/**
 * Accounts' live records — the builder invoices and expense claims that
 * Accounts approves, Home's My day counts and Jarvis quotes. They seed the
 * shared Launchpad store (src/state/launchpad-store.tsx), so an approval in
 * Accounts is what every other screen reads. From the mockup (`hm`, app.js
 * 10098–10855). All builder invoice amounts are excl GST.
 */
import { aud } from "@/lib/utils";

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

/**
 * "Invoiced this month": the month-to-date figure before this session, plus
 * every invoice approved in this session.
 */
export function invoicedThisMonth(invoices: BuilderInvoice[]): number {
  return INVOICED_THIS_MONTH + invoices.filter((i) => i.approvedNow).reduce((sum, i) => sum + i.amount, 0);
}

export type ClaimStatus = "Awaiting approval" | "Approved" | "Paid" | "Declined";

/** What a person decides on a claim that is awaiting approval. */
export type ClaimDecision = "Approved" | "Declined";

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

/** Claim amounts keep their cents: "$186.40". */
export const cents = (n: number) => aud(n, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
