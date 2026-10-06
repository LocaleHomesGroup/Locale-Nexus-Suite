# Tickets Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Tickets dashboard (HRIS's developer board, in the Launchpad shell) where anyone can raise an improvement ticket from any dashboard, fold the Projects dashboard into it as groups of tickets, and remove the Projects dashboard.

**Architecture:**
- **State:** a `TicketsProvider` in the dashboard layout holds the tickets. It's seeded, in memory and resets on reload, and it mounts the shared New ticket dialog.
- **Vocabulary and rules:** `tickets/data.ts` holds the words, projects and seed. `tickets/logic.ts` holds pure functions for every rule and figure.
- **Screens:** four rail sections (Overview, Board, Projects, Archived) render from the store. The open ticket lives in `?ticket=`.
- **Rail:** every staff rail, and the Employee portal's, gets a "Suggest an improvement" row that opens the dialog with that dashboard chosen.

**Tech Stack:** Next.js 16 App Router (client components under `Suspense`), React 19, `motion/react`, Tailwind 4, `lucide-react`, `sonner`. Verification uses `npx tsc`, a scratch `tsx` logic check, and scratch `playwright-core` browser scripts.

**Spec:** `docs/superpowers/specs/2026-10-06-tickets-dashboard-design.md`. Read it first. This plan argues from it.

## Global Constraints

- **Workspace:**
  - Work only in the worktree `C:\Users\Kane\Desktop\Locale-launchpad-tickets`, on branch `feat/tickets-dashboard` cut from `main`.
  - Never edit `C:\Users\Kane\Desktop\Locale-launchpad`: other sessions work there.
  - All paths below are relative to the worktree root.
- **Static prototype:** no backend, no auth, no RBAC, and no new dependencies. `package.json` and `package-lock.json` must not change.
- **Next.js 16:** before using any Next API not already used in this repo, read its page under `node_modules/next/dist/docs/` (AGENTS.md). This plan uses `permanentRedirect` (read `01-app/03-api-reference/04-functions/permanentRedirect.md`), `next/link` and `next/navigation` hooks.
- **Hands off Sales:** don't edit `src/components/modules/sales/**`. Tickets has its own drag hook in `src/hooks/`.
- **Numbering:** ticket numbers read `LP-<n>`. The seed runs LP-83 to LP-111, so the first ticket raised is **LP-112**.
- **Look:** the Tickets tone is **charcoal**. Never use HRIS's black-and-red console look.
- **Motion:** use only `EASE_OUT` / `EASE_SWAP` from `src/lib/motion.ts`. Gate durations with `useReducedMotion()`, never `initial`. Stagger rows with `rowDelay`.
- **Type scale:** closed. Use only `text-[10px]`, `text-xs`, `text-[13px]`, `text-sm` and the component sizes; never 11px.
- **Colour:**
  - Status colours carry verdicts: urgent is rose, high is amber.
  - No Sky Blue: it's Wealth's only.
  - Every colour sits beside its word.
- **Copy:** no eyebrow above headings. Buttons name their action ("Raise ticket", "Confirm archive", "Restore").
- **Hydration:** every relative time (`relativeTime`, ages) carries `suppressHydrationWarning`.
- **Checks:**
  - After every task: `npx tsc --noEmit` must pass.
  - Browser checks run against the worktree dev server on `http://localhost:3100`.
  - Treat a console error as a failure, unless it also appears on `main` for the same page. Note it if so.
- **Commits:** on the branch only, staging paths explicitly. End every message with `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`.
- **Scratchpad:** `S="C:/Users/Kane/AppData/Local/Temp/claude/c--Users-Kane-Desktop-Locale-launchpad/834af21c-da2e-4706-9af3-77a5b127f34a/scratchpad"`. Logic and browser checks live there and are never committed.

## Review Focus

These failure modes are implied by the spec but no unit test exercises them. Each is pinned to the task that owns it:

1. **A `?ticket=` link to a number that doesn't exist** (a typo, an old link). Expect a toast "There's no ticket LP-999", the param cleared, and no empty dialog. *(Task 3, `tickets-overview.mjs`)*
2. **Escape mid-drag, or dropping a card back on its own column.** Expect no write and no history entry; the card stays where it was. *(Task 4, `tickets-board.mjs`)*
3. **Double-clicking "Raise ticket".** Expect exactly one ticket, not two: the dialog stays clickable through its 0.18s exit. *(Guard in Task 2; check in Task 8, `tickets-rail.mjs`)*
4. **A title of only spaces, or no dashboard chosen.** Expect "Raise ticket" disabled. *(Task 8, `tickets-rail.mjs`)*
5. **Raising from the phone drawer.** Expect the drawer to close behind the dialog, and the dialog to be usable. *(Task 8, `tickets-rail.mjs`)*

---

### Task 1: Ticket vocabulary, projects, seed and rules

**Files:**
- Create: `src/components/modules/tickets/data.ts`
- Create: `src/components/modules/tickets/logic.ts`
- Scratch (not committed): `$S/check-tickets.mts`

**Interfaces:**
- Consumes: `DASHBOARDS`, `STAFF`, `spaceOf`, `dashboardById`, `type Dashboard` from `@/components/shell/dashboards`; `ORG_SEED` from `@/components/modules/hr/data`; `type ModuleId` from `@/state/launchpad-store`.
- Produces from `data.ts`:
  - Statuses and priorities: `TICKET_STATUSES`, `type TicketStatus`, `TICKET_STATUS_LABELS`, `TICKET_PRIORITIES`, `type TicketPriority`, `formatTicketNo(no)`.
  - People: `BOARD_OWNER`, `BOARD_ACTOR`, `ASSIGNEES`, `type Assignee`, `assigneeName(id)`.
  - Dashboards: `isTicketTarget(d)`, `TICKET_DASHBOARDS`, `isTicketDashboardId(id)`.
  - Projects: `PROJECT_STATES`, `type ProjectState`, `type Project`, `PROJECTS`, `projectById(id)`, `isProjectId(id)`.
  - Tickets: `type TicketField`, `type TicketChange`, `type TicketEvent`, `type TicketReply`, `type Ticket`, `seedTickets(now)`.
- Produces from `logic.ts`:
  - Constants: `DAY`, `WEEK`.
  - Drafts: `type TicketDraft`, `draftFromTicket`, `isDraftValid`, `fieldsFromDraft`, `diffTicket`.
  - Board: `nextTicketNo`, `byBoardOrder`, `isOpenTicket`, `doneAt`.
  - Figures: `type TicketStats`, `ticketStats(tickets, now)`, `weekDelta`.
  - Projects: `type ProjectProgress`, `projectProgress(project, tickets)`, `allProjectProgress(tickets)`.
  - Labels and search: `relativeTime(at, now?)`, `ageLabel(since, now?)`, `matchesQuery(t, query)`.

- [ ] **Step 1: Create the worktree and install**

Use superpowers:using-git-worktrees. The worktree must be at `C:\Users\Kane\Desktop\Locale-launchpad-tickets` on a new branch `feat/tickets-dashboard` from `main`. Then:

```bash
cd C:/Users/Kane/Desktop/Locale-launchpad-tickets
git log --oneline -1          # expect the plan commit on main
npm ci
npx tsc --noEmit              # expect: no output (clean baseline)
```

- [ ] **Step 2: Write the failing logic check**

Create `$S/check-tickets.mts`:

```ts
import assert from "node:assert/strict";

const R = "file:///C:/Users/Kane/Desktop/Locale-launchpad-tickets/src/components/modules/tickets";
const data = await import(`${R}/data.ts`);
const logic = await import(`${R}/logic.ts`);

const DAY = 86_400_000;
const now = Date.UTC(2026, 9, 6, 12);
const seed = data.seedTickets(now);
const byNo = (no: number) => seed.find((t: { no: number }) => t.no === no)!;

// Numbering and vocabulary
assert.equal(data.formatTicketNo(118), "LP-118");
assert.equal(logic.nextTicketNo(seed), 112);
assert.equal(logic.nextTicketNo([]), 101);
assert.deepEqual(data.ASSIGNEES.map((a: { name: string }) => a.name), ["Jan Kane Reroma", "Jerry Delos Santos", "Pablo Lopez", "Andre Mikhail Serra"]);
assert.equal(data.BOARD_ACTOR, "Shannan Hart");
assert.ok(data.isTicketDashboardId("sales"));
assert.ok(data.isTicketDashboardId("employee"));
assert.ok(!data.isTicketDashboardId("client"));
assert.ok(!data.isTicketDashboardId("developer"));
assert.ok(!data.isTicketDashboardId("nope"));
assert.deepEqual(data.PROJECTS.map((p: { id: string }) => p.id), ["launchpad-v1", "pricing-hub", "health-check", "lastpass"]);

// Seed integrity
assert.equal(seed.length, 29);
assert.equal(new Set(seed.map((t: { no: number }) => t.no)).size, seed.length);
for (const t of seed) {
  assert.equal(t.history[0].action, "created", `LP-${t.no} starts with created`);
  const latest = Math.max(t.createdAt, t.archived?.at ?? 0, ...t.history.map((e: { at: number }) => e.at), ...t.replies.map((r: { at: number }) => r.at));
  assert.equal(t.updatedAt, latest, `LP-${t.no} updatedAt`);
  if (t.project) assert.ok(data.isProjectId(t.project), `LP-${t.no} project exists`);
}

// Board order: urgent first, then oldest
const todo = seed.filter((t: any) => t.status === "todo" && !t.archived).sort(logic.byBoardOrder).map((t: any) => t.no);
assert.deepEqual(todo, [109, 89, 90, 91, 94, 99, 103, 105, 111, 108, 102]);
const doing = seed.filter((t: any) => t.status === "in_progress" && !t.archived).sort(logic.byBoardOrder).map((t: any) => t.no);
assert.deepEqual(doing, [86, 93, 98, 101, 107, 87, 88]);

// Stats
const s = logic.ticketStats(seed, now);
assert.equal(s.total, 28);
assert.equal(s.open, 20);
assert.equal(s.raisedThisWeek, 5);
assert.equal(s.raisedLastWeek, 3);
assert.equal(logic.weekDelta(s.raisedThisWeek, s.raisedLastWeek), "+2 vs last week");
assert.equal(logic.weekDelta(0, 0), "none last week either");
assert.equal(logic.weekDelta(3, 3), "same as last week");
assert.equal(s.doneThisWeek, 1);
assert.equal(s.archived, 1);
assert.deepEqual(s.byStatus, { todo: 11, in_progress: 7, testing: 2, done: 8 });
assert.deepEqual(s.openByPriority, { low: 2, medium: 11, high: 6, urgent: 1 });
assert.equal(s.oldestOpen?.no, 86);
assert.deepEqual(
  s.openByDashboard.map((d: any) => [d.dashboard, d.count]),
  [["operations", 9], ["it", 3], ["sales", 2], ["accounting", 1], ["employee", 1], ["finance", 1], ["hr", 1], ["knowledge", 1], ["leadership", 1]],
);

// Project progress
const progress = logic.allProjectProgress(seed);
assert.deepEqual(
  progress.map((p: any) => [p.project.id, p.done, p.total, p.pct, p.next?.no ?? null]),
  [["launchpad-v1", 3, 9, 33, 86], ["pricing-hub", 1, 3, 33, 93], ["health-check", 2, 3, 67, 95], ["lastpass", 1, 3, 33, 98]],
);
assert.deepEqual(progress[0].byStatus, { todo: 3, in_progress: 3, testing: 0, done: 3 });
const empty = logic.projectProgress({ id: "x", name: "X", owner: "pablo-lopez", state: "In build" }, seed);
assert.equal(empty.total, 0);
assert.equal(empty.pct, null);
assert.equal(empty.next, null);

// The history a save writes
const t103 = byNo(103);
const edited = { ...logic.draftFromTicket(t103), title: "  Leave: show balances on the form  ", priority: "high" };
assert.deepEqual(logic.diffTicket(t103, edited), [
  { field: "title", from: "Leave: show balances on the request form", to: "Leave: show balances on the form" },
  { field: "priority", from: "medium", to: "high" },
]);
assert.deepEqual(logic.diffTicket(t103, logic.draftFromTicket(t103)), []);
assert.deepEqual(logic.diffTicket(t103, { ...logic.draftFromTicket(t103), assignee: "" }), [{ field: "assignee", from: "jan-kane-reroma", to: "" }]);
assert.deepEqual(logic.diffTicket(t103, { ...logic.draftFromTicket(t103), project: "pricing-hub" }), [{ field: "project", from: "", to: "pricing-hub" }]);
assert.equal(logic.isDraftValid({ ...edited, title: "   " }), false);
assert.equal(logic.isDraftValid({ ...edited, dashboard: "" }), false);
assert.equal(logic.isDraftValid(edited), true);

// Done time comes from history
assert.equal(logic.doneAt(byNo(106)), now - 3 * DAY);
assert.equal(logic.doneAt(byNo(101)), null);

// Search covers number, words, people, dashboard and project
assert.ok(logic.matchesQuery(byNo(104), "lp-104"));
assert.ok(logic.matchesQuery(byNo(104), "pablo"));
assert.ok(logic.matchesQuery(byNo(104), "operations"));
assert.ok(logic.matchesQuery(byNo(86), "crm dash sync"));
assert.ok(!logic.matchesQuery(byNo(104), "zzz"));
assert.ok(logic.matchesQuery(byNo(104), "   "));

// Time labels
assert.equal(logic.relativeTime(now - 30_000, now), "just now");
assert.equal(logic.relativeTime(now - 5 * 3_600_000, now), "5h ago");
assert.equal(logic.relativeTime(now - 2 * DAY, now), "2d ago");
assert.equal(logic.ageLabel(now - 2 * 3_600_000, now), "<1d");
assert.equal(logic.ageLabel(now - 20 * DAY, now), "20d");

console.log("tickets logic: all checks passed");
```

- [ ] **Step 3: Run it and watch it fail**

```bash
cd C:/Users/Kane/Desktop/Locale-launchpad-tickets
npx -y tsx --tsconfig tsconfig.json "$S/check-tickets.mts"
```
Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `tickets/data.ts`.

- [ ] **Step 4: Write `src/components/modules/tickets/data.ts`**

