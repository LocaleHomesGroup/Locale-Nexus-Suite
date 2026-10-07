"use client";

import * as React from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { EASE_OUT } from "@/lib/motion";
import { Pill } from "@/components/ui/pill";
import { Dash } from "@/components/ui/table";
import { PAY_WEEKS, weekLabel, type InvoiceState, type StaffInvoice } from "./data";

/**
 * Pieces the Employee portal's sections share: HRIS's hidden figures, the
 * invoice status pill, and which week each invoice bills. The greeting is
 * `useGreeting` in src/hooks, shared with the Sales Representative portal.
 */

/* ── Hidden values (HRIS HiddenValue) ──────────────────────────────────── */

/**
 * A pay figure behind the eye. Hidden on every visit and never remembered, so
 * a glance over your shoulder sees bullets. The swap is a quick blur
 * crossfade; under reduced motion it's instant.
 */
export function HiddenValue({ shown, children, className }: { shown: boolean; children: React.ReactNode; className?: string }) {
  const reduce = useReducedMotion();
  return (
    <span className={cn("relative inline-flex tabular-nums", className)}>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={shown ? "shown" : "hidden"}
          initial={{ opacity: 0, filter: "blur(6px)", scale: 0.98 }}
          animate={{ opacity: 1, filter: "blur(0px)", scale: 1 }}
          exit={{ opacity: 0, filter: "blur(6px)", scale: 0.98 }}
          transition={{ duration: reduce ? 0 : 0.16, ease: EASE_OUT }}
        >
          {shown ? (
            children
          ) : (
            <>
              <span aria-hidden>$•••••</span>
              <span className="sr-only">Hidden</span>
            </>
          )}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

/** The eye that shows and hides every pay figure on a page. */
export function EyeToggle({ shown, onToggle, className }: { shown: boolean; onToggle: () => void; className?: string }) {
  const reduce = useReducedMotion();
  const Icon = shown ? EyeOff : Eye;
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={shown}
      aria-label={shown ? "Hide pay amounts" : "Show pay amounts"}
      className={cn(
        "inline-flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/45 focus-visible:outline-none",
        className,
      )}
    >
      <motion.span
        key={shown ? "off" : "on"}
        initial={{ rotate: -90, opacity: 0 }}
        animate={{ rotate: 0, opacity: 1 }}
        transition={{ duration: reduce ? 0 : 0.2, ease: EASE_OUT }}
        className="inline-flex"
      >
        <Icon className="size-4" aria-hidden />
      </motion.span>
    </button>
  );
}

/* ── Status ────────────────────────────────────────────────────────────── */

const STATUS: Record<InvoiceState, { label: string; tone: "pending" | "ok" | "problem" }> = {
  pending: { label: "Pending", tone: "pending" },
  approved: { label: "Approved", tone: "ok" },
  rejected: { label: "Rejected", tone: "problem" },
  paid: { label: "Paid", tone: "ok" },
};

export const statusLabel = (s: InvoiceState) => STATUS[s].label;

/** Where an invoice stands (`stateOf`), or Sending… while its undo window is open. */
export function StatusPill({ status, sending, className }: { status: InvoiceState; sending?: boolean; className?: string }) {
  if (sending)
    return (
      <Pill variant="caps" tone="neutral" className={className}>
        Sending…
      </Pill>
    );
  return (
    <Pill variant="caps" tone={STATUS[status].tone} className={className}>
      {STATUS[status].label}
    </Pill>
  );
}

/* ── Weeks and their invoices ──────────────────────────────────────────── */

/** Each pay week's invoice, if it has one (a retracted invoice frees its week). */
export function invoiceByWeek(invoices: StaffInvoice[]): Map<string, StaffInvoice> {
  const map = new Map<string, StaffInvoice>();
  for (const inv of invoices) if (inv.week) map.set(inv.week, inv);
  return map;
}

/** Closed weeks with no invoice yet, newest first: what's ready to bill. */
export function uninvoicedWeeks(invoices: StaffInvoice[]) {
  const billed = invoiceByWeek(invoices);
  return [...PAY_WEEKS].reverse().filter((w) => !billed.has(w.start));
}

/** "Week of 27 Sep – 3 Oct", or "One-off invoice". */
export const billsFor = (inv: Pick<StaffInvoice, "week">) => (inv.week ? `Week of ${weekLabel(inv.week)}` : "One-off invoice");

/* ── Record tiles ──────────────────────────────────────────────────────── */

/** One field of a person's record (HR's master-list record dialog); the tiles cascade in. */
export function Detail({
  index,
  icon: Icon,
  label,
  mono,
  children,
}: {
  index: number;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  mono?: boolean;
  children: React.ReactNode;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduce ? 0 : 0.24, ease: EASE_OUT, delay: reduce ? 0 : 0.08 + index * 0.03 }}
      className="min-w-0 rounded-lg border border-hairline bg-canvas/60 px-3 py-2"
    >
      <dt className="flex items-center gap-1.5 text-[10px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
        <Icon className="size-3 shrink-0" aria-hidden />
        {label}
      </dt>
      <dd className={cn("mt-0.5 text-[13px] break-words", mono && "font-mono text-xs")}>{children ?? <Dash />}</dd>
    </motion.div>
  );
}
