"use client";

import * as React from "react";
import { AlertTriangle, ArrowRight, Handshake, HardHat, KeyRound, Timer } from "lucide-react";
import { useLaunchpad } from "@/state/launchpad-store";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/ui/page";
import { Card, CardContent, CardHeader, CardMeta, CardTitle } from "@/components/ui/card";
import { KpiCard, KpiGrid } from "@/components/ui/kpi-card";
import { RateBar } from "@/components/ui/progress";
import { CountUp } from "@/components/ui/count-up";
import { Reveal } from "@/components/ui/reveal";
import { ColumnChart, DonutChart } from "./charts";
import {
  BUILDS_BY_BUILDER,
  OVERVIEW_KPIS,
  PIPELINE_BY_STAGE,
  SALES_BY_MONTH,
  SYNC_HEALTH_STATIC,
  type BuilderSlot,
} from "./data";

/**
 * Builder series colours — validated with the dataviz palette checker against
 * the card surface (light #ffffff, dark #1c1c1f): lightness band, chroma floor,
 * CVD and normal-vision separation between ring neighbours all pass in light.
 * Move Homes steps to skyblue-600 in dark so it clears 3:1 on the dark card.
 * The legend beside the ring carries every value, so no hue is the only signal.
 */
const BUILDER_STROKE: Record<BuilderSlot, string> = {
  forma: "stroke-haven-500",
  move: "stroke-skyblue-700 dark:stroke-skyblue-600",
  lavida: "stroke-nectar-500",
  newchoice: "stroke-skyblue-500",
  newera: "stroke-nectar-700",
};

const BUILDER_SWATCH: Record<BuilderSlot, string> = {
  forma: "bg-haven-500",
  move: "bg-skyblue-700 dark:bg-skyblue-600",
  lavida: "bg-nectar-500",
  newchoice: "bg-skyblue-500",
  newera: "bg-nectar-700",
};

