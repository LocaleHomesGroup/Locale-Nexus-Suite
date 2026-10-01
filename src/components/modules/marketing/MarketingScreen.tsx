"use client";

import * as React from "react";
import { motion, useReducedMotion } from "motion/react";
import {
  AlertTriangle,
  BarChart3,
  Circle,
  DollarSign,
  Target,
  TrendingUp,
  Trophy,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { EASE_OUT, rowDelay } from "@/lib/motion";
import { useTabParam } from "@/hooks/useTabParam";
import { PageContainer, PageHeader } from "@/components/ui/page";
import { TabPanels } from "@/components/ui/sliding-tabs";
import { Card, CardContent, CardHeader, CardMeta, CardTitle } from "@/components/ui/card";
import { KpiCard, KpiGrid } from "@/components/ui/kpi-card";
import { Pill } from "@/components/ui/pill";
import { RateBar } from "@/components/ui/progress";
import { CountUp } from "@/components/ui/count-up";
import { Reveal } from "@/components/ui/reveal";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  CHANNELS,
  COMMISSION_PER_DEAL,
  MARKETING_TABS,
  MAX_SPEND,
  NIGHTLY_CHECKS,
  TAG_COVERAGE,
  TAG_COVERAGE_FLOOR,
  TOTAL_LEADS,
  TOTAL_QUALIFIED,
  TOTAL_SPEND,
  TOTAL_WON,
  WON_BAR_SCALE,
  type MarketingTab,
} from "./data";
import { SpendDealsChart } from "./SpendDealsChart";

/**
 * Marketing — the mockup's `ym`: Performance (spend against deals won),
 * Channels (full funnel economics) and Attribution (whether the numbers can be
 * trusted). Read-only reporting; every figure derives from `./data`.
 */

/** "$18.4k" — the mockup's one-decimal thousands. */
const k1 = (n: number) => `$${(n / 1e3).toFixed(1)}k`;
/** "$1,238" */
const dollars = (n: number) => `$${Math.round(n).toLocaleString("en-AU")}`;
/** Commission returned, "$104k". */
const commission = (won: number) => `$${((won * COMMISSION_PER_DEAL) / 1e3).toFixed(0)}k`;
/** Above this a channel's cost per deal is flagged amber on the Channels table. */
const COST_PER_DEAL_CEILING = 2000;

export function MarketingScreen() {
  // The three sections are listed in the Marketing rail, not as a strip in the page.
  const [tab, , dir] = useTabParam(MARKETING_TABS, "performance");

  return (
    <PageContainer>
      <TabPanels value={tab} dir={dir}>
        {tab === "performance" ? <PerformanceTab /> : tab === "channels" ? <ChannelsTab /> : <AttributionTab />}
      </TabPanels>
    </PageContainer>
  );
}

/* ── Performance ──────────────────────────────────────────────────────────── */

