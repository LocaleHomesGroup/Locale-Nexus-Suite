"use client";

import * as React from "react";
import { undoable } from "@/lib/undoable";
import {
  BILL_TO,
  SEED_INVOICES,
  SEED_SENDER,
  invoiceTotals,
  money,
  paidDecision,
  type InvoicePayment,
  type InvoiceStatus,
  type PaymentMethod,
  type SenderDetails,
  type StaffInvoice,
} from "./data";
import { toPhp } from "@/components/modules/accounting/fx";

/**
 * The Employee portal's invoices and the details that prefill them, shared by
 * the Overview, New invoice, History, Profile and Jarvis. Module scope, like
 * HR's leave queue, so a sent invoice survives a section switch and its undo
 * window keeps running if you navigate away. Nothing is persisted: a reload
 * resets to the seed.
 *
 * Sending goes through `undoable()`: the invoice shows in History at once as
 * Sending…, the toast offers Undo, and Accounts only receives it when the 6s
 * window closes. HRIS sends straight away; the Launchpad holds every write
 * that leaves it.
 */
export interface InvoiceState {
  invoices: StaffInvoice[];
  /** Invoices inside their undo window, by id. Accounts hasn't got them yet. */
  sending: Record<string, true>;
  sender: SenderDetails;
  payment: PaymentMethod | null;
}

const SEED: InvoiceState = { invoices: SEED_INVOICES, sending: {}, sender: SEED_SENDER, payment: null };

let state: InvoiceState = SEED;
const listeners = new Set<() => void>();

function setState(next: (s: InvoiceState) => InvoiceState) {
  state = next(state);
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function settled(s: InvoiceState, id: string): Record<string, true> {
  const rest = { ...s.sending };
  delete rest[id];
  return rest;
}

/** The live invoices. The server (and hydration) always sees the seed. */
export function useInvoices(): InvoiceState {
  return React.useSyncExternalStore(
    subscribe,
    () => state,
    () => SEED,
  );
}

/** Send an invoice to Accounts behind the undo window. `onSent` runs once it has gone. */
export function sendInvoice(invoice: StaffInvoice, onSent?: () => void) {
  const { total } = invoiceTotals(invoice.lines);
  setState((s) => ({ ...s, invoices: [...s.invoices, invoice], sending: { ...s.sending, [invoice.id]: true } }));
  undoable({
    message: `Sending ${invoice.number} to ${BILL_TO.company}`,
    description: `${money(total)} · Accounts reviews it`,
    commit: () => {
      setState((s) => ({ ...s, sending: settled(s, invoice.id) }));
      onSent?.();
    },
    undo: () =>
      setState((s) => ({ ...s, invoices: s.invoices.filter((i) => i.id !== invoice.id), sending: settled(s, invoice.id) })),
    done: { message: `${invoice.number} sent to Accounts`, description: "Pending review · it's in your history" },
  });
}

/** Withdraw a pending invoice from Accounts. Its week is free to invoice again. */
export function retractInvoice(id: string) {
  setState((s) => ({ ...s, invoices: s.invoices.filter((i) => i.id !== id || i.status !== "pending") }));
}

/**
 * Accounting's verdict from the pay run's Invoices step: approve, reject, or
 * reset to pending. A paid invoice is settled and never changes.
 */
export function decideInvoices(ids: string[], status: InvoiceStatus, decision?: string) {
  const set = new Set(ids);
  setState((s) => ({
    ...s,
    invoices: s.invoices.map((i) => {
      if (!set.has(i.id) || i.paid) return i;
      const next: StaffInvoice = { ...i, status };
      if (decision) next.decision = decision;
      else delete next.decision;
      return next;
    }),
  }));
}

/** Accounting logged these approved invoices as paid on `on`, at a run's rate (pesos per A$1). */
export function payInvoices(ids: string[], on: string, rate: number) {
  const set = new Set(ids);
  setState((s) => ({
    ...s,
    invoices: s.invoices.map((i) => {
      if (!set.has(i.id) || i.status !== "approved" || i.paid) return i;
      const paid: InvoicePayment = { on, rate, php: toPhp(invoiceTotals(i.lines).total, rate) };
      return { ...i, paid, decision: paidDecision(paid) };
    }),
  }));
}

/** A payment sent back in Pay Dispatch: the invoices are approved again, not paid. */
export function unpayInvoices(ids: string[], decision: string) {
  const set = new Set(ids);
  setState((s) => ({
    ...s,
    invoices: s.invoices.map((i) => {
      if (!set.has(i.id) || !i.paid) return i;
      const next: StaffInvoice = { ...i, decision };
      delete next.paid;
      return next;
    }),
  }));
}

export function saveSender(sender: SenderDetails) {
  setState((s) => ({ ...s, sender }));
}

export function savePayment(payment: PaymentMethod | null) {
  setState((s) => ({ ...s, payment }));
}
