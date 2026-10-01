"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, useReducedMotion } from "motion/react";
import { ChevronRight, SearchX } from "lucide-react";
import type { Job } from "@/data/jobs";
import { cn } from "@/lib/utils";
import { EASE_OUT, rowDelay } from "@/lib/motion";
import { Card } from "@/components/ui/card";
import { Pill } from "@/components/ui/pill";
import { Button } from "@/components/ui/button";
import { SyncBadge } from "@/components/ui/sync-badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { SyncFilter } from "./CrmDashSync";

const MotionRow = motion.create(TableRow);

export function jobHref(id: number) {
  return `/operations/jobs/${id}`;
}

/** The Monday board a job sits on — "Construction · 5 of 8" or "Sales board". */
export function MondayPill({ job, long = false }: { job: Job; long?: boolean }) {
  if (job.board === "construction") {
    const done = job.milestones.filter((m) => m.status === "done").length;
    return (
      <Pill tone="haven" className="tabular-nums">
        {long ? `Monday · Construction, ${done} of ${job.milestones.length} done` : `Construction · ${done} of ${job.milestones.length}`}
      </Pill>
    );
  }
  return <Pill tone="skyblue">{long ? "Monday · Sales board" : "Sales board"}</Pill>;
}

function openLabel(job: Job) {
  return `Open ${job.jobNo ? `job ${job.jobNo}` : "new job"} · ${job.client}`;
}

/**
 * Every mirrored job. A table from `md` up (rows open the job), stacked cards
 * below it. The row entrance replays when the sync filter changes, not while
 * typing a search (HRIS § 14.3).
 */
export function JobsTable({
  rows,
  filter,
  query,
  onClear,
}: {
  rows: Job[];
  filter: SyncFilter;
  query: string;
  onClear: () => void;
}) {
  const router = useRouter();
  const reduce = useReducedMotion();

  return (
    <Card className="overflow-hidden">
      <div className="hidden min-w-0 md:block">
        <Table>
          <TableHeader>
            <tr>
              <TableHead className="pl-5">Job no</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>Builder</TableHead>
              <TableHead>HubSpot stage</TableHead>
              <TableHead>Monday</TableHead>
              <TableHead className="pr-5">Sync</TableHead>
            </tr>
          </TableHeader>
          <TableBody>
            {rows.map((j, i) => (
              <MotionRow
                key={`${filter}:${j.id}`}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: reduce ? 0 : 0.18, ease: EASE_OUT, delay: rowDelay(i, reduce) }}
                onClick={() => router.push(jobHref(j.id))}
                className="group cursor-pointer"
              >
                <TableCell className="py-3 pl-5">
                  <Link
                    href={jobHref(j.id)}
                    aria-label={openLabel(j)}
                    onClick={(e) => e.stopPropagation()}
                    className={cn(
                      "rounded-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/45",
                      j.jobNo ? "font-mono text-[12px] font-semibold text-foreground" : "text-[12.5px] text-subtle-foreground",
                    )}
                  >
                    {j.jobNo || "Awaiting"}
                  </Link>
                </TableCell>
                <TableCell className="py-3 font-medium">{j.client}</TableCell>
                <TableCell className="py-3 text-foreground/80">{j.builder}</TableCell>
                <TableCell className="py-3 text-foreground/80">{j.hsStage}</TableCell>
                <TableCell className="py-3">
                  <MondayPill job={j} />
                </TableCell>
                <TableCell className="py-3 pr-5">
                  <span className="flex items-center justify-between gap-2">
                    <SyncBadge sync={j.sync} />
                    <ChevronRight
                      className="size-3.5 text-subtle-foreground opacity-0 transition-[opacity,transform] group-hover:translate-x-0.5 group-hover:opacity-100"
                      aria-hidden
                    />
                  </span>
                </TableCell>
              </MotionRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <ul className="md:hidden">
        {rows.map((j, i) => (
          <motion.li
            key={`${filter}:${j.id}`}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: reduce ? 0 : 0.18, ease: EASE_OUT, delay: rowDelay(i, reduce) }}
            className="border-t border-hairline first:border-t-0"
          >
            <Link
              href={jobHref(j.id)}
              aria-label={openLabel(j)}
              className="flex flex-col gap-1.5 px-4 py-3 outline-none transition-colors hover:bg-haven-50/60 focus-visible:bg-haven-50/60 dark:hover:bg-haven-950/25 dark:focus-visible:bg-haven-950/25"
            >
              <span className="flex items-center gap-2">
                <span
                  className={cn(
                    "shrink-0",
                    j.jobNo ? "font-mono text-[12px] font-semibold" : "text-xs text-subtle-foreground",
                  )}
                >
                  {j.jobNo || "Awaiting"}
                </span>
                <span className="min-w-0 truncate text-[13px] font-medium">{j.client}</span>
                <SyncBadge sync={j.sync} className="ml-auto shrink-0" />
              </span>
              <span className="text-xs text-muted-foreground">
                {j.builder} · {j.hsStage}
              </span>
              <span>
                <MondayPill job={j} />
              </span>
            </Link>
          </motion.li>
        ))}
      </ul>

      {rows.length === 0 ? <NoJobMatches query={query} filter={filter} onClear={onClear} /> : null}
    </Card>
  );
}

/** Filter-shaped empty state (HRIS § 12.2) with the mockup's sentence. */
function NoJobMatches({ query, filter, onClear }: { query: string; filter: SyncFilter; onClear: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
      <div className="mb-3 flex size-12 items-center justify-center rounded-2xl bg-gradient-to-br from-zinc-300 to-zinc-500 text-white shadow-md dark:from-zinc-600 dark:to-zinc-800">
        <SearchX className="size-6" aria-hidden />
      </div>
      <h3 className="text-sm font-semibold">No matches</h3>
      <p className="mt-1.5 max-w-md text-xs text-muted-foreground">
        No jobs match
        {query ? (
          <>
            {" "}
            <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] text-foreground">{query}</span>
          </>
        ) : null}
        {filter !== "all" ? ` with status ${filter}` : ""}. Try clearing the filter or search.
      </p>
      <Button variant="outline" size="sm" className="mt-4 rounded-full" onClick={onClear}>
        Clear filter and search
      </Button>
    </div>
  );
}
