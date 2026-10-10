import { CONSTRUCTION_MILESTONES, summariseMilestones, type Job, type Milestone, type MilestoneStatus } from "@/data/jobs";
import { MONTHS, perthDay } from "@/lib/perth-time";

/** A row of launchpad.monday_jobs, with the rep's name resolved through staff_aliases. */
export interface JobRow {
  item_id: number;
  purpose: string;
  job_number: string | null;
  deal_name: string;
  site_address: string | null;
  site_suburb: string | null;
  site_state: string | null;
  builder: string | null;
  buyer_type: string | null;
  block_titled: string | null;
  title_due_date: string | null;
  sale_won_date: string | null;
  construction_stage: string | null;
  hubspot_deal_id: number | null;
  updated_at: Date | string;
  rep: string | null;
}

/** A row of launchpad.monday_job_milestones. */
export interface MilestoneRow {
  job_item_id: number;
  name: string;
  status_label: string | null;
  due_date: string | null;
  date_completed: string | null;
  monday_created_at: Date | string | null;
}

/** The prototype's preconstruction order (src/data/jobs.ts). Names Monday adds sort after these. */
export const PRECON_ORDER = [
  "Builder Acceptance",
  "Compliance Sketch and Quote received",
  "Compliance Sketch and Quote approved",
  "Contracts Received",
  "Contracts Signed",
  "Formal Finance Approval",
  "Settlement Confirmation",
  "Deposit Claim",
  "Prestart Meeting",
  "Build Permit Received",
  "Variations",
];

/** "2026-03-04" → "04 Mar 2026", the prototype's display form. */
export function displayDate(iso: string | null): string {
  if (!iso || !/^\d{4}-\d{2}-\d{2}/.test(iso)) return "";
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return `${String(d).padStart(2, "0")} ${MONTHS[m - 1]} ${y}`;
}

/** Whole labels only: "Incomplete" and "Not complete" aren't done. */
const DONE_LABELS = new Set(["done", "complete", "completed"]);

/** A Monday status label to the prototype's status. Done without a date is "awaiting date". */
export function milestoneStatus(label: string | null, completed: string | null): MilestoneStatus {
  const l = (label ?? "").trim().toLowerCase();
  if (DONE_LABELS.has(l)) return completed ? "done" : "pendingDate";
  if (l.includes("n/a") || l.includes("not applicable")) return "na";
  if (l.includes("progress") || l.includes("working") || l.includes("overdue") || l.includes("stuck")) return "prog";
  return completed ? "done" : "open";
}

/** Monday's Block Titled labels are Yes and No; the prototype says Titled and Untitled. */
function titledLabel(v: string | null): string {
  const l = (v ?? "").trim().toLowerCase();
  if (l === "yes" || l === "titled") return "Titled";
  if (l === "no" || l === "untitled") return "Untitled";
  return v?.trim() ?? "";
}

const CONSTRUCTION = new Set(CONSTRUCTION_MILESTONES.map((n) => n.toLowerCase()));

const createdAt = (m: MilestoneRow) => (m.monday_created_at ? new Date(m.monday_created_at).getTime() : 0);

/** Known steps in the prototype's order; anything else after them, oldest first. */
function ordered(rows: MilestoneRow[], order: readonly string[]): MilestoneRow[] {
  const rank = (name: string) => {
    const i = order.findIndex((o) => o.toLowerCase() === name.trim().toLowerCase());
    return i < 0 ? order.length : i;
  };
  return [...rows].sort((a, b) => rank(a.name) - rank(b.name) || createdAt(a) - createdAt(b));
}

const toMilestone = (m: MilestoneRow): Milestone => ({
  name: m.name.trim(),
  status: milestoneStatus(m.status_label, m.date_completed),
  date: displayDate(m.date_completed),
  due: displayDate(m.due_date),
});

const STATE_CODES = "WA|NSW|VIC|QLD|SA|TAS|NT|ACT";

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Whether the address already has this suburb or state in place: a whole word,
 * followed by the end, a comma, a state code or a postcode. So "WA" isn't found
 * in "Way", nor "Wellard" in "Wellard Road".
 */
function mentions(address: string, part: string): boolean {
  return new RegExp(`(?<!\\w)${escapeRegExp(part)}(?=\\s*(?:$|,|(?:${STATE_CODES})(?![A-Za-z])|\\d{4}\\b))`, "i").test(address);
}

function address(row: JobRow): string {
  let out = row.site_address?.trim() ?? "";
  for (const part of [row.site_suburb, row.site_state]) {
    const p = part?.trim();
    if (p && !mentions(out, p)) out = out ? `${out}, ${p}` : p;
  }
  return out;
}

/** "Monday, 08 Oct 2026": the day it last changed there, in Perth. */
function stamp(updated: Date | string): string {
  const t = new Date(updated).getTime();
  return Number.isNaN(t) ? "Monday" : `Monday, ${displayDate(perthDay(t))}`;
}

/**
 * A job's milestone rows as its screens carry them: preconstruction and construction apart, each in its own
 * order. The one mapping behind a job's own milestones and the summary a list carries, so they can't drift.
 */
export function toMilestones(rows: MilestoneRow[]): { precon: Milestone[]; milestones: Milestone[] } {
  const construction = rows.filter((m) => CONSTRUCTION.has(m.name.trim().toLowerCase()));
  const precon = rows.filter((m) => !CONSTRUCTION.has(m.name.trim().toLowerCase()));
  return {
    precon: ordered(precon, PRECON_ORDER).map(toMilestone),
    milestones: ordered(construction, CONSTRUCTION_MILESTONES).map(toMilestone),
  };
}

export function toJob(row: JobRow, milestones: MilestoneRow[]): Job {
  const own = milestones.filter((m) => m.job_item_id === row.item_id);
  const titled = titledLabel(row.block_titled);
  return {
    id: row.item_id,
    jobNo: row.job_number ?? "",
    recordId: row.hubspot_deal_id ? String(row.hubspot_deal_id) : "",
    buyerType: row.buyer_type ?? "",
    client: row.deal_name,
    builder: row.builder ?? "",
    address: address(row),
    board: row.purpose === "sales" ? "sales" : "construction",
    hsStage: row.construction_stage ?? (row.purpose === "sales" ? "Sale Won" : "Construction"),
    rep: row.rep?.trim() ?? "",
    saleWon: displayDate(row.sale_won_date),
    blockTitled: titled,
    blockDue: titled === "Titled" ? "" : displayDate(row.title_due_date),
    sync: "ok",
    lastSource: stamp(row.updated_at),
    ...toMilestones(own),
  };
}

/**
 * The job as a list carries it: its milestones summarised into `progress` (through toMilestones, so the status
 * mapping is the detail's) and left out. A live page ships its whole list in its HTML, so a job's own screen
 * fetches the milestones it shows instead (loadJobMilestones).
 */
export function toListJob(row: JobRow, milestones: MilestoneRow[]): Job {
  const own = toMilestones(milestones.filter((m) => m.job_item_id === row.item_id));
  return { ...toJob(row, []), progress: summariseMilestones(own.precon, own.milestones) };
}
