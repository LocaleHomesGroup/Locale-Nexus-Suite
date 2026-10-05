"use client";

import * as React from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Check, CheckCheck, Eye, FileText, RotateCcw, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { EASE_OUT, EASE_SWAP, rowDelay } from "@/lib/motion";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardMeta, CardTitle } from "@/components/ui/card";
import { Pill } from "@/components/ui/pill";
import { Reveal } from "@/components/ui/reveal";
import { EmptyState } from "@/components/ui/states";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AutoHeight, Ticker, useCascading } from "@/components/ui/list-motion";
import { EMPLOYEE_ID, dayMonth, invoiceTotals, money } from "@/components/modules/employee/data";
import { StatusPill, billsFor } from "@/components/modules/employee/parts";
import { InvoiceDialog } from "@/components/modules/employee/InvoiceSheet";
import { php, toPhp } from "../fx";
import { RUN_DATE, phpFor, type PayeeInvoice, type RunSummary } from "../data";
import { decide, type PayRunView } from "../payrun-store";
import { AudPhp, PersonCell } from "../parts";

/**
 * Step 2 · Invoices: HRIS's Contractors step. Every invoice waiting on
 * Accounting, approved or rejected one at a time (or all at once), with Reset
 * to take a decision back. Pending invoices are skipped and wait for the next
 * run; rejected ones go back to the employee to correct.
 */
export function InvoicesStep({ view, run }: { view: PayRunView; run: RunSummary }) {
  const reduce = useReducedMotion();
  const [viewId, setViewId] = React.useState<string | null>(null);
  const viewing = run.queue.find((i) => i.id === viewId) ?? view.invoices.find((i) => i.id === viewId) ?? null;
  const locked = Boolean(view.dispatching || view.done);
  const rate = view.rate;
  const approvedAud = run.approved.reduce((n, i) => n + invoiceTotals(i.lines).total, 0);

  return (
    <div className="flex flex-col gap-4">
      <Reveal index={0} className="flex flex-wrap items-center gap-2">
        <Pill tone="ok" icon={Check}>
          <Ticker value={run.approved.length} /> approved · {money(approvedAud)}
        </Pill>
        {run.pending.length ? (
          <Pill tone="pending">
            <Ticker value={run.pending.length} /> to review
          </Pill>
        ) : null}
        {run.rejected.length ? (
          <Pill tone="problem">
            <Ticker value={run.rejected.length} /> rejected
          </Pill>
        ) : null}
        <span className="text-xs text-subtle-foreground">Pending invoices are skipped and wait for the next run.</span>
        {run.pending.length > 1 && !locked ? (
          <Button variant="outline" size="sm" className="ml-auto" onClick={() => decide(run.pending, "approved")}>
            <CheckCheck /> Approve all {run.pending.length}
          </Button>
        ) : null}
      </Reveal>

      <Reveal index={1}>
        <Card className="min-w-0 overflow-hidden">
          <CardHeader className="border-b border-hairline pb-3">
            <CardTitle as="h3">Invoices in this run</CardTitle>
            <CardMeta>
              <span>
                <Ticker value={run.queue.length} /> invoices · AUD, paid in PHP
              </span>
            </CardMeta>
          </CardHeader>
          <AutoHeight>
            {run.queue.length ? (
              <QueueTable rows={run.queue} rate={rate} locked={locked} onView={setViewId} />
            ) : (
              <EmptyState
                icon={FileText}
                title="No invoices waiting"
                description="Everything sent to Accounting has been paid. New invoices from the Employee portal land here."
              />
            )}
          </AutoHeight>
          {run.approved.length ? (
            <motion.div
              layout="position"
              transition={{ duration: reduce ? 0 : 0.22, ease: EASE_SWAP }}
              className="flex flex-wrap items-center justify-between gap-x-6 gap-y-1 border-t border-hairline bg-canvas/60 px-5 py-3 text-[13px]"
            >
              <span className="text-[10px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">Approved total</span>
              <span className="flex items-baseline gap-3 tabular-nums">
                <span className="font-semibold">{money(approvedAud)}</span>
                <span className="text-muted-foreground">{rate != null ? `≈ ${php(phpFor(run.approved, rate))}` : "₱ not set"}</span>
              </span>
            </motion.div>
          ) : null}
        </Card>
      </Reveal>

      <InvoiceDialog invoice={viewing} onClose={() => setViewId(null)} />
    </div>
  );
}