function PerformanceTab() {
  const reduce = useReducedMotion();
  const costPerDeal = TOTAL_SPEND / TOTAL_WON;
  const returnOnSpend = (TOTAL_WON * COMMISSION_PER_DEAL) / TOTAL_SPEND;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Marketing performance"
        description="Spend against deals won, sourced from ad platforms and the HubSpot deal mirror. Revenue is commission payable, not contract value."
        actions={<Pill tone="neutral">Kellie · month to date</Pill>}
      />

      <Reveal index={0}>
        <KpiGrid cols={4}>
          <KpiCard
            label="Total spend"
            value={k1(TOTAL_SPEND)}
            icon={DollarSign}
            sub={`across ${CHANNELS.length} channels`}
          />
          <KpiCard label="Deals won" value={TOTAL_WON} icon={Trophy} sub={`from ${TOTAL_LEADS} leads`} />
          <KpiCard
            label="Cost per deal"
            value={dollars(costPerDeal)}
            icon={Target}
            tone="charcoal"
            sub="blended, all channels"
          />
          <KpiCard
            label="Return on spend"
            value={`${returnOnSpend.toFixed(1)}x`}
            icon={TrendingUp}
            sub={`at $${(COMMISSION_PER_DEAL / 1e3).toFixed(1)}k commission a deal`}
          />
        </KpiGrid>
      </Reveal>

      <Reveal index={1}>
        <Card>
          <CardHeader>
            <BarChart3 className="size-4 text-tone-ink" aria-hidden />
            <CardTitle>Spend versus deals won</CardTitle>
            <CardMeta>Last six months</CardMeta>
          </CardHeader>
          <CardContent>
            <SpendDealsChart />
            <div className="mt-2 flex flex-wrap items-center gap-x-3.5 gap-y-1 border-t border-hairline pt-2 text-xs text-muted-foreground">
              {/* On sm+ the strip gutter labels the series; the legend covers phones. */}
              <span className="inline-flex items-center gap-1.5 sm:hidden">
                <span className="inline-block size-2 rounded-[2px] bg-zinc-300 dark:bg-zinc-600" aria-hidden />
                Marketing spend
              </span>
              <span className="inline-flex items-center gap-1.5 sm:hidden">
                <span className="inline-block size-2 rounded-[2px] bg-tone-strong" aria-hidden />
                Deals won
              </span>
              <span className="text-subtle-foreground sm:ml-auto">
                June spend lifted deals two months later — the lag is roughly 60 days
              </span>
            </div>
          </CardContent>
        </Card>
      </Reveal>

      <Reveal index={2}>
        <Card>
          <CardHeader>
            <Target className="size-4 text-tone-ink" aria-hidden />
            <CardTitle>Ad spend versus leads converted</CardTitle>
          </CardHeader>
          <CardContent>
            <ul>
              {CHANNELS.map((c, i) => {
                const convert = (c.won / c.leads) * 100;
                const Icon = c.icon;
                return (
                  <motion.li
                    key={c.name}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.24, ease: EASE_OUT, delay: rowDelay(i, reduce, 0.06, 0.3) }}
                    className="border-t border-hairline py-2.5 first:border-t-0"
                  >
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[13px]">
                      <Icon className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                      <span className="font-medium">{c.name}</span>
                      {/* Phones: the figures drop under the name so "% convert" keeps its line. */}
                      <span className="order-last w-full pl-[22px] text-xs text-muted-foreground tabular-nums sm:order-none sm:w-auto sm:pl-0">
                        {k1(c.spend)} · {c.leads} leads · {c.won} won
                      </span>
                      <span
                        className={cn(
                          "ml-auto font-medium tabular-nums",
                          convert >= 10 ? "text-tone-ink" : "text-foreground",
                        )}
                      >
                        {convert.toFixed(1)}% convert
                      </span>
                    </div>
                    <div className="mt-1.5 flex gap-1">
                      <RateBar
                        value={c.spend / MAX_SPEND}
                        tone="neutral"
                        height="h-[7px]"
                        delay={Math.min(i * 0.08, 0.3)}
                        label={`Spend ${k1(c.spend)}`}
                      />
                      <RateBar
                        value={c.won / WON_BAR_SCALE}
                        height="h-[7px]"
                        delay={Math.min(i * 0.08 + 0.04, 0.34)}
                        label={`${c.won} deals won`}
                      />
                    </div>
                  </motion.li>
                );
              })}
            </ul>
            <p className="mt-2 text-xs text-subtle-foreground">
              Left bar is spend, right bar is deals won. Referral costs least per deal; Meta costs most.
            </p>
          </CardContent>
        </Card>
      </Reveal>
    </div>
  );
}

/* ── Channels ─────────────────────────────────────────────────────────────── */

const MotionRow = motion.create(TableRow);

const CHANNEL_HEADS = ["Channel", "Spend", "Leads", "Qualified", "Won", "Cost/lead", "Cost/deal", "Commission"];

function ChannelsTab() {
  const reduce = useReducedMotion();
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Channel economics"
        description="Full funnel by channel, with cost per lead, cost per deal and commission returned."
      />

      <Reveal index={0} className="flex min-w-0 flex-col gap-2">
        <Card className="min-w-0 overflow-hidden">
          <Table className="text-[13px]">
            <TableHeader>
              <TableRow className="hover:bg-transparent dark:hover:bg-transparent">
                {CHANNEL_HEADS.map((h, i) => (
                  <TableHead key={h} className={cn(i === 0 ? "pl-5" : "text-right", i === CHANNEL_HEADS.length - 1 && "pr-5")}>
                    {h}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {CHANNELS.map((c, i) => {
                const costPerDeal = Math.round(c.spend / c.won);
                return (
                  <MotionRow
                    key={c.name}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.24, ease: EASE_OUT, delay: rowDelay(i, reduce, 0.07, 0.3) }}
                  >
                    <TableCell className="pl-5 font-medium whitespace-nowrap">{c.name}</TableCell>
                    <TableCell className="text-right tabular-nums">{dollars(c.spend)}</TableCell>
                    <TableCell className="text-right tabular-nums">{c.leads}</TableCell>
                    <TableCell className="text-right tabular-nums">{c.qual}</TableCell>
                    <TableCell className="text-right font-medium tabular-nums">{c.won}</TableCell>
                    <TableCell className="text-right text-muted-foreground tabular-nums">
                      {dollars(c.spend / c.leads)}
                    </TableCell>
                    <TableCell
                      className={cn(
                        "text-right tabular-nums",
                        costPerDeal > COST_PER_DEAL_CEILING ? "font-medium text-amber-700 dark:text-amber-300" : "text-foreground",
                      )}
                    >
                      {/* Amber is never the only signal: the mark and the footnote say why. */}
                      {costPerDeal > COST_PER_DEAL_CEILING ? (
                        <AlertTriangle className="mr-1 inline size-3 -translate-y-px" aria-label="Over the cost-per-deal ceiling" />
                      ) : null}
                      {dollars(costPerDeal)}
                    </TableCell>
                    <TableCell className="pr-5 text-right font-medium tabular-nums">
                      {commission(c.won)}
                    </TableCell>
                  </MotionRow>
                );
              })}
              <TableRow className="border-t-2 border-border font-semibold hover:bg-transparent dark:hover:bg-transparent">
                <TableCell className="pl-5">Total</TableCell>
                <TableCell className="text-right tabular-nums">{dollars(TOTAL_SPEND)}</TableCell>
                <TableCell className="text-right tabular-nums">{TOTAL_LEADS}</TableCell>
                <TableCell className="text-right tabular-nums">{TOTAL_QUALIFIED}</TableCell>
                <TableCell className="text-right tabular-nums">{TOTAL_WON}</TableCell>
                <TableCell className="text-right font-normal text-muted-foreground tabular-nums">
                  {dollars(TOTAL_SPEND / TOTAL_LEADS)}
                </TableCell>
                <TableCell className="text-right tabular-nums">{dollars(TOTAL_SPEND / TOTAL_WON)}</TableCell>
                <TableCell className="pr-5 text-right tabular-nums">
                  {commission(TOTAL_WON)}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </Card>
        <p className="max-w-[70ch] text-xs leading-relaxed text-subtle-foreground">
          <AlertTriangle className="mr-1 inline size-3 -translate-y-px text-amber-700 dark:text-amber-300" aria-hidden />
          <span className="font-medium text-amber-700 dark:text-amber-300">Amber</span> marks a channel costing more than{" "}
          {dollars(COST_PER_DEAL_CEILING)} a deal. Commission uses the blended average of $11.5k per deal from the P and
          L. Display home costs are apportioned monthly.
        </p>
      </Reveal>
    </div>
  );
}

