import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { inspect } from "node:util";
import { migratedTestDb } from "../db/pglite";
import { addStaff } from "../db/test-fixtures";
import type { Db } from "../db/types";
import { matchReps } from "../mirror/monday/setup";
import { setWatermark } from "../mirror/runs";
import { loadAssetPath, loadItemFiles, parseAssetId } from "./files";
import { loadLiveData } from "./live-data";

let db: Db;
let close: () => Promise<void>;
before(async () => {
  ({ db, close } = await migratedTestDb());
  await addStaff(db, "test-rep-a", { department: "sales" });
  await addStaff(db, "test-ops-a", { department: "operations" });
  await db.query("insert into mirror.monday_workspaces (id, name) values (1, 'Test workspace')");
  await db.query(`insert into mirror.monday_boards (id, workspace_id, name, board_key, purpose, sync_enabled)
                  values (10, 1, 'Test sales', 'homes_sales_wa', 'sales', true), (20, 1, 'Test handed over', 'homes_handed_over_wa', 'handed_over', true)`);
  await db.query(`insert into mirror.monday_boards (id, workspace_id, name, type, parent_board_id, sync_enabled)
                  values (11, 1, 'Subitems', 'sub_items_board', 10, true)`);
  await db.query(`insert into mirror.monday_field_map (board_id, field_key, column_id) values
                  (10, 'job_number', 'text4'), (10, 'sales_rep', 'text_r'), (20, 'sales_rep', 'text_r'), (11, 'milestone_status', 'status')`);
  const values = JSON.stringify({ text4: { type: "text", text: "12345", value: null }, text_r: { type: "text", text: "TEST REP A", value: null } });
  await db.query(`insert into mirror.monday_items (id, board_id, name, monday_updated_at, column_values) values
                  (1001, 10, 'Test Client A', now(), $1::jsonb), (1501, 20, 'Test Client Old', now(), $1::jsonb)`, [values]);
  await db.query(`insert into mirror.monday_items (id, board_id, parent_item_id, name, monday_updated_at, column_values)
                  values (2001, 11, 1001, 'Builder Acceptance', now(), '{"status": {"type": "status", "text": "Done", "label": "Done", "value": null}}'::jsonb)`);
  await db.query("insert into launchpad.staff_aliases (alias, staff_id) values ('test rep a', 'test-rep-a')");
  await db.query(`insert into mirror.monday_assets (id, item_id, column_id, name, storage_path) values
                  (9001, 2001, 'files', 'plan.pdf', '10/2001/9001/plan.pdf'), (9002, 1001, null, 'waiting.pdf', null)`);
  const [lot] = await db.query<{ id: string }>("insert into launchpad.land_lots (lot_label, source, land_price) values ('Lot 1 Test Street', 'launchpad', 364000) returning id");
  await db.query("select launchpad.place_hold($1::uuid, 'test-rep-a', 'Test Client A')", [lot.id]);
});
after(async () => close());

test("live data: jobs, lots and reps from the database", async () => {
  const data = await loadLiveData(db, () => new Date("2026-10-08T00:00:00Z"));
  assert.ok(data && data.status === "ok");
  assert.equal(data.asOf, "2026-10-08T00:00:00.000Z");
  assert.equal(data.readAt, "2026-10-08T00:00:00.000Z");
  assert.deepEqual(data.jobs.map((j) => [j.id, j.jobNo, j.rep]), [[1001, "12345", "Test Rep A"]], "handed-over jobs stay out");
  // The list carries a summary in place of the milestones (the job's own screen fetches them): here the one
  // preconstruction milestone is done with no date, so the job needs one and has no construction milestones.
  assert.deepEqual([data.jobs[0].precon, data.jobs[0].milestones], [[], []]);
  assert.deepEqual(data.jobs[0].progress, { done: 0, total: 0, needsDate: true });
  assert.equal(data.lots.length, 1);
  assert.equal(data.lots[0].landPrice, 364000);
  assert.deepEqual(data.lots[0].holds.map((h) => [h.staffId, h.client]), [["test-rep-a", "Test Client A"]]);
  assert.deepEqual(data.reps, [{ id: "test-rep-a", name: "Test Rep A" }], "only Sales staff are reps");
});

test("live data: no database, no live data", async () => {
  assert.equal(await loadLiveData(null), null);
});

