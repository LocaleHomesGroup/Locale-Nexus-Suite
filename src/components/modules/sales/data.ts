/**
 * Sales — static data for the Pipeline, My clients, Under construction,
 * Exclusive land and Team tabs. Extracted verbatim from the mockup's Sales
 * component (`gm`) and the Team scorecard (`fm`, `ac`). Nothing is fetched.
 *
 * Rapid costing, My week and My Deal Submissions keep their data in their own
 * folders (costing/, week/, submissions/).
 */

/* ── Who is signed in to Sales ─────────────────────────────────────────── */

/** The mockup's Sales view is A. Mercer's: "My clients" filters jobs to this rep. */
export const CURRENT_REP = "A. Mercer";

/** The three consultants on the Team page (quarter, stage and task cards). */
export const REPS = ["A. Mercer", "K. Ellery", "D. Okafor"] as const;

/* ── Pipeline ──────────────────────────────────────────────────────────── */

/** Team sales won, August to date — the Team page's "Team sales MTD" tile and Sales' Overview. */
export const SALES_WON_MTD = 4;

export const PIPELINE_STAGES = ["Appointment booked", "Appointment held", "Potential sale", "Sale won"] as const;
export type PipelineStage = (typeof PIPELINE_STAGES)[number];

/** HubSpot's deal priority property. */
export const DEAL_PRIORITIES = ["high", "medium", "low"] as const;
export type DealPriority = (typeof DEAL_PRIORITIES)[number];

/** A note a consultant posts on the deal (the HRIS ticket's Updates thread). */
export interface DealUpdate {
  id: string;
  author: string;
  body: string;
  /** Epoch ms. */
  at: number;
}

/** The fields a deal's edit history tracks. */
export type DealField = "client" | "notes" | "priority" | "stage" | "rep" | "suburb" | "value" | "pkg" | "nextStep";

export interface DealChange {
  field: DealField;
  from: string;
  to: string;
}

/** One line on a deal's edit history, interleaved with its updates. */
export interface DealEvent {
  id: string;
  actor: string;
  at: number;
  action: "created" | "moved" | "updated" | "lost" | "reopened";
  changes?: DealChange[];
}

export interface PipelineDeal {
  id: string;
  /** HubSpot deal number, shown as "D-1042". */
  no: number;
  stage: PipelineStage;
  client: string;
  suburb: string;
  /** Contract value as the mockup prints it — "$585k". */
  value: string;
  /** Deal owner: the consultant who made the deal. */
  rep: string;
  priority: DealPriority;
  /** House and land package, "The Aspen · Forma". */
  pkg: string;
  /** Free-text details: what the clients want, finance, anything the next person should know. */
  notes: string;
  nextStep: string;
  createdAt: number;
  /** When it entered its current stage. */
  stageSince: number;
  /** Set when the deal is closed lost. It leaves the board but keeps its history and can be reopened. */
  lost?: { at: number; by: string };
  /** In its undo window: the HubSpot write hasn't gone yet. */
  syncing?: boolean;
  updates: DealUpdate[];
  history: DealEvent[];
}

/** Still on the board: not won, not lost. */
export const isOpenDeal = (d: PipelineDeal) => !d.lost && d.stage !== "Sale won";

/** "$585k" → 585. */
export const dealValueK = (d: PipelineDeal) => Number.parseFloat(d.value.replace(/[^\d.]/g, "")) || 0;

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

/**
 * The board as it opens. Built from `now` at render time, not at module load,
 * so the server's "2d ago" and the browser's agree. Updates, packages and
 * next steps are sample content.
 */
