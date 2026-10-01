"use client";

import * as React from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowLeft, ArrowRight, CircleCheck, LoaderCircle } from "lucide-react";
import { aud, cn } from "@/lib/utils";
import { DURATION, EASE_OUT } from "@/lib/motion";
import { confirm, useLaunchpad } from "@/state/launchpad-store";
import { PageContainer, PageHeader } from "@/components/ui/page";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { SmoothSelect } from "@/components/ui/select";
import { Reveal } from "@/components/ui/reveal";

/**
 * Finance — the mockup's `mm` (app.js 9955–10097): the client-facing Finance
 * health check, shown at step 2 of 5. Nectar is the Locale Financial
 * sub-brand, so the stepper carries it (via the dashboard tone).
 *
 * The mockup draws step 2 only. Here the preview works: Continue checks the
 * income, "writes" the step to Mercury and moves the bar to step 3; Back walks
 * to step 1 (already complete — 40% means step 1 is done) and back again. The
 * other steps' questions aren't in the mockup, so steps 1 and 3 show where the
 * client is rather than inventing fields.
 */
const EMPLOYMENT = ["Full time", "Part time", "Casual", "Self-employed", "Contract"] as const;
type Employment = (typeof EMPLOYMENT)[number];

const TOTAL_STEPS = 5;
type Step = 1 | 2 | 3;

export function FinanceScreen() {
  const reduce = useReducedMotion();
  const { later } = useLaunchpad();
  const [step, setStep] = React.useState<Step>(2);
  const [employment, setEmployment] = React.useState<Employment>("Full time");
  const [income, setIncome] = React.useState(""); // digits only
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  const pct = (step / TOTAL_STEPS) * 100;
  const incomeText = income ? aud(Number(income)) : "";

  const onContinue = () => {
    if (step === 1) return setStep(2);
    if (step !== 2 || saving) return;
    if (!income || Number(income) <= 0) {
      setError("Enter your annual income before tax to continue.");
      document.getElementById("fhc-income")?.focus();
      return;
    }
    setError(null);
    setSaving(true);
    later(() => {
      setSaving(false);
      setStep(3);
      confirm("Saved to Mercury", `Income and employment · ${employment} · ${aud(Number(income))} before tax`);
    }, 700);
  };

  const onBack = () => {
    if (saving) return;
    if (step === 3) setStep(2);
    else if (step === 2) setStep(1);
  };

  return (
    <PageContainer>
      <PageHeader
        title="Finance health check"
        description="Client-facing form. Replaces the WordPress form and writes straight to Mercury."
      />

      <Reveal index={0}>
        <Card>
          <CardContent className="pt-5 pb-5">
            <div className="flex items-baseline justify-between gap-3 text-xs text-muted-foreground">
              <span aria-live="polite">
                Step {step} of {TOTAL_STEPS}
                {step === 2 ? " · Income and employment" : ""}
              </span>
              <span className="font-medium text-foreground tabular-nums">{pct}%</span>
            </div>
            {/* Five segments, not one bar: the earlier step reads as done, so
                "Step 2 of 5" never looks like the form skipped its start. */}
            <ol className="mt-2 grid grid-cols-5 gap-1.5" aria-label={`Step ${step} of ${TOTAL_STEPS}, ${pct}% complete`}>
              {Array.from({ length: TOTAL_STEPS }, (_, i) => {
                const n = i + 1;
                const state = n < step ? "done" : n === step ? "current" : "todo";
                return (
                  <li
                    key={n}
                    aria-current={state === "current" ? "step" : undefined}
                    className={cn(
                      "h-1.5 rounded-full transition-colors duration-200",
                      state === "done" && "bg-tone-strong",
                      state === "current" && "bg-tone-strong/45",
                      state === "todo" && "bg-muted",
                    )}
                  >
                    <span className="sr-only">
                      Step {n}
                      {state === "done" ? ", saved" : state === "current" ? ", current" : ""}
                    </span>
                  </li>
                );
              })}
            </ol>
            <p className="mt-2 text-xs text-subtle-foreground">
              {step > 1 ? "Step 1 is already saved to Mercury. " : ""}This is the form as your client sees it.
            </p>

            <div className="mt-5">
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={step}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: reduce ? 0 : DURATION.fade, ease: EASE_OUT }}
                >
                  {step === 2 ? (
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label htmlFor="fhc-employment">Employment type</Label>
                        <SmoothSelect
                          id="fhc-employment"
                          value={employment}
                          onChange={setEmployment}
                          options={EMPLOYMENT.map((e) => ({ value: e, label: e }))}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="fhc-income">Annual income (before tax)</Label>
                        <Input
                          id="fhc-income"
                          inputMode="numeric"
                          autoComplete="off"
                          placeholder="$95,000"
                          value={incomeText}
                          aria-invalid={error ? true : undefined}
                          aria-describedby={error ? "fhc-income-error" : undefined}
                          className="tabular-nums"
                          onChange={(e) => {
                            setIncome(e.target.value.replace(/\D/g, "").replace(/^0+/, "").slice(0, 9));
                            if (error) setError(null);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") onContinue();
                          }}
                        />
                        {error ? (
                          <p id="fhc-income-error" role="alert" className="text-xs text-rose-700 dark:text-rose-300">
                            {error}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  ) : step === 1 ? (
                    <StepDone title="Step 1 complete" detail="Already saved to Mercury. Continue to income and employment." />
                  ) : (
                    <StepDone
                      title="Income and employment saved to Mercury"
                      detail={`${employment} · ${aud(Number(income))} before tax. Steps 3 to 5 continue in the client-facing form.`}
                    />
                  )}
                </motion.div>
              </AnimatePresence>
            </div>
          </CardContent>
          <CardFooter className="justify-end">
            <Button variant="outline" onClick={onBack} disabled={step === 1 || saving}>
              <ArrowLeft aria-hidden /> Back
            </Button>
            <Button onClick={onContinue} disabled={step === 3 || saving} aria-busy={saving || undefined}>
              {saving ? (
                <>
                  <LoaderCircle className="animate-spin motion-reduce:animate-none" aria-hidden /> Saving…
                </>
              ) : (
                <>
                  Continue <ArrowRight aria-hidden />
                </>
              )}
            </Button>
          </CardFooter>
        </Card>
      </Reveal>
    </PageContainer>
  );
}

function StepDone({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50/70 px-4 py-3 dark:border-emerald-500/25 dark:bg-emerald-500/10">
      <CircleCheck className="mt-0.5 size-4 shrink-0 text-emerald-700 dark:text-emerald-300" aria-hidden />
      <div className="min-w-0">
        <p className="text-[13px] font-semibold text-emerald-900 dark:text-emerald-100">{title}</p>
        <p className="mt-0.5 text-xs leading-relaxed text-emerald-800 dark:text-emerald-200/85">{detail}</p>
      </div>
    </div>
  );
}
