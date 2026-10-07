/**
 * Sales progress: the figures My progress (the Sales Representative portal) and Team's
 * commission column read that nothing in the prototype records yet. Each one
 * is named once, here. Static prototype data: nothing is fetched.
 */
import { COMMISSION_BASE } from "../costing/data";
import { LAST_WEEK } from "../week/data";

/** Sales a consultant is asked to sign in a month. Placeholder, not confirmed: Sean O'Neill sets targets. */
export const MONTH_TARGET = 2;

/** Sales a consultant is asked to sign in a quarter. Placeholder, not confirmed: Sean O'Neill sets targets. */
export const QUARTER_TARGET = 8;

/**
 * Commission per sale, AUD. Placeholder, not confirmed: Alison Carter confirms
 * the formula. Meeting 2 ruled out HubSpot's amount field, which is the build
 * price. Rapid costing's retail commission base, so the Launchpad quotes one
 * rate.
 */
export const COMMISSION_PER_SALE = COMMISSION_BASE.Retail;

/** An open deal this many days in one stage is stale. */
export const STALE_DAYS = 14;

export interface ForecastWeek {
  /** The Sunday the week ends: "2 Aug". */
  weekEnding: string;
  forecast: number;
  signed: number;
}

/**
 * The consultant's last six weeks, oldest first. Placeholder, not confirmed:
 * sample weeks. Each is within one of its forecast and the last is My week's
 * LAST_WEEK, so My week's "within one for 6 weeks running" stays true.
 */
export const FORECAST_HISTORY: readonly ForecastWeek[] = [
  { weekEnding: "28 Jun", forecast: 5, signed: 4 },
  { weekEnding: "5 Jul", forecast: 5, signed: 5 },
  { weekEnding: "12 Jul", forecast: 6, signed: 7 },
  { weekEnding: "19 Jul", forecast: 6, signed: 5 },
  { weekEnding: "26 Jul", forecast: 6, signed: 6 },
  { weekEnding: "2 Aug", forecast: LAST_WEEK.forecast, signed: LAST_WEEK.signed },
];
