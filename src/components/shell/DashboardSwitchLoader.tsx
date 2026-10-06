"use client";

import * as React from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";
import { EASE_OUT } from "@/lib/motion";
import type { ModuleId } from "@/state/launchpad-store";
import type { Dashboard } from "./dashboards";
import { TONES } from "./dashboard-tones";

/**
 * The dashboard-switch screen — HRIS's DashboardSwitchLoader (§ 4.1, § 14.6):
 * a shaped skeleton of the shell behind a floating "Switching to <X>" card,
 * themed to the DESTINATION so the switch reads as one continuous move from
 * click to landed view. The emblem pulses inside two expanding rings; a status
 * line cycles; a bar fills toward (never past) 99% until the switch lands.
 *
 * The skeleton is shaped like the destination (`SHAPES`): Home is its own
 * page, and every other dashboard opens on its Overview (two rows of KPI
 * cards); the rail skeleton has the destination's nav rows, at the rail's
 * current (collapsed or expanded) width.
 *
 * Under reduced motion the rings, pulse, dots and sweep stop; the card, the
 * words and the bar (no travel, just its fill) stay — the signal survives.
 */
const STATUS_MESSAGES = ["Loading your workspace", "Syncing HubSpot and Monday", "Fetching the latest figures", "Almost ready"];
const CYCLE_MS = 700;
const TICK_MS = 60;

type Body = "panels" | "overview";
interface Shape {
  /** A wide search field under the heading (Home, Knowledge). */
  search?: boolean;
  /** KPI tiles in a row. */
  kpis?: number;
  body: Body;
}

/** What each dashboard's landing screen looks like, roughly. Keep in step with the screens. */
const OVERVIEW: Shape = { kpis: 4, body: "overview" };
const SHAPES: Record<ModuleId, Shape> = {
  home: { search: true, kpis: 4, body: "panels" },
  operations: OVERVIEW,
  sales: OVERVIEW,
  marketing: OVERVIEW,
  finance: OVERVIEW,
  accounts: OVERVIEW,
  accounting: OVERVIEW,
  wealth: OVERVIEW,
  hr: OVERVIEW,
  knowledge: OVERVIEW,
  leadership: OVERVIEW,
  it: OVERVIEW,
  tickets: OVERVIEW,
  admin: OVERVIEW,
  client: OVERVIEW,
  developer: OVERVIEW,
  employee: OVERVIEW,
};

const KPI_COLS: Record<number, string> = {
  3: "grid-cols-1 sm:grid-cols-3",
  4: "grid-cols-2 lg:grid-cols-4",
};

