import { DASHBOARDS, STAFF, dashboardById, spaceOf } from "@/components/shell/dashboards";
import type { ModuleId } from "@/state/launchpad-store";
import type { PillTone } from "@/components/ui/pill";
import { ORG_SEED } from "@/components/modules/hr/data";

/**
 * Tickets — Simple HRIS's developer board (`/tickets`, `lib/tickets/types.ts`)
 * as a Launchpad dashboard. Anyone raises a ticket asking for an improvement
 * to a dashboard; the AI & Growth team works it across four columns. Projects
 * group tickets, and a project's progress is its done tickets over all of them.
 *
 * The vocabulary is declared once, here: statuses, priorities, their labels
 * and colours, the ticket number format and the projects. The rules (board
 * order, the history a save writes, every figure quoted) live in `logic.ts`.
 *
 * Static: the seed below plus an in-memory store (`state/tickets-store.tsx`).
 * A reload resets to the seed. Seed contents are sample data.
 */

export const TICKETS_TABS = ["overview", "board", "projects", "archived"] as const;
export type TicketsTab = (typeof TICKETS_TABS)[number];

/* ── Columns ───────────────────────────────────────────────────────────── */

export const TICKET_STATUSES = ["todo", "in_progress", "testing", "done"] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];

export const STATUS_LABEL: Record<TicketStatus, string> = {
  todo: "To Do",
  in_progress: "In Progress",
  testing: "Testing",
  done: "Done",
};

/**
 * A column's colour steps from grey through the dashboard's tone to emerald,
 * the way Sales' stages do. To Do sits a step lighter than Sales' first
 * stage, so it stays apart from In Progress on the charcoal tone, whose
 * half-strength fill is the same grey. Used for the column dot, the board
 * split and the dialog's Column field, always beside the column's name.
 */
export const STATUS_FILL: Record<TicketStatus, string> = {
  todo: "bg-zinc-300 dark:bg-zinc-600",
  in_progress: "bg-tone-strong/55",
  testing: "bg-tone-strong",
  done: "bg-emerald-500",
};

/* ── Priority ──────────────────────────────────────────────────────────── */

export const TICKET_PRIORITIES = ["low", "medium", "high", "urgent"] as const;
export type TicketPriority = (typeof TICKET_PRIORITIES)[number];

/**
 * Priority is a verdict, so urgent and high take status colours. Medium and
 * low are greys told apart by their word. Same hue on the card, the chart and
 * the dialog.
 */
export const PRIORITY_STYLES: Record<TicketPriority, { label: string; chip: string; dot: string; bar: string }> = {
  urgent: {
    label: "Urgent",
    chip: "bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300",
    dot: "bg-rose-500",
    bar: "bg-rose-500",
  },
  high: {
    label: "High",
    chip: "bg-amber-50 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300",
    dot: "bg-amber-500",
    bar: "bg-amber-500",
  },
  medium: {
    label: "Medium",
    chip: "bg-zinc-100 text-zinc-700 dark:bg-white/10 dark:text-zinc-200",
    dot: "bg-zinc-500 dark:bg-zinc-400",
    bar: "bg-zinc-500 dark:bg-zinc-400",
  },
  low: {
    label: "Low",
    chip: "bg-muted text-muted-foreground",
    dot: "bg-zinc-300 dark:bg-zinc-600",
    bar: "bg-zinc-300 dark:bg-zinc-600",
  },
};

/** "LP-118". The prefix keeps it apart from IT Help desk's "#214". */
export const formatTicketNo = (no: number) => `LP-${no}`;

/* ── Dashboards a ticket can be about ──────────────────────────────────── */

/** Every Launchpad dashboard, then the staff portals (Employee, Sales Representative). Client and Developer preview outsiders' views. */
export const TICKET_DASHBOARDS: ModuleId[] = DASHBOARDS.filter((d) => spaceOf(d) === "launchpad" || d.id === "employee" || d.id === "consultant").map(
  (d) => d.id,
);

/** "Sales Manager", "Employee portal", "Sales Representative". */
export function dashboardName(id: ModuleId): string {
  const d = dashboardById(id);
  return spaceOf(d) === "portal" ? d.title : d.label;
}

