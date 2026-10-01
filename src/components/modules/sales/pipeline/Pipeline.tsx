"use client";

import * as React from "react";
import { motion, useReducedMotion } from "motion/react";
import { ArrowRight, Briefcase, Check, ExternalLink, Plus } from "lucide-react";
import { useLaunchpad, confirm } from "@/state/launchpad-store";
import { cn } from "@/lib/utils";
import { DURATION, EASE_SWAP } from "@/lib/motion";
import { PageHeader } from "@/components/ui/page";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/input";
import { SmoothSelect } from "@/components/ui/select";
import { Avatar } from "@/components/ui/avatar";
import { Reveal } from "@/components/ui/reveal";
import { SyncBadge } from "@/components/ui/sync-badge";
import type { Job } from "@/data/jobs";
import { PIPELINE_STAGES, REPS, CURRENT_REP, type PipelineDeal } from "../data";
import { useSalesState } from "../sales-state";
import { Footnote } from "../parts";

/**
 * Sales › Pipeline — the mockup's four-column deal board. Each card opens the
 * deal; "Move to …" advances it a stage, and a deal reaching Sale won is what
 * CRM Dash Sync picks up to create the job in Operations.
 */
export function Pipeline() {
  const { deals, setDeals } = useSalesState();
  const { jobs, notify, openJob } = useLaunchpad();
  const reduce = useReducedMotion();

  const [openDeal, setOpenDeal] = React.useState<PipelineDeal | null>(null);
  const [dealOpen, setDealOpen] = React.useState(false);
  const [newOpen, setNewOpen] = React.useState(false);

  const showDeal = (d: PipelineDeal) => {
    setOpenDeal(d);
    setDealOpen(true);
  };

  const moveDeal = (d: PipelineDeal) => {
    const next = PIPELINE_STAGES[PIPELINE_STAGES.indexOf(d.stage) + 1];
    if (!next) return;
    setDeals((prev) => [{ ...d, stage: next, days: "today" }, ...prev.filter((x) => x.id !== d.id)]);
    setDealOpen(false);
    if (next === "Sale won") {
      confirm(`Sale won · ${d.client}`, "CRM Dash Sync creates the job in Operations automatically.");
      notify(`Sale won · ${d.client}, ${d.suburb} ${d.value} — job queued in CRM Dash Sync`);
    } else {
      confirm(`${d.client} moved to ${next}`, "Deal stage updated in HubSpot.");
    }
  };

  const addDeal = (d: Omit<PipelineDeal, "id" | "stage" | "days">) => {
    setDeals((prev) => [{ ...d, id: `d-${Date.now()}`, stage: "Appointment booked", days: "today" }, ...prev]);
    setNewOpen(false);
    confirm(`Deal added · ${d.client}`, "In Appointment booked · synced to HubSpot.");
  };

  const job = openDeal ? jobs.find((j) => j.client === openDeal.client) : undefined;
  const nextStage = openDeal ? PIPELINE_STAGES[PIPELINE_STAGES.indexOf(openDeal.stage) + 1] : undefined;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Sales"
        title="Deal pipeline"
        description="One clean view of every deal by stage. Won deals flow straight into Operations."
        actions={
          <Button onClick={() => setNewOpen(true)}>
            <Plus aria-hidden /> New deal
          </Button>
        }
      />

      <Reveal index={0} className="min-w-0">
        <div className="overflow-x-auto pb-1 [scrollbar-width:thin]">
          <div className="grid min-w-[760px] grid-cols-4 gap-2.5">
            {PIPELINE_STAGES.map((stage, si) => {
              const inStage = deals.filter((d) => d.stage === stage);
              const won = si === PIPELINE_STAGES.length - 1;
              return (
                <section
                  key={stage}
                  aria-label={`${stage}, ${inStage.length} deals`}
                  className="flex min-h-60 flex-col rounded-xl border border-border bg-canvas p-2.5"
                >
                  <header className="mb-2 flex items-baseline gap-1.5 px-0.5">
                    <h2 className="text-xs font-semibold">{stage}</h2>
                    <span className="ml-auto text-[11px] text-subtle-foreground tabular-nums">{inStage.length}</span>
                  </header>
                  <ul className="flex flex-col gap-2">
                    {inStage.map((d) => (
                      <motion.li
                        key={d.id}
                        layoutId={reduce ? undefined : `deal-${d.id}`}
                        transition={{ duration: DURATION.swap, ease: EASE_SWAP }}
                      >
                        <DealCard deal={d} won={won} onOpen={() => showDeal(d)} />
                      </motion.li>
                    ))}
                  </ul>
                  {inStage.length === 0 ? (
                    <p className="mt-2 rounded-lg border border-dashed border-border px-3 py-4 text-center text-[11px] text-subtle-foreground">
                      No deals in this stage
                    </p>
                  ) : null}
                </section>
              );
            })}
          </div>
        </div>
        <Footnote className="mt-3 text-xs">Sale won creates the job in CRM Dash Sync automatically.</Footnote>
      </Reveal>

      <Dialog
        open={dealOpen}
        onClose={() => setDealOpen(false)}
        icon={Briefcase}
        title={openDeal?.client ?? ""}
        description={openDeal ? `${openDeal.suburb} · ${openDeal.value} · ${openDeal.days} in stage` : undefined}
        footer={
          openDeal ? (
            <>
              <Button variant="outline" onClick={() => setDealOpen(false)}>
                Close
              </Button>
              {nextStage ? (
                <Button variant={nextStage === "Sale won" ? "brand" : "default"} onClick={() => moveDeal(openDeal)}>
                  Move to {nextStage} <ArrowRight aria-hidden />
                </Button>
              ) : job ? (
                <Button
                  onClick={() => {
                    setDealOpen(false);
                    openJob(job.id);
                  }}
                >
                  Open job <ExternalLink aria-hidden />
                </Button>
              ) : null}
            </>
          ) : null
        }
      >
        {openDeal ? <DealDetail deal={openDeal} job={job} /> : null}
      </Dialog>

      <NewDealDialog open={newOpen} onClose={() => setNewOpen(false)} onAdd={addDeal} />
    </div>
  );
}

