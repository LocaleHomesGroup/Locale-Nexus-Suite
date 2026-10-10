import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { migratedTestDb } from "../../db/pglite";
import type { Db } from "../../db/types";
import { beginRun, endRun, getWatermark, setWatermark } from "../runs";
import type { RawActivityLog } from "./activity";
import { MondayCapReachedError, MondayDailyLimitError, MondayError } from "./client";
import type { RawItem } from "./normalise";
import { nextPageSize, runMondayPass } from "./passes";
import { fakeMonday } from "./test-fakes";

let db: Db;
let close: () => Promise<void>;

const raw = (id: number, board: number, updated: string, parent: number | null = null): RawItem => ({
  id: String(id),
  name: `Test item ${id}`,
  state: "active",
  updated_at: updated,
  board: { id: String(board), name: `Board ${board}` },
  parent_item: parent ? { id: String(parent) } : null,
  column_values: [],
});

// What "Monday" holds. Tests change it between passes.
const world = {
  items: new Map<number, RawItem>(),
  logs: new Map<string, RawActivityLog[][]>(), // board id -> pages of entries
  recent: [] as { id: string; updated_at: string }[],
  asked: [] as string[], // boards asked for a first items page, in order
};
const onBoard = (board: number) => [...world.items.values()].filter((i) => i.board?.id === String(board));

const monday = fakeMonday((doc, vars) => {
  if (doc.includes("activity_logs")) {
    const page = Number(vars.page ?? 1);
    return {
      boards: (vars.boards as string[]).map((id) => ({ id, activity_logs: world.logs.get(id)?.[page - 1] ?? [], updates: [] })),
    };
  }
  if (doc.includes("__last_updated__")) return { boards: [{ items_page: { cursor: null, items: world.recent } }] };
  if (doc.includes("updates(limit")) return { boards: [{ updates: [] }] };
  if (doc.includes("items(ids")) {
    return { items: (vars.ids as string[]).map((id) => world.items.get(Number(id))).filter(Boolean) };
  }
  const full = doc.includes("id name state");
  if (doc.includes("next_items_page")) {
    // Only board 10 pages: its second page is everything after the first item.
    const rest = onBoard(10).slice(1);
    return { next_items_page: { cursor: null, items: full ? rest : rest.map((i) => ({ id: i.id, updated_at: i.updated_at })) } };
  }
  if (doc.includes("items_page")) {
    const board = Number((vars.board as string[])[0]);
    world.asked.push(String(board));
    const items = onBoard(board);
    const firstPage = board === 10 ? items.slice(0, 1) : items;
    return {
      boards: [{
        items_page: {
          cursor: board === 10 && items.length > 1 ? "cursor-1" : null,
          items: full ? firstPage : firstPage.map((i) => ({ id: i.id, updated_at: i.updated_at })),
        },
      }],
    };
  }
  throw new Error(`unexpected document: ${doc.slice(0, 80)}`);
});

const NOW = new Date("2026-10-08T06:00:00Z");
const opts = { trigger: "cli" as const, now: () => NOW };

before(async () => {
  ({ db, close } = await migratedTestDb());
  await db.query("insert into mirror.monday_workspaces (id, name) values (1, 'Test workspace')");
  await db.query(`insert into mirror.monday_boards (id, workspace_id, name, board_key, purpose, sync_enabled)
                  values (10, 1, 'Test sales', 'test_sales', 'sales', true)`);
  await db.query(`insert into mirror.monday_boards (id, workspace_id, name, type, board_key, parent_board_id, sync_enabled)
                  values (11, 1, 'Subitems of Test sales', 'sub_items_board', 'test_sales:subitems', 10, true)`);
  world.items.set(1001, raw(1001, 10, "2026-10-07T00:00:00Z"));
  world.items.set(1002, raw(1002, 10, "2026-10-07T00:00:00Z"));
  world.items.set(2001, raw(2001, 11, "2026-10-07T00:00:00Z", 1001));
});
after(async () => close());

const lastRun = async () =>
  (await db.query<{ status: string; api_calls: number; note: string | null }>(
    "select status, api_calls, note from mirror.sync_runs order by id desc limit 1",
  ))[0];

test("passes: page size follows the measured complexity", () => {
  assert.equal(nextPageSize(null, 100), 100);
  assert.equal(nextPageSize(400_000, 100), 500, "cheap pages grow to the 500 maximum");
  assert.equal(nextPageSize(4_000_000, 100), 50);
  assert.equal(nextPageSize(100_000_000, 100), 25, "never below 25");
});

test("passes: changes before any backfill is skipped, with the reason", async () => {
  const r = await runMondayPass(db, monday, "changes", opts);
  assert.equal(r.status, "skipped");
  assert.match(r.note ?? "", /backfill/);
});

test("passes: backfill pages through every board and sets the watermark", async () => {
  const before = monday.stats.calls;
  const r = await runMondayPass(db, monday, "backfill", opts);
  assert.equal(r.status, "ok");
  const [{ n }] = await db.query<{ n: number }>("select count(*)::int as n from mirror.monday_items");
  assert.equal(n, 3);
  // Board 10: two item pages and one updates page. Board 11: one of each.
  assert.equal(monday.stats.calls - before, 5);
  assert.equal((await lastRun()).api_calls, 5);
  const [{ w }] = await db.query<{ w: Date }>("select watermark as w from mirror.sync_state where scope = 'account'");
  assert.equal(new Date(w).toISOString(), NOW.toISOString());
});

test("passes: changes refetch what the log names; what Monday no longer returns is removed", async () => {
  world.items.set(1001, raw(1001, 10, "2026-10-08T05:00:00Z"));
  world.items.delete(1002);
  world.logs.set("10", [[
    { event: "update_column_value", data: JSON.stringify({ pulse_id: 1001 }), created_at: "17599032000000000" },
    { event: "delete_pulse", data: JSON.stringify({ pulse_id: 1002 }), created_at: "17599032000000000" },
  ]]);
  const r = await runMondayPass(db, monday, "changes", opts);
  assert.equal(r.status, "ok");
  const rows = await db.query<{ id: number; updated: Date; removed: boolean }>(
    "select id, monday_updated_at as updated, removed_at is not null as removed from mirror.monday_items where id in (1001, 1002) order by id",
  );
  assert.equal(new Date(rows[0].updated).toISOString(), "2026-10-08T05:00:00.000Z");
  assert.equal(rows[1].removed, true);
});

test("passes: an item Monday returns but we can't place stays live, never marked removed", async () => {
  // A copy with no board can't be stored, but Monday did return it: only absence means removed.
  const live = world.items.get(1001)!;
  world.items.set(1001, { ...live, board: null });
  world.logs.set("10", [[{ event: "update_column_value", data: JSON.stringify({ pulse_id: 1001 }), created_at: "17599032000000000" }]]);
  await runMondayPass(db, monday, "changes", opts);
  const [row] = await db.query<{ removed: boolean }>("select removed_at is not null as removed from mirror.monday_items where id = 1001");
  assert.equal(row.removed, false);
  world.items.set(1001, live);
  world.logs.clear();
});

