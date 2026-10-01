"use client";

import * as React from "react";
import { undoable } from "@/lib/undoable";
import { ORG_SEED, orgDepartment, orgDepartmentOf, orgSlug, type OrgBrand, type OrgPerson } from "./data";

/**
 * The live org chart: the seed plus seats added or filled in the Launchpad.
 * Module scope, like the leave queue, so an addition survives a section switch
 * and its undo window keeps running if you navigate away. Nothing is
 * persisted: a reload resets to the seed.
 *
 * Adding someone or filling a vacant seat goes through `undoable()`: the seat
 * appears at once, marked as adding, and Horilla only hears about it when the
 * 6s window closes.
 */
export interface OrgState {
  people: OrgPerson[];
  /** Seats added or filled inside their undo window, by id. Not in Horilla yet. */
  pending: Record<string, true>;
}

const SEED: OrgState = { people: ORG_SEED, pending: {} };

let state: OrgState = SEED;
const listeners = new Set<() => void>();

function setState(next: (s: OrgState) => OrgState) {
  state = next(state);
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function settled(s: OrgState, id: string): Record<string, true> {
  const rest = { ...s.pending };
  delete rest[id];
  return rest;
}

/** The live chart. The server (and hydration) always sees the seed. */
export function useOrg(): OrgState {
  return React.useSyncExternalStore(
    subscribe,
    () => state,
    () => SEED,
  );
}

export interface NewSeat {
  name: string;
  role: string;
  managerId: string;
  team?: string;
  brands?: OrgBrand[];
  isNew: boolean;
}

/** Add someone under a manager. Returns the new seat's id. */
export function addPerson(input: NewSeat): string {
  const id = `${orgSlug(input.name)}-${Date.now().toString(36)}`;
  const manager = state.people.find((p) => p.id === input.managerId);
  const dept = orgDepartment(orgDepartmentOf(state.people, input.managerId)).name;
  const seat: OrgPerson = {
    id,
    name: input.name,
    role: input.role,
    managerId: input.managerId,
    ...(input.team ? { team: input.team } : {}),
    ...(input.brands?.length ? { brands: input.brands } : {}),
    ...(input.isNew ? { isNew: true } : {}),
  };
  setState((s) => ({ people: [...s.people, seat], pending: { ...s.pending, [id]: true } }));
  undoable({
    message: `Adding ${input.name} to ${dept}`,
    description: `${input.role} · under ${manager?.name ?? manager?.role ?? "their manager"} · updates Horilla`,
    commit: () => setState((s) => ({ ...s, pending: settled(s, id) })),
    undo: () => setState((s) => ({ people: s.people.filter((p) => p.id !== id), pending: settled(s, id) })),
    done: { message: `${input.name} added to ${dept}`, description: "Horilla's org chart updated" },
  });
  return id;
}

/** Name the person taking a vacant seat; its reports stay under it. */
export function fillSeat(id: string, name: string, isNew: boolean) {
  const seat = state.people.find((p) => p.id === id);
  if (!seat || seat.name || state.pending[id]) return;
  setState((s) => ({
    people: s.people.map((p) => (p.id === id ? { ...p, name, ...(isNew ? { isNew: true } : {}) } : p)),
    pending: { ...s.pending, [id]: true },
  }));
  undoable({
    message: `Naming ${name} ${seat.role}`,
    description: `Fills the vacant seat · updates Horilla`,
    commit: () => setState((s) => ({ ...s, pending: settled(s, id) })),
    undo: () =>
      setState((s) => ({
        people: s.people.map((p) => (p.id === id ? { ...p, name: null, isNew: seat.isNew } : p)),
        pending: settled(s, id),
      })),
    done: { message: `${name} is now ${seat.role}`, description: "Horilla's org chart updated" },
  });
}
