"use client";

import * as React from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { DURATION, EASE_SWAP, PANEL_VARIANTS, RISE_VARIANTS } from "@/lib/motion";
import type { PageSlice } from "@/lib/paginate";
import { Button } from "@/components/ui/button";
import { AutoHeight, Ticker } from "@/components/ui/list-motion";

/**
 * Paging for a list body, as HRIS's Global Master List pages it: a compact
 * pager, a footer that says which rows you're on, and a pane that slides
 * sideways the way you page and rises in on a new filter. Slice the list with
 * `paginate()` (src/lib/paginate.ts).
 */

/** HRIS's compact pager: previous, "2 / 8", next. */
export function Pager({ current, pages, onPage }: { current: number; pages: number; onPage: (n: number) => void }) {
  return (
    <div className="flex shrink-0 items-center gap-0.5 rounded-lg border border-border bg-canvas/70 p-0.5">
      <Button variant="ghost" size="icon-sm" aria-label="Previous page" disabled={current === 0} onClick={() => onPage(current - 1)}>
        <ChevronLeft />
      </Button>
      <span className="sr-only" aria-live="polite">
        Page {current + 1} of {pages}
      </span>
      <span className="min-w-12 text-center font-mono text-xs text-muted-foreground tabular-nums" aria-hidden>
        <Ticker value={current + 1} /> / {pages}
      </span>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Next page"
        disabled={current >= pages - 1}
        onClick={() => onPage(current + 1)}
      >
        <ChevronRight />
      </Button>
    </div>
  );
}

/** A list's footer: "11–17 of 17 requests" and the pager. Shown even on one page, so the paging is never a surprise. */
export function PagerFooter<T>({
  slice,
  noun,
  onPage,
  className,
}: {
  slice: PageSlice<T>;
  /** Plural: "requests". */
  noun: string;
  onPage: (n: number) => void;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center justify-between gap-3 border-t border-hairline px-5 py-2.5", className)}>
      <p className="text-xs text-muted-foreground tabular-nums">
        {slice.total ? (
          <>
            {slice.from}–{slice.to} of {slice.total} {noun}
          </>
        ) : (
          `No ${noun}`
        )}
      </p>
      <Pager current={slice.page} pages={slice.pages} onPage={onPage} />
    </div>
  );
}

/**
 * How a list body swaps. Paging slides sideways the way you're going (§ 11.1);
 * a new filter rises in like a section (§ 1.1).
 */
export interface Swap {
  kind: "page" | "view";
  dir: number;
}

export const VIEW_SWAP: Swap = { kind: "view", dir: 1 };

const PANE_VARIANTS = {
  enter: (s: Swap) => (s.kind === "page" ? PANEL_VARIANTS.enter(s.dir) : RISE_VARIANTS.enter(1)),
  center: { opacity: 1, x: 0, y: 0 },
  exit: (s: Swap) => (s.kind === "page" ? PANEL_VARIANTS.exit(s.dir) : RISE_VARIANTS.exit(1)),
};

/** A list body that swaps on a page or filter change and glides to its new height (the master list's motion). */
export function SwapPane({ swapKey, swap, children }: { swapKey: string; swap: Swap; children: React.ReactNode }) {
  const reduce = useReducedMotion();
  return (
    <AutoHeight>
      <AnimatePresence mode="wait" initial={false} custom={swap}>
        <motion.div
          key={swapKey}
          custom={swap}
          variants={PANE_VARIANTS}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ duration: reduce ? 0 : swap.kind === "page" ? 0.22 : DURATION.swap, ease: EASE_SWAP }}
        >
          {children}
        </motion.div>
      </AnimatePresence>
    </AutoHeight>
  );
}

/**
 * Page and filter state for a paged list: which page, and how the body last
 * swapped. `goPage` slides the way you're going; `resetPage` (a new filter)
 * goes back to page one and rises in.
 */
export function usePaging() {
  const [page, setPage] = React.useState(0);
  const [swap, setSwap] = React.useState<Swap>(VIEW_SWAP);
  const goPage = React.useCallback(
    (n: number) => {
      setSwap({ kind: "page", dir: n > page ? 1 : -1 });
      setPage(n);
    },
    [page],
  );
  const resetPage = React.useCallback(() => {
    setSwap(VIEW_SWAP);
    setPage(0);
  }, []);
  return { page, swap, goPage, resetPage };
}