test("live data: a database that can't be read gives an error the screens can show (Review Focus 4)", async () => {
  const broken: Db = {
    query: async () => {
      throw new Error("connect ECONNREFUSED");
    },
    transaction: async () => {
      throw new Error("connect ECONNREFUSED");
    },
  };
  const original = console.error;
  console.error = () => {};
  try {
    const data = await loadLiveData(broken);
    assert.ok(data && data.status === "error");
    assert.match(data.message, /sample data/);
  } finally {
    console.error = original;
  }
});

test("files: the job's own files first, then each milestone's, ready or still copying", async () => {
  const files = await loadItemFiles(db, 1001);
  assert.deepEqual(files.map((f) => [f.assetId, f.ready, f.copyError, f.milestone]), [
    [9002, false, null, null],
    [9001, true, null, "Builder Acceptance"],
  ]);
  assert.equal(parseAssetId("9001"), 9001);
  assert.equal(parseAssetId("9001; drop table"), null);
  assert.equal(parseAssetId("-1"), null);
  assert.equal(parseAssetId("0"), null);
  assert.equal(parseAssetId("007"), null);
});

test("files: a file that will never be copied says why, in the list and in the download lookup", async () => {
  // Item 1501 has no other files, so the list above is untouched.
  await db.query(
    `insert into mirror.monday_assets (id, item_id, column_id, name, download_attempts, download_error) values
     (9003, 1501, 'files', 'huge.mov', 0, 'too_large'),
     (9004, 1501, 'files', 'broken.pdf', 3, 'download failed: HTTP 500')`,
  );
  const files = await loadItemFiles(db, 1501);
  assert.deepEqual(files.map((f) => [f.assetId, f.ready, f.copyError]), [
    [9004, false, "failed"],
    [9003, false, "too_large"],
  ]);
  assert.ok(!JSON.stringify(files).includes("HTTP 500"), "the failure message stays in the mirror");
  assert.deepEqual(await loadAssetPath(db, "9003"), { path: null, copyError: "too_large" });
  assert.deepEqual(await loadAssetPath(db, "9004"), { path: null, copyError: "failed" });
});

test("files: a milestone's file under a removed job is neither listed nor served", async () => {
  await db.query(`insert into mirror.monday_items (id, board_id, name, state, monday_updated_at, removed_at)
                  values (1601, 10, 'Test Client D', 'deleted', now(), now())`);
  await db.query(`insert into mirror.monday_items (id, board_id, parent_item_id, name, monday_updated_at)
                  values (2601, 11, 1601, 'Slab Down', now())`);
  await db.query(`insert into mirror.monday_assets (id, item_id, column_id, name, storage_path)
                  values (9005, 2601, 'files', 'slab.pdf', '10/2601/9005/slab.pdf')`);
  assert.deepEqual(await loadItemFiles(db, 1601), []);
  assert.equal(await loadAssetPath(db, "9005"), null, "the download route answers not found");
});

test("live data: a rep spelt Monday's way resolves once setup has stored the alias", async () => {
  // Curly apostrophe, double space, trailing full stop: matchReps (Task 11) matches it
  // loosely and stores the exact key loadJobs looks up.
  await addStaff(db, "test-rep-b", { name: "Test O'Rep", department: "sales" });
  const values = JSON.stringify({ text_r: { type: "text", text: " Test  O’Rep. ", value: null } });
  await db.query(
    "insert into mirror.monday_items (id, board_id, name, monday_updated_at, column_values) values (1002, 10, 'Test Client B', now(), $1::jsonb)",
    [values],
  );
  assert.deepEqual(await matchReps(db), { matched: 2, unmatched: [] });
  const data = await loadLiveData(db, () => new Date("2026-10-08T00:00:00Z"));
  assert.ok(data && data.status === "ok");
  assert.equal(data.jobs.find((j) => j.id === 1002)?.rep, "Test O'Rep");
});

test("live data: a malformed connection string shows sample data and logs no password (Review Focus 4)", async () => {
  const saved = process.env.SUPABASE_DB_URL;
  process.env.SUPABASE_DB_URL = "postgresql://u:pa#ss@db.invalid:6543/x";
  const original = console.error;
  const logged: unknown[][] = [];
  console.error = (...args: unknown[]) => {
    logged.push(args);
  };
  try {
    const data = await loadLiveData();
    assert.ok(data && data.status === "error");
    assert.ok(logged.length > 0, "the failure is logged");
    assert.ok(!inspect(logged).includes("pa#ss"), "the log carries no password");
  } finally {
    console.error = original;
    if (saved === undefined) delete process.env.SUPABASE_DB_URL;
    else process.env.SUPABASE_DB_URL = saved;
  }
});

