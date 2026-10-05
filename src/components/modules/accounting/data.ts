import { ORG_SEED, masterList, seedPayRate, type PayRate } from "@/components/modules/hr/data";
import {
  EMPLOYEE_ID,
  EMPLOYEE_TODAY,
  INVOICE_APPROVER,
  PAY_WEEKS,
  RATES,
  SEED_INVOICES,
  addDays,
  dayMonth,
  invoiceNumber,
  invoiceTotals,
  paidDecision,
  paymentComplete,
  processor,
  weekLabel,
  type InvoiceLine,
  type InvoiceStatus,
  type PaymentMethod,
  type StaffInvoice,
} from "@/components/modules/employee/data";
import { PAST_RATES, rateOn, toPhp } from "./fx";

/**
 * Accounting: where the company accountant pays Locale's offshore team. They
 * invoice in AUD from the Employee portal; Accounting pays them in pesos.
 *
 * The flow is HRIS's Payroll Wizard cut down to what an invoice-only payroll
 * needs. HRIS's steps:
 *
 *   1 Initialize, 2 Initial Calculation, 3 Orphanage, 4 PAB, 5 Additions,
 *   6 Contractors, 7 Validation, 8 Dispatch, 9 Reports
 *
 * The pay run keeps four of them:
 *
 *   Rate         HRIS's per-cycle FX card (step 2), AUD → PHP.
 *   Invoices     HRIS's Contractors (6): approve or reject what's being paid.
 *   Validation   HRIS's Validation (7): a pre-flight per person, then hold or pay.
 *   Dispatch     HRIS's Dispatch (8): lock in and send.
 *
 * Hubstaff uploads and hours maths (1, 2), Orphanage, PAB and Additions don't
 * apply: the invoice already carries the hours and the rate. Reports became the
 * Pay history section.
 *
 * Static prototype: the payees, their invoices, payment details and past runs
 * are sample figures. The previewed employee (Jan Kane Reroma) is live: their
 * invoices are the Employee portal's.
 */

/** What the flow is called: the rail item, the page title, the toasts. */
export const PAY_RUN = "Pay run";

/** Who runs it: the head of Accounts on the org chart. */
export const ACCOUNTANT = INVOICE_APPROVER;

/** This run's date: the Launchpad's today, the Sunday the latest pay week's invoices arrive. */
export const RUN_DATE = EMPLOYEE_TODAY;

/** Cents-safe rounding for a dollar or peso total. */
const round = (n: number) => Math.round(n * 100) / 100;

/** A staff invoice and whose it is. */
export interface PayeeInvoice extends StaffInvoice {
  employeeId: string;
}

/* ── Who's paid by invoice ─────────────────────────────────────────────── */

interface PayeeSeed {
  id: string;
  street: string;
  city: string;
  /** Their payment method on file (Employee › Profile). Null: they haven't added one. */
  method: PaymentMethod | null;
}

const wise = (email: string, accountName: string): PaymentMethod => ({ processor: "wise", fields: { email, accountName } });

const wire = (accountName: string, bankName: string, accountNumber: string, swift: string): PaymentMethod => ({
  processor: "wire",
  fields: { accountName, bankName, accountNumber, swift },
});

/**
 * Locale's offshore team, besides the previewed employee, whose payment
 * method is their Employee portal Profile. Placeholder: which staff invoice,
 * their addresses and payment details are sample figures.
 */
const PAYEE_SEED: PayeeSeed[] = [
  { id: "maria-soriano", street: "18 Jupiter St, Bel-Air", city: "Makati City, Metro Manila 1209", method: wise("msoriano@hotmail.com", "Maria Soriano") },
  {
    id: "kristian-charlon-serrano",
    street: "7 Maginhawa St, Teachers Village",
    city: "Quezon City, Metro Manila 1101",
    method: wire("Kristian Charlon Serrano", "BDO Unibank", "005810294467", "BNORPHMM"),
  },
  { id: "sarah-jasmin", street: "22 San Miguel Ave, Ortigas Center", city: "Pasig City, Metro Manila 1605", method: wise("sjasmin@hotmail.com", "Sarah Jasmin") },
  // No payment method on file: Validation holds her until she adds one.
  { id: "dianne-alvarez", street: "41 Gorordo Ave, Lahug", city: "Cebu City, Cebu 6000", method: null },
  {
    id: "jerry-delos-santos",
    street: "9 Lawton Ave, McKinley Hill",
    city: "Taguig City, Metro Manila 1634",
    method: wire("Jerry Delos Santos", "Bank of the Philippine Islands", "3459027781", "BOPIPHMM"),
  },
  { id: "pablo-lopez", street: "15 J.P. Laurel Ave, Bajada", city: "Davao City, Davao del Sur 8000", method: wise("pablol78@yahoo.com.au", "Pablo Lopez") },
  { id: "andre-mikhail-serra", street: "3 Shaw Blvd, Wack-Wack", city: "Mandaluyong City, Metro Manila 1550", method: wise("andre.serra00@hotmail.com", "Andre Mikhail Serra") },
];

