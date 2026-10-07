"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import { BadgeDollarSign, CalendarCheck, Check, Filter, Hourglass, Trophy } from "lucide-react";
import { aud } from "@/lib/utils";
import { EASE_OUT, rowDelay } from "@/lib/motion";
import { useNow } from "@/hooks/useNow";
import { hrefForKey } from "@/components/shell/dashboards";
import { PageHeader } from "@/components/ui/page";
import { Card, CardContent, CardHeader, CardMeta, CardTitle } from "@/components/ui/card";
import { Pill } from "@/components/ui/pill";
import { RateBar } from "@/components/ui/progress";
import { CountUp } from "@/components/ui/count-up";
import { Reveal } from "@/components/ui/reveal";
import { Dash, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CURRENT_REP, isOpenDeal, type PipelineDeal } from "../sales/data";
import { SIGNED_THIS_WEEK } from "../sales/week/data";
import { forecastTotal, scopeRep, useSalesScope, useSalesState } from "../sales/sales-state";
import { COMMISSION_PER_SALE, FORECAST_HISTORY, MONTH_TARGET, QUARTER_TARGET, STALE_DAYS } from "../sales/progress/data";
import {
  LEAD_STATUSES,
  commissionEarned,
  commissionPipeline,
  forecastStreak,
  funnel,
  leadsFor,
  percent,
  staleDeals,
  wonSoFar,
  wonVsTarget,
  type StaleDeal,
  type TargetProgress,
} from "../sales/progress/progress";

const signedThisWeek = Object.values(SIGNED_THIS_WEEK).reduce((a, b) => a + b, 0);

/**
 * Sales portal › My progress: how one consultant is tracking. Sales won
 * against target, forecast accuracy, their funnel with stale deals, and
 * commission. Deals are live from the Sales store; targets, the forecast
 * history and the commission rate are placeholders (sales/progress/data.ts).
 */
export function MyProgress() {
  const rep = scopeRep(useSalesScope()) ?? CURRENT_REP;
  const { deals, weekForecast } = useSalesState();
  const now = useNow();
  const won = wonSoFar(deals, rep);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="My progress"
        description="How you're tracking: sales against target, your forecasts, your funnel and your commission."
      />
      <div className="grid items-start gap-5 lg:grid-cols-2">
        <Reveal index={0} className="min-w-0">
          <TargetCard month={wonVsTarget(won.month, MONTH_TARGET)} quarter={wonVsTarget(won.quarter, QUARTER_TARGET)} />
        </Reveal>
        <Reveal index={1} className="min-w-0">
          <ForecastCard signed={signedThisWeek} forecast={forecastTotal(weekForecast)} />
        </Reveal>
        <Reveal index={2} className="min-w-0">
          <FunnelCard deals={deals} rep={rep} stale={now === null ? null : staleDeals(deals, rep, now)} />
        </Reveal>
        <Reveal index={3} className="min-w-0">
          <CommissionCard deals={deals} rep={rep} quarterWon={won.quarter} />
        </Reveal>
      </div>
    </div>
  );
}

function TargetCard({ month, quarter }: { month: TargetProgress; quarter: TargetProgress }) {
  return (
    <Card>
      <CardHeader>
        <Trophy className="size-3.5 text-tone-ink" aria-hidden />
        <CardTitle as="h3" className="text-sm">
          Sales won vs target
        </CardTitle>
        <CardMeta>HubSpot · sample targets</CardMeta>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <TargetRow label="This month" period="August to date" progress={month} delay={0} />
        <TargetRow label="This quarter" period="Quarter to date" progress={quarter} delay={0.08} />
        <p className="text-xs text-subtle-foreground">
          Targets are placeholders until Sean O&apos;Neill sets them. A deal you move to Sale won counts straight away.
        </p>
      </CardContent>
    </Card>
  );
}

