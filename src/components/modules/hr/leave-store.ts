"use client";

import * as React from "react";
import { undoable } from "@/lib/undoable";
import { LEAVE_SEED, type LeaveRequest, type LeaveStatus } from "./data";

/**
 * The leave queue, shared by HR › Leave, Employee › Leave, Home's My day and
 * Jarvis so all of them tell the same story after a decision. It lives at
 * module scope (not in a screen) so a decision survives leaving it, and so
 * the undo window keeps running if you navigate away mid-window, as a sent
 * email would. Like the Launchpad store, nothing is persisted: a reload
 * resets to the seed.
 *
 * Filing and deciding both go through `undoable()`. A filed request waits in
 * `filing` (yours to see as Sending…, nobody else's yet) until the 6s window
 * closes, then joins the queue and its approver hears about it. A decision
 * shows "Approving…" on the row at once, and the status only changes (and
 * Horilla and Xero only hear about it) when the window closes.
 */
export type LeaveDecision = Extract<LeaveStatus, "Approved" | "Declined">;

export interface LeaveState {
  requests: LeaveRequest[];
  /** Requests filed inside their undo window. Not sent yet, so not in `requests`. */
  filing: LeaveRequest[];
  /** Decisions inside their undo window, by request id. Not sent yet. */
  deciding: Record<string, LeaveDecision>;
  /**
   * Requests filed in the Employee portal that have been decided since their
   * requester last looked: the portal's "you've heard back" (it has no inbox).
   */
  unseen: string[];
}

const SEED: LeaveState = { requests: LEAVE_SEED, filing: [], deciding: {}, unseen: [] };

let state: LeaveState = SEED;
const listeners = new Set<() => void>();
const cancels = new Map<string, () => void>();

function setState(next: (s: LeaveState) => LeaveState) {
  state = next(state);
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function withoutDeciding(s: LeaveState, id: string): Record<string, LeaveDecision> {
  const rest = { ...s.deciding };
  delete rest[id];
  return rest;
}

/** The live queue. The server (and hydration) always sees the seed. */
export function useLeave(): LeaveState {
  return React.useSyncExternalStore(
    subscribe,
    () => state,
    () => SEED,
  );
}

/** The queue as it stands, outside React. */
export const leaveSnapshot = () => state;

/** File a request with its approver behind a 6s undo window. `onFiled` runs once it has gone. */
export function fileLeave(req: LeaveRequest, onFiled?: () => void) {
  setState((s) => ({ ...s, filing: [req, ...s.filing] }));
  const to = req.approver ?? "your manager";
  undoable({
    message: `Sending your ${req.type.toLowerCase()} request to ${to}`,
    description: `${req.when} · ${req.length}`,
    commit: () => {
      setState((s) => ({ ...s, filing: s.filing.filter((r) => r.id !== req.id), requests: [req, ...s.requests] }));
      onFiled?.();
    },
    undo: () => setState((s) => ({ ...s, filing: s.filing.filter((r) => r.id !== req.id) })),
    done: { message: `Leave request sent to ${to}`, description: `${req.type} · ${req.when} · they've been notified` },
  });
}

export interface DecideOptions {
  /** Who decided, as the requester will see it: "Jerry Delos Santos", "HR". */
  by?: string;
  /** ISO date of the decision. */
  on?: string;
  /** Runs once the decision has gone. */
  onDecided?: () => void;
}

/** Approve or decline a request behind a 6s undo window. */
export function decideLeave(req: LeaveRequest, decision: LeaveDecision, { by, on, onDecided }: DecideOptions = {}) {
  if (state.deciding[req.id] || req.status !== "Pending") return;
  setState((s) => ({ ...s, deciding: { ...s.deciding, [req.id]: decision } }));
  const approving = decision === "Approved";
  const cancel = undoable({
    message: `${approving ? "Approving" : "Declining"} ${req.name}'s leave, ${req.when}`,
    description: `${req.type} · ${req.length} · updates Horilla and Xero`,
    commit: () => {
      cancels.delete(req.id);
      setState((s) => ({
        ...s,
        requests: s.requests.map((r) =>
          r.id === req.id
            ? { ...r, status: decision, ...(by ? { decidedBy: by } : {}), ...(on ? { decidedOn: on } : {}) }
            : r,
        ),
        deciding: withoutDeciding(s, req.id),
        unseen: req.seatId ? [...s.unseen, req.id] : s.unseen,
      }));
      onDecided?.();
    },
    undo: () => {
      cancels.delete(req.id);
      setState((s) => ({ ...s, deciding: withoutDeciding(s, req.id) }));
    },
    done: {
      message: `Leave ${approving ? "approved" : "declined"}: ${req.name}, ${req.when}`,
      description: `${req.name.split(" ")[0]} has been notified · Horilla and Xero updated`,
    },
  });
  cancels.set(req.id, cancel);
}

/** The row's own Undo: drops the decision (and its toast) before anything is sent. */
export function undoLeave(id: string) {
  const cancel = cancels.get(id);
  if (!cancel) return;
  cancel();
  cancels.delete(id);
  setState((s) => ({ ...s, deciding: withoutDeciding(s, id) }));
}

/** The requester has seen these decisions (they opened My requests). */
export function markLeaveSeen(ids: string[]) {
  if (!ids.some((id) => state.unseen.includes(id))) return;
  setState((s) => ({ ...s, unseen: s.unseen.filter((id) => !ids.includes(id)) }));
}

/**
 * Withdraw your own pending request. Returns it as cancelled, or null when it
 * can't be: it's been decided, or its approver is deciding it right now.
 */
export function cancelLeave(id: string): LeaveRequest | null {
  const req = state.requests.find((r) => r.id === id);
  if (!req || req.status !== "Pending" || state.deciding[id]) return null;
  const cancelled: LeaveRequest = { ...req, status: "Cancelled" };
  setState((s) => ({ ...s, requests: s.requests.map((r) => (r.id === id ? cancelled : r)) }));
  return cancelled;
}
