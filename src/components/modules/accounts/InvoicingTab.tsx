"use client";

import * as React from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { CalendarClock, Check, ExternalLink, FileClock, Loader2, Receipt, Send, TrendingUp, Zap } from "lucide-react";
import { BUILDER_CLAIMS, STATUS_LABEL, type Job, type Milestone } from "@/data/jobs";
import { useLaunchpad } from "@/state/launchpad-store";
import { aud, cn } from "@/lib/utils";
import { DURATION, EASE_OUT } from "@/lib/motion";
import { PageHeader } from "@/components/ui/page";
import { Card, CardContent, CardDescription, CardHeader, CardMeta, CardTitle } from "@/components/ui/card";
import { KpiCard, KpiGrid } from "@/components/ui/kpi-card";
import { Pill } from "@/components/ui/pill";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Reveal } from "@/components/ui/reveal";
import { FORECAST_NEXT_MONTH, type BuilderInvoice } from "./data";
import { INVOICE_TONE } from "./status";

/** The job page an invoice's job number opens. */
function jobHref(jobs: Job[], jobNo: string): string | null {
  const job = jobs.find((j) => j.jobNo === jobNo);
  return job ? `/operations/jobs/${job.id}` : null;
}

/** "Forma", "Forma and Move Homes", "Forma, Move Homes and New Era". */
function listOf(names: string[]): string {
  const u = [...new Set(names)];
  return u.length <= 1 ? (u[0] ?? "") : `${u.slice(0, -1).join(", ")} and ${u[u.length - 1]}`;
}

/**
 * Accounts › Builder invoicing. Stage completions in CRM Dash raise draft Xero
 * invoices; nothing reaches a builder until it's approved here. Approving
 * waits out an undo window before it goes to Xero (the row says "Sending"
 * meanwhile). The invoice list is owned by AccountsScreen so approvals survive
 * a tab switch.
 */
export function InvoicingTab({
  invoices,
  sending,
  invoicedThisMonth,
  onApprove,
  onApproveMany,
  onOpenInXero,
}: {
  invoices: BuilderInvoice[];
  /** Invoice ids inside their undo window. */
  sending: ReadonlySet<string>;
  invoicedThisMonth: number;
  onApprove: (id: string) => void;
  onApproveMany: (ids: string[]) => void;
  onOpenInXero: (id: string) => void;
}) {
  const { jobs } = useLaunchpad();
  const [batchOpen, setBatchOpen] = React.useState(false);

  const drafts = invoices.filter((i) => i.status === "Draft");
  const draftTotal = drafts.reduce((sum, i) => sum + i.amount, 0);
  const ready = drafts.filter((i) => !sending.has(i.id));
  const readyTotal = ready.reduce((sum, i) => sum + i.amount, 0);
  const inFlight = drafts.length - ready.length;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Builder invoicing"
        description="Stage completions raise draft invoices per each builder's schedule. Nothing reaches a builder until it's approved here."
        actions={
          <span className="inline-flex items-center gap-1.5 text-xs text-subtle-foreground">
            <Zap className="size-3.5" aria-hidden />
            Raised automatically from CRM Dash milestones · all amounts excl GST
          </span>
        }
      />

      <Reveal index={0}>
        <KpiGrid cols={3}>
          <KpiCard
            label="Drafts awaiting approval"
            value={drafts.length}
            icon={FileClock}
            sub={
              drafts.length === 0
                ? "All drafts approved"
                : inFlight > 0
                  ? `${inFlight} sending · ${aud(draftTotal)} + GST in drafts`
                  : `${aud(draftTotal)} + GST in drafts`
            }
          />
          <KpiCard label="Invoiced this month" value={aud(invoicedThisMonth)} icon={Receipt} tone="charcoal" sub="excl GST" />
          <KpiCard label="Forecast next month" value={aud(FORECAST_NEXT_MONTH)} icon={TrendingUp} sub="excl GST" />
        </KpiGrid>
      </Reveal>

      <Reveal index={1}>
        <Card className="overflow-hidden">
          <CardHeader className="border-b border-hairline pb-3">
            <CardTitle>Builder invoices</CardTitle>
            <CardMeta>
              {ready.length > 1 ? (
                <Button size="sm" variant="brand" onClick={() => setBatchOpen(true)}>
                  <Send aria-hidden /> Approve {ready.length} drafts · {aud(readyTotal)} + GST
                </Button>
              ) : (
                <span>
                  {drafts.length} {drafts.length === 1 ? "draft" : "drafts"} · {invoices.length} this month
                </span>
              )}
            </CardMeta>
          </CardHeader>
          <ul aria-label="Builder invoices">
            {invoices.map((inv) => (
              <InvoiceRow
                key={inv.id}
                invoice={inv}
                sending={sending.has(inv.id)}
                href={jobHref(jobs, inv.job)}
                onApprove={onApprove}
                onOpenInXero={onOpenInXero}
              />
            ))}
          </ul>
        </Card>
      </Reveal>

      <Reveal index={2}>
        <UpNext jobs={jobs} />
      </Reveal>

      <BatchDialog
        open={batchOpen}
        invoices={ready}
        onClose={() => setBatchOpen(false)}
        onConfirm={(ids) => {
          setBatchOpen(false);
          onApproveMany(ids);
        }}
      />
    </div>
  );
}

