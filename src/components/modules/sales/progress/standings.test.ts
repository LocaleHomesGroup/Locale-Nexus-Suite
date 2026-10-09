import { test } from "node:test";
import assert from "node:assert/strict";
import { REPS, SALES_WON_MTD, SALES_WON_QTD, STAGE_REPORT_DEALS, seedDeals, type PipelineDeal } from "../data";
import { COMMISSION_PER_SALE, MONTH_TARGET, QUARTER_TARGET } from "./data";
import { monthlyCommission, saleDates } from "./commission";
import {
  avgSaleK,
  periodStart,
  previousLabel,
  samePointBefore,
  standingLabel,
  standings,
  teamByMonth,
  teamTotals,
} from "./standings";

const AS_OF = "2026-08-07";
const SEED = seedDeals(0);
const won = (deals: PipelineDeal[], id: string): PipelineDeal[] =>
  deals.map((d) => (d.id === id ? { ...d, stage: "Sale won" } : d));

test("every rep's sample history agrees with HubSpot's month and quarter to date", () => {
  let month = 0;
  for (const rep of REPS) {
    const [jul, aug] = monthlyCommission(saleDates(rep)).slice(-2);
    assert.equal(aug.sales, STAGE_REPORT_DEALS.find(([r]) => r === rep)?.[1][3], `${rep}: August`);
    assert.equal(jul.sales + aug.sales, SALES_WON_QTD.find(([r]) => r === rep)?.[1], `${rep}: quarter`);
    month += aug.sales;
  }
  assert.equal(month, SALES_WON_MTD);
});

test("periods start on the 1st, quarters in Jan, Apr, Jul and Oct", () => {
  assert.equal(periodStart("month", AS_OF), "2026-08-01");
  assert.equal(periodStart("quarter", AS_OF), "2026-07-01");
  assert.equal(periodStart("quarter", "2026-12-31"), "2026-10-01");
  assert.equal(periodStart("year", AS_OF), "2026-01-01");
});

test("the same point one period back keeps the day, clamped to a shorter month", () => {
  assert.equal(samePointBefore("month", AS_OF), "2026-07-07");
  assert.equal(samePointBefore("quarter", AS_OF), "2026-05-07");
  assert.equal(samePointBefore("year", AS_OF), "2025-08-07");
  assert.equal(samePointBefore("month", "2026-05-31"), "2026-04-30");
  assert.equal(samePointBefore("month", "2026-01-15"), "2025-12-15");
  assert.equal(samePointBefore("quarter", "2026-03-31"), "2025-12-31");
  assert.equal(samePointBefore("year", "2024-02-29"), "2023-02-28");
});

test("labels", () => {
  assert.equal(standingLabel("month", AS_OF), "August");
  assert.equal(standingLabel("quarter", AS_OF), "Jul to Sep");
  assert.equal(standingLabel("year", AS_OF), "2026");
  assert.equal(previousLabel("month", AS_OF), "in July");
  assert.equal(previousLabel("quarter", AS_OF), "last quarter");
  assert.equal(previousLabel("year", AS_OF), "in 2025");
});

test("a rep's average sale is their quarter's contract value over its sales", () => {
  assert.equal(Math.round(avgSaleK("K. Ellery")), 630);
  // Someone with no quarter yet is priced at the team's average.
  const team = SALES_WON_QTD.reduce((n, [, , v]) => n + Number.parseFloat(v.slice(1)) * 1000, 0) / 17;
  assert.equal(avgSaleK("Nobody"), team);
});

test("the quarter's standings reproduce HubSpot's quarter to date, ranked by sales", () => {
  const rows = standings(SEED, "quarter", "sales", AS_OF);
  assert.deepEqual(
    rows.map((r) => [r.rank, r.rep, r.sales, `$${(r.valueK / 1000).toFixed(2)}m`]),
    SALES_WON_QTD.map(([rep, n, v], i) => [i + 1, rep, n, v]),
  );
  const mercer = rows[0];
  assert.equal(mercer.commission, 7 * COMMISSION_PER_SALE);
  assert.deepEqual(mercer.target, { won: 7, target: QUARTER_TARGET, ratio: 7 / 8, hit: false });
  assert.equal(mercer.before, 4, "April 1 to May 7");
});

