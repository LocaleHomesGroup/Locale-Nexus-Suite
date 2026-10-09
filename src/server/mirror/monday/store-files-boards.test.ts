import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { migratedTestDb } from "../../db/pglite";
import type { Db } from "../../db/types";
import { syncFileAssets, syncedBoards } from "./store";

let db: Db;
let close: () => Promise<void>;
before(async () => ({ db, close } = await migratedTestDb()));
after(async () => close());

const file = (id: number, item: number, name: string) => ({ id, item_id: item, column_id: "files", update_id: null, name });
const assetsOf = (item: number) =>
  db.query<{ id: number; name: string; removed: boolean }>(
    "select id, name, removed_at is not null as removed from mirror.monday_assets where item_id = $1 order by id",
    [item],
  );

test("store: a file taken out of a column is restored when a later good read lists it again", async () => {
  await syncFileAssets(db, [3001], [file(9101, 3001, "a.pdf"), file(9102, 3001, "b.pdf")]);
  await syncFileAssets(db, [3001], [file(9101, 3001, "a.pdf")]);
  assert.deepEqual(await assetsOf(3001), [
    { id: 9101, name: "a.pdf", removed: false },
    { id: 9102, name: "b.pdf", removed: true },
  ]);

  // The same file is back in the column (renamed since): it is live again, under its new name.
  await syncFileAssets(db, [3001], [file(9101, 3001, "a.pdf"), file(9102, 3001, "b-renamed.pdf")]);
  assert.deepEqual(await assetsOf(3001), [
    { id: 9101, name: "a.pdf", removed: false },
    { id: 9102, name: "b-renamed.pdf", removed: false },
  ]);
});

test("store: syncing an item's file columns leaves another item's files and a file attached to an update alone", async () => {
  await syncFileAssets(db, [3002], [file(9201, 3002, "own.pdf")]);
  await syncFileAssets(db, [3003], [file(9301, 3003, "other.pdf")]);
  // A file attached to an update has no column.
  await db.query("insert into mirror.monday_assets (id, item_id, column_id, update_id, name) values (9202, 3002, null, 7001, 'attached.pdf')");

  await syncFileAssets(db, [3002], []);

  assert.deepEqual(await assetsOf(3002), [
    { id: 9201, name: "own.pdf", removed: true },
    { id: 9202, name: "attached.pdf", removed: false },
  ]);
  assert.deepEqual(await assetsOf(3003), [{ id: 9301, name: "other.pdf", removed: false }]);
});

test("store: synced boards list every parent before any subitems board, and a key brings that board's own subitems board", async () => {
  // Two parents, each with a subitems board. The ids are chosen so that plain id order would interleave them
  // (3005 is a subitems board and comes before the parent 3010), and a third parent is switched off.
  const board = (id: number, key: string, over: { parent?: number; enabled?: boolean } = {}) =>
    db.query(
      `insert into mirror.monday_boards (id, name, board_key, parent_board_id, type, sync_enabled)
       values ($1, $2, $3, $4, $5, $6)`,
      [id, `Test board ${id}`, key, over.parent ?? null, over.parent ? "sub_items_board" : "board", over.enabled ?? true],
    );
  await board(3010, "test_a");
  await board(3020, "test_b");
  await board(3030, "test_off", { enabled: false });
  await board(3015, "test_a:subitems", { parent: 3010 });
  await board(3005, "test_b:subitems", { parent: 3020 });
  await board(3035, "test_off:subitems", { parent: 3030, enabled: false });

  assert.deepEqual((await syncedBoards(db)).map((b) => b.id), [3010, 3020, 3015, 3005], "parents first, then their subitems boards");
  assert.deepEqual((await syncedBoards(db, "test_a")).map((b) => b.id), [3010, 3015], "that board and its subitems board, not the other's");
  assert.deepEqual((await syncedBoards(db, "test_b")).map((b) => b.id), [3020, 3005]);
  assert.deepEqual((await syncedBoards(db, "test_off")).map((b) => b.id), [], "a board that is switched off is not synced");
  assert.deepEqual((await syncedBoards(db, "test_b:subitems")).map((b) => b.id), [3005], "a subitems board's own key finds just it");
});
