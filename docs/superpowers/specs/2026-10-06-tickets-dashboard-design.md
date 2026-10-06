# Tickets dashboard: design

**Date:** 2026-10-06
**Status:** approved in conversation, awaiting written review
**Source:** Simple HRIS's developer board (`simple-hris/src/components/tickets/`, `src/lib/tickets/types.ts`; ui-standards § 17.9)

## Goal

Add a **Tickets** dashboard to the Launchpad, modelled on HRIS's `/tickets` board. Anyone can raise a
ticket asking for an improvement to a Launchpad dashboard. The team can then triage and work those
tickets, and see how each dashboard is improving.

What Kane said: add a new dashboard from HRIS and pull in Tickets, so we can collect improvements to
the Launchpad and see how each dashboard will improve, and each user can create a ticket.

What was agreed in the conversation:

| Question | Decision |
| --- | --- |
| Storage | **Static**, like the rest of the Launchpad: seeded tickets plus an in-memory store. A reload resets to the seed. |
| Where tickets are raised | On the Tickets dashboard **and** from a rail button on every dashboard, which opens the dialog with that dashboard already chosen. |
| Approach | A normal Launchpad dashboard in the shared shell. **Not** HRIS's standalone black and red console page. |

Out of scope: auth, RBAC and permission gating, a database, HRIS's Employee Support (chat and support
tickets), email or webhook notifications, and manual card reordering within a column. IT › Help desk
stays as it is: it is for IT problems, and this board is for improvements to the Launchpad.

## 1. The ticket

### Fields

The fields are HRIS's `TicketRow` plus one new field, **dashboard**:

| Field | Notes |
| --- | --- |
| `no` | Number shown as **`LP-118`**. The prefix keeps it apart from IT Help desk's `#214`. A new ticket gets the highest existing number + 1. |
| `title`, `details` | `details` is optional. |
| `dashboard` | The `ModuleId` of the dashboard the ticket improves. Any Launchpad dashboard or the Employee portal. **New.** |
| `priority` | `low` · `medium` · `high` · `urgent`. Defaults to `medium`. |
| `status` | `todo` · `in_progress` · `testing` · `done`. These are the board columns: To Do / In Progress / Testing / Done. |
| `raisedBy` | Display name of whoever the rail shows when the ticket is raised. |
| `assignee` | The org-chart seat id of the assignee, or `null`. Defaults to the board owner. |
| `createdAt`, `updatedAt` | ISO timestamps. |
| `archivedAt` | Set when archived. Archiving is a soft delete: the ticket leaves the board, appears in Archived and can be restored. |
| `replies` | `{ author, body, at }[]`. Replies can't be edited once posted. |
| `history` | `{ action, changes, actor, at }[]`. The actions are `created`, `updated`, `moved`, `archived` and `restored`. `changes` is a field-level from → to diff. |

The vocabulary (statuses, priorities, labels, chip styles, `formatTicketNo`) is declared once, in
`src/components/modules/tickets/data.ts`, the way HRIS keeps it in `lib/tickets/types.ts`.

### People

- **Raised by** is the rail's persona: Shannan Hart (Manager) on Launchpad dashboards, and Jan Kane
  Reroma on the Employee portal. The caller resolves it the way `Sidebar.tsx` resolves the user card
  (`dash.persona ?? STAFF`) and passes it to `openNewTicket`. `TicketsProvider` sits outside
  `NavProvider`, so it can't work out which dashboard is current. `STAFF` moves from `Sidebar.tsx`
  to `dashboards.ts` as `STAFF_PERSONA`.
- **Board owner** is `jan-kane-reroma` (Kane), the counterpart of HRIS's `TICKET_BOARD_OWNER`. New
  tickets go to Kane by default.
- **Assignees** are the AI & Growth seats from `ORG_SEED`: Jerry Delos Santos, Pablo Lopez, Andre
  Mikhail Serra and Jan Kane Reroma. *Assumption, not confirmed.* The list lives in one constant.

### Permissions

There are none yet, because the Launchpad has no RBAC. Everyone can create, edit, drag, reply,
archive and restore. HRIS limits moving cards to the owner and the assignee. With no sign-in, the
viewer is never Kane, so that rule would make the board read-only. Owner and assignee are still
stored, so the HRIS rule can be turned on in the RBAC phase without changing any data.

### Seed

