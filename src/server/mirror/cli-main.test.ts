import { after, before, beforeEach, test, type TestContext } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { main } from "./cli-main";
import { migratedTestDb } from "../db/pglite";
import type { Db } from "../db/types";
import { readServerEnv } from "../env";
import { HUBSPOT_API } from "./hubspot/client";
import { MONDAY_API_URL } from "./monday/client";
import { MAX_FILE_BYTES } from "./monday/files";

/**
 * The CLI's `main` (cli-main.ts), run on PGlite with a stubbed Monday: the switch, its flags and what each case hands on.
 * Importing cli-main.ts runs nothing. Never import scripts/mirror.ts here: it runs the CLI as soon as it loads.
 */
let db: Db;
let close: () => Promise<void>;
const dir = mkdtempSync(join(tmpdir(), "lp-cli-main-"));
before(async () => ({ db, close } = await migratedTestDb()));
after(async () => {
  await close();
  rmSync(dir, { recursive: true, force: true });
});

/** Each test starts with no boards, items, files, workspaces, runs or counted calls. */
beforeEach(async () => {
  await db.query("delete from mirror.monday_assets");
  await db.query("delete from mirror.monday_items");
  await db.query("delete from mirror.monday_boards where parent_board_id is not null");
  await db.query("delete from mirror.monday_boards");
  await db.query("delete from mirror.monday_workspaces");
  await db.query("delete from mirror.api_calls");
  await db.query("delete from mirror.sync_runs");
  await db.query("delete from mirror.sync_locks");
});

const env = readServerEnv({ MONDAY_API_TOKEN: "test-token", MONDAY_DAILY_CALL_CAP: "100" });
const withDb = () => ({ db, env });

/** A database nothing may touch: a command refused up front never reaches it. */
const tripwire: Db = {
  query: async (text) => {
    throw new Error(`the database was touched: ${text.slice(0, 40)}`);
  },
  transaction: async () => {
    throw new Error("the database was touched");
  },
};

/** What the command printed, with console.log and console.error silenced for the test. */
function captured(t: TestContext) {
  const out: string[] = [];
  const err: string[] = [];
  t.mock.method(console, "log", (...parts: unknown[]) => {
    out.push(parts.join(" "));
  });
  t.mock.method(console, "error", (...parts: unknown[]) => {
    err.push(parts.join(" "));
  });
  return { out, err };
}

const STORAGE_HOST = "runner.example.test";
const HUBSPOT_HOST = new URL(HUBSPOT_API).host;

/**
 * Stands in for Monday (and, when given them, one invented Storage host and HubSpot) by replacing the global fetch for
 * one test: no network, and a request to anything else fails the test, so every real host is refused. `answer` gets
 * each Monday document as it went out and returns the answer's `data`. Returns the Monday documents sent.
 */
function fakeMondayApi(t: TestContext, answer: (document: string) => unknown, others: { storage?: () => Response; hubspot?: () => Response } = {}) {
  const sent: string[] = [];
  t.mock.method(globalThis, "fetch", async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    if (url.host === STORAGE_HOST && others.storage) return others.storage();
    if (url.host === HUBSPOT_HOST && others.hubspot) return others.hubspot();
    if (url.href !== MONDAY_API_URL) throw new Error(`unexpected request in a test: ${url}`);
    sent.push((JSON.parse(String(init?.body)) as { query: string }).query);
    return Response.json({ data: answer(sent[sent.length - 1]) });
  });
  return sent;
}

const board = (id: number, name: string, over: Record<string, unknown> = {}) => ({
  id: String(id),
  name,
  type: "board",
  state: "active",
  updated_at: "2026-10-07T00:00:00Z",
  workspace: { id: "1" },
  columns: [{ id: "name", title: "Name", type: "name" }],
  groups: [],
  ...over,
});

/** A Monday with one workspace and its board 100, and board 101 (the subitems board) by id. Invented, like setup-run.test.ts's. */
function world(document: string): unknown {
  if (document.includes("workspaces(limit")) return { workspaces: [{ id: "1", name: "Test workspace A", kind: "open" }] };
  if (document.includes("users(limit")) return { users: [] };
  if (document.includes("boards(workspace_ids")) return { boards: [board(100, "Test board A")] };
  if (document.includes("boards(ids: $ids")) return { boards: [board(101, "Subitems of Test board A", { type: "sub_items_board", workspace: null })] };
  throw new Error(`unexpected document: ${document.slice(0, 60)}`);
}

