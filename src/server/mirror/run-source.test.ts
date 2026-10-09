import { after, before, beforeEach, test, type TestContext } from "node:test";
import assert from "node:assert/strict";
import { migratedTestDb } from "../db/pglite";
import type { Db } from "../db/types";
import { readServerEnv } from "../env";
import { HUBSPOT_API } from "./hubspot/client";
import { MONDAY_API_URL, MondayCapReachedError, MondayDailyLimitError, MondayDeadlineError } from "./monday/client";
import { mondayClientFor, runSource } from "./run-source";
import { beginRun } from "./runs";

let db: Db;
let close: () => Promise<void>;
before(async () => {
  ({ db, close } = await migratedTestDb());
  await db.query("insert into mirror.monday_workspaces (id, name) values (1, 'Test workspace')");
  await db.query(
    "insert into mirror.monday_boards (id, workspace_id, name, board_key, purpose, sync_enabled) values (10, 1, 'Test sales', 'test_sales', 'sales', true)",
  );
  await db.query("insert into mirror.monday_items (id, board_id, name, monday_updated_at) values (1001, 10, 'Test item', now())");
});
after(async () => close());

/** Each test starts with no calls counted, no runs, no leases and no files. */
beforeEach(async () => {
  await db.query("delete from mirror.monday_assets");
  await db.query("delete from mirror.api_calls");
  await db.query("delete from mirror.sync_runs");
  await db.query("delete from mirror.sync_locks");
});

const STORAGE_HOST = "runner.example.test";
const HUBSPOT_HOST = new URL(HUBSPOT_API).host;
const fakeKey = ["not", "a", "real", "key"].join("-");
const mondayEnv = (cap = "100") => readServerEnv({ MONDAY_API_TOKEN: "test-token", MONDAY_DAILY_CALL_CAP: cap });
/** HubSpot's settings, invented, with any of them overridden. */
const hubspotEnv = (over: Record<string, string> = {}) => readServerEnv({ HUBSPOT_TOKEN: "test-hubspot-token", HUBSPOT_PORTAL_ID: "1", ...over });
const storageEnv = () =>
  readServerEnv({
    MONDAY_API_TOKEN: "test-token",
    MONDAY_DAILY_CALL_CAP: "100",
    NEXT_PUBLIC_SUPABASE_URL: `https://${STORAGE_HOST}`,
    SUPABASE_SERVICE_ROLE_KEY: fakeKey,
  });

/**
 * Stands in for Monday, Supabase Storage and HubSpot by replacing the global fetch for one test (no network: a request
 * to anything else, or to a service the test gave no answer for, fails the test, so every real host is refused).
 * `monday` returns the `data` of its answer, or a whole Response. Returns what was asked, in order.
 */
function fakeServices(
  t: TestContext,
  answers: {
    monday?: (document: string, variables: Record<string, unknown>) => unknown;
    storage?: (method: string, path: string) => Response;
    hubspot?: (method: string, path: string) => Response;
  } = {},
) {
  const requests: string[] = [];
  t.mock.method(globalThis, "fetch", async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    const method = init?.method ?? "GET";
    if (url.href === MONDAY_API_URL && answers.monday) {
      const sent = JSON.parse(String(init?.body)) as { query: string; variables: Record<string, unknown> };
      requests.push("monday");
      const out = answers.monday(sent.query, sent.variables);
      return out instanceof Response ? out : Response.json({ data: out });
    }
    if (url.host === STORAGE_HOST && answers.storage) {
      requests.push(`storage ${method} ${url.pathname}`);
      return answers.storage(method, url.pathname);
    }
    if (url.host === HUBSPOT_HOST && answers.hubspot) {
      requests.push(`hubspot ${method} ${url.pathname}`);
      return answers.hubspot(method, url.pathname);
    }
    throw new Error(`unexpected request in a test: ${method} ${url}`);
  });
  return requests;
}

const rateLimited = () =>
  Response.json({ errors: [{ message: "Rate limit", extensions: { code: "RATE_LIMIT_EXCEEDED", retry_in_seconds: 60 } }] }, { status: 429 });
