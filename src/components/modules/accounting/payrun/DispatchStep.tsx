"use client";

import * as React from "react";
import { motion, useReducedMotion } from "motion/react";
import { ArrowRight, Check, Landmark, Loader2, Lock, PauseCircle, Send, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";
import { EASE_OUT, rowDelay } from "@/lib/motion";
import { useLaunchpad } from "@/state/launchpad-store";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CountUp } from "@/components/ui/count-up";
import { Reveal } from "@/components/ui/reveal";
import { EmptyState } from "@/components/ui/states";
import { dayMonth, money } from "@/components/modules/employee/data";
import { php, rateText } from "../fx";
import { ACCOUNTANT, RAIL_LABEL, personOf, phpFor, railOf, type Payee, type PayRun, type RunSummary } from "../data";
import { dispatch, startNextRun, type PayRunView } from "../payrun-store";
import { MethodCell, PayoutPill, PersonCell } from "../parts";

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** How a run's money will leave: Wise, bank wire or bank transfer, with who and how much. */
function byRail(pay: Payee[], rate: number) {
  const groups = new Map<string, { label: string; icon: typeof Wallet; people: number; php: number }>();
  for (const p of pay) {
    const rail = railOf(p.method) ?? "bank";
    const g = groups.get(rail) ?? { label: RAIL_LABEL[rail], icon: rail === "wise" ? Wallet : Landmark, people: 0, php: 0 };
    g.people += 1;
    g.php += phpFor(p.invoices, rate);
    groups.set(rail, g);
  }
  return [...groups.values()];
}

/**
 * Step 4 · Dispatch: HRIS's "Lock in Values & Send to Payment Dispatch". One
 * button locks the run's values in and queues a payout for everyone
 * Validation cleared, at this run's rate. It waits out the 6s undo window
 * first (the rim's running light says it's about to go). Then the run is in
 * Pay Dispatch, where each person is paid and logged; the receipt here
 * follows them live until the next run starts.
 */
export function DispatchStep({ view, run }: { view: PayRunView; run: RunSummary }) {
  const finished = view.done ? view.runs.find((r) => r.id === view.done) : undefined;
  if (finished) return <Receipt run={finished} view={view} />;
  return <LockIn view={view} run={run} />;
}