type RowStatus = BuilderInvoice["status"] | "Sending";

/**
 * One invoice — a card-list row (HRIS § 5.2). Stacks on mobile; on desktop a
 * fixed column grid keeps the amounts in one right-aligned line whatever the
 * status and actions beside them. Every invoice lives in Xero, so "Open in
 * Xero" stays on the row whatever its status.
 */
const InvoiceRow = React.memo(function InvoiceRow({
  invoice: inv,
  sending,
  href,
  onApprove,
  onOpenInXero,
}: {
  invoice: BuilderInvoice;
  sending: boolean;
  href: string | null;
  onApprove: (id: string) => void;
  onOpenInXero: (id: string) => void;
}) {
  const reduce = useReducedMotion();
  const isDraft = inv.status === "Draft";
  const status: RowStatus = isDraft && sending ? "Sending" : inv.status;

  return (
    <li
      aria-busy={sending || undefined}
      className={cn(
        "flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-hairline px-5 py-3 transition-colors duration-200 first:border-t-0 md:grid md:grid-cols-[minmax(0,1fr)_8rem_6.5rem_15rem] md:gap-x-4",
        sending ? "bg-amber-50/50 dark:bg-amber-500/[0.06]" : "hover:bg-tone-soft/50",
      )}
    >
      <div className="min-w-0 basis-full md:basis-auto">
        <p className="truncate text-[13px] font-medium">
          {href ? (
            <Link
              href={href}
              aria-label={`Open job ${inv.job} in Operations`}
              className="rounded-sm font-mono text-xs text-tone-ink tabular-nums underline-offset-2 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/45"
            >
              {inv.job}
            </Link>
          ) : (
            <span className="font-mono text-xs tabular-nums">{inv.job}</span>
          )}{" "}
          · {inv.client}
        </p>
        <p className="mt-0.5 text-xs leading-snug text-muted-foreground">
          <span className="font-mono text-xs text-subtle-foreground">{inv.id}</span> · {inv.builder} · {inv.stage}
          {inv.note ? ` · ${inv.note}` : ""}
        </p>
      </div>

      <span className="text-[13px] font-semibold whitespace-nowrap text-foreground tabular-nums md:text-right">
        {aud(inv.amount)} + GST
      </span>

      <span className="flex">
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={status}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: reduce ? 0 : DURATION.fade, ease: EASE_OUT }}
            className="inline-flex"
          >
            <Pill
              variant="caps"
              tone={status === "Sending" ? "pending" : INVOICE_TONE[status]}
              icon={status === "Approved" ? Check : undefined}
            >
              {status}
            </Pill>
          </motion.span>
        </AnimatePresence>
      </span>

      <div className="ml-auto flex items-center justify-end gap-1.5 md:ml-0">
        {isDraft ? (
          <Button
            size="sm"
            disabled={sending}
            onClick={() => onApprove(inv.id)}
            aria-label={sending ? `Sending invoice ${inv.id}` : `Approve invoice ${inv.id} for job ${inv.job}`}
          >
            {sending ? (
              <>
                <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden /> Sending…
              </>
            ) : (
              "Approve"
            )}
          </Button>
        ) : null}
        <Button
          size="sm"
          variant="outline"
          disabled={sending}
          onClick={() => onOpenInXero(inv.id)}
          aria-label={`Open invoice ${inv.id} in Xero`}
        >
          Open in Xero <ExternalLink className="size-3" aria-hidden />
        </Button>
      </div>
    </li>
  );
});