test("live data: one read failing gives the error state and leaves nothing unhandled", async () => {
  const reads: Promise<unknown>[] = [];
  const flaky: Db = {
    query: <T,>(text: string, params?: readonly unknown[]) => {
      const read = text.includes("launchpad.land_lot_board")
        ? Promise.reject(new Error("lots unavailable"))
        : db.query<T>(text, params);
      reads.push(read);
      return read as Promise<T[]>;
    },
    transaction: (fn) => db.transaction(fn),
  };
  const unhandled: unknown[] = [];
  const onUnhandled = (reason: unknown) => unhandled.push(reason);
  process.on("unhandledRejection", onUnhandled);
  const original = console.error;
  console.error = () => {};
  try {
    const data = await loadLiveData(flaky);
    assert.ok(data && data.status === "error");
    await Promise.allSettled(reads); // the other reads finish after the failure
    await new Promise((resolve) => setImmediate(resolve));
    assert.deepEqual(unhandled, []);
  } finally {
    console.error = original;
    process.off("unhandledRejection", onUnhandled);
  }
});

test("live data: lapsed holds are settled before the lots are read", async () => {
  const [lot] = await db.query<{ id: string }>(
    "insert into launchpad.land_lots (lot_label, source, land_price) values ('Lot 2 Test Street', 'launchpad', 380000) returning id::text as id",
  );
  const [lapsed] = await db.query<{ id: string }>(
    `insert into launchpad.land_holds (lot_id, staff_id, client_name, started_at, expires_at)
     values ($1::uuid, 'test-rep-a', 'Test Client A', now() - interval '2 days', now() - interval '1 day')
     returning id::text as id`,
    [lot.id],
  );
  const data = await loadLiveData(db, () => new Date("2026-10-08T00:00:00Z"));
  assert.ok(data && data.status === "ok");
  const board = data.lots.find((l) => l.id === lot.id);
  assert.ok(board, "the lot is on the board");
  assert.ok(!board.holds.some((h) => h.id === lapsed.id), "the lapsed hold was settled first");
});

test("live data: as of is Monday's last sync, not the time the page read it", async () => {
  // The first test has no sync yet, so it reads the page's time. Once a pass has
  // run, a stalled mirror shows its real age instead of looking current.
  await setWatermark(db, "monday", "account", new Date("2026-10-07T23:50:00Z"));
  const data = await loadLiveData(db, () => new Date("2026-10-08T00:00:00Z"));
  assert.ok(data && data.status === "ok");
  assert.equal(data.asOf, "2026-10-07T23:50:00.000Z");
  assert.equal(data.readAt, "2026-10-08T00:00:00.000Z", "holds are still judged against the read time");
});

test("live data: as of is when the mirror last held every change, which can be behind the account watermark", async () => {
  // The watermark moves once the activity log is read, and the items it named are refetched after: until the refetch
  // queue is empty, the data is only complete up to the earlier mark.
  await setWatermark(db, "monday", "account", new Date("2026-10-08T00:05:00Z"));
  await setWatermark(db, "monday", "complete", new Date("2026-10-07T23:55:00Z"));
  const data = await loadLiveData(db, () => new Date("2026-10-08T00:10:00Z"));
  assert.ok(data && data.status === "ok");
  assert.equal(data.asOf, "2026-10-07T23:55:00.000Z");
});

test("files: a copied file has a path, a waiting one doesn't, an unknown one isn't found", async () => {
  assert.deepEqual(await loadAssetPath(db, "9001"), { path: "10/2001/9001/plan.pdf", copyError: null });
  assert.deepEqual(await loadAssetPath(db, "9002"), { path: null, copyError: null });
  assert.equal(await loadAssetPath(db, "4242"), null);
  assert.equal(await loadAssetPath(db, "../9001"), null);
});