```ts
import type { ModuleId } from "@/state/launchpad-store";
import { DASHBOARDS, STAFF, spaceOf, type Dashboard } from "@/components/shell/dashboards";
import { ORG_SEED } from "@/components/modules/hr/data";

/**
 * Tickets — the one vocabulary module, after HRIS's `lib/tickets/types.ts`.
 * Every column, priority, label, project and person the Tickets dashboard uses
 * is declared here, so the card, the board, the dialog, the Overview, the
 * Projects section and Jarvis can't disagree about what a word means.
 *
 * A ticket asks for an improvement to one Launchpad dashboard, and may belong
 * to a project. Static: the seed below is sample content, and a reload resets
 * the board to it.
 */

/* ── Columns and priorities ────────────────────────────────────────────── */

/** Board columns, in display order. */
export const TICKET_STATUSES = ["todo", "in_progress", "testing", "done"] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];

export const TICKET_STATUS_LABELS: Record<TicketStatus, string> = {
  todo: "To Do",
  in_progress: "In Progress",
  testing: "Testing",
  done: "Done",
};

export const TICKET_PRIORITIES = ["low", "medium", "high", "urgent"] as const;
export type TicketPriority = (typeof TICKET_PRIORITIES)[number];

/** `LP-118`. One formatter, so the card, the toast and Jarvis can't differ. */
export const formatTicketNo = (no: number) => `LP-${no}`;

/* ── People ────────────────────────────────────────────────────────────── */

/**
 * The board owner: HRIS's TICKET_BOARD_OWNER. New tickets land on Kane's desk.
 * There's no RBAC yet, so this decides the default assignee and nothing else.
 */
export const BOARD_OWNER = "jan-kane-reroma";

/** Board edits (move, save, reply, archive, restore) are made as the Launchpad's staff persona. */
export const BOARD_ACTOR = STAFF.name;

/** Who a ticket can be assigned to: the AI & Growth team. An assumption — confirm with Kane. */
const ASSIGNEE_IDS = ["jan-kane-reroma", "jerry-delos-santos", "pablo-lopez", "andre-mikhail-serra"] as const;

export interface Assignee {
  id: string;
  name: string;
  role: string;
}

export const ASSIGNEES: Assignee[] = ASSIGNEE_IDS.map((id) => {
  const seat = ORG_SEED.find((p) => p.id === id);
  return { id, name: seat?.name ?? id, role: seat?.role ?? "" };
});

/** A seat id's name, or null for nobody. */
export const assigneeName = (id: string | null): string | null =>
  id ? (ASSIGNEES.find((a) => a.id === id)?.name ?? id) : null;

/* ── Dashboards a ticket can be about ──────────────────────────────────── */

/**
 * Every staff dashboard, plus the Employee portal (Locale's own people). Not
 * the Client or Developer portals: those preview outsiders. The same rule
 * decides which rails offer "Suggest an improvement".
 */
export const isTicketTarget = (d: Dashboard) => spaceOf(d) === "launchpad" || d.id === "employee";

export const TICKET_DASHBOARDS: Dashboard[] = DASHBOARDS.filter(isTicketTarget);

export const isTicketDashboardId = (id: string): id is ModuleId => TICKET_DASHBOARDS.some((d) => d.id === id);

/* ── Projects ──────────────────────────────────────────────────────────── */

export const PROJECT_STATES = ["In build", "Validation", "Deploying"] as const;
export type ProjectState = (typeof PROJECT_STATES)[number];

/**
 * The internal builds that used to be the Projects dashboard. A project is a
 * group of tickets: its progress is worked out from them (`projectProgress`),
 * never typed in. Its state is the stage its owner declares. Fixed data, as on
 * the old dashboard: the board doesn't create or edit projects.
 */
export interface Project {
  id: string;
  name: string;
  /** Org-chart seat id. */
  owner: string;
  state: ProjectState;
}

export const PROJECTS: Project[] = [
  { id: "launchpad-v1", name: "Launchpad V1 · CRM Dash Sync", owner: "jerry-delos-santos", state: "In build" },
  { id: "pricing-hub", name: "Locale Pricing Hub", owner: "jerry-delos-santos", state: "In build" },
  { id: "health-check", name: "Finance Health Check form", owner: "pablo-lopez", state: "Validation" },
  { id: "lastpass", name: "LastPass rollout", owner: "pablo-lopez", state: "Deploying" },
];

export const projectById = (id: string | null): Project | null => (id ? (PROJECTS.find((p) => p.id === id) ?? null) : null);

export const isProjectId = (id: string) => PROJECTS.some((p) => p.id === id);

/* ── Tickets ───────────────────────────────────────────────────────────── */

export type TicketField = "title" | "details" | "dashboard" | "project" | "priority" | "status" | "assignee";

/** One field change on a ticket's history. `project` and `assignee` are ids; "" means none. */
export interface TicketChange {
  field: TicketField;
  from: string;
  to: string;
}

export interface TicketEvent {
  id: string;
  actor: string;
  at: number;
  action: "created" | "updated" | "moved" | "archived" | "restored";
  /** The field-level diff, for `updated` and `moved`. */
  changes?: TicketChange[];
}

/** A reply on the ticket's thread. Never edited once posted. */
export interface TicketReply {
  id: string;
  author: string;
  body: string;
  at: number;
}

export interface Ticket {
  id: string;
  /** Shown as "LP-118". */
  no: number;
  title: string;
  details: string;
  /** The dashboard this ticket would improve. */
  dashboard: ModuleId;
  /** The project it belongs to, or null. */
  project: string | null;
  priority: TicketPriority;
  status: TicketStatus;
  /** Display name of whoever the rail showed when it was raised. */
  raisedBy: string;
  /** Org-chart seat id, or null for nobody. */
  assignee: string | null;
  /** Epoch ms, like Sales' deals. */
  createdAt: number;
  /** The last change or reply. */
  updatedAt: number;
  /** Set when archived (a soft delete): off the board, kept in Archived, restorable. */
  archived?: { at: number; by: string };
  replies: TicketReply[];
  history: TicketEvent[];
}

/* ── Seed ──────────────────────────────────────────────────────────────── */

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

/**
 * The board as it opens, stamped relative to `now` so ages and "this week"
 * stay meaningful whenever the demo runs. Ages sit well clear of the 7- and
 * 14-day lines, so a server render and a browser render moments apart count
 * the same week. Every ticket and reply is sample content: LP-100 to LP-111
 * are asks about real dashboards; LP-83 to LP-99 are the projects' work, the
 * Launchpad V1 nine taken from the old Projects board.
 */
export function seedTickets(now: number): Ticket[] {
  const ago = (ms: number) => now - ms;
  let n = 0;
  const ev = (actor: string, at: number, action: TicketEvent["action"], changes?: TicketChange[]): TicketEvent => ({
    id: `seed-ev-${n++}`,
    actor,
    at,
    action,
    changes,
  });
  const created = (actor: string, at: number) => ev(actor, at, "created");
  const moved = (actor: string, at: number, from: TicketStatus, to: TicketStatus) =>
    ev(actor, at, "moved", [{ field: "status", from, to }]);
  const assigned = (actor: string, at: number, to: string) =>
    ev(actor, at, "updated", [{ field: "assignee", from: BOARD_OWNER, to }]);
  const re = (author: string, at: number, body: string): TicketReply => ({ id: `seed-re-${n++}`, author, at, body });
  const t = (
    x: Omit<Ticket, "id" | "updatedAt" | "project" | "replies"> & { project?: string; replies?: TicketReply[] },
  ): Ticket => {
    const replies = x.replies ?? [];
    return {
      ...x,
      id: `t-${x.no}`,
      project: x.project ?? null,
      replies,
      updatedAt: Math.max(x.createdAt, x.archived?.at ?? 0, ...x.history.map((e) => e.at), ...replies.map((r) => r.at)),
    };
  };

  const KANE = "Jan Kane Reroma";
  const JERRY = "Jerry Delos Santos";
  const PABLO = "Pablo Lopez";
  const ANDRE = "Andre Mikhail Serra";
  const SHANNAN = STAFF.name;

  return [
    /* ── Improvements to the dashboards ── */
    t({
      no: 100,
      dashboard: "operations",
      title: "Jobs list: filter by builder",
      details: "Would be good to see one builder's jobs at a time.",
      priority: "low",
      status: "todo",
      raisedBy: "D. Cruz",
      assignee: BOARD_OWNER,
      createdAt: ago(13 * DAY),
      archived: { at: ago(11 * DAY + 2 * HOUR), by: KANE },
      replies: [re(KANE, ago(11 * DAY + 2 * HOUR), "Same ask as LP-104, so I'm archiving this one. Follow LP-104 for progress.")],
      history: [created("D. Cruz", ago(13 * DAY)), ev(KANE, ago(11 * DAY + 2 * HOUR), "archived")],
    }),
    t({
      no: 101,
      dashboard: "sales",
      title: "Pipeline: drag cards on a phone",
      details:
        "On a phone a card only opens on tap, so moving a deal means opening it and changing the stage. Let reps press and hold to drag, like on desktop.",
      priority: "high",
      status: "in_progress",
      raisedBy: "A. Mercer",
      assignee: "andre-mikhail-serra",
      createdAt: ago(16 * DAY),
      replies: [re(ANDRE, ago(3 * DAY), "Trying press-and-hold to start the drag, so a swipe still scrolls the board sideways.")],
      history: [
        created("A. Mercer", ago(16 * DAY)),
        assigned(KANE, ago(15 * DAY), "andre-mikhail-serra"),
        moved(ANDRE, ago(4 * DAY), "todo", "in_progress"),
      ],
    }),
    t({
      no: 102,
      dashboard: "accounting",
      title: "Rename Pay run once Kane picks a name",
      details: "“Pay run” is a stand-in. When the real name is chosen it should change in the rail, the steps and Pay history together.",
      priority: "low",
      status: "todo",
      raisedBy: SHANNAN,
      assignee: BOARD_OWNER,
      createdAt: ago(20 * DAY),
      history: [created(SHANNAN, ago(20 * DAY))],
    }),
    t({
      no: 103,
      dashboard: "hr",
      title: "Leave: show balances on the request form",
      details: "Staff can't see how many days they have left until HR replies. Show annual and personal leave balances beside the dates.",
      priority: "medium",
      status: "todo",
      raisedBy: "K. Ellery",
      assignee: BOARD_OWNER,
      createdAt: ago(6 * DAY + 2 * HOUR),
      history: [created("K. Ellery", ago(6 * DAY + 2 * HOUR))],
    }),
    t({
      no: 104,
      dashboard: "operations",
      title: "CRM dash sync: filter jobs by builder",
      details: "With 40-odd jobs the list is long. A builder filter beside the stage tiles would save scrolling to find one builder's jobs.",
      priority: "medium",
      status: "testing",
      raisedBy: "L. Dixon",
      assignee: "pablo-lopez",
      createdAt: ago(12 * DAY),
      replies: [
        re(PABLO, ago(2 * DAY), "The builder filter is in. Can you try it with the Forma jobs?"),
        re("L. Dixon", ago(1 * DAY + 5 * HOUR), "Works for Forma. Checking Dale Alcock next."),
      ],
      history: [
        created("L. Dixon", ago(12 * DAY)),
        assigned(KANE, ago(11 * DAY), "pablo-lopez"),
        moved(PABLO, ago(8 * DAY + 3 * HOUR), "todo", "in_progress"),
        moved(PABLO, ago(2 * DAY), "in_progress", "testing"),
      ],
    }),
    t({
      no: 105,
      dashboard: "employee",
      title: "Invoices: download a PDF copy",
      details: "History lists every invoice I've sent, but there's no way to save one for my records. A Download PDF button on each would do it.",
      priority: "medium",
      status: "todo",
      raisedBy: KANE,
      assignee: BOARD_OWNER,
      createdAt: ago(3 * DAY + 4 * HOUR),
      history: [created(KANE, ago(3 * DAY + 4 * HOUR))],
    }),
    t({
      no: 106,
      dashboard: "home",
      title: "Home: hide celebrations I've already seen",
      details: "The same birthdays and work anniversaries stay at the top all week. Let me dismiss one once I've seen it.",
      priority: "low",
      status: "done",
      raisedBy: "D. Cruz",
      assignee: "jerry-delos-santos",
      createdAt: ago(24 * DAY),
      replies: [re(JERRY, ago(3 * DAY), "Done: each celebration has a dismiss button now, remembered per person.")],
      history: [
        created("D. Cruz", ago(24 * DAY)),
        assigned(KANE, ago(23 * DAY), "jerry-delos-santos"),
        moved(JERRY, ago(10 * DAY), "todo", "in_progress"),
        moved(JERRY, ago(5 * DAY), "in_progress", "testing"),
        moved("D. Cruz", ago(3 * DAY), "testing", "done"),
      ],
    }),
    t({
      no: 107,
      dashboard: "leadership",
      title: "Business dashboard: compare with last quarter",
      details: "Each figure shows this quarter only. Put the change against last quarter under it, so a dip or a jump is obvious.",
      priority: "high",
      status: "in_progress",
      raisedBy: SHANNAN,
      assignee: "jerry-delos-santos",
      createdAt: ago(10 * DAY + 6 * HOUR),
      history: [
        created(SHANNAN, ago(10 * DAY + 6 * HOUR)),
        assigned(KANE, ago(10 * DAY), "jerry-delos-santos"),
        moved(JERRY, ago(6 * DAY), "todo", "in_progress"),
      ],
    }),
    t({
      no: 108,
      dashboard: "it",
      title: "Help desk: email me when my ticket is resolved",
      details: "I only find out an IT ticket is fixed by checking the help desk. An email when it moves to Resolved would close the loop.",
      priority: "medium",
      status: "todo",
      raisedBy: "K. Ellery",
      assignee: "pablo-lopez",
      createdAt: ago(1 * DAY + 3 * HOUR),
      history: [created("K. Ellery", ago(1 * DAY + 3 * HOUR)), assigned(KANE, ago(20 * HOUR), "pablo-lopez")],
    }),
    t({
      no: 109,
      dashboard: "sales",
      title: "Rapid costing: save a quote as a draft",
      details: "A costing is lost if I leave the page halfway through with a client. Save it as a draft I can come back to.",
      priority: "urgent",
      status: "todo",
      raisedBy: "A. Mercer",
      assignee: "andre-mikhail-serra",
      createdAt: ago(5 * HOUR),
      history: [created("A. Mercer", ago(5 * HOUR)), assigned(KANE, ago(4 * HOUR), "andre-mikhail-serra")],
    }),
    t({
      no: 110,
      dashboard: "finance",
      project: "health-check",
      title: "Health check: explain each score",
      details: "The health check gives a score per area but not why. A line under each score saying what drove it would help.",
      priority: "low",
      status: "done",
      raisedBy: SHANNAN,
      assignee: BOARD_OWNER,
      createdAt: ago(30 * DAY),
      history: [
        created(SHANNAN, ago(30 * DAY)),
        moved(KANE, ago(18 * DAY), "todo", "in_progress"),
        moved(KANE, ago(12 * DAY), "in_progress", "testing"),
        moved(SHANNAN, ago(9 * DAY + 4 * HOUR), "testing", "done"),
      ],
    }),
    t({
      no: 111,
      dashboard: "knowledge",
      title: "Knowledge: search inside documents",
      details: "Search only matches titles. Searching the text of each guide would find the right policy faster.",
      priority: "medium",
      status: "todo",
      raisedBy: "L. Dixon",
      assignee: BOARD_OWNER,
      createdAt: ago(2 * DAY + 1 * HOUR),
      history: [created("L. Dixon", ago(2 * DAY + 1 * HOUR))],
    }),

    /* ── Launchpad V1 · CRM Dash Sync: the old Projects board, as tickets ── */
    t({
      no: 83,
      dashboard: "operations",
      project: "launchpad-v1",
      title: "Board + automation audit",
      details: "Map every Monday board and automation CRM Dash Sync touches, and note which ones it replaces.",
      priority: "medium",
      status: "done",
      raisedBy: JERRY,
      assignee: "jerry-delos-santos",
      createdAt: ago(45 * DAY),
      history: [
        created(JERRY, ago(45 * DAY)),
        moved(JERRY, ago(40 * DAY), "todo", "in_progress"),
        moved(JERRY, ago(30 * DAY), "in_progress", "done"),
      ],
    }),
    t({
      no: 84,
      dashboard: "operations",
      project: "launchpad-v1",
      title: "Launchpad UI build",
      details: "Port the Launchpad mockup to Next.js with the Simple HRIS shell, in Locale's brand.",
      priority: "high",
      status: "done",
      raisedBy: JERRY,
      assignee: BOARD_OWNER,
      createdAt: ago(44 * DAY),
      replies: [re(KANE, ago(26 * DAY), "Every module is ported, in light and dark. Ready for a look.")],
      history: [
        created(JERRY, ago(44 * DAY)),
        moved(KANE, ago(38 * DAY), "todo", "in_progress"),
        moved(KANE, ago(26 * DAY), "in_progress", "testing"),
        moved(SHANNAN, ago(22 * DAY), "testing", "done"),
      ],
    }),
    t({
      no: 85,
      dashboard: "operations",
      project: "launchpad-v1",
      title: "Test workspace mirrors",
      details: "Mirror the HubSpot and Monday test workspaces so sync runs can't touch live jobs.",
      priority: "medium",
      status: "done",
      raisedBy: JERRY,
      assignee: "pablo-lopez",
      createdAt: ago(40 * DAY),
      history: [
        created(JERRY, ago(40 * DAY)),
        moved(PABLO, ago(30 * DAY), "todo", "in_progress"),
        moved(PABLO, ago(18 * DAY), "in_progress", "done"),
      ],
    }),
    t({
      no: 86,
      dashboard: "operations",
      project: "launchpad-v1",
      title: "Monday → HubSpot milestone sync",
      details: "When a milestone ticks in Monday, write its date to the HubSpot deal, and flag a conflict if HubSpot already has a different one.",
      priority: "high",
      status: "in_progress",
      raisedBy: JERRY,
      assignee: "jerry-delos-santos",
      createdAt: ago(38 * DAY),
      history: [created(JERRY, ago(38 * DAY)), moved(JERRY, ago(20 * DAY), "todo", "in_progress")],
    }),
    t({
      no: 87,
      dashboard: "operations",
      project: "launchpad-v1",
      title: "Supabase schema + RLS",
      details: "Tables for jobs, milestones and the audit log, with row-level security per role.",
      priority: "medium",
      status: "in_progress",
      raisedBy: JERRY,
      assignee: BOARD_OWNER,
      createdAt: ago(36 * DAY),
      history: [created(JERRY, ago(36 * DAY)), moved(KANE, ago(12 * DAY), "todo", "in_progress")],
    }),
    t({
      no: 88,
      dashboard: "operations",
      project: "launchpad-v1",
      title: "v0 UI pass",
      details: "A first pass of the sync screens in v0, to agree the layout before building them.",
      priority: "low",
      status: "in_progress",
      raisedBy: JERRY,
      assignee: BOARD_OWNER,
      createdAt: ago(35 * DAY),
      history: [created(JERRY, ago(35 * DAY)), moved(KANE, ago(9 * DAY), "todo", "in_progress")],
    }),
    t({
      no: 89,
      dashboard: "operations",
      project: "launchpad-v1",
      title: "Entra app registration session",
      details: "Book a session with IT to register the Launchpad in Entra, so staff sign in with their Locale accounts.",
      priority: "high",
      status: "todo",
      raisedBy: JERRY,
      assignee: "jerry-delos-santos",
      createdAt: ago(33 * DAY),
      history: [created(JERRY, ago(33 * DAY))],
    }),
    t({
      no: 90,
      dashboard: "operations",
      project: "launchpad-v1",
      title: "Capture sandbox stage IDs",
      details: "List the HubSpot sandbox's deal stage IDs, so the sync maps stages by ID rather than by name.",
      priority: "medium",
      status: "todo",
      raisedBy: JERRY,
      assignee: "jerry-delos-santos",
      createdAt: ago(32 * DAY),
      history: [created(JERRY, ago(32 * DAY))],
    }),
    t({
      no: 91,
      dashboard: "operations",
      project: "launchpad-v1",
      title: "Field matrix session w/ Shannan",
      details: "Walk through which HubSpot and Monday fields map to each other, and which side wins a conflict.",
      priority: "medium",
      status: "todo",
      raisedBy: JERRY,
      assignee: "jerry-delos-santos",
      createdAt: ago(31 * DAY),
      history: [created(JERRY, ago(31 * DAY))],
    }),

    /* ── Locale Pricing Hub ── */
    t({
      no: 92,
      dashboard: "operations",
      project: "pricing-hub",
      title: "Pricing: search by home design",
      details: "Find a design's current price across every builder's list by typing its name.",
      priority: "medium",
      status: "done",
      raisedBy: "L. Dixon",
      assignee: "jerry-delos-santos",
      createdAt: ago(34 * DAY),
      history: [
        created("L. Dixon", ago(34 * DAY)),
        moved(JERRY, ago(28 * DAY), "todo", "in_progress"),
        moved(JERRY, ago(20 * DAY), "in_progress", "done"),
      ],
    }),
    t({
      no: 93,
      dashboard: "operations",
      project: "pricing-hub",
      title: "Import the Q4 builder price lists",
      details: "Load each builder's Q4 list, so quotes use this quarter's prices.",
      priority: "high",
      status: "in_progress",
      raisedBy: SHANNAN,
      assignee: "jerry-delos-santos",
      createdAt: ago(28 * DAY),
      history: [created(SHANNAN, ago(28 * DAY)), moved(JERRY, ago(15 * DAY), "todo", "in_progress")],
    }),
    t({
      no: 94,
      dashboard: "operations",
      project: "pricing-hub",
      title: "Flag price changes over 5%",
      details: "When a new list moves a design's price by more than 5%, flag it for review before it's used in a quote.",
      priority: "medium",
      status: "todo",
      raisedBy: SHANNAN,
      assignee: "jerry-delos-santos",
      createdAt: ago(27 * DAY),
      history: [created(SHANNAN, ago(27 * DAY))],
    }),

    /* ── Finance Health Check form (LP-110 above belongs here too) ── */
    t({
      no: 95,
      dashboard: "finance",
      project: "health-check",
      title: "Health check: save answers between visits",
      details: "Clients lose their answers if they close the form. Save them so they can finish later.",
      priority: "medium",
      status: "testing",
      raisedBy: SHANNAN,
      assignee: "pablo-lopez",
      createdAt: ago(26 * DAY),
      replies: [re(PABLO, ago(4 * DAY), "Answers now save as you go. Can someone try closing the form halfway?")],
      history: [
        created(SHANNAN, ago(26 * DAY)),
        moved(PABLO, ago(19 * DAY), "todo", "in_progress"),
        moved(PABLO, ago(4 * DAY), "in_progress", "testing"),
      ],
    }),
    t({
      no: 96,
      dashboard: "finance",
      project: "health-check",
      title: "Health check: email the result to the client",
      details: "Send the client their result and next steps by email when they finish.",
      priority: "medium",
      status: "done",
      raisedBy: SHANNAN,
      assignee: "pablo-lopez",
      createdAt: ago(29 * DAY),
      history: [
        created(SHANNAN, ago(29 * DAY)),
        moved(PABLO, ago(24 * DAY), "todo", "in_progress"),
        moved(PABLO, ago(16 * DAY), "in_progress", "done"),
      ],
    }),

    /* ── LastPass rollout ── */
    t({
      no: 97,
      dashboard: "it",
      project: "lastpass",
      title: "LastPass: roll out to Sales",
      details: "Set up LastPass for the Sales team and move their shared logins into it.",
      priority: "medium",
      status: "done",
      raisedBy: PABLO,
      assignee: "pablo-lopez",
      createdAt: ago(30 * DAY),
      history: [
        created(PABLO, ago(30 * DAY)),
        moved(PABLO, ago(25 * DAY), "todo", "in_progress"),
        moved(PABLO, ago(15 * DAY), "in_progress", "done"),
      ],
    }),
    t({
      no: 98,
      dashboard: "it",
      project: "lastpass",
      title: "LastPass: roll out to Operations",
      details: "The same rollout for Operations, including the builder portal logins.",
      priority: "high",
      status: "in_progress",
      raisedBy: PABLO,
      assignee: "pablo-lopez",
      createdAt: ago(25 * DAY),
      history: [created(PABLO, ago(25 * DAY)), moved(PABLO, ago(13 * DAY), "todo", "in_progress")],
    }),
    t({
      no: 99,
      dashboard: "it",
      project: "lastpass",
      title: "LastPass: shared folders for builder logins",
      details: "One shared folder per builder, so a new starter gets every portal login on day one.",
      priority: "medium",
      status: "todo",
      raisedBy: PABLO,
      assignee: "pablo-lopez",
      createdAt: ago(24 * DAY),
      history: [created(PABLO, ago(24 * DAY))],
    }),
  ];
}
```

- [ ] **Step 5: Write `src/components/modules/tickets/logic.ts`**

```ts
import type { ModuleId } from "@/state/launchpad-store";
import { dashboardById } from "@/components/shell/dashboards";
import {
  PROJECTS,
  TICKET_PRIORITIES,
  TICKET_STATUSES,
  assigneeName,
  formatTicketNo,
  projectById,
  type Project,
  type Ticket,
  type TicketChange,
  type TicketField,
  type TicketPriority,
  type TicketStatus,
} from "./data";

/**
 * The board's rules as pure functions: ordering, numbering, the history a save
 * writes, project progress and every figure the Overview, Projects and Jarvis
 * quote. Nothing here touches React or the store, so every screen counts the
 * same way.
 */

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;
export const WEEK = 7 * DAY;

/* ── Drafts and the history a save writes ──────────────────────────────── */

/** What the ticket dialog edits. `dashboard` is "" until chosen; `project` and `assignee` "" mean none. */
export interface TicketDraft {
  title: string;
  details: string;
  dashboard: ModuleId | "";
  project: string;
  priority: TicketPriority;
  status: TicketStatus;
  assignee: string;
}

export const draftFromTicket = (t: Ticket): TicketDraft => ({
  title: t.title,
  details: t.details,
  dashboard: t.dashboard,
  project: t.project ?? "",
  priority: t.priority,
  status: t.status,
  assignee: t.assignee ?? "",
});

/** A draft can be saved once it has a title (not just spaces) and a dashboard. */
export const isDraftValid = (d: TicketDraft) => d.title.trim() !== "" && d.dashboard !== "";

/** The fields a valid draft sets, trimmed, as the ticket stores them. */
export function fieldsFromDraft(d: TicketDraft): Pick<Ticket, TicketField> {
  return {
    title: d.title.trim(),
    details: d.details.trim(),
    dashboard: d.dashboard as ModuleId,
    project: d.project || null,
    priority: d.priority,
    status: d.status,
    assignee: d.assignee || null,
  };
}

/** One change per field that differs, in field order. Empty when nothing changed. */
export function diffTicket(t: Ticket, d: TicketDraft): TicketChange[] {
  const next = fieldsFromDraft(d);
  return (Object.keys(next) as TicketField[])
    .filter((f) => (next[f] ?? "") !== (t[f] ?? ""))
    .map((f) => ({ field: f, from: String(t[f] ?? ""), to: String(next[f] ?? "") }));
}

/* ── The board ─────────────────────────────────────────────────────────── */

/** The next number: one past the highest, starting at LP-101. */
export const nextTicketNo = (tickets: Pick<Ticket, "no">[]) => Math.max(100, ...tickets.map((t) => t.no)) + 1;

const PRIORITY_RANK: Record<TicketPriority, number> = { urgent: 0, high: 1, medium: 2, low: 3 };

/** Column order: urgent first, then oldest first. There's no manual reordering. */
export const byBoardOrder = (a: Ticket, b: Ticket) =>
  PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || a.createdAt - b.createdAt;

/** Still to do: not done and not archived. */
export const isOpenTicket = (t: Ticket) => !t.archived && t.status !== "done";

/** When the ticket last reached Done (from its history), or null while it isn't done. */
export function doneAt(t: Ticket): number | null {
  if (t.status !== "done") return null;
  for (let i = t.history.length - 1; i >= 0; i--) {
    const e = t.history[i];
    if (e.changes?.some((c) => c.field === "status" && c.to === "done")) return e.at;
  }
  return t.createdAt;
}

/* ── Figures ───────────────────────────────────────────────────────────── */

export interface TicketStats {
  /** Tickets on the board (archived excluded). */
  total: number;
  open: number;
  raisedThisWeek: number;
  raisedLastWeek: number;
  doneThisWeek: number;
  archived: number;
  byStatus: Record<TicketStatus, number>;
  openByPriority: Record<TicketPriority, number>;
  /** Dashboards with open tickets, most first, ties by name. */
  openByDashboard: { dashboard: ModuleId; count: number }[];
  oldestOpen: Ticket | null;
}

/** Every figure the Overview and Jarvis quote. "This week" is the last 7 days. */
export function ticketStats(tickets: Ticket[], now: number): TicketStats {
  const live = tickets.filter((t) => !t.archived);
  const open = live.filter(isOpenTicket);
  const age = (at: number) => now - at;
  const counts = new Map<ModuleId, number>();
  for (const t of open) counts.set(t.dashboard, (counts.get(t.dashboard) ?? 0) + 1);
  return {
    total: live.length,
    open: open.length,
    raisedThisWeek: tickets.filter((t) => age(t.createdAt) < WEEK).length,
    raisedLastWeek: tickets.filter((t) => age(t.createdAt) >= WEEK && age(t.createdAt) < 2 * WEEK).length,
    doneThisWeek: live.filter((t) => {
      const d = doneAt(t);
      return d !== null && age(d) < WEEK;
    }).length,
    archived: tickets.length - live.length,
    byStatus: Object.fromEntries(TICKET_STATUSES.map((s) => [s, live.filter((t) => t.status === s).length])) as Record<TicketStatus, number>,
    openByPriority: Object.fromEntries(TICKET_PRIORITIES.map((p) => [p, open.filter((t) => t.priority === p).length])) as Record<
      TicketPriority,
      number
    >,
    openByDashboard: [...counts]
      .map(([dashboard, count]) => ({ dashboard, count }))
      .sort((a, b) => b.count - a.count || dashboardById(a.dashboard).label.localeCompare(dashboardById(b.dashboard).label)),
    oldestOpen: open.reduce<Ticket | null>((o, t) => (!o || t.createdAt < o.createdAt ? t : o), null),
  };
}

/** "+2 vs last week", "same as last week", or "none last week either". */
export function weekDelta(cur: number, prev: number): string {
  if (cur === prev) return prev === 0 ? "none last week either" : "same as last week";
  const d = cur - prev;
  return `${d > 0 ? "+" : ""}${d} vs last week`;
}

/* ── Projects ──────────────────────────────────────────────────────────── */

export interface ProjectProgress {
  project: Project;
  /** Its tickets, archived excluded. */
  total: number;
  done: number;
  /** 0–100, or null when it has no tickets (unmeasured, never 0%). */
  pct: number | null;
  byStatus: Record<TicketStatus, number>;
  /** Its first open ticket in board order. */
  next: Ticket | null;
}

/** A project's progress: its done tickets ÷ all its tickets. */
export function projectProgress(project: Project, tickets: Ticket[]): ProjectProgress {
  const mine = tickets.filter((t) => t.project === project.id && !t.archived);
  const byStatus = Object.fromEntries(TICKET_STATUSES.map((s) => [s, mine.filter((t) => t.status === s).length])) as Record<
    TicketStatus,
    number
  >;
  const open = mine.filter(isOpenTicket).sort(byBoardOrder);
  return {
    project,
    total: mine.length,
    done: byStatus.done,
    pct: mine.length ? Math.round((byStatus.done / mine.length) * 100) : null,
    byStatus,
    next: open[0] ?? null,
  };
}

/** Every project's progress, in `PROJECTS` order. */
export const allProjectProgress = (tickets: Ticket[]) => PROJECTS.map((p) => projectProgress(p, tickets));

/* ── Labels and search ─────────────────────────────────────────────────── */

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

/** "<1d", "3d": how long something has been open. */
export function ageLabel(since: number, now = Date.now()): string {
  const d = Math.floor(Math.max(0, now - since) / DAY);
  return d === 0 ? "<1d" : `${d}d`;
}

/** Search across the number, words, people, dashboard and project. A blank query matches everything. */
export function matchesQuery(t: Ticket, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return [
    formatTicketNo(t.no),
    t.title,
    t.details,
    t.raisedBy,
    assigneeName(t.assignee) ?? "",
    dashboardById(t.dashboard).label,
    projectById(t.project)?.name ?? "",
  ]
    .join(" ")
    .toLowerCase()
    .includes(q);
}
```

- [ ] **Step 6: Run the check and watch it pass**

```bash
cd C:/Users/Kane/Desktop/Locale-launchpad-tickets
npx -y tsx --tsconfig tsconfig.json "$S/check-tickets.mts"
npx tsc --noEmit
```
Expected: `tickets logic: all checks passed`, and `tsc` prints nothing.

- [ ] **Step 7: Commit**

