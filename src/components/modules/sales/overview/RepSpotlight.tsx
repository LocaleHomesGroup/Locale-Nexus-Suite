"use client";

import * as React from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { AlertTriangle, ArrowRight, CircleCheck, Crown, Flame, Shuffle, Sparkles } from "lucide-react";
import { aud, cn } from "@/lib/utils";
import { EASE_OUT } from "@/lib/motion";
import { hrefForKey } from "@/components/shell/dashboards";
import { Card, CardContent, CardHeader, CardMeta, CardTitle } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { CountUp } from "@/components/ui/count-up";
import { Pill } from "@/components/ui/pill";
import { RateBar, RingGauge } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/states";
import type { PipelineDeal, TeamTask } from "../data";
import { commissionRecord, monthLabel } from "../progress/commission";
import { LEAD_STATUSES, commissionPipeline, leadsFor, staleDeals } from "../progress/progress";
import { previousLabel, repSaleDates, standingLabel, standings, type StandingPeriod } from "../progress/standings";
import { kValue, plural } from "./format";

const LINK =
  "inline-flex items-center gap-1 text-[13px] font-medium text-tone-ink underline-offset-2 hover:underline focus-visible:underline focus-visible:outline-none";

/**
 * Sales Manager › Overview: one rep up close, picked at random on each visit
 * so every rep gets a turn in front of the manager. Shuffle draws someone
 * else; the leaderboard and the Top closer can put a rep here too. It shows
 * their rank for the page's period, this month and quarter against target,
 * this year's commission, their best month, and their pipeline now: open
 * deals, leads, and anything stale or overdue. The chart beside it picks out
 * the same rep.
 */
export function RepSpotlight({
  rep,
  deals,
  tasks,
  period,
  onShuffle,
}: {
  /** Null until the browser draws one, so the server and client agree. */
  rep: string | null;
  deals: readonly PipelineDeal[];
  tasks: readonly TeamTask[];
  period: StandingPeriod;
  onShuffle: () => void;
}) {
  const reduce = useReducedMotion();

  return (
    <Card className="flex h-full min-w-0 flex-col">
      <CardHeader>
        <Sparkles className="size-4 text-tone-ink" aria-hidden />
        <CardTitle>Rep spotlight</CardTitle>
        <CardMeta>
          <Button variant="outline" size="xs" onClick={onShuffle} disabled={!rep}>
            <Shuffle aria-hidden /> Shuffle
          </Button>
        </CardMeta>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col">
        <p className="sr-only" aria-live="polite">
          {rep ? `${rep} is in the spotlight.` : ""}
        </p>
        {rep ? (
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={rep}
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -16 }}
              transition={{ duration: reduce ? 0 : 0.24, ease: EASE_OUT }}
              className="flex flex-1 flex-col gap-4"
            >
              <Profile rep={rep} deals={deals} tasks={tasks} period={period} />
            </motion.div>
          </AnimatePresence>
        ) : (
          <div className="flex flex-col gap-4" aria-hidden>
            <div className="flex items-center gap-3">
              <Skeleton className="size-11 rounded-full" />
              <div className="flex flex-col gap-1.5">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-3 w-20" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-[74px] rounded-lg" />
              ))}
            </div>
            <Skeleton className="h-24 rounded-lg" />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Profile({
  rep,
  deals,
  tasks,
  period,
}: {
  rep: string;
  deals: readonly PipelineDeal[];
  tasks: readonly TeamTask[];
  period: StandingPeriod;
}) {
  // The clock for "days in stage", read once: the stale line is days wide, so the server's and browser's agree.
  const [now] = React.useState(() => Date.now());
  const find = (p: StandingPeriod) => standings(deals, p).find((r) => r.rep === rep);
  const month = find("month");
  const quarter = find("quarter");
  const year = find("year");
  const ranked = find(period);
  const best = commissionRecord(repSaleDates(deals, rep), "month")?.best ?? null;
  const stale = staleDeals(deals, rep, now);
  const overdue = tasks.filter((t) => t.rep === rep && t.flag);
  const leads = leadsFor(rep);
  if (!month || !quarter || !year || !ranked) return null;

  const monthName = standingLabel("month");
  const pace = month.sales - month.before;
  const toGo = Math.max(0, month.target.target - month.target.won);
  const story = [
    month.target.hit
      ? `${monthName}'s target is in the bag.`
      : month.target.target
        ? `${plural(toGo, "more sale")} for ${monthName}'s target.`
        : null,
    pace > 0
      ? `${plural(pace, "sale")} ahead of this point ${previousLabel("month")}.`
      : pace < 0
        ? `${plural(-pace, "sale")} behind this point ${previousLabel("month")}.`
        : `Level with this point ${previousLabel("month")}.`,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <>
      <div className="flex items-center gap-3">
        <Avatar name={rep} size="lg" />
        <div className="min-w-0">
          <p className="truncate text-lg leading-tight font-bold">{rep}</p>
          <p className="text-xs text-subtle-foreground">Sales consultant</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        <Pill tone={ranked.rank === 1 ? "tone" : "neutral"} icon={ranked.rank === 1 ? Crown : undefined}>
          #{ranked.rank} for {standingLabel(period)}
        </Pill>
        {month.streak.months ? (
          <Pill tone="neutral" icon={Flame}>
            {month.streak.months}-month streak
          </Pill>
        ) : null}
      </div>

      <p className="text-[13px] leading-relaxed text-muted-foreground">{story}</p>

      <dl className="grid grid-cols-2 gap-2.5">
        <Stat label={monthName}>
          <span className="flex items-center justify-between gap-2">
            <span>
              <span className="block text-lg leading-tight font-bold">
                <CountUp value={`${month.target.won} of ${month.target.target}`} />
              </span>
              <span className="text-xs text-subtle-foreground">sales to target</span>
            </span>
            {month.target.ratio !== null ? (
              <RingGauge value={month.target.ratio} size={38} stroke={4} tone={month.target.hit ? "ok" : "tone"} />
            ) : null}
          </span>
        </Stat>
        <Stat label={standingLabel("quarter")}>
          <span className="block text-lg leading-tight font-bold">
            <CountUp value={`${quarter.target.won} of ${quarter.target.target}`} />
          </span>
          {quarter.target.ratio !== null ? (
            <RateBar value={quarter.target.ratio} tone={quarter.target.hit ? "ok" : "tone"} height="h-1.5" className="mt-1.5" />
          ) : null}
        </Stat>
        <Stat label={`Earned in ${standingLabel("year")}`}>
          <span className="block text-lg leading-tight font-bold">
            <CountUp value={aud(year.commission)} />
          </span>
          <span className="text-xs text-subtle-foreground">
            {plural(year.sales, "sale")} · {kValue(year.valueK)}
          </span>
        </Stat>
        <Stat
          label={
            <>
              <Crown className="size-3 text-amber-500" aria-hidden /> Best month
            </>
          }
        >
          {best ? (
            <>
              <span className="block text-lg leading-tight font-bold">{plural(best.sales, "sale")}</span>
              <span className="text-xs text-subtle-foreground">{monthLabel(best.key, "full")}</span>
            </>
          ) : (
            <span className="text-xs text-subtle-foreground">No sales yet</span>
          )}
        </Stat>
      </dl>

      <div className="flex flex-col gap-2.5 rounded-lg border border-border px-3 py-2.5 dark:border-zinc-800">
        <div className="flex items-baseline gap-2 text-[13px]">
          <span className="font-semibold">Pipeline now</span>
          <span className="ml-auto text-right tabular-nums">
            <span className="font-semibold">{month.open ? kValue(month.openK) : "Empty"}</span>
            {month.open ? <span className="text-muted-foreground"> · {plural(month.open, "open deal")}</span> : null}
          </span>
        </div>
        {month.open ? (
          <p className="-mt-1.5 text-xs text-subtle-foreground">
            {aud(commissionPipeline(deals, rep))} commission if they all close
          </p>
        ) : null}
        <LeadsBar leads={leads} />
        <ul className="flex flex-col gap-1 text-xs">
          {stale.map(({ deal, days }) => (
            <li key={deal.id} className="flex items-start gap-1.5 text-rose-700 dark:text-rose-300">
              <AlertTriangle className="mt-px size-3.5 shrink-0" aria-hidden />
              <span>
                <span className="font-semibold">{deal.client}</span> · {days} days in {deal.stage}
              </span>
            </li>
          ))}
          {overdue.length ? (
            <li className="flex items-start gap-1.5 text-rose-700 dark:text-rose-300">
              <AlertTriangle className="mt-px size-3.5 shrink-0" aria-hidden />
              <span>
                {plural(overdue.length, "task")} overdue or due today
              </span>
            </li>
          ) : null}
          {!stale.length && !overdue.length ? (
            <li className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-300">
              <CircleCheck className="size-3.5 shrink-0" aria-hidden />
              Nothing stale or overdue.
            </li>
          ) : null}
        </ul>
      </div>

      <Link href={hrefForKey("sales:pipeline", { owner: rep })} className={cn(LINK, "mt-auto self-start")}>
        Open {rep}&apos;s pipeline <ArrowRight className="size-3.5" aria-hidden />
      </Link>
    </>
  );
}

