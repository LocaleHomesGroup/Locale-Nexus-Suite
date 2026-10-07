"use client";

import * as React from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  Check,
  Circle,
  DollarSign,
  Folder,
  House,
  Lock,
  Map as MapIcon,
  TriangleAlert,
  Upload,
} from "lucide-react";
import type { DocCategory, SubmissionDoc } from "@/data/jobs";
import { cn } from "@/lib/utils";
import { DURATION, EASE_OUT, EASE_SWAP, PANEL_VARIANTS } from "@/lib/motion";
import { Card, CardContent, CardDescription, CardHeader, CardMeta, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AutoHeight, Ticker } from "@/components/ui/list-motion";
import { DOC_CATEGORIES, categoryProgress, isFixDoc, isVerifiedDoc, plural } from "./data";

const CATEGORY_ICON = { Build: House, Land: MapIcon, Finance: DollarSign } as const;

/**
 * Which Documents tab is open. Lives in SubmissionDetail, so stepping on to
 * Review and submit and back returns to the same tab. Opens on the first tab
 * with something outstanding, so a sent-back doc is the first thing the rep sees.
 */
export function useDocTab(docs: SubmissionDoc[]) {
  const [tab, setTabState] = React.useState<DocCategory>(
    () => DOC_CATEGORIES.find((c) => categoryProgress(docs, c).outstanding > 0) ?? DOC_CATEGORIES[0],
  );
  const [dir, setDir] = React.useState(0);
  const setTab = (next: DocCategory) => {
    if (next === tab) return;
    setDir(DOC_CATEGORIES.indexOf(next) > DOC_CATEGORIES.indexOf(tab) ? 1 : -1);
    setTabState(next);
  };
  return { tab, dir, setTab };
}

/**
 * Step 4: Build, Land and Finance as tabs the rep works through with Next.
 * A tab is green once every required doc in it is uploaded and nothing is sent
 * back, red until then. Any tab can be opened, but Review and submit stays
 * locked until all three are green.
 */
