/**
 * Leadership — static figures from the mockup (Reference/locale-launchpad 1.html,
 * components `wm` Business dashboard and `km` Custom dashboard, data array `ts`).
 * Strings are Locale's words, copied verbatim. Nothing here is fetched.
 */

export const LEADERSHIP_TABS = ["overview", "business", "custom"] as const;
export type LeadershipTab = (typeof LEADERSHIP_TABS)[number];

/* ── Business dashboard ─────────────────────────────────────────────── */

export const OVERVIEW_KPIS = {
  salesThisMonth: 4,
  activeBuilds: 223,
  handoversYtd: 61,
  avgDaysSiteToKeys: 312,
} as const;

/** Sales won by month. August is month to date. */
export const SALES_BY_MONTH: { month: string; value: number; partial?: boolean }[] = [
  { month: "Mar", value: 6 },
  { month: "Apr", value: 9 },
  { month: "May", value: 7 },
  { month: "Jun", value: 11 },
  { month: "Jul", value: 13 },
  { month: "Aug", value: 4, partial: true },
];

export type BuilderSlot = "forma" | "move" | "lavida" | "newchoice" | "newera";

/** Active builds by builder, as a share of all active builds (sums to 100). */
export const BUILDS_BY_BUILDER: { builder: string; pct: number; slot: BuilderSlot }[] = [
  { builder: "Forma", pct: 38, slot: "forma" },
  { builder: "Move Homes", pct: 27, slot: "move" },
  { builder: "La Vida", pct: 18, slot: "lavida" },
  { builder: "New Choice", pct: 10, slot: "newchoice" },
  { builder: "New Era", pct: 7, slot: "newera" },
];

/** Pipeline value by stage — `share` is the stage's % of the whole pipeline. */
export const PIPELINE_BY_STAGE: { stage: string; value: string; share: number }[] = [
  { stage: "Appointment booked", value: "$1.19m", share: 34 },
  { stage: "Appointment held", value: "$0.54m", share: 16 },
  { stage: "Potential sale", value: "$1.25m", share: 36 },
  { stage: "Sale won (MTD)", value: "$0.63m", share: 18 },
];

/** Sync health rows. "Open conflicts" is read live from the job store instead. */
export const SYNC_HEALTH_STATIC: { label: string; value: string }[] = [
  { label: "Updates fanned out today", value: "17" },
  { label: "Median sync latency", value: "6.2s" },
  { label: "Pending retries", value: "2" },
];

/* ── Custom dashboard ───────────────────────────────────────────────── */

export const METRIC_GROUPS = ["Sales", "Operations", "Accounts", "Marketing", "People"] as const;
export type MetricGroup = (typeof METRIC_GROUPS)[number];

export type MetricId =
  | "won"
  | "pipe"
  | "conv"
  | "byrep"
  | "sync"
  | "milestone"
  | "subs"
  | "cash"
  | "forecast"
  | "drafts"
  | "spend"
  | "channel"
  | "head"
  | "leave";

export type MetricType = "kpi" | "table" | "bars";

export interface Metric {
  id: MetricId;
  group: MetricGroup;
  label: string;
  type: MetricType;
  /** KPI value (pre-formatted; counts up). */
  value?: string;
  /** KPI supporting line. */
  delta?: string;
}

/** The metric library (`ts` in the mockup), in library order. */
export const METRICS: Metric[] = [
  { id: "won", group: "Sales", label: "Deals won", value: "42", delta: "+6 vs last month", type: "kpi" },
  { id: "pipe", group: "Sales", label: "Pipeline value", value: "$630k", delta: "commission basis", type: "kpi" },
  { id: "conv", group: "Sales", label: "Lead to deal", value: "8.4%", delta: "+0.9 pts", type: "kpi" },
  { id: "byrep", group: "Sales", label: "Deals by rep", type: "table" },
  { id: "sync", group: "Operations", label: "Sync health", value: "99.2%", delta: "1 conflict open", type: "kpi" },
  { id: "milestone", group: "Operations", label: "Milestones this month", value: "118", delta: "94 auto, 24 manual", type: "kpi" },
  { id: "subs", group: "Operations", label: "Submissions in review", value: "7", delta: "avg 31 min to approve", type: "kpi" },
  { id: "cash", group: "Accounts", label: "Commission invoiced", value: "$487k", delta: "+12% vs last month", type: "kpi" },
  { id: "forecast", group: "Accounts", label: "Forecast next 3 months", type: "bars" },
  { id: "drafts", group: "Accounts", label: "Draft invoices waiting", value: "3", delta: "$42.5k", type: "kpi" },
  { id: "spend", group: "Marketing", label: "Marketing spend", value: "$55.7k", delta: "$1,326 per deal", type: "kpi" },
  { id: "channel", group: "Marketing", label: "Deals won by channel", type: "table" },
  { id: "head", group: "People", label: "Headcount", value: "23", delta: "2 open roles", type: "kpi" },
  { id: "leave", group: "People", label: "On leave this week", value: "3", delta: "all covered", type: "kpi" },
];

