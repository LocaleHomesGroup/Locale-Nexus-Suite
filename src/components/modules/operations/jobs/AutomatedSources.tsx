"use client";

import * as React from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Inbox } from "lucide-react";
import { useLaunchpad } from "@/state/launchpad-store";
import { cn } from "@/lib/utils";
import { EASE_OUT, rowDelay } from "@/lib/motion";
import { Card, CardContent, CardHeader, CardMeta, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useOperationsSync } from "../sync/OperationsSyncProvider";
import { AUTOMATED_SOURCES, SOURCE_LOG, type SourceHealth } from "./data";

const DOT: Record<SourceHealth, string> = {
  connected: "bg-emerald-500 dark:bg-emerald-400",
  building: "bg-amber-500 dark:bg-amber-400",
  manual: "bg-zinc-400 dark:bg-zinc-500",
};

/**
 * Automated sources — which builder portals are wired in, the updates they
 * found that are waiting for a human, and the latest poll results.
 */
export function AutomatedSources() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Automated sources</CardTitle>
        <CardMeta>Builder portals polled every 30 min</CardMeta>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <ul className="flex flex-wrap gap-2" aria-label="Builder portal adapters">
          {AUTOMATED_SOURCES.map((s) => (
            <li
              key={s.builder}
              className="inline-flex items-center gap-1.5 rounded-full border border-hairline bg-canvas px-3 py-1 text-[11px] dark:bg-white/[0.03]"
            >
              <span className={cn("size-[7px] shrink-0 rounded-full", DOT[s.health])} aria-hidden />
              <span className="font-semibold">{s.builder}</span>
              <span className="text-muted-foreground">{s.status}</span>
            </li>
          ))}
        </ul>

        <PortalInbox />

        <ul className="border-t border-hairline pt-2">
          {SOURCE_LOG.map((l) => (
            <li key={l.text} className="flex gap-2.5 py-1 text-xs">
              <span className="w-16 shrink-0 whitespace-nowrap text-subtle-foreground tabular-nums">{l.when}</span>
              <span className="min-w-0 text-foreground/85">{l.text}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

/** Portal and email updates the adapters found. Nothing syncs until someone accepts it. */
function PortalInbox() {
  const { portalUpdates } = useLaunchpad();
  const { acceptPortalUpdate, dismissPortalUpdate } = useOperationsSync();
  const reduce = useReducedMotion();
  const n = portalUpdates.length;

  return (
    <AnimatePresence initial={false}>
      {n > 0 ? (
        <motion.section
          key="inbox"
          aria-label="Portal updates awaiting review"
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, transition: { duration: reduce ? 0 : 0.16 } }}
          transition={{ duration: reduce ? 0 : 0.24, ease: EASE_OUT }}
          className="pulse-haven rounded-lg border border-haven-300 bg-haven-50 px-3.5 py-2.5 dark:border-haven-800 dark:bg-haven-950/40"
        >
          <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-foreground">
            <Inbox className="size-3.5 text-haven-700 dark:text-haven-300" aria-hidden />
            <span className="tabular-nums">
              {n} portal update{n > 1 ? "s" : ""} awaiting review · nothing syncs until a human approves
            </span>
          </p>
          <ul>
            <AnimatePresence initial={false}>
              {portalUpdates.map((u, i) => (
                <motion.li
                  key={u.id}
                  layout="position"
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0, transition: { duration: reduce ? 0 : 0.2, ease: EASE_OUT, delay: rowDelay(i, reduce) } }}
                  exit={{ opacity: 0, x: reduce ? 0 : -14, transition: { duration: reduce ? 0 : 0.14 } }}
                  className="flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-haven-200/70 py-2 dark:border-haven-900/60"
                >
                  <div className="min-w-0 flex-1 basis-64 text-xs">
                    <p className="leading-snug">
                      <span className="font-semibold">
                        {u.jobNo ? <span className="font-mono text-[11px]">{u.jobNo}</span> : "No job no"} · {u.client}
                      </span>
                      <span className="text-muted-foreground">
                        {u.kind === "move"
                          ? ` · ${u.milestone} (${u.date}) — proposes move to construction`
                          : ` · ${u.milestone} completed ${u.date}`}
                      </span>
                    </p>
                    <p className="mt-0.5 text-[10.5px] text-subtle-foreground">{u.source}</p>
                  </div>
                  <div className="ml-auto flex shrink-0 gap-1.5">
                    <Button size="sm" onClick={() => acceptPortalUpdate(u)}>
                      {u.kind === "move" ? "Accept and move" : "Accept and sync"}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => dismissPortalUpdate(u.id)}>
                      Dismiss
                    </Button>
                  </div>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        </motion.section>
      ) : null}
    </AnimatePresence>
  );
}