```bash
git add src/components/modules/tickets/data.ts src/components/modules/tickets/logic.ts
git commit -m "Add ticket vocabulary, projects, seed and board rules" -m "Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Ticket card and ticket dialog

**Files:**
- Create: `src/components/modules/tickets/TicketCard.tsx`
- Create: `src/components/modules/tickets/TicketDialog.tsx`

**Interfaces:**
- Consumes (Task 1): everything listed under `data.ts` and `logic.ts`.
- Produces:
  - From `TicketCard.tsx`:
    - `PRIORITY_STYLES: Record<TicketPriority, { label; chip; dot }>`, `STATUS_DOT: Record<TicketStatus, string>`.
    - `PriorityChip({ priority })`, `DashboardChip({ dashboard })`, `ProjectChip({ project })`.
    - `ticketCardClass({ ghosted?, overlay? })`, `TicketCardBody({ ticket })`.
  - From `TicketDialog.tsx`: `TicketDialog(props)`, where `props` is:
    - `open: boolean`, `onClose: () => void`
    - `ticket: Ticket | null` (null means create mode)
    - `initialDashboard?: ModuleId | ""`, `initialProject?: string`, `raisedBy?: string`
    - `onCreate?: (draft: TicketDraft) => void`
    - `onSave?: (id: string, draft: TicketDraft) => boolean`
    - `onArchive?: (id: string) => void`, `onRestore?: (id: string) => void`
    - `onReply?: (id: string, body: string) => void`

- [ ] **Step 1: Write `src/components/modules/tickets/TicketCard.tsx`**

```tsx
"use client";

import { FolderKanban, MessageSquare, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/ui/avatar";
import { dashboardById } from "@/components/shell/dashboards";
import { assigneeName, formatTicketNo, projectById, type Ticket, type TicketPriority, type TicketStatus } from "./data";
import { relativeTime } from "./logic";

/**
 * The board's shared vocabulary, after HRIS's TicketCard: one place, so the
 * card, the columns, the dialog and the Overview's charts use the same colours.
 * Priority is a verdict, so it takes status colours (urgent rose, high amber);
 * medium and low stay grey and are told apart by their word. Columns step from
 * grey through the dashboard's tone to emerald, as Sales' stages do, because
 * Done is done. Every colour sits beside its word.
 */
export const PRIORITY_STYLES: Record<TicketPriority, { label: string; chip: string; dot: string }> = {
  urgent: { label: "Urgent", chip: "bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300", dot: "bg-rose-500" },
  high: { label: "High", chip: "bg-amber-50 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300", dot: "bg-amber-500" },
  medium: { label: "Medium", chip: "bg-muted text-foreground", dot: "bg-zinc-500 dark:bg-zinc-400" },
  low: { label: "Low", chip: "bg-muted text-muted-foreground", dot: "bg-zinc-300 dark:bg-zinc-600" },
};

export const STATUS_DOT: Record<TicketStatus, string> = {
  todo: "bg-zinc-300 dark:bg-zinc-600",
  in_progress: "bg-tone-strong/50",
  testing: "bg-tone-strong",
  done: "bg-emerald-500",
};

const CHIP = "inline-flex h-5 max-w-full items-center gap-1 rounded-full px-2 text-xs font-medium";

export function PriorityChip({ priority, className }: { priority: TicketPriority; className?: string }) {
  const p = PRIORITY_STYLES[priority];
  return (
    <span className={cn(CHIP, "shrink-0", p.chip, className)}>
      <span className={cn("size-1.5 rounded-full", p.dot)} aria-hidden />
      {p.label}
      <span className="sr-only"> priority</span>
    </span>
  );
}

/** Which dashboard the ticket would improve, with that dashboard's icon. */
export function DashboardChip({ dashboard, className }: { dashboard: Ticket["dashboard"]; className?: string }) {
  const d = dashboardById(dashboard);
  const Icon = d.icon;
  return (
    <span className={cn(CHIP, "border border-border text-muted-foreground", className)} title={`For ${d.label}`}>
      <Icon className="size-3 shrink-0" aria-hidden />
      <span className="sr-only">For </span>
      <span className="truncate">{d.label}</span>
    </span>
  );
}

export function ProjectChip({ project, className }: { project: string; className?: string }) {
  const p = projectById(project);
  if (!p) return null;
  return (
    <span className={cn(CHIP, "border border-border text-muted-foreground", className)} title={`Part of ${p.name}`}>
      <FolderKanban className="size-3 shrink-0" aria-hidden />
      <span className="sr-only">Part of </span>
      <span className="truncate">{p.name}</span>
    </span>
  );
}

/**
 * The card's surface. The board puts it on a button (or on the drag overlay,
 * lifted, with no hover states), so one look serves both.
 */
export function ticketCardClass({ ghosted = false, overlay = false }: { ghosted?: boolean; overlay?: boolean }) {
  return cn(
    "group/card relative block w-full rounded-lg border border-border bg-card p-3 text-left shadow-xs outline-none select-none",
    "transition-[translate,box-shadow,opacity,border-color] duration-150 ease-out motion-reduce:transition-none",
    "focus-visible:ring-3 focus-visible:ring-ring/45",
    !overlay &&
      "cursor-grab hover:-translate-y-0.5 hover:border-tone-line hover:shadow-md active:cursor-grabbing motion-reduce:hover:translate-y-0",
    ghosted && "opacity-40",
    overlay && "cursor-grabbing border-tone-line shadow-xl shadow-black/15 ring-1 ring-tone-line dark:shadow-black/50",
  );
}

/** What a card shows: number and priority, title and details, where it's for, who has it, who raised it, replies and age. */
export function TicketCardBody({ ticket }: { ticket: Ticket }) {
  const assignee = assigneeName(ticket.assignee);
  const replies = ticket.replies.length;
  return (
    <>
      <span className="flex items-center justify-between gap-2">
        <span className="font-mono text-xs font-medium text-muted-foreground">{formatTicketNo(ticket.no)}</span>
        <PriorityChip priority={ticket.priority} />
      </span>

      <span className="mt-1.5 line-clamp-2 text-sm leading-snug font-medium text-foreground">{ticket.title}</span>
      {ticket.details ? (
        <span className="mt-1 line-clamp-2 text-xs leading-snug text-muted-foreground">{ticket.details}</span>
      ) : null}

      <span className="mt-2 flex flex-wrap gap-1.5">
        <DashboardChip dashboard={ticket.dashboard} />
        {ticket.project ? <ProjectChip project={ticket.project} /> : null}
        {assignee ? (
          <span className={cn(CHIP, "bg-tone-soft text-tone-ink")} title={`Assigned to ${assignee}`}>
            <UserRound className="size-3 shrink-0" aria-hidden />
            <span className="sr-only">Assigned to </span>
            <span className="truncate">{assignee}</span>
          </span>
        ) : null}
      </span>

      <span className="mt-2.5 flex items-center gap-1.5">
        <Avatar name={ticket.raisedBy} size="xs" />
        <span className="min-w-0 truncate text-xs text-muted-foreground">
          <span className="sr-only">Raised by </span>
          {ticket.raisedBy}
        </span>
        <span className="ml-auto flex shrink-0 items-center gap-2 text-xs text-subtle-foreground">
          {replies > 0 ? (
            <span className="flex items-center gap-0.5" title={`${replies} repl${replies === 1 ? "y" : "ies"}`}>
              <MessageSquare className="size-3" aria-hidden />
              {replies}
              <span className="sr-only"> repl{replies === 1 ? "y" : "ies"}</span>
            </span>
          ) : null}
          <span suppressHydrationWarning className="tabular-nums">
            {relativeTime(ticket.createdAt)}
          </span>
        </span>
      </span>
    </>
  );
}
```

- [ ] **Step 2: Write `src/components/modules/tickets/TicketDialog.tsx`**

```tsx
"use client";

import * as React from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  Archive,
  ArchiveRestore,
  CircleDot,
  History,
  Lightbulb,
  MessagesSquare,
  SendHorizontal,
  Ticket as TicketIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { EASE_OUT, EASE_SWAP, rowDelay } from "@/lib/motion";
import type { ModuleId } from "@/state/launchpad-store";
import { dashboardById } from "@/components/shell/dashboards";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Label, Textarea } from "@/components/ui/input";
import { SmoothSelect } from "@/components/ui/select";
import { Avatar } from "@/components/ui/avatar";
import { Pill } from "@/components/ui/pill";
import { useCascading } from "@/components/ui/list-motion";
import {
  ASSIGNEES,
  BOARD_OWNER,
  PROJECTS,
  TICKET_DASHBOARDS,
  TICKET_PRIORITIES,
  TICKET_STATUSES,
  TICKET_STATUS_LABELS,
  assigneeName,
  formatTicketNo,
  projectById,
  type Ticket,
  type TicketChange,
  type TicketEvent,
  type TicketPriority,
  type TicketReply,
  type TicketStatus,
} from "./data";
import { diffTicket, draftFromTicket, isDraftValid, relativeTime, type TicketDraft } from "./logic";
import { PRIORITY_STYLES, STATUS_DOT } from "./TicketCard";

/** SmoothSelect reads "" as "nothing chosen", so "none" stands for nobody / no project. */
const NONE = "none";

const emptyDraft = (dashboard: ModuleId | "", project: string): TicketDraft => ({
  title: "",
  details: "",
  dashboard,
  project,
  priority: "medium",
  status: "todo",
  assignee: BOARD_OWNER,
});

const DASHBOARD_OPTIONS = TICKET_DASHBOARDS.map((d) => {
  const Icon = d.icon;
  return {
    value: d.id,
    label: (
      <span className="inline-flex items-center gap-2">
        <Icon className="size-3.5 text-subtle-foreground" aria-hidden />
        {d.label}
      </span>
    ),
    hint: d.space === "portal" ? "portal" : undefined,
  };
});

const PROJECT_OPTIONS = [
  { value: NONE, label: "No project" },
  ...PROJECTS.map((p) => ({ value: p.id, label: p.name, hint: p.state })),
];

/**
 * One dialog for "New ticket" and a ticket's details, after HRIS's
 * TicketDialog (and Sales' deal dialog). New ticket stays a narrow single
 * column. Details goes wide: the fields on the left, and on the right the
 * replies interleaved with the edit history, so the conversation and the trail
 * of who changed what sit beside the fields. An archived ticket opens frozen:
 * restore it to edit or reply.
 */
export function TicketDialog({
  open,
  onClose,
  ticket,
  initialDashboard = "",
  initialProject = "",
  raisedBy,
  onCreate,
  onSave,
  onArchive,
  onRestore,
  onReply,
}: {
  open: boolean;
  onClose: () => void;
  /** null → New ticket. Otherwise the live ticket, so a reply shows at once. */
  ticket: Ticket | null;
  initialDashboard?: ModuleId | "";
  initialProject?: string;
  /** Create mode: who it will be raised by, for the description. */
  raisedBy?: string;
  onCreate?: (draft: TicketDraft) => void;
  /** False when nothing changed. */
  onSave?: (id: string, draft: TicketDraft) => boolean;
  onArchive?: (id: string) => void;
  onRestore?: (id: string) => void;
  onReply?: (id: string, body: string) => void;
}) {
  const isCreate = ticket === null;
  const archived = Boolean(ticket?.archived);
  const formId = React.useId();
  const [draft, setDraft] = React.useState<TicketDraft>(() => emptyDraft(initialDashboard, initialProject));
  const [confirmingArchive, setConfirmingArchive] = React.useState(false);
  // The dialog stays clickable through its exit animation; this stops a
  // double-click from raising (or saving) twice.
  const submitted = React.useRef(false);

  // Reset when the dialog opens or switches ticket, not when the ticket changes
  // underneath it: a reply must not wipe a half-typed edit.
  const ticketRef = React.useRef(ticket);
  ticketRef.current = ticket;
  const initialRef = React.useRef({ dashboard: initialDashboard, project: initialProject });
  initialRef.current = { dashboard: initialDashboard, project: initialProject };
  const ticketId = ticket?.id ?? null;
  React.useEffect(() => {
    if (!open) return;
    submitted.current = false;
    setConfirmingArchive(false);
    setDraft(
      ticketRef.current
        ? draftFromTicket(ticketRef.current)
        : emptyDraft(initialRef.current.dashboard, initialRef.current.project),
    );
  }, [open, ticketId]);

  const set = <K extends keyof TicketDraft>(k: K, v: TicketDraft[K]) => setDraft((d) => ({ ...d, [k]: v }));
  const valid = isDraftValid(draft);
  const dirty = isCreate ? true : valid && diffTicket(ticket, draft).length > 0;
  const ready = valid && dirty && !archived;

  const submit = () => {
    if (!ready || submitted.current) return;
    submitted.current = true;
    if (isCreate) onCreate?.(draft);
    else onSave?.(ticket.id, draft);
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      icon={isCreate ? Lightbulb : TicketIcon}
      size={isCreate ? "md" : "xl"}
      className={isCreate ? undefined : "md:h-[min(46rem,90dvh)]"}
      bodyClassName={
        isCreate ? undefined : "p-0 md:grid md:grid-cols-[minmax(0,1fr)_minmax(18rem,22rem)] md:grid-rows-1 md:overflow-hidden"
      }
      title={
        isCreate ? (
          "New ticket"
        ) : (
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="font-mono text-sm font-medium text-muted-foreground">{formatTicketNo(ticket.no)}</span>
            {ticket.title}
            {archived ? (
              <Pill tone="neutral" icon={Archive}>
                Archived
              </Pill>
            ) : null}
          </span>
        )
      }
      description={
        isCreate ? (
          `Raised by ${raisedBy ?? "you"}. It lands in To Do on the Tickets board, on ${assigneeName(BOARD_OWNER)}'s desk unless you choose someone.`
        ) : ticket.archived ? (
          <span suppressHydrationWarning>
            Archived {relativeTime(ticket.archived.at)} by {ticket.archived.by} · restore it to edit or reply
          </span>
        ) : (
          <span suppressHydrationWarning>
            Raised by {ticket.raisedBy} · {relativeTime(ticket.createdAt)} · in {TICKET_STATUS_LABELS[ticket.status]}
          </span>
        )
      }
      footer={
        <>
          {!isCreate && !archived ? (
            <Button
              variant={confirmingArchive ? "destructive" : "outline"}
              className="mr-auto"
              onClick={() => {
                if (!confirmingArchive) return setConfirmingArchive(true);
                onArchive?.(ticket.id);
                onClose();
              }}
            >
              <Archive aria-hidden />
              {confirmingArchive ? "Confirm archive" : "Archive"}
            </Button>
          ) : null}
          {!isCreate && archived ? (
            <Button
              variant="outline"
              className="mr-auto"
              onClick={() => {
                onRestore?.(ticket.id);
                onClose();
              }}
            >
              <ArchiveRestore aria-hidden /> Restore ticket
            </Button>
          ) : null}
          <Button variant="outline" onClick={onClose}>
            {archived || (!isCreate && !dirty) ? "Close" : "Cancel"}
          </Button>
          {!archived ? (
            <Button type="submit" form={formId} disabled={!ready}>
              {isCreate ? "Raise ticket" : "Save changes"}
            </Button>
          ) : null}
        </>
      }
    >
      <div className={cn(!isCreate && "px-5 py-4 md:min-h-0 md:overflow-y-auto")}>
        <form
          id={formId}
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <fieldset disabled={archived} className="grid min-w-0 gap-3.5">
            <legend className="sr-only">{isCreate ? "New ticket" : "Ticket details"}</legend>
            <Cascade i={0}>
              <Field label="Title" htmlFor={`${formId}-title`}>
                <Input
                  id={`${formId}-title`}
                  value={draft.title}
                  onChange={(e) => set("title", e.target.value)}
                  placeholder="What should change?"
                  autoComplete="off"
                  maxLength={120}
                  required
                />
              </Field>
            </Cascade>

            <Cascade i={1}>
              <Field label="Details" htmlFor={`${formId}-details`}>
                <Textarea
                  id={`${formId}-details`}
                  value={draft.details}
                  onChange={(e) => set("details", e.target.value)}
                  placeholder="What's in the way today, and what would be better. Which screen, which button…"
                  rows={isCreate ? 3 : 4}
                  maxLength={2000}
                  className="resize-y"
                />
              </Field>
            </Cascade>

            <Cascade i={2} className="grid gap-3 sm:grid-cols-2">
              <Field label="Dashboard" htmlFor={`${formId}-dash`}>
                <SmoothSelect
                  id={`${formId}-dash`}
                  value={draft.dashboard}
                  onChange={(v) => set("dashboard", v)}
                  placeholder="Choose a dashboard"
                  options={DASHBOARD_OPTIONS}
                />
              </Field>
              <Field label="Project" htmlFor={`${formId}-project`}>
                <SmoothSelect
                  id={`${formId}-project`}
                  value={draft.project || NONE}
                  onChange={(v) => set("project", v === NONE ? "" : v)}
                  options={PROJECT_OPTIONS}
                />
              </Field>
            </Cascade>

            <Cascade i={3}>
              <PriorityPicker value={draft.priority} onChange={(p) => set("priority", p)} />
            </Cascade>

            <Cascade i={4} className={cn(!isCreate && "grid gap-3 sm:grid-cols-2")}>
              {!isCreate ? (
                <Field label="Column" htmlFor={`${formId}-status`}>
                  <SmoothSelect
                    id={`${formId}-status`}
                    value={draft.status}
                    onChange={(v) => set("status", v)}
                    options={TICKET_STATUSES.map((s) => ({ value: s, label: <StatusLabel status={s} /> }))}
                  />
                </Field>
              ) : null}
              <Field label="Assigned to" htmlFor={`${formId}-assignee`}>
                <SmoothSelect
                  id={`${formId}-assignee`}
                  value={draft.assignee || NONE}
                  onChange={(v) => set("assignee", v === NONE ? "" : v)}
                  options={[
                    ...ASSIGNEES.map((a) => ({
                      value: a.id,
                      label: (
                        <span className="inline-flex items-center gap-2">
                          <Avatar name={a.name} size="xs" />
                          {a.name}
                        </span>
                      ),
                      hint: a.id === BOARD_OWNER ? "board owner" : undefined,
                    })),
                    { value: NONE, label: "Nobody yet" },
                  ]}
                />
              </Field>
            </Cascade>
          </fieldset>
        </form>
      </div>

      {!isCreate ? (
        <Cascade
          i={5}
          className="border-t border-hairline md:flex md:min-h-0 md:flex-col md:border-t-0 md:border-l md:bg-canvas/60"
        >
          <ActivityRail ticket={ticket} onReply={(body) => onReply?.(ticket.id, body)} />
        </Cascade>
      ) : null}
    </Dialog>
  );
}

/** Fields arrive in a soft 40ms cascade each time the dialog opens (HRIS's ticket-field). */
function Cascade({ i, className, children }: { i: number; className?: string; children: React.ReactNode }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={cn("min-w-0", className)}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduce ? 0 : 0.38, ease: EASE_SWAP, delay: reduce ? 0 : 0.07 + i * 0.04 }}
    >
      {children}
    </motion.div>
  );
}

function StatusLabel({ status }: { status: TicketStatus }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className={cn("size-2 shrink-0 rounded-full", STATUS_DOT[status])} aria-hidden />
      {TICKET_STATUS_LABELS[status]}
    </span>
  );
}

/** HRIS's priority radio row: the chosen one fills with its colour and grows a touch. */
function PriorityPicker({ value, onChange }: { value: TicketPriority; onChange: (p: TicketPriority) => void }) {
  const labelId = React.useId();
  const refs = React.useRef<(HTMLButtonElement | null)[]>([]);
  const order = [...TICKET_PRIORITIES];
  const onKeyDown = (e: React.KeyboardEvent, i: number) => {
    const step = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const n = (i + step + order.length) % order.length;
    onChange(order[n]);
    refs.current[n]?.focus();
  };
  return (
    <div className="space-y-1.5">
      <Label id={labelId}>Priority</Label>
      <div role="radiogroup" aria-labelledby={labelId} className="grid grid-cols-4 gap-1.5">
        {order.map((p, i) => {
          const active = value === p;
          return (
            <button
              key={p}
              ref={(el) => {
                refs.current[i] = el;
              }}
              type="button"
              role="radio"
              aria-checked={active}
              tabIndex={active ? 0 : -1}
              onClick={() => onChange(p)}
              onKeyDown={(e) => onKeyDown(e, i)}
              className={cn(
                "flex h-8 items-center justify-center gap-1.5 rounded-lg border text-xs font-medium outline-none select-none",
                "transition-[background-color,border-color,color,transform,box-shadow] duration-150 ease-out motion-reduce:transition-none",
                "focus-visible:ring-3 focus-visible:ring-ring/45 disabled:pointer-events-none disabled:opacity-60",
                active
                  ? cn("scale-[1.03] border-transparent shadow-xs motion-reduce:scale-100", PRIORITY_STYLES[p].chip)
                  : "border-input text-muted-foreground hover:bg-muted hover:text-foreground active:scale-[0.98]",
              )}
            >
              <span className={cn("size-1.5 rounded-full", PRIORITY_STYLES[p].dot)} aria-hidden />
              {PRIORITY_STYLES[p].label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ── Activity rail: replies + edit history ─────────────────────────────── */

type FeedItem = { kind: "reply"; at: number; reply: TicketReply } | { kind: "event"; at: number; event: TicketEvent };

const clip = (s: string, n = 40) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);
const priorityLabel = (p: string) => PRIORITY_STYLES[p as TicketPriority]?.label ?? p;
const statusLabel = (s: string) => TICKET_STATUS_LABELS[s as TicketStatus] ?? s;
const projectName = (id: string) => projectById(id)?.name ?? id;

/** One field change as a line on the trail. */
function describeChange(c: TicketChange): string {
  switch (c.field) {
    case "title":
      return `renamed “${clip(c.from)}” → “${clip(c.to)}”`;
    case "details":
      return "edited the details";
    case "dashboard":
      return `changed the dashboard ${dashboardById(c.from).label} → ${dashboardById(c.to).label}`;
    case "project":
      return c.to ? `added it to ${projectName(c.to)}` : `took it out of ${projectName(c.from)}`;
    case "priority":
      return `set priority ${priorityLabel(c.from)} → ${priorityLabel(c.to)}`;
    case "status":
      return `moved ${statusLabel(c.from)} → ${statusLabel(c.to)}`;
    case "assignee":
      return c.to ? `assigned it to ${assigneeName(c.to)}` : "unassigned it";
  }
}

function describeEvent(e: TicketEvent): string {
  switch (e.action) {
    case "created":
      return "raised this ticket";
    case "archived":
      return "archived this ticket";
    case "restored":
      return "restored this ticket";
    case "moved":
    case "updated":
      return (e.changes ?? []).map(describeChange).join(" · ") || "edited this ticket";
  }
}

/**
 * The ticket's conversation and trail in one chronological feed: replies read
 * as chat entries, edits as compact system lines between them. The newest
 * entry stays in view, and a new one slides in at the foot.
 */
function ActivityRail({ ticket, onReply }: { ticket: Ticket; onReply: (body: string) => void }) {
  const reduce = useReducedMotion();
  const cascading = useCascading();
  const [draft, setDraft] = React.useState("");
  const listRef = React.useRef<HTMLOListElement>(null);
  const first = React.useRef(true);
  const archived = Boolean(ticket.archived);

  const feed = React.useMemo<FeedItem[]>(
    () =>
      [
        ...ticket.replies.map((r) => ({ kind: "reply" as const, at: r.at, reply: r })),
        ...ticket.history.map((e) => ({ kind: "event" as const, at: e.at, event: e })),
      ].sort((a, b) => a.at - b.at),
    [ticket.replies, ticket.history],
  );

  React.useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: first.current || reduce ? "auto" : "smooth" });
    first.current = false;
  }, [feed.length, reduce]);

  const send = () => {
    const body = draft.trim();
    if (!body || archived) return;
    onReply(body);
    setDraft("");
  };

  return (
    <div className="flex min-h-0 flex-col gap-2.5 px-5 py-4 md:h-full md:px-4">
      <div className="flex items-center gap-1.5">
        <MessagesSquare className="size-3.5 text-subtle-foreground" aria-hidden />
        <h3 className="text-xs font-semibold text-foreground">
          Replies{ticket.replies.length ? <span className="text-muted-foreground"> ({ticket.replies.length})</span> : null}
        </h3>
        <span className="ml-auto flex items-center gap-1 text-xs text-subtle-foreground">
          <History className="size-3" aria-hidden />
          history included
        </span>
      </div>

      <ol
        ref={listRef}
        aria-label="Replies and history"
        className="flex max-h-72 min-h-0 flex-col gap-3 overflow-y-auto pr-1 [scrollbar-width:thin] md:max-h-none md:flex-1"
      >
        <AnimatePresence initial={false}>
          {feed.map((item, i) => (
            <motion.li
              key={item.kind === "reply" ? item.reply.id : item.event.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: reduce ? 0 : 0.22, ease: EASE_OUT, delay: cascading ? rowDelay(i, reduce, 0.03) : 0 }}
            >
              {item.kind === "reply" ? (
                <div className="flex gap-2">
                  <Avatar name={item.reply.author} size="xs" className="mt-0.5" />
                  <div className="min-w-0">
                    <p className="text-xs">
                      <span className="font-semibold">{item.reply.author}</span>
                      <span className="ml-1.5 text-subtle-foreground" suppressHydrationWarning>
                        {relativeTime(item.reply.at)}
                      </span>
                    </p>
                    <p className="mt-0.5 text-[13px] leading-relaxed break-words whitespace-pre-wrap">{item.reply.body}</p>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-2 text-xs leading-snug text-muted-foreground">
                  <CircleDot className="mt-0.5 size-3 shrink-0 text-subtle-foreground/70" aria-hidden />
                  <p className="min-w-0 break-words">
                    <span className="font-medium text-foreground/80">{item.event.actor}</span> {describeEvent(item.event)}
                    <span className="ml-1.5 text-subtle-foreground" suppressHydrationWarning>
                      {relativeTime(item.event.at)}
                    </span>
                  </p>
                </div>
              )}
            </motion.li>
          ))}
        </AnimatePresence>
      </ol>

      <div className="flex items-end gap-1.5 border-t border-hairline pt-2.5">
        <Textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              send();
            }
          }}
          rows={2}
          maxLength={2000}
          disabled={archived}
          placeholder={archived ? "Archived. Restore it to reply." : "Reply… (Shift+Enter for a new line)"}
          aria-label={`Reply on ${formatTicketNo(ticket.no)}`}
          className="min-h-14 resize-none text-[13px]"
        />
        <Button size="icon" aria-label="Send reply" disabled={!draft.trim() || archived} onClick={send}>
          <SendHorizontal />
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit
```
Expected: no output. Neither component is mounted yet. The dialog is first opened in Task 3, by `?ticket=`.

- [ ] **Step 4: Commit**

```bash
git add src/components/modules/tickets/TicketCard.tsx src/components/modules/tickets/TicketDialog.tsx
git commit -m "Add ticket card and ticket dialog" -m "Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Register Tickets: store, route, Overview, open ticket, Jarvis