function LockIn({ view, run }: { view: PayRunView; run: RunSummary }) {
  const reduce = useReducedMotion();
  const { notify } = useLaunchpad();
  const rate = view.rate;
  const sending = Boolean(view.dispatching);

  if (rate == null || !run.pay.length) {
    return (
      <EmptyState
        icon={Send}
        title="Nothing to send yet"
        description={rate == null ? "Set this run's rate first." : "Approve invoices, and clear at least one person in Validation."}
      />
    );
  }

  const go = () =>
    dispatch({ pay: run.pay, held: run.held, skipped: run.pending.length }, (r) =>
      notify(`Pay run locked in: ${php(r.php)} for ${plural(r.payees, "person", "people")} at ${rateText(r.rate)} per A$1 is in Pay Dispatch (Accounting)`),
    );

  return (
    <Card className={cn("overflow-hidden px-5 py-8 sm:px-8", sending && "dispatch-running")}>
      <div className="mx-auto flex max-w-xl flex-col items-center gap-5 text-center">
        <motion.span
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: reduce ? 0 : 0.4, ease: EASE_OUT }}
          className="flex size-16 items-center justify-center rounded-full bg-tone-fill text-tone-on-fill shadow-lg shadow-black/10 ring-8 ring-tone-soft"
          aria-hidden
        >
          {sending ? <Loader2 className="size-7 animate-spin motion-reduce:animate-none" /> : <Send className="size-7" />}
        </motion.span>

        <div className="space-y-1.5">
          <h3 className="font-heading text-xl font-bold tracking-tight">
            {sending ? "Sending to Pay Dispatch…" : "Lock in values and send to Pay Dispatch"}
          </h3>
          <p className="text-[13px] leading-relaxed text-pretty text-muted-foreground">
            {sending
              ? "Nothing has gone yet. Undo from the notification in the next few seconds to stop it."
              : `Freezes ${plural(run.pay.length, "person's", "people's")} pay at ${rateText(rate)} per A$1 and queues it in Pay Dispatch, where each payment is sent and logged. You get 6 seconds to undo.`}
          </p>
        </div>

        <div className="flex flex-col items-center gap-0.5">
          <span className="text-[10px] font-semibold tracking-[0.14em] text-subtle-foreground uppercase">To send</span>
          <span className="text-3xl font-bold tracking-tight text-tone-ink sm:text-4xl">
            <CountUp value={php(run.php)} />
          </span>
          <span className="text-xs text-muted-foreground tabular-nums">
            {money(run.aud)} invoiced · {plural(run.pay.reduce((n, p) => n + p.invoices.length, 0), "invoice")}
          </span>
        </div>

        <ul className="flex w-full flex-wrap justify-center gap-2">
          {byRail(run.pay, rate).map((g, i) => (
            <motion.li
              key={g.label}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: reduce ? 0 : 0.2, ease: EASE_OUT, delay: rowDelay(i, reduce, 0.05) + (reduce ? 0 : 0.15) }}
              className="flex items-center gap-2 rounded-lg border border-hairline bg-canvas/60 px-3 py-2 text-left text-xs"
            >
              <g.icon className="size-3.5 text-subtle-foreground" aria-hidden />
              <span className="font-medium">{g.label}</span>
              <span className="text-muted-foreground">{plural(g.people, "person", "people")}</span>
              <span className="font-semibold tabular-nums">{php(Math.round(g.php * 100) / 100)}</span>
            </motion.li>
          ))}
        </ul>

        {run.held.length ? (
          <div className="w-full rounded-lg border border-amber-200 bg-amber-50/70 px-4 py-3 text-left dark:border-amber-500/30 dark:bg-amber-500/10">
            <p className="flex items-center gap-1.5 text-[13px] font-semibold text-amber-800 dark:text-amber-300">
              <PauseCircle className="size-4" aria-hidden /> {plural(run.held.length, "person", "people")} held from this run
            </p>
            <ul className="mt-1 space-y-0.5 text-xs text-amber-900/80 dark:text-amber-200/80">
              {run.held.map((h) => (
                <li key={h.employeeId}>
                  <span className="font-medium">{personOf(h.employeeId).name}</span> · {h.reason}. Their invoices stay approved for the next run.
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <Button variant="brand" size="lg" className="h-11 px-8 text-[15px]" disabled={sending} onClick={go}>
          {sending ? (
            <>
              <Loader2 className="animate-spin motion-reduce:animate-none" /> Sending…
            </>
          ) : (
            <>
              <Lock /> Lock in {php(run.php)} and send
            </>
          )}
        </Button>
      </div>
    </Card>
  );
}

/** What was locked in, and each person's payment as Pay Dispatch logs it. */
function Receipt({ run, view }: { run: PayRun; view: PayRunView }) {
  const reduce = useReducedMotion();
  const payouts = view.payouts.filter((p) => p.runId === run.id);
  const sent = payouts.filter((p) => p.status === "paid").length;
  const all = sent === payouts.length;

  return (
    <div className="flex flex-col gap-4">
      <Card className="overflow-hidden px-5 py-8 sm:px-8">
        <div className="mx-auto flex max-w-xl flex-col items-center gap-4 text-center">
          <motion.span
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 320, damping: 18 }}
            className="flex size-16 items-center justify-center rounded-full bg-emerald-500 text-white shadow-lg shadow-emerald-700/20 ring-8 ring-emerald-50 dark:ring-emerald-500/15"
            aria-hidden
          >
            <Check className="size-8" strokeWidth={2.5} />
          </motion.span>
          <div className="space-y-1.5">
            <h3 className="font-heading text-xl font-bold tracking-tight">
              {all ? `${php(run.php)} sent to ${plural(run.payees, "person", "people")}` : `${php(run.php)} is in Pay Dispatch`}
            </h3>
            <p className="text-[13px] text-muted-foreground">
              Locked in {dayMonth(run.on)} at {rateText(run.rate)} per A$1 by {ACCOUNTANT} · {money(run.aud)} invoiced.{" "}
              {all ? "Every payment is logged and each invoice shows as Paid." : `${sent} of ${payouts.length} sent so far. Each invoice shows as Paid once its payment is logged.`}
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            <Button onClick={startNextRun}>
              Start next pay run <ArrowRight />
            </Button>
          </div>
        </div>
      </Card>

      <Reveal index={1}>
        <Card className="min-w-0 overflow-hidden">
          <ul className="divide-y divide-hairline">
            {payouts.map((p, i) => (
              <motion.li
                key={p.id}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: reduce ? 0 : 0.2, ease: EASE_OUT, delay: rowDelay(i, reduce, 0.04) }}
                className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 px-5 py-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,14rem)_auto_auto]"
              >
                <PersonCell id={p.employeeId} />
                <span className="hidden min-w-0 text-[13px] sm:block">
                  <MethodCell method={p.method} />
                </span>
                <span className="hidden sm:block">
                  <PayoutPill status={p.status} />
                </span>
                <span className="text-right text-[13px] tabular-nums">
                  <span className="block font-semibold">{php(p.php)}</span>
                  <span className="block text-xs text-muted-foreground">{plural(p.invoiceIds.length, "invoice")}</span>
                </span>
              </motion.li>
            ))}
          </ul>
          {run.held.length || run.skipped ? (
            <p className="border-t border-hairline bg-canvas/60 px-5 py-3 text-xs text-muted-foreground">
              {[
                run.held.length ? `Held: ${run.held.map((h) => personOf(h.employeeId).name).join(", ")}` : null,
                run.skipped ? `${plural(run.skipped, "pending invoice")} left for the next run` : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
          ) : null}
        </Card>
      </Reveal>
    </div>
  );
}
