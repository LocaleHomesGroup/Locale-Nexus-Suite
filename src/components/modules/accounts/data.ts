/**
 * Accounts — static data from the mockup (`hm`, app.js 10098–10855): the
 * read-only report figures. Builder invoices and expense claims live in
 * src/data/accounts.ts, where they seed the shared Launchpad store; they are
 * re-exported here so existing imports keep working.
 */
export {
  INVOICED_THIS_MONTH,
  SEED_CLAIMS,
  SEED_INVOICES,
  cents,
  invoicedThisMonth,
  type BuilderInvoice,
  type ClaimDecision,
  type ClaimStatus,
  type ExpenseClaim,
  type InvoiceStatus,
} from "@/data/accounts";

export const FORECAST_NEXT_MONTH = 310000;

export const EXPENSES_THIS_MONTH = "$6,840";
export const AVG_APPROVAL_TIME = "1.2 days";

/** Cashflow forecast · commission receipts — projected $k and the stage split (%). */
export interface CashflowMonth {
  month: string;
  projectedK: number;
  /** Finance Approval · Land Settlement · Slab and later — sums to 100. */
  split: [number, number, number];
}

export const CASHFLOW: CashflowMonth[] = [
  { month: "Sep 2026", projectedK: 425, split: [55, 30, 15] },
  { month: "Oct 2026", projectedK: 512, split: [50, 32, 18] },
  { month: "Nov 2026", projectedK: 468, split: [46, 34, 20] },
];

/** Segment names (bar tooltips) and legend labels, in split order. */
export const CASHFLOW_SEGMENTS = [
  { title: "Finance Approval", legend: "Finance Approval (avg $12.5k)" },
  { title: "Land Settlement", legend: "Land Settlement ($10k)" },
  { title: "Slab and later", legend: "Slab + later ($9k)" },
] as const;

export interface StageShare {
  stage: string;
  /** Share of YTD commission, %. */
  pct: number;
  amount: string;
}

/** Commission received this year — the sum of COMMISSION_BY_STAGE's amounts. */
export const COMMISSION_YTD = "$9.39m";

export const COMMISSION_BY_STAGE: StageShare[] = [
  { stage: "Finance Approval", pct: 44.6, amount: "$4.19m" },
  { stage: "Land Settlement", pct: 32.2, amount: "$3.03m" },
  { stage: "Slab", pct: 21, amount: "$1.97m" },
  { stage: "6.5% Deposit", pct: 1.7, amount: "$158k" },
  { stage: "Other", pct: 0.5, amount: "$43k" },
];

/** Home's date is Wednesday 5 August 2026 — "this month's pack" is August's. */
export const PACK_FILE = "locale-management-pack-aug-2026.csv";
