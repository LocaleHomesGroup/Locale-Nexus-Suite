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

export const SEED_ACTIVITY: ActivityEntry[] = [
  {
    "type": "milestone",
    "action": "Slab Down marked Completed",
    "detail": "Builder date 18 Jul 2026 · stage advanced to Slab Down",
    "targets": [
      "Monday",
      "HubSpot",
      "Xero"
    ],
    "who": "S. Hart",
    "when": "18 Jul, 09:14"
  },
  {
    "type": "invoice",
    "action": "Draft invoice created",
    "detail": "Forma · approved in Accounts",
    "targets": [
      "Xero"
    ],
    "who": "System",
    "when": "18 Jul, 09:14"
  },
  {
    "type": "details",
    "action": "Site address corrected",
    "detail": "Lot 361 Camperdown Way · typo fixed from builder pack",
    "targets": [
      "Monday",
      "HubSpot"
    ],
    "who": "A. Carter",
    "when": "2 Jul, 15:22"
  },
  {
    "type": "import",
    "action": "Portal update accepted",
    "detail": "Plate Height 12 Jun 2026 from Constructive portal",
    "targets": [
      "Monday",
      "HubSpot"
    ],
    "who": "S. Hart",
    "when": "12 Jun, 08:03"
  },
  {
    "type": "milestone",
    "action": "Moved to construction",
    "detail": "8 construction subitems seeded on the Monday board",
    "targets": [
      "Monday"
    ],
    "who": "S. Hart",
    "when": "2 May, 11:47"
  },
  {
    "type": "details",
    "action": "Job number entered",
    "detail": "25431 · deal renamed, Builder Acceptance ticked",
    "targets": [
      "Monday",
      "HubSpot"
    ],
    "who": "S. Hart",
    "when": "18 Apr, 16:30"
  }
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
    "builder": "Forma",
    "kind": "construction",
    "milestone": "Lock Up",
    "date": "05 Aug 2026",
    "source": "Constructive portal, 6:04am"
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
    "client": "L. Tan",
    "builder": "Forma",
    "kind": "move",
    "milestone": "Site start date detected in builder portal",
    "date": "11 Aug 2026",
    "source": "Constructive portal · construction tab, 6:04am"
  }
];
