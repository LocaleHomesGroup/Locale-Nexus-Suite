"use client";

import * as React from "react";
import { toast } from "sonner";
import { undoable } from "@/lib/undoable";
import {
  EMPLOYEE_ID,
  invoiceTotals,
  paidDecision,
  type InvoicePayment,
  type InvoiceStatus,
  type PaymentMethod,
} from "@/components/modules/employee/data";
import { decideInvoices, payInvoices, unpayInvoices, useInvoices } from "@/components/modules/employee/invoice-store";
import { usePay } from "@/components/modules/hr/pay-store";
import { php, toPhp } from "./fx";
import {
  ACCOUNTANT,
  RUN_DATE,
  SEED_METHODS,
  SEED_PAYEE_INVOICES,
  SEED_PAYOUTS,
  SEED_RUNS,
  STEPS,
  decisionFor,
  personOf,
  phpFor,
  summarise,
  type HeldPayee,
  type Payee,
  type PayeeInvoice,
  type Payout,
  type PayoutSent,
  type PayRun,
  type RunSummary,
} from "./data";

/**
 * The pay run in progress, the runs before it, and their payouts in Pay
 * Dispatch. Module scope, like the Employee portal's invoices, so a half-done
 * run survives a section switch and a lock-in's undo window keeps running if
 * you navigate away. Nothing is persisted: a reload resets to the seed.
 *
 * Everyone's invoices live here except the previewed employee's, which are
 * the Employee portal's own store: deciding or paying one writes there, so the
 * portal's History moves the moment Accounting does.
 *
 * The money moves in two places, as in HRIS. The Pay run's Dispatch step
 * locks the run in and queues one payout per person (through `undoable()`).
 * Pay Dispatch is where each is sent and logged; only then are its invoices
 * Paid. Approve and Reject apply at once, with Reset to take them back
 * (HRIS's Contractors step), and a logged payment can be sent back.
 */
interface PayRunState {
  invoices: PayeeInvoice[];
  methods: Record<string, PaymentMethod | null>;
  /** This run's AUD → PHP rate. Null until set: every run starts without one, as HRIS's cycles do. */
  rate: number | null;
  /** The step showing, an index into STEPS. */
  step: number;
  /** People held back from this run in Validation, by id. */
  holds: Record<string, true>;
  /** Invoices decided in this run, so a rejected one stays listed with Reset. */
  touched: Record<string, true>;
  /** Locked-in runs, newest first. */
  runs: PayRun[];
  /** Every run's payouts, the Pay Dispatch queue and its done list. */
  payouts: Payout[];
  /** The run inside its lock-in undo window. Nothing has been queued yet. */
  dispatching: PayRun | null;
  /** The run this one became once it was locked in. Dispatch shows its receipt until the next run starts. */
  done: string | null;
}

const SEED: PayRunState = {
  invoices: SEED_PAYEE_INVOICES,
  methods: SEED_METHODS,
  rate: null,
  step: 0,
  holds: {},
  touched: {},
  runs: SEED_RUNS,
  payouts: SEED_PAYOUTS,
  dispatching: null,
  done: null,
};

let state: PayRunState = SEED;
const listeners = new Set<() => void>();