test("ties on sales go to the bigger contract value, then by name", () => {
  const bySales = standings(SEED, "month", "sales", AS_OF);
  assert.deepEqual(
    bySales.map((r) => [r.rep, r.sales]),
    [
      ["K. Ellery", 2],
      ["D. Okafor", 1],
      ["A. Mercer", 1],
    ],
  );
  assert.ok(bySales[0].target.hit);
  assert.equal(bySales[0].share, 0.5);
  assert.ok(standings(SEED, "month", "value", AS_OF).every((r, i, all) => i === 0 || all[i - 1].valueK >= r.valueK));
});

test("a deal moved to Sale won this session counts today, and re-ranks the board", () => {
  const deals = won(won(won(SEED, "d-whitmore"), "d-osei"), "d-haddad"); // Haddad is lost: it doesn't count
  const rows = standings(deals, "month", "sales", AS_OF);
  assert.deepEqual(
    rows.map((r) => [r.rep, r.sales]),
    [
      ["A. Mercer", 3],
      ["K. Ellery", 2],
      ["D. Okafor", 1],
    ],
  );
  assert.equal(standings(won(SEED, "d-callahan"), "month", "sales", AS_OF)[0].rep, "K. Ellery", "level on sales, the bigger average sale leads");
});

test("open pipeline is each rep's open deals", () => {
  const rows = standings(SEED, "month", "sales", AS_OF);
  const mercer = rows.find((r) => r.rep === "A. Mercer");
  assert.deepEqual([mercer?.open, mercer?.openK], [3, 585 + 655 + 548]);
  assert.equal(rows.find((r) => r.rep === "D. Okafor")?.open, 1, "a lost deal isn't open");
});

test("a year has no target; streaks come from each rep's history", () => {
  const rows = standings(SEED, "year", "sales", AS_OF);
  assert.ok(rows.every((r) => r.target.ratio === null));
  const streak = Object.fromEntries(rows.map((r) => [r.rep, r.streak]));
  assert.deepEqual(streak["A. Mercer"], { months: 11, since: "2025-10" });
  assert.deepEqual(streak["K. Ellery"], { months: 19, since: "2025-02" });
  assert.deepEqual(streak["D. Okafor"], { months: 6, since: "2026-03" });
});

test("team totals add up the reps, against every rep's target", () => {
  const month = teamTotals(standings(SEED, "month", "sales", AS_OF), "month");
  assert.equal(month.sales, SALES_WON_MTD);
  assert.equal(month.before, 2, "July 1 to 7");
  assert.deepEqual(month.target, { won: 4, target: REPS.length * MONTH_TARGET, ratio: 4 / 6, hit: false });
  assert.equal(month.commission, 4 * COMMISSION_PER_SALE);
  const year = teamTotals(standings(SEED, "year", "sales", AS_OF), "year");
  assert.equal(year.target.ratio, null);
  assert.equal(teamTotals([], "month").target.ratio, null);
});

test("the team by month: twelve months to the as-of month, each rep's sales in each", () => {
  const months = teamByMonth(SEED, 12, AS_OF);
  assert.equal(months.length, 12);
  assert.equal(months[0].key, "2025-09");
  assert.ok(months.at(-1)?.current && months.slice(0, -1).every((m) => !m.current));
  const jul = months.find((m) => m.key === "2026-07");
  assert.deepEqual(jul?.byRep, { "A. Mercer": 6, "K. Ellery": 4, "D. Okafor": 3 });
  assert.equal(jul?.total, 13);
  assert.equal(teamByMonth(won(SEED, "d-callahan"), 12, AS_OF).at(-1)?.total, SALES_WON_MTD + 1);
});