export function seedDeals(now: number): PipelineDeal[] {
  const ago = (ms: number) => now - ms;
  let n = 0;
  const ev = (actor: string, at: number, action: DealEvent["action"], changes?: DealChange[]): DealEvent => ({
    id: `seed-ev-${n++}`,
    actor,
    at,
    action,
    changes,
  });
  const up = (author: string, at: number, body: string): DealUpdate => ({ id: `seed-up-${n++}`, author, at, body });
  const moved = (actor: string, at: number, from: PipelineStage, to: PipelineStage) =>
    ev(actor, at, "moved", [{ field: "stage", from, to }]);

  return [
    {
      id: "d-whitmore",
      no: 1047,
      stage: "Appointment booked",
      client: "S. and A. Whitmore",
      suburb: "Baldivis",
      value: "$585k",
      rep: "A. Mercer",
      priority: "medium",
      pkg: "The Hartley · La Vida",
      notes: "First home buyers. Want a 4x2 with a theatre and room for a boat. Comparing two lots in Baldivis.",
      nextStep: "First appointment Thursday 4pm",
      createdAt: ago(2 * DAY + 3 * HOUR),
      stageSince: ago(2 * DAY + 3 * HOUR),
      updates: [up("A. Mercer", ago(2 * DAY), "Booked the first appointment for Thursday 4pm at the Baldivis display.")],
      history: [ev("A. Mercer", ago(2 * DAY + 3 * HOUR), "created")],
    },
    {
      id: "d-perera",
      no: 1049,
      stage: "Appointment booked",
      client: "N. Perera",
      suburb: "Alkimos",
      value: "$612k",
      rep: "K. Ellery",
      priority: "high",
      pkg: "The Aspen · Forma",
      notes: "Investor, second property. Wants to sign before the end of the month.",
      nextStep: "Broker call with Locale Financial",
      createdAt: ago(1 * DAY + 5 * HOUR),
      stageSince: ago(1 * DAY + 5 * HOUR),
      updates: [up("K. Ellery", ago(20 * HOUR), "Pre-approval with Locale Financial is in progress. Broker call booked for tomorrow.")],
      history: [ev("K. Ellery", ago(1 * DAY + 5 * HOUR), "created")],
    },
    {
      id: "d-callahan",
      no: 1038,
      stage: "Appointment held",
      client: "G. Callahan",
      suburb: "Wellard",
      value: "$540k",
      rep: "D. Okafor",
      priority: "medium",
      pkg: "The Marlow · Move Homes",
      notes: "Downsizing. Single storey only, low-maintenance garden.",
      nextStep: "Send costings for The Marlow",
      createdAt: ago(9 * DAY),
      stageSince: ago(4 * DAY + 2 * HOUR),
      updates: [
        up("D. Okafor", ago(4 * DAY), "Held the appointment. Comparing The Marlow against another builder's package, so I'm sending costings."),
      ],
      history: [
        ev("D. Okafor", ago(9 * DAY), "created"),
        moved("D. Okafor", ago(4 * DAY + 2 * HOUR), "Appointment booked", "Appointment held"),
      ],
    },
    {
      id: "d-osei",
      no: 1031,
      stage: "Potential sale",
      client: "F. and R. Osei",
      suburb: "Yanchep",
      value: "$655k",
      rep: "A. Mercer",
      priority: "high",
      pkg: "The Aspen · Forma",
      notes: "Growing family, need a fourth bedroom near the living area. Bank valuation ordered.",
      nextStep: "Chase the bank valuation",
      createdAt: ago(16 * DAY),
      stageSince: ago(6 * DAY + 1 * HOUR),
      updates: [
        up("A. Mercer", ago(6 * DAY), "Rapid costing sent. Waiting on their bank valuation."),
        up("A. Mercer", ago(2 * DAY + 4 * HOUR), "They asked for a contribution toward the alfresco. Raised a discount request."),
      ],
      history: [
        ev("A. Mercer", ago(16 * DAY), "created"),
        moved("A. Mercer", ago(12 * DAY), "Appointment booked", "Appointment held"),
        moved("A. Mercer", ago(6 * DAY + 1 * HOUR), "Appointment held", "Potential sale"),
        ev("A. Mercer", ago(2 * DAY + 4 * HOUR), "updated", [{ field: "priority", from: "medium", to: "high" }]),
      ],
    },
    {
      id: "d-lindqvist",
      no: 1041,
      stage: "Appointment held",
      client: "M. Lindqvist",
      suburb: "Byford",
      value: "$548k",
      rep: "A. Mercer",
      priority: "low",
      pkg: "The Marlow · Move Homes",
      notes: "Second home buyers. Liked the Marlow at the display; waiting on a bank valuation before going further.",
      nextStep: "Follow up on the valuation",
      createdAt: ago(24 * DAY),
      // Well past the 14-day stale line, so My progress has one to show.
      stageSince: ago(17 * DAY),
      updates: [up("A. Mercer", ago(17 * DAY), "Appointment held at the Byford display. Waiting on their bank valuation.")],
      history: [
        ev("A. Mercer", ago(24 * DAY), "created"),
        moved("A. Mercer", ago(17 * DAY), "Appointment booked", "Appointment held"),
      ],
    },
    {
      id: "d-tran",
      no: 1036,
      stage: "Potential sale",
      client: "H. Tran",
      suburb: "Lakelands",
      value: "$598k",
      rep: "K. Ellery",
      priority: "medium",
      pkg: "The Score · La Vida",
      notes: "Happy with the plan. Deciding between two lots in The Gardens.",
      nextStep: "Confirm the lot by Friday",
      createdAt: ago(11 * DAY),
      stageSince: ago(3 * DAY + 6 * HOUR),
      updates: [up("K. Ellery", ago(3 * DAY), "Lot on hold for them until Friday. Contract pack is ready to go once they pick.")],
      history: [
        ev("K. Ellery", ago(11 * DAY), "created"),
        moved("K. Ellery", ago(7 * DAY), "Appointment booked", "Appointment held"),
        moved("K. Ellery", ago(3 * DAY + 6 * HOUR), "Appointment held", "Potential sale"),
      ],
    },
    {
      id: "d-mallillin",
      no: 1029,
      stage: "Sale won",
      client: "L. Mallillin",
      suburb: "Yanchep",
      value: "$630k",
      rep: "K. Ellery",
      priority: "low",
      pkg: "The Halcyon · New Choice",
      notes: "Contract signed and deposit paid. Lot 209, 15 Foreshore Vista.",
      nextStep: "Hand over to Operations",
      createdAt: ago(21 * DAY),
      stageSince: ago(3 * HOUR),
      updates: [up("K. Ellery", ago(2 * HOUR), "Contract signed and deposit received. Handing over to Operations.")],
      history: [
        ev("K. Ellery", ago(21 * DAY), "created"),
        moved("K. Ellery", ago(15 * DAY), "Appointment booked", "Appointment held"),
        moved("K. Ellery", ago(8 * DAY), "Appointment held", "Potential sale"),
        moved("K. Ellery", ago(3 * HOUR), "Potential sale", "Sale won"),
      ],
    },
    {
      id: "d-haddad",
      no: 1033,
      stage: "Appointment held",
      client: "M. Haddad",
      suburb: "Byford",
      value: "$520k",
      rep: "D. Okafor",
      priority: "low",
      pkg: "The Marlow · Move Homes",
      notes: "Went with an established home instead of building.",
      nextStep: "",
      createdAt: ago(14 * DAY),
      stageSince: ago(10 * DAY),
      lost: { at: ago(5 * DAY), by: "D. Okafor" },
      updates: [up("D. Okafor", ago(5 * DAY), "They bought an established home in Byford. Closing this one.")],
      history: [
        ev("D. Okafor", ago(14 * DAY), "created"),
        moved("D. Okafor", ago(10 * DAY), "Appointment booked", "Appointment held"),
        ev("D. Okafor", ago(5 * DAY), "lost"),
      ],
    },
  ];
}