export function BusinessDashboard() {
  const { jobs, openJob } = useLaunchpad();
  const [activeBuilder, setActiveBuilder] = React.useState<string | null>(null);

  // "Open conflicts" is the one Sync health figure the store can answer live —
  // resolve job 25501 in Operations and it drops to 0 here too.
  const conflicts = jobs.filter((j) => j.sync === "conflict");
  const firstConflict = conflicts[0];

  const monthsAria = `Sales won by month: ${SALES_BY_MONTH.map(
    (m) => `${m.month} ${m.value}${m.partial ? " (month to date)" : ""}`,
  ).join(", ")}.`;
  const buildersAria = `Active builds by builder: ${BUILDS_BY_BUILDER.map((b) => `${b.builder} ${b.pct}%`).join(", ")}.`;
  const active = BUILDS_BY_BUILDER.find((b) => b.builder === activeBuilder);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Business dashboard"
        description="Real-time, fed by Launchpad — not month-old exports."
      />

      <Reveal index={0}>
        <KpiGrid cols={4}>
          <KpiCard
            label="Sales this month"
            value={OVERVIEW_KPIS.salesThisMonth}
            icon={Handshake}
            sub="August, month to date"
          />
          <KpiCard
            label="Active builds"
            value={OVERVIEW_KPIS.activeBuilds}
            icon={HardHat}
            tone="charcoal"
            sub={`across ${BUILDS_BY_BUILDER.length} builders`}
          />
          <KpiCard
            label="Handovers YTD"
            value={OVERVIEW_KPIS.handoversYtd}
            icon={KeyRound}
            sub="since 1 January"
          />
          <KpiCard
            label="Avg days, site to keys"
            value={OVERVIEW_KPIS.avgDaysSiteToKeys}
            icon={Timer}
            sub="Date to Site → Key Handover"
          />
        </KpiGrid>
      </Reveal>

      <div className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
        <Reveal index={1} className="min-w-0">
          <Card className="h-full">
            <CardHeader>
              <CardTitle>Sales won by month</CardTitle>
            </CardHeader>
            <CardContent>
              <ColumnChart
                ariaLabel={monthsAria}
                plotHeight={110}
                className="pt-3"
                data={SALES_BY_MONTH.map((m) => ({
                  key: m.month,
                  value: m.value,
                  tone: m.partial ? "base" : "emphasis",
                  top: <CountUp value={m.value} />,
                  bottom: m.month,
                }))}
              />
              <p className="mt-3 flex items-center gap-1.5 text-xs text-subtle-foreground">
                <span className="inline-block size-2 rounded-[2px] bg-zinc-300 dark:bg-zinc-600" aria-hidden />
                August is month to date
              </p>
            </CardContent>
          </Card>
        </Reveal>

        <Reveal index={2} className="min-w-0">
          <Card className="flex h-full flex-col">
            <CardHeader>
              <CardTitle>Active builds by builder</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-1 flex-wrap items-center gap-x-5 gap-y-4 pt-2">
              <DonutChart
                ariaLabel={buildersAria}
                active={activeBuilder}
                onActiveChange={setActiveBuilder}
                data={BUILDS_BY_BUILDER.map((b) => ({
                  key: b.builder,
                  label: b.builder,
                  value: b.pct,
                  stroke: BUILDER_STROKE[b.slot],
                }))}
              >
                {active ? (
                  <>
                    <span className="text-lg leading-none font-bold tabular-nums">{active.pct}%</span>
                    <span className="mt-1 max-w-[76px] truncate text-[10px] text-muted-foreground">{active.builder}</span>
                  </>
                ) : (
                  <>
                    <span className="text-lg leading-none font-bold tabular-nums">
                      <CountUp value={OVERVIEW_KPIS.activeBuilds} />
                    </span>
                    <span className="mt-1 text-[10px] text-muted-foreground">active builds</span>
                  </>
                )}
              </DonutChart>
              <ul className="min-w-[150px] flex-1" onPointerLeave={() => setActiveBuilder(null)}>
                {BUILDS_BY_BUILDER.map((b) => (
                  <li
                    key={b.builder}
                    onPointerEnter={() => setActiveBuilder(b.builder)}
                    className={cn(
                      "flex items-center gap-2 rounded-md px-1.5 py-[3px] text-xs transition-colors",
                      activeBuilder === b.builder && "bg-muted",
                    )}
                  >
                    <span className={cn("inline-block size-2.5 shrink-0 rounded-[3px]", BUILDER_SWATCH[b.slot])} aria-hidden />
                    <span className="min-w-0 flex-1 truncate">{b.builder}</span>
                    <span className="pl-2.5 text-muted-foreground tabular-nums">{b.pct}%</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </Reveal>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <Reveal index={3} className="min-w-0">
          <Card className="h-full">
            <CardHeader>
              <CardTitle>Pipeline value by stage</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2.5 pt-1">
              {PIPELINE_BY_STAGE.map((s, i) => (
                <div key={s.stage}>
                  <div className="flex items-baseline gap-3 text-xs">
                    <span>{s.stage}</span>
                    <span className="ml-auto text-muted-foreground tabular-nums">{s.value}</span>
                  </div>
                  <RateBar
                    value={s.share / 100}
                    className="mt-1"
                    delay={i * 0.06}
                    label={`${s.stage}: ${s.value}, ${s.share}% of pipeline`}
                  />
                </div>
              ))}
            </CardContent>
          </Card>
        </Reveal>

        <Reveal index={4} className="min-w-0">
          <Card className="h-full">
            <CardHeader>
              <CardTitle>Sync health</CardTitle>
              {conflicts.length === 0 ? <CardMeta>HubSpot and Monday agree</CardMeta> : null}
            </CardHeader>
            <CardContent className="pt-0.5">
              <ul>
                {SYNC_HEALTH_STATIC.map((r) => (
                  <li key={r.label} className="flex items-baseline border-b border-hairline py-[7px] text-xs">
                    <span className="text-muted-foreground">{r.label}</span>
                    <span className="ml-auto font-semibold tabular-nums">{r.value}</span>
                  </li>
                ))}
                <li className="border-b border-hairline text-xs">
                  {firstConflict ? (
                    <button
                      type="button"
                      onClick={() => openJob(firstConflict.id)}
                      aria-label={`Open conflicts: ${conflicts.length}. Open job ${firstConflict.jobNo} to resolve.`}
                      className="group -mx-2 flex w-[calc(100%+1rem)] items-baseline rounded-md px-2 py-[7px] text-left transition-colors hover:bg-rose-50 dark:hover:bg-rose-500/10"
                    >
                      <span className="text-muted-foreground">Open conflicts</span>
                      <span className="ml-auto flex items-center gap-1.5 self-center font-semibold text-rose-700 tabular-nums dark:text-rose-300">
                        <AlertTriangle className="size-3" aria-hidden />
                        {conflicts.length}
                        <ArrowRight
                          className="size-3 text-subtle-foreground transition-transform group-hover:translate-x-0.5"
                          aria-hidden
                        />
                      </span>
                    </button>
                  ) : (
                    <div className="flex items-baseline py-[7px]">
                      <span className="text-muted-foreground">Open conflicts</span>
                      <span className="ml-auto font-semibold tabular-nums">0</span>
                    </div>
                  )}
                </li>
              </ul>
              <p className="mt-3 text-xs text-subtle-foreground">
                Numbers Ailid can trust — same data the reps and ops see.
              </p>
            </CardContent>
          </Card>
        </Reveal>
      </div>
    </div>
  );
}