test("passes: a log still full after the page cap runs the safety check, ends partial and says so (Review Focus 2)", async () => {
  const entry = (id: number) => ({ event: "update_column_value", data: JSON.stringify({ pulse_id: id }), created_at: "17599032000000000" });
  world.logs.set("10", [[entry(1001), entry(1001)], [entry(1001), entry(1001)], [entry(1001), entry(1001)]]);
  const sent = monday.documents.length;
  const r = await runMondayPass(db, monday, "changes", { ...opts, limits: { activityLimit: 2, activityMaxPages: 2 } });
  assert.equal(r.status, "partial");
  assert.match(r.note ?? "", /safety/);
  assert.ok(monday.documents.slice(sent).some((d) => d.includes("__last_updated__")), "the safety check ran on the full board");
  world.logs.clear();
});

test("passes: safety refetches anything updated today or yesterday that we hold an older copy of", async () => {
  world.items.set(1001, raw(1001, 10, "2026-10-08T05:30:00Z"));
  world.recent = [{ id: "1001", updated_at: "2026-10-08T05:30:00Z" }];
  const r = await runMondayPass(db, monday, "safety", opts);
  assert.equal(r.status, "ok");
  const [row] = await db.query<{ updated: Date }>("select monday_updated_at as updated from mirror.monday_items where id = 1001");
  assert.equal(new Date(row.updated).toISOString(), "2026-10-08T05:30:00.000Z");
});

test("passes: the sweep removes items Monday no longer has", async () => {
  await db.query(`insert into mirror.monday_items (id, board_id, name, monday_updated_at)
                  values (1003, 10, 'Test item 1003', '2026-10-01T00:00:00Z')`);
  const r = await runMondayPass(db, monday, "sweep", opts);
  assert.equal(r.status, "ok");
  const [row] = await db.query<{ removed: boolean }>("select removed_at is not null as removed from mirror.monday_items where id = 1003");
  assert.equal(row.removed, true);
});

test("passes: a second pass while one holds the lease is skipped, and runs no lot sync", async () => {
  await db.query("select mirror.try_lock('monday', 'another-pass', 600)");
  const w = watched(db);
  const r = await runMondayPass(w.db, monday, "changes", opts);
  assert.equal(r.status, "skipped");
  assert.equal((await lastRun()).status, "skipped");
  assert.equal(w.ran(LOT_SYNC), 0, "a pass that never ran has stored nothing to sync");
  await db.query("select mirror.unlock('monday', 'another-pass')");
});

test("passes: past its time limit a pass sends no Monday call, ends partial, and leaves the watermark", async () => {
  const watermark = async () =>
    (await db.query<{ w: string | null }>("select watermark::text as w from mirror.sync_state where source = 'monday' and scope = 'account'"))[0]?.w;
  const before = await watermark();
  const sent = monday.documents.length;
  const r = await runMondayPass(db, monday, "changes", { ...opts, deadline: new Date(NOW.getTime() - 1000) });
  assert.equal(r.status, "partial");
  assert.match(r.note ?? "", /time limit/);
  assert.equal(monday.documents.length, sent, "nothing is sent once the time limit has passed");
  assert.equal(await watermark(), before, "the next run re-reads the same changes");
});

test("passes: the sweep starts with the board swept longest ago", async () => {
  await db.query("update mirror.sync_state set swept_at = '2000-01-01', sweep_attempted_at = '2000-01-01' where source = 'monday' and scope = 'board:11'");
  await db.query("update mirror.sync_state set swept_at = now(), sweep_attempted_at = now() where source = 'monday' and scope = 'board:10'");
  world.asked.length = 0;
  const r = await runMondayPass(db, monday, "sweep", opts);
  assert.equal(r.status, "ok");
  assert.equal(world.asked[0], "11");
});

// Added after the brief's eleven tests, for the coordinator's three rulings on Task 12.
const accountWatermark = async () =>
  (await db.query<{ w: string | null }>("select watermark::text as w from mirror.sync_state where source = 'monday' and scope = 'account'"))[0]?.w;
const setAccountWatermark = (at: Date) =>
  db.query("update mirror.sync_state set watermark = $1::timestamptz where source = 'monday' and scope = 'account'", [at.toISOString()]);
const HOUR = 3_600_000;
const logEntry = (id: number) => ({ event: "update_column_value", data: JSON.stringify({ pulse_id: id }), created_at: "17599032000000000" });

test("passes: a changes pass limited to one board never moves the account-wide watermark", async () => {
  await setAccountWatermark(new Date(NOW.getTime() - HOUR));
  const before = await accountWatermark();
  world.logs.set("10", [[logEntry(1001)]]);
  const r = await runMondayPass(db, monday, "changes", { ...opts, boardKey: "test_sales" });
  assert.equal(r.status, "ok");
  assert.equal(await accountWatermark(), before, "the other boards' logs weren't read, so the watermark stays where it was");
  assert.match(r.note ?? "", /watermark unchanged: one board only/);
  const [row] = await db.query<{ unmoved: boolean }>("select watermark_after is null as unmoved from mirror.sync_runs order by id desc limit 1");
  assert.equal(row.unmoved, true, "and the run records no new watermark");
  // The same pass over every board does move it, so the check above can fail.
  await runMondayPass(db, monday, "changes", opts);
  assert.notEqual(await accountWatermark(), before);
  world.logs.clear();
});

test("passes: a full log whose safety check is cut short ends partial and leaves the watermark, so the next run re-reads the window", async () => {
  await setAccountWatermark(new Date(NOW.getTime() - HOUR));
  const before = await accountWatermark();
  world.logs.set("10", [[logEntry(1001), logEntry(1001)], [logEntry(1001), logEntry(1001)], [logEntry(1001), logEntry(1001)]]);
  const limits = { activityLimit: 2, activityMaxPages: 2 };

  // A clock that moves a second for every Monday call sent. Two calls read the log, and the time limit, 1.5 s in,
  // lapses before the third, the safety check. The log's item is queued by then, but nothing is refetched.
  const sent = monday.documents.length;
  const clock = () => new Date(NOW.getTime() + (monday.documents.length - sent) * 1000);
  const r = await runMondayPass(db, monday, "changes", { trigger: "cli", now: clock, limits, deadline: new Date(NOW.getTime() + 1500) });
  assert.equal(r.status, "partial");
  assert.equal(
    r.note,
    "stopped at the run's time limit before the watermark moved, so the next run reads the same window again; " +
      "if that keeps happening, run `npm run mirror -- changes` from the CLI, which has no time limit",
  );
  const mine = monday.documents.slice(sent);
  assert.equal(mine.length, 2, "only the log went out: the safety check never started");
  assert.equal(await accountWatermark(), before, "the check never finished, so the next run re-reads the same window");
  assert.deepEqual(await db.query("select item_id from mirror.monday_refetch_queue"), [{ item_id: 1001 }], "the log's item waits in the queue");

  // With time to finish, the next run does the safety check and only then moves the watermark, then empties the queue.
  const next = await runMondayPass(db, monday, "changes", { ...opts, limits });
  assert.equal(next.status, "partial");
  assert.match(next.note ?? "", /safety/);
  assert.match(next.note ?? "", /entries older than yesterday wait for the weekly sweep/);
  assert.notEqual(await accountWatermark(), before);
  assert.deepEqual(await db.query("select item_id from mirror.monday_refetch_queue"), []);
  world.logs.clear();
});