**Files:**
- Create: `src/state/tickets-store.tsx`
- Create: `src/components/modules/tickets/use-ticket-params.ts`
- Create: `src/components/modules/tickets/TicketsOverview.tsx`
- Create: `src/components/modules/tickets/TicketsScreen.tsx`
- Create: `app/(dashboard)/tickets/page.tsx`
- Modify:
  - `src/state/launchpad-store.tsx` (`ModuleId`)
  - `src/components/shell/dashboards.ts` (imports, Tickets entry)
  - `src/components/shell/DashboardSwitchLoader.tsx` (`SHAPES`)
  - `src/components/modules/admin/data.ts` (`BLURBS`)
  - `app/(dashboard)/layout.tsx`
  - `src/components/shell/assistant/jarvis-knowledge.ts`
  - `src/components/shell/assistant/JarvisBubble.tsx`
  - `src/components/shell/dashboard-tones.ts` (comment)
- Scratch: `$S/pw/lib.mjs`, `$S/pw/tickets-overview.mjs`

**Interfaces:**
- Consumes (Tasks 1–2): `seedTickets`, `nextTicketNo`, `fieldsFromDraft`, `diffTicket`, `isDraftValid`, `ticketStats`, `allProjectProgress`, `TicketDialog`, `STATUS_DOT`, `PRIORITY_STYLES`.
- Produces:
  - `useTickets(): TicketsStore` from `@/state/tickets-store`. The store is:
    - `tickets: Ticket[]`
    - `createTicket(draft, raisedBy): Ticket | null`
    - `saveTicket(id, draft): boolean`
    - `moveTicket(id, to: TicketStatus): void`
    - `reply(id, body): void`
    - `archiveTicket(id): void`, `restoreTicket(id): void`
    - `openNewTicket({ dashboard?, project?, raisedBy }): void`
  - `TicketsProvider` from the same module.
  - `useTicketParams()` returns:
    - `ticketNo: number | null`, `dashboard: ModuleId | null`, `project: string | null`, `priority: TicketPriority | null`
    - `set(patch: Record<string, string | null>)`, `openTicket(no)`, `closeTicket()`
  - Rail keys: `tickets:overview`, `tickets:board`, `tickets:projects`, `tickets:archived`.

- [ ] **Step 1: Add `"tickets"` to `ModuleId`** in `src/state/launchpad-store.tsx`

Replace:
```ts
  | "it"
  | "admin"
```
with:
```ts
  | "it"
  | "tickets"
  | "admin"
```

- [ ] **Step 2: Register the dashboard** in `src/components/shell/dashboards.ts`

In the `lucide-react` import list, add `Archive,` as the first entry, before `ArrowLeftRight,`. Add `FolderKanban,` after `FileText,`, `SquareKanban,` after `Sparkles,` and `Ticket,` after `Target,`.

Then replace the end of the IT entry:
```ts
    items: [overview("it"), tab("it", "helpdesk", "Help desk", LifeBuoy)],
  },
```
with:
```ts
    items: [overview("it"), tab("it", "helpdesk", "Help desk", LifeBuoy)],
  },
  {
    id: "tickets",
    label: "Tickets",
    title: "Tickets board",
    href: "/tickets",
    icon: Ticket,
    tone: "charcoal",
    defaults: { tab: "overview" },
    // HRIS's /tickets board, for improving the Launchpad itself, with the
    // projects that used to be their own dashboard. Every rail's "Suggest an
    // improvement" raises a ticket here. `?dash=`, `?project=`, `?priority=`
    // and `?ticket=` are board filters and the open ticket, not rail items.
    items: [
      overview("tickets"),
      tab("tickets", "board", "Board", SquareKanban),
      tab("tickets", "projects", "Projects", FolderKanban),
      tab("tickets", "archived", "Archived", Archive),
    ],
  },
```

- [ ] **Step 3: Give it a switch-loader shape** in `src/components/shell/DashboardSwitchLoader.tsx`

Replace `  it: OVERVIEW,` with:
```ts
  it: OVERVIEW,
  tickets: OVERVIEW,
```

- [ ] **Step 4: Give it an Admin role blurb** in `src/components/modules/admin/data.ts`

Replace:
```ts
  it: "Unlocks the IT dashboard and its help desk.",
```
with:
```ts
  it: "Unlocks the IT dashboard and its help desk.",
  tickets: "Unlocks the Tickets board, its projects and archive.",
```

- [ ] **Step 5: Write `src/components/modules/tickets/use-ticket-params.ts`**

```ts
"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { ModuleId } from "@/state/launchpad-store";
import { TICKET_PRIORITIES, isProjectId, isTicketDashboardId, type TicketPriority } from "./data";

/**
 * The board's URL state: the dashboard, project and priority filters
 * (`?dash=sales`, `?project=lastpass`, `?priority=urgent`) and the open ticket
 * (`?ticket=118`). In the URL so the Overview's rows and cards, the Projects
 * cards, the raise toast's View and a shared link all land on exactly that.
 * Unknown values read as "no filter".
 */
export function useTicketParams() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const rawTicket = params.get("ticket");
  const ticketNo = rawTicket && /^\d{1,6}$/.test(rawTicket) ? Number(rawTicket) : null;
  const rawDash = params.get("dash");
  const dashboard: ModuleId | null = rawDash && isTicketDashboardId(rawDash) ? rawDash : null;
  const rawProject = params.get("project");
  const project = rawProject && isProjectId(rawProject) ? rawProject : null;
  const rawPriority = params.get("priority");
  const priority = (TICKET_PRIORITIES as readonly string[]).includes(rawPriority ?? "") ? (rawPriority as TicketPriority) : null;

  const set = React.useCallback(
    (patch: Record<string, string | null>) => {
      const sp = new URLSearchParams(params.toString());
      for (const [k, v] of Object.entries(patch)) {
        if (v === null) sp.delete(k);
        else sp.set(k, v);
      }
      const qs = sp.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [params, pathname, router],
  );

  const openTicket = React.useCallback((no: number) => set({ ticket: String(no) }), [set]);
  const closeTicket = React.useCallback(() => set({ ticket: null }), [set]);

  return { ticketNo, dashboard, project, priority, set, openTicket, closeTicket };
}
```

- [ ] **Step 6: Write `src/state/tickets-store.tsx`**

```tsx
"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { confirm, useLaunchpad, type ModuleId } from "./launchpad-store";
import { dashboardById } from "@/components/shell/dashboards";
import {
  BOARD_ACTOR,
  TICKET_STATUS_LABELS,
  formatTicketNo,
  seedTickets,
  type Ticket,
  type TicketEvent,
  type TicketStatus,
} from "@/components/modules/tickets/data";
import { diffTicket, fieldsFromDraft, isDraftValid, nextTicketNo, type TicketDraft } from "@/components/modules/tickets/logic";
import { TicketDialog } from "@/components/modules/tickets/TicketDialog";

/**
 * The Tickets dashboard's state. It lives in the dashboard layout, beside the
 * Launchpad and portal stores, because every rail's "Suggest an improvement"
 * writes to it: a ticket raised on Sales is on the board the moment you switch
 * to Tickets. Nothing is persisted; a reload resets to the seed.
 *
 * Writes are immediate, like HRIS's board: nothing leaves the Launchpad, so
 * there's no undo window (UI guide § 5.1). Every write except a reply adds a
 * history entry. Board edits are made as the staff persona (`BOARD_ACTOR`).
 */
interface TicketsStore {
  tickets: Ticket[];
  /** Adds the ticket to To Do and says so: a toast with View, and an Inbox entry. Null when the draft isn't valid. */
  createTicket: (draft: TicketDraft, raisedBy: string) => Ticket | null;
  /** The dialog's Save changes. False when nothing changed. */
  saveTicket: (id: string, draft: TicketDraft) => boolean;
  /** A drag or Alt+arrow. Does nothing when it's already in that column. */
  moveTicket: (id: string, to: TicketStatus) => void;
  reply: (id: string, body: string) => void;
  archiveTicket: (id: string) => void;
  restoreTicket: (id: string) => void;
  /** Opens New ticket over the current page. */
  openNewTicket: (opts: { dashboard?: ModuleId; project?: string; raisedBy: string }) => void;
}

const TicketsContext = React.createContext<TicketsStore | null>(null);

let seq = 0;
const uid = (prefix: string) => `${prefix}-${Date.now()}-${seq++}`;

export function TicketsProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { notify } = useLaunchpad();
  const [tickets, setTickets] = React.useState<Ticket[]>(() => seedTickets(Date.now()));
  const ticketsRef = React.useRef(tickets);
  ticketsRef.current = tickets;

  const [raise, setRaise] = React.useState<{ open: boolean; dashboard: ModuleId | ""; project: string; raisedBy: string }>({
    open: false,
    dashboard: "",
    project: "",
    raisedBy: BOARD_ACTOR,
  });

  /** Apply `fn` to one ticket and stamp `updatedAt`. */
  const patch = React.useCallback((id: string, fn: (t: Ticket, at: number) => Ticket) => {
    const at = Date.now();
    setTickets((prev) => prev.map((t) => (t.id === id ? { ...fn(t, at), updatedAt: at } : t)));
  }, []);

  const find = (id: string) => ticketsRef.current.find((t) => t.id === id);

  const createTicket = React.useCallback<TicketsStore["createTicket"]>(
    (draft, raisedBy) => {
      if (!isDraftValid(draft)) return null;
      const at = Date.now();
      const no = nextTicketNo(ticketsRef.current);
      const ticket: Ticket = {
        ...fieldsFromDraft(draft),
        status: "todo",
        id: `t-${no}`,
        no,
        raisedBy,
        createdAt: at,
        updatedAt: at,
        replies: [],
        history: [{ id: uid("ev"), actor: raisedBy, at, action: "created" }],
      };
      // Ahead of the re-render, so a second create in the same tick takes the next number.
      ticketsRef.current = [ticket, ...ticketsRef.current];
      setTickets((prev) => [ticket, ...prev]);
      const label = dashboardById(ticket.dashboard).label;
      toast.success(`${formatTicketNo(no)} raised for ${label}`, {
        description: ticket.title,
        action: { label: "View", onClick: () => router.push(`/tickets?tab=board&ticket=${no}`) },
      });
      notify(`New ticket ${formatTicketNo(no)} · ${label}: ${ticket.title}`);
      return ticket;
    },
    [notify, router],
  );

  const saveTicket = React.useCallback<TicketsStore["saveTicket"]>(
    (id, draft) => {
      const t = find(id);
      if (!t || t.archived || !isDraftValid(draft)) return false;
      const changes = diffTicket(t, draft);
      if (changes.length === 0) return false;
      const onlyStatus = changes.length === 1 && changes[0].field === "status";
      patch(id, (cur, at) => ({
        ...cur,
        ...fieldsFromDraft(draft),
        history: [...cur.history, { id: uid("ev"), actor: BOARD_ACTOR, at, action: onlyStatus ? "moved" : "updated", changes }],
      }));
      confirm(`${formatTicketNo(t.no)} updated`);
      return true;
    },
    [patch],
  );

  const moveTicket = React.useCallback<TicketsStore["moveTicket"]>(
    (id, to) => {
      const t = find(id);
      if (!t || t.archived || t.status === to) return;
      patch(id, (cur, at) => {
        const event: TicketEvent = { id: uid("ev"), actor: BOARD_ACTOR, at, action: "moved", changes: [{ field: "status", from: cur.status, to }] };
        return { ...cur, status: to, history: [...cur.history, event] };
      });
    },
    [patch],
  );

  const reply = React.useCallback<TicketsStore["reply"]>(
    (id, body) => {
      const text = body.trim();
      const t = find(id);
      if (!text || !t || t.archived) return;
      patch(id, (cur, at) => ({ ...cur, replies: [...cur.replies, { id: uid("re"), author: BOARD_ACTOR, body: text, at }] }));
    },
    [patch],
  );

  const archiveTicket = React.useCallback<TicketsStore["archiveTicket"]>(
    (id) => {
      const t = find(id);
      if (!t || t.archived) return;
      patch(id, (cur, at) => ({
        ...cur,
        archived: { at, by: BOARD_ACTOR },
        history: [...cur.history, { id: uid("ev"), actor: BOARD_ACTOR, at, action: "archived" }],
      }));
      confirm(`${formatTicketNo(t.no)} archived`, "It's in Archived, where it can be restored.");
    },
    [patch],
  );

  const restoreTicket = React.useCallback<TicketsStore["restoreTicket"]>(
    (id) => {
      const t = find(id);
      if (!t?.archived) return;
      patch(id, (cur, at) => ({
        ...cur,
        archived: undefined,
        history: [...cur.history, { id: uid("ev"), actor: BOARD_ACTOR, at, action: "restored" }],
      }));
      confirm(`${formatTicketNo(t.no)} restored`, `Back on the board in ${TICKET_STATUS_LABELS[t.status]}.`);
    },
    [patch],
  );

  const openNewTicket = React.useCallback<TicketsStore["openNewTicket"]>(
    ({ dashboard, project, raisedBy }) => setRaise({ open: true, dashboard: dashboard ?? "", project: project ?? "", raisedBy }),
    [],
  );

  const value = React.useMemo<TicketsStore>(
    () => ({ tickets, createTicket, saveTicket, moveTicket, reply, archiveTicket, restoreTicket, openNewTicket }),
    [tickets, createTicket, saveTicket, moveTicket, reply, archiveTicket, restoreTicket, openNewTicket],
  );

  return (
    <TicketsContext.Provider value={value}>
      {children}
      <TicketDialog
        open={raise.open}
        onClose={() => setRaise((r) => ({ ...r, open: false }))}
        ticket={null}
        initialDashboard={raise.dashboard}
        initialProject={raise.project}
        raisedBy={raise.raisedBy}
        onCreate={(draft) => {
          createTicket(draft, raise.raisedBy);
        }}
      />
    </TicketsContext.Provider>
  );
}

export function useTickets(): TicketsStore {
  const ctx = React.useContext(TicketsContext);
  if (!ctx) throw new Error("useTickets must be used inside TicketsProvider");
  return ctx;
}
```

- [ ] **Step 7: Mount the provider** in `app/(dashboard)/layout.tsx`

Replace the whole file with:
```tsx
import { AppShell } from "@/components/shell/AppShell";
import { LaunchpadProvider } from "@/state/launchpad-store";
import { PortalProvider } from "@/state/portal-store";
import { TicketsProvider } from "@/state/tickets-store";

/**
 * Every Launchpad screen shares this layout. It stays mounted across
 * navigations, so the store (jobs, audit log, notifications) survives moving
 * between modules. The portals (Client, Developer) live here too, so what a
 * builder sends a client in one portal is waiting in the other. Tickets sits
 * above the shell because every rail raises tickets and Jarvis reads them.
 */
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <LaunchpadProvider>
      <PortalProvider>
        <TicketsProvider>
          <AppShell>{children}</AppShell>
        </TicketsProvider>
      </PortalProvider>
    </LaunchpadProvider>
  );
}
```

- [ ] **Step 8: Write `src/components/modules/tickets/TicketsOverview.tsx`**

```tsx
"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import { Archive, CircleCheck, CircleDot, FlaskConical, FolderKanban, Hourglass, Lightbulb, Siren } from "lucide-react";
import { useTickets } from "@/state/tickets-store";
import { dashboardById, hrefForKey } from "@/components/shell/dashboards";
import { cn } from "@/lib/utils";
import { DURATION, EASE_SWAP, rowDelay } from "@/lib/motion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RateBar } from "@/components/ui/progress";
import { Reveal } from "@/components/ui/reveal";
import { DashboardOverview } from "../overview/DashboardOverview";
import { TICKET_PRIORITIES, TICKET_STATUSES, TICKET_STATUS_LABELS, formatTicketNo } from "./data";
import { ageLabel, allProjectProgress, relativeTime, ticketStats, weekDelta } from "./logic";
import { PRIORITY_STYLES, STATUS_DOT } from "./TicketCard";
import { useTicketParams } from "./use-ticket-params";

/**
 * Tickets › Overview: HRIS's ticket Overview on the Launchpad's
 * DashboardOverview. Every figure is computed from the store the board writes,
 * so a ticket raised or moved anywhere is counted here straight away.
 */
export function TicketsOverview() {
  const { tickets } = useTickets();
  const { openTicket } = useTicketParams();
  const reduce = useReducedMotion();
  const now = Date.now();
  const s = ticketStats(tickets, now);
  const oldest = s.oldestOpen;
  const projects = allProjectProgress(tickets);
  const closest = projects.filter((p) => p.pct !== null).sort((a, b) => (b.pct ?? 0) - (a.pct ?? 0))[0];
  const recent = tickets
    .filter((t) => !t.archived)
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, 6);
  const maxDash = Math.max(1, ...s.openByDashboard.map((d) => d.count));
  const maxPriority = Math.max(1, ...TICKET_PRIORITIES.map((p) => s.openByPriority[p]));

  return (
    <DashboardOverview
      title="Tickets overview"
      description="Every improvement asked for on the Launchpad: what's open, where, and how each project is moving. Raise one from any dashboard with “Suggest an improvement”."
      headline={[
        {
          label: "Open now",
          value: s.open,
          sub: s.open ? `${s.byStatus.todo} to do · ${s.byStatus.in_progress} in progress` : "nothing open",
          icon: CircleDot,
          to: "tickets:board",
        },
        { label: "Raised this week", value: s.raisedThisWeek, sub: weekDelta(s.raisedThisWeek, s.raisedLastWeek), icon: Lightbulb, to: "tickets:board" },
        {
          label: "In testing",
          value: s.byStatus.testing,
          sub: s.byStatus.testing ? "waiting on a check" : "nothing to check",
          icon: FlaskConical,
          tone: s.byStatus.testing ? "pending" : "tone",
          to: "tickets:board",
        },
        { label: "Done this week", value: s.doneThisWeek, sub: `${s.byStatus.done} done in all`, icon: CircleCheck, tone: "ok", to: "tickets:board" },
      ]}
      moreLabel="Queue health"
      more={[
        oldest
          ? {
              label: "Oldest open",
              value: ageLabel(oldest.createdAt, now),
              sub: `${formatTicketNo(oldest.no)} · ${dashboardById(oldest.dashboard).label}`,
              icon: Hourglass,
              to: "tickets:board",
              query: { ticket: String(oldest.no) },
            }
          : { label: "Oldest open", value: "—", sub: "nothing open", icon: Hourglass, to: "tickets:board" },
        {
          label: "Urgent open",
          value: s.openByPriority.urgent,
          sub: s.openByPriority.urgent ? "top of every column" : "none",
          icon: Siren,
          tone: s.openByPriority.urgent ? "problem" : "tone",
          to: "tickets:board",
          query: { priority: "urgent" },
        },
        {
          label: "Projects",
          value: projects.length,
          sub: closest ? `closest: ${closest.project.name}, ${closest.pct}%` : "no tickets in any yet",
          icon: FolderKanban,
          to: "tickets:projects",
        },
        { label: "Archived", value: s.archived, sub: "duplicates and won't-dos", icon: Archive, tone: "charcoal", to: "tickets:archived" },
      ]}
    >
      <Reveal index={2} className="grid gap-3 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Open by dashboard</CardTitle>
            <CardDescription>Where the open asks are. Pick one to see its tickets.</CardDescription>
          </CardHeader>
          <CardContent>
            {s.openByDashboard.length ? (
              <ul className="grid gap-1">
                {s.openByDashboard.map(({ dashboard, count }, i) => {
                  const d = dashboardById(dashboard);
                  const Icon = d.icon;
                  return (
                    <li key={dashboard}>
                      <Link
                        href={hrefForKey("tickets:board", { dash: dashboard })}
                        scroll={false}
                        className="group grid grid-cols-[minmax(0,10rem)_minmax(0,1fr)_2rem] items-center gap-3 rounded-lg px-2 py-1.5 outline-none transition-colors hover:bg-tone-soft focus-visible:ring-3 focus-visible:ring-ring/45"
                      >
                        <span className="flex min-w-0 items-center gap-2 text-[13px] font-medium">
                          <Icon className="size-3.5 shrink-0 text-subtle-foreground group-hover:text-tone-ink" aria-hidden />
                          <span className="truncate">{d.label}</span>
                        </span>
                        <RateBar value={count / maxDash} delay={rowDelay(i, reduce)} label={`${d.label}: ${count} open`} />
                        <span className="text-right text-[13px] font-semibold tabular-nums">{count}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-[13px] text-muted-foreground">Nothing open. New tickets show up here under their dashboard.</p>
            )}
          </CardContent>
        </Card>

        <div className="grid gap-3">
          <Card>
            <CardHeader>
              <CardTitle>Board split</CardTitle>
              <CardDescription>Where every ticket sits right now</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              <div
                role="img"
                aria-label={TICKET_STATUSES.map((st) => `${TICKET_STATUS_LABELS[st]} ${s.byStatus[st]}`).join(", ")}
                className="flex h-2.5 gap-0.5 overflow-hidden rounded-full bg-muted"
              >
                {TICKET_STATUSES.map((st) =>
                  s.byStatus[st] ? (
                    <motion.span
                      key={st}
                      className={cn("h-full origin-left", STATUS_DOT[st])}
                      style={{ width: `${(s.byStatus[st] / Math.max(1, s.total)) * 100}%` }}
                      initial={{ scaleX: 0 }}
                      animate={{ scaleX: 1 }}
                      transition={{ duration: reduce ? 0 : DURATION.fill, ease: EASE_SWAP }}
                    />
                  ) : null,
                )}
              </div>
              <ul className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[13px]">
                {TICKET_STATUSES.map((st) => (
                  <li key={st} className="flex items-center gap-2">
                    <span className={cn("size-2 shrink-0 rounded-full", STATUS_DOT[st])} aria-hidden />
                    <span className="text-muted-foreground">{TICKET_STATUS_LABELS[st]}</span>
                    <span className="ml-auto font-semibold tabular-nums">{s.byStatus[st]}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Open by priority</CardTitle>
              <CardDescription>Everything not yet done</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="grid gap-2">
                {[...TICKET_PRIORITIES].reverse().map((p, i) => (
                  <li key={p} className="grid grid-cols-[5rem_minmax(0,1fr)_2rem] items-center gap-3 text-[13px]">
                    <span className="flex items-center gap-2">
                      <span className={cn("size-2 rounded-full", PRIORITY_STYLES[p].dot)} aria-hidden />
                      {PRIORITY_STYLES[p].label}
                    </span>
                    <RateBar
                      value={s.openByPriority[p] / maxPriority}
                      tone={p === "urgent" ? "problem" : p === "high" ? "pending" : "neutral"}
                      delay={rowDelay(i, reduce)}
                      label={`${PRIORITY_STYLES[p].label}: ${s.openByPriority[p]} open`}
                    />
                    <span className="text-right font-semibold tabular-nums">{s.openByPriority[p]}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>

        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Recent activity</CardTitle>
            <CardDescription>The latest tickets to change or get a reply</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="divide-y divide-hairline">
              {recent.map((t) => (
                <li key={t.id}>
                  <button
                    type="button"
                    onClick={() => openTicket(t.no)}
                    className="group flex w-full items-center gap-3 rounded-md px-2 py-2 text-left outline-none transition-colors hover:bg-tone-soft focus-visible:ring-3 focus-visible:ring-ring/45"
                  >
                    <span className="w-14 shrink-0 font-mono text-xs text-muted-foreground">{formatTicketNo(t.no)}</span>
                    <span className="min-w-0 flex-1 truncate text-[13px] font-medium">{t.title}</span>
                    <span className="hidden shrink-0 text-xs text-muted-foreground sm:inline">{dashboardById(t.dashboard).label}</span>
                    <span className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
                      <span className={cn("size-2 rounded-full", STATUS_DOT[t.status])} aria-hidden />
                      {TICKET_STATUS_LABELS[t.status]}
                    </span>
                    <span className="w-16 shrink-0 text-right text-xs text-subtle-foreground tabular-nums" suppressHydrationWarning>
                      {relativeTime(t.updatedAt, now)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </Reveal>
    </DashboardOverview>
  );
}
```

