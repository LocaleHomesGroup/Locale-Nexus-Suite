"use client";

import * as React from "react";
import { motion, useReducedMotion } from "motion/react";
import { ArrowLeft, ArrowRight, ArrowRightLeft, CalendarDays, Check, FileText, Send, ShieldCheck, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { DURATION, EASE_SWAP } from "@/lib/motion";
import { PageHeader } from "@/components/ui/page";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Pill } from "@/components/ui/pill";
import { TabPanels } from "@/components/ui/sliding-tabs";
import { longDate } from "@/components/modules/employee/data";
import { php, rateText } from "../fx";
import { PAY_RUN, RUN_DATE, STEPS, type RunSummary, type StepId } from "../data";
import { goToStep, useRun, type PayRunView } from "../payrun-store";
import { RateStep } from "./RateStep";
import { InvoicesStep } from "./InvoicesStep";
import { ValidationStep } from "./ValidationStep";
import { DispatchStep } from "./DispatchStep";

const ICONS: Record<StepId, LucideIcon> = {
  rate: ArrowRightLeft,
  invoices: FileText,
  validation: ShieldCheck,
  dispatch: Send,
};

/** Each step's heading over its body: HRIS's step banner, in the page's words. */
const INTRO: Record<StepId, { title: string; body: string }> = {
  rate: {
    title: "Set this run's rate",
    body: "Invoices are in Australian dollars and the team is paid in pesos. Set today's rate once and every figure after this uses it.",
  },
  invoices: {
    title: "Approve what's being paid",
    body: "Approve or reject each invoice. Reset takes a decision back. Pending invoices wait for the next run, and rejected ones go back to the employee to correct.",
  },
  validation: {
    title: "Check everyone can be paid",
    body: "A pre-flight on the run, then a final review per person. Hold anyone you're not ready to pay. Their invoices stay approved for next time.",
  },
  dispatch: {
    title: "Lock in and send",
    body: "Dispatch pays everyone Validation cleared, at this run's rate. You get 6 seconds to undo before anything moves.",
  },
};

/** Dispatch's heading once the run has gone. */
const SENT = {
  title: "This run has gone",
  body: "Everyone below has been paid and their invoices show as Paid. Anyone held keeps their approved invoices for the next run.",
};

const CONTINUE: Partial<Record<StepId, string>> = { validation: "Go to dispatch" };

/**
 * Accounting › Pay run: HRIS's Payroll Wizard for a team paid only by
 * invoice. Four steps (Rate, Invoices, Validation, Dispatch) on HRIS's rail:
 * a step list down the side (a scroll strip on a phone), a progress bar over
 * the body, Back and Continue under it.
 *
 * Every step is open at any time, from the rail or Back and Continue (HRIS's
 * wizard lets you jump too). A step that's missing something says so in its
 * body (no rate yet, nothing approved, no one to pay) and the footer names it.
 * Once a run has gone, the rail is complete, every step reads as it was sent,
 * and Dispatch holds the receipt until the next run starts.
 */
