# Operations dashboard — tab by tab

This review takes each tab in our Operations dashboard in turn and asks three questions:

- **The use case:** who uses the tab, for what, and how often.
- **The flaws:** what gets in the operator's way today.
- **How to simplify it:** what to change so the operator can do the job with less effort.

**How it was done.**
- I ran our prototype on 4 October 2026 and captured every tab at 1440px wide, with reduced
  motion so the numbers had settled.
- I read the code behind each tab.
- I compared each tab against the original build's intent and its UAT feedback.

The companion document, [OPERATIONS-DASHBOARD.md](OPERATIONS-DASHBOARD.md), explains how the
original was wired. `§` references point into it.

**Out of scope.** Nothing here touches **Switch view** or **Jarvis**. Both stay as they are.

---

## Contents

1. [The operator, and what they come here to do](#1-the-operator-and-what-they-come-here-to-do)
2. [Flaws that cut across every tab](#2-flaws-that-cut-across-every-tab)
3. [Overview](#3-overview)
4. [CRM dash sync: the jobs list](#4-crm-dash-sync-the-jobs-list)
5. [The job page](#5-the-job-page)
6. [Inbound capture](#6-inbound-capture)
7. [Review queue](#7-review-queue)
8. [Audit log](#8-audit-log)
9. [Submission review](#9-submission-review)
10. [Pricing and Doc formatter](#10-pricing-and-doc-formatter)
11. [A simpler shape for the whole dashboard](#11-a-simpler-shape-for-the-whole-dashboard)
12. [What to fix first](#12-what-to-fix-first)

---

## 1. The operator, and what they come here to do

**The main operator is Shannan.** Alison is the second. Their day looks like this:

1. A builder emails, rings or updates a portal to say something happened, such as "slab poured on
   3 September".
2. They record it once.
3. It needs to land in Monday and HubSpot, and they need to trust that it did.
4. A few times a week they also release or dismiss a held change to a milestone that moves money.

Every visit to this dashboard answers one of five questions:

| # | The operator's question | Where it should be answered |
|---|---|---|
| 1 | **What needs me today?** | One list, on the dashboard's first screen |
| 2 | **Where is job X up to, and what's next?** | The jobs list row, without opening the job |
| 3 | **Record this update** (a milestone, a date, a job number, a document) | The job page, at the top, in a few clicks |
| 4 | **Did it go through?** | The trail straight after saving, and a quiet status on the list |
| 5 | **Who changed this, and when?** | The job's activity, with the full log as a fallback |

**Two more operators share this dashboard,** with different rhythms:

- **Deal submissions.** Alison's team works on these, one deal at a time.
- **Builder pricing.** Someone does this monthly, per builder. *Who owns this job is an open
  question; the original plan never named a person.*

That split matters. The dashboard currently gives all three jobs equal weight.

---

## 2. Flaws that cut across every tab

These come up on several tabs, so they are listed once here.

1. **Three jobs share one flat rail.** Job sync is daily work for Shannan. Submission review is
   per-deal work for Alison's team. Pricing is monthly work for whoever owns it. The rail lists all
   seven items as equals, and the Overview mixes their numbers together.
2. **"What needs me" is spread over six places:**
   - the Overview tiles;
   - the CRM dash sync tiles;
   - the Review queue badge;
   - Inbound capture's Approve buttons;
   - conflict banners on job pages;
   - the Notifications inbox.

   There is no single to-do list.
3. **Two tabs are called "review".** *Review queue* holds money-milestone changes. *Submission
   review* checks deal paperwork. Inbound capture adds a third set of "Approve" buttons.
4. **One product has three names:** Launchpad, "CRM Dash" and "CRM dash sync". The ownership
   badges say **"CRM Dash owns · editable"** (`ours: jobs/detail/DetailCards.tsx:27`), and the
   conflict dialog says "Keep CRM Dash's value". An operator cannot tell whether CRM Dash is a
   system, a screen or this app. The original said **"Launchpad owns"** everywhere.
5. **Build notes have leaked into operator copy.** Examples:
   - *"Sales rep names are seeded fixtures, not yet mirrored from HubSpot"* and *"Prototype ·
     outbox simulated"* (`ours: jobs/CrmDashSync.tsx:138-141`);
   - *"Preview of the finished screen"*;
   - *"Tell us what it needs to do… send it to Jerry"*.

   These were written for stakeholders, not for the person doing the work.
6. **The rail loses your place.** On a job page it highlights **Overview**, not CRM dash sync.
   An item counts as active when the URL's `tab` matches, and a job page has no `tab`, so the
   rail falls back to the default (`ours: src/components/shell/dashboards.ts:448`).
7. **Money is shown to Operations.** The trail, toasts and audit lines say *"Xero · draft invoice
   for Forma, $17,500 + GST"*. In the original, builder invoicing schedules are never displayed,
   and Locale commission is hidden from Operations (rule 16 in §8).
8. **Some screens invite the double-keying the product exists to end:**
   - *Land and house* is marked editable, but developer and build type belong to HubSpot.
   - The conflict dialog lets anyone overwrite either side.

   Both are covered under the job page (§5).

---

## 3. Overview

**Use case.** The first screen of the day: *"what needs me this morning?"*

- **Who:** Shannan and Alison, every morning; leadership for a glance.
- **How often:** daily.

**What is there now.**

| Row | Tiles |
|---|---|
| Headline | Jobs 12 · Sync needs attention 1 · Review queue 3 · In submission 6 |
| "More from each section" | Awaiting a job number 2 · Price lists current 2 of 5 · Price changes 45 · Formatter outputs 2 |

**Flaws.**

- **Half the tiles are counts of things, not things to do.** Jobs 12, In submission 6, Price
  changes 45 and Formatter outputs 2 give the operator nothing to act on.
- **The original's main warning is missing.** *"Completed, no builder date"* (§5.1) appears on the
  CRM dash sync tiles but not here.
- **The same numbers appear twice.** Jobs, Awaiting a job number and Sync needs attention are
  repeated on the CRM dash sync tiles one click away. Two places to read one thing invites the two
  to disagree.
- **It mixes three operators' work** in one grid of equal-weight tiles.

**Simplify.**

1. **Turn the tile wall into a "Needs you" list.** Keep the tab name *Overview*, which every
   dashboard shares. Show one row per kind of work, in priority order. Each row has a count and
   **one** button, and a row disappears when its count is zero:

   | Row | Button |
   |---|---|
   | Held changes (Review queue) · 3 | Release or dismiss |
   | Writes that didn't send / disagreements · 1 | Fix |
   | Completed with no builder date · n | Add the date |
   | Awaiting a job number · 2 | Enter the number |
   | Submissions waiting for Ops · n | Review |
   | Price lists due · 2 | Upload |

2. **Show a calm "Nothing is waiting on you" state when the list is empty.** The original's home
   greeting did this ("nothing is waiting on you").
3. **Move the vanity counts** (jobs, models tracked, formatter outputs) into one line of small
   print, or drop them.

---

## 4. CRM dash sync: the jobs list

**Use case.** Find a job, see where it is up to, and spot the jobs that need attention.

- **Who:** Shannan and Alison.
- **How often:** many times a day.

**What is there now.**
- A title and a search box.
- Four filters: Builder, Sales rep, Brand and Division.
- Two build notes.
- Four tiles: Jobs, Awaiting a job number, Completed with no builder date, and Sync needs
  attention.
- A six-column table: Job number, Client, Builder, HubSpot stage, Monday, and Sync.
- A footer link to Inbound capture.

**Flaws.**

- **The table doesn't say what's next.** The operator's real question is "what's next on this
  job, and when is it due?" The columns show the HubSpot stage and a "Construction · 5 of 8" pill,
  but not the next milestone or its due date, so finding out means opening every job.
- **The Sync column is mostly noise.** "✓ HS · Mon" appears on 10 of 12 rows, which hides the two
  rows that matter: "Conflict" and "Syncing".
- **"Sync needs attention" means the wrong thing.**
  - **Here** it means a Monday-versus-Launchpad conflict.
  - **In the original** it meant writes that **gave up**: a destination refused them or they ran
    out of retries. Disagreements were a separate concept, kept on Sync health.

  These are two different problems with two different fixes, and the operator needs to see both.
- **No sort order and no "due" view.** You cannot see what is overdue or due this week, and the
  table has no visible order.
- **The tiles take a full row,** and the first one (Jobs 12, "Everything you may see") is not a
  filter.
- **Every update is a long trip:** open the job, scroll to the bottom, open the milestone, save,
  go back. That loop is most of Shannan's day.
- **Two build notes** sit under the filters (§2.5).

**Simplify.**

1. **Change the columns to answer the question:**

   | Column | Shows |
   |---|---|
   | Job | job number, or "No job number" |
   | Client | |
   | Builder | |
   | Where it's up to | one phrase, e.g. "Construction · Slab down done" |
   | Next | the next milestone and its due date, **red when overdue** |
   | Status | **only when something is wrong:** "Disagrees", "Didn't send", "Held for review", "Syncing". Blank when fine |

2. **Replace the four tiles with one row of filter chips:** *Needs attention (n) · No builder date
   (n) · No job number (n) · Overdue (n)*. The table is the page.
3. **Sort by next due date** by default.
4. **Add a quick update.** Clicking the Next cell opens a small popover: *"Mark Plate height
   complete, builder's date [ ]"*. The same rules apply (a date is required and cannot be in the
   future), and the same trail follows. That turns the most common task into two clicks.
5. **Say the outbox state only when it matters.** Remove the build notes. Show a small "Dry run"
   or "Sending paused" badge **only when sending is not live**.
6. **Move Sales rep and Brand behind a "More filters" control.** Ops mostly filter by builder and
   division.

---

## 5. The job page

**Use case.** Record what happened on one job, and confirm it reached Monday and HubSpot. That
covers a milestone completion, a due date, a job number or a document.

- **Who:** Shannan and Alison.
- **How often:** many times a day. This is where the work happens.

**What is there now** (job 25501, captured):

- **Header.** A red conflict banner with a **Resolve** button.
- **Left column, top to bottom:**
  1. *Deal details*, read-only;
  2. *Job details*;
  3. *Land and house*;
  4. *Preconstruction*, a list of 11 rows;
  5. *Construction*, a grid of 8 tiles.
- **Right column:**
  - *Documents*, with 5 slots;
  - *Audit log*, with 6 filter chips;
  - *Open in*.

**Flaws.**

- **The work is at the bottom.** Milestones start about 1,700px down the page, below three field
  panels, and the first panel is the read-only one. The most common action needs the most
  scrolling.
- **One action, two layouts.** Preconstruction is a list and Construction is a grid of tiles, so
  completing a milestone works differently depending on which phase it is in.
- **The milestone editor is missing what Ops asked for:**
  - **no due date**, although Alison asked for "just another date field in this section" at UAT;
  - **no note**;
  - a **free-text** date instead of a date picker;
  - **no future-date refusal**;
  - an extra **Source** chooser that the original did not have.
- **Land and house is marked "CRM Dash owns · editable"** and says it syncs to HubSpot
  (`ours: jobs/detail/DetailCards.tsx:214-251`). In the original, developer, build type and the
  land fields are **HubSpot-owned** and read-only. Editing them here creates the disagreements the
  product exists to prevent.
- **Resolve picks a side.** It offers "Accept Monday's value" or "Keep CRM Dash's"
  (`ours: jobs/detail/JobDialogs.tsx:128`). The original deliberately never built this: a value is
  fixed in the system that owns it (§5.6, §14 point 2).
- **The audit panel is over-built.** It has six filter chips for five events, and its *Invoicing*
  chip exposes Xero amounts.
- **The construction copy overpromises.** *"Each completion advances the HubSpot stage"*
  (`ours: MilestoneCards.tsx:167`) is not true when the deal is already ahead. The original said
  the stage moves forward *if the deal is behind it*.
- **The rail highlights Overview** on this page (§2.6).

**Simplify.**

1. **Reorder the page around the task:**

   ```
   Header: Job 25501 · B. Barber · Move Homes · [Monday ↗] [HubSpot ↗]
   ┌ Next up ─────────────────────────────────────────────────────┐
   │ Plate height · due 12 Oct · [Mark complete…]                │   ← the 80% task, first
   └──────────────────────────────────────────────────────────────┘
   Needs attention (only if any): "Slab down: Monday says 28 Jul, we have no date" [Fix]
   Milestones   one list, precon then construction, same row pattern;
                the current phase open, finished phase collapsed
   Job details  editable (green)
   Documents
   Deal details read-only (grey), collapsed by default, with "Edit in HubSpot ↗"
   Activity     the last 5 lines, no chips, "Full log →"
   ```

2. **Use one milestone editor everywhere.** It has Status, Builder's date (a picker capped at
   today, Perth time), Due date and Note. It shows the original's **destination sentence** before
   saving: *"Saving writes Launchpad, then the Monday subitem, then the HubSpot deal property."*
   Remove the Source chooser, or move it into the note.
3. **Make Land and house read-only and grey,** with "Edit in HubSpot ↗". The alternative is to
   decide, field by field, that Launchpad owns some of it, and write that down.
4. **Replace Resolve with Fix.** Say plainly which system owns the field and offer the one action
   that fits:
   - *"Launchpad owns this date. Enter the builder's date here and it will write to Monday and
     HubSpot."*
   - or *"HubSpot owns this. Change it in HubSpot ↗; Launchpad picks it up within 5 minutes."*
5. **Say "Launchpad owns"** in every badge.

---

## 6. Inbound capture

This is a preview, nested under CRM dash sync.

**Use case.** Bring builder updates in without retyping them: upload a builder's weekly file or
email, or let Launchpad poll the builder portals. Then approve each change.

- **Who:** Shannan.
- **How often:** weekly per builder.
- **Status:** not built in either version (Phase 5 in the original).

**What is there now.**
- Two panels of mock rows with disabled Approve and Dismiss buttons.
- Explanatory text.
- A "Tell us what it needs to do" box.

**Flaws.**

- **It would be a third approval list,** alongside the Review queue and Submission review. The
  original's contract was that **portal proposals land in the review queue** and are released
  through the same door as a save (§5.8).
- **It is a page in the rail that does nothing.** The operator can click into it, and the
  "Preview" tag is easy to miss.
- **"Already recorded · No change needed" rows** take space without needing a decision.
- **The copy is pitched at stakeholders** ("Tell us what it needs to do… send it to Jerry").

**Simplify.**

1. **Until it is built, take it out of the rail.** Keep the footer link on the jobs list ("Bulk
   upload and portal polling are coming. See the plan").
2. **When it is built, don't make it a separate inbox.** An upload or a portal poll should
   produce rows in the **same "Needs you" list**, shaped like a review item: job, milestone,
   proposed date, source, Approve or Dismiss. The Inbound page then shrinks to a drop zone and an
   import history.
3. **Collapse unchanged rows** to a count: "14 lines already recorded".

---

## 7. Review queue

**Use case.** Take a second look at changes to the four milestones that move money: Formal
finance approval, Slab down, Settlement confirmation and Plate height. A reversal or a backdated
completion is held here, and nothing reaches Monday or HubSpot until a person releases it.

- **Who:** Shannan and Alison release; leadership can look.
- **How often:** a few times a week.

**What is there now.** One large card per item, containing:
- the change, shown as before → after;
- the note, who filed it, when, and the source;
- a reason box;
- **Release and sync** and **Dismiss** buttons.

A stale item, meaning one whose milestone has moved since it was filed, can only be dismissed.
This tab follows the original closely, and that is the right call.

**Flaws.**

- **Each card is about 380px tall,** so three items fill more than a screen. Scanning what is
  waiting is slow.
- **Every card shows a reason box before you have decided anything.** The page reads like three
  forms to fill in.
- **Nothing stops self-release.** The person who filed a held change can release it
  themselves. For changes held *because they move money*, a second person may be the point.
  *The original allowed self-release; whether to keep that is a decision for Jerry and Alison.*
- **The name collides with "Submission review".**

**Simplify.**

1. **Make it a compact list:** one row per item, for example *"25211 · Slab down · Completed
   22 Jun → In progress · S. Hart · 08:41 · phone call"*. Click a row to expand the note and the
   buttons.
2. **Ask for the reason only after a choice.** Clicking Release or Dismiss opens a small
   confirmation with the reason field (required for both), and nothing else.
3. **Keep the name.** It is the one the operators learned at UAT and in the demo. Rename
   *Submission review* instead (§9).
4. **Fold the count into Overview's "Needs you" list,** and keep the pulsing badge in the rail.
   Pulsing means the system is waiting on a human.

---

## 8. Audit log

**Use case.** Answer *"who changed this, when, and did it reach Monday and HubSpot?"*

- **Who:** Shannan and Alison, occasionally; leadership for compliance.
- **How often:** ad hoc, and usually about one job.

**What is there now.**
- 18 events, with filter chips: All, Milestones, Job details, Regressions, Sync.
- Each entry has a title, a detail line, system tags, who and when, and an "open job" link.

**Flaws.**

- **You can't start from a job or a person.** The filters are by event type, but the operator's
  question starts from a job ("what happened on 25501?") or a person ("what did I change
  yesterday?"). There is no search.
- **No grouping by day,** which makes a long list hard to scan.
- **It shows invoice amounts** ("INV-D-1042 · Forma · $17,500 + GST"). See §2.7.
- **Each job page already shows the same events** for that job.

**Simplify.**

1. **Add one search box** for a job number, client or person, and **group entries by day**.
2. **Cut the filters to three:** Milestones, Job details, and Problems (sync and regressions).
3. **Remove the amounts.**
4. **Move it to the bottom of the rail.** It is a reference, not a daily task.

---

## 9. Submission review

**Use case.** Ops check a rep's deal submission before it goes to the builder: documents,
pricing and builder form fields. They either send it back with a reason or approve it, which
generates the builder pack.

- **Who:** Alison's team.
- **How often:** per deal.
- **Status:** UI only, in both versions (Phase 4 in the original).

**What is there now.**
- A five-column board: Rep draft 2 · Docs required 2 · **Ops review 0** · Sent to builder 1 ·
  Builder accepted 1.
- An *"Ops review — M. and T. Nguyen"* checklist panel.
- A *Builder delivery methods* reference panel.

**Flaws.**

- **The review panel shows a deal that isn't Ops' yet.** The Nguyen deal sits in **Rep draft**,
  and the Ops review column says **0**. The panel is hard-wired to that one live deal
  (`ours: submissions/SubmissionReview.tsx`, `ReviewQueue.tsx:142`), so the operator gets a
  checklist for something that has not reached them.
- **Ops' own column looks like the other four.** The one column that is Ops' work is drawn the
  same as the rep's columns, so "is there anything for me?" means reading the whole board.
- **Two of the five columns are the rep's work.** Watching them invites chasing reps from a board
  instead of the system notifying them.
- **Reference data takes prime space.** *Builder delivery methods* is configuration, not a task.
- **"Start on behalf of a rep" sits beside the title** and competes with the main task.
- **The name collides with Review queue.**

**Simplify.**

1. **Rename the tab "Deal submissions".**
2. **Open on "Waiting for Ops" by default:** only the submissions in Ops review, each with how
   long it has waited. Opening one goes straight to the document-by-document check (the existing
   OpsReview screen). The full board becomes a secondary "All submissions" view.
3. **Show the review panel only for a selected deal that is actually in Ops review.**
4. **Move Builder delivery methods** to a settings or templates area. Move "Start on behalf of a
   rep" into an overflow menu.

---

## 10. Pricing and Doc formatter

**Use case.** Once a month, for each builder:
1. take the builder's price-list PDF;
2. turn it into Locale's formats;
3. check what changed, flagging anything over 4%;
4. tell Sean;
5. publish to the Monday Models board, the branded PDF and Rapid costing.

- **Who:** whoever owns pricing (to be confirmed).
- **How often:** monthly per builder.
- **Status:** UI only, in both versions (Phase 6 in the original).

**What is there now.** The workflow is split across two tabs:
- **Pricing:** a status table of five builders, plus three tiles.
- **Doc formatter**, with four sub-views:
  - *New job*: drop a file and choose one of four templates;
  - *Price changes*: one list's diff, *Send report* and *Publish to Pricing*;
  - *Jobs*;
  - *Templates*.

**Flaws.**

- **One monthly workflow is split over two tabs and four sub-views.** The operator has to know
  the order themselves: formatter, then changes, then publish, then pricing.
- **The Pricing table has no actions.** A builder marked "Awaiting PDF" cannot be started from
  its own row.
- **Choosing a template is a step the system could infer.** The builder and the file already
  imply it. Two of the four templates (Wealth portfolio summary, Group rapid costing input) are
  not Operations price lists at all.
- **Two final buttons with no clear order.** *Send report* and *Publish to Pricing* are separate.
  In the original plan, publishing **also** sent the change report, so it was one act.
- **"Publish to Pricing" names a tab, not an outcome.** What actually happens is that the Monday
  Models board, the branded PDF and Rapid costing are all updated.
- **Rows flagged "review" have no action.** Nothing on screen says how a flagged rate becomes
  "checked".
- **The tiles count without prompting action:** Models tracked 312, Price changes 45.

**Simplify.**

1. **Merge the two tabs into one, called "Builder pricing".** The builder table is the home page,
   and each row carries the action for its state:

   | Row state | Action |
   |---|---|
   | Awaiting PDF | **Upload the October list** |
   | In review | **Continue checking** |
   | Published | **View changes** |

2. **Open a three-step flow from the row:** upload → check flagged values → compare and publish.
   The builder and the template are already chosen.
3. **Require a tick on every change over 4%** before publishing.
4. **Use one final button:** **Publish and send report**, listing exactly what it does: Monday
   Models board, branded PDF, Rapid costing, and an email to Sean. Show the email preview inline.
5. **Move Templates to settings,** and keep each builder's past runs as history under its row.

---

## 11. A simpler shape for the whole dashboard

Only two names change: *Submission review* becomes *Deal submissions*, and *Pricing* becomes
*Builder pricing*. The names the operators learned at UAT (CRM dash sync, Review queue, Audit
log) stay. Switch view and Jarvis are untouched.

```
Operations
  Overview          → "Needs you": one prioritised list, each row one button        [count]
  CRM dash sync     → jobs list with Next and Status columns; the job page under it
    Sync health     → NEW: disagreements, and writes that didn't send, each with Fix
  Review queue      → compact list of held money changes                             [count, pulsing]
  Deal submissions  → was Submission review; opens on "Waiting for Ops"
  Builder pricing   → Pricing and Doc formatter merged; each builder row carries its action
  Audit log         → searchable, grouped by day, at the bottom
```

Three more changes go with this shape:

- **Inbound capture** leaves the rail until it is built. When it is built, it feeds Overview and
  the Review queue rather than becoming another inbox.
- **Sync health is the one tab we don't have** and should. It replaces the pick-a-side conflict
  dialog with the original's model: each problem is shown with the system that owns the field and
  the one action that fixes it (§5.6, §7.5).
- **The rail could later group by operator** (Jobs / Submissions / Pricing) once roles arrive, so
  each person sees their own work first. That waits for the RBAC phase.

---

## 12. What to fix first

The list is ordered by impact on the operator's day against effort, smallest effort first.

| # | Change | Effort | Why first |
|---|---|---|---|
| 1 | ✅ **Quick fixes, done 4 October 2026:** <br>• the rail highlight on the job page <br>• remove build notes from operator copy <br>• "Launchpad owns" in every badge <br>• remove dollar amounts from Operations <br>• stage copy says "if the deal is behind it" | Hours | Each is a copy or one-line change, and together they remove most of the confusion |
| 2 | **Job page:** reorder around a "Next up" strip, one milestone editor (with due date, note, date picker and the future-date rule), Land and house read-only | 1–2 days | It is the flow used most, and the due date was an explicit UAT request |
| 3 | **Jobs list:** Next and Status columns, sort by due date, quick-complete popover | 1–2 days | It removes the open-scroll-save-back loop for routine completions |
| 4 | **Overview as "Needs you"** | 1 day | One place to start the day |
| 5 | **Review queue:** compact rows, reason asked on action | Half a day | Faster scanning, fewer empty fields on screen |
| 6 | **Sync health,** replacing the Resolve dialog | 2–3 days | It stops the app from encouraging overwrites of fields another system owns |
| 7 | **Deal submissions** opens on Ops' work | 1 day | Fixes the panel showing a deal that isn't Ops' yet |
| 8 | **Builder pricing:** merge the two tabs, row actions, one publish button | 2–3 days | It is monthly, so it has lower urgency, but the biggest simplification |
| 9 | **Audit log:** search, grouping by day | Half a day | Reference use only |

Efforts are rough estimates for the static prototype. Wiring any of these to real data is a
separate step (see OPERATIONS-DASHBOARD.md §15).

### What item 1 changed

| Flaw | Change |
|---|---|
| The rail lit Overview on a job page (§2.6) | `Dashboard.subpages` maps `/operations/jobs/…` to the CRM dash sync item, and `isItemActive` reads it (`src/components/shell/dashboards.ts`) |
| Build notes under the jobs filters (§2.5) | Removed from `jobs/CrmDashSync.tsx` |
| "CRM Dash" used as a system name (§2.4) | "Launchpad" in the ownership badge, the conflict banner and dialog, the trail lines, the Overview and the seed audit line. Accounts and Jarvis now say "CRM dash sync", meaning the screen |
| Builder claim amounts in Operations (§2.7) | The Xero step still appears, but without the amount, in the trail, the audit line and the seed. Accounts keeps its amounts; it reads its own invoice data |
| The stage advance overpromised (§5) | One rule, `movesStageForward()` in `sync/types.ts`, is now used by the editor's preview, the trail, the audit line and the stage update itself. A deal already at or past the stage says so and stays put |

**Not changed by this item.** *Land and house* still says "Launchpad owns · editable". Making it
read-only, as HubSpot's, is part of the job page work (item 2).

**One finding withdrawn.** "Formatter outputs · available until 5 Sep 2026" is not stale. The
prototype's seed data is set in August 2026, so the date is right within the demo.
