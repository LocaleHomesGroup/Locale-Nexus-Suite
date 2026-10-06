"use client";

import * as React from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { AtSign, ChevronLeft, ChevronRight, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { DURATION, EASE_SWAP, PANEL_VARIANTS, RISE_VARIANTS } from "@/lib/motion";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Pill } from "@/components/ui/pill";
import { AutoHeight, Ticker } from "@/components/ui/list-motion";
import { orgTone } from "@/components/modules/hr/data";
import { ROLE_BY_KEY, rolePillTone, type LiveState, type Principal, type RoleKey } from "./data";

/** Shared pieces of Admin's two directory screens (Roles & permissions, Global Master List). */

/** HRIS's header stat chip: an icon, a tiny-caps label and a figure that rolls when it changes. */
export function StatChip({
  icon: Icon,
  label,
  value,
  live,
}: {
  icon: LucideIcon;
  label: string;
  value: number;
  /** A small emerald dot after the label: the figure follows who's online. */
  live?: boolean;
}) {
  return (
    <div className="flex items-center gap-2.5 rounded-xl border border-border bg-card px-3 py-2 shadow-xs">
      <Icon className={cn("size-4 shrink-0", live ? "text-emerald-600 dark:text-emerald-400" : "text-subtle-foreground")} aria-hidden />
      <div>
        <p className="flex items-center gap-1.5 text-[10px] font-semibold tracking-[0.12em] text-subtle-foreground uppercase">
          {label}
          {live ? <span className="size-1.5 rounded-full bg-emerald-500" aria-hidden /> : null}
        </p>
        <p className="font-mono text-sm font-semibold tabular-nums">
          <Ticker value={value} />
        </p>
      </div>
    </div>
  );
}

const RING: Record<LiveState, string> = {
  online: "ring-emerald-400/80 dark:ring-emerald-500/60",
  inactive: "ring-amber-400/80 dark:ring-amber-500/60",
  offline: "ring-border",
};

export const LIVE_DOT: Record<LiveState, string> = {
  online: "bg-emerald-500",
  inactive: "bg-amber-500",
  offline: "bg-zinc-300 dark:bg-zinc-600",
};

export const LIVE_LABEL: Record<LiveState, string> = { online: "Online", inactive: "Inactive", offline: "Offline" };

/**
 * A person's avatar. With `live`, a ring and a corner dot say whether they're
 * online, inactive or offline; selected, the ring takes the dashboard's tone.
 * An off-roster account shows an @ tile instead of initials.
 */
export function PersonAvatar({
  person,
  live,
  selected,
  size = "md",
}: {
  person: Principal;
  live?: LiveState;
  selected?: boolean;
  size?: "sm" | "md";
}) {
  const ring = selected ? "ring-tone-strong/70" : live ? RING[live] : "ring-transparent";
  return (
    <span className={cn("relative inline-flex shrink-0 rounded-full ring-2 transition-[box-shadow] duration-200", ring)}>
      {person.row ? (
        <Avatar name={person.name} tone={orgTone(person.row.brands)} size={size} />
      ) : (
        <span
          aria-hidden
          className={cn(
            "inline-flex items-center justify-center rounded-full bg-muted text-muted-foreground",
            size === "md" ? "size-9" : "size-7",
          )}
        >
          <AtSign className="size-4" />
        </span>
      )}
      {live ? (
        <span
          className={cn(
            "absolute -right-0.5 -bottom-0.5 rounded-full ring-2 ring-card",
            size === "md" ? "size-3" : "size-2.5",
            LIVE_DOT[live],
          )}
          aria-hidden
        />
      ) : null}
    </span>
  );
}

/** "Off-roster": on the Launchpad but not on the master list (HRIS's tag for an admin or service account). */
export function OffRosterTag({ label = "Off-roster" }: { label?: string }) {
  return (
    <Pill variant="caps" tone="neutral" className="py-px" title="Not on the master list">
      {label}
    </Pill>
  );
}

/** The roles someone holds, in rail order: up to three, then "+N". */
export function RolePills({ roles, max = 3, className }: { roles: RoleKey[]; max?: number; className?: string }) {
  if (!roles.length) return <span className="text-xs whitespace-nowrap text-subtle-foreground">No roles</span>;
  return (
    <span className={cn("flex flex-wrap justify-end gap-1", className)}>
      {roles.slice(0, max).map((r) => (
        <Pill key={r} tone={rolePillTone(r)} className="px-2 py-0">
          {ROLE_BY_KEY[r].label}
        </Pill>
      ))}
      {roles.length > max ? (
        <Pill tone="neutral" className="px-2 py-0" title={roles.slice(max).map((r) => ROLE_BY_KEY[r].label).join(", ")}>
          +{roles.length - max}
        </Pill>
      ) : null}
    </span>
  );
}

/** A tiny-caps heading over a group in the detail pane, with an optional caption and right slot. */
export function PaneHeading({
  title,
  caption,
  right,
  icon: Icon,
}: {
  title: string;
  caption?: React.ReactNode;
  right?: React.ReactNode;
  icon?: LucideIcon;
}) {
  return (
    <div className="flex items-end justify-between gap-3 border-b border-hairline pb-1.5">
      <div className="min-w-0">
        <h3 className="flex items-center gap-1.5 text-[10px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
          {Icon ? <Icon className="size-3.5 text-subtle-foreground" aria-hidden /> : null}
          {title}
        </h3>
        {caption ? <p className="mt-0.5 max-w-[70ch] text-xs text-subtle-foreground">{caption}</p> : null}
      </div>
      {right ? <div className="shrink-0">{right}</div> : null}
    </div>
  );
}

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

/** The detail pane's body: rises in afresh for each person picked. */
export function DetailSwap({ id, children }: { id: string; children: React.ReactNode }) {
  const reduce = useReducedMotion();
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={id}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -6 }}
        transition={{ duration: reduce ? 0 : 0.24, ease: EASE_SWAP }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}

/** On a phone the detail pane sits under the list: bring it into view when someone is picked. */
export function useRevealOnPick() {
  const ref = React.useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const reveal = React.useCallback(() => {
    if (window.matchMedia("(min-width: 1024px)").matches) return;
    ref.current?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  }, [reduce]);
  return [ref, reveal] as const;
}