/** For readers outside the board (Leadership, Jarvis), which only need stages and values. */
export const SEED_DEALS: PipelineDeal[] = seedDeals(Date.now());

/** Open pipeline in $k: every deal not yet won or lost ("$585k" → 585). */
export function openPipelineK(deals: PipelineDeal[]): number {
  return deals.filter(isOpenDeal).reduce((sum, d) => sum + dealValueK(d), 0);
}

/** 2990 → "$2.99m". */
export const millionsFromK = (k: number) => `$${(k / 1000).toFixed(2)}m`;

/* ── My clients · To-dos ───────────────────────────────────────────────── */

export interface Todo {
  t: string;
  done: boolean;
}

export const SEED_TODOS: Todo[] = [
  { t: "Send progress update to R. de Thierry and J. Kumar", done: false },
  { t: "Chase finance pre-approval — P. Okonkwo", done: false },
  { t: "Book prestart appointment for B. Barber", done: true },
];

/* ── Under construction ────────────────────────────────────────────────── */

export interface BuildHome {
  jobNo: string;
  addr: string;
  builder: string;
  plan: string;
  storey: string;
  stage: string;
  /** Build progress, 0–100. 90+ reads as "Nearing handover". */
  pct: number;
  next: string;
  eta: string;
  photos: number;
  /** Date of the newest portal photo. */
  shot: string;
}

