# Supabase backend and Monday mirror: design

**Date:** 2026-10-08
**Status:** approved by Kane, 2026-10-08
**Builds on:** [Meeting3](../../Meeting3.md) rows 4 and 7, [Meeting2](../../Meeting2.md) decisions 1 and 2,
[OPERATIONS-DASHBOARD.md](../../OPERATIONS-DASHBOARD.md) (Jerry's build), the
[Employee Master Roster spec](2026-10-06-employee-master-roster-design.md)
**Touches:** Jerry's production Supabase project (his sign-off) and Andre's Monday API audit

> **Changed 2026-10-09: no Hubstaff.** Kane: "we dont have hubstaff its hubspot". Locale doesn't use
> Hubstaff, so the Hubstaff mirror is dropped: no client, pass, schedule or credentials. HubSpot stays.
> Migration `20261009000200_drop_hubstaff.sql` drops what the earlier migrations created for it: the
> Hubstaff tables, `mirror.integration_secrets`, the `staff.hubstaff_user_id` column and the
> `staff_hours_daily` view. It also narrows `sync_runs.source` to Monday and HubSpot. Read every
> Hubstaff mention below with that in mind.

## Goal

Give Launchpad a real backend in Supabase:

1. **A read-only copy of Monday**, documents included. HubSpot follows in the same pattern, and
   Hubstaff supplies hours.
2. **Tables for the data Launchpad owns**, for every module.
3. **One set of migrations and sync code** for local and production.

What Kane said:

- "lets import data from Monday to this app right now lets initiate everything I want an SQL Migration
  ready for Supabase to handle everything if you need monday API, or hubstaff API for production and
  local let me know now"

**Done by Tuesday 13 October**, the next AI huddle:

- Exclusive Land, the Sales Representative portal's My clients (with build status), Sales Manager's
  All clients and the Operations job list show real Monday data.
- Files attached in Monday are copied into Supabase Storage.
- The mirror records every Monday call it makes, so its share of the account's usage is known.
- The migrations for every module are applied, even where a screen still shows sample data.
- HubSpot's deals, contacts and meetings are mirrored too, if the rotated token arrives in time.

## Decisions

What was agreed in the conversation:

| Question | Decision |
| --- | --- |
| Where do the migrations run? | **Our own schemas,** `mirror` and `launchpad`, which never touch Jerry's `app`, `config`, `core`, `ops`, `api` or `hr`. A new Supabase project in Sydney for development now. In production the same migrations go into Jerry's `locale-launchpad-prod`, with his agreement. |
| Who owns Exclusive Land lots? | **Monday lots, Launchpad holds.** Alison keeps adding lots on the Monday board and the mirror picks them up. Holds, the queue and sold status belong to Launchpad. Lots can become Launchpad-owned later without a migration. |
| What runs on real data by the 13th? | **Schema for everything, four screens wired:** Exclusive Land, My clients, All clients, and the Operations job list with documents. Other modules keep their sample data until later. |
| Can the dev project hold real client data? | **Yes.** Dev mirrors production Monday, because Exclusive Land has no test board. It is treated like production: the AI team only, and never connected to a preview deployment. |

From the meetings and standing rules:

| Rule | Source |
| --- | --- |
| Nothing writes to Monday or HubSpot. | Meeting3, decision 2 |
| Monday allows the account 10,000 calls a day, and about 44,000 were used on 6 October. Pro's limit is soft today; a hard block from 2027 is reported by one third party and is unconfirmed. | Meeting3; Monday's rate-limit docs |
| **Going over 10,000 a day is acceptable.** The mirror still reads frugally, and its cap only guards against a runaway loop. | Kane, 8 October |
| Data stays in Australia: Supabase `ap-southeast-2`. | OPERATIONS-DASHBOARD.md §3 |
| The repo is public. Migrations carry schema and vocabulary only. Mirrored data, board and column ids, and secrets never enter git. | Standing rule |

Out of scope:

- **Any write to Monday or HubSpot.** That includes Dash Sync's write side, its outbox and the review
  queue's release. They stay in Jerry's schema and on hold.
- **Monday webhooks.** They need a public endpoint and Jerry's agreement, since creating one is a write
  to Monday. Monday also doesn't say whether deliveries use the account's monthly integration actions
  (25,000 on Pro), which Locale's own automations rely on. Polling is cheap enough without them.
- **Sign-in and enforcing roles.** The tables for Admin's grants are in; RLS policies come with sign-in.
- **Wiring the other modules to the database:** HR, Employee, Accounting, Accounts, Tickets, IT, the
  Client and Developer portals, and HomeScope. Their tables are in.
- **Andre's areas:** Wealth, Finance, Lai and pgvector.
- **HomeScope's price boards.** The catalogue stays a snapshot.

## 1. Architecture

```
Monday ───(GraphQL, read token)───┐
HubSpot ──(REST, read scopes)─────┼──> sync code (this repo) ──> mirror.*  ──views──> launchpad.monday_*
Hubstaff ─(REST, org token)───────┘           │                                       │
                                              └──> Storage: monday-files              │
                                                                                      v
                                    Next.js server: loaders and actions <────> launchpad.*
                                                       │
                                    browser (no Supabase key, no direct database access)
```

- **The browser never talks to Supabase.** Next.js server code reads and writes through a Postgres
  connection. Storage is reached with the service role key, on the server only. Our schemas stay off
  Supabase's Data API, so adding them to Jerry's project changes none of his settings.
- **Only the sync code calls Monday and HubSpot.** Screens read the mirror, never the APIs.
- **Without a database the app still runs.** When `SUPABASE_DB_URL` is unset, every loader returns
  nothing and the screens use today's sample data. A clone of the public repo still works with no
  `.env`.

## 2. Projects and environments

| | Local (development) | Production |
| --- | --- | --- |
| Supabase | A new project in Sydney | Jerry's `locale-launchpad-prod` (Sydney), new schemas only |
| `LAUNCHPAD_ENV` | `local` | `production` |
| Monday | Production Monday, read only, run by hand | The same account, on a schedule |
| Hubstaff and HubSpot | Locale's organisation and production portal, read only | The same |

**Dev holds real data** (agreed above). It mirrors production Monday, so treat the dev project like
production: Kane and the AI team only, and never connect a preview deployment to it. Jerry's build
mirrored only marked test items outside production; this is a deliberate difference.

**What we add to Jerry's project:**

- schemas `mirror`, `launchpad` and `launchpad_meta`;
- two private Storage buckets, `monday-files` and `launchpad-files`;
- a login role, `launchpad_app`, which owns our three schemas and has no rights on his.

`scripts/db/bootstrap.sql` creates the role and our three schemas, owned by it, with a password it
makes up and shows once. The role gets no right to create schemas of its own, and the owner manages it
with `set role` instead of inheriting its rights. The project owner runs it once in the SQL editor: Kane
in dev, Jerry in production. Everything after that connects as `launchpad_app` over TLS (the migration
runner refuses any other user), so our code can't touch Jerry's tables even by mistake. His Data API
keeps exposing only `api`.

**Environment variables.** Locally they live in `.env.local`. `.env.example` lists the names with no
values.

| Variable | Purpose |
| --- | --- |
| `LAUNCHPAD_ENV` | `local` or `production` |
| `SUPABASE_DB_URL` | Connection string for `launchpad_app` (Supavisor pooler, transaction mode). Server only |
| `NEXT_PUBLIC_SUPABASE_URL` | The project URL, for Storage |
| `SUPABASE_SERVICE_ROLE_KEY` | Storage uploads, buckets and signed downloads. Server only |
| `MONDAY_API_TOKEN` | The read token (section 4.5) |
| `MONDAY_DAILY_CALL_CAP` | A guard against a runaway loop, not a budget: 5,000 by default, 2,000 locally |
| `HUBSTAFF_TOKEN`, `HUBSTAFF_ORG_ID` | An organisation access token (`hsoat_…`) or a personal access token |
| `HUBSPOT_TOKEN`, `HUBSPOT_PORTAL_ID` | A read-scoped private app token, and the portal it must reach |
| `CRON_SECRET` | The bearer secret for scheduled routes |

The values committed in `15676f1` come out of `.env.example`, and the tokens behind them are rotated
(section 7).

## 3. Migrations

**Files** live in `supabase/migrations/`, named as the Supabase CLI names them
(`<timestamp>_<name>.sql`), one file per area.

**`npm run db:migrate`** (`scripts/db/migrate.ts`) applies them over `SUPABASE_DB_URL`:

- in order, each in its own transaction;
- recording each in `launchpad_meta.migrations` (version, name, checksum, applied at). That table is
  ours, not the CLI's history, so it can't clash with Jerry's;
- refusing to run when an applied file has changed since.

`npm run db:status` lists applied and pending files. No Docker or Supabase CLI is needed, and the same
SQL can be pasted into the SQL editor.

**Conventions:**

- **Vocabularies** are text columns with `check` constraints, not Postgres enums, so they can grow
  without `alter type`.
- **Keys:**
  - `uuid` from `gen_random_uuid()` for rows Launchpad creates, except append-only logs such as `audit_log`, which take an identity;
  - staff keep today's text ids (`jan-kane-reroma`);
  - Monday and HubSpot rows keep their own numeric ids.
- **Timestamps:** rows that people create and edit carry `created_at` and `updated_at`, kept by one
  `launchpad.touch_updated_at()` trigger. Append-only rows (logs, replies, events, reads) carry their own
  time column, and mirror rows carry `synced_at` and the source's own times.
- **Money** is `numeric(12,2)`, in AUD unless a `currency` column says otherwise (staff pay can be in PHP).
- **Row level security on every table, with no policies yet,** and `revoke all` from `public`, `anon`,
  `authenticated` and `service_role` on all three schemas. Only `launchpad_app`, which owns the tables, reaches the
  data. The service role is used for Storage only and is granted nothing in our schemas.
- **Data in migrations:** only vocabularies already in the repo, such as department ids and field keys.
  People arrive by a seed script. Mirrored data never appears in a migration.

## 4. The Monday mirror

### 4.1 Tables (`mirror`)

| Table | Holds |
| --- | --- |
| `monday_workspaces` | id, name, `sync_enabled` |
| `monday_boards` | id, workspace, name, type (board or subitems board), state, and `parent_board_id` on a subitems board. Our labels: `board_key` (e.g. `homes_sales_wa`), `purpose` (sales, construction, handed_over, exclusive_land, models, other), division, region and `sync_enabled` |
| `monday_columns` | board, column id, title, type (column settings come with the first screen that needs them) |
| `monday_groups` | board, group id, title, position, archived |
| `monday_items` | id, board, group, `parent_item_id` on subitems, name, state (active, archived, deleted), creator, Monday's created and updated times, **`column_values` as JSON keyed by column id**, and `removed_at` |
| `monday_updates` | an item's updates: body, creator, times |
| `monday_assets` | one row per file: asset id, item, column or update, name, extension, size, `storage_path`, `sha256`, `downloaded_at` and `download_error` |
| `monday_users` | id, name, email, enabled |
| `monday_fields` and `monday_field_map` | our field vocabulary (`job_number`, `sales_rep`, `milestone_status` and so on) and, per board, the column that holds each field |

Each column value is stored as Monday returns it:

- `type`, `text` and the parsed `value`;
- plus what the typed fragments add: a status's `label` and `index`, a date's `date`, a file column's
  assets, a connect column's `linked_item_ids` and a mirror column's `display_value`.

**The field map is data, not code.** `npm run mirror -- setup` fills it:

- **The eight job boards** from Jerry's `config/environments/monday.json`, read from the sibling folder
  on Kane's machine and never copied into git.
- **Exclusive Land** by column title. Kane confirms it once the board is shared with him.
- **Anything else** by hand, in SQL.

### 4.2 Typed views (`launchpad`)

| View | One row per | Main columns |
| --- | --- | --- |
| `monday_jobs` | parent item on a sales, construction or handed-over board | item id, board key, purpose, division, region, group, deal name, job number, site address, suburb, state, sales rep (text), builder, buyer type, block titled, title due date, sale won date, construction stage, HubSpot deal id, updated at |
| `monday_job_milestones` | subitem of a job | item id, job item id, name, status label, due date, date completed, people, notes, file count |
| `monday_job_files` | file on a job or a milestone | asset id, job item id, milestone item id, name, size, storage path |
| `monday_land_lots` | item on the Exclusive Land board | item id, and the lot fields once its columns are mapped |

### 4.3 How it reads

Every request pins `API-Version: 2026-10`, the current version. Jerry's reader still sends `2026-07`.

| Pass | When | What it asks Monday | Calls |
| --- | --- | --- | --- |
| `discover` | once, then on demand | workspaces, boards, columns, groups, users | about 5 |
| `backfill` | once per board | `items_page` with every column value and inline file assets, then `next_items_page`. The page size (up to 500) comes from the first page's measured complexity, and each board finishes within the cursor's 60-minute life. Updates are paged per board | (items + subitems) ÷ page size: 100 to 400, once |
| `changes` | every 5 minutes | **one** `activity_logs(from: watermark − 2 minutes)` request across every synced board and subitems board, then `items(ids:)` at 100 per call for the items it names. Delete and archive events mark rows removed | 300 to 450 a day |
| `safety` | daily | per board, `items_page` filtered to `__last_updated__` TODAY or YESTERDAY, asking only for ids and `updated_at`; anything that differs is refetched | about 20 a day |
| `sweep` | weekly | every board's ids and `updated_at`, 500 a page. Anything gone is marked removed, anything newer refetched | 60 to 100 a week |
| `files` | after `backfill` and `changes` | finds new asset ids in file columns and updates, gets fresh temporary URLs (valid 1 hour) from `assets(ids:)` 50 at a time, and downloads each file into `monday-files` | 1 per 50 new files |

**Expected spend is about 350 to 550 calls a day** at a 5-minute cadence. Jerry's pattern re-walks every
board at the same cadence, an estimated 7,000 to 12,000 a day once his production boards are switched
on.

What keeps it correct and cheap:

- **Activity logs are a hint.** Monday doesn't document the keys inside an entry's `data`. The parser
  reads `pulse_id` (and `parent_item_id` for subitems) where present, and skips entries it can't
  place. `safety` and `sweep` catch whatever it misses.
- **The watermark moves only after a pass finishes.** Every write is an upsert on Monday's ids, so a
  repeated pass does no harm. If the activity log is still full after the page cap, the pass also runs
  the safety check on those boards, and the run is logged as partial.
- **Subitems boards are read too,** because Monday may not log subitem edits on the parent board.
- **Timezones.** `__last_updated__` TODAY follows the token user's timezone; TODAY and YESTERDAY
  together always cover the last 24 hours.
- **Files are kept by asset id,** which never changes. Temporary URLs are never stored. A file over the
  bucket's size limit keeps its row, with `download_error = 'too_large'`.
- **Mirror and formula columns.** Mirror columns are joined in SQL through `linked_item_ids`. Formula
  columns aren't fetched.

### 4.4 Counting calls

- **Counting.** `mirror.api_calls` counts calls per source per UTC day; Monday's day resets at 00:00
  UTC. `mirror.record_api_call(source, n, cap)` adds to the count atomically and says whether the cap
  still has room. The client calls it before every request and stops the pass at the cap. The cap is
  there to stop a bug from looping, not to ration normal use.
- **Complexity.** Every request also asks for `complexity { query after reset_in_x_seconds }`, which
  costs nothing extra. It is logged on the run, and the client waits for the minute budget to reset
  when it runs low.
- **Errors.** `DAILY_LIMIT_EXCEEDED` stops every pass until 00:00 UTC: the ledger refuses every Monday
  call for the rest of that UTC day. Other rate-limit errors are retried after `retry_in_seconds`. Monday
  charges each retry a tenth of a call; the ledger counts every attempt as a whole call, so it errs high.
- **The run log.** `mirror.sync_runs` records each pass: source, mode, trigger, times, status, calls,
  complexity, records seen and changed, the watermark before and after, and any error.
- **One at a time.** One pass per source runs at once, under a lease row in `mirror.sync_locks` that
  expires on its own. A session advisory lock wouldn't survive Supabase's transaction pooler. The files
  pass has a lease of its own, so a long download doesn't hold up `changes`.

### 4.5 Read only

- **Code.** The Monday client exposes one function, `mondayQuery()`. It refuses any document that
  contains a `mutation` operation, and a test proves it.
- **Token.** Monday's personal tokens carry every permission the user has. The preferred token
  therefore comes from a **private Monday app** granted only `boards:read`, `updates:read`,
  `assets:read`, `users:read` and `workspaces:read`, so Monday itself refuses writes. The fallback is a personal
  token from an account that can read every board we need.
- **Database.** The mirror has no outbox, and nothing in this repo calls a Monday or HubSpot write
  endpoint.

## 5. HubSpot and Hubstaff

**HubSpot** is built after Monday, and before the 13th if the rotated token arrives.

- **Tables:**
  - `mirror.hubspot_objects`: object type, id, properties as JSON, associations, archived, and
    HubSpot's created and modified times;
  - `mirror.hubspot_owners`;
  - `mirror.hubspot_pipelines`, with their stages.
- **Objects:**
  - deals in every pipeline, because the Sales pipeline needs deals before Sale Won and Exclusive Land
    has its own pipeline;
  - contacts;
  - meetings, for appointment outcomes;
  - notes.
- **First load:** the same search the updates use, from the beginning, 200 a page.
- **Then every 10 minutes:** the search API on `hs_lastmodifieddate` (`lastmodifieddate` for contacts),
  from the watermark minus 5 minutes, ascending, 200 a page. Before reaching 10,000 results, the search
  restarts from the last timestamp seen.
- **Associations:** batch-read for the deals each pass changed. Re-reading open deals nightly, for
  associations that change without touching the deal, comes later.
- **Portal guard:** before anything is read, a check confirms the token reaches `HUBSPOT_PORTAL_ID`.
- **Limits:** HubSpot's daily limits (250,000 calls and up) aren't a concern. The search API's 5
  requests a second sets the pace.

**Hubstaff:**

- **Tables:**
  - `mirror.hubstaff_members`;
  - `mirror.hubstaff_daily_activities`: per user, project and day, the tracked, overall, idle, manual
    and billable seconds.
- **Daily:** `/v2/organizations/{id}/activities/daily/updates` from the last run minus an hour, plus
  members. A one-off backfill reads the last three months, 31 days at a time.
- **Token:**
  - An **organisation access token** (`hsoat_…`) is used as it is, with no refresh to store.
  - A personal access token also works, through HRIS's exchange-and-rotate pattern. The latest refresh
    token is kept in `mirror.integration_secrets`. Each environment then needs its own personal token,
    because every refresh invalidates the one before.
- **The view `launchpad.staff_hours_daily`** joins members to staff through `staff.hubstaff_user_id`.
  Setup fills it by email match where the emails agree and lists the rest, to be set by hand. Today's
  staff emails are placeholders, so expect most to need setting.

## 6. Launchpad's own tables (`launchpad`)

| Area | Tables |
| --- | --- |
| People | `departments` (the roster's 8: leadership, finance, sales, marketing, operations, it, accounting, executive), `staff` (one row per seat with the roster's work fields, plus `hubspot_owner_id`, `monday_user_id` and `hubstaff_user_id`), `staff_aliases` (other spellings of a name, such as Monday's sales rep text), `pay_rates` (dated), `one_off_payments` |
| Access | `app_users` (a sign-in: a staff member or an off-roster email), `modules`, `module_sections`, `role_grants`, `section_access` (hidden, view or edit) |
| Leave | `leave_requests` (type, dates, days, note, status, approver, decision), `leave_allowances` |
| Staff pay | `payment_methods`, `invoice_senders`, `staff_invoices`, `staff_invoice_lines`, `invoice_alerts` |
| Accounting | `pay_runs` (date, AUD to PHP rate, totals), `pay_run_invoices`, `pay_run_holds`, `payouts`, `payout_invoices` |
| Accounts | `builder_invoices`, `expense_claims` |
| Sales | `weekly_forecasts`, `sales_targets`, `commission_rules`, `discount_approvals`, `todos` |
| Exclusive Land | `land_lots`, `land_holds` (section 6.1) |
| Submissions | `submissions`, `submission_documents` (one per checklist item: file, dated, state, fix note, who verified) |
| HomeScope | `quotes` (a number from a sequence, `prepared_by` required, the estimate as JSON, totals, PDF options), `homescope_catalogues` (one current snapshot per builder, as JSON) |
| Tickets | `ticket_projects`, `tickets`, `ticket_replies`, `ticket_events`, and `it_tickets` (category and description kept apart, `kind` request, incident or idea, `source` portal or email) |
| Portals | `portal_updates`, `portal_update_photos`, `portal_messages`, `portal_message_reads`, `client_consents` |
| Everywhere | `notifications` (recipient, kind ok or red, event, message, link, `dedupe_key`, read and resolved), `audit_log`, `announcements`, `knowledge_materials` |

Uploaded files, such as submission documents, receipts and photos, go in `launchpad-files`. The tables
keep the path.

**People arrive by seed.** `npm run db:seed` loads departments and staff, with the same ids, from the
app's own org data. Today that is `ORG_SEED`, with `ai` read as `it` and `accounts` as `accounting`;
once its branch merges, it is the Employee Master Roster. Staff rows carry the work fields the app
already shows. Birthdays, folder links and remarks stay out.

### 6.1 Exclusive Land

**`land_lots`** holds:

- `monday_item_id` (unique), and `source`: `monday` now, `launchpad` later;
- lot label, street, suburb, state, estate, developer;
- builder, where empty means any builder;
- land and package prices, design, area, frontage, zoning;
- title status (titled, untitled or delayed) and title ETA, plus a rebate note;
- Monday's own status label, and `monday_removed_at`;
- `sale_status` (available, sold or withdrawn), and when, by whom and for whom it sold.

**`launchpad.sync_land_lots_from_monday()`** runs after each Monday pass:

- A new item becomes an available lot.
- While `source = 'monday'`, descriptive fields follow Monday.
- Sale status doesn't follow Monday. Launchpad owns it from the cutover.
- When an item disappears from Monday, its lot is withdrawn. If a hold is active, the lot stays open
  with `monday_removed_at` set for the maintainer to see.

**`land_holds`** holds the lot, rep, client and note, plus `queued_at`, `started_at`, `expires_at`
(started plus 24 hours), `ended_at` and an outcome (lapsed, released, left queue, converted, lot sold,
lot withdrawn).

**The rules are SQL functions.** Each locks the lot's row, so two reps can't take the same hold:

- **`place_hold(lot, rep, client, note)`.** The lot must be available. It takes at most 3 open holds
  (the active one plus the queue), and a rep can have only one of them. The first open hold starts at
  once; later ones queue.
- **`release_hold(hold)`** ends a hold and starts the next in the queue.
- **`mark_lot_sold(hold)`** is the active holder's Deposit received. It ends the queue.
- **`settle_land_holds()`** ends expired holds, starts the next with a fresh 24 hours, and notifies
  that rep. Every hold function calls it first, and a schedule runs it every 5 minutes. A late schedule
  therefore never leaves a lapsed hold standing.

**Cutover.** At the first import, a lot Monday shows as sold is sold, and everything else is available.
Holds already placed in Monday aren't carried over (Open points).

## 7. Security

**Rotate the leaked tokens first.** Commit `15676f1` put a Monday personal token and most of a HubSpot
token in `.env.example`, which is on the public remote.

- **Monday:** Profile picture › Developers › API token › Regenerate. An admin can also do it under
  Administration › Connections. GitHub's secret scanning doesn't cover Monday, so nothing has revoked
  it.
- **HubSpot:** Development › Legacy apps › the app › Auth › Rotate, with "expire now". HubSpot
  deactivates tokens that GitHub finds, but this one was partly cut off, so don't count on that.

**Other safeguards:**

- **A local secret check.** `npm run check:secrets` scans staged files for Monday, HubSpot, Hubstaff and
  Supabase token patterns. A pre-commit hook in `.githooks/` runs it; enable it once per clone with
  `git config core.hooksPath .githooks`.
- **RLS on, nothing granted** (section 3). The browser holds no Supabase key.
- **A deployment with live data must be protected.** There's no sign-in yet, so anyone who reaches the
  app sees real client data and can place holds; Server Actions are reachable by a direct POST. Until
  sign-in exists, any deployment pointed at a database sits behind Vercel Deployment Protection (team
  members only) or isn't deployed at all.
- **Files** download through signed URLs that the server makes and that last 5 minutes.
- **No mirrored data in git,** fixtures included. Tests use invented items.

## 8. The four screens

All four keep their current components:

- A loader in `src/server/read/` maps database rows to the types the screens already use (`LandLot`,
  `Job`, `Milestone`).
- The dashboard layout loads them once per page load and passes them in as initial state; moving
  between screens reuses them.
- With no database, the loaders return nothing and the sample data stays.

| Screen | Reads | Writes |
| --- | --- | --- |
| Exclusive Land (Sales Manager and Sales Representative) | `land_lots` and open `land_holds` | server actions calling the hold functions; the screen redraws from what they return |
| My clients (Sales Representative) | `monday_jobs` where the sales rep is the viewer | none |
| All clients (Sales Manager) | `monday_jobs`, grouped by rep | none |
| Operations job list and job page, with documents | `monday_jobs`, `monday_job_milestones` and `monday_job_files` | none. Editing is switched off while live data shows, under a note: "Live from Monday, read only during the Dash Sync hold" |

**Which jobs.** The live list holds jobs on the sales and construction boards. Handed-over jobs stay in
the mirror but out of the screens, which keeps each page's payload small.

**Who is viewing.** Until sign-in exists, the live screens get a "Viewing as" picker of Sales staff,
kept in the URL (`?as=<staff id>`). It picks the rep whose clients My clients shows and in whose
name a hold is placed. Screens still on sample data (My pipeline, My progress, My week) keep the
sample rep until HubSpot is wired.

**Matching reps.** Monday's sales rep column is free text. It matches a staff member by full or
preferred name, then through `staff_aliases`. `npm run mirror -- setup` lists the names it can't
match.

## 9. Running it

- **Locally:** `npm run mirror -- <discover|setup|backfill|changes|safety|sweep|files|status>`. Add
  `--board <key>` and `--max-calls <n>` to keep a run small.
- **In production:** `GET /api/mirror/[source]?mode=…` with `Authorization: Bearer $CRON_SECRET`, plus
  `/api/land/settle`.
  - On Vercel Pro these are Vercel crons.
  - On any other host, or a Vercel plan with only daily crons, Supabase's `pg_cron` and `pg_net` call
    the same routes.
  - The host is still to be chosen (Open points).

## 10. Testing

**The SQL** runs in-process on PGlite (Postgres compiled to WebAssembly) inside `npm test`, with a
small shim for Supabase's roles and no Docker. The tests apply every migration, then check that:

- every table has RLS on, and `anon` and `authenticated` have no privileges;
- the hold rules hold:
  - one active hold per lot, a queue of 3, one hold per rep;
  - lapse and promotion, with a fresh 24 hours;
  - only the holder sells, and a sold lot takes no holds;
- `record_api_call` stops at the cap;
- the typed views turn invented items and a field map into the right job, milestone and lot rows;
- `sync_land_lots_from_monday()` adds new lots and leaves Launchpad's sale status alone.

**The sync code** gets unit tests against recorded, invented responses for:

- the mutation guard;
- normalising column values;
- parsing activity logs: 17-digit times, and events to item ids;
- the row mappers.

**Against the dev project:**

1. Run `discover`, then `backfill` on one board.
2. Compare the item counts with Monday, and the calls with the ledger.
3. Leave `changes` running for a day and check the day's total stays inside the budget.

## 11. Rollout

1. **Kane:** rotate the Monday and HubSpot tokens.
2. **Kane:** create the dev Supabase project in Sydney, run `bootstrap.sql`, and put the URL, service
   role key and `launchpad_app` connection string in `.env.local`.
3. **Kane and Jerry:** the Monday read token (a private app if possible). Jerry shares the Exclusive
   Land board.
4. **Build:** migrations, runner and tests, applied to dev.
5. **Mirror:**
   - run `discover`, then `setup`; Kane confirms the Exclusive Land field map and the unmatched reps;
   - run `backfill`;
   - switch on `changes`.
6. **Screens:** wire the four.
7. **Production:**
   - with Jerry's agreement, he runs `bootstrap.sql`;
   - the migrations go in;
   - the variables are set on the host and the routes scheduled.
8. **13 October:** demo on production, or on dev if production isn't ready, with the call ledger on
   screen.

**For Andre's audit.** Our share of Monday's calls is in `mirror.api_calls` and `mirror.sync_runs`. The
quickest way to find the 44,000 is Monday's API analytics page (Administration › Usage stats › API),
which shows the top six users and apps. A Monday admin can open it today.

## Open points

- **The production host,** and how routes are scheduled: Vercel Pro crons or Supabase `pg_cron`.
- **Jerry's agreement** to add our role, schemas and buckets to `locale-launchpad-prod`, and who holds
  its keys. Later, his Dash Sync could read Monday from `mirror` instead of calling it, which would
  make this the only Monday reader.
- **The Monday token:** a private read-only app or a personal token, and from whose account.
- **Holds already in Monday at cutover.** Recommended: announce a cutover time to the reps and Alison,
  after which a rep re-places any Monday hold in Launchpad. Also to decide: whether a lot that Monday
  later marks sold should override Launchpad.
- **Reps' names** that Monday spells differently from the roster. Kane confirms the alias list that
  setup prints.
- **Hubstaff:** which staff track time in Locale's organisation, and whether an organisation access
  token is possible.
- **Storage.** Monday's file volume is unknown. Check the project's Storage allowance before the files
  backfill.
- **HubSpot:** the rotated token's portal and scopes.
- **Git history.** The leaked values stay in the public history after the file is fixed. Rotating is
  what protects; rewriting history is optional.
