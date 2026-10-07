# Sales portal: design

**Date:** 2026-10-06
**Status:** approved in conversation, awaiting written review
**Builds on:** the Employee portal (`modules/employee/`), the Sales dashboard (`modules/sales/`), Admin's
Roles & permissions (`modules/admin/data.ts`)

## Goal

Add a fourth portal, **Sales**, beside Client, Developer and Employee. It is one sales consultant's own
view: their clients and their own progress. The **Sales dashboard** becomes the whole-team view, where
every rep's sales are visible.

What Kane said:

- "Lets create a new dashboard under Portals and lets label it - Sales - This is an individual portal
  for Sales where they can see their own clients and own progress rather than the one on the Sales
  Dashboard where we can see all the Sales."

What was agreed in the conversation:

| Question | Decision |
| --- | --- |
| The rep's own sections on the Sales dashboard | **Move to the portal**: My clients, My week and My Deal Submissions. The Sales dashboard becomes the team view. |
| What "my progress" shows | **All four**: sales won vs target, forecast accuracy, my funnel, commission. |
| Deals in progress | **My pipeline** in the portal: the same board, only the rep's deals. The dashboard keeps the all-reps Pipeline. |
| Access | **Portal + narrowed dashboard.** Every Sales department member gets the portal. New Home Advocates keep the Sales dashboard with Pipeline, Clients and Team hidden. Managers keep it in full. |
| Build approach | **One shared Sales store, sections reused with a rep scope.** No forked copies, no mode flag on `SalesScreen`. |

Out of scope:

- Auth and real RBAC. Grants stay Admin's seeded sample data, as today.
- Real targets and a real commission formula. Both are placeholders (see section 1, My progress).
- Alison's Meeting 2 asks (My clients by builder, appointments in My week). They stay in
  `docs/superpowers/plans/2026-10-06-meeting2-prototype-updates.md` and land in the portal when that
  plan runs (see section 5).
- Rapid costing, Exclusive land, Under construction and Team. They don't change, apart from Team's
  commission column (section 2).

## 1. The Sales portal

**Registry:** `id: "consultant"`, label **Sales**, title **Sales portal**, `href: "/consultant"`, icon
`BriefcaseBusiness` (lucide), tone **haven** (Locale Homes is the brand a consultant sells for),
`space: "portal"`. `/sales` is the dashboard's, so the path names the role instead.
`persona: { name: "A. Mercer", role: "Sales consultant · staff preview" }`. A. Mercer is `CURRENT_REP`,
the rep the rest of the prototype already uses, and the Client portal's consultant.

The Switch view lists the portal with the other portals. Inside the portal it lists only the portals,
as Client, Developer and Employee do.

**Rail** (`?tab=`, Overview the default):

| Item | Key | Icon |
| --- | --- | --- |
| Overview | `consultant:overview` | `LayoutDashboard` |
| My pipeline | `consultant:pipeline` | `Columns3` |
| My clients | `consultant:clients` | `Users` |
| My week | `consultant:week` | `CalendarDays` |
| My progress | `consultant:progress` | `Target` |
| My Deal Submissions | `consultant:submissions` | `FileCheck2` |

### Overview

Built on `DashboardOverview`, like the Sales Overview.

- **Title:** `${greeting}, A. Mercer.` The greeting is `useGreeting()`, which moves from
  `employee/parts.tsx` to `src/hooks/use-greeting.ts` so both portals import it from one place.
- **Description:** what's waiting, joined into one line, e.g. "2 tasks are overdue. 1 submission came
  back with changes." If nothing is waiting: "You're all caught up."
- **Headline cards:**
  - **My pipeline:** open deal value, "N open deals". Links to `consultant:pipeline`.
  - **Won this month:** "1 of 2", "against target". Links to `consultant:progress`.
  - **Signed this week:** "4 of 7", "against forecast". Links to `consultant:week`.
  - **My overdue tasks:** the rep's flagged team tasks, with the existing overdue/due-today sub. Pending
    tone when there are any. Links to `consultant:clients`.
