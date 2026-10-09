"use client";

import * as React from "react";
import { motion, useReducedMotion } from "motion/react";
import { ChartColumn, Crown } from "lucide-react";
import { cn } from "@/lib/utils";
import { EASE_OUT, EASE_SWAP } from "@/lib/motion";
import { Card, CardContent, CardHeader, CardMeta, CardTitle } from "@/components/ui/card";
import { CountUp } from "@/components/ui/count-up";
import { Pill } from "@/components/ui/pill";
import { REPS, type PipelineDeal } from "../data";
import { MONTH_TARGET } from "../progress/data";
import { monthLabel } from "../progress/commission";
import { teamByMonth, type TeamMonth } from "../progress/standings";
import { BAR, IN_PROGRESS, useMeasuredWidth } from "../parts";
import { plural } from "./format";

const PLOT_H = 236;
/** Room above the plot for the best month's label. */
const HEAD = 24;
const TIP_W = 176;
/** The neutral second series: the rest of the team beside the rep in focus. */
const REST = "bg-zinc-300 dark:bg-zinc-600";

/** A zero-based count axis on round steps, at most four bands. */
function niceScale(max: number): { top: number; ticks: number[] } {
  const step = [1, 2, 5, 10, 20, 50, 100].find((s) => Math.ceil(max / s) <= 4) ?? Math.ceil(max / 400) * 100;
  const top = Math.max(step, Math.ceil(max / step) * step);
  return { top, ticks: Array.from({ length: top / step + 1 }, (_, i) => i * step) };
}

/**
 * Sales Manager › Overview: the team's sales won by month for the last
 * twelve, against the team's monthly target. The rep in the spotlight is the
 * Haven part of each column and the rest of the team is grey, so a shuffle
 * shows how much of each month was theirs. Hand-rolled like the Sales
 * Representative's commission chart (HRIS § 19): a zero-based axis, columns
 * that grow from the baseline, a readout on hover or the arrow keys, and a
 * table twin for assistive tech.
 */
