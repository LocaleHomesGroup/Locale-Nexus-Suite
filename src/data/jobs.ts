/**
 * Shared Launchpad data — the jobs every module reads (Home, Sales, Operations)
 * and the milestone vocabulary that CRM Dash Sync maps onto HubSpot, Monday and
 * Xero. Extracted verbatim from the static mockup (Reference/locale-launchpad 1.html).
 * Static prototype data: nothing here is fetched.
 */

/**
 * "pendingDate" = the builder says it's done but no completion date is on file
 * (job 25501). It is not Completed: nothing advances in HubSpot or
 * raises an invoice until a date is recorded.
 */
export type MilestoneStatus = "done" | "prog" | "open" | "na" | "pendingDate";
export type SyncState = "ok" | "pending" | "conflict";
export type Board = "sales" | "construction";

export interface Milestone {
  name: string;
  status: MilestoneStatus;
  date: string;
  due?: string;
}

/**
 * Monday and CRM Dash disagree about one field. `hub` / `monday` are the
 * sentences shown to people; `milestone` + the two dates are what a resolution
 * writes. An empty date means that system has none recorded.
 */
export interface SyncConflict {
  field: string;
  hub: string;
  monday: string;
  /** The milestone whose date is in dispute. */
  milestone?: string;
  hubDate?: string;
  mondayDate?: string;
}

export interface Job {
  id: number;
  jobNo: string;
  recordId: string;
  buyerType: string;
  client: string;
  builder: string;
  address: string;
  board: Board;
  hsStage: string;
  rep: string;
  saleWon: string;
  blockTitled: string;
  blockDue: string;
  sync: SyncState;
  conflict?: SyncConflict;
  lastSource: string;
  precon: Milestone[];
  milestones: Milestone[];
}

export interface LotDetail {
  estate: string;
  developer: string;
  lot: string;
  suburb: string;
  design: string;
  type: string;
  size: string;
}

/** The eight construction milestones, in build order. */
export const CONSTRUCTION_MILESTONES = [
  "Date to Site",
  "Slab Down",
  "Plate Height",
  "Roof Cover",
  "Lock Up",
  "Practical Completion",
  "Key Handover",
  "Maintenance"
] as const;

/** Human label for each milestone status. */
export const STATUS_LABEL: Record<MilestoneStatus, string> = {
  "done": "Completed",
  "prog": "In Progress",
  "open": "Not Started",
  "na": "Not Applicable",
  "pendingDate": "Awaiting date"
};

/** Preconstruction milestones that map onto a HubSpot date property. */
export const PRECON_HUBSPOT_PROPERTY: Record<string, string> = {
  "Contracts Signed": "Date Contracts Signed",
  "Build Permit Received": "Build Permit Date"
};

/** Construction milestone → HubSpot deal stage. `null` = no matching stage. */
export const MILESTONE_HUBSPOT_STAGE: Record<string, string | null> = {
  "Date to Site": "Site Start",
  "Slab Down": "Slab Down",
  "Plate Height": "Plate Height",
  "Roof Cover": "Roof Cover",
  "Lock Up": "Lock Up",
  "Practical Completion": "Practical Completion",
  "Key Handover": null,
  "Maintenance": "Maintenance"
};

/** Builder → milestone → claim amount (AUD) that raises a draft Xero invoice. */
export const BUILDER_CLAIMS: Record<string, Record<string, number>> = {
  "Move Homes": {
    "Formal Finance Approval": 10000,
    "Settlement Confirmation": 15000,
    "Slab Down": 10000
  },
  "La Vida": {
    "Formal Finance Approval": 20000,
    "Slab Down": 15000
  },
  "Forma": {
    "Formal Finance Approval": 17500,
    "Slab Down": 17500
  },
  "New Era": {
    "Settlement Confirmation": 15000,
    "Slab Down": 10000,
    "Plate Height": 10000
  },
  "New Choice": {
    "Slab Down": 17500,
    "Plate Height": 17500
  }
};

