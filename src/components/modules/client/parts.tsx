"use client";

import * as React from "react";
import { Camera, Check, Clock, Landmark, ShieldCheck, Wrench } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLaunchpad } from "@/state/launchpad-store";
import { CLIENT_JOB_ID } from "@/data/portal";
import type { Job, LotDetail, Milestone } from "@/data/jobs";
import type { JourneyStage, JourneyState } from "@/data/journey";
import { Avatar } from "@/components/ui/avatar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CONSULTANT_ROLE, PRE_SALE } from "./data";

/**
 * Pieces the Client portal's sections share: the client's live job, the
 * journey timeline, the "who's on your build" card and the step marks.
 */

/** The previewed client's job and lot, live from the Launchpad store. */
export function useClientJob(): { job: Job; lot: LotDetail } {
  const { jobs, lotDetails } = useLaunchpad();
  const job = jobs.find((j) => j.id === CLIENT_JOB_ID);
  if (!job) throw new Error(`Client portal: job ${CLIENT_JOB_ID} is missing from the shared jobs`);
  return { job, lot: lotDetails[job.id] };
}

/** "Lot 361, 8 Camperdown Way, Lakelands" */
export const lotLine = (lot: LotDetail) => `${lot.lot}, ${lot.suburb}`;

/* ── Step marks ────────────────────────────────────────────────────────── */

/** A journey stage's mark: done (emerald tick), current (tone ring), upcoming (hollow). */
export function StageMark({ state, n, size = "md" }: { state: JourneyState; n: number; size?: "sm" | "md" }) {
  const box = size === "sm" ? "size-5" : "size-7";
  if (state === "done") {
    return (
      <span
        className={cn(
          "flex shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white dark:bg-emerald-500",
          box,
        )}
      >
        <Check className={size === "sm" ? "size-3" : "size-3.5"} strokeWidth={3} aria-hidden />
      </span>
    );
  }
  if (state === "current") {
    return (
      <span
        className={cn(
          "flex shrink-0 items-center justify-center rounded-full border-2 border-tone-strong bg-tone-soft",
          box,
        )}
      >
        <span className="size-2 rounded-full bg-tone-strong" aria-hidden />
      </span>
    );
  }
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full border border-border bg-card font-semibold text-subtle-foreground tabular-nums",
        box,
        size === "sm" ? "text-[10px]" : "text-xs",
      )}
    >
      {n}
    </span>
  );
}

/** One milestone as a compact row: tick and date, "Next", "Awaiting date" or still to come. */
export function MilestoneRow({ m, next }: { m: Milestone; next: boolean }) {
  const done = m.status === "done";
  return (
    <li className="flex items-center gap-2.5 py-1.5">
      {done ? (
        <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
          <Check className="size-3" strokeWidth={3} aria-hidden />
        </span>
      ) : next ? (
        <span className="flex size-5 shrink-0 items-center justify-center rounded-full border-2 border-tone-strong bg-tone-soft">
          <span className="size-1.5 rounded-full bg-tone-strong" aria-hidden />
        </span>
      ) : (
        <span className="size-5 shrink-0 rounded-full border border-dashed border-border" aria-hidden />
      )}
      <span
        className={cn(
          "min-w-0 flex-1 truncate text-[13px]",
          done || next ? "text-foreground" : "text-muted-foreground",
        )}
      >
        {m.name}
      </span>
      <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
        {done ? (
          m.date || "Done"
        ) : m.status === "na" ? (
          "Not needed"
        ) : m.status === "pendingDate" ? (
          <span className="text-amber-800 dark:text-amber-300">Awaiting date</span>
        ) : next ? (
          <span className="font-medium text-tone-ink">Next</span>
        ) : (
          "To come"
        )}
      </span>
      <span className="sr-only">{done ? ", completed" : next ? ", next" : ", not started"}</span>
    </li>
  );
}

/* ── Journey timeline ──────────────────────────────────────────────────── */

/**
 * The whole journey, enquiry to keys, as a vertical timeline. Stages before
 * the sale carry what happened and when; the current stage opens up to show
 * its own steps.
 */
