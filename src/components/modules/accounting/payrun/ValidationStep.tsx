"use client";

import * as React from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { AlertTriangle, CircleCheck, CircleX, ShieldCheck, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { EASE_OUT, EASE_SWAP, rowDelay } from "@/lib/motion";
import { hrefForKey } from "@/components/shell/dashboards";
import { Card, CardContent, CardHeader, CardMeta, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/input";
import { Pill } from "@/components/ui/pill";
import { Reveal } from "@/components/ui/reveal";
import { EmptyState } from "@/components/ui/states";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useCascading } from "@/components/ui/list-motion";
import { EMPLOYEE_ID, money } from "@/components/modules/employee/data";
import { php, rateText } from "../fx";
import { phpFor, type Payee, type RunSummary } from "../data";
import { toggleHold, type PayRunView } from "../payrun-store";
import { MethodCell, PersonCell } from "../parts";

type CheckTone = "ok" | "warn" | "fail";

interface Check {
  label: string;
  detail: string;
  tone: CheckTone;
}

const CHECK_ICON: Record<CheckTone, { icon: LucideIcon; className: string }> = {
  ok: { icon: CircleCheck, className: "text-emerald-600 dark:text-emerald-400" },
  warn: { icon: AlertTriangle, className: "text-amber-600 dark:text-amber-400" },
  fail: { icon: CircleX, className: "text-rose-600 dark:text-rose-400" },
};

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/**
 * Step 3 · Validation: HRIS's pre-flight and final review. The checklist says
 * what the run will and won't do; the table is everyone with approved
 * invoices, what they're owed in both currencies and where it's going. No
 * payment method holds a person automatically. Anyone else can be held with
 * the switch (HRIS's "do not pay"); their invoices stay approved for the next run.
 */
export function ValidationStep({ view, run }: { view: PayRunView; run: RunSummary }) {
  const rate = view.rate;
  const locked = Boolean(view.dispatching || view.done);
  const missing = run.payees.filter((p) => p.blocker);
  const mismatched = run.payees.filter((p) => p.warnings.length);
  const manual = run.payees.filter((p) => !p.blocker && view.holds[p.id]);

  const checks: Check[] = [
    rate != null
      ? { label: "Rate set", detail: `${rateText(rate)} per A$1 for this run`, tone: "ok" }
      : { label: "Rate set", detail: "No rate yet. Go back to Rate.", tone: "fail" },
    run.pending.length
      ? {
          label: "Invoices decided",
          detail: `${plural(run.pending.length, "invoice")} still pending. ${run.pending.length === 1 ? "It waits" : "They wait"} for the next run.`,
          tone: "warn",
        }
      : { label: "Invoices decided", detail: "Every invoice in the run is approved or rejected", tone: "ok" },
    missing.length
      ? {
          label: "Payment details",
          detail: `${plural(missing.length, "person", "people")} can't be paid: ${missing.map((p) => p.name).join(", ")}. Held from this run.`,
          tone: "fail",
        }
      : { label: "Payment details", detail: "Everyone has a payment method on file", tone: "ok" },
    mismatched.length
      ? {
          label: "Rates match HR",
          detail: `${plural(mismatched.length, "person", "people")} billed a rate HR doesn't have on file. Worth a look; it won't stop the run.`,
          tone: "warn",
        }
      : { label: "Rates match HR", detail: "Every hourly line matches the Global Master List", tone: "ok" },
  ];

  return (
    <div className="flex flex-col gap-4">
      <Reveal index={0}>
        <Card>
          <CardHeader>
            <CardTitle as="h3" className="flex items-center gap-2">
              <ShieldCheck className="size-4 text-tone-ink" aria-hidden /> Pre-flight
            </CardTitle>
            <CardMeta>
              {checks.filter((c) => c.tone === "ok").length} of {checks.length} clear
            </CardMeta>
          </CardHeader>
          <CardContent>
            <ul className="grid gap-2 sm:grid-cols-2">
              {checks.map((c, i) => (
                <CheckRow key={c.label} check={c} index={i} />
              ))}
            </ul>
          </CardContent>
        </Card>
      </Reveal>

      <Reveal index={1}>
        <Card className="min-w-0 overflow-hidden">
          <CardHeader className="border-b border-hairline pb-3">
            <CardTitle as="h3">Final review</CardTitle>
            <CardMeta>
              Paying {plural(run.pay.length, "person", "people")}
              {run.held.length ? ` · ${run.held.length} held` : ""}
            </CardMeta>
          </CardHeader>
          {run.payees.length ? (
            <PayeeTable payees={run.payees} rate={rate} holds={view.holds} locked={locked} />
          ) : (
            <EmptyState icon={ShieldCheck} title="Nothing to check" description="Approve invoices in the Invoices step and the people they pay show here." />
          )}
          <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-1 border-t border-hairline bg-canvas/60 px-5 py-3 text-[13px]">
            <span className="text-[10px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
              To dispatch{manual.length ? ` · ${manual.length} held by you` : ""}
            </span>
            <span className="flex items-baseline gap-3 tabular-nums">
              <span className="font-semibold">{money(run.aud)}</span>
              <span className="font-semibold text-tone-ink">{rate != null ? php(run.php) : "₱ not set"}</span>
            </span>
          </div>
        </Card>
      </Reveal>
    </div>
  );
}

function CheckRow({ check, index }: { check: Check; index: number }) {
  const reduce = useReducedMotion();
  const { icon: Icon, className } = CHECK_ICON[check.tone];
  return (
    <motion.li
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduce ? 0 : 0.24, ease: EASE_OUT, delay: reduce ? 0 : 0.08 + index * 0.05 }}
      className={cn(
        "flex items-start gap-2.5 rounded-lg border px-3 py-2.5",
        check.tone === "ok" && "border-hairline bg-canvas/60",
        check.tone === "warn" && "border-amber-200 bg-amber-50/60 dark:border-amber-500/30 dark:bg-amber-500/10",
        check.tone === "fail" && "border-rose-200 bg-rose-50/60 dark:border-rose-500/30 dark:bg-rose-500/10",
      )}
    >
      <motion.span
        key={check.tone}
        initial={{ scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: reduce ? 0 : 0.3, ease: EASE_OUT, delay: reduce ? 0 : 0.12 + index * 0.05 }}
        className="mt-px"
      >
        <Icon className={cn("size-4", className)} aria-hidden />
      </motion.span>
      <span className="min-w-0">
        <span className="block text-[13px] font-semibold">
          {check.label}
          <span className="sr-only">: {check.tone === "ok" ? "clear" : check.tone === "warn" ? "warning" : "problem"}</span>
        </span>
        <span className="block text-xs leading-relaxed text-muted-foreground">{check.detail}</span>
      </span>
    </motion.li>
  );
}

