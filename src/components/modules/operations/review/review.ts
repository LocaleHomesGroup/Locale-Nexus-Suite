import { STATUS_LABEL, type Job, type Milestone, type MilestoneStatus } from "@/data/jobs";
import type { MilestoneState, ReviewItem } from "@/data/seed";

/**
 * The review queue's rules, shared by the job page (which files a change here
 * instead of applying it) and the Review queue (which releases or dismisses it).
 *
 * Four milestones move money. A reversal of one of them, or a backdated
 * completion, is held here until a person releases it — nothing reaches Monday
 * or HubSpot before then. Every other milestone applies straight away, with an
 * audit entry.
 */
export const MONEY_MILESTONES: ReadonlySet<string> = new Set([
  "Formal Finance Approval",
  "Slab Down",
  "Settlement Confirmation",
  "Plate Height",
]);

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

/**
 * "22 Jun 2026", "5 August 2026" and "30 Sept 2026" as a sortable day number,
 * or null for anything else. No Date object, so no timezone can move a day.
 */
export function dayNumber(date: string): number | null {
  const m = /^(\d{1,2})\s+([A-Za-z]+)\.?\s+(\d{4})$/.exec(date.trim());
  if (!m) return null;
  const month = MONTHS.indexOf(m[2].slice(0, 3).toLowerCase());
  return month < 0 ? null : Number(m[3]) * 372 + month * 31 + Number(m[1]);
}

/** Taking a Completed milestone back, or moving its builder's date earlier. */
export function isRegression(current: Milestone | undefined, status: MilestoneStatus, date: string): boolean {
  if (current?.status !== "done") return false;
  if (status !== "done") return true;
  const before = dayNumber(current.date);
  const after = dayNumber(date);
  return before !== null && after !== null && after < before;
}

/** The milestone a review item is about, as the job shows it now. */
export function liveMilestone(job: Job | undefined, item: Pick<ReviewItem, "kind" | "milestone">): Milestone | undefined {
  return (item.kind === "precon" ? job?.precon : job?.milestones)?.find((m) => m.name === item.milestone);
}

/**
 * The milestone moved after the item was filed, so its before-value describes
 * something that is no longer there. Releasing one would overwrite a change
 * nobody here is looking at, so it can only be dismissed.
 */
export function isStale(item: ReviewItem, live: Milestone | undefined): boolean {
  if (item.status !== "pending") return false;
  return !live || live.status !== item.held.status || live.date !== item.held.date;
}

/** "25211", or the client before a job number exists. */
export function jobRef(job: Job | undefined): string {
  return job ? job.jobNo || job.client : "the job";
}

/** "Slab Down on 25211 set back from Completed to In Progress". */
export function reviewSummary(job: Job | undefined, milestone: string, held: MilestoneState, proposed: MilestoneState): string {
  return proposed.status === "done"
    ? `${milestone} on ${jobRef(job)} backdated from ${held.date} to ${proposed.date}`
    : `${milestone} on ${jobRef(job)} set back from Completed to ${STATUS_LABEL[proposed.status]}`;
}
