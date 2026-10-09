# Locale Launchpad

Locale Property Group's internal platform, rebuilt in **Next.js 16** from the static
prototype in `Reference/locale-launchpad 1.html`.

It keeps the prototype's modules and content, but reworks the UI to follow **Simple HRIS**:
the same shell (collapsible rail, mobile drawer), KPI cards, tabs, dialogs and motion. It uses
**Locale's brand** for colour, type and logo, from `Reference/Logos & Fonts`. Light and dark mode
are both supported.

> **Sample data by default.** With no `.env.local`, every figure comes from `src/data/` or an
> in-memory store and a reload resets the demo. With a Supabase database connected, Exclusive
> Land, My clients, All clients and the Operations job list show live Monday data (read only);
> everything else keeps its sample data. There's no sign-in or RBAC yet, so a deployment with
> live data must sit behind Vercel Deployment Protection.

## Run it

```bash
npm install
npm run dev      # http://localhost:3000, or the next free port if 3000 is taken (see the terminal)
npm run build    # production build (stop the dev server first — they share .next/)
npm run lint     # type-check
```

Requires Node 20.9+.

## Live data (Supabase)

Spec: `docs/superpowers/specs/2026-10-08-supabase-mirror-design.md`. Monday and HubSpot are only
ever read; nothing writes back while the Dash Sync go-live is on hold.

### One-time setup

For a Supabase project (Sydney):

1. In the SQL editor, as the project owner, run `scripts/db/bootstrap.sql`. It creates the login
   `launchpad_app` and the three schemas it owns, and shows the login's password once: copy it
   straight away. Every check column in its result should read true.
2. Copy `.env.example` to `.env.local` and fill it in. `SUPABASE_DB_URL` is the transaction pooler
   string for the user `launchpad_app.<project-ref>`, with that password. Migrations refuse any
   other user.
3. To look at our tables in the SQL editor, run `set role launchpad_app;` first: the owner can
   act as it, but doesn't read its tables otherwise.
4. Then:

```bash
npm run db:status           # should say "connected as launchpad_app (login launchpad_app)", then list what is pending
npm run db:migrate          # applies supabase/migrations
npm run db:seed             # staff and department heads from the org chart
npm run mirror -- buckets   # the private Storage buckets
npm run mirror -- discover  # optional: the workspaces the Monday token can see (--workspace <id> adds one's boards)
npm run mirror -- setup     # Locale's Monday boards, mapped from Jerry's config next door
npm run mirror -- backfill --board homes_sales_wa --max-calls 50   # a small first run
npm run mirror -- backfill  # then everything
npm run mirror -- reps      # match Monday's sales rep names to staff
npm run mirror -- files     # copy Monday's files into Storage
npm run mirror -- hubspot   # HubSpot's owners, pipelines and what changed since last time
npm run mirror -- status    # boards, items, files, today's calls, recent runs
```

`setup` reads Jerry's config from the folder next to this repo; `--jerry-config <path>` points it
elsewhere. `status` lists the board keys that `--board` takes.

`npm run check:secrets` scans staged files for tokens, because the repo is public. Enable it as a
pre-commit hook once per clone with `git config core.hooksPath .githooks`.

### Keeping it current

After that, `changes` (every 5 minutes), `files` (every 15), `safety` (daily) and `sweep` (weekly)
keep Monday current. `hubspot` does the same for HubSpot. In production the routes under
`/api/mirror/*` and `/api/land/settle` run them on a schedule, with
`Authorization: Bearer $CRON_SECRET` (Vercel sends it itself once `CRON_SECRET` is set in the
project). On Vercel Pro, add these to `vercel.json`:

```json
{
  "crons": [
    { "path": "/api/mirror/monday?mode=changes", "schedule": "*/5 * * * *" },
    { "path": "/api/mirror/monday?mode=files", "schedule": "*/15 * * * *" },
    { "path": "/api/mirror/monday?mode=safety", "schedule": "30 18 * * *" },
    { "path": "/api/mirror/monday?mode=sweep", "schedule": "0 19 * * 0" },
    { "path": "/api/mirror/hubspot?mode=changes", "schedule": "*/10 * * * *" },
    { "path": "/api/land/settle", "schedule": "*/5 * * * *" }
  ]
}
```

