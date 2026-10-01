"use client";

import * as React from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";
import { DURATION, EASE_SWAP, PANEL_VARIANTS, RISE_VARIANTS } from "@/lib/motion";

/**
 * SlidingTabs — the HRIS § 11.1 pill row: ONE indicator that glides between
 * pills via a shared `layoutId`, instead of each pill toggling its own fill.
 * `variant="underline"` is the same mechanism with a 2px bar, for a strip that
 * must outrank a pill row beneath it.
 *
 *   const [tab, setTab, dir] = useTabParam(TABS, "pipeline");
 *   <SlidingTabs value={tab} onChange={setTab} items={[{ value: "pipeline", label: "Pipeline", count: 12 }]} />
 *   <TabPanels value={tab} dir={dir}>{tab === "pipeline" ? <Pipeline /> : …}</TabPanels>
 */
export interface TabItem<T extends string> {
  value: T;
  label: React.ReactNode;
  count?: number | string;
  icon?: React.ComponentType<{ className?: string }>;
  /** Red count + rose indicator — something is waiting on a decision. */
  danger?: boolean;
}

export function SlidingTabs<T extends string>({
  value,
  onChange,
  items,
  variant = "pill",
  className,
  ariaLabel,
}: {
  value: T;
  onChange: (value: T) => void;
  items: TabItem<T>[];
  variant?: "pill" | "underline";
  className?: string;
  ariaLabel?: string;
}) {
  const reduce = useReducedMotion();
  const id = React.useId();
  const transition = { duration: reduce ? 0 : DURATION.indicator, ease: EASE_SWAP };
  const listRef = React.useRef<HTMLDivElement>(null);
  const firstRun = React.useRef(true);

  // A strip wider than a phone scrolls sideways; keep the active tab in view so
  // a deep link (?tab=leave) never lands on a half-hidden tab. Adjusts only the
  // strip's own scrollLeft — never scrollIntoView, which would move the page.
  React.useEffect(() => {
    const list = listRef.current;
    const tab = list?.querySelector<HTMLElement>("[aria-selected=\"true\"]");
    if (!list || !tab || list.scrollWidth <= list.clientWidth) {
      firstRun.current = false;
      return;
    }
    const margin = 24;
    const left = tab.offsetLeft - margin;
    const right = tab.offsetLeft + tab.offsetWidth + margin - list.clientWidth;
    const target = list.scrollLeft > left ? left : list.scrollLeft < right ? right : null;
    if (target != null) {
      list.scrollTo({ left: Math.max(0, target), behavior: firstRun.current || reduce ? "auto" : "smooth" });
    }
    firstRun.current = false;
  }, [value, reduce]);

  if (variant === "underline") {
    return (
      <div
        ref={listRef}
        role="tablist"
        aria-label={ariaLabel}
        className={cn("relative flex max-w-full gap-1 overflow-x-auto border-b border-border [scrollbar-width:none]", className)}
      >
        {items.map((it) => {
          const active = it.value === value;
          const Icon = it.icon;
          return (
            <button
              key={it.value}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onChange(it.value)}
              className={cn(
                "relative -mb-px flex shrink-0 items-center gap-1.5 px-3.5 py-2.5 text-[13px] font-medium transition-colors",
                active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {Icon ? <Icon className="size-3.5" aria-hidden /> : null}
              {it.label}
              {it.count != null ? (
                <CountChip active={active} danger={it.danger} variant="underline">
                  {it.count}
                </CountChip>
              ) : null}
              {active ? (
                <motion.span
                  layoutId={`${id}-underline`}
                  className={cn(
                    "absolute inset-x-0 bottom-0 h-0.5 rounded-full",
                    it.danger ? "bg-rose-500" : "bg-tone-strong",
                  )}
                  transition={transition}
                />
              ) : null}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div
      ref={listRef}
      role="tablist"
      aria-label={ariaLabel}
      className={cn(
        "relative inline-flex max-w-full items-center gap-0.5 overflow-x-auto rounded-lg border border-border bg-card p-1 shadow-xs [scrollbar-width:none]",
        className,
      )}
    >
      {items.map((it) => {
        const active = it.value === value;
        const Icon = it.icon;
        return (
          <button
            key={it.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(it.value)}
            className={cn(
              "relative isolate flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors",
              active
                ? it.danger
                  ? "text-white"
                  : "text-tone-on-fill"
                : it.danger
                  ? "text-rose-700 hover:bg-rose-50 dark:text-rose-300 dark:hover:bg-rose-950/30"
                  : "text-muted-foreground hover:bg-tone-soft hover:text-tone-ink",
            )}
          >
            {active ? (
              <motion.span
                layoutId={`${id}-pill`}
                className={cn(
                  "absolute inset-0 -z-10 rounded-md shadow-sm",
                  it.danger ? "bg-rose-600 shadow-rose-600/20" : "bg-tone-fill shadow-black/10",
                )}
                transition={transition}
              />
            ) : null}
            {Icon ? <Icon className="size-3.5" aria-hidden /> : null}
            {it.label}
            {it.count != null ? <CountChip active={active} danger={it.danger}>{it.count}</CountChip> : null}
          </button>
        );
      })}
    </div>
  );
}

function CountChip({
  active,
  danger,
  variant = "pill",
  children,
}: {
  active: boolean;
  danger?: boolean;
  variant?: "pill" | "underline";
  children: React.ReactNode;
}) {
  // On the pill variant the active chip sits on the tone (or rose) fill; on the
  // underline variant it sits on the page, so it needs its own themed ground.
  const activeClass =
    variant === "pill"
      ? danger
        ? "bg-white/25 text-white"
        : "bg-black/10 text-tone-on-fill dark:bg-black/15"
      : danger
        ? "bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-200"
        : "bg-tone-tint text-tone-ink";
  return (
    <span
      className={cn(
        "rounded-full px-1.5 py-px text-xs font-semibold tabular-nums",
        active
          ? activeClass
          : danger
            ? "bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300"
            : "bg-muted text-muted-foreground",
      )}
    >
      {children}
    </span>
  );
}

/**
 * TabPanels — the animated swap for a section body (HRIS § 1.1 / § 11.1). Wrap
 * the active pane; key changes on `value`. `overflow-x-clip` keeps the slide
 * from spawning a page scrollbar without breaking sticky headers inside. Only
 * use it inside `PageContainer` (it borrows 16px of the page gutter).
 */
export function TabPanels({
  value,
  dir = 0,
  variant = "rise",
  className,
  children,
}: {
  value: string;
  dir?: number;
  /**
   * "rise" (default) — a dashboard section chosen in the rail: the HRIS
   * main-content swap. "slide" — an in-page step flow (Doc formatter's
   * upload → processing → review), sideways like a wizard.
   */
  variant?: "rise" | "slide";
  className?: string;
  children: React.ReactNode;
}) {
  const reduce = useReducedMotion();
  const slide = variant === "slide";
  return (
    // `-mx-4 px-4` gives the clip 16px of room inside the page gutter, so a
    // pulse ring or hover shadow on an edge tile isn't sliced off.
    <div className={cn("-mx-4 overflow-x-clip px-4", className)}>
      <AnimatePresence mode="wait" initial={false} custom={dir}>
        <motion.div
          key={value}
          custom={dir}
          variants={slide ? PANEL_VARIANTS : RISE_VARIANTS}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ duration: reduce ? 0 : slide ? 0.22 : DURATION.swap, ease: EASE_SWAP }}
        >
          {children}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
