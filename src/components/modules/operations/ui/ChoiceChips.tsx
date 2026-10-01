"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * A row of mutually exclusive pill toggles — the mockup's status / source /
 * buyer-type pickers. Selected = Haven fill with deep ink (never haven-300
 * text on white); the rest are outline pills. Each is an `aria-pressed`
 * button inside a labelled group.
 */
export function ChoiceChips<T extends string>({
  value,
  options,
  onChange,
  label,
  size = "md",
  className,
}: {
  value: T | "";
  options: readonly { value: T; label: React.ReactNode }[];
  onChange: (value: T) => void;
  /** Accessible group name. */
  label: string;
  size?: "sm" | "md";
  className?: string;
}) {
  return (
    <div role="group" aria-label={label} className={cn("flex flex-wrap gap-1.5", className)}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(o.value)}
            className={cn(
              "rounded-full border font-medium whitespace-nowrap transition-[background-color,border-color,color,transform] duration-150 focus-visible:ring-3 focus-visible:ring-ring/45 focus-visible:outline-none active:scale-[0.97]",
              size === "sm" ? "px-3 py-1 text-[11.5px]" : "px-3 py-1.5 text-xs",
              on
                ? "border-haven-300 bg-haven-300 text-haven-950 shadow-xs dark:border-haven-300 dark:bg-haven-300 dark:text-haven-950"
                : "border-border bg-card text-foreground hover:border-haven-300 hover:bg-haven-50/70 dark:bg-white/[0.03] dark:hover:border-haven-800 dark:hover:bg-haven-950/40",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
