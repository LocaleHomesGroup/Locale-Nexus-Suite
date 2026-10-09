import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { migratedTestDb } from "../db/pglite";
import type { Db } from "../db/types";
import { readStatus, repsLines, statusLines } from "./cli-report";

let db: Db;
let close: () => Promise<void>;
before(async () => ({ db, close } = await migratedTestDb()));
after(async () => close());

const NOW = new Date("2026-10-09T03:00:00Z");
const minutesAgo = (m: number) => new Date(NOW.getTime() - m * 60_000);

/** Each test starts from an empty mirror, so none depends on what an earlier one left. */
async function reset() {
  await db.query("delete from mirror.monday_field_map");
  await db.query("delete from mirror.monday_assets");
  await db.query("delete from mirror.monday_items");
  await db.query("delete from launchpad.land_lots");
  await db.query("delete from mirror.monday_boards where parent_board_id is not null");
  await db.query("delete from mirror.monday_boards");
  await db.query("delete from mirror.api_calls");
  await db.query("delete from mirror.sync_runs");
}

const summary = async (cap = 2000) => statusLines(await readStatus(db, cap), NOW).filter((l) => !l.startsWith("  "));

test("status: an empty mirror reads as zeros, and says the land status column isn't mapped", async () => {
  await reset();
  assert.deepEqual(await summary(), [
    "boards enabled: 0 (+ 0 subitems boards)",
    "items: 0 live, 0 removed",
    "files: 0 copied, 0 waiting, 0 over the size limit",
    "Exclusive Land: 0 lot(s) from Monday; status column NOT mapped yet, so lots don't sync (run setup)",
    "Monday calls today (UTC): 0 of the 2000 cap",
  ]);
});

test("status: counts boards, items, files and lots, and notices when the land status column is mapped", async () => {
  await reset();
  await db.query("insert into mirror.monday_workspaces (id, name) values (1, 'Test workspace') on conflict do nothing");
  await db.query(
    `insert into mirror.monday_boards (id, workspace_id, name, board_key, purpose, sync_enabled) values
       (10, 1, 'Test sales', 'test_sales', 'sales', true),
       (20, 1, 'Test land', 'test_land', 'exclusive_land', true),
       (30, 1, 'Test off', 'test_off', 'other', false)`,
  );
  await db.query(
    `insert into mirror.monday_boards (id, workspace_id, name, type, board_key, parent_board_id, sync_enabled)
     values (11, 1, 'Test sales subitems', 'sub_items_board', 'test_sales:subitems', 10, true)`,
  );
  // Enabled but not set up yet, so it has no key to name it by.
  await db.query("insert into mirror.monday_boards (id, workspace_id, name, sync_enabled) values (40, 1, 'Test unkeyed', true)");
  await db.query(
    `insert into mirror.monday_items (id, board_id, name, monday_updated_at, removed_at) values
       (1001, 10, 'Test item A', now(), null),
       (1002, 10, 'Test item B', now(), null),
       (1003, 10, 'Test item C', now(), now())`,
  );
  // copied, waiting, waiting, too large, removed (not waiting), failed for good (not waiting)
  await db.query(
    `insert into mirror.monday_assets (id, item_id, name, storage_path, download_error, removed_at) values
       (1, 1001, 'a.pdf', '10/1001/1/a.pdf', null, null),
       (2, 1001, 'b.pdf', null, null, null),
       (3, 1002, 'c.pdf', null, null, null),
       (4, 1002, 'd.mov', null, 'too_large', null),
       (5, 1002, 'e.pdf', null, null, now()),
       (6, 1002, 'f.pdf', null, 'download failed: HTTP 500', null)`,
  );
  // 12.5 today. Another day and another source don't count.
  await db.query(
    `insert into mirror.api_calls (source, day, calls) values
       ('monday', (now() at time zone 'utc')::date, 12.5),
       ('monday', (now() at time zone 'utc')::date - 1, 99),
       ('hubspot', (now() at time zone 'utc')::date, 40)`,
  );
  await db.query("insert into launchpad.land_lots (lot_label) values ('Test Lot 1')");
  await db.query("insert into launchpad.land_lots (lot_label, source) values ('Test Lot 2', 'launchpad')");

  // The keys are the ones --board takes: enabled, parent boards only (a subitems board comes with its parent), in key order.
  const unmapped = [
    "boards enabled: 3 (+ 1 subitems boards): test_land, test_sales",
    "items: 2 live, 1 removed",
    "files: 1 copied, 2 waiting, 1 over the size limit",
    "Exclusive Land: 1 lot(s) from Monday; status column NOT mapped yet, so lots don't sync (run setup)",
    "Monday calls today (UTC): 12.5 of the 2000 cap",
  ];
  assert.deepEqual(await summary(), unmapped);

  // The same field on a board that isn't Exclusive Land doesn't count.
  await db.query("insert into mirror.monday_field_map (board_id, field_key, column_id) values (10, 'lot_status', 'test_col')");
  assert.deepEqual(await summary(), unmapped);

  await db.query("insert into mirror.monday_field_map (board_id, field_key, column_id) values (20, 'lot_status', 'test_col')");
  const mapped = await summary();
  assert.equal(mapped[3], "Exclusive Land: 1 lot(s) from Monday; status column mapped");
  assert.equal(mapped[4], "Monday calls today (UTC): 12.5 of the 2000 cap", "the cap shown is the one passed in");
  assert.equal((await summary(5000))[4], "Monday calls today (UTC): 12.5 of the 5000 cap");
});