export function PayRun() {
  const { view, run } = useRun();
  const step = view.step;
  const current = STEPS[step];

  const prev = React.useRef(step);
  const dir = React.useRef(1);
  if (prev.current !== step) {
    dir.current = step > prev.current ? 1 : -1;
    prev.current = step;
  }

  const hint = step < STEPS.length - 1 && !view.done ? run.blocked[step] : null;
  const intro = view.done && current.id === "dispatch" ? SENT : INTRO[current.id];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={PAY_RUN}
        description="Pay the offshore team's invoices. Set the AUD to PHP rate, approve the invoices, check everyone can be paid, then dispatch."
        actions={
          <>
            <Pill icon={CalendarDays}>{longDate(RUN_DATE)}</Pill>
            {view.rate != null ? <Pill tone="tone">{rateText(view.rate)} per A$1</Pill> : <Pill tone="pending">Rate not set</Pill>}
            {view.done ? (
              <Pill tone="ok" icon={Check}>
                Dispatched
              </Pill>
            ) : null}
          </>
        }
      />

      <div className="flex min-w-0 flex-col gap-4 2xl:flex-row 2xl:items-start 2xl:gap-6">
        <StepRail view={view} run={run} step={step} />

        <Card className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <Progress step={step} done={Boolean(view.done)} sending={Boolean(view.dispatching)} />

          <div className="min-w-0 px-4 py-5 sm:px-6">
            <TabPanels value={current.id} dir={dir.current} variant="slide">
              <header className="mb-5">
                <p className="text-[10px] font-semibold tracking-[0.14em] text-tone-ink uppercase">
                  Step {step + 1} · {current.label}
                </p>
                <h2 className="mt-0.5 font-heading text-lg font-bold tracking-tight">{intro.title}</h2>
                <p className="mt-1 max-w-[70ch] text-[13px] leading-relaxed text-pretty text-muted-foreground">{intro.body}</p>
              </header>
              {current.id === "rate" ? (
                <RateStep view={view} run={run} />
              ) : current.id === "invoices" ? (
                <InvoicesStep view={view} run={run} />
              ) : current.id === "validation" ? (
                <ValidationStep view={view} run={run} />
              ) : (
                <DispatchStep view={view} run={run} />
              )}
            </TabPanels>
          </div>

          <footer className="mt-auto flex items-center justify-between gap-3 border-t border-hairline bg-canvas/60 px-4 py-3 sm:px-6">
            <Button variant="ghost" disabled={step === 0} onClick={() => goToStep(step - 1)}>
              <ArrowLeft /> Back
            </Button>
            <div className="flex min-w-0 items-center gap-3">
              {hint ? <span className="hidden truncate text-xs text-subtle-foreground sm:block">{hint}</span> : null}
              <span className="shrink-0 font-mono text-xs text-subtle-foreground">
                Step {step + 1} of {STEPS.length}
              </span>
              {step < STEPS.length - 1 ? (
                <Button onClick={() => goToStep(step + 1)}>
                  {CONTINUE[current.id] ?? "Continue"} <ArrowRight />
                </Button>
              ) : null}
            </div>
          </footer>
        </Card>
      </div>
    </div>
  );
}

/** One line under each step's label: where that step stands right now. */
function stepMeta(id: StepId, view: PayRunView, run: RunSummary): string {
  if (id === "rate") return view.rate != null ? `${rateText(view.rate)} per A$1` : "Not set";
  if (id === "invoices") return run.pending.length ? `${run.pending.length} to review` : `${run.approved.length} approved`;
  if (id === "validation") {
    if (view.done) return "Cleared";
    if (!run.payees.length) return "Nothing to check";
    return run.held.length ? `${run.pay.length} paying · ${run.held.length} held` : `${run.pay.length} paying`;
  }
  if (view.done) return "Sent";
  if (view.dispatching) return "Dispatching…";
  return view.rate != null && run.pay.length ? php(run.php) : "Waiting";
}

/**
 * HRIS's step rail: a column of steps on a wide screen, a sideways strip on a
 * phone. Every step is a button. The current step's highlight glides between
 * them (one shared `layoutId`, § 11.1); finished steps turn green with a tick.
 */
