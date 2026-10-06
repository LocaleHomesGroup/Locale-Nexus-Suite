"use client";

import { Check, Clock, CornerDownRight, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/ui/avatar";
import { SyncBadge } from "@/components/ui/sync-badge";
import type { Job } from "@/data/jobs";
import type { DealPriority, PipelineDeal, PipelineStage } from "../data";

/**
 * The board's shared vocabulary, after HRIS's TicketCard: one place, so the
 * card, the column headers and the dialog speak the same colour language.
 * Priority is a verdict, so it takes status colours. Stages step up through
 * the dashboard's tone and end on emerald, because a won sale is done. Every
 * colour sits beside its word.
 */
export const PRIORITY_STYLES: Record<DealPriority, { label: string; chip: string; dot: string }> = {
  high: {
    label: "High",
    chip: "bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300",
    dot: "bg-rose-500",
  },
  medium: {
    label: "Medium",
    chip: "bg-amber-50 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300",
    dot: "bg-amber-500",
  },
  low: {
    label: "Low",
    chip: "bg-muted text-muted-foreground",
    dot: "bg-zinc-400 dark:bg-zinc-500",
  },
};

export const STAGE_DOT: Record<PipelineStage, string> = {
  "Appointment booked": "bg-zinc-400 dark:bg-zinc-500",
  "Appointment held": "bg-tone-strong/50",
  "Potential sale": "bg-tone-strong",
  "Sale won": "bg-emerald-500",
};

/** Deals that sit this long in one stage are stale (Team's stage report). */
const STALE_DAYS = 14;

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export const dealNo = (d: Pick<PipelineDeal, "no">) => `D-${d.no}`;

/** "just now", "5m ago", "3h ago", "2d ago", then a date. */
export function relativeTime(at: number, now = Date.now()): string {
  const s = Math.max(0, now - at);
  if (s < MINUTE) return "just now";
  if (s < HOUR) return `${Math.floor(s / MINUTE)}m ago`;
  if (s < DAY) return `${Math.floor(s / HOUR)}h ago`;
  const d = Math.floor(s / DAY);
  if (d < 30) return `${d}d ago`;
  return new Date(at).toLocaleDateString("en-AU", { day: "numeric", month: "short" });
}

/** "<1d", "1d", "6d" — how long the deal has sat in its stage. */
export function inStage(since: number, now = Date.now()): { label: string; stale: boolean } {
  const d = Math.floor(Math.max(0, now - since) / DAY);
  return { label: d === 0 ? "<1d" : `${d}d`, stale: d >= STALE_DAYS };
}

export function PriorityChip({ priority, className }: { priority: DealPriority; className?: string }) {
  const p = PRIORITY_STYLES[priority];
  return (
    <span className={cn("inline-flex h-5 shrink-0 items-center gap-1 rounded-full px-2 text-xs font-medium", p.chip, className)}>
      <span className={cn("size-1.5 rounded-full", p.dot)} aria-hidden />
      {p.label}
      <span className="sr-only"> priority</span>
    </span>
  );
}

/**
 * The card's surface. The board puts it on a button (or on the drag overlay,
 * lifted, with no hover states), so one look serves both.
 */
export function dealCardClass({
  ghosted = false,
  overlay = false,
  won = false,
}: {
  ghosted?: boolean;
  overlay?: boolean;
  won?: boolean;
}) {
  return cn(
    "group/card relative block w-full rounded-lg border bg-card p-3 text-left shadow-xs outline-none select-none",
    "transition-[translate,box-shadow,opacity,border-color] duration-150 ease-out motion-reduce:transition-none",
    "focus-visible:ring-3 focus-visible:ring-ring/45",
    won ? "border-emerald-200 dark:border-emerald-500/25" : "border-border",
    !overlay &&
      "cursor-grab hover:-translate-y-0.5 hover:border-tone-line hover:shadow-md active:cursor-grabbing motion-reduce:hover:translate-y-0",
    ghosted && "opacity-40",
    overlay && "cursor-grabbing border-tone-line shadow-xl shadow-black/15 ring-1 ring-tone-line dark:shadow-black/50",
  );
}

/** What a deal card shows: number and priority, client and value, where and what, the next step, who made it. */
export function DealCardBody({ deal, job }: { deal: PipelineDeal; job?: Job }) {
  const won = deal.stage === "Sale won";
  const stage = inStage(deal.stageSince);
  const updates = deal.updates.length;

  return (
    <>
      <span className="flex items-center justify-between gap-2">
        <span className="font-mono text-xs font-medium text-muted-foreground">{dealNo(deal)}</span>
        <PriorityChip priority={deal.priority} />
      </span>

      <span className="mt-1.5 flex items-baseline justify-between gap-3">
        <span className="line-clamp-2 text-sm leading-snug font-medium text-foreground">{deal.client}</span>
        <span className="shrink-0 text-sm font-semibold text-foreground tabular-nums">{deal.value}</span>
      </span>
      <span className="mt-0.5 block truncate text-xs text-muted-foreground">
        {deal.suburb}
        {deal.pkg ? <> · {deal.pkg}</> : null}
      </span>

      {won ? (
        <span className="mt-2 flex">
          {job ? (
            <span className="inline-flex h-5 max-w-full items-center gap-1 rounded-full bg-emerald-50 px-2 text-xs font-medium text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
              <Check className="size-3 shrink-0" aria-hidden />
              <span className="truncate">{job.jobNo ? `Job ${job.jobNo}` : "Job created · awaiting no."}</span>
            </span>
          ) : (
            <span className="inline-flex h-5 max-w-full items-center gap-1 rounded-full bg-amber-50 px-2 text-xs font-medium text-amber-800 dark:bg-amber-500/15 dark:text-amber-300">
              <Clock className="size-3 shrink-0" aria-hidden />
              <span className="truncate">Queued in CRM Dash Sync</span>
            </span>
          )}
        </span>
      ) : deal.nextStep ? (
        <span className="mt-2 flex">
          <span
            className="inline-flex h-5 max-w-full items-center gap-1 rounded-full bg-tone-soft px-2 text-xs font-medium text-tone-ink"
            title={`Next step: ${deal.nextStep}`}
          >
            <CornerDownRight className="size-3 shrink-0" aria-hidden />
            <span className="sr-only">Next step: </span>
            <span className="truncate">{deal.nextStep}</span>
          </span>
        </span>
      ) : null}

      <span className="mt-2.5 flex items-center gap-1.5">
        <Avatar name={deal.rep} size="xs" />
        <span className="min-w-0 truncate text-xs text-muted-foreground">
          <span className="sr-only">Made by </span>
          {deal.rep}
        </span>
        <span className="ml-auto flex shrink-0 items-center gap-2 text-xs text-subtle-foreground">
          {updates > 0 ? (
            <span className="flex items-center gap-0.5" title={`${updates} update${updates === 1 ? "" : "s"}`}>
              <MessageSquare className="size-3" aria-hidden />
              {updates}
              <span className="sr-only"> update{updates === 1 ? "" : "s"}</span>
            </span>
          ) : null}
          {/* While its undo window is open, the card says so in place of its age. */}
          {deal.syncing ? (
            <SyncBadge sync="pending" />
          ) : (
            <span
              suppressHydrationWarning
              className={cn("tabular-nums", stage.stale && !won && "font-medium text-amber-700 dark:text-amber-300")}
              title={stage.stale && !won ? "Stale: 14 days or more in this stage" : undefined}
            >
              {stage.label} in stage
            </span>
          )}
        </span>
      </span>
    </>
  );
}
