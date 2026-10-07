"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Check, Circle, Flag, Users } from "lucide-react";
import { useLaunchpad } from "@/state/launchpad-store";
import { cn } from "@/lib/utils";
import { EASE_OUT, rowDelay } from "@/lib/motion";
import type { Job } from "@/data/jobs";
import { PageHeader } from "@/components/ui/page";
import { Card, CardContent, CardHeader, CardMeta, CardTitle } from "@/components/ui/card";
import { RateBar } from "@/components/ui/progress";
import { Reveal } from "@/components/ui/reveal";
import { Avatar } from "@/components/ui/avatar";
import { EmptyState } from "@/components/ui/states";
import { REPS } from "../data";
import { scopeRep, useSalesScope, useSalesState } from "../sales-state";
import { groupByRep } from "./group-by-rep";

/**
 * Clients: the jobs from the shared store, so a milestone synced in
 * Operations moves the bar here. A card opens the job in Operations.
 *
 * In the Sales portal it's one rep's My clients: their jobs, their to-dos and
 * the tasks their manager set them. On the Sales dashboard it's the team's
 * Clients: every rep's jobs, grouped by rep.
 */
export function MyClients() {
  const rep = scopeRep(useSalesScope());
  return rep ? <RepClients rep={rep} /> : <TeamClients />;
}

function RepClients({ rep }: { rep: string }) {
  const { jobs, openJob } = useLaunchpad();
  const mine = jobs.filter((j) => j.rep === rep);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="My clients" description="You only see clients assigned to you." />
      {mine.length ? (
        <ClientGrid jobs={mine} onOpen={openJob} />
      ) : (
        <EmptyState
          icon={Users}
          title="No clients yet"
          description="Your won deals become clients here once CRM Dash Sync creates the job."
          className="rounded-xl border border-dashed border-border"
        />
      )}
      <div className="grid items-start gap-5 lg:grid-cols-2">
        <Reveal index={mine.length} className="min-w-0">
          <TodosCard />
        </Reveal>
        <Reveal index={mine.length + 1} className="min-w-0">
          <TasksCard rep={rep} />
        </Reveal>
      </div>
    </div>
  );
}

function TeamClients() {
  const { jobs, openJob } = useLaunchpad();
  const groups = groupByRep(jobs, REPS);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Clients" description="Every rep's clients in preconstruction and construction." />
      {groups.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No clients yet"
          description="Won deals become clients here once CRM Dash Sync creates the job."
          className="rounded-xl border border-dashed border-border"
        />
      ) : null}
      {groups.map((g, gi) => (
        <Reveal as="section" key={g.rep} index={gi} className="flex flex-col gap-3">
          <h2 className="flex items-center gap-2 text-[13px] font-semibold">
            <Avatar name={g.rep} size="xs" />
            {g.rep}
            <span className="font-normal text-muted-foreground tabular-nums">
              · {g.jobs.length} {g.jobs.length === 1 ? "client" : "clients"}
            </span>
          </h2>
          <ClientGrid jobs={g.jobs} onOpen={openJob} />
        </Reveal>
      ))}
    </div>
  );
}

function ClientGrid({ jobs, onOpen }: { jobs: Job[]; onOpen: (id: number) => void }) {
  return (
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {jobs.map((j, i) => {
        const complete = j.milestones.filter((m) => m.status === "done").length;
        const total = j.milestones.length || 8;
        const building = j.board === "construction";
        const pct = building ? Math.round((complete / total) * 100) : 0;
        return (
          <Reveal as="li" key={j.id} index={i}>
            <button
              type="button"
              onClick={() => onOpen(j.id)}
              className="group flex h-full w-full flex-col rounded-xl border border-border bg-card px-4 py-3.5 text-left shadow-sm transition-[transform,box-shadow,border-color] duration-200 ease-out hover:-translate-y-0.5 hover:border-tone-line hover:shadow-md focus-visible:ring-3 focus-visible:ring-ring/45 focus-visible:outline-none motion-reduce:transition-none motion-reduce:hover:translate-y-0"
            >
              <span className="flex items-baseline justify-between gap-2">
                <span className="text-[13px] font-semibold">{j.client}</span>
                <span className={cn("shrink-0 text-xs text-muted-foreground", j.jobNo ? "font-mono tabular-nums" : "italic")}>
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
  );
}

function TodosCard() {
  const { todos, setTodos } = useSalesState();
  const done = todos.filter((t) => t.done).length;

  return (
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
  );
}

/** The tasks a manager set this rep on Team. Read-only here: managers set and reassign them. */
function TasksCard({ rep }: { rep: string }) {
  const { tasks } = useSalesState();
  const reduce = useReducedMotion();
  const mine = tasks.filter((t) => t.rep === rep);
  const isOverdue = (due: string) => /overdue/i.test(due);
  const overdue = mine.filter((t) => isOverdue(t.due)).length;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tasks</CardTitle>
        <CardMeta>{mine.length ? (overdue ? `${overdue} overdue` : "none overdue") : "from your manager"}</CardMeta>
      </CardHeader>
      <CardContent>
        {mine.length === 0 ? (
          <p className="py-1.5 text-[13px] text-muted-foreground">No tasks from your manager.</p>
        ) : (
          <ul className="flex flex-col">
            {mine.map((t, i) => (
              <motion.li
                key={t.id}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: reduce ? 0 : 0.22, ease: EASE_OUT, delay: rowDelay(i, reduce) }}
                className="flex items-start gap-2.5 py-1.5"
              >
                <Flag
                  className={cn("mt-0.5 size-3.5 shrink-0", t.flag ? "text-rose-600 dark:text-rose-400" : "text-subtle-foreground")}
                  aria-hidden
                />
                <span className="min-w-0 flex-1 text-[13px]">{t.task}</span>
                <span
                  className={cn(
                    "shrink-0 text-xs tabular-nums",
                    isOverdue(t.due) ? "font-medium text-rose-700 dark:text-rose-300" : "text-muted-foreground",
                  )}
                >
                  {t.due}
                </span>
              </motion.li>
            ))}
          </ul>
        )}
        <p className="mt-2 text-xs text-subtle-foreground">Set by your manager on the Sales dashboard&apos;s Team page.</p>
      </CardContent>
    </Card>
  );
}