export const BUILD_HOMES: BuildHome[] = [
  { jobNo: "25431", addr: "Lot 361, 8 Camperdown Way, Lakelands", builder: "Forma", plan: "The Aspen", storey: "Single", stage: "Practical Completion", pct: 95, next: "Key Handover", eta: "22 Aug", photos: 6, shot: "04 Aug" },
  { jobNo: "25478", addr: "Lot 22, 14 Marlin Rise, Yanchep", builder: "Forma", plan: "The Aspen", storey: "Single", stage: "Lock Up", pct: 70, next: "Practical Completion", eta: "18 Sep", photos: 4, shot: "05 Aug" },
  { jobNo: "25211", addr: "Lot 574, 32 Zodiac Street, Wellard", builder: "Move Homes", plan: "The Marlow", storey: "Single", stage: "Plate Height", pct: 45, next: "Roof Cover", eta: "02 Oct", photos: 3, shot: "01 Aug" },
  { jobNo: "25302", addr: "Lot 118, 22 Karri Loop, Baldivis", builder: "La Vida", plan: "The Hartley", storey: "Double", stage: "Slab Down", pct: 25, next: "Plate Height", eta: "14 Nov", photos: 2, shot: "28 Jul" },
  { jobNo: "23901", addr: "Lot 9, 3 Bellbird Way, Byford", builder: "New Era", plan: "The Aspen", storey: "Single", stage: "Roof Cover", pct: 60, next: "Lock Up", eta: "26 Sep", photos: 5, shot: "06 Aug" },
];

export const ALL_PLANS = "All plans";

/* ── Exclusive land ────────────────────────────────────────────────────── */

export const ESTATE_FILTERS = [
  "All estates",
  "Yanchep Golf Estate",
  "The Gardens, Lakelands",
  "Mojo, Cockburn Central",
  "Kingsford, Bullsbrook",
  "South West",
] as const;
export type EstateFilter = (typeof ESTATE_FILTERS)[number];

export type LotStatus = "available" | "hold" | "sold";

export interface LandLot {
  id: string;
  lot: string;
  estate: string;
  builder: string;
  status: LotStatus;
  price: string;
  specs: string;
  titled: string;
  note?: string;
  /** Who holds (or sold) the lot. */
  holder?: string;
  expires?: string;
  /** Holds already queued on the lot, the current holder included. */
  queue?: number;
  /** The signed-in rep placed the hold. */
  mine?: boolean;
  /** The signed-in rep's place in the hold queue, when they joined it. */
  queuedAt?: number;
}

/** Up to three holds queue per lot. */
export const HOLD_QUEUE_MAX = 3;

export const SEED_LOTS: LandLot[] = [
  {
    id: "lot-318",
    lot: "Lot 318 Impact Grove, Yanchep",
    estate: "Yanchep Golf Estate",
    builder: "Any builder",
    status: "available",
    price: "Land $364k",
    specs: "319 sqm · 8.97m frontage · RMD-R40",
    titled: "Titled",
    note: "$15k rebate — BAL 12.5 and noise package B",
  },
  {
    id: "lot-347",
    lot: "Lot 347 Endcliffe Road, Lakelands",
    estate: "The Gardens",
    builder: "New Choice",
    status: "available",
    price: "Land $365k",
    specs: "315 sqm · 10.5m frontage",
    titled: "Title ETA 30 Sep",
    note: "",
  },
  {
    id: "lot-452",
    lot: "Lot 452 Mayfield Way, Lakelands",
    estate: "The Gardens",
    builder: "La Vida",
    status: "hold",
    price: "Package $791k · The Score",
    specs: "315 sqm · 10.5m frontage",
    titled: "Title ETA 30 Sep",
    holder: "P. Bungard",
    expires: "Hold expires 11:42am tomorrow",
    queue: 1,
  },
  {
    id: "lot-353",
    lot: "Lot 353 Endcliffe Road, Lakelands",
    estate: "The Gardens",
    builder: "La Vida",
    status: "sold",
    price: "Package $836k · The Reveal",
    specs: "391 sqm · 11.86m frontage",
    titled: "Title ETA 30 Sep",
    holder: "M. Fox",
  },
];

