"use client";

import * as React from "react";
import { motion, useReducedMotion } from "motion/react";
import { Eye } from "lucide-react";
import type { Job } from "@/data/jobs";
import { cn } from "@/lib/utils";
import { EASE_OUT, rowDelay } from "@/lib/motion";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Pill } from "@/components/ui/pill";
import { SyncBadge } from "@/components/ui/sync-badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const MotionRow = motion.create(TableRow);

export function jobHref(id: number) {
  return `/operations/jobs/${id}`;
}

/** The Monday board a job sits on — "Construction · 5 of 8" or "Sales board". */
export function MondayPill({ job, long = false }: { job: Job; long?: boolean }) {
  if (job.board === "construction") {
    const done = job.milestones.filter((m) => m.status === "done").length;
    return (
      <Pill tone="tone" className="tabular-nums">
        {long ? `Monday · Construction, ${done} of ${job.milestones.length} done` : `Construction · ${done} of ${job.milestones.length}`}
      </Pill>
    );
  }
  return <Pill tone="neutral">{long ? "Monday · Sales board" : "Sales board"}</Pill>;
}

function viewLabel(job: Job) {
  return `View ${job.jobNo ? `job ${job.jobNo}` : "new job"} · ${job.client}`;
}

/**
 * The HRIS **View** row action (outline, small, eye icon). It opens the job's
 * quick view in a dialog; the dialog's footer goes on to the full job page.
 */
function ViewJob({ job, onView }: { job: Job; onView: (job: Job) => void }) {
  return (
    <Button variant="outline" size="sm" aria-label={viewLabel(job)} onClick={() => onView(job)}>
      <Eye /> View
    </Button>
  );
}

/**
 * Every mirrored job. A table from `md` up, stacked cards below it. A row is
 * not a link: the Action column's View opens the job, so reading across a row
 * never navigates by accident. The row entrance replays when `replayKey`
 * changes (a tile or a filter), not while typing a search (HRIS § 14.3).
 * `empty` fills the card when nothing is left to show; `onView` opens a job's
 * quick view.
 */
export function JobsTable({
  rows,
  replayKey,
  empty,
  onView,
}: {
  rows: Job[];
  replayKey: string;
  empty: React.ReactNode;
  onView: (job: Job) => void;
}) {
  const reduce = useReducedMotion();

  return (
    <Card className="overflow-hidden">
      <div className="hidden min-w-0 md:block">
        <Table>
          <TableHeader>
            <tr>
              <TableHead className="pl-5">Job number</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>Builder</TableHead>
              <TableHead>HubSpot stage</TableHead>
              <TableHead>Monday</TableHead>
              <TableHead>Sync</TableHead>
              <TableHead className="pr-5 text-right">Action</TableHead>
            </tr>
          </TableHeader>
          <TableBody>
            {rows.map((j, i) => (
              <MotionRow
                key={`${replayKey}:${j.id}`}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: reduce ? 0 : 0.18, ease: EASE_OUT, delay: rowDelay(i, reduce) }}
              >
                <TableCell className="py-3 pl-5">
                  <span
                    className={
                      j.jobNo ? "font-mono text-xs font-semibold text-foreground" : "text-[13px] text-subtle-foreground"
                    }
                  >
                    {j.jobNo || "Awaiting"}
                  </span>
                </TableCell>
                <TableCell className="py-3 font-medium">{j.client}</TableCell>
                <TableCell className="py-3 text-foreground/80">{j.builder}</TableCell>
                <TableCell className="py-3 text-foreground/80">{j.hsStage}</TableCell>
                <TableCell className="py-3">
                  <MondayPill job={j} />
                </TableCell>
                <TableCell className="py-3">
                  <SyncBadge sync={j.sync} />
                </TableCell>
                <TableCell className="py-3 pr-5 text-right">
                  <ViewJob job={j} onView={onView} />
                </TableCell>
              </MotionRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <ul className="md:hidden">
        {rows.map((j, i) => (
          <motion.li
            key={`${replayKey}:${j.id}`}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: reduce ? 0 : 0.18, ease: EASE_OUT, delay: rowDelay(i, reduce) }}
            className="border-t border-hairline first:border-t-0"
          >
            <div className="flex flex-col gap-1.5 px-4 py-3">
              <span className="flex items-center gap-2">
                <span
                  className={cn(
                    "shrink-0",
                    j.jobNo ? "font-mono text-xs font-semibold" : "text-xs text-subtle-foreground",
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
              <span className="flex items-center justify-between gap-2">
                <MondayPill job={j} />
                <ViewJob job={j} onView={onView} />
              </span>
            </div>
          </motion.li>
        ))}
      </ul>

      {rows.length === 0 ? empty : null}
    </Card>
  );
}