- **More row:**
  - **Under construction:** the rep's jobs on the construction board. Links to `consultant:clients`.
  - **Open to-dos:** "on My clients". Links to `consultant:clients`.
  - **Changes requested:** submissions in My Deal Submissions with status `changes` (Ops sent them
    back). Submissions carry no rep field; that screen is already the rep's own. Pending tone when
    there are any. Links to `consultant:submissions`.
  - **Commission pipeline:** the placeholder figure, sub "placeholder rate". Links to
    `consultant:progress`.

### My pipeline

The existing `Pipeline` and `DealDialog`, reading the rep scope (section 4):

- Only the rep's deals, on the board and in the Lost list.
- No owner filter in the toolbar. The priority filter and search stay.
- The deal dialog's owner field is read-only, showing the rep. Managers reassign from the dashboard.
- **New deal** creates a deal owned by the rep.
- Drag, edit, lose and reopen work as on the dashboard, through the same `deal-writes.ts`, so a move
  in one view is in the other at once.
- The page header reads "My pipeline", description "Your deals, from first appointment to sale won."

### My clients, My week, My Deal Submissions

Moved from the Sales dashboard unchanged, apart from:

- **My clients** reads the rep scope (section 4). In the portal it is today's screen, the rep's jobs
  and their to-dos, plus a **Tasks** card beside To-dos: the rep's tasks from the team task list
  (`tasks` in the store, filtered to the rep), each with its due label, overdue ones flagged. It is
  read-only, because managers set and reassign tasks on Team. This is where the Overview's "My overdue
  tasks" card lands; with no tasks it reads "No tasks from your manager."
- **My week:** the forecast and its submitted flag move from component state into the Sales store, so
  the Overview's "Signed this week" reads what the rep submitted. The "within one for six weeks
  running" sentence is computed from `FORECAST_HISTORY` (below) instead of being typed in.
- **My Deal Submissions:** no change. Operations › Submission review reads the same submissions, as
  today.

### My progress

New. Four cards in a two-column grid (one column on a phone), each with a `CardMeta` source line. The
sums are pure functions in `consultant/progress/progress.ts`. The placeholder values are named
constants in `consultant/progress/data.ts`, each with a doc comment that says "Placeholder, not
confirmed" and who confirms it.

**1. Sales won vs target**

- Two bars, **This month** and **This quarter**, each "N of T" with a `RateBar`. Sub-labels "August to
  date" and "Quarter to date", the Sales data's existing period words.
- Month won = the rep's month-to-date figure from `STAGE_REPORT_DEALS` (1 for A. Mercer) plus
  **won in session**. Quarter won = the rep's `SALES_WON_QTD` (7) plus won in session.
- **Won in session** = the rep's deals in Sale won now, minus the rep's deals in Sale won in the seed.
  Stages in the seed don't depend on the clock, so the seed count is fixed. Never below zero. Moving a
  deal to Sale won in My pipeline adds one; moving it back takes it away.
- Targets: `MONTH_TARGET = 2`, `QUARTER_TARGET = 8`. Placeholder, Sean O'Neill confirms.
- Past target, the bar is full and the figure reads "3 of 2, target hit". A target of 0 or none: no
  bar, the figure alone.

**2. Forecast accuracy**

- **This week:** signed so far against the submitted forecast, as on the Overview.
- **The last six weeks:** `FORECAST_HISTORY`, six `{ weekEnding, forecast, signed }` rows, oldest
  first, the last being My week's `LAST_WEEK` (6 forecast, 5 signed). Each is within one of its
  forecast, so My week's sentence stays true. Placeholder, sample weeks.
- Drawn as paired bars per week (forecast, signed) with direct labels, not colour alone.
- Headline: "Within one for N weeks running", the streak counted back from the latest week. A week
  more than one out ends the streak.

**3. My funnel**

- **Leads:** the rep's row from `STAGE_REPORT_LEADS` as four counts: New, Attempting, Connected,
  Qualified. HubSpot contacts aren't in the prototype, so these are counts only, no conversion.