const dailyLimit = () =>
  Response.json({ errors: [{ message: "Daily limit exceeded", extensions: { code: "DAILY_LIMIT_EXCEEDED" } }] }, { status: 429 });
const bucketIsPrivate = () =>
  Response.json({ id: "monday-files", name: "monday-files", owner: "", public: false, created_at: "2026-10-01T00:00:00Z", updated_at: "2026-10-01T00:00:00Z" });
const storageRefuses = () => Response.json({ statusCode: "403", error: "Unauthorized", message: "not allowed" }, { status: 403 });

const callsToday = async () =>
  (await db.query<{ n: number }>("select coalesce(sum(calls), 0)::float8 as n from mirror.api_calls where source = 'monday'"))[0].n;
const runRows = () =>
  db.query<{ mode: string; trigger: string; status: string; api_calls: number; note: string | null; error: string | null; finished: boolean }>(
    "select mode, trigger, status, api_calls, note, error, finished_at is not null as finished from mirror.sync_runs order by id",
  );
const leases = async () => (await db.query<{ source: string }>("select source from mirror.sync_locks order by source")).map((l) => l.source);
const addAssets = async (count: number) => {
  for (let i = 1; i <= count; i++) {
    await db.query("insert into mirror.monday_assets (id, item_id, column_id, name) values ($1, 1001, 'files', $2)", [9000 + i, `file-${i}.pdf`]);
  }
};
const attempts = async () => (await db.query<{ n: number }>("select download_attempts as n from mirror.monday_assets order by id")).map((r) => r.n);

/** A Db whose every statement fails with this, as when the database can't be reached. */
const unreachableDb = (failure: string | Error): Db => {
  const error = typeof failure === "string" ? new Error(failure) : failure;
  return {
    query: async () => {
      throw error;
    },
    transaction: async () => {
      throw error;
    },
  };
};

/** `inner`, with the statements `fail` picks made to throw instead of running. */
function failing(inner: Db, fail: (text: string) => Error | undefined): Db {
  return {
    query: async <T>(text: string, params?: readonly unknown[]) => {
      const failure = fail(text);
      if (failure) throw failure;
      return inner.query<T>(text, params);
    },
    transaction: (fn) => inner.transaction(fn),
  };
}
/** The statement that ends a run fails: the run can't be recorded (the lease is still freed, by its own statement). */
const cantRecordRuns = (text: string) => (text.includes("update mirror.sync_runs") ? new Error("connection reset") : undefined);

test("runSource: an unknown source or Monday mode fails at once, before any call or run", async (t) => {
  const requests = fakeServices(t);
  const env = mondayEnv();
  const source = await runSource(db, env, "nope", "changes", "cli");
  assert.deepEqual(source, { status: "failed", calls: 0, seen: 0, changed: 0, note: null, error: 'unknown source "nope"' });
  for (const mode of ["wipe", "", "daily"]) {
    const r = await runSource(db, env, "monday", mode, "cli");
    assert.equal(r.status, "failed");
    assert.equal(r.error, `unknown Monday mode "${mode}"`);
  }
  assert.deepEqual(requests, []);
  assert.deepEqual(await runRows(), []);
});

test("runSource: without a Monday token it says which setting is missing, whatever the mode", async (t) => {
  const requests = fakeServices(t);
  const env = readServerEnv({});
  for (const mode of ["backfill", "changes", "safety", "sweep", "files"]) {
    const r = await runSource(db, env, "monday", mode, "cli");
    assert.equal(r.status, "failed", mode);
    assert.equal(r.error, "MONDAY_API_TOKEN is not set", mode);
  }
  assert.deepEqual(requests, []);
  assert.deepEqual(await runRows(), []);
});

