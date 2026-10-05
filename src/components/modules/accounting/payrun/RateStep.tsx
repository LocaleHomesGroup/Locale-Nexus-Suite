"use client";

import * as React from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { AlertCircle, ArrowRight, Lock, Pencil, RotateCcw, TrendingDown, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { EASE_OUT } from "@/lib/motion";
import { confirm } from "@/state/launchpad-store";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardMeta, CardTitle } from "@/components/ui/card";
import { CountUp } from "@/components/ui/count-up";
import { Reveal } from "@/components/ui/reveal";
import { dayMonth, invoiceTotals, money } from "@/components/modules/employee/data";
import { RATE_BOUNDS, php, rateText, toPhp } from "../fx";
import type { RunSummary } from "../data";
import { setRate, type PayRunView } from "../payrun-store";

const round4 = (n: number) => Math.round(n * 10000) / 10000;

/** Why a typed rate can't be used, or null. */
function rateProblem(raw: string): string | null {
  const n = Number(raw);
  if (!raw.trim() || !Number.isFinite(n) || n <= 0) return "Enter the rate as pesos per A$1, like 38.20.";
  if (n < RATE_BOUNDS.min || n > RATE_BOUNDS.max) return `That's outside ₱${RATE_BOUNDS.min}–₱${RATE_BOUNDS.max} per A$1. Check for a typo.`;
  return null;
}

/**
 * Step 1 · Rate: HRIS's per-cycle FX card (Initial Calculation's USD → PHP),
 * anchored on the Australian dollar. Invoices are in AUD and the team is paid
 * in pesos, so the run needs today's rate before anything is converted.
 * Every run starts without one; last run's is a click away.
 */
