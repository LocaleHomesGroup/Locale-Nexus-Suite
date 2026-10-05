"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Check, HardHat } from "lucide-react";
import { cn } from "@/lib/utils";
import { DURATION, EASE_OUT, rowDelay } from "@/lib/motion";
import { CONSTRUCTION_MILESTONES } from "@/data/jobs";
import { journeyFor } from "@/data/journey";
import { usePortal } from "@/state/portal-store";
import { PageHeader } from "@/components/ui/page";
import { Card, CardContent, CardDescription, CardHeader, CardMeta, CardTitle } from "@/components/ui/card";
import { RateBar } from "@/components/ui/progress";
import { Pill } from "@/components/ui/pill";
import { Reveal } from "@/components/ui/reveal";
import { EmptyState } from "@/components/ui/states";
import { MilestoneRow, PhotoStrip, When, lotLine, useClientJob } from "./parts";

/**
 * Client › My build — the part of the journey where, as the meeting put it,
 * "we kind of let go of them". Not any more: the eight build milestones come
 * straight from the job (so a milestone Operations syncs shows here at once),
 * and the builder's site updates arrive from the Developer portal, photos and
 * all, instead of waiting for a phone call.
 */
export function MyBuild() {
  const reduce = useReducedMotion();
  const { job, lot } = useClientJob();
  const { updates } = usePortal();
  const mine = updates.filter((u) => u.jobId === job.id);
  const steps = CONSTRUCTION_MILESTONES.map(
    (name) => job.milestones.find((m) => m.name === name) ?? { name, status: "open" as const, date: "" },
  );
  const done = steps.filter((m) => m.status === "done").length;
  const nextAt = steps.findIndex((m) => m.status !== "done" && m.status !== "na");
  const before = journeyFor(job).filter((s) => s.id === "operations" || s.id === "precon");

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="My build"
        description={
          <>
            {lot.design}, {lot.type.toLowerCase()}, {lot.size}, at {lotLine(lot)}. Straight from {job.builder}&rsquo;s
            site updates, so you&rsquo;re never waiting on a phone call.
          </>
        }
      />

      <Reveal index={0}>
        <Card>
          <CardHeader>
            <CardTitle>Build milestones</CardTitle>
            <CardMeta>
              {done} of {steps.length} reached
            </CardMeta>
          </CardHeader>
          <CardContent className="pb-5">
            <RateBar
              value={done / steps.length}
              height="h-2"
              label={`${done} of ${steps.length} build milestones reached`}
            />
            <ol className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4 2xl:grid-cols-8">
              {steps.map((m, i) => {
                const reached = m.status === "done";
                const next = i === nextAt;
                return (
                  <li
                    key={m.name}
                    aria-current={next ? "step" : undefined}
                    className={cn(
                      "rounded-lg border px-3 py-2.5",
                      reached
                        ? "border-emerald-200 bg-emerald-50/60 dark:border-emerald-500/25 dark:bg-emerald-500/10"
                        : next
                          ? "border-tone-line bg-tone-soft/60"
                          : "border-dashed border-border",
                    )}
                  >
                    <div className="flex items-center gap-1.5">
                      {reached ? (
                        <Check
                          className="size-3.5 text-emerald-700 dark:text-emerald-300"
                          strokeWidth={3}
                          aria-hidden
                        />
                      ) : (
                        <span className="text-[10px] font-semibold text-subtle-foreground tabular-nums">{i + 1}</span>
                      )}
                      <span
                        className={cn("truncate text-[13px] font-medium", !reached && !next && "text-muted-foreground")}
                      >
                        {m.name}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground tabular-nums">
                      {reached
                        ? m.date || "Done"
                        : m.status === "pendingDate"
                          ? "Awaiting date"
                          : next
                            ? "Next"
                            : "To come"}
                    </p>
                  </li>
                );
              })}
            </ol>
          </CardContent>
        </Card>
      </Reveal>

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,380px)]">
        <Reveal index={1} className="min-w-0">
          <Card>
            <CardHeader>
              <CardTitle>Site updates from {job.builder}</CardTitle>
              <CardMeta>{mine.length}</CardMeta>
              <CardDescription>Posted by your builder at each stage, newest first.</CardDescription>
            </CardHeader>
            <CardContent>
              {mine.length === 0 ? (
                <EmptyState
                  icon={HardHat}
                  title="No site updates yet"
                  description={`${job.builder} posts an update with photos at each stage, starting at site start.`}
                />
              ) : (
                <ul>
                  <AnimatePresence initial={false}>
                    {mine.map((u, i) => (
                      <motion.li
                        key={u.id}
                        layout="position"
                        initial={{ opacity: 0, y: -6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{
                          duration: reduce ? 0 : DURATION.fade,
                          ease: EASE_OUT,
                          delay: rowDelay(i, reduce),
                        }}
                        className="border-t border-hairline py-3.5 first:border-t-0 first:pt-1"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <Pill tone="tone">{u.milestone}</Pill>
                          {u.fresh ? <Pill tone="ok">New</Pill> : null}
                          <span className="ml-auto">
                            <When>{u.when}</When>
                          </span>
                        </div>
                        <p className="mt-2 max-w-[70ch] text-[13px] leading-relaxed">{u.note}</p>
                        <PhotoStrip count={u.photos} label={`${u.milestone} at ${lot.lot}`} />
                        <p className="mt-2 text-xs text-subtle-foreground">
                          {u.builder} · site supervisor{u.photos ? ` · ${u.photos} photos` : ""}
                        </p>
                      </motion.li>
                    ))}
                  </AnimatePresence>
                </ul>
              )}
            </CardContent>
          </Card>
        </Reveal>

        <Reveal index={2} className="min-w-0">
          <Card>
            <CardHeader>
              <CardTitle>Before the build</CardTitle>
              <CardDescription>
                The paperwork Locale and {job.builder} finished so the first sod could turn.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {before.map((s) => (
                <div key={s.id} className="border-t border-hairline pt-2.5 pb-1 first:border-t-0 first:pt-0">
                  <p className="text-[10px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
                    {s.id === "operations" ? s.label : `${s.label} · ${s.who}`}
                  </p>
                  <ul className="mt-1">
                    {s.milestones.map((m) => (
                      <MilestoneRow key={m.name} m={m} next={false} />
                    ))}
                  </ul>
                </div>
              ))}
            </CardContent>
          </Card>
        </Reveal>
      </div>
    </div>
  );
}
