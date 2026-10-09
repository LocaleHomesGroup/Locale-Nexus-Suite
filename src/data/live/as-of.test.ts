import { test } from "node:test";
import assert from "node:assert/strict";
import { asOfLabel } from "./as-of";

test("as-of label: the same Perth day shows just the clock time", () => {
  // 10:42am and 11:00am on Fri 9 Oct, Perth.
  assert.equal(asOfLabel("2026-10-09T02:42:00Z", "2026-10-09T03:00:00Z"), "10:42am");
});

test("as-of label: across Perth midnight it names the day", () => {
  // 11:59pm Thu 8 Oct in Perth, read at 12:01am Fri 9 Oct.
  assert.equal(asOfLabel("2026-10-08T15:59:00Z", "2026-10-08T16:01:00Z"), "11:59pm on Thu 8 Oct");
});

test("as-of label: the Perth day decides, not the UTC date", () => {
  // Both are 8 Oct in UTC, but 11:00pm Thu 8 Oct and 1:00am Fri 9 Oct in Perth.
  assert.equal(asOfLabel("2026-10-08T15:00:00Z", "2026-10-08T17:00:00Z"), "11:00pm on Thu 8 Oct");
});

test("as-of label: a mirror that stalled days ago names its day", () => {
  assert.equal(asOfLabel("2026-10-07T01:00:00Z", "2026-10-09T01:00:00Z"), "9:00am on Wed 7 Oct");
});

test("as-of label: a two-digit day and a weekend weekday read the same way", () => {
  // 7:30am Sat 10 Oct in Perth, read on Sun 11 Oct.
  assert.equal(asOfLabel("2026-10-09T23:30:00Z", "2026-10-11T01:00:00Z"), "7:30am on Sat 10 Oct");
});

test("as-of label: September reads Sep, whatever the runtime's locale data says", () => {
  // 9:00am Thu 10 Sep in Perth, read two days later. en-AU's own short month for September is "Sept".
  assert.equal(asOfLabel("2026-09-10T01:00:00Z", "2026-09-12T01:00:00Z"), "9:00am on Thu 10 Sep");
});

test("as-of label: it compares against readAt, not the clock", () => {
  // Far from today, and both on Sun 6 May 2001 in Perth. A label that compared with today's date
  // would call this a different day and name it.
  assert.equal(asOfLabel("2001-05-06T02:00:00Z", "2001-05-06T03:00:00Z"), "10:00am");
});
