"use client";

import * as React from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { DURATION, EASE_OUT, EASE_SWAP } from "@/lib/motion";

/**
 * The list motion HRIS's Global Master List uses (HR › Global Master List,
 * Employee › Department): a body that glides to its new height, a figure that
 * rolls to its new value, and a cascade that only plays while a pane arrives.
 */

/**
 * Glides a list body to its new height when a page, filter or search changes
 * how much it holds, instead of the card snapping. Also clips a sideways page
 * slide to the card.
 */
export function AutoHeight({ children }: { children: React.ReactNode }) {
  const reduce = useReducedMotion();
  const inner = React.useRef<HTMLDivElement>(null);
  const [height, setHeight] = React.useState<number | "auto">("auto");

  React.useEffect(() => {
    const el = inner.current;
    if (!el) return;
    const observer = new ResizeObserver(() => setHeight(el.offsetHeight));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <motion.div
      initial={false}
      animate={{ height }}
      transition={{ duration: reduce ? 0 : DURATION.swap, ease: EASE_SWAP }}
      className="overflow-hidden"
    >
      <div ref={inner}>{children}</div>
    </motion.div>
  );
}

const TICK_VARIANTS = {
  enter: (dir: number) => ({ opacity: 0, y: dir >= 0 ? "70%" : "-70%" }),
  center: { opacity: 1, y: "0%" },
  exit: (dir: number) => ({ opacity: 0, y: dir >= 0 ? "-70%" : "70%" }),
};

/** A figure that rolls to its new value: up as it grows or moves on, down as it shrinks or goes back. */
export function Ticker({ value }: { value: number }) {
  const reduce = useReducedMotion();
  const [last, setLast] = React.useState({ value, dir: 1 });
  if (last.value !== value) setLast({ value, dir: value > last.value ? 1 : -1 });

  return (
    <span className="relative inline-flex overflow-hidden align-bottom">
      <AnimatePresence mode="popLayout" initial={false} custom={last.dir}>
        <motion.span
          key={value}
          custom={last.dir}
          variants={TICK_VARIANTS}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ duration: reduce ? 0 : 0.2, ease: EASE_OUT }}
        >
          {value}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

/**
 * True for a pane's first 600ms. Rows that mount in it cascade; rows a search
 * brings in later fade straight in, so typing never waits on a stagger (HRIS).
 */
export function useCascading() {
  const [cascading, setCascading] = React.useState(true);
  React.useEffect(() => {
    const t = setTimeout(() => setCascading(false), 600);
    return () => clearTimeout(t);
  }, []);
  return cascading;
}
