import { test } from "node:test";
import assert from "node:assert/strict";
import { paginate } from "./paginate";

const items = Array.from({ length: 23 }, (_, i) => i + 1);

test("paginate: ten a page by default, with the 1-based range shown", () => {
  const p = paginate(items, 0);
  assert.deepEqual(p.rows, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  assert.equal(p.page, 0);
  assert.equal(p.pages, 3);
  assert.equal(p.from, 1);
  assert.equal(p.to, 10);
  assert.equal(p.total, 23);
});

test("paginate: the last page holds the remainder", () => {
  const p = paginate(items, 2);
  assert.deepEqual(p.rows, [21, 22, 23]);
  assert.equal(p.from, 21);
  assert.equal(p.to, 23);
});

test("paginate: a page past the end clamps to the last (a filter shrank the list)", () => {
  const p = paginate(items, 9);
  assert.equal(p.page, 2);
  assert.deepEqual(p.rows, [21, 22, 23]);
  assert.equal(paginate(items, -1).page, 0);
});

test("paginate: an empty list is one empty page", () => {
  const p = paginate([], 3);
  assert.deepEqual(p.rows, []);
  assert.equal(p.page, 0);
  assert.equal(p.pages, 1);
  assert.equal(p.from, 0);
  assert.equal(p.to, 0);
});

test("paginate: takes another page size", () => {
  const p = paginate(items, 1, 12);
  assert.deepEqual(p.rows, [13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23]);
  assert.equal(p.pages, 2);
});
