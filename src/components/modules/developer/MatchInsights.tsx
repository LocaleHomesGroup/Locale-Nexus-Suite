"use client";

import {
  ArrowDown,
  Info,
  MapPin,
  MessageSquareWarning,
  Quote,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  TrendingUp,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { DEVELOPER } from "@/data/portal";
import { PageHeader } from "@/components/ui/page";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardMeta, CardTitle } from "@/components/ui/card";
import { KpiCard, KpiGrid } from "@/components/ui/kpi-card";
import { RateBar } from "@/components/ui/progress";
import { Pill } from "@/components/ui/pill";
import { Reveal } from "@/components/ui/reveal";
import { DEMAND, FACTOR_SCORES, FUNNEL, INSIGHTS_PERIOD, MATCH_STATS, OBJECTIONS } from "./data";

/**
 * Developer › Match insights — the meeting's idea, turned to the builder:
 * every consultation is recorded, AI scores what the client wants against
 * every builder's packages, and "we learn from our success, we learn from our
 * failures ... we also help the developers: this is your weakness". How this
 * builder ranks against the market, where its deals fall off, the objections
 * clients raise about it, and where Locale's clients want to build.
 *
 * Consultation recording isn't live yet, so every figure here is a sample and
 * says so.
 */
export function MatchInsights() {
  const lost = OBJECTIONS.reduce((sum, o) => sum + o.count, 0);
  const presented = FUNNEL[1].count;
  const chosen = FUNNEL[2].count;
  const best = [...FACTOR_SCORES].sort((a, b) => b.you - b.market - (a.you - a.market))[0];
  const worst = [...FACTOR_SCORES].sort((a, b) => a.you - a.market - (b.you - b.market))[0];
  const topObjection = OBJECTIONS[0];
  const gap = [...DEMAND].filter((d) => d.packages === 0).sort((a, b) => b.enquiries - a.enquiries)[0];
  const maxDemand = Math.max(...DEMAND.map((d) => d.enquiries));

  const strengths = [
    `${best.factor} is your strongest factor, ${best.you - best.market} points above the Locale average.`,
    `You were the top match ${MATCH_STATS.rankedFirst} times this quarter and chosen ${MATCH_STATS.chosen} times.`,
  ];
  const weaknesses = [
    `${worst.factor} is ${worst.market - worst.you} points below the Locale average, and “${topObjection.objection.toLowerCase()}” is the most common reason a client picks someone else (${topObjection.count} of ${lost}).`,
    ...(gap
      ? [
          `${gap.suburb} had ${gap.enquiries} Locale enquiries this quarter, the most of any suburb, and you have no package there.`,
        ]
      : []),
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Match insights"
        description="Every Locale consultation is recorded and scored against every builder's packages. Here's how yours rank, where deals fall off, and why."
        actions={
          <Pill tone="neutral" icon={Info}>
            Sample figures · {INSIGHTS_PERIOD}
          </Pill>
        }
      />

      <Reveal index={0}>
        <KpiGrid cols={4}>
          <KpiCard
            label="Consultations scored"
            value={MATCH_STATS.consultations}
            sub="Sample · across Locale"
            icon={Users}
          />
          <KpiCard
            label="You were shortlisted"
            value={MATCH_STATS.shortlisted}
            sub="Sample · in the client's top four"
            icon={Sparkles}
          />
          <KpiCard
            label="Ranked top match"
            value={MATCH_STATS.rankedFirst}
            sub="Sample · endorsed by the consultant"
            icon={TrendingUp}
          />
          <KpiCard
            label="Chosen"
            value={MATCH_STATS.chosen}
            sub={`Sample · ${Math.round((chosen / presented) * 100)}% of clients shown you`}
            icon={ThumbsUp}
          />
        </KpiGrid>
      </Reveal>

      <div className="grid items-start gap-5 xl:grid-cols-2">
        <Reveal index={1} className="min-w-0">
          <Card className="h-full">
            <CardHeader>
              <CardTitle>You against the market</CardTitle>
              <CardMeta>
                {MATCH_STATS.avgScore} vs {MATCH_STATS.marketAvg} overall
              </CardMeta>
              <CardDescription>
                Your average score on each match factor, beside the average of every builder on Locale.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="mb-3 flex gap-4 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <span aria-hidden className="size-2.5 rounded-sm bg-tone-strong" /> {DEVELOPER}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span aria-hidden className="size-2.5 rounded-sm bg-zinc-300 dark:bg-zinc-600" /> Locale average
                </span>
              </div>
              <ul className="space-y-3.5">
                {FACTOR_SCORES.map((f) => {
                  const diff = f.you - f.market;
                  return (
                    <li key={f.factor}>
                      <div className="mb-1 flex items-baseline justify-between gap-3">
                        <span className="text-[13px] font-medium">{f.factor}</span>
                        <span
                          className={cn(
                            "text-xs font-medium tabular-nums",
                            diff < 0 ? "text-rose-700 dark:text-rose-300" : "text-emerald-700 dark:text-emerald-300",
                          )}
                        >
                          {diff > 0 ? "+" : ""}
                          {diff} vs average
                        </span>
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <RateBar value={f.you / 100} label={`${DEVELOPER} ${f.you}`} />
                          <span className="w-6 shrink-0 text-right text-xs tabular-nums">{f.you}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <RateBar value={f.market / 100} tone="neutral" label={`Locale average ${f.market}`} />
                          <span className="w-6 shrink-0 text-right text-xs text-muted-foreground tabular-nums">
                            {f.market}
                          </span>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </CardContent>
          </Card>
        </Reveal>

        <Reveal index={2} className="min-w-0">
          <Card className="h-full">
            <CardHeader>
              <CardTitle>Where deals fall off</CardTitle>
              <CardDescription>From the shortlist to a signed contract, this quarter.</CardDescription>
            </CardHeader>
            <CardContent>
              <ol>
                {FUNNEL.map((f, i) => {
                  const drop = i > 0 ? FUNNEL[i - 1].count - f.count : 0;
                  const biggest =
                    i > 0 && drop === Math.max(...FUNNEL.slice(1).map((x, j) => FUNNEL[j].count - x.count));
                  return (
                    <li key={f.stage}>
                      {i > 0 ? (
                        <p
                          className={cn(
                            "flex items-center gap-1 py-1 pl-1 text-xs tabular-nums",
                            biggest ? "font-medium text-rose-700 dark:text-rose-300" : "text-subtle-foreground",
                          )}
                        >
                          <ArrowDown className="size-3" aria-hidden />
                          {drop} lost here{biggest ? " · the biggest drop" : ""}
                        </p>
                      ) : null}
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="text-[13px] font-medium">{f.stage}</span>
                        <span className="text-[13px] font-semibold tabular-nums">{f.count}</span>
                      </div>
                      <RateBar
                        value={f.count / FUNNEL[0].count}
                        height="h-2"
                        className="mt-1"
                        label={`${f.stage}: ${f.count}`}
                      />
                    </li>
                  );
                })}
              </ol>
            </CardContent>
          </Card>
        </Reveal>

        <Reveal index={3} className="min-w-0">
          <Card className="h-full">
            <CardHeader>
              <CardTitle>Why clients chose someone else</CardTitle>
              <CardMeta>{lost} consultations</CardMeta>
              <CardDescription>
                The objections raised in recorded consultations where you were shown and not chosen.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3">
                {OBJECTIONS.map((o) => (
                  <li key={o.objection}>
                    <div className="mb-1 flex items-baseline justify-between gap-3">
                      <span className="inline-flex items-center gap-1.5 text-[13px] font-medium">
                        <MessageSquareWarning className="size-3.5 text-subtle-foreground" aria-hidden />
                        {o.objection}
                      </span>
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {o.count} of {lost}
                      </span>
                    </div>
                    <RateBar value={o.count / lost} tone="neutral" label={`${o.objection}: ${o.count} of ${lost}`} />
                    <p className="mt-1 flex gap-1.5 text-xs text-muted-foreground italic">
                      <Quote className="mt-0.5 size-3 shrink-0" aria-hidden />
                      {o.said}
                    </p>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </Reveal>

        <Reveal index={4} className="min-w-0">
          <Card className="h-full">
            <CardHeader>
              <CardTitle>Where Locale clients want to build</CardTitle>
              <CardDescription>Enquiries by suburb this quarter, beside your packages there.</CardDescription>
            </CardHeader>
            <CardContent>
              <ul>
                {DEMAND.map((d) => (
                  <li
                    key={d.suburb}
                    className="grid grid-cols-[7rem_minmax(0,1fr)_auto] items-center gap-3 border-t border-hairline py-2 first:border-t-0"
                  >
                    <span className="inline-flex items-center gap-1.5 text-[13px] font-medium">
                      <MapPin className="size-3 text-subtle-foreground" aria-hidden />
                      {d.suburb}
                    </span>
                    <span className="flex items-center gap-2">
                      <RateBar value={d.enquiries / maxDemand} label={`${d.suburb}: ${d.enquiries} enquiries`} />
                      <span className="w-6 shrink-0 text-right text-xs tabular-nums">{d.enquiries}</span>
                    </span>
                    {d.packages ? (
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {d.packages} package{d.packages === 1 ? "" : "s"}
                      </span>
                    ) : (
                      <Pill tone="pending" variant="caps">
                        No package
                      </Pill>
                    )}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </Reveal>
      </div>

      <Reveal index={5}>
        <Card>
          <CardHeader>
            <CardTitle>What the scores say</CardTitle>
            <CardDescription>Your strengths to keep, and the gaps worth closing.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 pb-5 md:grid-cols-2">
            <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 px-4 py-3 dark:border-emerald-500/25 dark:bg-emerald-500/10">
              <p className="inline-flex items-center gap-1.5 text-[10px] font-semibold tracking-[0.12em] text-emerald-800 uppercase dark:text-emerald-200">
                <ThumbsUp className="size-3" aria-hidden /> Strengths
              </p>
              <ul className="mt-2 list-disc space-y-1.5 pl-4 text-[13px] leading-relaxed text-emerald-950 dark:text-emerald-50">
                {strengths.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
            </div>
            <div className="rounded-lg border border-amber-200 bg-amber-50/60 px-4 py-3 dark:border-amber-500/25 dark:bg-amber-500/10">
              <p className="inline-flex items-center gap-1.5 text-[10px] font-semibold tracking-[0.12em] text-amber-900 uppercase dark:text-amber-200">
                <ThumbsDown className="size-3" aria-hidden /> Worth working on
              </p>
              <ul className="mt-2 list-disc space-y-1.5 pl-4 text-[13px] leading-relaxed text-amber-950 dark:text-amber-50">
                {weaknesses.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
            </div>
          </CardContent>
          <CardFooter className="text-xs text-muted-foreground">
            Sample figures. Scores come from recorded consultations once recording goes live, and Locale's consultants
            see the same numbers.
          </CardFooter>
        </Card>
      </Reveal>
    </div>
  );
}