function DealCard({ deal, won, onOpen }: { deal: PipelineDeal; won: boolean; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        "w-full rounded-lg border bg-card px-3 py-2.5 text-left shadow-xs transition-[transform,box-shadow,border-color] duration-200 ease-out hover:-translate-y-0.5 hover:shadow-md focus-visible:ring-3 focus-visible:ring-ring/45 focus-visible:outline-none motion-reduce:transition-none motion-reduce:hover:translate-y-0",
        won ? "border-haven-300 dark:border-haven-700" : "border-border hover:border-haven-300 dark:hover:border-haven-800",
      )}
    >
      <span className="block text-xs font-semibold">{deal.client}</span>
      <span className="mt-0.5 mb-1.5 block text-[11px] text-muted-foreground tabular-nums">
        {deal.suburb} · {deal.value}
      </span>
      <span className="flex items-center">
        <span className="text-[10.5px] text-subtle-foreground">{deal.days} in stage</span>
        <span className="ml-auto" title={deal.rep}>
          <Avatar name={deal.rep} tone="haven" size="xs" />
          <span className="sr-only">Owner {deal.rep}</span>
        </span>
      </span>
    </button>
  );
}

function DealDetail({ deal, job }: { deal: PipelineDeal; job?: Job }) {
  const at = PIPELINE_STAGES.indexOf(deal.stage);
  return (
    <div className="flex flex-col gap-4">
      <ol className="grid grid-cols-4 gap-1.5" aria-label="Deal stage">
        {PIPELINE_STAGES.map((s, i) => (
          <li key={s} className="flex flex-col gap-1.5" aria-current={i === at ? "step" : undefined}>
            <span
              className={cn(
                "h-1.5 rounded-full",
                i < at && "bg-haven-400 dark:bg-haven-500",
                i === at && "bg-haven-600 dark:bg-haven-300",
                i > at && "bg-muted",
              )}
              aria-hidden
            />
            <span
              className={cn(
                "flex items-center gap-1 text-[10.5px] leading-tight",
                i === at ? "font-semibold text-foreground" : "text-subtle-foreground",
              )}
            >
              {i < at ? <Check className="size-3 shrink-0 text-haven-700 dark:text-haven-300" aria-hidden /> : null}
              {s}
            </span>
          </li>
        ))}
      </ol>

      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-[13px]">
        <dt className="text-muted-foreground">Owner</dt>
        <dd className="flex items-center gap-2">
          <Avatar name={deal.rep} tone="haven" size="xs" />
          {deal.rep}
        </dd>
        <dt className="text-muted-foreground">Value</dt>
        <dd className="tabular-nums">{deal.value}</dd>
        <dt className="text-muted-foreground">Suburb</dt>
        <dd>{deal.suburb}</dd>
        {job ? (
          <>
            <dt className="text-muted-foreground">Job</dt>
            <dd className="flex flex-wrap items-center gap-2">
              {job.jobNo ? (
                <span className="font-mono text-[11px] tabular-nums">{job.jobNo}</span>
              ) : (
                <span className="text-xs text-muted-foreground italic">Awaiting job no</span>
              )}
              <span className="text-muted-foreground">· {job.builder}</span>
              <SyncBadge sync={job.sync} />
            </dd>
          </>
        ) : null}
      </dl>

      {deal.stage === "Sale won" ? (
        <p className="rounded-lg border border-haven-300 bg-haven-50 px-3 py-2 text-xs text-haven-950 dark:border-haven-800 dark:bg-haven-950/40 dark:text-haven-100">
          Sale won creates the job in CRM Dash Sync automatically.
        </p>
      ) : null}
    </div>
  );
}

