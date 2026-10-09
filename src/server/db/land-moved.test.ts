import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { migratedTestDb } from "./pglite";
import { addStaff } from "./test-fixtures";
import type { Db } from "./types";

/**
 * A lot whose Monday item is moved to another board ("Move to board"). The refetch stores the item's new board, so the
 * item drops out of launchpad.monday_land_lots. The lot sync then treats the lot as it treats one whose item left
 * Monday: withdrawn, or only flagged while a hold is active. An item moved back brings its lot back. An item the mirror
 * doesn't have, or one still on an Exclusive Land board (enabled or not), is never taken for moved (final review,
 * Important 1).
 */
let db: Db;
let close: () => Promise<void>;

const LAND = 30;
const SECOND_LAND = 31;
const SALES = 40;
/** A board the mirror doesn't sync: what an item moved to an unmirrored board lands on (the refetch adds it by id). */
const ARCHIVE = 50;

const available = JSON.stringify({ status: { type: "status", text: "Available", label: "Available", value: null } });

before(async () => {
  ({ db, close } = await migratedTestDb());
  await db.query("insert into mirror.monday_workspaces (id, name) values (1, 'Test workspace')");
  await db.query(`insert into mirror.monday_boards (id, workspace_id, name, board_key, purpose, sync_enabled) values
    (${LAND}, 1, 'Test land board', 'exclusive_land', 'exclusive_land', true),
    (${SECOND_LAND}, 1, 'Test second land board', 'exclusive_land_two', 'exclusive_land', true),
    (${SALES}, 1, 'Test sales board', 'test_sales', 'sales', true),
    (${ARCHIVE}, 1, 'Test archive board', null, null, false)`);
  await db.query(`insert into mirror.monday_field_map (board_id, field_key, column_id) values
    (${LAND}, 'lot_status', 'status'), (${SECOND_LAND}, 'lot_status', 'status')`);
  for (const id of ["test-rep-a", "test-rep-b"]) await addStaff(db, id);
});
after(async () => close());

const T0 = "2026-10-08T00:00:00.000Z";
const at = (hours: number) => new Date(Date.parse(T0) + hours * 3_600_000).toISOString();

const sync = async (now = at(0)) =>
  (await db.query<{ n: number }>("select launchpad.sync_land_lots_from_monday($1::timestamptz) as n", [now]))[0].n;

let lots = 0;
/** A new item on a land board, synced into an available lot. */
async function newLot(board = LAND): Promise<{ item: number; lot: string }> {
  lots += 1;
  const item = 3000 + lots;
  await db.query(
    `insert into mirror.monday_items (id, board_id, name, monday_updated_at, column_values)
     values ($1, $2, $3, '2026-10-07T00:00:00Z', $4::jsonb)`,
    [item, board, `Lot ${lots} Test Street, Testville`, available],
  );
  await sync();
  const [row] = await db.query<{ id: string }>("select id::text as id from launchpad.land_lots where monday_item_id = $1", [item]);
  assert.ok(row, `item ${item} became a lot`);
  return { item, lot: row.id };
}

/** What the refetch stores after a "Move to board": the item's new board, the item still live. */
const moveTo = (item: number, board: number) =>
  db.query("update mirror.monday_items set board_id = $2, monday_updated_at = monday_updated_at + interval '1 hour' where id = $1", [
    item, board,
  ]);

async function lotNow(item: number) {
  const [row] = await db.query<{ sale_status: string; flagged: boolean; on_board: boolean }>(
    `select l.sale_status, l.monday_removed_at is not null as flagged,
            exists (select 1 from launchpad.land_lot_board b where b.id = l.id) as on_board
     from launchpad.land_lots l where l.monday_item_id = $1`,
    [item],
  );
  return row;
}

const openHolds = (lot: string) =>
  db.query<{ staff_id: string; active: boolean }>(
    "select staff_id, started_at is not null as active from launchpad.land_holds where lot_id = $1::uuid and ended_at is null order by queued_at",
    [lot],
  );

