"use client";

import * as React from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import { Archive, CircleCheck, FlaskConical, FolderKanban, Hourglass, Inbox, Siren, TicketPlus } from "lucide-react";
import { cn } from "@/lib/utils";
import { DURATION, rowDelay } from "@/lib/motion";
import { dashboardById, hrefForKey } from "@/components/shell/dashboards";
import { useTickets } from "@/state/tickets-store";
import { Card, CardContent, CardHeader, CardMeta, CardTitle } from "@/components/ui/card";
import { RateBar, type BarTone } from "@/components/ui/progress";
import { Reveal } from "@/components/ui/reveal";
import { DashboardOverview } from "../overview/DashboardOverview";
import {
  PRIORITY_STYLES,
  PROJECTS,
  STATUS_FILL,
  STATUS_LABEL,
  TICKET_STATUSES,
  dashboardName,
  formatTicketNo,
  type TicketPriority,
} from "./data";
import { ageLabel, openByDashboard, openByPriority, projectProgress, relativeTime, statusSplit, ticketStats } from "./logic";
import { StatusLabel } from "./TicketCard";

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

const PRIORITY_BAR: Record<TicketPriority, BarTone> = { urgent: "problem", high: "pending", medium: "neutral", low: "neutral" };

/**
 * Tickets › Overview. Read from the tickets store, so raising a ticket on any
 * dashboard, dragging one to Done or archiving one moves these figures. Each
 * card opens the section its figure comes from, filtered to match.
 */