export function JourneyTimeline({ stages }: { stages: JourneyStage[] }) {
  return (
    <ol className="relative">
      {stages.map((s, i) => {
        const last = i === stages.length - 1;
        const pre = PRE_SALE[s.id];
        const date = pre?.date ?? s.date;
        const next = s.milestones.find((m) => m.status !== "done" && m.status !== "na");
        return (
          <li
            key={s.id}
            className="relative flex gap-3.5 pb-5 last:pb-0"
            aria-current={s.state === "current" ? "step" : undefined}
          >
            {/* The thread between marks: solid where the journey has been. */}
            {last ? null : (
              <span
                aria-hidden
                className={cn(
                  "absolute top-8 bottom-1 left-[13px] w-0.5 rounded-full",
                  s.state === "done" ? "bg-emerald-600/60 dark:bg-emerald-500/50" : "bg-border",
                )}
              />
            )}
            <StageMark state={s.state} n={i + 1} />
            <div className="min-w-0 flex-1 pt-0.5">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                <p className={cn("text-sm font-semibold", s.state === "upcoming" && "text-muted-foreground")}>
                  {s.label}
                  {s.state === "current" ? (
                    <span className="ml-2 rounded-full bg-tone-tint px-2 py-0.5 align-[1px] text-[10px] font-semibold tracking-[0.12em] text-tone-ink uppercase">
                      You are here
                    </span>
                  ) : null}
                </p>
                {s.state === "done" && date ? (
                  <span className="text-xs text-muted-foreground tabular-nums">{date}</span>
                ) : null}
              </div>
              <p className="mt-0.5 max-w-[70ch] text-xs leading-relaxed text-muted-foreground">
                {pre && s.state === "done" ? pre.detail : s.blurb}
                <span className="text-subtle-foreground"> · {s.who}</span>
              </p>
              {s.state === "current" && s.milestones.length ? (
                <ul className="mt-2 rounded-lg border border-tone-line bg-tone-soft/40 px-3 py-1 dark:bg-tone-soft/30">
                  {s.milestones.map((m) => (
                    <MilestoneRow key={m.name} m={m} next={m === next} />
                  ))}
                </ul>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/* ── Who's on your build ───────────────────────────────────────────────── */

interface TeamMember {
  name: string;
  role: string;
  does: string;
  icon?: React.ComponentType<{ className?: string }>;
  tone: "haven" | "nectar" | "charcoal";
}

/** Everyone the client deals with, from enquiry to keys — in one place instead of four inboxes. */
export function teamFor(job: Job): TeamMember[] {
  return [
    { name: job.rep, role: CONSULTANT_ROLE, does: "Your first call for anything, start to finish", tone: "haven" },
    {
      name: "Locale Operations",
      role: "Contracts and settlement",
      does: "Keeps your builder, lender and land in step",
      icon: ShieldCheck,
      tone: "charcoal",
    },
    {
      name: "Locale Financial",
      role: "Your home loan",
      does: "Borrowing, approvals and progress payments",
      icon: Landmark,
      tone: "nectar",
    },
    {
      name: job.builder,
      role: "Your builder",
      does: "Builds your home and posts site updates here",
      icon: Wrench,
      tone: "charcoal",
    },
  ];
}

export function TeamCard({ job, className }: { job: Job; className?: string }) {
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Who&rsquo;s on your build</CardTitle>
        <CardDescription>One place for everyone, from enquiry to keys.</CardDescription>
      </CardHeader>
      <CardContent>
        <ul>
          {teamFor(job).map((t) => {
            const Icon = t.icon;
            return (
              <li key={t.name} className="flex items-center gap-3 border-t border-hairline py-2.5 first:border-t-0">
                {Icon ? (
                  <span
                    aria-hidden
                    className={cn(
                      "flex size-9 shrink-0 items-center justify-center rounded-full",
                      t.tone === "nectar"
                        ? "bg-nectar-200 text-nectar-900 dark:bg-nectar-300/20 dark:text-nectar-200"
                        : "bg-zinc-100 text-charcoal dark:bg-white/[0.08] dark:text-zinc-200",
                    )}
                  >
                    <Icon className="size-4" />
                  </span>
                ) : (
                  <Avatar name={t.name} tone={t.tone} />
                )}
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold">
                    {t.name} <span className="font-normal text-muted-foreground">· {t.role}</span>
                  </p>
                  <p className="text-xs text-muted-foreground">{t.does}</p>
                </div>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}

/* ── Site photos ───────────────────────────────────────────────────────── */

/** Placeholder tiles for a site update's photos (the prototype has no image store). */
export function PhotoStrip({ count, label }: { count: number; label: string }) {
  if (!count) return null;
  return (
    <div className="mt-2.5 flex items-center gap-1.5" role="img" aria-label={`${count} site photos: ${label}`}>
      {Array.from({ length: Math.min(count, 4) }, (_, i) => (
        <span
          key={i}
          aria-hidden
          className="flex h-12 w-16 items-center justify-center rounded-md border border-hairline bg-muted text-subtle-foreground"
        >
          <Camera className="size-3.5" />
        </span>
      ))}
      {count > 4 ? <span className="pl-1 text-xs text-muted-foreground tabular-nums">+{count - 4}</span> : null}
    </div>
  );
}

/** A small "when" caption with a clock. */
export function When({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground tabular-nums">
      <Clock className="size-3" aria-hidden />
      {children}
    </span>
  );
}
