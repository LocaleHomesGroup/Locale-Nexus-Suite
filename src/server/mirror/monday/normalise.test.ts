import { test } from "node:test";
import assert from "node:assert/strict";
import { fileAssets, normaliseItem, normaliseUpdate, toId, type RawColumnValue, type RawItem, type RawUpdate } from "./normalise";

const raw = (over: Partial<RawItem> = {}): RawItem => ({
  id: "1001",
  name: "Test Client A",
  state: "active",
  created_at: "2026-09-01T00:00:00Z",
  updated_at: "2026-10-07T03:00:00Z",
  creator_id: "77",
  group: { id: "topics" },
  board: { id: "10", name: "Test board" },
  parent_item: null,
  column_values: [],
  ...over,
});

test("normalise: keeps every column value with what its type adds", () => {
  const n = normaliseItem(raw({
    column_values: [
      { id: "text4", type: "text", text: "12345", value: "\"12345\"" },
      { id: "status", type: "status", text: "Done", value: "{\"index\":1}", index: 1, label: "Done" },
      { id: "date4", type: "date", text: "2026-09-01", value: "{\"date\":\"2026-09-01\"}", date: "2026-09-01" },
      { id: "link", type: "board_relation", text: null, value: null, linked_item_ids: ["5", "6"], display_value: "A, B" },
    ],
  }));
  assert.ok(n);
  assert.equal(n.item.id, 1001);
  assert.equal(n.item.board_id, 10);
  assert.equal(n.item.group_id, "topics");
  assert.deepEqual(n.item.column_values.text4, { type: "text", text: "12345", value: "12345" });
  assert.deepEqual(n.item.column_values.status, { type: "status", text: "Done", value: { index: 1 }, label: "Done", index: 1 });
  assert.equal(n.item.column_values.date4.date, "2026-09-01");
  assert.deepEqual(n.item.column_values.link.linked_item_ids, ["5", "6"]);
});

test("normalise: an unexpected shape still keeps the item (Review Focus 5)", () => {
  const n = normaliseItem(raw({
    column_values: [
      { id: "odd", type: "brand_new_type", text: null, value: "not json {" },
      { id: "empty", type: "text", text: null, value: null },
    ],
  }));
  assert.ok(n);
  assert.deepEqual(n.item.column_values.odd, { type: "brand_new_type", text: null, value: "not json {" });
  assert.deepEqual(n.item.column_values.empty, { type: "text", text: null, value: null });
  assert.ok(normaliseItem(raw({ column_values: null })), "no column values at all is still an item");
});

test("normalise: a file column's assets are listed, links and docs are not", () => {
  const value = { files: [{ assetId: 9001, name: "plan.pdf", fileType: "ASSET" }, { fileType: "LINK", linkToFile: "https://example.com" }] };
  assert.deepEqual(fileAssets(value), [{ id: 9001, name: "plan.pdf" }]);
  const n = normaliseItem(raw({ column_values: [{ id: "files_f", type: "file", text: "plan.pdf", value: JSON.stringify(value) }] }));
  assert.deepEqual(n?.assets, [{ id: 9001, item_id: 1001, column_id: "files_f", update_id: null, name: "plan.pdf" }]);
});

test("normalise: a subitem knows its parent; unknown states read as active; junk ids are dropped", () => {
  const sub = normaliseItem(raw({ id: "2001", parent_item: { id: "1001" }, state: "weird" }));
  assert.equal(sub?.item.parent_item_id, 1001);
  assert.equal(sub?.item.state, "active");
  assert.equal(normaliseItem(raw({ id: "not-a-number" })), null);
  assert.equal(normaliseItem(raw({ board: null }), 99)?.item.board_id, 99, "falls back to the board being read");
});

test("normalise: an update and its attachments", () => {
  const n = normaliseUpdate({
    id: "500",
    item_id: "1001",
    body: "<p>Contract attached</p>",
    text_body: "Contract attached",
    created_at: "2026-10-01T00:00:00Z",
    updated_at: "2026-10-01T00:00:00Z",
    creator_id: "77",
    assets: [{ id: "9100", name: "contract.pdf" }],
  });
  assert.equal(n?.update.item_id, 1001);
  assert.deepEqual(n?.assets, [{ id: 9100, item_id: 1001, column_id: null, update_id: 500, name: "contract.pdf" }]);
  assert.equal(normaliseUpdate({ id: "501", item_id: null }), null, "an update with no item is skipped");
});

test("normalise: an item keeps its state, and an empty name or a missing group or creator gets a fallback", () => {
  assert.equal(normaliseItem(raw({ state: "archived" }))?.item.state, "archived");
  assert.equal(normaliseItem(raw({ state: "deleted" }))?.item.state, "deleted");
  assert.equal(normaliseItem(raw({ state: null }))?.item.state, "active");
  const bare = normaliseItem(raw({ name: "", group: null, parent_item: null, creator_id: null, created_at: null }));
  assert.equal(bare?.item.name, "Item 1001");
  assert.equal(bare?.item.group_id, null);
  assert.equal(bare?.item.parent_item_id, null);
  assert.equal(bare?.item.creator_id, null);
  assert.equal(bare?.item.monday_created_at, null);
  assert.equal(bare?.item.board_name, "Test board");
  assert.equal(normaliseItem(raw({ updated_at: "" })), null, "monday_updated_at is required, so an item without one is skipped");
});

