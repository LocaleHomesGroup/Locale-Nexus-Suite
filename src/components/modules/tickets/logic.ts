import type { ModuleId } from "@/state/launchpad-store";
import {
  PROJECT_BY_ID,
  TICKET_PRIORITIES,
  TICKET_STATUSES,
  dashboardName,
  formatTicketNo,
  seatName,
  type Project,
  type Ticket,
  type TicketChange,
  type TicketPriority,
  type TicketStatus,
} from "./data";

/**
 * The board's rules, as pure functions over tickets: board order, numbering,
 * the history a save writes, and every figure the Overview, Projects and
 * Jarvis quote. Nothing here touches React or the store.
 */

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;

/* ── Order ─────────────────────────────────────────────────────────────── */

export const PRIORITY_RANK: Record<TicketPriority, number> = { urgent: 0, high: 1, medium: 2, low: 3 };

/** Within a column: urgent first, then oldest first. No manual reordering (a departure from HRIS). */
export function boardSort(a: Ticket, b: Ticket): number {
  return PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || a.createdAt - b.createdAt || a.no - b.no;
}

const live = (tickets: readonly Ticket[]) => tickets.filter((t) => !t.archived);

/** The four columns, archived tickets left out, each in board order. */
export function boardColumns(tickets: readonly Ticket[]): Record<TicketStatus, Ticket[]> {
  const cols = Object.fromEntries(TICKET_STATUSES.map((s) => [s, [] as Ticket[]])) as Record<TicketStatus, Ticket[]>;
  for (const t of live(tickets)) cols[t.status].push(t);
  for (const s of TICKET_STATUSES) cols[s].sort(boardSort);
  return cols;
}

/** Board order across the whole board: column by column, left to right. */
export function inBoardOrder(tickets: readonly Ticket[]): Ticket[] {
  const cols = boardColumns(tickets);
  return TICKET_STATUSES.flatMap((s) => cols[s]);
}

/** A new ticket gets the highest number yet + 1. */
export function nextTicketNo(tickets: readonly Ticket[]): number {
  return tickets.reduce((n, t) => Math.max(n, t.no), 99) + 1;
}

/* ── Edits ─────────────────────────────────────────────────────────────── */

/** What the dialog edits. `dashboard` is "" until one is chosen in a new ticket. */
export interface TicketDraft {
  title: string;
  details: string;
  dashboard: ModuleId | "";
  project: string | null;
  priority: TicketPriority;
  status: TicketStatus;
  assignee: string | null;
}

export function draftFromTicket(t: Ticket): TicketDraft {
  return {
    title: t.title,
    details: t.details,
    dashboard: t.dashboard,
    project: t.project,
    priority: t.priority,
    status: t.status,
    assignee: t.assignee,
  };
}

/** The field-level from → to diff a save writes to the history. Whitespace-only edits aren't changes. */
export function diffTicket(t: Ticket, d: TicketDraft): TicketChange[] {
  const out: TicketChange[] = [];
  const add = (field: TicketChange["field"], from: string | null, to: string | null) => {
    if ((from ?? null) !== (to ?? null)) out.push({ field, from, to });
  };
  add("title", t.title.trim(), d.title.trim());
  add("details", t.details.trim() || null, d.details.trim() || null);
  if (d.dashboard) add("dashboard", t.dashboard, d.dashboard);
  add("project", t.project, d.project);
  add("priority", t.priority, d.priority);
  add("status", t.status, d.status);
  add("assignee", t.assignee, d.assignee);
  return out;
}

/* ── Figures ───────────────────────────────────────────────────────────── */

/** When a ticket last reached Done, or null if it isn't done. */
export function doneAt(t: Ticket): number | null {
  if (t.status !== "done") return null;
  for (let i = t.history.length - 1; i >= 0; i--) {
    const e = t.history[i];
    if (e.changes?.some((c) => c.field === "status" && c.to === "done")) return e.at;
  }
  return t.createdAt;
}

export interface TicketStats {
  open: number;
  raisedThisWeek: number;
  raisedLastWeek: number;
  testing: number;
  doneThisWeek: number;
  /** The open ticket waiting longest. */
  oldestOpen: Ticket | null;
  urgentOpen: number;
  archived: number;
}

