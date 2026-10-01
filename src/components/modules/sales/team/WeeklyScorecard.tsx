"use client";

import * as React from "react";
import { BarChart3, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardMeta, CardTitle } from "@/components/ui/card";
import { Pill } from "@/components/ui/pill";
import { RateBar } from "@/components/ui/progress";
import { Reveal } from "@/components/ui/reveal";
import { SlidingTabs } from "@/components/ui/sliding-tabs";
import { Dash, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  ATTACH_RATE,
  FORECAST,
  FORECAST_BUILDERS,
  FORECAST_NOTE,
  PERIODS,
  SCORECARD_WIDGETS,
  TEAM_AGAINST_TEAM,
  TEAM_FILTERS,
  TEAMS,
  inTeam,
  type Period,
  type ScorecardWidget,
  type TeamFilter,
} from "../data";
import { Footnote, Legend, ManagersOnly, StackedBar } from "../parts";

/**
 * Team › Weekly scorecard — the ten HubSpot widgets a manager used to rebuild
 * per owner filter, driven by one team selector. Period changes the forecast
 * table and its notes; the widgets are the mockup's single snapshot.
 */
export function WeeklyScorecard() {
  const [period, setPeriod] = React.useState<Period>("Last week");
  const [team, setTeam] = React.useState<TeamFilter>("Quentin's reps");
  const forecast = FORECAST[period].filter(([rep]) => inTeam(team, rep));
  const attach = ATTACH_RATE.filter(([rep]) => inTeam(team, rep));

  return (
    <section aria-labelledby="weekly-scorecard" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-2">
        <BarChart3 className="size-4 text-haven-700 dark:text-haven-300" aria-hidden />
        <h2 id="weekly-scorecard" className="font-heading text-[15px] font-bold tracking-tight">
          Weekly scorecard
        </h2>
        <ManagersOnly />
        <SlidingTabs
          ariaLabel="Scorecard period"
          value={period}
          onChange={setPeriod}
          items={PERIODS.map((p) => ({ value: p, label: p }))}
          className="sm:ml-auto"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">Team</span>
        <SlidingTabs
          ariaLabel="Team"
          value={team}
          onChange={setTeam}
          items={TEAM_FILTERS.map((t) => ({ value: t, label: t, icon: t === "Quentin's reps" ? Users : undefined }))}
        />
      </div>

      <p className="text-xs text-muted-foreground">
        Showing{" "}
        <strong className="font-semibold text-foreground">
          {team === "All sales" ? "every sales rep" : `${team} · ${(TEAMS[team] ?? []).length} reps`}
        </strong>
        , {period.toLowerCase()}. Your own team is selected by default. Managers can switch; reps never see this page.
      </p>

      {team === "Quentin's reps" ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-[12px] leading-relaxed text-amber-950 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
          <strong className="font-semibold">Heads up:</strong> this group is currently a manual list, not a team. In
          HubSpot these reps are spread across two teams, and three of them belong to no team at all, so each of the ten
          widgets carries its own hand-picked owner filter. In Launchpad the team is defined once and every report
          follows it.
        </p>
      ) : null}

      {team === "All sales" ? (
        <Card className="border-haven-300 dark:border-haven-800">
          <CardHeader>
            <CardTitle as="h3" className="font-sans text-[13px]">
              Team against team
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul>
              {TEAM_AGAINST_TEAM.map(([name, reps, calls, connected, appts, won]) => (
                <li
                  key={name}
                  className="flex flex-wrap items-center gap-x-3 gap-y-0.5 border-t border-hairline py-2 first:border-t-0"
                >
                  <button
                    type="button"
                    onClick={() => setTeam(name as TeamFilter)}
                    className="min-w-[170px] text-left text-xs font-semibold hover:text-haven-700 hover:underline dark:hover:text-haven-300"
                  >
                    {name}
                  </button>
                  <span className="text-[11px] text-muted-foreground tabular-nums">{reps} reps</span>
                  <span className="text-[11px] text-muted-foreground tabular-nums">{calls} calls</span>
                  <span className="text-[11px] text-muted-foreground tabular-nums">{connected} connected</span>
                  <span className="text-[11px] text-muted-foreground tabular-nums">{appts} appts</span>
                  <span className="ml-auto text-xs font-semibold text-haven-700 tabular-nums dark:text-haven-300">
                    {won} won
                  </span>
                </li>
              ))}
            </ul>
            <Footnote className="mt-1.5">
              Select a team above to drill into it. Sean and leadership see this rollup by default.
            </Footnote>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {SCORECARD_WIDGETS.map((w, i) => (
          <Reveal key={w.t} index={i}>
            <ScorecardCard widget={w} team={team} />
          </Reveal>
        ))}
      </div>

      <Card className="border-haven-300 dark:border-haven-800">
        <CardHeader>
          <CardTitle as="h3" className="font-sans text-[13px]">
            Signed against forecast, by builder
          </CardTitle>
          <Pill tone="skyblue" className="text-[11px]">
            {period}
          </Pill>
          <CardMeta className="text-[10.5px]">Replaces the Monday scorecard spreadsheet</CardMeta>
        </CardHeader>
        <CardContent className="flex min-w-0 flex-col gap-2.5">
          <p className="text-[11.5px] text-muted-foreground">
            Signed comes from the CRM automatically. Forecast is what each rep submitted in My week. Nobody types
            anything into a spreadsheet.
          </p>
          <p className="rounded-lg border border-haven-300 bg-haven-50 px-3 py-2 text-[11.5px] leading-relaxed text-haven-950 dark:border-haven-800 dark:bg-haven-950/40 dark:text-haven-100">
            {FORECAST_NOTE[period]}
          </p>
          <Table className="text-xs">
            <TableHeader>
              <TableRow className="hover:bg-transparent dark:hover:bg-transparent">
                <TableHead className="pl-0">Rep</TableHead>
                {FORECAST_BUILDERS.map(([short, full]) => (
                  <TableHead key={short} className="px-1.5 text-center">
                    <abbr title={full} className="no-underline">
                      {short}
                    </abbr>
                  </TableHead>
                ))}
                <TableHead className="pr-0 text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {forecast.length === 0 ? (
                <TableRow className="hover:bg-transparent dark:hover:bg-transparent">
                  <TableCell colSpan={FORECAST_BUILDERS.length + 2} className="py-4 text-center text-[11px] text-subtle-foreground">
                    No forecasts from this team in the period.
                  </TableCell>
                </TableRow>
              ) : (
                forecast.map(([rep, cells]) => {
                  const signed = cells.reduce((a, c) => a + c[0], 0);
                  const target = cells.reduce((a, c) => a + c[1], 0);
                  return (
                    <TableRow key={rep}>
                      <TableCell className="py-2 pl-0 font-semibold whitespace-nowrap">{rep}</TableCell>
                      {cells.map(([s, f], ci) => (
                        <TableCell key={ci} className="px-1.5 py-2 text-center tabular-nums">
                          {s === 0 && f === 0 ? (
                            <Dash />
                          ) : (
                            <span>
                              <strong className="font-semibold">{s}</strong>
                              <span className="text-muted-foreground"> / {f}</span>
                            </span>
                          )}
                        </TableCell>
                      ))}
                      <TableCell
                        className={cn(
                          "py-2 pr-0 text-right font-semibold whitespace-nowrap tabular-nums",
                          signed >= target ? "text-emerald-700 dark:text-emerald-300" : "text-amber-700 dark:text-amber-300",
                        )}
                      >
                        {signed} / {target}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
          <div className="flex flex-wrap gap-x-3 gap-y-1 border-t border-hairline pt-2 text-[11px]">
            <span className="text-muted-foreground">
              Format is <strong className="font-semibold text-foreground">signed / forecast</strong>
            </span>
            {period === "Last week" ? (
              <span className="font-medium text-rose-700 dark:text-rose-300">
                Not yet submitted this Monday: Kristen Margetts, Emily Dann
              </span>
            ) : (
              <span className="text-muted-foreground">
                Forecast accuracy this {period === "This month" ? "month" : "quarter"}: within one on 4 of 5 reps
              </span>
            )}
            <span className="text-subtle-foreground sm:ml-auto">Feeds the cashflow forecast in Accounts</span>
          </div>
        </CardContent>
      </Card>

      <Card className="border-haven-300 dark:border-haven-800">
        <CardHeader>
          <CardTitle as="h3" className="font-sans text-[13px]">
            Locale Financial attach rate
          </CardTitle>
          <CardMeta className="text-[10.5px]">Internal · external · cash, all time</CardMeta>
          <p className="w-full text-[11.5px] text-muted-foreground">
            How often each rep refers finance in house. The clearest cross-sell number in the business.
          </p>
        </CardHeader>
        <CardContent>
          {attach.length === 0 ? (
            <p className="py-2 text-[11px] text-subtle-foreground">No activity for this team in the period.</p>
          ) : (
            <ul>
              {attach.map(([rep, internal, external, cash], i) => {
                const total = internal + external + cash;
                const rate = total > 0 ? internal / total : 0;
                return (
                  <li key={rep} className="grid grid-cols-[7.5rem_1fr_2.75rem] items-center gap-2.5 border-t border-hairline py-1.5 first:border-t-0">
                    <span className="truncate text-[11px] text-muted-foreground" title={rep}>
                      {rep}
                    </span>
                    <StackedBar
                      delay={Math.min(i * 0.04, 0.3)}
                      label={`${rep}: internal ${internal}, external ${external}, cash ${cash}`}
                      segments={[
                        { value: internal, tone: "haven", title: "Internal" },
                        { value: external, tone: "skyblue", title: "External" },
                        { value: cash, tone: "charcoal", title: "Cash" },
                      ]}
                    />
                    <span
                      className={cn(
                        "text-right text-[11px] font-semibold tabular-nums",
                        rate >= 0.6 ? "text-emerald-700 dark:text-emerald-300" : "text-amber-700 dark:text-amber-300",
                      )}
                    >
                      {Math.round(rate * 100)}%
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
          <Legend
            className="mt-2.5"
            items={[
              { label: "Internal, Locale Financial", tone: "haven" },
              { label: "External broker", tone: "skyblue" },
              { label: "Cash", tone: "charcoal" },
            ]}
          />
        </CardContent>
      </Card>
    </section>
  );
}

function ScorecardCard({ widget, team }: { widget: ScorecardWidget; team: TeamFilter }) {
  const rows = widget.d.filter(([rep]) => inTeam(team, rep));
  const max = Math.max(1, ...rows.map((r) => r[1]));
  return (
    <Card className="h-full px-3.5 py-3">
      <div className="mb-2 flex items-baseline gap-2">
        <h3 className="text-[12.5px] font-semibold">{widget.t}</h3>
        <span className="ml-auto text-[10px] text-subtle-foreground">{widget.sub}</span>
      </div>
      {rows.length === 0 ? (
        <p className="py-1.5 text-[11px] text-subtle-foreground">No activity for this team in the period.</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {rows.slice(0, 8).map(([rep, n], i) => (
            <li key={rep} className="grid grid-cols-[6.5rem_1fr_1.75rem] items-center gap-2">
              <span className="truncate text-[11px] text-muted-foreground" title={rep}>
                {rep}
              </span>
              <RateBar
                value={n / max}
                height="h-2"
                tone={widget.alert ? "problem" : i === 0 ? "haven" : "skyblue"}
                delay={Math.min(i * 0.04, 0.3)}
                label={`${rep}: ${n}`}
                className={i === 0 ? undefined : widget.alert ? "[&>div]:opacity-45" : "[&>div]:opacity-60"}
              />
              <span
                className={cn(
                  "text-right text-[11px] font-semibold tabular-nums",
                  widget.alert && i === 0 ? "text-rose-700 dark:text-rose-300" : "text-foreground",
                )}
              >
                {n}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
