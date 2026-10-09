import type { Job } from "@/data/jobs";

/** Where a job with no rep is filed, so it still shows. */
export const UNASSIGNED = "Unassigned";

export interface RepGroup {
  rep: string;
  jobs: Job[];
}

/**
 * The team's clients, one group per rep: `order` first (Sales' REPS), then any
 * other rep A to Z, then Unassigned. A rep with no clients is left out. Each
 * group keeps the jobs' own order.
 */
export function groupByRep(jobs: readonly Job[], order: readonly string[]): RepGroup[] {
  const repOf = (j: Job) => j.rep.trim() || UNASSIGNED;
  const others = [...new Set(jobs.map(repOf))]
    .filter((r) => r !== UNASSIGNED && !order.includes(r))
    .sort((a, b) => a.localeCompare(b));
  return [...order, ...others, UNASSIGNED]
    .map((rep) => ({ rep, jobs: jobs.filter((j) => repOf(j) === rep) }))
    .filter((g) => g.jobs.length > 0);
}

/**
 * One rep's clients, for My clients. With nobody named (live data with no reps, so no viewer) it is
 * empty: a live job with no rep has `rep: ""`, and an empty name must not match it.
 */
export function clientsOf(jobs: readonly Job[], who: string): Job[] {
  return who ? jobs.filter((j) => j.rep === who) : [];
}
