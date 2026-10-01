"use client";

import * as React from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { CountUp } from "./count-up";

/**
 * KpiCard — the Simple HRIS KPI tile (HR Overview anatomy): a gradient icon
 * chip, a tiny-caps label, a large tabular figure, and one muted supporting
 * line. Lay them out in a responsive grid:
 *
 *   <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">…</div>
 *
 * Pass `onClick` to make it a filter tile (the mockup's "Tap to filter" cards):
 * it renders a <button aria-pressed>, shows the hint line, and rims itself when
 * `active`. `alert` turns the figure and rim rose — use it only for something
 * that needs a decision (a sync conflict, an overdue claim), and pair it with
 * `pulse` only when that decision is today's.
 *
 * `value` is pre-formatted text; the numeric part counts up on mount. Pass
 * "—" for a value that was never recorded (absence is not zero, HRIS § 12.5).
 */
export type KpiTone = "haven" | "nectar" | "skyblue" | "charcoal" | "ok" | "pending" | "problem";

const CHIP: Record<KpiTone, string> = {
  haven: "from-haven-400 to-haven-700 shadow-haven-700/20",
  nectar: "from-nectar-400 to-nectar-700 shadow-nectar-700/20",
  skyblue: "from-skyblue-400 to-skyblue-700 shadow-skyblue-700/20",
  charcoal: "from-granite to-charcoal shadow-black/20 dark:from-zinc-500 dark:to-zinc-700",
  ok: "from-emerald-500 to-emerald-700 shadow-emerald-700/20",
  pending: "from-amber-500 to-orange-600 shadow-amber-700/20",
  problem: "from-rose-500 to-red-700 shadow-rose-700/20",
};

export interface KpiCardProps {
  label: string;
  value: string | number;
  sub?: React.ReactNode;
  icon?: LucideIcon;
  tone?: KpiTone;
  /** Makes it a filter tile. */
  onClick?: () => void;
  active?: boolean;
  /** Filter hint shown under the value when clickable and inactive. */
  hint?: string;
  alert?: boolean;
  pulse?: boolean;
  /** `sm` for dense rows of 5+ (text-xl figure, no icon chip below sm). */
  size?: "md" | "sm";
  className?: string;
}

export function KpiCard({
  label,
  value,
  sub,
  icon: Icon,
  tone = "haven",
  onClick,
  active = false,
  hint,
  alert = false,
  pulse = false,
  size = "md",
  className,
}: KpiCardProps) {
  const interactive = typeof onClick === "function";
  const Tag = interactive ? "button" : "div";
  const effectiveTone: KpiTone = alert ? "problem" : tone;

  return (
    <Tag
      type={interactive ? "button" : undefined}
      onClick={onClick}
      aria-pressed={interactive ? active : undefined}
      className={cn(
        // Dark mode: pure black tiles on the charcoal page, as HRIS's KPI row sits
        // black on its dashboards — the figures read as instruments, not cards.
        "group/kpi relative flex min-w-0 items-center gap-3 rounded-xl border bg-card px-4 py-3.5 text-left shadow-sm dark:bg-black dark:shadow-black/40",
        "transition-[transform,box-shadow,border-color,background-color] duration-200 ease-out motion-reduce:transition-none",
        alert ? "border-rose-200 dark:border-rose-500/30" : "border-border dark:border-zinc-800",
        interactive &&
          "cursor-pointer hover:-translate-y-0.5 hover:shadow-md focus-visible:ring-3 focus-visible:ring-ring/45 focus-visible:outline-none",
        interactive && active && !alert && "border-haven-400 bg-haven-50/80 ring-1 ring-haven-300 dark:border-haven-600 dark:bg-haven-950/40 dark:ring-haven-800",
        interactive && active && alert && "border-rose-400 bg-rose-50/80 ring-1 ring-rose-200 dark:border-rose-500/50 dark:bg-rose-950/30 dark:ring-rose-500/20",
        pulse && (alert ? "pulse-rose" : "pulse-haven"),
        className,
      )}
    >
      {Icon ? (
        <span
          className={cn(
            "flex shrink-0 items-center justify-center rounded-lg bg-gradient-to-br text-white shadow",
            size === "sm" ? "hidden size-8 sm:flex" : "size-9",
            CHIP[effectiveTone],
          )}
          aria-hidden
        >
          <Icon className="size-4" />
        </span>
      ) : null}
      <span className="flex min-w-0 flex-col">
        <span
          className={cn(
            "truncate text-[10px] font-semibold tracking-[0.12em] uppercase",
            alert ? "text-rose-700 dark:text-rose-300" : "text-subtle-foreground",
          )}
        >
          {label}
        </span>
        <span
          className={cn(
            "mt-0.5 truncate leading-tight font-bold tabular-nums",
            size === "sm" ? "text-xl" : "text-[28px]",
            alert ? "text-rose-700 dark:text-rose-300" : "text-foreground",
          )}
        >
          <CountUp value={value} />
        </span>
        {interactive ? (
          <span
            className={cn(
              "truncate text-[10.5px]",
              active
                ? alert
                  ? "font-medium text-rose-700 dark:text-rose-300"
                  : "font-medium text-haven-700 dark:text-haven-300"
                : "text-subtle-foreground",
            )}
          >
            {active ? "Showing only these · tap to clear" : (hint ?? "Tap to filter")}
          </span>
        ) : sub ? (
          <span className="truncate text-[11px] text-subtle-foreground">{sub}</span>
        ) : null}
      </span>
    </Tag>
  );
}

/** Responsive grid for a KPI row. `cols` is the count at xl. */
export function KpiGrid({
  cols = 4,
  className,
  children,
}: {
  cols?: 3 | 4 | 5 | 6;
  className?: string;
  children: React.ReactNode;
}) {
  const xl = { 3: "lg:grid-cols-3", 4: "lg:grid-cols-4", 5: "lg:grid-cols-3 xl:grid-cols-5", 6: "lg:grid-cols-3 xl:grid-cols-6" }[cols];
  return <div className={cn("grid grid-cols-1 gap-3 sm:grid-cols-2", xl, className)}>{children}</div>;
}
