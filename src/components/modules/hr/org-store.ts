"use client";

import * as React from "react";
import { undoable } from "@/lib/undoable";
import {
  ORG_DEPARTMENTS,
  ORG_SEED,
  formatIsoDate,
  orgDepartment,
  orgDepartmentOf,
  orgSlug,
  transitionIdOf,
  type OrgBrand,
  type OrgDepartmentId,
  type OrgPerson,
  type RecordEdit,
} from "./data";

/**
 * The live org chart: the seed plus seats added, filled or moved in the
 * Launchpad. Module scope, like the leave queue, so a change survives a section
 * switch and its undo window keeps running if you navigate away. Nothing is
 * persisted: a reload resets to the seed.
 *
 * Every write goes through `undoable()`: the chart and the master list change
 * at once, marked as pending, and Horilla only hears about it when the 6s
 * window closes.
 */
export type PendingKind = "adding" | "moving";

/** A department move booked for a later date. Horilla applies it on the day. */
export interface ScheduledTransfer {
  to: OrgDepartmentId;
  /** Effective date (ISO). */
  effective: string;
}

export interface OrgState {
  people: OrgPerson[];
  /** Seats added, filled or moved inside their undo window, by id. Not in Horilla yet. */
  pending: Record<string, PendingKind>;
  /** Moves booked for a later date, by person id. */
  scheduled: Record<string, ScheduledTransfer>;
  /** Records edited inside their undo window, by person id. Not in Horilla yet. */
  saving: Record<string, true>;
}

const SEED: OrgState = { people: ORG_SEED, pending: {}, scheduled: {}, saving: {} };

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

function settled(s: OrgState, ...ids: (string | null)[]): Record<string, PendingKind> {
  const rest = { ...s.pending };
  for (const id of ids) if (id) delete rest[id];
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
  setState((s) => ({ ...s, people: [...s.people, seat], pending: { ...s.pending, [id]: "adding" } }));
  undoable({
    message: `Adding ${input.name} to ${dept}`,
    description: `${input.role} · under ${manager?.name ?? manager?.role ?? "their manager"} · updates Horilla`,
    commit: () => setState((s) => ({ ...s, pending: settled(s, id) })),
    undo: () => setState((s) => ({ ...s, people: s.people.filter((p) => p.id !== id), pending: settled(s, id) })),
    done: { message: `${input.name} added to ${dept}`, description: "Horilla's org chart updated" },
  });
  return id;
}

/** Name the person taking a vacant seat; its reports stay under it. */
export function fillSeat(id: string, name: string, isNew: boolean) {
  const seat = state.people.find((p) => p.id === id);
  if (!seat || seat.name || state.pending[id]) return;
  setState((s) => ({
    ...s,
    people: s.people.map((p) => (p.id === id ? { ...p, name, ...(isNew ? { isNew: true } : {}) } : p)),
    pending: { ...s.pending, [id]: "adding" },
  }));
  undoable({
    message: `Naming ${name} ${seat.role}`,
    description: `Fills the vacant seat · updates Horilla`,
    commit: () => setState((s) => ({ ...s, pending: settled(s, id) })),
    undo: () =>
      setState((s) => ({
        ...s,
        people: s.people.map((p) => (p.id === id ? { ...p, name: null, isNew: seat.isNew } : p)),
        pending: settled(s, id),
      })),
    done: { message: `${name} is now ${seat.role}`, description: "Horilla's org chart updated" },
  });
}

/* ── Department transfers ──────────────────────────────────────────────── */

/** Departments someone can be moved into: everything but Leadership, which is set on the chart. */
export const TRANSFER_DEPARTMENTS = ORG_DEPARTMENTS.filter((d) => d.id !== "leadership");

/**
 * Why this person can't be moved from the master list, or null if they can.
 * A department is defined by its head, so heads, the managing director and the
 * board stay put; someone mid-handover moves once the handover is done.
 */
export function transferBlock(people: OrgPerson[], pending: OrgState["pending"], id: string): string | null {
  const seat = people.find((p) => p.id === id);
  if (!seat?.name) return "They're taking a seat over. Move them once the handover is done.";
  if (!seat.managerId) return "The managing director heads the group, so they don't sit in a department.";
  if (seat.link === "peer") return "A board seat sits outside the departments.";
  const heads = ORG_DEPARTMENTS.find((d) => d.headId === id);
  if (heads) return `${seat.name} heads ${heads.name}. Change a department's head on the org chart.`;
  if (pending[id]) return "Their last change is still on its way to Horilla. Try again in a few seconds.";
  return null;
}