The times are UTC: 18:30 is 02:30 in Perth.

Elsewhere (or on Vercel Hobby), `scripts/db/schedule-pg-cron.sql` schedules the same calls from
Supabase. It is optional, and in a project someone else owns it is their call: ask first.

### Deploying

- **Protect it.** There is no sign-in yet, so anyone who reaches a deployment with live data sees
  real client data and can place holds. Put it behind Vercel Deployment Protection, check that it
  covers the production domain as well as preview URLs, and never point a preview deployment at the
  dev database: it holds real data.
- **Monday's files open by their numeric id.** Until sign-in exists, anyone who can reach the app
  can open any copied Monday file at `/api/files/monday/<id>`. The download route serves every file
  on every mirrored board, so enable syncing only on the boards Launchpad should show. `setup`
  turns it on for Locale's boards and no others (`sync_enabled` on `mirror.monday_boards`).
- **Set the variables for the build as well.** Set `SUPABASE_DB_URL` (and the other server
  variables in `.env.example`, with `LAUNCHPAD_ENV=production`) for the build as well as at
  runtime. A build without it prerenders the sample-data shell, and the deployment then serves
  sample data. With it set, every dashboard route renders per request, and each full page load
  waits for the database: about 10 s at most (`connect_timeout`) when the database can't be
  reached, before sample data shows.
- **Run it next to the database.** Add `"regions": ["syd1"]` to `vercel.json` to run the app's
  functions in Sydney. Each page load reads the database several times.

### When something goes wrong

- **Look at our tables in the SQL editor.** Run `set role launchpad_app;` first. The statements
  below that change data run as `launchpad_app` too.
- **Files that never copy.** A file that fails to copy three times is retired (`download_error` is
  set), and a Storage outage can retire some that were fine. To put them back in the queue, run
  this as `launchpad_app`. Files over the 50 MB limit (`too_large`) stay as they are.

  ```sql
  update mirror.monday_assets set download_attempts = 0, download_error = null where download_error is not null and download_error <> 'too_large';
  ```

- **A run shows as "stale (no end recorded)" in `status`.** Its end couldn't be written. The lease
  frees itself when it expires, so nothing is needed unless it keeps happening.
- **`reps` lists names with "no single staff match".** Expect a long list on the first run. Add one
  alias for each, as `launchpad_app`, then run `reps` again to see what is left. To find a staff
  id, run `select id, name from launchpad.staff order by name`.

  ```sql
  insert into launchpad.staff_aliases (alias, staff_id) values (lower(btrim('<the name exactly as Monday has it>')), '<staff id>');
  ```

- **"SUPABASE_DB_URL isn't a valid connection string".** Check the port, and URL-encode any `@`,
  `#`, `/` or `:` in the password.
- **HubSpot.** `HUBSPOT_TOKEN` is a private app's token (it starts with `pat-`) with read scopes
  only. "HUBSPOT_TOKEN reaches portal X, not HUBSPOT_PORTAL_ID" means the token belongs to another
  HubSpot account. The first HubSpot load is quickest from the CLI (`npm run mirror -- hubspot`).
  After that, the schedule keeps it current.
- **A flag is refused.** `--max-calls`, `--max-files` and `--workspace` take positive whole
  numbers. A command refuses a flag it doesn't take, so a typo can't quietly widen a run:
  `--board` belongs to `backfill`, `changes`, `safety` and `sweep`, `--max-files` to `files`,
  `--workspace` to `discover`, and `hubspot` takes none.
- **A scheduled call fails.** Its response says why. A 401 `Unauthorized` means the bearer secret
  doesn't match `CRON_SECRET` on the host, and a 503 `No database is configured` means
  `SUPABASE_DB_URL` isn't set there. An answer that isn't our JSON, such as Vercel's sign-in page,
  is Deployment Protection stopping the call before it reaches the route. The Supabase-side
  schedule then needs Vercel's Protection Bypass for Automation secret, sent as an
  `x-vercel-protection-bypass` header on each job.

## Modules

