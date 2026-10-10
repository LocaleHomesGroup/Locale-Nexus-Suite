import { jobProgress, type Job } from "@/data/jobs";

/** Where a job with no rep is filed, so it still shows. */
export const UNASSIGNED = "Unassigned";

/** The rep a job is filed under: its rep, or Unassigned. */
export const repOf = (j: Job) => j.rep.trim() || UNASSIGNED;

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

/** Where a client's build is, as All clients' Progress column and filter band it. */
export type ProgressBand = "awaiting" | "building" | "complete";

export const PROGRESS_LABEL: Record<ProgressBand, string> = {
  awaiting: "Awaiting site start",
  building: "Building",
  complete: "All milestones done",
};

/**
 * A client's build progress. Preconstruction is awaiting site start. On the construction board it is the
 * milestones done of the job's own list, or of the eight when Monday has none yet (so 0 of 8, still building).
 */
export function buildProgress(j: Job): { band: ProgressBand; done: number; total: number } {
  if (j.board !== "construction") return { band: "awaiting", done: 0, total: 0 };
  // A live list job carries a summary rather than its milestones; jobProgress reads either.
  const { done, total: counted } = jobProgress(j);
  const total = counted || 8;
  return { band: done >= total ? "complete" : "building", done, total };
}

/**
 * All clients' list: one rep's jobs (`rep` as `repOf` files them; null for every rep) in one progress band
 * (null for every band), narrowed by a search over the client, job number, builder, address and rep. The jobs
 * keep their order.
 */
export function filterClients(
  jobs: readonly Job[],
  { rep, progress, query }: { rep: string | null; progress: ProgressBand | null; query: string },
): Job[] {
  const q = query.trim().toLowerCase();
  return jobs.filter(
    (j) =>
      (rep === null || repOf(j) === rep) &&
      (progress === null || buildProgress(j).band === progress) &&
      (!q || [j.client, j.jobNo, j.builder, j.address, repOf(j)].join(" ").toLowerCase().includes(q)),
  );
}
