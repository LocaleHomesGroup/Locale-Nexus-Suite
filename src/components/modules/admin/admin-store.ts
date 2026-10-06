"use client";

import * as React from "react";
import { undoable } from "@/lib/undoable";
import { confirm } from "@/state/launchpad-store";
import {
  ACCESS_LABEL,
  PRESENCE_SEED,
  ROLE_BY_KEY,
  SEED_ACCESS,
  SEED_GRANTS,
  SEED_OFF_ROSTER,
  byRailOrder,
  isOffRosterKey,
  pageOf,
  plural,
  provisioned,
  seededLastSeen,
  type Access,
  type AccessMap,
  type GrantMap,
  type LiveState,
  type Principal,
  type RoleKey,
} from "./data";

/**
 * Admin's live state: who holds which role, each grant's section access, the
 * off-roster accounts, and who has been signed out. Module scope, like HR's org
 * chart, so a change survives a section switch and its undo window keeps
 * running if you navigate away. Nothing is persisted: a reload resets to the
 * sample seed.
 *
 * Assign and Revoke wait out an undo window, because revoking signs the person
 * out. An assignment shows at once (its grid can be narrowed straight away); a
 * revoke keeps the role until the window closes. A section's access level
 * applies at once, as in HRIS.
 */
export type RoleChange = "assigning" | "revoking";

export interface AdminState {
  grants: GrantMap;
  access: AccessMap;
  /** Addresses that aren't on the master list, lower-case. */
  offRoster: string[];
  /** Role changes inside their undo window, keyed `who|role`. */
  changing: Record<string, RoleChange>;
  /** When each person was signed out (ms), by key. Shown as offline from then on. */
  signedOut: Record<string, number>;
  /** Sign-outs inside their undo window. */
  signingOut: Record<string, true>;
}

const SEED: AdminState = {
  grants: SEED_GRANTS,
  access: SEED_ACCESS,
  offRoster: SEED_OFF_ROSTER,
  changing: {},
  signedOut: {},
  signingOut: {},
};

let state: AdminState = SEED;
const listeners = new Set<() => void>();

