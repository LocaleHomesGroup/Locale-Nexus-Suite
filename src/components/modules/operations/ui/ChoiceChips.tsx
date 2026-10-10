"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { useJobReadOnly } from "../jobs/detail/read-only";

/**
 * A row of mutually exclusive pill toggles — the mockup's status / source /
 * buyer-type pickers. Selected = the dashboard's brand fill with its deep ink
 * (never the light fill as text on white); the rest are outline pills. Each is an `aria-pressed`
 * button inside a labelled group. Hover and press apply only while enabled; disabled (a live job's
 * cards sit in a disabled fieldset) they dim and show a not-allowed cursor. On a live job the dimming is
 * lighter (80%, not 60%): the chosen value is the page's data, not a control that is merely off.
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
  const readOnly = useJobReadOnly();
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
              "rounded-full border font-medium whitespace-nowrap transition-[background-color,border-color,color,transform] duration-150 focus-visible:ring-3 focus-visible:ring-ring/45 focus-visible:outline-none enabled:active:scale-[0.97] disabled:cursor-not-allowed",
              readOnly ? "disabled:opacity-80" : "disabled:opacity-60",
              size === "sm" ? "px-3 py-1 text-xs" : "px-3 py-1.5 text-xs",
              on
                ? "border-tone-fill bg-tone-fill text-tone-on-fill shadow-xs"
                : "border-border bg-card text-foreground enabled:hover:border-tone-line enabled:hover:bg-tone-soft/70 dark:bg-white/[0.03] dark:enabled:hover:bg-tone-soft",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
