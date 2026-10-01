/**
 * Seed state for the Launchpad store (src/state/launchpad-store.tsx):
 * the audit log, the Nguyen submission under review, notifications, and the
 * builder-portal updates waiting in the Operations inbox. From the mockup.
 */
import type { SubmissionDoc } from "./jobs";

export type ActivityType = "milestone" | "invoice" | "details" | "import" | "conflict";

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

export type PortalUpdateKind = "construction" | "precon" | "move";

export interface PortalUpdate {
  id: string;
  jobId: number;
  jobNo: string;
  client: string;
  builder: string;
  kind: PortalUpdateKind;
  milestone: string;
  date: string;
  source: string;
}

/**
 * The audit log, newest first. Every entry names the job(s) it wrote to, so a
 * job page only shows its own history. Dates follow each job's data in
 * `jobs.ts` (Home's "today" is Wednesday 5 August 2026).
 */
export const SEED_ACTIVITY: ActivityEntry[] = [
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
    type: "conflict",
    action: "Sync conflict flagged",
    detail: "Slab Down date: Monday has 28 Jul 2026, CRM Dash has no date. HubSpot and Xero wait until it's resolved",
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
    detail: "INV-D-1042 · Forma · $17,500 + GST · awaiting approval in Accounts",
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

export const SEED_PORTAL_UPDATES: PortalUpdate[] = [
  {
    "id": "PU-311",
    "jobId": 6,
    "jobNo": "25478",
    "client": "S. and P. Nakamura",
    "builder": "Move Homes",
    "kind": "construction",
    "milestone": "Lock Up",
    "date": "05 Aug 2026",
    "source": "Move Homes portal, 6:10am"
  },
  {
    "id": "PU-312",
    "jobId": 10,
    "jobNo": "23901",
    "client": "F. Adeyemi",
    "builder": "New Era",
    "kind": "precon",
    "milestone": "Formal Finance Approval",
    "date": "06 Aug 2026",
    "source": "Email parse, 7:15am"
  },
  {
    "id": "PU-313",
    "jobId": 12,
    "jobNo": "",
    "client": "W. and K. Tan",
    "builder": "Forma",
    "kind": "move",
    "milestone": "Site start date detected in builder portal",
    "date": "11 Aug 2026",
    "source": "Constructive portal · construction tab, 6:04am"
  }
];