function setState(next: (s: PayRunState) => PayRunState) {
  state = next(state);
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** The pay run's own state. The server (and hydration) always sees the seed. */
function usePayRunState(): PayRunState {
  return React.useSyncExternalStore(
    subscribe,
    () => state,
    () => SEED,
  );
}

export type PayRunView = PayRunState;

/**
 * Everything the screens read: this store, with the previewed employee's
 * invoices and payment method folded in from the Employee portal. An invoice
 * still inside its send window hasn't reached Accounts, so it isn't here.
 */
export function usePayRun(): PayRunView {
  const s = usePayRunState();
  const emp = useInvoices();
  const invoices = React.useMemo(
    () => [
      ...emp.invoices.filter((i) => !emp.sending[i.id]).map((i) => ({ ...i, employeeId: EMPLOYEE_ID })),
      ...s.invoices,
    ],
    [emp.invoices, emp.sending, s.invoices],
  );
  const methods = React.useMemo(() => ({ ...s.methods, [EMPLOYEE_ID]: emp.payment }), [s.methods, emp.payment]);
  return React.useMemo(() => ({ ...s, invoices, methods }), [s, invoices, methods]);
}

/** The run and its summary, checked against HR's live pay rates. */
export function useRun(): { view: PayRunView; run: RunSummary } {
  const view = usePayRun();
  const { rates } = usePay();
  const run = React.useMemo(() => summarise(view, rates), [view, rates]);
  return { view, run };
}

const locked = () => Boolean(state.dispatching || state.done);

export function setRate(rate: number) {
  if (locked()) return;
  setState((s) => ({ ...s, rate }));
}

export function goToStep(step: number) {
  setState((s) => ({ ...s, step: Math.max(0, Math.min(STEPS.length - 1, step)) }));
}

/** Approve, reject or reset invoices. The previewed employee's are written to the Employee portal's store. */
export function decide(invoices: PayeeInvoice[], status: InvoiceStatus) {
  if (locked() || !invoices.length) return;
  const decision = decisionFor(status);
  const theirs = invoices.filter((i) => i.employeeId === EMPLOYEE_ID).map((i) => i.id);
  const ours = new Set(invoices.filter((i) => i.employeeId !== EMPLOYEE_ID).map((i) => i.id));
  if (theirs.length) decideInvoices(theirs, status, decision);
  setState((s) => {
    const touched = { ...s.touched };
    for (const i of invoices) {
      if (status === "pending") delete touched[i.id];
      else touched[i.id] = true;
    }
    return {
      ...s,
      touched,
      invoices: s.invoices.map((i) => {
        if (!ours.has(i.id) || i.paid) return i;
        const next: PayeeInvoice = { ...i, status };
        if (decision) next.decision = decision;
        else delete next.decision;
        return next;
      }),
    };
  });
}

/** Hold someone back from this run, or put them back in. */
export function toggleHold(id: string) {
  if (locked()) return;
  setState((s) => {
    const holds = { ...s.holds };
    if (holds[id]) delete holds[id];
    else holds[id] = true;
    return { ...s, holds };
  });
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/**
 * Lock in and send to Pay Dispatch (HRIS's "Lock in Values & Send to Payment
 * Dispatch"): 6s to undo, then the run joins the history and each person
 * Validation cleared gets a pending payout, at this run's rate, with their
 * payment method as it stands. `onSent` runs once it has gone (the Inbox note).
 */
export function dispatch(
  { pay, held, skipped }: { pay: Payee[]; held: HeldPayee[]; skipped: number },
  onSent?: (run: PayRun) => void,
) {
  const rate = state.rate;
  if (locked() || rate == null || !pay.length) return;
  const id = `run-${RUN_DATE}-${state.runs.length + 1}`;
  const payouts: Payout[] = pay.map((p) => ({
    id: `${id}:${p.id}`,
    runId: id,
    employeeId: p.id,
    invoiceIds: p.invoices.map((i) => i.id),
    aud: p.aud,
    php: phpFor(p.invoices, rate),
    method: p.method,
    status: "pending",
  }));
  const run: PayRun = {
    id,
    on: RUN_DATE,
    rate,
    by: ACCOUNTANT,
    invoiceIds: payouts.flatMap((p) => p.invoiceIds),
    held,
    skipped,
    payees: pay.length,
    aud: Math.round(pay.reduce((n, p) => n + p.aud, 0) * 100) / 100,
    php: Math.round(payouts.reduce((n, p) => n + p.php, 0) * 100) / 100,
  };
  setState((s) => ({ ...s, dispatching: run }));

  undoable({
    message: `Sending ${plural(pay.length, "person", "people")} to Pay Dispatch`,
    description: `${php(run.php)} at ₱${rate.toFixed(2)} per A$1${held.length ? ` · ${held.length} held` : ""}`,
    commit: () => {
      setState((s) => ({ ...s, dispatching: null, done: run.id, runs: [run, ...s.runs], payouts: [...payouts, ...s.payouts] }));
      onSent?.(run);
    },
    undo: () => setState((s) => ({ ...s, dispatching: null })),
    done: { message: `${php(run.php)} is in Pay Dispatch`, description: `${plural(pay.length, "payment")} to send · values locked in` },
  });
}

/** Close the receipt and start the next run: no rate, nothing held, back to step one. */
export function startNextRun() {
  if (state.dispatching) return;
  setState((s) => ({ ...s, rate: null, step: 0, holds: {}, touched: {}, done: null }));
}

/* ── Pay Dispatch ──────────────────────────────────────────────────────── */

/**
 * Set a payout's invoices paid at its run's rate, or back to approved. The
 * previewed employee's are the Employee portal's, so they're written there.
 */
function settleInvoices(payout: Payout, paidOn: string | null) {
  const run = state.runs.find((r) => r.id === payout.runId);
  if (!run) return;
  if (payout.employeeId === EMPLOYEE_ID) {
    if (paidOn) payInvoices(payout.invoiceIds, paidOn, run.rate);
    else unpayInvoices(payout.invoiceIds, decisionFor("approved")!);
    return;
  }
  const ids = new Set(payout.invoiceIds);
  setState((s) => ({
    ...s,
    invoices: s.invoices.map((i) => {
      if (!ids.has(i.id)) return i;
      if (paidOn) {
        const paid: InvoicePayment = { on: paidOn, rate: run.rate, php: toPhp(invoiceTotals(i.lines).total, run.rate) };
        return { ...i, paid, decision: paidDecision(paid) };
      }
      const next: PayeeInvoice = { ...i, decision: decisionFor("approved") };
      delete next.paid;
      return next;
    }),
  }));
}

function patchPayout(id: string, patch: (p: Payout) => Payout) {
  setState((s) => ({ ...s, payouts: s.payouts.map((p) => (p.id === id ? patch(p) : p)) }));
}

/**
 * Log a payout as sent (HRIS's Mark Paid → Confirm sent): its invoices are
 * Paid from now on, in Accounting and the Employee portal. The toast offers
 * Undo, which sends it back to the queue.
 */
export function markPaid(id: string, sent: Omit<PayoutSent, "by">) {
  const payout = state.payouts.find((p) => p.id === id);
  if (!payout || payout.status === "paid") return;
  patchPayout(id, (p) => {
    const next: Payout = { ...p, status: "paid", sent: { ...sent, by: ACCOUNTANT } };
    delete next.problem;
    return next;
  });
  settleInvoices(payout, sent.on);
  const name = personOf(payout.employeeId).name;
  toast.success(`${name} paid ${php(payout.php)}`, {
    description: `${sent.ref} · from ${sent.from} · their invoice now shows as Paid`,
    action: { label: "Undo", onClick: () => sendBack(id, true) },
  });
}

/** Flag a payout that couldn't go (HRIS's Problem): out of the queue, still unpaid. */
export function flagProblem(id: string, problem: string) {
  const payout = state.payouts.find((p) => p.id === id);
  if (!payout || payout.status === "paid") return;
  patchPayout(id, (p) => ({ ...p, status: "problem", problem }));
  const name = personOf(payout.employeeId).name;
  toast(`${name} flagged as a problem`, {
    description: problem,
    action: { label: "Undo", onClick: () => sendBack(id, true) },
  });
}

/** Back to the queue: a logged payment undone, or a problem sorted. Its invoices are unpaid again. */
export function sendBack(id: string, quiet = false) {
  const payout = state.payouts.find((p) => p.id === id);
  if (!payout || payout.status === "pending") return;
  const wasPaid = payout.status === "paid";
  patchPayout(id, (p) => {
    const next: Payout = { ...p, status: "pending" };
    delete next.sent;
    delete next.problem;
    return next;
  });
  if (wasPaid) settleInvoices(payout, null);
  const name = personOf(payout.employeeId).name;
  if (quiet) toast(`Undone: ${name} is back in the queue`);
  else toast(`${name} is back in the queue`, { description: wasPaid ? "The logged payment is removed and their invoice is unpaid again." : "Ready to send." });
}
