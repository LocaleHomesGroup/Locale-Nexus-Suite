"use client";

import * as React from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ExternalLink, HardHat, Lock, Pencil, RefreshCw } from "lucide-react";
import type { Job, LotDetail } from "@/data/jobs";
import { useLaunchpad } from "@/state/launchpad-store";
import { cn } from "@/lib/utils";
import { DURATION, EASE_OUT } from "@/lib/motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Pill } from "@/components/ui/pill";
import { Button } from "@/components/ui/button";
import { ChoiceChips } from "../../ui/ChoiceChips";
import { FieldRow, InlineInput } from "../../ui/FieldRow";
import { BUILDER_FORMAT_JOB_NO, CLIENT_PHONE } from "../data";

/** Cards CRM Dash owns (editable) wear a Haven rim; HubSpot-owned ones stay neutral. */
export const EDITABLE_CARD = "border-haven-300 dark:border-haven-800";

export function OwnerPill({ owner }: { owner: "hubspot" | "crm" }) {
  return owner === "hubspot" ? (
    <Pill tone="neutral" icon={Lock} className="ml-auto">
      HubSpot owns · read only
    </Pill>
  ) : (
    <Pill tone="haven" icon={Pencil} className="ml-auto">
      CRM Dash owns · editable
    </Pill>
  );
}