/** Batch approve: every draft, its builder and job, and the total, before anything goes to Xero. */
function BatchDialog({
  open,
  invoices,
  onClose,
  onConfirm,
}: {
  open: boolean;
  invoices: BuilderInvoice[];
  onClose: () => void;
  onConfirm: (ids: string[]) => void;
}) {
  // Keep the list on screen while the dialog plays its close.
  const last = React.useRef(invoices);
  if (open) last.current = invoices;
  const list = last.current;
  const total = list.reduce((sum, i) => sum + i.amount, 0);
  const n = list.length;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="lg"
      icon={Send}
      title={`Approve and send ${n} invoices`}
      description={`Each one is approved in Xero and emailed to its builder: ${listOf(list.map((i) => i.builder))}. You get a few seconds to undo after confirming.`}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="brand" onClick={() => onConfirm(list.map((i) => i.id))}>
            <Send aria-hidden /> Send {n} invoices · {aud(total)} + GST
          </Button>
        </>
      }
    >
      <table className="w-full text-[13px]">
        <caption className="sr-only">Invoices to approve and send</caption>
        <thead>
          <tr className="border-b border-border text-left text-[10px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
            <th scope="col" className="pb-2 font-semibold">
              Invoice
            </th>
            <th scope="col" className="pb-2 font-semibold">
              Builder
            </th>
            <th scope="col" className="pb-2 font-semibold">
              Job
            </th>
            <th scope="col" className="pb-2 text-right font-semibold">
              Amount
            </th>
          </tr>
        </thead>
        <tbody>
          {list.map((inv) => (
            <tr key={inv.id} className="border-b border-hairline align-top">
              <td className="py-2 pr-3 font-mono text-xs whitespace-nowrap">{inv.id}</td>
              <td className="py-2 pr-3">{inv.builder}</td>
              <td className="py-2 pr-3">
                <span className="font-mono text-xs">{inv.job}</span>
                <span className="block text-xs text-muted-foreground">
                  {inv.client} · {inv.stage}
                </span>
              </td>
              <td className="py-2 text-right font-medium whitespace-nowrap tabular-nums">{aud(inv.amount)} + GST</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <th scope="row" colSpan={3} className="pt-2.5 text-left text-xs font-semibold">
              Total · {n} invoices
            </th>
            <td className="pt-2.5 text-right font-semibold whitespace-nowrap tabular-nums">{aud(total)} + GST</td>
          </tr>
        </tfoot>
      </table>
    </Dialog>
  );
}

interface NextClaim {
  job: Job;
  stage: string;
  amount: number;
  milestone: Milestone;
}

/**
 * The next draft each job's builder schedule will raise: the first billable
 * milestone (precon, then construction) that isn't complete yet. Live from the
 * jobs CRM Dash holds, so a stage completed in Operations drops off here.
 */
function nextClaims(jobs: Job[]): NextClaim[] {
  return jobs.flatMap((job) => {
    const schedule = BUILDER_CLAIMS[job.builder];
    if (!schedule) return [];
    const m = [...job.precon, ...job.milestones].find((x) => schedule[x.name] && x.status !== "done");
    return m ? [{ job, stage: m.name, amount: schedule[m.name], milestone: m }] : [];
  });
}

function claimState(c: NextClaim): { label: string; tone: "problem" | "pending" | "neutral" } {
  if (c.job.sync === "conflict" && c.job.conflict?.milestone === c.stage) return { label: "Date in conflict", tone: "problem" };
  if (c.milestone.status === "pendingDate") return { label: "Awaiting builder date", tone: "pending" };
  if (c.milestone.status === "prog") return { label: "In progress", tone: "pending" };
  return { label: STATUS_LABEL[c.milestone.status], tone: "neutral" };
}

/** Replaces the old "schedules aren't shown here" note with what the schedules will raise next. */
function UpNext({ jobs }: { jobs: Job[] }) {
  const claims = nextClaims(jobs);
  // What needs a person first: conflicts, then dates owed, then the rest in job order.
  const rank = (c: NextClaim) => ({ problem: 0, pending: 1, neutral: 2 })[claimState(c).tone];
  const sorted = [...claims].sort((a, b) => rank(a) - rank(b));
  const shown = sorted.slice(0, 6);
  const total = claims.reduce((sum, c) => sum + c.amount, 0);

  return (
    <Card>
      <CardHeader>
        <CalendarClock className="size-4 text-tone-ink" aria-hidden />
        <CardTitle>Next drafts to be raised</CardTitle>
        <CardMeta className="tabular-nums">
          {claims.length} jobs · {aud(total)} + GST
        </CardMeta>
        <CardDescription className="basis-full">
          <span className="block max-w-[70ch]">
            Each builder&apos;s schedule raises a draft here when one of these milestones completes in CRM Dash. Nothing
            is sent until it&apos;s approved above.
          </span>
        </CardDescription>
      </CardHeader>
      <CardContent className="px-0 pb-0">
        {shown.length === 0 ? (
          <p className="px-5 pb-4 text-xs text-subtle-foreground">No billable milestones left on any job.</p>
        ) : (
          <ul aria-label="Next drafts to be raised">
            {shown.map((c) => {
              const state = claimState(c);
              return (
                <li
                  key={c.job.id}
                  className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-hairline px-5 py-2.5 md:grid md:grid-cols-[minmax(0,1fr)_8rem_10rem] md:gap-x-4"
                >
                  <p className="min-w-0 basis-full truncate text-[13px] md:basis-auto">
                    {c.job.jobNo ? (
                      <Link
                        href={`/operations/jobs/${c.job.id}`}
                        className="rounded-sm font-mono text-xs text-tone-ink underline-offset-2 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/45"
                      >
                        {c.job.jobNo}
                      </Link>
                    ) : (
                      <span className="text-xs text-subtle-foreground">No job no</span>
                    )}{" "}
                    · {c.job.client}
                    <span className="text-xs text-muted-foreground">
                      {" "}
                      · {c.job.builder} · {c.stage}
                    </span>
                  </p>
                  <span className="text-[13px] font-medium whitespace-nowrap text-foreground tabular-nums md:text-right">
                    {aud(c.amount)} + GST
                  </span>
                  <span className="ml-auto md:ml-0">
                    <Pill tone={state.tone}>{state.label}</Pill>
                  </span>
                </li>
              );
            })}
          </ul>
        )}
        {sorted.length > shown.length ? (
          <p className="border-t border-hairline px-5 py-2.5 text-xs text-subtle-foreground">
            {sorted.length - shown.length} more jobs further out
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