export function ticketStats(tickets: readonly Ticket[], now: number): TicketStats {
  const onBoard = live(tickets);
  const open = onBoard.filter((t) => t.status !== "done");
  const raisedWithin = (from: number, to: number) => tickets.filter((t) => now - t.createdAt >= from && now - t.createdAt < to).length;
  return {
    open: open.length,
    raisedThisWeek: raisedWithin(0, WEEK),
    raisedLastWeek: raisedWithin(WEEK, 2 * WEEK),
    testing: onBoard.filter((t) => t.status === "testing").length,
    doneThisWeek: onBoard.filter((t) => {
      const at = doneAt(t);
      return at != null && now - at < WEEK;
    }).length,
    oldestOpen: [...open].sort((a, b) => a.createdAt - b.createdAt)[0] ?? null,
    urgentOpen: open.filter((t) => t.priority === "urgent").length,
    archived: tickets.length - onBoard.length,
  };
}

export interface ProjectProgress {
  total: number;
  done: number;
  /** Rounded percentage done. Null when the project has no tickets: unmeasured, never 0%. */
  pct: number | null;
  split: Record<TicketStatus, number>;
  /** The project's first open ticket in board order. */
  next: Ticket | null;
}

/** A project's progress: its done tickets over all of them, archived ones left out. */
export function projectProgress(project: Project, tickets: readonly Ticket[]): ProjectProgress {
  const mine = live(tickets).filter((t) => t.project === project.id);
  const split = statusSplit(mine);
  return {
    total: mine.length,
    done: split.done,
    pct: mine.length ? Math.round((split.done / mine.length) * 100) : null,
    split,
    next: inBoardOrder(mine).find((t) => t.status !== "done") ?? null,
  };
}

/** How many tickets sit in each column (archived left out). */
export function statusSplit(tickets: readonly Ticket[]): Record<TicketStatus, number> {
  const out = Object.fromEntries(TICKET_STATUSES.map((s) => [s, 0])) as Record<TicketStatus, number>;
  for (const t of live(tickets)) out[t.status] += 1;
  return out;
}

/** Open tickets by priority, urgent first. */
export function openByPriority(tickets: readonly Ticket[]): { priority: TicketPriority; count: number }[] {
  const open = live(tickets).filter((t) => t.status !== "done");
  return [...TICKET_PRIORITIES]
    .reverse()
    .map((priority) => ({ priority, count: open.filter((t) => t.priority === priority).length }));
}

/** Open tickets per dashboard, highest first. Dashboards with none are left out. */
export function openByDashboard(tickets: readonly Ticket[]): { dashboard: ModuleId; count: number }[] {
  const counts = new Map<ModuleId, number>();
  for (const t of live(tickets)) if (t.status !== "done") counts.set(t.dashboard, (counts.get(t.dashboard) ?? 0) + 1);
  return [...counts]
    .map(([dashboard, count]) => ({ dashboard, count }))
    .sort((a, b) => b.count - a.count || dashboardName(a.dashboard).localeCompare(dashboardName(b.dashboard)));
}

/* ── Search ────────────────────────────────────────────────────────────── */

/** Search across the LP number, title, details, people, dashboard and project. */
export function matchesTicket(t: Ticket, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return [
    formatTicketNo(t.no),
    String(t.no),
    t.title,
    t.details,
    t.raisedBy,
    seatName(t.assignee),
    dashboardName(t.dashboard),
    t.project ? PROJECT_BY_ID[t.project]?.name : null,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .includes(q);
}

/* ── Time ──────────────────────────────────────────────────────────────── */

/** "just now", "5m ago", "3h ago", "2d ago", then a date. */
export function relativeTime(at: number, now = Date.now()): string {
  const s = Math.max(0, now - at);
  if (s < MINUTE) return "just now";
  if (s < HOUR) return `${Math.floor(s / MINUTE)}m ago`;
  if (s < DAY) return `${Math.floor(s / HOUR)}h ago`;
  const d = Math.floor(s / DAY);
  if (d < 30) return `${d}d ago`;
  return new Date(at).toLocaleDateString("en-AU", { day: "numeric", month: "short" });
}

/** "<1d", "3d", "5w": how long a ticket has been open. */
export function ageLabel(at: number, now = Date.now()): string {
  const d = Math.floor(Math.max(0, now - at) / DAY);
  if (d === 0) return "<1d";
  if (d < 21) return `${d}d`;
  return `${Math.floor(d / 7)}w`;
}