export function TicketsOverview() {
  const reduce = useReducedMotion();
  const { tickets } = useTickets();
  // Ages and "this week" count from now. Read once per render.
  const now = Date.now();
  const stats = ticketStats(tickets, now);
  const split = statusSplit(tickets);
  const byDash = openByDashboard(tickets);
  const byPriority = openByPriority(tickets);
  const onBoard = TICKET_STATUSES.reduce((n, s) => n + split[s], 0);
  const progress = PROJECTS.map((p) => ({ p, progress: projectProgress(p, tickets) }));
  const closest = [...progress].filter((x) => x.progress.pct != null).sort((a, b) => b.progress.pct! - a.progress.pct!)[0];
  const recent = [...tickets].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 6);
  const change = stats.raisedThisWeek - stats.raisedLastWeek;
  const mostDash = Math.max(1, ...byDash.map((d) => d.count));
  const mostPriority = Math.max(1, ...byPriority.map((d) => d.count));

  return (
    <DashboardOverview
      title="Tickets overview"
      description="Improvements asked for across the Launchpad, how the board is moving, and how each project is going."
      headline={[
        {
          label: "Open now",
          value: stats.open,
          sub: `${split.todo} to do · ${split.in_progress} in progress · ${split.testing} testing`,
          icon: Inbox,
          to: "tickets:board",
        },
        {
          label: "Raised this week",
          value: stats.raisedThisWeek,
          sub:
            change === 0
              ? `same as last week (${stats.raisedLastWeek})`
              : `${change > 0 ? "+" : "−"}${Math.abs(change)} on last week (${stats.raisedLastWeek})`,
          icon: TicketPlus,
          tone: "tone",
          to: "tickets:board",
        },
        {
          label: "In testing",
          value: stats.testing,
          sub: stats.testing ? "waiting on a check before Done" : "nothing waiting on a check",
          icon: FlaskConical,
          tone: "pending",
          to: "tickets:board",
        },
        {
          label: "Done this week",
          value: stats.doneThisWeek,
          sub: `${split.done} done on the board`,
          icon: CircleCheck,
          tone: "ok",
          to: "tickets:board",
        },
      ]}
      moreLabel="Queue health"
      more={[
        stats.oldestOpen
          ? {
              label: "Oldest open",
              value: ageLabel(stats.oldestOpen.createdAt, now),
              sub: `${formatTicketNo(stats.oldestOpen.no)} · ${stats.oldestOpen.title}`,
              icon: Hourglass,
              to: "tickets:board",
              query: { ticket: String(stats.oldestOpen.no) },
            }
          : { label: "Oldest open", value: "—", sub: "nothing open", icon: Hourglass, to: "tickets:board" },
        {
          label: "Urgent open",
          value: stats.urgentOpen,
          sub: stats.urgentOpen ? "filter the board to them" : "none urgent",
          icon: Siren,
          tone: stats.urgentOpen ? "problem" : "ok",
          to: "tickets:board",
          query: { priority: "urgent" },
        },
        {
          label: "Projects",
          value: PROJECTS.length,
          sub: closest ? `closest to done: ${closest.p.name} · ${closest.progress.pct}%` : "no project tickets yet",
          icon: FolderKanban,
          tone: "charcoal",
          to: "tickets:projects",
        },
        {
          label: "Archived",
          value: stats.archived,
          sub: stats.archived ? "off the board, restorable" : "nothing archived",
          icon: Archive,
          to: "tickets:archived",
        },
      ]}
    >
      <div className="grid items-start gap-5 lg:grid-cols-2">
        <Reveal index={2}>
          <Card>
            <CardHeader>
              <CardTitle>Open by dashboard</CardTitle>
              <CardMeta>{plural(stats.open, "open ticket")}</CardMeta>
            </CardHeader>
            <CardContent>
              {byDash.length ? (
                <ul className="flex flex-col gap-1 pt-1">
                  {byDash.map((d, i) => {
                    const Icon = dashboardById(d.dashboard).icon;
                    return (
                      <li key={d.dashboard}>
                        <Link
                          href={hrefForKey("tickets:board", { dash: d.dashboard })}
                          className="block rounded-lg px-2 py-1.5 outline-none transition-colors hover:bg-tone-soft/60 focus-visible:ring-3 focus-visible:ring-ring/45"
                        >
                          <span className="mb-1.5 flex items-baseline gap-3 text-xs">
                            <Icon className="size-3.5 shrink-0 self-center text-subtle-foreground" aria-hidden />
                            <span className="min-w-0 flex-1 truncate font-medium">{dashboardName(d.dashboard)}</span>
                            <span className="shrink-0 text-muted-foreground tabular-nums">{d.count}</span>
                          </span>
                          <RateBar
                            value={d.count / mostDash}
                            height="h-[6px]"
                            delay={rowDelay(i, reduce, 0.05, 0.4)}
                            label={`${dashboardName(d.dashboard)}: ${plural(d.count, "open ticket")}`}
                          />
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="py-6 text-center text-xs text-muted-foreground">Nothing open on any dashboard.</p>
              )}
            </CardContent>
          </Card>
        </Reveal>

        <div className="flex min-w-0 flex-col gap-5">
          <Reveal index={3}>
            <Card>
              <CardHeader>
                <CardTitle>Board split</CardTitle>
                <CardMeta>{plural(onBoard, "ticket")}</CardMeta>
              </CardHeader>
              <CardContent>
                <div
                  className="flex h-3 w-full gap-[2px] overflow-hidden rounded-full bg-muted"
                  role="img"
                  aria-label={TICKET_STATUSES.map((s) => `${STATUS_LABEL[s]} ${split[s]}`).join(", ")}
                >
                  {TICKET_STATUSES.map((s, i) =>
                    split[s] ? (
                      <motion.span
                        key={s}
                        className={cn("h-full first:rounded-l-full last:rounded-r-full", STATUS_FILL[s])}
                        initial={{ width: 0 }}
                        animate={{ width: `${(split[s] / Math.max(1, onBoard)) * 100}%` }}
                        transition={{ duration: reduce ? 0 : DURATION.fill, ease: [0.16, 1, 0.3, 1], delay: reduce ? 0 : 0.1 + i * 0.06 }}
                      />
                    ) : null,
                  )}
                </div>
                <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs sm:grid-cols-4">
                  {TICKET_STATUSES.map((s) => (
                    <li key={s} className="flex items-center justify-between gap-2">
                      <StatusLabel status={s} className="text-muted-foreground" />
                      <span className="font-semibold tabular-nums">{split[s]}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </Reveal>

          <Reveal index={4}>
            <Card>
              <CardHeader>
                <CardTitle>Open by priority</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="flex flex-col gap-1">
                  {byPriority.map((p, i) => (
                    <li key={p.priority}>
                      <Link
                        href={hrefForKey("tickets:board", { priority: p.priority })}
                        className="block rounded-lg px-2 py-1.5 outline-none transition-colors hover:bg-tone-soft/60 focus-visible:ring-3 focus-visible:ring-ring/45"
                      >
                        <span className="mb-1.5 flex items-center gap-2 text-xs">
                          <span className={cn("size-2 rounded-full", PRIORITY_STYLES[p.priority].dot)} aria-hidden />
                          <span className="flex-1 font-medium">{PRIORITY_STYLES[p.priority].label}</span>
                          <span className="text-muted-foreground tabular-nums">{p.count}</span>
                        </span>
                        <RateBar
                          value={p.count / mostPriority}
                          tone={PRIORITY_BAR[p.priority]}
                          height="h-[6px]"
                          delay={rowDelay(i, reduce, 0.06, 0.3)}
                          label={`${PRIORITY_STYLES[p.priority].label}: ${plural(p.count, "open ticket")}`}
                        />
                      </Link>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </Reveal>
        </div>
      </div>

      <Reveal index={5}>
        <Card>
          <CardHeader>
            <CardTitle>Recent activity</CardTitle>
            <CardMeta>last {recent.length} updated</CardMeta>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col">
              {recent.map((t) => (
                <li key={t.no} className="border-t border-hairline first:border-t-0">
                  <Link
                    href={hrefForKey("tickets:overview", { ticket: String(t.no) })}
                    scroll={false}
                    className="-mx-2 flex flex-col gap-1 rounded-lg px-2 py-2.5 outline-none transition-colors hover:bg-tone-soft/60 focus-visible:ring-3 focus-visible:ring-ring/45 sm:flex-row sm:items-center sm:gap-3"
                  >
                    <span className="flex min-w-0 flex-1 items-center gap-2">
                      <span className="shrink-0 font-mono text-xs text-muted-foreground">{formatTicketNo(t.no)}</span>
                      <span className="truncate text-[13px] font-medium">{t.title}</span>
                    </span>
                    <span className="flex shrink-0 items-center gap-3 text-xs text-muted-foreground">
                      {t.archived ? <span>Archived</span> : <StatusLabel status={t.status} />}
                      <span className="w-16 text-right tabular-nums" suppressHydrationWarning>
                        {relativeTime(t.updatedAt, now)}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </Reveal>
    </DashboardOverview>
  );
}