export function DashboardSwitchLoader({ dashboard, expectedMs = 650 }: { dashboard: Dashboard; expectedMs?: number }) {
  const reduce = useReducedMotion();
  const tone = TONES[dashboard.tone].loader;
  const Icon = dashboard.icon;
  const [index, setIndex] = React.useState(0);
  const [percent, setPercent] = React.useState(8);
  // The rail is on the page underneath: draw its skeleton at the same width.
  // (Client-only: the loader mounts on a click, never in server HTML.)
  const [collapsed] = React.useState(
    () =>
      typeof document !== "undefined" &&
      document.querySelector<HTMLElement>("[data-collapsible-rail]")?.dataset.collapsed === "true" &&
      window.matchMedia("(min-width: 768px)").matches,
  );

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

  const navRows = dashboard.items.length + (dashboard.links?.length ?? 0) + 1;

  return (
    <div
      className="relative h-dvh max-h-dvh w-full overflow-hidden bg-background"
      aria-busy="true"
      aria-live="polite"
      aria-label={`Switching to ${dashboard.title}`}
    >
      {/* Skeleton of the shell behind the card, shaped like the destination. */}
      <div className="absolute inset-0 flex" aria-hidden>
        <RailSkeleton rows={navRows} collapsed={collapsed} />
        <PageSkeleton shape={SHAPES[dashboard.id]} />
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
              className={cn("relative flex size-14 items-center justify-center rounded-2xl", tone.emblem)}
              animate={reduce ? undefined : { scale: [1, 1.06, 1] }}
              transition={{ duration: 1.9, repeat: Infinity, ease: "easeInOut" }}
            >
              <Icon className="size-7" aria-hidden />
            </motion.div>
          </div>

          <div className="mt-5 text-center">
            <p className={cn("text-[10px] font-semibold tracking-[0.18em] uppercase", tone.eyebrow)}>Switching to</p>
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
                className={cn("relative h-full w-full origin-left rounded-full", tone.barFill)}
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

/** The rail: logo, Search, the destination's nav rows, the Switch view card and the pinned footer. */
function RailSkeleton({ rows, collapsed }: { rows: number; collapsed: boolean }) {
  return (
    <aside
      className={cn(
        "hidden shrink-0 flex-col border-r border-border pt-6 pb-4 md:flex",
        collapsed ? "w-16 items-center" : "w-64 px-5",
      )}
    >
      <div className={cn("skeleton-shimmer", collapsed ? "size-9 rounded-full" : "h-16 rounded-lg")} />
      <div className={cn("skeleton-shimmer mt-9 rounded-lg", collapsed ? "size-8" : "h-9")} />
      <div className={cn("mt-4 flex flex-col gap-2", collapsed && "items-center")}>
        {Array.from({ length: rows }, (_, i) => (
          <div
            key={i}
            className={cn("skeleton-shimmer rounded-md", collapsed ? "size-8" : "h-8")}
            style={collapsed ? undefined : { width: `${[78, 64, 86, 70, 58, 82, 66, 74][i % 8]}%` }}
          />
        ))}
      </div>
      <div className={cn("mt-auto flex flex-col gap-1.5", collapsed ? "items-center" : "rounded-md border border-border p-2")}>
        {Array.from({ length: 12 }, (_, i) => (
          <div
            key={i}
            className={cn("skeleton-shimmer rounded", collapsed ? "size-5" : "h-5")}
            style={collapsed ? undefined : { width: `${[52, 70, 44, 66, 58, 48, 62, 40, 56, 68, 46, 36][i]}%` }}
          />
        ))}
      </div>
      <div className={cn("mt-4 flex flex-col gap-2", collapsed && "items-center")}>
        <div className={cn("skeleton-shimmer rounded-md", collapsed ? "size-8" : "h-8 w-1/2")} />
        <div className={cn("skeleton-shimmer", collapsed ? "size-8 rounded-full" : "h-11 rounded-md")} />
      </div>
    </aside>
  );
}

function Panel({ className, children }: { className?: string; children?: React.ReactNode }) {
  return <div className={cn("rounded-xl border border-border bg-card p-5", className)}>{children}</div>;
}

function Lines({ n, className }: { n: number; className?: string }) {
  return (
    <div className={cn("space-y-3", className)}>
      {Array.from({ length: n }, (_, i) => (
        <div key={i} className="skeleton-shimmer h-3 rounded" style={{ width: `${[100, 88, 94, 72, 84, 66][i % 6]}%` }} />
      ))}
    </div>
  );
}

function PageSkeleton({ shape }: { shape: Shape }) {
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-6 px-4 pt-6 sm:px-6 lg:px-8 lg:pt-8">
      <div className="space-y-2">
        <div className="skeleton-shimmer h-7 w-64 max-w-full rounded-md" />
        <div className="skeleton-shimmer h-3.5 w-[28rem] max-w-full rounded-md" />
      </div>

      {shape.search ? <div className="skeleton-shimmer h-11 w-full max-w-2xl rounded-xl" /> : null}

      {shape.kpis ? (
        <div className={cn("grid gap-3", KPI_COLS[shape.kpis] ?? KPI_COLS[4])}>
          {Array.from({ length: shape.kpis }, (_, i) => (
            <Panel key={i} className="flex items-center gap-3 px-4 py-3.5">
              <div className="skeleton-shimmer size-9 rounded-lg" />
              <div className="flex-1 space-y-2">
                <div className="skeleton-shimmer h-2.5 w-20 rounded" />
                <div className="skeleton-shimmer h-6 w-14 rounded" />
              </div>
            </Panel>
          ))}
        </div>
      ) : null}

      {shape.body === "overview" ? (
        // An Overview's second row: a section label, then smaller KPI cards.
        <div className="flex flex-col gap-3">
          <div className="skeleton-shimmer h-2.5 w-40 rounded" />
          <div className={cn("grid gap-3", KPI_COLS[4])}>
            {Array.from({ length: 4 }, (_, i) => (
              <Panel key={i} className="flex items-center gap-3 px-4 py-3">
                <div className="skeleton-shimmer size-8 rounded-lg" />
                <div className="flex-1 space-y-2">
                  <div className="skeleton-shimmer h-2.5 w-16 rounded" />
                  <div className="skeleton-shimmer h-5 w-12 rounded" />
                </div>
              </Panel>
            ))}
          </div>
        </div>
      ) : null}

      {shape.body === "panels" ? (
        <div className="grid gap-5 lg:grid-cols-2">
          {[0, 1].map((i) => (
            <Panel key={i} className="space-y-4">
              <div className="skeleton-shimmer h-4 w-40 rounded" />
              <Lines n={5} />
            </Panel>
          ))}
        </div>
      ) : null}
    </div>
  );
}
