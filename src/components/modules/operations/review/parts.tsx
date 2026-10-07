"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { STATUS_LABEL, type Job } from "@/data/jobs";
import type { ReviewItem, ReviewStatus } from "@/data/seed";
import type { PillTone } from "@/components/ui/pill";
import { Dash } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { jobHref } from "../jobs/JobsTable";

export const LINK =
  "rounded-sm font-medium text-tone-ink underline-offset-2 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/45";

export type Decided = Exclude<ReviewStatus, "pending">;

/** How a decided item reads on the Decided tab: its pill, and the line that says what happened. */
export const DECIDED: Record<Decided, { word: string; tone: PillTone }> = {
  accepted: { word: "Released", tone: "ok" },
  dismissed: { word: "Dismissed", tone: "neutral" },
  superseded: { word: "Superseded", tone: "neutral" },
};

export function decidedLook(item: ReviewItem) {
  return DECIDED[item.status as Decided] ?? DECIDED.superseded;
}

export function kindLabel(item: Pick<ReviewItem, "kind">): string {
  return item.kind === "precon" ? "Pre-construction" : "Construction";
}

/** The job number (or the client, before there is one) as a link, with the client under it. */
export function JobCell({ item, job }: { item: ReviewItem; job: Job | undefined }) {
  return (
    <span className="flex min-w-0 flex-col">
      <Link
        href={jobHref(item.jobId)}
        onClick={(e) => e.stopPropagation()}
        className={cn(LINK, "w-fit font-mono text-xs")}
      >
        {job?.jobNo || "No job no. yet"}
      </Link>
      <span className="truncate text-xs text-muted-foreground" title={job?.client}>
        {job?.client ?? <Dash />}
      </span>
    </span>
  );
}

/**
 * What the change does, one line per field it touches: "Completed → In Progress",
 * "22 Jun 2026 → 19 Jun 2026". A field the change leaves alone isn't shown.
 */
export function ChangeLines({ item, className }: { item: ReviewItem; className?: string }) {
  const lines = [
    { label: "Status", from: STATUS_LABEL[item.held.status], to: STATUS_LABEL[item.proposed.status] },
    { label: "Builder’s date", from: item.held.date || "—", to: item.proposed.date || "—" },
  ].filter((l) => l.from !== l.to);
  return (
    <span className={cn("flex flex-col gap-0.5", className)}>
      {lines.map((l) => (
        <span key={l.label} className="text-xs whitespace-nowrap tabular-nums">
          <span className="sr-only">{l.label}: from </span>
          <span className="text-subtle-foreground">{l.from}</span>
          <ArrowRight className="mx-1 inline size-3 text-subtle-foreground" aria-hidden />
          <span className="sr-only"> to </span>
          <span className="font-medium text-foreground">{l.to}</span>
        </span>
      ))}
    </span>
  );
}

/** The before → after comparison as a small definition list, for the dialogs. */
export function ChangeList({ item }: { item: ReviewItem }) {
  return (
    <dl className="rounded-lg border border-hairline bg-card px-3.5 py-1 dark:bg-white/[0.02]">
      <ChangeRow label="Status" from={STATUS_LABEL[item.held.status]} to={STATUS_LABEL[item.proposed.status]} />
      <ChangeRow label="Builder’s date" from={item.held.date || "—"} to={item.proposed.date || "—"} />
    </dl>
  );
}

function ChangeRow({ label, from, to }: { label: string; from: string; to: string }) {
  if (from === to) return null;
  return (
    <div className="flex flex-wrap items-baseline gap-x-3 border-t border-hairline py-2 first:border-t-0">
      <dt className="w-28 shrink-0 text-xs text-muted-foreground">{label}</dt>
      <dd className="text-[13px] tabular-nums">
        <span className="sr-only">From </span>
        <span className="text-subtle-foreground">{from}</span>
        <ArrowRight className="mx-1.5 inline size-3 text-subtle-foreground" aria-hidden />
        <span className="sr-only"> to </span>
        <span className="font-medium text-foreground">{to}</span>
      </dd>
    </div>
  );
}
