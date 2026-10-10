"use client";

import * as React from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { AlertTriangle, ArrowRight, Ban, Check, CheckCircle2, Hourglass, ListChecks, SkipForward } from "lucide-react";
import { STATUS_LABEL, type Job } from "@/data/jobs";
import type { ReviewItem } from "@/data/seed";
import { useLaunchpad } from "@/state/launchpad-store";
import { DURATION, EASE_OUT, EASE_SWAP } from "@/lib/motion";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Field, Textarea } from "@/components/ui/input";
import { Pill } from "@/components/ui/pill";
import { useOperationsSync } from "../sync/OperationsSyncProvider";
import { jobHref } from "../jobs/JobsTable";
import { isStale, liveMilestone } from "./review";
import { ChangeList, LINK, kindLabel } from "./parts";

type Outcome = "released" | "dismissed" | "skipped";

/** What a disabled Release or Dismiss says while the writes are held (see OperationsSync.readOnly). */
const READ_ONLY_TITLE = "Read only while the Dash Sync go-live is on hold";

/** The item's facts above the comparison: who filed it, when, from where, and its job. */
function FiledLine({ item, job }: { item: ReviewItem; job: Job | undefined }) {
  return (
    <p className="text-xs leading-relaxed text-subtle-foreground">
      Filed {item.queuedAt} by {item.queuedBy}
      {item.source ? ` · source: ${item.source}` : ""}
      {" · "}
      <Link href={jobHref(item.jobId)} className={LINK}>
        open {job?.jobNo ? `job ${job.jobNo}` : "the job"}
      </Link>
    </p>
  );
}

/** Says what moved and why releasing is refused. */
function StaleAlert({ job, item }: { job: Job | undefined; item: ReviewItem }) {
  const live = liveMilestone(job, item);
  return (
    <p
      role="alert"
      className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs leading-relaxed text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200"
    >
      <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
      <span>
        This milestone has changed since the item was queued. It is now{" "}
        {live ? `${STATUS_LABEL[live.status]}${live.date ? ` on ${live.date}` : ""}` : "no longer on this job"}.
        Releasing will be refused, because applying it would overwrite a change nobody here is looking at. Dismiss it
        with a reason and make the change again against what is on the milestone today.
      </span>
    </p>
  );
}

/**
 * Process the review queue — HRIS's offboarding queue processor, for held
 * changes. It steps through the chosen items one at a time: each shows the
 * change, the filer's note and anything that has moved since, then Release and
 * sync, Dismiss (which asks for the reason) or Skip, which leaves it waiting.
 * A progress bar fills as items are decided, and the last one ends on a tally.
 */
