"use client";

import * as React from "react";
import { ClipboardList } from "lucide-react";
import { checklistFor } from "@/data/jobs";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { ChoiceGroup } from "../costing/choice-chips";
import { BUILDER_SUBMISSION_NOTE, SUBMISSION_BUILDERS, type SubmissionBuilder } from "./data";

/**
 * "New deal submission" (mockup `gm` modal): name the client, pick the builder,
 * and the checklist adapts to that builder's paperwork.
 */
export function NewSubmissionDialog({
  open,
  onClose,
  onStart,
}: {
  open: boolean;
  onClose: () => void;
  onStart: (client: string, builder: SubmissionBuilder) => void;
}) {
  const formId = React.useId();
  const [client, setClient] = React.useState("");
  const [builder, setBuilder] = React.useState<SubmissionBuilder>("Forma");
  const name = client.trim();
  const mandatory = checklistFor(builder).filter((d) => d.req).length;

  const start = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!name) return;
    onStart(name, builder);
    setClient("");
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="New deal submission"
      description="Pick the builder and the form adapts to their paperwork. You only enter the deal once."
      icon={ClipboardList}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form={formId} disabled={!name}>
            Start submission
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={start} className="flex flex-col gap-4">
        <Field label="Client name" htmlFor={`${formId}-client`}>
          <Input
            id={`${formId}-client`}
            value={client}
            onChange={(e) => setClient(e.target.value)}
            placeholder="e.g. J. and S. Whitfield"
            autoComplete="off"
            className="h-9"
          />
        </Field>
        <ChoiceGroup
          label="Builder"
          value={builder}
          onChange={setBuilder}
          options={SUBMISSION_BUILDERS}
          size="md"
          labelClassName="text-xs font-medium"
        />
        <p className="rounded-lg border border-haven-300 bg-haven-50 px-3 py-2.5 text-[11.5px] leading-relaxed dark:border-haven-800 dark:bg-haven-950/40">
          <strong className="font-semibold">{builder}</strong> requires{" "}
          <span className="tabular-nums">{mandatory}</span> mandatory documents{BUILDER_SUBMISSION_NOTE[builder]}.
        </p>
      </form>
    </Dialog>
  );
}
