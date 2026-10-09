import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { migratedTestDb } from "../../db/pglite";
import type { Db } from "../../db/types";
import { normaliseUpdate, type RawUpdate } from "./normalise";
import { upsertUpdates } from "./store";

let db: Db;
let close: () => Promise<void>;
before(async () => ({ db, close } = await migratedTestDb()));
after(async () => close());

const update = (id: string, updated: string, over: Partial<RawUpdate> = {}) =>
  normaliseUpdate({
    id,
    item_id: "1001",
    body: "<p>Test note</p>",
    text_body: "Test note",
    created_at: "2026-10-07T00:00:00Z",
    updated_at: updated,
    creator_id: "5001",
    assets: [{ id: "8001", name: "note.pdf" }],
    ...over,
  })!;

test("store: an update upserts once, only an edited copy counts as a change, and its file is linked to it", async () => {
  const first = update("7001", "2026-10-07T00:00:00Z");
  assert.equal(await upsertUpdates(db, [first.update], first.assets), 1);
  assert.equal(await upsertUpdates(db, [first.update, first.update], first.assets), 0, "the same copy, twice in a batch, is no change");

  const edited = update("7001", "2026-10-08T00:00:00Z", { text_body: "Test note, edited" });
  assert.equal(await upsertUpdates(db, [edited.update], edited.assets), 1);
  const [row] = await db.query<{ text_body: string; item_id: number; creator_id: number }>(
    "select text_body, item_id, creator_id from mirror.monday_updates where id = 7001",
  );
  assert.deepEqual(row, { text_body: "Test note, edited", item_id: 1001, creator_id: 5001 });

  const assets = await db.query("select id, item_id, column_id, update_id, name from mirror.monday_assets");
  assert.deepEqual(assets, [{ id: 8001, item_id: 1001, column_id: null, update_id: 7001, name: "note.pdf" }]);
});

test("store: an empty batch of updates writes nothing", async () => {
  assert.equal(await upsertUpdates(db, [], []), 0);
});

test("store: a NUL or a lone surrogate in an update can't fail the batch", async () => {
  const nul = String.fromCharCode(0);
  const surrogate = String.fromCharCode(0xdc00);
  const odd = update("7002", "2026-10-07T00:00:00Z", { text_body: `Test${nul} note ${surrogate}`, assets: [] });
  assert.equal(await upsertUpdates(db, [odd.update], odd.assets), 1);
  const [row] = await db.query<{ text_body: string }>("select text_body from mirror.monday_updates where id = 7002");
  assert.equal(row.text_body, `Test note ${String.fromCharCode(0xfffd)}`);
});