test("passes: a limit that isn't a positive whole number is refused before the pass starts", async () => {
  world.logs.clear();
  const runs = async () => (await db.query<{ n: number }>("select count(*)::int as n from mirror.sync_runs"))[0].n;
  const runsBefore = await runs();
  const sent = monday.documents.length;
  for (const bad of [0, -1, 1.5, Number.NaN, "100"]) {
    await assert.rejects(
      runMondayPass(db, monday, "changes", { ...opts, limits: { idsPerCall: bad as number } }),
      /limits\.idsPerCall must be a whole number from 1 to 100/,
    );
  }
  await assert.rejects(runMondayPass(db, monday, "sweep", { ...opts, limits: { updatePages: 0 } }), /limits\.updatePages/);
  assert.equal(monday.documents.length, sent, "nothing was sent");
  assert.equal(await runs(), runsBefore, "no run was opened");
  assert.deepEqual(await db.query("select source from mirror.sync_locks"), [], "and no lease was taken");
});

// ---- Follow-up round (the review's Minors). These tests use a second database, emptied before each one, and a fake
// ---- Monday made for the test, so none of them depends on what the tests above left behind.

let db2: Db;
let close2: () => Promise<void>;
before(async () => {
  ({ db: db2, close: close2 } = await migratedTestDb());
  await db2.query("insert into mirror.monday_workspaces (id, name) values (1, 'Test workspace')");
  await db2.query(`insert into mirror.monday_boards (id, workspace_id, name, board_key, purpose, sync_enabled) values
                   (10, 1, 'Test sales', 'test_sales', 'sales', true),
                   (12, 1, 'Test other', 'test_other', 'models', true)`);
  await db2.query(`insert into mirror.monday_boards (id, workspace_id, name, type, board_key, parent_board_id, sync_enabled)
                   values (11, 1, 'Subitems of Test sales', 'sub_items_board', 'test_sales:subitems', 10, true)`);
});
after(async () => close2());

/** Empties what the passes write and enables every board again. */
const reset2 = async () => {
  for (const table of ["monday_items", "monday_updates", "monday_assets", "monday_refetch_queue", "sync_state", "sync_runs", "sync_locks"]) {
    await db2.query(`delete from mirror.${table}`);
  }
  await db2.query("update mirror.monday_boards set sync_enabled = true");
};
const mark2 = (at: Date) => setWatermark(db2, "monday", "account", at);
const marked2 = async () => (await getWatermark(db2, "monday", "account"))?.toISOString() ?? null;
const leases2 = () => db2.query<{ source: string }>("select source from mirror.sync_locks");
const runCount2 = async () => (await db2.query<{ n: number }>("select count(*)::int as n from mirror.sync_runs"))[0].n;
/** The refetch queue, in the order the pass takes it. */
const queued2 = async () =>
  (await db2.query<{ item_id: number }>("select item_id from mirror.monday_refetch_queue order by queued_at, item_id")).map((r) => r.item_id);

/**
 * A Monday for one test. `reply` answers first (return undefined to fall through); whatever it leaves gets the quietest
 * world that works: one item on each board, no comments, an empty log, nothing to refetch. Every call is kept.
 */
function scripted(reply: (doc: string, vars: Record<string, unknown>) => unknown = () => undefined) {
  const calls: { doc: string; vars: Record<string, unknown> }[] = [];
  const fake = fakeMonday((doc, vars) => {
    calls.push({ doc, vars });
    const own = reply(doc, vars);
    if (own !== undefined) return own;
    if (doc.includes("activity_logs")) return { boards: (vars.boards as string[]).map((id) => ({ id, activity_logs: [], updates: [] })) };
    if (doc.includes("__last_updated__")) return { boards: [{ items_page: { cursor: null, items: [] } }] };
    if (doc.includes("updates(limit")) return { boards: [{ updates: [] }] };
    if (doc.includes("items(ids")) return { items: [] };
    if (doc.includes("next_items_page")) return { next_items_page: { cursor: null, items: [] } };
    if (doc.includes("items_page")) {
      const board = Number((vars.board as string[])[0]);
      const item = raw(board * 100 + 1, board, "2026-10-07T00:00:00Z");
      const items = doc.includes("id name state") ? [item] : [{ id: item.id, updated_at: item.updated_at }];
      return { boards: [{ items_page: { cursor: null, items } }] };
    }
    throw new Error(`unexpected document: ${doc.slice(0, 80)}`);
  });
  return Object.assign(fake, { calls });
}

/** `inner`, with every statement noted and the ones `fail` picks made to throw instead of running. */
function watched(inner: Db, fail: (text: string, params?: readonly unknown[]) => Error | undefined = () => undefined) {
  const seen: string[] = [];
  const wrapped: Db = {
    query: async <T>(text: string, params?: readonly unknown[]) => {
      seen.push(text);
      const failure = fail(text, params);
      if (failure) throw failure;
      return inner.query<T>(text, params);
    },
    transaction: (fn) => inner.transaction(fn),
  };
  return { db: wrapped, ran: (needle: string) => seen.filter((text) => text.includes(needle)).length };
}
const LOT_SYNC = "sync_land_lots_from_monday";

test("passes: a backfill limited to one board leaves the watermark unset and says so, and a backfill over every board sets it", async () => {
  await reset2();
  const m = scripted();
  const one = await runMondayPass(db2, m, "backfill", { ...opts, boardKey: "test_sales" });
  assert.equal(one.status, "ok");
  assert.equal(one.note, "watermark not started: one board only", "the README's first run: the note says why changes will wait");
  assert.equal(await marked2(), null, "the other boards haven't been read, so changes can't start from here");
  const firstPages = m.calls.filter((c) => c.doc.includes("items_page") && !c.doc.includes("next_items_page"));
  assert.deepEqual(firstPages.map((c) => (c.vars.board as string[])[0]), ["10", "11"], "only that board and its subitems board were read");

  const waiting = await runMondayPass(db2, m, "changes", opts);
  assert.equal(waiting.status, "skipped");
  assert.equal(waiting.note, "no watermark yet: run `npm run mirror -- backfill` (all boards) first");

  await runMondayPass(db2, m, "backfill", opts);
  assert.equal(await marked2(), NOW.toISOString());

  // With the watermark started, a backfill of one board has nothing more to say.
  const again = await runMondayPass(db2, m, "backfill", { ...opts, boardKey: "test_sales" });
  assert.equal(again.status, "ok");
  assert.equal(again.note, null);
  assert.equal(await marked2(), NOW.toISOString(), "and leaves it where it was");
});