- [ ] **Step 9: Write `src/components/modules/tickets/TicketsScreen.tsx`**. This is the Overview-only version; Tasks 4, 5 and 7 replace it.

```tsx
"use client";

import * as React from "react";
import { toast } from "sonner";
import { useTickets } from "@/state/tickets-store";
import { useTabParam } from "@/hooks/useTabParam";
import { PageContainer } from "@/components/ui/page";
import { TabPanels } from "@/components/ui/sliding-tabs";
import { formatTicketNo } from "./data";
import { TicketDialog } from "./TicketDialog";
import { TicketsOverview } from "./TicketsOverview";
import { useTicketParams } from "./use-ticket-params";

const TABS = ["overview"] as const;

/**
 * Tickets — its sections in the rail (`?tab=`). The open ticket (`?ticket=118`)
 * sits above them, so a link to a ticket opens it whichever section is showing.
 * Board, Projects and Archived arrive in the following tasks; until then their
 * rail items show the Overview.
 */
export function TicketsScreen() {
  const [tab, , dir] = useTabParam(TABS, "overview");
  return (
    <PageContainer>
      <TabPanels value={tab} dir={dir}>
        <TicketsOverview />
      </TabPanels>
      <OpenTicket />
    </PageContainer>
  );
}

/** The ticket in `?ticket=`, over whichever section is showing. */
function OpenTicket() {
  const { tickets, saveTicket, archiveTicket, restoreTicket, reply } = useTickets();
  const { ticketNo, closeTicket } = useTicketParams();
  // Kept after close, so the dialog keeps its content while it animates out.
  const [shownNo, setShownNo] = React.useState<number | null>(ticketNo);
  React.useEffect(() => {
    if (ticketNo !== null) setShownNo(ticketNo);
  }, [ticketNo]);

  const missing = ticketNo !== null && !tickets.some((t) => t.no === ticketNo);
  // A link to a ticket that doesn't exist clears itself instead of opening an empty dialog.
  React.useEffect(() => {
    if (!missing || ticketNo === null) return;
    toast(`There's no ticket ${formatTicketNo(ticketNo)}`, { id: "ticket-missing", description: "Check the number in the link." });
    closeTicket();
  }, [missing, ticketNo, closeTicket]);

  const ticket = shownNo === null ? null : (tickets.find((t) => t.no === shownNo) ?? null);
  if (!ticket) return null;
  return (
    <TicketDialog
      open={ticketNo !== null && !missing}
      onClose={closeTicket}
      ticket={ticket}
      onSave={saveTicket}
      onArchive={archiveTicket}
      onRestore={restoreTicket}
      onReply={reply}
    />
  );
}
```

- [ ] **Step 10: Write `app/(dashboard)/tickets/page.tsx`**

```tsx
import type { Metadata } from "next";
import { Suspense } from "react";
import { ScreenSkeleton } from "@/components/ui/screen-skeleton";
import { TicketsScreen } from "@/components/modules/tickets/TicketsScreen";

export const metadata: Metadata = { title: "Tickets" };

export default function Page() {
  return (
    <Suspense fallback={<ScreenSkeleton />}>
      <TicketsScreen />
    </Suspense>
  );
}
```

- [ ] **Step 11: Teach Jarvis about tickets** in `src/components/shell/assistant/jarvis-knowledge.ts`

a) Imports. After the line `import { liveOf, type AdminState } from "@/components/modules/admin/admin-store";`, add:
```ts
import { TICKET_STATUS_LABELS, assigneeName, formatTicketNo, type Ticket } from "@/components/modules/tickets/data";
import { DAY, allProjectProgress, ticketStats } from "@/components/modules/tickets/logic";
import { dashboardById } from "@/components/shell/dashboards";
```

b) Context. Replace:
```ts
  /** Admin's roles, section access and sign-outs. */
  admin: AdminState;
}
```
with:
```ts
  /** Admin's roles, section access and sign-outs. */
  admin: AdminState;
  /** The Tickets board, live (its store). */
  tickets: Ticket[];
}
```

c) The brief. Replace:
```ts
    fallback: "On IT I can list open tickets and explain how to raise one or report phishing.",
  },
```
with:
```ts
    fallback: "On IT I can list open tickets and explain how to raise one or report phishing.",
  },
  tickets: {
    subtitle: "Improvements and projects",
    greeting: "I can tell you which dashboards have open tickets, how each project is going, and how to raise a ticket.",
    faqs: [
      {
        group: "Overview",
        question: "Which dashboards have open tickets?",
        keys: ["which dashboard", "by dashboard", "most open", "dashboards", "open tickets"],
        answer: (ctx) => {
          const s = ticketStats(ctx.tickets, Date.now());
          if (!s.openByDashboard.length) return { text: "Nothing is open: every ticket is done or archived.", source: "Tickets · live" };
          return {
            text: `${plural(s.open, "open ticket")} across ${plural(s.openByDashboard.length, "dashboard")}:`,
            bullets: s.openByDashboard.map(({ dashboard, count }) => `${dashboardById(dashboard).label}: ${count} open`),
            actions: [{ label: "Open the board", href: "/tickets?tab=board" }],
            source: "Tickets · live",
          };
        },
      },
      {
        group: "Projects",
        question: "How are the projects going?",
        keys: ["project", "projects", "progress", "closest", "in build", "deploy"],
        answer: (ctx) => {
          const all = allProjectProgress(ctx.tickets).sort((a, b) => (b.pct ?? -1) - (a.pct ?? -1));
          return {
            text: `${plural(all.length, "project")}, furthest along first:`,
            bullets: all.map(
              (p) =>
                `${p.project.name}: ${p.total ? `${p.done} of ${p.total} tickets done (${p.pct}%)` : "no tickets yet"} · ${p.project.state} · ${assigneeName(p.project.owner)}.`,
            ),
            actions: [{ label: "Open Projects", href: "/tickets?tab=projects" }],
            source: "Tickets · live",
          };
        },
      },
      {
        group: "Board",
        question: "How do I raise a ticket?",
        keys: ["raise", "new ticket", "suggest", "improvement", "idea", "feedback"],
        answer: () => ({
          text: "Press “Suggest an improvement” in the sidebar on any dashboard. It opens a new ticket with that dashboard already chosen, and the ticket lands in To Do on the board. On the board itself, “New ticket” does the same.",
          actions: [{ label: "Open the board", href: "/tickets?tab=board" }],
        }),
      },
      {
        group: "Board",
        question: "What's the oldest open ticket?",
        keys: ["oldest", "longest", "waiting longest", "stuck"],
        answer: (ctx) => {
          const t = ticketStats(ctx.tickets, Date.now()).oldestOpen;
          if (!t) return { text: "Nothing is open, so nothing is waiting.", source: "Tickets · live" };
          const days = Math.floor((Date.now() - t.createdAt) / DAY);
          return {
            text: `${formatTicketNo(t.no)} · ${t.title} has been open ${days < 1 ? "less than a day" : plural(days, "day")}.`,
            bullets: [
              `For ${dashboardById(t.dashboard).label}, raised by ${t.raisedBy}.`,
              `In ${TICKET_STATUS_LABELS[t.status]}, ${t.assignee ? `assigned to ${assigneeName(t.assignee)}` : "not assigned"}.`,
            ],
            actions: [{ label: `Open ${formatTicketNo(t.no)}`, href: `/tickets?tab=board&ticket=${t.no}` }],
            source: "Tickets · live",
          };
        },
      },
      ...USING("Tickets"),
    ],
    fallback: "On Tickets I can list the dashboards with open tickets, say how each project is going, find the oldest open ticket and explain how to raise one.",
  },
```

d) Featured. Replace:
```ts
  it: ["What tickets are open?", "How do I raise a ticket?", "How do I report a phishing email?"],
```
with:
```ts
  it: ["What tickets are open?", "How do I raise a ticket?", "How do I report a phishing email?"],
  tickets: ["Which dashboards have open tickets?", "How are the projects going?", "How do I raise a ticket?"],
```

- [ ] **Step 12: Pass tickets to Jarvis** in `src/components/shell/assistant/JarvisBubble.tsx`

After `import { useAdmin } from "@/components/modules/admin/admin-store";`, add:
```ts
import { useTickets } from "@/state/tickets-store";
```
Replace `  const admin = useAdmin();` with:
```ts
  const admin = useAdmin();
  const { tickets } = useTickets();
```
Replace:
```ts
    payRun,
    admin,
```
with:
```ts
    payRun,
    admin,
    tickets,
```

- [ ] **Step 13: List Tickets in the tone notes** in `src/components/shell/dashboard-tones.ts`

Replace `Marketing, HR, Projects, Knowledge, Leadership, IT, Admin;` with `Marketing, HR, Projects, Knowledge, Leadership, IT, Tickets, Admin;`.

- [ ] **Step 14: Type-check**

```bash
npx tsc --noEmit
```
Expected: no output.

- [ ] **Step 15: Start the worktree dev server and set up the browser checks**

Run in the background, from the worktree:
```bash
npx next dev -p 3100
```
Then wait until `curl -s -o /dev/null -w "%{http_code}" http://localhost:3100/tickets` prints `200`. After that:
```bash
mkdir -p "$S/pw" "$S/shots" && cd "$S/pw" && npm init -y >/dev/null && npm i playwright-core@^1.63.0
```

Create `$S/pw/lib.mjs`:
```js
import { chromium } from "playwright-core";
import fs from "node:fs";

const S = "C:/Users/Kane/AppData/Local/Temp/claude/c--Users-Kane-Desktop-Locale-launchpad/834af21c-da2e-4706-9af3-77a5b127f34a/scratchpad";
const EXE = "C:/Users/Kane/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe";
export const BASE = process.env.BASE ?? "http://localhost:3100";
export const OUT = `${S}/shots`;
fs.mkdirSync(OUT, { recursive: true });

/** A fresh browser on a fresh store (every goto reloads, so the seed comes back). */
export async function open({ theme = "light", width = 1440, height = 900, reducedMotion = "no-preference" } = {}) {
  const browser = await chromium.launch({ executablePath: EXE });
  const context = await browser.newContext({ viewport: { width, height }, reducedMotion });
  await context.addInitScript((t) => {
    try {
      localStorage.setItem("launchpad-theme", t);
      localStorage.setItem("launchpad:sidebar:collapsed", "0");
    } catch {}
  }, theme);
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(`console: ${m.text()}`);
  });
  return { browser, page, errors };
}

let failures = 0;
export function check(ok, label) {
  if (ok) console.log(`  ok  ${label}`);
  else {
    failures++;
    console.log(`FAIL  ${label}`);
  }
}
export function noErrors(errors, label) {
  check(errors.length === 0, `${label}: no console errors${errors.length ? ` — ${errors.join(" | ")}` : ""}`);
}
export function done() {
  console.log(failures ? `\n${failures} check(s) failed` : "\nall checks passed");
  process.exitCode = failures ? 1 : 0;
}
export const shot = (page, name) => page.screenshot({ path: `${OUT}/${name}.png` });

/** A board column by its heading ("To Do, 11 tickets"). */
export const column = (page, name) => page.locator("section", { has: page.getByRole("heading", { name: new RegExp(`^${name},`) }) });
export const cardIds = (scope) => scope.locator("[data-ticket-card]").evaluateAll((els) => els.map((e) => e.getAttribute("data-ticket-card")));
export async function closeDialog(page) {
  await page.getByRole("dialog").getByRole("button", { name: "Close", exact: true }).first().click();
  await page.waitForTimeout(450);
}
```

- [ ] **Step 16: Write and run `$S/pw/tickets-overview.mjs`**

```js
import { BASE, open, check, noErrors, done, shot } from "./lib.mjs";

for (const theme of ["light", "dark"]) {
  const { browser, page, errors } = await open({ theme });
  await page.goto(`${BASE}/tickets`, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "Tickets overview" }).waitFor();
  await page.waitForTimeout(1500); // count-ups settle
  if (theme === "dark") check(await page.evaluate(() => document.documentElement.classList.contains("dark")), "[dark] dark theme applied");

  const card = (label) => page.locator("a", { hasText: label }).first().innerText();
  check((await card("Open now")).includes("20"), `[${theme}] Open now shows 20`);
  check((await card("Raised this week")).includes("+2 vs last week"), `[${theme}] Raised this week compares with last week`);
  check((await card("Projects")).includes("Finance Health Check form, 67%"), `[${theme}] Projects card names the closest project`);
  const firstRow = await page.locator("a[href*='dash=']").first().innerText();
  check(/Operations[\s\S]*9/.test(firstRow), `[${theme}] Open by dashboard leads with Operations, 9`);
  check((await page.getByRole("navigation", { name: "Switch dashboard" }).getByText("Tickets", { exact: true }).count()) > 0, `[${theme}] Switch view lists Tickets`);
  await shot(page, `overview-${theme}`);

  // A ticket link opens that ticket over the Overview.
  await page.goto(`${BASE}/tickets?ticket=104`, { waitUntil: "networkidle" });
  const dialog = page.getByRole("dialog");
  await dialog.waitFor();
  await page.waitForTimeout(600);
  const text = await dialog.innerText();
  check(text.includes("LP-104"), `[${theme}] ?ticket=104 opens LP-104`);
  check(text.includes("moved In Progress → Testing"), `[${theme}] history reads as a trail`);
  check(text.includes("Works for Forma. Checking Dale Alcock next."), `[${theme}] replies sit in the feed`);
  await shot(page, `ticket-104-${theme}`);
  await page.getByRole("dialog").getByRole("button", { name: "Close", exact: true }).first().click();
  await page.waitForTimeout(500);
  check(!page.url().includes("ticket="), `[${theme}] closing the dialog drops ?ticket=`);

  // A link to a ticket that doesn't exist clears itself.
  await page.goto(`${BASE}/tickets?ticket=999`, { waitUntil: "networkidle" });
  await page.getByText("There's no ticket LP-999").waitFor({ timeout: 5000 });
  await page.waitForTimeout(400);
  check(!page.url().includes("ticket="), `[${theme}] an unknown ticket number clears from the URL`);
  check((await page.getByRole("dialog").count()) === 0, `[${theme}] no empty dialog for an unknown ticket`);

  noErrors(errors, `[${theme}] overview`);
  await browser.close();
}

// Jarvis answers from the live store.
{
  const { browser, page, errors } = await open();
  await page.goto(`${BASE}/tickets`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Ask Jarvis about Tickets" }).click();
  await page.getByRole("button", { name: "Which dashboards have open tickets?" }).click();
  await page.getByText("Operations: 9 open").waitFor({ timeout: 6000 });
  check(true, "Jarvis lists open tickets by dashboard");
  await page.getByRole("button", { name: "How are the projects going?" }).first().click();
  await page.getByText("Finance Health Check form: 2 of 3 tickets done (67%)", { exact: false }).waitFor({ timeout: 6000 });
  check(true, "Jarvis reports project progress");
  noErrors(errors, "jarvis");
  await browser.close();
}

done();
```

Run:
```bash
cd "$S/pw" && node tickets-overview.mjs
```
Expected: every line `ok`, ending in `all checks passed`. Open `$S/shots/overview-light.png`, `overview-dark.png` and `ticket-104-dark.png` with the Read tool, and confirm the cards, bars and dialog look right in both themes.

- [ ] **Step 17: Commit**

```bash
cd C:/Users/Kane/Desktop/Locale-launchpad-tickets
git add src/state/tickets-store.tsx src/state/launchpad-store.tsx src/components/modules/tickets/use-ticket-params.ts src/components/modules/tickets/TicketsOverview.tsx src/components/modules/tickets/TicketsScreen.tsx "app/(dashboard)/tickets/page.tsx" "app/(dashboard)/layout.tsx" src/components/shell/dashboards.ts src/components/shell/DashboardSwitchLoader.tsx src/components/shell/dashboard-tones.ts src/components/modules/admin/data.ts src/components/shell/assistant/jarvis-knowledge.ts src/components/shell/assistant/JarvisBubble.tsx
git commit -m "Add the Tickets dashboard: store, Overview, open ticket and Jarvis" -m "Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: The board

**Files:**
- Create: `src/hooks/use-board-drag.ts`
- Create: `src/components/modules/tickets/TicketsBoard.tsx`
- Modify: `src/components/modules/tickets/TicketsScreen.tsx` (whole file)
- Scratch: `$S/pw/tickets-board.mjs`

**Interfaces:**
- Consumes: `useTickets()` (`tickets`, `moveTicket`, `openNewTicket`), `useTicketParams()`, `byBoardOrder`, `matchesQuery`, `TicketCardBody`, `ticketCardClass`, `PRIORITY_STYLES`, `STATUS_DOT`, `BOARD_ACTOR`.
- Produces:
  - `useBoardDrag<K>({ columnAt, onHover, onDrop, slotOf })` returns `BoardDrag<K>`, which has `active`, `over`, `dropping`, `x`, `y`, `start(e, id, from)` and `wasJustDropped()`.
  - `TicketsBoard()`.
  - Each card button carries `data-ticket-card="t-<no>"`.

- [ ] **Step 1: Write `src/hooks/use-board-drag.ts`**

```ts
"use client";

import * as React from "react";
import { animate, useMotionValue, useReducedMotion, type MotionValue } from "motion/react";

/** A card follows the pointer only after this much travel, so a click still opens it (HRIS: 5px). */
const ACTIVATE_PX = 5;

export interface BoardDrag<K extends string> {
  /** The card being carried, and its width for the overlay. Stays set through the drop flight. */
  active: { id: string; width: number } | null;
  /** The column under the pointer while carrying. */
  over: K | null;
  /** True while the overlay flies into its slot after the drop. */
  dropping: boolean;
  /** Overlay position (viewport px). */
  x: MotionValue<number>;
  y: MotionValue<number>;
  /** Spread onto a card: starts a drag on a mouse or pen press. */
  start: (e: React.PointerEvent<HTMLElement>, id: string, from: K) => void;
  /** Browsers fire a click on the card right after a drop; check this before opening it. */
  wasJustDropped: () => boolean;
}

/**
 * Pointer drag for a column board, HRIS TicketsBoard's feel without dnd-kit:
 * the card lifts into an overlay that follows the pointer, the column under it
 * lights up, `onHover` lets the board slot the card into that column at once so
 * it reflows under the pointer, and on release the overlay glides into the
 * card's new slot (found with `slotOf`). Escape, or letting go outside every
 * column, puts it back.
 *
 * The general version of Sales' `pipeline/use-board-drag.ts`, which looks its
 * slot up by `[data-deal-card]`. Follow-up: point the pipeline here.
 *
 * Touch is left to scrolling: on a phone, tap the card and change its column.
 */
