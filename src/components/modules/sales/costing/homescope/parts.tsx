"use client";

import * as React from "react";
import { motion, useReducedMotion } from "motion/react";
import { Check } from "lucide-react";
import { aud, cn } from "@/lib/utils";
import { DURATION, EASE_OUT, EASE_SWAP, rowDelay } from "@/lib/motion";
import { Input } from "@/components/ui/input";

/**
 * HomeScope's building blocks in Launchpad's look: the pick-one cards its
 * builder, model, range, elevation and colour steps are made of, a segmented
 * control, money and measure inputs, and the small headings inside a step.
 */

/**
 * A grid of pick-one cards. ONE highlight glides between them (a shared
 * `layoutId`, HRIS § 11.1), the cards cascade in once, and each lifts on hover.
 */
export function ChoiceGrid({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div role="list" className={cn("grid gap-3 sm:grid-cols-2 xl:grid-cols-3", className)}>
      {children}
    </div>
  );
}

export function ChoiceCard({
  group,
  index = 0,
  selected,
  onSelect,
  title,
  sub,
  meta,
  aside,
  mark,
  disabled,
  className,
}: {
  /** Cards that share a group share the gliding highlight. */
  group: string;
  index?: number;
  selected: boolean;
  onSelect: () => void;
  title: React.ReactNode;
  sub?: React.ReactNode;
  meta?: React.ReactNode;
  /** Top-right: a price or a tag. */
  aside?: React.ReactNode;
  /** The leading tile: an initial or an icon. */
  mark?: React.ReactNode;
  disabled?: boolean;
  className?: string;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      role="listitem"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduce ? 0 : 0.28, ease: EASE_OUT, delay: rowDelay(index, reduce, 0.03, 0.3) }}
      className="min-w-0"
    >
      <button
        type="button"
        aria-pressed={selected}
        disabled={disabled}
        onClick={onSelect}
        className={cn(
          "group/card relative isolate flex h-full w-full cursor-pointer items-start gap-3 rounded-xl border p-3.5 text-left outline-none",
          "transition-[transform,border-color,background-color,box-shadow] duration-200 focus-visible:ring-3 focus-visible:ring-ring/45",
          "disabled:cursor-not-allowed disabled:opacity-50",
          selected
            ? "border-transparent shadow-sm"
            : "border-border bg-card hover:-translate-y-0.5 hover:border-tone-line hover:shadow-md dark:bg-white/[0.02]",
          className,
        )}
      >
        {selected ? (
          <motion.span
            layoutId={`hs-pick-${group}`}
            aria-hidden
            className="absolute inset-0 -z-10 rounded-xl border-[1.5px] border-tone-strong bg-tone-soft"
            transition={{ duration: reduce ? 0 : DURATION.indicator, ease: EASE_SWAP }}
          />
        ) : null}
        {mark ? (
          <span
            aria-hidden
            className={cn(
              "flex size-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br text-sm font-bold text-white transition-transform duration-200",
              "from-tone-chip-a to-tone-chip-b group-hover/card:scale-105",
            )}
          >
            {mark}
          </span>
        ) : null}
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="flex items-start justify-between gap-2">
            <span className="text-[13px] leading-snug font-semibold text-pretty text-foreground">{title}</span>
            {aside ? <span className="shrink-0 text-xs font-semibold text-foreground tabular-nums">{aside}</span> : null}
          </span>
          {sub ? <span className="text-xs text-muted-foreground">{sub}</span> : null}
          {meta ? <span className="text-xs text-subtle-foreground tabular-nums">{meta}</span> : null}
        </span>
        <span
          aria-hidden
          className={cn(
            "absolute top-2 right-2 flex size-4 items-center justify-center rounded-full bg-tone-fill text-tone-on-fill transition-[opacity,transform] duration-200",
            selected ? "scale-100 opacity-100" : "scale-50 opacity-0",
          )}
        >
          <Check className="size-2.5" strokeWidth={3} />
        </span>
      </button>
    </motion.div>
  );
}

/** A labelled group of cards (a model frontage, a spec level). */
export function GroupLabel({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="mb-2 flex items-center gap-2">
      <span className="text-[10px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">{children}</span>
      <span className="h-px flex-1 bg-hairline" aria-hidden />
      {right}
    </div>
  );
}

/** A panel heading inside a step. */
export function PanelTitle({
  icon: Icon,
  children,
  right,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
    <div className="mb-3 flex items-center gap-2">
      {Icon ? <Icon className="size-3.5 text-tone-ink" aria-hidden /> : null}
      <h3 className="text-sm font-semibold">{children}</h3>
      {right ? <div className="ml-auto flex items-center gap-2">{right}</div> : null}
    </div>
  );
}