/** "The Gardens, Lakelands" chip → lots in "The Gardens". */
export function lotMatchesEstate(lot: LandLot, filter: EstateFilter): boolean {
  return filter === "All estates" || filter === lot.estate || filter.startsWith(`${lot.estate},`);
}

/* ── Team · headline cards ─────────────────────────────────────────────── */

/** Sales won · quarter to date — [rep, sales, value]. Bars are sales / 7. */
export const SALES_WON_QTD: [string, number, string][] = [
  ["A. Mercer", 7, "$4.31m"],
  ["K. Ellery", 6, "$3.78m"],
  ["D. Okafor", 4, "$2.49m"],
];

/** Client jobs by stage — [rep, precon, construction, handed over]. */
export const JOBS_BY_STAGE: [string, number, number, number][] = [
  ["A. Mercer", 3, 9, 2],
  ["K. Ellery", 4, 7, 1],
  ["D. Okafor", 2, 5, 3],
];

export interface DiscountApproval {
  id: string;
  client: string;
  plan: string;
  discount: number;
  contribution: number;
  rep: string;
}

export const SEED_DISCOUNTS: DiscountApproval[] = [
  { id: "disc-tan", client: "L. Tan", plan: "The Aspen · Forma", discount: 8500, contribution: 3500, rep: "K. Ellery" },
  { id: "disc-whitfield", client: "R. Whitfield", plan: "The Halcyon · New Choice", discount: 6000, contribution: 1000, rep: "A. Mercer" },
];

/** Stage report by rep — deals: [rep, [appt booked, appt held, potential sale, sale won MTD], pipeline commission]. */
export const STAGE_REPORT_DEALS: [string, number[], string][] = [
  ["A. Mercer", [2, 1, 2, 1], "$210k"],
  ["K. Ellery", [3, 1, 1, 2], "$245k"],
  ["D. Okafor", [1, 1, 2, 1], "$175k"],
];

/** [label, value, needs attention]. */
export const STAGE_REPORT_STATS: [string, string, boolean][] = [
  ["Appt booked", "avg 4 days", false],
  ["Appt held", "avg 6 days", false],
  ["Potential sale", "avg 9 days", false],
  ["Stale deals (14+ days)", "2", true],
  ["Over capacity", "K. Ellery · 8 leads in New", true],
];

/** Stage report by rep — leads: [rep, [new, attempting, connected, qualified]]. */
export const STAGE_REPORT_LEADS: [string, number[]][] = [
  ["A. Mercer", [6, 4, 3, 2]],
  ["K. Ellery", [8, 5, 2, 3]],
  ["D. Okafor", [4, 3, 3, 1]],
];

export interface TeamTask {
  id: string;
  task: string;
  rep: string;
  due: string;
  /** Overdue or due today — counted in the Overdue tasks tile. */
  flag: boolean;
}

export const SEED_TEAM_TASKS: TeamTask[] = [
  { id: "task-okonkwo", task: "Chase finance pre-approval — P. Okonkwo", rep: "A. Mercer", due: "2 days overdue", flag: true },
  { id: "task-s117", task: "Upload signed contract pack — S-117", rep: "A. Mercer", due: "1 day overdue", flag: true },
  { id: "task-carmody", task: "Send settlement congratulations — Carmody", rep: "D. Okafor", due: "Due today", flag: true },
  { id: "task-nguyen", task: "Book prestart — T. Nguyen", rep: "K. Ellery", due: "Due Friday", flag: false },
];

/* ── Team · Weekly scorecard (the mockup's `fm`) ───────────────────────── */

export const PERIODS = ["Last week", "This month", "This quarter"] as const;
export type Period = (typeof PERIODS)[number];

