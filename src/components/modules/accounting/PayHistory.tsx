"use client";

import * as React from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowRightLeft, Banknote, ChevronDown, Eye, FileText, Send } from "lucide-react";
import { cn } from "@/lib/utils";
import { DURATION, EASE_OUT, EASE_SWAP, rowDelay } from "@/lib/motion";
import { PageHeader } from "@/components/ui/page";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardMeta, CardTitle } from "@/components/ui/card";
import { KpiCard, KpiGrid } from "@/components/ui/kpi-card";
import { Pill } from "@/components/ui/pill";
import { Reveal } from "@/components/ui/reveal";
import { EmptyState } from "@/components/ui/states";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useCascading } from "@/components/ui/list-motion";
import { EMPLOYEE_ID, dayMonth, invoiceTotals, longDate, money } from "@/components/modules/employee/data";
import { billsFor } from "@/components/modules/employee/parts";
import { InvoiceDialog } from "@/components/modules/employee/InvoiceSheet";
import { php, phpWhole, rateText } from "./fx";
import { PAY_RUN, personOf, type PayeeInvoice, type PayRun } from "./data";
import { usePayRun } from "./payrun-store";
import { PersonCell } from "./parts";

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/**
 * Accounting › Pay history: every dispatched run, newest first (HRIS's
 * Reports step, kept as its own section). A run's figures are frozen at
 * dispatch; open one to see who it paid, and any invoice exactly as sent.
 */
export function PayHistory() {
  const reduce = useReducedMotion();
  const cascading = useCascading();
  const view = usePayRun();
  const runs = view.runs;
  const [openId, setOpenId] = React.useState<string | null>(null);
  const [viewId, setViewId] = React.useState<string | null>(null);
  const viewing = view.invoices.find((i) => i.id === viewId) ?? null;

  const last = runs[0];
  const total = runs.reduce((n, r) => n + r.php, 0);
  const invoices = runs.reduce((n, r) => n + r.invoiceIds.length, 0);
  const recent = runs.slice(0, 5);
  const avgRate = recent.reduce((n, r) => n + r.rate, 0) / Math.max(1, recent.length);
  const first = runs[runs.length - 1];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Pay history"
        description={`Every ${PAY_RUN.toLowerCase()} that's gone, newest first: who it paid, at what rate, and what it held back. Open a run to see its invoices.`}
      />

      {runs.length ? (
        <>
          <Reveal index={0}>
            <KpiGrid cols={4}>
              <KpiCard label="Last run" value={phpWhole(last.php)} sub={`${dayMonth(last.on)} · ${plural(last.payees, "person", "people")}`} icon={Send} />
              <KpiCard label={`Paid since ${dayMonth(first.on)}`} value={phpWhole(total)} sub={plural(runs.length, "run")} icon={Banknote} tone="charcoal" />
              <KpiCard label="Average rate" value={rateText(avgRate)} sub={`per A$1 · last ${plural(recent.length, "run")}`} icon={ArrowRightLeft} />
              <KpiCard label="Invoices paid" value={invoices} sub={`across ${plural(runs.length, "run")}`} icon={FileText} tone="ok" />
            </KpiGrid>
          </Reveal>

          <Reveal index={1}>
            <Card className="min-w-0 overflow-hidden">
              <CardHeader className="border-b border-hairline pb-3">
                <CardTitle>Pay runs</CardTitle>
                <CardMeta>{plural(runs.length, "run")}</CardMeta>
              </CardHeader>
              <Table className="min-w-[860px]">
                <TableHeader>
                  <TableRow className="hover:bg-transparent dark:hover:bg-transparent">
                    <TableHead className="pl-5">Date</TableHead>
                    <TableHead className="text-right">People</TableHead>
                    <TableHead className="text-right">Invoices</TableHead>
                    <TableHead className="text-right">Invoiced</TableHead>
                    <TableHead className="text-right">Rate</TableHead>
                    <TableHead className="text-right">Paid</TableHead>
                    <TableHead>Notes</TableHead>
                    <TableHead className="pr-5">
                      <span className="sr-only">Open</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {runs.map((r, i) => (
                    <RunRows
                      key={r.id}
                      run={r}
                      index={i}
                      cascade={cascading}
                      open={openId === r.id}
                      onToggle={() => setOpenId((cur) => (cur === r.id ? null : r.id))}
                      invoices={view.invoices.filter((inv) => r.invoiceIds.includes(inv.id))}
                      onView={setViewId}
                      reduce={reduce}
                    />
                  ))}
                </TableBody>
              </Table>
            </Card>
          </Reveal>
        </>
      ) : (
        <Card>
          <EmptyState icon={Send} title="No pay runs yet" description={`Dispatch a ${PAY_RUN.toLowerCase()} and it shows here.`} />
        </Card>
      )}

      <InvoiceDialog invoice={viewing} onClose={() => setViewId(null)} />
    </div>
  );
}

