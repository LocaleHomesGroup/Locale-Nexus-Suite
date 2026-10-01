"use client";

import * as React from "react";
import { motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";
import { EASE_SWAP } from "@/lib/motion";

/**
 * Leadership charts — hand-rolled on motion/react (HRIS § 19, no chart library).
 *
 * ColumnChart  zero-based columns, capped width so the band keeps its air,
 *              4–5px rounded cap and a square foot on one hairline baseline.
 *              Columns grow on a transform (scaleY) over 900ms on EASE_SWAP.
 * DonutChart   share-of-whole ring drawn on with a stroke-dashoffset mask wipe,
 *              2px surface gaps between segments, legend + values beside it.
 *
 * Both are real-pixel HTML/SVG (no viewBox scaling, so strokes never thin), and
 * both carry every value in visible text — the aria-label repeats it for AT.
 */

const REVEAL_S = 0.9;

export type ColumnTone = "haven" | "skyblue";

const COLUMN_TONE: Record<ColumnTone, string> = {
  haven: "bg-gradient-to-t from-haven-500 to-haven-300",
  skyblue: "bg-gradient-to-t from-skyblue-500 to-skyblue-300",
};

export interface ColumnDatum {
  key: string;
  value: number;
  tone: ColumnTone;
  /** Rides on the column cap (the value, usually). */
  top?: React.ReactNode;
  /** Under the baseline (the category). */
  bottom: React.ReactNode;
}

export function ColumnChart({
  data,
  plotHeight,
  ariaLabel,
  barClassName = "max-w-[42px]",
  gapClassName = "gap-3.5",
  className,
}: {
  data: ColumnDatum[];
  /** Height of the tallest column, px. */
  plotHeight: number;
  /** Sentence that carries every value, for assistive tech. */
  ariaLabel: string;
  /** Width cap for each column — a complete literal class. */
  barClassName?: string;
  /** Column spacing — a complete literal class. */
  gapClassName?: string;
  className?: string;
}) {
  const reduce = useReducedMotion();
  const [hover, setHover] = React.useState<string | null>(null);
  const max = Math.max(1, ...data.map((d) => d.value));
  const hasTop = data.some((d) => d.top != null);

  return (
    <div role="img" aria-label={ariaLabel} className={cn("w-full", className)}>
      <div
        className={cn("flex items-end border-b border-border px-1.5", gapClassName)}
        style={{ height: plotHeight + (hasTop ? 22 : 0) }}
        onPointerLeave={() => setHover(null)}
      >
        {data.map((d, i) => {
          const h = Math.max(2, Math.round((d.value / max) * plotHeight));
          const dim = hover != null && hover !== d.key;
          return (
            <div
              key={d.key}
              onPointerEnter={() => setHover(d.key)}
              className={cn(
                "flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1 transition-opacity duration-200",
                dim && "opacity-45",
              )}
            >
              {d.top != null ? (
                <span className="text-[11px] leading-none font-medium text-muted-foreground tabular-nums">{d.top}</span>
              ) : null}
              <motion.div
                className={cn("w-full origin-bottom rounded-t-[5px]", barClassName, COLUMN_TONE[d.tone])}
                style={{ height: h }}
                initial={{ scaleY: 0 }}
                animate={{ scaleY: 1 }}
                transition={{
                  duration: reduce ? 0 : REVEAL_S,
                  ease: EASE_SWAP,
                  delay: reduce ? 0 : Math.min(i * 0.08, 0.4),
                }}
              />
            </div>
          );
        })}
      </div>
      <div className={cn("mt-1.5 flex px-1.5", gapClassName)} aria-hidden>
        {data.map((d) => (
          <span
            key={d.key}
            className={cn(
              "min-w-0 flex-1 truncate text-center text-[11px] text-subtle-foreground tabular-nums transition-colors",
              hover === d.key && "text-foreground",
            )}
          >
            {d.bottom}
          </span>
        ))}
      </div>
    </div>
  );
}

export interface DonutSegment {
  key: string;
  label: string;
  /** Share of the whole, 0–100. */
  value: number;
  /** Stroke class for the ring segment — complete literal. */
  stroke: string;
}

/** Surface gap between segments along the ring, px. */
const SEGMENT_GAP = 2;

export function DonutChart({
  data,
  size = 130,
  radius = 52,
  thickness = 18,
  active,
  onActiveChange,
  ariaLabel,
  children,
}: {
  data: DonutSegment[];
  size?: number;
  radius?: number;
  thickness?: number;
  /** Highlighted segment key (hover), shared with the legend. */
  active: string | null;
  onActiveChange: (key: string | null) => void;
  ariaLabel: string;
  /** Centre readout. */
  children?: React.ReactNode;
}) {
  const reduce = useReducedMotion();
  const rawId = React.useId();
  const maskId = `donut-${rawId.replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const c = size / 2;
  const circumference = 2 * Math.PI * radius;
  const total = data.reduce((a, d) => a + d.value, 0) || 1;

  let cursor = 0;
  const segments = data.map((d) => {
    const len = (d.value / total) * circumference;
    const start = cursor;
    cursor += len;
    return { ...d, dash: Math.max(0, len - SEGMENT_GAP), start };
  });

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} role="img" aria-label={ariaLabel} onPointerLeave={() => onActiveChange(null)}>
        <defs>
          <mask id={maskId} maskUnits="userSpaceOnUse" x={0} y={0} width={size} height={size}>
            <motion.circle
              cx={c}
              cy={c}
              r={radius}
              fill="none"
              stroke="white"
              strokeWidth={thickness + 4}
              strokeDasharray={`${circumference} ${circumference}`}
              transform={`rotate(-90 ${c} ${c})`}
              initial={{ strokeDashoffset: circumference }}
              animate={{ strokeDashoffset: 0 }}
              transition={{ duration: reduce ? 0 : REVEAL_S, ease: EASE_SWAP }}
            />
          </mask>
        </defs>
        <g mask={`url(#${maskId})`}>
          {segments.map((s) => (
            <circle
              key={s.key}
              cx={c}
              cy={c}
              r={radius}
              fill="none"
              strokeWidth={thickness}
              strokeDasharray={`${s.dash} ${circumference - s.dash}`}
              strokeDashoffset={-s.start}
              transform={`rotate(-90 ${c} ${c})`}
              onPointerEnter={() => onActiveChange(s.key)}
              className={cn(
                "cursor-default transition-opacity duration-200",
                s.stroke,
                active != null && active !== s.key && "opacity-30",
              )}
            />
          ))}
        </g>
      </svg>
      {children ? (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          {children}
        </div>
      ) : null}
    </div>
  );
}
