"use client";

import * as React from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Crown, Sparkles, Trophy } from "lucide-react";
import { aud, cn } from "@/lib/utils";
import { DURATION, EASE_OUT, EASE_SWAP } from "@/lib/motion";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { CountUp } from "@/components/ui/count-up";
import { Pill } from "@/components/ui/pill";
import type { RepStanding } from "../progress/standings";
import { kValue, plural } from "./format";

/**
 * Sales Manager › Overview: the period's top closer, on the charcoal feature
 * card. The board's #1 on sales won (a tie goes to contract value): what they
 * closed, what it's worth, their lead over #2 and their share of the team's
 * sales. Gold means rank (HRIS § 8.5). A new period or a new leader swaps the
 * body; "Put in the spotlight" hands them to the Rep spotlight.
 */
export function TopCloser({
  rows,
  label,
  spotlight,
  onSpotlight,
}: {
  /** The board ranked on sales. */
  rows: readonly RepStanding[];
  /** "August", "Jul to Sep", "2026". */
  label: string;
  spotlight: string | null;
  onSpotlight: (rep: string) => void;
}) {
  const reduce = useReducedMotion();
  const [top, next] = rows;
  const closed = top && top.sales > 0;

  return (
    <Card tone="inverse" className="flex h-full flex-col">
      <CardContent className="flex flex-1 flex-col gap-5 pt-4">
        <div className="flex items-center gap-3">
          <span
            className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-amber-400 to-amber-600 text-white shadow shadow-amber-700/30"
            aria-hidden
          >
            <Crown className="size-4" />
          </span>
          <h2 className="text-[10px] font-semibold tracking-[0.12em] text-silver/75 uppercase">Top closer · {label}</h2>
          {closed && top.target.hit ? (
            <Pill tone="ok" icon={Trophy} className="ml-auto">
              Target hit
            </Pill>
          ) : null}
        </div>

        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={`${label}-${top?.rep ?? "none"}`}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: reduce ? 0 : DURATION.fade, ease: EASE_OUT }}
            className="flex flex-1 flex-col gap-5"
          >
            {!closed ? (
              <p className="text-[13px] text-silver/75">No sales yet in {label}. The first one takes the crown.</p>
            ) : (
              <>
                <div className="flex items-center gap-3">
                  <Avatar name={top.rep} size="lg" className="ring-2 ring-amber-400/70 ring-offset-2 ring-offset-charcoal dark:ring-offset-[#2b2b30]" />
                  <div className="min-w-0">
                    <p className="truncate text-xl leading-tight font-bold text-white">{top.rep}</p>
                    <p className="text-xs text-silver/70">Sales consultant</p>
                  </div>
                </div>

                <div>
                  <p className="flex items-baseline gap-2 text-white">
                    <span className="text-5xl leading-none font-bold">
                      <CountUp value={top.sales} />
                    </span>
                    <span className="text-lg font-semibold text-silver/80">{top.sales === 1 ? "sale" : "sales"}</span>
                  </p>
                  <p className="mt-2 text-[13px] text-silver/80">
                    <span className="font-semibold text-white">
                      <CountUp value={kValue(top.valueK)} />
                    </span>{" "}
                    contract value ·{" "}
                    <span className="font-semibold text-white">
                      <CountUp value={aud(top.commission)} />
                    </span>{" "}
                    commission
                  </p>
                </div>

                <p className="text-[13px] font-medium text-haven-300">{lead(top, next)}</p>

                {top.share !== null ? <Share value={top.share} /> : null}

                <button
                  type="button"
                  onClick={() => onSpotlight(top.rep)}
                  disabled={spotlight === top.rep}
                  className={cn(
                    "mt-auto inline-flex items-center gap-1.5 self-start rounded-md text-[13px] font-medium text-haven-300 underline-offset-2",
                    "hover:underline focus-visible:ring-3 focus-visible:ring-haven-300/45 focus-visible:outline-none",
                    "disabled:cursor-default disabled:text-silver/60 disabled:no-underline",
                  )}
                >
                  <Sparkles className="size-3.5" aria-hidden />
                  {spotlight === top.rep ? "In the spotlight" : "Put in the spotlight"}
                </button>
              </>
            )}
          </motion.div>
        </AnimatePresence>
      </CardContent>
    </Card>
  );
}

function lead(top: RepStanding, next: RepStanding | undefined): string {
  if (!next) return "The only rep on the board.";
  const ahead = top.sales - next.sales;
  if (ahead > 0) return `${plural(ahead, "sale")} ahead of ${next.rep}.`;
  return top.valueK > next.valueK
    ? `Level with ${next.rep} on sales, ahead on contract value.`
    : `Level with ${next.rep}.`;
}

/** Their share of the team's sales, as a bar on the charcoal. */
function Share({ value }: { value: number }) {
  const reduce = useReducedMotion();
  const pct = Math.round(value * 100);
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between text-xs text-silver/75">
        <span>Share of the team&apos;s sales</span>
        <span className="font-semibold text-white tabular-nums">{pct}%</span>
      </div>
      <div
        role="img"
        aria-label={`${pct}% of the team's sales`}
        className="relative h-2 w-full overflow-hidden rounded-full bg-white/15"
      >
        <motion.div
          className="absolute inset-y-0 left-0 w-full origin-left rounded-full bg-amber-400"
          initial={{ scaleX: 0 }}
          animate={{ scaleX: value }}
          transition={{ duration: reduce ? 0 : DURATION.fill, ease: EASE_SWAP }}
        />
      </div>
    </div>
  );
}
