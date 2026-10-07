"use client";

import * as React from "react";
import Link from "next/link";
import { BadgeDollarSign, Flame, Target, Trophy, Wallet } from "lucide-react";
import { aud } from "@/lib/utils";
import { useGreeting } from "@/hooks/useGreeting";
import { hrefForKey } from "@/components/shell/dashboards";
import { PageHeader } from "@/components/ui/page";
import { KpiCard, KpiGrid } from "@/components/ui/kpi-card";
import { RingGauge } from "@/components/ui/progress";
import { Reveal } from "@/components/ui/reveal";
import { CURRENT_REP, isOpenDeal } from "../sales/data";
import { useSalesState } from "../sales/sales-state";
import { HISTORY_AS_OF, MONTH_TARGET } from "../sales/progress/data";
import { commissionEarned, commissionPipeline, wonSoFar, wonThisSession, wonVsTarget } from "../sales/progress/progress";
import { monthLabel, saleDates, saleStreak } from "../sales/progress/commission";
import { useChangesRequested } from "./use-changes-requested";
import { CommissionChart } from "./CommissionChart";
import { HighestCommission } from "./HighestCommission";

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const WORDS = ["No", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine"];

const LINK = "font-medium text-tone-ink underline-offset-2 hover:underline focus-visible:underline focus-visible:outline-none";

/**
 * Sales Representative portal › Overview: what a consultant has earned and
 * what's left to win. Four KPI cards (this month's commission, the month's
 * target, commission still in open deals, their sale streak), then their
 * commission by month and their highest commission in a day, week, month or
 * year. Nothing else: the rest lives in its own section.
 *
 * Deals come from the shared Sales store, so a deal moved to Sale won on
 * either board lands here at once: on this month's figures, the chart's
 * August column and, if it's enough, a new record. Commission is the
 * placeholder flat rate; the history is sample (sales/progress/data.ts).
 */
export function ConsultantOverview() {
  const rep = CURRENT_REP;
  const greeting = useGreeting();
  const { deals, tasks } = useSalesState();
  const changes = useChangesRequested();

  const dates = React.useMemo(() => saleDates(rep, wonThisSession(deals, rep)), [deals, rep]);
  const won = wonSoFar(deals, rep);
  const target = wonVsTarget(won.month, MONTH_TARGET);
  const toGo = Math.max(0, target.target - target.won);
  const open = deals.filter((d) => d.rep === rep && isOpenDeal(d)).length;
  const streak = saleStreak(dates);
  const month = monthLabel(HISTORY_AS_OF.slice(0, 7), "long");

  const flagged = tasks.filter((t) => t.rep === rep && t.flag);
  const overdue = flagged.filter((t) => /overdue/i.test(t.due)).length;

  const nudge =
    target.ratio === null
      ? null
      : target.hit
        ? `${month}'s target is in the bag. Keep it rolling.`
        : `${toGo === 1 ? "One more sale" : `${WORDS[toGo] ?? toGo} more sales`} and ${month}'s target is yours.`;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={`${greeting}, ${rep}.`}
        description={
          <>
            {nudge ?? (overdue || changes ? null : "You're all caught up.")}
            {overdue ? (
              <>
                {" "}
                <Link href={hrefForKey("consultant:clients")} className={LINK}>
                  {plural(overdue, "task")} {overdue === 1 ? "is" : "are"} overdue.
                </Link>
              </>
            ) : null}
            {changes ? (
              <>
                {" "}
                <Link href={hrefForKey("consultant:submissions")} className={LINK}>
                  {plural(changes, "submission")} came back with changes.
                </Link>
              </>
            ) : null}
          </>
        }
      />

      <Reveal index={0}>
        <KpiGrid cols={4}>
          <KpiCard
            label="Earned this month"
            value={aud(commissionEarned(won.month))}
            sub={`${plural(won.month, "sale")} in ${month}`}
            icon={BadgeDollarSign}
            wrapLabel
            href={hrefForKey("consultant:progress")}
          />
          <KpiCard
            label={`${month} target`}
            value={target.target ? `${target.won} of ${target.target}` : target.won}
            sub={target.hit ? "Target hit. Nice work." : target.target ? `${plural(toGo, "sale")} to go` : "no target set"}
            icon={target.hit ? Trophy : Target}
            tone={target.hit ? "ok" : undefined}
            aside={
              target.ratio === null ? null : (
                <RingGauge value={target.ratio} size={46} stroke={5} tone={target.hit ? "ok" : "tone"}>
                  <span className="text-[11px]">{Math.round((target.won / target.target) * 100)}%</span>
                </RingGauge>
              )
            }
            wrapLabel
            href={hrefForKey("consultant:progress")}
          />
          <KpiCard
            label="Up for grabs"
            value={aud(commissionPipeline(deals, rep))}
            sub={open ? `in ${plural(open, "open deal")}` : "book an appointment to fill it"}
            icon={Wallet}
            wrapLabel
            href={hrefForKey("consultant:pipeline")}
          />
          <KpiCard
            label="Sale streak"
            value={plural(streak.months, "month")}
            sub={streak.since ? `unbroken since ${monthLabel(streak.since)} ${streak.since.slice(0, 4)}` : "a sale this month starts one"}
            icon={Flame}
            wrapLabel
          />
        </KpiGrid>
      </Reveal>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
        <Reveal index={1} className="min-w-0">
          <CommissionChart dates={dates} />
        </Reveal>
        <Reveal index={2} className="min-w-0">
          <HighestCommission dates={dates} />
        </Reveal>
      </div>
    </div>
  );
}
