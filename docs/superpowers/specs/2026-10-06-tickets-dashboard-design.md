# Tickets dashboard: design

**Date:** 2026-10-06 (revised the same day: Projects moved into Tickets)
**Status:** approved in conversation, awaiting written review of this revision
**Source:** Simple HRIS's developer board (`simple-hris/src/components/tickets/`, `src/lib/tickets/types.ts`; ui-standards § 17.9)

## Goal

Add a **Tickets** dashboard to the Launchpad, modelled on HRIS's `/tickets` board. Anyone can raise a
ticket asking for an improvement to a Launchpad dashboard. The team can then triage and work those
tickets, see how each dashboard is improving, and see how each project is progressing. The
**Projects dashboard is removed**: its projects now live in Tickets, where each project is a group of
tickets and its progress comes from them.

What Kane said:

- "Add a new dashboard from HRIS and pull in Tickets in here, this way we can get the improvements
  on the Launchpad, how we are gonna improve each dashboard, each user can create a ticket."
- "Remove the Projects dashboard and the Project Board should be transferred here in Tickets as
  well, where we can see the progress of each Project."

What was agreed in the conversation:

| Question | Decision |
| --- | --- |
| Storage | **Static**, like the rest of the Launchpad: seeded tickets plus an in-memory store. A reload resets to the seed. |
| Where tickets are raised | On the Tickets dashboard **and** from a rail button on every dashboard, which opens the dialog with that dashboard already chosen. |
| Approach | A normal Launchpad dashboard in the shared shell. **Not** HRIS's standalone black and red console page. |
| Projects | **Projects group tickets.** A ticket may belong to one project. A project's progress is its done tickets ÷ all its tickets. The old Launchpad V1 task list becomes real tickets. |
| Projects dashboard | **Removed.** `/projects` redirects to Tickets › Projects. |

Out of scope:

- Auth, RBAC and permission gating, and a database.
- HRIS's Employee Support (support chat and support tickets).
- Email or webhook notifications.
- Manual card reordering within a column.
- Creating, renaming or editing projects. The four projects are fixed data, as they were on the
  Projects dashboard.

IT › Help desk stays as it is: it is for IT problems, and this board is for improvements to the
Launchpad.

## 1. Tickets and projects

### Ticket fields

The fields are HRIS's `TicketRow` plus **dashboard** and **project**:

| Field | Notes |
| --- | --- |
| `no` | Number shown as **`LP-118`**. The prefix keeps it apart from IT Help desk's `#214`. A new ticket gets the highest existing number + 1. |
| `title`, `details` | `details` is optional. |
| `dashboard` | The `ModuleId` of the dashboard the ticket improves. Any Launchpad dashboard or the Employee portal. Required. |
| `project` | The id of the project the ticket belongs to, or `null`. Optional; most improvement tickets have none. |
| `priority` | `low` · `medium` · `high` · `urgent`. Defaults to `medium`. |
| `status` | `todo` · `in_progress` · `testing` · `done`. These are the board columns: To Do / In Progress / Testing / Done. |
| `raisedBy` | Display name of whoever the rail shows when the ticket is raised. |
| `assignee` | The org-chart seat id of the assignee, or `null`. Defaults to the board owner. |
| `createdAt`, `updatedAt` | Epoch milliseconds, like Sales' deals. A reply also moves `updatedAt`. |
| `archived` | `{ at, by }` when archived. Archiving is a soft delete: the ticket leaves the board, appears in Archived and can be restored. |
| `replies` | `{ id, author, body, at }[]`. Replies can't be edited once posted. |
| `history` | `{ id, actor, at, action, changes? }[]`. The actions are `created`, `updated`, `moved`, `archived` and `restored`. `changes` is a field-level from → to diff over title, details, dashboard, project, priority, status and assignee. |

The vocabulary (statuses, priorities, labels, chip styles, `formatTicketNo`, the projects) is
declared once, in `src/components/modules/tickets/data.ts`, the way HRIS keeps it in
`lib/tickets/types.ts`. The rules (board order, the history a save writes, every figure the
Overview, Projects and Jarvis quote) are pure functions in `tickets/logic.ts`.

### Projects

The four projects from the Projects dashboard, unchanged in name, owner and state:

| Project | Owner | State | Dashboard its tickets are on |
| --- | --- | --- | --- |
| Launchpad V1 · CRM Dash Sync | Jerry Delos Santos | In build | Operations |
| Locale Pricing Hub | Jerry Delos Santos | In build | Operations |
| Finance Health Check form | Pablo Lopez | Validation | Finance |
| LastPass rollout | Pablo Lopez | Deploying | IT |

- A project is `{ id, name, owner (seat id), state }`. State (In build · Validation · Deploying)
  stays a value someone sets, because it's a stage the owner declares, not something the tickets
  can tell.
- **Progress** is the project's done tickets ÷ all its tickets, archived tickets excluded. It's shown
  as a bar, "3 of 9 done", a percentage, and a split such as "3 to do · 3 in progress · 0 testing".
  It replaces the typed-in percentages (45%, 30%, 80%, 65%).
- A project with no tickets shows "No tickets yet" and an unmeasured bar (`RateBar value={null}`),
  never 0%.

### People

- **Raised by** is the rail's persona: Shannan Hart (Manager) on Launchpad dashboards, and Jan Kane
  Reroma on the Employee portal. The caller resolves it the way `Sidebar.tsx` resolves the user card
  (`dash.persona ?? STAFF`) and passes it to `openNewTicket`. `TicketsProvider` sits outside
  `NavProvider`, so it can't work out which dashboard is current.
- **Board edits** (move, save, reply, archive, restore) are made as `BOARD_ACTOR` in
  `tickets/data.ts`, which is `STAFF.name` from `dashboards.ts`: the same staff persona, Shannan Hart.
- **Board owner** is `jan-kane-reroma` (Kane), the counterpart of HRIS's `TICKET_BOARD_OWNER`. New
  tickets go to Kane by default.
- **Assignees** are the AI & Growth seats from `ORG_SEED`: Jan Kane Reroma, Jerry Delos Santos, Pablo
  Lopez and Andre Mikhail Serra. *Assumption, not confirmed.* The list lives in one constant.

### Permissions

There are none yet, because the Launchpad has no RBAC. Everyone can create, edit, drag, reply,
archive and restore. HRIS limits moving cards to the owner and the assignee. With no sign-in, the
viewer is never Kane, so that rule would make the board read-only. Owner and assignee are still
stored, so the HRIS rule can be turned on in the RBAC phase without changing any data.

### Seed

- **Improvement tickets** LP-100 to LP-111. These are sample asks about real dashboards. For
  example: "Sales › Pipeline: drag cards on a phone", "Accounting: rename Pay run once Kane picks a
  name", "HR › Leave: show balances on the request form". LP-100 is archived as a duplicate of LP-104.