export const METRIC_BY_ID = Object.fromEntries(METRICS.map((m) => [m.id, m])) as Record<MetricId, Metric>;

export const DEFAULT_SELECTION: MetricId[] = ["won", "cash", "sync", "forecast"];

export const PERIODS = ["This month", "This quarter", "Year to date"] as const;
export type Period = (typeof PERIODS)[number];

/** Commission receipts forecast, $k. October is the peak. */
export const FORECAST: { month: string; value: number }[] = [
  { month: "Sep", value: 425 },
  { month: "Oct", value: 512 },
  { month: "Nov", value: 468 },
];

export const DEALS_BY_REP: { rep: string; deals: number; value: string }[] = [
  { rep: "K. Ellery", deals: 14, value: "$245k" },
  { rep: "A. Mercer", deals: 12, value: "$210k" },
  { rep: "D. Okafor", deals: 9, value: "$175k" },
];

export const DEALS_BY_CHANNEL: { channel: string; won: number }[] = [
  { channel: "Google search", won: 12 },
  { channel: "Referral", won: 11 },
  { channel: "Meta ads", won: 9 },
  { channel: "Display homes", won: 8 },
  { channel: "Organic", won: 5 },
];

export const SAVED_VIEWS: { name: string; active: boolean }[] = [
  { name: "Monday leadership board", active: true },
  { name: "Cashflow only, for Aled", active: false },
  { name: "Sales performance, weekly", active: false },
];

/* ── Jarvis ─────────────────────────────────────────────────────────── */

export const JARVIS_SUGGESTIONS = [
  "What does cash look like next month?",
  "Which channel gives the cheapest deals?",
  "Any sync risk I should know about?",
];

/**
 * Simulated answers. The first entry with a keyword contained in the question
 * wins (substring match, in this order — same as the mockup). `add` is the
 * metric Jarvis puts on the dashboard.
 */
export const JARVIS_ANSWERS: { keys: string[]; answer: string; add: MetricId }[] = [
  {
    keys: ["margin", "profit", "commission per", "average"],
    answer:
      "Average commission per deal is $11,580 this quarter, up from $10,940 last quarter. The lift is mostly mix: New Era and New Choice deals carry three invoice stages instead of two.",
    add: "cash",
  },
  {
    keys: ["marketing", "spend", "channel", "roi", "cost per"],
    answer:
      "Referral is your cheapest channel at $291 per deal won, Meta the most expensive at $2,044. Meta is also under-credited, since 23 closed-won deals lost their source tag, so its true cost per deal is lower than reported.",
    add: "spend",
  },
  {
    keys: ["rep", "who", "performance", "team"],
    answer:
      "K. Ellery leads on volume with 14 deals won, A. Mercer on value at $245k commission pipeline. Two deals have sat in Potential sale for more than 14 days, both with D. Okafor.",
    add: "byrep",
  },
  {
    keys: ["cash", "forecast", "next", "month"],
    answer:
      "September looks like $425k in commission receipts, October $512k. That assumes the current lodge-to-invoice lag of about 60 days holds, and it excludes the 3 draft invoices still waiting on approval.",
    add: "forecast",
  },
  {
    keys: ["sync", "risk", "problem", "wrong", "issue"],
    answer:
      "One sync conflict is open on job 25501, where Monday and HubSpot disagree on the Plate Height date. Nothing else has failed in the last 30 days. 24 of 118 milestone updates were still entered by hand, mostly New Era.",
    add: "sync",
  },
];

export const JARVIS_FALLBACK =
  "Jarvis can answer from anything mirrored in Launchpad: deals, milestones, invoices, marketing spend and people. Try asking about cash forecast, channel cost per deal, rep performance or sync risk.";

/** Simulated "Reading your data…" delay, ms. */
export const JARVIS_DELAY_MS = 1100;

export const REPORT_SUMMARY =
  " Deals won are ahead of last month and commission invoiced is up 12 per cent. Cash receipts should stay strong into October on current lodgement rates. Watch two things: three draft invoices worth $42.5k are still waiting on approval, and one sync conflict remains open on job 25501.";
