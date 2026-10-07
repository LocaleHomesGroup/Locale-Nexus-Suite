import { Banknote, Landmark, Wallet, type LucideIcon } from "lucide-react";
import {
  EMPLOYEE_RECORDS,
  ORG_SEED,
  leaveUsed,
  orgDepartment,
  orgDepartmentOf,
  type LeaveRequest,
  type LeaveType,
} from "@/components/modules/hr/data";
import { php, rateOn, toPhp } from "@/components/modules/accounting/fx";

/**
 * Employee portal data: what a Locale staff member sees of their own pay. It
 * pairs two Simple HRIS dashboards. From the employee dashboard it takes the
 * pay week, the hours behind it and your rates. From the contractor dashboard
 * it takes the invoice: Locale's offshore team is paid by invoice, so you
 * build one from your week, send it to Accounts and follow it to approval.
 *
 * The preview is Jan Kane Reroma, AI Engineer in AI & Growth (the org chart's
 * `jan-kane-reroma`). Their seat, record and department come from HR's data.
 *
 * Static prototype: the hours, rates and invoice history are sample figures.
 * Time tracking and Xero aren't connected, and the screens say so.
 */

/* ── Who ───────────────────────────────────────────────────────────────── */

export const EMPLOYEE_ID = "jan-kane-reroma";

/** The name they go by: the greeting's "Good afternoon, Kane." */
export const GOES_BY = "Kane";

const SEAT = ORG_SEED.find((p) => p.id === EMPLOYEE_ID)!;
export const EMPLOYEE = {
  name: SEAT.name!,
  role: SEAT.role,
  managerId: SEAT.managerId!,
  record: EMPLOYEE_RECORDS[EMPLOYEE_ID],
  department: orgDepartmentOf(ORG_SEED, EMPLOYEE_ID),
};

/** The portal's "today": the Sunday the latest week closed and its invoice is due to go. */
export const EMPLOYEE_TODAY = "2026-10-04";

/** Who reviews staff invoices: the head of Accounts on the org chart. */
const ACCOUNTS_HEAD = ORG_SEED.find((p) => p.id === orgDepartment("accounts").headId)!;
export const INVOICE_APPROVER = ACCOUNTS_HEAD.name!;

/* ── Rates ─────────────────────────────────────────────────────────────── */

/**
 * What Locale pays per hour, set by Locale (read-only here, as HRIS's Profile ›
 * Compensation › Rates). Hours over `overtimeAfter` in a pay week bill at the
 * overtime rate. Sample figures.
 */
export const RATES = { regular: 45, overtime: 67.5, overtimeAfter: 40 } as const;

/** A full day: the daily breakdown's marker line. */
export const DAY_TARGET = 8;

/** Every invoice is in Locale's currency; Accounts sets it, not the invoice. */
export const CURRENCY = "AUD";

