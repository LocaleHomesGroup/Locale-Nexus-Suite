"use client";

import * as React from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Clock } from "lucide-react";
import type { ActivityEntry, ActivityType } from "@/data/seed";
import { cn } from "@/lib/utils";
import { EASE_OUT, rowDelay } from "@/lib/motion";
import { Card, CardContent, CardDescription, CardHeader, CardMeta, CardTitle } from "@/components/ui/card";
import { SystemTag } from "@/components/ui/pill";

const FILTERS: { value: "all" | ActivityType; label: string }[] = [
  { value: "all", label: "All" },
  { value: "milestone", label: "Milestones" },
  { value: "details", label: "Details" },
  { value: "invoice", label: "Invoicing" },
  { value: "import", label: "Imports" },
];

const DOT: Record<ActivityType, string> = {
  milestone: "bg-tone-strong",
  details: "bg-zinc-400 dark:bg-zinc-500",
  invoice: "bg-emerald-500 dark:bg-emerald-400",
  import: "bg-amber-400",
  conflict: "bg-rose-500 dark:bg-rose-400",
};

/**
 * Audit log (mockup `om`) — every write, what it changed and which systems it
 * landed in, newest first. New entries slide in at the top.
 */
export function AuditLog({ entries }: { entries: ActivityEntry[] }) {
  const reduce = useReducedMotion();
  const [filter, setFilter] = React.useState<"all" | ActivityType>("all");
  // Entries are prepended, so "distance from the oldest" is a stable key.
  const rows = entries
    .map((e, i) => ({ e, key: entries.length - i }))
    .filter(({ e }) => filter === "all" || e.type === filter);

  return (
    <Card>
      <CardHeader>
        <Clock className="size-4 text-tone-ink" aria-hidden />
        <CardTitle>Audit log</CardTitle>
        <CardMeta>
          {entries.length} {entries.length === 1 ? "event" : "events"}
        </CardMeta>
        <CardDescription>Every write to this job, what it changed and where it landed.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="mb-2.5 flex flex-wrap gap-1" role="group" aria-label="Filter audit log">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              aria-pressed={filter === f.value}
              onClick={() => setFilter(f.value)}
              className={cn(
                "rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors focus-visible:ring-3 focus-visible:ring-ring/45 focus-visible:outline-none",
                filter === f.value
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-muted-foreground hover:border-tone-line hover:text-foreground dark:bg-white/[0.03]",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="max-h-[340px] overflow-y-auto pr-1">
          {rows.length === 0 ? (
            <p className="py-2.5 text-xs text-subtle-foreground">
              {entries.length === 0
                ? "Nothing written to this job from Launchpad yet. Edits made here, from a portal update or a CSV land in this log."
                : "No events of this type yet."}
            </p>
          ) : (
            <ul>
              <AnimatePresence initial={false}>
                {rows.map(({ e, key }, i) => (
                  <motion.li
                    key={`${filter}:${key}`}
                    layout="position"
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0, transition: { duration: reduce ? 0 : 0.24, ease: EASE_OUT, delay: rowDelay(i, reduce) } }}
                    exit={{ opacity: 0, transition: { duration: reduce ? 0 : 0.12 } }}
                    className="flex gap-2.5 border-t border-hairline py-2 first:border-t-0"
                  >
                    <span className={cn("mt-[5px] size-1.5 shrink-0 rounded-full", DOT[e.type])} aria-hidden />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-foreground">{e.action}</p>
                      {e.detail ? <p className="text-xs leading-snug text-muted-foreground">{e.detail}</p> : null}
                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        {e.targets.map((t) => (
                          <SystemTag key={t}>{t}</SystemTag>
                        ))}
                        <span className="ml-auto text-xs whitespace-nowrap text-subtle-foreground tabular-nums">
                          {e.who} · {e.when}
                        </span>
                      </div>
                    </div>
                  </motion.li>
                ))}
              </AnimatePresence>
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
