"use client";

import * as React from "react";
import Link from "next/link";
import { CircleCheck, LoaderCircle, Send } from "lucide-react";
import { cn } from "@/lib/utils";
import { undoable } from "@/lib/undoable";
import { awaitingAcceptance, nextStep } from "@/data/journey";
import { DEVELOPER, PORTAL_TODAY } from "@/data/portal";
import type { Job } from "@/data/jobs";
import { useLaunchpad } from "@/state/launchpad-store";
import { useTabParam } from "@/hooks/useTabParam";
import { hrefForKey } from "@/components/shell/dashboards";
import { PageHeader } from "@/components/ui/page";
import { Card, CardContent } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/input";
import { Pill } from "@/components/ui/pill";
import { Reveal } from "@/components/ui/reveal";
import { SlidingTabs } from "@/components/ui/sliding-tabs";
import { EmptyState } from "@/components/ui/states";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { STAGE_VIEW, homeLine, useDeveloperJobs, type DeveloperJob } from "./parts";

const FILTERS = ["all", "awaiting", "operations", "precon", "construction", "handover"] as const;
type Filter = (typeof FILTERS)[number];

const matches = (d: DeveloperJob, f: Filter) =>
  f === "all" ||
  (f === "awaiting"
    ? awaitingAcceptance(d.job)
    : f === "handover"
      ? d.stage === "handover" || d.stage === "done"
      : d.stage === f);

/**
 * Developer › Locale clients — every client Locale has sold this builder's
 * homes to, where each is in their journey and who has the next move. A new
 * sale waits here for the builder to accept it: entering its job number and
 * accepting ticks Builder Acceptance on the shared job (after the usual undo
 * window), so Operations, the client and Monday all see it — the same rule
 * Operations applies when a job number arrives by email.
 */