- **Deals:** from the live deals, four steps: Appointment booked, Appointment held, Potential sale,
  Sale won.
  - **At each step now:** the rep's deals currently in that stage, lost deals excluded.
  - **Conversion** between steps: of the deals that reached a step, how many reached the next. A deal
    counts as reaching every step up to its stage. A lost deal counts up to the stage it was lost at,
    because it did reach it.
  - A step that nothing reached shows the table's `Dash` placeholder, never `NaN` or 0%.
- **Stale:** the rep's open deals (not lost, not won) that have been in their stage for 14 days or
  more. Exactly 14 days counts. Listed by client with their stage and days; each row links to My
  pipeline (the board has no deal-by-URL param, and this work doesn't add one). It reads the clock,
  so it renders after mount.

**4. Commission**

- **Pipeline:** the rep's open deals × `COMMISSION_PER_SALE`.
- **Earned this quarter:** quarter won (card 1) × `COMMISSION_PER_SALE`.
- `COMMISSION_PER_SALE = 3000` (AUD, flat). Placeholder, Alison Carter confirms the formula. Meeting 2
  ruled out HubSpot's amount field, which is the build price.
- The card says so in a `Pill`: "Placeholder rate".

## 2. The Sales dashboard

Becomes the team view. Its rail:

| Item | Change |
| --- | --- |
| Overview | Team figures, below. |
| Pipeline | Unchanged: every rep, owner filter. |
| **Clients** | Was My clients. Key `sales:clients` unchanged. Every rep's clients, grouped by rep, same cards, no to-dos. |
| Under construction | Unchanged. |
| Rapid costing | Unchanged. |
| ~~My week~~ | Moved to the portal. |
| ~~My Deal Submissions~~ | Moved to the portal. |
| Exclusive land | Unchanged. |
| Team | Unchanged, apart from the commission column below. |

**Overview**, retitled "Sales overview", description "The team's pipeline, sales and follow-ups."

- **Headline cards:** Pipeline value, all reps (as today); Sales won, team, August to date (as today);
  **Team scorecard:** signed against forecast for last week, summed from `FORECAST["Last week"]`,
  linking to `sales:team`; Overdue tasks across the team (as today).
- **More row:** Under construction (as today); **Clients**: every rep's jobs, sub "N in construction",
  linking to `sales:clients`; Lots available (as today); Discounts to approve (as today).

**Clients** (team scope): one section per rep in `REPS` order, a heading with the rep's name and
client count, then that rep's job cards. A rep with no clients is left out. The header reads
"Clients", description "Every rep's clients in preconstruction and construction."

**Team › stage report:** the "Pipeline commission" column reads the same function as My progress, so
the dashboard and the portal never disagree. Its header gets the same "Placeholder rate" pill.

## 3. Access

In `modules/admin/data.ts`:

- `BLURBS.consultant`: "Unlocks the Sales portal: your pipeline, clients, week, progress and deal
  submissions."
- **Role names:** a portal's role is labelled with its title ("Sales portal", "Client portal",
  "Developer portal", "Employee portal"), so two roles never both read "Sales". Launchpad dashboards
  keep their labels.
- **Seed grants:** `DEPARTMENT_ROLES.sales` becomes `["sales", "consultant"]`. The wealth-only rule
  still gives wealth-only sellers just `wealth`.
- **Narrowed sections:** the existing New Home Advocate limit (`sales:team` → view) is replaced by
  three: `sales:pipeline`, `sales:clients` and `sales:team` → hidden. They keep Rapid costing,
  Exclusive land and Under construction. The Head of Sales, the Advocate Managers and Sales Operations
  keep the full dashboard.
- **Who's online sample:** Michael Fox's `at: "sales:submissions"` becomes
  `"consultant:submissions"`.

## 4. Wiring

### Shared state

- `SalesStateProvider` moves from `SalesScreen` to `app/(dashboard)/layout.tsx`, inside
  `PortalProvider`, so the dashboard and the portal read one store. **Behaviour change:** Sales state
  (deals, to-dos, tasks, lots, discounts, the land filter) now survives leaving Sales, as jobs do.
- It gains `weekForecast: Record<ScorecardBuilder, number>` and `weekSubmitted: boolean`, from My week.
- `reselect` leaves the store. A small `SalesViewProvider` that each screen mounts carries `reselect`
  and the **scope**. `useSalesTabReselect()` keeps its name and reads it from there.

