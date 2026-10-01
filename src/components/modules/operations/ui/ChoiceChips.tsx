"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * A row of mutually exclusive pill toggles — the mockup's status / source /
 * buyer-type pickers. Selected = the dashboard's brand fill with its deep ink
 * (never the light fill as text on white); the rest are outline pills. Each is an `aria-pressed`
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
              size === "sm" ? "px-3 py-1 text-xs" : "px-3 py-1.5 text-xs",
              on
                ? "border-tone-fill bg-tone-fill text-tone-on-fill shadow-xs"
                : "border-border bg-card text-foreground hover:border-tone-line hover:bg-tone-soft/70 dark:bg-white/[0.03] dark:hover:bg-tone-soft",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