export function RateStep({ view, run }: { view: PayRunView; run: RunSummary }) {
  const reduce = useReducedMotion();
  const rate = view.rate;
  const last = view.runs[0];
  const locked = Boolean(view.dispatching || view.done);
  const [editing, setEditing] = React.useState(rate == null);
  const [input, setInput] = React.useState(rate != null ? String(rate) : "");
  const [error, setError] = React.useState<string | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const errorId = React.useId();

  const apply = (raw: string) => {
    const problem = rateProblem(raw);
    if (problem) {
      setError(problem);
      inputRef.current?.focus();
      return;
    }
    const next = round4(Number(raw));
    setRate(next);
    setInput(String(next));
    setEditing(false);
    setError(null);
    confirm(`Rate set: ${rateText(next)} per A$1`, "For this run only · it's locked in at Dispatch");
  };

  const startEditing = () => {
    setEditing(true);
    requestAnimationFrame(() => inputRef.current?.select());
  };

  const cancel = () => {
    setInput(rate != null ? String(rate) : "");
    setError(null);
    setEditing(false);
  };

  const change = rate != null && last ? ((rate - last.rate) / last.rate) * 100 : null;
  const inRun = run.queue.filter((i) => i.status !== "rejected");
  const runAud = inRun.reduce((n, i) => n + invoiceTotals(i.lines).total, 0);
  const preview = rate ?? (rateProblem(input) ? null : Number(input));

  return (
    <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
      <Reveal index={0}>
        <section
          aria-labelledby="fx-title"
          className="flex flex-col gap-4 rounded-xl border border-tone-line bg-tone-soft/50 p-5 dark:bg-tone-soft/40"
        >
          <div className="flex items-start gap-3">
            <span className="flex h-10 shrink-0 items-center gap-1.5 rounded-lg border border-tone-line bg-card px-2.5 font-mono text-[11px] font-semibold tracking-wide">
              AUD
              <ArrowRight className="size-3 text-tone-ink" aria-hidden />
              PHP
            </span>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold tracking-[0.14em] text-tone-ink uppercase">Philippine peso</p>
              <h3 id="fx-title" className="font-heading text-base leading-tight font-bold">
                AUD → PHP
              </h3>
            </div>
            {locked ? (
              <span className="ml-auto inline-flex items-center gap-1 text-xs text-muted-foreground">
                <Lock className="size-3" aria-hidden /> Locked in
              </span>
            ) : null}
          </div>

          <p className="max-w-[60ch] text-[13px] leading-relaxed text-muted-foreground">
            Each approved invoice&apos;s AUD total is multiplied by this rate to give what the person is paid. It&apos;s set
            for this run only, so every run starts without one.
          </p>

          <AnimatePresence mode="wait" initial={false}>
            {rate == null ? (
              <motion.p
                key="unset"
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: reduce ? 0 : 0.18, ease: EASE_OUT }}
                className="flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300"
              >
                <AlertCircle className="size-3.5 shrink-0" aria-hidden />
                Not set for this run. Enter today&apos;s rate.
              </motion.p>
            ) : (
              <motion.p
                key="set"
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: reduce ? 0 : 0.18, ease: EASE_OUT }}
                className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground"
              >
                <span className="font-mono font-semibold text-foreground">₱{rate.toFixed(4)}</span>
                <span>= A$1 this run</span>
                {last ? (
                  <>
                    <span aria-hidden>·</span>
                    <span>
                      last run {rateText(last.rate)} on {dayMonth(last.on)}
                    </span>
                    {change != null && Math.abs(change) >= 0.005 ? (
                      <span
                        className={cn(
                          "inline-flex items-center gap-0.5 rounded-full px-1.5 py-px font-medium tabular-nums",
                          change > 0
                            ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
                            : "bg-muted text-muted-foreground",
                        )}
                      >
                        {change > 0 ? <TrendingUp className="size-3" aria-hidden /> : <TrendingDown className="size-3" aria-hidden />}
                        {change > 0 ? "+" : ""}
                        {change.toFixed(2)}%
                      </span>
                    ) : null}
                  </>
                ) : null}
              </motion.p>
            )}
          </AnimatePresence>

          <form
            className="flex flex-col gap-2 border-t border-tone-line/60 pt-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (editing) apply(input);
            }}
          >
            <label htmlFor="fx-rate" className="text-xs font-medium text-muted-foreground">
              Pesos per A$1
            </label>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative min-w-40 flex-1">
                <span className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-sm font-semibold text-tone-ink" aria-hidden>
                  ₱
                </span>
                <input
                  ref={inputRef}
                  id="fx-rate"
                  inputMode="decimal"
                  autoComplete="off"
                  value={input}
                  readOnly={!editing || locked}
                  placeholder={last ? last.rate.toFixed(2) : "38.00"}
                  onChange={(e) => {
                    setInput(e.target.value.replace(/[^0-9.]/g, ""));
                    setError(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Escape" && rate != null) {
                      e.preventDefault();
                      cancel();
                    }
                  }}
                  aria-invalid={error ? true : undefined}
                  aria-describedby={error ? errorId : undefined}
                  className={cn(
                    "h-10 w-full rounded-lg border pr-16 pl-7 font-mono text-base tabular-nums shadow-xs outline-none",
                    "focus-visible:border-tone-strong focus-visible:ring-3 focus-visible:ring-tone-line/45",
                    "aria-invalid:border-rose-400 aria-invalid:ring-rose-200/50",
                    editing && !locked ? "border-input bg-card dark:bg-white/[0.03]" : "cursor-default border-tone-line bg-tone-soft/60",
                  )}
                />
                <span className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-xs text-subtle-foreground">
                  per A$1
                </span>
              </div>
              {locked ? null : editing ? (
                <>
                  <Button type="submit" variant="brand" size="lg">
                    Apply rate
                  </Button>
                  {rate != null ? (
                    <Button type="button" variant="ghost" size="lg" onClick={cancel}>
                      Cancel
                    </Button>
                  ) : null}
                </>
              ) : (
                <Button type="button" variant="outline" size="lg" onClick={startEditing}>
                  <Pencil /> Edit rate
                </Button>
              )}
            </div>
            <AnimatePresence initial={false}>
              {error ? (
                <motion.p
                  key="error"
                  id={errorId}
                  role="alert"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: reduce ? 0 : 0.18, ease: EASE_OUT }}
                  className="text-xs font-medium text-rose-700 dark:text-rose-300"
                >
                  {error}
                </motion.p>
              ) : null}
            </AnimatePresence>
            {editing && !locked ? (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-subtle-foreground">
                <span>
                  Press <kbd className="rounded border border-border bg-muted px-1 font-mono text-[10px]">Enter</kbd> or Apply rate to confirm.
                </span>
                {last && last.rate !== rate ? (
                  <button
                    type="button"
                    onClick={() => apply(String(last.rate))}
                    className="inline-flex items-center gap-1 rounded-md font-medium text-tone-ink underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/45"
                  >
                    <RotateCcw className="size-3" aria-hidden />
                    Use last run&apos;s {rateText(last.rate)}
                  </button>
                ) : null}
              </div>
            ) : null}
          </form>
        </section>
      </Reveal>

      <div className="flex min-w-0 flex-col gap-4">
        <Reveal index={1}>
          <Card>
            <CardHeader>
              <CardTitle as="h3">What this run pays</CardTitle>
              <CardMeta>{inRun.length} invoices</CardMeta>
              <CardDescription>Approved and pending invoices, at {preview ? `${rateText(preview)}` : "the rate you set"}.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <div className="flex items-end justify-between gap-3 rounded-lg border border-hairline bg-canvas/60 px-3 py-2.5">
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold tracking-[0.12em] text-subtle-foreground uppercase">Invoiced</p>
                  <p className="text-lg font-bold tabular-nums">{money(runAud)}</p>
                </div>
                <ArrowRight className="mb-2 size-4 shrink-0 text-subtle-foreground" aria-hidden />
                <div className="min-w-0 text-right">
                  <p className="text-[10px] font-semibold tracking-[0.12em] text-subtle-foreground uppercase">Paid out</p>
                  <p className="text-lg font-bold text-tone-ink tabular-nums">
                    {preview ? <CountUp value={php(toPhp(runAud, preview))} duration={500} /> : <span className="text-subtle-foreground">₱ —</span>}
                  </p>
                </div>
              </div>
              <dl className="grid grid-cols-3 gap-2 text-center">
                {[100, 1000, 2000].map((a) => (
                  <div key={a} className="rounded-lg border border-hairline px-2 py-2">
                    <dt className="text-xs text-muted-foreground tabular-nums">{money(a).replace(".00", "")}</dt>
                    <dd className="text-[13px] font-semibold tabular-nums">{preview ? php(toPhp(a, preview)).replace(/\.00$/, "") : "—"}</dd>
                  </div>
                ))}
              </dl>
            </CardContent>
          </Card>
        </Reveal>

        <Reveal index={2}>
          <Card>
            <CardHeader>
              <CardTitle as="h3">Recent rates</CardTitle>
              <CardMeta>last {view.runs.slice(0, 5).length} runs</CardMeta>
            </CardHeader>
            <CardContent>
              <RecentRates runs={view.runs.slice(0, 5)} />
            </CardContent>
          </Card>
        </Reveal>
      </div>
    </div>
  );
}

