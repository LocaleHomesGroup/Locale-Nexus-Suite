"use client";

import * as React from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  AlertTriangle,
  ArrowRight,
  CalendarPlus,
  ChevronDown,
  CircleCheck,
  HardHat,
  Hourglass,
  Inbox,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { useLaunchpad, confirm } from "@/state/launchpad-store";
import { EASE_OUT } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { PageContainer } from "@/components/ui/page";
import { Card, CardContent, CardHeader, CardMeta, CardRow, CardTitle } from "@/components/ui/card";
import { KpiCard, KpiGrid } from "@/components/ui/kpi-card";
import { Pill } from "@/components/ui/pill";
import { Button } from "@/components/ui/button";
import { SearchInput } from "@/components/ui/input";
import { Avatar } from "@/components/ui/avatar";
import { BrandShapes } from "@/components/ui/brand-shapes";
import { EmptyState } from "@/components/ui/states";
import { Reveal } from "@/components/ui/reveal";
import { SyncBadge } from "@/components/ui/sync-badge";
// One source of truth for the Popular titles and the search that finds each.
import { POPULAR } from "@/components/modules/knowledge/data";
import { personTone } from "@/components/modules/hr/data";
import { useLeave } from "@/components/modules/hr/leave-store";
import { ANNOUNCEMENTS, CELEBRATIONS, COMING_UP, QUICK_LINKS, type Announcement } from "./data";
import { buildMyDay, type MyDayItem } from "./my-day";

/**
 * Home — "what needs me" first. The wide column leads with My day, the one
 * actionable list on the page, straight after the greeting and the KPI row;
 * company news (events, celebrations, announcements, popular reads) sits in
 * the side column. Calm by design: the only thing that may pulse is a real
 * problem due today (the Sync conflicts tile, three rings then rest). My day
 * says "Due today" in words, not with a ring.
 */
