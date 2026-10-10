import * as React from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface Crumb {
  label: React.ReactNode;
  /** Where the step goes back to. The last step is the page you're on and takes none. */
  href?: string;
  icon?: LucideIcon;
}

/**
 * Breadcrumb — HRIS's editorial trail (§ 3.2.1): the section's icon, then each
 * step with a "/" between. Every step but the last links back; the last is
 * where you are, and truncates first on a narrow screen.
 *
 *   <Breadcrumb items={[{ label: "All clients", href: "/sales?tab=clients", icon: Users }, { label: client }]} />
 */
export function Breadcrumb({ items, className }: { items: Crumb[]; className?: string }) {
  return (
    <nav aria-label="Breadcrumb" className={cn("min-w-0 text-xs", className)}>
      <ol className="flex min-w-0 items-center gap-1.5">
        {items.map((c, i) => {
          const last = i === items.length - 1;
          const Icon = c.icon;
          const body = (
            <>
              {Icon ? <Icon className="size-3.5 shrink-0 text-tone-ink" aria-hidden /> : null}
              <span className="truncate">{c.label}</span>
            </>
          );
          return (
            <li key={i} className={cn("flex items-center gap-1.5", last ? "min-w-0" : "shrink-0")}>
              {i > 0 ? (
                <span aria-hidden className="text-subtle-foreground/60">
                  /
                </span>
              ) : null}
              {last || !c.href ? (
                <span
                  aria-current={last ? "page" : undefined}
                  className={cn("flex min-w-0 items-center gap-1.5", last ? "font-medium text-foreground" : "text-muted-foreground")}
                >
                  {body}
                </span>
              ) : (
                <Link
                  href={c.href}
                  className="flex items-center gap-1.5 rounded-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/45 focus-visible:outline-none"
                >
                  {body}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