test("passes: limits above what Monday takes are refused, and the largest it takes is accepted", async () => {
  await reset2();
  await mark2(new Date(NOW.getTime() - HOUR));
  const m = scripted();
  const runsBefore = await runCount2();
  await assert.rejects(
    runMondayPass(db2, m, "changes", { ...opts, limits: { idsPerCall: 101 } }),
    /limits\.idsPerCall must be a whole number from 1 to 100, not 101/,
  );
  await assert.rejects(
    runMondayPass(db2, m, "changes", { ...opts, limits: { activityLimit: 10_001 } }),
    /limits\.activityLimit must be a whole number from 1 to 10000, not 10001/,
  );
  assert.equal(m.calls.length, 0, "nothing was sent");
  assert.equal(await runCount2(), runsBefore, "no run was opened");
  assert.deepEqual(await leases2(), [], "and no lease was taken");

  const r = await runMondayPass(db2, m, "changes", { ...opts, limits: { idsPerCall: 100, activityLimit: 10_000 } });
  assert.equal(r.status, "ok", "the largest values Monday takes are fine");
});

test("passes: the land lot sync runs once after a pass that finished, and once after one the time limit cut short", async () => {
  await reset2();
  await mark2(new Date(NOW.getTime() - HOUR));
  const done = watched(db2);
  const finished = await runMondayPass(done.db, scripted(), "safety", opts);
  assert.equal(finished.status, "ok");
  assert.equal(done.ran(LOT_SYNC), 1);

  const cut = watched(db2);
  const stopped = await runMondayPass(cut.db, scripted(), "changes", { ...opts, deadline: new Date(NOW.getTime() - 1000) });
  assert.equal(stopped.status, "partial");
  assert.equal(cut.ran(LOT_SYNC), 1, "the lots this pass stored needn't wait for the next one");
});

test("passes: a pass that was skipped doesn't run the land lot sync", async () => {
  await reset2();
  const w = watched(db2);
  const noBoard = await runMondayPass(w.db, scripted(), "changes", { ...opts, boardKey: "no_such_board" });
  const noWatermark = await runMondayPass(w.db, scripted(), "changes", opts);
  assert.deepEqual([noBoard.status, noWatermark.status], ["skipped", "skipped"]);
  assert.equal(w.ran(LOT_SYNC), 0);
});

test("passes: a failing land lot sync makes an ok pass partial, names itself in error, and leaves the Monday work standing", async () => {
  await reset2();
  await mark2(new Date(NOW.getTime() - HOUR));
  const broken = watched(db2, (text) => (text.includes(LOT_SYNC) ? new Error("lot sync broke") : undefined));
  const r = await runMondayPass(broken.db, scripted(), "changes", opts);
  assert.equal(r.status, "partial");
  assert.equal(r.error, "land lot sync failed: lot sync broke");
  assert.equal(await marked2(), NOW.toISOString(), "the Monday work was done, so the watermark moved");
  const [row] = await db2.query<{ status: string; error: string | null }>("select status, error from mirror.sync_runs order by id desc limit 1");
  assert.deepEqual(row, { status: "partial", error: "land lot sync failed: lot sync broke" }, "and the run row says the same");

  // Any other status stays as it is: a failed pass keeps its own error and gains the sync's.
  const refused = scripted(() => {
    throw new Error("boom");
  });
  const f = await runMondayPass(broken.db, refused, "changes", opts);
  assert.equal(f.status, "failed");
  assert.equal(f.error, "boom; land lot sync failed: lot sync broke");
});

test("passes: a clock that throws during setup leaves no lease and no run behind", async () => {
  await reset2();
  const runsBefore = await runCount2();
  try {
    await assert.rejects(
      runMondayPass(db2, scripted(), "safety", {
        trigger: "cli",
        now: () => {
          throw new Error("clock broke");
        },
      }),
      /clock broke/,
    );
    assert.deepEqual(await leases2(), [], "nothing took the lease before the pass could start");
    assert.equal(await runCount2(), runsBefore);
  } finally {
    await db2.query("delete from mirror.sync_locks"); // a stranded lease would turn every later test into a skip
  }
});

test("passes: a run that can't be recorded still returns what the pass did, and frees the lease", async () => {
  await reset2();
  const w = watched(db2, (text) => (text.includes("update mirror.sync_runs") ? new Error("connection reset") : undefined));
  const m = scripted();
  const r = await runMondayPass(w.db, m, "safety", opts);
  assert.equal(r.status, "ok", "the pass's own status, not the bookkeeping's");
  assert.equal(r.calls, m.calls.length, "and its own counts");
  assert.equal(r.error, "the run couldn't be recorded: connection reset");
  const next = await beginRun(db2, "monday", "safety", "cli", 60);
  assert.ok(next, "the lease was freed at once");
  await endRun(db2, next, { status: "ok", calls: 0, complexity: 0, seen: 0, changed: 0, note: null, error: null, watermarkBefore: null, watermarkAfter: null });
});

test("passes: a run that can't be recorded keeps the error of a pass that already failed, and frees the lease", async () => {
  await reset2();
  const w = watched(db2, (text) => (text.includes("update mirror.sync_runs") ? new Error("connection reset") : undefined));
  const refused = scripted(() => {
    throw new Error("boom");
  });
  const r = await runMondayPass(w.db, refused, "safety", opts);
  assert.equal(r.status, "failed");
  assert.equal(r.error, "boom; the run couldn't be recorded: connection reset", "both texts, the pass's own first");
  assert.deepEqual(await leases2(), [], "the lease was freed");
});

test("passes: a pass cut short by its time limit says where the next run starts, by mode", async () => {
  await reset2();
  await mark2(new Date(NOW.getTime() - HOUR));
  const lapsed = new Date(NOW.getTime() - 1000);
  const notes: Record<string, string | null> = {};
  for (const mode of ["backfill", "changes", "safety", "sweep"] as const) {
    notes[mode] = (await runMondayPass(db2, scripted(), mode, { ...opts, deadline: lapsed })).note;
  }
  assert.deepEqual(notes, {
    backfill: "stopped at the run's time limit; run backfill again to finish (it starts from the first board)",
    // Cut before the log was read: nothing is queued and the watermark is where it was.
    changes:
      "stopped at the run's time limit before the watermark moved, so the next run reads the same window again; " +
      "if that keeps happening, run `npm run mirror -- changes` from the CLI, which has no time limit",
    safety: "stopped at the run's time limit; the next safety run starts again from the first board",
    // No board has been swept, so the first in id order was the one cut.
    sweep:
      "stopped at the run's time limit while sweeping test_sales; it goes to the back of the order; " +
      "if it never finishes, run `npm run mirror -- sweep --board test_sales` from the CLI",
  });
});