function QueueTable({
  rows,
  rate,
  locked,
  onView,
}: {
  rows: PayeeInvoice[];
  rate: number | null;
  locked: boolean;
  onView: (id: string) => void;
}) {
  const reduce = useReducedMotion();
  const cascading = useCascading();
  return (
    <Table className="min-w-[700px]">
      <TableHeader>
        <TableRow className="hover:bg-transparent dark:hover:bg-transparent">
          <TableHead className="pl-5">Employee</TableHead>
          <TableHead>Invoice</TableHead>
          <TableHead className="text-right">Total</TableHead>
          <TableHead className="pr-5 text-right">Decision</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <AnimatePresence initial={false}>
          {rows.map((inv, i) => {
            const total = invoiceTotals(inv.lines).total;
            const overdue = inv.due < RUN_DATE;
            return (
              <motion.tr
                key={inv.id}
                layout="position"
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -14, transition: { duration: reduce ? 0 : 0.14, ease: EASE_OUT } }}
                transition={{
                  duration: reduce ? 0 : 0.18,
                  ease: EASE_OUT,
                  delay: cascading ? rowDelay(i, reduce, 0.03) : 0,
                  layout: { duration: reduce ? 0 : 0.22, ease: EASE_SWAP, delay: 0 },
                }}
                className={cn(
                  "border-b border-hairline transition-colors hover:bg-tone-soft/60 dark:hover:bg-tone-soft/40",
                  inv.status === "rejected" && "bg-rose-50/40 dark:bg-rose-500/5",
                )}
              >
                <TableCell className="pl-5">
                  <PersonCell id={inv.employeeId} you={inv.employeeId === EMPLOYEE_ID} />
                </TableCell>
                <TableCell>
                  <button
                    type="button"
                    onClick={() => onView(inv.id)}
                    className="rounded-sm font-mono text-xs font-medium whitespace-nowrap underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/45"
                  >
                    {inv.number}
                  </button>
                  <span className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-muted-foreground">
                    <span className="whitespace-nowrap">{billsFor(inv)}</span>
                    <span aria-hidden>·</span>
                    <span className="whitespace-nowrap tabular-nums">due {dayMonth(inv.due)}</span>
                    {overdue && inv.status !== "rejected" ? (
                      <Pill variant="caps" tone="problem">
                        Overdue
                      </Pill>
                    ) : null}
                  </span>
                </TableCell>
                <TableCell className="text-right whitespace-nowrap">
                  <AudPhp aud={total} peso={rate != null ? toPhp(total, rate) : null} />
                </TableCell>
                <TableCell className="pr-5">
                  <div className="flex items-center justify-end gap-1">
                    {inv.status !== "pending" ? <StatusPill status={inv.status} className="mr-1" /> : null}
                    <Button variant="ghost" size="icon-sm" aria-label={`View invoice ${inv.number}`} onClick={() => onView(inv.id)}>
                      <Eye />
                    </Button>
                    <AnimatePresence mode="popLayout" initial={false}>
                      {inv.status === "pending" ? (
                        <motion.span
                          key="decide"
                          className="flex items-center gap-1"
                          initial={{ opacity: 0, scale: 0.96 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.96 }}
                          transition={{ duration: reduce ? 0 : 0.14, ease: EASE_OUT }}
                        >
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={locked}
                            className="border-emerald-300 text-emerald-700 hover:border-emerald-400 hover:bg-emerald-50 dark:border-emerald-500/40 dark:text-emerald-300 dark:hover:bg-emerald-500/10"
                            onClick={() => decide([inv], "approved")}
                          >
                            <Check /> Approve
                          </Button>
                          <Button variant="destructive" size="sm" disabled={locked} onClick={() => decide([inv], "rejected")}>
                            <X /> Reject
                          </Button>
                        </motion.span>
                      ) : (
                        <motion.span
                          key="reset"
                          initial={{ opacity: 0, scale: 0.96 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.96 }}
                          transition={{ duration: reduce ? 0 : 0.14, ease: EASE_OUT }}
                        >
                          <Button variant="ghost" size="sm" disabled={locked} onClick={() => decide([inv], "pending")}>
                            <RotateCcw /> Reset
                          </Button>
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </div>
                </TableCell>
              </motion.tr>
            );
          })}
        </AnimatePresence>
      </TableBody>
    </Table>
  );
}
