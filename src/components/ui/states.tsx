"use client";

import * as React from "react";
import { motion, useReducedMotion } from "motion/react";
import { AlertTriangle, SearchX, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { EASE_OUT } from "@/lib/motion";
import { Button } from "./button";

/**
 * Empty / no-matches / error — three states, never merged (HRIS § 12).
 */

/** Success-shaped empty: "All clear", "Inbox zero". Haven sparkle tile. */
export function EmptyState({
  title,
  description,
  icon: Icon = Sparkles,
  action,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
  action?: React.ReactNode;
  className?: string;
}) {
  const reduce = useReducedMotion();
  return (
    <div className={cn("flex flex-col items-center justify-center px-6 py-12 text-center", className)}>
      <motion.div
        className="mb-3 flex size-12 items-center justify-center rounded-2xl border border-tone-line bg-tone-soft text-tone-ink"
        initial={{ scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: reduce ? 0 : 0.4, ease: EASE_OUT }}
      >
        <Icon className="size-6" />
      </motion.div>
      <h3 className="text-sm font-semibold">{title}</h3>
      {description ? <p className="mt-1 max-w-sm text-xs text-muted-foreground">{description}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

/** Filter-shaped empty: the query in mono + a Clear pill. */
export function NoMatches({ query, onClear, className }: { query: string; onClear: () => void; className?: string }) {
  return (
    <div className={cn("flex flex-col items-center justify-center px-6 py-12 text-center", className)}>
      <div className="mb-3 flex size-12 items-center justify-center rounded-2xl border border-border bg-muted text-muted-foreground">
        <SearchX className="size-6" />
      </div>
      <h3 className="text-sm font-semibold">No matches</h3>
      <p className="mt-1.5 text-xs text-muted-foreground">
        Nothing matches{" "}
        <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-foreground">{query}</span>
      </p>
      <Button variant="outline" size="sm" className="mt-4 rounded-full" onClick={onClear}>
        Clear search
      </Button>
    </div>
  );
}

/** Error — always show the actual message, not a friendly rewrite. */
export function ErrorState({
  title,
  message,
  onBack,
  className,
}: {
  title: React.ReactNode;
  message: React.ReactNode;
  onBack?: () => void;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-3 px-6 py-12 text-center", className)}>
      <div className="flex size-12 items-center justify-center rounded-2xl border border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">
        <AlertTriangle className="size-6" />
      </div>
      <h2 className="text-base font-semibold">{title}</h2>
      <p className="max-w-md text-xs text-muted-foreground">{message}</p>
      {onBack ? (
        <Button variant="outline" size="sm" onClick={onBack}>
          Back
        </Button>
      ) : null}
    </div>
  );
}

/** Shimmer skeleton block. Size it with className. */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton-shimmer rounded-md", className)} aria-hidden />;
}
