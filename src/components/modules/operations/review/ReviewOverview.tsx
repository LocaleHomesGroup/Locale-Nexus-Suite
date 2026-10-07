"use client";

import * as React from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { AlertTriangle, Ban, CheckCheck, Hourglass, Landmark, Users } from "lucide-react";
import type { ReviewItem } from "@/data/seed";
import { EASE_OUT, rowDelay } from "@/lib/motion";
import { KpiCard, KpiGrid } from "@/components/ui/kpi-card";
import { RateBar } from "@/components/ui/progress";
import { Pill } from "@/components/ui/pill";
import { Avatar } from "@/components/ui/avatar";
import { Ticker } from "@/components/ui/list-motion";
import { MONEY_MILESTONES } from "./review";
import { kindLabel } from "./parts";

/** "Yesterday, 16:20" reads mid-sentence as "yesterday, 16:20"; "3 Aug, 09:30" stays as it is. */
function inSentence(when: string): string {
  return when.replace(/^(Today|Yesterday|Just now)/, (w) => w.toLowerCase());
}

interface Tally {
  key: string;
  filed: number;
  waiting: number;
}

/** Filed and still-waiting counts per key, ranked by how many were filed. */
function tally(items: ReviewItem[], keyOf: (i: ReviewItem) => string, keys: string[] = []): Tally[] {
  const m = new Map<string, Tally>(keys.map((k) => [k, { key: k, filed: 0, waiting: 0 }]));
  for (const i of items) {
    const k = keyOf(i);
    const t = m.get(k) ?? { key: k, filed: 0, waiting: 0 };
    t.filed += 1;
    if (i.status === "pending") t.waiting += 1;
    m.set(k, t);
  }
  return [...m.values()];
}

/**
 * Review queue › Overview — HRIS's offboarding overview, for held changes: the
 * KPI row, then where they come from (which money milestone, who filed them).
 * Everything is counted live from the queue, so a release here moves the
 * figures at once.
 */
export function ReviewOverview({ items, staleCount }: { items: ReviewItem[]; staleCount: number }) {
  const waiting = items.filter((i) => i.status === "pending");
  const released = items.filter((i) => i.status === "accepted").length;
  const dismissed = items.filter((i) => i.status === "dismissed").length;
  const superseded = items.filter((i) => i.status === "superseded").length;
  // The queue is newest first, so the oldest waiting item is the last one.
  const oldest = waiting[waiting.length - 1];

  const byMilestone = tally(items, (i) => i.milestone, [...MONEY_MILESTONES]);
  const kindOf = new Map(items.map((i) => [i.milestone, kindLabel(i)]));
  const byPerson = tally(items, (i) => i.queuedBy).sort((a, b) => b.filed - a.filed || a.key.localeCompare(b.key));

  return (
    <div className="flex flex-col gap-4">
      <KpiGrid cols={4}>
        <KpiCard
          label="Waiting on a person"
          wrapLabel
          value={waiting.length}
          icon={Hourglass}
          tone="pending"
          sub={oldest ? `Oldest filed ${inSentence(oldest.queuedAt)}` : "Nothing waiting"}
        />
        <KpiCard
          label="Can only be dismissed"
          wrapLabel
          value={staleCount}
          icon={AlertTriangle}
          alert={staleCount > 0}
          tone="charcoal"
          sub={staleCount ? "Milestone moved since filing" : "None has moved since filing"}
        />
        <KpiCard label="Released" value={released} icon={CheckCheck} tone="ok" sub="Applied and synced" />
        <KpiCard
          label="Dismissed"
          value={dismissed}
          icon={Ban}
          tone="charcoal"
          sub={superseded ? `Plus ${superseded} superseded` : "Nothing changed anywhere"}
        />
      </KpiGrid>

      <div className="grid gap-4 lg:grid-cols-2">
        <Breakdown
          icon={Landmark}
          title="By milestone"
          meta={`${MONEY_MILESTONES.size} hold their changes`}
          rows={byMilestone}
          label={(t) => (
            <span className="flex min-w-0 flex-col">
              <span className="truncate">{t.key}</span>
              <span className="text-xs text-subtle-foreground">{kindOf.get(t.key) ?? "Money milestone"}</span>
            </span>
          )}
          footnote="Alison, at UAT on 26 August, added Settlement Confirmation and Plate Height to the two Shannan named on 12 August."
        />
        <Breakdown
          icon={Users}
          title="Filed by"
          meta={`${byPerson.length} ${byPerson.length === 1 ? "person" : "people"}`}
          rows={byPerson}
          label={(t) => (
            <span className="flex min-w-0 items-center gap-2">
              <Avatar name={t.key} size="xs" />
              <span className="truncate">{t.key}</span>
            </span>
          )}
        />
      </div>
    </div>
  );
}

/** One ranked list with a bar per row: how many were filed, and a chip for any still waiting. */
function Breakdown({
  icon: Icon,
  title,
  meta,
  rows,
  label,
  footnote,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  meta: string;
  rows: Tally[];
  label: (t: Tally) => React.ReactNode;
  footnote?: string;
}) {
  const reduce = useReducedMotion();
  const max = Math.max(1, ...rows.map((r) => r.filed));
  return (
    <section className="flex flex-col rounded-xl border border-border bg-card p-4 shadow-xs dark:bg-white/[0.02]">
      <header className="flex items-center gap-2">
        <Icon className="size-3.5 text-tone-ink" aria-hidden />
        <h3 className="text-[10px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">{title}</h3>
        <span className="ml-auto text-xs text-subtle-foreground tabular-nums">{meta}</span>
      </header>
      <ul className="mt-3 flex flex-col gap-2.5">
        <AnimatePresence initial={false}>
          {rows.map((t, i) => (
            <motion.li
              key={t.key}
              layout="position"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: reduce ? 0 : 0.28, ease: EASE_OUT, delay: rowDelay(i, reduce, 0.04) }}
              className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 text-[13px] sm:grid-cols-[minmax(0,1fr)_7rem_7.5rem]"
            >
              {label(t)}
              <RateBar
                value={t.filed / max}
                tone={t.waiting ? "pending" : "tone"}
                className="hidden sm:block"
                delay={rowDelay(i, reduce, 0.04)}
                label={`${t.filed} filed`}
              />
              <span className="flex items-center justify-end gap-1.5">
                {t.waiting ? (
                  <Pill tone="pending" className="px-2 py-0">
                    <Ticker value={t.waiting} /> waiting
                  </Pill>
                ) : null}
                <span className="w-5 text-right font-semibold tabular-nums">
                  <Ticker value={t.filed} />
                </span>
              </span>
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
      {footnote ? (
        <p className="mt-auto pt-4">
          <span className="block border-t border-hairline pt-3 text-xs leading-relaxed text-subtle-foreground">
            {footnote}
          </span>
        </p>
      ) : null}
    </section>
  );
}