test("passes: a board key that matches no enabled board says so, and the setup hint stays for no boards at all", async () => {
  await reset2();
  const unknown = await runMondayPass(db2, scripted(), "changes", { ...opts, boardKey: "nope" });
  assert.equal(unknown.status, "skipped");
  assert.equal(unknown.note, "no enabled board is called nope: `npm run mirror -- status` lists them");

  await db2.query("update mirror.monday_boards set sync_enabled = false");
  const hint = "no boards are enabled: run `npm run mirror -- setup` first";
  assert.equal((await runMondayPass(db2, scripted(), "changes", opts)).note, hint);
  assert.equal((await runMondayPass(db2, scripted(), "changes", { ...opts, boardKey: "test_sales" })).note, hint, "no key can name a board when none is enabled");
});

test("passes: a backfill whose comments stop at the page limit ends partial and says so, naming the board and the pages", async () => {
  await reset2();
  await mark2(new Date(NOW.getTime() - HOUR)); // a watermark is already started, so the page limit is all there is to say
  const fullPage = Array.from({ length: 100 }, (_, i) => ({
    id: String(7000 + i),
    item_id: "1201",
    body: "Test comment",
    text_body: "Test comment",
    created_at: "2026-10-07T00:00:00Z",
    updated_at: "2026-10-07T00:00:00Z",
  }));
  const m = scripted((doc) => (doc.includes("updates(limit") ? { boards: [{ updates: fullPage }] } : undefined));
  const r = await runMondayPass(db2, m, "backfill", { ...opts, boardKey: "test_other", limits: { updatePages: 2 } });
  assert.equal(r.status, "partial", '"ok" means complete, and older comments may be missing');
  assert.equal(r.note, "test_other: comments stopped at 2 pages, so older ones may be missing");
  assert.equal(m.calls.filter((c) => c.doc.includes("updates(limit")).length, 2, "and no further page was asked for");
  const [row] = await db2.query<{ status: string }>("select status from mirror.sync_runs order by id desc limit 1");
  assert.equal(row.status, "partial", "the run row says the same");

  // Comments that fit under the limit are no cause for a note, and the pass is complete.
  await reset2();
  await mark2(new Date(NOW.getTime() - HOUR));
  const quiet = await runMondayPass(db2, scripted(), "backfill", { ...opts, boardKey: "test_other", limits: { updatePages: 2 } });
  assert.equal(quiet.status, "ok");
  assert.equal(quiet.note, null);

  // With no watermark yet, a board-limited backfill gives both reasons, the page limit first.
  await reset2();
  const both = await runMondayPass(db2, m, "backfill", { ...opts, boardKey: "test_other", limits: { updatePages: 2 } });
  assert.equal(both.status, "partial");
  assert.equal(both.note, "test_other: comments stopped at 2 pages, so older ones may be missing; watermark not started: one board only");
});

test("passes: the activity request reads from two minutes before the watermark", async () => {
  await reset2();
  await mark2(new Date("2026-10-08T03:30:00Z"));
  const m = scripted();
  await runMondayPass(db2, m, "changes", opts);
  const log = m.calls.find((c) => c.doc.includes("activity_logs"));
  assert.equal(log?.vars.from, "2026-10-08T03:28:00.000Z");
});

for (const [label, thrown] of [
  ["our own call cap", () => new MondayCapReachedError("No Monday calls left today", "CAP_REACHED")],
  ["Monday's daily limit", () => new MondayDailyLimitError("Daily limit exceeded", "DAILY_LIMIT_EXCEEDED", 200)],
] as const) {
  test(`passes: ${label} ends a changes pass partial, with the message in error, the log's item queued for the next run, and the lot sync still run`, async () => {
    await reset2();
    const earlier = new Date(NOW.getTime() - HOUR);
    await mark2(earlier);
    // The log is read; the refetch it asks for is refused.
    const m = scripted((doc) => {
      if (doc.includes("items(ids")) throw thrown();
      if (doc.includes("activity_logs")) return { boards: [{ id: "10", activity_logs: [logEntry(1001)], updates: [] }] };
      return undefined;
    });
    const w = watched(db2);
    const r = await runMondayPass(w.db, m, "changes", opts);
    assert.equal(r.status, "partial");
    assert.equal(r.error, thrown().message);
    assert.equal(r.note, "1 item(s) wait in the refetch queue for the next run");
    assert.equal(await marked2(), NOW.toISOString(), "the log was read and its item queued, so the watermark moved");
    assert.deepEqual(await queued2(), [1001]);
    assert.equal(w.ran(LOT_SYNC), 1, "what the pass stored before it stopped is synced");

    // The next pass, with calls to spare, refetches it.
    const next = scripted((doc, vars) =>
      doc.includes("items(ids") ? { items: (vars.ids as string[]).map((id) => raw(Number(id), 10, "2026-10-08T05:00:00Z")) } : undefined);
    assert.equal((await runMondayPass(db2, next, "changes", opts)).status, "ok");
    assert.deepEqual(await queued2(), []);
    assert.equal(next.calls.filter((c) => c.doc.includes("items(ids")).length, 1);
  });
}

test("passes: a second backfill leaves an existing watermark where it was", async () => {
  await reset2();
  const m = scripted();
  await runMondayPass(db2, m, "backfill", opts);
  assert.equal(await marked2(), NOW.toISOString());
  const later = new Date(NOW.getTime() + HOUR);
  await runMondayPass(db2, m, "backfill", { ...opts, now: () => later });
  assert.equal(await marked2(), NOW.toISOString(), "only the first backfill starts the watermark");
});

test("passes: ids are refetched idsPerCall at a time, each call asking for exactly what it carries", async () => {
  await reset2();
  await mark2(new Date(NOW.getTime() - HOUR));
  const ids = [3001, 3002, 3003, 3004, 3005];
  const m = scripted((doc, vars) => {
    if (doc.includes("activity_logs")) {
      return { boards: (vars.boards as string[]).map((id) => ({ id, activity_logs: id === "10" ? ids.map((n) => logEntry(n)) : [], updates: [] })) };
    }
    if (doc.includes("items(ids")) return { items: (vars.ids as string[]).map((id) => raw(Number(id), 10, "2026-10-08T05:00:00Z")) };
    return undefined;
  });
  const r = await runMondayPass(db2, m, "changes", { ...opts, limits: { idsPerCall: 2 } });
  assert.equal(r.status, "ok");
  const refetches = m.calls.filter((c) => c.doc.includes("items(ids"));
  assert.deepEqual(refetches.map((c) => c.vars.ids), [["3001", "3002"], ["3003", "3004"], ["3005"]]);
  assert.deepEqual(refetches.map((c) => c.vars.limit), [2, 2, 1]);
});