/** Each recent run's rate as a bar on a shared scale, with its move from the run before. */
function RecentRates({ runs }: { runs: PayRunView["runs"] }) {
  const reduce = useReducedMotion();
  if (!runs.length) return <p className="text-xs text-muted-foreground">No runs yet.</p>;
  const rates = runs.map((r) => r.rate);
  const lo = Math.min(...rates) - 0.25;
  const hi = Math.max(...rates) + 0.05;
  return (
    <ul className="flex flex-col gap-2">
      {runs.map((r, i) => {
        const prev = runs[i + 1];
        const delta = prev ? r.rate - prev.rate : null;
        return (
          <li key={r.id} className="grid grid-cols-[52px_minmax(0,1fr)_88px] items-center gap-3 text-[13px]">
            <span className="text-muted-foreground tabular-nums">{dayMonth(r.on)}</span>
            <span className="relative h-2 overflow-hidden rounded-full bg-muted">
              <motion.span
                className="absolute inset-y-0 left-0 w-full origin-left rounded-full bg-tone-strong"
                initial={{ scaleX: 0 }}
                animate={{ scaleX: (r.rate - lo) / (hi - lo) }}
                transition={{ duration: reduce ? 0 : 0.6, ease: EASE_OUT, delay: reduce ? 0 : 0.1 + i * 0.05 }}
              />
            </span>
            <span className="text-right tabular-nums">
              <span className="font-semibold">{rateText(r.rate)}</span>
              {delta != null ? (
                <span className={cn("ml-1 text-xs", delta >= 0 ? "text-emerald-700 dark:text-emerald-300" : "text-muted-foreground")}>
                  {delta >= 0 ? "+" : "−"}
                  {Math.abs(delta).toFixed(2)}
                </span>
              ) : null}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
