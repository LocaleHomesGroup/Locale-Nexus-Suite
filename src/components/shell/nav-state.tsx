"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { dashboardForPath } from "./dashboards";

/**
 * Rail state shared between the shell and the modules:
 *
 * - **Badges.** A module publishes a count for one of its nav items
 *   (`useNavBadge("hr:leave", { count: 2, tone: "pending" })`) and the rail
 *   draws it — the HRIS nav-row badge, relocated to a corner dot while the rail
 *   is collapsed. The badge clears when the module unmounts.
 * - **Reselect.** Clicking the item that is already showing doesn't navigate;
 *   it fires a reselect a module can listen for to reset itself (Sales clears
 *   the open submission, Doc formatter returns to a fresh New job).
 * - **Current dashboard.** Shared pages like /notifications keep the rail of
 *   the dashboard you came from, as each HRIS dashboard keeps its own inbox.
 */
export type NavBadgeTone = "neutral" | "pending" | "problem";
export interface NavBadge {
  count: number;
  tone?: NavBadgeTone;
  /** Screen-reader suffix, e.g. "awaiting approval". */
  label?: string;
}

interface NavState {
  badges: Record<string, NavBadge>;
  setBadge: (key: string, badge: NavBadge | null) => void;
  reselect: { key: string; n: number };
  fireReselect: (key: string) => void;
  /** The dashboard whose rail is showing. */
  dashboardId: string;
}

const Ctx = React.createContext<NavState | null>(null);
const LAST_KEY = "launchpad:last-dashboard";

export function NavProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [badges, setBadges] = React.useState<Record<string, NavBadge>>({});
  const [reselect, setReselect] = React.useState({ key: "", n: 0 });
  const [last, setLast] = React.useState("home");

  React.useEffect(() => {
    try {
      const stored = sessionStorage.getItem(LAST_KEY);
      if (stored) setLast(stored);
    } catch {
      /* storage unavailable */
    }
  }, []);

  const own = dashboardForPath(pathname);
  React.useEffect(() => {
    if (!own) return;
    setLast(own.id);
    try {
      sessionStorage.setItem(LAST_KEY, own.id);
    } catch {
      /* storage unavailable */
    }
  }, [own]);

  const setBadge = React.useCallback((key: string, badge: NavBadge | null) => {
    setBadges((prev) => {
      const cur = prev[key];
      if (!badge || badge.count <= 0) {
        if (!cur) return prev;
        const next = { ...prev };
        delete next[key];
        return next;
      }
      if (cur && cur.count === badge.count && cur.tone === badge.tone && cur.label === badge.label) return prev;
      return { ...prev, [key]: badge };
    });
  }, []);

  const fireReselect = React.useCallback((key: string) => setReselect((r) => ({ key, n: r.n + 1 })), []);

  const value = React.useMemo<NavState>(
    () => ({ badges, setBadge, reselect, fireReselect, dashboardId: own?.id ?? last }),
    [badges, setBadge, reselect, fireReselect, own, last],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useNavState(): NavState {
  const v = React.useContext(Ctx);
  if (!v) throw new Error("useNavState must be used inside <NavProvider>");
  return v;
}

/** Publish a count for a nav item. Pass null (or count 0) to clear it. */
export function useNavBadge(key: string, badge: NavBadge | null) {
  const { setBadge } = useNavState();
  const count = badge?.count ?? 0;
  const tone = badge?.tone;
  const label = badge?.label;
  React.useEffect(() => {
    setBadge(key, count > 0 ? { count, tone, label } : null);
  }, [key, count, tone, label, setBadge]);
  React.useEffect(() => () => setBadge(key, null), [key, setBadge]);
}

/**
 * Run `onReselect` when the user re-clicks an item that is already showing.
 * `match` is an item key or a prefix ending in ":" ("sales:" = any Sales item).
 */
export function useNavReselect(match: string, onReselect: (key: string) => void) {
  const { reselect } = useNavState();
  const cb = React.useRef(onReselect);
  cb.current = onReselect;
  const seen = React.useRef(reselect.n);
  React.useEffect(() => {
    if (reselect.n === seen.current) return;
    seen.current = reselect.n;
    const hit = match.endsWith(":") ? reselect.key.startsWith(match) : reselect.key === match;
    if (hit) cb.current(reselect.key);
  }, [reselect, match]);
}