test("passes: the measured cost of the first page sizes the next page", async () => {
  for (const [cost, expected] of [[4_000_000, 50], [400_000, 500]] as const) {
    await reset2();
    let m: ReturnType<typeof scripted>;
    m = scripted((doc) => {
      if (doc.includes("next_items_page")) return { next_items_page: { cursor: null, items: [] } };
      if (doc.includes("items_page")) {
        m.stats.lastComplexity = { query: cost, after: 9_000_000, resetInSeconds: 60 };
        return { boards: [{ items_page: { cursor: "cursor-1", items: [] } }] };
      }
      return undefined;
    });
    await runMondayPass(db2, m, "backfill", { ...opts, boardKey: "test_other" });
    const pages = m.calls.filter((c) => c.doc.includes("items_page"));
    assert.deepEqual(pages.map((c) => c.vars.limit), [100, expected], `a first page that cost ${cost} points`);
  }
});

// ---- Final review, Important 2: no pass livelocks on its own time limit. `changes` queues what the log names, moves
// ---- the watermark once the log is read, then refetches the queue; `sweep` sends a board it was cut on to the back.

/** The items each items(ids:) call asked for, in order. */
const refetched = (m: ReturnType<typeof scripted>) =>
  m.calls.filter((c) => c.doc.includes("items(ids")).map((c) => (c.vars.ids as string[]).map(Number));
/** Monday's answer to items(ids:): every id asked for, on board 10. */
const everyId = (vars: Record<string, unknown>) => ({ items: (vars.ids as string[]).map((id) => raw(Number(id), 10, "2026-10-08T05:00:00Z")) });
/** An activity log in which board 10 names these items and the other boards name none. */
const logNaming = (vars: Record<string, unknown>, ids: number[]) => ({
  boards: (vars.boards as string[]).map((id) => ({ id, activity_logs: id === "10" ? ids.map(logEntry) : [], updates: [] })),
});

test("passes: a window that needs more calls than one run's time limit allows is finished by the next run, each item refetched once", async () => {
  // The review's case: 450 items changed (an outage, or a bulk edit), five items(ids:) calls of 100, 30 s a call.
  await reset2();
  await mark2(new Date("2026-10-08T00:00:00Z"));
  const ids = Array.from({ length: 450 }, (_, i) => 100_001 + i);
  const changedAt = Date.parse("2026-10-08T03:00:00Z");
  let clock = Date.parse("2026-10-08T06:00:00Z");
  const m = scripted((doc, vars) => {
    clock += 30_000;
    // The log holds what changed since `from`, so once the watermark has passed 03:00 it names nothing.
    if (doc.includes("activity_logs")) return logNaming(vars, Date.parse(String(vars.from)) <= changedAt ? ids : []);
    if (doc.includes("items(ids")) return everyId(vars);
    return undefined;
  });
  const cronRun = () => {
    const start = clock;
    return runMondayPass(db2, m, "changes", { trigger: "cron", now: () => new Date(clock), deadline: new Date(start + 120_000) });
  };

  // The log at 0 s, and three refetches before the time limit, 120 s in.
  const first = await cronRun();
  assert.equal(first.status, "partial");
  assert.equal(first.note, "stopped at the run's time limit; 150 item(s) wait in the refetch queue for the next run");
  assert.equal(await marked2(), "2026-10-08T06:00:00.000Z", "the log was read, so the watermark moved to when the run started");
  assert.equal((await queued2()).length, 150);

  // The next run reads a log with nothing new in it, and refetches what waits.
  const second = await cronRun();
  assert.equal(second.status, "ok", second.error ?? second.note ?? "");
  assert.equal(second.note, null, "it refetched items, so it doesn't say nothing changed");
  assert.equal(await marked2(), "2026-10-08T06:02:00.000Z");
  assert.deepEqual(await queued2(), []);

  const asked = refetched(m);
  assert.equal(asked.length, 5, "the five calls the window needs, and no more");
  assert.deepEqual(asked.flat(), ids, "each item once, oldest in the queue first");
  const [{ n }] = await db2.query<{ n: number }>("select count(*)::int as n from mirror.monday_items where id between 100001 and 100450");
  assert.equal(n, 450);
});

test("passes: the watermark moves once the log is read; a run cut while refetching records it, and says how many items wait", async () => {
  await reset2();
  const earlier = new Date(NOW.getTime() - HOUR);
  await mark2(earlier);
  const m = scripted((doc, vars) => {
    if (doc.includes("activity_logs")) return logNaming(vars, [3501, 3502, 3503]);
    if (doc.includes("items(ids")) return everyId(vars);
    return undefined;
  });
  // A second a call: the log at 0 s and one refetch at 1 s go out, and the time limit, 2 s in, stops the next.
  const clock = () => new Date(NOW.getTime() + m.calls.length * 1000);
  const r = await runMondayPass(db2, m, "changes", { trigger: "cron", now: clock, limits: { idsPerCall: 1 }, deadline: new Date(NOW.getTime() + 2000) });
  assert.equal(r.status, "partial");
  assert.equal(r.note, "stopped at the run's time limit; 2 item(s) wait in the refetch queue for the next run");
  assert.equal(await marked2(), NOW.toISOString(), "moved to when the run started");
  assert.deepEqual(await queued2(), [3502, 3503]);
  assert.deepEqual(refetched(m), [[3501]]);
  const [run] = await db2.query<{ before: string | null; after: string | null }>(
    "select watermark_before #>> '{}' as before, watermark_after #>> '{}' as after from mirror.sync_runs order by id desc limit 1",
  );
  assert.deepEqual(run, { before: earlier.toISOString(), after: NOW.toISOString() }, "and the run row says where it moved");
});

test("passes: with a full log, the log's items are queued, then the safety check runs, and only then the watermark moves", async () => {
  await reset2();
  await mark2(new Date(NOW.getTime() - HOUR));
  const events: string[] = [];
  const m = scripted((doc, vars) => {
    if (doc.includes("activity_logs")) {
      events.push("log");
      const page = Number(vars.page ?? 1);
      return logNaming(vars, [3600 + page, 3700 + page]); // two entries a page: full at activityLimit 2
    }
    if (doc.includes("__last_updated__")) events.push("safety");
    if (doc.includes("items(ids")) events.push(`refetch ${(vars.ids as string[]).join(" ")}`);
    return undefined;
  });
  const w = watched(db2, (text, params) => {
    if (text.includes("insert into mirror.monday_refetch_queue")) events.push("queue");
    // setWatermark, for the account watermark or the complete mark.
    if (text.includes("insert into mirror.sync_state (source, scope, watermark)")) events.push(`mark ${String(params?.[1])}`);
    return undefined;
  });
  const r = await runMondayPass(w.db, m, "changes", { ...opts, limits: { activityLimit: 2, activityMaxPages: 2 } });
  assert.equal(r.status, "partial");
  assert.match(r.note ?? "", /^the activity log was still full after 2 pages on 1 board\(s\), so the safety check ran on those boards too/);
  // The queue starts empty, so complete is marked at the watermark first; it is marked again once the drain empties it.
  assert.deepEqual(events, [
    "mark complete", "log", "log", "queue", "safety", "mark account", "refetch 3601 3602 3701 3702", "mark complete",
  ]);
});

