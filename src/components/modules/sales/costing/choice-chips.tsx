"use client";

import * as React from "react";
import { motion, useReducedMotion } from "motion/react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { DURATION, EASE_SWAP } from "@/lib/motion";

/**
 * Choice chips — the mockup's rounded option buttons (`qe` in Rapid costing,
 * the builder picker in New deal submission).
 *
 *   <ChoiceGroup label="Builder" value={builder} onChange={setBuilder} options={BUILDERS} />
 *   <ToggleChip on={coastal} onClick={() => setCoastal(!coastal)}>Coastal, under 1km</ToggleChip>
 *
 * A single-choice group moves ONE Haven fill between chips via a shared
 * `layoutId` (the HRIS § 11.1 sliding-indicator mechanism), so the selection
 * glides rather than blinking. Each chip is a toggle button (`aria-pressed`).
 */

const CHIP_BASE =
  "relative isolate inline-flex items-center gap-1 rounded-full border whitespace-nowrap transition-colors duration-150 focus-visible:ring-3 focus-visible:ring-ring/45 focus-visible:outline-none";

const CHIP_SIZE = {
  sm: "px-3 py-1 text-[11.5px]",
  md: "px-3.5 py-1.5 text-xs",
} as const;

const CHIP_OFF =
  "border-border bg-card text-foreground hover:border-haven-300 hover:bg-haven-50/70 dark:bg-white/[0.03] dark:hover:border-haven-800 dark:hover:bg-haven-950/40";

export function ChoiceGroup<T extends string>({
  label,
  value,
  onChange,
  options,
  size = "sm",
  className,
  labelClassName,
}: {
  label: string;
  value: T;
  onChange: (value: T) => void;
  options: readonly T[];
  size?: keyof typeof CHIP_SIZE;
  className?: string;
  labelClassName?: string;
}) {
  const reduce = useReducedMotion();
  const id = React.useId();
  return (
    <div className={className}>
      <p id={`${id}-label`} className={cn("mb-1.5 text-[11px] text-muted-foreground", labelClassName)}>
        {label}
      </p>
      <div role="group" aria-labelledby={`${id}-label`} className="flex flex-wrap gap-1.5">
        {options.map((opt) => {
          const on = opt === value;
          return (
            <button
              key={opt}
              type="button"
              aria-pressed={on}
              onClick={() => onChange(opt)}
              className={cn(
                CHIP_BASE,
                CHIP_SIZE[size],
                on ? "border-transparent font-medium text-haven-950" : CHIP_OFF,
              )}
            >
              {on ? (
                <motion.span
                  layoutId={`${id}-fill`}
                  aria-hidden
                  className="absolute -inset-px -z-10 rounded-full bg-haven-300 shadow-sm shadow-haven-600/15"
                  transition={{ duration: reduce ? 0 : DURATION.indicator, ease: EASE_SWAP }}
                />
              ) : null}
              {opt}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** An independent on/off chip (multi-select). The tick keeps state readable without colour. */
export function ToggleChip({
  on,
  onClick,
  children,
  size = "sm",
}: {
  on: boolean;
  onClick: () => void;
  children: React.ReactNode;
  size?: keyof typeof CHIP_SIZE;
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={cn(
        CHIP_BASE,
        CHIP_SIZE[size],
        on
          ? "border-haven-300 bg-haven-300 font-medium text-haven-950 shadow-sm shadow-haven-600/15 hover:bg-haven-200 dark:border-haven-300"
          : CHIP_OFF,
      )}
    >
      {on ? <Check className="size-3" aria-hidden /> : null}
      {children}
    </button>
  );
}