/** The HubSpot owner groups (`ac`). "All sales" is every rep. */
export const TEAMS: Record<string, string[]> = {
  "Quentin's reps": [
    "Monique Juratovac",
    "Kate Grierson",
    "Tayla Juratovac",
    "Kristen Margetts",
    "Rachal Maffina",
    "Lori Pirozzi",
    "Jesse Williamson",
    "James Francis",
    "Emily Dann",
    "Shea Connolly",
    "Audris Quek",
    "Steve Ross",
  ],
  "Locale Homes Sales": [
    "Brendan Ford",
    "Lori Pirozzi",
    "Natalie Mason",
    "Krystal Mosca",
    "James Francis",
    "Nathan Good",
    "Oumi Kapila",
    "Thales Ferreira",
    "Pryncess Bungard",
    "Shea Connolly",
    "Josh Beardsell",
    "Kathryn Carr",
  ],
  "HOMES | 2nd Opportunity": [
    "Rachal Maffina",
    "Kristen Margetts",
    "Kate Grierson",
    "Emily Dann",
    "Ciaran Fahy",
    "Monique Juratovac",
    "Jordan Dench",
    "Jesse Williamson",
  ],
};

export const TEAM_FILTERS = ["Quentin's reps", "Locale Homes Sales", "HOMES | 2nd Opportunity", "All sales"] as const;
export type TeamFilter = (typeof TEAM_FILTERS)[number];

export function inTeam(team: TeamFilter, rep: string): boolean {
  return team === "All sales" || (TEAMS[team] ?? []).includes(rep);
}

export interface ScorecardWidget {
  t: string;
  sub: string;
  d: [string, number][];
  /** A number you want low — bars read as a warning. */
  alert?: boolean;
}

export const SCORECARD_WIDGETS: ScorecardWidget[] = [
  {
    t: "New enquiries per rep",
    sub: "Contact owner",
    d: [
      ["Monique Juratovac", 25],
      ["Kate Grierson", 24],
      ["Tayla Juratovac", 23],
      ["Kristen Margetts", 15],
      ["Rachal Maffina", 15],
      ["Lori Pirozzi", 14],
      ["Jesse Williamson", 13],
      ["James Francis", 13],
      ["Emily Dann", 3],
    ],
  },
  {
    t: "Calls made",
    sub: "Activity assigned to",
    d: [
      ["James Francis", 187],
      ["Monique Juratovac", 151],
      ["Kate Grierson", 137],
      ["Rachal Maffina", 121],
      ["Jesse Williamson", 105],
      ["Lori Pirozzi", 98],
      ["Kristen Margetts", 86],
      ["Emily Dann", 74],
      ["Tayla Juratovac", 56],
      ["Shea Connolly", 45],
    ],
  },
  {
    t: "Connected calls",
    sub: "Connected of total",
    d: [
      ["Monique Juratovac", 24],
      ["Kate Grierson", 16],
      ["Jesse Williamson", 15],
      ["Shea Connolly", 12],
      ["Tayla Juratovac", 9],
      ["Emily Dann", 4],
      ["Rachal Maffina", 3],
      ["Lori Pirozzi", 1],
      ["James Francis", 0],
    ],
  },
  {
    t: "1st appointments booked",
    sub: "Deal owner",
    d: [
      ["Kate Grierson", 5],
      ["James Francis", 5],
      ["Lori Pirozzi", 4],
      ["Tayla Juratovac", 1],
      ["Kristen Margetts", 1],
    ],
  },
  {
    t: "1st appointments held",
    sub: "Deal owner",
    d: [
      ["Tayla Juratovac", 3],
      ["Lori Pirozzi", 3],
      ["Kristen Margetts", 2],
      ["James Francis", 2],
      ["Shea Connolly", 1],
      ["Kate Grierson", 1],
    ],
  },
  {
    t: "Engagement fees taken",
    sub: "Deal owner",
    d: [["James Francis", 1]],
  },
  {
    t: "Deals won",
    sub: "Deal owner",
    d: [
      ["Lori Pirozzi", 2],
      ["Tayla Juratovac", 1],
      ["Steve Ross", 1],
    ],
  },
  {
    t: "Cancelled jobs",
    sub: "All time",
    d: [
      ["Tayla Juratovac", 19],
      ["Lori Pirozzi", 4],
      ["Shea Connolly", 3],
      ["James Francis", 2],
      ["Audris Quek", 1],
      ["Rachal Maffina", 1],
    ],
    alert: true,
  },
  {
    t: "Client reviews posted",
    sub: "All time",
    d: [
      ["Tayla Juratovac", 7],
      ["Kristen Margetts", 3],
      ["Lori Pirozzi", 3],
      ["Shea Connolly", 2],
      ["James Francis", 2],
      ["Audris Quek", 1],
      ["Monique Juratovac", 1],
    ],
  },
];

