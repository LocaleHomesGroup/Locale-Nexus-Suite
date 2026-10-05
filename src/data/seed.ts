/**
 * Seed state for the Launchpad store (src/state/launchpad-store.tsx):
 * the audit log, the Nguyen submission under review, notifications, and the
 * milestone changes held in the Operations review queue.
 */
import type { MilestoneStatus, SubmissionDoc } from "./jobs";

/** `review` = a regression filed to, released from or dismissed from the review queue. */
export type ActivityType = "milestone" | "invoice" | "details" | "import" | "conflict" | "review";

export interface ActivityEntry {
  type: ActivityType;
  action: string;
  detail: string;
  targets: string[];
  who: string;
  when: string;
  /** The job ids this write touched. An entry without any shows on every job. */
  jobs?: number[];
}

export type NotificationKind = "ok" | "red";

export interface AppNotification {
  msg: string;
  when: string;
  kind: NotificationKind;
}

/**
 * A held change's lifecycle: waiting on a person, then released (applied and
 * synced), dismissed (nothing changed anywhere), or superseded by a newer
 * change to the same milestone.
 */
export type ReviewStatus = "pending" | "accepted" | "dismissed" | "superseded";

/** One milestone as the review queue compares it. `date` is the builder's date, "" when none. */
export interface MilestoneState {
  status: MilestoneStatus;
  date: string;
}

/**
 * A reversal or a backdated completion on one of the four milestones that move
 * money, held back from Monday and HubSpot until a person releases it. `held`
 * is the milestone as it stood when the change was filed: once the live
 * milestone moves away from it, releasing is refused.
 */
export interface ReviewItem {
  id: string;
  status: ReviewStatus;
  jobId: number;
  kind: "construction" | "precon";
  milestone: string;
  summary: string;
  queuedAt: string;
  queuedBy: string;
  /** Where the person heard about the change. */
  source?: string;
  held: MilestoneState;
  proposed: MilestoneState;
  /** From the person who made the change. */
  note?: string;
  decidedAt?: string;
  decidedBy?: string;
  /** The reason given when it was released or dismissed. */
  decisionNote?: string;
}

/**
 * The audit log, newest first. Every entry names the job(s) it wrote to, so a
 * job page only shows its own history. Dates follow each job's data in
 * `jobs.ts` (Home's "today" is Wednesday 5 August 2026).
 */