- **Project tickets** LP-83 to LP-99, all older than two weeks:
  - The nine Launchpad V1 task-list items, in the columns they're in today. To do: Entra app
    registration session, Capture sandbox stage IDs, Field matrix session w/ Shannan. In progress:
    Monday → HubSpot milestone sync, Supabase schema + RLS, v0 UI pass. Done: Board + automation
    audit, Launchpad UI build, Test workspace mirrors.
  - Three for Pricing Hub, two for Health Check (the improvement ticket LP-110 "Health check:
    explain each score" also joins Health Check), and three for LastPass.
- The first ticket raised in a session is **LP-112**.
- Seed times are stamped relative to when the store is created, so ages and "this week" counts stay
  meaningful whenever the demo runs. Ages sit well clear of the 7- and 14-day lines. Relative ages
  carry `suppressHydrationWarning`, like Sales' deal cards.

## 2. The Tickets dashboard

**Registry:** `id: "tickets"`, label **Tickets**, title "Tickets board", `href: "/tickets"`, a lucide
ticket icon, tone **charcoal**, which puts it in the Company group, listed after IT. The rail
sections are `overview` (the default), `board`, `projects` and `archived`, set by `?tab=`.
`?dash=`, `?project=`, `?priority=` and `?ticket=` are board filters and the open ticket, not rail
items.

### Overview

Built on `DashboardOverview`: four headline KPI cards, a smaller row, then panels. It uses the
Launchpad's `KpiCard` and `Card`, not HRIS's glass KPI treatment.

- **Headline cards:** Open now, Raised this week (signed change vs last week), In testing, and Done
  this week.
- **Smaller row ("Queue health"):**
  - Oldest open: its age; clicking it opens that ticket.
  - Urgent open: opens the board filtered to Urgent.
  - Projects: how many there are, and the one closest to done with its percentage. Opens Tickets ›
    Projects.
  - Archived.
- Each card links to its section with the matching filter, using `hrefForKey`.
- **Open by dashboard:** one bar per dashboard that has open tickets, with name and count labels,
  sorted by count with the highest first. A row links to `?tab=board&dash=<id>`.
- **Board split:** a segmented bar of how many tickets are in each column. Kept from HRIS.
- **Open by priority:** kept from HRIS.
- **Recent activity:** the six most recently updated tickets. Clicking one opens it.
- HRIS's Members panel is dropped, because there's no RBAC to show.

Colours follow the entity, as in HRIS: each status and priority keeps the same hue on the card, in
the chart and in the dialog. Priority is a verdict, so urgent is rose and high is amber; medium and
low are greys told apart by their word. Columns step from grey through the dashboard tone to emerald,
the way Sales' stages do. Every bar carries a direct label, so hue is never the only cue.

### Board

- Four columns. Within a column, cards sort by priority (urgent first), then by `createdAt` (oldest
  first). There is no manual reordering within a column; this is a deliberate departure from HRIS.
- **Toolbar:**
  - Search, across the LP number, title, details, people, dashboard and project.
  - **Dashboard** filter (`?dash=`), **Project** filter (`?project=`) and **Priority** filter
    (`?priority=`), each read from and written to the URL.
  - **New ticket**, which opens the shared create dialog. It starts on the filtered dashboard and
    project, if there is one.
- **Card:** LP number, priority chip, title (2 lines), details (2 lines), dashboard chip, a project
  chip when it has one, assignee chip, the initials and name of who raised it, reply count, and
  relative age.
- **Drag:** the feel of the Sales pipeline. The card lifts into an overlay, the column under the
  pointer lights up, the card slots into that column straight away, and on release it glides into
  its new slot. Escape, or dropping outside every column, puts it back. Dropping a card on its own
  column writes nothing. On touch devices there's no drag: tap the card and change its column in the
  dialog. Alt+← / Alt+→ on a focused card moves it one column.
- A search or filter that matches nothing shows `NoMatches` with a Clear action.
- `?ticket=<no>` opens that ticket's dialog over any section. Closing the dialog removes the param. A
  number that doesn't exist shows a toast ("There's no ticket LP-999") and removes the param, rather
  than opening an empty dialog.

### Projects

This replaces the Projects dashboard's Project board.

- One card per project, laid out like the old project cards. Each shows:
  - name, owner avatar and name, and state pill;
  - the progress bar, "3 of 9 done" and the percentage;
  - the column split;
  - "Next up": the project's first open ticket in board order, with its LP number.
- A card links to `?tab=board&project=<id>`.
- The old three-column task list is gone, because those items are now tickets on the board.

### Archived

A list of archived tickets (LP number, title, dashboard, who archived it and when) with search and a
**Restore** action on each row. Clicking a row opens the ticket. It has an empty state.

### Ticket dialog

A single component handles both create and view, as in HRIS.

- **Fields, in order:**
  1. Title
  2. Details
  3. Dashboard and Project, side by side. Project is optional, "No project" by default.
  4. Priority, as a four-way radio row.
  5. Column (view mode only) and Assigned to, side by side.
- **Create mode** is a narrow single column titled "New ticket". The description says who it will
  be raised by and that it lands in To Do. **Raise ticket** is disabled until there's a title (not
  just spaces) and a dashboard. A second click while the dialog closes doesn't raise a second ticket.
- **View mode** is wide. The fields are on the left. The activity rail is on the right: replies and
  history merged in time order, with a reply box (Enter sends, Shift+Enter adds a new line, an empty
  reply sends nothing).
  - **Archive** asks for confirmation inline.
  - An archived ticket shows **Restore** instead, and its fields and reply box are read-only.
  - **Save changes** is disabled until something has changed.
- It uses `Dialog`'s `bodyClassName`, the way the deal dialog does: the fields pane and the activity
  pane scroll on their own.

### Motion

- The pane swap uses `TabPanels`.
- KPI figures count up, and bars fill.
- List rows cascade in (`useCascading` from `ui/list-motion.tsx`).
- Drag lift, overlay and drop flight.
- Dialog fields cascade in, as in the deal dialog.
- Every animation honours `useReducedMotion` and the reduced-motion rules in `globals.css`.
- Empty columns, empty search results, an empty Archived list and a project with no tickets each get
  an empty state.

