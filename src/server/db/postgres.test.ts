import { test } from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { inspect } from "node:util";
import pg from "pg";
import { checkDbUrl, getDb, isQueryTimeout, pgDb, POOL_OPTIONS } from "./postgres";

test("postgres: the pool requires TLS, keeps connections alive, times queries out, and reads int8 as a number or refuses it", () => {
  assert.deepEqual(POOL_OPTIONS.ssl, { rejectUnauthorized: false }, "encrypted; checking the certificate is a later step");
  assert.equal(POOL_OPTIONS.keepAlive, true);
  assert.equal(POOL_OPTIONS.keepAliveInitialDelayMillis, 60_000, "probes start after a minute, not the OS default of two hours");
  assert.equal(POOL_OPTIONS.query_timeout, 60_000);
  const types = POOL_OPTIONS.types!;
  assert.equal(types.getTypeParser(20, "text")("9007199254740991"), 9007199254740991);
  assert.throws(() => types.getTypeParser(20, "text")("9007199254740993"), /too large/);
  assert.deepEqual(types.getTypeParser(1016 as never, "text")("{1,NULL,9007199254740991}"), [1, null, 9007199254740991], "int8[] too");
  // json and jsonb come back parsed, as on PGlite; other types keep node-postgres's own parsers.
  assert.deepEqual(types.getTypeParser(3802, "text")('[{"id":1}]'), [{ id: 1 }]);
  assert.deepEqual(types.getTypeParser(114, "text")('{"a":1}'), { a: 1 });
  assert.equal(types.getTypeParser(23, "text")("42"), 42);
});

type Script = (text: string, client: FakeClient) => unknown;

/** A stand-in for a pg client: records statements, can be scripted to fail, and emits like the real one. */
class FakeClient extends EventEmitter {
  log: string[] = [];
  releasedWith: unknown[] = [];
  constructor(private readonly script: Script = () => undefined) {
    super();
  }
  async query(textOrConfig: string | { text: string; values?: unknown[]; query_timeout?: number }, maybeValues?: unknown[]) {
    const config = typeof textOrConfig === "string" ? { text: textOrConfig, values: maybeValues } : textOrConfig;
    const { text, values } = config;
    const timeout = "query_timeout" in config && config.query_timeout ? ` timeout=${config.query_timeout}` : "";
    this.log.push((values === undefined ? text : `${text} ${JSON.stringify(values)}`) + timeout);
    const outcome = await this.script(text, this);
    if (outcome instanceof Error) throw outcome;
    return { rows: [{ ok: true }] };
  }
  release(err?: unknown) {
    this.releasedWith.push(err);
  }
}

function fakePool(script?: Script) {
  const clients: FakeClient[] = [];
  const pool = {
    connect: async () => {
      const client = new FakeClient(script);
      clients.push(client);
      return client as unknown as pg.PoolClient;
    },
  };
  return { pool, clients };
}

const refused = () => new pg.DatabaseError("refused by the server", 0, "error");

test("postgres: parameters go with their statement, and the timeout given for a read rides with it", async () => {
  const { pool, clients } = fakePool();
  const db = pgDb(pool);
  assert.deepEqual(await db.query("select $1::int as x", [1]), [{ ok: true }]);
  await db.query("select 1");
  // No parameters: node-postgres sends it as a simple query. Through the pooler that was no worse than the
  // extended protocol (8/8 against 5/8 on cold connections), so nothing forces the extended one.
  assert.deepEqual(clients.flatMap((c) => c.log), ["select $1::int as x [1]", "select 1 []"]);
  assert.deepEqual(clients.flatMap((c) => c.releasedWith), [undefined, undefined], "each connection goes back healthy");

  // A Db made with a per-query timeout (the page loader's) sends it with every statement.
  await pgDb(pool, false, 15_000).query("select $1::text", ["x"]);
  assert.equal(clients.at(-1)!.log[0], 'select $1::text ["x"] timeout=15000');
});

test("postgres: a server error that ends the session closes the connection instead of reusing it", async () => {
  const fatal = () => Object.assign(new pg.DatabaseError("terminating connection due to administrator command", 0, "error"), { severity: "FATAL" });
  const { pool, clients } = fakePool((text) => (text === "ended" ? fatal() : undefined));
  await assert.rejects(pgDb(pool).query("ended"), /terminating connection/);
  assert.ok(clients[0].releasedWith[0] instanceof Error, "a FATAL error means the server is closing the socket");
});

test("postgres: isQueryTimeout knows node-postgres's own timeout error", () => {
  assert.equal(isQueryTimeout(new Error("Query read timeout")), true);
  assert.equal(isQueryTimeout(new Error("Connection terminated")), false);
  assert.equal(isQueryTimeout("Query read timeout"), false);
});

test("postgres: a statement the server refuses keeps its connection; a failing connection is closed", async () => {
  const { pool, clients } = fakePool((text) => (text === "refuse" ? refused() : text === "drop" ? new Error("Connection terminated") : undefined));
  const db = pgDb(pool);
  await assert.rejects(db.query("refuse"), /refused by the server/);
  await assert.rejects(db.query("drop"), /Connection terminated/);
  assert.equal(clients[0].releasedWith[0], undefined, "a refused statement leaves the connection usable");
  assert.ok(clients[1].releasedWith[0] instanceof Error, "a dropped connection is not reused");
});

