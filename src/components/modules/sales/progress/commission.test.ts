import { test } from "node:test";
import assert from "node:assert/strict";
import { COMMISSION_PER_SALE, HISTORY_AS_OF, SALE_DAYS } from "./data";
import { commissionEarned, wonToDate } from "./progress";
import {
  commissionRecord,
  monthLabel,
  monthlyCommission,
  periodKey,
  periodLabel,
  recentTotals,
  saleDates,
  saleStreak,
} from "./commission";

const RATE = COMMISSION_PER_SALE;

test("sale dates: oldest first, a repeated day is two sales, session wins land on the as-of day", () => {
  const dates = saleDates("A. Mercer");
  assert.deepEqual(dates.slice(0, 2), ["2024-01-18", "2024-02-08"]);
  assert.equal(dates.filter((d) => d === "2026-07-14").length, 2);
  assert.ok(dates.every((d, i) => i === 0 || dates[i - 1] <= d));
  assert.ok(dates.every((d) => d <= HISTORY_AS_OF), "no sale after the as-of day");
  assert.deepEqual(saleDates("A. Mercer", 2).slice(-2), [HISTORY_AS_OF, HISTORY_AS_OF]);
  assert.deepEqual(saleDates("Nobody"), []);
});

test("the sample history agrees with HubSpot's month and quarter to date", () => {
  const { month, quarter } = wonToDate("A. Mercer", 0);
  const months = monthlyCommission(saleDates("A. Mercer"));
  const [jul, aug] = months.slice(-2);
  assert.equal(aug.sales, month);
  assert.equal(jul.sales + aug.sales, quarter);
  assert.equal(aug.amount, commissionEarned(month));
});

test("weeks run Monday to Sunday", () => {
  assert.equal(periodKey("2026-07-13", "week"), "2026-07-13"); // Monday
  assert.equal(periodKey("2026-07-19", "week"), "2026-07-13"); // Sunday
  assert.equal(periodKey("2026-07-20", "week"), "2026-07-20");
  assert.equal(periodKey("2026-01-01", "week"), "2025-12-29"); // across a year
  assert.equal(periodKey("2026-07-14", "month"), "2026-07");
  assert.equal(periodKey("2026-07-14", "year"), "2026");
});

test("highest commission: best day, week, month and year in the sample, against the period so far", () => {
  const dates = saleDates("A. Mercer");
  const day = commissionRecord(dates, "day")!;
  assert.deepEqual(day.best, { key: "2026-07-14", sales: 2, amount: 2 * RATE });
  assert.deepEqual(day.current, { key: HISTORY_AS_OF, sales: 0, amount: 0 });
  assert.equal(day.status, "chasing");
  assert.equal(day.gap, 2 * RATE);
  assert.equal(day.salesToBeat, 3);

  const week = commissionRecord(dates, "week")!;
  assert.deepEqual(week.best, { key: "2026-07-13", sales: 3, amount: 3 * RATE });
  assert.equal(week.current.key, "2026-08-03");
  assert.equal(week.current.sales, 1);

  const month = commissionRecord(dates, "month")!;
  assert.deepEqual(month.best, { key: "2026-07", sales: 6, amount: 6 * RATE });
  assert.equal(month.salesToBeat, 6);

  const year = commissionRecord(dates, "year")!;
  assert.deepEqual(year.best, { key: "2025", sales: 35, amount: 35 * RATE });
  assert.deepEqual(year.current, { key: "2026", sales: 28, amount: 28 * RATE });
  assert.equal(year.gap, 7 * RATE);
  assert.equal(year.salesToBeat, 8);
});

test("highest commission: a tie matches the record, more takes it, nothing is null", () => {
  const asOf = "2026-08-07";
  const matched = commissionRecord(["2026-08-03", "2026-08-07"], "day", asOf, 100)!;
  assert.equal(matched.best.key, "2026-08-03");
  assert.equal(matched.status, "matched");
  assert.equal(matched.gap, 0);
  assert.equal(matched.salesToBeat, 1);

  const taken = commissionRecord(["2026-08-03", "2026-08-07", "2026-08-07"], "day", asOf, 100)!;
  assert.equal(taken.best.key, asOf);
  assert.equal(taken.status, "new");
  assert.equal(taken.salesToBeat, 0);

  assert.equal(commissionRecord([], "month"), null);
});