export function DeveloperClients() {
  const mine = useDeveloperJobs();
  const [show, setShow] = useTabParam(FILTERS, "all", "show");
  const [accepting, setAccepting] = React.useState<Job | null>(null);
  const [pending, setPending] = React.useState<ReadonlySet<number>>(() => new Set());
  const rows = mine.filter((d) => matches(d, show));
  const count = (f: Filter) => mine.filter((d) => matches(d, f)).length;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Locale clients"
        description="Every client Locale has sold your homes to, where they are in their journey, and who has the next move."
      />

      <SlidingTabs
        ariaLabel="Show clients"
        value={show}
        onChange={setShow}
        items={[
          { value: "all", label: "All", count: count("all") },
          { value: "awaiting", label: "Awaiting you", count: count("awaiting") },
          { value: "operations", label: "Locale operations", count: count("operations") },
          { value: "precon", label: "Pre-construction", count: count("precon") },
          { value: "construction", label: "Construction", count: count("construction") },
          { value: "handover", label: "Handover", count: count("handover") },
        ]}
      />

      <Reveal index={0}>
        <Card>
          <CardContent className="px-0 pb-0">
            {rows.length === 0 ? (
              <EmptyState
                icon={CircleCheck}
                title={show === "awaiting" ? "Every job accepted" : "No clients at this stage"}
                description={
                  show === "awaiting"
                    ? "New Locale sales wait here for you to accept them."
                    : "Pick another stage, or All."
                }
              />
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="pl-5">Client</TableHead>
                      <TableHead>Home</TableHead>
                      <TableHead>Consultant</TableHead>
                      <TableHead>Stage</TableHead>
                      <TableHead>Next</TableHead>
                      <TableHead className="pr-5 text-right">
                        <span className="sr-only">Action</span>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((d) => {
                      const view = STAGE_VIEW[d.stage];
                      const waiting = awaitingAcceptance(d.job);
                      const inWindow = pending.has(d.job.id);
                      const next = nextStep(d.job);
                      return (
                        <TableRow key={d.job.id}>
                          <TableCell className="pl-5">
                            <span className="block font-medium">{d.job.client}</span>
                            <span className="block font-mono text-xs text-muted-foreground">
                              {d.job.jobNo ? `Job ${d.job.jobNo}` : "No job number yet"}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className="block">{homeLine(d.lot)}</span>
                            <span className="block text-xs text-muted-foreground">
                              {d.lot.suburb} · sold {d.job.saleWon}
                            </span>
                          </TableCell>
                          <TableCell className="text-muted-foreground">{d.job.rep}</TableCell>
                          <TableCell>{view ? <Pill tone={view.tone}>{view.label}</Pill> : null}</TableCell>
                          <TableCell>
                            {waiting ? (
                              <span className="font-medium text-amber-800 dark:text-amber-300">Accept the job</span>
                            ) : (
                              <span>{next ? next.name : "Maintenance period"}</span>
                            )}
                            <span
                              className={cn(
                                "block text-xs",
                                waiting || view?.withYou ? "text-tone-ink" : "text-muted-foreground",
                              )}
                            >
                              {waiting || view?.withYou ? "With you" : "With Locale"}
                            </span>
                          </TableCell>
                          <TableCell className="pr-5 text-right">
                            {waiting ? (
                              <Button
                                size="sm"
                                onClick={() => setAccepting(d.job)}
                                disabled={inWindow}
                                aria-busy={inWindow || undefined}
                              >
                                {inWindow ? (
                                  <>
                                    <LoaderCircle className="animate-spin motion-reduce:animate-none" aria-hidden />{" "}
                                    Accepting…
                                  </>
                                ) : (
                                  "Accept job"
                                )}
                              </Button>
                            ) : d.job.milestones.length ? (
                              <Link
                                href={hrefForKey("developer:updates", { job: String(d.job.id) })}
                                className={buttonVariants({ variant: "outline", size: "sm" })}
                              >
                                <Send aria-hidden /> Send update
                              </Link>
                            ) : null}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </Reveal>

      <AcceptDialog
        job={accepting}
        onClose={() => setAccepting(null)}
        onPending={(id, on) =>
          setPending((prev) => {
            const next = new Set(prev);
            if (on) next.add(id);
            else next.delete(id);
            return next;
          })
        }
      />
    </div>
  );
}

/** Accept a new Locale sale: give it your job number, and Builder Acceptance is ticked everywhere. */
function AcceptDialog({
  job,
  onClose,
  onPending,
}: {
  job: Job | null;
  onClose: () => void;
  onPending: (id: number, on: boolean) => void;
}) {
  const { updateJob, logActivity, notify } = useLaunchpad();
  const [jobNo, setJobNo] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [shown, setShown] = React.useState<Job | null>(job);
  if (job && job !== shown) {
    setShown(job);
    setJobNo("");
    setError(null);
  }

  const accept = () => {
    if (!job) return;
    const no = jobNo.trim();
    if (!/^\d{5}$/.test(no)) {
      setError("Enter your five-digit job number.");
      return;
    }
    const { id, client } = job;
    onClose();
    onPending(id, true);
    undoable({
      message: `Accepting ${client} as job ${no}`,
      description: "Ticks Builder Acceptance for Locale Operations, Monday and HubSpot",
      commit: () => {
        updateJob(id, (j) => ({
          jobNo: no,
          precon: j.precon.map((m) =>
            m.name === "Builder Acceptance" && m.status !== "done" ? { ...m, status: "done", date: PORTAL_TODAY } : m,
          ),
        }));
        logActivity(
          "details",
          "Accepted in the Developer portal",
          `${no} · Builder Acceptance ticked by ${DEVELOPER}`,
          ["Monday", "HubSpot"],
          id,
          `${DEVELOPER} · Developer portal`,
        );
        notify(`${DEVELOPER} accepted ${client} as job ${no} (Developer portal)`);
        onPending(id, false);
      },
      undo: () => onPending(id, false),
      done: { message: `${client} accepted`, description: `Job ${no} · Locale Operations has it` },
    });
  };

  const d = job ?? shown;
  return (
    <Dialog
      open={Boolean(job)}
      onClose={onClose}
      icon={CircleCheck}
      iconTone="ok"
      title={d ? `Accept ${d.client}` : "Accept job"}
      description="Your job number goes on the deal, Builder Acceptance is ticked, and Locale Operations moves on to the compliance sketch and quote. You get six seconds to undo."
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={accept}>Accept job</Button>
        </>
      }
    >
      <Field label="Your job number" htmlFor="accept-job-no" hint="Five digits, as it appears in your own system.">
        <Input
          id="accept-job-no"
          inputMode="numeric"
          autoComplete="off"
          placeholder="25530"
          value={jobNo}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "accept-job-no-error" : undefined}
          className="font-mono tabular-nums"
          onChange={(e) => {
            setJobNo(e.target.value.replace(/\D/g, "").slice(0, 5));
            if (error) setError(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") accept();
          }}
        />
      </Field>
      {error ? (
        <p id="accept-job-no-error" role="alert" className="mt-1.5 text-xs text-rose-700 dark:text-rose-300">
          {error}
        </p>
      ) : null}
    </Dialog>
  );
}
