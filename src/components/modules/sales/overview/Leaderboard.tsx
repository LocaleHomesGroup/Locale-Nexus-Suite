"use client";

import * as React from "react";
import { motion, useReducedMotion } from "motion/react";
import { ArrowDownRight, ArrowUpRight, Crown, Flame, Medal, Sparkles } from "lucide-react";
import { aud, cn } from "@/lib/utils";
import { EASE_OUT, rowDelay } from "@/lib/motion";
import { Card, CardContent, CardHeader, CardMeta, CardTitle } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { Pill } from "@/components/ui/pill";
import { RateBar } from "@/components/ui/progress";
import { SlidingTabs, type TabItem } from "@/components/ui/sliding-tabs";
import { Dash, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { COMMISSION_PER_SALE } from "../progress/data";
import type { RankBy, RepStanding } from "../progress/standings";
import { Footnote } from "../parts";
import { kValue, plural } from "./format";

const RANK_BY: TabItem<RankBy>[] = [
  { value: "sales", label: "Sales" },
  { value: "value", label: "Value" },
];

/**
 * Sales Manager › Overview: every rep ranked for the period, on sales won or
 * the contract value they're worth. Each row has what they closed, its value
 * and commission, their target, their pace against the same point last
 * period, and their open pipeline. Re-ranking glides each row to its new place
 * (HRIS § 14); a row puts its rep in the spotlight.
 */
export function Leaderboard({
  rows,
  by,
  onBy,
  label,
  previous,
  spotlight,
  onSpotlight,
}: {
  rows: readonly RepStanding[];
  by: RankBy;
  onBy: (by: RankBy) => void;
  /** "August", "Jul to Sep", "2026". */
  label: string;
  /** "in July", "last quarter": what the pace compares against. */
  previous: string;
  spotlight: string | null;
  onSpotlight: (rep: string) => void;
}) {
  const reduce = useReducedMotion();
  const leader = Math.max(1, ...rows.map((r) => (by === "sales" ? r.sales : r.valueK)));
  const hasTarget = rows.some((r) => r.target.ratio !== null);

  return (
    <Card className="flex h-full min-w-0 flex-col">
      <CardHeader>
        <Medal className="size-4 text-tone-ink" aria-hidden />
        <CardTitle>Leaderboard</CardTitle>
        <span className="text-xs text-subtle-foreground">{label} to date</span>
        <CardMeta>
          <span className="hidden sm:inline">Rank by</span>
          <SlidingTabs value={by} onChange={onBy} items={RANK_BY} ariaLabel="Rank the board by" />
        </CardMeta>
      </CardHeader>
      <CardContent className="flex min-w-0 flex-1 flex-col gap-3">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent dark:hover:bg-transparent">
              <TableHead className="w-10 pl-0">#</TableHead>
              <TableHead>Rep</TableHead>
              <TableHead className="text-right">Sales</TableHead>
              <TableHead className="text-right">Contract value</TableHead>
              <TableHead className="text-right">Commission</TableHead>
              <TableHead>Target</TableHead>
              <TableHead>Pace</TableHead>
              <TableHead className="text-right">Open pipeline</TableHead>
              <TableHead className="pr-0">
                <span className="sr-only">Spotlight</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r, i) => {
              const on = spotlight === r.rep;
              const pace = r.sales - r.before;
              return (
                <motion.tr
                  key={r.rep}
                  layout="position"
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    duration: reduce ? 0 : 0.2,
                    ease: EASE_OUT,
                    delay: rowDelay(i, reduce),
                    layout: { duration: reduce ? 0 : 0.32, ease: EASE_OUT },
                  }}
                  data-state={on ? "selected" : undefined}
                  onClick={() => onSpotlight(r.rep)}
                  className="cursor-pointer border-b border-hairline transition-colors hover:bg-tone-soft/60 data-[state=selected]:bg-tone-soft dark:hover:bg-tone-soft/40"
                >
                  <TableCell className="pl-0">
                    <RankChip rank={r.rank} />
                  </TableCell>
                  <TableCell>
                    <span className="flex items-center gap-2.5">
                      <Avatar name={r.rep} size="sm" />
                      <span className="min-w-0">
                        <span className="block font-semibold whitespace-nowrap">{r.rep}</span>
                        <span className="flex items-center gap-1 text-xs whitespace-nowrap text-subtle-foreground">
                          {r.streak.months ? (
                            <>
                              <Flame className="size-3 text-amber-500" aria-hidden />
                              {r.streak.months}-month streak
                            </>
                          ) : (
                            "No streak running"
                          )}
                        </span>
                      </span>
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <span className="block text-sm font-bold tabular-nums">{r.sales}</span>
                    <RateBar
                      value={(by === "sales" ? r.sales : r.valueK) / leader}
                      height="h-1"
                      delay={Math.min(i * 0.06, 0.3)}
                      className="mt-1 ml-auto w-16"
                    />
                  </TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">{r.sales ? kValue(r.valueK) : <Dash />}</TableCell>
                  <TableCell className="text-right tabular-nums">{r.sales ? aud(r.commission) : <Dash />}</TableCell>
                  <TableCell>
                    {r.target.ratio === null ? (
                      <Dash />
                    ) : (
                      <span className="flex min-w-24 flex-col gap-1">
                        <span className={cn("text-xs tabular-nums", r.target.hit && "font-semibold text-emerald-700 dark:text-emerald-300")}>
                          {r.target.won} of {r.target.target}
                          {r.target.hit ? " · hit" : ""}
                        </span>
                        <RateBar value={r.target.ratio} tone={r.target.hit ? "ok" : "tone"} height="h-1" delay={Math.min(i * 0.06, 0.3)} />
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Pace delta={pace} before={r.before} previous={previous} />
                  </TableCell>
                  <TableCell className="text-right whitespace-nowrap tabular-nums">
                    {r.open ? (
                      <>
                        <span className="font-semibold">{kValue(r.openK)}</span>
                        <span className="block text-xs text-subtle-foreground">{plural(r.open, "deal")}</span>
                      </>
                    ) : (
                      <Dash />
                    )}
                  </TableCell>
                  <TableCell className="pr-0 text-right">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSpotlight(r.rep);
                      }}
                      aria-pressed={on}
                      aria-label={`Put ${r.rep} in the spotlight`}
                      className={cn(
                        "inline-flex size-7 items-center justify-center rounded-md transition-colors focus-visible:ring-3 focus-visible:ring-ring/45 focus-visible:outline-none",
                        on ? "bg-tone-fill text-tone-on-fill" : "text-subtle-foreground hover:bg-tone-soft hover:text-tone-ink",
                      )}
                    >
                      <Sparkles className="size-3.5" aria-hidden />
                    </button>
                  </TableCell>
                </motion.tr>
              );
            })}
          </TableBody>
        </Table>

        <div className="mt-auto flex flex-wrap items-center gap-2">
          <Pill tone="neutral">Placeholder rate</Pill>
          <Footnote>
            Contract value is each rep&apos;s average sale this quarter, from HubSpot. Commission is a flat{" "}
            {aud(COMMISSION_PER_SALE)} a sale until Alison Carter confirms the formula.{" "}
            {hasTarget ? "Targets are placeholders until Sean O'Neill sets them. " : ""}Pace is sales against the same
            point {previous}.
          </Footnote>
        </div>
      </CardContent>
    </Card>
  );
}