export function useBoardDrag<K extends string>({
  columnAt,
  onHover,
  onDrop,
  slotOf,
}: {
  /** The column under a viewport point, or null. */
  columnAt: (x: number, y: number) => K | null;
  onHover: (id: string, column: K) => void;
  /** `to` is null when the drag was cancelled. */
  onDrop: (id: string, from: K, to: K | null) => void;
  /** The card's element once it has re-rendered in its new slot. */
  slotOf: (id: string) => HTMLElement | null;
}): BoardDrag<K> {
  const reduce = useReducedMotion();
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const [active, setActive] = React.useState<{ id: string; width: number } | null>(null);
  const [over, setOver] = React.useState<K | null>(null);
  const [dropping, setDropping] = React.useState(false);
  const justDropped = React.useRef(false);
  const cleanup = React.useRef<(() => void) | null>(null);

  // Latest callbacks, so a drag that started a render ago still calls the current ones.
  const cb = React.useRef({ columnAt, onHover, onDrop, slotOf });
  cb.current = { columnAt, onHover, onDrop, slotOf };

  React.useEffect(() => () => cleanup.current?.(), []);

  const start = React.useCallback(
    (e: React.PointerEvent<HTMLElement>, id: string, from: K) => {
      if (e.button !== 0 || e.pointerType === "touch" || cleanup.current) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const origin = { x: e.clientX, y: e.clientY };
      const grab = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      let started = false;
      let current: K | null = from;

      const settle = (to: K | null) => {
        justDropped.current = true;
        window.setTimeout(() => (justDropped.current = false), 150);
        cb.current.onDrop(id, from, to);
        setOver(null);
        // Fly the overlay into wherever the card now sits (its slot in the new
        // column, or back home), then hand back to the card.
        requestAnimationFrame(() => {
          const target = to ? cb.current.slotOf(id)?.getBoundingClientRect() : rect;
          if (!target || reduce) {
            setActive(null);
            return;
          }
          setDropping(true);
          const ease = [0.2, 0, 0, 1] as const;
          Promise.all([
            animate(x, target.left, { duration: 0.22, ease }),
            animate(y, target.top, { duration: 0.22, ease }),
          ]).then(() => {
            setDropping(false);
            setActive(null);
          });
        });
      };

      const onMove = (ev: PointerEvent) => {
        if (!started) {
          if (Math.hypot(ev.clientX - origin.x, ev.clientY - origin.y) < ACTIVATE_PX) return;
          started = true;
          setActive({ id, width: rect.width });
          setOver(from);
          document.body.style.userSelect = "none";
          document.body.style.cursor = "grabbing";
        }
        x.set(ev.clientX - grab.x);
        y.set(ev.clientY - grab.y);
        const hit = cb.current.columnAt(ev.clientX, ev.clientY);
        if (hit !== current) {
          current = hit;
          setOver(hit);
          if (hit) cb.current.onHover(id, hit);
        }
      };
      const finish = (to: K | null) => {
        cleanup.current?.();
        if (started) settle(to);
      };
      const onUp = () => finish(current);
      const onCancel = () => finish(null);
      const onKey = (ev: KeyboardEvent) => {
        if (ev.key !== "Escape" || !started) return;
        ev.preventDefault();
        ev.stopPropagation();
        finish(null);
      };

      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      window.addEventListener("pointercancel", onCancel);
      window.addEventListener("keydown", onKey, true);
      cleanup.current = () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        window.removeEventListener("pointercancel", onCancel);
        window.removeEventListener("keydown", onKey, true);
        document.body.style.userSelect = "";
        document.body.style.cursor = "";
        cleanup.current = null;
      };
    },
    [reduce, x, y],
  );

  const wasJustDropped = React.useCallback(() => justDropped.current, []);

  return { active, over, dropping, x, y, start, wasJustDropped };
}
```

- [ ] **Step 2: Write `src/components/modules/tickets/TicketsBoard.tsx`**

```tsx
"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Plus } from "lucide-react";
import { useTickets } from "@/state/tickets-store";
import { useBoardDrag, type BoardDrag } from "@/hooks/use-board-drag";
import { dashboardById } from "@/components/shell/dashboards";
import { cn } from "@/lib/utils";
import { DURATION, EASE_OUT, EASE_SWAP, rowDelay } from "@/lib/motion";
import { PageHeader } from "@/components/ui/page";
import { Button } from "@/components/ui/button";
import { SearchInput } from "@/components/ui/input";
import { SmoothSelect } from "@/components/ui/select";
import { NoMatches } from "@/components/ui/states";
import { Reveal } from "@/components/ui/reveal";
import { Ticker, useCascading } from "@/components/ui/list-motion";
import {
  BOARD_ACTOR,
  PROJECTS,
  TICKET_DASHBOARDS,
  TICKET_PRIORITIES,
  TICKET_STATUSES,
  TICKET_STATUS_LABELS,
  projectById,
  type Ticket,
  type TicketStatus,
} from "./data";
import { byBoardOrder, matchesQuery } from "./logic";
import { PRIORITY_STYLES, STATUS_DOT, TicketCardBody, ticketCardClass } from "./TicketCard";
import { useTicketParams } from "./use-ticket-params";

const cardSelector = (id: string) => `[data-ticket-card="${CSS.escape(id)}"]`;

const EMPTY_COLUMN: Record<TicketStatus, string> = {
  todo: "New tickets land here",
  in_progress: "Nothing in progress",
  testing: "Nothing waiting on a check",
  done: "Finished tickets land here",
};

/**
 * Tickets › Board: HRIS's Tickets board in the Launchpad shell, with the feel
 * of Sales' pipeline. Four columns, cards sorted urgent-first then oldest, a
 * pointer drag between columns (Alt+← / Alt+→ from the keyboard) and a click
 * that opens the ticket. The dashboard, project and priority filters live in
 * the URL, so the Overview and Projects link straight into a filtered board.
 *
 * Motion (HRIS § 14): cards cascade in on arrival, a moved card glides to its
 * new column while the rest close the gap, filtered-out cards drift away, and
 * column counts tick.
 */
export function TicketsBoard() {
  const { tickets, moveTicket, openNewTicket } = useTickets();
  const { dashboard, project, priority, set, openTicket } = useTicketParams();
  const reduce = useReducedMotion();
  const hintId = React.useId();
  const [query, setQuery] = React.useState("");

  // While a card is carried, the column it hovers holds it, so the board
  // reflows under the pointer (HRIS's onDragOver). Nothing is written until the drop.
  const [carry, setCarry] = React.useState<{ id: string; status: TicketStatus } | null>(null);
  const columnRefs = React.useRef(new Map<TicketStatus, HTMLElement>());

  const drag = useBoardDrag<TicketStatus>({
    columnAt: (x, y) => {
      for (const [status, el] of columnRefs.current) {
        const r = el.getBoundingClientRect();
        if (x >= r.left && x <= r.right && y >= r.top - 48 && y <= r.bottom + 160) return status;
      }
      return null;
    },
    onHover: (id, status) => setCarry({ id, status }),
    onDrop: (id, from, to) => {
      setCarry(null);
      if (to && to !== from) moveTicket(id, to);
    },
    slotOf: (id) => document.querySelector<HTMLElement>(cardSelector(id)),
  });

  const onBoard = React.useMemo(() => tickets.filter((t) => !t.archived), [tickets]);
  const filtersActive = dashboard !== null || project !== null || priority !== null || query.trim() !== "";
  const shown = React.useMemo(
    () =>
      onBoard.filter(
        (t) =>
          (!dashboard || t.dashboard === dashboard) &&
          (!project || t.project === project) &&
          (!priority || t.priority === priority) &&
          matchesQuery(t, query),
      ),
    [onBoard, dashboard, project, priority, query],
  );

  const columns = React.useMemo(() => {
    const map = Object.fromEntries(TICKET_STATUSES.map((s) => [s, [] as Ticket[]])) as Record<TicketStatus, Ticket[]>;
    for (const t of shown) map[carry?.id === t.id ? carry.status : t.status].push(t);
    for (const s of TICKET_STATUSES) map[s].sort(byBoardOrder);
    return map;
  }, [shown, carry]);

  const clearFilters = () => {
    setQuery("");
    set({ dash: null, project: null, priority: null });
  };

  /** Alt+← / Alt+→ on a focused card: one column along, focus following the card. */
  const step = (t: Ticket, by: 1 | -1) => {
    const to = TICKET_STATUSES[TICKET_STATUSES.indexOf(t.status) + by];
    if (!to) return;
    moveTicket(t.id, to);
    window.setTimeout(() => columnRefs.current.get(to)?.querySelector<HTMLElement>(cardSelector(t.id))?.focus(), 60);
  };

  const carried = drag.active ? tickets.find((t) => t.id === drag.active?.id) : undefined;
  const filterLabel =
    query.trim() ||
    [
      dashboard ? dashboardById(dashboard).label : null,
      projectById(project)?.name ?? null,
      priority ? `${PRIORITY_STYLES[priority].label} priority` : null,
    ]
      .filter(Boolean)
      .join(" · ");

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Board"
        description="Every open ask, by column. Drag a card to move it, or open it to edit, reply or archive. Urgent cards sit at the top of each column."
        actions={
          <Button onClick={() => openNewTicket({ dashboard: dashboard ?? undefined, project: project ?? undefined, raisedBy: BOARD_ACTOR })}>
            <Plus aria-hidden /> New ticket
          </Button>
        }
      />

      <Reveal index={0} className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <p className="text-xs text-muted-foreground tabular-nums" aria-live="polite">
          <Ticker value={shown.length} /> of {onBoard.length} tickets
        </p>
        <div className="flex w-full flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center lg:ml-auto lg:w-auto">
          <SmoothSelect
            value={dashboard ?? "all"}
            onChange={(v) => set({ dash: v === "all" ? null : v })}
            ariaLabel="Filter by dashboard"
            className="sm:w-48"
            options={[
              { value: "all", label: "All dashboards" },
              ...TICKET_DASHBOARDS.map((d) => {
                const Icon = d.icon;
                return {
                  value: d.id as string,
                  label: (
                    <span className="inline-flex items-center gap-2">
                      <Icon className="size-3.5 text-subtle-foreground" aria-hidden />
                      {d.label}
                    </span>
                  ),
                };
              }),
            ]}
          />
          <SmoothSelect
            value={project ?? "all"}
            onChange={(v) => set({ project: v === "all" ? null : v })}
            ariaLabel="Filter by project"
            className="sm:w-56"
            options={[{ value: "all", label: "All projects" }, ...PROJECTS.map((p) => ({ value: p.id, label: p.name }))]}
          />
          <SmoothSelect
            value={priority ?? "all"}
            onChange={(v) => set({ priority: v === "all" ? null : v })}
            ariaLabel="Filter by priority"
            className="sm:w-40"
            options={[
              { value: "all", label: "All priorities" },
              ...[...TICKET_PRIORITIES].reverse().map((p) => ({
                value: p as string,
                label: (
                  <span className="inline-flex items-center gap-2">
                    <span className={cn("size-2 rounded-full", PRIORITY_STYLES[p].dot)} aria-hidden />
                    {PRIORITY_STYLES[p].label}
                  </span>
                ),
              })),
            ]}
          />
          <SearchInput
            value={query}
            onChange={setQuery}
            count={query.trim() ? shown.length : undefined}
            placeholder="Search tickets…"
            aria-label="Search tickets"
            className="sm:w-60"
          />
        </div>
      </Reveal>

      <Reveal index={1} className="min-w-0">
        {onBoard.length > 0 && shown.length === 0 ? (
          <NoMatches query={filterLabel} onClear={clearFilters} className="rounded-xl border border-dashed border-border" />
        ) : (
          <>
            {/* On a phone the columns keep a readable width and snap as the board scrolls sideways. */}
            <div className="-mx-1 snap-x snap-proximity overflow-x-auto scroll-px-1 px-1 pt-1 pb-2 [scrollbar-width:thin]">
              <div className="grid min-w-[68rem] grid-cols-4 gap-3 sm:min-w-[56rem]">
                {TICKET_STATUSES.map((status) => (
                  <BoardColumn
                    key={status}
                    status={status}
                    tickets={columns[status]}
                    visible={shown}
                    filtersActive={filtersActive}
                    highlighted={drag.active !== null && drag.over === status}
                    drag={drag}
                    hintId={hintId}
                    onOpen={openTicket}
                    onStep={step}
                    refCallback={(el) => {
                      if (el) columnRefs.current.set(status, el);
                      else columnRefs.current.delete(status);
                    }}
                  />
                ))}
              </div>
            </div>
            <p id={hintId} className="sr-only">
              Press Enter to open the ticket. Alt with the left or right arrow moves it one column.
            </p>
            <p className="mt-2 text-xs text-subtle-foreground">
              Drag a card to another column to move it, or open it to edit, reply or archive. Cards sort by priority, then oldest first.
            </p>
          </>
        )}
      </Reveal>

      {/* The carried card, lifted and tilted under the pointer (HRIS's DragOverlay). */}
      {drag.active && carried
        ? createPortal(
            <motion.div
              aria-hidden
              className="pointer-events-none fixed top-0 left-0 z-[90]"
              style={{ x: drag.x, y: drag.y, width: drag.active.width }}
              initial={{ rotate: 0, scale: 1 }}
              animate={drag.dropping ? { rotate: 0, scale: 1 } : { rotate: 2, scale: 1.03 }}
              transition={{ duration: reduce ? 0 : 0.18, ease: EASE_OUT }}
            >
              <div className={ticketCardClass({ overlay: true })}>
                <TicketCardBody ticket={carried} />
              </div>
            </motion.div>,
            document.body,
          )
        : null}
    </div>
  );
}

function BoardColumn({
  status,
  tickets,
  visible,
  filtersActive,
  highlighted,
  drag,
  hintId,
  onOpen,
  onStep,
  refCallback,
}: {
  status: TicketStatus;
  tickets: Ticket[];
  /** Every card on the board after filters, so a card leaving this column for another isn't animated away. */
  visible: Ticket[];
  filtersActive: boolean;
  highlighted: boolean;
  drag: BoardDrag<TicketStatus>;
  hintId: string;
  onOpen: (no: number) => void;
  onStep: (t: Ticket, by: 1 | -1) => void;
  refCallback: (el: HTMLElement | null) => void;
}) {
  const reduce = useReducedMotion();
  const cascading = useCascading();
  const headingId = React.useId();
  const stillShown = React.useMemo(() => new Set(visible.map((t) => t.id)), [visible]);

  // Cards that were on the board last render move here without fading in;
  // cards a filter brings back fade in.
  const seen = React.useRef<Set<string> | null>(null);
  const before = seen.current;
  React.useEffect(() => {
    seen.current = stillShown;
  }, [stillShown]);

  return (
    <section
      ref={refCallback}
      aria-labelledby={headingId}
      className={cn(
        "flex min-h-72 min-w-0 snap-start flex-col rounded-xl border border-transparent bg-canvas",
        "transition-[background-color,border-color,box-shadow] duration-150 motion-reduce:transition-none",
        highlighted && "border-tone-line bg-tone-soft/70 ring-1 ring-tone-line",
      )}
    >
      <header className="flex items-center gap-2 px-3 pt-3 pb-2">
        <span className={cn("size-2 shrink-0 rounded-full", STATUS_DOT[status])} aria-hidden />
        <h2 id={headingId} className="truncate text-[13px] font-semibold">
          {TICKET_STATUS_LABELS[status]}
          <span className="sr-only">, {tickets.length} tickets</span>
        </h2>
        <span
          className="rounded-full bg-card px-1.5 py-px font-mono text-xs text-muted-foreground tabular-nums shadow-xs dark:bg-muted"
          aria-hidden
        >
          <Ticker value={tickets.length} />
        </span>
      </header>

      <ul className="flex flex-1 flex-col gap-2 px-2 pb-2">
        <AnimatePresence initial={false} custom={stillShown}>
          {tickets.map((t, i) => {
            const arriving = before !== null && !before.has(t.id);
            return (
              <motion.li
                key={t.id}
                layout={reduce ? false : "position"}
                layoutId={reduce ? undefined : `ticket-${t.id}`}
                custom={stillShown}
                variants={{
                  hidden: { opacity: 0, y: 6 },
                  shown: { opacity: 1, y: 0 },
                  // Moving to another column is the layout glide, not an exit.
                  gone: (shownIds: Set<string>) =>
                    shownIds.has(t.id)
                      ? { opacity: 0, transition: { duration: 0 } }
                      : { opacity: 0, scale: 0.96, transition: { duration: reduce ? 0 : 0.14, ease: EASE_OUT } },
                }}
                initial={before === null || arriving ? "hidden" : false}
                animate="shown"
                exit="gone"
                transition={{
                  duration: reduce ? 0 : 0.22,
                  ease: EASE_OUT,
                  delay: cascading ? rowDelay(i, reduce, 0.04, 0.24) : 0,
                  layout: { duration: reduce ? 0 : DURATION.swap, ease: EASE_SWAP, delay: 0 },
                }}
              >
                <button
                  type="button"
                  data-ticket-card={t.id}
                  aria-describedby={hintId}
                  className={ticketCardClass({ ghosted: drag.active?.id === t.id })}
                  onPointerDown={(e) => drag.start(e, t.id, t.status)}
                  onClick={() => {
                    if (!drag.wasJustDropped()) onOpen(t.no);
                  }}
                  onKeyDown={(e) => {
                    if (!e.altKey || (e.key !== "ArrowRight" && e.key !== "ArrowLeft")) return;
                    e.preventDefault();
                    onStep(t, e.key === "ArrowRight" ? 1 : -1);
                  }}
                >
                  <TicketCardBody ticket={t} />
                </button>
              </motion.li>
            );
          })}
        </AnimatePresence>
        {tickets.length === 0 ? (
          <li
            className={cn(
              "mx-1 mt-1 flex h-20 items-center justify-center rounded-lg border border-dashed px-3 text-center text-xs text-subtle-foreground",
              highlighted ? "border-tone-line text-tone-ink" : "border-border",
            )}
          >
            {highlighted ? "Drop to move here" : filtersActive ? "No tickets match" : EMPTY_COLUMN[status]}
          </li>
        ) : null}
      </ul>
    </section>
  );
}
```

- [ ] **Step 3: Route the Board section.** Replace the whole of `src/components/modules/tickets/TicketsScreen.tsx` with:

```tsx
"use client";

import * as React from "react";
import { toast } from "sonner";
import { useTickets } from "@/state/tickets-store";
import { useTabParam } from "@/hooks/useTabParam";
import { PageContainer } from "@/components/ui/page";
import { TabPanels } from "@/components/ui/sliding-tabs";
import { formatTicketNo } from "./data";
import { TicketDialog } from "./TicketDialog";
import { TicketsBoard } from "./TicketsBoard";
import { TicketsOverview } from "./TicketsOverview";
import { useTicketParams } from "./use-ticket-params";

const TABS = ["overview", "board"] as const;

/**
 * Tickets — its sections in the rail (`?tab=`). The open ticket (`?ticket=118`)
 * sits above them, so a link to a ticket opens it whichever section is showing.
 * Projects and Archived arrive in the following tasks; until then their rail
 * items show the Overview.
 */
export function TicketsScreen() {
  const [tab, , dir] = useTabParam(TABS, "overview");
  return (
    <PageContainer>
      <TabPanels value={tab} dir={dir}>
        {tab === "board" ? <TicketsBoard /> : <TicketsOverview />}
      </TabPanels>
      <OpenTicket />
    </PageContainer>
  );
}

/** The ticket in `?ticket=`, over whichever section is showing. */
function OpenTicket() {
  const { tickets, saveTicket, archiveTicket, restoreTicket, reply } = useTickets();
  const { ticketNo, closeTicket } = useTicketParams();
  // Kept after close, so the dialog keeps its content while it animates out.
  const [shownNo, setShownNo] = React.useState<number | null>(ticketNo);
  React.useEffect(() => {
    if (ticketNo !== null) setShownNo(ticketNo);
  }, [ticketNo]);

  const missing = ticketNo !== null && !tickets.some((t) => t.no === ticketNo);
  // A link to a ticket that doesn't exist clears itself instead of opening an empty dialog.
  React.useEffect(() => {
    if (!missing || ticketNo === null) return;
    toast(`There's no ticket ${formatTicketNo(ticketNo)}`, { id: "ticket-missing", description: "Check the number in the link." });
    closeTicket();
  }, [missing, ticketNo, closeTicket]);

  const ticket = shownNo === null ? null : (tickets.find((t) => t.no === shownNo) ?? null);
  if (!ticket) return null;
  return (
    <TicketDialog
      open={ticketNo !== null && !missing}
      onClose={closeTicket}
      ticket={ticket}
      onSave={saveTicket}
      onArchive={archiveTicket}
      onRestore={restoreTicket}
      onReply={reply}
    />
  );
}
```

- [ ] **Step 4: Type-check**

```bash
npx tsc --noEmit
```
Expected: no output.

- [ ] **Step 5: Write and run `$S/pw/tickets-board.mjs`**

```js
import { BASE, open, check, noErrors, done, shot, column, cardIds, closeDialog } from "./lib.mjs";

/** Carry a card sideways into another column at the card's own height, so the pointer stays in view. */
async function drag(page, no, toCol, { cancel = false } = {}) {
  const card = page.locator(`[data-ticket-card="t-${no}"]`);
  await card.scrollIntoViewIfNeeded();
  const box = await card.boundingBox();
  const target = await column(page, toCol).boundingBox();
  const y = box.y + box.height / 2;
  await page.mouse.move(box.x + box.width / 2, y);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 10, y + 6, { steps: 4 });
  await page.mouse.move(target.x + target.width / 2, y, { steps: 12 });
  if (cancel) await page.keyboard.press("Escape");
  await page.mouse.up();
  await page.waitForTimeout(700);
}

async function historyOf(page, no) {
  await page.locator(`[data-ticket-card="t-${no}"]`).click();
  const list = page.getByRole("dialog").getByRole("list", { name: "Replies and history" });
  await list.waitFor();
  await page.waitForTimeout(400);
  const text = await list.innerText();
  await closeDialog(page);
  return text;
}

{
  const { browser, page, errors } = await open();
  await page.goto(`${BASE}/tickets?tab=board`, { waitUntil: "networkidle" });
  await column(page, "To Do").waitFor();
  await page.waitForTimeout(800);

  check(
    JSON.stringify(await cardIds(column(page, "To Do"))) ===
      JSON.stringify(["t-109", "t-89", "t-90", "t-91", "t-94", "t-99", "t-103", "t-105", "t-111", "t-108", "t-102"]),
    "To Do sorts urgent first, then oldest",
  );
  check(JSON.stringify(await cardIds(column(page, "In Progress"))) === JSON.stringify(["t-86", "t-93", "t-98", "t-101", "t-107", "t-87", "t-88"]), "In Progress sorts the same way");

  await drag(page, 103, "In Progress");
  check((await cardIds(column(page, "In Progress"))).includes("t-103"), "dragging LP-103 moves it to In Progress");
  check((await historyOf(page, 103)).includes("moved To Do → In Progress"), "the move is on LP-103's history");

  await drag(page, 105, "Testing", { cancel: true });
  check((await cardIds(column(page, "To Do"))).includes("t-105"), "Escape mid-drag puts LP-105 back");
  check(!(await historyOf(page, 105)).includes("moved"), "a cancelled drag writes no history");

  await drag(page, 102, "To Do");
  check((await cardIds(column(page, "To Do"))).includes("t-102"), "LP-102 dropped on its own column stays there");
  check(!(await historyOf(page, 102)).includes("moved"), "dropping on its own column writes no history");

  await page.locator('[data-ticket-card="t-111"]').focus();
  await page.keyboard.press("Alt+ArrowRight");
  await page.waitForTimeout(600);
  check((await cardIds(column(page, "In Progress"))).includes("t-111"), "Alt+→ moves LP-111 to In Progress");
  await shot(page, "board-light");

  // Filters live in the URL.
  await page.goto(`${BASE}/tickets?tab=board&dash=sales`, { waitUntil: "networkidle" });
  await column(page, "To Do").waitFor();
  await page.waitForTimeout(600);
  check(JSON.stringify((await cardIds(page.locator("body"))).sort()) === JSON.stringify(["t-101", "t-109"]), "?dash=sales shows only Sales tickets");

  await page.goto(`${BASE}/tickets?tab=board&project=lastpass`, { waitUntil: "networkidle" });
  await column(page, "To Do").waitFor();
  await page.waitForTimeout(600);
  check(JSON.stringify((await cardIds(page.locator("body"))).sort()) === JSON.stringify(["t-97", "t-98", "t-99"]), "?project=lastpass shows only LastPass tickets");

  await page.goto(`${BASE}/tickets?tab=board&dash=sales`, { waitUntil: "networkidle" });
  await page.getByLabel("Search tickets").fill("zzz");
  await page.waitForTimeout(400);
  check((await page.getByRole("button", { name: "Clear search" }).count()) === 1, "a search with no results offers Clear search");
  await page.getByRole("button", { name: "Clear search" }).click();
  await page.waitForTimeout(500);
  check(!page.url().includes("dash="), "Clear search also clears the URL filters");

  // New ticket opens the shared create dialog, on the filtered dashboard.
  await page.goto(`${BASE}/tickets?tab=board&dash=hr`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "New ticket" }).click();
  const d = page.getByRole("dialog");
  await d.waitFor();
  check((await d.innerText()).includes("HR"), "New ticket on an HR-filtered board starts on HR");
  await d.getByRole("button", { name: "Cancel" }).click();

  noErrors(errors, "board");
  await browser.close();
}

