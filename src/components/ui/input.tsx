"use client";

import * as React from "react";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

const FIELD =
  "w-full min-w-0 rounded-lg border border-input bg-card px-2.5 text-sm text-foreground shadow-xs outline-none placeholder:text-subtle-foreground focus-visible:border-tone-strong focus-visible:ring-3 focus-visible:ring-tone-line/45 disabled:cursor-not-allowed disabled:opacity-60 aria-invalid:border-rose-400 aria-invalid:ring-rose-200/50 dark:bg-white/[0.03]";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, type = "text", ...props }, ref) {
    return <input ref={ref} type={type} className={cn(FIELD, "h-8 py-1", className)} {...props} />;
  },
);

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, rows = 3, ...props }, ref) {
    return <textarea ref={ref} rows={rows} className={cn(FIELD, "py-2 leading-relaxed", className)} {...props} />;
  },
);

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  // eslint-disable-next-line jsx-a11y/label-has-associated-control
  return <label className={cn("text-xs font-medium text-muted-foreground", className)} {...props} />;
}

/** Label + control + optional hint, stacked (HRIS § 9.1 field group). */
export function Field({
  label,
  htmlFor,
  hint,
  className,
  children,
}: {
  label: React.ReactNode;
  htmlFor?: string;
  hint?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint ? <p className="text-xs text-subtle-foreground">{hint}</p> : null}
    </div>
  );
}

/**
 * SearchInput — HRIS § 9.2 compact search: leading icon, a result count once
 * there is a query, and a clear button. `size="lg"` is the Home hero search.
 */
export function SearchInput({
  value,
  onChange,
  placeholder = "Search…",
  count,
  size = "md",
  className,
  ...rest
}: Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "value" | "size"> & {
  value: string;
  onChange: (v: string) => void;
  /** Result count to show while a query is active. */
  count?: number;
  size?: "md" | "lg";
}) {
  const has = value.trim().length > 0;
  return (
    <div className={cn("relative w-full", size === "md" && "max-w-sm", className)}>
      <Search
        className={cn(
          "pointer-events-none absolute top-1/2 -translate-y-1/2 text-subtle-foreground",
          size === "lg" ? "left-3.5 size-4" : "left-2.5 size-3.5",
        )}
        aria-hidden
      />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={cn(
          FIELD,
          "[&::-webkit-search-cancel-button]:hidden",
          size === "lg" ? "h-11 rounded-xl pr-24 pl-10 text-sm shadow-sm" : "h-8 pr-20 pl-8 text-xs",
        )}
        {...rest}
      />
      {has ? (
        <div className="absolute top-1/2 right-1.5 flex -translate-y-1/2 items-center gap-1">
          {count != null ? (
            <span className="rounded-full bg-muted px-1.5 py-px font-mono text-xs text-muted-foreground tabular-nums">
              {count}
            </span>
          ) : null}
          <button
            type="button"
            onClick={() => onChange("")}
            aria-label="Clear search"
            className="flex size-6 items-center justify-center rounded-md text-subtle-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="size-3.5" />
          </button>
        </div>
      ) : null}
    </div>
  );
}

/** Switch — a labelled on/off toggle (role="switch"). */
export function Switch({
  checked,
  onCheckedChange,
  label,
  className,
  disabled,
}: {
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
  label?: string;
  className?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        "relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border border-transparent transition-colors focus-visible:ring-3 focus-visible:ring-ring/45 focus-visible:outline-none disabled:opacity-50",
        checked ? "bg-tone-strong" : "bg-zinc-300 dark:bg-zinc-700",
        className,
      )}
    >
      <span
        className={cn(
          "inline-block size-4 rounded-full bg-white shadow-sm transition-transform duration-200 ease-out",
          checked ? "translate-x-4" : "translate-x-0.5",
        )}
      />
    </button>
  );
}

/** Checkbox — native input restyled so labels and forms keep working. */
export const Checkbox = React.forwardRef<HTMLInputElement, Omit<React.InputHTMLAttributes<HTMLInputElement>, "type">>(
  function Checkbox({ className, ...props }, ref) {
    return (
      <input
        ref={ref}
        type="checkbox"
        className={cn(
          "size-4 shrink-0 cursor-pointer rounded border-input accent-tone-strong focus-visible:ring-3 focus-visible:ring-ring/45 focus-visible:outline-none",
          className,
        )}
        {...props}
      />
    );
  },
);