/* ── Projects ──────────────────────────────────────────────────────────── */

export type ProjectState = "In build" | "Validation" | "Deploying";

export const PROJECT_STATE_TONE: Record<ProjectState, PillTone> = {
  "In build": "tone",
  Validation: "pending",
  Deploying: "charcoal",
};

export interface Project {
  id: string;
  name: string;
  /** Org-chart seat id. */
  owner: string;
  /** A stage the owner declares, not something the tickets can tell. */
  state: ProjectState;
}

/** The four projects that were the Projects dashboard. Fixed: there's no creating or renaming them here. */
export const PROJECTS: Project[] = [
  { id: "crm-dash-sync", name: "Launchpad V1 · CRM Dash Sync", owner: "jerry-delos-santos", state: "In build" },
  { id: "pricing-hub", name: "Locale Pricing Hub", owner: "jerry-delos-santos", state: "In build" },
  { id: "health-check", name: "Finance Health Check form", owner: "pablo-lopez", state: "Validation" },
  { id: "lastpass", name: "LastPass rollout", owner: "pablo-lopez", state: "Deploying" },
];

export const PROJECT_BY_ID: Record<string, Project> = Object.fromEntries(PROJECTS.map((p) => [p.id, p]));

/* ── People ────────────────────────────────────────────────────────────── */

/** HRIS's TICKET_BOARD_OWNER: Kane. New tickets go to them by default. */
export const BOARD_OWNER = "jan-kane-reroma";

/** Who a ticket can be assigned to: the AI & Growth seats. An assumption, not confirmed. */
export const ASSIGNEES: readonly string[] = ["jan-kane-reroma", "jerry-delos-santos", "pablo-lopez", "andre-mikhail-serra"];

/** Who board edits (move, save, reply, archive, restore) are made as, until there's sign-in: the rail's staff persona. */
export const BOARD_ACTOR = STAFF.name;

const SEATS = new Map(ORG_SEED.map((p) => [p.id, p]));

/** A seat's holder: "Jan Kane Reroma". */
export const seatName = (id: string | null) => (id ? (SEATS.get(id)?.name ?? id) : null);

/* ── Tickets ───────────────────────────────────────────────────────────── */

export interface TicketReply {
  id: string;
  author: string;
  body: string;
  at: number;
}

export type TicketAction = "created" | "updated" | "moved" | "archived" | "restored";
export type TicketField = "title" | "details" | "dashboard" | "project" | "priority" | "status" | "assignee";

export interface TicketChange {
  field: TicketField;
  from: string | null;
  to: string | null;
}

export interface TicketEvent {
  id: string;
  actor: string;
  at: number;
  action: TicketAction;
  changes?: TicketChange[];
}

export interface Ticket {
  no: number;
  title: string;
  details: string;
  /** The dashboard the ticket improves. */
  dashboard: ModuleId;
  /** The project it belongs to, if any. */
  project: string | null;
  priority: TicketPriority;
  status: TicketStatus;
  /** Display name of whoever the rail showed when it was raised. */
  raisedBy: string;
  /** Org-chart seat id. */
  assignee: string | null;
  createdAt: number;
  updatedAt: number;
  /** Set when archived: a soft delete. It leaves the board and can be restored. */
  archived: { at: number; by: string } | null;
  replies: TicketReply[];
  history: TicketEvent[];
}

/* ── Seed ──────────────────────────────────────────────────────────────── */

const DAY = 86_400_000;

interface SeedRow {
  no: number;
  title: string;
  details?: string;
  dashboard: ModuleId;
  project?: string;
  priority: TicketPriority;
  raisedBy: string;
  assignee: string;
  /** Days ago it was raised. */
  age: number;
  /** Column moves: where to, how many days ago, by whom. The last one is where it sits. */
  moves?: [TicketStatus, number, string][];
  replies?: [author: string, age: number, body: string][];
  archived?: [age: number, by: string];
}

const KANE = "Jan Kane Reroma";
const JERRY = "Jerry Delos Santos";
const PABLO = "Pablo Lopez";
const ANDRE = "Andre Mikhail Serra";

