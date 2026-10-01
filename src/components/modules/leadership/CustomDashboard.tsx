"use client";

import * as React from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Check, FileText, LayoutDashboard, Save } from "lucide-react";
import { confirm } from "@/state/launchpad-store";
import { cn } from "@/lib/utils";
import { EASE_OUT } from "@/lib/motion";
import { PageHeader } from "@/components/ui/page";
import { Card, CardContent, CardFooter, CardHeader, CardMeta, CardTitle } from "@/components/ui/card";
import { KpiCard } from "@/components/ui/kpi-card";
import { Pill } from "@/components/ui/pill";
import { Button } from "@/components/ui/button";
import { SlidingTabs } from "@/components/ui/sliding-tabs";
import { Avatar } from "@/components/ui/avatar";
import { Reveal } from "@/components/ui/reveal";
import { ColumnChart } from "./charts";
import { JarvisPanel } from "./JarvisPanel";
import { ReportDialog } from "./ReportDialog";
import type { CustomDashboardState } from "./useCustomDashboard";
import {
  DEALS_BY_CHANNEL,
  DEALS_BY_REP,
  FORECAST,
  METRIC_GROUPS,
  METRICS,
  PERIODS,
  SAVED_VIEWS,
  type Metric,
} from "./data";

/**
 * Custom dashboard — the mockup's report builder (`km`): pick metrics from the
 * library, watch them land in the live preview, export a Leadership report, or
 * ask Jarvis, which answers from the same figures and adds what it cites.
 */