test("passes: a changes pass limited to one board refetches through the queue too, and never moves the watermark", async () => {
  await reset2();
  const earlier = new Date(NOW.getTime() - HOUR);
  await mark2(earlier);
  const m = scripted((doc, vars) => {
    if (doc.includes("activity_logs")) return logNaming(vars, [3801]);
    if (doc.includes("items(ids")) return everyId(vars);
    return undefined;
  });
  // Cut while refetching: the item waits in the queue, and the watermark stays where it was.
  const clock = () => new Date(NOW.getTime() + m.calls.length * 1000);
  const cut = await runMondayPass(db2, m, "changes", { trigger: "cli", now: clock, boardKey: "test_sales", deadline: new Date(NOW.getTime() + 1000) });
  assert.equal(cut.status, "partial");
  assert.equal(cut.note, "stopped at the run's time limit; 1 item(s) wait in the refetch queue for the next run");
  assert.deepEqual(await queued2(), [3801]);
  assert.equal(await marked2(), earlier.toISOString());

  // With time to finish, the item is refetched and taken out, and the watermark still stays.
  const done = await runMondayPass(db2, m, "changes", { ...opts, boardKey: "test_sales" });
  assert.equal(done.status, "ok");
  assert.equal(done.note, "watermark unchanged: one board only");
  assert.deepEqual(await queued2(), []);
  assert.equal(await marked2(), earlier.toISOString());
  assert.deepEqual(refetched(m), [[3801]]);
});

test("passes: an item the log names that items(ids:) doesn't return is marked removed and taken out of the queue", async () => {
  await reset2();
  await mark2(new Date(NOW.getTime() - HOUR));
  await db2.query("insert into mirror.monday_items (id, board_id, name, monday_updated_at) values (3901, 10, 'Test item 3901', '2026-10-07T00:00:00Z')");
  const m = scripted((doc, vars) => {
    if (doc.includes("activity_logs")) return logNaming(vars, [3901, 3902]);
    // Monday returns 3902 only: 3901 is gone.
    if (doc.includes("items(ids")) return { items: everyId(vars).items.filter((i) => i.id === "3902") };
    return undefined;
  });
  const r = await runMondayPass(db2, m, "changes", opts);
  assert.equal(r.status, "ok");
  const rows = await db2.query<{ id: number; removed: boolean }>(
    "select id, removed_at is not null as removed from mirror.monday_items where id in (3901, 3902) order by id",
  );
  assert.deepEqual(rows, [{ id: 3901, removed: true }, { id: 3902, removed: false }]);
  assert.deepEqual(await queued2(), []);
});

test("passes: a board the sweep's time limit cuts short goes to the back, so the next sweep starts with the other", async () => {
  await reset2();
  await db2.query("update mirror.monday_boards set sync_enabled = false where id = 11"); // two boards: 10 and 12
  const firstPages: string[] = [];
  const m = scripted((doc, vars) => {
    if (doc.includes("next_items_page")) return { next_items_page: { cursor: null, items: [] } };
    if (doc.includes("items_page")) {
      const board = (vars.board as string[])[0];
      firstPages.push(board);
      return { boards: [{ items_page: { cursor: board === "10" ? "cursor-1" : null, items: [] } }] }; // board 10 has a second page
    }
    return undefined;
  });
  // A second a call: board 10's first page goes out at 0 s, and the time limit, 1 s in, stops its second.
  const clock = () => new Date(NOW.getTime() + m.calls.length * 1000);
  const cut = await runMondayPass(db2, m, "sweep", { trigger: "cron", now: clock, deadline: new Date(NOW.getTime() + 1000) });
  assert.equal(cut.status, "partial");
  assert.equal(
    cut.note,
    "stopped at the run's time limit while sweeping test_sales; it goes to the back of the order; " +
      "if it never finishes, run `npm run mirror -- sweep --board test_sales` from the CLI",
  );
  assert.deepEqual(firstPages, ["10"]);

  const next = await runMondayPass(db2, m, "sweep", opts);
  assert.equal(next.status, "ok");
  assert.deepEqual(firstPages, ["10", "12", "10"], "board 12 first, then the board cut last time");
  const swept = await db2.query<{ scope: string; swept: boolean }>(
    "select scope, swept_at is not null as swept from mirror.sync_state where scope like 'board:%' order by scope",
  );
  assert.deepEqual(swept, [{ scope: "board:10", swept: true }, { scope: "board:12", swept: true }]);
});

// ---- Residuals round. R1: the "complete" mark, which the screens' "as of" reads, never runs ahead of the data, and a
// ---- chunk that keeps failing can't hold up the queue. R2: a long run keeps its lease, and stops if it loses it.

/** sync_state('monday', 'complete'): the time up to which every change the logs named is stored. */
const complete2 = async () => (await getWatermark(db2, "monday", "complete"))?.toISOString() ?? null;
const LATER = new Date(NOW.getTime() + HOUR);

test("passes: a changes pass that empties the refetch queue marks the mirror complete up to the watermark it moved to", async () => {
  await reset2();
  await mark2(new Date(NOW.getTime() - HOUR));
  const m = scripted((doc, vars) => {
    if (doc.includes("activity_logs")) return logNaming(vars, [4001, 4002]);
    if (doc.includes("items(ids")) return everyId(vars);
    return undefined;
  });
  const r = await runMondayPass(db2, m, "changes", opts);
  assert.equal(r.status, "ok");
  assert.deepEqual(await queued2(), []);
  assert.equal(await complete2(), NOW.toISOString());
});

test("passes: a pass that leaves items queued moves the account watermark but not complete, and the next pass catches up", async () => {
  await reset2();
  const earlier = new Date(NOW.getTime() - HOUR);
  await mark2(earlier);
  await setWatermark(db2, "monday", "complete", earlier);
  const m = scripted((doc, vars) => {
    if (doc.includes("activity_logs")) return logNaming(vars, [4101, 4102, 4103]);
    if (doc.includes("items(ids")) return everyId(vars);
    return undefined;
  });
  // A second a call: the log and one refetch go out, and the time limit, 2 s in, stops the next.
  const clock = () => new Date(NOW.getTime() + m.calls.length * 1000);
  const cut = await runMondayPass(db2, m, "changes", { trigger: "cron", now: clock, limits: { idsPerCall: 1 }, deadline: new Date(NOW.getTime() + 2000) });
  assert.equal(cut.status, "partial");
  assert.equal(await marked2(), NOW.toISOString(), "the log was read, so the account watermark moved");
  assert.equal(await complete2(), earlier.toISOString(), "two items still wait, so complete stays where the data is");

  const next = await runMondayPass(db2, m, "changes", { trigger: "cli", now: () => LATER });
  assert.equal(next.status, "ok");
  assert.deepEqual(await queued2(), []);
  assert.equal(await complete2(), LATER.toISOString());
});