function setState(next: (s: AdminState) => AdminState) {
  state = next(state);
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** The live admin state. The server (and hydration) always sees the seed. */
export function useAdmin(): AdminState {
  return React.useSyncExternalStore(
    subscribe,
    () => state,
    () => SEED,
  );
}

export const changeKey = (who: string, role: RoleKey) => `${who}|${role}`;

const without = <T,>(rec: Record<string, T>, key: string) => {
  const next = { ...rec };
  delete next[key];
  return next;
};

/* ── Presence ──────────────────────────────────────────────────────────── */

export interface Live {
  state: LiveState;
  /** The rail key they have open, while online or inactive. */
  at: string | null;
  /** Minutes since they were last in, while offline. Null: never signed in. */
  lastSeen: number | null;
}

/** Someone's live state: the sample seed, unless an admin has signed them out since. */
export function liveOf(p: Principal, s: AdminState, now: number): Live {
  const out = s.signedOut[p.key];
  if (out != null) return { state: "offline", at: null, lastSeen: Math.max(0, Math.floor((now - out) / 60_000)) };
  const seed = PRESENCE_SEED[p.key];
  if (seed) return { state: seed.inactive ? "inactive" : "online", at: seed.at, lastSeen: null };
  // Someone without a record, or an address just added, has never signed in.
  if (!p.email || (isOffRosterKey(p.key) && !SEED_OFF_ROSTER.includes(p.email))) {
    return { state: "offline", at: null, lastSeen: null };
  }
  return { state: "offline", at: null, lastSeen: seededLastSeen(p.key) };
}

const isOnline = (key: string) => PRESENCE_SEED[key] != null && state.signedOut[key] == null;

/* ── Roles ─────────────────────────────────────────────────────────────── */

/** Grant a role: on at once, Edit on every section, 6s to undo. */
export function grantRole(p: Principal, role: RoleKey) {
  const key = changeKey(p.key, role);
  if (!p.email || state.changing[key] || state.grants[p.key]?.includes(role)) return;
  const r = ROLE_BY_KEY[role];
  const sections = r.sections.length;

  setState((s) => ({
    ...s,
    grants: { ...s.grants, [p.key]: byRailOrder([...(s.grants[p.key] ?? []), role]) },
    access: role === "admin" ? s.access : { ...s.access, [p.key]: { ...s.access[p.key], [role]: provisioned(role) } },
    changing: { ...s.changing, [key]: "assigning" },
  }));
  undoable({
    message: `Granting ${r.label} to ${p.name}`,
    description:
      role === "admin"
        ? "Unlocks every dashboard, this one included"
        : `Adds the ${r.dashboard.title} to their Switch view · Edit on ${plural(sections, "section")}`,
    commit: () => setState((s) => ({ ...s, changing: without(s.changing, key) })),
    undo: () =>
      setState((s) => {
        const perRole = { ...s.access[p.key] };
        delete perRole[role];
        return {
          ...s,
          grants: { ...s.grants, [p.key]: (s.grants[p.key] ?? []).filter((x) => x !== role) },
          access: { ...s.access, [p.key]: perRole },
          changing: without(s.changing, key),
        };
      }),
    done: { message: `Granted ${r.label}`, description: `${p.name} · ${r.dashboard.title}` },
  });
}

/** Revoke a role: held until the 6s window closes, then gone, and they're signed out so it takes effect. */
export function revokeRole(p: Principal, role: RoleKey) {
  const key = changeKey(p.key, role);
  if (state.changing[key] || !state.grants[p.key]?.includes(role)) return;
  const r = ROLE_BY_KEY[role];
  const online = isOnline(p.key);

  setState((s) => ({ ...s, changing: { ...s.changing, [key]: "revoking" } }));
  undoable({
    message: `Revoking ${r.label} from ${p.name}`,
    description: [
      role === "admin" ? "Takes away full access" : `Removes the ${r.dashboard.title} from their Switch view`,
      online ? "signs them out so it takes effect" : null,
    ]
      .filter(Boolean)
      .join(" · "),
    commit: () =>
      setState((s) => {
        const perRole = { ...s.access[p.key] };
        delete perRole[role];
        return {
          ...s,
          grants: { ...s.grants, [p.key]: (s.grants[p.key] ?? []).filter((x) => x !== role) },
          access: { ...s.access, [p.key]: perRole },
          changing: without(s.changing, key),
          signedOut: online ? { ...s.signedOut, [p.key]: Date.now() } : s.signedOut,
        };
      }),
    undo: () => setState((s) => ({ ...s, changing: without(s.changing, key) })),
    done: {
      message: `Revoked ${r.label}`,
      description: online ? `${p.name} was signed out` : p.name,
    },
  });
}

/* ── Section access ────────────────────────────────────────────────────── */

export function setSectionAccess(p: Principal, role: RoleKey, section: string, access: Access) {
  const current = state.access[p.key]?.[role];
  if (!current || current[section] === access) return;
  setState((s) => ({
    ...s,
    access: { ...s.access, [p.key]: { ...s.access[p.key], [role]: { ...current, [section]: access } } },
  }));
  const label = pageOf(section).section;
  confirm(access === "hidden" ? `Hid ${label}` : `${ACCESS_LABEL[access]} access on ${label}`, `${p.name} · ${ROLE_BY_KEY[role].dashboard.title}`);
}

/** Set every section of one dashboard at once: HRIS's bulk "All: Edit", "All: View", "Hide all". */
export function setAllSectionAccess(p: Principal, role: RoleKey, access: Access) {
  if (!state.access[p.key]?.[role]) return;
  const r = ROLE_BY_KEY[role];
  setState((s) => ({
    ...s,
    access: {
      ...s.access,
      [p.key]: { ...s.access[p.key], [role]: Object.fromEntries(r.sections.map((x) => [x.key, access])) },
    },
  }));
  confirm(
    access === "hidden" ? `Hid every ${r.label} section` : `${ACCESS_LABEL[access]} on every ${r.label} section`,
    `${p.name} · ${plural(r.sections.length, "section")}`,
  );
}

/* ── Off-roster accounts ───────────────────────────────────────────────── */

/** Add an address that isn't on the master list, so it can be granted roles. */
export function addOffRoster(email: string) {
  const address = email.trim().toLowerCase();
  if (state.offRoster.includes(address)) return;
  setState((s) => ({ ...s, offRoster: [...s.offRoster, address] }));
}

/* ── Sessions ──────────────────────────────────────────────────────────── */

/**
 * End someone's session (HRIS's force logout / reset session), 6s to undo.
 * They sign in again with their current access. Someone already offline stays
 * as they were; there's just no session left to pick up.
 */
export function signOut(p: Principal) {
  if (state.signingOut[p.key]) return;
  const online = isOnline(p.key);
  setState((s) => ({ ...s, signingOut: { ...s.signingOut, [p.key]: true } }));
  undoable({
    message: `Signing ${p.name} out of the Launchpad`,
    description: online ? "Ends their session now · they sign in again with their current access" : "Clears any saved session",
    commit: () =>
      setState((s) => ({
        ...s,
        signingOut: without(s.signingOut, p.key),
        signedOut: online ? { ...s.signedOut, [p.key]: Date.now() } : s.signedOut,
      })),
    undo: () => setState((s) => ({ ...s, signingOut: without(s.signingOut, p.key) })),
    done: { message: `${p.name} signed out`, description: "Their next sign-in picks up their current roles" },
  });
}
