"use client";

import * as React from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  ArrowLeft,
  Check,
  FileText,
  GitCompareArrows,
  Maximize2,
  ShieldCheck,
  Sparkles,
  TriangleAlert,
} from "lucide-react";
import { confirm, useLaunchpad } from "@/state/launchpad-store";
import { cn } from "@/lib/utils";
import { DURATION, EASE_OUT } from "@/lib/motion";
import { PageHeader, SectionLabel } from "@/components/ui/page";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Pill } from "@/components/ui/pill";
import { RateBar } from "@/components/ui/progress";
import { Reveal } from "@/components/ui/reveal";
import { AUTOMATED_CHECKS, DEFAULT_FIX_NOTE, FIX_REASONS, NGUYEN, isChangesRequested, isVerified } from "./data";
import { CompareDialog, PreviewDialog } from "./ReviewDialogs";

/**
 * Ops review of the Nguyen submission (mockup `am`): pick a submitted
 * document, read the automated checks, then verify it or send it back to the
 * rep with a reason. Approval unlocks once every uploaded document is verified.
 */
export function OpsReview({ onBack }: { onBack: () => void }) {
  const {
    submissionDocs: docs,
    setSubmissionDocs: setDocs,
    submissionStatus: status,
    setSubmissionStatus: setStatus,
    notify,
  } = useLaunchpad();
  const reduce = useReducedMotion();

  const uploaded = docs.filter((d) => d.file);
  const [selected, setSelected] = React.useState<string | null>(uploaded[0]?.ref ?? null);
  const [reason, setReason] = React.useState("");
  const [preview, setPreview] = React.useState(false);
  const [compare, setCompare] = React.useState(false);

  const current = docs.find((d) => d.ref === selected);
  const verifiedCount = uploaded.filter((d) => isVerified(d.state)).length;
  const allVerified = uploaded.length > 0 && verifiedCount === uploaded.length;
  const anyFix = docs.some((d) => d.state === "fix");

  const verify = (ref: string) => {
    setDocs((prev) => prev.map((d) => (d.ref === ref ? { ...d, state: "verified", fixNote: "" } : d)));
    const next = uploaded.filter((d) => d.ref !== ref && !isVerified(d.state));
    if (next[0]) setSelected(next[0].ref);
  };

  const requestFix = (ref: string, note: string) => {
    const doc = docs.find((d) => d.ref === ref);
    setDocs((prev) =>
      prev.map((d) => (d.ref === ref ? { ...d, state: "fix", fixNote: note || DEFAULT_FIX_NOTE } : d)),
    );
    setStatus("changes");
    const msg = `Fix requested · ${doc?.name ?? ref} — ${NGUYEN.repName} notified`;
    notify(msg, "red");
    confirm(msg, note || DEFAULT_FIX_NOTE);
    setReason("");
  };

  const approve = () => {
    setStatus("approved");
    const msg = "Nguyen submission approved · Forma pack generated and delivered";
    notify(msg, "ok");
    confirm(msg);
  };

  const statusPill =
    status === "approved" ? (
      <Pill tone="ok">Approved</Pill>
    ) : isChangesRequested(status) ? (
      <Pill tone="problem">Changes requested</Pill>
    ) : (
      <Pill tone="pending">In review</Pill>
    );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <Button variant="ghost" size="sm" className="-ml-2 self-start" onClick={onBack}>
          <ArrowLeft aria-hidden /> Review queue
        </Button>
        <PageHeader
          title={
            <span className="inline-flex items-center gap-2">
              <ShieldCheck className="size-5 shrink-0 text-tone-ink" aria-hidden />
              Ops review · M. and T. Nguyen
            </span>
          }
          description="Open each document, check it against the deal, then verify or send it back. Automated checks run first so you only look closely at what matters."
          actions={
            <>
              <Pill tone="neutral">{NGUYEN.builder}</Pill>
              {statusPill}
              <span className="text-xs text-subtle-foreground">Submitted by {NGUYEN.repName}</span>
            </>
          }
        />
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-[0.85fr_1.15fr]">
        {/* Submitted documents */}
        <Reveal index={0} className="min-w-0">
          <Card>
            <CardHeader className="pb-1">
              <p className="text-[10px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
                Submitted documents
              </p>
            </CardHeader>
            <CardContent className="px-3 pb-3">
              <ul className="flex flex-col gap-0.5">
                {uploaded.map((d) => {
                  const active = d.ref === selected;
                  return (
                    <li key={d.ref}>
                      <button
                        type="button"
                        onClick={() => setSelected(d.ref)}
                        aria-current={active ? "true" : undefined}
                        className={cn(
                          "flex w-full items-center gap-2.5 rounded-lg border px-2.5 py-2 text-left transition-colors",
                          active
                            ? "border-tone-line bg-tone-soft"
                            : "border-transparent hover:bg-tone-soft/60",
                        )}
                      >
                        {isVerified(d.state) ? (
                          <Check className="size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
                        ) : d.state === "fix" ? (
                          <TriangleAlert className="size-3.5 shrink-0 text-rose-600 dark:text-rose-400" aria-hidden />
                        ) : (
                          <FileText className="size-3.5 shrink-0 text-subtle-foreground" aria-hidden />
                        )}
                        <span className="min-w-0 flex-1">
                          <span className={cn("block text-xs leading-snug", active ? "font-semibold" : "font-normal")}>
                            {d.name}
                          </span>
                          <span className="block font-mono text-xs text-subtle-foreground">{d.ref}</span>
                        </span>
                        <span className="sr-only">
                          {isVerified(d.state) ? "Verified" : d.state === "fix" ? "Sent back" : "Not reviewed"}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </CardContent>
            <CardFooter className="flex-col items-stretch gap-1.5">
              <span className="text-xs text-subtle-foreground tabular-nums">
                {verifiedCount} of {uploaded.length} verified
              </span>
              <RateBar
                value={uploaded.length ? verifiedCount / uploaded.length : null}
                tone="ok"
                label={`${verifiedCount} of ${uploaded.length} documents verified`}
              />
            </CardFooter>
          </Card>
        </Reveal>

        <div className="flex min-w-0 flex-col gap-4">
          {/* The selected document */}
          {current ? (
            <Reveal index={1}>
              <Card className="border-tone-line">
                <AnimatePresence mode="wait" initial={false}>
                  <motion.div
                    key={current.ref}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1, transition: { duration: reduce ? 0 : DURATION.fade, ease: EASE_OUT } }}
                    exit={{ opacity: 0, transition: { duration: reduce ? 0 : 0.1 } }}
                  >
                    <CardHeader className="pt-4">
                      <FileText className="size-4 shrink-0 text-tone-ink" aria-hidden />
                      <CardTitle as="h2" className="text-sm">
                        {current.name}
                      </CardTitle>
                      <span className="ml-auto font-mono text-xs text-subtle-foreground">{current.file}</span>
                    </CardHeader>
                    <CardContent className="pb-5">
                      <div className="mb-3 rounded-lg border border-hairline bg-muted/60 px-4 py-5 text-center dark:bg-white/[0.03]">
                        <div className="mx-auto mb-2 flex h-[68px] w-[54px] items-center justify-center rounded border border-border bg-card shadow-md shadow-black/10">
                          <FileText className="size-5.5 text-tone-ink" aria-hidden />
                        </div>
                        <p className="text-xs text-muted-foreground">Document preview · page 1 of 3</p>
                        <div className="mt-2.5 flex flex-wrap justify-center gap-2">
                          <Button variant="outline" size="xs" onClick={() => setPreview(true)}>
                            <Maximize2 aria-hidden /> Open full size
                          </Button>
                          <Button variant="outline" size="xs" onClick={() => setCompare(true)}>
                            <GitCompareArrows aria-hidden /> Compare to deal form
                          </Button>
                        </div>
                      </div>

                      <SectionLabel className="mb-0.5">Automated checks</SectionLabel>
                      <ul>
                        {AUTOMATED_CHECKS.map(([label, pass]) => (
                          <li
                            key={label}
                            className="flex items-center gap-2 border-t border-hairline py-1.5 text-xs first:border-t-0"
                          >
                            {pass ? (
                              <Check className="size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
                            ) : (
                              <TriangleAlert className="size-3.5 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
                            )}
                            <span>{label}</span>
                            <span
                              className={cn(
                                "ml-auto text-xs font-medium",
                                pass ? "text-emerald-700 dark:text-emerald-300" : "text-amber-700 dark:text-amber-300",
                              )}
                            >
                              {pass ? "Pass" : "Check"}
                            </span>
                          </li>
                        ))}
                      </ul>

                      {isVerified(current.state) ? (
                        <p className="mt-3.5 flex items-center justify-center gap-1.5 text-[13px] font-semibold text-emerald-700 dark:text-emerald-300">
                          <Check className="size-4" aria-hidden /> Verified by S. Hart
                        </p>
                      ) : current.state === "fix" ? (
                        <div className="mt-3.5 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5 text-xs text-rose-900 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-100">
                          <span className="font-semibold">Sent back to {NGUYEN.repName}:</span> {current.fixNote}
                        </div>
                      ) : (
                        <>
                          <div className="mt-3.5 flex flex-wrap gap-2">
                            <Button className="min-w-[150px] flex-1" size="lg" onClick={() => verify(current.ref)}>
                              <Check aria-hidden /> Verify document
                            </Button>
                            <Button
                              variant="outline"
                              size="lg"
                              onClick={() => requestFix(current.ref, reason || DEFAULT_FIX_NOTE)}
                            >
                              Request fix
                            </Button>
                          </div>
                          <div className="mt-2.5 flex flex-wrap items-center gap-1.5" role="group" aria-label="Reason for the fix">
                            {FIX_REASONS.map((r) => (
                              <button
                                key={r}
                                type="button"
                                aria-pressed={reason === r}
                                onClick={() => setReason(reason === r ? "" : r)}
                                className={cn(
                                  "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                                  reason === r
                                    ? "border-tone-fill bg-tone-fill text-tone-on-fill"
                                    : "border-border bg-card text-muted-foreground hover:border-tone-line hover:text-foreground dark:bg-white/[0.03]",
                                )}
                              >
                                {r}
                              </button>
                            ))}
                            <span className="text-xs text-subtle-foreground">reason sent to the rep</span>
                          </div>
                        </>
                      )}
                    </CardContent>
                  </motion.div>
                </AnimatePresence>
              </Card>
            </Reveal>
          ) : null}

          {/* Approve */}
          <Reveal index={2}>
            <Card className="px-4 py-3">
              {status === "approved" ? (
                <p className="flex items-center gap-2 text-[13px] font-semibold text-emerald-700 dark:text-emerald-300">
                  <Sparkles className="size-4 shrink-0" aria-hidden /> Approved · Forma workbook generated and delivered
                  to their Teams folder
                </p>
              ) : (
                <Button
                  variant={allVerified ? "brand" : "secondary"}
                  size="lg"
                  className="w-full"
                  disabled={!allVerified}
                  onClick={approve}
                >
                  {allVerified
                    ? "Approve and generate Forma pack"
                    : anyFix
                      ? "Waiting on rep to re-upload"
                      : `Verify all documents to approve (${verifiedCount}/${uploaded.length})`}
                </Button>
              )}
            </Card>
          </Reveal>
        </div>
      </div>

      {current ? (
        <>
          <PreviewDialog open={preview} onClose={() => setPreview(false)} doc={current} />
          <CompareDialog open={compare} onClose={() => setCompare(false)} doc={current} />
        </>
      ) : null}
    </div>
  );
}