export const SEED_ACTIVITY: ActivityEntry[] = [
  {
    type: "review",
    action: "Filed to the review queue",
    detail: "Slab Down on 25211 set back from Completed to In Progress · held until Operations releases it",
    targets: [],
    who: "S. Hart",
    when: "Today, 08:41",
    jobs: [2],
  },
  {
    type: "review",
    action: "Filed to the review queue",
    detail: "Plate Height on 25478 backdated from 12 Jun 2026 to 05 Jun 2026 · held until Operations releases it",
    targets: [],
    who: "A. Carter",
    when: "Today, 07:58",
    jobs: [6],
  },
  {
    type: "import",
    action: "Portal update applied",
    detail: "Lock Up 24 Jul 2026 from the Constructive portal · stage advanced to Lock Up",
    targets: ["Monday", "HubSpot"],
    who: "System",
    when: "Today, 06:04",
    jobs: [1],
  },
  {
    type: "review",
    action: "Filed to the review queue",
    detail: "Settlement Confirmation on 23912 set back from Completed to Not Started · held until Operations releases it",
    targets: [],
    who: "S. Hart",
    when: "Yesterday, 16:20",
    jobs: [11],
  },
  {
    type: "review",
    action: "Filed to the review queue",
    detail: "Slab Down on 25211 backdated from 22 Jun 2026 to 19 Jun 2026 · held until Operations releases it",
    targets: [],
    who: "A. Carter",
    when: "Yesterday, 11:05",
    jobs: [2],
  },
  {
    type: "conflict",
    action: "Sync conflict flagged",
    detail: "Slab Down date: Monday has 28 Jul 2026, Launchpad has no date. HubSpot and Xero wait until it's resolved",
    targets: [],
    who: "System",
    when: "3 Aug, 16:05",
    jobs: [3],
  },
  {
    type: "milestone",
    action: "Slab Down date edited in Monday",
    detail: "28 Jul 2026 typed into the Monday subitem directly, not through Launchpad",
    targets: ["Monday"],
    who: "S. Hart",
    when: "3 Aug, 16:02",
    jobs: [3],
  },
  {
    type: "review",
    action: "Released from the review queue",
    detail: "Slab Down on 25302 backdated from 06 Feb 2026 to 30 Jan 2026 · “Matches La Vida's pour docket.”",
    targets: ["Monday", "HubSpot"],
    who: "S. Hart",
    when: "3 Aug, 10:12",
    jobs: [7],
  },
  {
    type: "review",
    action: "Dismissed from the review queue",
    detail:
      "Formal Finance Approval on 25517 · nothing changed · “Entered against the wrong job — finance on 25517 is unconditional.”",
    targets: [],
    who: "S. Hart",
    when: "31 Jul, 14:30",
    jobs: [9],
  },
  {
    type: "milestone",
    action: "Slab Down marked complete by the builder",
    detail: "Move Homes confirmed the slab by phone, no completion date supplied · status Awaiting date",
    targets: ["Monday"],
    who: "S. Hart",
    when: "29 Jul, 10:41",
    jobs: [3],
  },
  {
    type: "details",
    action: "Site address corrected",
    detail: "Lot 361 Camperdown Way · typo fixed from builder pack",
    targets: ["Monday", "HubSpot"],
    who: "A. Carter",
    when: "2 Jul, 15:22",
    jobs: [1],
  },
  {
    type: "milestone",
    action: "Moved to construction",
    detail: "Site start 30 Jun 2026 · 8 construction subitems seeded on the Monday board",
    targets: ["Monday", "HubSpot"],
    who: "S. Hart",
    when: "30 Jun, 11:47",
    jobs: [3],
  },
  {
    type: "milestone",
    action: "Slab Down marked Completed",
    detail: "Builder date 22 Jun 2026 · stage advanced to Slab Down",
    targets: ["Monday", "HubSpot", "Xero"],
    who: "S. Hart",
    when: "22 Jun, 09:14",
    jobs: [2],
  },
  {
    type: "invoice",
    action: "Draft invoice created",
    detail: "INV-D-1042 · Forma · awaiting approval in Accounts",
    targets: ["Xero"],
    who: "System",
    when: "22 Jun, 09:14",
    jobs: [2],
  },
  {
    type: "import",
    action: "Portal update accepted",
    detail: "Roof Cover 12 Jun 2026 from the Constructive portal",
    targets: ["Monday", "HubSpot"],
    who: "S. Hart",
    when: "12 Jun, 08:03",
    jobs: [1],
  },
  {
    type: "milestone",
    action: "Moved to construction",
    detail: "Site start 05 May 2026 · 8 construction subitems seeded on the Monday board",
    targets: ["Monday", "HubSpot"],
    who: "S. Hart",
    when: "5 May, 11:47",
    jobs: [2],
  },
  {
    type: "details",
    action: "Job number entered",
    detail: "25501 · deal renamed, Builder Acceptance ticked",
    targets: ["Monday", "HubSpot"],
    who: "S. Hart",
    when: "19 Mar, 16:30",
    jobs: [3],
  },
  {
    type: "details",
    action: "Job number entered",
    detail: "25431 · deal renamed, Builder Acceptance ticked",
    targets: ["Monday", "HubSpot"],
    who: "S. Hart",
    when: "14 Nov 2025, 16:30",
    jobs: [1],
  },
];

export const SEED_SUBMISSION_DOCS: SubmissionDoc[] = [
  {
    "ref": "DEALPPA",
    "cat": "Build",
    "name": "Signed PPA",
    "req": true,
    "file": "Nguyen_DEALPPA.pdf",
    "state": "",
    "fixNote": ""
  },
  {
    "ref": "DEALFLR",
    "cat": "Build",
    "name": "Signed Floor/Elevation Plan (N point and setbacks)",
    "req": true,
    "file": "Nguyen_DEALFLR.pdf",
    "state": "",
    "fixNote": ""
  },
  {
    "ref": "DEALSITE",
    "cat": "Build",
    "name": "Signed Fixed Siteworks",
    "req": true,
    "file": "Nguyen_DEALSITE.pdf",
    "state": "",
    "fixNote": ""
  },
  {
    "ref": "DEALSPS",
    "cat": "Build",
    "name": "Sales Pricing Document / Rapid Costing",
    "req": true,
    "file": "",
    "state": "",
    "fixNote": ""
  },
  {
    "ref": "DEALCOMP",
    "cat": "Build",
    "name": "Compliance checklist completed",
    "req": true,
    "file": "",
    "state": "",
    "fixNote": ""
  },
  {
    "ref": "DEALSPEC",
    "cat": "Build",
    "name": "Signed Specifications (Finishing Touch only)",
    "req": false,
    "file": "",
    "state": "",
    "fixNote": ""
  },
  {
    "ref": "DEALOA",
    "cat": "Land",
    "name": "Offer and Acceptance / Certificate of Title",
    "req": true,
    "file": "Nguyen_DEALOA.pdf",
    "state": "",
    "fixNote": ""
  },
  {
    "ref": "DEALDTA",
    "cat": "Land",
    "name": "Delayed Title Agreement (added by rule)",
    "req": true,
    "file": "",
    "state": "",
    "fixNote": ""
  },
  {
    "ref": "DEALDAP",
    "cat": "Land",
    "name": "Design Guidelines / DAP",
    "req": false,
    "file": "",
    "state": "",
    "fixNote": ""
  },
  {
    "ref": "PPADEP",
    "cat": "Finance",
    "name": "Deposit Receipt",
    "req": true,
    "file": "Nguyen_PPADEP.pdf",
    "state": "",
    "fixNote": ""
  },
  {
    "ref": "DEALLOE",
    "cat": "Finance",
    "name": "Letter of Eligibility / Pre-Approval",
    "req": true,
    "file": "Nguyen_DEALLOE.pdf",
    "state": "",
    "fixNote": ""
  },
  {
    "ref": "DEALID",
    "cat": "Finance",
    "name": "Photo ID, both buyers",
    "req": true,
    "file": "Nguyen_DEALID.pdf",
    "state": "",
    "fixNote": ""
  },
  {
    "ref": "DEALREB",
    "cat": "Finance",
    "name": "Rebate Annexure",
    "req": false,
    "file": "",
    "state": "",
    "fixNote": ""
  }
];