// Dark + reduced motion: dragging still works, nothing flies.
{
  const { browser, page, errors } = await open({ theme: "dark", reducedMotion: "reduce" });
  await page.goto(`${BASE}/tickets?tab=board`, { waitUntil: "networkidle" });
  await column(page, "To Do").waitFor();
  await drag(page, 109, "In Progress");
  check((await cardIds(column(page, "In Progress"))).includes("t-109"), "[reduced motion] drag still moves LP-109");
  await shot(page, "board-dark");
  noErrors(errors, "board dark reduced");
  await browser.close();
}

// Phone: the board scrolls sideways and a tap opens the card.
{
  const { browser, page, errors } = await open({ width: 390, height: 844 });
  await page.goto(`${BASE}/tickets?tab=board`, { waitUntil: "networkidle" });
  await column(page, "To Do").waitFor();
  await page.locator('[data-ticket-card="t-109"]').click();
  await page.getByRole("dialog").waitFor();
  check((await page.getByRole("dialog").innerText()).includes("LP-109"), "[phone] tapping a card opens it");
  await shot(page, "board-phone");
  noErrors(errors, "board phone");
  await browser.close();
}

done();
```

Run:
```bash
cd "$S/pw" && node tickets-board.mjs
```
Expected: `all checks passed`. Open `board-light.png`, `board-dark.png` and `board-phone.png` with Read, and confirm the columns, chips and priority colours look right in both themes.

- [ ] **Step 6: Commit**

```bash
cd C:/Users/Kane/Desktop/Locale-launchpad-tickets
git add src/hooks/use-board-drag.ts src/components/modules/tickets/TicketsBoard.tsx src/components/modules/tickets/TicketsScreen.tsx
git commit -m "Add the Tickets board with drag, filters and keyboard moves" -m "Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: The Projects section

**Files:**
- Create: `src/components/modules/tickets/TicketsProjects.tsx`
- Modify: `src/components/modules/tickets/TicketsScreen.tsx` (whole file)
- Scratch: `$S/pw/tickets-projects.mjs`

**Interfaces:**
- Consumes: `useTickets()`, `allProjectProgress`, `assigneeName`, `formatTicketNo`, `hrefForKey("tickets:board", { project })`.
- Produces: `TicketsProjects()`. Each project card is a link to `/tickets?tab=board&project=<id>`, and its accessible name includes the project's name.

- [ ] **Step 1: Write `src/components/modules/tickets/TicketsProjects.tsx`**

```tsx
"use client";

import * as React from "react";
import Link from "next/link";
import { useReducedMotion } from "motion/react";
import { useTickets } from "@/state/tickets-store";
import { hrefForKey } from "@/components/shell/dashboards";
import { rowDelay } from "@/lib/motion";
import { PageHeader } from "@/components/ui/page";
import { Avatar } from "@/components/ui/avatar";
import { Pill, type PillTone } from "@/components/ui/pill";
import { RateBar } from "@/components/ui/progress";
import { CountUp } from "@/components/ui/count-up";
import { Reveal } from "@/components/ui/reveal";
import { assigneeName, formatTicketNo, type ProjectState } from "./data";
import { allProjectProgress, type ProjectProgress } from "./logic";

/** In build is the dashboard's own tone, Validation is waiting on a check, Deploying is nearly done. */
const STATE_TONE: Record<ProjectState, PillTone> = {
  "In build": "tone",
  Validation: "pending",
  Deploying: "ok",
};

/**
 * Tickets › Projects: what used to be the Projects dashboard. Each project is a
 * group of tickets, so its progress is its done tickets out of all of them and
 * moves when the board does. A card opens the board filtered to that project.
 */
export function TicketsProjects() {
  const { tickets } = useTickets();
  const progress = React.useMemo(() => allProjectProgress(tickets), [tickets]);
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Projects"
        description="Every internal build, its owner and its state. Progress is its done tickets out of all its tickets, so it moves when the board does."
      />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {progress.map((p, i) => (
          <Reveal key={p.project.id} index={i}>
            <ProjectCard progress={p} index={i} />
          </Reveal>
        ))}
      </div>
    </div>
  );
}

function ProjectCard({ progress: p, index }: { progress: ProjectProgress; index: number }) {
  const reduce = useReducedMotion();
  const owner = assigneeName(p.project.owner) ?? p.project.owner;
  return (
    <Link
      href={hrefForKey("tickets:board", { project: p.project.id })}
      scroll={false}
      className="group flex h-full flex-col rounded-xl border border-border bg-card px-4 py-3.5 shadow-sm outline-none transition-[translate,box-shadow,border-color] duration-200 ease-out hover:-translate-y-0.5 hover:border-tone-line hover:shadow-md focus-visible:ring-3 focus-visible:ring-ring/45 motion-reduce:transition-none motion-reduce:hover:translate-y-0"
    >
      <h2 className="min-h-8 text-[13px] leading-snug font-semibold">{p.project.name}</h2>
      <div className="mt-1 mb-3 flex items-center gap-1.5 text-xs text-muted-foreground">
        <Avatar name={owner} size="xs" />
        <span className="truncate">{owner}</span>
        <Pill tone={STATE_TONE[p.project.state]} variant="caps" className="ml-auto">
          {p.project.state}
        </Pill>
      </div>

      <RateBar
        value={p.pct === null ? null : p.pct / 100}
        height="h-[7px]"
        delay={rowDelay(index, reduce, 0.06, 0.3)}
        label={p.pct === null ? `${p.project.name}: no tickets yet` : `${p.project.name}: ${p.done} of ${p.total} tickets done`}
      />
      <p className="mt-1.5 flex items-baseline justify-between gap-2 text-xs">
        <span className="text-muted-foreground tabular-nums">{p.total ? `${p.done} of ${p.total} done` : "No tickets yet"}</span>
        {p.pct !== null ? (
          <span className="font-semibold text-foreground tabular-nums">
            <CountUp value={`${p.pct}%`} />
          </span>
        ) : null}
      </p>
      <p className="mt-0.5 text-xs text-subtle-foreground tabular-nums">
        {p.byStatus.todo} to do · {p.byStatus.in_progress} in progress · {p.byStatus.testing} testing
      </p>

      <p className="mt-3 line-clamp-2 border-t border-hairline pt-2.5 text-xs">
        {p.next ? (
          <>
            <span className="text-muted-foreground">Next up </span>
            <span className="font-mono text-muted-foreground">{formatTicketNo(p.next.no)}</span>{" "}
            <span className="font-medium">{p.next.title}</span>
          </>
        ) : (
          <span className="text-muted-foreground">{p.total ? "Every ticket is done" : "Tickets added to this project show up here"}</span>
        )}
      </p>
      <span className="mt-auto pt-2 text-xs font-medium text-tone-ink opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
        See its tickets →
      </span>
    </Link>
  );
}
```

- [ ] **Step 2: Route the Projects section.** Replace the whole of `src/components/modules/tickets/TicketsScreen.tsx` with:

```tsx
"use client";

import * as React from "react";
import { toast } from "sonner";
import { useTickets } from "@/state/tickets-store";
import { useTabParam } from "@/hooks/useTabParam";
import { PageContainer } from "@/components/ui/page";
import { TabPanels } from "@/components/ui/sliding-tabs";
import { formatTicketNo } from "./data";
import { TicketDialog } from "./TicketDialog";
import { TicketsBoard } from "./TicketsBoard";
import { TicketsOverview } from "./TicketsOverview";
import { TicketsProjects } from "./TicketsProjects";
import { useTicketParams } from "./use-ticket-params";

const TABS = ["overview", "board", "projects"] as const;

/**
 * Tickets — its sections in the rail (`?tab=`). The open ticket (`?ticket=118`)
 * sits above them, so a link to a ticket opens it whichever section is showing.
 * Archived arrives in a following task; until then its rail item shows the
 * Overview.
 */
export function TicketsScreen() {
  const [tab, , dir] = useTabParam(TABS, "overview");
  return (
    <PageContainer>
      <TabPanels value={tab} dir={dir}>
        {tab === "board" ? <TicketsBoard /> : tab === "projects" ? <TicketsProjects /> : <TicketsOverview />}
      </TabPanels>
      <OpenTicket />
    </PageContainer>
  );
}

/** The ticket in `?ticket=`, over whichever section is showing. */
function OpenTicket() {
  const { tickets, saveTicket, archiveTicket, restoreTicket, reply } = useTickets();
  const { ticketNo, closeTicket } = useTicketParams();
  // Kept after close, so the dialog keeps its content while it animates out.
  const [shownNo, setShownNo] = React.useState<number | null>(ticketNo);
  React.useEffect(() => {
    if (ticketNo !== null) setShownNo(ticketNo);
  }, [ticketNo]);

  const missing = ticketNo !== null && !tickets.some((t) => t.no === ticketNo);
  // A link to a ticket that doesn't exist clears itself instead of opening an empty dialog.
  React.useEffect(() => {
    if (!missing || ticketNo === null) return;
    toast(`There's no ticket ${formatTicketNo(ticketNo)}`, { id: "ticket-missing", description: "Check the number in the link." });
    closeTicket();
  }, [missing, ticketNo, closeTicket]);

  const ticket = shownNo === null ? null : (tickets.find((t) => t.no === shownNo) ?? null);
  if (!ticket) return null;
  return (
    <TicketDialog
      open={ticketNo !== null && !missing}
      onClose={closeTicket}
      ticket={ticket}
      onSave={saveTicket}
      onArchive={archiveTicket}
      onRestore={restoreTicket}
      onReply={reply}
    />
  );
}
```

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit
```
Expected: no output.

- [ ] **Step 4: Write and run `$S/pw/tickets-projects.mjs`**

```js
import { BASE, open, check, noErrors, done, shot, column, cardIds } from "./lib.mjs";

for (const theme of ["light", "dark"]) {
  const { browser, page, errors } = await open({ theme });
  await page.goto(`${BASE}/tickets?tab=projects`, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "Projects", exact: true }).waitFor();
  await page.waitForTimeout(1300);

  const cardText = (name) => page.getByRole("link", { name: new RegExp(name) }).first().innerText();
  const v1 = await cardText("Launchpad V1");
  check(v1.includes("3 of 9 done") && v1.includes("33%"), `[${theme}] Launchpad V1 shows 3 of 9 done, 33%`);
  check(v1.includes("LP-86") && v1.includes("Monday → HubSpot milestone sync"), `[${theme}] Launchpad V1's next up is LP-86`);
  check(v1.includes("3 to do · 3 in progress · 0 testing"), `[${theme}] Launchpad V1 shows its column split`);
  const hc = await cardText("Finance Health Check form");
  check(hc.includes("2 of 3 done") && hc.includes("67%") && hc.toUpperCase().includes("VALIDATION"), `[${theme}] Health Check shows 2 of 3, 67%, Validation`);
  await shot(page, `projects-${theme}`);

  await page.getByRole("link", { name: /LastPass rollout/ }).first().click();
  await page.waitForURL(/tab=board&project=lastpass/);
  await column(page, "To Do").waitFor();
  await page.waitForTimeout(600);
  check(JSON.stringify((await cardIds(page.locator("body"))).sort()) === JSON.stringify(["t-97", "t-98", "t-99"]), `[${theme}] a project card opens its tickets on the board`);

  noErrors(errors, `[${theme}] projects`);
  await browser.close();
}

{
  const { browser, page, errors } = await open({ width: 390, height: 844, reducedMotion: "reduce" });
  await page.goto(`${BASE}/tickets?tab=projects`, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "Projects", exact: true }).waitFor();
  await shot(page, "projects-phone");
  noErrors(errors, "projects phone reduced");
  await browser.close();
}

done();
```

Run `cd "$S/pw" && node tickets-projects.mjs`. Expected: `all checks passed`. Look at `projects-light.png`, `projects-dark.png` and `projects-phone.png`.

- [ ] **Step 5: Commit**

```bash
cd C:/Users/Kane/Desktop/Locale-launchpad-tickets
git add src/components/modules/tickets/TicketsProjects.tsx src/components/modules/tickets/TicketsScreen.tsx
git commit -m "Add Tickets › Projects: progress from each project's tickets" -m "Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: Remove the Projects dashboard

**Files:**
- Delete: `src/components/modules/projects/ProjectsScreen.tsx`, `ProjectsOverview.tsx`, `data.ts`
- Modify:
  - `app/(dashboard)/projects/page.tsx` (whole file: redirect)
  - `src/components/shell/dashboards.ts` (remove the Projects entry and the `ClipboardList` import)
  - `src/state/launchpad-store.tsx` (`ModuleId`)
  - `src/components/shell/DashboardSwitchLoader.tsx` (`SHAPES`)
  - `src/components/shell/assistant/jarvis-knowledge.ts` (projects import, brief, featured)
  - `src/components/modules/it/ItOverview.tsx`
  - `src/components/modules/admin/data.ts` (blurb, grants)
  - `src/components/shell/dashboard-tones.ts` (comment)
- Scratch: `$S/pw/tickets-removal.mjs`

**Interfaces:**
- Consumes: `PROJECTS`, `projectProgress`, `useTickets()`.
- Produces: no `"projects"` ModuleId. `/projects` answers with a 308 to `/tickets?tab=projects`.

- [ ] **Step 1: Read the Next 16 doc for `permanentRedirect`**

Read `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/permanentRedirect.md`. Confirm it can be called in a Server Component page, and that it throws: no `return` is needed.

- [ ] **Step 2: Turn `/projects` into a redirect.** Replace the whole of `app/(dashboard)/projects/page.tsx` with:

```tsx
import { permanentRedirect } from "next/navigation";

/**
 * Projects moved into Tickets on 2026-10-06: each project is now a group of
 * tickets on the Tickets board. Old links and bookmarks land on its Projects
 * section.
 */
export default function Page() {
  permanentRedirect("/tickets?tab=projects");
}
```

- [ ] **Step 3: Delete the module**

```bash
git rm -r src/components/modules/projects
```

- [ ] **Step 4: Remove it from the registry** in `src/components/shell/dashboards.ts`

Delete this block:
```ts
  {
    id: "projects",
    label: "Projects",
    title: "Projects dashboard",
    href: "/projects",
    icon: ClipboardList,
    tone: "charcoal",
    defaults: { tab: "overview" },
    items: [overview("projects"), tab("projects", "board", "Project board", ClipboardList)],
  },
```
Then delete the import line `  ClipboardList,`. Confirm nothing else uses it: `git grep -n ClipboardList -- src` should print nothing.

- [ ] **Step 5: Remove `"projects"`** from `ModuleId` in `src/state/launchpad-store.tsx` (delete the line `  | "projects"`) and from `SHAPES` in `src/components/shell/DashboardSwitchLoader.tsx` (delete the line `  projects: OVERVIEW,`).

- [ ] **Step 6: Remove the Projects brief** from `src/components/shell/assistant/jarvis-knowledge.ts`

- Delete the import line `import { PROJECTS, BOARD } from "@/components/modules/projects/data";`.
- Delete the whole `  projects: { … },` brief: from the line `  projects: {` down to its closing `  },`, which is followed by a blank line and `  knowledge: {`. Delete that blank line too.
- Delete the `FEATURED` line `  projects: ["What's in build right now?", "What's closest to done?", "What's on the to-do list?"],`.

- [ ] **Step 7: Read LastPass from its tickets** in `src/components/modules/it/ItOverview.tsx`

Replace:
```ts
import { PROJECTS } from "../projects/data";
import { IT_SAMPLE, type Ticket } from "./data";

/**
 * IT › Overview. Tickets come from the screen above it, so one raised on the
 * Help desk counts here. Devices are HR's asset register and LastPass is the
 * Projects list: IT reads them, it doesn't own them. Time to resolve and the
 * phishing module are samples (see `IT_SAMPLE`).
 */
```
with:
```ts
import { useTickets } from "@/state/tickets-store";
import { PROJECTS } from "../tickets/data";
import { projectProgress } from "../tickets/logic";
import { IT_SAMPLE, type Ticket } from "./data";

/**
 * IT › Overview. Tickets come from the screen above it, so one raised on the
 * Help desk counts here. Devices are HR's asset register and LastPass is a
 * project on the Tickets board, its progress worked out from its tickets: IT
 * reads them, it doesn't own them. Time to resolve and the phishing module are
 * samples (see `IT_SAMPLE`).
 */
```
Replace:
```ts
  const lastPass = PROJECTS.find((p) => p.name.includes("LastPass"));
```
with:
```ts
  const { tickets: board } = useTickets();
  const lastPassProject = PROJECTS.find((p) => p.id === "lastpass");
  const lastPass = lastPassProject ? projectProgress(lastPassProject, board) : null;
```
Replace:
```ts
          value: lastPass ? `${lastPass.progress}%` : "—",
          sub: lastPass ? `${lastPass.state.toLowerCase()} · Projects` : "not started",
          icon: KeyRound,
          to: "projects:board",
```
with:
```ts
          value: lastPass && lastPass.pct !== null ? `${lastPass.pct}%` : "—",
          sub: lastPass
            ? lastPass.total
              ? `${lastPass.done} of ${lastPass.total} done · ${lastPass.project.state.toLowerCase()}`
              : "no tickets yet"
            : "not started",
          icon: KeyRound,
          to: "tickets:projects",
```

- [ ] **Step 8: Move Admin's Projects role to Tickets** in `src/components/modules/admin/data.ts`

- Delete the line `  projects: "Unlocks the Projects dashboard and its board.",`.
- Replace `  "sean-oneill": ["operations", "projects", "leadership"],` with `  "sean-oneill": ["operations", "tickets", "leadership"],`.
- Replace `  "larnie-clark": ["operations", "projects", "knowledge"],` with `  "larnie-clark": ["operations", "tickets", "knowledge"],`.
- Replace `  "alison-carter": ["operations", "projects"],` with `  "alison-carter": ["operations", "tickets"],`.
- Replace `  "pablo-lopez": ["projects"],` with `  "pablo-lopez": ["tickets"],`.

- [ ] **Step 9: Update the tone notes** in `src/components/shell/dashboard-tones.ts`

Replace `Marketing, HR, Projects, Knowledge, Leadership, IT, Tickets, Admin;` with `Marketing, HR, Knowledge, Leadership, IT, Tickets, Admin;`.

- [ ] **Step 10: Confirm nothing points at Projects any more**

```bash
npx tsc --noEmit
git grep -n -e "modules/projects" -e "projects:board" -e '"projects"' -- src app
```
Expected: `tsc` prints nothing. `git grep` prints only `app/(dashboard)/projects/page.tsx`, if anything; it has no `"projects"` string, so most likely nothing.

- [ ] **Step 11: Write and run `$S/pw/tickets-removal.mjs`**

```js
import { BASE, open, check, noErrors, done } from "./lib.mjs";

const { browser, page, errors } = await open();

await page.goto(`${BASE}/projects`, { waitUntil: "networkidle" });
await page.waitForURL(/\/tickets\?tab=projects/);
await page.getByRole("heading", { name: "Projects", exact: true }).waitFor();
check(true, "/projects lands on Tickets › Projects");

const switcher = page.getByRole("navigation", { name: "Switch dashboard" });
check((await switcher.getByText("Projects", { exact: true }).count()) === 0, "Switch view no longer lists Projects");
check((await switcher.getByText("Tickets", { exact: true }).count()) > 0, "Switch view lists Tickets");

await page.goto(`${BASE}/it`, { waitUntil: "networkidle" });
await page.getByRole("heading", { name: "IT overview" }).waitFor();
await page.waitForTimeout(1300);
const lastPass = page.locator("a", { hasText: "LastPass rollout" }).first();
const text = await lastPass.innerText();
check(text.includes("33%") && text.includes("1 of 3 done"), "IT's LastPass card reads 33%, 1 of 3 done");
check(((await lastPass.getAttribute("href")) ?? "").includes("/tickets?tab=projects"), "IT's LastPass card opens Tickets › Projects");

await page.goto(`${BASE}/admin?tab=roles`, { waitUntil: "networkidle" });
await page.waitForTimeout(800);
check((await page.getByText("Unlocks the Projects dashboard", { exact: false }).count()) === 0, "Admin no longer offers a Projects role");

noErrors(errors, "removal");
await browser.close();
done();
```

Run `cd "$S/pw" && node tickets-removal.mjs`. Expected: `all checks passed`. Then re-run `node tickets-overview.mjs` and `node tickets-projects.mjs`. Both must still pass, since Jarvis and the Overview still answer.

- [ ] **Step 12: Commit**

```bash
cd C:/Users/Kane/Desktop/Locale-launchpad-tickets
git add -A src/components/modules/projects "app/(dashboard)/projects/page.tsx" src/components/shell/dashboards.ts src/state/launchpad-store.tsx src/components/shell/DashboardSwitchLoader.tsx src/components/shell/assistant/jarvis-knowledge.ts src/components/modules/it/ItOverview.tsx src/components/modules/admin/data.ts src/components/shell/dashboard-tones.ts
git commit -m "Remove the Projects dashboard; its projects live in Tickets" -m "Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: Archived, and the dialog's edit flows

**Files:**
- Create: `src/components/modules/tickets/TicketsArchived.tsx`
- Modify: `src/components/modules/tickets/TicketsScreen.tsx` (whole file, final version)
- Scratch: `$S/pw/tickets-archive.mjs`

**Interfaces:**
- Consumes: `useTickets()` (`tickets`, `restoreTicket`), `useTicketParams().openTicket`, `matchesQuery`, `relativeTime`, `DashboardChip`.
- Produces: `TicketsArchived()`.

- [ ] **Step 1: Write `src/components/modules/tickets/TicketsArchived.tsx`**

```tsx
"use client";

import * as React from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Archive, ArchiveRestore } from "lucide-react";
import { useTickets } from "@/state/tickets-store";
import { EASE_OUT, EASE_SWAP, rowDelay } from "@/lib/motion";
import { PageHeader } from "@/components/ui/page";
import { Button } from "@/components/ui/button";
import { SearchInput } from "@/components/ui/input";
import { EmptyState, NoMatches } from "@/components/ui/states";
import { Avatar } from "@/components/ui/avatar";
import { Reveal } from "@/components/ui/reveal";
import { Ticker, useCascading } from "@/components/ui/list-motion";
import { TICKET_STATUS_LABELS, formatTicketNo } from "./data";
import { matchesQuery, relativeTime } from "./logic";
import { DashboardChip } from "./TicketCard";
import { useTicketParams } from "./use-ticket-params";

/**
 * Tickets › Archived: HRIS's Archived view. Archiving is a soft delete, so a
 * ticket here keeps its replies and history. Newest first. A row opens the
 * ticket frozen; Restore puts it back on the board in the column it left.
 */
