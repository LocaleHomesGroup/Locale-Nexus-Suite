"use client";

import * as React from "react";
import { motion, useReducedMotion } from "motion/react";
import { AlertTriangle, Check, Circle, Hourglass, Minus, ReceiptText, RefreshCw } from "lucide-react";
import {
  BUILDER_CLAIMS,
  MILESTONE_HUBSPOT_STAGE,
  PRECON_HUBSPOT_PROPERTY,
  STATUS_LABEL,
  type Job,
  type Milestone,
  type MilestoneStatus,
} from "@/data/jobs";
import { cn } from "@/lib/utils";
import { DURATION, EASE_OUT } from "@/lib/motion";
import { Card, CardContent, CardHeader, CardMeta, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { ChoiceChips } from "../../ui/ChoiceChips";
import { movesStageForward, type MilestoneKind } from "../../sync/types";
import { MONEY_MILESTONES, isRegression, liveMilestone } from "../../review/review";
import { UPDATE_SOURCES, type UpdateSource } from "../data";
import { useEditableCard } from "./DetailCards";
import { useJobReadOnly } from "./read-only";

export interface MilestoneDraft {
  kind: MilestoneKind;
  name: string;
  status: MilestoneStatus;
  date: string;
  source: UpdateSource;
}

const EDITABLE_STATUSES = (["done", "prog", "open", "na"] as const).map((s) => ({ value: s, label: STATUS_LABEL[s] }));
const SOURCE_OPTIONS = UPDATE_SOURCES.map((s) => ({ value: s, label: s }));

/**
 * The precon row glyph (mockup `vc`): done without a date is a caution, not a
 * tick. Decorative — the row's right-hand text carries the status in words.
 */
export function StatusIcon({ m }: { m: Milestone }) {
  if ((m.status === "done" && !m.date) || m.status === "pendingDate")
    return <AlertTriangle className="size-3.5 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />;
  if (m.status === "done")
    return <Check className="size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" strokeWidth={2.5} aria-hidden />;
  if (m.status === "prog") return <RefreshCw className="size-3 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />;
  if (m.status === "na") return <Minus className="size-3.5 shrink-0 text-subtle-foreground" aria-hidden />;
  return <Circle className="size-3 shrink-0 text-subtle-foreground" aria-hidden />;
}

interface EditorBinding {
  draft: MilestoneDraft | null;
  setDraft: React.Dispatch<React.SetStateAction<MilestoneDraft | null>>;
  onEdit: (kind: MilestoneKind, m: Milestone) => void;
  onSave: () => void;
  /** The milestone Monday and Launchpad disagree on, if any. It can't be edited until resolved. */
  conflictOn?: string;
  onConflict?: () => void;
}

/**
 * Preconstruction — every Monday subitem, in order. The next open item is
 * highlighted. The editor opens directly under the row that was clicked.
 */
export function PreconCard({ job, editor }: { job: Job; editor: EditorBinding }) {
  const next = job.precon.find((m) => m.status === "open" || m.status === "prog");
  const editorId = React.useId();
  const rim = useEditableCard();
  // A live job's milestones are Monday's: no hover tint, and no "Mark complete" prompt, on rows that can't be edited.
  const readOnly = useJobReadOnly();

  return (
    <Card className={rim}>
      <CardHeader>
        <CardTitle>Preconstruction</CardTitle>
        <CardMeta className="text-muted-foreground">Mirrors every Monday subitem: status, due date, date completed</CardMeta>
      </CardHeader>
      <CardContent>
        <ul>
          {job.precon.map((m) => {
            const isNext = next?.name === m.name;
            const noDate = m.status === "done" && !m.date;
            const editing = editor.draft?.kind === "precon" && editor.draft.name === m.name;
            return (
              <li key={m.name} className="border-t border-hairline first:border-t-0">
                <button
                  type="button"
                  onClick={() => editor.onEdit("precon", m)}
                  aria-expanded={editing}
                  aria-controls={editing ? editorId : undefined}
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-md px-1.5 py-2 text-left transition-colors focus-visible:ring-3 focus-visible:ring-ring/45 focus-visible:outline-none",
                    editing
                      ? "bg-muted"
                      : isNext
                        ? readOnly
                          ? "bg-tone-soft"
                          : "bg-tone-soft hover:bg-tone-tint"
                        : readOnly
                          ? ""
                          : "hover:bg-muted/60",
                  )}
                >
                  <StatusIcon m={m} />
                  <span
                    className={cn(
                      "min-w-0 text-xs",
                      m.status === "na" ? "text-subtle-foreground line-through" : "text-foreground",
                    )}
                  >
                    {m.name}
                  </span>
                  {PRECON_HUBSPOT_PROPERTY[m.name] ? (
                    <span
                      title="Mapped to a HubSpot property"
                      className="shrink-0 rounded-full bg-muted px-1.5 py-px text-[10px] font-semibold tracking-[0.08em] text-muted-foreground"
                    >
                      HS
                      <span className="sr-only"> · mapped to a HubSpot property</span>
                    </span>
                  ) : null}
                  <span
                    className={cn(
                      "ml-auto shrink-0 text-right text-xs whitespace-nowrap tabular-nums",
                      noDate || m.status === "pendingDate"
                        ? "text-amber-700 dark:text-amber-300"
                        : isNext && m.status === "open" && !readOnly
                          ? "font-semibold text-tone-ink"
                          : "text-muted-foreground",
                    )}
                  >
                    {noDate
                      ? "Completed · no date"
                      : m.status === "done"
                        ? (
                            <>
                              <span className="sr-only">Completed </span>
                              {m.date}
                            </>
                          )
                        : m.status === "prog"
                          ? m.due
                            ? `In progress · due ${m.due}`
                            : "In progress"
                          : m.status === "na"
                            ? "Not applicable"
                            : m.status === "pendingDate"
                              ? "Awaiting date"
                              : isNext && !readOnly
                              ? "Mark complete"
                              : "Not started"}
                  </span>
                </button>
                {editing ? <MilestoneEditor id={editorId} job={job} editor={editor} className="mt-1 mb-2.5" /> : null}
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}

/**
 * Construction — the eight build stages as tiles; the next one wears the
 * accent border. A stage in a sync conflict can't be marked complete: its tile
 * says so and opens the conflict instead of the editor.
 */
export function ConstructionCard({ job, editor }: { job: Job; editor: EditorBinding }) {
  const next = job.milestones.find((m) => m.status !== "done");
  const editorId = React.useId();
  const rim = useEditableCard();
  const readOnly = useJobReadOnly();

  return (
    <Card className={rim}>
      <CardHeader>
        <CardTitle>Construction</CardTitle>
        <CardMeta className="text-muted-foreground">
          Dates are the builder&apos;s dates · a completion can move the HubSpot stage forward, never back
        </CardMeta>
      </CardHeader>
      <CardContent>
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-[repeat(auto-fit,minmax(140px,1fr))]">
          {job.milestones.map((m) => {
            const isNext = next?.name === m.name;
            const done = m.status === "done";
            const conflicted = editor.conflictOn === m.name;
            const awaiting = m.status === "pendingDate";
            const editing = editor.draft?.kind === "construction" && editor.draft.name === m.name;
            return (
              <li key={m.name} className="flex">
                <button
                  type="button"
                  onClick={() => (conflicted ? editor.onConflict?.() : editor.onEdit("construction", m))}
                  aria-expanded={conflicted ? undefined : editing}
                  aria-haspopup={conflicted ? "dialog" : undefined}
                  title={conflicted ? "Monday and Launchpad disagree. Resolve the conflict to continue." : undefined}
                  aria-controls={editing ? editorId : undefined}
                  className={cn(
                    "flex w-full flex-col rounded-lg border text-left transition-[transform,box-shadow,border-color,background-color] duration-200",
                    readOnly ? "" : "hover:-translate-y-0.5 hover:shadow-md",
                    "focus-visible:ring-3 focus-visible:ring-ring/45 focus-visible:outline-none",
                    conflicted
                      ? "border-2 border-rose-300 bg-rose-50/70 px-[11px] py-[9px] dark:border-rose-500/50 dark:bg-rose-500/10"
                      : isNext
                        ? "border-2 border-tone-strong bg-card px-[11px] py-[9px]"
                        : cn("px-3 py-2.5", done ? "border-border bg-canvas dark:bg-white/[0.03]" : "border-border bg-card"),
                    editing && "ring-2 ring-tone-line",
                  )}
                >
                  <span
                    className={cn(
                      "flex items-center gap-1 text-xs font-semibold",
                      done || isNext || conflicted ? "text-foreground" : "text-muted-foreground",
                    )}
                  >
                    {done ? (
                      <Check className="size-3 shrink-0 text-emerald-600 dark:text-emerald-400" strokeWidth={2.75} aria-hidden />
                    ) : conflicted ? (
                      <AlertTriangle className="size-3 shrink-0 text-rose-600 dark:text-rose-400" aria-hidden />
                    ) : null}
                    {m.name}
                  </span>
                  <span
                    className={cn(
                      "mt-0.5 text-xs tabular-nums",
                      conflicted
                        ? "font-semibold text-rose-700 dark:text-rose-300"
                        : done
                          ? m.date
                            ? "text-muted-foreground"
                            : "text-amber-700 dark:text-amber-300"
                          : awaiting
                            ? "font-semibold text-amber-700 dark:text-amber-300"
                            : isNext && !readOnly
                              ? "font-semibold text-tone-ink"
                              : "text-subtle-foreground",
                    )}
                  >
                    {conflicted
                      ? "Date in conflict"
                      : done
                        ? m.date || "Completed · no date"
                        : awaiting
                          ? "Awaiting date"
                          : isNext && !readOnly
                            ? "Mark complete"
                            : (STATUS_LABEL[m.status] ?? "Not started")}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
        {editor.draft?.kind === "construction" ? <MilestoneEditor id={editorId} job={job} editor={editor} /> : null}
      </CardContent>
    </Card>
  );
}

/** The inline milestone editor (mockup `fs`): status, builder's date, source, then Save update. */
function MilestoneEditor({
  id,
  job,
  editor,
  className,
}: {
  id: string;
  job: Job;
  editor: EditorBinding;
  className?: string;
}) {
  const reduce = useReducedMotion();
  const ref = React.useRef<HTMLDivElement>(null);
  const dateId = React.useId();
  const { draft, setDraft, onSave } = editor;

  // Precon lists are long — bring the editor into view when a row far above it opens it.
  React.useEffect(() => {
    ref.current?.scrollIntoView({ block: "nearest", behavior: reduce ? "auto" : "smooth" });
  }, [draft?.name, reduce]);

  if (!draft) return null;
  const done = draft.status === "done";
  const stage = MILESTONE_HUBSPOT_STAGE[draft.name];
  const property = PRECON_HUBSPOT_PROPERTY[draft.name];
  const current = liveMilestone(job, { kind: draft.kind, milestone: draft.name });
  const regression = isRegression(current, draft.status, draft.date);
  // A reversal or backdate on a milestone that moves money waits for a person.
  const held = regression && MONEY_MILESTONES.has(draft.name);
  // A builder bills a stage once: only a first completion raises a claim.
  const claim = done && current?.status !== "done" ? BUILDER_CLAIMS[job.builder]?.[draft.name] : undefined;

  const note = !done
    ? "Saving updates the Monday subitem status. HubSpot stays unchanged until the milestone is Completed with a date."
    : draft.kind === "construction"
      ? stage
        ? movesStageForward(stage, job.hsStage)
          ? `Saving writes to Launchpad, then updates the Monday subitem and HubSpot, moving the deal stage forward to ${stage}.`
          : `Saving writes to Launchpad, then updates the Monday subitem and HubSpot. The deal is already at ${job.hsStage}, so its stage stays where it is.`
        : "Saving writes to Launchpad and the Monday subitem. No matching HubSpot stage exists for Key Handover — flagged for the field matrix."
      : property
        ? `Saving writes to Launchpad, updates the Monday subitem, and sets ${property} in HubSpot.`
        : "Saving writes to Launchpad and updates the Monday subitem. No HubSpot property exists for this milestone yet — flagged for the field matrix.";

  const patch = (p: Partial<MilestoneDraft>) => setDraft((d) => (d ? { ...d, ...p } : d));

  return (
    <motion.div
      ref={ref}
      id={id}
      key={draft.name}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduce ? 0 : DURATION.fade, ease: EASE_OUT }}
      className={cn(
        "mt-3 scroll-mb-4 rounded-lg border border-hairline bg-canvas px-4 py-3.5 dark:bg-white/[0.03]",
        className,
      )}
    >
      <p className="mb-2.5 text-[13px] font-semibold">Edit {draft.name}</p>

      <Label className="mb-1 block text-xs">Status</Label>
      <ChoiceChips
        label="Status"
        value={EDITABLE_STATUSES.find((s) => s.value === draft.status)?.value ?? ""}
        options={EDITABLE_STATUSES}
        onChange={(v) => patch({ status: v })}
      />

      <div className="mt-3 flex flex-wrap items-end gap-x-4 gap-y-3">
        {done ? (
          <div>
            <Label htmlFor={dateId} className="mb-1 block text-xs">
              Builder&apos;s date (Date Completed)
            </Label>
            <Input
              id={dateId}
              value={draft.date}
              onChange={(e) => patch({ date: e.target.value })}
              className="w-40 text-xs tabular-nums"
            />
          </div>
        ) : null}
        <div>
          <Label className="mb-1 block text-xs">Source</Label>
          <ChoiceChips label="Source" value={draft.source} options={SOURCE_OPTIONS} onChange={(v) => patch({ source: v })} />
        </div>
      </div>

      {held ? (
        <p className="mt-3 flex max-w-[70ch] gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs leading-relaxed text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
          <Hourglass className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          <span>
            This milestone affects cashflow, so the change is filed in the review queue rather than applied. Operations
            releases it from the Review queue; nothing reaches Monday or HubSpot until they do.
          </span>
        </p>
      ) : (
        <p className="mt-3 max-w-[70ch] rounded-lg bg-muted px-3 py-2.5 text-xs leading-relaxed text-foreground/85">
          {note}
          {regression ? " Reversing a completed milestone is allowed here, and is recorded in the audit log with your name." : ""}
        </p>
      )}

      {claim ? (
        <p className="mt-2 flex max-w-[70ch] gap-2 rounded-lg border border-tone-line bg-tone-soft px-3 py-2.5 text-xs leading-relaxed text-foreground">
          <ReceiptText className="mt-0.5 size-3.5 shrink-0 text-tone-ink" aria-hidden />
          <span>
            <strong className="font-semibold">Builder invoicing:</strong> this stage creates a draft invoice for{" "}
            {job.builder} in Xero. It waits for approval in Accounts. Nothing is sent automatically.
          </span>
        </p>
      ) : null}

      <div className="mt-3 flex gap-2">
        <Button onClick={onSave}>{held ? `File ${draft.name} for review` : `Save and sync ${draft.name}`}</Button>
        <Button variant="outline" onClick={() => setDraft(null)}>
          Cancel
        </Button>
      </div>
    </motion.div>
  );
}