const ROWS = new Map(masterList(ORG_SEED).map((r) => [r.id, r]));

/** Everyone Accounting pays by invoice, previewed employee first. */
export const PAYEE_IDS: readonly string[] = [EMPLOYEE_ID, ...PAYEE_SEED.map((p) => p.id)];

/** Name and position from HR's org chart. */
export function personOf(id: string): { name: string; role: string } {
  const row = ROWS.get(id);
  return { name: row?.name ?? id, role: row?.role ?? "" };
}

/** Payment methods on file, previewed employee aside (theirs is live in the Employee portal). */
export const SEED_METHODS: Record<string, PaymentMethod | null> = Object.fromEntries(PAYEE_SEED.map((p) => [p.id, p.method]));

/* ── Their invoices ────────────────────────────────────────────────────── */

/** Weekly hours, cycled per person and week so no two weeks read the same. Sample figures. */
const HOURS = [40, 41.5, 40, 38.5, 40, 43, 40, 39, 42, 40];

/** A week's hours as invoice lines at HR's rates: regular to the threshold, overtime after. */
function hoursLines(weekStart: string, hours: number, rate: PayRate, makeId: () => string): InvoiceLine[] {
  const period = `${weekLabel(weekStart)} ${weekStart.slice(0, 4)}`;
  const regular = Math.min(hours, RATES.overtimeAfter);
  const overtime = Math.max(0, hours - RATES.overtimeAfter);
  const lines: InvoiceLine[] = [
    { id: makeId(), description: "Regular hours", notes: `Week of ${period}`, qty: regular, rate: rate.hourly, taxPct: 0, auto: "regular" },
  ];
  if (overtime > 0) {
    lines.push({
      id: makeId(),
      description: `Overtime (after ${RATES.overtimeAfter}h)`,
      notes: `Week of ${period}`,
      qty: overtime,
      rate: rate.overtime,
      taxPct: 0,
      auto: "overtime",
    });
  }
  return lines;
}

/** A pay run's date for a week: the Tuesday after the Sunday it's invoiced. */
const runFor = (weekStart: string) => addDays(weekStart, 9);

/** The latest past run. */
const LAST_RUN = PAST_RATES[PAST_RATES.length - 1].on;

/**
 * The 29 Sep run's two bank wires: locked in and waiting in Pay Dispatch, not
 * sent yet (wires go out after Wise). Their invoices are approved, not paid.
 */
const UNSENT = new Set(["kristian-charlon-serrano", "jerry-delos-santos"]);

/**
 * Each payee's invoice for every closed week. The past five weeks were paid
 * on the Tuesday run after them; the latest week's arrived today and is
 * pending. Andre also sent a one-off for a tool subscription.
 */
function seedInvoices(): PayeeInvoice[] {
  const out: PayeeInvoice[] = [];
  let line = 0;
  const makeId = () => `acct-line-${++line}`;
  PAYEE_SEED.forEach((p, pi) => {
    const row = ROWS.get(p.id)!;
    const rate = seedPayRate(row)!;
    const from = { entityName: row.name, name: row.name, address: p.street, cityStateZip: p.city, country: "Philippines", logo: null };
    PAY_WEEKS.forEach((week, wi) => {
      const date = addDays(week.start, 7);
      const lines = hoursLines(week.start, HOURS[(pi * 3 + wi * 7) % HOURS.length], rate, makeId);
      const on = runFor(week.start);
      const settled = PAST_RATES.some((r) => r.on === on);
      const unsent = settled && on === LAST_RUN && UNSENT.has(p.id);
      const paid = settled && !unsent ? { on, rate: rateOn(on), php: toPhp(invoiceTotals(lines).total, rateOn(on)) } : undefined;
      out.push({
        id: `acct-${p.id}-${week.start}`,
        employeeId: p.id,
        number: invoiceNumber(row.name, date, wi + 1),
        date,
        due: addDays(date, 7),
        week: week.start,
        from,
        lines,
        notes: "",
        payment: p.method,
        status: settled ? "approved" : "pending",
        ...(paid ? { paid, decision: paidDecision(paid) } : unsent ? { decision: `Approved by ${ACCOUNTANT} · ${dayMonth(on)}` } : {}),
      });
    });
    if (p.id === "andre-mikhail-serra") {
      const date = "2026-10-02";
      out.push({
        id: `acct-${p.id}-one-off`,
        employeeId: p.id,
        number: invoiceNumber(row.name, date, PAY_WEEKS.length + 1),
        date,
        due: addDays(date, 7),
        week: null,
        from,
        lines: [
          {
            id: makeId(),
            description: "AI coding assistant, October",
            notes: "Team seat, approved by Jerry Delos Santos. Receipt attached.",
            qty: 1,
            rate: 64,
            taxPct: 0,
          },
        ],
        notes: "Reimbursement for a tool the AI & Growth team uses.",
        payment: p.method,
        status: "pending",
      });
    }
  });
  return out;
}