export function TicketsArchived() {
  const { tickets, restoreTicket } = useTickets();
  const { openTicket } = useTicketParams();
  const reduce = useReducedMotion();
  const cascading = useCascading();
  const [query, setQuery] = React.useState("");

  const archived = React.useMemo(
    () => tickets.filter((t) => t.archived).sort((a, b) => (b.archived?.at ?? 0) - (a.archived?.at ?? 0)),
    [tickets],
  );
  const shown = React.useMemo(() => archived.filter((t) => matchesQuery(t, query)), [archived, query]);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Archived tickets"
        description="Duplicates and won't-dos, kept with their replies and history. Restore one to put it back on the board."
      />

      <Reveal index={0} className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <p className="text-xs text-muted-foreground tabular-nums" aria-live="polite">
          <Ticker value={shown.length} /> of {archived.length} archived
        </p>
        <SearchInput
          value={query}
          onChange={setQuery}
          count={query.trim() ? shown.length : undefined}
          placeholder="Search archived…"
          aria-label="Search archived tickets"
          className="sm:ml-auto sm:w-64"
        />
      </Reveal>

      <Reveal index={1}>
        {archived.length === 0 ? (
          <EmptyState
            icon={Archive}
            title="Nothing archived"
            description="Archiving a ticket parks it here with its replies and history, instead of deleting it."
            className="rounded-xl border border-dashed border-border"
          />
        ) : shown.length === 0 ? (
          <NoMatches query={query.trim()} onClear={() => setQuery("")} className="rounded-xl border border-dashed border-border" />
        ) : (
          <ul className="grid gap-2">
            <AnimatePresence initial={false}>
              {shown.map((t, i) => (
                <motion.li
                  key={t.id}
                  layout={reduce ? false : "position"}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -14, transition: { duration: reduce ? 0 : 0.14, ease: EASE_OUT } }}
                  transition={{
                    duration: reduce ? 0 : 0.22,
                    ease: EASE_OUT,
                    delay: cascading ? rowDelay(i, reduce, 0.04) : 0,
                    layout: { duration: reduce ? 0 : 0.24, ease: EASE_SWAP, delay: 0 },
                  }}
                  className="flex items-center gap-2 rounded-xl border border-border bg-card p-2 pl-3 shadow-xs"
                >
                  <button
                    type="button"
                    onClick={() => openTicket(t.no)}
                    className="group flex min-w-0 flex-1 items-center gap-3 rounded-lg p-1 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/45"
                  >
                    <Avatar name={t.archived?.by ?? t.raisedBy} size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="font-mono text-xs font-medium text-muted-foreground">{formatTicketNo(t.no)}</span>
                        <span className="truncate text-sm font-medium group-hover:text-tone-ink">{t.title}</span>
                        <DashboardChip dashboard={t.dashboard} />
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-muted-foreground" suppressHydrationWarning>
                        Archived {t.archived ? relativeTime(t.archived.at) : ""} by {t.archived?.by} · was in {TICKET_STATUS_LABELS[t.status]}
                      </span>
                    </span>
                  </button>
                  <Button variant="outline" size="sm" onClick={() => restoreTicket(t.id)}>
                    <ArchiveRestore aria-hidden /> Restore
                  </Button>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        )}
      </Reveal>
    </div>
  );
}
```

- [ ] **Step 2: Route the Archived section.** Replace the whole of `src/components/modules/tickets/TicketsScreen.tsx` with the final version:

```tsx
"use client";

import * as React from "react";
import { toast } from "sonner";
import { useTickets } from "@/state/tickets-store";
import { useTabParam } from "@/hooks/useTabParam";
import { PageContainer } from "@/components/ui/page";
import { TabPanels } from "@/components/ui/sliding-tabs";
import { formatTicketNo } from "./data";
import { TicketDialog } from "./TicketDialog";
import { TicketsArchived } from "./TicketsArchived";
import { TicketsBoard } from "./TicketsBoard";
import { TicketsOverview } from "./TicketsOverview";
import { TicketsProjects } from "./TicketsProjects";
import { useTicketParams } from "./use-ticket-params";

const TABS = ["overview", "board", "projects", "archived"] as const;

/**
 * Tickets — Overview (the default), Board, Projects and Archived, in the rail
 * (`?tab=`). The open ticket (`?ticket=118`) sits above all four, so a link to
 * a ticket opens it whichever section is showing.
 */
export function TicketsScreen() {
  const [tab, , dir] = useTabParam(TABS, "overview");
  return (
    <PageContainer>
      <TabPanels value={tab} dir={dir}>
        {tab === "board" ? (
          <TicketsBoard />
        ) : tab === "projects" ? (
          <TicketsProjects />
        ) : tab === "archived" ? (
          <TicketsArchived />
        ) : (
          <TicketsOverview />
        )}
      </TabPanels>
      <OpenTicket />
    </PageContainer>
  );
}

/** The ticket in `?ticket=`, over whichever section is showing. */
function OpenTicket() {
  const { tickets, saveTicket, archiveTicket, restoreTicket, reply } = useTickets();
  const { ticketNo, closeTicket } = useTicketParams();
  // Kept after close, so the dialog keeps its content while it animates out.
  const [shownNo, setShownNo] = React.useState<number | null>(ticketNo);
  React.useEffect(() => {
    if (ticketNo !== null) setShownNo(ticketNo);
  }, [ticketNo]);

  const missing = ticketNo !== null && !tickets.some((t) => t.no === ticketNo);
  // A link to a ticket that doesn't exist clears itself instead of opening an empty dialog.
  React.useEffect(() => {
    if (!missing || ticketNo === null) return;
    toast(`There's no ticket ${formatTicketNo(ticketNo)}`, { id: "ticket-missing", description: "Check the number in the link." });
    closeTicket();
  }, [missing, ticketNo, closeTicket]);

  const ticket = shownNo === null ? null : (tickets.find((t) => t.no === shownNo) ?? null);
  if (!ticket) return null;
  return (
    <TicketDialog
      open={ticketNo !== null && !missing}
      onClose={closeTicket}
      ticket={ticket}
      onSave={saveTicket}
      onArchive={archiveTicket}
      onRestore={restoreTicket}
      onReply={reply}
    />
  );
}
```

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit
```
Expected: no output.

- [ ] **Step 4: Write and run `$S/pw/tickets-archive.mjs`**

```js
import { BASE, open, check, noErrors, done, shot, column, closeDialog } from "./lib.mjs";

const { browser, page, errors } = await open();
await page.goto(`${BASE}/tickets?tab=board`, { waitUntil: "networkidle" });
await column(page, "In Progress").waitFor();
await page.waitForTimeout(600);

// Edit: raise LP-107's priority.
await page.locator('[data-ticket-card="t-107"]').click();
let d = page.getByRole("dialog");
await d.waitFor();
check(await d.getByRole("button", { name: "Save changes" }).isDisabled(), "Save is disabled until something changes");
await d.getByRole("radio", { name: "Urgent" }).click();
await d.getByRole("button", { name: "Save changes" }).click();
await page.waitForTimeout(600);
check((await page.locator('[data-ticket-card="t-107"]').innerText()).includes("Urgent"), "saving shows the new priority on the card");

// History and replies.
await page.locator('[data-ticket-card="t-107"]').click();
d = page.getByRole("dialog");
await d.waitFor();
await page.waitForTimeout(400);
check((await d.innerText()).includes("set priority High → Urgent"), "the edit is on the history");
const box = d.getByLabel("Reply on LP-107");
await box.fill("Checked on staging, looks right.");
await box.press("Enter");
await page.waitForTimeout(400);
check((await d.innerText()).includes("Checked on staging, looks right."), "Enter posts the reply");
await box.fill("   ");
await box.press("Enter");
await page.waitForTimeout(300);
check((await d.getByText("Checked on staging, looks right.").count()) === 1, "an empty reply posts nothing");
await shot(page, "dialog-light");

// Archive, with the inline confirmation.
await d.getByRole("button", { name: "Archive", exact: true }).click();
await d.getByRole("button", { name: "Confirm archive" }).click();
await page.waitForTimeout(600);
check((await page.locator('[data-ticket-card="t-107"]').count()) === 0, "an archived ticket leaves the board");

// Archived, through the rail (client navigation keeps the store).
await page.getByRole("link", { name: "Archived", exact: true }).click();
await page.getByRole("heading", { name: "Archived tickets" }).waitFor();
await page.waitForTimeout(500);
check((await page.getByText("Business dashboard: compare with last quarter").count()) === 1, "it's listed in Archived");
await shot(page, "archived-light");

// An archived ticket opens frozen.
await page.getByText("Jobs list: filter by builder").click();
d = page.getByRole("dialog");
await d.waitFor();
check((await d.getByRole("button", { name: "Restore ticket" }).count()) === 1, "an archived ticket offers Restore ticket");
check(await d.getByLabel("Reply on LP-100").isDisabled(), "an archived ticket's reply box is read-only");
await closeDialog(page);

// Restore puts it back on the board.
await page.getByRole("button", { name: "Restore", exact: true }).first().click();
await page.waitForTimeout(500);
check((await page.getByText("Business dashboard: compare with last quarter").count()) === 0, "restoring takes it out of Archived");
await page.getByRole("link", { name: "Board", exact: true }).click();
await page.locator('[data-ticket-card="t-107"]').waitFor();
check(true, "restored LP-107 is back on the board");

// Archived search with no results.
await page.getByRole("link", { name: "Archived", exact: true }).click();
await page.getByLabel("Search archived tickets").fill("zzz");
await page.waitForTimeout(300);
check((await page.getByRole("button", { name: "Clear search" }).count()) === 1, "an archived search with no results offers Clear search");

noErrors(errors, "archive");
await browser.close();

{
  const { browser, page, errors } = await open({ theme: "dark" });
  await page.goto(`${BASE}/tickets?tab=archived`, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "Archived tickets" }).waitFor();
  await shot(page, "archived-dark");
  noErrors(errors, "archived dark");
  await browser.close();
}

done();
```

Run `cd "$S/pw" && node tickets-archive.mjs`. Expected: `all checks passed`. Look at `dialog-light.png`, `archived-light.png` and `archived-dark.png`.

- [ ] **Step 5: Commit**

```bash
cd C:/Users/Kane/Desktop/Locale-launchpad-tickets
git add src/components/modules/tickets/TicketsArchived.tsx src/components/modules/tickets/TicketsScreen.tsx
git commit -m "Add Tickets › Archived with restore" -m "Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 8: "Suggest an improvement" in every rail

**Files:**
- Modify: `src/components/shell/Sidebar.tsx`
- Scratch: `$S/pw/tickets-rail.mjs`

**Interfaces:**
- Consumes: `useTickets().openNewTicket`, `isTicketTarget(dash)`, `STAFF` (already imported in `Sidebar.tsx`).
- Produces: a `button` named "Suggest an improvement" in a "Feedback" group under Inbox, on every Launchpad dashboard and on the Employee portal.

- [ ] **Step 1: Imports.** In `src/components/shell/Sidebar.tsx`:
  - Replace `import { ExternalLink, LogOut } from "lucide-react";` with `import { ExternalLink, Lightbulb, LogOut } from "lucide-react";`.
  - After `import { useLaunchpad } from "@/state/launchpad-store";`, add:

```ts
import { useTickets } from "@/state/tickets-store";
import { isTicketTarget } from "@/components/modules/tickets/data";
```

- [ ] **Step 2: Read the store in `RailNav`.** Replace:
```ts
  const { notifications } = useLaunchpad();
  const urgent = notifications.some((n) => n.kind === "red");
```
with:
```ts
  const { notifications } = useLaunchpad();
  const { openNewTicket } = useTickets();
  const urgent = notifications.some((n) => n.kind === "red");
```

- [ ] **Step 3: Share the row look.** Replace:
```ts
  // Running render position — drives the staggered mobile drawer slide-in.
  let order = 0;
```
with:
```ts
  // Running render position — drives the staggered mobile drawer slide-in.
  let order = 0;

  /** A rail row's look, for links and for the Suggest an improvement button alike. */
  const rowClass = (opts: { child?: boolean; active: boolean }) =>
    cn(
      "group/row sb-row relative flex w-full items-center gap-2.5 rounded-md px-2.5 font-[450] focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-inset",
      collapsed && "md:ring-0!",
      opts.child ? "py-[6px] text-[13px]" : "py-[7px] text-sm",
      mobileOpen ? "translate-x-0 opacity-100" : "-translate-x-6 opacity-0 md:translate-x-0 md:opacity-100",
      opts.active ? (opts.child ? tone.childActive : tone.navActive) : cn("text-zinc-700 dark:text-zinc-300", tone.navHover),
    );
```
Then, inside `row(...)`, replace:
```ts
        className={cn(
          "group/row sb-row relative flex w-full items-center gap-2.5 rounded-md px-2.5 font-[450] focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-inset",
          collapsed && "md:ring-0!",
          opts.child ? "py-[6px] text-[13px]" : "py-[7px] text-sm",
          mobileOpen ? "translate-x-0 opacity-100" : "-translate-x-6 opacity-0 md:translate-x-0 md:opacity-100",
          opts.active
            ? opts.child
              ? tone.childActive
              : tone.navActive
            : cn("text-zinc-700 dark:text-zinc-300", tone.navHover),
        )}
```
with:
```ts
        className={rowClass(opts)}
```

- [ ] **Step 4: Add the Feedback group under Inbox.** Replace:
```ts
                    : undefined,
              },
            )}
          </nav>
        </>
      )}
    </>
  );
}
```
with:
```ts
                    : undefined,
              },
            )}
          </nav>
        </>
      )}

      {/* Every staff dashboard and the Employee portal: raise a ticket for this dashboard without leaving it. */}
      {isTicketTarget(dash) ? (
        <>
          <p className="sb-collapse-fade mt-5 mb-1.5 px-2.5 text-[10px] font-semibold tracking-[0.12em] text-subtle-foreground uppercase">
            Feedback
          </p>
          <div className="flex flex-col gap-px">
            <button
              type="button"
              data-rail-tip="Suggest an improvement"
              onClick={() => {
                onNavigate();
                openNewTicket({
                  dashboard: dash.id === "tickets" ? undefined : dash.id,
                  raisedBy: (dash.persona ?? STAFF).name,
                });
              }}
              style={
                isMobile
                  ? { ...DRAWER_ROW_TRANSITION, transitionDelay: mobileOpen ? `${60 + order++ * 30}ms` : "0ms" }
                  : undefined
              }
              className={rowClass({ active: false })}
            >
              <SidebarFocusTile collapsed={collapsed} />
              <Lightbulb aria-hidden className="relative size-[15px] shrink-0 text-zinc-400 dark:text-zinc-500" />
              <span className="sb-collapse-fade min-w-0 flex-1 truncate text-left">Suggest an improvement</span>
            </button>
          </div>
        </>
      ) : null}
    </>
  );
}
```

- [ ] **Step 5: Type-check**

```bash
npx tsc --noEmit
```
Expected: no output.

- [ ] **Step 6: Write and run `$S/pw/tickets-rail.mjs`**

```js
import { BASE, open, check, noErrors, done, shot } from "./lib.mjs";

// Raise from Sales: the dialog starts on Sales; blank titles and double-clicks are handled.
{
  const { browser, page, errors } = await open();
  await page.goto(`${BASE}/sales`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Suggest an improvement" }).click();
  const d = page.getByRole("dialog");
  await d.waitFor();
  await page.waitForTimeout(500);
  const text = await d.innerText();
  check(text.includes("Raised by Shannan Hart"), "raised by the rail's persona");
  check(text.includes("Sales"), "the dialog starts on Sales");
  const raise = d.getByRole("button", { name: "Raise ticket" });
  await d.getByLabel("Title").fill("   ");
  check(await raise.isDisabled(), "a blank title can't be raised");
  await d.getByLabel("Title").fill("Team: show each rep's open deals");
  check(!(await raise.isDisabled()), "a real title can be raised");
  await raise.dblclick();
  await page.getByText("LP-112 raised for Sales").waitFor({ timeout: 5000 });
  await page.getByRole("button", { name: "View" }).click();
  await page.waitForURL(/\/tickets\?tab=board&ticket=112/);
  const v = page.getByRole("dialog");
  await v.waitFor();
  check((await v.innerText()).includes("LP-112"), "View opens LP-112 on the board");
  await v.getByRole("button", { name: "Close", exact: true }).first().click();
  await page.waitForTimeout(500);
  check((await page.locator('[data-ticket-card="t-112"]').count()) === 1, "LP-112 is on the board");
  check((await page.locator('[data-ticket-card="t-113"]').count()) === 0, "a double-click raises one ticket, not two");
  await page.getByRole("link", { name: /Notifications/ }).click();
  await page.getByText("New ticket LP-112 · Sales: Team: show each rep's open deals").waitFor({ timeout: 5000 });
  check(true, "the Inbox has the new ticket");
  noErrors(errors, "raise from Sales");
  await browser.close();
}

// Portals: hidden on Client and Developer, present on Employee (raised as Jan Kane Reroma).
{
  const { browser, page, errors } = await open();
  for (const portal of ["client", "developer"]) {
    await page.goto(`${BASE}/${portal}`, { waitUntil: "networkidle" });
    await page.waitForTimeout(400);
    check((await page.getByRole("button", { name: "Suggest an improvement" }).count()) === 0, `no Suggest on the ${portal} portal`);
  }
  await page.goto(`${BASE}/employee`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Suggest an improvement" }).click();
  const d = page.getByRole("dialog");
  await d.waitFor();
  await page.waitForTimeout(500);
  const text = await d.innerText();
  check(text.includes("Raised by Jan Kane Reroma"), "the Employee portal raises as Jan Kane Reroma");
  check(text.includes("Employee"), "it starts on the Employee portal");
  noErrors(errors, "portals");
  await browser.close();
}

// Phone: the drawer closes behind the dialog, and the dialog works.
{
  const { browser, page, errors } = await open({ width: 390, height: 844 });
  await page.goto(`${BASE}/hr`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Open navigation menu" }).click();
  await page.waitForTimeout(500);
  await page.getByRole("button", { name: "Suggest an improvement" }).click();
  const d = page.getByRole("dialog");
  await d.waitFor();
  await page.waitForTimeout(600);
  check((await page.locator("#launchpad-sidebar-nav[inert]").count()) === 1, "[phone] the drawer closes behind the dialog");
  check((await d.innerText()).includes("HR"), "[phone] it starts on HR");
  await shot(page, "raise-phone");
  await d.getByLabel("Title").fill("Leave: approve from a phone");
  await d.getByRole("button", { name: "Raise ticket" }).click();
  await page.getByText("LP-112 raised for HR").waitFor({ timeout: 5000 });
  check(true, "[phone] the ticket is raised");
  noErrors(errors, "phone");
  await browser.close();
}

// Dark, collapsed rail: the row is still there as an icon.
{
  const { browser, page, errors } = await open({ theme: "dark" });
  await page.goto(`${BASE}/accounting`, { waitUntil: "networkidle" });
  await page.keyboard.press("Control+b");
  await page.waitForTimeout(500);
  check((await page.getByRole("button", { name: "Suggest an improvement" }).count()) === 1, "[collapsed] the row stays in the rail");
  await shot(page, "rail-collapsed-dark");
  noErrors(errors, "collapsed dark");
  await browser.close();
}

done();
```

Run `cd "$S/pw" && node tickets-rail.mjs`. Expected: `all checks passed`. Look at `raise-phone.png` and `rail-collapsed-dark.png`.

- [ ] **Step 7: Commit**

```bash
cd C:/Users/Kane/Desktop/Locale-launchpad-tickets
git add src/components/shell/Sidebar.tsx
git commit -m "Add Suggest an improvement to every staff rail and the Employee portal" -m "Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 9: Docs, build and the full pass

**Files:**
- Modify: `README.md`
- Modify (only if nobody else has it open): `docs/UI-GUIDE.md`

- [ ] **Step 1: README.** In `README.md`'s Modules table, delete the row `| \`/projects\` | Projects | — |`. After the row `| \`/it\` | IT | — |`, add:

```md
| `/tickets` | Tickets | `board` · `projects` · `archived` (filters `&dash=` · `&project=` · `&priority=`; `&ticket=` opens one) |
```

After the paragraph that starts `Sections live in the URL`, add:

```md
Every staff dashboard's sidebar, and the Employee portal's, has **Suggest an improvement**: it raises a
ticket for that dashboard on the Tickets board. `/projects` redirects to Tickets › Projects, where each
project's progress comes from its tickets.
```

- [ ] **Step 2: UI guide, if it's free.** Run `git -C C:/Users/Kane/Desktop/Locale-launchpad status --short docs/UI-GUIDE.md`.
  - **If it prints nothing**, nobody has uncommitted edits, so edit `docs/UI-GUIDE.md` in the worktree:
    - Replace `  - Charcoal (master brand): Marketing, HR, Projects, Knowledge, Leadership and IT, and the Developer and Employee portals.` with `  - Charcoal (master brand): Marketing, HR, Knowledge, Leadership, IT, Tickets and Admin, and the Developer and Employee portals.`
    - Insert this bullet directly before the line starting `- **Rail order:**`:

```md
- **Tickets** is HRIS's developer board (`/tickets`) in the Launchpad shell, for improving the Launchpad itself.
  The rail is Overview · Board · Projects · Archived.
  - **Raising:** every staff rail, and the Employee portal's, has **Suggest an improvement** in a Feedback group
    under Inbox. It opens New ticket over the page with that dashboard chosen. The ticket lands in To Do as
    `LP-<n>`, with a toast (View) and an Inbox entry.
  - **Board:** four columns sorted urgent-first, then oldest. Drag between columns (`src/hooks/use-board-drag.ts`)
    or use Alt+←/→. Dashboard, project and priority filters live in the URL (`&dash=`, `&project=`, `&priority=`),
    and `&ticket=` opens a ticket over any section.
  - **Projects:** the old Projects dashboard. A project is a group of tickets, and its progress is its done tickets ÷
    all its tickets, so it moves when the board does. `/projects` redirects here.
  - **Writes:** immediate, like HRIS: nothing leaves the Launchpad, so there's no undo window. Every change lands on
    the ticket's history beside its replies.
  - **Sources:** `tickets/data.ts` (vocabulary, projects, seed) and `tickets/logic.ts` (every rule and figure). State
    is in `src/state/tickets-store.tsx`. Seed tickets are sample content.
```

  - **If it prints `M docs/UI-GUIDE.md`**, leave the guide alone and report that its Tickets section is still to add.

- [ ] **Step 3: Full type-check and every browser script**

```bash
cd C:/Users/Kane/Desktop/Locale-launchpad-tickets && npx tsc --noEmit
npx -y tsx --tsconfig tsconfig.json "$S/check-tickets.mts"
cd "$S/pw" && for f in tickets-overview tickets-board tickets-projects tickets-removal tickets-archive tickets-rail; do echo "== $f"; node $f.mjs || exit 1; done
```
Expected: `tsc` prints nothing, the logic check passes, and every script ends `all checks passed`.

- [ ] **Step 4: Production build**

Stop the worktree dev server on :3100: it shares the worktree's `.next/`. Then:
```bash
cd C:/Users/Kane/Desktop/Locale-launchpad-tickets && npx next build
```
Expected: the build succeeds, with `/tickets` in the route list. Then start `npx next start -p 3101` in the background and run:
```bash
curl -s -o /dev/null -w "%{http_code} %{redirect_url}\n" http://localhost:3101/projects
```
Expected: `308 http://localhost:3101/tickets?tab=projects`. Stop the server.

- [ ] **Step 5: Commit**

```bash
git add README.md docs/UI-GUIDE.md
git commit -m "Document the Tickets dashboard" -m "Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```
If Step 2 left the UI guide alone, `git add` it anyway; it's unchanged, so nothing extra is staged.

- [ ] **Step 6: Bring in the latest `main`, then hand off**

```bash
git merge main   # worktrees share branches, so this is main as the other sessions left it
```
- If it merges with conflicts, resolve them in the shared files (`dashboards.ts`, `ModuleId`, `SHAPES`, `JARVIS` / `FEATURED`, `Sidebar.tsx`, `admin/data.ts`) by keeping both sides. Make sure no `projects` entry comes back.
- Re-run Step 3.
- Then use **superpowers:finishing-a-development-branch** to decide with Kane how the branch lands on `main`.

Report to Kane:
- The follow-ups:
  - Point the Sales pipeline at `src/hooks/use-board-drag.ts` and delete `sales/pipeline/use-board-drag.ts`.
  - Add the UI guide's Tickets section, if Step 2 left it.
- The assumptions to confirm:
  - The AI & Growth team as assignees.
  - The sample seed content.
