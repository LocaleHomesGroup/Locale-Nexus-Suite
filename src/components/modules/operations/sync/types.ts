import { CONSTRUCTION_MILESTONES, MILESTONE_HUBSPOT_STAGE, type Milestone } from "@/data/jobs";

/** The systems a write lands in, in the order CRM Dash Sync pushes them. */
export type SyncSystem = "Launchpad" | "Monday" | "HubSpot" | "Xero";

/** One line of a sync trail. Every step is either landed or in flight. */
export interface SyncStep {
  sys: SyncSystem;
  state: "done" | "pending";
  label: string;
  /** Wall-clock stamp once the step lands. */
  meta: string;
}

/** One write's walk through the systems: Launchpad first, then each connected system in turn. */
export interface SyncRun {
  id: string;
  jobId: number;
  /** "25501 · Slab Down" — names the run inside a batch trail. */
  label: string;
  steps: SyncStep[];
  /** Every system has confirmed. */
  done: boolean;
}

/**
 * What the sync trail dialog shows: one run, or a batch of them accepted
 * together ("3 portal updates"). Trails run in the background; the dialog
 * only opens when someone asks to see one.
 */
export interface SyncTrail {
  id: string;
  /** "25501 · Slab Down" or "3 portal updates". */
  subject: string;
  runs: SyncRun[];
}

export function trailDone(trail: SyncTrail): boolean {
  return trail.runs.length > 0 && trail.runs.every((r) => r.done);
}

/** The trail's title says where it is: "Syncing 25501 · Slab Down…", then "25501 · Slab Down synced". */
export function trailTitle(trail: SyncTrail): string {
  return trailDone(trail) ? `${trail.subject} synced` : `Syncing ${trail.subject}…`;
}

export type MilestoneKind = "construction" | "precon";

/**
 * HubSpot deal stages in pipeline order — the construction milestones that map
 * to a stage. A completion only ever moves a deal forward along this list.
 */
export const HUBSPOT_STAGE_ORDER: string[] = CONSTRUCTION_MILESTONES.map((m) => MILESTONE_HUBSPOT_STAGE[m]).filter(
  (s): s is string => Boolean(s),
);

/** A fresh construction board: Date to Site done on the builder's site start, the rest open. */
export function seedConstruction(siteStart: string): Milestone[] {
  return CONSTRUCTION_MILESTONES.map((name, i) => ({
    name,
    status: i === 0 ? "done" : "open",
    date: i === 0 ? siteStart : "",
  }));
}