test("session wins can set a new record", () => {
  const dates = saleDates("A. Mercer", 3);
  const day = commissionRecord(dates, "day")!;
  assert.equal(day.status, "new");
  assert.equal(day.best.amount, 3 * RATE);
  assert.equal(commissionRecord(saleDates("A. Mercer", 2), "day")!.status, "matched");
});

test("monthly commission: twelve months to the as-of month, zeros kept, the last one current", () => {
  const months = monthlyCommission(saleDates("A. Mercer"));
  assert.equal(months.length, 12);
  assert.equal(months[0].key, "2025-09");
  assert.equal(months[0].amount, 0);
  assert.equal(months[11].key, "2026-08");
  assert.deepEqual(
    months.map((m) => m.current),
    [...Array(11).fill(false), true],
  );
  assert.deepEqual(
    months.map((m) => m.sales),
    [0, 4, 5, 2, 2, 3, 5, 3, 4, 4, 6, 1],
  );
  assert.deepEqual(
    monthlyCommission([], 3).map((m) => m.amount),
    [0, 0, 0],
  );
});

test("recent totals: the last n periods to the as-of one, zeros kept, never before the first sale", () => {
  const dates = saleDates("A. Mercer");
  const days = recentTotals(dates, "day", 5);
  assert.deepEqual(
    days.map((d) => [d.key, d.sales]),
    [
      ["2026-08-03", 0],
      ["2026-08-04", 1],
      ["2026-08-05", 0],
      ["2026-08-06", 0],
      ["2026-08-07", 0],
    ],
  );
  const weeks = recentTotals(dates, "week", 4);
  assert.deepEqual(
    weeks.map((w) => [w.key, w.sales]),
    [
      ["2026-07-13", 3],
      ["2026-07-20", 1],
      ["2026-07-27", 0],
      ["2026-08-03", 1],
    ],
  );
  assert.deepEqual(
    recentTotals(dates, "month", 3).map((m) => m.key),
    ["2026-06", "2026-07", "2026-08"],
  );
  assert.deepEqual(
    recentTotals(dates, "year", 12).map((y) => [y.key, y.amount]),
    [
      ["2024", 25 * RATE],
      ["2025", 35 * RATE],
      ["2026", 28 * RATE],
    ],
  );
  assert.deepEqual(
    recentTotals([], "month", 3).map((m) => m.key),
    ["2026-08"],
  );
});

test("sale streak: back from the as-of month; a month under way with no sale doesn't break it", () => {
  assert.deepEqual(saleStreak(saleDates("A. Mercer")), { months: 11, since: "2025-10" });
  assert.deepEqual(saleStreak(["2026-06-10", "2026-07-02"], "2026-08-07"), { months: 2, since: "2026-06" });
  assert.deepEqual(saleStreak(["2026-05-10", "2026-08-02"], "2026-08-07"), { months: 1, since: "2026-08" });
  assert.deepEqual(saleStreak(["2026-05-10"], "2026-08-07"), { months: 0, since: null });
});

test("labels", () => {
  assert.equal(periodLabel("2026-07-14", "day"), "Tue 14 Jul 2026");
  assert.equal(periodLabel("2026-07-13", "week"), "Week of 13 Jul 2026");
  assert.equal(periodLabel("2026-07", "month"), "July 2026");
  assert.equal(periodLabel("2025", "year"), "2025");
  assert.equal(monthLabel("2026-08"), "Aug");
  assert.equal(monthLabel("2026-08", "long"), "August");
  assert.equal(monthLabel("2025-10", "full"), "October 2025");
});

test("every sample month is a real month with real days", () => {
  for (const months of Object.values(SALE_DAYS)) {
    for (const [month, days] of Object.entries(months)) {
      const [y, m] = month.split("-").map(Number);
      const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
      assert.ok(days.every((d) => d >= 1 && d <= last), month);
    }
  }
});