export const SEED_PAYEE_INVOICES: PayeeInvoice[] = seedInvoices();

/* ── Pay runs ──────────────────────────────────────────────────────────── */

export interface HeldPayee {
  employeeId: string;
  reason: string;
}

/** A locked-in pay run: what it pays, at what rate, and what it left. */
export interface PayRun {
  id: string;
  /** Date (ISO). */
  on: string;
  /** Pesos per A$1. */
  rate: number;
  by: string;
  /** The invoices it pays, through its payouts in Pay Dispatch. */
  invoiceIds: string[];
  /** Approved invoices it held back, by person. */
  held: HeldPayee[];
  /** Invoices still pending when it went, left for the next run. */
  skipped: number;
  /** Totals at dispatch, so the record never moves. */
  payees: number;
  aud: number;
  php: number;
}

/* ── Pay Dispatch ──────────────────────────────────────────────────────── */

export type PayoutStatus = "pending" | "paid" | "problem";

/** How a payout went out, as logged in Pay Dispatch (HRIS's Mark Paid). */
export interface PayoutSent {
  /** The processor's transaction reference. */
  ref: string;
  /** The Locale account it was sent from. */
  from: string;
  /** Date sent (ISO). */
  on: string;
  by: string;
}

/**
 * One person's pay in a locked-in run: what HRIS's Payment Dispatch queues.
 * The run's Dispatch step creates it as pending; it's paid once someone sends
 * the money and logs the reference. Only then are its invoices Paid.
 */
export interface Payout {
  id: string;
  runId: string;
  employeeId: string;
  invoiceIds: string[];
  aud: number;
  php: number;
  /** Their payment method when the run was locked in. */
  method: PaymentMethod | null;
  status: PayoutStatus;
  sent?: PayoutSent;
  /** What went wrong, for a payout flagged as a problem. */
  problem?: string;
}

/** The Locale accounts a payout is sent from. Placeholder names. */
export const SENT_FROM = ["Wise Business", "Business bank account"] as const;

/** The account a method is usually paid from: Wise to Wise, a wire from the bank. */
export const defaultFrom = (m: PaymentMethod | null) => (m?.processor === "wise" ? SENT_FROM[0] : SENT_FROM[1]);

/** A plausible processor reference for a seeded payment: "TRF-48213906", "FT26092441178". */
function seedRef(m: PaymentMethod | null, on: string, i: number): string {
  const n = (on.replace(/-/g, "").slice(2) + String(i * 7919 + 1301)).slice(0, 11);
  return m?.processor === "wise" ? `TRF-${n.slice(-8)}` : `FT${n}`;
}

/**
 * The past runs, newest first, and their payouts, built from the invoices
 * they paid. Everything before 29 Sep is sent; the 29 Sep wires are pending.
 */