test("postgres: a transaction commits on one connection, joins an outer one, and rolls back on a throw", async () => {
  const { pool, clients } = fakePool((text) => (text.startsWith("boom") ? refused() : undefined));
  const db = pgDb(pool);
  const result = await db.transaction(async (outer) => {
    await outer.query("a");
    await outer.transaction(async (inner) => {
      await inner.query("b");
    });
    return "done";
  });
  assert.equal(result, "done");
  assert.deepEqual(clients[0].log, ["begin", "a []", "b []", "commit"]);
  assert.deepEqual(clients[0].releasedWith, [undefined]);

  await assert.rejects(db.transaction(async (tx) => tx.query("boom")), /refused by the server/);
  assert.deepEqual(clients[1].log, ["begin", "boom []", "rollback"]);
  assert.deepEqual(clients[1].releasedWith, [undefined], "rolled back cleanly: the connection is reused");
});

test("postgres: a connection that drops during a transaction is caught, and closed rather than reused", async () => {
  // The pool hands out a client with no error listener; without one, this emit would be an uncaught exception.
  const { pool, clients } = fakePool((text, client) => {
    if (text === "a") {
      // As pg does: the error event comes from the socket, later, while the client is still checked out.
      const dropped = new Error("Connection terminated unexpectedly");
      return new Promise((_, reject) => setImmediate(() => {
        client.emit("error", dropped);
        reject(dropped);
      }));
    }
    if (text === "rollback") return new Error("Client was closed");
    return undefined;
  });
  await assert.rejects(pgDb(pool).transaction(async (tx) => tx.query("a")), /terminated unexpectedly/);
  assert.ok(clients[0].releasedWith[0] instanceof Error);
  assert.equal(clients[0].listenerCount("error"), 0, "its listener is removed when it goes back");
});

test("postgres: a rollback that fails closes the connection", async () => {
  const { pool, clients } = fakePool((text) => (text === "boom" ? refused() : text === "rollback" ? new Error("socket hang up") : undefined));
  await assert.rejects(pgDb(pool).transaction(async (tx) => tx.query("boom")), /refused by the server/, "the first error is the one reported");
  assert.ok(clients[0].releasedWith[0] instanceof Error);
});

test("postgres: a statement that times out in a transaction closes the connection without waiting on a rollback", async () => {
  const { pool, clients } = fakePool((text) => (text.startsWith("slow") ? new Error("Query read timeout") : undefined));
  await assert.rejects(pgDb(pool).transaction(async (tx) => tx.query("slow")), /Query read timeout/);
  assert.deepEqual(clients[0].log, ["begin", "slow []"], "no rollback queued behind the timed-out statement");
  assert.ok(clients[0].releasedWith[0] instanceof Error);
});

test("postgres: SUPABASE_DB_URL is refused with a clean message when it is malformed or sets its own TLS", () => {
  const url = (s: string) => `postgresql://launchpad_app.ref:${s}@aws-0-test.pooler.supabase.com:6543/postgres`;
  assert.doesNotThrow(() => checkDbUrl(url("pw")));
  for (const bad of [url("p%E9w"), "postgresql://u:pa#ss@db.invalid:6543/x"]) {
    assert.throws(
      () => checkDbUrl(bad),
      (e: Error) => /isn't a valid connection string/.test(e.message) && !e.message.includes("p%E9w") && !e.message.includes("pa#ss"),
    );
  }
  assert.throws(() => checkDbUrl(`${url("pw")}?sslmode=disable`), /Remove \?sslmode= from SUPABASE_DB_URL/);
  assert.throws(() => checkDbUrl(`${url("pw")}?sslrootcert=x.crt`), /Remove \?sslrootcert=/);
  assert.throws(() => checkDbUrl(`${url("pw")}?sslnegotiation=direct`), /Remove \?sslnegotiation=/);
});

test("postgres: a malformed SUPABASE_DB_URL fails with a clean message that carries no part of the URL", () => {
  // Node's URL error keeps the whole URL in `input`, password included; logging it would leak it.
  const saved = process.env.SUPABASE_DB_URL;
  process.env.SUPABASE_DB_URL = "postgresql://u:pa#ss@db.invalid:6543/x";
  try {
    let caught: unknown;
    try {
      getDb();
    } catch (e) {
      caught = e;
    }
    assert.ok(caught instanceof Error, "getDb throws");
    assert.equal(
      caught.message,
      "SUPABASE_DB_URL isn't a valid connection string: check the port, and URL-encode any @, #, / or : in the password.",
    );
    assert.equal(caught.cause, undefined);
    for (const key of Object.getOwnPropertyNames(caught)) {
      assert.ok(!inspect((caught as unknown as Record<string, unknown>)[key]).includes("pa#ss"), `${key} carries the password`);
    }
    assert.ok(!inspect(caught, { showHidden: true }).includes("pa#ss"));
  } finally {
    if (saved === undefined) delete process.env.SUPABASE_DB_URL;
    else process.env.SUPABASE_DB_URL = saved;
  }
});