/** Mirrored HubSpot site record per job id. */
export const LOT_DETAILS: Record<number, LotDetail> = {
  "1": {
    "estate": "Seaside Rise",
    "developer": "Peet",
    "lot": "Lot 361, 8 Camperdown Way",
    "suburb": "Lakelands",
    "design": "The Aspen",
    "type": "Single Storey",
    "size": "192 sqm"
  },
  "2": {
    "estate": "Emerald Park",
    "developer": "Stockland",
    "lot": "Lot 574, 32 Zodiac Street",
    "suburb": "Wellard",
    "design": "The Marlow",
    "type": "Single Storey",
    "size": "178 sqm"
  },
  "3": {
    "estate": "Rivergums",
    "developer": "Cedar Woods",
    "lot": "Lot 118, 22 Karri Loop",
    "suburb": "Baldivis",
    "design": "The Hartley",
    "type": "Single Storey",
    "size": "205 sqm"
  },
  "4": {
    "estate": "Trinity",
    "developer": "Satterley",
    "lot": "Lot 44, 7 Ashby Rise",
    "suburb": "Alkimos",
    "design": "The Coventry",
    "type": "Double Storey",
    "size": "241 sqm"
  },
  "5": {
    "estate": "Capricorn",
    "developer": "Yanchep Beach JV",
    "lot": "Lot 209, 15 Foreshore Vista",
    "suburb": "Yanchep",
    "design": "The Sorrento",
    "type": "Single Storey",
    "size": "186 sqm"
  },
  "6": {
    "estate": "Wellard Glen",
    "developer": "Peet",
    "lot": "Lot 88, 4 Tuart Rise",
    "suburb": "Wellard",
    "design": "The Fremont",
    "type": "Single Storey",
    "size": "198 sqm"
  },
  "7": {
    "estate": "Rivergums",
    "developer": "Cedar Woods",
    "lot": "Lot 271, 19 Banksia Bend",
    "suburb": "Baldivis",
    "design": "The Lucia",
    "type": "Single Storey",
    "size": "173 sqm"
  },
  "8": {
    "estate": "Seaside Rise",
    "developer": "Peet",
    "lot": "Lot 402, 11 Currawong Loop",
    "suburb": "Lakelands",
    "design": "The Aspen",
    "type": "Single Storey",
    "size": "192 sqm"
  },
  "9": {
    "estate": "Trinity",
    "developer": "Satterley",
    "lot": "Lot 133, 27 Sandpiper Way",
    "suburb": "Alkimos",
    "design": "The Bremer",
    "type": "Double Storey",
    "size": "236 sqm"
  },
  "10": {
    "estate": "Kingsford",
    "developer": "Okeland",
    "lot": "Lot 512, 6 Aviator Street",
    "suburb": "Bullsbrook",
    "design": "The Dalton",
    "type": "Single Storey",
    "size": "168 sqm"
  },
  "11": {
    "estate": "Emerald Park",
    "developer": "Stockland",
    "lot": "Lot 590, 41 Zodiac Street",
    "suburb": "Wellard",
    "design": "The Score",
    "type": "Single Storey",
    "size": "182 sqm"
  },
  "12": {
    "estate": "Capricorn",
    "developer": "Yanchep Beach JV",
    "lot": "Lot 220, 3 Reef Break Road",
    "suburb": "Yanchep",
    "design": "The Sorrento",
    "type": "Single Storey",
    "size": "186 sqm"
  }
};

export const HOUSE_IMAGE_BASE = "https://d239b6a2ib0iz7.cloudfront.net/home";

