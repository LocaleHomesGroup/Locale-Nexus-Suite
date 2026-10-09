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
  assert.deepEqual(data.jobs[0].precon.map((m) => [m.name, m.status]), [["Builder Acceptance", "pendingDate"]]);
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

test("files: a copied file has a path, a waiting one doesn't, an unknown one isn't found", async () => {
  assert.deepEqual(await loadAssetPath(db, "9001"), { path: "10/2001/9001/plan.pdf", copyError: null });
  assert.deepEqual(await loadAssetPath(db, "9002"), { path: null, copyError: null });
  assert.equal(await loadAssetPath(db, "4242"), null);
  assert.equal(await loadAssetPath(db, "../9001"), null);
});
