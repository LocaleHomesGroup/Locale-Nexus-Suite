# Operations dashboard — how the original was wired, and why

This document covers the Operations dashboard in the original Locale Launchpad build: what it was
for, how it was wired end to end, and which rules it enforced. It exists so we can rebuild it here
on our own terms. We should know which parts were deliberate decisions, which were accidents, and
which were never finished.

**Source.** The original build lives at `C:\Users\Kane\Desktop\Locale_Launchpad-main`. It is
Next.js 15 on Vercel with Supabase Postgres in Sydney. Its own documents were last updated
17 September 2026. Everything below was read from that repo's code and docs. **Nothing was
run.** Where the original's docs and its code disagree, this document follows the code and says
so.

**Companion document.** [OPERATIONS-TABS-REVIEW.md](OPERATIONS-TABS-REVIEW.md) goes through our
dashboard tab by tab: what each tab is for, what gets in the operator's way, and how to simplify
it.

**How to read the references.**
- Paths are relative to the original repo.
- `0057` means the migration `supabase/migrations/*_0057_*.sql`.
- `ours:` marks a path in this repo.

---

## Contents

1. [Why it exists](#1-why-it-exists)
2. [What the module contained](#2-what-the-module-contained)
3. [Architecture: mirror and serve](#3-architecture-mirror-and-serve)
4. [Who owns which field](#4-who-owns-which-field)
5. [The screens](#5-the-screens)
6. [The write path: one save, end to end](#6-the-write-path-one-save-end-to-end)
7. [The read path: the mirror, findings and the digest](#7-the-read-path-the-mirror-findings-and-the-digest)
8. [The rules it never breaks](#8-the-rules-it-never-breaks)
9. [Safety controls, and how they were meant to be operated](#9-safety-controls-and-how-they-were-meant-to-be-operated)
10. [Data model and configuration](#10-data-model-and-configuration)
11. [Who can do what](#11-who-can-do-what)
12. [Where the original stopped](#12-where-the-original-stopped)
13. [Gaps found in the original](#13-gaps-found-in-the-original)
14. [How our prototype compares](#14-how-our-prototype-compares)
15. [Decisions to make before we wire it for real](#15-decisions-to-make-before-we-wire-it-for-real)
16. [Where to read more in the original](#16-where-to-read-more-in-the-original)

---

## 1. Why it exists

### The problem

Locale sells house-and-land packages. Once a deal is won, a builder builds it and Operations track
every step. That tracking lived in **two systems at once**:

- **HubSpot**, the sales CRM: the deal, its pipeline and stage, the client and the rep.
- **Monday.com**, the Ops boards: one item per job and one subitem per milestone.

Shannan Murray (Workflow and Compliance Lead) typed every job update into both, by hand. A chain
of Zapier automations used to copy some HubSpot fields into Monday. 22 of the 28 Zaps were paused
on 27 August 2026, and Ops have double-keyed ever since (`CLAUDE.md`, "Cutover discipline").

### The goal

Phase 1 was the MVP and Jerry's first priority. It was called **CRM Dash Sync — Shannan's single
place**: *Shannan updates a job once in Launchpad and both HubSpot and Monday update, with proof
that it happened* (`docs/PHASE-PLAN.md`).

What she would no longer have to do, in the plan's words: *open Monday, open HubSpot, type the
same thing twice, or wonder whether the other system got updated.*

**Done when:**
- Shannan works a full day without opening either CRM.
- The reconciliation report shows no unexplained drift.
- Every write appears in the audit log with her name on it.

**The one sentence** the team used in demos (`docs/DEMO-RUNSHEET-V1.1.md`):

> There is now one place where a milestone change lands in all four systems — with the ones that
> move money held back until a person says so.

The "four systems" are really four places:
1. The Monday subitem.
2. The Monday parent item.
3. The HubSpot deal properties.
4. The HubSpot deal stage.

Alison described a completion landing in four places. Before Launchpad, it landed in two.

### Who it is for

**Shannan and Alison Carter (Sales Operations) edit it. Leadership reads it.** Nobody else needs
it. Every design choice is tuned for two expert users who know the boards intimately and need to
trust what the app did on their behalf.

### What it deliberately is not

- **It does not create Monday items.** The four Sale Won Zaps keep doing that, permanently.
- **It does not write HubSpot-owned fields:** client, rep, finance type, pricing.
- **It does not resolve a disagreement by "picking a side".** A disagreement is fixed in the
  system that owns the field (§7.5).
- **Xero invoicing** is Phase 3.
- **Builder-portal polling** is Phase 5.

---

## 2. What the module contained

### Built

The Operations nav, from `src/components/shell.tsx:59-76`:

```
Operations
  CRM dash sync            /jobs              every job: search, filter, sync status
    (job page)             /jobs/[id]         edit Launchpad-owned fields and milestones, upload files
    Inbound capture        /inbound           static preview of bulk upload and portal updates  [Preview]
    Sync health            /sync-health       mirror findings and writes that gave up
  Review queue             /review            held money-milestone changes; badge pulses when non-empty
  Audit log                /audit             every write: who, what, where it went
```

Home also carried a **My day** list built from the same data (§5.9).

**The nav is data.** Two tables decide it, read on every request through `api.my_modules`:
- `config.module_flags` decides whether a module is on.
- `config.module_role_visibility` decides who sees it.

So turning Operations on or off is a database toggle, not a deploy, and that toggle is the fastest
rollback there is. Each page also refuses on its own (`moduleVisible('operations')`); the nav is a
convenience, never the control.

### Planned, not built

These come from the frozen prototype (`reference/prototype.jsx`, its Operations tabs at about line
4437) and `docs/PHASE-PLAN.md`. **Our prototype already has UI for most of them (§14).**

| Section | Phase | Intent |
|---|---|---|
| Automated sources (portal polling) | 5 | A panel in CRM dash sync lists what the polling agent found in builder portals, for example "25478 · Lock Up completed 05 Aug · Constructive portal, 6:04am". **Accept and sync** applies it exactly as if Shannan had typed it: same trail, same audit entry. A site-start date in a portal *proposes* the move to construction. **The AI never writes to Monday or HubSpot.** It writes to the review queue and a person releases it. |
| Bulk update | 5 | Upload a builder's weekly file or CSV, check the rows, approve |
| Submission review | 4 | Ops review a rep's deal submission document by document (verify or request a fix), then generate the builder pack |
| Pricing and Doc formatter | 6 | Extract a builder price-list PDF with per-value confidence. Diff it against last month and flag changes over 4%. Publishing updates the Monday Models board, the branded PDF and Rapid costing |
| Xero draft invoice | 3 | A billable milestone raises a **draft** invoice that Aled approves in Accounts. The sync trail gains a fourth step. **No amount is shown to Operations** |

---

## 3. Architecture: mirror and serve

This is locked decision 1 in `CLAUDE.md`:

- **Supabase is the app's system of record.** HubSpot and Monday are mirrored into it.
- **The UI reads Supabase only.**
- **Writes go to Supabase first**, then an outbox fans them out to the external systems.

```
 Shannan ─► Next.js page ──read──► api.* views ──────────────► core.* tables
                         ──save──► api.* RPC ─┬─► core.*        ┐
                                              ├─► ops.outbox    ├ one transaction
                                              └─► ops.audit_log ┘

 cron, every 5 min ─► /api/outbox/dispatch ─► claim ops.outbox rows ─► render ─► HubSpot API / Monday API
 cron, every 5 min ─► /api/mirror/sync     ─► read HubSpot + Monday ─► api.upsert_mirrored_jobs
                                                                       ─► core.* or ops.recon_findings
 cron, 07:00 and 15:00 Perth ─► /api/mirror/digest ─► Teams channel (or the audit log, on staging)

 HubSpot deal reaches Sale Won ─► Zapier (4 Zaps, kept forever) ─► creates the Monday item
                               ─► the next mirror pass links that item to the job
```

### The pieces

| Piece | Where | What it does |
|---|---|---|
| Pages | `src/app/jobs`, `review`, `sync-health`, `audit`, `inbound` | Server components. Read through `src/lib/jobs.ts`; save through server actions in `src/lib/actions/write.ts` and `files.ts` |
| Read surface | `api.*` views, security invoker | **RLS decides the rows and the views decide the columns.** A page cannot see more by asking a different question |
| Write doors | `api.update_job_fields`, `api.set_milestone`, `api.resolve_review_item`, `api.resolve_recon_finding`, `api.record_job_file`, `core.change_job_no` | Security definer. Every rule lives here. Each call writes the `core` change, the audit row and the outbox rows in **one transaction** |
| Outbox | `ops.outbox`, `ops.enqueue_outbox` | One row per destination. The idempotency key is unique **in the database** |
| Dispatcher | `/api/outbox/dispatch` → `src/lib/outbox/dispatch.ts` → `src/lib/hubspot.ts`, `src/lib/monday.ts` | Claims due rows, renders the API call, sends or logs it, records the outcome. It also runs straight after each save, for that job only |
| Mirror | `/api/mirror/sync` → `src/lib/mirror/*` → `ops.mirror_apply` | Pulls both systems and applies changes or raises findings. The TypeScript only moves data; Postgres decides |
| Digest | `/api/mirror/digest` → `api.digest_compose` | A twice-daily plain-text summary posted to Teams |
| Health | `/api/health` → `api.health()` | Public. Reports whether the database is reachable and whether the outbox is halted, in dry run or live |

### Schedules

All schedules are in `vercel.json`, in UTC. Perth is UTC+8 with no daylight saving.

| Cron | Route | Perth time |
|---|---|---|
| `*/5 * * * *` | dispatch | every 5 minutes |
| `*/5 * * * *` | mirror, incremental | every 5 minutes |
| `*/5 18 * * *` | mirror, `mode=full` | every 5 minutes from 02:00 to 02:55. A pass cut short resumes, and a source that finished a full pass in the last 20 hours is skipped |
| `0 23 * * *`, `0 7 * * *` | digest | 07:00 and 15:00 |

**Crons fire only on a production deployment.** Production deploys were held
(`git.deploymentEnabled.main: false`), so on staging the mirror and digest were run by hand.

### Two things that changed from the plan

1. **No n8n.** Decision 1 still says n8n syncs by webhook. The mirror that was actually built is
   a polling Vercel route (the v1.5 brief overrode the plan). The only n8n workflow is an inactive
   `[TEST]` outbox sweep, due for deletion at cutover.
2. **No pg_cron.** It was never installed. The nightly reconciliation is the mirror's full pass.

### Stack

- Next.js 15 with the App Router, server components and server actions, plus `@supabase/ssr`.
- Supabase Postgres 17 in ap-southeast-2 (Sydney). Vercel functions in `syd1`.
- **Australian data residency is a requirement**, not a preference.
- Sign-in is Supabase email and password. Entra SSO was deferred.

---

## 4. Who owns which field

This is decision 3: **ownership is per field, not per record.** The UI makes it visible:

- **Green-bordered panels** are Launchpad's, and Operations may edit them.
- **Grey panels** are HubSpot's. They are read-only, with a link across to HubSpot.

That convention is "how Shannan knows what she may change", and it is worth keeping exactly.

### Job fields

These are rows in `config.field_ownership`. The write function refuses anything the table does not
allow.

| Field | Owner | Launchpad writes Monday | Launchpad writes HubSpot | Rule |
|---|---|---|---|---|
| Job number | Launchpad | `job_number`, and renames the item | `builder_job_no` | Nullable until builder acceptance; immutable after; format and uniqueness per builder |
| Builder | Launchpad | `builder` (label per board) | — | A change needs a reason and is audited |
| Sale won date | Launchpad | `sale_won_date` | `closedate` (no dedicated property exists) | Required |
| Site address | Launchpad | `site_address` | `street_address` | Required |
| Site suburb | Launchpad | `site_suburb` | `site_suburb` | Required, and **must belong to the state** (M10) |
| Block titled | Launchpad | `block_titled` | `block_titled_` (Yes/No) | Required |
| Expected title date | Launchpad | `title_due_date` | `expected_title_date` | Required when the block is untitled |
| Buyer type | Launchpad | `buyer_type` (label per board) | `buyer_type` | From a fixed vocabulary |
| Site state | Launchpad | `site_state` | `site_state` | **Wealth only**; refused by name on Homes |
| Finance sent to builder | Launchpad | — | `formal_approved_sent_to_builder` | Never in the future (M2) |
| Deal name | derived | item name | `dealname` | Job number + client, set when the job number arrives |
| Client, rep, pipeline, stage, finance type, house type, developer, broker, prices | **HubSpot** | — | — | Mirrored, never written. **The rep is locked after Sale Won**; reassignment is not supported |

The one exception to HubSpot owning the stage is Launchpad's own **forward stage advance** (§6.4).

### Milestones

There are two phases. **The milestone map is per pipeline family, never global.**

- Homes calls the first construction stage *Site Start* (shown to Ops as "Date to site") and has
  **no** Key handover stage.
- Wealth uses *Date to site* and **does** have a Key handover stage.

**Preconstruction.** The same 11 milestones exist for both `homes_sales` and `wealth_sales`.
Two retired Homes rows are kept as history.

| # | Milestone | HubSpot completion date | HubSpot due date | Regression | Billable |
|---|---|---|---|---|---|
| 10 | Builder acceptance | — | — | audit | — |
| 20 | Sketch and quote received | — | — | audit | — |
| 30 | Sketch and quote approved | — | — | audit | — |
| 40 | Contracts received | — | `expected_build_contract_date` | audit | — |
| 50 | Contracts signed | `date_contracts_signed` | — | audit | — |
| 60 | **Formal finance approval** | `date_formal_finance_received` | `finance_due` | **review queue** | yes |
| 70 | **Settlement confirmation** | `settlement_date` | `settlement_due` | **review queue** | yes |
| 80 | Deposit claim | `deposit__6_5___progress_claim_received_` | — | audit | yes |
| 90 | Prestart meeting | — (Monday only) | `prestart_appointment_date` | audit | — |
| 100 | Build permit received | `estimated_build_permit_date` | — | audit | — |
| 110 | Variations | — | — | audit | — |

**Construction.** There are 8 milestones per family, plus one Maintenance row on each
handed-over family.

| # | Homes / Wealth | HubSpot completion date | Stage it can advance to | Regression | Billable |
|---|---|---|---|---|---|
| 10 | Date to site (Homes key `site_start`) / `date_to_site` | — / `date_to_site` | site_start / date_to_site — **this milestone moves the job (§6.6)** | audit | — |
| 20 | **Slab down** | `slab_down_date` | slab_down | **review queue** | yes |
| 30 | **Plate height** | `plate_height_reached` | plate_height | **review queue** | — |
| 40 | Roof cover | `roof_cover_reached` | roof_cover | audit | — |
| 50 | Lock up | `lock_up_reached` | lock_up | audit | — |
| 60 | Practical completion | `practical_completion_reached` (due: `pc_expected_date`) | practical_completion | audit | — |
| 70 | Key handover | `key_handover_date` | **none on Homes** / key_handover — **this milestone moves the job** | audit | — |
| 80 | Maintenance | — | maintenance | audit | — |

Three things to notice:

1. **The four review-queue milestones are not the same set as the billable ones.** Deposit claim
   is billable but audit-only, and Plate height is gated but not billable. Who chose them:
   Formal finance approval and Slab down came from Shannan on 12 August; Settlement confirmation
   and Plate height came from Alison at UAT on 26 August.
2. **Precon field ownership is settled** in `docs/PRECON-FIELD-MAP.md`. Five subitems are
   Monday-only. Six are HubSpot-entered properties. *A HubSpot field existing does not mean it is
   used.*
3. **Statuses:** `not_started`, `in_progress`, `overdue`, `completed`, `not_applicable`.
   `ready_to_write` is a generated column: Completed **and** a builder's date. Only a
   `ready_to_write` milestone sends a completion onward.

---

## 5. The screens

### 5.1 CRM dash sync — `/jobs`

*"Every job, served from Launchpad. Edit here once and it goes to Monday and HubSpot."*

- **Search.** Matches job number, client, deal name, address or suburb. Enter submits, and
  emptying the box resubmits. That fix came from UAT: Alison found that clearing the box did not
  bring the list back.
- **Filters:**
  - **Builder** and **Sales rep**.
  - **Brand** (Homes or Wealth, stored as `division`).
  - **Division** (WA, VIC or QLD, stored as `region`).

  The labels were renamed at M11 to match what Ops call these things; the columns kept their
  names on purpose. The filter bar is a plain GET form that submits on change. Every control
  carries the others' state, so a filtered view is a shareable URL. **An unrecognised filter value
  shows nothing and says so**, rather than silently matching everything.
- **The outbox line** shows the environment and whether the outbox is halted, in dry run ("writes
  are recorded here, not sent onward") or live. It reads `api.dispatch_state()`.
- **Four tiles.** They are counted **in the database over every job the role can see**
  (`api.jobs_summary`), not over the rows on screen:

  | Tile | What it counts |
  |---|---|
  | Jobs | everything |
  | Awaiting a job number | `job_no` is null |
  | Completed, no builder date *(alert)* | a milestone is Completed without the builder's date. This is Alison's reported pain. Nothing has been sent onward for it |
  | Sync needs attention *(alert)* | the job has **dead** outbox rows: a write a destination refused, or one that ran out of retries |

  Tapping a tile filters in the browser through `pushState`, and the URL still changes.
- **The table** has these columns:
  - Job number (or "Awaiting"), Client, Builder, HubSpot stage.
  - Monday: "Sales board", or "Construction · n of m".
  - Sync: "n gave up", "n queued", "Dry run logged", "Sent" or "Nothing queued".
- **The 300-row cap.** The list shows at most 300 rows and says "Showing N of M". Pagination was
  deferred until real volume.
- **Footer.** *"Bulk upload and builder-portal polling are not built yet. See where this is
  going"*, linking to `/inbound`.

### 5.2 The job page — `/jobs/[id]`

**Header.** "Job 25431 · Client" and the address. Badges show the builder, the Record ID, the
HubSpot stage and a link to the Monday item. The link is built from `api.environment_links`, so
on staging it points at the test copies. **There is never a guessed URL.**

**The left column, all green (Launchpad owns):**

1. **Job details.** The fields in §4. The panel spells out these rules:
   - It shows the job number format hint for the builder.
   - Correcting an existing job number, or changing the builder, is an admin action. It asks for
     a reason and writes its own audit line.
   - Entering the first job number derives the deal name and marks **Builder acceptance**
     complete. The copy says this is "a proxy for acceptance, not a confirmation of it".
   - The suburb picker is filtered by state.
   - Expected title date appears only when the block is untitled.
   - Site state appears only on Wealth.
   - **Save and sync** sends only the fields that changed.
2. **Preconstruction.** On a sales job the last row is the trigger milestone (Date to site), which
   moves the job to construction.
3. **Construction.**
4. **Files** (§5.4).

**The right column:**

5. **Deal details**, grey, labelled "HubSpot owns · read only":
   - Deal name, marked "derived from job number and client".
   - Sales rep, marked "locked after Sale Won".
   - Client, pipeline, stage and contracts signed.
   - The footer reads "Mirrored from HubSpot · time. To change any of it, open the deal in
     HubSpot ↗".
6. **Sync trail.** The job's last 12 outbox rows: destination · status, a plain-English summary,
   and a Dry run tag.
7. **Recent activity.** The last 8 audit entries, with a link to the full log.

**For read-only roles.** Every panel says "Launchpad owns · read only" and shows the same
information without inputs. *"Read-only was being enforced by having nothing to read, which is a
different thing from oversight."*

### 5.3 The milestone editor

**A collapsed row** shows a status dot, the label and a state line such as "Completed · 3 September
2026" or "In progress · due 30 June 2026". A milestone that is Completed with no builder date
gets an amber dot and a warning: *"Nothing has been sent to Monday or HubSpot for this
milestone."*

**Open, it has four inputs:**
- **Status:** Not started, In progress, Completed or Not applicable.
- **Builder's date (Date completed).**
- **Due date.**
- **Note.**

The two date labels can differ per milestone; Pre-start, for example, has its own wording.

**What it says before the save happens.** This is the panel's core job:

| Situation | What the panel says |
|---|---|
| Completed with no date | Refused: "The date stored is the builder's completion date, never the day it was typed in" |
| Builder's date after today in Perth | Refused, **on any status**: "A date something is expected by belongs in the due date" |
| Reversing a money milestone | "Filed in the review queue rather than applied. Nothing reaches Monday or HubSpot until they do" |
| Reversing any other milestone | "Allowed here, and recorded in the audit log with your name" |
| Taking a milestone off Completed | The date field empties, and the panel says the builder's date is cleared in Monday and HubSpot too |
| Any save | **A destination sentence** saying exactly where it lands, for example: *"Saving writes Launchpad, then the Monday subitem, then the HubSpot deal property. It also moves the stage forward to plate height on the deal and on the Monday item, if they are behind it — the stage never moves backwards."* |
| Note-only change | The button becomes **Save note**, and the sentence says the note goes to the Monday subitem's Notes column and nowhere in HubSpot |
| No Monday subitem yet | Recorded here, and carried onto the subitem when one appears (the mirror's *replay*, §7.3) |
| Billable milestone | "A billing stage. Invoicing follows in Phase 3; nothing is raised now" |

The design principle is written into the component: *"It says where a save will land before the
save happens."* Every warning duplicates a database rule. **The database refuses regardless; the
warning is a courtesy.**

### 5.4 Files (0058)

- **Types.** Nine file types live in `config.file_types`, from Shannan's *File Sync v4*
  appendices A and B. Each type knows the subitem it belongs on and whether it reaches HubSpot.
- **Where to upload.** From a milestone row, or from the Files panel.
- **Naming.** The name defaults to `jobnumber TYPE.ext`, and there is a rename field.
- **Destination first.** The destination is stated before the upload, for example *"Uploading
  stores the file in LaunchPad, then sends it to the Monday contracts signed subitem's Files column
  and to the HubSpot deal's Attachments card."*
- **Storage.** Bytes go to a private `job-files` Supabase bucket, 25 MB a file. There is one
  `core.job_files` row per upload, and one outbox row per destination.
- **Monday.** `add_file_to_column` on the subitem.
- **HubSpot.** Five types reach it: signed contract, deposit receipt, finance approval, settlement
  confirmation and titles. Each is a private Files API upload into `/Launchpad`, plus a Note
  carrying the attachment, which fills the Attachments card.
- **Idempotency.** On SHA-256 and destination: uploading the same bytes twice sends nothing.
- **Access.** Operations and platform owners upload. Leadership reads.

### 5.5 Review queue — `/review`

- **Purpose.** The four money milestones file a **reversal or a backdated completion** here
  instead of applying it. Nothing reaches Monday or HubSpot until a person releases it.
  **Ordinary forward progress is never gated.** Completing Plate height applies immediately; only
  taking it back is held.
- **Three states side by side:**
  - **held** — what was true when the change was filed;
  - **proposed** — what releasing would apply;
  - **live** — what is true now.

  If held and live differ, the milestone moved underneath the proposal. The database then refuses
  to release, and the page says so before you press anything.
- **Actions:**
  - **Release and sync**, with a reason. This runs the same machinery as a save.
  - **Dismiss**, with a **required** reason. It changes nothing anywhere, so the reason is the
    only record of the decision.
- **History.** Accepted, dismissed and superseded items, with who decided and their reason.
- **The nav count pulses.** In this design language, *"pulsing UI means the system is waiting on
  a human"*, and this queue is that sentence made into a page.
- **Access.** Leadership sees the queue but cannot release from it. Consultants never see it. The
  database enforces both.

### 5.6 Sync health — `/sync-health`

This was added in v1.5 (0050) for the cutover. It is "watch mode", and the replacement for
"ten clean days" of watching Zapier.

| Area | Shows |
|---|---|
| Header metrics | **Need a look** (open, unexplained findings) · **Explained by a write in flight** · **Writes that gave up** (dead outbox rows) · **Retrying** (failed rows) |
| The mirror | One line per source: Error / Cut short / Full pass / Incremental, the finish time, and records read, changed and found. Also the last full pass with a **clean** verdict, and the last digest |
| Findings | The headline, the Launchpad value, the source's value and timestamp, and the *other* system's finding on the same field. Then the explanation, first and last seen, the seen count, and a link to the job |
| Action | **Dismiss as explained**, with a reason. Allowed for operations, it_admin and platform_owner; leadership reads only. Audited, and changes nothing in Monday or HubSpot |
| Recently closed | The last 15, marked either "dismissed" or "closed by the mirror" |

**How a finding is fixed** (from `CLAUDE.md`):
- A Launchpad-owned field is corrected **in Launchpad**, and the change writes out.
- A HubSpot-owned field is corrected **in HubSpot**, and the mirror pulls it in.
- Dismissing is for findings that are fine as they stand.

### 5.7 Audit log — `/audit`

- **What it shows.** The latest 200 events, filtered by All, Milestones, Job details,
  Regressions or Sync.
- **Each entry:**
  - the **sentence** describing what happened;
  - the action type and a link to the job;
  - tags for the target systems;
  - actor, role and time;
  - a **Break glass** badge where one applies.
- **Where the sentence comes from.** The database writes it (`ops.write_audit`) in the same
  transaction as the change. What is on screen is what was recorded, not a second rendering of it.
- **`before_value` and `after_value` are not exposed.** They could carry values the reader's role
  may not see.
- **The audit log is never rewritten.** Rows from a renamed test user keep their old name, on
  purpose.

### 5.8 Inbound capture — `/inbound`, preview only

A static mock with every control disabled. It has two panels:
- **Upload a builder update.** Rows marked "Ready to approve", "Needs a date" or "Already
  recorded".
- **Builder portal updates.** For example, "Site start recorded → would move this job to
  construction".

It existed so the people using CRM dash sync could critique the shape before it was built. The
Phase 5 contract with Andre Serra's branch (`docs/BUILD-PLAN-v1.6-dash-sync-fixes.md` §8) was:

- Portal proposals are `ops.review_queue` rows with `source = 'portal'`.
- Accepting one calls `api.set_milestone()`, so **every save rule applies to it**.
- Non-critical portal updates stay in Launchpad for reps to see (M13). That would be
  `core.job_portal_updates`, which was not built.

### 5.9 Home: "My day"

Home shows four counts, and they are real:
- jobs where the sync has given up;
- milestone changes waiting on your review;
- jobs completed without the builder's date;
- jobs awaiting a job number.

The greeting's "N things need you today" is their sum. Each count comes from the database for the
person looking at it. Everything else on Home was tagged **Preview**, so people could tell which
numbers they could act on.

---

## 6. The write path: one save, end to end

### 6.1 The four doors

There are **only four write functions the client can call**. Builder changes, notes and due dates
are branches inside them, not functions of their own.

| Function | Called from | Covers |
|---|---|---|
| `api.update_job_fields(job, changes, reason)` | `saveJobFields` (`src/lib/actions/write.ts`) | Every job-detail field, including job number and builder |
| `api.set_milestone(milestone, status, date, note, due, due_touched)` | `saveMilestone` | Status, builder's date, due date, note |
| `api.resolve_review_item(item, 'apply'\|'dismiss', reason)` | `resolveReviewItem` | Releasing or dismissing a held change |
| `api.record_job_file(...)` | `uploadJobFile` (`src/lib/actions/files.ts`) | File upload |

Each door works the same way:
1. Check the role (`app.can_edit_job_data()`: operations or platform_owner).
2. Check the caller can see the job's row.
3. Call an `_internal` function that is granted to nobody.

**One call is one transaction.** The `core` change, the outbox rows and the audit row land
together or not at all. A save that changes nothing writes nothing: no outbox row and no audit
row.

### 6.2 Validation, in order

**`update_job_fields`** (latest 0054):

1. Every key is checked against `config.field_ownership`. A key is refused if it is unknown,
   HubSpot-owned, read-only after Sale Won, a milestone, or blank when required. A vocabulary
   field must hold an active option, and the refusal lists the valid choices.
2. Rules are judged against the **effective row**: builder, job number, state and suburb as they
   will be *after* the save. This is the M8 fix. Changing the builder and the job number together
   used to fail, because a trigger judged a half-applied row.
3. The suburb must be allowed for the state (`config.field_option_parents`). A state with no rows
   allows every suburb, which is what HubSpot itself does.
4. **Builder change.**
   - It needs a reason, and the builder must be active.
   - The job number is re-validated against the new builder's format and checked for uniqueness
     within that builder.
   - It writes its own audit row.
5. **Job number.**
   - It cannot be cleared once set, and it must be unique per builder.
   - The first assignment is a plain update.
   - A correction needs a reason and goes through `core.change_job_no`, which audits it as
     `job_no.corrected`.
   - Triggers back all of this up: an immutability trigger, a per-builder format trigger, and a
     partial unique index on `(coalesce(builder_key,''), job_no)`.
6. **Finance sent to builder** may not be in the future, in Perth time.
7. **After the update:**
   - the deal name is re-derived if the job number changed;
   - an untitled block needs an expected title date;
   - site state must be set on Wealth and must not be on Homes.
8. **First job number.** Builder acceptance is completed automatically, through
   `set_milestone_internal`.

**`set_milestone`** (latest 0057):

1. **Completed needs the builder's date.**
2. **The builder's date can never be after today in Perth**, on any status.
3. **Any status other than Completed drops the date.** This is how un-completing clears it (M9).
4. **A note-only change** produces its own Monday row and the audit row `milestone.note_added`.
5. **A regression** is Completed → anything else, or a Completed date moved **earlier**. On a
   `review_queue` milestone it is filed in the queue (§6.5) and **nothing else happens**.
6. **Otherwise**, the status, date, due date and note are applied, and the outbox rows below are
   added.

### 6.3 From a change to outbox rows

**The write function decides the rows.** Each row covers one destination, one entity and one
field group.

| Consumer | Operations |
|---|---|
| Monday | `update_parent_item`, `update_subitem`, `move_board`, `add_file` |
| HubSpot | `update_deal_property`, `advance_deal_stage`, `move_pipeline`, `attach_file` |

**What a milestone save can enqueue:**
- a Monday `update_subitem` row with status, builder's date (or `''` to clear one), due date and
  note;
- a HubSpot due-date property row, if the due date changed and the milestone has a due property;
- a HubSpot completion-date property row: the date if the milestone is `ready_to_write`, or `''`
  to clear a date that existed before;
- a stage advance (§6.4), or a pipeline move (§6.6).

**What a job-fields save enqueues:**
- one Monday `update_parent_item` row with every changed Monday field, plus `item_name` if the job
  number changed;
- one HubSpot property row;
- a separate HubSpot `dealname` row.

**`ops.enqueue_outbox` is the gate every row passes through** (latest 0057):

- **Idempotency key.** It is
  `sha256(consumer, operation, entity_type, entity_id, field_group, value_hash, source_version)`.
  - `source_version` is the `core` row's `updated_at` to the microsecond, or the SHA-256 for files.
  - The key is enforced by the unique constraint `(consumer, idempotency_key)` with
    `ON CONFLICT DO NOTHING`, so **a retry can never double-apply**.
  - A genuine A→B→A change still produces three rows.
- **Monday allowlist.** A row's target board must pass `config.assert_monday_board_writable`. That
  check raises if the board is unknown, excluded, not writable, or in the production workspace
  while the database is not production. **A board not on the allowlist is a hard error, never a
  silent skip.** It runs again at claim time.
- **HubSpot shape rules:**
  - `hs_pipeline_stage` is always refused.
  - `dealstage` is allowed only alone, under `advance_deal_stage`.
  - `pipeline` is allowed only beside `dealstage`, under `move_pipeline`, and only along a
    `config.pipeline_transitions` row.
  - **A Sale Won stage is never a target**, checked by ID against every pipeline.

**`ops.resolve_outbox_targets` runs at claim time** and turns keys into real IDs:

- **Columns** come from `config.monday_columns`, per board, taken from the board the row names.
  They never come from the job's current board, because a move changes that in the same
  transaction.
- **Milestone status** is written by index: In progress 0, Completed 1, Overdue 2, Not started 3,
  Not applicable 4.
- **Other status columns use the label for that specific board**
  (`config.monday_option_labels`), then a generic label, then the raw value. The raw value is a
  deliberate fallback, so that Monday refuses it visibly.
- **HubSpot rows** get this environment's Sale Won stage IDs as `forbidden_stage_ids`, read at
  claim time.

### 6.4 Stage advance, forward only (0039, 0056)

These conditions must all hold:
- the milestone is in the construction phase;
- it writes to HubSpot and maps to a stage;
- its state changed;
- the save is **not** a regression and **not** a pipeline trigger;
- the target stage is **ahead** of the deal's current stage. Order comes from
  `config.milestone_defs.sort_order`, and the deal must already be at a construction stage.

When they do, the save:
- enqueues HubSpot `advance_deal_stage {dealstage}`;
- updates `core.jobs.stage_key` straight away;
- writes a `core.deal_stage_history` row;
- enqueues a Monday parent `construction_stage` row (M5). Its label comes **from that board's
  captured labels**, never derived from the stage key; Wealth calls Key handover "KHO". A stage
  with no label, such as Maintenance, is reported as "not sent".

**A regression never moves the stage, in either direction.**

### 6.5 Money milestones and the review queue

**Filing.** A regression on Formal finance approval, Settlement confirmation, Slab down or Plate
height:
- calls `ops.file_review_item`, storing the proposed `{status, date_completed, note, due}`
  against the current state. The proposal **carries the cleared date**;
- supersedes any older pending item for that milestone;
- audits `milestone.regression_queued`;
- returns `queued_for_review: true`.

**`core`, Monday and HubSpot are all untouched.** No outbox row is created and nothing is
dispatched.

**The lifecycle:** pending → accepted (released), dismissed or superseded.

**Releasing** (`api.resolve_review_item`):
1. Checks the role: operations or platform_owner. **Dismiss needs a reason.**
2. Runs the stale check: if live ≠ held, it refuses.
3. Calls `set_milestone_internal(..., p_review_release => true)`. The regression branch is skipped
   once and the normal fan-out runs. The client can never pass `true` itself.
4. Marks the item and supersedes any siblings, then audits `review.applied` or
   `review.dismissed` with the reason.

### 6.6 Pipeline and board moves (M4, 0057)

`config.pipeline_transitions` has four rows. Completing the **trigger** milestone with a date moves
the job, on that save:

| From | To | Trigger | Lands on stage | Launchpad seeds milestones? |
|---|---|---|---|---|
| homes_sales | homes_construction | Date to site (`site_start`) | site_start | no — a Monday board automation creates the seven construction subitems on arrival |
| homes_construction | homes_handed_over | Key handover | maintenance | yes — Maintenance, because nothing in Monday adds it |
| wealth_sales | wealth_construction | `date_to_site` | date_to_site | no |
| wealth_construction | wealth_handed_over | Key handover | maintenance | yes |

**What the save does:**
- **HubSpot:** a `move_pipeline {pipeline, dealstage}` row, with the target resolved per region.
- **Monday:** a `move_board` row that `depends_on` the same save's subitem row, so the subitem
  write lands before the item moves.
- **Homes VIC and QLD** have no Monday construction board. There, the Monday half is recorded as
  "not sent" and only the deal moves.
- **The job record:** its three pipeline fields and its board key change in one statement.
- **A trigger emits no stage advance.** It moves the job instead.
- **Reading it back.** The Monday send reads the item first and treats "already there" as done.
  It moves the item, then reads it back. If a subitem or the job number did not travel,
  that is a `board_move` finding.
- **There is no automatic rollback.** A wrong move is corrected by hand in HubSpot and Monday, and
  the mirror pulls the correction in.
- **In reverse,** a deal moved by hand in HubSpot along a transition makes the mirror queue the
  Monday `move_board` itself.

### 6.7 The dispatcher

**How it is triggered:**
- the Vercel cron every 5 minutes;
- **on demand straight after each save**, for that job only. This uses the service role, which
  is why the trail usually shows results immediately.

**Route auth:**
1. `ROSTER_ONLY` is checked **before any secret**, and returns 403.
2. The bearer must match `OUTBOX_DISPATCH_SECRET` or `CRON_SECRET`, compared in constant time.
   With no secret configured, everything is refused.

**One run.** For Monday and then HubSpot, `api.dispatch_claim`:

1. Claims nothing if the **kill switch** is on (`config.writes_halted()`). A missing settings row
   counts as halted.
2. Claims nothing if the consumer's **circuit breaker** is open.
3. Retires **superseded** rows: a pending or failed row whose content is fully covered by a later
   row for the same entity and field group is marked dead and audited `outbox.superseded`.
4. Claims due `pending` or `failed` rows whose `depends_on` row has settled. It uses
   `FOR UPDATE SKIP LOCKED` and a 120-second lock, and counts an attempt at claim time.
5. Re-checks the Monday allowlist and resolves targets.
6. **Decides dry run at claim time.** If `write_settings.outbox_dry_run` **or** the consumer's
   `dry_run` is set, or the consumer is not enabled, the exact request is rendered and stored as
   `dry_run_logged`, and nothing is sent.

**A live send.**
- **HubSpot portal guard,** once per batch. It asks HubSpot which portal the token belongs to,
  and the database decides: it must be this environment's portal, and outside production it must
  be a SANDBOX account. If that fails, the whole batch fails.
- **Then** render → send → `api.dispatch_sent`, which logs one `ops.sync_log` row per payload key.
  Those rows are what echo suppression matches against (§7.4).

**Failure handling.** The seeded values for both Monday and HubSpot:

| | |
|---|---|
| Backoff | 30s, 60s, 120s, 240s (base 30, multiplier 2, capped at 30 minutes) |
| Max attempts | 5, then `dead` |
| Circuit breaker | 5 non-terminal failures in 10 minutes opens it for 10 minutes, audited `outbox.circuit_opened` |
| **Terminal refusal** (0051) | A HubSpot 4xx other than 429, or a Monday validation error, goes **straight to dead**. It does not count toward the breaker and is audited `outbox.dead_lettered`. This was the "Toowoomba" lesson: a suburb HubSpot did not accept bounced 13 times and tripped the breaker |

**There is no re-drive.** The fix for a dead row is to correct the value in Launchpad so it writes
out again (`docs/RUNBOOK-production-cutover.md`).

### 6.8 The sync trail after Save

The modal (`src/lib/sync-trail.ts`, `src/components/sync-trail.tsx`) is a **snapshot** taken after
the on-demand dispatch. It does not poll. It shows:

1. **Launchpad ✓.**
2. One step per outbox row:

   | Outbox status | Trail shows |
   |---|---|
   | `sent` | "Done" |
   | `dry_run_logged` | "Dry run", with the exact request |
   | `failed` or `dead` | "Failed" |
   | anything else | "Queued", pulsing |

3. One "blocked" step per *not sent* reason, for example *"Homes has no Key handover stage"*.

A queued regression shows only "Launchpad: not applied" and "Review queue: waiting".

After UAT, the trail switched from raw JSON to plain English: *"Sent to Monday and confirmed."*
The payload now appears **only** for a dry run, where inspecting it is the point.

### 6.9 Life of one save, end to end

**Example 1. Shannan marks Slab down Completed, builder's date 3 September.** The job is a Homes
WA construction job at Site start.

1. **Save.** `saveMilestone` → `api.set_milestone`, which checks the role and the row → 
   `set_milestone_internal`, in **one transaction**:
   - It locks the milestone and the job and resolves the definition `homes_construction/slab_down`.
   - The date is present and not in the future. This is not a regression.
   - It updates `core.job_milestones`; `ready_to_write` becomes true.
   - It enqueues the Monday subitem row `{milestone_status: completed, date_completed: 2026-09-03}`.
   - It enqueues HubSpot `{slab_down_date: 2026-09-03}`.
   - Site start sorts before Slab down, so it enqueues HubSpot `advance_deal_stage`, updates
     `stage_key`, enqueues the Monday parent `{construction_stage: "Slab Down"}`, and writes a
     `deal_stage_history` row.
   - It writes the audit line: *"Set Slab down to Completed, builder date 3 September 2026. The
     deal stage moved forward from site start to slab down, and the Monday item to 'Slab Down'.
     Queued for monday and hubspot."*
2. **On-demand dispatch** for the job, Monday first and then HubSpot:
   - **In dry run:** the requests are rendered and stored.
   - **Live:** `change_multiple_column_values` on Monday; the HubSpot portal guard, then
     `PATCH /deals/{id}` for the property and again for the stage.
3. **Trail.** Launchpad ✓, Monday, HubSpot, Monday, HubSpot.
4. **The next mirror pass** finds both systems agreeing with `core`. There is no finding.

**Example 2. The same milestone reversed to In progress.**

1. The date field empties, with a warning.
2. Save files a review item: proposal `{in_progress, date: null}` against held
   `{completed, 2026-09-03}`. **Nothing else changes anywhere.**
   The trail shows "Sent to the review queue".
3. **On `/review`, someone releases it with a reason:**
   - Monday gets `{milestone_status: in_progress, date_completed: ''}` and **the date is cleared**.
   - HubSpot gets `{slab_down_date: ''}` and **the date is cleared**.
   - **The stage stays at Slab down.**
   - Audit lines `milestone.regressed` and `review.applied` are written.
4. **Dismissing it instead** needs a reason and changes nothing.

---

## 7. The read path: the mirror, findings and the digest

### 7.1 One pass

**The route** (`/api/mirror/sync`):
- **Auth:** a `ROSTER_ONLY` refusal first, then the bearer token.
- **Parameters:** `mode=full|incremental`, `source=hubspot|monday`, and `limit` (1–100).
- **Time:** 60 seconds with a 45-second budget.

**`runMirrorPass`** (`src/lib/mirror/run.ts`):

1. **`api.mirror_pass_start`** returns everything the pass needs:
   - the watermarks;
   - the scopes;
   - every pipeline with its Sale Won stage ID;
   - every HubSpot deal property in this environment's capture;
   - the Monday boards, **only those that are `writable and not excluded`** (see §13).
2. **Monday is read first, then HubSpot.** In `linked_only` scope, a deal enters through the
   Monday item that carries its Record ID.
3. **Records are applied in batches of 25** through `api.upsert_mirrored_jobs`. One bad record
   does not stop the rest.
4. **`api.mirror_source_finish`** stores the watermark; an errored run keeps the old one. After a
   **whole, error-free full pass** it raises a `missing` finding for any job the source no longer
   returns.
5. **`api.mirror_pass_finish`** returns `clean`.

### 7.2 What it reads

**HubSpot** (`src/lib/mirror/hubspot.ts`):
- **Query.** `POST /crm/v3/objects/deals/search` sorted by `hs_lastmodifieddate`, with two filter
  groups: sales pipelines at their Sale Won stage, and any construction or handed-over pipeline.
  **Cancelled pipelines are never read.**
- **Watermark.** The last `hs_lastmodifieddate`. The search restarts at about 9,000 results to
  stay under HubSpot's 10,000 cap.
- **Properties.** The fixed set plus every property in the capture.
- **Contact and owner.** The primary contact comes through v4 associations. Owners are cached.
- Calls are paced at 220 ms.

**Monday** (`src/lib/mirror/monday.ts`):
- **A cheap walk first.** It lists ids and `updated_at` for every parent board and every subitem
  board.
- **Then full detail,** 25 at a time, for parents changed since the board's watermark **or that
  own a changed subitem**, because a subitem edit does not move its parent's timestamp.
- **Watermark.** Per board, and advanced only if the whole board was read.

**Scopes fail closed outside production:**
- HubSpot `linked_only`: only deals already linked to a job.
- Monday `marked_only`: only items whose name carries the `ZZTEST` marker.

The production runbook switches both to `all`.

### 7.3 How a record is applied (`ops.mirror_apply`, latest 0059)

**Normalisers** sort each source's fields into two buckets:
- **external fields**, which are HubSpot-owned and always taken;
- **Launchpad fields**, which are compared.

**The order of operations:**

1. **Find the job** by HubSpot Record ID, then Monday item ID, then job number.
2. **If no job is found:**
   - a record with no HubSpot ID becomes an **orphan** finding;
   - otherwise a `core.jobs` row is **inserted**. This is how a new Sale Won deal becomes a job.
3. **Link the Monday item** if the job has none. A *different* item already linked is a finding.
4. **HubSpot-owned fields are updated unconditionally.** A pipeline change along a transition
   queues the Monday `move_board`.
5. **Each Launchpad-owned field, in this order:**
   - equal → close any open finding;
   - **source empty → silence** (0049, extended to due dates in 0059);
   - our own echo → suppressed (§7.4);
   - `job_no` already set and different → **always a finding** (job numbers are immutable);
   - **Launchpad's value is newer → a finding, never an overwrite;**
   - otherwise → **applied**. A database refusal becomes an `error` finding.
6. **Milestones** follow the same pattern, with three additions:
   - an empty HubSpot completion never un-completes a milestone;
   - due dates are compared, never applied;
   - a **blank new subitem** for a state Launchpad already holds is **replayed** through the outbox.

**What "newer" means.** Launchpad's time is the later of `updated_at` (which only a person's save
moves) and `mirrored_source_at`. The source's time is the record's own stamp.

**In practice:** any Launchpad-owned field, milestones included, **is overwritten by the mirror
whenever the source record is newer than Launchpad's last save.** It is "never overwritten" only
in four cases:
- the job number;
- an empty source value;
- HubSpot due dates;
- the Monday construction stage.

### 7.4 Echo suppression

Without it, every Launchpad write would come back on the next pass as an "external change".
(`CLAUDE.md` warns that HubSpot and Monday "will update each other in a loop".)

- **Outbound.** Every live send logs one `ops.sync_log` row per field: system, external ID, field
  key, and a SHA-256 of the value. Dry-run rows never match.
- **Inbound.** `ops.classify_inbound_change` matches system, ID, field and **exact value hash**
  within `echo_suppression_window_seconds` (120 seconds). **Each outbound row absorbs only one
  echo**, so a second, identical genuine edit is still seen.
- **When it actually matters.** It only runs when the inbound value *differs* from `core`. An echo
  of the current value is simply "agreeing". It matters when Launchpad has moved on again since
  its write.
- **Outside the window,** the "Launchpad is newer" rule takes over. The finding is marked
  *explained* if a matching outbox row is pending, failed, or was sent within the window.

### 7.5 Findings

| Severity | Raised when |
|---|---|
| `drift` | A Launchpad-owned value disagrees with a source (job field, milestone, due date, construction stage, Monday item link) |
| `error` | The database refused the incoming value, or a board move did not fully travel |
| `orphan` | A Monday item with neither a HubSpot ID nor a job number, or a subitem name not in the catalogue |
| `missing` | After a whole full pass, the source no longer returns the job |

**How a finding lives:**
- **Deduplicated** per job, system, external ID and field. A repeat increments `seen_count`.
  Changed values supersede the old row.
- **Auto-closed** when the two systems agree again.
- **Dismissed** by a person with a reason, from Sync health.

**"Clean"** means the full pass completed and **no open, unexplained finding exists anywhere**.
Jerry decided that definition on 7 September (C10) and it is stored as data in
`config.write_settings.recon_finding_rules`. Only two keys in it are actually read by code:
`explained_by_outbox_statuses` and `hubspot_empty_claims_since`.

**Dead outbox rows are not findings.** They appear as "Writes that gave up" on Sync health and in
the digest.

### 7.6 The digest

- **When.** 07:00 and 15:00 Perth.
- **How.** `api.digest_compose` renders plain text **in the database**:
  - the environment and Perth time;
  - the last full pass and its clean verdict;
  - the latest run per source, with any errors;
  - every open, unexplained finding (up to 40, new ones marked `· NEW`);
  - every dead outbox row since the last digest, with its error;
  - a link to `/sync-health`.
- **Where it goes.**
  - A Teams Adaptive Card, if `TEAMS_DIGEST_WEBHOOK_URL` is set.
  - Otherwise the **audit log**, which is what staging does.
  - Nothing at all if there is nothing to say.

  A failed post repeats its content next time.

### 7.7 Life of an external change

**Someone types a milestone date directly into a Monday subitem.**

1. Within about 5 minutes, the subitem's newer timestamp pulls its parent into the incremental
   read.
2. The change is not an echo, and it is newer than Launchpad's last save, so it is **applied to
   `core`**. There is:
   - no finding, no audit row and no outbox row;
   - **no review queue, even for a money milestone;**
   - **no future-date check**, because those are save-side rules.

   **Nothing propagates to HubSpot.**
3. On the next HubSpot read of that deal, the property is either:
   - **empty:** an unexplained finding (for milestones dated from 27 August), which lands on Sync
     health and in the next digest;
   - **older:** HubSpot's value may be applied back over Monday's, because "newer" is per deal,
     not per property.

That is why the explainer tells Ops: *"Please do not work around it by typing into HubSpot or
Monday directly; that is how the two boards drift apart."*

**Someone renames the client in HubSpot.** This is HubSpot-owned, so `core.contacts` is updated
on the next read of the deal, with no finding and no digest line. Whether a contact edit moves the
deal's timestamp is **not verified**. If it does not, the change arrives at the nightly full pass.
The deal name is not re-derived; it changes only when the job number does.

---

## 8. The rules it never breaks

These are the invariants. Each was decided by a named person for a stated reason, and **each is
enforced in Postgres, not in the page.**

| # | Rule | Why | Source |
|---|---|---|---|
| 1 | **The builder's date is the truth.** Completing a milestone needs the builder's date, never the day it was typed | A data-entry timestamp is a different fact. `hs_v2_date_entered_*` is a reporting fallback only | Decision 5 |
| 2 | **The Formal finance approval date is the date on the letter**, not the day a builder logged it | Builders count the price-hold period from the letter | M1, Alison and Shannan 10 Sep |
| 3 | **A builder's date is never in the future,** in Perth time, on any status | A future date is a target someone typed in the wrong field; targets go in the due date | Alison 26 Aug; widened by Shannan's UAT case on 4 Sep (0048) |
| 4 | **A completion date exists only on a Completed milestone.** Un-completing clears it in Launchpad, Monday and HubSpot | Otherwise both systems keep claiming a completion that was reversed | M9, Shannan 10 Sep |
| 5 | **Reversals apply with an audit entry, except on the four money milestones,** which go to the review queue | They move cashflow | Shannan 12 Aug, Alison 26 Aug. Per-milestone config |
| 6 | **The stage moves forward only.** Only a completed construction milestone moves it; never backwards, never on a reversal, never from precon | — | Decision 4, 0039 |
| 7 | **No Sale Won stage is ever written, from any path** | The Sale Won Zaps create a Monday item, so writing Sale Won would create a duplicate | Three layers: config constraint, `ops.enqueue_outbox`, the renderer |
| 8 | **The pipeline is written only by `move_pipeline`,** forward, along the four transition rows. There is no automatic rollback | — | M4, 0057 |
| 9 | **Job numbers** are nullable until acceptance and immutable once set. A correction is an admin action with a reason. They are unique *per builder* and formatted per builder | Two builders can issue the same number | Decision 8, Alison 26 Aug |
| 10 | **The sales rep is read-only after Sale Won** | Reassignment is not a supported operation | Decision 10 |
| 11 | **The suburb must belong to the state,** exactly as HubSpot's conditional options say | HubSpot refuses anything else | M10 |
| 12 | **Launchpad never creates a Monday item.** The mirror pulls; the Zaps create | — | Cutover discipline |
| 13 | **Portal updates and AI never write to Monday or HubSpot directly.** They file to the review queue and a person releases them. A person saving in Launchpad *is* the human confirmation | Jerry's rule: "it does not bend" | Decision 7, AI naming |
| 14 | **No hardcoded IDs.** Boards, pipelines, stages, columns and status *labels* live in `config.environment_ids`, per environment and per board | Production subitem columns turned out *not* to be uniform across boards (§13) | Safety rails |
| 15 | **Monday has no sandbox.** A board allowlist guards every write; a board not on it is a hard error | One token reaches both the test and production workspaces | Safety rails |
| 16 | **Confidentiality is enforced at the data layer.** Locale commission is hidden from Operations and consultants. Builder invoicing schedules are **never displayed anywhere** | UI-only gating is "a blocking defect, not a cosmetic one" | Decisions 12–13 |
| 17 | **Every write is audited:** actor, action, targets, and a human sentence. Audit rows are never rewritten | It is user-facing, not just diagnostic | Safety rails |
| 18 | **Business rules live in Postgres,** never only in the UI, and never in an integration tool | Rules must be diffable, reviewable and testable | Safety rails |

---

## 9. Safety controls, and how they were meant to be operated

| Control | Mechanism | Used how |
|---|---|---|
| **Dry run** (the default) | `config.write_settings.outbox_dry_run`, or the consumer's own `dry_run`. Missing config counts as dry run. `OUTBOX_DRY_RUN` is **display only** | Every write renders the exact request and stores it as `dry_run_logged`, visible in the trail |
| **Kill switch** | `config.write_settings.kill_switch` | One statement stops every outbound write. Rows wait as `pending`; nothing is lost. A runbook step Pablo can execute |
| **Per-consumer enable** | `config.outbox_consumers.enabled` | Turn Monday on first and HubSpot a day later |
| **Circuit breaker** | 5 failures in 10 minutes opens it for 10 minutes | Automatic; audited |
| **Terminal dead-letter** | 0051 | A refused value stops at the first refusal and is listed in the digest |
| **Idempotency** | A unique constraint in the database | A retry never double-applies |
| **Echo suppression** | `ops.sync_log` | Stops the systems updating each other in a loop |
| **Board allowlist and portal guard** | `config.assert_monday_board_writable`, `api.assert_hubspot_portal` | A wrong-environment write fails, loudly |
| **Module flags** | `config.module_flags` | Turn the whole module off without a deploy |
| **`ROSTER_ONLY`** | An environment flag checked before any secret | A roster-only deployment can never run the mirror or the dispatcher |

### The intended cutover

This is the operating model in miniature, from `comms/launchpad-going-live-explainer.md` and
`docs/RUNBOOK-production-cutover.md`:

1. **Set up production with sending off.** The mirror reads both systems; nothing is sent.
2. **Watch mode, together.** Real jobs appear. Sync health lists every disagreement, and Jerry,
   Alison and Shannan go through it on a call. Dates that never reached Monday either clear
   themselves or are written later. Anything fine as it stands is dismissed with a one-line
   reason.
3. **Check the recordings.** Jerry makes real changes in dry run and compares each rendered
   request against what he would have typed by hand. Ops keep working as before.
4. **Monday on.** From this point, Ops update the job in Launchpad.
5. **HubSpot on, the next day,** after one clean morning digest.

**Every step is reversible with one setting and no release.**

**Their day, before and after:**

| Before | After |
|---|---|
| Update Monday, then HubSpot, and sometimes chase which is right | Complete it once in Launchpad with the builder's date |
| Type a job number into both systems and rename the item | Enter it once. The item is renamed and Builder acceptance ticks |
| Nobody knows the boards disagree until someone notices | A Teams summary at 07:00 and 15:00, and Sync health |
| A value one system won't accept retries quietly | The sync stops at the first refusal and says why |

---

## 10. Data model and configuration

### Schemas

| Schema | What it holds | Reachable by the client |
|---|---|---|
| `api` | **The entire read and write surface:** views and RPCs | The only schema with USAGE |
| `core` | Business data, mirrored and Launchpad-owned | Through `api` views, with RLS |
| `ops` | Outbox, sync log, audit log, review queue, findings, mirror and digest runs | Through `api` views |
| `config` | IDs, flags, ownership, milestone map, write settings | Mostly read-only |
| `app` | Enums, plus identity and role predicates | Execute per function |
| `hr` | HR records, isolated at grant level | — |

### Core tables Operations uses

**`core.jobs`.** Identity is the internal `id` UUID; **`hubspot_record_id` is the universal
external key** (unique, not null), and `monday_item_id` is linked by the mirror. Its columns cover
the job fields in §4, plus:
- `pipeline_key`, `pipeline_family`, `stage_key`, `region` and `division`;
- `hubspot_owner_id`, which drives row scope;
- mirror timestamps.

**There are no write policies.** Every write goes through a definer RPC.

**`core.job_milestones`.** One row per job, phase and key:
- `status`, `due_date`, `date_completed`, `notes`;
- `monday_subitem_id` and `monday_board_id`;
- the generated `ready_to_write`.

**There is no foreign key to the definitions.** A row is resolved by family, phase and key through
`config.milestone_def_for`, which tries the job's own family first and then its sibling families.

**Smaller tables:**
- `core.job_files`: files.
- `core.deal_stage_history`: Launchpad's own forward advances only.
- `core.owners`: the reps.
- `core.contacts`: client PII, upserted by the mirror.

**Operational tables:**

| Table | Holds |
|---|---|
| `ops.outbox` | status `pending`, `dry_run_logged`, `sent`, `failed` or `dead`; `depends_on`; `attempts`; `rendered_payload` |
| `ops.outbox_attempts` | One row per attempt |
| `ops.sync_log` | Outbound and inbound field hashes |
| `ops.audit_log` | The audit trail |
| `ops.review_queue` | Held changes |
| `ops.recon_runs`, `ops.recon_findings` | Mirror passes and findings |
| `ops.mirror_runs`, `ops.digest_runs` | Per-source runs and digests |

### Configuration that drives behaviour

| Table | Drives |
|---|---|
| `config.runtime` | One row naming this database's environment. **Absent means every write raises** |
| `config.environment_ids` | Every external ID, keyed by environment, system, entity type and parent. 13 entity types, from Monday board to HubSpot stage. Loaded from `config/environments/*.json` by `scripts/load-environment-ids.mjs`; never typed. **Production Monday boards are never writable** until the cutover step that flips them |
| `config.milestone_defs` | The milestone map (§4): per family, HubSpot completion and due properties, stage key, `regression_policy`, `billable`, labels |
| `config.pipeline_transitions` | The four moves (§6.6) |
| `config.field_ownership` | Who owns each job field, where it writes, and its required rule |
| `config.field_options`, `config.field_option_parents` | Vocabularies (buyer type, builder, state, 123 suburbs) and the suburb-per-state rule |
| `config.monday_option_labels` | Status labels **per board**. The builder label genuinely differs by board |
| `config.builders` | The job-number pattern per builder |
| `config.write_settings` | Dry run, kill switch, echo window, mirror scopes, test marker, finding rules |
| `config.outbox_consumers` | Per consumer: enabled, dry run, attempts, backoff, breaker. All seeded **disabled and in dry run** |
| `config.module_flags`, `config.module_role_visibility` | The nav |
| `config.file_types` | The nine file types and where each one goes |

**Job-number patterns** (`config.builders`):

| Builder | Pattern | Example |
|---|---|---|
| Forma, Move Homes, Levita | numeric `^[0-9]+$` | 25431 |
| New Choice | alphanumeric `^[A-Za-z0-9]+$` | 2401022R |
| New Era | alphanumeric with hyphens (widened in 0053) | NE-I2009 |
| La Vida, LVI | no pattern; anything passes | — |

**Buyer types.** Investor (shown as "Investor - Retail"), Investor - Wholesale, Owner Occupier -
First Home Buyer, Owner Occupier - Upsizer, Owner Occupier - Downsizer, and Staff Deal. The stored
values are HubSpot's internal ones and differ from some labels; for example, "Owner Occupier -
Second Home Buyer" is shown as Upsizer.

### Where the external IDs come from

**HubSpot pipeline families:**
- `homes_sales`, `homes_construction` and `homes_handed_over`, for WA, VIC and QLD;
- `wealth_sales`, `wealth_construction` and `wealth_handed_over`;
- cancelled and exclusive-land families, which the mirror never reads.

**The Sale Won stage ID is `closedwon` only on Homes WA.** VIC, QLD and Wealth use numeric IDs,
which is why the Sale Won guard checks by ID.

**Monday, production** (workspace 1333035):
- Homes sales WA, VIC and QLD;
- Homes construction WA and Homes handed-over WA;
- Wealth sales, construction and handed-over.

**There are no VIC or QLD construction boards.** The test workspace (3190615) mirrors the eight
job boards.

---

## 11. Who can do what

**Roles** (`app.role_key`): consultant, sales_manager, head_of_sales, operations, accounts,
marketing, leadership, hr, it_admin, platform_owner.

- A role is resolved **from the `core.app_users` table**, never from the token. Inactive means no
  access.
- Shannan and Alison are both `operations`.

| Capability (on `api.me`) | Roles | Used for |
|---|---|---|
| See the Operations module | operations, leadership, platform_owner | Nav and page gate |
| `can_edit_job_data` | operations, platform_owner | Job fields, milestones, files |
| `can_see_review_queue` | operations, leadership, it_admin, platform_owner | `/review` |
| `can_release_review_items` | operations, platform_owner | Release or dismiss |
| `can_see_sync_health` | operations, leadership, it_admin, platform_owner | `/sync-health`, sync badges, the trail |
| `can_resolve_recon_findings` | operations, it_admin, platform_owner | Dismiss a finding |

**The UI asks the database these questions** (through `api.me`) instead of working them out from
the role. That way *"the screen and the RPC cannot disagree"* — the difference between a disabled
button and a control.

**Which jobs each role sees:**

| Role | Sees |
|---|---|
| operations, leadership, accounts, head_of_sales, platform_owner | Every job |
| consultant | Their own jobs only |
| sales_manager | Their team's jobs |
| marketing, hr, it_admin | No jobs |

**Commission:**
- Operations always receives **null** for both commission figures, enforced in the `api.jobs`
  view.
- Builder invoicing schedules are granted to no client role.

---

## 12. Where the original stopped

This is the position as at 16–17 September 2026, from `docs/STATUS.md`.

**Built, and live to the test targets.** Those targets are the HubSpot sandbox 443399468, the
Monday test workspace 3190615, and Supabase staging. It covers:
- the jobs list and job page;
- the write path, including all four places a completion lands;
- the review queue;
- the mirror, findings, Sync health and the digest;
- file sync;
- the pipeline and board moves.

**How it was tested:**
- UAT with Alison and Shannan on 26 August, 3–4 September and 9 September.
- All fourteen decisions from 10 September (M1–M14) were built as v1.6, slices 0–6.
- The write-path suite: 405 of 405 assertions, run twice against staging. Confidentiality
  fixtures: 21 of 21.

**Not cut over.**
- The production Supabase project exists, created on 16 September for the enquiry roster, but the
  Operations module is **off** there.
- The cutover runbook was written and not executed.
- **The copy we have holds migrations up to 0067.** That is the roster branch, which ran ahead of
  `main` (which stops at 0047).

**Decisions still open at the time:**

| Question | Owner |
|---|---|
| Will Homes VIC and QLD get Monday construction and handed-over boards? | Alison |
| Repoint the handed-over boards' "Maintenance" automations, which are bound to a group that does not exist there | Alison |
| Should a milestone note also go to Monday's Updates feed, to keep the history Shannan kept by hand? | Shannan |
| Should a Titles upload set Block titled? | Shannan |
| The suburb audit, after which the capture is re-run | Alison |
| The Teams channel and webhook for the digest | Jerry |
| Fix the Sale Won Zap mapping: Buyer type, Block titled and Builder are fetched but never mapped | Jerry or Alison |
| The production HubSpot private app and token, with file scopes | Jerry, at cutover |
| The alerting channel for the circuit breaker (C11) | Pablo |

**Not built, on purpose:**
- Xero;
- notifications beyond the digest;
- Entra SSO;
- portal polling (Andre's branch);
- file versioning and VO numbering;
- creating Monday subitems or automations.

---

## 13. Gaps found in the original

These were found by reading the code for this document. **None was reproduced by running it.**
Treat each as a lead to confirm, not a fact. They matter mainly if we port the original's SQL.

**Write path:**

1. **The sync trail mislabels the stage advance.** In `set_milestone_internal` (0057 at about
   line 1585, inherited from 0056), one variable holds the HubSpot `advance_deal_stage` row's ID.
   It is then overwritten by the Monday `construction_stage` row's ID and reported as HubSpot. So
   the trail's HubSpot step shows the Monday row's status. *Verified in the SQL.* The HubSpot row
   is still sent.
2. **Rows logged in dry run are never sent later.** The claim takes only `pending` and `failed`
   rows. Turning live writes on does not replay what was recorded during watch mode. That may be
   intended, but nothing says so. *Verified.*
3. **The kill switch stops sending, not queueing.** Rows pile up as `pending` and all go out
   (after supersede) when it is released.
4. **Deterministic refusals are retried and count toward the breaker.** This covers the
   renderer's own refusals, a portal-guard failure, claim-time resolver errors, and the Monday
   "item on a third board" refusal (sent as HTTP 409, which is treated as transient).
5. **A missing completion property aborts the whole milestone save.** A missing job-field
   property only reports "not sent". The two behave inconsistently.
6. **A cleared note is lost on release.** A regression filed with an emptied note stores
   `note: null` ("not supplied"), so releasing it does not clear the note, although the filing
   audit line says it was cleared.
7. **Builder acceptance is stamped with `current_date`,** the UTC date. Before 08:00 Perth that is
   yesterday.
8. **Sale Won guard layer 1 is now empty.** After 0037 no field carries the flag the 0013
   constraint checks. Layers 2 and 3 still hold.
9. **No dead-letter re-drive, and no Xero consumer,** despite the enum and seed rows for both.

**Mirror:**

10. **The Monday mirror reads only *writable* boards.** Production boards stay read-only until a
    late cutover step, so the "watch mode" full pass would read **no Monday boards**. A
    `config:apply`, which resets `writable`, or a rollback to read-only, would silently stop the
    Monday read. The next full pass would then flag every Monday-linked job as `missing`.
    *Verified in `api.mirror_pass_start`.*
11. **A resumed full pass can report false `missing` findings.** The resumed pass skips boards (or
    the HubSpot range) already done without adding them to the "seen" list. That list is then
    treated as complete.
12. **Monday milestone findings are probably never "explained".** The explanation lookup is passed
    the parent item ID, but milestone outbox rows carry the subitem ID.
13. **"Newer" is per record, not per field.** Touching any field on a HubSpot deal or a Monday item
    makes every Launchpad-owned field on it "newer".
14. **Per-record mirror failures are nearly invisible.** They go to `mirror_runs.errors`, which
    Sync health does not show and the digest does not read, and the watermark still advances.
15. **The incremental and full crons overlap during 02:00–02:55 Perth.** No lock was found.
16. **The read-side HubSpot portal check is weaker.** The mirror checks the portal ID but not
    SANDBOX, unlike the dispatcher.

**Access and documentation:**

17. **`api.dispatch_state()` is readable by every signed-in role.**
18. `docs/ROLE-MATRIX.md` disagrees with the code on who sees sync internals. **The code wins.**
19. **Documented but not enforced:** `app_users.division` scoping.
20. **Out-of-date statements:** `CLAUDE.md` decision 1 (n8n), the 0016 header (pg_cron), and the
    Monday status-index comments.

**Config capture.** Read off the live boards, not found by any test:
- The Wealth subitem boards use **different column IDs** from Homes.
- Production lacked the Wealth stage column and the `site_state` property.

All three were fixed before cutover, but they show why rule 14 (no hardcoded IDs) exists.

---

## 14. How our prototype compares

Our Operations dashboard (`ours: src/components/modules/operations/`) is a **static rebuild of
the earlier mockup**. All its data is in memory (`ours: src/data/jobs.ts`,
`ours: src/state/launchpad-store.tsx`), and the sync is simulated on timers
(`ours: .../sync/OperationsSyncProvider.tsx`). Much of its copy comes straight from the original
app, so the shape is close. These are the places where it matches and where it does not.

### Side by side

| Original | Ours | Match |
|---|---|---|
| CRM dash sync `/jobs`: four tiles, Builder/Rep/Brand/Division filters, URL state, the 300 cap | `jobs/CrmDashSync.tsx`, `JobsTable.tsx`, `filters.ts` | **Close.** Same tiles and filters. But see "Sync needs attention" below |
| Job page: Job details (green), Deal details (grey), Precon, Construction, Files, Sync trail, Recent activity | `jobs/detail/*`: Job details, Deal details, Land and house, milestone cards, Documents, Open in, audit | **Close in layout.** No per-job outbox trail panel, and no typed Files with stated destinations |
| Milestone editor: status, builder's date, **due date**, **note**; future-date refusal; date cleared on un-complete; destination sentence | `MilestoneCards.tsx` `MilestoneEditor`: status, a free-text date, and a **Source** chooser | **Partial.** No due date, no note, no future-date rule (none found), no job-number format check, and a free-text date field |
| Review queue: four money milestones, held / proposed / live, the stale rule, reasons | `review/review.ts`, `ReviewQueueScreen.tsx` | **Matches.** The same four, the same stale rule, release and dismiss with reasons |
| Audit log | `audit/AuditLogScreen.tsx` | **Matches in intent** |
| Inbound capture, preview | `inbound/InboundCapture.tsx`, `?tab=jobs&view=inbound` | **Matches.** Also a preview |
| **Sync health** | — | **Missing** |
| Outbox line (dry run / halted / live) | — | **Missing.** Nothing in ours says whether writes are real |
| Home "My day" | `home/` | Not compared in detail |
| — | `OperationsOverview.tsx` (Overview tab) | **New in ours** |
| Submission review, Pricing, Doc formatter: Phases 4 and 6, prototype only | `submissions/`, `pricing/`, `formatter/` | **UI only, as in the original prototype.** No backend existed for these in the original either |

### Divergences to decide on

1. **"Sync needs attention" means something different.**
   - **Ours:** a Monday-versus-CRM *conflict*.
   - **The original:** writes that **gave up**, meaning dead outbox rows. Disagreements are a
     separate concept (findings) on Sync health.

   These are two different problems with two different fixes.
2. **The conflict dialog picks a side.** Ours offers "Accept Monday's value" or "Keep CRM Dash's"
   (`JobDialogs.tsx`). The original's phase plan once described a resolve flow, but V1 cut it to
   *detection only*. v1.5 replaced it with **fix it in the owning system, then dismiss the
   finding with a reason**. Picking a side lets anyone overwrite a field another system owns,
   which is exactly what decision 3 exists to prevent.
3. **We show builder claim amounts in Operations.** Ours raises a simulated Xero step and writes,
   for example, *"Xero · draft invoice for Forma, $17,500 + GST"* into the trail, toasts and audit
   (`OperationsSyncProvider.tsx` and `BUILDER_CLAIMS` in `src/data/jobs.ts`). In the original:
   - Decision 13 says builder invoicing schedules are **never displayed** in any UI.
   - Decision 12 hides Locale commission from Operations.
   - The Phase 3 plan says the milestone form tells Shannan a draft invoice will be raised, with
     **no amount shown**.

   Our editor's "this stage creates a draft invoice" note is fine. The amounts are the problem.
4. **Move to construction is a button in ours.** In the original (M4), completing **Date to site**
   *is* the move, and a portal-detected site start is a proposal in the review queue. The
   prototype kept a manual move "for exceptions" only.
5. **There is one global milestone map in ours.** `MILESTONE_HUBSPOT_STAGE` maps Key Handover to
   no stage and Maintenance to a stage, for every job. That is Homes' shape. **Wealth has a Key
   handover stage.** The original keys the map per pipeline family.
6. **"Awaiting date" is a stored status in ours** (`pendingDate`). In the original it is
   *derived*: Completed with no builder's date, so `ready_to_write` is false. Keeping it derived
   prevents a fifth status from drifting away from the rule.
7. **The stage advance promises too much in ours.** Our copy says "advancing the deal stage to X".
   The original's copy says the stage moves forward **if the deal is behind it**, because a
   completion behind the current stage moves nothing.
8. **There are no roles in ours yet.** That is deliberate: the prototype is static, and roles are
   the planned next phase. When roles arrive, the original's capability split (§11) is the
   template, **enforced in the data layer, not by hiding buttons**.

---

## 15. Decisions to make before we wire it for real

Each point gives the original's answer and a recommendation. The decision is ours.

1. **Architecture.** *Original:* mirror and serve, with an outbox, in Postgres. **Recommend
   keeping the pattern** (reads from our store, writes through an outbox with idempotency keys,
   dry run first), whatever the hosting. It is the part that made the original safe to switch on.
2. **Field ownership.** *Original:* the table in §4. **Recommend adopting it as written** and
   revisiting single fields only when Ops ask. It was settled with Alison and Shannan over three
   UAT rounds.
3. **Disagreements.** *Original:* findings, fixed at source and dismissed with a reason.
   **Recommend replacing our pick-a-side dialog** with a Sync health section and a "fix it here or
   there" link.
4. **Confidentiality.** **Recommend removing the claim amounts from Operations now**, even in the
   static prototype. Shareable artefacts cannot be recalled; the original learned this on 10
   August, when an early prototype had already been emailed to leadership.
5. **Moving to construction.** *Original:* the milestone save is the move, and a portal proposal
   is reviewed. Decide whether our manual button stays as an exception path.
6. **Who creates the Monday item.** *Original:* the Sale Won Zaps, forever. If we ever want
   Launchpad to create the item instead, the `closedwon` guard and the mirror's
   create-on-first-sight logic must be redesigned together.
7. **How the mirror receives changes.** *Original:* polling every 5 minutes, with a nightly full
   pass. Webhooks were planned and never built. Polling is simpler and was proven; decide whether
   5 minutes is fresh enough.
8. **If we reuse the original's SQL,** start with the §13 list. Items 1, 10 and 11 would bite on
   day one of a cutover.
9. **Inbound and portal polling.** *Original:* review queue rows with `source = 'portal'`, released
   through the same `set_milestone` door. Keep that contract so there is still only one door.
10. **What we measure.** *Original:* "Shannan works a full day without opening either CRM." Agree
    our own done-when before building, so "improved" has a test.

---

## 16. Where to read more in the original

| To understand | Read |
|---|---|
| The locked decisions and safety rails | `CLAUDE.md` |
| Why Phase 1, and what each phase delivers | `docs/PHASE-PLAN.md`, `docs/V1-SCOPE.md` |
| Where it got to, and what was decided on 10 September (M1–M14) | `docs/STATUS.md` |
| What Ops asked for, in their words | `docs/UAT-FINDINGS-26-AUG.md`, `-3-SEP.md`, `-9-SEP.md` |
| The demo story, and the refusals that build trust | `docs/DEMO-RUNSHEET-V1.1.md` |
| The going-live plan, in plain English | `comms/launchpad-going-live-explainer.md` |
| The cutover, step by step | `docs/RUNBOOK-production-cutover.md` |
| Precon field ownership | `docs/PRECON-FIELD-MAP.md` |
| What Zapier did and still does | `docs/ZAPIER-INVENTORY.md` |
| File sync | `docs/FILE-SYNC-SPEC.md` |
| Roles and confidentiality fixtures | `docs/ROLE-MATRIX.md` (where it disagrees with the code, the code wins) |
| Every external ID | `docs/PHASE-0-HANDOFF.md`, `config/environments/*.json` |
| The UX reference for unbuilt screens | `reference/prototype.jsx` (frozen) |
| The latest save logic | `supabase/migrations/*_0054_*` (job fields), `*_0057_*` (milestones, moves, the outbox gate) |
| The latest mirror logic | `*_0049_*` (the mirror), `*_0050_*` (Sync health, the digest), `*_0059_*` (`mirror_apply`) |
| The dispatcher | `src/lib/outbox/dispatch.ts`, `src/lib/hubspot.ts`, `src/lib/monday.ts` |
| What the tests prove | `db/tests/03_write_path_dry_run.sql` (blocks W01–W48) |
