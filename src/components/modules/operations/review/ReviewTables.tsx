"use client";

import * as React from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Ban, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Play } from "lucide-react";
import type { Job } from "@/data/jobs";
import type { ReviewItem } from "@/data/seed";
import { cn } from "@/lib/utils";
import { EASE_OUT, EASE_SWAP, PANEL_VARIANTS, rowDelay } from "@/lib/motion";
import { CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/input";
import { Pill } from "@/components/ui/pill";
import { Dash, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AutoHeight, Ticker, useCascading } from "@/components/ui/list-motion";
import { ChangeLines, JobCell, decidedLook, kindLabel } from "./parts";

/** Both tables page in 10s, as HRIS's offboarded list does. */
export const PAGE_SIZE = 10;

type JobFor = (id: number) => Job | undefined;

/** Each row's drift in and out (HRIS § 14.3): a capped cascade while the pane arrives, a slide left on the way out. */
function rowMotion(i: number, cascading: boolean, reduce: boolean | null) {
  return {
    layout: "position" as const,
    initial: { opacity: 0, y: 4 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, x: -14, transition: { duration: reduce ? 0 : 0.14, ease: EASE_OUT } },
    transition: {
      duration: reduce ? 0 : 0.18,
      ease: EASE_OUT,
      delay: cascading ? rowDelay(i, reduce, 0.03) : 0,
      layout: { duration: reduce ? 0 : 0.22, ease: EASE_SWAP, delay: 0 },
    },
  };
}

/**
 * A page of rows that slides sideways the way you're paging, while the card
 * glides to the new height. A search or filter that keeps the page doesn't
 * swap it: rows drift out and the rest close the gap.
 */
export function PagedBody({ page, dir, children }: { page: number; dir: number; children: React.ReactNode }) {
  const reduce = useReducedMotion();
  return (
    <AutoHeight>
      <AnimatePresence mode="wait" initial={false} custom={dir}>
        <motion.div
          key={page}
          custom={dir}
          variants={PANEL_VARIANTS}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ duration: reduce ? 0 : 0.22, ease: EASE_SWAP }}
        >
          {children}
        </motion.div>
      </AnimatePresence>
    </AutoHeight>
  );
}

/** "1–3 of 3" and the four page buttons, as on the Global Master List. */
export function Pager({
  page,
  total,
  onPage,
  noun,
}: {
  page: number;
  total: number;
  onPage: (n: number) => void;
  noun: string;
}) {
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  return (
    <CardFooter className="justify-between text-xs text-muted-foreground">
      <span className="tabular-nums">
        {total ? `${page * PAGE_SIZE + 1}–${Math.min((page + 1) * PAGE_SIZE, total)} of ${total} ${noun}` : "No matches"}
      </span>
      <div className="flex items-center gap-1">
        <Button variant="outline" size="icon-sm" aria-label="First page" disabled={page === 0} onClick={() => onPage(0)}>
          <ChevronsLeft />
        </Button>
        <Button
          variant="outline"
          size="icon-sm"
          aria-label="Previous page"
          disabled={page === 0}
          onClick={() => onPage(page - 1)}
        >
          <ChevronLeft />
        </Button>
        <span className="sr-only" aria-live="polite">
          Page {page + 1} of {pages}
        </span>
        <span className="min-w-14 text-center tabular-nums" aria-hidden>
          <Ticker value={page + 1} /> / {pages}
        </span>
        <Button
          variant="outline"
          size="icon-sm"
          aria-label="Next page"
          disabled={page >= pages - 1}
          onClick={() => onPage(page + 1)}
        >
          <ChevronRight />
        </Button>
        <Button
          variant="outline"
          size="icon-sm"
          aria-label="Last page"
          disabled={page >= pages - 1}
          onClick={() => onPage(pages - 1)}
        >
          <ChevronsRight />
        </Button>
      </div>
    </CardFooter>
  );
}

function MilestoneCell({ item }: { item: ReviewItem }) {
  return (
    <span className="flex flex-col">
      <span className="font-medium whitespace-nowrap">{item.milestone}</span>
      <span className="font-mono text-xs whitespace-nowrap text-muted-foreground">
        {item.id} · {kindLabel(item)}
      </span>
    </span>
  );
}

/**
 * Queue — every change still waiting on a person, one row each (HRIS's
 * offboarding Queue). Tick rows to process just those; Process steps through
 * one; Dismiss asks for the reason and nothing else. A row whose milestone has
 * moved since it was filed says so, and can only be dismissed.
 */