Each module is its own **dashboard**. Its sections are listed in its sidebar, and "Switch view"
in the sidebar moves between dashboards, the way it does in HRIS. Every dashboard has **Jarvis**,
an assistant bubble (bottom-right) with three FAQ questions about that dashboard.

| Route | Dashboard | Sidebar sections (`?tab=`) |
| --- | --- | --- |
| `/` | Home | — |
| `/operations` | Operations | `jobs` (CRM Dash Sync) · `submissions` · `pricing` · `formatter` |
| `/operations/jobs/[id]` | Job detail | — |
| `/sales` | Sales Manager (the team's view) | `pipeline` · `clients` · `build` · `costing` · `land` · `team` |
| `/marketing` | Marketing | `performance` · `channels` · `attribution` |
| `/finance` | Finance | — |
| `/accounts` | Accounts | `invoicing` · `reports` · `expenses` |
| `/accounting` | Accounting | `payrun` (Pay run: Rate → Invoices → Validation → Dispatch) · `history` |
| `/wealth` | Wealth | — |
| `/hr` | HR | `dashboard` · `people` · `attendance` · `leave` · `recruitment` · `performance` · `assets` |
| `/knowledge` | Knowledge | — |
| `/leadership` | Leadership | `overview` · `custom` |
| `/it` | IT | — |
| `/tickets` | Tickets | `board` · `projects` · `archived` (filters `&dash=` · `&project=` · `&priority=`; `&ticket=` opens one). `/projects` redirects to `projects` |
| `/notifications` | Notifications inbox | — |
| `/client` | Client portal | `finance` · `options` · `build` · `documents` · `messages` |
| `/developer` | Developer portal | `clients` · `updates` · `insights` · `products` · `terms` |
| `/employee` | Employee portal | `invoices` (`&view=new` · `history`) · `profile` · `department` |
| `/consultant` | Sales Representative portal (one consultant's own) | `pipeline` · `clients` · `week` · `progress` · `submissions` |

Sections live in the URL, so Home's shortcuts deep-link (for example `/hr?tab=leave`). Doc
formatter's views (`&view=`) and Knowledge's categories (`?cat=`) are sidebar items too.
Collapse the sidebar with its pull-tab or Ctrl+B / ⌘B.

Every staff dashboard, and the Employee portal, has **Suggest an improvement** under Feedback in its
sidebar. It raises a ticket on the Tickets board against that dashboard without leaving the page.

## Layout

```
app/
  layout.tsx               fonts (Manrope, plus Libre Baskerville for the one accent word), theme, toaster
  (dashboard)/layout.tsx   store + shell, stays mounted across navigation
  (dashboard)/template.tsx page-enter animation
  (dashboard)/<module>/    one route per module
src/
  components/ui/           shared primitives: KpiCard, Card, SlidingTabs, Dialog, Pill, Table, …
  components/shell/        dashboards + their sidebars, view switcher, switch loader, Jarvis, app shell
  components/modules/      one folder per module
  state/launchpad-store.tsx  shared in-memory state (jobs, audit log, notifications, submission)
  data/                    jobs and seed data, extracted verbatim from the prototype
  styles/globals.css       Locale tokens, dark theme, motion and reduced-motion rules
public/brand/              Locale master logo and sticker (from the brand kit)
docs/UI-GUIDE.md           the design system: tokens, components, motion, porting rules
```

## Brand

- **Colour:** Charcoal `#323232`, Granite `#737373` and Silver `#F2F2F2` are the master brand.
  The three sub-brand tints are Haven Green `#9CE3DB` (Homes, and the Launchpad accent),
  Nectar `#F7D4B7` (Financial) and Sky Blue `#C8D5F5` (Wealth).
- **Type:** one face, Manrope, for headings, body and IDs alike, the same as the sidebar. The
  only exception is the brand accent word, Libre Baskerville Italic, on Home's greeting.
  Both fonts are self-hosted from the brand kit.
- **Logo:** the Locale Property Group master logo sits in the rail. When the rail is
  collapsed it becomes the "L" sticker, which is also the favicon.

See `docs/UI-GUIDE.md` for the full token and component reference.
