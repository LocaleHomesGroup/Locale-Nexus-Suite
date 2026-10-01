"use client";

import * as React from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  CalendarPlus,
  Gift,
  HardHat,
  Inbox,
  Map,
  PartyPopper,
  ShieldCheck,
  Sparkles,
  UserPlus,
  Users,
} from "lucide-react";
import { useLaunchpad, confirm, type ModuleId } from "@/state/launchpad-store";
import { cn } from "@/lib/utils";
import { PageContainer } from "@/components/ui/page";
import { Card, CardContent, CardHeader, CardMeta, CardRow, CardTitle } from "@/components/ui/card";
import { KpiCard, KpiGrid } from "@/components/ui/kpi-card";
import { Pill } from "@/components/ui/pill";
import { Button } from "@/components/ui/button";
import { SearchInput } from "@/components/ui/input";
import { Avatar } from "@/components/ui/avatar";
import { BrandShapes } from "@/components/ui/brand-shapes";
import { Reveal } from "@/components/ui/reveal";
import { SyncBadge } from "@/components/ui/sync-badge";
// One source of truth for the Popular titles and the search that finds each.
import { POPULAR } from "@/components/modules/knowledge/data";

export const ANNOUNCEMENTS = [
  {
    title: "Launchpad is live in pilot",
    body: "CRM Dash Sync is now syncing milestones to HubSpot and Monday automatically. Ops: updates entered once now land everywhere.",
    meta: "Today · Jerry",
    pinned: true,
  },
  {
    title: "August builder price lists published",
    body: "Move Homes and Forma are current. La Vida in review — hold quotes on affected models until Thursday.",
    meta: "Yesterday · Yasmin",
    pinned: false,
  },
  {
    title: "New phishing simulation this month",
    body: "Check sender addresses before clicking. When unsure, forward to support@localegroup.au.",
    meta: "Mon · IT",
    pinned: false,
  },
];

export const COMING_UP = [
  { title: "Sales training · objection handling", when: "Tue 12 Aug, 9:00am", where: "Subiaco boardroom", icon: BookOpen },
  { title: "Peet land release · Seaside Rise stage 4", when: "Thu 14 Aug", where: "Titles expected Mar 2027", icon: Map },
  { title: "Sales awards · July winners", when: "Fri 15 Aug, 4:00pm", where: "Drinks after", icon: Sparkles },
  { title: "Team day · end of quarter", when: "Fri 29 Aug", where: "Details to follow", icon: Users },
];

export const CELEBRATIONS = [
  { icon: Gift, name: "Kellie Rowe", note: "Birthday — Thursday" },
  { icon: Gift, name: "D. Okafor", note: "Birthday — Saturday" },
  { icon: PartyPopper, name: "Alison Carter", note: "3 years at Locale — next week" },
  { icon: UserPlus, name: "L. Dixon", note: "New starter — say hi (Broker Support)" },
];

const QUICK_LINKS: { label: string; module: ModuleId; tab: string | null }[] = [
  { label: "Leave request", module: "hr", tab: "leave" },
  { label: "Expenses", module: "accounts", tab: "expenses" },
  { label: "IT help desk", module: "it", tab: null },
];

