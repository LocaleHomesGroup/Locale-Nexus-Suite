"use client";

import * as React from "react";
import { AlertTriangle, Check, HardHat, Lock } from "lucide-react";
import type { Job } from "@/data/jobs";
import { cn } from "@/lib/utils";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";

const HANDOVER_EFFECTS = [
  "Monday item moves to Home Construction Pipeline; 7 milestone subitems created",
  "HubSpot deal moves to Construction Pipeline (WA), stage Site Start",
  "Date to Site recorded with the builder's date",
];

/** Move to construction (mockup `H`) — a restricted, three-system handover. */
export function HandoverDialog({
  open,
  job,
  siteStart,
  onSiteStart,
  onClose,
  onConfirm,
}: {
  open: boolean;
  job: Job;
  siteStart: string;
  onSiteStart: (v: string) => void;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const id = React.useId();
  return (
    <Dialog
      open={open}
      onClose={onClose}
      icon={HardHat}
      iconTone="charcoal"
      title="Move to construction"
      description={
        <>
          Job {job.jobNo ? <span className="font-mono text-[11.5px]">{job.jobNo}</span> : "—"} · {job.client} · {job.builder}
        </>
      }
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={onConfirm}>
            <HardHat /> Confirm move
          </Button>
        </>
      }
    >
      <Field label="Site start date (from builder)" htmlFor={id}>
        <Input id={id} value={siteStart} onChange={(e) => onSiteStart(e.target.value)} className="block w-44 text-xs tabular-nums" />
      </Field>
      <p className="mt-4 mb-1.5 text-xs font-semibold">This will update</p>
      <ul className="rounded-lg border border-hairline">
        {HANDOVER_EFFECTS.map((t) => (
          <li key={t} className="flex gap-2.5 border-t border-hairline px-3 py-2 text-xs first:border-t-0">
            <Check className="mt-px size-3.5 shrink-0 text-haven-700 dark:text-haven-300" aria-hidden />
            <span>{t}</span>
          </li>
        ))}
      </ul>
      <p className="mt-3 flex gap-2 rounded-lg bg-skyblue-100 px-3 py-2.5 text-xs leading-relaxed text-skyblue-950 dark:bg-skyblue-950/50 dark:text-skyblue-100">
        <Lock className="mt-0.5 size-3 shrink-0" aria-hidden />
        <span>Restricted action. Available to admins, Shannan and Alison. Recorded in the sync trail.</span>
      </p>
    </Dialog>
  );
}

/** Resolve conflict (mockup `O`) — pick which system's value wins. */
export function ConflictDialog({
  open,
  job,
  onClose,
  onResolve,
}: {
  open: boolean;
  job: Job;
  onClose: () => void;
  onResolve: (keep: "monday" | "crm") => void;
}) {
  // Resolving clears the conflict at once; keep showing it while the dialog closes (HRIS § 10).
  const last = React.useRef(job.conflict);
  if (job.conflict) last.current = job.conflict;
  const c = last.current;
  return (
    <Dialog
      open={open && Boolean(job.conflict)}
      onClose={onClose}
      icon={AlertTriangle}
      iconTone="problem"
      title="Resolve conflict"
      description={c ? `${c.field} disagrees between systems` : undefined}
      footer={
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
      }
    >
      {c ? (
        <div className="grid gap-2">
          <ChoiceCard
            recommended
            title="Accept Monday's value"
            body={`${c.monday}. CRM Dash records it and syncs to HubSpot.`}
            onClick={() => onResolve("monday")}
          />
          <ChoiceCard
            title="Keep the CRM Dash value"
            body={`${c.hub}. Monday will be corrected on the next sync pass.`}
            onClick={() => onResolve("crm")}
          />
        </div>
      ) : null}
    </Dialog>
  );
}

function ChoiceCard({
  title,
  body,
  onClick,
  recommended = false,
}: {
  title: string;
  body: string;
  onClick: () => void;
  recommended?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-lg bg-card px-3.5 py-2.5 text-left transition-[transform,box-shadow,border-color,background-color] duration-200 hover:-translate-y-0.5 hover:shadow-md focus-visible:ring-3 focus-visible:ring-ring/45 focus-visible:outline-none dark:bg-white/[0.03]",
        recommended
          ? "border-2 border-haven-300 hover:bg-haven-50/70 dark:border-haven-700 dark:hover:bg-haven-950/40"
          : "border border-border hover:border-haven-300 dark:hover:border-haven-800",
      )}
    >
      <span className="block text-[13px] font-semibold">{title}</span>
      <span className="mt-0.5 block text-xs text-muted-foreground">{body}</span>
    </button>
  );
}