### Rep scope

```ts
type SalesScope = { kind: "team" } | { kind: "rep"; rep: string };
```

`useSalesScope()` returns the nearest `SalesViewProvider`'s scope, or `{ kind: "team" }` outside one.
`SalesScreen` mounts `{ kind: "team" }`. `ConsultantScreen` mounts `{ kind: "rep", rep: CURRENT_REP }`.
Only `Pipeline`, `DealDialog` and `MyClients` read it. My week and My Deal Submissions only ever render
in the portal.

### New files

| Path | Purpose |
| --- | --- |
| `app/(dashboard)/consultant/page.tsx` | Route, `Suspense` + `ScreenSkeleton tabs={false}`, metadata title "Sales portal", like Employee's. |
| `src/components/modules/consultant/ConsultantScreen.tsx` | `useTabParam` + `TabPanels` over the six sections, inside `SalesViewProvider` (rep scope) with its own `useNavReselect("consultant:")`. A pending badge on `consultant:submissions` when submissions came back with changes. |
| `src/components/modules/consultant/ConsultantOverview.tsx` | Section 1 › Overview. |
| `src/components/modules/consultant/progress/MyProgress.tsx` | Section 1 › My progress. |
| `src/components/modules/consultant/progress/progress.ts` | Pure: `wonInSession`, `wonVsTarget`, `forecastStreak`, `funnel`, `staleDeals`, `commission`. |
| `src/components/modules/consultant/progress/progress.test.ts` | Unit tests (section 6). |
| `src/components/modules/consultant/progress/data.ts` | `MONTH_TARGET`, `QUARTER_TARGET`, `FORECAST_HISTORY`, `COMMISSION_PER_SALE`, `STALE_DAYS = 14`. |
| `src/hooks/use-greeting.ts` | `useGreeting()`, moved from `employee/parts.tsx`. |

### Changed files

| Path | Change |
| --- | --- |
| `src/state/launchpad-store.tsx` | `ModuleId` gains `"consultant"`. |
| `src/components/shell/dashboards.ts` | The portal entry after Employee. Sales: My week and My Deal Submissions out, My clients renamed Clients. The doc comment says four portals. |
| `src/components/shell/dashboard-tones.ts` | Comment only: the Sales portal joins haven. |
| `src/components/shell/DashboardSwitchLoader.tsx` | `SHAPES.consultant = OVERVIEW`. |
| `app/(dashboard)/layout.tsx` | Mount `SalesStateProvider`. |
| `src/components/modules/sales/sales-state.tsx` | Week forecast fields; `SalesViewProvider`, `useSalesScope`; `reselect` moves there. |
| `src/components/modules/sales/SalesScreen.tsx` | Team scope; tabs `week` and `submissions` out. |
| `src/components/modules/sales/SalesOverview.tsx` | Team figures (section 2). |
| `src/components/modules/sales/pipeline/Pipeline.tsx`, `DealDialog.tsx` | Read the scope (section 1, My pipeline). |
| `src/components/modules/sales/clients/MyClients.tsx` | Read the scope: rep view as today, team view grouped by rep. |
| `src/components/modules/sales/week/MyWeek.tsx` | Forecast from the store; the streak sentence from `forecastStreak`. |
| `src/components/modules/sales/team/Team.tsx` | Commission column from `commission()`. |
| `src/components/modules/employee/parts.tsx`, `EmployeeOverview.tsx` | Import `useGreeting` from the hook. |
| `src/components/modules/admin/data.ts` | Section 3. |
| `src/components/shell/assistant/jarvis-knowledge.ts` | A `consultant` brief and `FEATURED.consultant`: "How am I tracking against target?", "Which of my deals have gone stale?", "What's my commission pipeline?". `PORTAL_USING` lists "Client, Developer, Employee and Sales". The deal-submission and My week answers move from the Sales brief to the portal's, and their links from `/sales?tab=submissions` to `/consultant?tab=submissions`. |
| `README.md` | The Modules table gets the Sales portal row; Sales' row loses My week and My Deal Submissions. |

