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