function PayeeTable({
  payees,
  rate,
  holds,
  locked,
}: {
  payees: Payee[];
  rate: number | null;
  holds: Record<string, true>;
  locked: boolean;
}) {
  const reduce = useReducedMotion();
  const cascading = useCascading();
  return (
    <Table className="min-w-[760px]">
      <TableHeader>
        <TableRow className="hover:bg-transparent dark:hover:bg-transparent">
          <TableHead className="pl-5">Employee</TableHead>
          <TableHead className="text-right">Owed</TableHead>
          <TableHead>Pay to</TableHead>
          <TableHead className="w-[30%]">Checks</TableHead>
          <TableHead className="pr-5 text-right">Pay</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {payees.map((p, i) => {
          const held = Boolean(p.blocker || holds[p.id]);
          return (
            <motion.tr
              key={p.id}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: reduce ? 0 : 0.18, ease: EASE_OUT, delay: cascading ? rowDelay(i, reduce, 0.03) : 0 }}
              className={cn(
                "border-b border-hairline align-top transition-colors",
                held ? "bg-muted/40" : "hover:bg-tone-soft/60 dark:hover:bg-tone-soft/40",
              )}
            >
              <TableCell className={cn("pl-5 transition-opacity duration-200", held && "opacity-60")}>
                <PersonCell id={p.id} you={p.id === EMPLOYEE_ID} />
              </TableCell>
              <TableCell className="text-right whitespace-nowrap tabular-nums">
                <motion.span
                  key={held ? "held" : "pay"}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: reduce ? 0 : 0.18 }}
                  className={cn("block font-semibold", held ? "text-subtle-foreground line-through decoration-1" : "text-tone-ink")}
                >
                  {rate != null ? php(phpFor(p.invoices, rate)) : "—"}
                </motion.span>
                <span className={cn("block text-xs text-muted-foreground transition-opacity duration-200", held && "opacity-60")}>
                  {money(p.aud)} · {p.invoices.length === 1 ? "1 invoice" : `${p.invoices.length} invoices`}
                </span>
              </TableCell>
              <TableCell className="max-w-52">
                <MethodCell method={p.method} />
              </TableCell>
              <TableCell>
                <div className="flex flex-col items-start gap-1">
                  {p.blocker ? (
                    <>
                      <Pill variant="caps" tone="problem">
                        Can&apos;t pay
                      </Pill>
                      <span className="text-xs text-rose-700 dark:text-rose-300">{p.blocker}.</span>
                      {p.id === EMPLOYEE_ID ? (
                        <Link
                          href={hrefForKey("employee:profile")}
                          className="text-xs font-medium text-tone-ink underline-offset-4 hover:underline"
                        >
                          Add it in Employee › Profile
                        </Link>
                      ) : (
                        <span className="text-xs text-muted-foreground">Ask them to add one in their Profile.</span>
                      )}
                      {p.warnings.map((w) => (
                        <span key={w} className="text-xs text-amber-800 dark:text-amber-300">
                          {w}
                        </span>
                      ))}
                    </>
                  ) : p.warnings.length ? (
                    <>
                      <Pill variant="caps" tone="pending">
                        Check
                      </Pill>
                      {p.warnings.map((w) => (
                        <span key={w} className="text-xs text-amber-800 dark:text-amber-300">
                          {w}
                        </span>
                      ))}
                    </>
                  ) : (
                    <Pill variant="caps" tone="ok">
                      Ready
                    </Pill>
                  )}
                </div>
              </TableCell>
              <TableCell className="pr-5">
                <div className="flex flex-col items-end gap-1">
                  <Switch
                    checked={!held}
                    disabled={locked || Boolean(p.blocker)}
                    onCheckedChange={() => toggleHold(p.id)}
                    label={held ? `Pay ${p.name} in this run` : `Hold ${p.name} from this run`}
                  />
                  <AnimatePresence mode="wait" initial={false}>
                    <motion.span
                      key={held ? "held" : "pay"}
                      initial={{ opacity: 0, y: 3 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -3 }}
                      transition={{ duration: reduce ? 0 : 0.14, ease: EASE_SWAP }}
                      className={cn("text-[11px] font-medium", held ? "text-amber-700 dark:text-amber-300" : "text-muted-foreground")}
                    >
                      {held ? "Held" : "Paying"}
                    </motion.span>
                  </AnimatePresence>
                </div>
              </TableCell>
            </motion.tr>
          );
        })}
      </TableBody>
    </Table>
  );
}
