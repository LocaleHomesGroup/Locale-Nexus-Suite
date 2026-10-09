import { test, type TestContext } from "node:test";
import assert from "node:assert/strict";
import net from "node:net";
import { inspect } from "node:util";
import { GET } from "../../app/api/files/monday/[assetId]/route";
import { closeDb } from "./db/postgres";

/**
 * The download route's answers that need no database query and no network: 503 for a missing setting, 404 for an id that
 * isn't a plain number, and 502 for a URL that doesn't parse (Ruling C6). The 409 (a file still being copied) and the 307
 * (a signed URL) need a row to read, so they are covered where the rows are: loadAssetPath's PGlite test in
 * read/live-data.test.ts.
 *
 * Nothing here may touch the network. The invented addresses are 127.0.0.1 on port 1, where nothing listens, so even a
 * stray connection would be refused at once with no DNS lookup and no packet leaving the machine. On top of that, every
 * test refuses and counts any fetch or socket connect, and expects none.
 */
const DB_URL = "postgresql://launchpad_app@127.0.0.1:1/x";
const STORAGE = { NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:1", SUPABASE_SERVICE_ROLE_KEY: "test-service-key" };
// The "#" ends the authority early, so this never parses (the shape Task 15's test uses).
const UNPARSABLE_DB_URL = "postgresql://u:pa#ss@db.invalid:6543/x";

const MISSING = { error: "Files need a database and Storage" };
const NOT_FOUND = { error: "File not found" };
const COULDNT_OPEN = { error: "Couldn't open that file right now. Try again in a moment." };

/** What no answer may carry: a URL, an address, a storage path, or text from a driver or from Storage. */
const LEAKS = /:\/\/|127\.0\.0\.1|\.invalid|monday-files|storage\/v1|\d+\/\d+\/|postgres|supabase|ECONN|ENOTFOUND|getaddrinfo|password/i;

/** Every setting the route reads. Each case clears them first, so it sees only what it names. */
const SETTINGS = ["SUPABASE_DB_URL", "NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"];

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

/** For the rest of the test: refuses and counts any fetch or socket connect, and silences and records console.error. */
function offline(t: TestContext) {
  const fetched = t.mock.method(globalThis, "fetch", async () => {
    throw new Error("the route reached for the network");
  });
  const connected = t.mock.method(net.Socket.prototype, "connect", () => {
    throw new Error("the route opened a connection");
  });
  const logged = t.mock.method(console, "error", () => {});
  return {
    /** Fetches and socket connects the route tried. */
    attempts: () => fetched.mock.callCount() + connected.mock.callCount(),
    /** What the route logged as an error: one array of arguments per call. */
    logs: () => logged.mock.calls.map((call) => call.arguments),
  };
}

/** Asks the route for one asset under exactly these settings, and checks the answer carries nothing it shouldn't. */
async function ask(assetId: string, settings: Record<string, string | undefined>) {
  let res!: Response;
  await withEnv({ ...Object.fromEntries(SETTINGS.map((k) => [k, undefined])), ...settings }, async () => {
    try {
      res = await GET(new Request(`http://localhost/api/files/monday/${assetId}`), { params: Promise.resolve({ assetId }) });
    } finally {
      // getDb() keeps its pool on globalThis and never reads the URL again, so a pool one case made would answer the next
      // case instead, and an unparsable URL would find it and never be parsed. Closing it clears that (the pool never
      // connected, so it ends at once).
      await closeDb();
    }
  });
  const body = await res.json();
  assert.doesNotMatch(JSON.stringify(body), LEAKS, `the ${res.status} body holds no URL, path or driver text`);
  return { status: res.status, body };
}

/** The route answered 502 with the generic body, logged the error once under its own prefix, and kept every secret out of the log. */
function assertCouldntOpen(answer: { status: number; body: unknown }, guard: ReturnType<typeof offline>, secrets: string[]) {
  assert.equal(answer.status, 502);
  assert.deepEqual(answer.body, COULDNT_OPEN);
  const logs = guard.logs();
  assert.equal(logs.length, 1, "logged once");
  assert.equal(logs[0][0], "[files] couldn't open a Monday file:");
  assert.ok(logs[0][1] instanceof Error, "with the error itself");
  for (const secret of secrets) assert.ok(!inspect(logs).includes(secret), "the log holds no password or key");
  assert.equal(guard.attempts(), 0, "no fetch and no socket connect");
}

test("files route: with no database URL it is a 503, whether or not Storage is set", async (t) => {
  const guard = offline(t);
  for (const settings of [{}, STORAGE]) {
    const { status, body } = await ask("9001", settings);
    assert.equal(status, 503, `with ${Object.keys(settings).length} Storage settings`);
    assert.deepEqual(body, MISSING);
  }
  assert.deepEqual([guard.attempts(), guard.logs()], [0, []], "no network, nothing logged");
});

test("files route: a database URL without both Storage settings is a 503", async (t) => {
  const guard = offline(t);
  const half = [{}, { NEXT_PUBLIC_SUPABASE_URL: STORAGE.NEXT_PUBLIC_SUPABASE_URL }, { SUPABASE_SERVICE_ROLE_KEY: STORAGE.SUPABASE_SERVICE_ROLE_KEY }];
  for (const storage of half) {
    const { status, body } = await ask("9001", { SUPABASE_DB_URL: DB_URL, ...storage });
    assert.equal(status, 503, `with Storage settings ${JSON.stringify(Object.keys(storage))}`);
    assert.deepEqual(body, MISSING);
  }
  assert.deepEqual([guard.attempts(), guard.logs()], [0, []], "no network, nothing logged");
});

test("files route: an id that isn't a plain number is a 404, before any query is made", async (t) => {
  const guard = offline(t);
  // loadAssetPath returns null for these before it queries, so the pool getDb() makes is never asked for a connection.
  for (const id of ["abc", "../9001", "0", "9001; drop table x"]) {
    const { status, body } = await ask(id, { SUPABASE_DB_URL: DB_URL, ...STORAGE });
    assert.equal(status, 404, `id ${JSON.stringify(id)}`);
    assert.deepEqual(body, NOT_FOUND);
  }
  assert.deepEqual([guard.attempts(), guard.logs()], [0, []], "no network, nothing logged");
});

test("files route: a connection string that doesn't parse is a 502 with the generic body, and the log keeps the password out (Ruling C6)", async (t) => {
  const guard = offline(t);
  const answer = await ask("9001", { SUPABASE_DB_URL: UNPARSABLE_DB_URL });
  assertCouldntOpen(answer, guard, ["pa#ss", "db.invalid"]);
});

test("files route: a Supabase URL that doesn't parse is a 502 with the generic body, and the log keeps the key out (Ruling C6)", async (t) => {
  const guard = offline(t);
  const answer = await ask("9001", { SUPABASE_DB_URL: DB_URL, NEXT_PUBLIC_SUPABASE_URL: "not a url", SUPABASE_SERVICE_ROLE_KEY: STORAGE.SUPABASE_SERVICE_ROLE_KEY });
  assertCouldntOpen(answer, guard, [STORAGE.SUPABASE_SERVICE_ROLE_KEY]);
});