function NewDealDialog({
  open,
  onClose,
  onAdd,
}: {
  open: boolean;
  onClose: () => void;
  onAdd: (d: Omit<PipelineDeal, "id" | "stage" | "days">) => void;
}) {
  const formId = React.useId();
  const [client, setClient] = React.useState("");
  const [suburb, setSuburb] = React.useState("");
  const [value, setValue] = React.useState("");
  const [rep, setRep] = React.useState<string>(CURRENT_REP);

  React.useEffect(() => {
    if (open) {
      setClient("");
      setSuburb("");
      setValue("");
      setRep(CURRENT_REP);
    }
  }, [open]);

  const k = Number(value);
  const ready = client.trim().length > 0 && suburb.trim().length > 0 && Number.isFinite(k) && k > 0;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      icon={Plus}
      title="New deal"
      description="Adds the deal to Appointment booked and creates it in the HubSpot sales pipeline."
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form={formId} disabled={!ready}>
            Add deal
          </Button>
        </>
      }
    >
      <form
        id={formId}
        className="grid gap-3 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!ready) return;
          onAdd({ client: client.trim(), suburb: suburb.trim(), value: `$${Math.round(k)}k`, rep });
        }}
      >
        <Field label="Client" htmlFor={`${formId}-client`} className="sm:col-span-2">
          <Input
            id={`${formId}-client`}
            value={client}
            onChange={(e) => setClient(e.target.value)}
            placeholder="e.g. S. and A. Whitmore"
            autoComplete="off"
          />
        </Field>
        <Field label="Suburb" htmlFor={`${formId}-suburb`}>
          <Input
            id={`${formId}-suburb`}
            value={suburb}
            onChange={(e) => setSuburb(e.target.value)}
            placeholder="e.g. Baldivis"
            autoComplete="off"
          />
        </Field>
        <Field label="Estimated value" htmlFor={`${formId}-value`} hint="In thousands — 600 is $600k">
          <Input
            id={`${formId}-value`}
            type="number"
            inputMode="numeric"
            min={1}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="600"
            className="tabular-nums"
          />
        </Field>
        <Field label="Owner" htmlFor={`${formId}-rep`} className="sm:col-span-2">
          <SmoothSelect
            id={`${formId}-rep`}
            value={rep}
            onChange={setRep}
            options={REPS.map((r) => ({ value: r, label: r }))}
          />
        </Field>
      </form>
    </Dialog>
  );
}

