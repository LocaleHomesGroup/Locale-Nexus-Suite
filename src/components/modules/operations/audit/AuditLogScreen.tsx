"use client";

import * as React from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useLaunchpad } from "@/state/launchpad-store";
import { useTabParam } from "@/hooks/useTabParam";
import { cn } from "@/lib/utils";
import { EASE_OUT, rowDelay } from "@/lib/motion";
import { PageHeader } from "@/components/ui/page";
import { Card, CardContent } from "@/components/ui/card";
import { SystemTag } from "@/components/ui/pill";
import { SlidingTabs } from "@/components/ui/sliding-tabs";
import { jobHref } from "../jobs/JobsTable";
import { AUDIT_DOT, AUDIT_GROUPS, AUDIT_GROUP_VALUES, AUDIT_TYPE_LABEL } from "./data";

const LINK =
  "rounded-sm font-medium text-tone-ink underline-offset-2 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/45";

/**
 * The audit log, as a person reads it: who, what changed, where it went, when.
 * Every write across every job, newest first — each job page shows only its
 * own share of it. The filter is in the URL (`?tab=audit&type=review`).
 */
export function AuditLogScreen() {
  const { activity, jobs } = useLaunchpad();
  const reduce = useReducedMotion();
  const [type, setType] = useTabParam(AUDIT_GROUP_VALUES, "all", "type");
  const group = AUDIT_GROUPS.find((g) => g.value === type) ?? AUDIT_GROUPS[0];
  const inGroup = (g: (typeof AUDIT_GROUPS)[number]) => (e: (typeof activity)[number]) => !g.types || g.types.includes(e.type);

  // Entries are prepended, so "distance from the oldest" is a stable key.
  const shown = activity.map((e, i) => ({ e, key: activity.length - i })).filter(({ e }) => inGroup(group)(e));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Audit log"
        description="Every write Launchpad has made: who did it, what changed, and where it went."
        actions={
          <span className="text-xs text-subtle-foreground tabular-nums">
            {activity.length} {activity.length === 1 ? "event" : "events"}
          </span>
        }
      />

      <div className="flex flex-col gap-2.5">
        <SlidingTabs
          value={type}
          onChange={setType}
          ariaLabel="Filter the audit log"
          items={AUDIT_GROUPS.map((g) => ({ value: g.value, label: g.label, count: activity.filter(inGroup(g)).length }))}
        />
        {type === "review" ? (
          <p className="max-w-[70ch] text-xs text-subtle-foreground">
            Every regression and every decision taken on one, as history. The queue itself — the changes still waiting
            on a person — is at{" "}
            <Link href="/operations?tab=review" className={LINK}>
              Review queue
            </Link>
            .
          </p>
        ) : null}
      </div>

      <Card>
        <CardContent className="pt-2 pb-2">
          {shown.length === 0 ? (
            <p className="py-4 text-xs text-subtle-foreground">
              No events of this kind yet. Every save through Launchpad writes one, alongside the change itself.
            </p>
          ) : (
            <ul>
              <AnimatePresence initial={false}>
                {shown.map(({ e, key }, i) => (
                  <motion.li
                    key={`${type}:${key}`}
                    layout="position"
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0, transition: { duration: reduce ? 0 : 0.24, ease: EASE_OUT, delay: rowDelay(i, reduce) } }}
                    exit={{ opacity: 0, transition: { duration: reduce ? 0 : 0.12 } }}
                    className="flex gap-3 border-t border-hairline py-3 first:border-t-0"
                  >
                    <span className={cn("mt-[6px] size-1.5 shrink-0 rounded-full", AUDIT_DOT[e.type])} aria-hidden />
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-semibold text-foreground">{e.action}</p>
                      {e.detail ? <p className="max-w-[90ch] text-xs leading-snug text-muted-foreground">{e.detail}</p> : null}
                      <div className="mt-1.5 flex flex-wrap items-center gap-x-1.5 gap-y-1">
                        {e.targets.map((t) => (
                          <SystemTag key={t}>{t}</SystemTag>
                        ))}
                        <span className="text-xs text-subtle-foreground">
                          {AUDIT_TYPE_LABEL[e.type]}
                          {(e.jobs ?? []).map((id) => {
                            const job = jobs.find((j) => j.id === id);
                            return (
                              <React.Fragment key={id}>
                                {" · "}
                                <Link href={jobHref(id)} className={LINK}>
                                  open {job?.jobNo ? `job ${job.jobNo}` : (job?.client ?? "the job")}
                                </Link>
                              </React.Fragment>
                            );
                          })}
                        </span>
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
        </CardContent>
      </Card>
    </div>
  );
}