About ten sample tickets spread across real dashboards, columns and priorities, with a few replies
and history entries. Examples:

- "Sales › Pipeline: drag cards on a phone"
- "Accounting: rename Pay run once Kane picks a name"
- "HR › Leave: show balances on the request form"

Seed times are stamped relative to when the store is created, so ages and "this week" counts stay
meaningful whenever the demo runs. Relative ages render only inside the client-rendered screens
(under each page's `Suspense`), so they can't cause a hydration mismatch.

## 2. The Tickets dashboard

**Registry:** `id: "tickets"`, label **Tickets**, title "Tickets board", `href: "/tickets"`, a lucide
ticket icon, tone **charcoal**, which puts it in the Company group, listed after IT. The rail
sections are `overview` (the default), `board` and `archived`, set by `?tab=`. `?dash=` and
`?ticket=` are query values read by the board, not rail items.

### Overview

Uses the Launchpad's `KpiCard` and `Card`, not HRIS's glass KPI treatment.

- **KPI row:** Open now (the lead figure), Raised this week (signed change vs last week), In testing,
  Done this week, and Oldest open (its age; clicking it opens that ticket). Each card links into the
  board with the matching filter, using `hrefForKey`.
- **Open by dashboard:** one bar per dashboard that has open tickets, with name and count labels,
  sorted by count with the highest first. A row links to `?tab=board&dash=<id>`.
- **Board split:** a segmented bar of how many tickets are in each column. Kept from HRIS.
- **Open by priority:** kept from HRIS.
- **Recent activity:** the most recently updated tickets. Clicking one opens it.
- HRIS's Members panel is dropped, because there's no RBAC to show.

Colours follow the entity, as in HRIS: each status and priority keeps the same hue on the card, in
the chart and in the dialog. Every bar carries a direct label, so hue is never the only cue.

### Board

- Four columns. Within a column, cards sort by priority (urgent first), then by `createdAt` (oldest
  first). There is no manual reordering within a column; this is a deliberate departure from HRIS.
- Toolbar: search (title, details, LP number), a **Dashboard** filter that reads and writes `?dash=`,
  a **Priority** filter, and **New ticket**.
- **Card:** LP number, priority chip, title (2 lines), details (2 lines), dashboard chip, assignee
  chip, the initials and name of who raised it, reply count, and relative age.
- **Drag:** the feel of the Sales pipeline. The card lifts into an overlay, the column under the
  pointer lights up, the card slots into that column straight away, and on release it glides into
  its new slot. Escape, or dropping outside every column, puts it back. On touch devices there's no
  drag: tap the card and change its column in the dialog.
- `?ticket=<no>` opens that ticket's dialog. Closing the dialog removes the param.

### Archived

A list of archived tickets (LP number, title, dashboard, who archived it and when) with search and a
**Restore** action. It has an empty state.

### Ticket dialog

A single component handles both create and view, as in HRIS.

- **Create mode:** a narrow single column with Title, Details, Dashboard, Priority and Assignee.
- **View mode:** wide. The fields are on the left and include Column. The activity rail is on the
  right: replies and history merged in time order, with a reply box (Enter sends, Shift+Enter adds a
  new line). **Archive** asks for confirmation inline. An archived ticket shows **Restore** instead,
  and its fields are read-only.

### Motion

- The pane swap uses `TabPanels`.
- KPI figures count up.
- List rows cascade in (`useCascading` / `AutoHeight` from `ui/list-motion.tsx`).
- Drag lift, overlay and drop flight.
- Dialog entrance.
- Every animation honours `useReducedMotion` and the reduced-motion rules in `globals.css`.
- Empty columns, empty search results and an empty Archived list each get an empty state.

## 3. Raising a ticket from any dashboard

- **Rail row:** **Suggest an improvement** (lightbulb icon) sits directly under Inbox in `Sidebar.tsx`,
  so it's in the same place on every dashboard. When the rail is collapsed it shows as the icon
  with a `RailTooltip`.
- **Shown on:** every Launchpad-space dashboard (Tickets included) and the Employee portal.
  **Hidden on:** the Client and Developer portals, which preview outsiders' views.
- **What it does:** it opens the shared create dialog over the current page, without navigating. The
  dialog starts with the current dashboard chosen, and the user can change it. On Tickets itself the
  dashboard field starts empty and is required.
- **The dialog is mounted once**, by `TicketsProvider`. `openNewTicket({ dashboard?, raisedBy })`
  opens it from anywhere.
- **On submit:**
  - A toast: "LP-119 raised for Sales", with a **View** action that links to
    `/tickets?tab=board&ticket=119`.
  - An inbox entry through the store's existing `notify`: "New ticket LP-119 · Sales: Drag cards
    on a phone".

## 4. Wiring

### New files

| Path | Purpose |
| --- | --- |
| `app/(dashboard)/tickets/page.tsx` | Route, `Suspense` + `ScreenSkeleton`, like Accounting's. |
| `src/state/tickets-store.tsx` | `TicketsProvider`: tickets state, all writes (create, update, move, reply, archive, restore) that append history entries, and the create dialog's open state. |
| `src/components/modules/tickets/data.ts` | Vocabulary, owner, assignees, seed. |
| `src/components/modules/tickets/TicketsScreen.tsx` | `useTabParam` + `TabPanels` across the three sections. |
| `src/components/modules/tickets/TicketsOverview.tsx` | Section 2 › Overview. |
| `src/components/modules/tickets/TicketsBoard.tsx` | Section 2 › Board. |
| `src/components/modules/tickets/TicketCard.tsx` | Presentational card + shared chip styles. |
| `src/components/modules/tickets/TicketDialog.tsx` | Create/view dialog. |
| `src/components/modules/tickets/TicketsArchived.tsx` | Section 2 › Archived. |
| `src/hooks/use-board-drag.ts` | A general version of the Sales pipeline's drag hook. It takes a `slotOf(id)` lookup instead of the hard-coded `[data-deal-card]` query. |

### Changed files

| Path | Change |
| --- | --- |
| `src/state/launchpad-store.tsx` | Add `"tickets"` to `ModuleId`. |
| `src/components/shell/dashboards.ts` | Tickets dashboard entry; `STAFF_PERSONA` (moved from `Sidebar.tsx`). |
| `app/(dashboard)/layout.tsx` | Mount `TicketsProvider` inside `LaunchpadProvider`, because it calls `notify`. |
| `src/components/shell/Sidebar.tsx` | Suggest an improvement row; read `STAFF_PERSONA` from `dashboards.ts`. |
| `src/components/shell/dashboard-tones.ts` | Comment only: list Tickets under charcoal. |
| `src/components/shell/assistant/jarvis-knowledge.ts` | A `tickets` brief with three FAQs: "What's open for this dashboard?", "What's the oldest open ticket?" and "How do I raise a ticket?". Required, because `JARVIS` is a `Record<ModuleId, …>`. |
| `README.md` | Tickets row in the Modules table. |

### Working alongside the Sales session

Another session was editing the Sales pipeline while this was designed, and its work is uncommitted.

- Don't edit `src/components/modules/sales/**`. Tickets uses the new `src/hooks/use-board-drag.ts`.
  **Follow-up, after the Sales work is committed:** switch the pipeline to the shared hook and delete
  `sales/pipeline/use-board-drag.ts`.
- `jarvis-knowledge.ts` already has uncommitted changes: only add the `tickets` entry and leave the
  rest of the file as it is.
- Commit only the files this work creates or changes, by path.

## 5. Verification

The repo has no test runner, and the project rule is tsc + build + checking both themes
(`src/components/modules/AGENTS.md`). This work doesn't add one.

1. `npx tsc --noEmit` passes.
2. `npx next build` passes. Run it only when no dev server is using `.next/`; otherwise say it was
   skipped.
3. Browser pass, in light and dark, at desktop and phone widths:
   - Raise a ticket from Sales' rail. It appears on the board, in Overview's counts and in the inbox.
     The toast's View action opens it.
   - Drag across columns, and press Escape to cancel a drag.
   - Filter by dashboard from an Overview row.
   - Reply, edit, archive (with the confirmation), then restore.
   - Open a `?ticket=` link directly.
   - The button is absent on the Client and Developer portals and present on the Employee portal.
   - With reduced motion on, nothing slides or flies.

## Open items and assumptions

- Assignees are the AI & Growth team. This is my assumption and needs confirming.
- Seed ticket contents are invented samples.
- The Sales drag hook dedupe is the follow-up described in section 4.
- When RBAC arrives, apply HRIS's move rule (owner + assignee) and its archive rule (creator + admin).