/**
 * Move a seat under another department's head. Their reports don't follow: a
 * manager leaves a vacant seat behind with the team under it (and anyone taking
 * that seat over), so the old department keeps its shape.
 */
function moveSeat(people: OrgPerson[], id: string, to: OrgDepartmentId) {
  const seat = people.find((p) => p.id === id)!;
  const hasReports = people.some((p) => p.managerId === id);
  const vacancy: OrgPerson | null = hasReports
    ? {
        id: `${id}-seat-${Date.now().toString(36)}`,
        name: null,
        role: seat.role,
        managerId: seat.managerId,
        ...(seat.link ? { link: seat.link } : {}),
        ...(seat.team ? { team: seat.team } : {}),
        ...(seat.brands ? { brands: seat.brands } : {}),
        ...(seat.transition ? { transition: seat.transition } : {}),
        ...(seat.transitionId ? { transitionId: seat.transitionId } : {}),
        ...(seat.transitionEdits ? { transitionEdits: seat.transitionEdits } : {}),
      }
    : null;
  // A team block and a dotted line belong to the old manager; a handover belongs to the seat.
  const moved: OrgPerson = {
    id,
    name: seat.name,
    role: seat.role,
    managerId: orgDepartment(to).headId,
    ...(seat.brands ? { brands: seat.brands } : {}),
    ...(seat.note ? { note: seat.note } : {}),
    ...(seat.isNew ? { isNew: true } : {}),
    ...(seat.edits ? { edits: seat.edits } : {}),
  };
  const next = people.flatMap((p) => {
    if (p.id === id) return vacancy ? [vacancy, moved] : [moved];
    if (vacancy && p.managerId === id) return [{ ...p, managerId: vacancy.id }];
    return [p];
  });
  const undo = (current: OrgPerson[]) =>
    current
      .filter((p) => p.id !== vacancy?.id)
      .map((p) => (p.id === id ? seat : vacancy && p.managerId === vacancy.id ? { ...p, managerId: id } : p));
  return { next, undo, vacancyId: vacancy?.id ?? null, reports: people.filter((p) => p.managerId === id).length };
}

/** Move someone to another department today: one click, 6s to undo, then Horilla. */
export function transferNow(id: string, to: OrgDepartmentId) {
  if (transferBlock(state.people, state.pending, id)) return;
  const seat = state.people.find((p) => p.id === id)!;
  const from = orgDepartmentOf(state.people, id);
  if (from === to) return;
  const dept = orgDepartment(to);
  const head = state.people.find((p) => p.id === dept.headId);
  const booked = state.scheduled[id];
  const { next, undo, vacancyId, reports } = moveSeat(state.people, id, to);

  setState((s) => {
    const scheduled = { ...s.scheduled };
    delete scheduled[id];
    return {
      ...s,
      people: next,
      pending: { ...s.pending, [id]: "moving", ...(vacancyId ? { [vacancyId]: "moving" as const } : {}) },
      scheduled,
    };
  });
  undoable({
    message: `Moving ${seat.name} to ${dept.name}`,
    description: [
      `${orgDepartment(from).name} → ${dept.name}`,
      `reports to ${head?.name ?? dept.name}`,
      reports ? `their ${reports} ${reports === 1 ? "report stays" : "reports stay"} under a vacant ${seat.role} seat` : null,
      "effective today · updates Horilla",
    ]
      .filter(Boolean)
      .join(" · "),
    commit: () => setState((s) => ({ ...s, pending: settled(s, id, vacancyId) })),
    undo: () =>
      setState((s) => ({
        ...s,
        people: undo(s.people),
        pending: settled(s, id, vacancyId),
        scheduled: booked ? { ...s.scheduled, [id]: booked } : s.scheduled,
      })),
    done: { message: `${seat.name} moved to ${dept.name}`, description: "Horilla updated · effective today" },
  });
}

