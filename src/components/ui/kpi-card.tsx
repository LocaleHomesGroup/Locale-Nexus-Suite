"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowUpRight, type LucideIcon } from "lucide-react";
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
 * `active`. Pass `href` instead to make it a link to the section the figure
 * comes from (every Overview card does): it keeps its `sub` line and shows a
 * small arrow on hover and focus. `alert` turns the figure and rim rose — use it only for something
 * that needs a decision (a sync conflict, an overdue claim). `pulse` only ever
 * fires on an alert, and only a few times: one alarm that arrives, then rests
 * (the rose text keeps saying why).
 *
 * `tone` defaults to the dashboard's own accent; pass a sub-brand only when the
 * figure belongs to that brand, and ok / pending / problem for status.
 *
 * `value` is pre-formatted text; the numeric part counts up on mount. Pass
 * "—" for a value that was never recorded (absence is not zero, HRIS § 12.5).
 */
export type KpiTone = "tone" | "haven" | "nectar" | "skyblue" | "charcoal" | "ok" | "pending" | "problem";

const CHIP: Record<KpiTone, string> = {
  tone: "from-tone-chip-a to-tone-chip-b shadow-black/15",
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
  /** Makes it a link to where the figure comes from (an Overview card). Ignored with `onClick`. */
  href?: string;
  active?: boolean;
  /** Filter hint shown under the value when clickable and inactive. */
  hint?: string;
  alert?: boolean;
  pulse?: boolean;
  /** `sm` for dense rows of 5+ (text-xl figure, no icon chip below sm). */
  size?: "md" | "sm";
  /**
   * Let a long label run to two lines instead of truncating — for labels that
   * are whole phrases ("Completed, no builder date") where a cut-off one would
   * lose its meaning on a phone.
   */
  wrapLabel?: boolean;
  className?: string;
}

export function KpiCard({
  label,
  value,
  sub,
  icon: Icon,
  tone = "tone",
  onClick,
  href,
  active = false,
  hint,
  alert = false,
  pulse = false,
  size = "md",
  wrapLabel = false,
  className,
}: KpiCardProps) {
  const interactive = typeof onClick === "function";
  const linked = !interactive && Boolean(href);
  const effectiveTone: KpiTone = alert ? "problem" : tone;

  const classes = cn(
    // Dark mode: pure black tiles on the charcoal page, as HRIS's KPI row sits
    // black on its dashboards — the figures read as instruments, not cards.
    "group/kpi relative flex min-w-0 items-center gap-3 rounded-xl border bg-card px-4 py-3.5 text-left shadow-sm dark:bg-black dark:shadow-black/40",
    "transition-[transform,box-shadow,border-color,background-color] duration-200 ease-out motion-reduce:transition-none",
    alert ? "border-rose-200 dark:border-rose-500/30" : "border-border dark:border-zinc-800",
    (interactive || linked) &&
      "cursor-pointer hover:-translate-y-0.5 hover:shadow-md focus-visible:ring-3 focus-visible:ring-ring/45 focus-visible:outline-none motion-reduce:hover:translate-y-0",
    interactive && active && !alert && "border-tone-strong bg-tone-soft ring-1 ring-tone-line dark:bg-tone-soft",
    interactive && active && alert && "border-rose-400 bg-rose-50/80 ring-1 ring-rose-200 dark:border-rose-500/50 dark:bg-rose-950/30 dark:ring-rose-500/20",
    pulse && alert && "pulse-rose",
    className,
  );

  const body = (
    <>
      {Icon ? (
        <span
          className={cn(
            "flex shrink-0 items-center justify-center rounded-lg bg-gradient-to-br text-white shadow",
            // Phones run KPIs two-up, so the chip gives its width to the figure.
            size === "sm" ? "hidden size-8 sm:flex" : "hidden size-9 sm:flex",
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
            "text-[10px] font-semibold tracking-[0.12em] uppercase",
            wrapLabel ? "line-clamp-2 leading-snug" : "truncate",
            alert ? "text-rose-700 dark:text-rose-300" : "text-subtle-foreground",
          )}
        >
          {label}
        </span>
        <span
          className={cn(
            "mt-0.5 truncate leading-tight font-bold tabular-nums",
            size === "sm" ? "text-xl" : "text-2xl sm:text-[28px]",
            alert ? "text-rose-700 dark:text-rose-300" : "text-foreground",
          )}
        >
          <CountUp value={value} />
        </span>
        {interactive ? (
          <span
            className={cn(
              "truncate text-xs",
              active
                ? alert
                  ? "font-medium text-rose-700 dark:text-rose-300"
                  : "font-medium text-tone-ink"
                : "text-subtle-foreground",
            )}
          >
            {active ? "Showing only these · tap to clear" : (hint ?? "Tap to filter")}
          </span>
        ) : sub ? (
          <span className="truncate text-xs text-subtle-foreground">{sub}</span>
        ) : null}
      </span>
    </>
  );

  if (linked && href) {
    return (
      <Link href={href} className={classes}>
        {body}
        {/* Says "this goes somewhere" on hover and focus, without taking a line from the figure. */}
        <ArrowUpRight
          className="absolute top-2.5 right-2.5 size-3.5 text-tone-ink opacity-0 transition-opacity duration-200 group-hover/kpi:opacity-100 group-focus-visible/kpi:opacity-100 motion-reduce:transition-none"
          aria-hidden
        />
      </Link>
    );
  }

  const Tag = interactive ? "button" : "div";
  return (
    <Tag
      type={interactive ? "button" : undefined}
      onClick={onClick}
      aria-pressed={interactive ? active : undefined}
      className={classes}
    >
      {body}
    </Tag>
  );
}

/** Responsive grid for a KPI row. `cols` is the count at xl. */
export function KpiGrid({
  cols = 4,
  className,
  children,
}: {
  cols?: 2 | 3 | 4 | 5 | 6;
  className?: string;
  children: React.ReactNode;
}) {
  // Four-up waits for xl: at lg the open rail leaves ~190px a tile, which cuts
  // labels ("NEEDS YOU TOD…"). Two-up until there's room for the full label.
  const xl = { 2: "", 3: "lg:grid-cols-3", 4: "xl:grid-cols-4", 5: "lg:grid-cols-3 xl:grid-cols-5", 6: "lg:grid-cols-3 xl:grid-cols-6" }[cols];
  // Two-up from the smallest phone: four figures in one glance, not a scroll.
  return <div className={cn("grid grid-cols-2 gap-3", xl, className)}>{children}</div>;
}