export const JOBS: Job[] = [
  {
    "id": 1,
    "jobNo": "25431",
    "recordId": "18234599102",
    "buyerType": "Retail",
    "client": "R. de Thierry and J. Kumar",
    "builder": "Forma",
    "address": "Lot 361, 8 Camperdown Way, Lakelands WA 6180",
    "board": "construction",
    "hsStage": "Lock Up",
    "rep": "A. Mercer",
    "saleWon": "14 Nov 2025",
    "blockTitled": "Titled",
    "blockDue": "",
    "sync": "ok",
    "lastSource": "Portal, 6:04am",
    "precon": [
      {
        "name": "Builder Acceptance",
        "status": "done",
        "date": "14 Nov 2025",
        "due": ""
      },
      {
        "name": "Compliance Sketch and Quote received",
        "status": "done",
        "date": "28 Nov 2025",
        "due": ""
      },
      {
        "name": "Compliance Sketch and Quote approved",
        "status": "done",
        "date": "05 Dec 2025",
        "due": ""
      },
      {
        "name": "Contracts Received",
        "status": "done",
        "date": "19 Dec 2025",
        "due": ""
      },
      {
        "name": "Contracts Signed",
        "status": "done",
        "date": "22 Jan 2026",
        "due": ""
      },
      {
        "name": "Formal Finance Approval",
        "status": "done",
        "date": "30 Jan 2026",
        "due": ""
      },
      {
        "name": "Settlement Confirmation",
        "status": "done",
        "date": "06 Feb 2026",
        "due": ""
      },
      {
        "name": "Deposit Claim",
        "status": "done",
        "date": "09 Feb 2026",
        "due": ""
      },
      {
        "name": "Prestart Meeting",
        "status": "done",
        "date": "10 Feb 2026",
        "due": ""
      },
      {
        "name": "Build Permit Received",
        "status": "done",
        "date": "11 Feb 2026",
        "due": ""
      },
      {
        "name": "Variations",
        "status": "na",
        "date": "",
        "due": ""
      }
    ],
    "milestones": [
      {
        "name": "Date to Site",
        "status": "done",
        "date": "12 Feb 2026"
      },
      {
        "name": "Slab Down",
        "status": "done",
        "date": "18 Mar 2026"
      },
      {
        "name": "Plate Height",
        "status": "done",
        "date": "29 Apr 2026"
      },
      {
        "name": "Roof Cover",
        "status": "done",
        "date": "12 Jun 2026"
      },
      {
        "name": "Lock Up",
        "status": "done",
        "date": "24 Jul 2026"
      },
      {
        "name": "Practical Completion",
        "status": "open",
        "date": ""
      },
      {
        "name": "Key Handover",
        "status": "open",
        "date": ""
      },
      {
        "name": "Maintenance",
        "status": "open",
        "date": ""
      }
    ]
  },
  {
    "id": 2,
    "jobNo": "25211",
    "recordId": "18240013557",
    "buyerType": "Retail",
    "client": "A. Davoile and C. Alex",
    "builder": "Forma",
    "address": "Lot 574, 32 Zodiac Street, Wellard WA 6170",
    "board": "construction",
    "hsStage": "Slab Down",
    "rep": "K. Ellery",
    "saleWon": "02 Feb 2026",
    "blockTitled": "Titled",
    "blockDue": "",
    "sync": "ok",
    "lastSource": "Ops entry, yesterday",
    "precon": [
      {
        "name": "Builder Acceptance",
        "status": "done",
        "date": "02 Feb 2026",
        "due": ""
      },
      {
        "name": "Compliance Sketch and Quote received",
        "status": "done",
        "date": "16 Feb 2026",
        "due": ""
      },
      {
        "name": "Compliance Sketch and Quote approved",
        "status": "done",
        "date": "24 Feb 2026",
        "due": ""
      },
      {
        "name": "Contracts Received",
        "status": "done",
        "date": "10 Mar 2026",
        "due": ""
      },
      {
        "name": "Contracts Signed",
        "status": "done",
        "date": "27 Mar 2026",
        "due": ""
      },
      {
        "name": "Formal Finance Approval",
        "status": "done",
        "date": "09 Apr 2026",
        "due": ""
      },
      {
        "name": "Settlement Confirmation",
        "status": "done",
        "date": "17 Apr 2026",
        "due": ""
      },
      {
        "name": "Deposit Claim",
        "status": "done",
        "date": "20 Apr 2026",
        "due": ""
      },
      {
        "name": "Prestart Meeting",
        "status": "done",
        "date": "24 Apr 2026",
        "due": ""
      },
      {
        "name": "Build Permit Received",
        "status": "done",
        "date": "30 Apr 2026",
        "due": ""
      },
      {
        "name": "Variations",
        "status": "done",
        "date": "01 May 2026",
        "due": ""
      }
    ],
    "milestones": [
      {
        "name": "Date to Site",
        "status": "done",
        "date": "05 May 2026"
      },
      {
        "name": "Slab Down",
        "status": "done",
        "date": "22 Jun 2026"
      },
      {
        "name": "Plate Height",
        "status": "open",
        "date": ""
      },
      {
        "name": "Roof Cover",
        "status": "open",
        "date": ""
      },
      {
        "name": "Lock Up",
        "status": "open",
        "date": ""
      },
      {
        "name": "Practical Completion",
        "status": "open",
        "date": ""
      },
      {
        "name": "Key Handover",
        "status": "open",
        "date": ""
      },
      {
        "name": "Maintenance",
        "status": "open",
        "date": ""
      }
    ]
  },
  {
    "id": 3,
    "jobNo": "25501",
    "recordId": "18251772980",
    "buyerType": "Retail",
    "client": "B. Barber",
    "builder": "Move Homes",
    "address": "Lot 118, 22 Karri Loop, Baldivis WA 6171",
    "board": "construction",
    "hsStage": "Site Start",
    "rep": "A. Mercer",
    "saleWon": "19 Mar 2026",
    "blockTitled": "Titled",
    "blockDue": "",
    "sync": "conflict",
    "conflict": {
      "field": "Slab Down date",
      "hub": "No date recorded",
      "monday": "28 Jul 2026 (edited directly in Monday by S. Hart)",
      "milestone": "Slab Down",
      "hubDate": "",
      "mondayDate": "28 Jul 2026"
    },
    "lastSource": "Monday edit, Mon",
    "precon": [
      {
        "name": "Builder Acceptance",
        "status": "done",
        "date": "19 Mar 2026",
        "due": ""
      },
      {
        "name": "Compliance Sketch and Quote received",
        "status": "done",
        "date": "02 Apr 2026",
        "due": ""
      },
      {
        "name": "Compliance Sketch and Quote approved",
        "status": "done",
        "date": "10 Apr 2026",
        "due": ""
      },
      {
        "name": "Contracts Received",
        "status": "done",
        "date": "28 Apr 2026",
        "due": ""
      },
      {
        "name": "Contracts Signed",
        "status": "done",
        "date": "15 May 2026",
        "due": ""
      },
      {
        "name": "Formal Finance Approval",
        "status": "done",
        "date": "29 May 2026",
        "due": ""
      },
      {
        "name": "Settlement Confirmation",
        "status": "done",
        "date": "05 Jun 2026",
        "due": ""
      },
      {
        "name": "Deposit Claim",
        "status": "done",
        "date": "09 Jun 2026",
        "due": ""
      },
      {
        "name": "Prestart Meeting",
        "status": "done",
        "date": "12 Jun 2026",
        "due": ""
      },
      {
        "name": "Build Permit Received",
        "status": "done",
        "date": "",
        "due": ""
      },
      {
        "name": "Variations",
        "status": "open",
        "date": "",
        "due": ""
      }
    ],
    "milestones": [
      {
        "name": "Date to Site",
        "status": "done",
        "date": "30 Jun 2026"
      },
      {
        "name": "Slab Down",
        "status": "pendingDate",
        "date": ""
      },
      {
        "name": "Plate Height",
        "status": "open",
        "date": ""
      },
      {
        "name": "Roof Cover",
        "status": "open",
        "date": ""
      },
      {
        "name": "Lock Up",
        "status": "open",
        "date": ""
      },
      {
        "name": "Practical Completion",
        "status": "open",
        "date": ""
      },
      {
        "name": "Key Handover",
        "status": "open",
        "date": ""
      },
      {
        "name": "Maintenance",
        "status": "open",
        "date": ""
      }
    ]
  },
  {
    "id": 4,
    "jobNo": "23769",
    "recordId": "18266408315",
    "buyerType": "Retail",
    "client": "K. Hicks",
    "builder": "La Vida",
    "address": "Lot 44, 7 Ashby Rise, Alkimos WA 6038",
    "board": "sales",
    "hsStage": "Sale Won",
    "rep": "D. Okafor",
    "saleWon": "08 Jul 2026",
    "blockTitled": "Untitled",
    "blockDue": "30 Sept 2026",
    "sync": "ok",
    "lastSource": "CSV import, Mon",
    "precon": [
      {
        "name": "Builder Acceptance",
        "status": "done",
        "date": "08 Jul 2026",
        "due": ""
      },
      {
        "name": "Compliance Sketch and Quote received",
        "status": "done",
        "date": "22 Jul 2026",
        "due": ""
      },
      {
        "name": "Compliance Sketch and Quote approved",
        "status": "done",
        "date": "29 Jul 2026",
        "due": ""
      },
      {
        "name": "Contracts Received",
        "status": "prog",
        "date": "",
        "due": "21 Aug 2026"
      },
      {
        "name": "Contracts Signed",
        "status": "open",
        "date": "",
        "due": ""
      },
      {
        "name": "Formal Finance Approval",
        "status": "open",
        "date": "",
        "due": ""
      },
      {
        "name": "Settlement Confirmation",
        "status": "open",
        "date": "",
        "due": ""
      },
      {
        "name": "Deposit Claim",
        "status": "open",
        "date": "",
        "due": ""
      },
      {
        "name": "Prestart Meeting",
        "status": "open",
        "date": "",
        "due": ""
      },
      {
        "name": "Build Permit Received",
        "status": "open",
        "date": "",
        "due": ""
      },
      {
        "name": "Variations",
        "status": "open",
        "date": "",
        "due": ""
      }
    ],
    "milestones": []
  },
  {
    "id": 5,
    "jobNo": "",
    "recordId": "18271956023",
    "buyerType": "Retail",
    "client": "L. Mallillin",
    "builder": "New Choice",
    "address": "Lot 209, 15 Foreshore Vista, Yanchep WA 6035",
    "board": "sales",
    "hsStage": "Sale Won",
    "rep": "K. Ellery",
    "saleWon": "22 Jul 2026",
    "blockTitled": "Untitled",
    "blockDue": "14 Nov 2026",
    "sync": "ok",
    "lastSource": "Broker email, Fri",
    "precon": [
      {
        "name": "Builder Acceptance",
        "status": "prog",
        "date": "",
        "due": ""
      },
      {
        "name": "Compliance Sketch and Quote received",
        "status": "open",
        "date": "",
        "due": ""
      },
      {
        "name": "Compliance Sketch and Quote approved",
        "status": "open",
        "date": "",
        "due": ""
      },
      {
        "name": "Contracts Received",
        "status": "open",
        "date": "",
        "due": ""
      },
      {
        "name": "Contracts Signed",
        "status": "open",
        "date": "",
        "due": ""
      },
      {
        "name": "Formal Finance Approval",
        "status": "open",
        "date": "",
        "due": ""
      },
      {
        "name": "Settlement Confirmation",
        "status": "open",
        "date": "",
        "due": ""
      },
      {
        "name": "Deposit Claim",
        "status": "open",
        "date": "",
        "due": ""
      },
      {
        "name": "Prestart Meeting",
        "status": "open",
        "date": "",
        "due": ""
      },
      {
        "name": "Build Permit Received",
        "status": "open",
        "date": "",
        "due": ""
      },
      {
        "name": "Variations",
        "status": "open",
        "date": "",
        "due": ""
      }
    ],
    "milestones": []
  },
  {
    "id": 6,
    "jobNo": "25478",
    "recordId": "18239884471",
    "buyerType": "Retail",
    "client": "S. and P. Nakamura",
    "builder": "Move Homes",
    "address": "Lot 88, 4 Tuart Rise, Wellard WA 6170",
    "board": "construction",
    "hsStage": "Roof Cover",
    "rep": "D. Okafor",
    "saleWon": "09 Dec 2025",
    "blockTitled": "Titled",
    "blockDue": "",
    "sync": "ok",
    "lastSource": "Portal, 6:10am",
    "precon": [
      {
        "name": "Builder Acceptance",
        "status": "done",
        "date": "09 Dec 2025",
        "due": ""
      },
      {
        "name": "Compliance Sketch and Quote received",
        "status": "done",
        "date": "22 Dec 2025",
        "due": ""
      },
      {
        "name": "Compliance Sketch and Quote approved",
        "status": "done",
        "date": "12 Jan 2026",
        "due": ""
      },
      {
        "name": "Contracts Received",
        "status": "done",
        "date": "27 Jan 2026",
        "due": ""
      },
      {
        "name": "Contracts Signed",
        "status": "done",
        "date": "13 Feb 2026",
        "due": ""
      },
      {
        "name": "Formal Finance Approval",
        "status": "done",
        "date": "26 Feb 2026",
        "due": ""
      },
      {
        "name": "Settlement Confirmation",
        "status": "done",
        "date": "06 Mar 2026",
        "due": ""
      },
      {
        "name": "Deposit Claim",
        "status": "done",
        "date": "10 Mar 2026",
        "due": ""
      },
      {
        "name": "Prestart Meeting",
        "status": "done",
        "date": "13 Mar 2026",
        "due": ""
      },
      {
        "name": "Build Permit Received",
        "status": "done",
        "date": "20 Mar 2026",
        "due": ""
      },
      {
        "name": "Variations",
        "status": "done",
        "date": "24 Mar 2026",
        "due": ""
      }
    ],
    "milestones": [
      {
        "name": "Date to Site",
        "status": "done",
        "date": "31 Mar 2026"
      },
      {
        "name": "Slab Down",
        "status": "done",
        "date": "08 May 2026"
      },
      {
        "name": "Plate Height",
        "status": "done",
        "date": "12 Jun 2026"
      },
      {
        "name": "Roof Cover",
        "status": "done",
        "date": "21 Jul 2026"
      },
      {
        "name": "Lock Up",
        "status": "open",
        "date": ""
      },
      {
        "name": "Practical Completion",
        "status": "open",
        "date": ""
      },
      {
        "name": "Key Handover",
        "status": "open",
        "date": ""
      },
      {
        "name": "Maintenance",
        "status": "open",
        "date": ""
      }
    ]
  },
  {
    "id": 7,
    "jobNo": "25302",
    "recordId": "18227390566",
    "buyerType": "Wholesale",
    "client": "M. Achebe",
    "builder": "La Vida",
    "address": "Lot 271, 19 Banksia Bend, Baldivis WA 6171",
    "board": "construction",
    "hsStage": "Practical Completion",
    "rep": "A. Mercer",
    "saleWon": "18 Sep 2025",
    "blockTitled": "Titled",
    "blockDue": "",
    "sync": "ok",
    "lastSource": "Ops entry, Tue",
    "precon": [
      {
        "name": "Builder Acceptance",
        "status": "done",
        "date": "18 Sep 2025",
        "due": ""
      },
      {
        "name": "Compliance Sketch and Quote received",
        "status": "done",
        "date": "01 Oct 2025",
        "due": ""
      },
      {
        "name": "Compliance Sketch and Quote approved",
        "status": "done",
        "date": "10 Oct 2025",
        "due": ""
      },
      {
        "name": "Contracts Received",
        "status": "done",
        "date": "24 Oct 2025",
        "due": ""
      },
      {
        "name": "Contracts Signed",
        "status": "done",
        "date": "07 Nov 2025",
        "due": ""
      },
      {
        "name": "Formal Finance Approval",
        "status": "done",
        "date": "18 Nov 2025",
        "due": ""
      },
      {
        "name": "Settlement Confirmation",
        "status": "done",
        "date": "25 Nov 2025",
        "due": ""
      },
      {
        "name": "Deposit Claim",
        "status": "na",
        "date": "",
        "due": ""
      },
      {
        "name": "Prestart Meeting",
        "status": "done",
        "date": "02 Dec 2025",
        "due": ""
      },
      {
        "name": "Build Permit Received",
        "status": "done",
        "date": "09 Dec 2025",
        "due": ""
      },
      {
        "name": "Variations",
        "status": "done",
        "date": "11 Dec 2025",
        "due": ""
      }
    ],
    "milestones": [
      {
        "name": "Date to Site",
        "status": "done",
        "date": "16 Dec 2025"
      },
      {
        "name": "Slab Down",
        "status": "done",
        "date": "30 Jan 2026"
      },
      {
        "name": "Plate Height",
        "status": "done",
        "date": "06 Mar 2026"
      },
      {
        "name": "Roof Cover",
        "status": "done",
        "date": "17 Apr 2026"
      },
      {
        "name": "Lock Up",
        "status": "done",
        "date": "29 May 2026"
      },
      {
        "name": "Practical Completion",
        "status": "done",
        "date": "24 Jul 2026"
      },
      {
        "name": "Key Handover",
        "status": "prog",
        "date": ""
      },
      {
        "name": "Maintenance",
        "status": "open",
        "date": ""
      }
    ]
  },
  {
    "id": 8,
    "jobNo": "24960",
    "recordId": "18201175834",
    "buyerType": "Retail",
    "client": "G. and H. Petrov",
    "builder": "Forma",
    "address": "Lot 402, 11 Currawong Loop, Lakelands WA 6180",
    "board": "construction",
    "hsStage": "Maintenance",
    "rep": "K. Ellery",
    "saleWon": "02 May 2025",
    "blockTitled": "Titled",
    "blockDue": "",
    "sync": "ok",
    "lastSource": "Portal, 6:04am",
    "precon": [
      {
        "name": "Builder Acceptance",
        "status": "done",
        "date": "02 May 2025",
        "due": ""
      },
      {
        "name": "Compliance Sketch and Quote received",
        "status": "done",
        "date": "16 May 2025",
        "due": ""
      },
      {
        "name": "Compliance Sketch and Quote approved",
        "status": "done",
        "date": "27 May 2025",
        "due": ""
      },
      {
        "name": "Contracts Received",
        "status": "done",
        "date": "10 Jun 2025",
        "due": ""
      },
      {
        "name": "Contracts Signed",
        "status": "done",
        "date": "27 Jun 2025",
        "due": ""
      },
      {
        "name": "Formal Finance Approval",
        "status": "done",
        "date": "08 Jul 2025",
        "due": ""
      },
      {
        "name": "Settlement Confirmation",
        "status": "done",
        "date": "15 Jul 2025",
        "due": ""
      },
      {
        "name": "Deposit Claim",
        "status": "done",
        "date": "18 Jul 2025",
        "due": ""
      },
      {
        "name": "Prestart Meeting",
        "status": "done",
        "date": "22 Jul 2025",
        "due": ""
      },
      {
        "name": "Build Permit Received",
        "status": "done",
        "date": "01 Aug 2025",
        "due": ""
      },
      {
        "name": "Variations",
        "status": "done",
        "date": "05 Aug 2025",
        "due": ""
      }
    ],
    "milestones": [
      {
        "name": "Date to Site",
        "status": "done",
        "date": "12 Aug 2025"
      },
      {
        "name": "Slab Down",
        "status": "done",
        "date": "19 Sep 2025"
      },
      {
        "name": "Plate Height",
        "status": "done",
        "date": "24 Oct 2025"
      },
      {
        "name": "Roof Cover",
        "status": "done",
        "date": "28 Nov 2025"
      },
      {
        "name": "Lock Up",
        "status": "done",
        "date": "23 Jan 2026"
      },
      {
        "name": "Practical Completion",
        "status": "done",
        "date": "20 Mar 2026"
      },
      {
        "name": "Key Handover",
        "status": "done",
        "date": "02 Apr 2026"
      },
      {
        "name": "Maintenance",
        "status": "prog",
        "date": ""
      }
    ]
  },
  {
    "id": 9,
    "jobNo": "25517",
    "recordId": "18274430189",
    "buyerType": "Retail",
    "client": "T. Woods and R. Chen",
    "builder": "Move Homes",
    "address": "Lot 133, 27 Sandpiper Way, Alkimos WA 6038",
    "board": "construction",
    "hsStage": "Site Start",
    "rep": "K. Ellery",
    "saleWon": "03 Apr 2026",
    "blockTitled": "Titled",
    "blockDue": "",
    "sync": "pending",
    "lastSource": "Ops entry, just now",
    "precon": [
      {
        "name": "Builder Acceptance",
        "status": "done",
        "date": "03 Apr 2026",
        "due": ""
      },
      {
        "name": "Compliance Sketch and Quote received",
        "status": "done",
        "date": "17 Apr 2026",
        "due": ""
      },
      {
        "name": "Compliance Sketch and Quote approved",
        "status": "done",
        "date": "28 Apr 2026",
        "due": ""
      },
      {
        "name": "Contracts Received",
        "status": "done",
        "date": "12 May 2026",
        "due": ""
      },
      {
        "name": "Contracts Signed",
        "status": "done",
        "date": "29 May 2026",
        "due": ""
      },
      {
        "name": "Formal Finance Approval",
        "status": "done",
        "date": "11 Jun 2026",
        "due": ""
      },
      {
        "name": "Settlement Confirmation",
        "status": "done",
        "date": "18 Jun 2026",
        "due": ""
      },
      {
        "name": "Deposit Claim",
        "status": "done",
        "date": "22 Jun 2026",
        "due": ""
      },
      {
        "name": "Prestart Meeting",
        "status": "done",
        "date": "26 Jun 2026",
        "due": ""
      },
      {
        "name": "Build Permit Received",
        "status": "done",
        "date": "07 Jul 2026",
        "due": ""
      },
      {
        "name": "Variations",
        "status": "done",
        "date": "10 Jul 2026",
        "due": ""
      }
    ],
    "milestones": [
      {
        "name": "Date to Site",
        "status": "done",
        "date": "29 Jul 2026"
      },
      {
        "name": "Slab Down",
        "status": "open",
        "date": ""
      },
      {
        "name": "Plate Height",
        "status": "open",
        "date": ""
      },
      {
        "name": "Roof Cover",
        "status": "open",
        "date": ""
      },
      {
        "name": "Lock Up",
        "status": "open",
        "date": ""
      },
      {
        "name": "Practical Completion",
        "status": "open",
        "date": ""
      },
      {
        "name": "Key Handover",
        "status": "open",
        "date": ""
      },
      {
        "name": "Maintenance",
        "status": "open",
        "date": ""
      }
    ]
  },
  {
    "id": 10,
    "jobNo": "23901",
    "recordId": "18262901447",
    "buyerType": "Wholesale",
    "client": "F. Adeyemi",
    "builder": "New Era",
    "address": "Lot 512, 6 Aviator Street, Bullsbrook WA 6084",
    "board": "sales",
    "hsStage": "Sale Won",
    "rep": "D. Okafor",
    "saleWon": "12 Jun 2026",
    "blockTitled": "Untitled",
    "blockDue": "02 Oct 2026",
    "sync": "ok",
    "lastSource": "Email, Tue",
    "precon": [
      {
        "name": "Builder Acceptance",
        "status": "done",
        "date": "12 Jun 2026",
        "due": ""
      },
      {
        "name": "Compliance Sketch and Quote received",
        "status": "done",
        "date": "26 Jun 2026",
        "due": ""
      },
      {
        "name": "Compliance Sketch and Quote approved",
        "status": "done",
        "date": "07 Jul 2026",
        "due": ""
      },
      {
        "name": "Contracts Received",
        "status": "done",
        "date": "17 Jul 2026",
        "due": ""
      },
      {
        "name": "Contracts Signed",
        "status": "done",
        "date": "31 Jul 2026",
        "due": ""
      },
      {
        "name": "Formal Finance Approval",
        "status": "prog",
        "date": "",
        "due": "19 Aug 2026"
      },
      {
        "name": "Settlement Confirmation",
        "status": "open",
        "date": "",
        "due": ""
      },
      {
        "name": "Deposit Claim",
        "status": "open",
        "date": "",
        "due": ""
      },
      {
        "name": "Prestart Meeting",
        "status": "open",
        "date": "",
        "due": ""
      },
      {
        "name": "Build Permit Received",
        "status": "open",
        "date": "",
        "due": ""
      },
      {
        "name": "Variations",
        "status": "open",
        "date": "",
        "due": ""
      }
    ],
    "milestones": []
  },
  {
    "id": 11,
    "jobNo": "23912",
    "recordId": "18259178205",
    "buyerType": "Retail",
    "client": "J. and A. O'Connell",
    "builder": "La Vida",
    "address": "Lot 590, 41 Zodiac Street, Wellard WA 6170",
    "board": "sales",
    "hsStage": "Sale Won",
    "rep": "A. Mercer",
    "saleWon": "29 May 2026",
    "blockTitled": "Titled",
    "blockDue": "",
    "sync": "ok",
    "lastSource": "CSV import, Mon",
    "precon": [
      {
        "name": "Builder Acceptance",
        "status": "done",
        "date": "29 May 2026",
        "due": ""
      },
      {
        "name": "Compliance Sketch and Quote received",
        "status": "done",
        "date": "12 Jun 2026",
        "due": ""
      },
      {
        "name": "Compliance Sketch and Quote approved",
        "status": "done",
        "date": "23 Jun 2026",
        "due": ""
      },
      {
        "name": "Contracts Received",
        "status": "done",
        "date": "03 Jul 2026",
        "due": ""
      },
      {
        "name": "Contracts Signed",
        "status": "done",
        "date": "17 Jul 2026",
        "due": ""
      },
      {
        "name": "Formal Finance Approval",
        "status": "done",
        "date": "24 Jul 2026",
        "due": ""
      },
      {
        "name": "Settlement Confirmation",
        "status": "done",
        "date": "28 Jul 2026",
        "due": ""
      },
      {
        "name": "Deposit Claim",
        "status": "done",
        "date": "30 Jul 2026",
        "due": ""
      },
      {
        "name": "Prestart Meeting",
        "status": "done",
        "date": "03 Aug 2026",
        "due": ""
      },
      {
        "name": "Build Permit Received",
        "status": "prog",
        "date": "",
        "due": "14 Aug 2026"
      },
      {
        "name": "Variations",
        "status": "open",
        "date": "",
        "due": ""
      }
    ],
    "milestones": []
  },
  {
    "id": 12,
    "jobNo": "",
    "recordId": "18276554312",
    "buyerType": "Retail",
    "client": "W. and K. Tan",
    "builder": "Forma",
    "address": "Lot 220, 3 Reef Break Road, Yanchep WA 6035",
    "board": "sales",
    "hsStage": "Sale Won",
    "rep": "A. Mercer",
    "saleWon": "01 Aug 2026",
    "blockTitled": "Untitled",
    "blockDue": "20 Nov 2026",
    "sync": "ok",
    "lastSource": "Broker email, yesterday",
    "precon": [
      {
        "name": "Builder Acceptance",
        "status": "prog",
        "date": "",
        "due": ""
      },
      {
        "name": "Compliance Sketch and Quote received",
        "status": "open",
        "date": "",
        "due": ""
      },
      {
        "name": "Compliance Sketch and Quote approved",
        "status": "open",
        "date": "",
        "due": ""
      },
      {
        "name": "Contracts Received",
        "status": "open",
        "date": "",
        "due": ""
      },
      {
        "name": "Contracts Signed",
        "status": "open",
        "date": "",
        "due": ""
      },
      {
        "name": "Formal Finance Approval",
        "status": "open",
        "date": "",
        "due": ""
      },
      {
        "name": "Settlement Confirmation",
        "status": "open",
        "date": "",
        "due": ""
      },
      {
        "name": "Deposit Claim",
        "status": "open",
        "date": "",
        "due": ""
      },
      {
        "name": "Prestart Meeting",
        "status": "open",
        "date": "",
        "due": ""
      },
      {
        "name": "Build Permit Received",
        "status": "open",
        "date": "",
        "due": ""
      },
      {
        "name": "Variations",
        "status": "open",
        "date": "",
        "due": ""
      }
    ],
    "milestones": []
  }
];