const place = (lot: string, staff: string, now: string) =>
  db.query("select launchpad.place_hold($1::uuid, $2, null, null, $3::timestamptz)", [lot, staff, now]);

const release = (lot: string, staff: string, now: string) =>
  db.query(
    `select launchpad.release_hold(h.id, $2, $3::timestamptz)
       from launchpad.land_holds h where h.lot_id = $1::uuid and h.staff_id = $2 and h.ended_at is null`,
    [lot, staff, now],
  );

test("land moved: a lot whose item moves to another board while it is unheld is withdrawn, leaves the board and takes no hold", async () => {
  const { item, lot } = await newLot();
  await moveTo(item, ARCHIVE);
  assert.equal(await sync(at(1)), 1, "one lot withdrawn");
  assert.deepEqual(await lotNow(item), { sale_status: "withdrawn", flagged: true, on_board: false });
  await assert.rejects(place(lot, "test-rep-a", at(2)), /land_lot_not_available/);
  assert.equal(await sync(at(2)), 0, "nothing left to change");
});

test("land moved: a lot whose item moves while a hold is active is only flagged, the holds stay, and it is withdrawn once they end", async () => {
  const { item, lot } = await newLot();
  await place(lot, "test-rep-a", at(0));
  await place(lot, "test-rep-b", at(0.5));
  await moveTo(item, SALES);
  assert.equal(await sync(at(1)), 1, "the flag is one change");
  assert.deepEqual(await lotNow(item), { sale_status: "available", flagged: true, on_board: true });
  assert.deepEqual(await openHolds(lot), [
    { staff_id: "test-rep-a", active: true },
    { staff_id: "test-rep-b", active: false },
  ]);
  assert.equal(await sync(at(1)), 0, "flagged once");

  // The holder lets it go, and rep b's queued hold starts. Once that one is released too, nothing holds the lot.
  await release(lot, "test-rep-a", at(2));
  assert.equal(await sync(at(2)), 0, "rep b's hold is active now, so the lot stays");
  await release(lot, "test-rep-b", at(3));
  assert.equal(await sync(at(3)), 1);
  assert.deepEqual(await lotNow(item), { sale_status: "withdrawn", flagged: true, on_board: false });
});

test("land moved: an item moved back onto the Exclusive Land board brings its lot back, and a held lot loses its flag", async () => {
  const withdrawn = await newLot();
  await moveTo(withdrawn.item, ARCHIVE);
  await sync(at(1));
  assert.equal((await lotNow(withdrawn.item)).sale_status, "withdrawn");

  const held = await newLot();
  await place(held.lot, "test-rep-a", at(0));
  await moveTo(held.item, SALES);
  await sync(at(1));
  assert.equal((await lotNow(held.item)).flagged, true);

  await moveTo(withdrawn.item, LAND);
  await moveTo(held.item, LAND);
  assert.equal(await sync(at(2)), 2, "both lots rewritten");
  assert.deepEqual(await lotNow(withdrawn.item), { sale_status: "available", flagged: false, on_board: true });
  assert.deepEqual(await lotNow(held.item), { sale_status: "available", flagged: false, on_board: true });
  assert.deepEqual(await openHolds(held.lot), [{ staff_id: "test-rep-a", active: true }], "the hold carried on");
  await release(held.lot, "test-rep-a", at(3));
});

test("land moved: an item on a disabled Exclusive Land board, or one the mirror doesn't have, is not taken for moved", async () => {
  const onDisabled = await newLot(SECOND_LAND);
  const movedToDisabled = await newLot();
  const missing = await newLot();
  await db.query("update mirror.monday_boards set sync_enabled = false where id = $1", [SECOND_LAND]);
  await moveTo(movedToDisabled.item, SECOND_LAND);
  await db.query("delete from mirror.monday_items where id = $1", [missing.item]);
  try {
    assert.equal(await sync(at(1)), 0, "nothing withdrawn, nothing flagged");
    for (const { item } of [onDisabled, movedToDisabled, missing]) {
      assert.deepEqual(await lotNow(item), { sale_status: "available", flagged: false, on_board: true }, `item ${item}`);
    }
  } finally {
    await db.query("update mirror.monday_boards set sync_enabled = true where id = $1", [SECOND_LAND]);
  }
});