export function QueueTable({
  rows,
  jobFor,
  staleIds,
  selected,
  onToggle,
  onTogglePage,
  onProcess,
  onDismiss,
}: {
  rows: ReviewItem[];
  jobFor: JobFor;
  staleIds: ReadonlySet<string>;
  selected: ReadonlySet<string>;
  onToggle: (id: string) => void;
  onTogglePage: () => void;
  onProcess: (item: ReviewItem) => void;
  onDismiss: (item: ReviewItem) => void;
}) {
  const reduce = useReducedMotion();
  const cascading = useCascading();
  const allOnPage = rows.length > 0 && rows.every((r) => selected.has(r.id));
  const someOnPage = !allOnPage && rows.some((r) => selected.has(r.id));

  return (
    <Table className="min-w-[960px]">
      <TableHeader>
        <TableRow className="hover:bg-transparent dark:hover:bg-transparent">
          <TableHead className="w-10 pl-5">
            <Checkbox
              checked={allOnPage}
              ref={(el) => {
                if (el) el.indeterminate = someOnPage;
              }}
              onChange={onTogglePage}
              aria-label="Select every change on this page"
            />
          </TableHead>
          <TableHead>Milestone</TableHead>
          <TableHead>Job</TableHead>
          <TableHead>Change</TableHead>
          <TableHead>Filed</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="pr-5 text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <AnimatePresence initial={false}>
          {rows.map((item, i) => {
            const stale = staleIds.has(item.id);
            const on = selected.has(item.id);
            return (
              <motion.tr
                key={item.id}
                {...rowMotion(i, cascading, reduce)}
                className={cn(
                  "border-b border-hairline align-top transition-colors hover:bg-tone-soft/60 dark:hover:bg-tone-soft/40",
                  on && "bg-tone-soft/70 dark:bg-tone-soft/50",
                )}
              >
                <TableCell className="w-10 pt-3 pl-5">
                  <Checkbox
                    checked={on}
                    onChange={() => onToggle(item.id)}
                    aria-label={`Select ${item.milestone} on ${jobFor(item.jobId)?.jobNo || "this job"}`}
                  />
                </TableCell>
                <TableCell>
                  <MilestoneCell item={item} />
                </TableCell>
                <TableCell className="max-w-44">
                  <JobCell item={item} job={jobFor(item.jobId)} />
                </TableCell>
                <TableCell>
                  <ChangeLines item={item} />
                  {item.note ? (
                    <p className="mt-1 max-w-60 truncate text-xs text-muted-foreground" title={item.note}>
                      “{item.note}”
                    </p>
                  ) : null}
                </TableCell>
                <TableCell>
                  <span className="flex flex-col">
                    <span className="whitespace-nowrap">
                      {item.queuedBy}
                      <span className="text-muted-foreground tabular-nums"> · {item.queuedAt}</span>
                    </span>
                    <span className="text-xs whitespace-nowrap text-muted-foreground">{item.source ?? "No source given"}</span>
                  </span>
                </TableCell>
                <TableCell>
                  {stale ? (
                    <Pill
                      variant="caps"
                      tone="problem"
                      title="The milestone has changed since this was filed, so releasing it would overwrite a change nobody here is looking at. It can only be dismissed."
                    >
                      Moved since filed
                    </Pill>
                  ) : (
                    <Pill variant="caps" tone="pending">
                      Waiting
                    </Pill>
                  )}
                </TableCell>
                <TableCell className="pr-5">
                  <span className="flex items-center justify-end gap-1.5">
                    <Button
                      variant="outline"
                      size="xs"
                      onClick={() => onDismiss(item)}
                      title="Dismiss with a reason. Nothing changes here, in Monday or in HubSpot."
                    >
                      <Ban /> Dismiss
                    </Button>
                    <Button
                      variant="brand"
                      size="xs"
                      onClick={() => onProcess(item)}
                      title={stale ? "Open it to see what moved. It can only be dismissed." : "Check the change, then release or dismiss it"}
                    >
                      <Play /> Process
                    </Button>
                  </span>
                </TableCell>
              </motion.tr>
            );
          })}
        </AnimatePresence>
      </TableBody>
    </Table>
  );
}

/**
 * Decided — what happened to everything that has left the queue (HRIS's
 * Offboarded list): released, dismissed, or superseded by a newer change to
 * the same milestone, with who decided and the reason they gave.
 */
export function DecidedTable({ rows, jobFor }: { rows: ReviewItem[]; jobFor: JobFor }) {
  const reduce = useReducedMotion();
  const cascading = useCascading();

  return (
    <Table className="min-w-[960px]">
      <TableHeader>
        <TableRow className="hover:bg-transparent dark:hover:bg-transparent">
          <TableHead className="pl-5">Milestone</TableHead>
          <TableHead>Job</TableHead>
          <TableHead>Change</TableHead>
          <TableHead>Outcome</TableHead>
          <TableHead>Reason</TableHead>
          <TableHead>Decided by</TableHead>
          <TableHead className="pr-5">Decided</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <AnimatePresence initial={false}>
          {rows.map((item, i) => {
            const look = decidedLook(item);
            const reason =
              item.decisionNote ??
              (item.status === "superseded" ? "A newer change to the same milestone replaced it." : null);
            return (
              <motion.tr
                key={item.id}
                {...rowMotion(i, cascading, reduce)}
                className="border-b border-hairline align-top transition-colors hover:bg-tone-soft/60 dark:hover:bg-tone-soft/40"
              >
                <TableCell className="pl-5">
                  <MilestoneCell item={item} />
                </TableCell>
                <TableCell className="max-w-44">
                  <JobCell item={item} job={jobFor(item.jobId)} />
                </TableCell>
                <TableCell>
                  <ChangeLines item={item} />
                </TableCell>
                <TableCell>
                  <Pill variant="caps" tone={look.tone}>
                    {look.word}
                  </Pill>
                </TableCell>
                <TableCell>
                  {reason ? (
                    <p
                      className={cn("max-w-64 text-xs leading-snug", item.decisionNote ? "text-foreground/85" : "text-muted-foreground")}
                      title={reason}
                    >
                      {item.decisionNote ? `“${item.decisionNote}”` : reason}
                    </p>
                  ) : (
                    <Dash />
                  )}
                </TableCell>
                <TableCell>
                  <span className="flex flex-col">
                    <span className="whitespace-nowrap">{item.decidedBy ?? "System"}</span>
                    <span className="text-xs whitespace-nowrap text-muted-foreground">filed by {item.queuedBy}</span>
                  </span>
                </TableCell>
                <TableCell className="pr-5 text-xs whitespace-nowrap text-muted-foreground tabular-nums">
                  {item.decidedAt ?? <Dash />}
                </TableCell>
              </motion.tr>
            );
          })}
        </AnimatePresence>
      </TableBody>
    </Table>
  );
}
