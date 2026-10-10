import { test } from "node:test";
import assert from "node:assert/strict";
import { paginate } from "@/lib/paginate";
import { JOBS_PAGE_SIZE, narrowingKey, rangeLine } from "./paging";

const jobs = Array.from({ length: 977 }, (_, i) => i + 1);
// An en dash (2013) or an em dash (2014), built from their code points so this file holds neither.
const DASHES = new RegExp(`[${String.fromCharCode(0x2013, 0x2014)}]`);

test("the Ops list pages in 50s: 977 jobs is 20 pages and the last holds 27", () => {
  assert.equal(JOBS_PAGE_SIZE, 50);
  const first = paginate(jobs, 0, JOBS_PAGE_SIZE);
  assert.equal(first.rows.length, 50);
  assert.equal(first.pages, 20);
  assert.equal(first.from, 1);
  assert.equal(first.to, 50);
  const last = paginate(jobs, 19, JOBS_PAGE_SIZE);
  assert.equal(last.rows.length, 27);
  assert.equal(last.from, 951);
  assert.equal(last.to, 977);
});

test("50 jobs or fewer is one page, so no pager shows; 51 is two", () => {
  for (const n of [0, 1, 12, 50]) assert.equal(paginate(Array.from({ length: n }), 0, JOBS_PAGE_SIZE).pages, 1, `${n} jobs`);
  assert.equal(paginate(Array.from({ length: 51 }), 0, JOBS_PAGE_SIZE).pages, 2);
});

test("a page the list no longer reaches clamps to the last one (a sync or a filter shrank it)", () => {
  const p = paginate(jobs.slice(0, 120), 7, JOBS_PAGE_SIZE);
  assert.equal(p.page, 2);
  assert.equal(p.rows.length, 20);
  assert.equal(p.from, 101);
});

test("rangeLine: the count line as a range", () => {
  assert.equal(rangeLine({ from: 51, to: 100, total: 977, hasFilters: false, tile: null }), "Showing 51 to 100 of 977 jobs.");
  assert.equal(rangeLine({ from: 951, to: 977, total: 977, hasFilters: false, tile: null }), "Showing 951 to 977 of 977 jobs.");
});

test("rangeLine: says when filters narrow the list and which tile is on", () => {
  assert.equal(
    rangeLine({ from: 1, to: 50, total: 120, hasFilters: true, tile: null }),
    "Showing 1 to 50 of 120 jobs matching these filters.",
  );
  assert.equal(
    rangeLine({ from: 51, to: 100, total: 120, hasFilters: false, tile: "Awaiting a job number" }),
    "Showing 51 to 100 of 120 jobs · Awaiting a job number.",
  );
  assert.equal(
    rangeLine({ from: 101, to: 120, total: 120, hasFilters: true, tile: "Completed without a builder date" }),
    "Showing 101 to 120 of 120 jobs matching these filters · Completed without a builder date.",
  );
});

test("rangeLine: a single job is not plural", () => {
  assert.equal(rangeLine({ from: 1, to: 1, total: 1, hasFilters: false, tile: null }), "Showing 1 to 1 of 1 job.");
});

test("rangeLine: no en or em dash anywhere in it", () => {
  for (const hasFilters of [false, true]) {
    for (const tile of [null, "Awaiting a job number", "Completed without a builder date"]) {
      const line = rangeLine({ from: 51, to: 100, total: 977, hasFilters, tile });
      assert.doesNotMatch(line, DASHES, line);
    }
  }
});

test("narrowingKey: the same search, filters and tile make the same key", () => {
  const a = narrowingKey({ tile: "awaiting", filters: ["Alder Homes", "", "Homes"], query: "oak" });
  const b = narrowingKey({ tile: "awaiting", filters: ["Alder Homes", "", "Homes"], query: "oak" });
  assert.equal(a, b);
});

test("narrowingKey: changing the tile, any one filter or the search changes the key", () => {
  const base = { tile: "all", filters: ["", "", ""], query: "" };
  const key = narrowingKey(base);
  assert.notEqual(narrowingKey({ ...base, tile: "awaiting" }), key);
  for (let i = 0; i < base.filters.length; i++) {
    const filters = [...base.filters];
    filters[i] = "x";
    assert.notEqual(narrowingKey({ ...base, filters }), key, `filter ${i}`);
  }
  assert.notEqual(narrowingKey({ ...base, query: "oak" }), key);
});

test("narrowingKey: a value moved to another slot, or a separator inside a value, is a different key", () => {
  assert.notEqual(
    narrowingKey({ tile: "all", filters: ["x", ""], query: "" }),
    narrowingKey({ tile: "all", filters: ["", "x"], query: "" }),
  );
  assert.notEqual(
    narrowingKey({ tile: "all", filters: ["a|b", ""], query: "" }),
    narrowingKey({ tile: "all", filters: ["a", "b|"], query: "" }),
  );
  assert.notEqual(
    narrowingKey({ tile: "all", filters: ["x"], query: "" }),
    narrowingKey({ tile: "all", filters: [], query: "x" }),
  );
});
