"use client";

import * as React from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  ArrowLeft,
  Check,
  Circle,
  DollarSign,
  Folder,
  House,
  Lock,
  Map as MapIcon,
  Send,
  Sparkles,
  TriangleAlert,
  Upload,
  Users,
} from "lucide-react";
import type { SubmissionDoc } from "@/data/jobs";
import { useLaunchpad, confirm, type SubmissionStatus } from "@/state/launchpad-store";
import { cn } from "@/lib/utils";
import { DURATION, EASE_OUT, EASE_SWAP, PANEL_VARIANTS } from "@/lib/motion";
import { PageHeader } from "@/components/ui/page";
import { Card, CardContent, CardDescription, CardHeader, CardMeta, CardRow, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Pill } from "@/components/ui/pill";
import {
  DOC_CATEGORIES,
  NGUYEN_BUILDER,
  NGUYEN_CLIENT,
  STEP_FACTS,
  SUBMISSION_REP,
  SUBMISSION_STEPS,
  isApproved,
  isChangesRequested,
  isFixDoc,
  isSubmitted,
  isVerifiedDoc,
  plural,
  statusLabel,
  statusTone,
  surnameOf,
} from "./data";

const STEP_ICON = { 1: Users, 2: MapIcon, 3: DollarSign } as const;
const CATEGORY_ICON = { Build: House, Land: MapIcon, Finance: DollarSign } as const;