test("passes: a backfill that starts the watermark marks the mirror complete with it; one limited to a board does neither", async () => {
  await reset2();
  const m = scripted();
  await runMondayPass(db2, m, "backfill", { ...opts, boardKey: "test_sales" });
  assert.equal(await complete2(), null);
  await runMondayPass(db2, m, "backfill", opts);
  assert.equal(await marked2(), NOW.toISOString());
  assert.equal(await complete2(), NOW.toISOString(), "a backfill reads everything");
});

test("passes: a pass that finds the queue empty marks complete at the watermark it read from, before anything can fail", async () => {
  // A database whose account watermark came before the complete mark existed, and a refetch that fails on every run
  // (the re-review's probe). Complete must hold at what was stored, not follow the watermark.
  await reset2();
  const earlier = new Date(NOW.getTime() - HOUR);
  await mark2(earlier);
  const m = scripted((doc, vars) => {
    if (doc.includes("activity_logs")) return logNaming(vars, [4201]);
    if (doc.includes("items(ids")) throw new MondayError("Internal server error on this item", "SOME_ERROR", 200);
    return undefined;
  });
  for (const at of [NOW, LATER]) {
    const r = await runMondayPass(db2, m, "changes", { trigger: "cron", now: () => at });
    assert.equal(r.status, "failed");
    assert.equal(await marked2(), at.toISOString());
    assert.equal(await complete2(), earlier.toISOString(), `after the run at ${at.toISOString()}`);
  }
});

test("passes: a chunk that keeps failing goes to the back of the queue, so the next run refetches the others first", async () => {
  await reset2();
  await mark2(new Date(NOW.getTime() - HOUR));
  // Five items queued in one read, two a call. Any call that asks for 4301 fails.
  let reads = 0;
  const m = scripted((doc, vars) => {
    if (doc.includes("activity_logs")) return logNaming(vars, reads++ === 0 ? [4301, 4302, 4303, 4304, 4305] : []);
    if (doc.includes("items(ids")) {
      if ((vars.ids as string[]).includes("4301")) throw new MondayError("Internal server error on this item", "SOME_ERROR", 200);
      return everyId(vars);
    }
    return undefined;
  });
  const first = await runMondayPass(db2, m, "changes", { ...opts, limits: { idsPerCall: 2 } });
  assert.equal(first.status, "failed", "the pass still ends failed, with the error");
  assert.equal(first.error, "Internal server error on this item");
  assert.deepEqual(await queued2(), [4303, 4304, 4305, 4301, 4302], "the failing chunk went to the back");

  const second = await runMondayPass(db2, m, "changes", { trigger: "cli", now: () => LATER, limits: { idsPerCall: 2 } });
  assert.equal(second.status, "failed");
  assert.deepEqual(refetched(m), [[4301, 4302], [4303, 4304], [4305, 4301]], "the next run took the others first");
  const stored = await db2.query<{ id: number }>("select id from mirror.monday_items where id between 4301 and 4305 order by id");
  assert.deepEqual(stored.map((r) => r.id), [4303, 4304]);
  assert.deepEqual(await queued2(), [4302, 4301, 4305]);
});

test("passes: a changes pass whose lease another pass took over stops partial, and writes nothing more", async () => {
  await reset2();
  await mark2(new Date(NOW.getTime() - HOUR));
  let tookOver = false;
  const m = scripted((doc, vars) => {
    if (doc.includes("activity_logs")) return logNaming(vars, [4401, 4402]);
    if (doc.includes("items(ids")) {
      if (tookOver) return everyId(vars);
      tookOver = true;
      // This call outlasts the run's lease, and a pass started elsewhere takes the lease over while it is out.
      return (async () => {
        await db2.query("update mirror.sync_locks set locked_until = clock_timestamp() - interval '1 second' where source = 'monday'");
        await db2.query("select mirror.try_lock('monday', 'changes:another-pass', 600)");
        return everyId(vars);
      })();
    }
    return undefined;
  });
  const w = watched(db2);
  const r = await runMondayPass(w.db, m, "changes", { ...opts, limits: { idsPerCall: 1 } });
  assert.equal(r.status, "partial");
  assert.equal(r.note, "another pass took over the lease");
  assert.equal(r.error, null);
  assert.equal(refetched(m).length, 1, "Monday wasn't asked again");
  assert.deepEqual(await db2.query("select id from mirror.monday_items where id in (4401, 4402)"), [], "the copy in flight wasn't stored");
  assert.deepEqual(await queued2(), [4401, 4402], "and nothing left the queue");
  assert.equal(w.ran(LOT_SYNC), 0, "the lot sync is the other pass's to run");
  assert.deepEqual(await leases2(), [{ source: "monday" }]);
  assert.deepEqual(await db2.query("select owner from mirror.sync_locks"), [{ owner: "changes:another-pass" }], "its lease is still its own");
});

test("passes: a drain that outlives its lease renews it between chunks, so no other pass can start beside it", async () => {
  await reset2();
  await mark2(new Date(NOW.getTime() - HOUR));
  const seen: { alive: boolean; owner: string; otherStarted: boolean }[] = [];
  const m = scripted((doc, vars) => {
    if (doc.includes("activity_logs")) return logNaming(vars, [4501, 4502, 4503]);
    if (doc.includes("items(ids")) {
      return (async () => {
        const [lease] = await db2.query<{ alive: boolean; owner: string }>(
          "select locked_until > clock_timestamp() as alive, owner from mirror.sync_locks where source = 'monday'",
        );
        const other = await beginRun(db2, "monday", "changes", "cron", 600);
        seen.push({ ...lease, otherStarted: other !== null });
        // Each call outlasts the lease: it has lapsed by the time the call comes back.
        await db2.query("update mirror.sync_locks set locked_until = clock_timestamp() - interval '1 second' where source = 'monday'");
        return everyId(vars);
      })();
    }
    return undefined;
  });
  const r = await runMondayPass(db2, m, "changes", { ...opts, limits: { idsPerCall: 1 } });
  assert.equal(r.status, "ok", r.note ?? r.error ?? "");
  assert.equal(seen.length, 3);
  for (const [i, s] of seen.entries()) {
    assert.deepEqual(s, { alive: true, owner: seen[0].owner, otherStarted: false }, `at call ${i + 1}, the lease was the pass's own and held`);
  }
  assert.deepEqual(await queued2(), []);
});