export function HomeScreen() {
  const { jobs, reviewItems, submissionDocs, submissionStatus, invoices, claims, go, openJob } = useLaunchpad();
  const heldForReview = reviewItems.filter((i) => i.status === "pending").length;
  const { requests: leave } = useLeave();
  const [query, setQuery] = React.useState("");

  const myDay = buildMyDay({ jobs, leave, submissionDocs, submissionStatus, invoices, claims });
  const modules = new Set(myDay.map((i) => i.module)).size;
  const conflicts = jobs.filter((j) => j.sync === "conflict");
  const conflictJob = conflicts[0];
  const inConstruction = jobs.filter((j) => j.board === "construction").length;

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
      <Reveal index={0} className="relative z-[2] flex flex-col items-start pt-1">
        <h1 className="font-heading text-2xl font-bold tracking-tight sm:text-[28px]">
          G&apos;day, <span className="font-accent font-normal text-tone-ink">Shannan</span>
        </h1>
        <p className="mt-1.5 text-[13px] text-muted-foreground">
          Wednesday 5 August ·{" "}
          {myDay.length === 0
            ? "nothing needs you today"
            : `${myDay.length} ${myDay.length === 1 ? "thing needs" : "things need"} you today`}
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
                  No jobs match <span className="rounded bg-muted px-1 font-mono text-xs">{query}</span>. Try a job
                  number, client or suburb.
                </p>
              ) : (
                <ul>
                  {matches.map((j) => (
                    <li key={j.id}>
                      <button
                        type="button"
                        onClick={() => openJob(j.id)}
                        className="flex w-full items-center gap-3 border-t border-hairline px-4 py-2.5 text-left first:border-t-0 hover:bg-tone-soft"
                      >
                        <span className="w-12 shrink-0 font-mono text-xs text-muted-foreground">
                          {j.jobNo || "—"}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13px] font-medium">{j.client}</span>
                          <span className="block truncate text-xs text-subtle-foreground">
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
          <KpiCard
            label="Needs you today"
            value={myDay.length}
            sub={modules > 1 ? `across ${modules} modules` : modules === 1 ? "in 1 module" : "all clear"}
            icon={Inbox}
          />
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
            label="Review queue"
            value={heldForReview}
            icon={Hourglass}
            tone="pending"
            onClick={() => go("operations", "review")}
            hint="Waiting on a person · tap to open"
          />
        </KpiGrid>
      </Reveal>

      <div className="relative z-[1] grid items-start gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        {/* Main column: the work. */}
        <div className="flex min-w-0 flex-col gap-5">
          <Reveal index={2}>
            <MyDayCard items={myDay} />
          </Reveal>

          <Reveal index={3}>
            <Card tone="inverse" className="flex flex-wrap items-center gap-x-4 gap-y-3 px-5 py-4">
              <Avatar name="K Ellery" tone="haven" size="lg" />
              <div className="min-w-[200px] flex-1">
                <p className="text-[10px] font-semibold tracking-[0.18em] text-(color:--tone-pair) uppercase">
                  Sale of the week
                </p>
                <p className="mt-0.5 font-heading text-[15px] font-bold text-silver">K. Ellery — L. Mallillin, Yanchep</p>
                <p className="mt-0.5 text-xs text-zinc-400">$630k house and land · won Friday · 3rd sale this month</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="ml-auto border-(color:--tone-pair)/70 bg-transparent text-(color:--tone-pair) hover:border-(color:--tone-pair) hover:bg-(color:--tone-pair)/10 dark:bg-transparent dark:hover:bg-(color:--tone-pair)/10"
                onClick={() => confirm("Kudos sent to K. Ellery", "They'll see it on their Home page.")}
              >
                <Sparkles /> Send kudos
              </Button>
            </Card>
          </Reveal>

          <Reveal index={4}>
            <QuickPulse />
          </Reveal>
        </div>

        {/* Side column: company news. Two-up between md and xl, stacked beside My day from xl. */}
        <div className="grid min-w-0 items-start gap-5 md:grid-cols-2 xl:grid-cols-1">
          <Reveal index={3}>
            <Card>
              <CardHeader>
                <CardTitle>What&apos;s coming up</CardTitle>
              </CardHeader>
              <CardContent>
                {COMING_UP.map(({ title, when, where, icon: Icon }) => (
                  <CardRow key={title} className="flex items-start gap-2.5 py-2">
                    <Icon className="mt-0.5 size-3.5 shrink-0 text-tone-ink" aria-hidden />
                    <div className="min-w-0">
                      <p className="text-[13px] font-medium">{title}</p>
                      <p className="text-xs text-muted-foreground">
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
                    <Avatar name={name} tone={personTone(name)} size="sm" />
                    <div className="min-w-0">
                      <p className="text-[13px] font-medium">{name}</p>
                      <p className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Icon className="size-3 shrink-0 text-tone-ink" aria-hidden />
                        {note}
                      </p>
                    </div>
                  </CardRow>
                ))}
              </CardContent>
            </Card>
          </Reveal>

          <Reveal index={5}>
            <AnnouncementsCard />
          </Reveal>

          <Reveal index={6}>
            <Card>
              <CardHeader>
                <CardTitle>Popular right now</CardTitle>
              </CardHeader>
              <CardContent>
                {POPULAR.map(({ label: title, query, cat }) => (
                  <CardRow key={title} className="py-0">
                    {/* Knowledge reads ?q= and opens straight on the article's search. */}
                    <Link
                      href={`/knowledge?cat=${cat}&q=${encodeURIComponent(query)}`}
                      className="group flex w-full items-baseline gap-3 py-2 text-left"
                    >
                      <span className="text-[13px] font-medium text-tone-ink group-hover:underline">{title}</span>
                      <span className="ml-auto shrink-0 text-xs text-subtle-foreground">Knowledge</span>
                    </Link>
                  </CardRow>
                ))}
              </CardContent>
            </Card>
          </Reveal>
        </div>
      </div>
    </PageContainer>
  );
}

/** The lead block: everything waiting on you, most urgent first, each row a link to where it's done. */
function MyDayCard({ items }: { items: MyDayItem[] }) {
  return (
    <Card tone="accent">
      <CardHeader>
        <CardTitle>My day</CardTitle>
        <CardMeta>{items.length} open</CardMeta>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <EmptyState
            icon={CircleCheck}
            title="Nothing needs you today"
            description="Conflicts, approvals and reviews land here as they come in."
            className="py-8"
          />
        ) : (
          <ul className="flex flex-col gap-1.5">
            {items.map((item) => (
              <li key={item.id}>
                <MyDayRow item={item} />
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function MyDayRow({ item }: { item: MyDayItem }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      className={cn(
        "group flex items-center gap-3 rounded-lg border bg-card px-3 py-2.5 text-left shadow-xs outline-none",
        "transition-[background-color,border-color] duration-150 hover:border-tone-line focus-visible:ring-3 focus-visible:ring-ring/45",
        "dark:bg-white/[0.04] dark:hover:bg-white/[0.07]",
        item.urgent ? "border-rose-200 dark:border-rose-500/30" : "border-transparent dark:border-white/[0.04]",
      )}
    >
      <span
        className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-lg",
          item.urgent
            ? "bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300"
            : "bg-tone-soft text-tone-ink dark:bg-tone-tint",
        )}
        aria-hidden
      >
        <Icon className="size-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-[13px] leading-snug font-semibold text-foreground">{item.title}</span>
          {item.urgent ? (
            <Pill tone="problem" variant="caps">
              Due today
            </Pill>
          ) : null}
        </span>
        <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
          {item.detail}
          {item.figure ? (
            <>
              {" · "}
              <span className="font-semibold text-foreground tabular-nums">{item.figure}</span>
            </>
          ) : null}
        </span>
      </span>
      <span className="hidden shrink-0 text-xs text-subtle-foreground lg:block">{item.where}</span>
      <ArrowRight
        className="size-3.5 shrink-0 text-subtle-foreground transition-transform duration-150 group-hover:translate-x-0.5 group-hover:text-tone-ink"
        aria-hidden
      />
    </Link>
  );
}

/** Announcements, compact: the latest in full, the rest behind "2 more". */
function AnnouncementsCard() {
  const reduce = useReducedMotion();
  const [open, setOpen] = React.useState(false);
  const [latest, ...rest] = ANNOUNCEMENTS;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Announcements</CardTitle>
        <CardMeta>{ANNOUNCEMENTS.length} posts</CardMeta>
      </CardHeader>
      <CardContent>
        <AnnouncementRow a={latest} first />
        <AnimatePresence initial={false}>
          {open
            ? rest.map((a) => (
                <motion.div
                  key={a.title}
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, transition: { duration: reduce ? 0 : 0.12 } }}
                  transition={{ duration: reduce ? 0 : 0.2, ease: EASE_OUT }}
                >
                  <AnnouncementRow a={a} />
                </motion.div>
              ))
            : null}
        </AnimatePresence>
        {rest.length ? (
          <Button
            variant="link"
            size="sm"
            className="mt-1 gap-1 text-xs"
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? "Show less" : `${rest.length} more`}
            <ChevronDown className={cn("transition-transform duration-200", open && "rotate-180")} aria-hidden />
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}

function AnnouncementRow({ a, first = false }: { a: Announcement; first?: boolean }) {
  return (
    <div className={cn("py-2.5", !first && "border-t border-hairline")}>
      <div className="flex items-baseline gap-2">
        <span className="min-w-0 truncate text-[13px] font-semibold">{a.title}</span>
        {a.pinned ? <Pill className="bg-tone-tint text-tone-ink">Pinned</Pill> : null}
        <span className="ml-auto shrink-0 text-xs whitespace-nowrap text-subtle-foreground">{a.meta}</span>
      </div>
      <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">{a.body}</p>
    </div>
  );
}

/** A one-question workload check. Anonymous; flat, neutral chrome so it never competes with My day. */
function QuickPulse() {
  const [pulse, setPulse] = React.useState<string | null>(null);
  return (
    <Card className="flex flex-wrap items-center gap-x-4 gap-y-3 px-5 py-4">
      <div className="min-w-[200px] flex-1">
        <p className="text-[13px] font-semibold">Quick pulse: how&apos;s your workload this week?</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {pulse ? `You said ${pulse.toLowerCase()}. Change it any time this week.` : "Anonymous, rolled up weekly."}
        </p>
      </div>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Workload this week">
        {["Light", "Just right", "Heavy"].map((opt) => (
          <button
            key={opt}
            type="button"
            aria-pressed={pulse === opt}
            onClick={() => {
              setPulse(opt);
              confirm("Pulse recorded, thanks", "Answers are anonymous and rolled up weekly.");
            }}
            className={cn(
              "rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/45",
              pulse === opt
                ? "border-tone-fill bg-tone-fill text-tone-on-fill"
                : "border-border bg-card text-foreground hover:border-tone-line hover:bg-tone-soft dark:bg-white/[0.03]",
            )}
          >
            {opt}
          </button>
        ))}
      </div>
    </Card>
  );
}