export type DocCategory = "Build" | "Land" | "Finance";

export interface ChecklistItem {
  ref: string;
  cat: DocCategory;
  name: string;
  req: boolean;
}

/** Each builder's deal-submission document checklist. */
export const BUILDER_CHECKLISTS: Record<string, ChecklistItem[]> = {
  "Forma": [
    {
      "ref": "DEALPPA",
      "cat": "Build",
      "name": "Signed PPA or EOI",
      "req": true
    },
    {
      "ref": "DEALFLR",
      "cat": "Build",
      "name": "Signed Sketch",
      "req": true
    },
    {
      "ref": "DEALELEV",
      "cat": "Build",
      "name": "Signed Elevation",
      "req": true
    },
    {
      "ref": "DEALSITE",
      "cat": "Build",
      "name": "Signed Fixed Siteworks",
      "req": true
    },
    {
      "ref": "DEALSPS",
      "cat": "Build",
      "name": "Rapid Costing Tool",
      "req": true
    },
    {
      "ref": "DEALCOMP",
      "cat": "Build",
      "name": "Compliance checklist",
      "req": true
    },
    {
      "ref": "DEALSPEC",
      "cat": "Build",
      "name": "Signed Specs (Finishing Touch only)",
      "req": false
    },
    {
      "ref": "DEALOA",
      "cat": "Land",
      "name": "O and A or ownership proof",
      "req": true
    },
    {
      "ref": "DEALDAP",
      "cat": "Land",
      "name": "Design guidelines / DAP",
      "req": false
    },
    {
      "ref": "PPADEP",
      "cat": "Finance",
      "name": "Proof of deposit",
      "req": true
    },
    {
      "ref": "DEALLOE",
      "cat": "Finance",
      "name": "LOE / pre-approval / cash",
      "req": true
    },
    {
      "ref": "DEALID",
      "cat": "Finance",
      "name": "Photo ID, both buyers",
      "req": true
    }
  ],
  "Move Homes": [
    {
      "ref": "PBAPACK",
      "cat": "Build",
      "name": "PBA pack workbook",
      "req": true
    },
    {
      "ref": "DEALFLR",
      "cat": "Build",
      "name": "Signed sketch and elevation",
      "req": true
    },
    {
      "ref": "DEALSITE",
      "cat": "Build",
      "name": "Fixed siteworks quote",
      "req": true
    },
    {
      "ref": "DEALSPS",
      "cat": "Build",
      "name": "Rapid Costing Tool",
      "req": true
    },
    {
      "ref": "DEALOA",
      "cat": "Land",
      "name": "O and A",
      "req": true
    },
    {
      "ref": "DEALTITLE",
      "cat": "Land",
      "name": "Title or anticipated title date",
      "req": true
    },
    {
      "ref": "PPADEP",
      "cat": "Finance",
      "name": "Deposit receipt",
      "req": true
    },
    {
      "ref": "DEALLOE",
      "cat": "Finance",
      "name": "Finance pre-approval",
      "req": true
    },
    {
      "ref": "DEALID",
      "cat": "Finance",
      "name": "Photo ID, both buyers",
      "req": true
    },
    {
      "ref": "DEALFEE",
      "cat": "Finance",
      "name": "Services fee acknowledgement $3,500",
      "req": true
    }
  ],
  "New Choice": [
    {
      "ref": "NCHLEAD",
      "cat": "Build",
      "name": "Lead number and client name",
      "req": true
    },
    {
      "ref": "NCHPPA",
      "cat": "Build",
      "name": "PPA",
      "req": true
    },
    {
      "ref": "NCHQUOTE",
      "cat": "Build",
      "name": "Quote",
      "req": true
    },
    {
      "ref": "NCHSKETCH",
      "cat": "Build",
      "name": "Sketch, north point and zoning",
      "req": true
    },
    {
      "ref": "NCHSPEC",
      "cat": "Build",
      "name": "Specification",
      "req": true
    },
    {
      "ref": "NCHPRE",
      "cat": "Build",
      "name": "Pre-start allowance annexure",
      "req": true
    },
    {
      "ref": "NCHOA",
      "cat": "Land",
      "name": "Offer and Acceptance, names match quote",
      "req": true
    },
    {
      "ref": "NCHBAL",
      "cat": "Land",
      "name": "BAL certificate, under 12 months",
      "req": true
    },
    {
      "ref": "NCHDFES",
      "cat": "Land",
      "name": "DFES BAL map screenshot",
      "req": true
    },
    {
      "ref": "NCHZONE",
      "cat": "Land",
      "name": "Intramaps or developer land list",
      "req": true
    },
    {
      "ref": "NCHDEP",
      "cat": "Finance",
      "name": "Deposit received",
      "req": true
    },
    {
      "ref": "NCHLOE",
      "cat": "Finance",
      "name": "Finance LOE or pre-approval",
      "req": true
    },
    {
      "ref": "NCHREF",
      "cat": "Finance",
      "name": "Referral form",
      "req": false
    }
  ],
  "New Era": [
    {
      "ref": "NEQUOTE",
      "cat": "Build",
      "name": "Signed sales quotation",
      "req": true
    },
    {
      "ref": "NESKETCH",
      "cat": "Build",
      "name": "Signed sketch 1:100 with block drawn",
      "req": true
    },
    {
      "ref": "NEELEV",
      "cat": "Build",
      "name": "Signed elevations",
      "req": true
    },
    {
      "ref": "NESPEC",
      "cat": "Build",
      "name": "Signed specification",
      "req": true
    },
    {
      "ref": "NEPPA",
      "cat": "Build",
      "name": "Signed PPA",
      "req": true
    },
    {
      "ref": "NEINFO",
      "cat": "Build",
      "name": "Customer information sheet",
      "req": true
    },
    {
      "ref": "NEOA",
      "cat": "Land",
      "name": "Copy of O and A if title not issued",
      "req": true
    },
    {
      "ref": "NECOV",
      "cat": "Land",
      "name": "Developer covenants",
      "req": false
    },
    {
      "ref": "NETITLE",
      "cat": "Land",
      "name": "Certificate of title",
      "req": false
    },
    {
      "ref": "NEDEP",
      "cat": "Finance",
      "name": "Receipt of deposit paid",
      "req": true
    },
    {
      "ref": "NELOE",
      "cat": "Finance",
      "name": "Pre-approval, LOE or proof of funds",
      "req": true
    },
    {
      "ref": "NEID",
      "cat": "Finance",
      "name": "Drivers licence or passport",
      "req": true
    }
  ],
  "La Vida": [
    {
      "ref": "LVQUOTE",
      "cat": "Build",
      "name": "Signed sales quotation",
      "req": true
    },
    {
      "ref": "LVSKETCH",
      "cat": "Build",
      "name": "Signed sketch with block drawn",
      "req": true
    },
    {
      "ref": "LVELEV",
      "cat": "Build",
      "name": "Signed elevation",
      "req": true
    },
    {
      "ref": "LVPPA",
      "cat": "Build",
      "name": "Signed PPA",
      "req": true
    },
    {
      "ref": "LVREVUP",
      "cat": "Build",
      "name": "RevUp T and Cs signed",
      "req": false
    },
    {
      "ref": "LVOA",
      "cat": "Land",
      "name": "O and A signed by both parties",
      "req": true
    },
    {
      "ref": "LVDG",
      "cat": "Land",
      "name": "Developer design guidelines",
      "req": true
    },
    {
      "ref": "LVREBATE",
      "cat": "Land",
      "name": "Rebate form if applicable",
      "req": false
    },
    {
      "ref": "LVDEP",
      "cat": "Finance",
      "name": "Deposit paid, proof of transaction",
      "req": true
    },
    {
      "ref": "LVLOE",
      "cat": "Finance",
      "name": "Pre-approval or LOE",
      "req": true
    },
    {
      "ref": "LVID",
      "cat": "Finance",
      "name": "Drivers licence or passport",
      "req": true
    }
  ]
};

export interface SubmissionDoc extends ChecklistItem {
  file: string;
  /** "" = not reviewed yet, "verified" = accepted by Ops, "fix" = returned to the rep (see fixNote). */
  state: "" | "verified" | "fix" | string;
  fixNote: string;
}

/** A fresh submission checklist for a builder (falls back to Forma). */
export function checklistFor(builder: string): SubmissionDoc[] {
  return (BUILDER_CHECKLISTS[builder] ?? BUILDER_CHECKLISTS.Forma).map((c) => ({
    ...c,
    file: "",
    state: "",
    fixNote: "",
  }));
}