export const SEED_NOTIFICATIONS: AppNotification[] = [
  {
    "msg": "3 required documents outstanding — Nguyen submission",
    "when": "1 hr ago",
    "kind": "red"
  },
  {
    "msg": "Portal update applied — 25478 Lock Up",
    "when": "2 hrs ago",
    "kind": "ok"
  },
  {
    "msg": "Invoice approved — 25302 Slab Down",
    "when": "Yesterday",
    "kind": "ok"
  }
];

/**
 * The review queue: three changes waiting on a person, then the latest
 * decisions, newest first. Each `held` matches the job's data in `jobs.ts`, so
 * none of the pending items starts out stale; the decided ones already agree
 * with what the job shows now.
 */
export const SEED_REVIEW_ITEMS: ReviewItem[] = [
  {
    id: "RQ-118",
    status: "pending",
    jobId: 2,
    kind: "construction",
    milestone: "Slab Down",
    summary: "Slab Down on 25211 set back from Completed to In Progress",
    queuedAt: "Today, 08:41",
    queuedBy: "S. Hart",
    source: "Phone call",
    held: { status: "done", date: "22 Jun 2026" },
    proposed: { status: "prog", date: "" },
    note: "Forma says the slab failed its engineer's inspection and is being re-poured.",
  },
  {
    id: "RQ-117",
    status: "pending",
    jobId: 6,
    kind: "construction",
    milestone: "Plate Height",
    summary: "Plate Height on 25478 backdated from 12 Jun 2026 to 05 Jun 2026",
    queuedAt: "Today, 07:58",
    queuedBy: "A. Carter",
    source: "Vendor portal",
    held: { status: "done", date: "12 Jun 2026" },
    proposed: { status: "done", date: "05 Jun 2026" },
    note: "Move Homes' weekly report has the frame inspection on 5 June, not 12 June.",
  },
  {
    id: "RQ-116",
    status: "pending",
    jobId: 11,
    kind: "precon",
    milestone: "Settlement Confirmation",
    summary: "Settlement Confirmation on 23912 set back from Completed to Not Started",
    queuedAt: "Yesterday, 16:20",
    queuedBy: "S. Hart",
    source: "Broker email",
    held: { status: "done", date: "28 Jul 2026" },
    proposed: { status: "open", date: "" },
    note: "The developer re-booked land settlement; 28 July did not go ahead.",
  },
  {
    id: "RQ-115",
    status: "superseded",
    jobId: 2,
    kind: "construction",
    milestone: "Slab Down",
    summary: "Slab Down on 25211 backdated from 22 Jun 2026 to 19 Jun 2026",
    queuedAt: "Yesterday, 11:05",
    queuedBy: "A. Carter",
    held: { status: "done", date: "22 Jun 2026" },
    proposed: { status: "done", date: "19 Jun 2026" },
    decidedAt: "Today, 08:41",
    decidedBy: "System",
  },
  {
    id: "RQ-109",
    status: "accepted",
    jobId: 7,
    kind: "construction",
    milestone: "Slab Down",
    summary: "Slab Down on 25302 backdated from 06 Feb 2026 to 30 Jan 2026",
    queuedAt: "3 Aug, 09:30",
    queuedBy: "A. Carter",
    held: { status: "done", date: "06 Feb 2026" },
    proposed: { status: "done", date: "30 Jan 2026" },
    decidedAt: "3 Aug, 10:12",
    decidedBy: "S. Hart",
    decisionNote: "Matches La Vida's pour docket.",
  },
  {
    id: "RQ-104",
    status: "dismissed",
    jobId: 9,
    kind: "precon",
    milestone: "Formal Finance Approval",
    summary: "Formal Finance Approval on 25517 set back from Completed to In Progress",
    queuedAt: "31 Jul, 11:02",
    queuedBy: "K. Ellery",
    held: { status: "done", date: "11 Jun 2026" },
    proposed: { status: "prog", date: "" },
    decidedAt: "31 Jul, 14:30",
    decidedBy: "S. Hart",
    decisionNote: "Entered against the wrong job — finance on 25517 is unconditional.",
  },
];
