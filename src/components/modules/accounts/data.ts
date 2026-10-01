/**
 * Accounts — static data from the mockup (`hm`, app.js 10098–10855).
 * Builder invoices and expense claims seed the module's local state; the
 * report figures are read-only. All builder invoice amounts are excl GST.
 */

export type InvoiceStatus = "Draft" | "Approved" | "Paid";

export interface BuilderInvoice {
  id: string;
  job: string;
  client: string;
  builder: string;
  stage: string;
  /** AUD excl GST. */
  amount: number;
  note: string;
  status: InvoiceStatus;
  /** Approved in this session — counts toward "Invoiced this month". */
  approvedNow?: boolean;
}

export const SEED_INVOICES: BuilderInvoice[] = [
  {
    id: "INV-D-1042",
    job: "25211",
    client: "A. Davoile and C. Alex",
    builder: "Forma",
    stage: "Slab Down",
    amount: 17500,
    note: "50% down deduction applies at this stage",
    status: "Draft",
  },
  {
    id: "INV-D-1041",
    job: "25478",
    client: "S. and P. Nakamura",
    builder: "Move Homes",
    stage: "Slab Down",
    amount: 10000,
    note: "Down deducted here if applicable",
    status: "Draft",
  },
  {
    id: "INV-D-1040",
    job: "23901",
    client: "F. Adeyemi",
    builder: "New Era",
    stage: "Land Settlement",
    amount: 15000,
    note: "",
    status: "Draft",
  },
  {
    id: "INV-1036",
    job: "25302",
    client: "M. Achebe",
    builder: "La Vida",
    stage: "Slab Down",
    amount: 15000,
    note: "",
    status: "Approved",
  },
  {
    id: "INV-1031",
    job: "25431",
    client: "R. de Thierry and J. Kumar",
    builder: "Forma",
    stage: "Finance Approval",
    amount: 17500,
    note: "",
    status: "Paid",
  },
];

/** "Invoiced this month" before anything is approved in this session. */
export const INVOICED_THIS_MONTH = 135000;
export const FORECAST_NEXT_MONTH = 310000;

export type ClaimStatus = "Awaiting approval" | "Approved" | "Paid" | "Declined";

export interface ExpenseClaim {
  claim: string;
  staff: string;
  /** AUD, cents kept. */
  amount: number;
  /** Xero account code and name — "453 · Travel". */
  code: string;
  account: string;
  status: ClaimStatus;
}

export const SEED_CLAIMS: ExpenseClaim[] = [
  {
    claim: "Site travel — Baldivis x3",
    staff: "A. Mercer",
    amount: 186.4,
    code: "453",
    account: "Travel",
    status: "Awaiting approval",
  },
  {
    claim: "Client settlement gift",
    staff: "K. Ellery",
    amount: 120,
    code: "429",
    account: "Client costs",
    status: "Awaiting approval",
  },
  {
    claim: "Display home consumables",
    staff: "S. Hart",
    amount: 342.75,
    code: "461",
    account: "Office",
    status: "Approved",
  },
  {
    claim: "Software — measurement app",
    staff: "P. Lopez",
    amount: 29,
    code: "489",
    account: "Subscriptions",
    status: "Paid",
  },
];

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

export const COMMISSION_BY_STAGE: StageShare[] = [
  { stage: "Finance Approval", pct: 44.6, amount: "$4.19m" },
  { stage: "Land Settlement", pct: 32.2, amount: "$3.03m" },
  { stage: "Slab", pct: 21, amount: "$1.97m" },
  { stage: "6.5% Deposit", pct: 1.7, amount: "$158k" },
  { stage: "Other", pct: 0.5, amount: "$43k" },
];

/** Home's date is Wednesday 5 August 2026 — "this month's pack" is August's. */
export const PACK_FILE = "locale-management-pack-aug-2026.csv";
