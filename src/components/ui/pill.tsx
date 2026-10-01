import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Pill — short inline tags and status.
 *
 * variant="soft"  rounded tag, text-xs medium — "Pinned", "In build", "Titled".
 * variant="caps"  HRIS § 8.2 tiny-caps status pill with a border — PAID / PENDING.
 *
 * Tones carry meaning (HRIS § 15). Brand tones are identity, status tones are
 * verdicts — never use `ok` green for a brand accent or `haven` for a verdict.
 *   haven    Locale accent / current / selected (Homes)
 *   nectar   Financial sub-brand
 *   skyblue  Wealth sub-brand, neutral info
 *   neutral  default / inactive
 *   ok       done, approved, synced
 *   pending  waiting, in review, caution
 *   problem  conflict, rejected, overdue
 *   charcoal inverse emphasis
 */
export type PillTone =
  | "haven"
  | "nectar"
  | "skyblue"
  | "neutral"
  | "ok"
  | "pending"
  | "problem"
  | "charcoal";

const SOFT: Record<PillTone, string> = {
  haven: "bg-haven-300 text-haven-950 dark:bg-haven-300/90 dark:text-haven-950",
  nectar: "bg-nectar-200 text-nectar-900 dark:bg-nectar-300/20 dark:text-nectar-200",
  skyblue: "bg-skyblue-200 text-skyblue-900 dark:bg-skyblue-300/20 dark:text-skyblue-200",
  neutral: "bg-muted text-muted-foreground",
  ok: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  pending: "bg-amber-50 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300",
  problem: "bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300",
  charcoal: "bg-charcoal text-haven-300 dark:bg-silver dark:text-charcoal",
};

const CAPS: Record<PillTone, string> = {
  haven: "border-haven-300 bg-haven-50 text-haven-800 dark:border-haven-700/60 dark:bg-haven-500/10 dark:text-haven-200",
  nectar: "border-nectar-300 bg-nectar-50 text-nectar-800 dark:border-nectar-700/50 dark:bg-nectar-500/10 dark:text-nectar-200",
  skyblue: "border-skyblue-300 bg-skyblue-50 text-skyblue-800 dark:border-skyblue-700/50 dark:bg-skyblue-500/10 dark:text-skyblue-200",
  neutral: "border-border bg-muted text-muted-foreground",
  ok: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300",
  pending: "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300",
  problem: "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300",
  charcoal: "border-charcoal bg-charcoal text-haven-300 dark:border-silver dark:bg-silver dark:text-charcoal",
};

export function Pill({
  tone = "neutral",
  variant = "soft",
  icon: Icon,
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & {
  tone?: PillTone;
  variant?: "soft" | "caps";
  icon?: React.ComponentType<{ className?: string }>;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 whitespace-nowrap",
        variant === "soft"
          ? cn("rounded-full px-2.5 py-0.5 text-xs font-medium", SOFT[tone])
          : cn("rounded-full border px-1.5 py-0.5 text-[10px] font-semibold tracking-[0.12em] uppercase", CAPS[tone]),
        className,
      )}
      {...props}
    >
      {Icon ? <Icon className={variant === "soft" ? "size-3" : "size-2.5"} aria-hidden /> : null}
      {children}
    </span>
  );
}

/** A tiny caps system tag — "MONDAY", "HUBSPOT", "XERO" — on the audit trail. */
export function SystemTag({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "rounded-full bg-muted px-1.5 py-px text-[9.5px] font-semibold tracking-[0.1em] text-muted-foreground uppercase",
        className,
      )}
    >
      {children}
    </span>
  );
}
