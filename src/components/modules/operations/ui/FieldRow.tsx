"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * A label-left / value-right row on the job page's detail cards, hairline
 * between rows. `FieldRow` takes any value node; `InlineInput` is the
 * mockup's borderless right-aligned input that tints on hover and focus so an
 * editable card still reads like a record, not a form.
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
    return (
      <input
        ref={ref}
        type="text"
        className={cn(
          "h-7 min-w-0 flex-1 rounded-md bg-transparent px-1.5 text-right text-[13px] font-medium text-foreground outline-none transition-colors placeholder:font-normal placeholder:text-subtle-foreground hover:bg-muted/60 focus-visible:bg-muted focus-visible:ring-2 focus-visible:ring-ring/45",
          className,
        )}
        {...props}
      />
    );
  },
);
