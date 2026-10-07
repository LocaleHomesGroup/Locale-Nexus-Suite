/**
 * Commission history rules, pure (no React). The Sales Representative
 * portal's Overview reads them: commission by month for its chart, the rep's
 * highest commission in a day, week, month and year, and their sale streak.
 * Every figure is sales won at the placeholder per-sale rate, so it agrees
 * with My progress's "Earned this quarter".
 *
 * Dates are ISO days ("2026-07-14"), read as UTC so no time zone moves a sale
 * into the next day.
 */
import { COMMISSION_PER_SALE, HISTORY_AS_OF, SALE_DAYS } from "./data";

export const RECORD_PERIODS = ["day", "week", "month", "year"] as const;
export type RecordPeriod = (typeof RECORD_PERIODS)[number];

const utc = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d ?? 1));
};
const isoDay = (date: Date) => date.toISOString().slice(0, 10);

/** The rep's sale days, oldest first, with this session's wins on the as-of day. */
export function saleDates(rep: string, inSession = 0, asOf = HISTORY_AS_OF): string[] {
  const dates = Object.entries(SALE_DAYS[rep] ?? {})
    .sort(([a], [b]) => a.localeCompare(b))
    .flatMap(([month, days]) => [...days].sort((a, b) => a - b).map((d) => `${month}-${String(d).padStart(2, "0")}`));
  return [...dates, ...Array.from({ length: Math.max(0, inSession) }, () => asOf)];
}

/** The period a day falls in: the day itself, its week's Monday, "2026-07" or "2026". */
export function periodKey(iso: string, period: RecordPeriod): string {
  if (period === "day") return iso;
  if (period === "month") return iso.slice(0, 7);
  if (period === "year") return iso.slice(0, 4);
  // Weeks run Monday to Sunday, keyed by their Monday.
  const date = utc(iso);
  date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
  return isoDay(date);
}

export interface PeriodTotal {
  key: string;
  sales: number;
  amount: number;
}

function countBy(dates: readonly string[], period: RecordPeriod): Map<string, number> {
  const counts = new Map<string, number>();
  for (const iso of dates) {
    const key = periodKey(iso, period);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

export interface CommissionRecord {
  period: RecordPeriod;
  /** The highest period: the earliest to reach the most sales, so a later tie matches it rather than taking it. */
  best: PeriodTotal;
  /** The period the as-of day is in, so far. */
  current: PeriodTotal;
  /** "new": the current period holds the record. "matched": it ties an earlier one. "chasing": it's behind. */
  status: "new" | "matched" | "chasing";
  /** Commission still to earn to match the record. 0 once matched or held. */
  gap: number;
  /** Sales that would set a new record. 0 while the current period holds it. */
  salesToBeat: number;
}

/** The rep's highest commission in a day, week, month or year, and how the current one compares. Null with no sales. */
export function commissionRecord(
  dates: readonly string[],
  period: RecordPeriod,
  asOf = HISTORY_AS_OF,
  perSale = COMMISSION_PER_SALE,
): CommissionRecord | null {
  const counts = countBy(dates, period);
  if (counts.size === 0) return null;
  const total = (key: string): PeriodTotal => {
    const sales = counts.get(key) ?? 0;
    return { key, sales, amount: sales * perSale };
  };
  const bestKey = [...counts.keys()].sort().reduce((a, b) => ((counts.get(b) ?? 0) > (counts.get(a) ?? 0) ? b : a));
  const best = total(bestKey);
  const current = total(periodKey(asOf, period));
  const status = best.key === current.key ? "new" : current.sales === best.sales ? "matched" : "chasing";
  return {
    period,
    best,
    current,
    status,
    gap: best.amount - current.amount,
    salesToBeat: status === "new" ? 0 : best.sales - current.sales + 1,
  };
}

function previousKey(key: string, period: RecordPeriod): string {
  if (period === "year") return String(Number(key) - 1);
  if (period === "month") {
    const [y, m] = key.split("-").map(Number);
    return isoDay(new Date(Date.UTC(y, m - 2, 1))).slice(0, 7);
  }
  const date = utc(key);
  date.setUTCDate(date.getUTCDate() - (period === "week" ? 7 : 1));
  return isoDay(date);
}

/**
 * The last `n` days, weeks, months or years up to and including the as-of
 * one, oldest first. Zeros are kept; nothing before the period of the first sale.
 */
export function recentTotals(
  dates: readonly string[],
  period: RecordPeriod,
  n = 12,
  asOf = HISTORY_AS_OF,
  perSale = COMMISSION_PER_SALE,
): PeriodTotal[] {
  const counts = countBy(dates, period);
  const current = periodKey(asOf, period);
  const first = dates.length ? periodKey(dates.reduce((a, b) => (b < a ? b : a)), period) : current;
  const keys: string[] = [];
  for (let key = current; keys.length < n && key >= first; key = previousKey(key, period)) keys.unshift(key);
  return keys.map((key) => {
    const sales = counts.get(key) ?? 0;
    return { key, sales, amount: sales * perSale };
  });
}

export interface MonthTotal extends PeriodTotal {
  /** The as-of month, still under way. */
  current: boolean;
}

/** Commission by month for the `months` up to and including the as-of month, oldest first. A month with no sales is 0. */
export function monthlyCommission(
  dates: readonly string[],
  months = 12,
  asOf = HISTORY_AS_OF,
  perSale = COMMISSION_PER_SALE,
): MonthTotal[] {
  const counts = countBy(dates, "month");
  const end = utc(asOf);
  return Array.from({ length: months }, (_, i) => {
    const key = isoDay(new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() - (months - 1 - i), 1))).slice(0, 7);
    const sales = counts.get(key) ?? 0;
    return { key, sales, amount: sales * perSale, current: i === months - 1 };
  });
}

export interface SaleStreak {
  /** Months in a row with at least one sale. */
  months: number;
  /** The first month of the run ("2025-10"), or null with no run. */
  since: string | null;
}

/**
 * Months in a row with a sale, counted back from the as-of month. The month
 * under way counts once it has a sale; until then it doesn't break the run.
 */
export function saleStreak(dates: readonly string[], asOf = HISTORY_AS_OF): SaleStreak {
  const counts = countBy(dates, "month");
  const end = utc(asOf);
  const keyAt = (back: number) =>
    isoDay(new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() - back, 1))).slice(0, 7);
  let back = counts.has(keyAt(0)) ? 0 : 1;
  let months = 0;
  while (counts.has(keyAt(back))) {
    months += 1;
    back += 1;
  }
  return { months, since: months ? keyAt(back - 1) : null };
}

// Spelled out rather than Intl's en-AU, whose short months ("July", "Sept")
// differ between the server's and the browser's ICU data.
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** "Tue 14 Jul 2026", "Week of 13 Jul 2026", "July 2026", "2025". */
export function periodLabel(key: string, period: RecordPeriod): string {
  if (period === "year") return key;
  if (period === "month") return monthLabel(key, "full");
  const date = utc(key);
  const day = `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()].slice(0, 3)} ${date.getUTCFullYear()}`;
  return period === "week" ? `Week of ${day}` : `${WEEKDAYS[date.getUTCDay()]} ${day}`;
}

/** "Jul", "July" or "July 2026" for a month key. */
export function monthLabel(key: string, form: "short" | "long" | "full" = "short"): string {
  const [y, m] = key.split("-").map(Number);
  const name = MONTHS[m - 1];
  return form === "short" ? name.slice(0, 3) : form === "long" ? name : `${name} ${y}`;
}