function seedRuns(): { runs: PayRun[]; payouts: Payout[] } {
  const all: PayeeInvoice[] = [...SEED_INVOICES.map((i) => ({ ...i, employeeId: EMPLOYEE_ID })), ...SEED_PAYEE_INVOICES];
  const payouts: Payout[] = [];
  const runs = PAST_RATES.map(({ on, rate }) => {
    const id = `run-${on}`;
    const mine = all.filter((i) => i.paid?.on === on || (on === LAST_RUN && UNSENT.has(i.employeeId) && i.status === "approved" && !i.paid));
    const people = PAYEE_IDS.filter((e) => mine.some((i) => i.employeeId === e));
    people.forEach((e, n) => {
      const invs = mine.filter((i) => i.employeeId === e);
      const method = e === EMPLOYEE_ID ? null : SEED_METHODS[e];
      const sent = invs.every((i) => i.paid);
      payouts.push({
        id: `${id}:${e}`,
        runId: id,
        employeeId: e,
        invoiceIds: invs.map((i) => i.id),
        aud: round(invs.reduce((t, i) => t + invoiceTotals(i.lines).total, 0)),
        php: round(invs.reduce((t, i) => t + toPhp(invoiceTotals(i.lines).total, rate), 0)),
        method,
        status: sent ? "paid" : "pending",
        ...(sent ? { sent: { ref: seedRef(method, on, n + 1), from: defaultFrom(method), on, by: ACCOUNTANT } } : {}),
      });
    });
    const run: PayRun = {
      id,
      on,
      rate,
      by: ACCOUNTANT,
      invoiceIds: mine.map((i) => i.id),
      held: [],
      // The 29 Sep run left Kane's week of 20 Sep undecided.
      skipped: SEED_INVOICES.filter((i) => i.status === "pending" && i.date < on).length,
      payees: people.length,
      aud: round(mine.reduce((t, i) => t + invoiceTotals(i.lines).total, 0)),
      php: round(payouts.filter((p) => p.runId === id).reduce((t, p) => t + p.php, 0)),
    };
    return run;
  }).reverse();
  return { runs, payouts };
}

const SEEDED = seedRuns();
export const SEED_RUNS: PayRun[] = SEEDED.runs;
export const SEED_PAYOUTS: Payout[] = SEEDED.payouts;

/** Invoices locked into a run and still in Pay Dispatch. The next run leaves them alone. */
export const queuedIds = (payouts: Payout[]) => new Set(payouts.filter((p) => p.status !== "paid").flatMap((p) => p.invoiceIds));

/** How a method pays out, as Pay Dispatch groups it. */
export type Rail = "wise" | "wire" | "bank";

export const RAIL_LABEL: Record<Rail, string> = { wise: "Wise", wire: "Bank wire", bank: "Bank transfer" };

export const railOf = (m: PaymentMethod | null): Rail | null => m?.processor ?? null;


/* ── This run ──────────────────────────────────────────────────────────── */

/** The four steps, HRIS's labels where HRIS has one. */
export const STEPS = [
  { id: "rate", label: "Rate", description: "AUD to PHP for this run" },
  { id: "invoices", label: "Invoices", description: "Approve what's being paid" },
  { id: "validation", label: "Validation", description: "Pre-flight check and final review" },
  { id: "dispatch", label: "Dispatch", description: "Lock in and send to Pay Dispatch" },
] as const;

export type StepId = (typeof STEPS)[number]["id"];

/** "Approved by Aled Smith · 4 Oct": what the employee sees after the Invoices step. */
export function decisionFor(status: InvoiceStatus): string | undefined {
  if (status === "pending") return undefined;
  return `${status === "approved" ? "Approved" : "Rejected"} by ${ACCOUNTANT} · ${dayMonth(RUN_DATE)}`;
}

/** One person's share of the run: their approved, unpaid invoices and whether they can be paid. */
export interface Payee {
  id: string;
  name: string;
  role: string;
  invoices: PayeeInvoice[];
  aud: number;
  method: PaymentMethod | null;
  /** Why they can't be paid this run. Validation holds them. */
  blocker: string | null;
  /** Worth a look, but they can be paid. */
  warnings: string[];
}

/**
 * The pre-flight, per person (HRIS's Validation). A missing or half-filled
 * payment method blocks: there's nowhere to send it. A billed rate that
 * differs from HR's rate on file only warns (HRIS's rate-mismatch note): the
 * invoice is what was agreed, but it may be worth asking.
 */
export function payeesOf(
  invoices: PayeeInvoice[],
  methods: Record<string, PaymentMethod | null>,
  hrRates: Record<string, PayRate | undefined>,
  queued: Set<string> = new Set(),
): Payee[] {
  const due = invoices.filter((i) => i.status === "approved" && !i.paid && !queued.has(i.id));
  return PAYEE_IDS.flatMap((id) => {
    const mine = due.filter((i) => i.employeeId === id);
    if (!mine.length) return [];
    const method = methods[id] ?? null;
    const hr = hrRates[id];
    const warnings = new Set<string>();
    for (const inv of mine) {
      for (const l of inv.lines) {
        const expected = l.auto === "regular" ? hr?.hourly : l.auto === "overtime" ? hr?.overtime : undefined;
        if (expected != null && Math.abs(expected - l.rate) >= 0.005) {
          warnings.add(`${l.auto === "regular" ? "Regular" : "Overtime"} billed at ${aud2(l.rate)}/h; HR has ${aud2(expected)}/h`);
        }
      }
    }
    return [
      {
        id,
        ...personOf(id),
        invoices: mine,
        aud: round(mine.reduce((n, i) => n + invoiceTotals(i.lines).total, 0)),
        method,
        blocker: !method ? "No payment method on file" : !paymentComplete(method) ? "Payment method is missing details" : null,
        warnings: [...warnings],
      },
    ];
  });
}

