"use client";

import * as React from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowLeft, Check, DollarSign, Lock, Map as MapIcon, Send, Sparkles, TriangleAlert, Users } from "lucide-react";
import type { SubmissionDoc } from "@/data/jobs";
import { useLaunchpad, confirm, type SubmissionStatus } from "@/state/launchpad-store";
import { cn } from "@/lib/utils";
import { DURATION, EASE_OUT, EASE_SWAP, PANEL_VARIANTS } from "@/lib/motion";
import { PageHeader } from "@/components/ui/page";
import { Card, CardContent, CardHeader, CardRow, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Pill } from "@/components/ui/pill";
import {
  NGUYEN_BUILDER,
  NGUYEN_CLIENT,
  STEP_FACTS,
  SUBMISSION_REP,
  SUBMISSION_STEPS,
  isApproved,
  isChangesRequested,
  isFixDoc,
  isSubmitted,
  plural,
  statusLabel,
  statusTone,
  surnameOf,
} from "./data";
import { DocumentsStep, useDocTab } from "./DocumentsStep";

const STEP_ICON = { 1: Users, 2: MapIcon, 3: DollarSign } as const;

/**
 * One deal submission, from the rep's side (mockup `rc`): a five-step form
 * where each step unlocks the next, required documents block submission until
 * uploaded, and anything Ops sends back shows up here as a red row to re-upload.
 * Documents splits into Build, Land and Finance tabs (DocumentsStep); the
 * stepper goes green as steps complete and Documents stays red while anything
 * blocks submission.
 * The Nguyen submission passes the store's docs/status, so Operations →
 * Submission review sees every upload and the "review" hand-off.
 */
