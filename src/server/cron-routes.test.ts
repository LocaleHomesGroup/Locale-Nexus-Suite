import { test, type TestContext } from "node:test";
import assert from "node:assert/strict";
import { GET as settleLots } from "../../app/api/land/settle/route";
import { GET as runMirror } from "../../app/api/mirror/[source]/route";
import { closeDb } from "./db/postgres";

const secret = ["a", "test", "cron", "secret"].join("-");

/**
 * A database URL nothing answers. Nothing listens on port 1 of this machine, so a query is refused at once and no
 * packet leaves it, and there is no password to leak. node-postgres connects only when it has a query to send.
 */
const NOBODY = "postgresql://launchpad_app@127.0.0.1:1/x";

/** Runs `fn` with these environment variables set (undefined means unset), then puts each one back as it was. */
async function withEnv(vars: Record<string, string | undefined>, fn: () => Promise<void>): Promise<void> {
  const before = Object.fromEntries(Object.keys(vars).map((k) => [k, process.env[k]]));
  const apply = (values: Record<string, string | undefined>) => {
    for (const [k, v] of Object.entries(values)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  };
  apply(vars);
  try {
    await fn();
  } finally {
    apply(before);
  }
}

const withHeader = (authorization: string | undefined): RequestInit => ({ headers: authorization === undefined ? undefined : { authorization } });
const settleRequest = (authorization?: string) => new Request("http://localhost/api/land/settle", withHeader(authorization));
const mirrorRequest = (authorization?: string) => new Request("http://localhost/api/mirror/monday?mode=changes", withHeader(authorization));
const context = { params: Promise.resolve({ source: "monday" }) };

test("cron routes: no bearer, a wrong one, or the bare secret is a 401, before the database is looked at", async () => {
  // No database is configured, so a request that got past the check would be a 503: a 401 means it stopped at the check.
  await withEnv({ CRON_SECRET: secret, SUPABASE_DB_URL: undefined }, async () => {
    for (const authorization of [undefined, "Bearer wrong", secret, `Bearer ${secret}x`]) {
      const settle = await settleLots(settleRequest(authorization));
      assert.equal(settle.status, 401, `settle with ${authorization}`);
      assert.deepEqual(await settle.json(), { error: "Unauthorized" });
      const mirror = await runMirror(mirrorRequest(authorization), context);
      assert.equal(mirror.status, 401, `mirror with ${authorization}`);
    }
  });
});

test("cron routes: with no CRON_SECRET configured, nothing gets in, not even an empty bearer", async () => {
  await withEnv({ CRON_SECRET: undefined, SUPABASE_DB_URL: undefined }, async () => {
    for (const authorization of [undefined, "Bearer ", `Bearer ${secret}`]) {
      assert.equal((await settleLots(settleRequest(authorization))).status, 401, `settle with ${authorization}`);
      assert.equal((await runMirror(mirrorRequest(authorization), context)).status, 401, `mirror with ${authorization}`);
    }
  });
});

test("cron routes: the right bearer but no database is a 503 that says so", async () => {
  await withEnv({ CRON_SECRET: secret, SUPABASE_DB_URL: undefined }, async () => {
    const settle = await settleLots(settleRequest(`Bearer ${secret}`));
    assert.equal(settle.status, 503);
    assert.deepEqual(await settle.json(), { error: "No database is configured" });
    const mirror = await runMirror(mirrorRequest(`Bearer ${secret}`), context);
    assert.equal(mirror.status, 503);
    assert.deepEqual(await mirror.json(), { error: "No database is configured" });
  });
});

/**
 * The mirror route past its gate: the right bearer and a database that is configured but can't be reached. Returns the
 * response, its JSON, and what the route logged as an error (the log is silenced for the test).
 */
async function pastTheGate(t: TestContext, source: string, query: string) {
  const logged = t.mock.method(console, "error", () => {});
  let res!: Response;
  // An invented token, so a request that gets as far as a database query is not stopped by the missing token first.
  await withEnv({ CRON_SECRET: secret, SUPABASE_DB_URL: NOBODY, MONDAY_API_TOKEN: "test-token" }, async () => {
    try {
      res = await runMirror(
        new Request(`http://localhost/api/mirror/${source}${query}`, withHeader(`Bearer ${secret}`)),
        { params: Promise.resolve({ source }) },
      );
    } finally {
      await closeDb();
    }
  });
  return { res, body: await res.json(), logs: logged.mock.calls.map((call) => call.arguments) };
}

test("cron routes: past the gate, an unknown source answers 500 with the failure in the body, and logs one line", async (t) => {
  const { res, body, logs } = await pastTheGate(t, "x", "?mode=changes");
  assert.equal(res.status, 500);
  assert.deepEqual(body, { status: "failed", calls: 0, seen: 0, changed: 0, note: null, error: 'unknown source "x"' });
  assert.deepEqual(logs, [["[mirror] x changes failed:", 'unknown source "x"']], "the message, never the object");
});

test("cron routes: past the gate, a request with no mode answers 500 with the unknown mode, and logs it", async (t) => {
  const { res, body, logs } = await pastTheGate(t, "monday", "");
  assert.equal(res.status, 500);
  assert.equal(body.status, "failed");
  assert.equal(body.error, 'unknown Monday mode ""');
  assert.deepEqual(logs, [["[mirror] monday  failed:", 'unknown Monday mode ""']]);
});

test("cron routes: past the gate, HubSpot is a source of its own, and its one mode is changes", async (t) => {
  const { res, body, logs } = await pastTheGate(t, "hubspot", "?mode=daily");
  assert.equal(res.status, 500);
  assert.equal(body.status, "failed");
  assert.equal(body.error, 'unknown HubSpot mode "daily"');
  assert.deepEqual(logs, [["[mirror] hubspot daily failed:", 'unknown HubSpot mode "daily"']]);
});

test("cron routes: a database that refuses connections is a 500 with the failure in the body, not a bare error", { timeout: 20_000 }, async (t) => {
  const { res, body, logs } = await pastTheGate(t, "monday", "?mode=changes");
  assert.equal(res.status, 500);
  assert.equal(body.status, "failed");
  assert.match(body.error, /ECONNREFUSED/);
  assert.deepEqual(logs, [["[mirror] monday changes failed:", body.error]]);
});

// Final review, Minor 4: whatever throws past the gate is a JSON 500 with a generic message, and one log line that holds
// the message only: never Next's bare 500, and never an error object (with its stack) in the log.

/** The "#" ends the authority early, so this never parses (the shape the files route's test uses). The password is invented. */
const UNPARSABLE = "postgresql://u:pa#ss@db.invalid:6543/x";
const URL_REFUSED = "SUPABASE_DB_URL isn't a valid connection string: check the port, and URL-encode any @, #, / or : in the password.";
const MIRROR_FAILED = { error: "The mirror run failed before it could answer. The function log has the reason." };
const SETTLE_FAILED = { error: "Settling the holds failed. The function log has the reason." };

/** Runs `fn` with the right bearer and this database URL, then closes whatever pool it made. Returns what was logged. */
async function withDatabase(t: TestContext, url: string, fn: () => Promise<void>): Promise<unknown[][]> {
  const logged = t.mock.method(console, "error", () => {});
  await withEnv({ CRON_SECRET: secret, SUPABASE_DB_URL: url, MONDAY_API_TOKEN: "test-token" }, async () => {
    try {
      await fn();
    } finally {
      await closeDb();
    }
  });
  return logged.mock.calls.map((call) => call.arguments);
}

test("cron routes: a database URL that doesn't parse is a JSON 500 from both routes, with one message-only log line each", async (t) => {
  const answers: { status: number; body: unknown }[] = [];
  const logs = await withDatabase(t, UNPARSABLE, async () => {
    for (const res of [await runMirror(mirrorRequest(`Bearer ${secret}`), context), await settleLots(settleRequest(`Bearer ${secret}`))]) {
      answers.push({ status: res.status, body: await res.json() });
    }
  });
  assert.deepEqual(answers, [{ status: 500, body: MIRROR_FAILED }, { status: 500, body: SETTLE_FAILED }]);
  assert.deepEqual(logs, [["[mirror] monday changes failed:", URL_REFUSED], ["[land] settle failed:", URL_REFUSED]]);
  assert.ok(!JSON.stringify(logs).includes("pa#ss") && !JSON.stringify(logs).includes("db.invalid"), "no part of the URL is logged");
});

test("cron routes: a database that refuses connections is a JSON 500 from settle too, with one message-only log line", { timeout: 20_000 }, async (t) => {
  let res!: Response;
  const logs = await withDatabase(t, NOBODY, async () => {
    res = await settleLots(settleRequest(`Bearer ${secret}`));
  });
  assert.equal(res.status, 500);
  assert.deepEqual(await res.json(), SETTLE_FAILED);
  assert.equal(logs.length, 1, "one line");
  assert.equal(logs[0][0], "[land] settle failed:");
  assert.equal(typeof logs[0][1], "string", "the message, never the error object with its stack");
  assert.match(String(logs[0][1]), /ECONNREFUSED/);
});