test("status: says when Monday's daily limit was hit today", async () => {
  await reset();
  await db.query("insert into mirror.api_calls (source, day, calls) values ('monday', (now() at time zone 'utc')::date, 30)");
  assert.equal((await summary())[4], "Monday calls today (UTC): 30 of the 2000 cap");

  await db.query("update mirror.api_calls set limit_hit_at = now() where source = 'monday'");
  assert.equal(
    (await summary())[4],
    "Monday calls today (UTC): 30 of the 2000 cap; Monday's daily limit was hit, so calls wait for 00:00 UTC",
  );
});

test("status: a run marked running for over an hour is stale, not running; a run's note and error show together", async () => {
  await reset();
  const add = (mode: string, status: string, startedMinutesAgo: number, note: string | null = null, error: string | null = null, calls = 0) =>
    db.query(
      `insert into mirror.sync_runs (source, mode, trigger, started_at, finished_at, status, api_calls, note, error)
       values ('monday', $1, 'cron', $2::timestamptz, $3::timestamptz, $4, $5, $6, $7)`,
      [
        mode,
        minutesAgo(startedMinutesAgo).toISOString(),
        status === "running" ? null : minutesAgo(startedMinutesAgo - 1).toISOString(),
        status,
        calls,
        note,
        error,
      ],
    );
  await add("files", "ok", 180, "7 downloaded, 0 too large, 0 failed, 0 waiting", null, 7);
  await add("backfill", "running", 120); // started two hours ago, no end recorded
  await add("changes", "running", 61); // just over the hour
  await add("safety", "running", 60); // exactly an hour is not "more than"
  await add("sweep", "running", 5);
  await add("changes", "failed", 2, null, "Monday is unreachable");
  // A run can carry both: a pass that finished but whose lot sync failed is partial, with a note and an error.
  await add("changes", "partial", 3, "nothing changed", "land lot sync failed: test failure");

  const runs = statusLines(await readStatus(db, 2000), NOW).filter((l) => l.startsWith("  "));
  assert.deepEqual(runs, [
    `  ${minutesAgo(3).toISOString()}  monday/changes  partial  0 call(s)  nothing changed; land lot sync failed: test failure`,
    `  ${minutesAgo(2).toISOString()}  monday/changes  failed  0 call(s)  Monday is unreachable`,
    `  ${minutesAgo(5).toISOString()}  monday/sweep  running  0 call(s)`,
    `  ${minutesAgo(60).toISOString()}  monday/safety  running  0 call(s)`,
    `  ${minutesAgo(61).toISOString()}  monday/changes  stale (no end recorded)  0 call(s)`,
    `  ${minutesAgo(120).toISOString()}  monday/backfill  stale (no end recorded)  0 call(s)`,
    `  ${minutesAgo(180).toISOString()}  monday/files  ok  7 call(s)  7 downloaded, 0 too large, 0 failed, 0 waiting`,
  ]);
});

test("status: shows the ten latest runs, newest first", async () => {
  await reset();
  for (let i = 1; i <= 12; i++) {
    await db.query(
      "insert into mirror.sync_runs (source, mode, trigger, started_at, finished_at, status) values ('monday', $1, 'cli', $2::timestamptz, $2::timestamptz, 'ok')",
      [`mode${i}`, minutesAgo(100 - i).toISOString()],
    );
  }
  const runs = statusLines(await readStatus(db, 2000), NOW).filter((l) => l.startsWith("  "));
  assert.equal(runs.length, 10);
  assert.match(runs[0], /monday\/mode12 /);
  assert.match(runs[9], /monday\/mode3 /);
});

test("reps: says how many names matched, and lists the rest as needing an alias by hand", () => {
  assert.deepEqual(repsLines({ matched: 3, unmatched: [] }), ["matched 3 rep name(s)"]);
  assert.deepEqual(repsLines({ matched: 1, unmatched: ["Sam Lee", "Pat O'Rep"] }), [
    "matched 1 rep name(s)",
    "no single staff match, add an alias to launchpad.staff_aliases by hand: Sam Lee; Pat O'Rep",
  ]);
});