test("live data: a read that times out is tried once more, and a second timeout falls back to sample data", async () => {
  const timeout = () => new Error("Query read timeout");
  const original = { warn: console.warn, error: console.error };
  console.warn = () => {};
  console.error = () => {};
  try {
    let timedOut = 0;
    const flakyOnce: Db = {
      query: async (text, params) => {
        if (timedOut === 0 && /launchpad\.monday_jobs/.test(text)) {
          timedOut++;
          throw timeout();
        }
        return db.query(text, params);
      },
      transaction: (fn) => db.transaction(fn),
    };
    const recovered = await loadLiveData(flakyOnce, () => new Date("2026-10-08T00:00:00Z"));
    assert.ok(recovered && recovered.status === "ok", "the second try reads it");
    assert.equal(timedOut, 1);

    const alwaysTimesOut: Db = { query: async () => { throw timeout(); }, transaction: async () => { throw timeout(); } };
    const fellBack = await loadLiveData(alwaysTimesOut);
    assert.ok(fellBack && fellBack.status === "error", "two timeouts: sample data with the note, never a hang");

    let calls = 0;
    const refused: Db = { query: async () => { calls++; throw new Error("permission denied"); }, transaction: async () => { throw new Error("x"); } };
    await loadLiveData(refused);
    assert.ok(calls <= 5, "an error that isn't a timeout isn't retried");
  } finally {
    console.warn = original.warn;
    console.error = original.error;
  }
});

test("live data: a load over three seconds logs how long it took, once, with no data in the line", async () => {
  const original = { warn: console.warn, error: console.error };
  const warned: string[] = [];
  console.warn = (...args: unknown[]) => {
    warned.push(args.map(String).join(" "));
  };
  console.error = () => {};
  try {
    // A quick load, the clock standing still: nothing is logged.
    const quick = await loadLiveData(db, () => new Date("2026-10-08T00:00:00Z"));
    assert.ok(quick && quick.status === "ok");
    assert.equal(warned.length, 0);

    // A clock that is 4 s later at every look. A good load looks at it three times (start, read time, end), so it took 8 s.
    let t = Date.parse("2026-10-08T00:00:00Z");
    const slowClock = () => new Date((t += 4_000));
    const slow = await loadLiveData(db, slowClock);
    assert.ok(slow && slow.status === "ok");
    assert.equal(warned.length, 1, "one line");
    assert.match(warned[0], /\[live-data\] a load took 8000 ms$/);
    assert.ok(!/Test Client|Test Rep|12345|Test Street/.test(warned[0]), "no job, rep or lot in it");

    // A load that fails is logged the same way, so a slow failure is no quieter than a slow success.
    warned.length = 0;
    const broken: Db = {
      query: async () => {
        throw new Error("connect ECONNREFUSED");
      },
      transaction: async () => {
        throw new Error("connect ECONNREFUSED");
      },
    };
    const failed = await loadLiveData(broken, slowClock);
    assert.ok(failed && failed.status === "error");
    assert.deepEqual(warned.filter((w) => w.includes("took")).length, 1);
  } finally {
    console.warn = original.warn;
    console.error = original.error;
  }
});

test("live data: the time logged covers the whole call, so a retried load shows what the two tries cost", async () => {
  const original = { warn: console.warn, error: console.error };
  const warned: string[] = [];
  console.warn = (...args: unknown[]) => {
    warned.push(args.map(String).join(" "));
  };
  console.error = () => {};
  try {
    let t = Date.parse("2026-10-08T00:00:00Z");
    let timedOut = false;
    // The first read waits 15 s and times out; the second is quick.
    const flakyOnce: Db = {
      query: async (text, params) => {
        if (!timedOut && /launchpad\.monday_jobs/.test(text)) {
          timedOut = true;
          t += 15_000;
          throw new Error("Query read timeout");
        }
        return db.query(text, params);
      },
      transaction: (fn) => db.transaction(fn),
    };
    const data = await loadLiveData(flakyOnce, () => new Date(t));
    assert.ok(data && data.status === "ok", "the second try reads it");
    const slow = warned.filter((w) => w.includes("took"));
    assert.equal(slow.length, 1, "one slow-load line, besides the retry's own note");
    assert.match(slow[0], /a load took 15000 ms$/);
    assert.equal(warned.length, 2, "the retry note and the slow-load line");
  } finally {
    console.warn = original.warn;
    console.error = original.error;
  }
});