Every overview card links with `hrefForKey`, which throws on a key that no longer exists. Before the
build, a grep for `sales:week`, `sales:submissions`, `tab=week` and `tab=submissions` must come back
with only Operations' own `submissions` tab.

### Motion

As the Employee portal: `TabPanels` between sections, `Reveal` for cards, `rowDelay` for list rows,
`CountUp` on figures, `RateBar` fills. Ease from `src/lib/motion.ts` only. Transitions gated on
`useReducedMotion()`, never `initial`. Empty states for: no deals in My pipeline, no clients, no stale
deals ("Nothing stale. Every open deal moved in the last 14 days."), no leads.

## 5. Working alongside other work

- **Worktree.** Other sessions edit the main working tree (the review files are uncommitted there
  now). This work runs in its own git worktree on **`feat/sales-portal`**, cut from `main`, with its
  own `npm ci` and dev server, like the Tickets work.
- **Tickets branch.** `feat/tickets-dashboard` also adds to `dashboards.ts`, `ModuleId`, `SHAPES`,
  Admin's blurbs and Jarvis's records. Whichever merges second keeps both sides. The conflicts are
  additive.
- **Meeting 2 plan.** Tasks 1 and 2 edit `sales/clients/MyClients.tsx` and `sales/week/`. Those paths
  don't change, but the screens now show in the portal, and Task 2's `useNavBadge("sales:week", ...)`
  becomes `"consultant:week"` in `ConsultantScreen.tsx`. Task 1's test runner is added here instead
  (section 6), so its Step 1 shrinks to creating the branch. A note at the top of the plan says so.
- **Test runner.** Added exactly as the plan's Task 1 Step 1 specifies: `tsx@^4.21.0` as a dev
  dependency and `"test": "node --import tsx --test \"src/**/*.test.ts\""`.

## 6. Verification

1. **Unit tests** (`npm test`), written first and failing first:
   - Won in session: zero at the seed; +1 after a move to Sale won; back to zero after moving it out;
     never negative.
   - Won vs target: under, at, over target; a target of 0 gives no ratio.
   - Forecast streak: six within one gives 6; a miss by two in week 4 gives 2; an empty history gives 0.
   - Funnel: a step nothing reached gives `null` (rendered as `Dash`); a lost deal counts up to its stage;
     a deal in Potential sale counts as reaching Booked and Held.
   - Stale: 13 days 23 hours is not stale; exactly 14 days is; lost and won deals never are.
   - Commission: no open deals gives 0; the dashboard's column and the portal's card agree for each rep.
2. `npx tsc --noEmit` after every task.
3. `npx next build` in the worktree, its dev server stopped.
4. **Browser checks**, light and dark, at 375px and desktop:
   - The Switch view lists Sales under Portals on the Launchpad; inside the portal, only the portals.
   - Move a deal to Sale won in My pipeline: the portal's Won this month and the dashboard's Pipeline
     both change. Open the deal from the dashboard: it's still in Sale won.
   - The portal's owner field is read-only; a new deal there belongs to A. Mercer.
   - Submit My week with a changed forecast: the Overview's Signed this week reads the new figure.
   - The dashboard's Clients groups by rep; its rail has no My week or My Deal Submissions.
   - Admin › Roles & permissions shows "Sales portal" and "Sales" as separate roles; a New Home
     Advocate's Sales grant shows Pipeline, Clients and Team hidden.
   - Jarvis in the portal answers the three featured questions.
   - With reduced motion on, nothing slides.

## Open items and assumptions

- Targets (2 a month, 8 a quarter) are placeholders for Sean O'Neill to set.
- Commission is a flat $3,000 a sale until Alison's formula. Leadership's AI summary still quotes the
  mockup's "$245k commission pipeline" in prose; it is left alone and noted here.
- The six-week forecast history is sample data, written to agree with My week's existing sentence.
- The persona is A. Mercer, not a seat on HR's org chart, as on the Sales dashboard today. When RBAC
  arrives the portal shows whoever signs in.
- The path `/consultant` is my choice; the label and title are what Kane asked for.