export function SubmissionDetail({
  docs,
  setDocs,
  status,
  setStatus,
  onBack,
  client = NGUYEN_CLIENT,
  builder = NGUYEN_BUILDER,
}: {
  docs: SubmissionDoc[];
  setDocs: React.Dispatch<React.SetStateAction<SubmissionDoc[]>>;
  status: SubmissionStatus;
  setStatus: (status: SubmissionStatus) => void;
  onBack: () => void;
  client?: string;
  builder?: string;
}) {
  const { notify } = useLaunchpad();
  const reduce = useReducedMotion();
  const indicatorId = React.useId();
  // The mockup opens a submission on Documents: steps 1–3 come pre-filled
  // from the deal record. `furthest` is the deepest step reached — a step at
  // or before it stays open, so going back never locks a completed step.
  const [step, setStepState] = React.useState(4);
  const [furthest, setFurthest] = React.useState(4);
  const [dir, setDir] = React.useState(0);
  const docTab = useDocTab(docs);

  const surname = surnameOf(client);
  const requiredUploaded = docs.filter((d) => d.req && d.file).length;
  const requiredTotal = docs.filter((d) => d.req).length;
  const fixes = docs.filter((d) => isFixDoc(d.state));
  const ready = requiredUploaded === requiredTotal && fixes.length === 0;
  const submitted = isSubmitted(status);
  const outstanding = requiredTotal - requiredUploaded + fixes.length;

  const goTo = (n: number) => {
    if (n === step) return;
    setDir(n > step ? 1 : -1);
    setStepState(n);
    setFurthest((f) => Math.max(f, n));
  };

  const upload = (ref: string) =>
    setDocs((prev) =>
      prev.map((d) => (d.ref === ref ? { ...d, file: `${surname}_${ref}.pdf`, state: "", fixNote: "" } : d)),
    );

  const submit = () => {
    setStatus("review");
    const msg = `${surname} submission sent to Ops review`;
    notify(msg, "ok");
    confirm(msg, "Submitted · now in the Ops review queue");
  };

  const fade = {
    initial: { opacity: 0, y: 6 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -4, transition: { duration: reduce ? 0 : 0.14 } },
    transition: { duration: reduce ? 0 : DURATION.fade, ease: EASE_OUT },
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col items-start gap-2">
        <Button variant="ghost" size="sm" className="-ml-2" onClick={onBack}>
          <ArrowLeft /> My Deal Submissions
        </Button>
        <PageHeader
          className="w-full"
          title={client}
          description="Each step must be complete before the next unlocks. Green is complete; red blocks submission until it's cleared."
          actions={
            <>
              <Pill tone="neutral">{builder}</Pill>
              <Pill variant="caps" tone={statusTone(status)}>
                {statusLabel(status)}
              </Pill>
              <span className="text-xs text-subtle-foreground">Rep: {SUBMISSION_REP}</span>
            </>
          }
        />
      </div>

      <AnimatePresence initial={false}>
        {isChangesRequested(status) && fixes.length > 0 ? (
          <motion.div
            key="changes"
            {...fade}
            role="status"
            className="pulse-rose rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 dark:border-rose-500/30 dark:bg-rose-500/10"
          >
            <p className="flex items-center gap-2 text-[13px] font-semibold text-rose-700 dark:text-rose-300">
              <TriangleAlert className="size-3.5" aria-hidden /> Ops requested changes on {plural(fixes.length, "document")}
            </p>
            <ul className="mt-1">
              {fixes.map((d) => (
                <li key={d.ref} className="py-0.5 text-xs text-foreground">
                  · {d.name} — {d.fixNote}
                </li>
              ))}
            </ul>
          </motion.div>
        ) : null}
        {isApproved(status) ? (
          <motion.div
            key="approved"
            {...fade}
            role="status"
            className="flex items-center gap-2 rounded-xl border border-tone-line bg-tone-soft px-4 py-3"
          >
            <Check className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
            <span className="text-[13px]">
              Approved by Ops · {builder} pack generated and delivered. Job number follows on builder acceptance.
            </span>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {/* ── Stepper: one charcoal indicator glides to the current step;
             complete steps are green, Documents is red while anything blocks ── */}
      <nav aria-label="Submission steps">
        <ol className="flex flex-wrap gap-1.5">
          {SUBMISSION_STEPS.map((name, i) => {
            const n = i + 1;
            const current = n === step;
            // Documents only counts as complete while nothing is outstanding;
            // Review and submit opens the moment every document is in.
            const done = submitted || (n < furthest && (n !== 4 || ready));
            const blocked = !submitted && n === 4 && !ready;
            const locked = !submitted && (n === 5 ? !ready : n > furthest);
            return (
              <li key={name}>
                <button
                  type="button"
                  disabled={locked}
                  aria-current={current ? "step" : undefined}
                  onClick={() => goTo(n)}
                  className={cn(
                    "relative isolate inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs transition-colors duration-150 focus-visible:ring-3 focus-visible:ring-ring/45 focus-visible:outline-none",
                    current
                      ? "border-transparent font-semibold text-primary-foreground"
                      : done
                        ? "border-emerald-200 bg-emerald-50 text-foreground hover:bg-emerald-100/70 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:hover:bg-emerald-500/15"
                        : blocked
                          ? "border-rose-200 bg-rose-50 font-medium text-rose-700 hover:bg-rose-100/70 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300 dark:hover:bg-rose-500/15"
                          : locked
                          ? "cursor-not-allowed border-border bg-card text-subtle-foreground"
                          : "border-border bg-card text-foreground hover:border-tone-line hover:bg-tone-soft/70",
                  )}
                >
                  {current ? (
                    <motion.span
                      layoutId={`${indicatorId}-step`}
                      aria-hidden
                      className="absolute -inset-px -z-10 rounded-full bg-charcoal shadow-sm dark:bg-silver"
                      transition={{ duration: reduce ? 0 : DURATION.indicator, ease: EASE_SWAP }}
                    />
                  ) : null}
                  <span
                    className={cn(
                      "flex size-[17px] items-center justify-center rounded-full text-[10px] font-semibold tabular-nums",
                      done
                        ? "bg-emerald-600 text-white dark:bg-emerald-500"
                        : blocked
                          ? "bg-rose-600 text-white dark:bg-rose-500"
                          : current
                            ? "bg-tone-fill text-tone-on-fill"
                            : "bg-muted text-muted-foreground",
                    )}
                    aria-hidden
                  >
                    {done ? <Check className="size-2.5" strokeWidth={3} /> : locked ? <Lock className="size-2.5" /> : n}
                  </span>
                  {name}
                  {locked ? (
                    <span className="sr-only"> (locked)</span>
                  ) : done ? (
                    <span className="sr-only"> (complete)</span>
                  ) : blocked ? (
                    <span className="sr-only"> ({plural(outstanding, "item")} outstanding)</span>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ol>
      </nav>

      <div className="overflow-x-clip">
        <AnimatePresence mode="wait" initial={false} custom={dir}>
          <motion.div
            key={step}
            custom={dir}
            variants={PANEL_VARIANTS}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: reduce ? 0 : 0.22, ease: EASE_SWAP }}
          >
            {step <= 3 ? (
              <StepFacts step={step as 1 | 2 | 3} onContinue={() => goTo(step + 1)} />
            ) : step === 4 ? (
              <DocumentsStep
                docs={docs}
                tab={docTab.tab}
                dir={docTab.dir}
                onTab={docTab.setTab}
                onUpload={upload}
                onContinue={() => goTo(5)}
              />
            ) : (
              <Card className="border-tone-line">
                <CardHeader>
                  <Send className="size-4 text-tone-ink" aria-hidden />
                  <CardTitle as="h3" className="text-sm">
                    Review and submit
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {(
                    [
                      ["Deal details", "Complete"],
                      ["Land and title", "Complete · delayed title rule satisfied"],
                      ["Finance and deposit", "Complete"],
                      ["Documents", `${requiredUploaded} of ${requiredTotal} required uploaded · named to convention`],
                    ] as const
                  ).map(([label, value]) => (
                    <FactRow key={label} label={label} value={value} />
                  ))}
                  <p className="mt-2.5 rounded-lg bg-muted px-3 py-2.5 text-xs leading-relaxed text-foreground/85">
                    Submitting sends this to Ops review. Once approved, Launchpad fills {builder}&apos;s checklist from
                    this form and delivers it the way {builder} expects.
                  </p>
                  <div className="mt-3">
                    <AnimatePresence mode="wait" initial={false}>
                      {submitted ? (
                        <motion.p
                          key="sent"
                          {...fade}
                          role="status"
                          className="flex min-h-9 items-center justify-center gap-2 text-[13px] font-semibold text-tone-ink"
                        >
                          <Check className="size-3.5" aria-hidden />
                          {isApproved(status) ? "Approved by Ops" : "Submitted · now in the Ops review queue"}
                        </motion.p>
                      ) : (
                        <motion.div key="submit" {...fade}>
                          <Button size="lg" className="w-full" disabled={!ready} onClick={submit}>
                            <Send /> Submit for ops review
                          </Button>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </CardContent>
              </Card>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

/** Steps 1–3: facts captured from the deal record, each ticked. */
function StepFacts({ step, onContinue }: { step: 1 | 2 | 3; onContinue: () => void }) {
  const Icon = STEP_ICON[step];
  return (
    <Card>
      <CardHeader>
        <Icon className="size-4 text-tone-ink" aria-hidden />
        <CardTitle as="h3" className="text-sm">
          {SUBMISSION_STEPS[step - 1]} · complete
        </CardTitle>
      </CardHeader>
      <CardContent>
        {STEP_FACTS[step].map(([label, value]) => (
          <FactRow key={label} label={label} value={value} />
        ))}
        {step === 2 ? (
          <p className="mt-2.5 flex gap-2 rounded-lg border border-tone-line bg-tone-soft px-3 py-2.5 text-xs leading-relaxed">
            <Sparkles className="mt-0.5 size-3.5 shrink-0 text-tone-ink" aria-hidden />
            <span>
              Smart check: titles are more than 9 months out, so a{" "}
              <strong className="font-semibold">Delayed Title Agreement</strong> was added to required documents
              automatically.
            </span>
          </p>
        ) : null}
        <Button className="mt-3" onClick={onContinue}>
          Continue
        </Button>
      </CardContent>
    </Card>
  );
}

function FactRow({ label, value }: { label: string; value: string }) {
  return (
    <CardRow className="flex items-baseline gap-2.5 py-2">
      <Check className="size-3 shrink-0 translate-y-0.5 text-emerald-600 dark:text-emerald-400" aria-hidden />
      <div className="min-w-0">
        <p className="text-[13px] font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{value}</p>
      </div>
    </CardRow>
  );
}