## 3. Raising a ticket from any dashboard

- **Rail row:** **Suggest an improvement** (lightbulb icon) sits in a **Feedback** group directly
  under Inbox in `Sidebar.tsx`. On the Employee portal, which has no Inbox, the Feedback group stands
  alone. When the rail is collapsed it shows as the icon with a `RailTooltip`.
- **Shown on:** every Launchpad-space dashboard (Tickets included) and the Employee portal.
  **Hidden on:** the Client and Developer portals, which preview outsiders' views.
- **What it does:** it opens the shared create dialog over the current page, without navigating. On
  a phone the drawer closes first. The dialog starts with the current dashboard chosen, and the user
  can change it. On Tickets itself the dashboard field starts empty.
- **The dialog is mounted once**, by `TicketsProvider`. `openNewTicket({ dashboard?, project?,
  raisedBy })` opens it from anywhere.
- **On submit:**
  - A toast: "LP-112 raised for Sales", with a **View** action that links to
    `/tickets?tab=board&ticket=112`.
  - An inbox entry through the store's existing `notify`: "New ticket LP-112 · Sales: Drag cards
    on a phone".

## 4. Removing the Projects dashboard

- **Deleted:** `src/components/modules/projects/` (`ProjectsScreen.tsx`, `ProjectsOverview.tsx`,
  `data.ts`). Its project data moves into `tickets/data.ts`.
- **Removed:**
  - The Projects entry in `dashboards.ts`.
  - `"projects"` from `ModuleId`.
  - `projects` from `SHAPES` in `DashboardSwitchLoader.tsx`.
  - The `projects` brief from `JARVIS` and from `FEATURED`.
- **`app/(dashboard)/projects/page.tsx`** becomes a `permanentRedirect("/tickets?tab=projects")`, so
  old links and bookmarks land on the projects.
- **IT › Overview's "LastPass rollout" card** reads the LastPass project's progress from the tickets
  store ("33%", "1 of 3 done") and links to `tickets:projects`.