function SaveButton({ show, onClick, children, className }: { show: boolean; onClick: () => void; children: React.ReactNode; className?: string }) {
  const reduce = useReducedMotion();
  return (
    <AnimatePresence initial={false}>
      {show ? (
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, transition: { duration: reduce ? 0 : 0.12 } }}
          transition={{ duration: reduce ? 0 : DURATION.fade, ease: EASE_OUT }}
          className={className}
        >
          <Button size="sm" onClick={onClick}>
            <RefreshCw /> {children}
          </Button>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

/** Deal details — mirrored from HubSpot, read only. */
export function DealDetailsCard({ job }: { job: Job }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Deal details</CardTitle>
        <OwnerPill owner="hubspot" />
      </CardHeader>
      <CardContent>
        <FieldRow label="Deal name">
          <span className="text-right">
            {job.jobNo ? (
              <>
                <span className="font-mono text-[12px]">{job.jobNo}</span> {job.client}
              </>
            ) : (
              job.client
            )}
            <span className="text-[11px] text-subtle-foreground"> (auto from job no + client)</span>
          </span>
        </FieldRow>
        <FieldRow label="Sales rep">
          <span className="text-right">
            {job.rep}
            <span className="text-[11px] text-subtle-foreground"> · locked after Sale Won</span>
          </span>
        </FieldRow>
        <FieldRow label="Client phone">
          <span className="text-right tabular-nums">{CLIENT_PHONE}</span>
        </FieldRow>
        <p className="mt-2.5 flex items-center gap-1 text-[11px] text-muted-foreground">
          Mirrored from HubSpot. To change, edit in HubSpot <ExternalLink className="size-3" aria-hidden />
        </p>
      </CardContent>
    </Card>
  );
}

const BUYER_TYPES = [
  { value: "Retail", label: "Retail" },
  { value: "Wholesale", label: "Wholesale" },
] as const;
const TITLE_STATES = [
  { value: "Titled", label: "Titled" },
  { value: "Untitled", label: "Untitled" },
] as const;

/** Job details — CRM Dash owns these; edits land in the store at once, then sync on save. */
export function JobDetailsCard({
  job,
  dirty,
  onEdit,
  onSave,
  onMoveToConstruction,
}: {
  job: Job;
  dirty: boolean;
  onEdit: (patch: Partial<Job>) => void;
  onSave: () => void;
  onMoveToConstruction: () => void;
}) {
  const id = React.useId();
  const text: { label: string; key: "jobNo" | "saleWon" | "address"; placeholder?: string; mono?: boolean }[] = [
    {
      label: "Job number",
      key: "jobNo",
      placeholder: job.jobNo ? "" : "Enter at builder acceptance",
      mono: true,
    },
    { label: "Sale won date", key: "saleWon" },
    { label: "Site address", key: "address" },
  ];

  return (
    <Card className={EDITABLE_CARD}>
      <CardHeader>
        <CardTitle>Job details</CardTitle>
        <OwnerPill owner="crm" />
      </CardHeader>
      <CardContent>
        {text.map((f) => (
          <FieldRow key={f.key} label={f.label} htmlFor={`${id}-${f.key}`}>
            <InlineInput
              id={`${id}-${f.key}`}
              value={job[f.key]}
              placeholder={f.placeholder}
              onChange={(e) => onEdit({ [f.key]: e.target.value })}
              className={cn(f.mono && "font-mono text-[12.5px] placeholder:font-sans placeholder:text-[13px]")}
            />
          </FieldRow>
        ))}
        <FieldRow label="Buyer type">
          <ChoiceChips
            label="Buyer type"
            size="sm"
            value={job.buyerType as "Retail" | "Wholesale"}
            options={BUYER_TYPES}
            onChange={(v) => onEdit({ buyerType: v })}
            className="justify-end"
          />
        </FieldRow>
        <FieldRow label="Block titled status">
          <ChoiceChips
            label="Block titled status"
            size="sm"
            value={job.blockTitled as "Titled" | "Untitled"}
            options={TITLE_STATES}
            onChange={(v) => onEdit({ blockTitled: v })}
            className="justify-end"
          />
        </FieldRow>
        <FieldRow label="Block titled due" htmlFor={`${id}-blockDue`}>
          <InlineInput
            id={`${id}-blockDue`}
            value={job.blockDue}
            placeholder="Add due date"
            onChange={(e) => onEdit({ blockDue: e.target.value })}
          />
        </FieldRow>

        {!job.jobNo ? (
          <p className="mt-2.5 text-[11px] font-medium text-haven-700 dark:text-haven-300">
            Saving the job number renames the deal, fills Monday, and ticks Builder Acceptance
          </p>
        ) : null}
        <p className="mt-1.5 text-[10.5px] text-subtle-foreground">
          Job number format:{" "}
          {BUILDER_FORMAT_JOB_NO.includes(job.builder) ? "builder format, e.g. 2401022R" : "5 digits, e.g. 25431"} · Buyer
          type syncs to HubSpot and Monday
        </p>

        <SaveButton show={dirty} onClick={onSave} className="mt-3">
          Save and sync changes
        </SaveButton>

        {job.board === "sales" ? (
          <div className="mt-3.5 border-t border-hairline pt-3.5">
            <Button onClick={onMoveToConstruction}>
              <HardHat /> Move to construction
            </Button>
            <p className="mt-1.5 text-[10.5px] text-subtle-foreground">
              Usually proposed automatically when the builder portal shows a site start date. Manual move is for
              exceptions.
            </p>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

const LOT_FIELDS: { label: string; key: keyof LotDetail }[] = [
  { label: "Estate", key: "estate" },
  { label: "Developer", key: "developer" },
  { label: "Lot and street", key: "lot" },
  { label: "Suburb", key: "suburb" },
  { label: "House design", key: "design" },
  { label: "Build type", key: "type" },
  { label: "House size", key: "size" },
];

/** Land and house — the mirrored HubSpot site record, editable from CRM Dash. */
export function LandHouseCard({
  jobId,
  dirty,
  onDirty,
  onSave,
}: {
  jobId: number;
  dirty: boolean;
  onDirty: () => void;
  onSave: () => void;
}) {
  const { lotDetails, updateLot } = useLaunchpad();
  const lot = lotDetails[jobId];
  const id = React.useId();

  return (
    <Card className={EDITABLE_CARD}>
      <CardHeader>
        <CardTitle>Land and house</CardTitle>
        <OwnerPill owner="crm" />
      </CardHeader>
      <CardContent>
        {LOT_FIELDS.map((f) => (
          <FieldRow key={f.key} label={f.label} htmlFor={`${id}-${f.key}`}>
            <InlineInput
              id={`${id}-${f.key}`}
              value={lot?.[f.key] ?? ""}
              onChange={(e) => {
                updateLot(jobId, { [f.key]: e.target.value });
                onDirty();
              }}
            />
          </FieldRow>
        ))}
        <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-2">
          <p className="min-w-0 flex-1 text-[11px] text-muted-foreground">
            Syncs to the matching HubSpot deal properties and Monday columns.
          </p>
          <SaveButton show={dirty} onClick={onSave} className="ml-auto">
            Save and sync
          </SaveButton>
        </div>
      </CardContent>
    </Card>
  );
}