/* ── Attribution ──────────────────────────────────────────────────────────── */

function AttributionTab() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Attribution health"
        description="Whether the numbers above can be trusted. Attribution breaks quietly, so it is monitored rather than assumed."
      />

      <Reveal index={0}>
        <div
          role="alert"
          className="pulse-rose rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 dark:border-rose-500/30 dark:bg-rose-500/10"
        >
          <p className="flex items-center gap-2 text-[13px] font-semibold text-rose-700 dark:text-rose-300">
            <AlertTriangle className="size-4 shrink-0" aria-hidden />
            Paid social attribution is under-reporting
          </p>
          <p className="mt-1 text-xs leading-relaxed text-foreground">
            23 of 66 closed-won paid social deals carry an unresolved dynamic parameter in their source tag, so they fall
            into Direct rather than Meta. Meta&apos;s real contribution is higher than the reports show. The fix is a
            one-line change to the ad URL templates, then a back-fill of affected deals.
          </p>
        </div>
      </Reveal>

      <div className="grid items-start gap-5 md:grid-cols-2">
        <Reveal index={1}>
          <Card>
            <CardHeader>
              <CardTitle as="h3" className="text-sm">
                Tag coverage by source
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="flex flex-col gap-2.5">
                {TAG_COVERAGE.map((t, i) => {
                  const low = t.pct < TAG_COVERAGE_FLOOR;
                  return (
                    <li key={t.source}>
                      <div className="flex items-center gap-2 text-xs">
                        <span>{t.source}</span>
                        {low ? (
                          <Pill tone="pending" variant="caps" className="py-0">
                            Below {TAG_COVERAGE_FLOOR}%
                          </Pill>
                        ) : null}
                        <span
                          className={cn(
                            "ml-auto tabular-nums",
                            low ? "font-medium text-amber-700 dark:text-amber-300" : "text-muted-foreground",
                          )}
                        >
                          <CountUp value={`${t.pct}%`} />
                        </span>
                      </div>
                      <RateBar
                        value={t.pct / 100}
                        tone={low ? "pending" : "haven"}
                        className="mt-1"
                        delay={Math.min(i * 0.08, 0.3)}
                        label={`${t.source}: ${t.pct}% tagged`}
                      />
                    </li>
                  );
                })}
              </ul>
            </CardContent>
          </Card>
        </Reveal>

        <Reveal index={2}>
          <Card>
            <CardHeader>
              <CardTitle as="h3" className="text-sm">
                What Launchpad checks nightly
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul>
                {NIGHTLY_CHECKS.map((c) => (
                  <li
                    key={c.check}
                    className="flex items-center gap-2.5 border-t border-hairline py-2 text-xs first:border-t-0"
                  >
                    <Circle className="size-3 shrink-0 text-amber-500 dark:text-amber-400" aria-hidden />
                    <span className="min-w-0 flex-1">{c.check}</span>
                    <span className="shrink-0 text-muted-foreground tabular-nums">{c.found}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-subtle-foreground">
                Anything found here is raised with Kellie before the monthly report goes out.
              </p>
            </CardContent>
          </Card>
        </Reveal>
      </div>
    </div>
  );
}
