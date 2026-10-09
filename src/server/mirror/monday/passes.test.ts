import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { migratedTestDb } from "../../db/pglite";
import type { Db } from "../../db/types";
import { beginRun, endRun, getWatermark, setWatermark } from "../runs";
import type { RawActivityLog } from "./activity";
import { MondayCapReachedError, MondayDailyLimitError } from "./client";
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

test("passes: the sweep starts with the board swept longest ago, so a sweep cut short resumes there", async () => {
  await db.query("update mirror.sync_state set swept_at = '2000-01-01' where source = 'monday' and scope = 'board:11'");
  await db.query("update mirror.sync_state set swept_at = now() where source = 'monday' and scope = 'board:10'");
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

  // A clock that moves a second for every Monday call sent. Two calls read the log and one refetches the item;
  // the time limit, 2.5 s in, lapses before the fourth, the safety check.
  const sent = monday.documents.length;
  const clock = () => new Date(NOW.getTime() + (monday.documents.length - sent) * 1000);
  const r = await runMondayPass(db, monday, "changes", { trigger: "cli", now: clock, limits, deadline: new Date(NOW.getTime() + 2500) });
  assert.equal(r.status, "partial");
  assert.match(r.note ?? "", /time limit/);
  const mine = monday.documents.slice(sent);
  assert.equal(mine.length, 3, "the log twice and the refetch went out");
  assert.ok(mine[2].includes("items(ids"), "the refetch was the last call: the safety check never started");
  assert.equal(await accountWatermark(), before, "the check never finished, so the next run re-reads the same window");

  // With time to finish, the next run does the safety check and only then moves the watermark.
  const next = await runMondayPass(db, monday, "changes", { ...opts, limits });
  assert.equal(next.status, "partial");
  assert.match(next.note ?? "", /safety/);
  assert.match(next.note ?? "", /entries older than yesterday wait for the weekly sweep/);
  assert.notEqual(await accountWatermark(), before);
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
  for (const table of ["monday_items", "monday_updates", "monday_assets", "sync_state", "sync_runs", "sync_locks"]) {
    await db2.query(`delete from mirror.${table}`);
  }
  await db2.query("update mirror.monday_boards set sync_enabled = true");
};
const mark2 = (at: Date) => setWatermark(db2, "monday", "account", at);
const marked2 = async () => (await getWatermark(db2, "monday", "account"))?.toISOString() ?? null;
const leases2 = () => db2.query<{ source: string }>("select source from mirror.sync_locks");
const runCount2 = async () => (await db2.query<{ n: number }>("select count(*)::int as n from mirror.sync_runs"))[0].n;

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
function watched(inner: Db, fail: (text: string) => Error | undefined = () => undefined) {
  const seen: string[] = [];
  const wrapped: Db = {
    query: async <T>(text: string, params?: readonly unknown[]) => {
      seen.push(text);
      const failure = fail(text);
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
    changes: "stopped at the run's time limit; the next run picks up from here",
    safety: "stopped at the run's time limit; the next safety run starts again from the first board",
    sweep: "stopped at the run's time limit; the next run picks up from here",
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
  test(`passes: ${label} ends a changes pass partial, with the message in error, the watermark where it was, and the lot sync still run`, async () => {
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
    assert.equal(await marked2(), earlier.toISOString(), "the window wasn't finished, so the next run re-reads it");
    assert.equal(w.ran(LOT_SYNC), 1, "what the pass stored before it stopped is synced");
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
