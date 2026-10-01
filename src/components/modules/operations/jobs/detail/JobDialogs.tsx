"use client";

import * as React from "react";
import { AlertTriangle, Check, HardHat, Lock } from "lucide-react";
import { BUILDER_CLAIMS, MILESTONE_HUBSPOT_STAGE, type Job } from "@/data/jobs";
import { cn } from "@/lib/utils";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";

const HANDOVER_EFFECTS = [
  "Monday item moves to Home Construction Pipeline; 8 milestone subitems created",
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
          Job {job.jobNo ? <span className="font-mono text-xs">{job.jobNo}</span> : "—"} · {job.client} · {job.builder}
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
            <Check className="mt-px size-3.5 shrink-0 text-tone-ink" aria-hidden />
            <span>{t}</span>
          </li>
        ))}
      </ul>
      <p className="mt-3 flex gap-2 rounded-lg bg-muted px-3 py-2.5 text-xs leading-relaxed text-foreground/85">
        <Lock className="mt-0.5 size-3 shrink-0" aria-hidden />
        <span>Restricted action. Available to admins, Shannan and Alison. Recorded in the sync trail.</span>
      </p>
    </Dialog>
  );
}

/** "28 Jul 2026" → "28 Jul" for a button label. */
function shortDate(date: string) {
  return date.split(" ").slice(0, 2).join(" ");
}

type Keep = "monday" | "crm";

/**
 * Resolve conflict (mockup `O`) — pick which system's value wins. Nothing is
 * chosen for you: the confirm stays disabled until a side is picked, and then
 * says exactly what it will do ("Accept Monday's 28 Jul").
 */
export function ConflictDialog({
  open,
  job,
  onClose,
  onResolve,
}: {
  open: boolean;
  job: Job;
  onClose: () => void;
  onResolve: (keep: Keep) => void;
}) {
  // Resolving clears the conflict at once; keep showing it while the dialog closes (HRIS § 10).
  const last = React.useRef(job.conflict);
  if (job.conflict) last.current = job.conflict;
  const c = last.current;
  const [choice, setChoice] = React.useState<Keep | null>(null);
  const groupId = React.useId();

  // Every opening starts undecided.
  React.useEffect(() => {
    if (open) setChoice(null);
  }, [open]);

  const mondayDate = c?.mondayDate ?? "";
  const hubDate = c?.hubDate ?? "";
  const labels: Record<Keep, string> = {
    monday: mondayDate ? `Accept Monday's ${shortDate(mondayDate)}` : "Accept Monday's value",
    crm: hubDate ? `Keep CRM Dash's ${shortDate(hubDate)}` : "Keep CRM Dash: no date",
  };
  const milestone = c?.milestone ?? "the milestone";
  const stage = mondayDate && c?.milestone ? MILESTONE_HUBSPOT_STAGE[c.milestone] : null;
  const claim = mondayDate && c?.milestone ? BUILDER_CLAIMS[job.builder]?.[c.milestone] : undefined;

  return (
    <Dialog
      open={open && Boolean(job.conflict)}
      onClose={onClose}
      icon={AlertTriangle}
      iconTone="problem"
      title="Resolve conflict"
      description={c ? `${c.field} disagrees between systems. Pick the value that's right; the other system is corrected to match.` : undefined}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={!choice} onClick={() => choice && onResolve(choice)}>
            {choice ? labels[choice] : "Choose a value"}
          </Button>
        </>
      }
    >
      {c ? (
        <div role="radiogroup" aria-labelledby={groupId} className="grid gap-2">
          <p id={groupId} className="text-xs font-semibold">
            Which {c.field} is right?
          </p>
          <ChoiceCard
            selected={choice === "monday"}
            title={labels.monday}
            body={`Monday: ${c.monday}. CRM Dash records it and marks ${milestone} Completed${
              stage ? `, HubSpot moves to ${stage}` : ""
            }${claim ? ` and a ${job.builder} draft invoice is raised in Xero for Accounts to approve` : ""}.`}
            onSelect={() => setChoice("monday")}
          />
          <ChoiceCard
            selected={choice === "crm"}
            title={labels.crm}
            body={`CRM Dash: ${c.hub}. Monday is corrected to match${
              hubDate ? "" : `, and ${milestone} stays awaiting the builder's date`
            }.`}
            onSelect={() => setChoice("crm")}
          />
        </div>
      ) : null}
    </Dialog>
  );
}

function ChoiceCard({
  title,
  body,
  selected,
  onSelect,
}: {
  title: string;
  body: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={cn(
        "flex items-start gap-3 rounded-lg border bg-card px-3.5 py-2.5 text-left transition-[border-color,background-color,box-shadow] duration-150 focus-visible:ring-3 focus-visible:ring-ring/45 focus-visible:outline-none dark:bg-white/[0.03]",
        selected
          ? "border-tone-strong bg-tone-soft ring-1 ring-tone-line dark:bg-tone-soft"
          : "border-border hover:border-tone-line hover:bg-tone-soft/50",
      )}
    >
      <span
        className={cn(
          "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border transition-colors duration-150",
          selected ? "border-tone-strong bg-tone-strong" : "border-border bg-card",
        )}
        aria-hidden
      >
        {selected ? <span className="size-1.5 rounded-full bg-white" /> : null}
      </span>
      <span className="min-w-0">
        <span className="block text-[13px] font-semibold">{title}</span>
        <span className="mt-0.5 block text-xs text-muted-foreground">{body}</span>
      </span>
    </button>
  );
}