/** "$1,833.75" — invoices carry cents, unlike the Launchpad's whole-dollar `aud()`. */
export function money(n: number): string {
  return n.toLocaleString("en-AU", { style: "currency", currency: CURRENCY, minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** "$•••••" — a hidden figure, the same width whatever it hides (HRIS HiddenValue). */
export const MASKED = "$•••••";

/** "40.5h" */
export const formatHours = (h: number) => `${h.toFixed(1)}h`;

/** "8h 30m", "45m", "—" for a day not worked (HRIS's daily breakdown). */
export function formatDuration(h: number): string {
  if (h <= 0) return "—";
  const mins = Math.round(h * 60);
  const hh = Math.floor(mins / 60);
  const mm = mins % 60;
  return hh ? (mm ? `${hh}h ${mm}m` : `${hh}h`) : `${mm}m`;
}

/* ── Dates ─────────────────────────────────────────────────────────────── */

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

/** ISO dates are read as UTC, so a date never shifts with the viewer's time zone. */
const utc = (iso: string) => new Date(`${iso}T00:00:00Z`);

export function addDays(iso: string, days: number): string {
  const d = utc(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** "27 Sep" */
export function dayMonth(iso: string): string {
  const d = utc(iso);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}

/** "27 Sep 2026" */
export function longDate(iso: string): string {
  return `${dayMonth(iso)} ${utc(iso).getUTCFullYear()}`;
}

/** "Mon 28" */
export function weekdayDate(iso: string): string {
  const d = utc(iso);
  return `${WEEKDAYS[d.getUTCDay()]} ${d.getUTCDate()}`;
}

/** Whole days from `a` to `b`. */
export const daysBetween = (a: string, b: string) => Math.round((utc(b).getTime() - utc(a).getTime()) / 86_400_000);

/* ── Pay weeks ─────────────────────────────────────────────────────────── */

/**
 * A pay week runs Sunday to Saturday, as HRIS's pay periods do. Hours are the
 * tracked hours for each day, Sunday first. Kane started on Monday 24 Aug.
 */
export interface PayWeek {
  /** The Sunday it starts (ISO). */
  start: string;
  hours: readonly [number, number, number, number, number, number, number];
}

/** Oldest first. The latest closed yesterday (Saturday 3 Oct). Sample figures. */
export const PAY_WEEKS: PayWeek[] = [
  { start: "2026-08-23", hours: [0, 8, 8, 8, 8, 8, 0] },
  { start: "2026-08-30", hours: [0, 8, 8.5, 8, 9, 8, 0] },
  { start: "2026-09-06", hours: [0, 8, 8, 7.5, 8, 8, 0] },
  { start: "2026-09-13", hours: [0, 8, 9, 8.5, 9, 8, 3] },
  { start: "2026-09-20", hours: [0, 8, 8, 8, 8, 6.5, 0] },
  { start: "2026-09-27", hours: [0, 8, 8.5, 8, 8, 8, 0] },
];

export const LATEST_WEEK = PAY_WEEKS[PAY_WEEKS.length - 1];

export const weekByStart = (start: string | null | undefined) => PAY_WEEKS.find((w) => w.start === start);

/** "27 Sep – 3 Oct", or "6–12 Sep" inside one month. */
export function weekLabel(start: string): string {
  const end = addDays(start, 6);
  const [s, e] = [utc(start), utc(end)];
  return s.getUTCMonth() === e.getUTCMonth()
    ? `${s.getUTCDate()}–${e.getUTCDate()} ${MONTHS[s.getUTCMonth()]}`
    : `${dayMonth(start)} – ${dayMonth(end)}`;
}

const cents = (n: number) => Math.round(n * 100) / 100;

/** What a week earns at your rates: regular hours up to the threshold, overtime after it. */
export function weekPay(week: PayWeek) {
  const hours = week.hours.reduce((a, b) => a + b, 0);
  const regularHours = Math.min(hours, RATES.overtimeAfter);
  const overtimeHours = Math.max(0, hours - RATES.overtimeAfter);
  const regular = cents(regularHours * RATES.regular);
  const overtime = cents(overtimeHours * RATES.overtime);
  return {
    hours,
    regularHours,
    overtimeHours,
    regular,
    overtime,
    total: cents(regular + overtime),
    daysWorked: week.hours.filter((h) => h > 0).length,
  };
}

/* ── Invoices ──────────────────────────────────────────────────────────── */

/** Accounts' decision. Anything not decided yet is pending (HRIS `normStatus`). */
export type InvoiceStatus = "pending" | "approved" | "rejected";

export interface InvoiceLine {
  id: string;
  description: string;
  notes: string;
  qty: number;
  rate: number;
  taxPct: number;
  /** Filled from the pay week's hours: re-filled when the week changes. */
  auto?: "regular" | "overtime";
}

/** The sender block every invoice carries: Profile › Invoice details prefills it. */
export interface SenderDetails {
  entityName: string;
  name: string;
  address: string;
  cityStateZip: string;
  country: string;
  /** An uploaded logo (data URL). Without one the invoice shows your initials. */
  logo: string | null;
}

export type ProcessorId = "bank" | "wise" | "wire";

/** How you want to be paid: owned by Profile › Payment method, copied onto each invoice. */
export interface PaymentMethod {
  processor: ProcessorId;
  fields: Record<string, string>;
}

export interface StaffInvoice {
  id: string;
  number: string;
  /** Invoice date and due date (ISO). */
  date: string;
  due: string;
  /** The pay week it bills (its Sunday), or null for a one-off. */
  week: string | null;
  from: SenderDetails;
  lines: InvoiceLine[];
  notes: string;
  payment: PaymentMethod | null;
  status: InvoiceStatus;
  /** "Approved by Aled Smith · 1 Sep", then "Paid by Aled Smith · 1 Sep · ₱68,652.00" */
  decision?: string;
  /** Set when Accounting's pay run paid it. The invoice stays approved. */
  paid?: InvoicePayment;
}

/** How a pay run paid an approved invoice: its date and rate, and the pesos sent. */
export interface InvoicePayment {
  /** The pay run's date (ISO). */
  on: string;
  /** Pesos per A$1 that run. */
  rate: number;
  /** What was sent. */
  php: number;
}

/**
 * Where an invoice stands, as the pills say it: Accounts' verdict, or Paid
 * once a pay run has sent it.
 */
export type InvoiceState = InvoiceStatus | "paid";

export const stateOf = (inv: Pick<StaffInvoice, "status" | "paid">): InvoiceState => (inv.paid ? "paid" : inv.status);

/** Who every invoice is billed to. Read-only on the invoice, as HRIS's Bill To. */
export const BILL_TO = { company: "Locale Property Group", address: "Perth, Western Australia", country: "Australia" } as const;

export function lineAmount(l: Pick<InvoiceLine, "qty" | "rate" | "taxPct">) {
  const amount = cents(l.qty * l.rate);
  return { amount, tax: cents(amount * (l.taxPct / 100)) };
}

export function invoiceTotals(lines: InvoiceLine[]) {
  let subtotal = 0;
  let tax = 0;
  for (const l of lines) {
    const a = lineAmount(l);
    subtotal += a.amount;
    tax += a.tax;
  }
  return { subtotal: cents(subtotal), tax: cents(tax), total: cents(subtotal + tax) };
}

/**
 * HRIS's invoice number: the entity's slug (every other letter), the issue
 * date as M-D-YY, then the sequence. "Jan Kane Reroma", 4 Oct 2026, sixth
 * invoice → "jnaeeoa-10-4-26-6".
 */
export function invoiceNumber(entityName: string, dateIso: string, seq: number): string {
  const letters = entityName.toLowerCase().replace(/[^a-z0-9]/g, "");
  let slug = "";
  for (let i = 0; i < letters.length; i += 2) slug += letters[i];
  const [y, m, d] = dateIso.split("-");
  return `${slug || "inv"}-${Number(m)}-${Number(d)}-${(y ?? "").slice(2)}-${seq}`;
}

/** A week's hours as invoice lines: regular, plus overtime when there is some. */
export function weekLines(week: PayWeek, makeId: () => string): InvoiceLine[] {
  const pay = weekPay(week);
  const period = `${weekLabel(week.start)} ${utc(week.start).getUTCFullYear()}`;
  const lines: InvoiceLine[] = [
    {
      id: makeId(),
      description: "Regular hours",
      notes: `Week of ${period}`,
      qty: pay.regularHours,
      rate: RATES.regular,
      taxPct: 0,
      auto: "regular",
    },
  ];
  if (pay.overtimeHours > 0) {
    lines.push({
      id: makeId(),
      description: `Overtime (after ${RATES.overtimeAfter}h)`,
      notes: `Week of ${period}`,
      qty: pay.overtimeHours,
      rate: RATES.overtime,
      taxPct: 0,
      auto: "overtime",
    });
  }
  return lines;
}

/**
 * The sender details on file. No address or payment method yet: the
 * Overview asks for them, and earlier invoices went out without.
 */
export const SEED_SENDER: SenderDetails = {
  entityName: EMPLOYEE.name,
  name: EMPLOYEE.name,
  address: "",
  cityStateZip: "",
  country: "",
  logo: null,
};

/** "Paid by Aled Smith · 1 Sep · ₱68,652.00": an invoice's decision once a pay run has sent it. */
export const paidDecision = (p: InvoicePayment) => `Paid by ${INVOICE_APPROVER} · ${dayMonth(p.on)} · ${php(p.php)}`;

/**
 * One sent invoice per closed week but the latest, invoiced the Sunday after
 * it, due a week later. Accounting's Tuesday pay run approved and paid the
 * first four (the dates are its past runs); the 29 Sep run skipped the fifth,
 * so it's still pending.
 */
const SEED_PAID_ON: (string | null)[] = ["2026-09-01", "2026-09-08", "2026-09-15", "2026-09-22", null];

let seedLine = 0;
export const SEED_INVOICES: StaffInvoice[] = PAY_WEEKS.slice(0, -1).map((week, i) => {
  const date = addDays(week.start, 7);
  const lines = weekLines(week, () => `seed-${++seedLine}`);
  const on = SEED_PAID_ON[i];
  const paid = on ? { on, rate: rateOn(on), php: toPhp(invoiceTotals(lines).total, rateOn(on)) } : undefined;
  return {
    id: `inv-${week.start}`,
    number: invoiceNumber(SEED_SENDER.entityName, date, i + 1),
    date,
    due: addDays(date, 7),
    week: week.start,
    from: SEED_SENDER,
    lines,
    notes: "",
    payment: null,
    status: paid ? "approved" : "pending",
    ...(paid ? { paid, decision: paidDecision(paid) } : {}),
  };
});

/* ── Payment methods (HRIS Profile › Payment Gateway) ──────────────────── */

export interface PaymentField {
  key: string;
  label: string;
  placeholder: string;
  mono?: boolean;
  type?: "email" | "text";
  /** Nice to have; an invoice goes without it. */
  optional?: boolean;
}

export const PROCESSORS: { id: ProcessorId; label: string; blurb: string; icon: LucideIcon; fields: PaymentField[] }[] = [
  {
    id: "bank",
    label: "Bank transfer",
    blurb: "Paid into an Australian bank account by BSB and account number.",
    icon: Landmark,
    fields: [
      { key: "accountName", label: "Account name", placeholder: "Name on the account" },
      { key: "bsb", label: "BSB", placeholder: "000-000", mono: true },
      { key: "accountNumber", label: "Account number", placeholder: "12345678", mono: true },
    ],
  },
  {
    id: "wise",
    label: "Wise",
    blurb: "Paid to your Wise account, found by its email address.",
    icon: Wallet,
    fields: [
      { key: "email", label: "Wise email", placeholder: "you@example.com", type: "email" },
      { key: "accountName", label: "Account holder name", placeholder: "Name on the account" },
    ],
  },
  {
    id: "wire",
    label: "International wire",
    blurb: "A SWIFT transfer to a bank outside Australia.",
    icon: Banknote,
    fields: [
      { key: "accountName", label: "Account holder name", placeholder: "Name on the account" },
      { key: "bankName", label: "Bank name", placeholder: "Bank name" },
      { key: "accountNumber", label: "Account number", placeholder: "Account number", mono: true },
      { key: "swift", label: "SWIFT / BIC", placeholder: "SWIFT or BIC code", mono: true },
      { key: "bankAddress", label: "Bank address", placeholder: "Branch address", optional: true },
    ],
  },
];

export const processor = (id: ProcessorId) => PROCESSORS.find((p) => p.id === id)!;

/** The filled-in fields of a payment method, for the invoice and its preview. */
export function paymentLines(m: PaymentMethod | null): { label: string; value: string; mono?: boolean }[] {
  if (!m) return [];
  return processor(m.processor)
    .fields.map((f) => ({ label: f.label, value: (m.fields[f.key] ?? "").trim(), mono: f.mono }))
    .filter((l) => l.value);
}

/** Every field the method needs is filled in. */
export function paymentComplete(m: PaymentMethod | null): boolean {
  return Boolean(m) && processor(m!.processor).fields.every((f) => f.optional || (m!.fields[f.key] ?? "").trim());
}

/** Missing from the invoice details: what the Overview's nudge asks for. */
export function missingDetails(sender: SenderDetails, payment: PaymentMethod | null): string[] {
  const missing: string[] = [];
  if (!sender.address.trim() || !sender.country.trim()) missing.push("your address");
  if (!paymentComplete(payment)) missing.push("how you'd like to be paid");
  return missing;
}

/* ── Leave ─────────────────────────────────────────────────────────────── */

/**
 * Your yearly allowance for each leave type that draws on a balance (HRIS's
 * leave types; Bereavement and Other are granted case by case). Placeholders,
 * like the rates, until Horilla's balances are connected.
 */
export const LEAVE_ALLOWANCE: Partial<Record<LeaveType, number>> = { Vacation: 10, Sick: 5, Personal: 3 };

/** Days of a type you can still ask for: the allowance less what's pending or approved. Null when it has no balance. */
export function leaveAvailable(requests: LeaveRequest[], type: LeaveType): number | null {
  const allowance = LEAVE_ALLOWANCE[type];
  return allowance === undefined ? null : allowance - leaveUsed(requests, EMPLOYEE.name, type);
}

/** How far back sick leave can be filed: you're often off before you can say so. */
export const SICK_BACKDATE_DAYS = 14;