/**
 * LP-83 to LP-99 are the projects' tickets, all over two weeks old: the nine
 * Launchpad V1 task-list items in the columns they were in, then Pricing Hub,
 * Health Check and LastPass. LP-100 to LP-111 are sample improvement asks
 * about real dashboards. Ages sit well clear of the 7- and 14-day lines, so
 * "this week" counts hold whenever the demo runs.
 */
const SEED: SeedRow[] = [
  // Launchpad V1 · CRM Dash Sync
  {
    no: 83,
    title: "Board + automation audit",
    details: "List every Monday board and automation the sync touches, and who owns each.",
    dashboard: "operations",
    project: "crm-dash-sync",
    priority: "medium",
    raisedBy: JERRY,
    assignee: "jerry-delos-santos",
    age: 45,
    moves: [["in_progress", 42, JERRY], ["done", 30, JERRY]],
  },
  {
    no: 84,
    title: "Launchpad UI build",
    details: "The static Launchpad in Next.js with the HRIS shell, in Locale's brand.",
    dashboard: "operations",
    project: "crm-dash-sync",
    priority: "high",
    raisedBy: JERRY,
    assignee: "jan-kane-reroma",
    age: 44,
    moves: [["in_progress", 40, KANE], ["testing", 24, KANE], ["done", 18, JERRY]],
  },
  {
    no: 85,
    title: "Test workspace mirrors",
    details: "Mirror the HubSpot and Monday sandboxes so a sync can be tested end to end.",
    dashboard: "operations",
    project: "crm-dash-sync",
    priority: "medium",
    raisedBy: JERRY,
    assignee: "pablo-lopez",
    age: 42,
    moves: [["in_progress", 21, PABLO], ["testing", 9.5, PABLO], ["done", 5, JERRY]],
    replies: [[PABLO, 9.5, "Both sandboxes mirror now. Sync ran clean on 12 test jobs."]],
  },
  {
    no: 86,
    title: "Monday → HubSpot milestone sync",
    details: "Push milestone dates from Monday to the HubSpot deal, behind the review queue for money milestones.",
    dashboard: "operations",
    project: "crm-dash-sync",
    priority: "high",
    raisedBy: JERRY,
    assignee: "jerry-delos-santos",
    age: 40,
    moves: [["in_progress", 16, JERRY]],
  },
  {
    no: 87,
    title: "Supabase schema + RLS",
    dashboard: "operations",
    project: "crm-dash-sync",
    priority: "high",
    raisedBy: JERRY,
    assignee: "pablo-lopez",
    age: 39,
    moves: [["in_progress", 12, PABLO]],
  },
  {
    no: 88,
    title: "v0 UI pass",
    details: "Tidy the CRM dash sync screens before Operations starts using them daily.",
    dashboard: "operations",
    project: "crm-dash-sync",
    priority: "medium",
    raisedBy: JERRY,
    assignee: "jan-kane-reroma",
    age: 38,
    moves: [["in_progress", 10.5, KANE]],
  },
  {
    no: 89,
    title: "Entra app registration session",
    dashboard: "operations",
    project: "crm-dash-sync",
    priority: "medium",
    raisedBy: JERRY,
    assignee: "pablo-lopez",
    age: 36,
  },
  {
    no: 90,
    title: "Capture sandbox stage IDs",
    dashboard: "operations",
    project: "crm-dash-sync",
    priority: "low",
    raisedBy: JERRY,
    assignee: "jerry-delos-santos",
    age: 35,
  },
  {
    no: 91,
    title: "Field matrix session w/ Shannan",
    details: "Walk every mirrored field with Shannan Murray and agree which system wins.",
    dashboard: "operations",
    project: "crm-dash-sync",
    priority: "medium",
    raisedBy: JERRY,
    assignee: "jerry-delos-santos",
    age: 34,
  },
  // Locale Pricing Hub
  {
    no: 92,
    title: "Import the builder price lists",
    dashboard: "operations",
    project: "pricing-hub",
    priority: "high",
    raisedBy: JERRY,
    assignee: "jerry-delos-santos",
    age: 33,
    moves: [["in_progress", 29, JERRY], ["done", 20, JERRY]],
  },
  {
    no: 93,
    title: "Margin rules per estate",
    details: "Let Operations set a margin per estate instead of one rate for every package.",
    dashboard: "operations",
    project: "pricing-hub",
    priority: "medium",
    raisedBy: JERRY,
    assignee: "andre-mikhail-serra",
    age: 32,
    moves: [["in_progress", 11, ANDRE]],
  },
  {
    no: 94,
    title: "Price-change alerts to Sales",
    dashboard: "operations",
    project: "pricing-hub",
    priority: "medium",
    raisedBy: JERRY,
    assignee: "andre-mikhail-serra",
    age: 31,
  },
  // Finance Health Check form
  {
    no: 95,
    title: "Question set signed off",
    dashboard: "finance",
    project: "health-check",
    priority: "high",
    raisedBy: PABLO,
    assignee: "pablo-lopez",
    age: 30,
    moves: [["in_progress", 28, PABLO], ["done", 25, PABLO]],
  },
  {
    no: 96,
    title: "Score weighting review with Brad",
    dashboard: "finance",
    project: "health-check",
    priority: "medium",
    raisedBy: PABLO,
    assignee: "pablo-lopez",
    age: 29,
    moves: [["in_progress", 22, PABLO], ["testing", 15.5, PABLO], ["done", 9.5, "Brad Linford"]],
    replies: [["Brad Linford", 9.5, "Weights look right. Income stability should count double, as we said."]],
  },
  // LastPass rollout
  {
    no: 97,
    title: "Enrol the Sales team",
    dashboard: "it",
    project: "lastpass",
    priority: "high",
    raisedBy: PABLO,
    assignee: "pablo-lopez",
    age: 28,
    moves: [["in_progress", 24, PABLO], ["done", 11, PABLO]],
  },
  {
    no: 98,
    title: "Move shared logins out of the Drive sheet",
    details: "Every shared login in the old spreadsheet goes into a LastPass shared folder, then the sheet is deleted.",
    dashboard: "it",
    project: "lastpass",
    priority: "urgent",
    raisedBy: PABLO,
    assignee: "pablo-lopez",
    age: 27.5,
    moves: [["in_progress", 10, PABLO]],
  },
  {
    no: 99,
    title: "Enforce MFA for admins",
    dashboard: "it",
    project: "lastpass",
    priority: "high",
    raisedBy: PABLO,
    assignee: "pablo-lopez",
    age: 26.5,
    moves: [["in_progress", 17, PABLO], ["testing", 3, PABLO]],
  },
  // Improvement asks
  {
    no: 100,
    title: "Sales › Pipeline: can't move deals on mobile",
    dashboard: "sales",
    priority: "high",
    raisedBy: "Jasmin Bainbridge",
    assignee: "jan-kane-reroma",
    age: 25,
    replies: [[KANE, 15, "Same ask as LP-104, which has more detail. Archiving this one."]],
    archived: [15, KANE],
  },
  {
    no: 101,
    title: "HR › Leave: show balances on the request form",
    details: "Staff keep asking HR how much leave they have left. Show it beside the dates as they pick them.",
    dashboard: "hr",
    priority: "medium",
    raisedBy: "Maria Soriano",
    assignee: "andre-mikhail-serra",
    age: 22,
    moves: [["in_progress", 8.5, ANDRE]],
  },
  {
    no: 102,
    title: "CRM dash sync: a resolved conflict keeps its red dot",
    details: "After resolving a conflict on the job page, the row still shows Conflict until a reload.",
    dashboard: "operations",
    priority: "urgent",
    raisedBy: "Larnie Clark",
    assignee: "jan-kane-reroma",
    age: 19.5,
    moves: [["in_progress", 4, KANE]],
    replies: [
      ["Larnie Clark", 18, "Happened twice this morning on Nguyen and Patel."],
      [KANE, 4, "Found it: the list reads a cached sync state. Fix is in progress."],
    ],
  },
  {
    no: 103,
    title: "Accounts › Builder invoicing: show when Xero last synced",
    dashboard: "accounts",
    priority: "medium",
    raisedBy: "Aled Smith",
    assignee: "andre-mikhail-serra",
    age: 17,
    moves: [["in_progress", 12, ANDRE], ["testing", 2, ANDRE]],
  },
  {
    no: 104,
    title: "Sales › Pipeline: drag cards on a phone",
    details:
      "On a phone the only way to move a deal is to open it and change the stage. A long-press to pick up the card would be quicker between appointments.",
    dashboard: "sales",
    priority: "high",
    raisedBy: "Michael Fox",
    assignee: "jan-kane-reroma",
    age: 15,
    replies: [
      [KANE, 13, "Long-press fights with scrolling the board sideways. Looking at a drag handle instead."],
      ["Michael Fox", 12.5, "A handle is fine, as long as it's big enough for a thumb."],
    ],
  },
  {
    no: 105,
    title: "Marketing › Attribution: export to CSV",
    dashboard: "marketing",
    priority: "low",
    raisedBy: "Kellie Boyer",
    assignee: "andre-mikhail-serra",
    age: 12.5,
    moves: [["in_progress", 8, ANDRE], ["testing", 4, ANDRE], ["done", 2, "Kellie Boyer"]],
  },
  {
    no: 106,
    title: "Home: let me pin my own shortcuts",
    dashboard: "home",
    priority: "low",
    raisedBy: STAFF.name,
    assignee: "jan-kane-reroma",
    age: 10.5,
  },
  {
    no: 107,
    title: "Employee portal: download an invoice as a PDF",
    details: "Some of us need a PDF copy for our own records and the BIR.",
    dashboard: "employee",
    priority: "medium",
    raisedBy: "Sarah Jasmin",
    assignee: "jan-kane-reroma",
    age: 8.5,
    moves: [["in_progress", 3, KANE]],
  },
  {
    no: 108,
    title: "Admin: filter the roster by who has never signed in",
    dashboard: "admin",
    priority: "medium",
    raisedBy: JERRY,
    assignee: "jan-kane-reroma",
    age: 5.5,
    moves: [["in_progress", 4.5, KANE], ["testing", 1.5, KANE]],
  },
  {
    no: 109,
    title: "Accounting: rename Pay run once Kane picks a name",
    details: "Pay run is a placeholder name. Swap it everywhere once there's a final one.",
    dashboard: "accounting",
    priority: "low",
    raisedBy: "Aled Smith",
    assignee: "jan-kane-reroma",
    age: 4,
  },
  {
    no: 110,
    title: "Health check: explain each score",
    details: "Clients see a score but not what moved it. A line under each score would stop the follow-up calls.",
    dashboard: "finance",
    project: "health-check",
    priority: "medium",
    raisedBy: "Brad Linford",
    assignee: "pablo-lopez",
    age: 2.5,
  },
  {
    no: 111,
    title: "Knowledge: search inside documents, not just titles",
    dashboard: "knowledge",
    priority: "medium",
    raisedBy: "Shannan Murray",
    assignee: "jan-kane-reroma",
    age: 1,
  },
];