- **Jarvis on Tickets** takes over the project questions; see section 5.
- **Admin** (`modules/admin/data.ts`): its role blurbs are keyed by every dashboard, so `projects`
  goes and `tickets` gets one ("Unlocks the Tickets board, its projects and archive."). The four
  people granted `projects` (Sean O'Neill, Larnie Clark, Alison Carter, Pablo Lopez) are granted
  `tickets` instead.
- **Comments and docs:** `dashboard-tones.ts` (charcoal list) and the README's Modules table.

## 5. Wiring

### New files

| Path | Purpose |
| --- | --- |
| `app/(dashboard)/tickets/page.tsx` | Route, `Suspense` + `ScreenSkeleton`, like Accounting's. |
| `src/state/tickets-store.tsx` | `TicketsProvider`: tickets state, all writes (create, save, move, reply, archive, restore) that append history entries, and the create dialog's open state. |
| `src/components/modules/tickets/data.ts` | Vocabulary, projects, owner, assignees, `BOARD_ACTOR`, seed. |
| `src/components/modules/tickets/logic.ts` | Board order, numbering, draft diff, stats, project progress, search, time labels. |
| `src/components/modules/tickets/use-ticket-params.ts` | The URL state: `?dash=`, `?project=`, `?priority=`, `?ticket=`. |
| `src/components/modules/tickets/TicketsScreen.tsx` | `useTabParam` + `TabPanels` across the four sections, plus the open-ticket dialog. |
| `src/components/modules/tickets/TicketsOverview.tsx` | Section 2 › Overview. |
| `src/components/modules/tickets/TicketsBoard.tsx` | Section 2 › Board. |
| `src/components/modules/tickets/TicketsProjects.tsx` | Section 2 › Projects. |
| `src/components/modules/tickets/TicketsArchived.tsx` | Section 2 › Archived. |
| `src/components/modules/tickets/TicketCard.tsx` | Presentational card + shared chip styles. |
| `src/components/modules/tickets/TicketDialog.tsx` | Create/view dialog. |
| `src/hooks/use-board-drag.ts` | A general version of the Sales pipeline's drag hook. It takes a `slotOf(id)` lookup instead of the hard-coded `[data-deal-card]` query. |

### Changed files

| Path | Change |
| --- | --- |
| `src/state/launchpad-store.tsx` | `ModuleId`: add `"tickets"`, remove `"projects"`. |
| `src/components/shell/dashboards.ts` | Tickets dashboard entry; Projects entry removed. |
| `src/components/shell/DashboardSwitchLoader.tsx` | `SHAPES`: add `tickets`, remove `projects`. |
| `app/(dashboard)/layout.tsx` | Mount `TicketsProvider` inside `PortalProvider`, around `AppShell`, because it calls `notify` and Jarvis reads it. |
| `src/components/shell/Sidebar.tsx` | The Feedback group with Suggest an improvement. |
| `src/components/shell/assistant/jarvis-knowledge.ts` | `JarvisContext.tickets`. A `tickets` brief whose featured questions are "Which dashboards have open tickets?", "How are the projects going?" and "How do I raise a ticket?"; "What's the oldest open ticket?" answers when typed. The `projects` brief and its imports go. |
| `src/components/shell/assistant/JarvisBubble.tsx` | Pass `tickets` from `useTickets()` into the context. |
| `src/components/modules/it/ItOverview.tsx` | LastPass card from the tickets store, linking to `tickets:projects`. |
| `src/components/modules/admin/data.ts` | Role blurb and grants: `projects` → `tickets`. |
| `app/(dashboard)/projects/page.tsx` | Becomes the redirect. |
| `src/components/shell/dashboard-tones.ts` | Comment only: Tickets in, Projects out of the charcoal list. |
| `README.md` | Tickets row in, Projects row out of the Modules table, and a line on Suggest an improvement. |

### Working alongside the other sessions

Other sessions work in `C:\Users\Kane\Desktop\Locale-launchpad` at the same time. While this was
designed, the Sales pipeline and the Admin dashboard landed on `main` (commit `2bda04f`), so this
work builds on both. `UI-GUIDE.md` still had someone's uncommitted edits.

- This work runs in its own **git worktree** on branch **`feat/tickets-dashboard`**, cut from
  `main`, with its own `node_modules` (`npm ci`; `next.config.ts` pins Turbopack's root to the
  project, so a linked `node_modules` won't do) and its own dev server. It never edits the main
  working tree.
- It doesn't edit `sales/**`. It has its own general drag hook in `src/hooks/`. **Follow-up:** point
  the Sales pipeline at the shared hook and delete `sales/pipeline/use-board-drag.ts`.
- **Integration:** when the branch is done, merge the latest `main` into it, resolve any conflicts in
  the shared files by keeping both sides, re-run the checks, then merge into `main`. A Tickets
  section in `UI-GUIDE.md` is added at that point, once nobody else has it open.

## 6. Verification

The repo has no test runner, and this work doesn't add one: `package.json` doesn't change.

1. **Logic check:** a scratch script in the session scratchpad imports `tickets/data.ts` and
   `logic.ts` through `npx -y tsx` and asserts the numbers (board order, stats, project progress,
   diff, search). It's written before the code, and fails first. Nothing is committed to the repo.
2. `npx tsc --noEmit` passes after every task.
3. `npx next build` passes in the worktree, with the worktree's dev server stopped.
4. **Browser checks** (scratch `playwright-core` scripts against the worktree dev server on :3100),
   in light and dark, at desktop and phone widths:
   - Raise a ticket from Sales' rail. It appears on the board, in the Overview's counts and in the
     inbox, and the toast's View opens it. A double-click raises one ticket, and a blank title can't
     be raised.
   - Drag across columns. Press Escape mid-drag, and drop a card on its own column: neither writes
     history.
   - Filter by dashboard from an Overview row, and by project from a Projects card.
   - Reply, edit, archive (with the confirmation), then restore.
   - Open a `?ticket=` link directly, and one for a number that doesn't exist.
   - `/projects` lands on Tickets › Projects. The Projects dashboard is gone from Switch view.
   - IT › Overview's LastPass card shows the project's progress.
   - The button is absent on the Client and Developer portals and present on the Employee portal.
     On a phone the drawer closes behind the dialog.
   - With reduced motion on, nothing slides or flies.

## Open items and assumptions

- Assignees are the AI & Growth team. This is my assumption and needs confirming.
- Seed ticket contents, and which project tickets are done, are invented samples. They're built on
  the old task list where one existed.
- Integration with the Sales and Admin work is described in section 5.
- When RBAC arrives, apply HRIS's move rule (owner + assignee) and its archive rule (creator + admin).
