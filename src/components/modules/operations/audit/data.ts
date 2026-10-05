import type { ActivityType } from "@/data/seed";

/**
 * How an audit entry is marked, on the Audit log and on each job's own log.
 * Colour is never the only code: every entry also names its kind in words.
 */
export const AUDIT_DOT: Record<ActivityType, string> = {
  milestone: "bg-tone-strong",
  details: "bg-zinc-400 dark:bg-zinc-500",
  invoice: "bg-emerald-500 dark:bg-emerald-400",
  import: "bg-amber-400",
  conflict: "bg-rose-500 dark:bg-rose-400",
  review: "bg-zinc-700 dark:bg-zinc-300",
};

export const AUDIT_TYPE_LABEL: Record<ActivityType, string> = {
  milestone: "Milestone",
  details: "Job details",
  invoice: "Invoice",
  import: "Import",
  conflict: "Sync conflict",
  review: "Regression",
};

export type AuditGroup = "all" | "milestone" | "job" | "review" | "sync";

/**
 * The Audit log's filters. "Regressions" is a filter over history — every
 * regression and every decision taken on one — and deliberately not called
 * "Review queue": two things sharing a name is how a person ends up looking in
 * the wrong place for something that is in the other.
 */
export const AUDIT_GROUPS: { value: AuditGroup; label: string; types: readonly ActivityType[] | null }[] = [
  { value: "all", label: "All", types: null },
  { value: "milestone", label: "Milestones", types: ["milestone"] },
  { value: "job", label: "Job details", types: ["details"] },
  { value: "review", label: "Regressions", types: ["review"] },
  // Everything that went out to, or came back from, another system.
  { value: "sync", label: "Sync", types: ["conflict", "import", "invoice"] },
];

export const AUDIT_GROUP_VALUES = AUDIT_GROUPS.map((g) => g.value);