/** The seed, stamped relative to `now` (when the store is created). */
export function seedTickets(now: number): Ticket[] {
  const at = (days: number) => Math.round(now - days * DAY);
  return SEED.map((s) => {
    const history: TicketEvent[] = [{ id: `${s.no}-e0`, actor: s.raisedBy, at: at(s.age), action: "created" }];
    let status: TicketStatus = "todo";
    for (const [to, age, actor] of s.moves ?? []) {
      history.push({
        id: `${s.no}-e${history.length}`,
        actor,
        at: at(age),
        action: "moved",
        changes: [{ field: "status", from: status, to }],
      });
      status = to;
    }
    if (s.archived) history.push({ id: `${s.no}-e${history.length}`, actor: s.archived[1], at: at(s.archived[0]), action: "archived" });
    const replies = (s.replies ?? []).map(([author, age, body], i) => ({ id: `${s.no}-r${i}`, author, body, at: at(age) }));
    const times = [...history.map((e) => e.at), ...replies.map((r) => r.at)];
    return {
      no: s.no,
      title: s.title,
      details: s.details ?? "",
      dashboard: s.dashboard,
      project: s.project ?? null,
      priority: s.priority,
      status,
      raisedBy: s.raisedBy,
      assignee: s.assignee,
      createdAt: at(s.age),
      updatedAt: Math.max(...times),
      archived: s.archived ? { at: at(s.archived[0]), by: s.archived[1] } : null,
      replies,
      history,
    };
  });
}