test("land moved: an item moved and then archived on its new board is withdrawn too, whether or not a sync ran in between", async () => {
  const between = await newLot();
  const held = await newLot();
  await place(held.lot, "test-rep-a", at(0));
  const archive = (item: number, when: string) =>
    db.query("update mirror.monday_items set state = 'archived', removed_at = $2::timestamptz where id = $1", [item, when]);

  // Between two syncs: the refetch stores the new board and the archived state at once.
  await moveTo(between.item, ARCHIVE);
  await archive(between.item, at(1));
  // While held: moved, synced (so only flagged), and archived on the new board after that.
  await moveTo(held.item, SALES);
  assert.equal(await sync(at(1)), 2, "the unheld lot is withdrawn and the held one flagged");
  await archive(held.item, at(2));
  assert.equal(await sync(at(2)), 0, "the held lot keeps its flag and its hold");
  assert.deepEqual(await lotNow(between.item), { sale_status: "withdrawn", flagged: true, on_board: false });
  assert.deepEqual(await lotNow(held.item), { sale_status: "available", flagged: true, on_board: true });

  // Once the hold ends, the lot goes, as a lot whose item was removed on the Exclusive Land board does.
  await release(held.lot, "test-rep-a", at(3));
  assert.equal(await sync(at(3)), 1);
  assert.deepEqual(await lotNow(held.item), { sale_status: "withdrawn", flagged: true, on_board: false });
});

test("land moved: a lot Launchpad owns is never withdrawn by a move", async () => {
  const { item, lot } = await newLot();
  await db.query("update launchpad.land_lots set source = 'launchpad' where id = $1::uuid", [lot]);
  await moveTo(item, ARCHIVE);
  assert.equal(await sync(at(1)), 0);
  assert.deepEqual(await lotNow(item), { sale_status: "available", flagged: false, on_board: true });
});

test("land moved: with the status column unmapped the sync changes nothing, a moved item's lot included", async () => {
  const other = await migratedTestDb();
  try {
    await other.db.query("insert into mirror.monday_workspaces (id, name) values (1, 'Test workspace')");
    await other.db.query(`insert into mirror.monday_boards (id, workspace_id, name, board_key, purpose, sync_enabled) values
      (${LAND}, 1, 'Test land board', 'exclusive_land', 'exclusive_land', true),
      (${SALES}, 1, 'Test sales board', 'test_sales', 'sales', true)`);
    // A lot from an earlier import, whose item has since moved to the sales board.
    await other.db.query(
      "insert into mirror.monday_items (id, board_id, name, monday_updated_at) values (3901, $1, 'Lot 90 Test Street, Testville', now())",
      [SALES],
    );
    await other.db.query("insert into launchpad.land_lots (monday_item_id, source, lot_label) values (3901, 'monday', 'Lot 90 Test Street, Testville')");
    const status = async () =>
      (await other.db.query<{ s: string }>("select sale_status as s from launchpad.land_lots where monday_item_id = 3901"))[0].s;

    assert.equal((await other.db.query<{ n: number }>("select launchpad.sync_land_lots_from_monday() as n"))[0].n, 0);
    assert.equal(await status(), "available", "no mapping, no change");

    await other.db.query("insert into mirror.monday_field_map (board_id, field_key, column_id) values ($1, 'lot_status', 'status')", [LAND]);
    assert.equal((await other.db.query<{ n: number }>("select launchpad.sync_land_lots_from_monday() as n"))[0].n, 1);
    assert.equal(await status(), "withdrawn", "once mapped, the moved item's lot goes");
  } finally {
    await other.close();
  }
});