/** Team against team (All sales) — [team, reps, calls, connected, appts, won]. */
export const TEAM_AGAINST_TEAM: [string, number, number, number, number, number][] = [
  ["Quentin's reps", 12, 145, 66, 11, 4],
  ["Locale Homes Sales", 12, 98, 41, 7, 3],
  ["HOMES | 2nd Opportunity", 8, 132, 58, 9, 2],
];

/** Builder columns of the forecast table: [short heading, builder]. */
export const FORECAST_BUILDERS: [string, string][] = [
  ["Move", "Move Homes"],
  ["Forma", "Forma"],
  ["Endeav.", "Endeavour"],
  ["101 Res", "101 Residential"],
  ["New Ch.", "New Choice"],
  ["New Era", "New Era"],
  ["Select", "Select"],
];

/** Per rep, per builder: [signed, forecast]. */
export type ForecastRow = [string, [number, number][]];

export const FORECAST: Record<Period, ForecastRow[]> = {
  "Last week": [
    ["Tayla Juratovac", [[2, 3], [1, 2], [0, 0], [0, 1], [1, 1], [0, 0], [0, 0]]],
    ["Lori Pirozzi", [[1, 2], [2, 2], [0, 1], [0, 0], [0, 1], [1, 1], [0, 0]]],
    ["James Francis", [[0, 1], [1, 1], [0, 0], [0, 0], [0, 0], [0, 1], [1, 1]]],
    ["Kate Grierson", [[1, 1], [0, 1], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0]]],
    ["Shea Connolly", [[0, 0], [0, 1], [0, 0], [0, 0], [1, 1], [0, 0], [0, 0]]],
  ],
  "This month": [
    ["Tayla Juratovac", [[4, 3], [2, 2], [0, 0], [1, 1], [1, 1], [0, 0], [0, 0]]],
    ["Lori Pirozzi", [[2, 2], [3, 2], [0, 1], [0, 0], [1, 1], [1, 1], [0, 0]]],
    ["James Francis", [[1, 1], [1, 1], [0, 0], [0, 0], [0, 0], [0, 1], [1, 1]]],
    ["Kate Grierson", [[1, 1], [1, 1], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0]]],
    ["Shea Connolly", [[0, 0], [1, 1], [0, 0], [0, 0], [1, 1], [0, 0], [0, 0]]],
  ],
  "This quarter": [
    ["Tayla Juratovac", [[11, 10], [6, 6], [0, 1], [2, 2], [3, 3], [1, 1], [0, 0]]],
    ["Lori Pirozzi", [[7, 8], [8, 7], [1, 2], [0, 1], [2, 3], [3, 3], [0, 0]]],
    ["James Francis", [[3, 4], [4, 4], [0, 0], [1, 1], [0, 1], [2, 2], [2, 2]]],
    ["Kate Grierson", [[4, 4], [3, 4], [0, 0], [0, 0], [1, 1], [0, 0], [0, 0]]],
    ["Shea Connolly", [[2, 2], [3, 3], [0, 1], [0, 0], [2, 2], [1, 1], [0, 0]]],
  ],
};

export const FORECAST_NOTE: Record<Period, string> = {
  "Last week":
    "Showing deals signed in the week ending Sun 9 Aug, against the month forecast each rep submitted that Monday. Forecasts are monthly, so the weekly column is progress toward it, not a weekly target.",
  "This month":
    "Showing deals signed so far in August against each rep's latest August forecast. Forecasts are restated every Monday, so the most recent submission is used — they are never added together.",
  "This quarter":
    "Showing deals signed this quarter against the sum of each month's final forecast. July and August are settled; September uses the latest submission.",
};

/** Locale Financial attach rate — [rep, internal, external, cash]. */
export const ATTACH_RATE: [string, number, number, number][] = [
  ["Tayla Juratovac", 65, 10, 1],
  ["Lori Pirozzi", 20, 17, 1],
  ["Shea Connolly", 8, 21, 0],
  ["Rachal Maffina", 9, 11, 0],
  ["James Francis", 7, 5, 1],
  ["Audris Quek", 6, 6, 0],
  ["Kristen Margetts", 7, 3, 0],
  ["Kate Grierson", 4, 0, 0],
  ["Monique Juratovac", 4, 2, 0],
];
