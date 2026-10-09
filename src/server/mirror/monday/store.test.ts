import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { migratedTestDb } from "../../db/pglite";
import type { Db } from "../../db/types";
import { normaliseItem, type RawItem } from "./normalise";
import { itemStamps, markRemoved, syncFileAssets, syncedBoards, upsertBoards, upsertItems, upsertWorkspaces } from "./store";

let db: Db;
let close: () => Promise<void>;
before(async () => {
  ({ db, close } = await migratedTestDb());
  await upsertWorkspaces(db, [{ id: 1, name: "Test workspace", kind: "open" }]);
  await upsertBoards(db, [{ id: 10, workspace_id: 1, name: "Test board", type: "board", state: "active", monday_updated_at: null }]);
});
after(async () => close());

const item = (id: string, updated: string, over: Partial<RawItem> = {}) =>
  normaliseItem({ id, name: `Test item ${id}`, updated_at: updated, board: { id: "10", name: "Test board" }, ...over })!;

test("store: items upsert once, and only a newer copy counts as a change", async () => {
  assert.equal(await upsertItems(db, [item("1001", "2026-10-07T00:00:00Z").item]), 1);
  assert.equal(await upsertItems(db, [item("1001", "2026-10-07T00:00:00Z").item]), 0);
  assert.equal(await upsertItems(db, [item("1001", "2026-10-08T00:00:00Z").item]), 1);
  const stamps = await itemStamps(db, 10);
  assert.equal(stamps.get(1001), Date.parse("2026-10-08T00:00:00Z"));
});

test("store: duplicate ids in one batch don't break the upsert", async () => {
  const a = item("1002", "2026-10-07T00:00:00Z").item;
  assert.equal(await upsertItems(db, [a, a]), 1);
});

test("store: an item on a board we haven't seen gets a placeholder board", async () => {
  await upsertItems(db, [item("1003", "2026-10-07T00:00:00Z", { board: { id: "99", name: "Moved here" } }).item]);
  const [b] = await db.query<{ name: string; sync_enabled: boolean }>("select name, sync_enabled from mirror.monday_boards where id = 99");
  assert.deepEqual(b, { name: "Moved here", sync_enabled: false });
});

test("store: removing marks the item, and a returning item is live again", async () => {
  assert.equal(await markRemoved(db, [1001]), 1);
  const [gone] = await db.query<{ state: string; removed: boolean }>("select state, removed_at is not null as removed from mirror.monday_items where id = 1001");
  assert.deepEqual(gone, { state: "deleted", removed: true });
  await upsertItems(db, [item("1001", "2026-10-09T00:00:00Z").item]);
  const [back] = await db.query<{ state: string; removed: boolean }>("select state, removed_at is not null as removed from mirror.monday_items where id = 1001");
  assert.deepEqual(back, { state: "active", removed: false });
});

test("store: a file taken out of a column is marked removed", async () => {
  await syncFileAssets(db, [1002], [
    { id: 9001, item_id: 1002, column_id: "files", update_id: null, name: "a.pdf" },
    { id: 9002, item_id: 1002, column_id: "files", update_id: null, name: "b.pdf" },
  ]);
  await syncFileAssets(db, [1002], [{ id: 9001, item_id: 1002, column_id: "files", update_id: null, name: "a.pdf" }]);
  const rows = await db.query<{ id: number; removed: boolean }>("select id, removed_at is not null as removed from mirror.monday_assets order by id");
  assert.deepEqual(rows, [{ id: 9001, removed: false }, { id: 9002, removed: true }]);
});

test("store: synced boards are the enabled ones, parents first", async () => {
  await db.query("update mirror.monday_boards set sync_enabled = true, board_key = 'test_board' where id = 10");
  const boards = await syncedBoards(db);
  assert.deepEqual(boards.map((b) => b.id), [10]);
  assert.deepEqual((await syncedBoards(db, "nope")).map((b) => b.id), []);
});

test("store: a NUL or a lone surrogate in Monday's text can't fail the batch", async () => {
  // Postgres refuses both in json and text. The store drops NULs and replaces a lone surrogate with U+FFFD.
  const nul = String.fromCharCode(0);
  const surrogate = String.fromCharCode(0xd800);
  const odd = item("1004", "2026-10-07T00:00:00Z", { name: `Test${nul} item ${surrogate}` }).item;
  assert.equal(await upsertItems(db, [odd]), 1);
  const [row] = await db.query<{ name: string }>("select name from mirror.monday_items where id = 1004");
  assert.equal(row.name, `Test item ${String.fromCharCode(0xfffd)}`);
});