function Stat({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="min-w-0 rounded-lg bg-muted/50 px-3 py-2.5 dark:bg-white/[0.04]">
      <dt className="flex items-center gap-1 truncate text-[10px] font-semibold tracking-[0.12em] text-subtle-foreground uppercase">
        {label}
      </dt>
      <dd className="mt-1">{children}</dd>
    </div>
  );
}

/** HubSpot's lead statuses for the rep, as one bar: new to qualified, light to deep. */
function LeadsBar({ leads }: { leads: number[] }) {
  const total = leads.reduce((a, b) => a + b, 0);
  if (!total) return <p className="text-xs text-subtle-foreground">No leads in HubSpot.</p>;
  const fills = ["bg-zinc-300 dark:bg-zinc-600", "bg-haven-200 dark:bg-haven-800", "bg-haven-400 dark:bg-haven-600", "bg-[#14a394]"];
  return (
    <div className="flex flex-col gap-1.5">
      <div role="img" aria-label={LEAD_STATUSES.map((s, i) => `${leads[i]} ${s.toLowerCase()}`).join(", ")} className="flex h-2 gap-[2px]">
        {leads.map((n, i) =>
          n ? (
            <span
              key={LEAD_STATUSES[i]}
              className={cn("h-full basis-0 first:rounded-l-full last:rounded-r-full", fills[i])}
              style={{ flexGrow: n }}
            />
          ) : null,
        )}
      </div>
      <p className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground" aria-hidden>
        {LEAD_STATUSES.map((s, i) => (
          <span key={s} className="inline-flex items-center gap-1">
            <span className={cn("size-2 rounded-[2px]", fills[i])} />
            {leads[i]} {s.toLowerCase()}
          </span>
        ))}
      </p>
    </div>
  );
}
