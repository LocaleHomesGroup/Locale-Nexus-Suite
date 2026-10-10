import type { Job, Milestone } from "@/data/jobs";

/**
 * Where a job screen is with a live job's milestones. The job list carries a summary instead of them, so the job's own
 * screen asks for them (see useJobMilestones), and an empty list on that screen means "not asked yet" as often as "none".
 */
export type MilestoneLoad = "loading" | "failed" | "ready";

/** What the fetch brought back, and for which job: a result only counts for the job it was asked about. */
export type FetchedMilestones = { id: number; found: { precon: Milestone[]; milestones: Milestone[] } | "failed" } | null;

/**
 * The job a screen shows, and where its milestones are. A sample job, or no job, is as it is: its own milestones,
 * ready. A live list job has none of its own, so until its fetch has answered it is loading, and an answer that failed
 * is failed. Neither is "no milestones": only a fetch that came back empty means that.
 */
export function withMilestones<J extends Job | undefined>(
  job: J,
  live: boolean,
  fetched: FetchedMilestones,
): { job: J; load: MilestoneLoad } {
  if (!job || !live) return { job, load: "ready" };
  if (fetched === null || fetched.id !== job.id) return { job, load: "loading" };
  if (fetched.found === "failed") return { job, load: "failed" };
  return { job: { ...job, ...fetched.found }, load: "ready" };
}
