"use client";

import * as React from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";
import { EASE_OUT } from "@/lib/motion";
import type { Dashboard } from "./dashboards";
import { TONES } from "./dashboard-tones";

/**
 * The dashboard-switch screen — HRIS's DashboardSwitchLoader (§ 4.1, § 14.6):
 * a shaped skeleton of the shell behind a floating "Switching to <X>" card,
 * themed to the DESTINATION so the switch reads as one continuous move from
 * click to landed view. The emblem pulses inside two expanding rings; a status
 * line cycles; a bar fills toward (never past) 99% until the switch lands.
 *
 * Under reduced motion the rings, pulse, dots and sweep stop; the card, the
 * words and the bar (no travel, just its fill) stay — the signal survives.
 */
const STATUS_MESSAGES = ["Loading your workspace", "Syncing HubSpot and Monday", "Fetching the latest figures", "Almost ready"];
const NAV_ROWS = [72, 88, 64, 80, 70, 84, 60];
const CYCLE_MS = 700;
const TICK_MS = 60;

export function DashboardSwitchLoader({ dashboard, expectedMs = 650 }: { dashboard: Dashboard; expectedMs?: number }) {
  const reduce = useReducedMotion();
  const tone = TONES[dashboard.tone].loader;
  const Icon = dashboard.icon;
  const [index, setIndex] = React.useState(0);
  const [percent, setPercent] = React.useState(8);

  React.useEffect(() => {
    const id = setInterval(() => setIndex((i) => (i + 1) % STATUS_MESSAGES.length), CYCLE_MS);
    return () => clearInterval(id);
  }, []);

  React.useEffect(() => {
    let elapsed = 0;
    const id = setInterval(() => {
      elapsed += TICK_MS;
      setPercent(Math.min(99, 8 + (elapsed / expectedMs) * 91));
    }, TICK_MS);
    return () => clearInterval(id);
  }, [expectedMs]);

  return (
    <div
      className="relative h-dvh max-h-dvh w-full overflow-hidden bg-background"
      aria-busy="true"
      aria-live="polite"
      aria-label={`Switching to ${dashboard.title}`}
    >
      {/* Skeleton of the shell behind the card */}
      <div className="absolute inset-0 flex" aria-hidden>
        <aside className="hidden w-64 shrink-0 flex-col gap-2 border-r border-border p-5 md:flex">
          <div className="skeleton-shimmer mb-5 h-14 rounded-lg" />
          {NAV_ROWS.map((w, i) => (
            <div key={i} className="skeleton-shimmer h-8 rounded-md" style={{ width: `${w}%` }} />
          ))}
        </aside>
        <div className="flex min-w-0 flex-1 flex-col gap-5 p-8">
          <div className="skeleton-shimmer h-7 w-64 rounded-md" />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="skeleton-shimmer h-24 rounded-xl" />
            ))}
          </div>
          <div className="skeleton-shimmer h-72 rounded-xl" />
        </div>
      </div>

      <div className="absolute inset-0 bg-background/40 backdrop-blur-[2px]" aria-hidden />

      <div className="absolute inset-0 flex items-center justify-center px-6">
        <motion.div
          initial={{ opacity: 0, y: 14, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: reduce ? 0 : 0.4, ease: EASE_OUT }}
          className={cn("w-full max-w-sm rounded-2xl border p-8 backdrop-blur-xl", tone.card)}
        >
          <div className="relative mx-auto flex size-16 items-center justify-center">
            {reduce
              ? null
              : [0, 1].map((r) => (
                  <motion.span
                    key={r}
                    aria-hidden
                    className={cn("absolute inset-0 rounded-2xl border", tone.ring)}
                    initial={{ scale: 0.7, opacity: 0.7 }}
                    animate={{ scale: 1.9, opacity: 0 }}
                    transition={{ duration: 1.9, repeat: Infinity, ease: "easeOut", delay: r * 0.95 }}
                  />
                ))}
            <motion.div
              className={cn("relative flex size-14 items-center justify-center rounded-2xl bg-gradient-to-br shadow-lg", tone.emblem)}
              animate={reduce ? undefined : { scale: [1, 1.06, 1] }}
              transition={{ duration: 1.9, repeat: Infinity, ease: "easeInOut" }}
            >
              <Icon className="size-7" aria-hidden />
            </motion.div>
          </div>

          <div className="mt-5 text-center">
            <p className={cn("text-[11px] font-semibold tracking-[0.18em] uppercase", tone.eyebrow)}>Switching to</p>
            <h2 className="mt-1 font-heading text-xl font-bold text-foreground">{dashboard.title}</h2>
          </div>

          <div className="relative mt-3 flex h-6 items-center justify-center overflow-hidden">
            <AnimatePresence mode="wait" initial={false}>
              <motion.p
                key={index}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: reduce ? 0 : 0.3, ease: "easeOut" }}
                className={cn("flex items-center gap-2 text-sm font-medium", tone.status)}
              >
                <span className="inline-flex gap-0.5" aria-hidden>
                  {[0, 1, 2].map((d) => (
                    <motion.span
                      key={d}
                      className={cn("size-1 rounded-full", tone.dot)}
                      animate={reduce ? undefined : { opacity: [0.3, 1, 0.3] }}
                      transition={{ duration: 0.9, repeat: Infinity, ease: "easeInOut", delay: d * 0.15 }}
                    />
                  ))}
                </span>
                {STATUS_MESSAGES[index]}
              </motion.p>
            </AnimatePresence>
          </div>

          <div className="mt-6">
            <div className={cn("h-1.5 w-full overflow-hidden rounded-full", tone.barTrack)}>
              <motion.div
                className={cn("relative h-full w-full origin-left rounded-full bg-gradient-to-r", tone.barFill)}
                initial={{ scaleX: 0.08 }}
                animate={{ scaleX: percent / 100 }}
                transition={{ duration: reduce ? 0 : TICK_MS / 1000, ease: "linear" }}
              >
                {reduce ? null : (
                  <motion.span
                    aria-hidden
                    className="absolute inset-0 bg-gradient-to-r from-transparent via-white/50 to-transparent"
                    animate={{ x: ["-100%", "180%"] }}
                    transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
                  />
                )}
              </motion.div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
