"use client";

import * as React from "react";
import { motion, useReducedMotion } from "motion/react";
import { CalendarClock, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { EASE_OUT } from "@/lib/motion";
import { Button } from "@/components/ui/button";
import { Dash } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { addDays, formatDayLong, toIso } from "@/components/ui/date-picker";
import { ORG_BRANDS, formatIsoDate, orgDepartment, type MasterRow, type OrgPerson } from "../data";
import type { ScheduledTransfer } from "../org-store";

/** Shared pieces of the Global Master List and its View, Edit and Pay dialogs. */

export type Mode = "view" | "edit" | "pay";
export type OpenFn = (id: string, mode: Mode) => void;

/** "2026-10-12" → "12 Oct", with the year only when it isn't this one. */
export function shortDate(iso: string, today: Date) {
  const full = formatIsoDate(iso);
  return iso.startsWith(String(today.getFullYear())) ? full.replace(/ \d{4}$/, "") : full;
}

/** Quick picks for an effective or pay date: today, next Monday, the 1st of next month. */
export function datePresets(today: Date) {
  const nextMonday = addDays(today, (8 - today.getDay()) % 7 || 7);
  const firstOfNext = new Date(today.getFullYear(), today.getMonth() + 1, 1);
  return [
    { label: "Today", iso: toIso(today) },
    { label: "Next Monday", iso: toIso(nextMonday) },
    { label: `1 ${formatIsoDate(toIso(firstOfNext)).split(" ")[1]}`, iso: toIso(firstOfNext) },
  ];
}

/** Who a seat answers to: their manager, the seat's title while it's vacant, or the board. */
export function reportsTo(row: MasterRow, seats: Map<string, OrgPerson>): string | null {
  if (row.link === "peer") return "The board";
  const manager = row.managerId ? seats.get(row.managerId) : undefined;
  if (!manager) return null;
  return manager.name ? `${manager.name} · ${manager.role}` : `${manager.role} (vacant)`;
}

export const brandWords = (row: MasterRow) =>
  row.brands?.length ? row.brands.map((b) => ORG_BRANDS[b].label).join(" and ") : "Group services";

/** An address that may break after its @ when the column is tight, never mid-word. */
export function Email({ value }: { value: string }) {
  const at = value.indexOf("@");
  if (at < 0) return <>{value}</>;
  return (
    <>
      {value.slice(0, at + 1)}
      <wbr />
      {value.slice(at + 1)}
    </>
  );
}

export const EMAIL_LINK =
  "rounded-sm text-tone-ink underline-offset-2 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/45";

export function DetailGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-2 text-[10px] font-semibold tracking-[0.12em] text-subtle-foreground uppercase">{title}</h3>
      <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2">{children}</dl>
    </section>
  );
}

/** One labelled read-only tile (HRIS's DetailField). Tiles cascade in behind the dialog's own entrance. */
export function Detail({
  index,
  icon: Icon,
  label,
  mono,
  wide,
  children,
}: {
  index: number;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  mono?: boolean;
  /** Spans both columns: a list rather than a value. */
  wide?: boolean;
  children: React.ReactNode;
}) {
  const reduce = useReducedMotion();
  const empty = children == null || children === "" || children === false;
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduce ? 0 : 0.24, ease: EASE_OUT, delay: reduce ? 0 : 0.1 + Math.min(index * 0.025, 0.25) }}
      className={cn("min-w-0 rounded-lg border border-hairline bg-canvas/60 px-3 py-2", wide && "sm:col-span-2")}
    >
      <dt className="flex items-center gap-1.5 text-[10px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
        <Icon className="size-3 shrink-0" aria-hidden />
        {label}
      </dt>
      <dd className={cn("mt-0.5 text-[13px] break-words", mono && "font-mono text-xs")}>{empty ? <Dash /> : children}</dd>
    </motion.div>
  );
}

/** A tinted line of context in a dialog: something booked (tone) or something that stops an action (amber). */
export function Notice({
  tone = "tone",
  icon: Icon = tone === "amber" ? TriangleAlert : CalendarClock,
  action,
  children,
}: {
  tone?: "tone" | "amber";
  icon?: React.ComponentType<{ className?: string }>;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border px-3 py-2.5 text-[13px]",
        tone === "amber"
          ? "border-amber-300/70 bg-amber-50 text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100"
          : "border-tone-line bg-tone-soft/60",
      )}
    >
      <Icon className={cn("size-4 shrink-0", tone === "tone" && "text-tone-ink")} aria-hidden />
      <div className="min-w-0 flex-1">{children}</div>
      {action}
    </div>
  );
}

/** A booked department move, with the way to call it off when `onCancel` is given. */
export function BookedMove({ booked, onCancel }: { booked: ScheduledTransfer; onCancel?: () => void }) {
  return (
    <Notice
      action={
        onCancel ? (
          <Button variant="outline" size="sm" onClick={onCancel}>
            Cancel move
          </Button>
        ) : null
      }
    >
      Moving to <span className="font-semibold">{orgDepartment(booked.to).name}</span> on{" "}
      <span className="font-semibold tabular-nums">{formatDayLong(booked.effective)}</span>
      <span className="block text-xs text-muted-foreground">Booked in Horilla · it applies on the day.</span>
    </Notice>
  );
}

/** A dollar figure: "$" ahead, an optional unit ("/hr") behind, two decimals once you leave the field. */
export const MoneyInput = React.forwardRef<
  HTMLInputElement,
  Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange"> & {
    value: string;
    onChange: (v: string) => void;
    unit?: string;
  }
>(function MoneyInput({ value, onChange, unit, className, onBlur, ...props }, ref) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-sm text-subtle-foreground">$</span>
      <Input
        ref={ref}
        inputMode="decimal"
        autoComplete="off"
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/[^0-9.,]/g, ""))}
        onBlur={(e) => {
          const n = parseMoney(value);
          if (n != null) onChange(n.toFixed(2));
          onBlur?.(e);
        }}
        className={cn("pl-6 tabular-nums", unit && "pr-10", className)}
        {...props}
      />
      {unit ? (
        <span className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-xs text-subtle-foreground">
          {unit}
        </span>
      ) : null}
    </div>
  );
});

/** "1,250.5" → 1250.5; null when it isn't a number. */
export function parseMoney(s: string): number | null {
  const t = s.replace(/,/g, "").trim();
  if (!t || !/^\d*\.?\d*$/.test(t)) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

/** An inline field error, announced as it appears. */
export function FieldError({ id, children }: { id?: string; children?: React.ReactNode }) {
  if (!children) return null;
  return (
    <p id={id} role="alert" className="text-xs text-rose-600 dark:text-rose-400">
      {children}
    </p>
  );
}
