/**
 * Team standings rules, pure (no React). The Sales Manager's Overview reads
 * them: each rep's sales in the month, quarter or year to date, what those
 * sales are worth, the pace against the same point last period, and the team
 * by month. Every figure is the reps' sale history (SALE_DAYS, sample) plus
 * this session's wins, so a deal moved to Sale won re-ranks the board at once.
 *
 * Dates are ISO days ("2026-08-07") and compare as strings.
 */
import { REPS, SALES_WON_QTD, dealValueK, isOpenDeal, type PipelineDeal } from "../data";
import { COMMISSION_PER_SALE, HISTORY_AS_OF, MONTH_TARGET, QUARTER_TARGET } from "./data";
import { monthLabel, monthlyCommission, saleDates, saleStreak, type SaleStreak } from "./commission";
import { wonThisSession, wonVsTarget, type TargetProgress } from "./progress";

export const STANDING_PERIODS = ["month", "quarter", "year"] as const;
export type StandingPeriod = (typeof STANDING_PERIODS)[number];

/** What the board ranks on: sales won, or the contract value they're worth. */
export type RankBy = "sales" | "value";

const pad = (n: number) => String(n).padStart(2, "0");
const ymd = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`;
const daysIn = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();
const parts = (iso: string) => iso.split("-").map(Number) as [number, number, number];

/** The first day of the period `asOf` is in. Quarters are calendar quarters: Jan, Apr, Jul and Oct. */
export function periodStart(period: StandingPeriod, asOf = HISTORY_AS_OF): string {
  const [y, m] = parts(asOf);
  if (period === "month") return ymd(y, m, 1);
  if (period === "quarter") return ymd(y, m - ((m - 1) % 3), 1);
  return ymd(y, 1, 1);
}

/** The same day one period back, clamped to that month's length: 31 May is 30 April a month before. */
export function samePointBefore(period: StandingPeriod, asOf = HISTORY_AS_OF): string {
  const [y, m, d] = parts(asOf);
  const months = y * 12 + (m - 1) - (period === "month" ? 1 : period === "quarter" ? 3 : 12);
  const py = Math.floor(months / 12);
  const pm = (months % 12) + 1;
  return ymd(py, pm, Math.min(d, daysIn(py, pm)));
}

/** "August", "Jul to Sep", "2026": the period `asOf` is in. */
export function standingLabel(period: StandingPeriod, asOf = HISTORY_AS_OF): string {
  const start = periodStart(period, asOf);
  if (period === "month") return monthLabel(start.slice(0, 7), "long");
  if (period === "year") return start.slice(0, 4);
  const [y, m] = parts(start);
  return `${monthLabel(start.slice(0, 7))} to ${monthLabel(`${y}-${pad(m + 2)}`)}`;
}

/** "in July", "last quarter", "in 2025": the period before, to finish "this point …". */
export function previousLabel(period: StandingPeriod, asOf = HISTORY_AS_OF): string {
  if (period === "quarter") return "last quarter";
  const before = samePointBefore(period, asOf);
  return `in ${period === "month" ? monthLabel(before.slice(0, 7), "long") : before.slice(0, 4)}`;
}

const between = (dates: readonly string[], from: string, to: string) => dates.filter((d) => d >= from && d <= to).length;

/** "$4.31m" → 4310. */
const valueK = (value: string) => Number.parseFloat(value.replace(/[^\d.]/g, "")) * 1000;

/**
 * A rep's average contract value a sale, in $k: their quarter to date from
 * HubSpot (SALES_WON_QTD) over its sales, so the quarter's standings match
 * Team's. A rep with no sales this quarter is priced at the team's average.
 * Placeholder: nothing records each sale's contract value yet.
 */
export function avgSaleK(rep: string): number {
  const row = SALES_WON_QTD.find(([r]) => r === rep);
  if (row && row[1] > 0) return valueK(row[2]) / row[1];
  const sales = SALES_WON_QTD.reduce((n, [, s]) => n + s, 0);
  return sales ? SALES_WON_QTD.reduce((n, [, , v]) => n + valueK(v), 0) / sales : 0;
}

const targetFor = (period: StandingPeriod) => (period === "month" ? MONTH_TARGET : period === "quarter" ? QUARTER_TARGET : 0);

export interface RepStanding {
  rep: string;
  /** 1 is the top of the board. */
  rank: number;
  /** Sales won in the period to date. */
  sales: number;
  /** Their contract value in $k, at the rep's average sale. */
  valueK: number;
  /** Commission on those sales, at the placeholder rate. */
  commission: number;
  /** Against the rep's own target for the period. A year has none. */
  target: TargetProgress;
  /** Sales by the same point last period. */
  before: number;
  streak: SaleStreak;
  /** Open deals on the board now, and their value in $k. */
  open: number;
  openK: number;
  /** Their share of the team's sales in the period. Null while the team has none. */
  share: number | null;
}

/** A rep's sale days: the sample history, plus this session's wins on the as-of day. */
export const repSaleDates = (deals: readonly PipelineDeal[], rep: string, asOf = HISTORY_AS_OF) =>
  saleDates(rep, wonThisSession(deals, rep), asOf);

/**
 * The board for a period: every rep, best first. Ranked on sales or value;
 * a tie goes to the other figure, then the name, so the order never flickers.
 */
export function standings(
  deals: readonly PipelineDeal[],
  period: StandingPeriod,
  by: RankBy = "sales",
  asOf = HISTORY_AS_OF,
  reps: readonly string[] = REPS,
): RepStanding[] {
  const from = periodStart(period, asOf);
  const before = samePointBefore(period, asOf);
  const beforeFrom = periodStart(period, before);
  const rows = reps.map((rep) => {
    const dates = repSaleDates(deals, rep, asOf);
    const sales = between(dates, from, asOf);
    const open = deals.filter((d) => d.rep === rep && isOpenDeal(d));
    return {
      rep,
      rank: 0,
      sales,
      valueK: sales * avgSaleK(rep),
      commission: sales * COMMISSION_PER_SALE,
      target: wonVsTarget(sales, targetFor(period)),
      before: between(dates, beforeFrom, before),
      streak: saleStreak(dates, asOf),
      open: open.length,
      openK: open.reduce((n, d) => n + dealValueK(d), 0),
      share: null as number | null,
    };
  });
  const team = rows.reduce((n, r) => n + r.sales, 0);
  const [first, second] = by === "sales" ? (["sales", "valueK"] as const) : (["valueK", "sales"] as const);
  return rows
    .sort((a, b) => b[first] - a[first] || b[second] - a[second] || a.rep.localeCompare(b.rep))
    .map((r, i) => ({ ...r, rank: i + 1, share: team ? r.sales / team : null }));
}

export interface TeamTotals {
  sales: number;
  valueK: number;
  commission: number;
  /** Against every rep's target added up. A year has none. */
  target: TargetProgress;
  before: number;
}

export function teamTotals(rows: readonly RepStanding[], period: StandingPeriod): TeamTotals {
  const sum = (pick: (r: RepStanding) => number) => rows.reduce((n, r) => n + pick(r), 0);
  const sales = sum((r) => r.sales);
  return {
    sales,
    valueK: sum((r) => r.valueK),
    commission: sum((r) => r.commission),
    target: wonVsTarget(sales, rows.length * targetFor(period)),
    before: sum((r) => r.before),
  };
}

export interface TeamMonth {
  /** "2026-07". */
  key: string;
  /** The as-of month, still under way. */
  current: boolean;
  byRep: Record<string, number>;
  total: number;
}

/** The team's sales by month for the `months` up to and including the as-of month, oldest first, split by rep. */
export function teamByMonth(
  deals: readonly PipelineDeal[],
  months = 12,
  asOf = HISTORY_AS_OF,
  reps: readonly string[] = REPS,
): TeamMonth[] {
  const perRep = reps.map((rep) => [rep, monthlyCommission(repSaleDates(deals, rep, asOf), months, asOf)] as const);
  return perRep[0]?.[1].map((m, i) => {
    const byRep = Object.fromEntries(perRep.map(([rep, totals]) => [rep, totals[i].sales]));
    return { key: m.key, current: m.current, byRep, total: Object.values(byRep).reduce((a, b) => a + b, 0) };
  }) ?? [];
}
