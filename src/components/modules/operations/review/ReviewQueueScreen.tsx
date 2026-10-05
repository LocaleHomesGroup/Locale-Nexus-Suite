"use client";

import * as React from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { AlertTriangle, ArrowRight, CheckCheck, History } from "lucide-react";
import { STATUS_LABEL, type Job } from "@/data/jobs";
import type { ReviewItem, ReviewStatus } from "@/data/seed";
import { useLaunchpad } from "@/state/launchpad-store";
import { cn } from "@/lib/utils";
import { EASE_OUT, rowDelay } from "@/lib/motion";
import { PageHeader } from "@/components/ui/page";
import { Card, CardContent, CardHeader, CardMeta, CardTitle } from "@/components/ui/card";
import { Pill, type PillTone } from "@/components/ui/pill";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/states";
import { Reveal } from "@/components/ui/reveal";
import { useOperationsSync } from "../sync/OperationsSyncProvider";
import { jobHref } from "../jobs/JobsTable";
import { isStale, liveMilestone } from "./review";

const LINK =
  "rounded-sm font-medium text-tone-ink underline-offset-2 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/45";

/**
 * The review queue. Four milestones move money — Formal Finance Approval, Slab
 * Down, Settlement Confirmation and Plate Height — and a reversal or a
 * backdated completion on one of them is filed here instead of applied.
 * Nothing reaches Monday or HubSpot until a person releases it.
 *
 * Each item shows what was true when it was filed, what releasing would apply,
 * and — when it has moved — what is true now, because that is the one that can
 * change underneath it. Releasing onto a milestone that has moved is refused.
 */
export function ReviewQueueScreen() {
  const { jobs, reviewItems } = useLaunchpad();
  const reduce = useReducedMotion();
  const pending = reviewItems.filter((i) => i.status === "pending");
  const history = reviewItems.filter((i) => i.status !== "pending").slice(0, 20);
  const jobFor = (id: number) => jobs.find((j) => j.id === id);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Review queue"
        description="Changes to the four milestones that move money are held here until a person releases them. Nothing has been sent to Monday or HubSpot for anything on this page."
        actions={<span className="text-xs text-subtle-foreground tabular-nums">{pending.length} waiting</span>}
      />

      <ul className="flex flex-col gap-4" aria-label="Changes waiting on a person">
        <AnimatePresence initial={false}>
          {pending.map((item, i) => (
            <motion.li
              key={item.id}
              layout="position"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0, transition: { duration: reduce ? 0 : 0.3, ease: EASE_OUT, delay: rowDelay(i, reduce, 0.05) } }}
              exit={{ opacity: 0, x: reduce ? 0 : -16, transition: { duration: reduce ? 0 : 0.18 } }}
            >
              <PendingItem item={item} job={jobFor(item.jobId)} />
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>

      {pending.length === 0 ? (
        <Reveal>
          <Card>
            <EmptyState
              icon={CheckCheck}
              title="Nothing is waiting"
              description="Formal Finance Approval, Slab Down, Settlement Confirmation and Plate Height file a reversal or a backdated completion here instead of applying it. Every other milestone applies straight away, with an audit entry."
              action={
                <p className="max-w-sm text-xs text-subtle-foreground">
                  Alison, at UAT on 26 August, added Settlement Confirmation and Plate Height to the two Shannan named
                  on 12 August.
                </p>
              }
            />
          </Card>
        </Reveal>
      ) : null}

      {history.length > 0 ? (
        <Reveal index={Math.min(pending.length, 4)}>
          <Card>
            <CardHeader>
              <History className="size-4 text-tone-ink" aria-hidden />
              <CardTitle>Already decided</CardTitle>
              <CardMeta>
                <Pill tone="neutral">Last {history.length}</Pill>
              </CardMeta>
            </CardHeader>
            <CardContent>
              <ul>
                <AnimatePresence initial={false}>
                  {history.map((item) => (
                    <motion.li
                      key={item.id}
                      layout="position"
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0, transition: { duration: reduce ? 0 : 0.24, ease: EASE_OUT } }}
                      className="border-t border-hairline first:border-t-0"
                    >
                      <DecidedEntry item={item} job={jobFor(item.jobId)} />
                    </motion.li>
                  ))}
                </AnimatePresence>
              </ul>
            </CardContent>
          </Card>
        </Reveal>
      ) : null}
    </div>
  );
}

