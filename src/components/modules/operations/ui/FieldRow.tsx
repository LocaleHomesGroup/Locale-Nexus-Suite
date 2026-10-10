"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { useJobReadOnly } from "../jobs/detail/read-only";

/**
 * A label-left / value-right row on the job page's detail cards, hairline
 * between rows. `FieldRow` takes any value node; `InlineInput` is the
 * mockup's borderless right-aligned input that tints on hover and focus so an
 * editable card still reads like a record, not a form. Hover applies only while enabled; disabled
 * (a live job's cards sit in a disabled fieldset) it dims and shows a not-allowed cursor. On a live job
 * the dimming is lighter (80%, not 60%): those values are the page's data, not a control that is merely off.
 */
export function FieldRow({
  label,
  htmlFor,
  children,
  className,
}: {
  label: React.ReactNode;
  htmlFor?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex min-h-9 items-center justify-between gap-4 border-b border-hairline py-1 text-[13px] last:border-b-0",
        className,
      )}
    >
      {htmlFor ? (
        <label htmlFor={htmlFor} className="shrink-0 whitespace-nowrap text-muted-foreground">
          {label}
        </label>
      ) : (
        <span className="shrink-0 whitespace-nowrap text-muted-foreground">{label}</span>
      )}
      {children}
    </div>
  );
}

export const InlineInput = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function InlineInput({ className, ...props }, ref) {
    const readOnly = useJobReadOnly();
    return (
      <input
        ref={ref}
        type="text"
        // Hover tints an enabled input only: `disabled:hover:bg-transparent` cancels it. Not `enabled:hover:`,
        // because `:enabled` would out-rank `focus-visible:bg-muted` and change a hovered, focused input.
        className={cn(
          "h-7 min-w-0 flex-1 rounded-md bg-transparent px-1.5 text-right text-[13px] font-medium text-foreground outline-none transition-colors placeholder:font-normal placeholder:text-subtle-foreground hover:bg-muted/60 focus-visible:bg-muted focus-visible:ring-2 focus-visible:ring-ring/45 disabled:cursor-not-allowed",
          readOnly ? "disabled:opacity-80" : "disabled:opacity-60",
          "disabled:hover:bg-transparent",
          className,
        )}
        {...props}
      />
    );
  },
);