export function CustomDashboard({ state }: { state: CustomDashboardState }) {
  const { selected, toggle, period, setPeriod, setReportOpen, flash } = state;
  const kpis = METRICS.filter((m) => selected.includes(m.id) && m.type === "kpi");
  const activeView = SAVED_VIEWS.find((v) => v.active);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Leadership"
        title={
          <>
            Custom dashboard{" "}
            <Pill tone="neutral" className="ml-1 align-middle font-sans tracking-normal">
              Adam · saved view
            </Pill>
          </>
        }
        description="Choose what you want to see, preview it live, then export it. Everything reads from the same mirrored data the rest of Launchpad uses, so these numbers match what the teams see."
        actions={
          <SlidingTabs
            value={period}
            onChange={setPeriod}
            ariaLabel="Reporting period"
            items={PERIODS.map((p) => ({ value: p, label: p }))}
          />
        }
      />

      <div className="grid items-start gap-5 lg:grid-cols-[0.72fr_1.28fr]">
        <div className="flex min-w-0 flex-col gap-5">
          <Reveal index={0}>
            <MetricLibrary selected={selected} onToggle={toggle} />
          </Reveal>
          <Reveal index={1}>
            <Card>
              <CardHeader>
                <PanelLabel>Saved views</PanelLabel>
              </CardHeader>
              <CardContent>
                <ul>
                  {SAVED_VIEWS.map((v) => (
                    <li
                      key={v.name}
                      className="flex items-center gap-2 border-t border-hairline py-1.5 text-xs first:border-t-0"
                    >
                      {v.active ? (
                        <Check className="size-3 shrink-0 text-haven-700 dark:text-haven-300" aria-hidden />
                      ) : (
                        <span className="size-3 shrink-0 rounded-full border border-granite/50 dark:border-zinc-500" aria-hidden />
                      )}
                      <span className={v.active ? "font-medium text-foreground" : "text-muted-foreground"}>
                        {v.name}
                        {v.active ? <span className="sr-only"> (current view)</span> : null}
                      </span>
                    </li>
                  ))}
                </ul>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2.5 w-full"
                  onClick={() =>
                    confirm(
                      `Saved “${activeView?.name ?? "Custom dashboard"}”`,
                      `${selected.length} widget${selected.length === 1 ? "" : "s"} · ${period}`,
                    )
                  }
                >
                  <Save /> Save this view
                </Button>
              </CardContent>
            </Card>
          </Reveal>
        </div>

        <div className="flex min-w-0 flex-col gap-5">
          <Reveal index={1}>
            <Card className="border-haven-300 dark:border-haven-800">
              <CardHeader className="pb-3">
                <CardTitle>Preview</CardTitle>
                <Pill tone="skyblue">{period}</Pill>
                <CardMeta>
                  {selected.length} widget{selected.length !== 1 ? "s" : ""}
                </CardMeta>
              </CardHeader>
              <CardContent className="@container flex flex-col gap-5">
                {selected.length === 0 ? (
                  <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border px-4 py-9 text-center text-xs text-subtle-foreground">
                    <LayoutDashboard className="size-5" aria-hidden />
                    Pick metrics on the left and they appear here.
                  </div>
                ) : null}

                {kpis.length > 0 ? <PreviewKpis kpis={kpis} flash={flash} /> : null}

                <AnimatePresence initial={false}>
                  {selected.includes("forecast") ? (
                    <Widget key="forecast" title="Forecast next 3 months" flash={flash === "forecast"}>
                      <ForecastBars />
                    </Widget>
                  ) : null}
                  {selected.includes("byrep") ? (
                    <Widget key="byrep" title="Deals by rep" flash={flash === "byrep"}>
                      <ul>
                        {DEALS_BY_REP.map((r) => (
                          <li
                            key={r.rep}
                            className="flex items-center gap-2 border-t border-hairline py-1.5 text-xs"
                          >
                            <Avatar name={r.rep} size="xs" />
                            <span>{r.rep}</span>
                            <span className="ml-auto text-muted-foreground tabular-nums">
                              {r.deals} deals · {r.value}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </Widget>
                  ) : null}
                  {selected.includes("channel") ? (
                    <Widget key="channel" title="Deals won by channel" flash={flash === "channel"}>
                      <ul>
                        {DEALS_BY_CHANNEL.map((c) => (
                          <li key={c.channel} className="flex items-center border-t border-hairline py-1.5 text-xs">
                            <span>{c.channel}</span>
                            <span className="ml-auto text-muted-foreground tabular-nums">{c.won} won</span>
                          </li>
                        ))}
                      </ul>
                    </Widget>
                  ) : null}
                </AnimatePresence>
              </CardContent>
              <CardFooter className="justify-end">
                <Button onClick={() => setReportOpen(true)} disabled={selected.length === 0}>
                  <FileText /> Generate report
                </Button>
              </CardFooter>
            </Card>
          </Reveal>

          <Reveal index={2}>
            <JarvisPanel state={state} />
          </Reveal>
        </div>
      </div>

      <ReportDialog state={state} kpis={kpis} />
    </div>
  );
}

/** Tiny-caps panel label — the mockup's builder side panels use caps, not the serif title. */
function PanelLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-[10.5px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">{children}</h2>
  );
}

function MetricLibrary({
  selected,
  onToggle,
}: {
  selected: CustomDashboardState["selected"];
  onToggle: CustomDashboardState["toggle"];
}) {
  return (
    <Card>
      <CardHeader>
        <PanelLabel>Metric library</PanelLabel>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {METRIC_GROUPS.map((g) => (
          <div key={g} role="group" aria-labelledby={`metric-group-${g}`}>
            <p id={`metric-group-${g}`} className="mb-1 text-[11px] text-subtle-foreground">
              {g}
            </p>
            <div className="flex flex-col gap-0.5">
              {METRICS.filter((m) => m.group === g).map((m) => {
                const on = selected.includes(m.id);
                return (
                  <button
                    key={m.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() => onToggle(m.id)}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-lg border px-2.5 py-1.5 text-left text-xs transition-colors focus-visible:ring-3 focus-visible:ring-ring/45 focus-visible:outline-none",
                      on
                        ? "border-haven-300 bg-haven-50 text-foreground dark:border-haven-800 dark:bg-haven-950/40"
                        : "border-transparent text-foreground hover:bg-muted",
                    )}
                  >
                    <span
                      className={cn(
                        "flex size-3.5 shrink-0 items-center justify-center rounded-full transition-colors",
                        on
                          ? "bg-haven-600 text-white dark:bg-haven-300 dark:text-haven-950"
                          : "border border-granite/50 dark:border-zinc-500",
                      )}
                      aria-hidden
                    >
                      {on ? <Check className="size-2.5" strokeWidth={3} /> : null}
                    </span>
                    <span className="min-w-0 flex-1">{m.label}</span>
                    {m.type !== "kpi" ? (
                      <span className="text-[9px] font-semibold tracking-[0.1em] text-subtle-foreground uppercase">
                        {m.type}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function PreviewKpis({ kpis, flash }: { kpis: Metric[]; flash: CustomDashboardState["flash"] }) {
  const reduce = useReducedMotion();
  return (
    <div className="grid grid-cols-1 gap-3 @sm:grid-cols-2 @xl:grid-cols-3">
      <AnimatePresence initial={false} mode="popLayout">
        {kpis.map((m) => (
          <motion.div
            key={m.id}
            layout={reduce ? false : "position"}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduce ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0, scale: 0.96, transition: { duration: 0.16 } }}
            transition={{ duration: reduce ? 0 : 0.24, ease: EASE_OUT }}
          >
            <KpiCard
              size="sm"
              label={m.label}
              value={m.value ?? "—"}
              sub={m.delta}
              pulse={flash === m.id}
              className="h-full"
            />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

const Widget = React.forwardRef<
  HTMLElement,
  { title: string; flash: boolean; children: React.ReactNode }
>(function Widget({ title, flash, children }, ref) {
  const reduce = useReducedMotion();
  return (
    <motion.section
      ref={ref}
      layout={reduce ? false : "position"}
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={reduce ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0, transition: { duration: 0.14 } }}
      transition={{ duration: reduce ? 0 : 0.24, ease: EASE_OUT }}
      className={cn("rounded-lg", flash && "pulse-haven")}
    >
      <h3 className="mb-2 text-xs font-semibold">{title}</h3>
      {children}
    </motion.section>
  );
});

function ForecastBars() {
  const peak = Math.max(...FORECAST.map((f) => f.value));
  return (
    <ColumnChart
      plotHeight={78}
      barClassName="max-w-[72px]"
      gapClassName="gap-3"
      ariaLabel={`Forecast next 3 months, commission receipts: ${FORECAST.map((f) => `${f.month} $${f.value}k`).join(", ")}.`}
      data={FORECAST.map((f) => ({
        key: f.month,
        value: f.value,
        tone: f.value === peak ? "haven" : "skyblue",
        bottom: `${f.month} · $${f.value}k`,
      }))}
    />
  );
}
