"use client";

import * as React from "react";
import { undoable } from "@/lib/undoable";
import { LEAVE_SEED, type LeaveRequest, type LeaveStatus } from "./data";

/**
 * The leave approval queue, shared by HR › Leave, Home's My day and Jarvis so
 * all three tell the same story after a decision. It lives at module scope
 * (not in HrScreen) so a decision survives leaving HR, and so the undo window
 * keeps running if you navigate away mid-window, as a sent email would. Like
 * the Launchpad store, nothing is persisted: a reload resets to the seed.
 *
 * A decision goes through `undoable()`: the row shows "Approving…" at once,
 * the toast offers Undo, and the status only changes (and Horilla and Xero
 * only hear about it) when the 6s window closes.
 */
export type LeaveDecision = Exclude<LeaveStatus, "Pending">;

export interface LeaveState {
  requests: LeaveRequest[];
  /** Decisions inside their undo window, by request id. Not sent yet. */
  deciding: Record<string, LeaveDecision>;
}

const SEED: LeaveState = { requests: LEAVE_SEED, deciding: {} };

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

/** Approve or decline a request behind a 6s undo window. */
export function decideLeave(req: LeaveRequest, decision: LeaveDecision) {
  if (state.deciding[req.id] || req.status !== "Pending") return;
  setState((s) => ({ ...s, deciding: { ...s.deciding, [req.id]: decision } }));
  const approving = decision === "Approved";
  const cancel = undoable({
    message: `${approving ? "Approving" : "Declining"} ${req.name}'s leave, ${req.when}`,
    description: `${req.type} · ${req.length} · updates Horilla and Xero`,
    commit: () => {
      cancels.delete(req.id);
      setState((s) => ({
        requests: s.requests.map((r) => (r.id === req.id ? { ...r, status: decision } : r)),
        deciding: withoutDeciding(s, req.id),
      }));
    },
    undo: () => {
      cancels.delete(req.id);
      setState((s) => ({ ...s, deciding: withoutDeciding(s, req.id) }));
    },
    done: {
      message: `Leave ${approving ? "approved" : "declined"}: ${req.name}, ${req.when}`,
      description: "Horilla and Xero updated via the live leave workflow",
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
