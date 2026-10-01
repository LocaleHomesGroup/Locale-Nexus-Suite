"use client";

import * as React from "react";
import { motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";
import { DURATION, EASE_SWAP } from "@/lib/motion";

/**
 * Bars animate TRANSFORM, never layout (HRIS performance-ui rule 4): a child
 * scales inside a fixed-size track, so nothing around it reflows.
 */
/**
 * `tone` (the default) is the dashboard's own accent; `neutral` is the quiet
 * second series (spend beside deals, partial beside complete). Named sub-brand tones are
 * for data that belongs to that brand (Wealth's book on a Leadership chart);
 * ok / pending / problem carry status. Fills are flat — a gradient adds no
 * information to a bar.
 */
export type BarTone = "tone" | "neutral" | "haven" | "nectar" | "skyblue" | "charcoal" | "ok" | "pending" | "problem";

const FILL: Record<BarTone, string> = {
  tone: "bg-tone-strong",
  neutral: "bg-zinc-300 dark:bg-zinc-600",
  haven: "bg-haven-500 dark:bg-haven-400",
  nectar: "bg-nectar-500 dark:bg-nectar-400",
  skyblue: "bg-skyblue-500 dark:bg-skyblue-400",
  charcoal: "bg-charcoal dark:bg-silver",
  ok: "bg-emerald-500 dark:bg-emerald-400",
  pending: "bg-amber-400",
  problem: "bg-rose-500 dark:bg-rose-400",
};

const COLUMN: Record<BarTone, string> = {
  tone: "bg-tone-strong",
  neutral: "bg-zinc-300 dark:bg-zinc-600",
  haven: "bg-haven-500 dark:bg-haven-400",
  nectar: "bg-nectar-500 dark:bg-nectar-400",
  skyblue: "bg-skyblue-500 dark:bg-skyblue-400",
  charcoal: "bg-charcoal dark:bg-zinc-300",
  ok: "bg-emerald-500",
  pending: "bg-amber-400",
  problem: "bg-rose-500",
};

/**
 * RateBar — a horizontal fill from 0 to `value` (0–1). `null` = unmeasurable:
 * the track renders hatched, which is deliberately different from a 0% bar.
 */
export function RateBar({
  value,
  tone = "tone",
  height = "h-1.5",
  delay = 0,
  className,
  label,
}: {
  value: number | null;
  tone?: BarTone;
  height?: string;
  delay?: number;
  className?: string;
  /** Accessible label, e.g. "62% of target". */
  label?: string;
}) {
  const reduce = useReducedMotion();
  const v = value == null ? 0 : Math.max(0, Math.min(1, value));
  return (
    <div
      role={label ? "img" : undefined}
      aria-label={label}
      className={cn(
        "relative w-full overflow-hidden rounded-full bg-muted",
        value == null &&
          "bg-[repeating-linear-gradient(45deg,transparent_0_4px,rgb(115_115_115/0.18)_4px_6px)]",
        height,
        className,
      )}
    >
      {value != null ? (
        <motion.div
          className={cn("absolute inset-y-0 left-0 w-full origin-left rounded-full", FILL[tone])}
          initial={{ scaleX: 0 }}
          animate={{ scaleX: v }}
          transition={{ duration: reduce ? 0 : DURATION.fill, ease: EASE_SWAP, delay: reduce ? 0 : delay }}
        />
      ) : null}
    </div>
  );
}

/**
 * ColumnBars — a small vertical bar chart. Each column grows from the baseline.
 * `null` values render as a 1px stub (a missing week is not a zero, § 12.5).
 * Always pair it with the numbers somewhere readable (a label row or a table).
 */
export function ColumnBars({
  data,
  tone = "tone",
  height = 120,
  highlightLast = false,
  className,
  formatValue = (n) => String(n),
  showValues = false,
}: {
  data: { label: string; value: number | null; tone?: BarTone }[];
  tone?: BarTone;
  height?: number;
  highlightLast?: boolean;
  className?: string;
  formatValue?: (n: number) => string;
  showValues?: boolean;
}) {
  const reduce = useReducedMotion();
  const max = Math.max(1, ...data.map((d) => d.value ?? 0));
  return (
    <div className={cn("w-full", className)}>
      <div className="flex items-end gap-1.5" style={{ height }}>
        {data.map((d, i) => {
          const h = d.value == null ? 0 : d.value / max;
          const last = i === data.length - 1;
          return (
            <div key={d.label + i} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1">
              {showValues && d.value != null ? (
                <span className="text-[10px] font-medium text-muted-foreground tabular-nums">{formatValue(d.value)}</span>
              ) : null}
              {d.value == null ? (
                <div className="h-px w-full bg-border" title={`${d.label}: no data`} />
              ) : (
                <motion.div
                  title={`${d.label}: ${formatValue(d.value)}`}
                  className={cn(
                    "w-full origin-bottom rounded-t-[4px]",
                    COLUMN[d.tone ?? tone],
                    highlightLast && !last && "opacity-45",
                  )}
                  style={{ height: `${Math.max(2, h * 100)}%` }}
                  initial={{ scaleY: 0 }}
                  animate={{ scaleY: 1 }}
                  transition={{ duration: reduce ? 0 : 0.7, ease: EASE_SWAP, delay: reduce ? 0 : Math.min(i * 0.04, 0.3) }}
                />
              )}
            </div>
          );
        })}
      </div>
      <div className="mt-1.5 flex gap-1.5">
        {data.map((d, i) => (
          <span key={d.label + i} className="min-w-0 flex-1 truncate text-center text-[10px] text-subtle-foreground">
            {d.label}
          </span>
        ))}
      </div>
    </div>
  );
}

/** A small ring gauge for a single rate (0–1), with the figure in the middle. */
export function RingGauge({
  value,
  size = 64,
  stroke = 7,
  tone = "tone",
  children,
}: {
  value: number;
  size?: number;
  stroke?: number;
  tone?: "tone" | "haven" | "nectar" | "skyblue" | "ok" | "pending" | "problem";
  children?: React.ReactNode;
}) {
  const reduce = useReducedMotion();
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const color = {
    tone: "stroke-tone-strong",
    haven: "stroke-haven-500 dark:stroke-haven-300",
    nectar: "stroke-nectar-500",
    skyblue: "stroke-skyblue-500",
    ok: "stroke-emerald-500",
    pending: "stroke-amber-500",
    problem: "stroke-rose-500",
  }[tone];
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} className="fill-none stroke-muted" />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          strokeWidth={stroke}
          strokeLinecap="round"
          className={cn("fill-none", color)}
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c * (1 - Math.max(0, Math.min(1, value))) }}
          transition={{ duration: reduce ? 0 : 0.9, ease: EASE_SWAP }}
        />
      </svg>
      <span className="absolute text-[13px] font-bold tabular-nums">{children}</span>
    </div>
  );
}
