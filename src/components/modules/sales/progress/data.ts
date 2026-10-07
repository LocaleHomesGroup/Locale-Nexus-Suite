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

/**
 * The day the sample commission history runs to: the Friday of My week's week
 * (ending Sun 9 Aug 2026), so "August to date" means the same thing everywhere.
 * A deal moved to Sale won in this session lands on this day.
 */
export const HISTORY_AS_OF = "2026-08-07";

/**
 * Each rep's sales won by month ("2026-07"), as days of the month; a day
 * listed twice is two sales that day. Placeholder, not confirmed: sample
 * history, January 2024 to date. A. Mercer's July and August agree with
 * HubSpot's quarter (7) and month (1) to date, and September 2025 is the gap
 * their sale streak starts after. Commission is these sales at
 * COMMISSION_PER_SALE.
 */
export const SALE_DAYS: Record<string, Record<string, readonly number[]>> = {
  "A. Mercer": {
    "2024-01": [18],
    "2024-02": [8, 22],
    "2024-03": [7, 26],
    "2024-04": [16],
    "2024-05": [3, 15, 28],
    "2024-06": [12, 25],
    "2024-07": [4, 17, 30],
    "2024-08": [9, 23],
    "2024-09": [5, 18, 27],
    "2024-10": [10, 24],
    "2024-11": [7, 14, 28],
    "2024-12": [12],
    "2025-01": [16, 30],
    "2025-02": [6, 13, 27],
    "2025-03": [5, 13, 20, 27],
    "2025-04": [10, 24],
    "2025-05": [8, 15, 29],
    "2025-06": [4, 12, 19, 26],
    "2025-07": [3, 17, 31],
    "2025-08": [7, 14, 28],
    "2025-09": [],
    "2025-10": [2, 9, 16, 23],
    "2025-11": [6, 13, 20, 21, 27],
    "2025-12": [4, 11],
    "2026-01": [15, 29],
    "2026-02": [5, 12, 26],
    "2026-03": [5, 12, 19, 26, 27],
    "2026-04": [9, 16, 30],
    "2026-05": [7, 14, 21, 28],
    "2026-06": [4, 11, 18, 25],
    "2026-07": [2, 9, 14, 14, 16, 23],
    "2026-08": [4],
  },
};