export function DocumentsStep({
  docs,
  tab,
  dir,
  onTab,
  onUpload,
  onContinue,
}: {
  docs: SubmissionDoc[];
  tab: DocCategory;
  dir: number;
  onTab: (cat: DocCategory) => void;
  onUpload: (ref: string) => void;
  onContinue: () => void;
}) {
  const reduce = useReducedMotion();
  const id = React.useId();

  const progress = DOC_CATEGORIES.map((cat) => ({ cat, ...categoryProgress(docs, cat) }));
  const requiredUploaded = progress.reduce((n, p) => n + p.uploaded, 0);
  const requiredTotal = progress.reduce((n, p) => n + p.total, 0);
  const outstanding = progress.reduce((n, p) => n + p.outstanding, 0);
  const ready = outstanding === 0;

  const index = DOC_CATEGORIES.indexOf(tab);
  const prev = DOC_CATEGORIES[index - 1];
  const next = DOC_CATEGORIES[index + 1];
  const redElsewhere = progress.filter((p) => p.cat !== tab && p.outstanding > 0);
  const rows = docs.filter((d) => d.cat === tab);

  return (
    <Card className="border-tone-line">
      <CardHeader>
        <Folder className="size-4 text-tone-ink" aria-hidden />
        <CardTitle as="h3" className="text-sm">
          Documents
        </CardTitle>
        <CardMeta
          className={cn(
            "text-xs font-semibold transition-colors duration-200",
            ready ? "text-emerald-700 dark:text-emerald-300" : "text-rose-700 dark:text-rose-300",
          )}
        >
          <span>
            Required: <Ticker value={requiredUploaded} /> of {requiredTotal} uploaded
          </span>
        </CardMeta>
        <CardDescription className="text-xs text-subtle-foreground">
          Work through Build, Land and Finance in turn. Green is complete; red is missing or sent back and blocks
          submission. Files are renamed on upload: <span className="font-mono text-xs">Surname_Ref.pdf</span>
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {/* ── Build · Land · Finance: a charcoal ring glides to the open tab ── */}
        <div role="tablist" aria-label="Document groups" className="grid grid-cols-3 gap-2">
          {progress.map((p, i) => {
            const active = p.cat === tab;
            const ok = p.outstanding === 0;
            const Icon = CATEGORY_ICON[p.cat];
            return (
              <button
                key={p.cat}
                type="button"
                role="tab"
                id={`${id}-tab-${p.cat}`}
                aria-controls={`${id}-panel`}
                aria-selected={active}
                onClick={() => onTab(p.cat)}
                className={cn(
                  "relative isolate flex min-w-0 flex-col items-start gap-0.5 rounded-lg border px-3 py-2 text-left transition-colors duration-200 focus-visible:ring-3 focus-visible:ring-ring/45 focus-visible:outline-none",
                  ok
                    ? "border-emerald-200 bg-emerald-50 hover:bg-emerald-100/70 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:hover:bg-emerald-500/15"
                    : "border-rose-200 bg-rose-50 hover:bg-rose-100/70 dark:border-rose-500/30 dark:bg-rose-500/10 dark:hover:bg-rose-500/15",
                )}
              >
                {active ? (
                  <motion.span
                    layoutId={`${id}-doc-tab`}
                    aria-hidden
                    className="absolute -inset-px -z-10 rounded-lg ring-2 ring-charcoal dark:ring-silver"
                    transition={{ duration: reduce ? 0 : DURATION.indicator, ease: EASE_SWAP }}
                  />
                ) : null}
                <span className="flex w-full items-center gap-1.5">
                  <StatusMark ok={ok} count={p.outstanding} />
                  <span className="truncate text-[13px] font-semibold">
                    <span className="sr-only">Step {i + 1}: </span>
                    {p.cat}
                  </span>
                  <Icon className="ml-auto hidden size-3.5 shrink-0 text-muted-foreground sm:block" aria-hidden />
                </span>
                <span
                  className={cn(
                    "text-xs leading-snug",
                    ok ? "text-emerald-700 dark:text-emerald-300" : "text-rose-700 dark:text-rose-300",
                  )}
                >
                  {p.fixes > 0 ? `${p.fixes} sent back` : `${p.uploaded} of ${p.total} required`}
                </span>
                <span className="sr-only">{ok ? " (complete)" : ` (${plural(p.outstanding, "item")} outstanding)`}</span>
              </button>
            );
          })}
        </div>

        <AutoHeight>
          <AnimatePresence mode="wait" initial={false} custom={dir}>
            <motion.ul
              key={tab}
              id={`${id}-panel`}
              role="tabpanel"
              aria-labelledby={`${id}-tab-${tab}`}
              custom={dir}
              variants={PANEL_VARIANTS}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: reduce ? 0 : 0.22, ease: EASE_SWAP }}
              className="flex flex-col gap-1"
            >
              {rows.map((d) => (
                <DocRow key={d.ref} doc={d} onUpload={() => onUpload(d.ref)} />
              ))}
            </motion.ul>
          </AnimatePresence>
        </AutoHeight>

        <div className="mt-1 flex items-center gap-2">
          {prev ? (
            <Button variant="outline" size="lg" onClick={() => onTab(prev)}>
              <ArrowLeft /> {prev}
            </Button>
          ) : null}
          {next ? (
            <Button size="lg" className="flex-1" onClick={() => onTab(next)}>
              Next: {next} documents <ArrowRight />
            </Button>
          ) : (
            <Button size="lg" className="flex-1" disabled={!ready} onClick={() => ready && onContinue()}>
              {ready ? (
                <>
                  Continue to review and submit <ArrowRight />
                </>
              ) : (
                <>
                  <Lock /> Continue locked · {plural(outstanding, "item")} outstanding
                </>
              )}
            </Button>
          )}
        </div>
        {!next && redElsewhere.length > 0 ? (
          <p className="-mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-rose-700 dark:text-rose-300">
            Still red:
            {redElsewhere.map((p) => (
              <button
                key={p.cat}
                type="button"
                onClick={() => onTab(p.cat)}
                className="rounded-sm font-semibold underline decoration-rose-300 underline-offset-2 hover:decoration-current focus-visible:ring-3 focus-visible:ring-ring/45 focus-visible:outline-none dark:decoration-rose-500/50"
              >
                {p.cat} · {p.outstanding}
              </button>
            ))}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}

/** The tab's verdict mark: a green tick once complete, a red count until then. */
function StatusMark({ ok, count }: { ok: boolean; count: number }) {
  const reduce = useReducedMotion();
  return (
    <span className="relative flex size-[17px] shrink-0" aria-hidden>
      <AnimatePresence initial={false} mode="popLayout">
        <motion.span
          key={ok ? "ok" : count}
          initial={{ opacity: 0, scale: 0.6 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.6 }}
          transition={{ duration: reduce ? 0 : 0.2, ease: EASE_OUT }}
          className={cn(
            "absolute inset-0 flex items-center justify-center rounded-full text-[10px] font-semibold text-white tabular-nums",
            ok ? "bg-emerald-600 dark:bg-emerald-500" : "bg-rose-600 dark:bg-rose-500",
          )}
        >
          {ok ? <Check className="size-2.5" strokeWidth={3} /> : count}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

/**
 * A checklist row. Red = blocking (a required doc with no file, or one Ops sent
 * back); green = uploaded, a stronger green with a badge once Ops verifies it;
 * muted = optional and empty.
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
            ? "border-emerald-300 bg-emerald-50 dark:border-emerald-500/40 dark:bg-emerald-500/15"
            : doc.file
              ? "border-emerald-200 bg-emerald-50/50 dark:border-emerald-500/25 dark:bg-emerald-500/[0.07]"
              : "border-hairline bg-muted/60 dark:bg-white/[0.03]",
      )}
    >
      {fix ? (
        <TriangleAlert className="size-3.5 shrink-0 text-rose-600 dark:text-rose-400" aria-label="Sent back by Ops" />
      ) : verified ? (
        <BadgeCheck className="size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" aria-label="Verified by Ops" />
      ) : doc.file ? (
        <Check className="size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" aria-label="Uploaded" />
      ) : (
        <Circle
          className={cn("size-3.5 shrink-0", blocking ? "text-rose-500 dark:text-rose-400" : "text-subtle-foreground")}
          aria-label="Not uploaded"
        />
      )}
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "text-xs",
            blocking ? "font-medium text-rose-700 dark:text-rose-300" : "text-foreground",
          )}
        >
          {doc.name}{" "}
          {!doc.req ? <span className="text-xs font-normal text-subtle-foreground">· if applicable</span> : null}
        </p>
        <p className="truncate text-xs text-muted-foreground">
          {fix ? (
            <span className="text-rose-700 dark:text-rose-300">Ops: {doc.fixNote}</span>
          ) : verified ? (
            <>
              <span className="font-mono">{doc.file}</span> ·{" "}
              <span className="text-emerald-700 dark:text-emerald-300">verified by Ops</span>
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
          className={cn(!blocking && "text-tone-ink")}
          aria-label={`${fix ? "Re-upload" : "Upload"} ${doc.name}`}
          onClick={onUpload}
        >
          <Upload /> {fix ? "Re-upload" : "Upload"}
        </Button>
      ) : null}
    </li>
  );
}
