"use client";

import * as React from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Check, Minus, Plus, Send, Target } from "lucide-react";
import { useLaunchpad, confirm } from "@/state/launchpad-store";
import { cn } from "@/lib/utils";
import { DURATION, EASE_OUT } from "@/lib/motion";
import { PageHeader } from "@/components/ui/page";
import { Card, CardContent, CardDescription, CardHeader, CardMeta, CardRow, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Pill } from "@/components/ui/pill";
import { Input } from "@/components/ui/input";
import { Reveal } from "@/components/ui/reveal";
import { CountUp } from "@/components/ui/count-up";
import { LAST_WEEK, LAST_WEEK_FORECAST, SCORECARD_BUILDERS, SIGNED_THIS_WEEK, type ScorecardBuilder } from "./data";

type Forecast = Record<ScorecardBuilder, string>;

const initialForecast = (): Forecast =>
  Object.fromEntries(SCORECARD_BUILDERS.map((b) => [b, String(LAST_WEEK_FORECAST[b])])) as Forecast;

/**
 * Sales → My week (mockup `cm`). The weekly scorecard that replaces the Monday
 * email: signed deals fill themselves in from the CRM, the rep only adjusts the
 * month's forecast per builder, and submitting rolls it up to their manager.
 */
export function MyWeek() {
  const { notify } = useLaunchpad();
  const reduce = useReducedMotion();
  const [forecast, setForecast] = React.useState<Forecast>(initialForecast);
  const [submitted, setSubmitted] = React.useState(false);

  const totalSigned = SCORECARD_BUILDERS.reduce((sum, b) => sum + SIGNED_THIS_WEEK[b], 0);
  const totalForecast = SCORECARD_BUILDERS.reduce((sum, b) => sum + (Number(forecast[b]) || 0), 0);
  const signedRows = SCORECARD_BUILDERS.filter((b) => SIGNED_THIS_WEEK[b] > 0);

  const step = (b: ScorecardBuilder, delta: 1 | -1) =>
    setForecast((f) => ({ ...f, [b]: String(Math.max(0, (Number(f[b]) || 0) + delta)) }));

  const submit = () => {
    setSubmitted(true);
    const msg = `Weekly scorecard submitted · ${totalSigned} signed, ${totalForecast} forecast`;
    notify(msg, "ok");
    confirm(msg, "Your manager sees it straight away.");
  };

  const swap = {
    initial: { opacity: 0, y: 4 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -4, transition: { duration: reduce ? 0 : 0.12 } },
    transition: { duration: reduce ? 0 : DURATION.fade, ease: EASE_OUT },
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="My week"
        description="Your signed deals are filled in automatically from the CRM. You only need to give your forecast for the month. Takes under a minute, and it replaces the Monday email."
        actions={
          <>
            <Pill tone="neutral">Week ending Sun 9 August 2026</Pill>
            <AnimatePresence mode="wait" initial={false}>
              <motion.span key={submitted ? "done" : "due"} {...swap} className="inline-flex">
                <Pill variant="caps" tone={submitted ? "ok" : "problem"} icon={submitted ? Check : undefined}>
                  {submitted ? "Submitted" : "Due today"}
                </Pill>
              </motion.span>
            </AnimatePresence>
          </>
        }
      />

      <div className="grid items-start gap-5 lg:grid-cols-2">
        {/* ── Signed this week — read from the CRM ─────────────────── */}
        <Reveal index={0} className="min-w-0">
          <Card>
            <CardHeader>
              <Check className="size-3.5 text-emerald-600 dark:text-emerald-400" aria-hidden />
              <CardTitle as="h3" className="text-sm">
                Signed this week
              </CardTitle>
              <CardMeta>From the CRM, nothing to type</CardMeta>
              <CardDescription>Deals you moved to Sale Won between Monday and Sunday.</CardDescription>
            </CardHeader>
            <CardContent>
              <div>
                {signedRows.map((b) => (
                  <CardRow key={b} className="flex items-baseline py-1.5 text-[13px]">
                    <span>{b}</span>
                    <span className="ml-auto font-semibold tabular-nums">{SIGNED_THIS_WEEK[b]}</span>
                  </CardRow>
                ))}
              </div>
              <TotalRow label="Total signed">
                <CountUp value={totalSigned} />
              </TotalRow>
              <p className="mt-3 rounded-lg border border-tone-line bg-tone-soft px-3 py-2.5 text-xs leading-relaxed">
                Last week you forecast <strong className="font-semibold tabular-nums">{LAST_WEEK.forecast}</strong> and
                signed <strong className="font-semibold tabular-nums">{LAST_WEEK.signed}</strong>. Your forecasts have
                been within one for six weeks running.
              </p>
            </CardContent>
          </Card>
        </Reveal>

        {/* ── The forecast — the one thing the rep types ────────────── */}
        <Reveal index={1} className="min-w-0">
          <Card tone="accent">
            <CardHeader>
              <Target className="size-3.5 text-tone-ink" aria-hidden />
              <CardTitle as="h3" className="text-sm">
                Your forecast for August
              </CardTitle>
              <CardDescription>
                How many you expect to sign this month, per builder. Pre-filled with last week&apos;s numbers, just
                adjust.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div>
                {SCORECARD_BUILDERS.map((b) => {
                  const n = Number(forecast[b]) || 0;
                  const inputId = `week-forecast-${b.replace(/\s+/g, "-").toLowerCase()}`;
                  return (
                    <CardRow key={b} className="flex items-center gap-2.5 py-1">
                      <label
                        htmlFor={inputId}
                        className={cn(
                          "flex-1 text-[13px] transition-colors",
                          n > 0 ? "text-foreground" : "text-muted-foreground",
                        )}
                      >
                        {b}
                      </label>
                      <Button
                        variant="outline"
                        size="icon-xs"
                        aria-label={`Decrease ${b} forecast`}
                        disabled={n === 0}
                        onClick={() => step(b, -1)}
                      >
                        <Minus />
                      </Button>
                      <Input
                        id={inputId}
                        inputMode="numeric"
                        autoComplete="off"
                        value={forecast[b]}
                        onChange={(e) => {
                          const v = e.target.value.replace(/[^0-9]/g, "");
                          setForecast((f) => ({ ...f, [b]: v }));
                        }}
                        className="h-6 w-[42px] px-0 text-center text-[13px] tabular-nums"
                      />
                      <Button
                        variant="outline"
                        size="icon-xs"
                        aria-label={`Increase ${b} forecast`}
                        onClick={() => step(b, 1)}
                      >
                        <Plus />
                      </Button>
                    </CardRow>
                  );
                })}
              </div>
              <TotalRow label="Total forecast">{totalForecast}</TotalRow>

              <div className="mt-3">
                <AnimatePresence mode="wait" initial={false}>
                  {submitted ? (
                    <motion.p
                      key="submitted"
                      {...swap}
                      role="status"
                      className="flex min-h-9 items-center justify-center gap-2 text-[13px] font-semibold text-tone-ink"
                    >
                      <Check className="size-3.5" aria-hidden /> Submitted · your manager sees it straight away
                    </motion.p>
                  ) : (
                    <motion.div key="submit" {...swap}>
                      <Button size="lg" className="w-full" onClick={submit}>
                        <Send /> Submit my week
                      </Button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              <p className="mt-2 text-center text-xs text-subtle-foreground">
                No spreadsheet, no Monday email. Managers see the whole team roll up automatically.
              </p>
            </CardContent>
          </Card>
        </Reveal>
      </div>
    </div>
  );
}

function TotalRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mt-1 flex items-baseline border-t border-border pt-2 text-[13px] font-semibold">
      <span>{label}</span>
      <span className="ml-auto text-tone-ink tabular-nums">{children}</span>
    </div>
  );
}