const aud2 = (n: number) => `$${n.toFixed(2)}`;

/** "Wise · msoriano@hotmail.com", "BDO Unibank · ••••4467". */
export function methodSummary(m: PaymentMethod | null): { label: string; detail: string } | null {
  if (!m) return null;
  const f = m.fields;
  const tail = (s?: string) => (s ? `••••${s.replace(/\D/g, "").slice(-4)}` : "");
  if (m.processor === "wise") return { label: processor("wise").label, detail: f.email ?? "" };
  if (m.processor === "wire") return { label: f.bankName || processor("wire").label, detail: tail(f.accountNumber) };
  return { label: processor("bank").label, detail: [f.bsb, tail(f.accountNumber)].filter(Boolean).join(" ") };
}

/** What a payee's invoices pay in pesos: each invoice converted on its own, to the centavo. */
export const phpFor = (invoices: StaffInvoice[], rate: number) => round(invoices.reduce((n, i) => n + toPhp(invoiceTotals(i.lines).total, rate), 0));

/**
 * The invoices the run is about: still to decide, approved but unpaid, or
 * decided in this run. One already locked into a run waits in Pay Dispatch.
 */
export function inRun(invoices: PayeeInvoice[], touched: Record<string, true>, queued: Set<string>): PayeeInvoice[] {
  return invoices.filter((i) => !i.paid && !queued.has(i.id) && (i.status !== "rejected" || touched[i.id]));
}

/** The run at a glance: what each step shows and how far the run can go. */
export interface RunSummary {
  /** The Invoices step's list: pending first, then approved, then rejected. */
  queue: PayeeInvoice[];
  pending: PayeeInvoice[];
  approved: PayeeInvoice[];
  rejected: PayeeInvoice[];
  /** Everyone with approved invoices, checked. */
  payees: Payee[];
  /** Who this run pays: not blocked, not held. */
  pay: Payee[];
  /** Who it holds back, and why. */
  held: HeldPayee[];
  /** What it pays. PHP is 0 until the rate is set. */
  aud: number;
  php: number;
  /** What each step still needs before the run can go, or null: the footer's hint. */
  blocked: (string | null)[];
}

const ORDER: Record<InvoiceStatus, number> = { pending: 0, approved: 1, rejected: 2 };

export function summarise(
  view: {
    invoices: PayeeInvoice[];
    methods: Record<string, PaymentMethod | null>;
    rate: number | null;
    holds: Record<string, true>;
    touched: Record<string, true>;
    payouts: Payout[];
  },
  hrRates: Record<string, PayRate | undefined>,
): RunSummary {
  const seat = (id: string) => PAYEE_IDS.indexOf(id);
  const queued = queuedIds(view.payouts);
  const queue = inRun(view.invoices, view.touched, queued).sort(
    (a, b) => ORDER[a.status] - ORDER[b.status] || seat(a.employeeId) - seat(b.employeeId) || a.date.localeCompare(b.date),
  );
  const payees = payeesOf(view.invoices, view.methods, hrRates, queued);
  const pay = payees.filter((p) => !p.blocker && !view.holds[p.id]);
  const held = payees
    .filter((p) => p.blocker || view.holds[p.id])
    .map((p) => ({ employeeId: p.id, reason: p.blocker ?? `Held by ${ACCOUNTANT}` }));
  const approved = queue.filter((i) => i.status === "approved");
  const rate = view.rate;
  const blocked = [
    rate == null ? "This run's rate isn't set yet" : null,
    approved.length ? null : "No invoices approved yet",
    pay.length ? null : "No one can be paid yet",
    null,
  ];
  return {
    queue,
    pending: queue.filter((i) => i.status === "pending"),
    approved,
    rejected: queue.filter((i) => i.status === "rejected"),
    payees,
    pay,
    held,
    aud: round(pay.reduce((n, p) => n + p.aud, 0)),
    php: rate == null ? 0 : round(pay.reduce((n, p) => n + phpFor(p.invoices, rate), 0)),
    blocked,
  };
}