export function TeamSalesChart({ deals, focus }: { deals: readonly PipelineDeal[]; focus: string | null }) {
  const reduce = useReducedMotion();
  const months = React.useMemo(() => teamByMonth(deals), [deals]);
  const target = REPS.length * MONTH_TARGET;
  const { top, ticks } = niceScale(Math.max(target, ...months.map((m) => m.total)));
  const y = (n: number) => Math.round((n / top) * PLOT_H);

  const year = months[months.length - 1].key.slice(0, 4);
  const thisYear = months.filter((m) => m.key.startsWith(year));
  const wonThisYear = thisYear.reduce((n, m) => n + m.total, 0);
  // The earliest month to reach the most sales, as a record is everywhere else.
  const best = months.reduce((a, m) => (m.total > a.total ? m : a), months[0]);
  const done = months.filter((m) => !m.current);
  const onTarget = done.filter((m) => m.total >= target).length;
  const focusInYear = focus ? thisYear.reduce((n, m) => n + (m.byRep[focus] ?? 0), 0) : 0;

  const [active, setActive] = React.useState<number | null>(null);
  const [plotRef, plotWidth] = useMeasuredWidth<HTMLDivElement>();
  const slot = plotWidth / months.length;
  const range = `${monthLabel(months[0].key, "full")} to ${monthLabel(months[months.length - 1].key, "full")}`;

  const describe = (m: TeamMonth) =>
    `${monthLabel(m.key, "full")}${m.current ? " so far" : ""}: ${plural(m.total, "sale")}, ${REPS.map(
      (r) => `${r} ${m.byRep[r] ?? 0}`,
    ).join(", ")}${m.key === best.key ? ". The team's best month" : ""}.`;

  const onKeyDown = (e: React.KeyboardEvent) => {
    const last = months.length - 1;
    const at = active ?? last;
    const next =
      e.key === "ArrowLeft"
        ? active === null ? last : Math.max(0, at - 1)
        : e.key === "ArrowRight"
          ? active === null ? last : Math.min(last, at + 1)
          : e.key === "Home"
            ? 0
            : e.key === "End"
              ? last
              : null;
    if (next !== null) {
      e.preventDefault();
      setActive(next);
    } else if (e.key === "Escape" && active !== null) {
      e.preventDefault();
      setActive(null);
    }
  };

  return (
    <Card className="flex h-full min-w-0 flex-col">
      <CardHeader>
        <ChartColumn className="size-4 text-tone-ink" aria-hidden />
        <CardTitle>Team sales by month</CardTitle>
        <CardMeta>
          <Pill tone="neutral">Sample history</Pill>
        </CardMeta>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-5">
        <dl className="flex flex-wrap items-end gap-x-8 gap-y-3">
          <div className="min-w-0">
            <dt className="text-[10px] font-semibold tracking-[0.12em] text-subtle-foreground uppercase">Won in {year}</dt>
            <dd className="mt-0.5 text-3xl leading-tight font-bold">
              <CountUp value={plural(wonThisYear, "sale")} />
            </dd>
            <dd className="text-xs text-subtle-foreground">
              {focus ? `${focusInYear} of them ${focus}'s` : `across ${plural(REPS.length, "rep")}`}
            </dd>
          </div>
          <div className="min-w-0">
            <dt className="flex items-center gap-1 text-[10px] font-semibold tracking-[0.12em] text-subtle-foreground uppercase">
              <Crown className="size-3 text-amber-500" aria-hidden /> Best month
            </dt>
            <dd className="mt-0.5 text-lg leading-tight font-bold">
              <CountUp value={plural(best.total, "sale")} />
            </dd>
            <dd className="text-xs text-subtle-foreground">{monthLabel(best.key, "full")}</dd>
          </div>
          <div className="min-w-0">
            <dt className="flex items-center gap-1.5 text-[10px] font-semibold tracking-[0.12em] text-subtle-foreground uppercase">
              <span className="h-px w-3 bg-foreground/45" aria-hidden /> On target
            </dt>
            <dd className="mt-0.5 text-lg leading-tight font-bold">
              <CountUp value={`${onTarget} of ${done.length}`} />
            </dd>
            <dd className="text-xs text-subtle-foreground">months at {target} or more</dd>
          </div>
        </dl>

        <div
          role="group"
          tabIndex={0}
          aria-label={`Team sales by month, ${range}. Use the arrow keys to read each month.`}
          onKeyDown={onKeyDown}
          onBlur={() => setActive(null)}
          className="rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-ring/45"
        >
          <div className="flex">
            <div className="relative w-8 shrink-0" style={{ height: PLOT_H + HEAD }} aria-hidden>
              {ticks.map((t) => (
                <span
                  key={t}
                  className="absolute right-2 translate-y-1/2 text-[10px] leading-none text-subtle-foreground tabular-nums"
                  style={{ bottom: y(t) }}
                >
                  {t}
                </span>
              ))}
            </div>

            <div
              ref={plotRef}
              className="relative min-w-0 flex-1"
              style={{ height: PLOT_H + HEAD }}
              onPointerLeave={() => setActive(null)}
            >
              {ticks.map((t) => (
                <div
                  key={t}
                  className={cn("absolute inset-x-0 h-px", t === 0 ? "bg-border" : "bg-hairline")}
                  style={{ bottom: y(t) }}
                  aria-hidden
                />
              ))}
              <div className="absolute inset-x-0 h-px bg-foreground/45" style={{ bottom: y(target) }} aria-hidden />

              <div className="absolute inset-0 flex items-end" aria-hidden>
                {months.map((m, i) => (
                  <Column
                    key={m.key}
                    month={m}
                    index={i}
                    focus={focus}
                    y={y}
                    best={m.key === best.key}
                    dim={active !== null && active !== i}
                    onEnter={() => setActive(i)}
                  />
                ))}
              </div>

              {active !== null && plotWidth > 0 ? (
                <Readout
                  month={months[active]}
                  index={active}
                  slot={slot}
                  plotWidth={plotWidth}
                  barTop={y(months[active].total)}
                  focus={focus}
                  target={target}
                  best={months[active].key === best.key}
                />
              ) : null}
            </div>
          </div>

          <div className="mt-1.5 ml-8 flex" aria-hidden>
            {months.map((m, i) => (
              <span
                key={m.key}
                className={cn(
                  "min-w-0 flex-1 text-center text-[10px] leading-tight text-subtle-foreground transition-colors",
                  active === i && "font-semibold text-foreground",
                )}
              >
                {slot > 0 && slot < 26 ? monthLabel(m.key).charAt(0) : monthLabel(m.key)}
                {i === 0 || m.key.endsWith("-01") ? <span className="block text-[9px]">{m.key.slice(0, 4)}</span> : null}
              </span>
            ))}
          </div>

          <p className="sr-only" aria-live="polite">
            {active !== null ? describe(months[active]) : ""}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <span className={cn("size-2.5 rounded-[3px]", BAR)} aria-hidden />
            {focus ?? "The team"}
          </span>
          {focus ? (
            <span className="inline-flex items-center gap-1.5">
              <span className={cn("size-2.5 rounded-[3px]", REST)} aria-hidden />
              Rest of the team
            </span>
          ) : null}
          <span className="inline-flex items-center gap-1.5">
            <span className="h-px w-3.5 bg-foreground/45" aria-hidden />
            Team target, {target} a month
          </span>
        </div>

        <table className="sr-only">
          <caption>Team sales by month, {range}</caption>
          <thead>
            <tr>
              <th scope="col">Month</th>
              {REPS.map((r) => (
                <th key={r} scope="col">
                  {r}
                </th>
              ))}
              <th scope="col">Team</th>
            </tr>
          </thead>
          <tbody>
            {months.map((m) => (
              <tr key={m.key}>
                <th scope="row">
                  {monthLabel(m.key, "full")}
                  {m.current ? " (so far)" : ""}
                </th>
                {REPS.map((r) => (
                  <td key={r}>{m.byRep[r] ?? 0}</td>
                ))}
                <td>{m.total}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <p className="mt-auto max-w-[70ch] text-xs text-subtle-foreground">
          Sample history until HubSpot&apos;s Sale won events are mirrored. The striped column is this month so far. The
          target is a placeholder {MONTH_TARGET} a rep a month until Sean O&apos;Neill sets targets.
        </p>
      </CardContent>
    </Card>
  );
}

/**
 * One month: the rep in focus at the base, the rest of the team above with a
 * 2px gap of card between them. The column grows from the baseline on a
 * transform; a new focus re-splits it.
 */
function Column({
  month,
  index,
  focus,
  y,
  best,
  dim,
  onEnter,
}: {
  month: TeamMonth;
  index: number;
  focus: string | null;
  y: (n: number) => number;
  best: boolean;
  dim: boolean;
  onEnter: () => void;
}) {
  const reduce = useReducedMotion();
  const mine = focus ? (month.byRep[focus] ?? 0) : month.total;
  const rest = month.total - mine;
  const hatch = month.current ? IN_PROGRESS : undefined;
  const split = { duration: reduce ? 0 : 0.36, ease: EASE_SWAP };

  return (
    <div onPointerEnter={onEnter} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end">
      {best && month.total > 0 ? (
        <span
          className={cn(
            "mb-1 flex items-center gap-0.5 text-xs leading-none font-semibold whitespace-nowrap tabular-nums transition-opacity duration-200",
            dim && "opacity-40",
          )}
        >
          <Crown className="size-3 text-amber-500" />
          {month.total}
        </span>
      ) : null}
      {month.total > 0 ? (
        <motion.div
          className={cn("flex w-[62%] max-w-6 origin-bottom flex-col-reverse transition-opacity duration-200", dim && "opacity-40")}
          initial={{ scaleY: 0 }}
          animate={{ scaleY: 1 }}
          transition={{ duration: reduce ? 0 : 0.9, ease: EASE_SWAP, delay: reduce ? 0 : Math.min(index * 0.05, 0.45) }}
        >
          <motion.div
            className={cn(BAR, rest === 0 ? "rounded-t-[4px]" : "")}
            initial={false}
            animate={{ height: mine ? Math.max(3, y(mine)) : 0 }}
            transition={split}
            style={{ backgroundImage: hatch }}
          />
          <motion.div
            className={cn(REST, "rounded-t-[4px]")}
            initial={false}
            animate={{ height: rest ? Math.max(3, y(rest)) : 0, marginBottom: rest && mine ? 2 : 0 }}
            transition={split}
            style={{ backgroundImage: hatch }}
          />
        </motion.div>
      ) : null}
    </div>
  );
}

/** The hovered month: above its column when there's room, beside it when the column is tall. */
function Readout({
  month,
  index,
  slot,
  plotWidth,
  barTop,
  focus,
  target,
  best,
}: {
  month: TeamMonth;
  index: number;
  slot: number;
  plotWidth: number;
  barTop: number;
  focus: string | null;
  target: number;
  best: boolean;
}) {
  const reduce = useReducedMotion();
  const tipH = 72 + REPS.length * 18;
  const cx = (index + 0.5) * slot;
  const clampX = (x: number) => Math.max(0, Math.min(plotWidth - TIP_W, x));
  const above = barTop + 28 + tipH <= PLOT_H + HEAD;
  const left = above
    ? clampX(cx - TIP_W / 2)
    : clampX(cx > plotWidth / 2 ? cx - slot * 0.4 - TIP_W - 6 : cx + slot * 0.4 + 6);
  const bottom = above ? barTop + 28 : Math.max(0, Math.min(PLOT_H + HEAD - tipH, barTop - tipH / 2));
  const reps = [...REPS].sort((a, b) => (month.byRep[b] ?? 0) - (month.byRep[a] ?? 0));

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduce ? 0 : 0.16, ease: EASE_OUT }}
      className="pointer-events-none absolute z-10 rounded-lg border border-border bg-white px-3 py-2 shadow-lg dark:bg-zinc-900"
      style={{ left, bottom, width: TIP_W }}
      aria-hidden
    >
      <p className="text-xs text-muted-foreground">
        {monthLabel(month.key, "full")}
        {month.current ? " · so far" : ""}
      </p>
      <p className="flex items-center gap-1 text-sm font-bold tabular-nums">
        {plural(month.total, "sale")}
        {best ? <Crown className="size-3 text-amber-500" /> : null}
      </p>
      <ul className="mt-1 flex flex-col gap-0.5">
        {reps.map((r) => (
          <li key={r} className="flex items-center gap-1.5 text-xs">
            <span className={cn("size-2 rounded-[2px]", !focus || r === focus ? BAR : REST)} />
            <span className={cn("truncate", r === focus ? "font-semibold text-foreground" : "text-muted-foreground")}>{r}</span>
            <span className="ml-auto font-semibold tabular-nums">{month.byRep[r] ?? 0}</span>
          </li>
        ))}
      </ul>
      <p className="mt-1 border-t border-hairline pt-1 text-xs text-muted-foreground">
        {month.total >= target ? "On target" : `${target - month.total} short of ${target}`}
        {month.current ? " so far" : ""}
      </p>
    </motion.div>
  );
}