const writeConfig = () => {
  const path = join(dir, "monday.json");
  writeFileSync(
    path,
    JSON.stringify({ workspaces: { production: { id: 1, name: "Test workspace A" } }, production: { boards: { test_sales: { parent: 100, subitems: 101 } } } }),
  );
  return path;
};

const enableBoard = async () => {
  await db.query("insert into mirror.monday_workspaces (id, name) values (1, 'Test workspace')");
  await db.query("insert into mirror.monday_boards (id, workspace_id, name, board_key, purpose, sync_enabled) values (10, 1, 'Test sales', 'test_sales', 'sales', true)");
};

test("main: a flag the command doesn't take, or a bad value, is refused before the database is touched", async (t) => {
  captured(t);
  const refused: [string[], string][] = [
    [["files", "--board", "test_sales"], "files doesn't take --board"],
    [["backfill", "--max-files", "5"], "backfill doesn't take --max-files"],
    [["status", "--max-calls", "5"], "status doesn't take --max-calls"],
    [["reps", "--board", "test_sales"], "reps doesn't take --board"],
    [["hubspot", "--max-calls", "5"], "hubspot doesn't take --max-calls"],
    [["backfill", "--max-calls", "abc"], '--max-calls must be a positive whole number, not "abc"'],
    [["discover", "--workspace", "0"], '--workspace must be a positive whole number, not "0"'],
    [["changes", "--board"], "--board needs a value"],
  ];
  for (const [argv, message] of refused) {
    await assert.rejects(main(argv, { db: tripwire, env }), { message }, argv.join(" "));
  }
});

test("main: an unknown command says so, and points at the usage", async (t) => {
  captured(t);
  await assert.rejects(main(["frobnicate"], withDb()), { message: 'Unknown command "frobnicate". See the comment at the top of scripts/mirror.ts.' });
});

test("main: discover lists the workspaces, and one workspace's boards when asked, then the call count", async (t) => {
  const sent = fakeMondayApi(t, world);
  const { out } = captured(t);
  await main(["discover", "--workspace", "1"], withDb());
  assert.deepEqual(out, ["workspace 1  Test workspace A", "  board 100  Test board A  (board)", "2 Monday call(s)"]);
  assert.equal(sent.length, 2);
});

test("main: discover takes --max-calls, and stops after that many calls in the trial run's own words", async (t) => {
  const sent = fakeMondayApi(t, world);
  captured(t);
  await assert.rejects(main(["discover", "--workspace", "1", "--max-calls", "1"], withDb()), { message: "Stopped after --max-calls 1, as asked." });
  assert.equal(sent.length, 1, "the second call, for the boards, was never sent");
});

test("main: setup takes --max-calls too", async (t) => {
  const sent = fakeMondayApi(t, world);
  captured(t);
  await assert.rejects(
    main(["setup", "--jerry-config", writeConfig(), "--max-calls", "1"], withDb()),
    { message: "Stopped after --max-calls 1, as asked." },
  );
  assert.equal(sent.length, 1, "the workspaces were read; the users call was never sent");
});

test("main: setup, given room, runs to the end and prints its report", async (t) => {
  const sent = fakeMondayApi(t, world);
  const { out } = captured(t);
  await main(["setup", "--jerry-config", writeConfig(), "--max-calls", "10"], withDb());
  assert.equal(sent.length, 4, "workspaces, users, the workspace's boards, and the subitems board by id");
  assert.deepEqual(out, [
    "discovering workspaces and users",
    "discovering boards in workspace 1",
    "boards enabled: test_sales",
    "fields mapped: 0",
    "Exclusive Land, matched by title: nothing",
    "4 Monday call(s)",
  ]);
});

test("main: discover and setup with no Monday token say which setting is missing, and send nothing", async (t) => {
  const sent = fakeMondayApi(t, world);
  captured(t);
  const none = { db, env: readServerEnv({}) };
  await assert.rejects(main(["discover"], none), { message: "MONDAY_API_TOKEN is not set." });
  await assert.rejects(main(["setup", "--jerry-config", writeConfig()], none), { message: "MONDAY_API_TOKEN is not set." });
  assert.deepEqual(sent, []);
});