/** Gold for #1 (HRIS § 8.5: gold means rank), quiet numbers below it. */
export function RankChip({ rank }: { rank: number }) {
  return rank === 1 ? (
    <span
      className="flex size-7 items-center justify-center rounded-lg bg-gradient-to-br from-amber-400 to-amber-600 text-white shadow shadow-amber-700/20"
      title="Top of the board"
    >
      <Crown className="size-3.5" aria-hidden />
      <span className="sr-only">1</span>
    </span>
  ) : (
    <span className="flex size-7 items-center justify-center rounded-lg bg-muted text-xs font-bold text-muted-foreground tabular-nums">
      {rank}
    </span>
  );
}

/** Sales against the same point last period: up, level or down, never colour alone. */
function Pace({ delta, before, previous }: { delta: number; before: number; previous: string }) {
  const title = `${before} by this point ${previous}`;
  if (delta === 0)
    return (
      <span className="text-xs whitespace-nowrap text-muted-foreground" title={title}>
        Level
      </span>
    );
  const up = delta > 0;
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 text-xs font-semibold whitespace-nowrap tabular-nums",
        up ? "text-emerald-700 dark:text-emerald-300" : "text-amber-700 dark:text-amber-300",
      )}
      title={title}
    >
      <Icon className="size-3.5" aria-hidden />
      {up ? "+" : "−"}
      {Math.abs(delta)}
      <span className="sr-only"> on this point {previous}</span>
    </span>
  );
}