/** A quiet bordered panel for a block of fields. */
export function Panel({ className, children }: { className?: string; children: React.ReactNode }) {
  return <section className={cn("min-w-0 rounded-xl border border-border bg-canvas/60 p-4 dark:bg-white/[0.02]", className)}>{children}</section>;
}

/** Pick one of a few, as a pill row with one gliding fill (radio semantics). */
export function Segmented<T extends string>({
  label,
  value,
  onChange,
  options,
  className,
}: {
  label: string;
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: React.ReactNode; disabled?: boolean; title?: string }[];
  className?: string;
}) {
  const reduce = useReducedMotion();
  const id = React.useId();
  return (
    <div role="radiogroup" aria-label={label} className={cn("inline-flex rounded-lg border border-border bg-card p-0.5 shadow-xs", className)}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            disabled={o.disabled}
            title={o.title}
            onClick={() => onChange(o.value)}
            className={cn(
              "relative isolate rounded-md px-3 py-1 text-xs font-medium transition-colors focus-visible:ring-3 focus-visible:ring-ring/45 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-40",
              on ? "text-tone-on-fill" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {on ? (
              <motion.span
                layoutId={`${id}-seg`}
                aria-hidden
                className="absolute inset-0 -z-10 rounded-md bg-tone-fill shadow-sm"
                transition={{ duration: reduce ? 0 : DURATION.indicator, ease: EASE_SWAP }}
              />
            ) : null}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** Whole dollars, grouped as you type. Empty reads as null. */
export function MoneyInput({
  id,
  value,
  onChange,
  placeholder = "0",
  className,
  ariaLabel,
  autoFocus,
}: {
  id?: string;
  value: number | null;
  onChange: (n: number | null) => void;
  placeholder?: string;
  className?: string;
  ariaLabel?: string;
  autoFocus?: boolean;
}) {
  return (
    <div className={cn("relative", className)}>
      <span className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-xs text-subtle-foreground" aria-hidden>
        $
      </span>
      <Input
        id={id}
        inputMode="numeric"
        autoComplete="off"
        aria-label={ariaLabel}
        autoFocus={autoFocus}
        placeholder={placeholder}
        value={value == null ? "" : value.toLocaleString("en-AU")}
        onChange={(e) => {
          const digits = e.target.value.replace(/[^0-9]/g, "");
          onChange(digits ? Number(digits) : null);
        }}
        className="pl-5 text-right tabular-nums"
      />
    </div>
  );
}

/** A measure (m², metres): digits and one decimal point, with a unit after. Empty reads as null. */
export function MeasureInput({
  id,
  value,
  onChange,
  unit,
  placeholder,
  className,
  ariaInvalid,
}: {
  id?: string;
  value: number | null;
  onChange: (n: number | null) => void;
  unit: string;
  placeholder?: string;
  className?: string;
  ariaInvalid?: boolean;
}) {
  const [text, setText] = React.useState(value == null ? "" : String(value));
  // Follow outside changes (a loaded quote, Start over) without fighting the typing.
  const last = React.useRef(value);
  if (last.current !== value) {
    last.current = value;
    const parsed = text === "" ? null : Number(text);
    if (parsed !== value) setText(value == null ? "" : String(value));
  }
  return (
    <div className={cn("relative", className)}>
      <Input
        id={id}
        inputMode="decimal"
        autoComplete="off"
        placeholder={placeholder}
        aria-invalid={ariaInvalid || undefined}
        value={text}
        onChange={(e) => {
          const t = e.target.value.replace(/[^0-9.]/g, "").replace(/(\..*)\./g, "$1");
          setText(t);
          const n = t === "" || t === "." ? null : Number(t);
          last.current = n;
          onChange(n);
        }}
        className="pr-9 tabular-nums"
      />
      <span className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-xs text-subtle-foreground" aria-hidden>
        {unit}
      </span>
    </div>
  );
}

/** "+$19,500", "−$228", "$0". */
export const signed = (n: number, sign: "+" | "−" | "" = "+") => `${n === 0 ? "" : sign}${aud(n, { maximumFractionDigits: Number.isInteger(n) ? 0 : 2 })}`;

/** A label and a figure on one line, for breakdowns. */
export function FigureRow({
  label,
  sub,
  children,
  strong,
  className,
}: {
  label: React.ReactNode;
  sub?: React.ReactNode;
  children: React.ReactNode;
  strong?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("flex items-baseline gap-3 border-t border-hairline py-2 first:border-t-0", className)}>
      <div className="min-w-0 flex-1">
        <p className={cn(strong ? "text-sm font-semibold text-foreground" : "text-[13px] text-foreground")}>{label}</p>
        {sub ? <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p> : null}
      </div>
      <span className={cn("shrink-0 tabular-nums", strong ? "text-sm font-bold" : "text-[13px] font-medium")}>{children}</span>
    </div>
  );
}
