import { test } from "node:test";
import assert from "node:assert/strict";
import { inspect } from "node:util";
import postgres from "postgres";
import { getDb, POOL_OPTIONS, postgresDb } from "./postgres";

test("postgres: the pool requires TLS, JSON text reaches json and jsonb parameters unchanged, and int8 reads as a number or is refused", async () => {
  // postgres.js connects on the first query, so this makes no connection.
  const sql = postgres({ ...POOL_OPTIONS, host: "localhost", database: "unused" });
  try {
    assert.equal(sql.options.ssl, "require");
    assert.equal(sql.options.prepare, false);
    assert.equal(sql.options.serializers[3802]('[{"id":1}]'), '[{"id":1}]');
    assert.equal(sql.options.serializers[114]('{"a":1}'), '{"a":1}');
    assert.equal(sql.options.serializers[3802]({ a: 1 }), '{"a":1}');
    assert.equal(sql.options.parsers[20]("9007199254740991"), 9007199254740991);
    assert.throws(() => sql.options.parsers[20]("9007199254740993"), /too large/);
  } finally {
    await sql.end({ timeout: 0 });
  }
});

test("postgres: a transaction inside a transaction joins the outer one, as on PGlite", async () => {
  // Shaped like postgres.js's handles: only the pool has begin(); a transaction handle has unsafe() and
  // savepoint() but no begin().
  const log: string[] = [];
  const tx = {
    unsafe: async (text: string) => { log.push(`tx:${text}`); return []; },
    savepoint: async () => { log.push("SAVEPOINT"); },
  };
  const pool = { unsafe: async () => [], begin: async (fn: (t: unknown) => unknown) => { log.push("BEGIN"); return fn(tx); } };
  const db = postgresDb(pool as never);
  const result = await db.transaction(async (outer) => {
    await outer.query("a");
    await outer.transaction(async (inner) => {
      await inner.query("b");
    });
    return "done";
  });
  assert.equal(result, "done");
  assert.deepEqual(log, ["BEGIN", "tx:a", "tx:b"]);

  // What reserve() gives is unsafe() alone: no begin() to start a transaction and no savepoint() to show it is in one.
  const reserved = { unsafe: async () => [] };
  await assert.rejects(postgresDb(reserved as never).transaction(async () => "x"), /needs the pool or a transaction handle/);
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
