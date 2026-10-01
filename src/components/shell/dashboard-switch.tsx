"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { dashboardForPath, type Dashboard } from "./dashboards";
import { useNavState } from "./nav-state";
import { DashboardSwitchLoader } from "./DashboardSwitchLoader";

/**
 * The command palette's way into another dashboard. It mirrors the rail's
 * "Switch view" card (ViewSwitcher.tsx) exactly: the same loader, the same
 * 650 ms hold and 0.28 s fade, so a switch looks and behaves the same
 * whichever started it. Keep the two in step.
 *
 * Crossing into another dashboard paints the switch loader (HRIS § 4.1) THIS
 * frame and navigates on the next, so the loader is the single continuous
 * surface from click to landed view, themed to the destination. Our routes are
 * static and land fast, so the loader holds for a short minimum rather than
 * flashing, then fades. A move inside the dashboard you are in (a section, a
 * job, the shared inbox) is a plain navigation with no loader.
 */
/** Same as ViewSwitcher. */
export const MIN_SWITCH_MS = 650;
const EXIT_S = 0.28;
/** If a navigation never lands (offline, a thrown route), stop covering the app. */
const GIVE_UP_MS = 10_000;

interface SwitchApi {
  /** Go to `href`, painting the switch loader when it crosses into another dashboard. */
  navigate: (href: string) => void;
  /** Warm the router cache for `href` (hover / focus on a destination). */
  prefetch: (href: string) => void;
  /** The dashboard being switched to, while the loader is up. */
  pending: Dashboard | null;
}

const Ctx = React.createContext<SwitchApi | null>(null);

export function DashboardSwitchProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { dashboardId } = useNavState();
  const reduce = useReducedMotion();
  const [target, setTarget] = React.useState<Dashboard | null>(null);
  // Portal only after mount, so server and first client render agree.
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);
  const startedAt = React.useRef(0);

  // Latest values for the stable callbacks below.
  const live = React.useRef({ target, dashboardId });
  live.current = { target, dashboardId };

  // Close the loader once the destination has rendered and the minimum hold
  // has passed: the new rail and page are already painted underneath.
  React.useEffect(() => {
    if (!target) return;
    const landed = dashboardForPath(pathname)?.id === target.id;
    const wait = landed ? Math.max(0, MIN_SWITCH_MS - (performance.now() - startedAt.current)) : GIVE_UP_MS;
    const t = setTimeout(() => setTarget(null), reduce && landed ? 0 : wait);
    return () => clearTimeout(t);
  }, [pathname, target, reduce]);

  const prefetch = React.useCallback(
    (href: string) => {
      try {
        router.prefetch(href);
      } catch {
        /* best effort */
      }
    },
    [router],
  );

  const navigate = React.useCallback(
    (href: string) => {
      if (live.current.target) return;
      const path = href.split(/[?#]/)[0] || "/";
      const dest = dashboardForPath(path);
      // Same rail (a section, a job, the inbox): no loader. The root owns the
      // viewport, so scroll the content area ourselves.
      if (!dest || dest.id === live.current.dashboardId) {
        router.push(href, { scroll: false });
        document.getElementById("launchpad-scroll")?.scrollTo({ top: 0 });
        return;
      }
      startedAt.current = performance.now();
      setTarget(dest);
      requestAnimationFrame(() => router.push(href, { scroll: false }));
    },
    [router],
  );

  const api = React.useMemo<SwitchApi>(() => ({ navigate, prefetch, pending: target }), [navigate, prefetch, target]);

  return (
    <Ctx.Provider value={api}>
      {children}
      {/* Portaled to <body> so the rail's transform can't trap the fixed overlay. */}
      {mounted
        ? createPortal(
            <AnimatePresence>
              {target ? (
                <motion.div
                  key="switch"
                  className="fixed inset-0 z-[100]"
                  initial={{ opacity: 1 }}
                  exit={{ opacity: 0, transition: { duration: reduce ? 0 : EXIT_S } }}
                >
                  <DashboardSwitchLoader dashboard={target} expectedMs={MIN_SWITCH_MS} />
                </motion.div>
              ) : null}
            </AnimatePresence>,
            document.body,
          )
        : null}
    </Ctx.Provider>
  );
}

export function useDashboardSwitch(): SwitchApi {
  const v = React.useContext(Ctx);
  if (!v) throw new Error("useDashboardSwitch must be used inside <DashboardSwitchProvider>");
  return v;
}