test("normalise: ids are positive whole numbers, from numbers or digit strings", () => {
  assert.equal(toId("1001"), 1001);
  assert.equal(toId(1001), 1001);
  assert.equal(toId(10000000000), 10000000000);
  assert.equal(toId("007"), 7);
  // What Number() alone would take for an id: a boolean, a one-item array, hex, binary, padding, a sign, an exponent, a decimal.
  const coerced = [true, [7], "0x10", "0b11", " 12 ", "+5", "1e3", "12.0"];
  for (const junk of [null, undefined, "", "0", 0, -5, 1.5, "abc", "12abc", "9007199254740993", 2 ** 53, {}, ...coerced]) {
    assert.equal(toId(junk), null, `${JSON.stringify(junk)} is not an id`);
  }
});

test("normalise: a status with only text, a status at index 0 and JSON scalars in value are stored as sent", () => {
  const n = normaliseItem(raw({
    column_values: [
      { id: "plain", type: "status", text: "Done", value: null },
      { id: "first", type: "status", text: "Working on it", value: "{\"index\":0}", index: 0, label: "Working on it" },
      { id: "five", type: "numbers", text: "5", value: "5" },
      { id: "zero", type: "numbers", text: "0", value: "0" },
    ],
  }));
  assert.ok(n);
  assert.deepEqual(n.item.column_values.plain, { type: "status", text: "Done", value: null }, "no label or index keys when there are none");
  assert.deepEqual(n.item.column_values.first, { type: "status", text: "Working on it", value: { index: 0 }, label: "Working on it", index: 0 });
  assert.deepEqual(n.item.column_values.five, { type: "numbers", text: "5", value: 5 });
  assert.deepEqual(n.item.column_values.zero, { type: "numbers", text: "0", value: 0 }, "a falsy scalar is still a value");
});

test("normalise: linked item ids are stored as strings, whether Monday sends text or numbers", () => {
  const n = normaliseItem(raw({ column_values: [{ id: "link", type: "board_relation", text: null, value: null, linked_item_ids: [5, "6"] }] }));
  assert.deepEqual(n?.item.column_values.link.linked_item_ids, ["5", "6"]);
});

test("normalise: only a file column contributes assets, so an asset's column is always a file column", () => {
  const value = JSON.stringify({ files: [{ assetId: 9002, name: "note.pdf" }] });
  const n = normaliseItem(raw({ column_values: [{ id: "doc_d", type: "doc", text: null, value }] }));
  assert.deepEqual(n?.assets, []);
  assert.deepEqual(n?.item.column_values.doc_d.value, { files: [{ assetId: 9002, name: "note.pdf" }] }, "the value itself is still kept");
});

test("normalise: odd entries in a file column's value are skipped, not thrown on", () => {
  const odd = { files: [null, undefined, 5, "x", [], {}, { assetId: "abc" }, { assetId: 9001, name: "plan.pdf" }] };
  assert.deepEqual(fileAssets(odd), [{ id: 9001, name: "plan.pdf" }]);
  for (const value of [undefined, null, 0, "text", true, [], {}, { files: null }, { files: "x" }, { files: {} }]) {
    assert.deepEqual(fileAssets(value), [], `${JSON.stringify(value)} lists no assets`);
  }
  const n = normaliseItem(raw({ column_values: [{ id: "files_f", type: "file", text: null, value: JSON.stringify(odd) }] }));
  assert.deepEqual(n?.assets, [{ id: 9001, item_id: 1001, column_id: "files_f", update_id: null, name: "plan.pdf" }]);
});

test("normalise: a file column with no usable value is still stored, with no assets", () => {
  for (const value of [null, "not json {", "[]", "{\"files\":\"x\"}"]) {
    const n = normaliseItem(raw({ column_values: [{ id: "files_f", type: "file", text: null, value }] }));
    assert.ok(n, `the item is kept for ${JSON.stringify(value)}`);
    assert.equal(n.item.column_values.files_f.type, "file");
    assert.deepEqual(n.assets, []);
  }
});

test("normalise: a null item, update or column value is skipped, not thrown on", () => {
  assert.equal(normaliseItem(null as unknown as RawItem), null);
  assert.equal(normaliseUpdate(null as unknown as RawUpdate), null);
  const columns = [null, 5, "x", {}, { id: 7 }, { id: "ok", type: "text", text: "hi", value: null }] as unknown as RawColumnValue[];
  assert.deepEqual(Object.keys(normaliseItem(raw({ column_values: columns }))?.item.column_values ?? {}), ["ok"]);
  const assets = [null, 5, {}, { id: "9100" }] as unknown as RawUpdate["assets"];
  assert.deepEqual(normaliseUpdate({ id: "500", item_id: "1001", assets })?.assets, [
    { id: 9100, item_id: 1001, column_id: null, update_id: 500, name: "file-9100" },
  ]);
});