export function HomeScreen() {
  const { jobs, portalUpdates, go, openJob } = useLaunchpad();
  const [query, setQuery] = React.useState("");
  const [pulse, setPulse] = React.useState<string | null>(null);

  const conflicts = jobs.filter((j) => j.sync === "conflict");
  const conflictJob = conflicts[0];
  const inConstruction = jobs.filter((j) => j.board === "construction").length;

  const myDay: { label: string; onClick: () => void; urgent?: boolean }[] = [
    ...(conflictJob
      ? [
          {
            label: `Resolve sync conflict — job ${conflictJob.jobNo} ${conflictJob.conflict?.field ?? ""}`.trim(),
            onClick: () => openJob(conflictJob.id),
            urgent: true,
          },
        ]
      : []),
    { label: "Approve leave — A. Mercer, 17–21 Aug", onClick: () => go("hr", "leave") },
    { label: "2 expense claims awaiting approval", onClick: () => go("accounts", "expenses") },
    { label: "Ops review — Nguyen submission, 2 items outstanding", onClick: () => go("operations", "submissions") },
    { label: "3 draft invoices awaiting approval — builder billing", onClick: () => go("accounts", "invoicing") },
  ];

  const q = query.trim().toLowerCase();
  const matches = q
    ? jobs
        .filter((j) => `${j.jobNo} ${j.client} ${j.builder} ${j.address} ${j.rep}`.toLowerCase().includes(q))
        .slice(0, 6)
    : [];

  return (
    <PageContainer className="relative">
      <BrandShapes
        size={176}
        className="absolute top-5 right-8 hidden opacity-60 xl:block dark:opacity-45"
      />

      {/* Greeting + hero search */}
      <Reveal index={0} className="relative z-[1] flex flex-col items-start pt-1">
        <h1 className="font-heading text-2xl font-bold tracking-tight sm:text-[28px]">
          G&apos;day, <span className="font-accent font-normal text-haven-700 dark:text-haven-300">Shannan</span>
        </h1>
        <p className="mt-1.5 text-[13px] text-muted-foreground">
          Wednesday 5 August · {myDay.length} things need you today
        </p>
        <div className="relative mt-4 w-full max-w-[520px]">
          <SearchInput
            size="lg"
            value={query}
            onChange={setQuery}
            count={q ? matches.length : undefined}
            placeholder="Search Launchpad: jobs, people, articles, deals"
            aria-label="Search Launchpad"
          />
          {q ? (
            <div className="absolute inset-x-0 top-full z-20 mt-1.5 overflow-hidden rounded-xl border border-border bg-popover text-left shadow-lg">
              {matches.length === 0 ? (
                <p className="px-4 py-3 text-xs text-muted-foreground">
                  No jobs match <span className="rounded bg-muted px-1 font-mono text-[11px]">{query}</span>. Try a job
                  number, client or suburb.
                </p>
              ) : (
                <ul>
                  {matches.map((j) => (
                    <li key={j.id}>
                      <button
                        type="button"
                        onClick={() => openJob(j.id)}
                        className="flex w-full items-center gap-3 border-t border-hairline px-4 py-2.5 text-left first:border-t-0 hover:bg-haven-50/70 dark:hover:bg-haven-950/30"
                      >
                        <span className="w-12 shrink-0 font-mono text-[11px] text-muted-foreground">
                          {j.jobNo || "—"}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13px] font-medium">{j.client}</span>
                          <span className="block truncate text-[11px] text-subtle-foreground">
                            {j.builder} · {j.address}
                          </span>
                        </span>
                        <SyncBadge sync={j.sync} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : null}
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {QUICK_LINKS.map((l) => (
            <Button key={l.label} variant="outline" size="sm" className="rounded-full px-3.5" onClick={() => go(l.module, l.tab)}>
              {l.label}
            </Button>
          ))}
        </div>
      </Reveal>

      {/* At a glance — every figure is read from the live store. */}
      <Reveal index={1} className="relative z-[1]">
        <KpiGrid cols={4}>
          <KpiCard label="Needs you today" value={myDay.length} sub="across 4 modules" icon={Inbox} tone="haven" />
          <KpiCard
            label="Jobs in construction"
            value={inConstruction}
            sub={`of ${jobs.length} mirrored jobs`}
            icon={HardHat}
            tone="charcoal"
          />
          <KpiCard
            label="Sync conflicts"
            value={conflicts.length}
            icon={conflicts.length > 0 ? AlertTriangle : ShieldCheck}
            alert={conflicts.length > 0}
            pulse={conflicts.length > 0}
            onClick={conflictJob ? () => openJob(conflictJob.id) : undefined}
            hint={conflictJob ? `Job ${conflictJob.jobNo} · tap to resolve` : undefined}
            sub="HubSpot and Monday agree"
            tone="ok"
          />
          <KpiCard
            label="Portal updates"
            value={portalUpdates.length}
            icon={Sparkles}
            tone="skyblue"
            onClick={() => go("operations")}
            hint="Waiting for review · tap to open"
          />
        </KpiGrid>
      </Reveal>

      <div className="relative z-[1] grid items-start gap-5 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="flex min-w-0 flex-col gap-5">
          <Reveal index={2}>
            <Card>
              <CardHeader>
                <CardTitle>Announcements</CardTitle>
                <CardMeta>{ANNOUNCEMENTS.length} posts</CardMeta>
              </CardHeader>
              <CardContent>
                {ANNOUNCEMENTS.map((a) => (
                  <CardRow key={a.title}>
                    <div className="flex flex-wrap items-baseline gap-2">
                      <span className="text-[13px] font-semibold">{a.title}</span>
                      {a.pinned ? <Pill tone="haven">Pinned</Pill> : null}
                      <span className="ml-auto text-[11px] whitespace-nowrap text-subtle-foreground">{a.meta}</span>
                    </div>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{a.body}</p>
                  </CardRow>
                ))}
              </CardContent>
            </Card>
          </Reveal>

          <Reveal index={3}>
            <Card tone="inverse" className="flex flex-wrap items-center gap-4 px-5 py-4 shadow-lg shadow-black/15">
              <Avatar name="K Ellery" tone="haven" size="lg" />
              <div className="min-w-[200px] flex-1">
                <p className="text-[10.5px] font-semibold tracking-[0.18em] text-haven-300 uppercase">
                  Sale of the week
                </p>
                <p className="mt-0.5 font-heading text-[15px] font-bold text-silver">K. Ellery — L. Mallillin, Yanchep</p>
                <p className="mt-0.5 text-xs text-zinc-400">$630k house and land · won Friday · 3rd sale this month</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="ml-auto border-haven-300/70 bg-transparent text-haven-300 hover:border-haven-300 hover:bg-haven-300/10 dark:bg-transparent"
                onClick={() => confirm("Kudos sent to K. Ellery", "They'll see it on their Home page.")}
              >
                <Sparkles /> Send kudos
              </Button>
            </Card>
          </Reveal>

          <Reveal index={4}>
            <Card>
              <CardHeader>
                <CardTitle>Popular right now</CardTitle>
              </CardHeader>
              <CardContent>
                {POPULAR.map(({ label: title, query }) => (
                  <CardRow key={title} className="py-0">
                    {/* Knowledge reads ?q= and opens straight on the article's search. */}
                    <Link
                      href={`/knowledge?q=${encodeURIComponent(query)}`}
                      className="group flex w-full items-baseline gap-3 py-2 text-left"
                    >
                      <span className="text-[13px] font-medium text-haven-700 group-hover:underline dark:text-haven-300">
                        {title}
                      </span>
                      <span className="ml-auto text-[11px] text-subtle-foreground">Knowledge</span>
                    </Link>
                  </CardRow>
                ))}
              </CardContent>
            </Card>
          </Reveal>
        </div>

        <div className="flex min-w-0 flex-col gap-5">
          <Reveal index={2}>
            <Card tone="accent">
              <CardHeader>
                <CardTitle>My day</CardTitle>
                <CardMeta>{myDay.length} open</CardMeta>
              </CardHeader>
              <CardContent className="flex flex-col gap-1.5">
                {myDay.map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    onClick={item.onClick}
                    className={cn(
                      "group flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs transition-[background-color,transform] duration-150 active:scale-[0.99]",
                      item.urgent
                        ? "pulse-rose bg-rose-50 font-semibold text-rose-700 hover:bg-rose-100 dark:bg-rose-500/10 dark:text-rose-300 dark:hover:bg-rose-500/15"
                        : "bg-white/80 text-foreground hover:bg-white dark:bg-white/[0.04] dark:hover:bg-white/[0.07]",
                    )}
                  >
                    {item.urgent ? <AlertTriangle className="size-3.5 shrink-0" aria-hidden /> : null}
                    <span className="min-w-0 flex-1">{item.label}</span>
                    <ArrowRight
                      className="size-3.5 shrink-0 text-subtle-foreground transition-transform group-hover:translate-x-0.5"
                      aria-hidden
                    />
                  </button>
                ))}
              </CardContent>
            </Card>
          </Reveal>

          <Reveal index={3}>
            <Card>
              <CardHeader>
                <CardTitle>What&apos;s coming up</CardTitle>
              </CardHeader>
              <CardContent>
                {COMING_UP.map(({ title, when, where, icon: Icon }) => (
                  <CardRow key={title} className="flex items-start gap-2.5 py-2">
                    <Icon className="mt-0.5 size-3.5 shrink-0 text-haven-700 dark:text-haven-300" aria-hidden />
                    <div className="min-w-0">
                      <p className="text-[12.5px] font-medium">{title}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {when} · {where}
                      </p>
                    </div>
                  </CardRow>
                ))}
                <Button
                  variant="link"
                  size="sm"
                  className="mt-2 gap-1 text-xs"
                  onClick={() => confirm("Added to your calendar", "4 events · reminders the day before")}
                >
                  <CalendarPlus /> Add to my calendar
                </Button>
              </CardContent>
            </Card>
          </Reveal>

          <Reveal index={4}>
            <Card>
              <CardHeader>
                <CardTitle>Celebrations</CardTitle>
              </CardHeader>
              <CardContent>
                {CELEBRATIONS.map(({ icon: Icon, name, note }) => (
                  <CardRow key={name + note} className="flex items-center gap-2.5 py-2">
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-nectar-100 text-nectar-800 dark:bg-nectar-300/15 dark:text-nectar-200">
                      <Icon className="size-3.5" aria-hidden />
                    </span>
                    <div className="min-w-0">
                      <p className="text-[13px] font-medium">{name}</p>
                      <p className="text-[11px] text-muted-foreground">{note}</p>
                    </div>
                  </CardRow>
                ))}
              </CardContent>
            </Card>
          </Reveal>

          <Reveal index={5}>
            <div className="rounded-xl border border-skyblue-300 bg-skyblue-100 px-5 py-4 dark:border-skyblue-800/50 dark:bg-skyblue-950/40">
              <p className="text-xs font-semibold text-skyblue-950 dark:text-skyblue-100">
                Quick pulse: how&apos;s your workload this week?
              </p>
              <div className="mt-2.5 flex flex-wrap gap-1.5" role="group" aria-label="Workload this week">
                {["Light", "Just right", "Heavy"].map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    aria-pressed={pulse === opt}
                    onClick={() => {
                      setPulse(opt);
                      confirm("Thanks — pulse recorded", "Answers are anonymous and rolled up weekly.");
                    }}
                    className={cn(
                      "rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors",
                      pulse === opt
                        ? "border-skyblue-700 bg-skyblue-700 text-white dark:border-skyblue-300 dark:bg-skyblue-300 dark:text-skyblue-950"
                        : "border-skyblue-300 bg-white text-skyblue-950 hover:border-skyblue-500 dark:border-skyblue-800 dark:bg-skyblue-950/60 dark:text-skyblue-100",
                    )}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </PageContainer>
  );
}
