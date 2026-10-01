"use client";

import * as React from "react";
import { motion, useReducedMotion } from "motion/react";
import { AlertTriangle, Check, Circle, Minus, ReceiptText, RefreshCw } from "lucide-react";
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
import type { MilestoneKind } from "../../sync/types";
import { UPDATE_SOURCES, type UpdateSource } from "../data";
import { EDITABLE_CARD } from "./DetailCards";

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
function StatusIcon({ m }: { m: Milestone }) {
  if (m.status === "done" && !m.date)
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
}

/** Preconstruction — every Monday subitem, in order. The next open item is highlighted. */
export function PreconCard({ job, editor }: { job: Job; editor: EditorBinding }) {
  const next = job.precon.find((m) => m.status === "open" || m.status === "prog");
  const editorId = React.useId();

  return (
    <Card className={EDITABLE_CARD}>
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
                        ? "bg-haven-50 hover:bg-haven-100/70 dark:bg-haven-950/35 dark:hover:bg-haven-950/55"
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
                      className="shrink-0 rounded-full bg-skyblue-200 px-1.5 py-px text-[10px] font-medium text-skyblue-900 dark:bg-skyblue-300/20 dark:text-skyblue-200"
                    >
                      HS
                    </span>
                  ) : null}
                  <span
                    className={cn(
                      "ml-auto shrink-0 text-right text-[11px] whitespace-nowrap tabular-nums",
                      noDate
                        ? "text-amber-700 dark:text-amber-300"
                        : isNext && m.status === "open"
                          ? "font-semibold text-haven-700 dark:text-haven-300"
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
                            : isNext
                              ? "Mark complete"
                              : "Not started"}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
        {editor.draft?.kind === "precon" ? <MilestoneEditor id={editorId} job={job} editor={editor} /> : null}
      </CardContent>
    </Card>
  );
}

/** Construction — the eight build stages as tiles. The next one pulses. */
export function ConstructionCard({ job, editor }: { job: Job; editor: EditorBinding }) {
  const next = job.milestones.find((m) => m.status !== "done");
  const editorId = React.useId();

  return (
    <Card className={EDITABLE_CARD}>
      <CardHeader>
        <CardTitle>Construction</CardTitle>
        <CardMeta className="text-muted-foreground">
          Dates are the builder&apos;s dates · each completion advances the HubSpot stage
        </CardMeta>
      </CardHeader>
      <CardContent>
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-[repeat(auto-fit,minmax(140px,1fr))]">
          {job.milestones.map((m) => {
            const isNext = next?.name === m.name;
            const done = m.status === "done";
            const editing = editor.draft?.kind === "construction" && editor.draft.name === m.name;
            return (
              <li key={m.name} className="flex">
                <button
                  type="button"
                  onClick={() => editor.onEdit("construction", m)}
                  aria-expanded={editing}
                  aria-controls={editing ? editorId : undefined}
                  className={cn(
                    "flex w-full flex-col rounded-lg border text-left transition-[transform,box-shadow,border-color,background-color] duration-200 hover:-translate-y-0.5 hover:shadow-md focus-visible:ring-3 focus-visible:ring-ring/45 focus-visible:outline-none",
                    isNext
                      ? "pulse-haven border-2 border-haven-400 bg-card px-[11px] py-[9px] dark:border-haven-400"
                      : cn("px-3 py-2.5", done ? "border-border bg-canvas dark:bg-white/[0.03]" : "border-border bg-card"),
                    editing && "ring-2 ring-haven-300 dark:ring-haven-700",
                  )}
                >
                  <span
                    className={cn(
                      "flex items-center gap-1 text-xs font-semibold",
                      done || isNext ? "text-foreground" : "text-muted-foreground",
                    )}
                  >
                    {done ? (
                      <Check className="size-3 shrink-0 text-emerald-600 dark:text-emerald-400" strokeWidth={2.75} aria-hidden />
                    ) : null}
                    {m.name}
                  </span>
                  <span
                    className={cn(
                      "mt-0.5 text-[11px] tabular-nums",
                      done
                        ? m.date
                          ? "text-muted-foreground"
                          : "text-amber-700 dark:text-amber-300"
                        : isNext
                          ? "font-semibold text-haven-700 dark:text-haven-300"
                          : "text-subtle-foreground",
                    )}
                  >
                    {done ? m.date || "Completed · no date" : isNext ? "Mark complete" : (STATUS_LABEL[m.status] ?? "Not started")}
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
function MilestoneEditor({ id, job, editor }: { id: string; job: Job; editor: EditorBinding }) {
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
  const claim = done ? BUILDER_CLAIMS[job.builder]?.[draft.name] : undefined;

  const note = !done
    ? "Saving updates the Monday subitem status. HubSpot stays unchanged until the milestone is Completed with a date."
    : draft.kind === "construction"
      ? stage
        ? `Saving writes to Launchpad, then updates the Monday subitem and HubSpot, advancing the deal stage to ${stage}.`
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
      className="mt-3 scroll-mb-4 rounded-lg border border-hairline bg-canvas px-4 py-3.5 dark:bg-white/[0.03]"
    >
      <p className="mb-2.5 text-[13px] font-semibold">Edit {draft.name}</p>

      <Label className="mb-1 block text-[11px]">Status</Label>
      <ChoiceChips
        label="Status"
        value={EDITABLE_STATUSES.find((s) => s.value === draft.status)?.value ?? ""}
        options={EDITABLE_STATUSES}
        onChange={(v) => patch({ status: v })}
      />

      <div className="mt-3 flex flex-wrap items-end gap-x-4 gap-y-3">
        {done ? (
          <div>
            <Label htmlFor={dateId} className="mb-1 block text-[11px]">
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
          <Label className="mb-1 block text-[11px]">Source</Label>
          <ChoiceChips label="Source" value={draft.source} options={SOURCE_OPTIONS} onChange={(v) => patch({ source: v })} />
        </div>
      </div>

      <p className="mt-3 rounded-lg bg-skyblue-100 px-3 py-2.5 text-xs leading-relaxed text-skyblue-950 dark:bg-skyblue-950/50 dark:text-skyblue-100">
        {note}
      </p>

      {claim ? (
        <p className="mt-2 flex gap-2 rounded-lg border border-haven-300 bg-haven-50 px-3 py-2.5 text-xs leading-relaxed text-foreground dark:border-haven-800 dark:bg-haven-950/40">
          <ReceiptText className="mt-0.5 size-3.5 shrink-0 text-haven-700 dark:text-haven-300" aria-hidden />
          <span>
            <strong className="font-semibold">Builder invoicing:</strong> this stage creates a draft invoice for{" "}
            {job.builder} in Xero. It waits for approval in Accounts — nothing is sent automatically.
          </span>
        </p>
      ) : null}

      <div className="mt-3 flex gap-2">
        <Button onClick={onSave}>Save update</Button>
        <Button variant="outline" onClick={() => setDraft(null)}>
          Cancel
        </Button>
      </div>
    </motion.div>
  );
}
