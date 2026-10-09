"use client";

import * as React from "react";
import { motion, useReducedMotion } from "motion/react";
import { Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { DURATION, EASE_SWAP } from "@/lib/motion";
import { Pill } from "@/components/ui/pill";

/**
 * Small pieces shared by the Sales tabs. Anything here is Sales-only; the
 * app-wide primitives live in src/components/ui.
 */

/**
 * Haven a step deeper for chart marks. The dataviz validator passes it on the
 * white card and the black one (lightness band, chroma floor, 3:1); the
 * tone's own haven-500 reads 2.5:1 on white.
 */
export const BAR = "bg-[#14a394]";
/** A period still under way: the same bar, hatched, because it isn't finished. */
export const IN_PROGRESS = "repeating-linear-gradient(135deg, rgb(255 255 255 / 0.34) 0 3px, transparent 3px 7px)";

/** An element's content width, kept current as it resizes: the hand-rolled charts lay out in real pixels. */
export function useMeasuredWidth<T extends HTMLElement>() {
  const ref = React.useRef<T>(null);
  const [width, setWidth] = React.useState(0);
  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

/** The "Managers only" lock tag on manager-visible cards (a quiet neutral tag). */
export function ManagersOnly({ className }: { className?: string }) {
  return (
    <Pill tone="neutral" icon={Lock} className={cn("text-xs", className)}>
      Managers only
    </Pill>
  );
}

/** A caption under a card or section — the mockup's faint 10.5–12px notes. */
export function Footnote({ className, children }: { className?: string; children: React.ReactNode }) {
  // Capped at ~70ch: the Sales pages run full width, a footnote shouldn't.
  return <p className={cn("max-w-[70ch] text-xs leading-relaxed text-subtle-foreground", className)}>{children}</p>;
}

/**
 * Segment colours for the stacked bars and their legends. One literal class per
 * segment so Tailwind sees every name (HRIS § 15.2).
 */
export const SEGMENT = {
  /** Mockup "mist": a quiet neutral. Sky Blue is Locale Wealth's colour, so it
   *  never stands in for a generic data series on a Homes dashboard. */
  mist: "bg-zinc-300 dark:bg-zinc-600",
  /** Mockup "seafoam" → Haven Green. */
  haven: "bg-haven-300 dark:bg-haven-400",
  /** Mockup "charcoal" (inverts in dark, as the mockup's token did). */
  charcoal: "bg-charcoal dark:bg-zinc-300",
} as const;
export type SegmentTone = keyof typeof SEGMENT;

export function Legend({ items, className }: { items: { label: string; tone: SegmentTone }[]; className?: string }) {
  return (
    <div className={cn("flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground", className)}>
      {items.map((it) => (
        <span key={it.label} className="inline-flex items-center gap-1.5">
          <span className={cn("size-2 rounded-[2px]", SEGMENT[it.tone])} aria-hidden />
          {it.label}
        </span>
      ))}
    </div>
  );
}

/**
 * StackedBar — segments share one track in proportion to their values. The
 * whole bar wipes in on a scaleX (transform only, HRIS performance rule 4).
 * `label` is the accessible reading of every segment.
 */
export function StackedBar({
  segments,
  label,
  delay = 0,
  className,
}: {
  segments: { value: number; tone: SegmentTone; title: string }[];
  label: string;
  delay?: number;
  className?: string;
}) {
  const reduce = useReducedMotion();
  return (
    <div role="img" aria-label={label} className={cn("h-2.5 w-full overflow-hidden rounded-full bg-muted", className)}>
      <motion.div
        className="flex h-full w-full origin-left"
        initial={{ scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={{ duration: reduce ? 0 : DURATION.fill, ease: EASE_SWAP, delay: reduce ? 0 : delay }}
      >
        {segments.map((s) =>
          s.value > 0 ? (
            <div
              key={s.title}
              title={`${s.title} ${s.value}`}
              className={cn("h-full basis-0", SEGMENT[s.tone])}
              style={{ flexGrow: s.value }}
            />
          ) : null,
        )}
      </motion.div>
    </div>
  );
}