function RunRows({
  run,
  index,
  cascade,
  open,
  onToggle,
  invoices,
  onView,
  reduce,
}: {
  run: PayRun;
  index: number;
  cascade: boolean;
  open: boolean;
  onToggle: () => void;
  invoices: PayeeInvoice[];
  onView: (id: string) => void;
  reduce: boolean | null;
}) {
  const panelId = `run-${run.id}`;
  return (
    <>
      <motion.tr
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: reduce ? 0 : 0.18, ease: EASE_OUT, delay: cascade ? rowDelay(index, reduce, 0.04) : 0 }}
        onClick={onToggle}
        className={cn(
          "cursor-pointer border-b border-hairline transition-colors hover:bg-tone-soft/60 dark:hover:bg-tone-soft/40",
          open && "bg-tone-soft/40",
        )}
      >
        <TableCell className="pl-5 whitespace-nowrap">
          <span className="block font-medium">{longDate(run.on)}</span>
          <span className="block text-xs text-muted-foreground">by {run.by}</span>
        </TableCell>
        <TableCell className="text-right tabular-nums">{run.payees}</TableCell>
        <TableCell className="text-right tabular-nums">{run.invoiceIds.length}</TableCell>
        <TableCell className="text-right whitespace-nowrap tabular-nums">{money(run.aud)}</TableCell>
        <TableCell className="text-right whitespace-nowrap tabular-nums">{rateText(run.rate)}</TableCell>
        <TableCell className="text-right font-semibold whitespace-nowrap text-tone-ink tabular-nums">{php(run.php)}</TableCell>
        <TableCell>
          <span className="flex flex-wrap gap-1">
            {run.held.length ? (
              <Pill variant="caps" tone="pending">
                {run.held.length} held
              </Pill>
            ) : null}
            {run.skipped ? (
              <Pill variant="caps" tone="neutral">
                {run.skipped} skipped
              </Pill>
            ) : null}
            {!run.held.length && !run.skipped ? <span className="text-xs text-subtle-foreground">All paid</span> : null}
          </span>
        </TableCell>
        <TableCell className="pr-5 text-right">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-expanded={open}
            aria-controls={panelId}
            aria-label={`${open ? "Close" : "Open"} the ${dayMonth(run.on)} run`}
            onClick={(e) => {
              e.stopPropagation();
              onToggle();
            }}
          >
            <motion.span animate={{ rotate: open ? 180 : 0 }} transition={{ duration: reduce ? 0 : 0.2, ease: EASE_SWAP }} className="inline-flex">
              <ChevronDown />
            </motion.span>
          </Button>
        </TableCell>
      </motion.tr>
      <tr className={cn(open && "border-b border-hairline")}>
        <td colSpan={8} className="p-0" id={panelId}>
          <AnimatePresence initial={false}>
            {open ? (
              <motion.div
                key="panel"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: reduce ? 0 : DURATION.swap, ease: EASE_SWAP }}
                className="overflow-hidden"
              >
                <RunDetail run={run} invoices={invoices} onView={onView} />
              </motion.div>
            ) : null}
          </AnimatePresence>
        </td>
      </tr>
    </>
  );
}

function RunDetail({ run, invoices, onView }: { run: PayRun; invoices: PayeeInvoice[]; onView: (id: string) => void }) {
  const reduce = useReducedMotion();
  return (
    <div className="bg-canvas/60 px-5 py-3">
      <ul className="divide-y divide-hairline rounded-lg border border-hairline bg-card">
        {invoices.map((inv, i) => (
          <motion.li
            key={inv.id}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: reduce ? 0 : 0.18, ease: EASE_OUT, delay: rowDelay(i, reduce, 0.025) }}
            className="grid grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_auto_auto] items-center gap-4 px-3 py-2 text-[13px]"
          >
            <PersonCell id={inv.employeeId} you={inv.employeeId === EMPLOYEE_ID} />
            <span className="min-w-0">
              <button
                type="button"
                onClick={() => onView(inv.id)}
                className="block max-w-full truncate rounded-sm font-mono text-xs font-medium underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/45"
              >
                {inv.number}
              </button>
              <span className="block truncate text-xs text-muted-foreground">{billsFor(inv)}</span>
            </span>
            <span className="text-right tabular-nums">
              <span className="block font-semibold">{inv.paid ? php(inv.paid.php) : "—"}</span>
              <span className="block text-xs text-muted-foreground">{money(invoiceTotals(inv.lines).total)}</span>
            </span>
            <Button variant="ghost" size="icon-sm" aria-label={`View invoice ${inv.number}`} onClick={() => onView(inv.id)}>
              <Eye />
            </Button>
          </motion.li>
        ))}
      </ul>
      {run.held.length ? (
        <p className="mt-2 text-xs text-muted-foreground">
          Held:{" "}
          {run.held.map((h, i) => (
            <span key={h.employeeId}>
              {i ? "; " : ""}
              <span className="font-medium text-foreground">{personOf(h.employeeId).name}</span> ({h.reason.charAt(0).toLowerCase() + h.reason.slice(1)})
            </span>
          ))}
        </p>
      ) : null}
    </div>
  );
}
