"use client";

import * as React from "react";
import { Check, ChevronLeft, ChevronRight, FileText, GitCompareArrows, TriangleAlert } from "lucide-react";
import type { SubmissionDoc } from "@/data/jobs";
import { cn } from "@/lib/utils";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { SectionLabel } from "@/components/ui/page";
import { AUTOMATED_CHECKS, DEAL_FORM, PREVIEW_PAGES } from "./data";

/**
 * "Open full size" — the simulated document viewer (HRIS § 10.2 shape: page
 * N of M, ←/→ to step). The prototype has no real files, so each page is a
 * neutral stand-in; the last page carries the signature block the automated
 * check looks for.
 */
export function PreviewDialog({ open, onClose, doc }: { open: boolean; onClose: () => void; doc: SubmissionDoc }) {
  const [page, setPage] = React.useState(1);

  React.useEffect(() => {
    if (open) setPage(1);
  }, [open, doc.ref]);

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") setPage((p) => Math.min(PREVIEW_PAGES, p + 1));
      if (e.key === "ArrowLeft") setPage((p) => Math.max(1, p - 1));
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="lg"
      icon={FileText}
      title={doc.name}
      description={<span className="font-mono text-[11px]">{doc.file}</span>}
      footer={
        <Button variant="outline" onClick={onClose}>
          Close
        </Button>
      }
    >
      <div className="flex items-center justify-center gap-3">
        <Button
          variant="outline"
          size="icon"
          className="rounded-full"
          aria-label="Previous page"
          disabled={page === 1}
          onClick={() => setPage((p) => Math.max(1, p - 1))}
        >
          <ChevronLeft />
        </Button>
        <div
          className="aspect-[1/1.3] w-full max-w-[340px] rounded-md border border-border bg-white px-7 py-8 shadow-lg shadow-black/10 dark:bg-[#ececef]"
          role="img"
          aria-label={`${doc.name}, page ${page} of ${PREVIEW_PAGES}`}
        >
          <div className="h-2.5 w-1/2 rounded-full bg-zinc-300" />
          <div className="mt-1.5 h-1.5 w-1/3 rounded-full bg-zinc-200 dark:bg-zinc-300" />
          <div className="mt-6 flex flex-col gap-2">
            {Array.from({ length: page === PREVIEW_PAGES ? 7 : 12 }, (_, i) => (
              <div
                key={i}
                className={cn(
                  "h-1.5 rounded-full bg-zinc-200 dark:bg-zinc-300",
                  i % 4 === 3 ? "w-3/5" : i % 3 === 1 ? "w-11/12" : "w-full",
                )}
              />
            ))}
          </div>
          {page === PREVIEW_PAGES ? (
            <div className="mt-8 grid grid-cols-2 gap-6">
              {[0, 1].map((i) => (
                <div key={i}>
                  <svg viewBox="0 0 120 32" className="h-7 w-full text-haven-800" aria-hidden>
                    <path
                      d={i === 0 ? "M4 24 C 18 4, 26 30, 40 14 S 64 6, 70 22 S 96 10, 116 16" : "M6 20 C 20 8, 30 28, 46 12 S 72 26, 84 10 S 104 22, 114 14"}
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                    />
                  </svg>
                  <div className="mt-1 h-px bg-zinc-400" />
                  <div className="mt-1.5 h-1.5 w-2/3 rounded-full bg-zinc-200 dark:bg-zinc-300" />
                </div>
              ))}
            </div>
          ) : null}
        </div>
        <Button
          variant="outline"
          size="icon"
          className="rounded-full"
          aria-label="Next page"
          data-autofocus
          disabled={page === PREVIEW_PAGES}
          onClick={() => setPage((p) => Math.min(PREVIEW_PAGES, p + 1))}
        >
          <ChevronRight />
        </Button>
      </div>
      <p className="mt-3 text-center text-[11.5px] text-muted-foreground tabular-nums" aria-live="polite">
        Document preview · page {page} of {PREVIEW_PAGES}
      </p>
    </Dialog>
  );
}

/** "Compare to deal form" — what the rep entered, beside this document's automated checks. */
export function CompareDialog({ open, onClose, doc }: { open: boolean; onClose: () => void; doc: SubmissionDoc }) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="lg"
      icon={GitCompareArrows}
      title="Compare to deal form"
      description={
        <>
          {doc.name} · <span className="font-mono text-[11px]">{doc.file}</span>
        </>
      }
      footer={
        <Button variant="outline" onClick={onClose}>
          Close
        </Button>
      }
    >
      <div className="grid gap-5 sm:grid-cols-[1.2fr_1fr]">
        <div className="flex flex-col gap-4">
          {DEAL_FORM.map((group) => (
            <section key={group.section}>
              <SectionLabel>{group.section}</SectionLabel>
              <dl className="mt-1">
                {group.rows.map(([k, v]) => (
                  <div key={k} className="flex items-baseline gap-3 border-t border-hairline py-1.5 text-xs first:border-t-0">
                    <dt className="w-28 shrink-0 text-muted-foreground">{k}</dt>
                    <dd className="min-w-0 flex-1">{v}</dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
        </div>
        <div className="flex flex-col gap-4">
          <section>
            <SectionLabel>Automated checks</SectionLabel>
            <ul className="mt-1">
              {AUTOMATED_CHECKS.map(([label, pass]) => (
                <li key={label} className="flex items-center gap-2 border-t border-hairline py-1.5 text-xs first:border-t-0">
                  {pass ? (
                    <Check className="size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
                  ) : (
                    <TriangleAlert className="size-3.5 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
                  )}
                  <span className="min-w-0 flex-1">{label}</span>
                  <span
                    className={cn(
                      "text-[10.5px] font-medium",
                      pass ? "text-emerald-700 dark:text-emerald-300" : "text-amber-700 dark:text-amber-300",
                    )}
                  >
                    {pass ? "Pass" : "Check"}
                  </span>
                </li>
              ))}
            </ul>
          </section>
          <section className="rounded-lg border border-hairline bg-canvas px-3 py-2.5">
            <p className="text-[10px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">Document</p>
            <p className="mt-1 text-xs font-semibold">{doc.name}</p>
            <p className="mt-0.5 font-mono text-[11px] text-subtle-foreground">
              {doc.ref} · {doc.cat}
            </p>
          </section>
        </div>
      </div>
    </Dialog>
  );
}
