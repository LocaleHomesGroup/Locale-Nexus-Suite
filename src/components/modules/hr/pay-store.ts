"use client";

import * as React from "react";
import { undoable } from "@/lib/undoable";
import { aud } from "@/lib/utils";
import { ORG_SEED, formatIsoDate, masterList, seedPayRate, type PayRate } from "./data";

/**
 * Pay rates: what each person earns an hour, ordinary time and overtime, in
 * AUD. Seeded from the last rate review, edited from the Global Master List.
 * Module scope like the org chart, so an edit survives a section switch and
 * its undo window keeps running if you navigate away. Nothing is persisted: a
 * reload resets to the seed.
 *
 * A change effective today applies at once and goes through `undoable()`, so
 * Horilla only hears about it when the 6s window closes. A later effective
 * date books the change instead; Horilla applies it on the day.
 */
export interface PayState {
  /** The rate in force now, by person id. */
  rates: Record<string, PayRate>;
  /** A change booked for a later date, by person id. */
  scheduled: Record<string, PayRate>;
  /** Rates changed inside their undo window. Not in Horilla yet. */
  pending: Record<string, true>;
  /** One-off payments filed from the master list, newest first. */
  payments: OneOffPayment[];
}

export type PaymentKind = "Bonus" | "Commission" | "Overtime" | "Reimbursement" | "Back pay" | "Other";

/** A one-off payment request. Payroll sends it; nothing moves from the Launchpad. */
export interface OneOffPayment {
  id: string;
  personId: string;
  kind: PaymentKind;
  /** AUD. */
  amount: number;
  /** Overtime paid by the hour: the hours and the rate used. */
  hours?: number;
  rate?: number;
  note?: string;
  /** Pay date (ISO). */
  payOn: string;
  /** "filing" inside the undo window, "requested" once payroll has it. */
  status: "filing" | "requested";
}

function seed(): Record<string, PayRate> {
  const rates: Record<string, PayRate> = {};
  for (const row of masterList(ORG_SEED)) {
    const rate = seedPayRate(row);
    if (rate) rates[row.id] = rate;
  }
  return rates;
}

const SEED: PayState = { rates: seed(), scheduled: {}, pending: {}, payments: [] };

let state: PayState = SEED;
const listeners = new Set<() => void>();

function setState(next: (s: PayState) => PayState) {
  state = next(state);
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function without<T>(map: Record<string, T>, id: string): Record<string, T> {
  const rest = { ...map };
  delete rest[id];
  return rest;
}

/** The live rates. The server (and hydration) always sees the seed. */
export function usePay(): PayState {
  return React.useSyncExternalStore(
    subscribe,
    () => state,
    () => SEED,
  );
}

/** "$57.00". */
export const money = (n: number) => aud(n, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** How overtime relates to the hourly rate: "time and a half", "double time" or "1.75×". */
export function overtimeBasis(rate: Pick<PayRate, "hourly" | "overtime">): string {
  const ratio = rate.overtime / rate.hourly;
  if (Math.abs(ratio - 1.5) < 0.005) return "time and a half";
  if (Math.abs(ratio - 2) < 0.005) return "double time";
  return `${ratio.toFixed(2)}×`;
}

function describe(before: PayRate | undefined, next: Pick<PayRate, "hourly" | "overtime">) {
  const part = (label: string, from: number | undefined, to: number) =>
    from == null || from === to ? `${label} ${money(to)}` : `${label} ${money(from)} → ${money(to)}`;
  return `${part("hourly", before?.hourly, next.hourly)} · ${part("overtime", before?.overtime, next.overtime)}`;
}

/**
 * Set someone's hourly and overtime rates from an effective date. Today (or
 * earlier) applies now with 6s to undo; a later date books the change.
 */
export function changeRates(
  id: string,
  name: string,
  next: Pick<PayRate, "hourly" | "overtime">,
  effective: string,
  todayIso: string,
) {
  if (state.pending[id]) return;
  const before = state.rates[id];
  const rate: PayRate = { ...next, effective };

  if (effective > todayIso) {
    const booked = state.scheduled[id];
    setState((s) => ({ ...s, scheduled: { ...s.scheduled, [id]: rate } }));
    undoable({
      message: `Booking ${name}'s new pay rates`,
      description: `${describe(before, next)} · from ${formatIsoDate(effective)} · Horilla applies it on the day`,
      commit: () => {},
      undo: () =>
        setState((s) => ({ ...s, scheduled: booked ? { ...s.scheduled, [id]: booked } : without(s.scheduled, id) })),
      done: { message: `${name}'s rates change on ${formatIsoDate(effective)}`, description: "Booked in Horilla" },
    });
    return;
  }

  setState((s) => ({ ...s, rates: { ...s.rates, [id]: rate }, pending: { ...s.pending, [id]: true } }));
  undoable({
    message: `Updating ${name}'s pay rates`,
    description: `${describe(before, next)} · effective today · updates Horilla`,
    commit: () => setState((s) => ({ ...s, pending: without(s.pending, id) })),
    undo: () =>
      setState((s) => ({
        ...s,
        rates: before ? { ...s.rates, [id]: before } : without(s.rates, id),
        pending: without(s.pending, id),
      })),
    done: { message: `${name}'s pay rates updated`, description: "Horilla updated · effective today" },
  });
}

/** Call off a booked rate change. */
export function cancelRateChange(id: string, name: string) {
  const booked = state.scheduled[id];
  if (!booked) return;
  setState((s) => ({ ...s, scheduled: without(s.scheduled, id) }));
  undoable({
    message: `Cancelling ${name}'s booked rate change`,
    description: `Was ${money(booked.hourly)}/hr from ${formatIsoDate(booked.effective)} · updates Horilla`,
    commit: () => {},
    undo: () => setState((s) => ({ ...s, scheduled: { ...s.scheduled, [id]: booked } })),
    done: { message: `${name}'s rates stay as they are`, description: "The booked change is off in Horilla" },
  });
}

/**
 * File a one-off payment for payroll to send on the pay date, as HRIS's Pay
 * does: 6s to undo, then it's with payroll. No money moves from here.
 */
export function requestPayment(name: string, payment: Omit<OneOffPayment, "id" | "status">) {
  const id = `pay-${Date.now().toString(36)}`;
  setState((s) => ({ ...s, payments: [{ ...payment, id, status: "filing" }, ...s.payments] }));
  const what = payment.hours
    ? `${payment.hours} overtime ${payment.hours === 1 ? "hour" : "hours"} at ${money(payment.rate ?? 0)}`
    : payment.kind.toLowerCase();
  undoable({
    message: `Paying ${name} ${money(payment.amount)}`,
    description: [what, payment.note, `pay on ${formatIsoDate(payment.payOn)}`, "payroll sends it"].filter(Boolean).join(" · "),
    commit: () =>
      setState((s) => ({ ...s, payments: s.payments.map((p) => (p.id === id ? { ...p, status: "requested" } : p)) })),
    undo: () => setState((s) => ({ ...s, payments: s.payments.filter((p) => p.id !== id) })),
    done: { message: `${money(payment.amount)} for ${name} is with payroll`, description: `Paid on ${formatIsoDate(payment.payOn)}` },
  });
}
