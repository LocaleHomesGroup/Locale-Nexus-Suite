import { test } from "node:test";
import assert from "node:assert/strict";
import type { LiveLot } from "@/data/live/types";
import { formatHoldExpiry, lotPrice, lotSpecs, lotTitled, viewLot } from "./live-lots";

const NOW = Date.parse("2026-10-08T00:00:00Z"); // 8:00am Thursday in Perth

const lot = (over: Partial<LiveLot> = {}): LiveLot => ({
  id: "11111111-1111-1111-1111-111111111111",
  lot: "Lot 1 Test Street, Testville",
  estate: "Test Estate",
  developer: null,
  builder: null,
  landPrice: 364000,
  packagePrice: null,
  design: null,
  areaSqm: 319,
  frontageM: 8.97,
  zoning: "R40",
  titleStatus: "untitled",
  titleEta: "2026-09-30",
  rebate: "Test rebate",
  saleStatus: "available",
  soldBy: null,
  soldClient: null,
  mondayItemId: 3001,
  removedFromMonday: false,
  holds: [],
  ...over,
});

const hold = (staffId: string, startedAt: string | null, expiresAt: string | null, client: string | null = null) => ({
  id: `hold-${staffId}`,
  staffId,
  name: staffId === "test-rep-a" ? "Test Rep A" : "Test Rep B",
  client,
  note: null,
  queuedAt: "2026-10-07T23:00:00Z",
  startedAt,
  expiresAt,
});

test("live lots: hold expiry reads in Perth time, whatever the server's timezone (Review Focus 3)", () => {
  assert.equal(formatHoldExpiry("2026-10-09T00:00:00Z", NOW), "8:00am tomorrow");
  assert.equal(formatHoldExpiry("2026-10-08T03:42:00Z", NOW), "11:42am today");
  assert.equal(formatHoldExpiry("2026-10-10T02:00:00Z", NOW), "10:00am on Sat 10 Oct");
  // Two days ahead (8:00am Tue 8 Sep), so neither "today" nor "tomorrow". en-AU's own short month for September is "Sept".
  assert.equal(formatHoldExpiry("2026-09-10T02:00:00Z", Date.parse("2026-09-08T00:00:00Z")), "10:00am on Thu 10 Sep");
  // Either side of Perth's midnight (16:00 UTC), where Perth's date and UTC's differ.
  assert.equal(formatHoldExpiry("2026-10-08T22:00:00Z", NOW), "6:00am tomorrow");
  assert.equal(formatHoldExpiry("2026-10-08T15:59:00Z", NOW), "11:59pm today");
  assert.equal(formatHoldExpiry("2026-10-08T16:00:00Z", NOW), "12:00am tomorrow");
  assert.equal(formatHoldExpiry("2026-10-08T16:01:00Z", Date.parse("2026-10-08T15:59:00Z")), "12:01am tomorrow");
});

test("live lots: prices, specs and title read like the prototype's", () => {
  assert.equal(lotPrice(lot()), "Land $364k");
  assert.equal(lotPrice(lot({ packagePrice: 791000, design: "Test Design" })), "Package $791k · Test Design");
  assert.equal(lotPrice(lot({ landPrice: null })), "Price on request");
  assert.equal(lotSpecs(lot()), "319 sqm · 8.97m frontage · R40");
  assert.equal(lotTitled(lot()), "Title ETA 30 Sep");
  assert.equal(lotTitled(lot({ titleStatus: "titled" })), "Titled");
  assert.equal(lotTitled(lot({ titleStatus: "delayed", titleEta: null })), "Title delayed");
  assert.equal(lotTitled(lot({ titleStatus: "delayed" })), "Title delayed", "a delay outranks the ETA it may have broken");
});

test("live lots: the active holder sees it as theirs", () => {
  const view = viewLot(lot({ holds: [hold("test-rep-a", "2026-10-08T00:00:00Z", "2026-10-09T00:00:00Z", "Test Client A")] }), "test-rep-a", NOW);
  assert.equal(view.status, "hold");
  assert.equal(view.mine, true);
  assert.equal(view.holder, "Test Rep A for Test Client A");
  assert.equal(view.expires, "Hold expires 8:00am tomorrow");
  assert.equal(view.queue, 1);
  assert.equal(view.builder, "Any builder");
});

test("live lots: a queued rep sees their place; anyone else sees the hold", () => {
  const l = lot({
    holds: [hold("test-rep-a", "2026-10-08T00:00:00Z", "2026-10-09T00:00:00Z"), hold("test-rep-b", null, null)],
  });
  const queued = viewLot(l, "test-rep-b", NOW);
  assert.deepEqual([queued.mine, queued.queuedAt, queued.queue], [false, 2, 2]);
  const other = viewLot(l, "someone-else", NOW);
  assert.deepEqual([other.status, other.mine, other.queuedAt], ["hold", false, undefined]);
});

test("live lots: a sold lot shows who sold it, and an expired hold no longer shows", () => {
  assert.equal(viewLot(lot({ saleStatus: "sold", soldBy: "Test Rep A" }), null, NOW).holder, "Test Rep A");
  const lapsed = viewLot(lot({ holds: [hold("test-rep-a", "2026-10-06T00:00:00Z", "2026-10-07T00:00:00Z")] }), null, NOW);
  assert.equal(lapsed.status, "available");
});

test("live lots: a lapsed hold the settle hasn't reached yet drops out, and the queue behind it moves up", () => {
  const l = lot({ holds: [hold("test-rep-a", "2026-10-06T00:00:00Z", "2026-10-07T00:00:00Z"), hold("test-rep-b", null, null)] });
  const lapsedHolder = viewLot(l, "test-rep-a", NOW);
  assert.deepEqual(
    [lapsedHolder.status, lapsedHolder.queue, lapsedHolder.queuedAt, lapsedHolder.mine],
    ["available", 1, undefined, false],
  );
  assert.equal(viewLot(l, "test-rep-b", NOW).queuedAt, 1);
});

test("live lots: a started hold whose expiry can't be read counts as lapsed, not a crash", () => {
  const view = viewLot(lot({ holds: [hold("test-rep-a", "2026-10-08T00:00:00Z", "soon")] }), "test-rep-a", NOW);
  assert.deepEqual([view.status, view.holder, view.expires, view.queue], ["available", undefined, undefined, undefined]);
});
