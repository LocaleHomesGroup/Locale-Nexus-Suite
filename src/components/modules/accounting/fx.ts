/**
 * AUD → PHP for staff pay. Locale's offshore team invoices in AUD and is paid
 * in pesos, at a rate Accounting sets for each pay run (HRIS's per-cycle
 * USD → PHP card, anchored on the Australian dollar instead).
 *
 * The rate is pesos per A$1: at ₱38.14, a A$1,800.00 invoice pays ₱68,652.00.
 *
 * No imports, so the Employee portal's seed can read past runs' rates without
 * pulling in Accounting.
 */

/** Each past pay run's date (ISO) and rate, oldest first. Placeholder figures. */
export const PAST_RATES: readonly { on: string; rate: number }[] = [
  { on: "2026-09-01", rate: 37.62 },
  { on: "2026-09-08", rate: 37.88 },
  { on: "2026-09-15", rate: 38.05 },
  { on: "2026-09-22", rate: 37.91 },
  { on: "2026-09-29", rate: 38.14 },
];

/** The rate a past run paid at. */
export function rateOn(iso: string): number {
  const r = PAST_RATES.find((p) => p.on === iso);
  if (!r) throw new Error(`No pay run on ${iso}`);
  return r.rate;
}

/** An A$ amount in pesos at `rate`, to the centavo. */
export const toPhp = (aud: number, rate: number) => Math.round(aud * rate * 100) / 100;

/** "₱68,652.00" */
export function php(n: number): string {
  return `₱${n.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** "₱3,580,611": whole pesos, for a KPI tile where centavos would cut the figure off. */
export const phpWhole = (n: number) => `₱${Math.round(n).toLocaleString("en-PH")}`;

/** "₱38.14": a rate, as the run and the history show it. */
export const rateText = (rate: number) => `₱${rate.toFixed(2)}`;

/** The most a rate can sensibly be: anything outside 10–100 is a typo, not a market move. */
export const RATE_BOUNDS = { min: 10, max: 100 } as const;