export function ReviewProcessor({ ids, onClose }: { ids: string[] | null; onClose: () => void }) {
  const { reviewItems, jobs } = useLaunchpad();
  // While the writes are held, Release and Dismiss are off: the held write only toasts, and the screen would still tally "N released".
  const { releaseReview, dismissReview, readOnly } = useOperationsSync();
  const reduce = useReducedMotion();
  const open = Boolean(ids?.length);

  // Keep the last batch while the dialog plays its close.
  const kept = React.useRef<string[]>([]);
  if (ids?.length) kept.current = ids;
  const batch = kept.current;

  const [idx, setIdx] = React.useState(0);
  const [outcomes, setOutcomes] = React.useState<Record<string, Outcome>>({});
  const [notes, setNotes] = React.useState<Record<string, string>>({});
  const [dismissing, setDismissing] = React.useState(false);
  const [reason, setReason] = React.useState("");
  const [missing, setMissing] = React.useState(false);
  const noteId = React.useId();
  const reasonId = React.useId();

  const batchKey = ids?.join(",") ?? "";
  React.useEffect(() => {
    if (!batchKey) return;
    setIdx(0);
    setOutcomes({});
    setNotes({});
    setDismissing(false);
    setReason("");
    setMissing(false);
  }, [batchKey]);

  const total = batch.length;
  const done = idx >= total;
  const item = done ? undefined : reviewItems.find((i) => i.id === batch[idx]);
  const job = item ? jobs.find((j) => j.id === item.jobId) : undefined;
  const stale = item ? isStale(item, liveMilestone(job, item)) : false;
  const seen = Object.keys(outcomes).length;
  const count = (o: Outcome) => Object.values(outcomes).filter((x) => x === o).length;

  const advance = (id: string, outcome: Outcome) => {
    setOutcomes((prev) => ({ ...prev, [id]: outcome }));
    setDismissing(false);
    setReason("");
    setMissing(false);
    setIdx((i) => i + 1);
  };

  const release = () => {
    if (!item || stale || readOnly) return;
    releaseReview(item.id, notes[item.id] ?? "");
    advance(item.id, "released");
  };

  const confirmDismiss = () => {
    if (!item || readOnly) return;
    if (!reason.trim()) {
      setMissing(true);
      return;
    }
    dismissReview(item.id, reason);
    advance(item.id, "dismissed");
  };

  const footer = done ? (
    <Button onClick={onClose}>Done</Button>
  ) : dismissing ? (
    <>
      <Button variant="outline" className="mr-auto" onClick={() => setDismissing(false)}>
        Back
      </Button>
      <Button
        variant="destructive"
        onClick={confirmDismiss}
        disabled={readOnly}
        title={readOnly ? READ_ONLY_TITLE : undefined}
      >
        <Ban /> Confirm dismiss
      </Button>
    </>
  ) : (
    <>
      <Button
        variant="outline"
        className="mr-auto"
        onClick={() => setDismissing(true)}
        disabled={readOnly}
        title={readOnly ? READ_ONLY_TITLE : undefined}
      >
        <Ban /> Dismiss
      </Button>
      <Button variant="outline" onClick={() => item && advance(item.id, "skipped")}>
        <SkipForward /> Skip
      </Button>
      <Button
        variant="brand"
        onClick={release}
        disabled={stale || readOnly}
        title={
          readOnly ? READ_ONLY_TITLE : stale ? "Refused: the milestone has moved since this was filed" : undefined
        }
      >
        <Check /> Release and sync
        {idx + 1 < total ? <ArrowRight /> : null}
      </Button>
    </>
  );

  return (
    <Dialog
      open={open}
      onClose={onClose}
      icon={ListChecks}
      title={done ? "Queue processed" : `Change ${Math.min(idx + 1, total)} of ${total}`}
      description={
        readOnly
          ? "Read only while the Dash Sync go-live is on hold, so nothing can be released or dismissed. Skip steps through the queue."
          : "Releasing applies the change here and sends it to Monday and HubSpot. Dismissing changes nothing anywhere."
      }
      footer={footer}
    >
      <div className="flex flex-col gap-4">
        <div
          className="h-1 overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-label="Looked at so far"
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={seen}
        >
          <motion.div
            className="h-full w-full origin-left rounded-full bg-tone-strong"
            initial={false}
            animate={{ scaleX: total ? seen / total : 0 }}
            transition={{ duration: reduce ? 0 : 0.35, ease: EASE_SWAP }}
          />
        </div>

        <AnimatePresence mode="wait" initial={false}>
          {done ? (
            <motion.div
              key="done"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: reduce ? 0 : DURATION.fade, ease: EASE_SWAP }}
              className="flex flex-col items-center gap-2 py-4 text-center"
            >
              <motion.span
                className="flex size-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 ring-1 ring-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:ring-emerald-500/30"
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: reduce ? 0 : 0.4, ease: EASE_OUT, delay: reduce ? 0 : 0.08 }}
              >
                <CheckCircle2 className="size-6" />
              </motion.span>
              <p className="text-sm font-semibold">Every change in this batch has been looked at</p>
              <p className="text-xs text-muted-foreground tabular-nums">
                {count("released")} released · {count("dismissed")} dismissed · {count("skipped")} left waiting
              </p>
            </motion.div>
          ) : item ? (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -32 }}
              transition={{ duration: reduce ? 0 : 0.26, ease: EASE_SWAP }}
              className="flex flex-col gap-3"
            >
              <div className="flex items-start gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-tone-line bg-tone-soft text-tone-ink">
                  <Hourglass className="size-4.5" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[15px] leading-snug font-semibold">{item.summary}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    <Pill tone="neutral" className="px-2 py-0">
                      {kindLabel(item)}
                    </Pill>
                    {job ? <span className="truncate text-xs text-muted-foreground">{job.client}</span> : null}
                  </div>
                </div>
              </div>

              <FiledLine item={item} job={job} />
              <ChangeList item={item} />

              {item.note ? (
                <p className="text-xs leading-relaxed text-muted-foreground">
                  Note from the person who made the change: “{item.note}”
                </p>
              ) : null}

              {stale ? <StaleAlert job={job} item={item} /> : null}

              {dismissing ? (
                <Field
                  label="Why is it being dismissed? (required)"
                  htmlFor={reasonId}
                  hint="Dismissing changes nothing anywhere, so the reason is the only record of the decision."
                >
                  <Textarea
                    id={reasonId}
                    rows={2}
                    autoFocus
                    value={reason}
                    onChange={(e) => {
                      setReason(e.target.value);
                      if (e.target.value.trim()) setMissing(false);
                    }}
                    placeholder="Entered against the wrong job, the builder corrected it…"
                    aria-invalid={missing || undefined}
                  />
                  {missing ? (
                    <p className="text-xs font-medium text-rose-700 dark:text-rose-300">Add a reason to dismiss.</p>
                  ) : null}
                </Field>
              ) : !stale ? (
                <Field label="Note for the audit log (optional)" htmlFor={noteId}>
                  <Textarea
                    id={noteId}
                    rows={2}
                    value={notes[item.id] ?? ""}
                    onChange={(e) => setNotes((prev) => ({ ...prev, [item.id]: e.target.value }))}
                    placeholder="Matches the builder’s pour docket…"
                  />
                </Field>
              ) : null}
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </Dialog>
  );
}