function TargetRow({ label, period, progress, delay }: { label: string; period: string; progress: TargetProgress; delay: number }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className="text-[13px] font-semibold">{label}</span>
        <span className="text-xs text-muted-foreground">{period}</span>
        <span className="ml-auto text-[13px] tabular-nums">
          <span className="font-semibold">
            <CountUp value={progress.won} />
          </span>
          {progress.target ? <span className="text-muted-foreground"> of {progress.target}</span> : null}
        </span>
        {progress.hit ? (
          <Pill tone="ok" icon={Check}>
            Target hit
          </Pill>
        ) : null}
      </div>
      {progress.ratio === null ? null : (
        <RateBar
          value={progress.ratio}
          tone={progress.hit ? "ok" : "tone"}
          height="h-2"
          delay={delay}
          label={`${progress.won} of ${progress.target} sales`}
        />
      )}
    </div>
  );
}

function ForecastCard({ signed, forecast }: { signed: number; forecast: number }) {
  const reduce = useReducedMotion();
  const streak = forecastStreak(FORECAST_HISTORY);
  const scale = Math.max(1, ...FORECAST_HISTORY.flatMap((w) => [w.forecast, w.signed]));

  return (
    <Card>
      <CardHeader>
        <CalendarCheck className="size-3.5 text-tone-ink" aria-hidden />
        <CardTitle as="h3" className="text-sm">
          Forecast accuracy
        </CardTitle>
        <CardMeta>
          {streak ? `Within one for ${streak} ${streak === 1 ? "week" : "weeks"} running` : "More than one out last week"}
        </CardMeta>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <p className="rounded-lg border border-tone-line bg-tone-soft px-3 py-2.5 text-xs leading-relaxed">
          This week so far: <strong className="font-semibold tabular-nums">{signed}</strong> signed against your forecast of{" "}
          <strong className="font-semibold tabular-nums">{forecast}</strong>.
        </p>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-muted-foreground/40" aria-hidden />
            Forecast
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-tone-strong" aria-hidden />
            Signed
          </span>
        </div>
        <ul className="flex flex-col gap-2.5">
          {FORECAST_HISTORY.map((w, i) => {
            const off = Math.abs(w.signed - w.forecast) > 1;
            return (
              <motion.li
                key={w.weekEnding}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: reduce ? 0 : 0.22, ease: EASE_OUT, delay: rowDelay(i, reduce) }}
                className="grid grid-cols-[4.5rem_minmax(0,1fr)_3.5rem] items-center gap-x-3 gap-y-1"
              >
                <span className="row-span-2 text-xs text-muted-foreground">w/e {w.weekEnding}</span>
                <RateBar value={w.forecast / scale} tone="neutral" delay={0.05 * i} label={`Forecast ${w.forecast}`} />
                <span className="row-span-2 text-right text-xs tabular-nums">
                  <span className="font-semibold">{w.signed}</span> of {w.forecast}
                </span>
                <RateBar value={w.signed / scale} tone={off ? "problem" : "tone"} delay={0.05 * i + 0.03} label={`Signed ${w.signed}`} />
              </motion.li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}

function FunnelCard({ deals, rep, stale }: { deals: PipelineDeal[]; rep: string; stale: StaleDeal[] | null }) {
  const steps = funnel(deals, rep);
  const leads = leadsFor(rep);

  return (
    <Card>
      <CardHeader>
        <Filter className="size-3.5 text-tone-ink" aria-hidden />
        <CardTitle as="h3" className="text-sm">
          My funnel
        </CardTitle>
        <CardMeta>HubSpot · deals live</CardMeta>
      </CardHeader>
      <CardContent className="flex min-w-0 flex-col gap-4">
        <div>
          <p className="mb-1.5 text-[10px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">Leads</p>
          <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {LEAD_STATUSES.map((s, i) => (
              <div key={s} className="rounded-lg border border-border px-2.5 py-2">
                <dt className="text-xs text-muted-foreground">{s}</dt>
                <dd className="text-base font-semibold tabular-nums">
                  <CountUp value={leads[i]} />
                </dd>
              </div>
            ))}
          </dl>
        </div>

        <Table className="text-xs">
          <TableHeader>
            <TableRow className="hover:bg-transparent dark:hover:bg-transparent">
              <TableHead className="pl-0">Deals</TableHead>
              <TableHead>Now</TableHead>
              <TableHead>Reached</TableHead>
              <TableHead className="pr-0 text-right">Conversion</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {steps.map((s) => (
              <TableRow key={s.stage}>
                <TableCell className="py-2 pl-0 font-medium whitespace-nowrap">{s.stage}</TableCell>
                <TableCell className="py-2 tabular-nums">{s.now || <Dash />}</TableCell>
                <TableCell className="py-2 tabular-nums">{s.reached || <Dash />}</TableCell>
                <TableCell className="py-2 pr-0 text-right tabular-nums">
                  {s.conversion === null ? <Dash /> : percent(s.conversion)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        <StaleList stale={stale} />
      </CardContent>
    </Card>
  );
}

/** Reads the clock, so it fills in after mount (`stale` is null until then). */
function StaleList({ stale }: { stale: StaleDeal[] | null }) {
  const reduce = useReducedMotion();
  return (
    <div>
      <p className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
        <Hourglass className="size-3" aria-hidden /> Stale: {STALE_DAYS}+ days in a stage
      </p>
      {stale === null ? (
        <div className="h-9 animate-pulse rounded-lg bg-muted motion-reduce:animate-none" aria-hidden />
      ) : stale.length === 0 ? (
        <p className="text-[13px] text-muted-foreground">Nothing stale. Every open deal moved in the last {STALE_DAYS} days.</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {stale.map(({ deal, days }, i) => (
            <motion.li
              key={deal.id}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: reduce ? 0 : 0.22, ease: EASE_OUT, delay: rowDelay(i, reduce) }}
            >
              <Link
                href={hrefForKey("consultant:pipeline")}
                className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-[13px] transition-colors hover:border-tone-line hover:bg-tone-soft/50 focus-visible:ring-3 focus-visible:ring-ring/45 focus-visible:outline-none"
              >
                <span className="min-w-0 flex-1 truncate font-medium">{deal.client}</span>
                <span className="shrink-0 text-xs text-muted-foreground">{deal.stage}</span>
                <span className="shrink-0 text-xs font-semibold text-amber-700 tabular-nums dark:text-amber-300">{days} days</span>
              </Link>
            </motion.li>
          ))}
        </ul>
      )}
    </div>
  );
}

function CommissionCard({ deals, rep, quarterWon }: { deals: PipelineDeal[]; rep: string; quarterWon: number }) {
  const open = deals.filter((d) => d.rep === rep && isOpenDeal(d)).length;

  return (
    <Card>
      <CardHeader>
        <BadgeDollarSign className="size-3.5 text-tone-ink" aria-hidden />
        <CardTitle as="h3" className="text-sm">
          Commission
        </CardTitle>
        <Pill tone="neutral">Placeholder rate</Pill>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <dl className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-border px-3 py-2.5">
            <dt className="text-xs text-muted-foreground">Pipeline</dt>
            <dd className="font-heading text-xl font-bold tabular-nums">
              <CountUp value={aud(commissionPipeline(deals, rep))} />
            </dd>
            <dd className="text-xs text-muted-foreground tabular-nums">
              {open} open {open === 1 ? "deal" : "deals"} × {aud(COMMISSION_PER_SALE)}
            </dd>
          </div>
          <div className="rounded-lg border border-border px-3 py-2.5">
            <dt className="text-xs text-muted-foreground">Earned this quarter</dt>
            <dd className="font-heading text-xl font-bold tabular-nums">
              <CountUp value={aud(commissionEarned(quarterWon))} />
            </dd>
            <dd className="text-xs text-muted-foreground tabular-nums">
              {quarterWon} {quarterWon === 1 ? "sale" : "sales"} × {aud(COMMISSION_PER_SALE)}
            </dd>
          </div>
        </dl>
        <p className="text-xs text-subtle-foreground">
          A flat {aud(COMMISSION_PER_SALE)} a sale until Alison Carter confirms the commission formula. HubSpot&apos;s amount
          is the build price, not what you earn.
        </p>
      </CardContent>
    </Card>
  );
}