test("main: a pass runs on the board asked for, within the call limit, and its result is printed", async (t) => {
  await enableBoard();
  const sent = fakeMondayApi(t, () => ({ boards: [{ items_page: { cursor: "page-2", items: [] } }] }));
  const { out, err } = captured(t);
  await main(["backfill", "--board", "test_sales", "--max-calls", "1"], withDb());
  assert.deepEqual(out, ["backfill test_sales", "partial: 1 call(s), 0 seen, 0 changed"]);
  assert.deepEqual(err, ["error: Stopped after --max-calls 1, as asked."]);
  assert.equal(sent.length, 1, "the second page was never asked for");

  // A key that names no enabled board reaches the pass as it is: nothing runs, and nothing is sent.
  out.length = 0;
  err.length = 0;
  await main(["backfill", "--board", "no_such_board"], withDb());
  assert.deepEqual(out, ["skipped: 0 call(s), 0 seen, 0 changed. no enabled board is called no_such_board: `npm run mirror -- status` lists them"]);
  assert.equal(sent.length, 1);
});

test("main: a files run is given the file limit, and prints how it went", async (t) => {
  await enableBoard();
  await db.query("insert into mirror.monday_items (id, board_id, name, monday_updated_at) values (1001, 10, 'Test item', now())");
  for (const id of [9001, 9002, 9003]) {
    await db.query("insert into mirror.monday_assets (id, item_id, column_id, name) values ($1, 1001, 'files', 'file.pdf')", [id]);
  }
  const bucket = () => Response.json({ id: "monday-files", name: "monday-files", owner: "", public: false, created_at: "2026-10-01T00:00:00Z", updated_at: "2026-10-01T00:00:00Z" });
  // Monday returns none of the files asked for, so each one taken up is charged an attempt.
  fakeMondayApi(t, () => ({ assets: [] }), { storage: bucket });
  const { out, err } = captured(t);
  const withStorage = {
    db,
    env: readServerEnv({
      MONDAY_API_TOKEN: "test-token",
      MONDAY_DAILY_CALL_CAP: "100",
      NEXT_PUBLIC_SUPABASE_URL: `https://${STORAGE_HOST}`,
      SUPABASE_SERVICE_ROLE_KEY: ["not", "a", "real", "key"].join("-"),
    }),
  };
  await main(["files", "--max-files", "1"], withStorage);
  assert.deepEqual(out, ["partial: 1 call(s), 1 seen, 0 changed. 0 downloaded, 0 too large, 1 failed, 3 waiting"]);
  assert.deepEqual(err, []);
  const tried = await db.query<{ n: number }>("select count(*)::int as n from mirror.monday_assets where download_attempts > 0");
  assert.equal(tried[0].n, 1, "one file was taken up, not three");
});

test("main: hubspot runs HubSpot's pass as a CLI run, and prints its result like any other", async (t) => {
  // The portal the token reaches isn't the one the settings name: the pass reads nothing more, and fails.
  const sent = fakeMondayApi(t, () => assert.fail("Monday was asked"), { hubspot: () => Response.json({ portalId: 999 }) });
  const { out, err } = captured(t);
  const withHubspot = { db, env: readServerEnv({ HUBSPOT_TOKEN: "test-hubspot-token", HUBSPOT_PORTAL_ID: "1" }) };
  const before = process.exitCode;
  try {
    await main(["hubspot"], withHubspot);
    assert.equal(process.exitCode, 1, "a failed run exits 1");
  } finally {
    process.exitCode = before;
  }
  assert.deepEqual(out, ["failed: 1 call(s), 0 seen, 0 changed"]);
  assert.deepEqual(err, ["error: HUBSPOT_TOKEN reaches portal 999, not HUBSPOT_PORTAL_ID 1. Nothing was read."]);
  assert.deepEqual(sent, [], "Monday wasn't asked");
  const runs = await db.query<{ source: string; mode: string; trigger: string; status: string }>(
    "select source, mode, trigger, status from mirror.sync_runs",
  );
  assert.deepEqual(runs, [{ source: "hubspot", mode: "changes", trigger: "cli", status: "failed" }]);
});

test("main: a run that failed prints its error and sets the exit code", async (t) => {
  const { out, err } = captured(t);
  const before = process.exitCode;
  try {
    // A token but no Storage settings: a files run can't start.
    await main(["files", "--max-files", "5"], withDb());
    assert.equal(process.exitCode, 1);
  } finally {
    process.exitCode = before;
  }
  assert.deepEqual(out, ["failed: 0 call(s), 0 seen, 0 changed"]);
  assert.deepEqual(err, ["error: Storage isn't configured: set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY"]);
});

test("main: status and reps print their lines", async (t) => {
  await enableBoard();
  const { out } = captured(t);
  await main(["status"], withDb());
  assert.equal(out[0], "boards enabled: 1 (+ 0 subitems boards): test_sales");
  assert.equal(out[4], "Monday calls today (UTC): 0 of the 100 cap");

  out.length = 0;
  await main(["reps"], withDb());
  assert.deepEqual(out, ["matched 0 rep name(s)"]);
});