/** One held change, waiting on a person. */
function PendingItem({ item, job }: { item: ReviewItem; job: Job | undefined }) {
  const { releaseReview, dismissReview } = useOperationsSync();
  const [reason, setReason] = React.useState("");
  const [missing, setMissing] = React.useState(false);
  const reasonId = React.useId();
  const hintId = React.useId();
  const live = liveMilestone(job, item);
  const stale = isStale(item, live);

  const dismiss = () => {
    if (!reason.trim()) {
      setMissing(true);
      return;
    }
    dismissReview(item.id, reason);
  };

  return (
    <Card tone="accent">
      <CardHeader>
        <span className="size-2 shrink-0 rounded-full bg-amber-500 dark:bg-amber-400" aria-hidden />
        <CardTitle>{item.milestone}</CardTitle>
        <CardMeta>
          <Pill variant="caps" tone="pending">
            Waiting on a person
          </Pill>
        </CardMeta>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div>
          <p className="text-[13px] text-foreground">{item.summary}.</p>
          <p className="mt-0.5 text-xs text-subtle-foreground">
            Queued {item.queuedAt} by {item.queuedBy}
            {item.source ? ` · source: ${item.source}` : ""}
            {" · "}
            <Link href={jobHref(item.jobId)} className={LINK}>
              open {job?.jobNo ? `job ${job.jobNo}` : "the job"}
            </Link>
          </p>
        </div>

        <dl className="max-w-xl rounded-lg border border-hairline bg-card px-3.5 py-1 dark:bg-white/[0.02]">
          <Change label="Status" from={STATUS_LABEL[item.held.status]} to={STATUS_LABEL[item.proposed.status]} />
          <Change label="Builder’s date" from={item.held.date || "—"} to={item.proposed.date || "—"} />
        </dl>

        {item.note ? (
          <p className="max-w-[70ch] text-xs leading-relaxed text-muted-foreground">
            Note from the person who made the change: “{item.note}”
          </p>
        ) : null}

        {stale ? (
          <p
            role="alert"
            className="flex max-w-[70ch] gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs leading-relaxed text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200"
          >
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            <span>
              This milestone has changed since the item was queued — it is now{" "}
              {live ? `${STATUS_LABEL[live.status]}${live.date ? ` on ${live.date}` : ""}` : "no longer on this job"}.
              Releasing will be refused, because applying it would overwrite a change nobody here is looking at.
              Dismiss it with a reason and make the change again against what is on the milestone today.
            </span>
          </p>
        ) : null}

        <div className="flex max-w-xl flex-col gap-1.5">
          <Label htmlFor={reasonId}>
            Reason {stale ? "(required — this can only be dismissed)" : "(required to dismiss)"}
          </Label>
          <Input
            id={reasonId}
            value={reason}
            onChange={(e) => {
              setReason(e.target.value);
              if (e.target.value.trim()) setMissing(false);
            }}
            placeholder="Why is this being released or dismissed?"
            aria-invalid={missing || undefined}
            aria-describedby={hintId}
          />
          {missing ? (
            <p className="text-xs font-medium text-rose-700 dark:text-rose-300">
              Add a reason to dismiss — it is the only record of the decision.
            </p>
          ) : null}
          <p id={hintId} className="text-xs leading-relaxed text-subtle-foreground">
            Releasing applies the change here and sends it onward. Dismissing changes nothing anywhere, which is why it
            needs a reason — the reason is the only record of it.
          </p>
          <div className="mt-1 flex flex-wrap gap-2">
            <Button onClick={() => releaseReview(item.id, reason)} disabled={stale}>
              Release and sync
            </Button>
            <Button variant="outline" onClick={dismiss}>
              Dismiss
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/** One row of the comparison; a field the change doesn't touch isn't shown. */
function Change({ label, from, to }: { label: string; from: string; to: string }) {
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

const DECIDED: Record<Exclude<ReviewStatus, "pending">, { word: string; tone: PillTone; dot: string }> = {
  accepted: { word: "Released", tone: "ok", dot: "bg-emerald-500 dark:bg-emerald-400" },
  dismissed: { word: "Dismissed", tone: "neutral", dot: "bg-zinc-400 dark:bg-zinc-500" },
  superseded: { word: "Superseded", tone: "neutral", dot: "bg-zinc-300 dark:bg-zinc-600" },
};

function decision(item: ReviewItem): string {
  if (item.status === "accepted") {
    const p = item.proposed;
    return `Released — ${STATUS_LABEL[p.status]} applied${p.status === "done" && p.date ? `, builder date ${p.date}` : ""}.`;
  }
  if (item.status === "dismissed") return "Dismissed. Nothing was changed here or anywhere else.";
  return "Superseded by a newer change to the same milestone.";
}

function DecidedEntry({ item, job }: { item: ReviewItem; job: Job | undefined }) {
  const look = DECIDED[item.status as Exclude<ReviewStatus, "pending">] ?? DECIDED.superseded;
  return (
    <div className="flex gap-2.5 py-2.5">
      <span className={cn("mt-[6px] size-1.5 shrink-0 rounded-full", look.dot)} aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-semibold text-foreground">{item.summary}</p>
        <p className="text-xs leading-snug text-muted-foreground">
          {decision(item)}
          {item.decisionNote ? ` “${item.decisionNote}”` : ""}
          {" · "}
          <Link href={jobHref(item.jobId)} className={LINK}>
            open {job?.jobNo ? `job ${job.jobNo}` : "the job"}
          </Link>
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          <Pill variant="caps" tone={look.tone}>
            {look.word}
          </Pill>
          <span className="ml-auto text-xs whitespace-nowrap text-subtle-foreground tabular-nums">
            {item.decidedBy ?? "System"} · {item.decidedAt}
          </span>
        </div>
      </div>
    </div>
  );
}
