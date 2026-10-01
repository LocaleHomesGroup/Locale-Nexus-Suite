"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowLeftRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { DASHBOARDS, dashboardForPath, type Dashboard } from "./dashboards";
import { TONES } from "./dashboard-tones";
import { DashboardSwitchLoader } from "./DashboardSwitchLoader";

/**
 * "Switch view" — HRIS's ViewSwitcher (§ 4.1), listing every Launchpad
 * dashboard. It sits inside the rail's scroll area (never pinned in the
 * footer) so a short viewport can still reach it. Collapsed, the card sheds
 * its chrome (`.vs-collapse-box`) and only the view icons remain, lined up with
 * the nav icons above.
 *
 * The click paints the switch loader THIS frame and navigates on the next one,
 * so the loader is the single continuous surface from click to landed view
 * (HRIS deliberately does not wrap this in a View Transition). Our routes are
 * static and land fast, so the loader holds for a short minimum rather than
 * flashing. Hover and focus prefetch the target.
 *
 * No RBAC yet: everyone sees every dashboard.
 */
const MIN_SWITCH_MS = 650;

export function ViewSwitcher({
  current,
  collapsed,
  onSwitch,
}: {
  current: Dashboard;
  collapsed: boolean;
  /** Called as a switch starts (the shell closes the mobile drawer). */
  onSwitch?: () => void;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const reduce = useReducedMotion();
  const [target, setTarget] = React.useState<Dashboard | null>(null);
  // Portal only after mount, so server and first client render agree.
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);
  const startedAt = React.useRef(0);
  const tone = TONES[current.tone];

  // Close the loader once the destination has rendered and the minimum hold
  // has passed — the new rail and page are already painted underneath.
  React.useEffect(() => {
    if (!target) return;
    const landed = dashboardForPath(pathname)?.id === target.id;
    if (!landed) return;
    const wait = Math.max(0, MIN_SWITCH_MS - (performance.now() - startedAt.current));
    const t = setTimeout(() => setTarget(null), reduce ? 0 : wait);
    return () => clearTimeout(t);
  }, [pathname, target, reduce]);

  const prefetch = (d: Dashboard) => {
    if (d.id === current.id) return;
    try {
      router.prefetch(d.href);
    } catch {
      /* best effort */
    }
  };

  const switchTo = (d: Dashboard) => {
    if (d.id === current.id || target) return;
    startedAt.current = performance.now();
    setTarget(d);
    onSwitch?.();
    requestAnimationFrame(() => router.push(d.href));
  };

  return (
    <>
      <div className={cn("vs-collapse-box mb-3 rounded-md border p-2", tone.softCard)}>
        <div className="sb-collapse-fade mb-1.5 flex items-center gap-1.5 px-1 text-[10px] font-semibold tracking-wider text-zinc-500 uppercase dark:text-zinc-400">
          <ArrowLeftRight className="size-3" aria-hidden />
          Switch view
        </div>
        <nav aria-label="Switch dashboard" className="vs-collapse-nudge grid gap-0.5">
          {DASHBOARDS.map((d) => {
            const Icon = d.icon;
            const active = d.id === current.id;
            const pending = target?.id === d.id;
            return (
              <button
                key={d.id}
                type="button"
                onClick={() => switchTo(d)}
                onPointerEnter={() => prefetch(d)}
                onFocus={() => prefetch(d)}
                disabled={Boolean(target)}
                aria-current={active ? "page" : undefined}
                title={collapsed ? d.label : undefined}
                className={cn(
                  "group relative flex items-center gap-2 overflow-hidden rounded px-2 py-1.5 text-left text-xs font-medium",
                  "transition-[color,background-color,transform,opacity] duration-200 ease-out motion-reduce:transition-none",
                  active
                    ? tone.switcherActive
                    : "text-zinc-600 hover:translate-x-0.5 hover:bg-white/70 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-white/[0.05] dark:hover:text-zinc-100",
                  pending && "scale-[0.98]",
                  target && !pending && "opacity-40",
                )}
              >
                <Icon
                  aria-hidden
                  className={cn(
                    "relative z-10 size-3.5 shrink-0",
                    TONES[d.tone].switcherIcon,
                    pending && "animate-pulse motion-reduce:animate-none",
                  )}
                />
                <span className="sb-collapse-fade relative z-10 truncate">{d.label}</span>
                {pending ? (
                  <span
                    aria-hidden
                    className="viewswitch-shimmer absolute inset-y-0 left-0 w-full bg-gradient-to-r from-white/0 via-white/60 to-white/0 motion-reduce:hidden dark:via-white/15"
                  />
                ) : null}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Portaled to <body> so the rail's transform can't trap the fixed overlay. */}
      {mounted
        ? createPortal(
            <AnimatePresence>
              {target ? (
                <motion.div
                  key="switch"
                  className="fixed inset-0 z-[100]"
                  initial={{ opacity: 1 }}
                  exit={{ opacity: 0, transition: { duration: reduce ? 0 : 0.28 } }}
                >
                  <DashboardSwitchLoader dashboard={target} expectedMs={MIN_SWITCH_MS} />
                </motion.div>
              ) : null}
            </AnimatePresence>,
            document.body,
          )
        : null}
    </>
  );
}
