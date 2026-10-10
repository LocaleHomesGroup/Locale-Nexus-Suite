"use client";

import * as React from "react";
import { useReducedMotion } from "motion/react";
import { Pager } from "@/components/ui/pager";

/**
 * The jobs table's footer when the list is more than one page: which jobs the table is on, and the shared
 * compact pager (src/components/ui/pager.tsx), laid out the way PagerFooter lays them out. PagerFooter writes
 * its own range with a dash ("51-100"); this list's count line is words ("Showing 51 to 100 of 977 jobs"), so the
 * footer is put together here from the same pieces.
 *
 * The pager names its buttons and announces "Page 2 of 20" (an sr-only live region), so that part is the shared
 * component's. What this adds is for a long page: turning it from the footer brings the top of the table back
 * into view, and keyboard focus stays on a pager button when Next or Previous disables itself on the last or
 * first page.
 */
export function JobsPager({
  page,
  pages,
  text,
  onPage,
}: {
  /** The page showing, 0-based, as `paginate()` clamps it. */
  page: number;
  pages: number;
  /** The count line: "Showing 51 to 100 of 977 jobs." */
  text: string;
  onPage: (n: number) => void;
}) {
  const reduce = useReducedMotion();
  const root = React.useRef<HTMLElement>(null);
  // Set when the pager turned the page, so a page that changes for another reason (a new search or filter) is left alone.
  const turned = React.useRef(false);

  const go = (n: number) => {
    if (n === page) return;
    turned.current = true;
    onPage(n);
  };

  React.useEffect(() => {
    if (!turned.current) return;
    turned.current = false;
    const footer = root.current;
    if (!footer) return;
    // The page scrolls inside the shell, not the window: when the table's top has scrolled out of sight, bring it
    // back, with a little air above it so the card's edge is never cut.
    const card = footer.closest<HTMLElement>('[data-slot="card"]');
    const scroller = document.getElementById("launchpad-scroll");
    if (card && scroller) {
      const above = card.getBoundingClientRect().top - scroller.getBoundingClientRect().top;
      if (above < 0) scroller.scrollTo({ top: scroller.scrollTop + above - 16, behavior: reduce ? "auto" : "smooth" });
    }
    // A button that disables itself drops focus to the page; hand it to the pager button that still works.
    const active = document.activeElement;
    if (!active || active === document.body || (active instanceof HTMLButtonElement && active.disabled)) {
      footer.querySelector<HTMLButtonElement>("button:not(:disabled)")?.focus({ preventScroll: true });
    }
  }, [page, reduce]);

  return (
    <nav
      ref={root}
      aria-label="Job list pages"
      className="flex items-center justify-between gap-3 border-t border-hairline px-5 py-2.5"
    >
      <p className="min-w-0 text-xs text-muted-foreground tabular-nums">{text}</p>
      <Pager current={page} pages={pages} onPage={go} />
    </nav>
  );
}