function StepRail({ view, run, step }: { view: PayRunView; run: RunSummary; step: number }) {
  const reduce = useReducedMotion();
  const listRef = React.useRef<HTMLOListElement>(null);

  // Keep the current step in view on the phone strip, without moving the page.
  React.useEffect(() => {
    const list = listRef.current;
    const el = list?.querySelector<HTMLElement>("[aria-current='step']");
    if (!list || !el || list.scrollWidth <= list.clientWidth) return;
    list.scrollTo({ left: el.offsetLeft - 16, behavior: reduce ? "auto" : "smooth" });
  }, [step, reduce]);

  return (
    <nav aria-label={`${PAY_RUN} steps`} className="min-w-0 2xl:sticky 2xl:top-4 2xl:w-60 2xl:shrink-0">
      <ol
        ref={listRef}
        className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] lg:mx-0 lg:grid lg:grid-cols-4 lg:overflow-visible lg:px-0 lg:pb-0 2xl:flex 2xl:flex-col [&::-webkit-scrollbar]:hidden"
      >
        {STEPS.map((s, i) => {
          const done = Boolean(view.done) || i < step;
          const isCurrent = i === step;
          const Icon = ICONS[s.id];
          return (
            <li key={s.id} className="relative shrink-0 lg:min-w-0">
              <button
                type="button"
                aria-current={isCurrent ? "step" : undefined}
                onClick={() => goToStep(i)}
                className={cn(
                  "group/step relative flex w-full cursor-pointer items-center gap-2.5 rounded-xl border px-3 py-2 text-left outline-none lg:items-start lg:p-3",
                  "transition-[background-color,border-color,opacity] duration-200 focus-visible:ring-3 focus-visible:ring-ring/45",
                  isCurrent
                    ? "border-transparent"
                    : done
                      ? "border-emerald-200 bg-emerald-50/50 hover:bg-emerald-50 dark:border-emerald-500/25 dark:bg-emerald-500/5 dark:hover:bg-emerald-500/10"
                      : "border-border bg-card hover:border-tone-line hover:bg-tone-soft/40",
                )}
              >
                {isCurrent ? (
                  <motion.span
                    layoutId="pay-run-step"
                    aria-hidden
                    className="absolute inset-0 rounded-xl border border-tone-strong bg-tone-soft shadow-sm"
                    transition={{ duration: reduce ? 0 : DURATION.indicator, ease: EASE_SWAP }}
                  />
                ) : null}
                <span
                  className={cn(
                    "relative flex size-7 shrink-0 items-center justify-center rounded-full transition-colors duration-200",
                    isCurrent ? "bg-tone-fill text-tone-on-fill" : done ? "bg-emerald-500 text-white" : "bg-muted text-muted-foreground group-hover/step:text-foreground",
                  )}
                  aria-hidden
                >
                  {done ? <Check className="size-3.5" strokeWidth={3} /> : <Icon className="size-3.5" />}
                </span>
                <span className="relative flex min-w-0 flex-col">
                  <span className={cn("truncate text-[13px] font-semibold", isCurrent || done ? "text-foreground" : "text-muted-foreground")}>
                    <span className="sr-only">Step {i + 1}: </span>
                    {s.label}
                  </span>
                  <span className="hidden truncate text-[11px] leading-snug text-muted-foreground 2xl:block">{s.description}</span>
                  <span
                    className={cn(
                      "truncate text-[11px] font-medium tabular-nums 2xl:mt-1",
                      isCurrent ? "text-tone-ink" : done ? "text-emerald-700 dark:text-emerald-300" : "text-subtle-foreground",
                    )}
                  >
                    {stepMeta(s.id, view, run)}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/**
 * The bar over every step's body (HRIS's wizard progress): it fills as the run
 * moves on and turns green once it has gone. Transform only, so nothing
 * around it reflows.
 */
function Progress({ step, done, sending }: { step: number; done: boolean; sending: boolean }) {
  const reduce = useReducedMotion();
  const pct = done ? 100 : Math.round(((step + 0.5) / STEPS.length) * 100);
  return (
    <div className="border-b border-hairline px-4 py-3 sm:px-6">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-2">
          <span className="relative flex size-1.5 shrink-0" aria-hidden>
            {sending ? <span className="absolute inline-flex size-full animate-ping rounded-full bg-tone-strong opacity-75 motion-reduce:animate-none" /> : null}
            <span className={cn("relative inline-flex size-1.5 rounded-full", done ? "bg-emerald-500" : "bg-tone-strong")} />
          </span>
          <span className="text-[10px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
            {done ? "Dispatched" : sending ? "Dispatching" : `${PAY_RUN} progress`}
          </span>
        </span>
        <span
          className={cn(
            "rounded-md px-1.5 py-0.5 font-mono text-[11px] font-semibold tabular-nums",
            done ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300" : "bg-tone-tint text-tone-ink",
          )}
        >
          {pct}%
        </span>
      </div>
      <div
        className="h-2 overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${PAY_RUN}: step ${step + 1} of ${STEPS.length}`}
      >
        <motion.div
          className={cn("h-full w-full origin-left rounded-full", done ? "bg-emerald-500" : "bg-tone-strong")}
          initial={false}
          animate={{ scaleX: pct / 100 }}
          transition={{ duration: reduce ? 0 : 0.55, ease: EASE_SWAP }}
        />
      </div>
    </div>
  );
}
