"use client";

import * as React from "react";
import { motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";
import { DURATION, EASE_SWAP } from "@/lib/motion";
import { MONTHLY } from "./data";

/**
 * Spend versus deals won, last six months. The mockup drew both measures as a
 * grouped pair on one plot with two hidden scales; HRIS § 19.5 (and the dataviz
 * rule "one axis") split two measures into two strips on a shared x axis, so
 * spend sits above deals won and each strip is zero-based on its own max.
 *
 * Every value is printed above its bar (the readable twin), each month column
 * is its own tab stop (§ 19.13, the CycleTrendChart variant) and the readout
 * line above the chart names the hovered / focused month, newest by default.
 * Bars reveal with a transform-only scaleY.
 */
const BAR_ROOM = 64;

export function SpendDealsChart() {
  const reduce = useReducedMotion();
  const [active, setActive] = React.useState<number | null>(null);
  const maxSpend = Math.max(...MONTHLY.map((m) => m.spend));
  const maxWon = Math.max(...MONTHLY.map((m) => m.won));
  const shownIndex = active ?? MONTHLY.length - 1;
  const shown = MONTHLY[shownIndex];

  const grow = (i: number, extra = 0) => ({
    initial: { scaleY: reduce ? 1 : 0 },
    animate: { scaleY: 1 },
    transition: { duration: reduce ? 0 : DURATION.fill, ease: EASE_SWAP, delay: reduce ? 0 : i * 0.07 + extra },
  });

  return (
    <div role="group" aria-label="Spend versus deals won, last six months" className="w-full">
      <p className="mb-2 text-[11.5px] text-muted-foreground tabular-nums" aria-live="polite">
        <span className="font-semibold text-foreground">{shown.month}</span> · ${shown.spend}k spend · {shown.won} deals
        won
      </p>

      <div className="flex gap-2">
        {/* Strip labels — the gutter sits outside the columns (§ 19.11). */}
        <div className="hidden w-24 shrink-0 flex-col pt-1 sm:flex" aria-hidden>
          <div className="flex items-end gap-1.5 pb-1 text-[10.5px] text-muted-foreground" style={{ height: BAR_ROOM + 17 }}>
            <span className="mb-0.5 inline-block size-2 shrink-0 rounded-[2px] bg-skyblue-500" />
            Marketing spend
          </div>
          <div className="mt-2 flex items-end gap-1.5 pb-1 text-[10.5px] text-muted-foreground" style={{ height: BAR_ROOM + 17 }}>
            <span className="mb-0.5 inline-block size-2 shrink-0 rounded-[2px] bg-haven-500" />
            Deals won
          </div>
        </div>

        <div className="flex min-w-0 flex-1 gap-1 sm:gap-2.5">
          {MONTHLY.map((m, i) => {
            const isActive = i === shownIndex;
            return (
              <button
                key={m.month}
                type="button"
                aria-label={`${m.month}: $${m.spend}k spend, ${m.won} deals won`}
                onMouseEnter={() => setActive(i)}
                onMouseLeave={() => setActive(null)}
                onFocus={() => setActive(i)}
                onBlur={() => setActive(null)}
                onClick={() => setActive(i)}
                className={cn(
                  "flex min-w-0 flex-1 cursor-default flex-col items-center rounded-lg px-0.5 pt-1 pb-1.5 transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/45",
                  active === i ? "bg-muted/70 dark:bg-white/[0.05]" : "hover:bg-muted/50",
                )}
              >
                {/* Spend strip */}
                <span
                  className={cn(
                    "block h-4 text-[10px] leading-4 tabular-nums",
                    isActive ? "font-semibold text-foreground" : "text-subtle-foreground",
                  )}
                >
                  ${m.spend}k
                </span>
                <span className="flex w-full items-end justify-center" style={{ height: BAR_ROOM }}>
                  <motion.span
                    className="block w-[46%] max-w-8 origin-bottom rounded-t-[4px] bg-skyblue-500"
                    style={{ height: `${(m.spend / maxSpend) * 100}%` }}
                    {...grow(i)}
                  />
                </span>
                <span className="block h-px w-full bg-border" />

                {/* Deals-won strip */}
                <span
                  className={cn(
                    "mt-2 block h-4 text-[10px] leading-4 tabular-nums",
                    isActive ? "font-semibold text-foreground" : "text-subtle-foreground",
                  )}
                >
                  {m.won}
                </span>
                <span className="flex w-full items-end justify-center" style={{ height: BAR_ROOM }}>
                  <motion.span
                    className="block w-[46%] max-w-8 origin-bottom rounded-t-[4px] bg-haven-500"
                    style={{ height: `${(m.won / maxWon) * 100}%` }}
                    {...grow(i, 0.04)}
                  />
                </span>
                <span className="block h-px w-full bg-border" />

                <span
                  className={cn(
                    "mt-1.5 text-[10.5px]",
                    isActive ? "font-semibold text-foreground" : "text-muted-foreground",
                  )}
                >
                  {m.month}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