/**
 * Supabase Storage's bucket endpoints, stood in for by replacing the global fetch for one test: no network, and a
 * request to any other host fails the test. Each request is recorded.
 */
function fakeStorage(t: TestContext, answer: (request: { method: string; path: string }) => Response) {
  const requests: { method: string; path: string; body: Record<string, unknown> | null }[] = [];
  t.mock.method(globalThis, "fetch", async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    if (url.host !== STORAGE_HOST) throw new Error(`unexpected request in a test: ${url}`);
    const request = {
      method: init?.method ?? "GET",
      path: url.pathname,
      body: typeof init?.body === "string" ? (JSON.parse(init.body) as Record<string, unknown>) : null,
    };
    requests.push(request);
    return answer(request);
  });
  return requests;
}

const storageSettings = (key = ["not", "a", "real", "key"].join("-")) =>
  readServerEnv({ NEXT_PUBLIC_SUPABASE_URL: `https://${STORAGE_HOST}`, SUPABASE_SERVICE_ROLE_KEY: key });

const bucketJson = (name: string, over: Record<string, unknown> = {}) => ({
  id: name,
  name,
  owner: "",
  public: false,
  file_size_limit: MAX_FILE_BYTES,
  created_at: "2026-10-01T00:00:00Z",
  updated_at: "2026-10-01T00:00:00Z",
  ...over,
});

test("main: buckets looks at both buckets, and creates what is missing, private and with the file size limit", async (t) => {
  const requests = fakeStorage(t, ({ method }) =>
    method === "GET" ? Response.json({ statusCode: "404", error: "Bucket not found", message: "Bucket not found" }, { status: 404 }) : Response.json({ name: "created" }),
  );
  const { out } = captured(t);
  await main(["buckets"], { db, env: storageSettings() });
  assert.deepEqual(
    requests.map((r) => `${r.method} ${r.path}`),
    ["GET /storage/v1/bucket/monday-files", "POST /storage/v1/bucket", "GET /storage/v1/bucket/launchpad-files", "POST /storage/v1/bucket"],
  );
  const created = requests.filter((r) => r.method === "POST").map((r) => r.body);
  assert.deepEqual(
    created.map((b) => [b?.name, b?.public, b?.file_size_limit]),
    [["monday-files", false, MAX_FILE_BYTES], ["launchpad-files", false, MAX_FILE_BYTES]],
  );
  assert.deepEqual(out, ["buckets ready: monday-files, launchpad-files"]);
});

test("main: buckets leaves buckets that are already private and big enough as they are", async (t) => {
  const requests = fakeStorage(t, ({ path }) => Response.json(bucketJson(path.split("/").pop() ?? "")));
  const { out } = captured(t);
  await main(["buckets"], { db, env: storageSettings() });
  assert.deepEqual(
    requests.map((r) => `${r.method} ${r.path}`),
    ["GET /storage/v1/bucket/monday-files", "GET /storage/v1/bucket/launchpad-files"],
  );
  assert.deepEqual(out, ["buckets ready: monday-files, launchpad-files"]);
});

test("main: buckets without the Storage settings says which to set, and sends nothing", async (t) => {
  const requests = fakeStorage(t, () => Response.json({}));
  captured(t);
  const message = "Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY first.";
  await assert.rejects(main(["buckets"], { db, env: readServerEnv({}) }), { message });
  await assert.rejects(main(["buckets"], { db, env: readServerEnv({ NEXT_PUBLIC_SUPABASE_URL: `https://${STORAGE_HOST}` }) }), { message });
  await assert.rejects(main(["buckets"], { db, env: readServerEnv({ SUPABASE_SERVICE_ROLE_KEY: "test-key-abc" }) }), { message });
  assert.deepEqual(requests, []);
});

test("main: buckets with a service-role key that has a line break is refused by name, and none of the key is quoted or sent", async (t) => {
  const requests = fakeStorage(t, () => Response.json({}));
  captured(t);
  const key = "test-key-abc\ndef"; // invented
  await assert.rejects(main(["buckets"], { db, env: storageSettings(key) }), (e: unknown) => {
    const message = e instanceof Error ? e.message : String(e);
    assert.match(message, /SUPABASE_SERVICE_ROLE_KEY/);
    assert.ok(!message.includes("test-key") && !message.includes("def"), "the message quotes none of the key");
    return true;
  });
  assert.deepEqual(requests, [], "fetch was never called");
});