/**
 * The row's quick Dismiss (HRIS's queue "Return"): the change, and the reason,
 * which is required because dismissing changes nothing anywhere.
 */
export function DismissDialog({ item, onClose }: { item: ReviewItem | null; onClose: () => void }) {
  const { jobs } = useLaunchpad();
  const { dismissReview, readOnly } = useOperationsSync();
  const [reason, setReason] = React.useState("");
  const [missing, setMissing] = React.useState(false);
  const reasonId = React.useId();

  // Keep the item while the dialog plays its close.
  const kept = React.useRef<ReviewItem | null>(null);
  if (item) kept.current = item;
  const shown = kept.current;
  const job = shown ? jobs.find((j) => j.id === shown.jobId) : undefined;

  React.useEffect(() => {
    setReason("");
    setMissing(false);
  }, [item?.id]);

  const submit = () => {
    if (!shown || readOnly) return;
    if (!reason.trim()) {
      setMissing(true);
      return;
    }
    dismissReview(shown.id, reason);
    onClose();
  };

  return (
    <Dialog
      open={Boolean(item)}
      onClose={onClose}
      icon={Ban}
      iconTone="charcoal"
      title={shown ? `Dismiss ${shown.milestone} on ${job?.jobNo || job?.client || "this job"}` : "Dismiss"}
      description={
        readOnly
          ? "Read only while the Dash Sync go-live is on hold, so nothing can be dismissed here."
          : "Nothing changes here, in Monday or in HubSpot. The reason goes in the audit log, and it is the only record of the decision."
      }
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={submit}
            disabled={readOnly}
            title={readOnly ? READ_ONLY_TITLE : undefined}
          >
            <Ban /> Dismiss
          </Button>
        </>
      }
    >
      {shown ? (
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <FiledLine item={shown} job={job} />
          <ChangeList item={shown} />
          <Field label="Reason (required)" htmlFor={reasonId}>
            <Textarea
              id={reasonId}
              rows={3}
              data-autofocus
              value={reason}
              onChange={(e) => {
                setReason(e.target.value);
                if (e.target.value.trim()) setMissing(false);
              }}
              placeholder="Why is this being dismissed?"
              aria-invalid={missing || undefined}
            />
            {missing ? (
              <p className="text-xs font-medium text-rose-700 dark:text-rose-300">
                Add a reason to dismiss. It is the only record of the decision.
              </p>
            ) : null}
          </Field>
        </form>
      ) : null}
    </Dialog>
  );
}