test("runSource: a files run without Storage settings fails before it takes a lease or a run", async (t) => {
  const requests = fakeServices(t);
  const r = await runSource(db, mondayEnv(), "monday", "files", "cli");
  assert.equal(r.status, "failed");
  assert.match(r.error ?? "", /^Storage isn't configured: set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY/);
  assert.deepEqual(requests, []);
  assert.deepEqual(await runRows(), []);
});

test("mondayClientFor: no token, no client", () => {
  assert.equal(mondayClientFor(db, readServerEnv({})), null);
  assert.ok(mondayClientFor(db, mondayEnv()));
});

test("mondayClientFor: --max-calls stops the run after that many calls, in its own words, and the third is never sent or counted", async (t) => {
  const requests = fakeServices(t, { monday: () => ({ me: { id: "1" } }) });
  const monday = mondayClientFor(db, mondayEnv(), 2);
  assert.ok(monday);
  await monday.query("query { me { id } }");
  await monday.query("query { me { id } }");
  await assert.rejects(
    monday.query("query { me { id } }"),
    (e: unknown) => e instanceof MondayCapReachedError && e.code === "MAX_CALLS" && e.message === "Stopped after --max-calls 2, as asked.",
  );
  assert.equal(requests.length, 2);
  assert.equal(await callsToday(), 2);
});

test("mondayClientFor: a trial run's limit doesn't hide the day's cap", async (t) => {
  const requests = fakeServices(t, { monday: () => ({ me: { id: "1" } }) });
  const monday = mondayClientFor(db, mondayEnv("1"), 5);
  assert.ok(monday);
  await monday.query("query { me { id } }");
  await assert.rejects(monday.query("query { me { id } }"), (e: unknown) => e instanceof MondayCapReachedError && e.code === "CAP_REACHED");
  assert.equal(requests.length, 1);
});

test("mondayClientFor: Monday's daily limit is recorded in the ledger, and refuses every later call, with or without --max-calls", async (t) => {
  const requests = fakeServices(t, { monday: dailyLimit });
  const trial = mondayClientFor(db, mondayEnv(), 5);
  assert.ok(trial);
  await assert.rejects(trial.query("query { me { id } }"), MondayDailyLimitError);
  const [row] = await db.query<{ hit: boolean }>("select limit_hit_at is not null as hit from mirror.api_calls where source = 'monday'");
  assert.equal(row.hit, true, "the wrapper passed dailyLimitHit on to the database ledger");

  // A new client, with no limit of its own, is refused from the ledger without sending anything.
  const later = mondayClientFor(db, mondayEnv());
  assert.ok(later);
  await assert.rejects(later.query("query { me { id } }"), (e: unknown) => e instanceof MondayCapReachedError && e.code === "CAP_REACHED");
  assert.equal(requests.length, 1);
});

test("mondayClientFor: the run's deadline reaches the client, so nothing is claimed or sent after it", async (t) => {
  const requests = fakeServices(t, { monday: () => ({ me: { id: "1" } }) });
  const monday = mondayClientFor(db, mondayEnv(), undefined, new Date(Date.now() - 1000));
  assert.ok(monday);
  await assert.rejects(monday.query("query { me { id } }"), MondayDeadlineError);
  assert.deepEqual(requests, []);
  assert.equal(await callsToday(), 0);
});

test("runSource: a run's deadline also cuts short the client's own wait, so a rate-limited pass ends partial at once", { timeout: 20_000 }, async (t) => {
  // Monday says to wait 60 s. The deadline is 5 s away: the client must refuse the wait, not sit it out.
  const requests = fakeServices(t, { monday: rateLimited });
  const started = Date.now();
  const r = await runSource(db, mondayEnv(), "monday", "backfill", "cron", { deadline: new Date(Date.now() + 5000) });
  assert.ok(Date.now() - started < 4000, "it did not wait out the 60 s");
  assert.equal(r.status, "partial");
  assert.match(r.note ?? "", /time limit/);
  assert.equal(r.calls, 1);
  assert.equal(requests.length, 1);
  const [run] = await runRows();
  assert.deepEqual([run.mode, run.trigger, run.status, run.finished], ["backfill", "cron", "partial", true]);
  assert.deepEqual(await leases(), []);
});

test("runSource: --max-calls ends a pass partial with the trial run's own message, and the run is recorded", async (t) => {
  const requests = fakeServices(t, { monday: () => ({ boards: [{ items_page: { cursor: "page-2", items: [] } }] }) });
  const lines: string[] = [];
  const r = await runSource(db, mondayEnv(), "monday", "backfill", "cli", { maxCalls: 1, log: (line) => lines.push(line) });
  assert.deepEqual(r, { status: "partial", calls: 1, seen: 0, changed: 0, note: null, error: "Stopped after --max-calls 1, as asked." });
  assert.equal(requests.length, 1, "the second page was never asked for");
  assert.deepEqual(lines, ["backfill test_sales"], "the pass logs to the caller's log");
  const [run] = await runRows();
  assert.deepEqual([run.mode, run.trigger, run.status, run.api_calls], ["backfill", "cli", "partial", 1]);
  assert.deepEqual(await leases(), []);
});

test("runSource: a board key limits the pass to that board", async (t) => {
  const requests = fakeServices(t, { monday: () => ({ boards: [{ items_page: { cursor: null, items: [] } }] }) });
  const none = await runSource(db, mondayEnv(), "monday", "backfill", "cli", { boardKey: "no_such_board" });
  assert.equal(none.status, "skipped");
  assert.equal(requests.length, 0);
  const one = await runSource(db, mondayEnv(), "monday", "backfill", "cli", { boardKey: "test_sales" });
  assert.equal(one.status, "ok");
  assert.ok(requests.length > 0);
});

test("runSource: a files run has a lease of its own, so it runs beside a changes pass but not beside another files run", async (t) => {
  const requests = fakeServices(t); // nothing is waiting, so Monday and Storage are never asked
  const changes = await beginRun(db, "monday", "changes", "cron", 60);
  assert.ok(changes, "a changes pass is under way");

  const beside = await runSource(db, storageEnv(), "monday", "files", "cli");
  assert.deepEqual(beside, { status: "ok", calls: 0, seen: 0, changed: 0, note: "0 downloaded, 0 too large, 0 failed, 0 waiting", error: null });

  const files = await beginRun(db, "monday", "files", "cron", 60, "monday:files");
  assert.ok(files, "and now a files run is");
  const again = await runSource(db, storageEnv(), "monday", "files", "cli");
  assert.deepEqual(again, { status: "skipped", calls: 0, seen: 0, changed: 0, note: "another files run is going", error: null });

  assert.deepEqual(requests, []);
  assert.deepEqual(await leases(), ["monday", "monday:files"], "only the two simulated runs still hold a lease");
  assert.deepEqual(
    (await runRows()).map((r) => [r.mode, r.trigger, r.status]),
    [
      ["changes", "cron", "running"],
      ["files", "cli", "ok"],
      ["files", "cron", "running"],
      ["files", "cli", "skipped"],
    ],
  );
});

test("runSource: Storage that can't take files fails the files run, charges no file, and frees the lease", async (t) => {
  await addAssets(2);
  const requests = fakeServices(t, {
    monday: () => assert.fail("Monday was asked before Storage was checked"),
    storage: storageRefuses,
  });
  const r = await runSource(db, storageEnv(), "monday", "files", "cli");
  assert.equal(r.status, "failed");
  assert.match(r.error ?? "", /^Storage: not allowed/);
  assert.ok(requests.length > 0 && requests.every((q) => q.startsWith("storage")));
  assert.deepEqual(await attempts(), [0, 0]);
  const [run] = await runRows();
  assert.deepEqual([run.mode, run.status, run.finished], ["files", "failed", true]);
  assert.match(run.error ?? "", /^Storage: not allowed/);
  assert.deepEqual(await leases(), []);
});

test("runSource: a files run stopped by --max-calls is partial, not failed, like a pass", async (t) => {
  // 51 files make two Monday calls (50 a call). Monday returns none of them, so each is charged one attempt.
  await addAssets(51);
  const requests = fakeServices(t, { monday: () => ({ assets: [] }), storage: bucketIsPrivate });
  const r = await runSource(db, storageEnv(), "monday", "files", "cli", { maxCalls: 1, maxFiles: 100 });
  assert.deepEqual(r, { status: "partial", calls: 1, seen: 0, changed: 0, note: null, error: "Stopped after --max-calls 1, as asked." });
  assert.equal(requests.filter((q) => q === "monday").length, 1);
  assert.equal((await attempts()).filter((n) => n === 1).length, 50, "the first call's 50 files were tried; the 51st waits");
  const [run] = await runRows();
  assert.deepEqual([run.mode, run.status, run.api_calls, run.finished], ["files", "partial", 1, true]);
  assert.deepEqual(await leases(), []);
});

test("runSource: --max-files caps how many files one run takes up", async (t) => {
  await addAssets(3);
  fakeServices(t, { monday: () => ({ assets: [] }), storage: bucketIsPrivate });
  const r = await runSource(db, storageEnv(), "monday", "files", "cli", { maxFiles: 1 });
  // Monday returned nothing for the one file taken up, so it was charged an attempt; the other two weren't touched.
  assert.deepEqual(r, { status: "partial", calls: 1, seen: 1, changed: 0, note: "0 downloaded, 0 too large, 1 failed, 3 waiting", error: null });
  assert.deepEqual((await attempts()).sort(), [0, 0, 1]);
});

test("runSource: a files run's deadline is handed to the downloader, which starts nothing past it", async (t) => {
  await addAssets(2);
  const requests = fakeServices(t, { monday: () => assert.fail("Monday was asked past the deadline"), storage: bucketIsPrivate });
  const r = await runSource(db, storageEnv(), "monday", "files", "cron", { deadline: new Date(Date.now() - 1000) });
  assert.deepEqual(r, { status: "ok", calls: 0, seen: 0, changed: 0, note: "0 downloaded, 0 too large, 0 failed, 2 waiting", error: null });
  assert.deepEqual(await attempts(), [0, 0]);
  assert.ok(!requests.includes("monday"));
});

test("runSource: a files run reaching its deadline inside a Monday call is partial too", { timeout: 20_000 }, async (t) => {
  await addAssets(1);
  fakeServices(t, { monday: rateLimited, storage: bucketIsPrivate });
  const r = await runSource(db, storageEnv(), "monday", "files", "cron", { deadline: new Date(Date.now() + 5000) });
  assert.equal(r.status, "partial");
  assert.match(r.note ?? "", /time limit/);
  assert.equal(r.error, null);
  assert.deepEqual(await attempts(), [0], "no file was charged for Monday's rate limit");
});

test("runSource: it never rejects: with the database unreachable, every Monday pass, a files run and HubSpot's pass resolve failed with the message", async (t) => {
  const requests = fakeServices(t); // nothing may be sent
  const down = unreachableDb("connection refused");
  for (const mode of ["backfill", "changes", "safety", "sweep", "files"]) {
    const r = await runSource(down, storageEnv(), "monday", mode, "cron");
    assert.deepEqual(r, { status: "failed", calls: 0, seen: 0, changed: 0, note: null, error: "connection refused" }, mode);
  }
  const hubspot = await runSource(down, hubspotEnv(), "hubspot", "changes", "cron");
  assert.deepEqual(hubspot, { status: "failed", calls: 0, seen: 0, changed: 0, note: null, error: "connection refused" }, "hubspot");
  assert.deepEqual(requests, []);
});

test("runSource: a failure with no message still says something: its code, or else its name", async (t) => {
  fakeServices(t);
  // How Node reports a refused connection to a host with several addresses: no message, but a code.
  const refused = Object.assign(new AggregateError([new Error("one"), new Error("two")], ""), { code: "ECONNREFUSED" });
  const withCode = await runSource(unreachableDb(refused), mondayEnv(), "monday", "changes", "cron");
  assert.deepEqual([withCode.status, withCode.error], ["failed", "ECONNREFUSED"]);
  const bare = await runSource(unreachableDb(new Error("")), mondayEnv(), "monday", "changes", "cron");
  assert.deepEqual([bare.status, bare.error], ["failed", "Error"]);
});

test("runSource: a client that can't be made (a deadline that isn't a date) is a failed result too, not a throw", async (t) => {
  const requests = fakeServices(t);
  const r = await runSource(db, mondayEnv(), "monday", "changes", "cron", { deadline: new Date(Number.NaN) });
  assert.deepEqual(r, { status: "failed", calls: 0, seen: 0, changed: 0, note: null, error: "deadline must be a valid Date" });
  assert.deepEqual(requests, []);
});

test("runSource: a token the client refuses (a line break in it) is a failed result, and its message quotes none of the token", async (t) => {
  const requests = fakeServices(t);
  const token = "test-token-abc\ndef"; // invented
  const env = readServerEnv({
    MONDAY_API_TOKEN: token,
    MONDAY_DAILY_CALL_CAP: "100",
    NEXT_PUBLIC_SUPABASE_URL: `https://${STORAGE_HOST}`,
    SUPABASE_SERVICE_ROLE_KEY: fakeKey,
  });
  for (const mode of ["changes", "files"]) {
    const r = await runSource(db, env, "monday", mode, "cron");
    assert.equal(r.status, "failed", mode);
    assert.match(r.error ?? "", /MONDAY_API_TOKEN/, mode);
    assert.ok(!(r.error ?? "").includes("test-token-abc") && !(r.error ?? "").includes("def"), `${mode}: the message quotes none of the token`);
  }
  assert.deepEqual(requests, [], "nothing was sent");
  assert.deepEqual(await runRows(), [], "and no run was opened");
});

test("runSource: Storage that can't be set up (a URL that isn't one) fails a files run as a result, not a throw", async (t) => {
  const requests = fakeServices(t);
  const env = readServerEnv({
    MONDAY_API_TOKEN: "test-token",
    MONDAY_DAILY_CALL_CAP: "100",
    NEXT_PUBLIC_SUPABASE_URL: "not a url",
    SUPABASE_SERVICE_ROLE_KEY: fakeKey,
  });
  const r = await runSource(db, env, "monday", "files", "cron");
  assert.equal(r.status, "failed");
  assert.match(r.error ?? "", /supabaseUrl/i);
  assert.deepEqual(requests, []);
  assert.deepEqual(await runRows(), [], "no run was opened");
});

test("runSource: a service-role key with a line break is refused by name before any run opens, and none of it is quoted", async (t) => {
  // A file is waiting, so a files run that got past the key check would reach Storage with it.
  await addAssets(1);
  const requests = fakeServices(t); // nothing may be sent
  const key = "test-key-abc\ndef"; // invented
  const env = readServerEnv({
    MONDAY_API_TOKEN: "test-token",
    MONDAY_DAILY_CALL_CAP: "100",
    NEXT_PUBLIC_SUPABASE_URL: `https://${STORAGE_HOST}`,
    SUPABASE_SERVICE_ROLE_KEY: key,
  });
  const r = await runSource(db, env, "monday", "files", "cli");
  assert.equal(r.status, "failed");
  assert.match(r.error ?? "", /SUPABASE_SERVICE_ROLE_KEY/);
  assert.ok(!(r.error ?? "").includes("test-key") && !(r.error ?? "").includes("def"), "the message quotes none of the key");
  assert.deepEqual(requests, [], "fetch was never called");
  assert.deepEqual(await runRows(), [], "no run was opened");
  assert.deepEqual(await attempts(), [0], "and the waiting file wasn't charged an attempt");
});

test("runSource: a files run whose run can't be recorded still returns what it did, adds that to error, and frees the lease", async (t) => {
  await addAssets(3);
  fakeServices(t, { monday: () => ({ assets: [] }), storage: bucketIsPrivate });
  const r = await runSource(failing(db, cantRecordRuns), storageEnv(), "monday", "files", "cli", { maxFiles: 1 });
  assert.deepEqual(r, {
    status: "partial",
    calls: 1,
    seen: 1,
    changed: 0,
    note: "0 downloaded, 0 too large, 1 failed, 3 waiting",
    error: "the run couldn't be recorded: connection reset",
  });
  assert.deepEqual((await attempts()).sort(), [0, 0, 1], "the work itself stands");
  assert.deepEqual(await leases(), [], "and the lease was freed at once");
});

test("runSource: a files run that failed keeps its own error when its run can't be recorded either", async (t) => {
  await addAssets(2);
  fakeServices(t, { monday: () => assert.fail("Monday was asked before Storage was checked"), storage: storageRefuses });
  const r = await runSource(failing(db, cantRecordRuns), storageEnv(), "monday", "files", "cli");
  assert.equal(r.status, "failed");
  assert.equal(r.error, "Storage: not allowed; the run couldn't be recorded: connection reset");
  assert.deepEqual(await leases(), []);
});

test("runSource: HubSpot without its token or its portal id fails, naming both settings, and sends nothing", async (t) => {
  const requests = fakeServices(t);
  for (const env of [readServerEnv({}), readServerEnv({ HUBSPOT_TOKEN: "test-hubspot-token" }), readServerEnv({ HUBSPOT_PORTAL_ID: "1" })]) {
    const r = await runSource(db, env, "hubspot", "changes", "cron");
    assert.deepEqual(r, { status: "failed", calls: 0, seen: 0, changed: 0, note: null, error: "HUBSPOT_TOKEN and HUBSPOT_PORTAL_ID must both be set" });
  }
  assert.deepEqual(requests, []);
  assert.deepEqual(await runRows(), [], "and no run was opened");
});

test("runSource: an unknown HubSpot mode fails at once, and the mode is judged before the settings", async (t) => {
  const requests = fakeServices(t);
  for (const mode of ["backfill", "daily", ""]) {
    // With no settings at all, the mode is still what the message names.
    const r = await runSource(db, readServerEnv({}), "hubspot", mode, "cron");
    assert.deepEqual([r.status, r.error], ["failed", `unknown HubSpot mode "${mode}"`], mode);
  }
  assert.deepEqual(requests, []);
  assert.deepEqual(await runRows(), []);
});

test("runSource: a HubSpot token the client refuses (a line break in it) is a failed result, and its message quotes none of the token", async (t) => {
  const requests = fakeServices(t);
  const token = "test-token-abc\ndef"; // invented
  const r = await runSource(db, hubspotEnv({ HUBSPOT_TOKEN: token }), "hubspot", "changes", "cron");
  assert.equal(r.status, "failed");
  assert.match(r.error ?? "", /HUBSPOT_TOKEN/);
  assert.ok(!(r.error ?? "").includes("test-token-abc") && !(r.error ?? "").includes("def"), "the message quotes none of the token");
  assert.deepEqual(requests, [], "nothing was sent");
  assert.deepEqual(await runRows(), [], "and no run was opened");
});

test("runSource: a HubSpot pass already past its deadline ends partial with the time-limit note, sends nothing, and still writes its run", async (t) => {
  const requests = fakeServices(t); // HubSpot is given no answer: a request to it would fail the test
  const r = await runSource(db, hubspotEnv(), "hubspot", "changes", "cron", { deadline: new Date(Date.now() - 1000) });
  assert.deepEqual(r, {
    status: "partial",
    calls: 0,
    seen: 0,
    changed: 0,
    note: "stopped at the run's time limit; the next run picks up from here",
    error: null,
  });
  assert.deepEqual(requests, [], "the client threw before anything was sent");
  const runs = await db.query<{ source: string; mode: string; trigger: string; status: string; finished: boolean }>(
    "select source, mode, trigger, status, finished_at is not null as finished from mirror.sync_runs",
  );
  assert.deepEqual(runs, [{ source: "hubspot", mode: "changes", trigger: "cron", status: "partial", finished: true }]);
  assert.deepEqual(await leases(), []);
});

test("runSource: HubSpot's pass is given the settings and the trigger, and its result comes back as it is", async (t) => {
  // The portal the token reaches isn't the one the settings name: the pass reads nothing more, and fails.
  const requests = fakeServices(t, { hubspot: () => Response.json({ portalId: 999 }) });
  const r = await runSource(db, hubspotEnv(), "hubspot", "changes", "cli");
  assert.deepEqual(r, {
    status: "failed",
    calls: 1,
    seen: 0,
    changed: 0,
    note: null,
    error: "HUBSPOT_TOKEN reaches portal 999, not HUBSPOT_PORTAL_ID 1. Nothing was read.",
  });
  assert.deepEqual(requests, ["hubspot GET /account-info/v3/details"]);
  const [run] = await runRows();
  assert.deepEqual([run.mode, run.trigger, run.status, run.api_calls, run.finished], ["changes", "cli", "failed", 1, true]);
});
