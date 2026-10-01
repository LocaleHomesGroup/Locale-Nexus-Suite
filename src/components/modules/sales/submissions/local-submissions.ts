"use client";

import { useSyncExternalStore } from "react";
import type { SubmissionDoc } from "@/data/jobs";
import type { SubmissionStatus } from "@/state/launchpad-store";

/**
 * Submissions the rep starts from "New deal submission". In the mockup they
 * live in the Sales screen's state, so they survive switching Sales tabs; a
 * tab body here unmounts on every switch, so they live in this tiny module
 * store instead (in memory only — a reload resets them, like the rest of the
 * prototype). Only the Nguyen submission is shared with Ops, via the store.
 */
export interface LocalSubmission {
  id: string;
  client: string;
  builder: string;
  docs: SubmissionDoc[];
  status: SubmissionStatus;
}

const EMPTY: LocalSubmission[] = [];
let current: LocalSubmission[] = EMPTY;
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function updateLocalSubmissions(fn: (prev: LocalSubmission[]) => LocalSubmission[]) {
  current = fn(current);
  listeners.forEach((l) => l());
}

export function useLocalSubmissions(): LocalSubmission[] {
  return useSyncExternalStore(
    subscribe,
    () => current,
    () => EMPTY,
  );
}

/** `setDocs` for one local submission, shaped like a React state setter. */
export function localDocsSetter(id: string): React.Dispatch<React.SetStateAction<SubmissionDoc[]>> {
  return (action) =>
    updateLocalSubmissions((prev) =>
      prev.map((s) => (s.id === id ? { ...s, docs: typeof action === "function" ? action(s.docs) : action } : s)),
    );
}

/** `setStatus` for one local submission. */
export function localStatusSetter(id: string): (status: SubmissionStatus) => void {
  return (status) => updateLocalSubmissions((prev) => prev.map((s) => (s.id === id ? { ...s, status } : s)));
}
