"use client";

import * as React from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Crown, Sparkles } from "lucide-react";
import { aud, cn } from "@/lib/utils";
import { EASE_OUT, EASE_SWAP } from "@/lib/motion";
import { Card, CardContent } from "@/components/ui/card";
import { CountUp } from "@/components/ui/count-up";
import { Pill } from "@/components/ui/pill";
import { RateBar } from "@/components/ui/progress";
import { SlidingTabs, type TabItem } from "@/components/ui/sliding-tabs";
import {
  commissionRecord,
  periodLabel,
  recentTotals,
  type CommissionRecord,
  type PeriodTotal,
  type RecordPeriod,
} from "../sales/progress/commission";
import { BAR, IN_PROGRESS } from "./CommissionChart";

const PERIODS: TabItem<RecordPeriod>[] = [
  { value: "day", label: "Day" },
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
  { value: "year", label: "Year" },
];

const SO_FAR: Record<RecordPeriod, string> = { day: "Today", week: "This week", month: "This month", year: "This year" };

const RECENT: Record<RecordPeriod, string> = {
  day: "Last 12 days",
  week: "Last 12 weeks",
  month: "Last 12 months",
  year: "Every year",
};

const TREND_H = 56;

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/**
 * Sales Representative › Overview: the rep's highest commission in a day,
 * week, month or year, and how far the one under way is from it. A KPI card
 * with the gold #1 chip (HRIS § 8.5: gold means rank); it goes green while the
 * period under way holds the record. Under the figure, the stat tile's trend:
 * the last twelve periods against the record. Switching period glides the
 * figure to the new one, regrows the trend and slides the progress bar.
 */