/**
 * One deal submission, from the rep's side (mockup `rc`): a five-step form
 * where each step unlocks the next, required documents block submission until
 * uploaded, and anything Ops sends back shows up here as a red row to re-upload.
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
          eyebrow="Sales"
          title={client}
          description="Each step must be complete before the next unlocks. Required documents block submission until uploaded."
          actions={
            <>
              <Pill tone="skyblue">{builder}</Pill>
              <Pill variant="caps" tone={statusTone(status)}>
                {statusLabel(status)}
              </Pill>
              <span className="text-[11.5px] text-subtle-foreground">Rep: {SUBMISSION_REP}</span>
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
            <p className="flex items-center gap-2 text-[12.5px] font-semibold text-rose-700 dark:text-rose-300">
              <TriangleAlert className="size-3.5" aria-hidden /> Ops requested changes on {plural(fixes.length, "document")}
            </p>
            <ul className="mt-1">
              {fixes.map((d) => (
                <li key={d.ref} className="py-0.5 text-[11.5px] text-foreground">
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
            className="flex items-center gap-2 rounded-xl border border-haven-300 bg-haven-50 px-4 py-3 dark:border-haven-800 dark:bg-haven-950/40"
          >
            <Check className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
            <span className="text-[12.5px]">
              Approved by Ops · {builder} pack generated and delivered. Job number follows on builder acceptance.
            </span>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {/* ── Stepper: one charcoal indicator glides to the current step ── */}
      <nav aria-label="Submission steps">
        <ol className="flex flex-wrap gap-1.5">
          {SUBMISSION_STEPS.map((name, i) => {
            const n = i + 1;
            const current = n === step;
            // Documents only counts as complete while nothing is outstanding;
            // Review and submit opens the moment every document is in.
            const done = submitted || (n < furthest && (n !== 4 || ready));
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
                      ? "border-transparent font-semibold text-haven-300 dark:text-charcoal"
                      : done
                        ? "border-haven-300 bg-haven-50 text-foreground hover:bg-haven-100 dark:border-haven-800 dark:bg-haven-950/40 dark:hover:bg-haven-950/70"
                        : locked
                          ? "cursor-not-allowed border-border bg-card text-subtle-foreground"
                          : "border-border bg-card text-foreground hover:border-haven-300 hover:bg-haven-50/70 dark:hover:border-haven-800 dark:hover:bg-haven-950/40",
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
                      done || current ? "bg-haven-300 text-haven-950" : "bg-muted text-muted-foreground",
                    )}
                    aria-hidden
                  >
                    {done ? <Check className="size-2.5" /> : locked ? <Lock className="size-2.5" /> : n}
                  </span>
                  {name}
                  {locked ? <span className="sr-only"> (locked)</span> : done ? <span className="sr-only"> (complete)</span> : null}
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
              <Card className="border-haven-300 dark:border-haven-800">
                <CardHeader>
                  <Folder className="size-4 text-haven-700 dark:text-haven-300" aria-hidden />
                  <CardTitle as="h3" className="text-sm">
                    Documents
                  </CardTitle>
                  <CardMeta
                    className={cn(
                      "text-[11.5px] font-semibold",
                      ready ? "text-emerald-700 dark:text-emerald-300" : "text-amber-700 dark:text-amber-300",
                    )}
                  >
                    Required: {requiredUploaded} of {requiredTotal} uploaded
                  </CardMeta>
                  <CardDescription className="text-[11px] text-subtle-foreground">
                    Red rows are non-negotiable and block submission. Files are renamed on upload:{" "}
                    <span className="font-mono text-[11px]">Surname_Ref.pdf</span>
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                  {DOC_CATEGORIES.map((cat) => {
                    const Icon = CATEGORY_ICON[cat];
                    const rows = docs.filter((d) => d.cat === cat);
                    if (rows.length === 0) return null;
                    return (
                      <section key={cat} aria-label={`${cat} documents`}>
                        <p className="flex items-center gap-1.5 py-1 text-[10px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
                          <Icon className="size-3" aria-hidden /> {cat}
                        </p>
                        <ul className="flex flex-col gap-1">
                          {rows.map((d) => (
                            <DocRow key={d.ref} doc={d} onUpload={() => upload(d.ref)} />
                          ))}
                        </ul>
                      </section>
                    );
                  })}
                  <Button
                    size="lg"
                    className="mt-1 w-full"
                    disabled={!ready}
                    onClick={() => ready && goTo(5)}
                  >
                    {ready ? (
                      "Continue to review and submit"
                    ) : (
                      <>
                        <Lock /> Continue locked · {plural(outstanding, "item")} outstanding
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <Card className="border-haven-300 dark:border-haven-800">
                <CardHeader>
                  <Send className="size-4 text-haven-700 dark:text-haven-300" aria-hidden />
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
                  <p className="mt-2.5 rounded-lg bg-skyblue-100 px-3 py-2.5 text-[11.5px] leading-relaxed text-skyblue-950 dark:bg-skyblue-950/50 dark:text-skyblue-100">
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
                          className="flex min-h-9 items-center justify-center gap-2 text-[12.5px] font-semibold text-haven-700 dark:text-haven-300"
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
        <Icon className="size-4 text-haven-700 dark:text-haven-300" aria-hidden />
        <CardTitle as="h3" className="text-sm">
          {SUBMISSION_STEPS[step - 1]} · complete
        </CardTitle>
      </CardHeader>
      <CardContent>
        {STEP_FACTS[step].map(([label, value]) => (
          <FactRow key={label} label={label} value={value} />
        ))}
        {step === 2 ? (
          <p className="mt-2.5 flex gap-2 rounded-lg border border-haven-300 bg-haven-50 px-3 py-2.5 text-[11.5px] leading-relaxed dark:border-haven-800 dark:bg-haven-950/40">
            <Sparkles className="mt-0.5 size-3.5 shrink-0 text-haven-700 dark:text-haven-300" aria-hidden />
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
        <p className="text-[12.5px] font-medium">{label}</p>
        <p className="text-[11.5px] text-muted-foreground">{value}</p>
      </div>
    </CardRow>
  );
}

/**
 * A checklist row. Red = blocking (a required doc with no file, or one Ops sent
 * back); Haven = verified by Ops; white = uploaded, not yet reviewed; muted =
 * optional and empty.
 */
function DocRow({ doc, onUpload }: { doc: SubmissionDoc; onUpload: () => void }) {
  const fix = isFixDoc(doc.state);
  const verified = isVerifiedDoc(doc.state);
  const blocking = (doc.req && !doc.file) || fix;
  const canUpload = !doc.file || fix;
  return (
    <li
      className={cn(
        "flex items-center gap-2.5 rounded-lg border px-2.5 py-1.5 transition-colors duration-200",
        blocking
          ? "border-rose-200 bg-rose-50 dark:border-rose-500/30 dark:bg-rose-500/10"
          : verified
            ? "border-haven-200 bg-haven-50 dark:border-haven-800/60 dark:bg-haven-950/40"
            : doc.file
              ? "border-hairline bg-card"
              : "border-hairline bg-muted/60 dark:bg-white/[0.03]",
      )}
    >
      {fix ? (
        <TriangleAlert className="size-3.5 shrink-0 text-rose-600 dark:text-rose-400" aria-label="Sent back by Ops" />
      ) : doc.file ? (
        <Check className="size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" aria-label="Uploaded" />
      ) : (
        <Circle className="size-3.5 shrink-0 text-subtle-foreground" aria-label="Not uploaded" />
      )}
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "text-xs",
            blocking ? "font-medium text-rose-700 dark:text-rose-300" : "text-foreground",
          )}
        >
          {doc.name}{" "}
          {!doc.req ? <span className="text-[10.5px] font-normal text-subtle-foreground">· if applicable</span> : null}
        </p>
        <p className="truncate text-[11px] text-muted-foreground">
          {fix ? (
            <span className="text-rose-700 dark:text-rose-300">Ops: {doc.fixNote}</span>
          ) : verified ? (
            <>
              <span className="font-mono">{doc.file}</span> · verified by Ops
            </>
          ) : (
            <span className="font-mono">{doc.file || doc.ref}</span>
          )}
        </p>
      </div>
      {canUpload ? (
        <Button
          size="xs"
          variant={blocking ? "default" : "outline"}
          className={cn(!blocking && "text-haven-700 dark:text-haven-300")}
          aria-label={`${fix ? "Re-upload" : "Upload"} ${doc.name}`}
          onClick={onUpload}
        >
          <Upload /> {fix ? "Re-upload" : "Upload"}
        </Button>
      ) : null}
    </li>
  );
}
