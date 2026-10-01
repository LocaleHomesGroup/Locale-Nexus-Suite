import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Table — HRIS § 5.1, for genuinely tabular content. Wide tables scroll inside
 * their container, never the page — give the parent `min-w-0`. Column heads use
 * the app-wide tiny caps. Money / counts: `text-right tabular-nums`. An empty
 * cell is a dim "—", never 0.
 */
export function Table({ className, ...props }: React.TableHTMLAttributes<HTMLTableElement>) {
  return (
    <div className="relative w-full overflow-x-auto">
      <table className={cn("w-full caption-bottom text-[13px]", className)} {...props} />
    </div>
  );
}

export function TableHeader({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <thead className={cn("[&_tr]:border-b [&_tr]:border-border", className)} {...props} />;
}

export function TableBody({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={cn("[&_tr:last-child]:border-0", className)} {...props} />;
}

export function TableRow({ className, ...props }: React.HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr
      className={cn(
        "border-b border-hairline transition-colors hover:bg-tone-soft/60 data-[state=selected]:bg-tone-soft dark:hover:bg-tone-soft/40",
        className,
      )}
      {...props}
    />
  );
}

export function TableHead({ className, ...props }: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={cn(
        "h-9 px-3 text-left align-middle text-[10px] font-semibold tracking-[0.12em] whitespace-nowrap text-muted-foreground uppercase",
        className,
      )}
      {...props}
    />
  );
}

export function TableCell({ className, ...props }: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={cn("px-3 py-2.5 align-middle", className)} {...props} />;
}

/** The empty-cell convention. */
export function Dash() {
  return <span className="text-subtle-foreground/70">—</span>;
}