/** Book a move for a later effective date. It shows as booked until Horilla applies it on the day. */
export function scheduleTransfer(id: string, to: OrgDepartmentId, effective: string) {
  if (transferBlock(state.people, state.pending, id)) return;
  const seat = state.people.find((p) => p.id === id)!;
  const dept = orgDepartment(to);
  const before = state.scheduled[id];
  setState((s) => ({ ...s, scheduled: { ...s.scheduled, [id]: { to, effective } } }));
  undoable({
    message: `Booking ${seat.name}'s move to ${dept.name}`,
    description: `Effective ${formatIsoDate(effective)} · Horilla applies it on the day`,
    commit: () => {},
    undo: () =>
      setState((s) => {
        const scheduled = { ...s.scheduled };
        if (before) scheduled[id] = before;
        else delete scheduled[id];
        return { ...s, scheduled };
      }),
    done: {
      message: `${seat.name} moves to ${dept.name} on ${formatIsoDate(effective)}`,
      description: "Booked in Horilla",
    },
  });
}

/** Call off a booked move. */
export function cancelTransfer(id: string) {
  const booked = state.scheduled[id];
  const seat = state.people.find((p) => p.id === id);
  if (!booked || !seat) return;
  const dept = orgDepartment(booked.to).name;
  setState((s) => {
    const scheduled = { ...s.scheduled };
    delete scheduled[id];
    return { ...s, scheduled };
  });
  undoable({
    message: `Cancelling ${seat.name}'s move to ${dept}`,
    description: `Was effective ${formatIsoDate(booked.effective)} · updates Horilla`,
    commit: () => {},
    undo: () => setState((s) => ({ ...s, scheduled: { ...s.scheduled, [id]: booked } })),
    done: { message: `${seat.name} stays put`, description: `The move to ${dept} is off in Horilla` },
  });
}

/* ── Record edits ──────────────────────────────────────────────────────── */

export interface ProfileChange {
  name?: string;
  role?: string;
  edits?: RecordEdit;
}

/** The seat that holds someone's record: their own, or the one they're taking over. */
function holderOf(people: OrgPerson[], id: string) {
  const own = people.find((p) => p.id === id && p.name);
  if (own) return { seat: own, handover: false };
  const taken = people.find((p) => transitionIdOf(p) === id);
  return taken ? { seat: taken, handover: true } : null;
}

/**
 * Edit someone's record from the master list: name and position live on their
 * seat, so the org chart follows; the rest rides on the seat as edits over
 * Horilla's record. 6s to undo, then Horilla. `summary` names what changed.
 * Someone taking a seat over keeps the seat's position, so only their name and
 * record change.
 */
export function updateProfile(id: string, change: ProfileChange, summary: string) {
  if (state.saving[id]) return;
  const holder = holderOf(state.people, id);
  if (!holder) return;
  const { seat, handover } = holder;
  const oldName = (handover ? seat.transition : seat.name) ?? "";
  const updated: OrgPerson = handover
    ? {
        ...seat,
        ...(change.name ? { transition: change.name, transitionId: id } : {}),
        ...(change.edits ? { transitionEdits: { ...seat.transitionEdits, ...change.edits } } : {}),
      }
    : {
        ...seat,
        ...(change.name ? { name: change.name } : {}),
        ...(change.role ? { role: change.role } : {}),
        ...(change.edits ? { edits: { ...seat.edits, ...change.edits } } : {}),
      };
  // Undo puts back only what this edit touched, so a move made meanwhile survives it.
  const restore = (p: OrgPerson): OrgPerson =>
    handover
      ? { ...p, transition: seat.transition, transitionId: seat.transitionId, transitionEdits: seat.transitionEdits }
      : { ...p, name: seat.name, role: seat.role, edits: seat.edits };
  const done = (s: OrgState) => {
    const saving = { ...s.saving };
    delete saving[id];
    return saving;
  };

  setState((s) => ({
    ...s,
    people: s.people.map((p) => (p.id === seat.id ? { ...p, ...updated, managerId: p.managerId } : p)),
    saving: { ...s.saving, [id]: true },
  }));
  undoable({
    message: `Updating ${oldName}'s record`,
    description: `${summary} · updates Horilla`,
    commit: () => setState((s) => ({ ...s, saving: done(s) })),
    undo: () => setState((s) => ({ ...s, people: s.people.map((p) => (p.id === seat.id ? restore(p) : p)), saving: done(s) })),
    done: { message: `${change.name ?? oldName}'s record updated`, description: "Horilla's master list updated" },
  });
}
