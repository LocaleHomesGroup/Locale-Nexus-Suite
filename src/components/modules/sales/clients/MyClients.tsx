"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Check, Circle } from "lucide-react";
import { useLaunchpad } from "@/state/launchpad-store";
import { cn } from "@/lib/utils";
import { EASE_OUT } from "@/lib/motion";
import { PageHeader } from "@/components/ui/page";
import { Card, CardContent, CardHeader, CardMeta, CardTitle } from "@/components/ui/card";
import { RateBar } from "@/components/ui/progress";
import { Reveal } from "@/components/ui/reveal";
import { CURRENT_REP } from "../data";
import { useSalesState } from "../sales-state";

/**
 * Sales › My clients — the signed-in rep's jobs from the shared store (so a
 * milestone synced in Operations moves the bar here), and their to-do list.
 * A card opens the job in Operations.
 */
export function MyClients() {
  const { jobs, openJob } = useLaunchpad();
  const { todos, setTodos } = useSalesState();
  const reduce = useReducedMotion();
  const mine = jobs.filter((j) => j.rep === CURRENT_REP);
  const done = todos.filter((t) => t.done).length;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="My clients" description="You only see clients assigned to you." />

      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {mine.map((j, i) => {
          const complete = j.milestones.filter((m) => m.status === "done").length;
          const total = j.milestones.length || 8;
          const building = j.board === "construction";
          const pct = building ? Math.round((complete / total) * 100) : 0;
          return (
            <Reveal as="li" key={j.id} index={i}>
              <button
                type="button"
                onClick={() => openJob(j.id)}
                className="group flex h-full w-full flex-col rounded-xl border border-border bg-card px-4 py-3.5 text-left shadow-sm transition-[transform,box-shadow,border-color] duration-200 ease-out hover:-translate-y-0.5 hover:border-tone-line hover:shadow-md focus-visible:ring-3 focus-visible:ring-ring/45 focus-visible:outline-none motion-reduce:transition-none motion-reduce:hover:translate-y-0"
              >
                <span className="flex items-baseline justify-between gap-2">
                  <span className="text-[13px] font-semibold">{j.client}</span>
                  <span
                    className={cn(
                      "shrink-0 text-xs text-muted-foreground",
                      j.jobNo ? "font-mono tabular-nums" : "italic",
                    )}
                  >
                    {j.jobNo || "Awaiting job no"}
                  </span>
                </span>
                <span className="mt-0.5 mb-2.5 text-xs text-muted-foreground">
                  {j.builder} · {building ? "Under construction" : "Preconstruction"}
                </span>
                <RateBar
                  value={pct / 100}
                  height="h-2"
                  delay={Math.min(i * 0.05, 0.3)}
                  label={building ? `${complete} of ${total} milestones` : "Awaiting site start"}
                  className="mt-auto"
                />
                <span className="mt-1.5 text-xs text-muted-foreground tabular-nums">
                  {building ? `${complete} of ${total} milestones` : "Awaiting site start"}
                </span>
              </button>
            </Reveal>
          );
        })}
      </ul>

      <Reveal index={mine.length}>
        <Card>
          <CardHeader>
            <CardTitle>To-dos</CardTitle>
            <CardMeta>
              {done} of {todos.length} done
            </CardMeta>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col">
              {todos.map((t, i) => (
                <li key={t.t}>
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={t.done}
                    onClick={() => setTodos((prev) => prev.map((x, xi) => (xi === i ? { ...x, done: !x.done } : x)))}
                    className="group flex w-full items-center gap-2.5 rounded-md py-1.5 text-left focus-visible:ring-3 focus-visible:ring-ring/45 focus-visible:outline-none"
                  >
                    <span className="relative flex size-4 shrink-0 items-center justify-center" aria-hidden>
                      <AnimatePresence initial={false} mode="popLayout">
                        {t.done ? (
                          <motion.span
                            key="done"
                            className="flex"
                            initial={{ scale: 0.4, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1, transition: { duration: 0.24, ease: EASE_OUT } }}
                            exit={{ opacity: 0, transition: { duration: 0.1 } }}
                          >
                            <Check className="size-3.5 text-emerald-600 dark:text-emerald-400" strokeWidth={2.5} />
                          </motion.span>
                        ) : (
                          <motion.span
                            key="open"
                            className="flex"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1, transition: { duration: 0.18 } }}
                            exit={{ opacity: 0, transition: { duration: 0.1 } }}
                          >
                            <Circle className="size-3.5 text-subtle-foreground group-hover:text-tone-ink" />
                          </motion.span>
                        )}
                      </AnimatePresence>
                    </span>
                    <span
                      className={cn(
                        "text-[13px] transition-colors",
                        t.done ? "text-subtle-foreground line-through" : "text-foreground",
                      )}
                    >
                      {t.t}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </Reveal>
    </div>
  );
}