export function HighestCommission({ dates }: { dates: readonly string[] }) {
  const reduce = useReducedMotion();
  const [period, setPeriod] = React.useState<RecordPeriod>("month");
  const record = React.useMemo(() => commissionRecord(dates, period), [dates, period]);
  const recent = React.useMemo(() => recentTotals(dates, period), [dates, period]);
  const held = record?.status === "new";

  return (
    <Card
      className={cn(
        "flex h-full flex-col transition-colors duration-300 dark:bg-black dark:shadow-black/40",
        held ? "border-emerald-200 dark:border-emerald-500/30" : "dark:border-zinc-800",
      )}
    >
      <CardContent className="flex flex-1 flex-col gap-4 pt-4">
        <div className="flex items-center gap-3">
          <span
            className={cn(
              "flex size-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br text-white shadow transition-colors",
              held ? "from-emerald-500 to-emerald-700 shadow-emerald-700/20" : "from-amber-400 to-amber-600 shadow-amber-700/20",
            )}
            aria-hidden
          >
            <Crown className="size-4" />
          </span>
          <h3 className="text-[10px] font-semibold tracking-[0.12em] text-subtle-foreground uppercase">Highest commission</h3>
          {held ? (
            <Pill tone="ok" icon={Sparkles} className="ml-auto">
              New record
            </Pill>
          ) : null}
        </div>

        <SlidingTabs value={period} onChange={setPeriod} items={PERIODS} ariaLabel="Highest commission in a" className="self-start" />

        {record === null ? (
          <p className="text-[13px] text-muted-foreground">Your first sale sets your first record.</p>
        ) : (
          <>
            <div>
              <p className="text-4xl leading-tight font-bold">
                <CountUp value={aud(record.best.amount)} />
              </p>
              <AnimatePresence mode="wait" initial={false}>
                <motion.p
                  key={record.best.key}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: reduce ? 0 : 0.2, ease: EASE_OUT }}
                  className="text-[13px] text-muted-foreground"
                >
                  Best {period}: {periodLabel(record.best.key, period)} · {plural(record.best.sales, "sale")}
                </motion.p>
              </AnimatePresence>
            </div>

            <Trend key={period} record={record} recent={recent} />
            <Chase record={record} />
          </>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * The last twelve periods as small columns on a scale topped by the record:
 * grey, the record gold, the one under way in the chart's Haven, hatched. A
 * period that reaches the line matched the record. Hovering one names it.
 */
function Trend({ record, recent }: { record: CommissionRecord; recent: PeriodTotal[] }) {
  const reduce = useReducedMotion();
  const [hover, setHover] = React.useState<number | null>(null);
  const { period, best } = record;
  const shown = hover === null ? null : recent[hover];

  return (
    <div className="mt-auto">
      <div
        role="img"
        aria-label={`${RECENT[period]}: ${recent.map((r) => `${periodLabel(r.key, period)} ${aud(r.amount)}`).join(", ")}. Record ${aud(best.amount)}.`}
        className="relative flex items-end gap-1 border-b border-border"
        style={{ height: TREND_H }}
        onPointerLeave={() => setHover(null)}
      >
        <div className="absolute inset-x-0 top-0 h-px bg-amber-400" aria-hidden />
        {recent.map((r, i) => {
          const isBest = r.key === best.key;
          const isCurrent = r.key === record.current.key;
          return (
            <div key={r.key} onPointerEnter={() => setHover(i)} className="flex h-full min-w-0 flex-1 items-end justify-center">
              {r.amount > 0 ? (
                <motion.div
                  className={cn(
                    "w-full max-w-4 origin-bottom rounded-t-[3px] transition-opacity duration-200",
                    isBest ? "bg-amber-400" : isCurrent ? BAR : "bg-zinc-300 dark:bg-zinc-600",
                    hover !== null && hover !== i && "opacity-40",
                  )}
                  style={{
                    height: Math.max(3, Math.round((r.amount / best.amount) * TREND_H)),
                    backgroundImage: isCurrent && !isBest ? IN_PROGRESS : undefined,
                  }}
                  initial={{ scaleY: 0 }}
                  animate={{ scaleY: 1 }}
                  transition={{ duration: reduce ? 0 : 0.7, ease: EASE_SWAP, delay: reduce ? 0 : Math.min(i * 0.03, 0.3) }}
                />
              ) : null}
            </div>
          );
        })}
      </div>
      <p className="mt-1.5 flex items-center justify-between gap-2 text-[11px] text-subtle-foreground" aria-hidden>
        {shown ? (
          <span className="truncate font-medium text-foreground">
            {periodLabel(shown.key, period)} · {aud(shown.amount)}
          </span>
        ) : (
          <>
            <span>{RECENT[period]}</span>
            <span className="flex items-center gap-1">
              <span className="h-px w-3 bg-amber-400" /> your record
            </span>
          </>
        )}
      </p>
    </div>
  );
}

/** The period under way against the record: a bar, and what it takes to beat it. */
function Chase({ record }: { record: CommissionRecord }) {
  const reduce = useReducedMotion();
  const { period, current, best, status, gap, salesToBeat } = record;
  const message =
    status === "new"
      ? `${SO_FAR[period]} is your best ${period} yet. Every sale from here raises the bar.`
      : status === "matched"
        ? "You've matched it. One more sale sets a new record."
        : `${aud(gap)} to match it. ${plural(salesToBeat, "more sale")} ${salesToBeat === 1 ? "sets" : "set"} a new record.`;

  return (
    <div className="flex flex-col gap-1.5 rounded-lg border border-border bg-muted/40 px-3 py-2.5 dark:border-zinc-800 dark:bg-white/[0.03]">
      <div className="flex items-baseline gap-2 text-[13px]">
        <span className="font-semibold">{SO_FAR[period]}</span>
        <span className="ml-auto font-semibold tabular-nums">
          <CountUp value={aud(current.amount)} />
        </span>
      </div>
      <RateBar
        value={current.amount / best.amount}
        tone={status === "chasing" ? "tone" : "ok"}
        height="h-2"
        label={`${aud(current.amount)} of ${aud(best.amount)}`}
      />
      <AnimatePresence mode="wait" initial={false}>
        <motion.p
          key={`${period}-${status}-${salesToBeat}`}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: reduce ? 0 : 0.2, ease: EASE_OUT }}
          className={cn("text-xs", status === "chasing" ? "text-muted-foreground" : "font-medium text-emerald-700 dark:text-emerald-300")}
        >
          {message}
        </motion.p>
      </AnimatePresence>
    </div>
  );
}
