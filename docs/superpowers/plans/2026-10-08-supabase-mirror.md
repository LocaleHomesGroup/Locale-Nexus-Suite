# Supabase backend and Monday mirror Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give Launchpad a Supabase backend: a read-only mirror of Monday (then HubSpot and Hubstaff), tables for every module's own data, and four screens (Exclusive Land, My clients, All clients, the Operations job list with documents) reading real data.

**Architecture:** Two new Postgres schemas, `mirror` (raw copies, written only by sync code) and `launchpad` (app-owned tables plus typed views over the mirror), owned by a dedicated `launchpad_app` login so they can sit beside Jerry's schemas in production. Next.js server code reaches them through one small `Db` interface (postgres.js in the app, PGlite in tests); the browser never holds a Supabase key. The Monday sync is TypeScript in this repo, run by `npm run mirror` locally and by cron-protected routes in production, reading frugally (one activity-log request per pass, then only what changed).

**Tech Stack:** Next.js 16.3 (App Router, no Cache Components), React 19, TypeScript 5.9, Node 24, `postgres` 3.4.9 (postgres.js), `@supabase/supabase-js` 2.117.3 (Storage only), `@electric-sql/pglite` 0.5.8 (tests), `node:test` via `tsx`.

**Spec:** [docs/superpowers/specs/2026-10-08-supabase-mirror-design.md](../specs/2026-10-08-supabase-mirror-design.md). Read it before starting; this plan argues from it.

## Global Constraints

- **Postgres 17 features only.** Supabase runs 17.6; PGlite 0.5.8 runs 18.3. Don't use anything newer than 17 (no `uuidv7()`, no virtual generated columns, no `OLD`/`NEW` in `RETURNING`).
- **No `pgcrypto`.** Built-ins are enough (`gen_random_uuid()`, `sha256()`), and leaving it out keeps Jerry's project free of new extensions.
- **Our schemas only.** Never create or alter anything outside `mirror`, `launchpad` and `launchpad_meta`. Jerry's `app`, `config`, `core`, `ops`, `api`, `hr` and `public` are off limits. One exception: `scripts/db/schedule-pg-cron.sql` (Task 22), an opt-in script the project owner runs by hand, schedules our routes through `cron`, `net` and `vault`.
- **Every migration ends with `select launchpad.secure_schemas();`.** It turns RLS on, revokes `public`/`anon`/`authenticated`, and attaches the `updated_at` trigger. The schema test fails if a table is missed.
- **Vocabularies are `text` with `check` constraints, never Postgres enums.**
- **Monday is read only.** All Monday traffic goes through `mondayQuery()` (the client's `query`), which refuses any `mutation` or `subscription`. Pin `API-Version: 2026-10`. Multi-board queries set `limit` explicitly (Monday's `boards` default is 25).
- **HubSpot is read only.** Every request passes `isAllowedHubSpotRequest()`; there is no write endpoint in the allowlist.
- **Nothing real enters git.** No mirrored data, board or column ids, tokens, connection strings or real client names, fixtures included. Tests use invented items (ids like `1001`, names like "Test Client A").
- **The app runs with no `.env`.** Every loader returns `null` when `SUPABASE_DB_URL` is unset, and each screen keeps its sample data. `npm run build` must pass without a database.
- **SQL portable across both drivers.** Positional `$1` parameters; JSON passed as text and cast (`$1::jsonb`); `date` columns read back as text (`col::text`); int8 comes back as a JS number in both. postgres.js is configured for both in `POOL_OPTIONS` (Task 2): without its `json` override it would encode JSON text a second time, and every batched write would pass on PGlite and fail on Supabase.
- **"use server" files export only async functions.** Types, constants and validation live in a sibling module.
- **No `server-only` package.** Its npm build throws under plain Node, which the CLI and tests use. Server modules live under `src/server/` and import `postgres` (Node-only), so an accidental client import fails the build.
- **Copy:** no em dashes in new UI text; follow the screens' existing tone ("·" separators, sentence case).
- **Never commit.** Kane commits himself (standing rule; the repo is public). Each task ends with a checkpoint: tests pass and `git status --short` lists the task's files. Work in the main folder, not a worktree. If another session has uncommitted edits in a file you must touch, copy that file to the scratchpad first.

## Review Focus

The five inputs the spec implies but no feature test would naturally hit, most likely first. Each has a test in the task named.

1. **Two reps hold the same lot at the same moment.** Exactly one hold is active; the other queues. (Task 6: `place_hold` twice on one lot, and the unique index that refuses a second active hold. PGlite has one connection, so true concurrency rests on the lot's row lock and that index.)
2. **A busy day or a long outage fills the activity log page.** The `changes` pass pages on, and past its page cap it runs the `safety` check on the boards still full and records a partial run that says so; nothing is dropped silently. (Task 12: truncated scan.)
3. **The server's timezone isn't Perth.** Hold expiry and "as of" times are shown in Australia/Perth whatever the host's `TZ`. (Task 15: fixed instants.)
4. **The database is unreachable at request time.** The layout doesn't crash; the screens show sample data under a visible "Live data unavailable" note. (Task 15: loader error path.)
5. **Monday returns a column shape we didn't expect** (a `null` value, a non-JSON `value`, a new column type). The item is still stored and the views return nulls for what they can't read. (Task 10: normaliser.)

## File structure

**New, server (Node only):**

| File | Responsibility |
| --- | --- |
| `src/server/env.ts` | Reads every setting from `process.env`; all optional |
| `src/server/db/types.ts` | The `Db` interface |
| `src/server/db/postgres.ts` | postgres.js adapter and the app's pool |
| `src/server/db/pglite.ts` | PGlite adapter and the migrated test database |
| `src/server/db/migrations.ts` | Reads migration files, checksums, works out what's pending |
| `src/server/db/seed-staff.ts` | Builds and writes staff rows from the org chart |
| `src/server/db/test-fixtures.ts` | `addStaff`, an invented staff row for tests |
| `src/server/storage.ts` | `FileStore` over Supabase Storage |
| `src/server/cron-auth.ts` | Bearer check for scheduled routes |
| `src/server/mirror/runs.ts` | Run log, lease lock, watermarks (shared by every source) |
| `src/server/mirror/monday/client.ts` | GraphQL client: query-only guard, version, budget, retries |
| `src/server/mirror/monday/ledger.ts` | The client's call ledger over `mirror.api_calls` |
| `src/server/mirror/monday/test-fakes.ts` | `fakeMonday`, a scripted client for tests |
| `src/server/mirror/monday/queries.ts` | Every GraphQL document the mirror sends |
| `src/server/mirror/monday/normalise.ts` | API items to rows |
| `src/server/mirror/monday/activity.ts` | Activity logs to item ids |
| `src/server/mirror/monday/store.ts` | Upserts into `mirror.monday_*` |
| `src/server/mirror/monday/setup.ts` | Board labels and field map from Jerry's config; lot columns by title; rep aliases |
| `src/server/mirror/monday/discover.ts` | Workspaces, boards, columns, groups, users |
| `src/server/mirror/monday/passes.ts` | `backfill`, `changes`, `safety`, `sweep` |
| `src/server/mirror/monday/files.ts` | Downloads Monday files into Storage |
| `src/server/mirror/hubstaff/*` | Hubstaff client and pass |
| `src/server/mirror/hubspot/*` | HubSpot client, properties and pass |
| `src/server/read/*` | Loaders the layout and actions call, and `to-job.ts` (rows to `Job`) |
| `src/server/actions/*` | Server actions ("use server") and their pure helpers |

**New, shared (client and server):** `src/data/live/types.ts` (the `LiveData` shape), `src/data/live/viewer.ts` (who is viewing, from `?as=`), `src/components/modules/sales/land/live-lots.ts` (lots to `LandLot` for a viewer), `src/state/live-data.tsx` (provider and hooks), `src/components/ui/live-note.tsx`, `src/components/modules/sales/ViewingAs.tsx`, `src/components/modules/operations/jobs/detail/LiveDocumentsCard.tsx`, `src/components/ui/file-list.tsx`.

**New, other:** `supabase/migrations/*.sql` (9 files), `scripts/db/{bootstrap.sql,migrate.ts,seed.ts,schedule-pg-cron.sql}`, `scripts/{mirror.ts,check-secrets.ts}`, `src/lib/secret-scan.ts`, `.githooks/pre-commit`, `app/api/mirror/[source]/route.ts`, `app/api/land/settle/route.ts`, `app/api/files/monday/[assetId]/route.ts`.

**Modified:** `package.json`, `.env.example`, `README.md`, `app/(dashboard)/layout.tsx`, `app/(dashboard)/operations/jobs/[id]/page.tsx`, `sales/land/ExclusiveLand.tsx`, `sales/clients/MyClients.tsx`, `operations/jobs/CrmDashSync.tsx`, `operations/jobs/detail/JobDetailScreen.tsx`, `operations/sync/OperationsSyncProvider.tsx`.

---

# Phase A: Database foundation

### Task 1: Secrets hygiene

The leaked tokens come out of `.env.example`, and a local check stops the next one before it reaches the public repo. (Rotating the leaked tokens is Kane's job, not this task's.)

**Files:**
- Create: `src/lib/secret-scan.ts`
- Test: `src/lib/secret-scan.test.ts`
- Create: `scripts/check-secrets.ts`
- Create: `.githooks/pre-commit`
- Create: `.gitattributes` (keeps the hook's line endings LF)
- Modify: `.env.example` (full rewrite)
- Modify: `package.json` (`scripts`)

**Interfaces:**
- Produces: `scanText(path: string, text: string): SecretFinding[]` and `SecretFinding { path: string; line: number; name: string }`.

- [ ] **Step 1: Write the failing test**

Create `src/lib/secret-scan.test.ts`. The fake tokens are built by concatenation, so this file never contains a literal token and doesn't trip its own check.

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { scanText } from "./secret-scan";

// Built at runtime: a literal token here would block committing this file.
const JWT_HEAD = "eyJhbGciOiJIUzI1NiJ9" + ".";
const fakeMonday = JWT_HEAD + "eyJ0aWQiOj" + "A".repeat(40) + "." + "b".repeat(30);
const fakeHubSpot = "pat-" + "ap1-" + "1234abcd-12ab-34cd-56ef-1234567890ab";
// Invented: never reuse a real (even leaked) value in a test.
const fakeFragment = "ap1-" + "1111-2222-3a3b-4c4d-5e5f6a7b8c9d";
const fakeHubstaff = "hsoat_" + "x".repeat(24);

test("secret-scan: finds a Monday token, even commented out", () => {
  const found = scanText(".env.example", `# MONDAY_API_TOKEN=${fakeMonday}\n`);
  assert.deepEqual(found.map((f) => f.name), ["Monday API token", "Secret-looking assignment"]);
  assert.equal(found[0].line, 1);
});

test("secret-scan: finds HubSpot tokens, including one with its prefix cut off", () => {
  assert.equal(scanText("a.ts", `const t = "${fakeHubSpot}";`)[0]?.name, "HubSpot private app token");
  assert.equal(scanText("a.md", `token ${fakeFragment} here`)[0]?.name, "HubSpot token fragment");
});

test("secret-scan: finds Hubstaff tokens and filled-in secret assignments", () => {
  assert.equal(scanText("a.txt", fakeHubstaff)[0]?.name, "Hubstaff organization token");
  assert.equal(scanText(".env", "CRON_SECRET=abcdefghijklmnop")[0]?.name, "Secret-looking assignment");
});

test("secret-scan: empty assignments, ordinary code and settings that aren't secret pass", () => {
  const text = [
    "SUPABASE_DB_URL=",
    "HUBSPOT_TOKEN=",
    "MONDAY_DAILY_CALL_CAP=2000",
    "LAUNCHPAD_ENV=local",
    "export const TOKEN_HEADER = \"Authorization\";",
    "const key = row.key;",
  ].join("\n");
  assert.deepEqual(scanText(".env.example", text), []);
});

test("secret-scan: reports the line each finding is on", () => {
  const found = scanText("x.env", `A=1\nB=2\nHUBSTAFF_TOKEN=${fakeHubstaff}\n`);
  assert.ok(found.length > 0);
  assert.ok(found.every((f) => f.line === 3));
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --import tsx --test src/lib/secret-scan.test.ts`
Expected: FAIL, `Cannot find module './secret-scan'`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/secret-scan.ts`:

```ts
/**
 * Token shapes that must never reach git. The repo is public, and GitHub's
 * secret scanning doesn't cover Monday tokens, so `npm run check:secrets`
 * runs this over staged files before every commit (.githooks/pre-commit).
 */
export interface SecretFinding {
  path: string;
  line: number;
  name: string;
}

interface SecretPattern {
  name: string;
  pattern: RegExp;
}

const PATTERNS: readonly SecretPattern[] = [
  // Monday personal and app tokens are HS256 JWTs whose payload opens {"tid":
  { name: "Monday API token", pattern: /eyJhbGciOiJIUzI1NiJ9\.eyJ0aWQiOj[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}/ },
  // HubSpot private app tokens and service keys: pat-<region>-<uuid>
  {
    name: "HubSpot private app token",
    pattern: /\bpat-[a-z]{2}\d-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/,
  },
  // The same with "pat-" (and part of the uuid) cut off, as committed in 15676f1.
  {
    name: "HubSpot token fragment",
    pattern: /(?<!pat-)\b[a-z]{2}\d-[0-9a-f]{4,8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/,
  },
  { name: "Hubstaff organization token", pattern: /\bhsoat_[A-Za-z0-9_-]{16,}/ },
  { name: "Supabase secret key", pattern: /\bsb_secret_[A-Za-z0-9_-]{20,}/ },
  { name: "Postgres URL with a password", pattern: /postgres(?:ql)?:\/\/[^:\s/]+:[^@\s<>]{6,}@[a-z0-9.-]+/i },
  // NAME=value where NAME says secret: catches anything pasted into an env file.
  {
    name: "Secret-looking assignment",
    pattern: /^\s*#?\s*(?:export\s+)?[A-Z][A-Z0-9_]*(?:TOKEN|SECRET|PASSWORD|_KEY|_PAT)\s*=\s*["']?[^\s"'#]{8,}/,
  },
];

export function scanText(path: string, text: string): SecretFinding[] {
  const findings: SecretFinding[] = [];
  const lines = text.split(/\r?\n/);
  lines.forEach((line, i) => {
    for (const { name, pattern } of PATTERNS) {
      if (pattern.test(line)) findings.push({ path, line: i + 1, name });
    }
  });
  return findings;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --import tsx --test src/lib/secret-scan.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 5: Write the check script and the hook**

Create `scripts/check-secrets.ts`:

```ts
/**
 * npm run check:secrets          scan what is staged (the pre-commit hook)
 * npm run check:secrets -- --all scan every tracked file
 *
 * Fails when a token-shaped value is found. Move it to .env.local (git-ignored)
 * and rotate anything that was ever committed: deleting it doesn't un-publish it.
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { scanText, type SecretFinding } from "../src/lib/secret-scan";

const BINARY = /\.(png|jpe?g|gif|ico|webp|svg|ttf|otf|woff2?|pdf|zip|xlsx|docx|mp4|wasm)$/i;

function git(args: string[]): string {
  return execFileSync("git", args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
}

function main() {
  const all = process.argv.includes("--all");
  const files = (all ? git(["ls-files"]) : git(["diff", "--cached", "--name-only", "--diff-filter=ACMR"]))
    .split("\n")
    .map((f) => f.trim())
    .filter((f) => f && !BINARY.test(f));

  const findings: SecretFinding[] = [];
  for (const file of files) {
    let text: string;
    try {
      // Staged mode reads what is about to be committed, not the working copy.
      text = all ? readFileSync(file, "utf8") : git(["show", `:${file}`]);
    } catch {
      continue;
    }
    findings.push(...scanText(file, text));
  }

  if (findings.length > 0) {
    for (const f of findings) console.error(`${f.path}:${f.line}  ${f.name}`);
    console.error(
      "\nToken-shaped values found. Move them to .env.local (git-ignored) and rotate any that were ever committed.",
    );
    process.exit(1);
  }
  console.log(`check:secrets: ${files.length} file(s), nothing found`);
}

main();
```

Create `.githooks/pre-commit` (LF line endings):

```sh
#!/bin/sh
# Stops a commit that stages a token. The repo is public.
# Enable once per clone:  git config core.hooksPath .githooks
npm run --silent check:secrets
```

Create `.gitattributes`. The repo is checked out with `core.autocrlf=true` on Windows, and a hook checked out with CRLF line endings fails on its first line (`/bin/sh^M: bad interpreter`):

```
# Git hooks run under sh, which needs LF line endings.
.githooks/* text eol=lf
```

- [ ] **Step 6: Rewrite `.env.example`**

Replace the whole file with:

```
# Copy to .env.local and fill in there. Never put a real value in this file: the repo is
# public, and GitHub doesn't scan for Monday tokens. `npm run check:secrets` blocks a commit
# that stages one (enable the hook once with: git config core.hooksPath .githooks).
#
# With no .env.local at all, `npm run dev` still works and every screen shows sample data.
# Setup: docs/superpowers/specs/2026-10-08-supabase-mirror-design.md, section 2, and README.

# --- Environment --------------------------------------------------------------------------
# local or production. Unset means local.
LAUNCHPAD_ENV=

# --- Supabase -----------------------------------------------------------------------------
# Supabase > Connect > Transaction pooler, as the user launchpad_app.<project-ref> that
# scripts/db/bootstrap.sql creates. Server only.
SUPABASE_DB_URL=
# The project URL, for Storage.
NEXT_PUBLIC_SUPABASE_URL=
# Storage uploads and signed downloads. Server only: never prefix it NEXT_PUBLIC_.
SUPABASE_SERVICE_ROLE_KEY=

# --- Monday -------------------------------------------------------------------------------
# Best: a private Monday app's token with only boards:read, updates:read, assets:read,
# users:read and workspaces:read. A personal token works too. The mirror only sends queries.
MONDAY_API_TOKEN=
# A guard against a runaway loop, not a budget. Unset means 2000 locally, 5000 in production.
MONDAY_DAILY_CALL_CAP=

# --- Hubstaff -----------------------------------------------------------------------------
# An organization access token (Settings > Organization > API tokens), or a personal one.
HUBSTAFF_TOKEN=
HUBSTAFF_ORG_ID=

# --- HubSpot ------------------------------------------------------------------------------
# A private app token with read scopes only, and the portal id it must reach.
HUBSPOT_TOKEN=
HUBSPOT_PORTAL_ID=

# --- Scheduled routes ---------------------------------------------------------------------
# Bearer secret for /api/mirror/* and /api/land/settle. A long random value.
CRON_SECRET=

# --- Later: Dash Sync writes, on hold (Meeting3) ------------------------------------------
# OUTBOX_DRY_RUN=true
# OUTBOX_DISPATCH_SECRET=
# TEAMS_OPS_WEBHOOK_URL=
```

- [ ] **Step 7: Add the script to `package.json` and enable the hook**

In `package.json` `"scripts"`, add after `"test"`:

```json
    "check:secrets": "node --import tsx scripts/check-secrets.ts"
```

Then run (local git config only):

```bash
git config core.hooksPath .githooks
```

- [ ] **Step 8: Run the full-repo scan**

Run: `npm run check:secrets -- --all`
Expected: `check:secrets: N file(s), nothing found`. If anything is listed, open each line: a real value means stop and tell Kane; a false positive means tighten the pattern in `secret-scan.ts` and add a test for it.

- [ ] **Step 9: Checkpoint**

Run: `npm test` (all pass) and `git status --short`.
Expected files: `.env.example`, `package.json`, `src/lib/secret-scan.ts`, `src/lib/secret-scan.test.ts`, `scripts/check-secrets.ts`, `.githooks/pre-commit`, `.gitattributes`. Don't commit.

---

### Task 2: The database layer, the migration runner and the foundation migration

> **Superseded in review (2026-10-08).** The code blocks below are this task as first planned. The files in the repo are the reviewed version, and they differ on purpose:
> - `bootstrap.sql` creates our three schemas, owned by `launchpad_app`, with a generated password and setup checks; `launchpad_app` gets no CREATE on the database, and the owner manages it with `set role`;
> - the foundation migration no longer creates schemas, and `secure_schemas()` also covers `launchpad_meta` and `service_role`;
> - connections use TLS;
> - the runner refuses any login but `launchpad_app`, and `db:status` changes nothing;
> - tests run as `launchpad_app`.
>
> Copy from the repo, not from here. The reasons are in the SDD ledger's Task 2 rulings.

**Files:**
- Modify: `package.json` (dependencies, scripts)
- Create: `src/server/env.ts`, test `src/server/env.test.ts`
- Create: `src/server/db/types.ts`
- Create: `src/server/db/postgres.ts`, test `src/server/db/postgres.test.ts`
- Create: `src/server/db/migrations.ts`, test `src/server/db/migrations.test.ts`
- Create: `src/server/db/pglite.ts`
- Create: `src/server/db/schema.test.ts`
- Create: `supabase/migrations/20261008000100_foundation.sql`
- Create: `scripts/db/bootstrap.sql`, `scripts/db/migrate.ts`

**Interfaces:**
- Produces:
  - `readServerEnv(env?: Partial<NodeJS.ProcessEnv>): ServerEnv` and `hasDatabase(env?: ServerEnv): boolean`.
  - `interface Db { query<T>(text: string, params?: readonly unknown[]): Promise<T[]>; transaction<T>(fn: (tx: Db) => Promise<T>): Promise<T> }`.
  - `getDb(): Db | null`, `closeDb(): Promise<void>`, `postgresDb(sql): Db`, and `POOL_OPTIONS` (the postgres.js settings, exported for its test).
  - `readMigrations(dir?): MigrationFile[]`, `planMigrations(files, applied): MigrationPlan`, `checksum(sql): string`.
  - `migratedTestDb(): Promise<{ db: Db; close: () => Promise<void> }>` and `pgliteDb(pg): Db` (tests only).
  - SQL: schemas `mirror`, `launchpad`; functions `launchpad.touch_updated_at()`, `launchpad.secure_schemas()`.

- [ ] **Step 1: Install the packages**

```bash
npm install postgres@3.4.9 @supabase/supabase-js@2.117.3
npm install --save-dev @electric-sql/pglite@0.5.8
```

Then add to `package.json` `"scripts"`:

```json
    "db:migrate": "node --env-file-if-exists=.env.local --import tsx scripts/db/migrate.ts",
    "db:status": "node --env-file-if-exists=.env.local --import tsx scripts/db/migrate.ts --status",
```

- [ ] **Step 2: Write the failing tests for settings and migration planning**

Create `src/server/env.test.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { hasDatabase, readServerEnv } from "./env";

test("env: everything is optional, and blank counts as unset", () => {
  const env = readServerEnv({ SUPABASE_DB_URL: "  ", MONDAY_API_TOKEN: "" });
  assert.equal(env.launchpadEnv, "local");
  assert.equal(env.dbUrl, null);
  assert.equal(env.mondayToken, null);
  assert.equal(hasDatabase(env), false);
});

test("env: the Monday cap defaults by environment and takes an override", () => {
  assert.equal(readServerEnv({}).mondayDailyCallCap, 2000);
  assert.equal(readServerEnv({ LAUNCHPAD_ENV: "production" }).mondayDailyCallCap, 5000);
  assert.equal(readServerEnv({ MONDAY_DAILY_CALL_CAP: "750" }).mondayDailyCallCap, 750);
  assert.equal(readServerEnv({ MONDAY_DAILY_CALL_CAP: "nope" }).mondayDailyCallCap, 2000);
});

test("env: a set database URL means live loaders run", () => {
  const env = readServerEnv({ SUPABASE_DB_URL: "postgres://example" });
  assert.equal(hasDatabase(env), true);
});
```

Create `src/server/db/migrations.test.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { checksum, planMigrations, readMigrations, type MigrationFile } from "./migrations";

const file = (version: string, sql: string): MigrationFile => ({ version, name: `m${version}`, sql, checksum: checksum(sql) });

test("migrations: reads only well-named .sql files, in version order", () => {
  const dir = mkdtempSync(join(tmpdir(), "lp-migrations-"));
  writeFileSync(join(dir, "20261008000200_second.sql"), "select 2;");
  writeFileSync(join(dir, "20261008000100_first.sql"), "select 1;");
  writeFileSync(join(dir, "notes.md"), "not a migration");
  writeFileSync(join(dir, "2026_bad.sql"), "select 0;");
  const files = readMigrations(dir);
  assert.deepEqual(files.map((f) => f.version), ["20261008000100", "20261008000200"]);
  assert.equal(files[0].name, "first");
});

test("migrations: checksums ignore Windows line endings", () => {
  assert.equal(checksum("select 1;\r\nselect 2;\r\n"), checksum("select 1;\nselect 2;\n"));
});

test("migrations: plans pending, changed and unknown versions", () => {
  const files = [file("1", "a"), file("2", "b"), file("3", "c")];
  const plan = planMigrations(files, [
    { version: "1", checksum: checksum("a") },
    { version: "2", checksum: checksum("edited") },
    { version: "9", checksum: "x" },
  ]);
  assert.deepEqual(plan.pending.map((f) => f.version), ["3"]);
  assert.deepEqual(plan.changed.map((f) => f.version), ["2"]);
  assert.deepEqual(plan.unknown, ["9"]);
});
```

- [ ] **Step 3: Run them to verify they fail**

Run: `node --import tsx --test src/server/env.test.ts src/server/db/migrations.test.ts`
Expected: FAIL, modules not found.

- [ ] **Step 4: Write the settings, the `Db` interface and migration planning**

Create `src/server/env.ts`:

```ts
/**
 * Server settings, read from process.env. Import only from server code
 * (src/server, app/api, server actions, scripts): nothing here is for the
 * browser. Every value is optional, so the prototype runs with no .env.
 */
export interface ServerEnv {
  launchpadEnv: "local" | "production";
  dbUrl: string | null;
  supabaseUrl: string | null;
  serviceRoleKey: string | null;
  mondayToken: string | null;
  /** A runaway-loop guard, not a budget (Kane, 8 Oct: going over 10,000 is fine). */
  mondayDailyCallCap: number;
  hubstaffToken: string | null;
  hubstaffOrgId: string | null;
  hubspotToken: string | null;
  hubspotPortalId: string | null;
  cronSecret: string | null;
}

const text = (v: string | undefined): string | null => (v && v.trim() ? v.trim() : null);

// Partial because Next's types make NODE_ENV required, and the tests pass only a few keys.
export function readServerEnv(env: Partial<NodeJS.ProcessEnv> = process.env): ServerEnv {
  const launchpadEnv = env.LAUNCHPAD_ENV?.trim() === "production" ? "production" : "local";
  const cap = Number(env.MONDAY_DAILY_CALL_CAP);
  return {
    launchpadEnv,
    dbUrl: text(env.SUPABASE_DB_URL),
    supabaseUrl: text(env.NEXT_PUBLIC_SUPABASE_URL),
    serviceRoleKey: text(env.SUPABASE_SERVICE_ROLE_KEY),
    mondayToken: text(env.MONDAY_API_TOKEN),
    mondayDailyCallCap:
      Number.isFinite(cap) && cap > 0 ? Math.floor(cap) : launchpadEnv === "production" ? 5000 : 2000,
    hubstaffToken: text(env.HUBSTAFF_TOKEN),
    hubstaffOrgId: text(env.HUBSTAFF_ORG_ID),
    hubspotToken: text(env.HUBSPOT_TOKEN),
    hubspotPortalId: text(env.HUBSPOT_PORTAL_ID),
    cronSecret: text(env.CRON_SECRET),
  };
}

/** True when a database is configured, so live loaders should run. */
export const hasDatabase = (env: ServerEnv = readServerEnv()): boolean => env.dbUrl !== null;
```

Create `src/server/db/types.ts`:

```ts
/**
 * The one database interface the server code uses. The app runs it on
 * postgres.js over Supabase's pooler; tests run it on PGlite in memory. Keep
 * SQL to what both accept: positional $1 parameters, JSON passed as text and
 * cast (`$1::jsonb`), `date` columns read back as text (`col::text`).
 */
export interface Db {
  query<T = Record<string, unknown>>(text: string, params?: readonly unknown[]): Promise<T[]>;
  /** Runs `fn` in one transaction: everything it does commits together, or none of it. */
  transaction<T>(fn: (tx: Db) => Promise<T>): Promise<T>;
}
```

Create `src/server/db/migrations.ts`:

```ts
import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/** One file in supabase/migrations: `<14-digit version>_<name>.sql`. */
export interface MigrationFile {
  version: string;
  name: string;
  sql: string;
  checksum: string;
}

export interface AppliedMigration {
  version: string;
  checksum: string;
}

export interface MigrationPlan {
  /** Not applied yet, in order. */
  pending: MigrationFile[];
  /** Applied, but the file has changed since: the runner refuses to go on. */
  changed: MigrationFile[];
  /** Applied versions with no file any more. */
  unknown: string[];
}

export const MIGRATIONS_DIR = join(process.cwd(), "supabase", "migrations");

const FILE_NAME = /^(\d{14})_([a-z0-9_]+)\.sql$/;

/** sha256 of the file, with Windows line endings evened out so a checkout can't change it. */
export const checksum = (sql: string): string =>
  createHash("sha256").update(sql.replace(/\r\n/g, "\n")).digest("hex");

export function readMigrations(dir: string = MIGRATIONS_DIR): MigrationFile[] {
  return readdirSync(dir)
    .filter((f) => FILE_NAME.test(f))
    .sort()
    .map((f) => {
      const [, version, name] = FILE_NAME.exec(f)!;
      const sql = readFileSync(join(dir, f), "utf8");
      return { version, name, sql, checksum: checksum(sql) };
    });
}

export function planMigrations(files: MigrationFile[], applied: AppliedMigration[]): MigrationPlan {
  const appliedSums = new Map(applied.map((a) => [a.version, a.checksum]));
  const known = new Set(files.map((f) => f.version));
  return {
    pending: files.filter((f) => !appliedSums.has(f.version)),
    changed: files.filter((f) => appliedSums.has(f.version) && appliedSums.get(f.version) !== f.checksum),
    unknown: applied.map((a) => a.version).filter((v) => !known.has(v)),
  };
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `node --import tsx --test src/server/env.test.ts src/server/db/migrations.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 6: Write the failing schema test**

Create `src/server/db/schema.test.ts`. It stays in force for every later migration: a table without RLS, or one that `anon` can read, fails it.

```ts
import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { migratedTestDb } from "./pglite";
import type { Db } from "./types";

let db: Db;
let close: () => Promise<void>;
before(async () => ({ db, close } = await migratedTestDb()));
after(async () => close());

test("schema: our two schemas exist", async () => {
  const rows = await db.query<{ nspname: string }>(
    "select nspname from pg_namespace where nspname in ('mirror', 'launchpad') order by 1",
  );
  assert.deepEqual(rows.map((r) => r.nspname), ["launchpad", "mirror"]);
});

test("schema: every table in our schemas has row level security on", async () => {
  const rows = await db.query<{ name: string }>(`
    select n.nspname || '.' || c.relname as name
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname in ('mirror', 'launchpad') and c.relkind in ('r', 'p') and not c.relrowsecurity`);
  assert.deepEqual(rows.map((r) => r.name), []);
});

test("schema: anon and authenticated can't reach our schemas, tables or views", async () => {
  const rows = await db.query<{ what: string }>(`
    select r.rolname || ' has usage on ' || n.nspname as what
    from pg_namespace n cross join pg_roles r
    where n.nspname in ('mirror', 'launchpad') and r.rolname in ('anon', 'authenticated')
      and has_schema_privilege(r.oid, n.oid, 'USAGE')
    union all
    select r.rolname || ' can touch ' || n.nspname || '.' || c.relname
    from pg_class c join pg_namespace n on n.oid = c.relnamespace cross join pg_roles r
    where n.nspname in ('mirror', 'launchpad') and c.relkind in ('r', 'p', 'v')
      and r.rolname in ('anon', 'authenticated')
      and has_table_privilege(r.oid, c.oid, 'SELECT,INSERT,UPDATE,DELETE')`);
  assert.deepEqual(rows.map((r) => r.what), []);
});

test("schema: every table with updated_at keeps it current", async () => {
  const rows = await db.query<{ name: string }>(`
    select n.nspname || '.' || c.relname as name
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    join pg_attribute a on a.attrelid = c.oid and a.attname = 'updated_at' and not a.attisdropped
    where n.nspname in ('mirror', 'launchpad') and c.relkind = 'r'
      and not exists (select 1 from pg_trigger t where t.tgrelid = c.oid and t.tgname = 'touch_updated_at')`);
  assert.deepEqual(rows.map((r) => r.name), []);
});
```

Create `src/server/db/postgres.test.ts`. PGlite takes JSON text for a `$1::jsonb` parameter as it is, but postgres.js's default would `JSON.stringify` that text again and store a JSON string, so every batched write would pass the tests and fail on Supabase. This pins the override in `POOL_OPTIONS` without a server:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import postgres from "postgres";
import { POOL_OPTIONS } from "./postgres";

test("postgres: JSON text reaches json and jsonb parameters unchanged, and int8 reads as a number", async () => {
  // postgres.js connects on the first query, so this makes no connection.
  const sql = postgres({ ...POOL_OPTIONS, host: "localhost", database: "unused" });
  try {
    assert.equal(sql.options.serializers[3802]('[{"id":1}]'), '[{"id":1}]');
    assert.equal(sql.options.serializers[114]('{"a":1}'), '{"a":1}');
    assert.equal(sql.options.serializers[3802]({ a: 1 }), '{"a":1}');
    assert.equal(sql.options.parsers[20]("9007199254740991"), 9007199254740991);
  } finally {
    await sql.end({ timeout: 0 });
  }
});
```

- [ ] **Step 7: Run them to verify they fail**

Run: `node --import tsx --test src/server/db/schema.test.ts src/server/db/postgres.test.ts`
Expected: FAIL, `Cannot find module './pglite'` and `Cannot find module './postgres'`.

- [ ] **Step 8: Write the PGlite adapter, the foundation migration and the bootstrap**

Create `src/server/db/pglite.ts`:

```ts
import { PGlite } from "@electric-sql/pglite";
import type { Db } from "./types";
import { readMigrations } from "./migrations";

/** The roles Supabase creates, so migrations that revoke from them also run on PGlite. */
const SUPABASE_ROLES = `
  do $$ begin
    if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
    if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
    if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin; end if;
  end $$;
`;

interface Queryable {
  query<T>(text: string, params?: unknown[]): Promise<{ rows: T[] }>;
}

/** Wraps PGlite (or a PGlite transaction) as a `Db`. Tests only. */
export function pgliteDb(pg: Queryable & { transaction?: PGlite["transaction"] }): Db {
  return {
    query: async <T>(text: string, params: readonly unknown[] = []) => (await pg.query<T>(text, [...params])).rows,
    transaction: async <T>(fn: (tx: Db) => Promise<T>): Promise<T> => {
      if (!pg.transaction) return fn(pgliteDb(pg)); // already inside one
      return pg.transaction((tx) => fn(pgliteDb(tx)));
    },
  };
}

/** A fresh in-memory database with every migration applied. Takes about a second: share one per test file. */
export async function migratedTestDb(): Promise<{ db: Db; close: () => Promise<void> }> {
  const pg = new PGlite();
  await pg.exec(SUPABASE_ROLES);
  for (const m of readMigrations()) {
    try {
      await pg.exec(m.sql);
    } catch (e) {
      throw new Error(`migration ${m.version}_${m.name} failed: ${(e as Error).message}`);
    }
  }
  return { db: pgliteDb(pg), close: () => pg.close() };
}
```

Create `supabase/migrations/20261008000100_foundation.sql`:

```sql
-- Launchpad's own schemas. They sit beside anything else in the database
-- (Jerry's app, config, core, ops, api and hr in production) and touch none of it.
-- Spec: docs/superpowers/specs/2026-10-08-supabase-mirror-design.md

create schema if not exists mirror;
create schema if not exists launchpad;

comment on schema mirror is 'Read-only copies of Monday, HubSpot and Hubstaff. Written only by the sync code.';
comment on schema launchpad is 'Data Launchpad owns, and the views the app reads.';

-- Keeps updated_at current on every table that has one. secure_schemas() attaches it.
create or replace function launchpad.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end
$$;

-- Every migration ends by calling this. It turns row level security on for every
-- table in our schemas, takes every privilege away from public, anon and
-- authenticated, and attaches touch_updated_at wherever there is an updated_at
-- column. Safe to run any number of times.
create or replace function launchpad.secure_schemas() returns void
language plpgsql as $$
declare
  r record;
begin
  execute 'revoke all on schema mirror, launchpad from public, anon, authenticated';
  execute 'revoke all on all functions in schema mirror, launchpad from public, anon, authenticated';
  execute 'revoke all on all sequences in schema mirror, launchpad from public, anon, authenticated';
  for r in
    select n.nspname as schema_name, c.relname as table_name
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname in ('mirror', 'launchpad') and c.relkind in ('r', 'p', 'v')
  loop
    execute format('revoke all on table %I.%I from public, anon, authenticated', r.schema_name, r.table_name);
  end loop;
  for r in
    select n.nspname as schema_name, c.relname as table_name
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname in ('mirror', 'launchpad') and c.relkind in ('r', 'p')
  loop
    execute format('alter table %I.%I enable row level security', r.schema_name, r.table_name);
  end loop;
  for r in
    select n.nspname as schema_name, c.relname as table_name
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    join pg_attribute a on a.attrelid = c.oid and a.attname = 'updated_at' and not a.attisdropped
    where n.nspname in ('mirror', 'launchpad') and c.relkind = 'r'
      and not exists (select 1 from pg_trigger t where t.tgrelid = c.oid and t.tgname = 'touch_updated_at')
  loop
    execute format(
      'create trigger touch_updated_at before update on %I.%I for each row execute function launchpad.touch_updated_at()',
      r.schema_name, r.table_name
    );
  end loop;
end
$$;

select launchpad.secure_schemas();
```

Create `scripts/db/bootstrap.sql`:

```sql
-- Run ONCE per Supabase project, as the project owner, in the Supabase SQL editor.
-- It creates the login that owns Launchpad's schemas, so the app and its migrations
-- can't touch anything else in the database (in production: Jerry's schemas).
--
-- 1. Replace CHANGE-ME with a long random password. Don't save the edited file:
--    the password belongs only in .env.local or the host's environment variables.
-- 2. Run it.
-- 3. Build SUPABASE_DB_URL from Supabase > Connect > Transaction pooler, with the user
--    launchpad_app.<project-ref> and the password from step 1.

create role launchpad_app with login password 'CHANGE-ME';

-- Lets launchpad_app create its schemas: mirror, launchpad and launchpad_meta.
grant create on database postgres to launchpad_app;

-- Lets the project owner manage what launchpad_app creates.
grant launchpad_app to postgres;
```

Create `src/server/db/postgres.ts`:

```ts
import postgres from "postgres";
import type { Db } from "./types";
import { readServerEnv } from "../env";

type Sql = postgres.Sql | postgres.TransactionSql;

export function postgresDb(sql: Sql): Db {
  return {
    query: async <T>(text: string, params: readonly unknown[] = []) =>
      (await sql.unsafe(text, [...params] as never)) as unknown as T[],
    transaction: <T>(fn: (tx: Db) => Promise<T>) =>
      (sql as postgres.Sql).begin((tx) => fn(postgresDb(tx))) as unknown as Promise<T>,
  };
}

/** postgres.js settings for Supabase's transaction pooler. Exported for its test. */
export const POOL_OPTIONS = {
  prepare: false, // Supavisor's transaction mode can't keep prepared statements
  max: 5,
  idle_timeout: 20,
  connect_timeout: 10,
  onnotice: () => {},
  types: {
    // int8 as a JS number, as PGlite returns it. Monday and HubSpot ids fit in 2^53.
    int8: { to: 20, from: [20], serialize: (x: number) => String(x), parse: (x: string) => Number(x) },
    // Our SQL passes JSON as text and casts it (`$1::jsonb`), which PGlite takes as it
    // is. postgres.js's default would JSON.stringify that text again and store a string.
    json: {
      to: 3802,
      from: [114, 3802],
      serialize: (x: unknown) => (typeof x === "string" ? x : JSON.stringify(x)),
      parse: (x: string) => JSON.parse(x),
    },
  },
};

const cache = globalThis as unknown as { __launchpadSql?: postgres.Sql };

/** The app's pool, or null when SUPABASE_DB_URL isn't set (the screens keep sample data). */
export function getDb(): Db | null {
  const url = readServerEnv().dbUrl;
  if (!url) return null;
  cache.__launchpadSql ??= postgres(url, POOL_OPTIONS);
  return postgresDb(cache.__launchpadSql);
}

/** Ends the pool, for scripts that must exit. */
export async function closeDb(): Promise<void> {
  await cache.__launchpadSql?.end({ timeout: 5 });
  cache.__launchpadSql = undefined;
}
```

Create `scripts/db/migrate.ts`:

```ts
/**
 * npm run db:migrate   apply pending migrations
 * npm run db:status    list applied and pending migrations, change nothing
 *
 * Applies supabase/migrations/*.sql over SUPABASE_DB_URL (as launchpad_app), each
 * in its own transaction, and records it in launchpad_meta.migrations: our own
 * history table, so it can't clash with the Supabase CLI's or Jerry's. Refuses to
 * run when a file that was already applied has changed since.
 */
import postgres from "postgres";
import { planMigrations, readMigrations } from "../../src/server/db/migrations";

async function main() {
  const url = process.env.SUPABASE_DB_URL?.trim();
  if (!url) {
    console.error("SUPABASE_DB_URL is not set. Put it in .env.local (see .env.example).");
    process.exit(1);
  }
  const statusOnly = process.argv.includes("--status");
  const sql = postgres(url, { prepare: false, max: 1, onnotice: () => {} });
  try {
    await sql
      .unsafe(
        `create schema if not exists launchpad_meta;
         create table if not exists launchpad_meta.migrations (
           version text primary key,
           name text not null,
           checksum text not null,
           applied_at timestamptz not null default now()
         );
         alter table launchpad_meta.migrations enable row level security;
         revoke all on schema launchpad_meta from public, anon, authenticated;
         revoke all on table launchpad_meta.migrations from public, anon, authenticated;`,
      )
      .simple();

    const applied = await sql<{ version: string; checksum: string }[]>`
      select version, checksum from launchpad_meta.migrations order by version`;
    const files = readMigrations();
    const plan = planMigrations(files, applied);

    if (plan.changed.length > 0) {
      console.error("These migrations were applied and have changed since. Add a new migration instead:");
      for (const f of plan.changed) console.error(`  ${f.version}_${f.name}`);
      process.exitCode = 1;
      return;
    }
    if (plan.unknown.length > 0) {
      console.warn(`Applied but not in supabase/migrations: ${plan.unknown.join(", ")}`);
    }
    for (const f of files) {
      console.log(`${plan.pending.includes(f) ? "pending" : "applied"}  ${f.version}_${f.name}`);
    }
    if (statusOnly) return;
    if (plan.pending.length === 0) {
      console.log("Nothing to apply.");
      return;
    }
    for (const f of plan.pending) {
      await sql.begin(async (tx) => {
        await tx.unsafe(f.sql).simple();
        await tx`insert into launchpad_meta.migrations (version, name, checksum)
                 values (${f.version}, ${f.name}, ${f.checksum})`;
      });
      console.log(`done     ${f.version}_${f.name}`);
    }
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
```

- [ ] **Step 9: Run the tests to verify they pass**

Run: `node --import tsx --test src/server/db/schema.test.ts src/server/db/postgres.test.ts`
Expected: PASS, 5 tests.

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 10: Checkpoint**

Run: `npm test` and `git status --short`. Expected new files: `src/server/env.ts`, `src/server/env.test.ts`, `src/server/db/{types,postgres,postgres.test,migrations,migrations.test,pglite,schema.test}.ts`, `supabase/migrations/20261008000100_foundation.sql`, `scripts/db/{bootstrap.sql,migrate.ts}`; modified `package.json`, `package-lock.json`. Don't commit.

---

### Task 3: The mirror's tables

> **Changed in review (2026-10-08).** In the repo, `try_lock`, `record_api_call` and `record_daily_limit` use `clock_timestamp()`, not `now()`. The pending-files index is `(monday_created_at desc nulls last, id)`, excluding failed files. The test adds the UTC day key, unlock by a non-owner and the unchanged count. Copy from the repo, not from here.


**Files:**
- Create: `supabase/migrations/20261008000200_mirror_monday.sql`
- Create: `supabase/migrations/20261008000300_mirror_hubspot_hubstaff.sql`
- Test: `src/server/db/mirror-schema.test.ts`

**Interfaces:**
- Produces (SQL):
  - Monday tables: `mirror.monday_workspaces`, `monday_boards`, `monday_columns`, `monday_groups`, `monday_items`, `monday_updates`, `monday_assets`, `monday_users`, `monday_fields` (seeded vocabulary), `monday_field_map`.
  - Bookkeeping: `mirror.sync_runs`, `sync_state`, `sync_locks`, `api_calls`, `integration_secrets`.
  - Functions: `mirror.record_api_call(p_source text, p_calls numeric, p_cap numeric) returns boolean` (false past the cap, or after the day's limit was hit), `mirror.record_daily_limit(p_source text) returns void`, `mirror.try_lock(p_source text, p_owner text, p_seconds integer) returns boolean`, `mirror.unlock(p_source text, p_owner text)`.
  - HubSpot and Hubstaff: `mirror.hubspot_objects`, `hubspot_owners`, `hubspot_pipelines`, `hubstaff_members`, `hubstaff_daily_activities`.

- [ ] **Step 1: Write the failing test**

Create `src/server/db/mirror-schema.test.ts`:

```ts
import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { migratedTestDb } from "./pglite";
import type { Db } from "./types";

let db: Db;
let close: () => Promise<void>;
before(async () => ({ db, close } = await migratedTestDb()));
after(async () => close());

test("mirror: record_api_call admits calls up to the cap, then refuses without counting", async () => {
  const take = async () =>
    (await db.query<{ ok: boolean }>("select mirror.record_api_call('monday', 1, 2) as ok"))[0].ok;
  assert.equal(await take(), true);
  assert.equal(await take(), true);
  assert.equal(await take(), false);
  const [row] = await db.query<{ calls: string }>("select calls::text from mirror.api_calls where source = 'monday'");
  assert.equal(row.calls, "2.0");
});

test("mirror: after the daily limit is hit, record_api_call refuses until the UTC day ends", async () => {
  const take = async () =>
    (await db.query<{ ok: boolean }>("select mirror.record_api_call('hubspot', 1, 100) as ok"))[0].ok;
  assert.equal(await take(), true);
  await db.query("select mirror.record_daily_limit('hubspot')");
  assert.equal(await take(), false);
  // Make today's row yesterday's: the new day starts clear.
  await db.query("update mirror.api_calls set day = day - 1 where source = 'hubspot'");
  assert.equal(await take(), true);
});

test("mirror: a lease lock has one holder until it expires or is released", async () => {
  const lock = async (owner: string, secs = 60) =>
    (await db.query<{ ok: boolean }>("select mirror.try_lock('monday', $1, $2) as ok", [owner, secs]))[0].ok;
  assert.equal(await lock("a"), true);
  assert.equal(await lock("b"), false);
  assert.equal(await lock("a"), true, "the holder can renew");
  await db.query("select mirror.unlock('monday', 'a')");
  assert.equal(await lock("b"), true);
  await db.query("update mirror.sync_locks set locked_until = now() - interval '1 second' where source = 'monday'");
  assert.equal(await lock("c"), true, "an expired lease can be taken");
});

test("mirror: the field vocabulary covers job, milestone and lot fields", async () => {
  const rows = await db.query<{ key: string; scope: string }>("select key, scope from mirror.monday_fields");
  const keys = new Set(rows.map((r) => r.key));
  for (const k of ["job_number", "sales_rep", "hubspot_id", "milestone_status", "date_completed", "files", "lot_estate"]) {
    assert.ok(keys.has(k), `missing field ${k}`);
  }
  assert.equal(rows.find((r) => r.key === "milestone_status")?.scope, "subitem");
});

test("mirror: an item keeps every column value as JSON, and the field map points at one column", async () => {
  await db.query("insert into mirror.monday_workspaces (id, name) values (1, 'Test workspace')");
  await db.query("insert into mirror.monday_boards (id, workspace_id, name) values (10, 1, 'Test board')");
  await db.query(
    `insert into mirror.monday_items (id, board_id, name, monday_updated_at, column_values)
     values (100, 10, 'Test Client A', now(), $1::jsonb)`,
    [JSON.stringify({ text4: { type: "text", text: "12345", value: "\"12345\"" } })],
  );
  await db.query("insert into mirror.monday_field_map (board_id, field_key, column_id) values (10, 'job_number', 'text4')");
  const [row] = await db.query<{ job: string }>(`
    select i.column_values -> m.column_id ->> 'text' as job
    from mirror.monday_items i join mirror.monday_field_map m on m.board_id = i.board_id
    where i.id = 100 and m.field_key = 'job_number'`);
  assert.equal(row.job, "12345");
  await assert.rejects(
    db.query("insert into mirror.monday_field_map (board_id, field_key, column_id) values (10, 'not_a_field', 'x')"),
  );
});

test("mirror: HubSpot and Hubstaff rows land in their own tables", async () => {
  await db.query(
    `insert into mirror.hubspot_objects (object_type, id, properties) values ('deals', 555, $1::jsonb)`,
    [JSON.stringify({ dealname: "Test deal" })],
  );
  await db.query(
    `insert into mirror.hubstaff_daily_activities (id, organization_id, user_id, date, tracked_seconds)
     values (1, 7, 42, '2026-10-06', 27000)`,
  );
  const [deal] = await db.query<{ n: string }>("select properties ->> 'dealname' as n from mirror.hubspot_objects");
  assert.equal(deal.n, "Test deal");
  await assert.rejects(
    db.query("insert into mirror.hubspot_objects (object_type, id) values ('tickets', 1)"),
    /check/i,
  );
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node --import tsx --test src/server/db/mirror-schema.test.ts`
Expected: FAIL, `function mirror.record_api_call(...) does not exist`.

- [ ] **Step 3: Write the Monday and bookkeeping migration**

Create `supabase/migrations/20261008000200_mirror_monday.sql`:

```sql
-- Monday, mirrored generically: boards, columns, groups, items with every column
-- value as JSON, updates, file assets and users. Nothing here knows a column id;
-- monday_field_map (filled at setup, never committed) names the columns we read.

create table mirror.monday_workspaces (
  id bigint primary key,
  name text not null,
  kind text,
  sync_enabled boolean not null default false,
  synced_at timestamptz not null default now()
);

create table mirror.monday_boards (
  id bigint primary key,
  workspace_id bigint references mirror.monday_workspaces (id),
  name text not null,
  type text not null default 'board',
  state text not null default 'active' check (state in ('active', 'archived', 'deleted')),
  -- Set on a subitems board: the board whose items own its subitems.
  parent_board_id bigint references mirror.monday_boards (id),
  -- Our labels, set by setup. A subitems board's key is '<parent key>:subitems'.
  board_key text unique,
  purpose text check (purpose in ('sales', 'construction', 'handed_over', 'exclusive_land', 'models', 'other')),
  division text check (division in ('homes', 'wealth')),
  region text check (region in ('WA', 'VIC', 'QLD', 'NSW', 'SA', 'NT', 'TAS', 'ACT')),
  sync_enabled boolean not null default false,
  monday_updated_at timestamptz,
  synced_at timestamptz not null default now()
);

create table mirror.monday_columns (
  board_id bigint not null references mirror.monday_boards (id) on delete cascade,
  id text not null,
  title text not null,
  type text not null,
  position integer,
  synced_at timestamptz not null default now(),
  primary key (board_id, id)
);

create table mirror.monday_groups (
  board_id bigint not null references mirror.monday_boards (id) on delete cascade,
  id text not null,
  title text not null,
  color text,
  position text,
  archived boolean not null default false,
  deleted boolean not null default false,
  synced_at timestamptz not null default now(),
  primary key (board_id, id)
);

create table mirror.monday_items (
  id bigint primary key,
  board_id bigint not null references mirror.monday_boards (id),
  group_id text,
  -- Set on a subitem. No foreign key: a subitem can arrive before its parent.
  parent_item_id bigint,
  name text not null,
  state text not null default 'active' check (state in ('active', 'archived', 'deleted')),
  creator_id bigint,
  monday_created_at timestamptz,
  monday_updated_at timestamptz not null,
  -- { "<column id>": { "type", "text", "value", "label"?, "index"?, "date"?, "display_value"?, "linked_item_ids"? } }
  column_values jsonb not null default '{}'::jsonb,
  first_seen_at timestamptz not null default now(),
  synced_at timestamptz not null default now(),
  -- When we learned it was archived, deleted or gone. Null while it is live.
  removed_at timestamptz
);
create index monday_items_board on mirror.monday_items (board_id) where removed_at is null;
create index monday_items_parent on mirror.monday_items (parent_item_id) where parent_item_id is not null;

create table mirror.monday_updates (
  id bigint primary key,
  item_id bigint not null,
  creator_id bigint,
  body text,
  text_body text,
  monday_created_at timestamptz,
  monday_updated_at timestamptz,
  synced_at timestamptz not null default now()
);
create index monday_updates_item on mirror.monday_updates (item_id);

create table mirror.monday_assets (
  id bigint primary key,
  item_id bigint not null,
  -- The file column it sits in, or null when it was attached to an update.
  column_id text,
  update_id bigint,
  name text not null,
  file_extension text,
  file_size bigint,
  monday_created_at timestamptz,
  -- Where its bytes are in the monday-files bucket. Null until downloaded.
  storage_path text unique,
  sha256 text check (sha256 is null or sha256 ~ '^[0-9a-f]{64}$'),
  downloaded_at timestamptz,
  download_attempts smallint not null default 0,
  download_error text,
  removed_at timestamptz,
  synced_at timestamptz not null default now()
);
create index monday_assets_item on mirror.monday_assets (item_id);
create index monday_assets_pending on mirror.monday_assets (monday_created_at desc)
  where storage_path is null and removed_at is null;

create table mirror.monday_users (
  id bigint primary key,
  name text,
  email text,
  enabled boolean,
  is_guest boolean,
  synced_at timestamptz not null default now()
);

-- Our names for the columns we read. Vocabulary only: no ids.
create table mirror.monday_fields (
  key text primary key,
  scope text not null check (scope in ('parent', 'subitem')),
  label text not null
);
insert into mirror.monday_fields (key, scope, label) values
  ('job_number', 'parent', 'Job number'),
  ('site_address', 'parent', 'Site address'),
  ('site_suburb', 'parent', 'Site suburb'),
  ('site_state', 'parent', 'Site state'),
  ('sales_rep', 'parent', 'Sales rep'),
  ('builder', 'parent', 'Builder'),
  ('buyer_type', 'parent', 'Buyer type'),
  ('block_titled', 'parent', 'Block titled'),
  ('title_due_date', 'parent', 'Title due date'),
  ('sale_won_date', 'parent', 'Sale won date'),
  ('construction_stage', 'parent', 'Construction stage'),
  ('handover_date', 'parent', 'Handover date'),
  ('hubspot_id', 'parent', 'HubSpot deal id'),
  ('milestone_status', 'subitem', 'Milestone status'),
  ('due_date', 'subitem', 'Due date'),
  ('date_completed', 'subitem', 'Date completed'),
  ('people', 'subitem', 'People'),
  ('files', 'subitem', 'Files'),
  ('notes', 'subitem', 'Notes'),
  ('lot_status', 'parent', 'Lot status'),
  ('lot_address', 'parent', 'Lot address'),
  ('lot_suburb', 'parent', 'Lot suburb'),
  ('lot_state', 'parent', 'Lot state'),
  ('lot_estate', 'parent', 'Estate'),
  ('lot_developer', 'parent', 'Land developer'),
  ('lot_builder', 'parent', 'Builder'),
  ('lot_land_price', 'parent', 'Land price'),
  ('lot_package_price', 'parent', 'Package price'),
  ('lot_design', 'parent', 'Design'),
  ('lot_area', 'parent', 'Lot area'),
  ('lot_frontage', 'parent', 'Frontage'),
  ('lot_zoning', 'parent', 'Zoning'),
  ('lot_title', 'parent', 'Title status'),
  ('lot_title_eta', 'parent', 'Title ETA'),
  ('lot_rebate', 'parent', 'Rebate'),
  ('lot_files', 'parent', 'Plans and files');

-- Per board, the column that holds each field. Filled by `npm run mirror -- setup`.
create table mirror.monday_field_map (
  board_id bigint not null references mirror.monday_boards (id) on delete cascade,
  field_key text not null references mirror.monday_fields (key),
  column_id text not null,
  source text not null default 'manual' check (source in ('jerry_config', 'title_match', 'manual')),
  primary key (board_id, field_key)
);

-- One row per pass of any source.
create table mirror.sync_runs (
  id bigint generated always as identity primary key,
  source text not null check (source in ('monday', 'hubspot', 'hubstaff')),
  mode text not null,
  trigger text not null check (trigger in ('cron', 'cli', 'manual')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null default 'running' check (status in ('running', 'ok', 'partial', 'failed', 'skipped')),
  api_calls integer not null default 0,
  complexity bigint not null default 0,
  records_seen integer not null default 0,
  records_changed integer not null default 0,
  watermark_before jsonb,
  watermark_after jsonb,
  note text,
  error text
);
create index sync_runs_recent on mirror.sync_runs (source, started_at desc);

-- Watermarks and milestones per source and scope ('account', 'board:<id>', 'object:deals').
create table mirror.sync_state (
  source text not null,
  scope text not null,
  watermark timestamptz,
  backfilled_at timestamptz,
  swept_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (source, scope)
);

-- One pass per source at a time. A lease that expires on its own, because session
-- advisory locks don't survive Supabase's transaction pooler.
create table mirror.sync_locks (
  source text primary key,
  owner text not null,
  locked_until timestamptz not null
);

create or replace function mirror.try_lock(p_source text, p_owner text, p_seconds integer)
returns boolean
language plpgsql as $$
begin
  insert into mirror.sync_locks as l (source, owner, locked_until)
  values (p_source, p_owner, now() + make_interval(secs => p_seconds))
  on conflict (source) do update
    set owner = excluded.owner, locked_until = excluded.locked_until
    where l.locked_until < now() or l.owner = excluded.owner;
  return found;
end
$$;

create or replace function mirror.unlock(p_source text, p_owner text)
returns void
language sql as $$
  delete from mirror.sync_locks where source = p_source and owner = p_owner;
$$;

-- Calls per source per UTC day (Monday's day resets at 00:00 UTC).
create table mirror.api_calls (
  source text not null,
  day date not null,
  calls numeric(10, 1) not null default 0,
  -- Set when Monday answers DAILY_LIMIT_EXCEEDED: nothing more is sent that UTC day.
  limit_hit_at timestamptz,
  primary key (source, day)
);

-- Counts p_calls against today's total when it stays within p_cap and the source's
-- daily limit hasn't been hit today. False (and nothing counted) otherwise: the
-- caller must not send the request.
create or replace function mirror.record_api_call(p_source text, p_calls numeric, p_cap numeric)
returns boolean
language plpgsql as $$
declare
  v_day date := (now() at time zone 'utc')::date;
begin
  insert into mirror.api_calls (source, day, calls) values (p_source, v_day, 0)
  on conflict (source, day) do nothing;
  update mirror.api_calls
     set calls = calls + p_calls
   where source = p_source and day = v_day and calls + p_calls <= p_cap and limit_hit_at is null;
  return found;
end
$$;

-- Monday said DAILY_LIMIT_EXCEEDED: refuse every call for the rest of the UTC day,
-- so no pass keeps knocking until the limit resets at 00:00 UTC.
create or replace function mirror.record_daily_limit(p_source text)
returns void
language sql as $$
  insert into mirror.api_calls as a (source, day, calls, limit_hit_at)
  values (p_source, (now() at time zone 'utc')::date, 0, now())
  on conflict (source, day) do update set limit_hit_at = coalesce(a.limit_hit_at, excluded.limit_hit_at);
$$;

-- Tokens that rotate (a Hubstaff personal access token's refresh chain).
create table mirror.integration_secrets (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

select launchpad.secure_schemas();
```

- [ ] **Step 4: Write the HubSpot and Hubstaff migration**

Create `supabase/migrations/20261008000300_mirror_hubspot_hubstaff.sql`:

```sql
-- HubSpot and Hubstaff, mirrored read only. Properties stay JSON: typed views
-- come with the screens that need them.

create table mirror.hubspot_objects (
  object_type text not null check (object_type in ('deals', 'contacts', 'meetings', 'notes')),
  id bigint not null,
  properties jsonb not null default '{}'::jsonb,
  -- { "contacts": [ids], "deals": [ids] }
  associations jsonb not null default '{}'::jsonb,
  archived boolean not null default false,
  hs_created_at timestamptz,
  hs_updated_at timestamptz,
  synced_at timestamptz not null default now(),
  primary key (object_type, id)
);
create index hubspot_objects_updated on mirror.hubspot_objects (object_type, hs_updated_at desc);

create table mirror.hubspot_owners (
  id bigint primary key,
  user_id bigint,
  email text,
  first_name text,
  last_name text,
  teams jsonb not null default '[]'::jsonb,
  archived boolean not null default false,
  hs_updated_at timestamptz,
  synced_at timestamptz not null default now()
);

create table mirror.hubspot_pipelines (
  object_type text not null,
  id text not null,
  label text not null,
  display_order integer,
  archived boolean not null default false,
  stages jsonb not null default '[]'::jsonb,
  synced_at timestamptz not null default now(),
  primary key (object_type, id)
);

create table mirror.hubstaff_members (
  user_id bigint primary key,
  organization_id bigint not null,
  name text,
  email text,
  membership_status text,
  synced_at timestamptz not null default now()
);

-- One row per Hubstaff daily activity: a user, a project (and task) and a day in
-- the organisation's timezone.
create table mirror.hubstaff_daily_activities (
  id bigint primary key,
  organization_id bigint not null,
  user_id bigint not null,
  project_id bigint,
  task_id bigint,
  date date not null,
  tracked_seconds integer not null default 0,
  overall_seconds integer,
  idle_seconds integer,
  manual_seconds integer,
  billable_seconds integer,
  hs_updated_at timestamptz,
  synced_at timestamptz not null default now()
);
create index hubstaff_daily_user_date on mirror.hubstaff_daily_activities (user_id, date);

select launchpad.secure_schemas();
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `node --import tsx --test src/server/db/mirror-schema.test.ts src/server/db/schema.test.ts`
Expected: PASS, 13 tests (the schema tests now cover the new tables too).

- [ ] **Step 6: Checkpoint**

Run: `npm test` and `git status --short`. Expected new files: the two migrations and `src/server/db/mirror-schema.test.ts`. Don't commit.

---

### Task 4: People, access, leave, staff pay, Accounting and Accounts tables

> **Changed in review (2026-10-08).** In the repo:
> - an invoice number is unique per sender, and a person has one live invoice per pay week (partial unique indexes; a retracted invoice frees both);
> - nobody reports to themselves;
> - currencies are checked as three upper-case letters;
> - a payout is paid exactly when it has a sent date, and isn't deleted with its pay run;
> - departments and leave allowances carry `created_at` and `updated_at`.
>
> Copy from the repo, not from here.


**Files:**
- Create: `supabase/migrations/20261008000400_launchpad_people_access.sql`
- Create: `supabase/migrations/20261008000500_launchpad_pay_accounts.sql`
- Create: `src/server/db/test-fixtures.ts`
- Test: `src/server/db/people-pay-schema.test.ts`

**Interfaces:**
- Consumes: `migratedTestDb()` (Task 2).
- Produces:
  - SQL, people and access: `launchpad.departments` (8 rows seeded), `staff`, `staff_aliases`, `pay_rates`, `one_off_payments`, `app_users`, `modules`, `module_sections`, `role_grants`, `section_access`, `leave_requests`, `leave_allowances`.
  - SQL, pay and accounts: `launchpad.payment_methods`, `invoice_senders`, `staff_invoices`, `staff_invoice_lines`, `invoice_alerts`, `pay_runs`, `pay_run_invoices`, `pay_run_holds`, `payouts`, `payout_invoices`, `builder_invoices`, `expense_claims`.
  - TS test helper: `addStaff(db: Db, id: string, opts?: { name?: string | null; department?: string; reportsTo?: string | null; email?: string | null }): Promise<void>`.

- [ ] **Step 1: Write the test helper and the failing test**

Create `src/server/db/test-fixtures.ts`:

```ts
import type { Db } from "./types";

/** "test-rep-a" → "Test Rep A". */
const titleOf = (id: string) =>
  id
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");

/** Inserts one invented staff member. Tests only: never a real person. */
export async function addStaff(
  db: Db,
  id: string,
  opts: { name?: string | null; department?: string; reportsTo?: string | null; email?: string | null } = {},
): Promise<void> {
  const name = opts.name === undefined ? titleOf(id) : opts.name;
  await db.query(
    `insert into launchpad.staff (id, name, role, department_id, reports_to, work_email, vacant)
     values ($1, $2, 'Test role', $3, $4, $5, $6)`,
    [id, name, opts.department ?? "sales", opts.reportsTo ?? null, opts.email ?? null, name === null],
  );
}
```

Create `src/server/db/people-pay-schema.test.ts`:

```ts
import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { migratedTestDb } from "./pglite";
import { addStaff } from "./test-fixtures";
import type { Db } from "./types";

let db: Db;
let close: () => Promise<void>;
before(async () => ({ db, close } = await migratedTestDb()));
after(async () => close());

test("people: the roster's eight departments are there", async () => {
  const rows = await db.query<{ id: string }>("select id from launchpad.departments order by sort");
  assert.deepEqual(rows.map((r) => r.id), [
    "leadership", "finance", "sales", "marketing", "operations", "it", "accounting", "executive",
  ]);
});

test("people: a report can be written before their manager inside one transaction", async () => {
  await db.transaction(async (tx) => {
    await addStaff(tx, "test-report", { reportsTo: "test-manager" });
    await addStaff(tx, "test-manager");
  });
  const [row] = await db.query<{ reports_to: string }>("select reports_to from launchpad.staff where id = 'test-report'");
  assert.equal(row.reports_to, "test-manager");
});

test("people: ids are slugs, and a vacant seat has no name", async () => {
  await assert.rejects(addStaff(db, "Not A Slug"), /check/i);
  await addStaff(db, "test-vacancy", { name: null });
  await assert.rejects(
    db.query("insert into launchpad.staff (id, name, role, vacant) values ('test-bad-vacancy', 'Someone', 'x', true)"),
    /check/i,
  );
});

test("people: updated_at moves on update", async () => {
  // Start from a past updated_at, so the test doesn't depend on the clock ticking
  // between two statements (PGlite's clock moves in whole milliseconds).
  await db.query(
    `insert into launchpad.staff (id, name, role, department_id, vacant, created_at, updated_at)
     values ('test-touch', 'Test Touch', 'Test role', 'sales', false, '2000-01-01', '2000-01-01')`,
  );
  await db.query("update launchpad.staff set role = 'Another role' where id = 'test-touch'");
  const [row] = await db.query<{ moved: boolean }>(
    "select updated_at > '2000-01-02'::timestamptz as moved from launchpad.staff where id = 'test-touch'",
  );
  assert.equal(row.moved, true);
});

test("leave: Other needs a note, and a request can't end before it starts", async () => {
  await addStaff(db, "test-leaver");
  const file = (type: string, start: string, end: string, note: string | null) =>
    db.query(
      `insert into launchpad.leave_requests (staff_id, type, starts_on, ends_on, days, note)
       values ('test-leaver', $1, $2, $3, 1, $4)`,
      [type, start, end, note],
    );
  await assert.rejects(file("Other", "2026-10-12", "2026-10-12", null), /check/i);
  await assert.rejects(file("Vacation", "2026-10-12", "2026-10-09", null), /check/i);
  await file("Other", "2026-10-12", "2026-10-12", "Moving house");
  await file("Vacation", "2026-10-13", "2026-10-14", null);
});

test("pay: one current payment method per person", async () => {
  await addStaff(db, "test-payee");
  const add = () =>
    db.query(
      "insert into launchpad.payment_methods (staff_id, processor, details) values ('test-payee', 'wise', $1::jsonb)",
      [JSON.stringify({ email: "payee@example.com", accountName: "Test Payee" })],
    );
  await add();
  await assert.rejects(add(), /payment_methods_current|unique/i);
});

test("pay: an invoice is paid exactly when it has a paid date", async () => {
  await addStaff(db, "test-invoicer");
  const insert = (status: string, paidOn: string | null) =>
    db.query(
      `insert into launchpad.staff_invoices (staff_id, number, issued_on, sender, status, paid_on)
       values ('test-invoicer', $1, '2026-10-04', '{}'::jsonb, $2, $3)`,
      [`test-${status}-${paidOn ?? "none"}`, status, paidOn],
    );
  await assert.rejects(insert("paid", null), /check/i);
  await assert.rejects(insert("pending", "2026-10-07"), /check/i);
  await insert("paid", "2026-10-07");
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node --import tsx --test src/server/db/people-pay-schema.test.ts`
Expected: FAIL, `relation "launchpad.departments" does not exist`.

- [ ] **Step 3: Write the people and access migration**

Create `supabase/migrations/20261008000400_launchpad_people_access.sql`:

```sql
-- People, access and leave: what HR, Admin and the Employee portal own. Staff rows
-- carry work fields only (the roster's rule: no birthdays, folder links or remarks),
-- and keep today's org-chart ids (jan-kane-reroma) so nothing that links to them breaks.

create table launchpad.departments (
  id text primary key,
  name text not null,
  head_staff_id text,
  sort smallint not null default 0
);
insert into launchpad.departments (id, name, sort) values
  ('leadership', 'Leadership', 1),
  ('finance', 'Finance', 2),
  ('sales', 'Sales', 3),
  ('marketing', 'Marketing', 4),
  ('operations', 'Operations', 5),
  ('it', 'Information Technology', 6),
  ('accounting', 'Accounting', 7),
  ('executive', 'Executive Office', 8);

create table launchpad.staff (
  id text primary key check (id ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  -- Null while the seat is vacant.
  name text,
  preferred_name text,
  role text not null,
  company text,
  division text,
  brand text check (brand in ('homes', 'financial', 'wealth')),
  department_id text references launchpad.departments (id),
  location text,
  reports_to text references launchpad.staff (id) deferrable initially deferred,
  link text check (link in ('peer', 'assistant')),
  team text,
  employment_type text,
  probation text,
  start_date date,
  confirmation_date date,
  end_date date,
  status text not null default 'active' check (status in ('active', 'pending', 'inactive')),
  vacant boolean not null default false,
  folder_on_file boolean not null default false,
  note text,
  -- The Launchpad sign-in. Today's are placeholders (first@localegroup.au).
  work_email text,
  hubspot_owner_id bigint unique,
  monday_user_id bigint unique,
  hubstaff_user_id bigint unique,
  source text not null default 'org_seed' check (source in ('org_seed', 'roster', 'manual')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (vacant = (name is null))
);
create unique index staff_work_email on launchpad.staff (lower(work_email)) where work_email is not null;
create index staff_department on launchpad.staff (department_id);

alter table launchpad.departments
  add constraint departments_head_staff_fk
  foreign key (head_staff_id) references launchpad.staff (id) deferrable initially deferred;

-- Other spellings of a person, lower-cased and trimmed: Monday's free-text sales
-- rep column, HubSpot owners, HomeScope's staff picker.
create table launchpad.staff_aliases (
  alias text primary key check (alias = lower(btrim(alias)) and alias <> ''),
  staff_id text not null references launchpad.staff (id) on delete cascade,
  source text not null default 'manual' check (source in ('setup', 'manual')),
  created_at timestamptz not null default now()
);

-- Dated pay rates. A future effective_from is a booked change.
create table launchpad.pay_rates (
  id uuid primary key default gen_random_uuid(),
  staff_id text not null references launchpad.staff (id) on delete cascade,
  hourly numeric(10, 2) not null check (hourly >= 0),
  overtime numeric(10, 2) not null check (overtime >= 0),
  currency char(3) not null default 'AUD',
  effective_from date not null,
  set_by text,
  created_at timestamptz not null default now(),
  unique (staff_id, effective_from)
);

create table launchpad.one_off_payments (
  id uuid primary key default gen_random_uuid(),
  staff_id text not null references launchpad.staff (id) on delete cascade,
  kind text not null check (kind in ('bonus', 'commission', 'overtime', 'reimbursement', 'back_pay', 'other')),
  amount numeric(12, 2) not null check (amount > 0),
  currency char(3) not null default 'AUD',
  hours numeric(6, 2),
  rate numeric(10, 2),
  note text,
  pay_on date not null,
  status text not null default 'requested' check (status in ('requested', 'paid', 'cancelled')),
  requested_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- A sign-in: a staff member, or an off-roster account (staff_id null).
create table launchpad.app_users (
  id uuid primary key default gen_random_uuid(),
  staff_id text unique references launchpad.staff (id) on delete set null,
  email text not null,
  display_name text,
  -- Supabase Auth's user id, once sign-in exists.
  auth_user_id uuid unique,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index app_users_email on launchpad.app_users (lower(email));

-- The dashboards and their rail sections (src/components/shell/dashboards.ts).
create table launchpad.modules (
  id text primary key,
  label text not null,
  space text not null default 'launchpad' check (space in ('launchpad', 'portal')),
  sort smallint not null default 0
);

create table launchpad.module_sections (
  key text primary key,
  module_id text not null references launchpad.modules (id) on delete cascade,
  label text not null,
  sort smallint not null default 0
);

-- One role per dashboard (Admin > Roles and permissions).
create table launchpad.role_grants (
  app_user_id uuid not null references launchpad.app_users (id) on delete cascade,
  module_id text not null references launchpad.modules (id) on delete cascade,
  granted_by text,
  granted_at timestamptz not null default now(),
  primary key (app_user_id, module_id)
);

create table launchpad.section_access (
  app_user_id uuid not null references launchpad.app_users (id) on delete cascade,
  section_key text not null references launchpad.module_sections (key) on delete cascade,
  access text not null check (access in ('hidden', 'view', 'edit')),
  updated_by text,
  updated_at timestamptz not null default now(),
  primary key (app_user_id, section_key)
);

create table launchpad.leave_requests (
  id uuid primary key default gen_random_uuid(),
  staff_id text not null references launchpad.staff (id) on delete cascade,
  type text not null check (type in ('Vacation', 'Sick', 'Personal', 'Bereavement', 'Other')),
  starts_on date not null,
  ends_on date not null,
  days numeric(4, 1) not null check (days > 0),
  note text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'declined', 'cancelled')),
  approver_staff_id text references launchpad.staff (id),
  balance_before numeric(5, 1),
  filed_at timestamptz not null default now(),
  decided_by text,
  decided_at timestamptz,
  decision_note text,
  updated_at timestamptz not null default now(),
  check (ends_on >= starts_on),
  check (type <> 'Other' or (note is not null and btrim(note) <> ''))
);
create index leave_requests_staff on launchpad.leave_requests (staff_id, starts_on desc);
create index leave_requests_waiting on launchpad.leave_requests (approver_staff_id) where status = 'pending';

create table launchpad.leave_allowances (
  staff_id text not null references launchpad.staff (id) on delete cascade,
  year smallint not null,
  type text not null check (type in ('Vacation', 'Sick', 'Personal')),
  days numeric(4, 1) not null check (days >= 0),
  primary key (staff_id, year, type)
);

select launchpad.secure_schemas();
```

- [ ] **Step 4: Write the pay and accounts migration**

Create `supabase/migrations/20261008000500_launchpad_pay_accounts.sql`:

```sql
-- Staff pay (invoices, payment methods), Accounting's pay runs, and Accounts'
-- builder invoices and expense claims.

create table launchpad.payment_methods (
  id uuid primary key default gen_random_uuid(),
  staff_id text not null references launchpad.staff (id) on delete cascade,
  processor text not null check (processor in ('bank', 'wise', 'wire')),
  -- The processor's fields: bank (account name, BSB, account number); wise (email,
  -- account name); wire (account name, bank, account number, SWIFT, bank address).
  details jsonb not null,
  is_current boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index payment_methods_current on launchpad.payment_methods (staff_id) where is_current;

create table launchpad.invoice_senders (
  staff_id text primary key references launchpad.staff (id) on delete cascade,
  entity_name text,
  name text,
  address text,
  city_state_zip text,
  country text,
  logo_path text,
  updated_at timestamptz not null default now()
);

create table launchpad.staff_invoices (
  id uuid primary key default gen_random_uuid(),
  staff_id text not null references launchpad.staff (id),
  number text not null unique,
  issued_on date not null,
  due_on date,
  -- The Sunday the billed pay week starts on, when it bills one.
  pay_week_start date,
  -- Snapshots, so a later profile edit doesn't rewrite a sent invoice.
  sender jsonb not null,
  payment jsonb,
  notes text,
  currency char(3) not null default 'AUD',
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'paid', 'retracted')),
  decision_note text,
  decided_by text,
  decided_at timestamptz,
  paid_on date,
  -- Pesos per A$1 on the pay run that paid it, and what it came to.
  paid_rate numeric(10, 4),
  paid_php numeric(14, 2),
  sent_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((status = 'paid') = (paid_on is not null))
);
create index staff_invoices_staff on launchpad.staff_invoices (staff_id, issued_on desc);

create table launchpad.staff_invoice_lines (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references launchpad.staff_invoices (id) on delete cascade,
  position smallint not null,
  description text not null,
  notes text,
  qty numeric(10, 2) not null,
  rate numeric(10, 2) not null,
  tax_pct numeric(5, 2) not null default 0,
  auto text check (auto in ('regular', 'overtime')),
  unique (invoice_id, position)
);

create table launchpad.invoice_alerts (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references launchpad.staff_invoices (id) on delete cascade,
  kind text not null check (kind in ('received', 'approved', 'rejected', 'paid', 'unpaid')),
  at timestamptz not null default now(),
  read_at timestamptz
);

create table launchpad.pay_runs (
  id uuid primary key default gen_random_uuid(),
  run_on date not null,
  -- Pesos per A$1, set by Accounting for the run.
  fx_rate numeric(10, 4) not null check (fx_rate between 10 and 100),
  run_by text,
  status text not null default 'draft' check (status in ('draft', 'dispatched')),
  payees integer,
  skipped integer,
  total_aud numeric(14, 2),
  total_php numeric(16, 2),
  dispatched_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table launchpad.pay_run_invoices (
  pay_run_id uuid not null references launchpad.pay_runs (id) on delete cascade,
  invoice_id uuid not null unique references launchpad.staff_invoices (id),
  primary key (pay_run_id, invoice_id)
);

create table launchpad.pay_run_holds (
  pay_run_id uuid not null references launchpad.pay_runs (id) on delete cascade,
  staff_id text not null references launchpad.staff (id),
  reason text not null,
  primary key (pay_run_id, staff_id)
);

create table launchpad.payouts (
  id uuid primary key default gen_random_uuid(),
  pay_run_id uuid not null references launchpad.pay_runs (id) on delete cascade,
  staff_id text not null references launchpad.staff (id),
  aud numeric(14, 2) not null,
  php numeric(16, 2) not null,
  method jsonb not null,
  status text not null default 'pending' check (status in ('pending', 'paid', 'problem')),
  sent_ref text,
  sent_from text,
  sent_on date,
  sent_by text,
  problem text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (pay_run_id, staff_id)
);

create table launchpad.payout_invoices (
  payout_id uuid not null references launchpad.payouts (id) on delete cascade,
  invoice_id uuid not null references launchpad.staff_invoices (id),
  primary key (payout_id, invoice_id)
);

-- Accounts: the draft and final invoices Locale sends builders. Amounts exclude GST.
create table launchpad.builder_invoices (
  id uuid primary key default gen_random_uuid(),
  number text not null unique,
  job_number text,
  monday_item_id bigint,
  hubspot_deal_id bigint,
  client_label text,
  builder text not null,
  stage text not null,
  amount_ex_gst numeric(12, 2) not null check (amount_ex_gst >= 0),
  note text,
  status text not null default 'draft' check (status in ('draft', 'approved', 'paid')),
  approved_by text,
  approved_at timestamptz,
  xero_invoice_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table launchpad.expense_claims (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  staff_id text references launchpad.staff (id),
  amount numeric(12, 2) not null check (amount > 0),
  account_code text,
  account_name text,
  status text not null default 'awaiting_approval'
    check (status in ('awaiting_approval', 'approved', 'paid', 'declined')),
  decided_by text,
  decided_at timestamptz,
  receipt_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

select launchpad.secure_schemas();
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `node --import tsx --test src/server/db/people-pay-schema.test.ts src/server/db/schema.test.ts`
Expected: PASS, 14 tests.

- [ ] **Step 6: Checkpoint**

Run: `npm test` and `git status --short`. Expected new files: the two migrations, `src/server/db/test-fixtures.ts`, `src/server/db/people-pay-schema.test.ts`. Don't commit.

---

### Task 5: Sales, submissions, HomeScope, tickets, portals and shared tables

> **Changed in review (2026-10-08).** In the repo:
> - seven edited tables carry trigger-kept `created_at` and `updated_at`;
> - `commission_rules` has `set_by` and a checked `buyer_type`, and the knowledge categories are checked;
> - `todos` has `due_on` and `set_by`, `audit_log` has `job_ids`, and `submissions` has `deal`;
> - document state matches its file;
> - replies can't be blank;
> - four lookup indexes are added.
>
> Copy from the repo, not from here.


**Files:**
- Create: `supabase/migrations/20261008000600_launchpad_sales.sql`
- Create: `supabase/migrations/20261008000700_launchpad_work_portals.sql`
- Test: `src/server/db/sales-work-schema.test.ts`

**Interfaces:**
- Consumes: `migratedTestDb()`, `addStaff()`.
- Produces:
  - SQL, sales: `launchpad.weekly_forecasts`, `sales_targets`, `commission_rules`, `discount_approvals`, `todos`, `submissions` (number `S-200` up), `submission_documents`, `quotes` (number `HS-1001` up, `prepared_by` required), `homescope_catalogues`.
  - SQL, tickets: `launchpad.ticket_projects`, `tickets` (`ticket_no` from 100), `ticket_replies`, `ticket_events`, `it_tickets` (`ticket_no` from 1).
  - SQL, portals: `launchpad.portal_updates`, `portal_update_photos`, `portal_messages`, `portal_message_reads`, `client_consents`.
  - SQL, shared: `launchpad.notifications` (unique `dedupe_key`), `audit_log`, `announcements`, `knowledge_materials`.

- [ ] **Step 1: Write the failing test**

Create `src/server/db/sales-work-schema.test.ts`:

```ts
import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { migratedTestDb } from "./pglite";
import { addStaff } from "./test-fixtures";
import type { Db } from "./types";

let db: Db;
let close: () => Promise<void>;
before(async () => {
  ({ db, close } = await migratedTestDb());
  await addStaff(db, "test-rep-a");
});
after(async () => close());

test("quotes: numbered HS-1001 upward, and never without a rep", async () => {
  const add = (by: string | null) =>
    db.query<{ number: string }>(
      "insert into launchpad.quotes (prepared_by, builder, estimate) values ($1, 'Test Builder', '{}'::jsonb) returning number",
      [by],
    );
  assert.equal((await add("test-rep-a"))[0].number, "HS-1001");
  assert.equal((await add("test-rep-a"))[0].number, "HS-1002");
  await assert.rejects(add(null), /null value/i);
});

test("submissions: a document sent back for a fix says why, and each ref appears once", async () => {
  const [s] = await db.query<{ id: string; number: string }>(
    "insert into launchpad.submissions (client_label, builder) values ('Test Client A', 'Test Builder') returning id, number",
  );
  assert.equal(s.number, "S-200");
  const doc = (ref: string, state: string, note: string | null) =>
    db.query(
      `insert into launchpad.submission_documents (submission_id, ref, category, name, state, fix_note)
       values ($1, $2, 'build', 'Test document', $3, $4)`,
      [s.id, ref, state, note],
    );
  await assert.rejects(doc("DOC1", "fix", null), /check/i);
  await doc("DOC1", "fix", "Unsigned on the last page");
  await assert.rejects(doc("DOC1", "uploaded", null), /unique|duplicate/i);
});

test("sales: one team-wide target per period, even with no rep", async () => {
  const add = () =>
    db.query("insert into launchpad.sales_targets (staff_id, period, period_start, target) values (null, 'month', '2026-10-01', 2)");
  await add();
  await assert.rejects(add(), /unique|duplicate/i);
});

test("tickets: numbered from 100, with the board's priorities only", async () => {
  const add = (priority: string) =>
    db.query<{ ticket_no: number }>(
      "insert into launchpad.tickets (title, raised_by, priority) values ('Test ticket', 'Test Rep A', $1) returning ticket_no",
      [priority],
    );
  assert.equal((await add("high"))[0].ticket_no, 100);
  assert.equal((await add("urgent"))[0].ticket_no, 101);
  await assert.rejects(add("someday"), /check/i);
});

test("notifications: a dedupe key is written once", async () => {
  const add = () =>
    db.query(
      "insert into launchpad.notifications (recipient, event, message, dedupe_key) values ('test-rep-a', 'test', 'Hello', 'test:1')",
    );
  await add();
  await assert.rejects(add(), /unique|duplicate/i);
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node --import tsx --test src/server/db/sales-work-schema.test.ts`
Expected: FAIL, `relation "launchpad.quotes" does not exist`.

- [ ] **Step 3: Write the sales migration**

Create `supabase/migrations/20261008000600_launchpad_sales.sql`:

```sql
-- Sales: forecasts, targets, commission rules, discount approvals, to-dos, deal
-- submissions and HomeScope quotes. Targets and commission rules start empty: the
-- prototype's figures are placeholders (Sean sets targets, Alison the formula).

create table launchpad.weekly_forecasts (
  staff_id text not null references launchpad.staff (id) on delete cascade,
  week_ending date not null,
  builder text not null,
  forecast smallint not null check (forecast >= 0),
  submitted_at timestamptz not null default now(),
  primary key (staff_id, week_ending, builder)
);

create table launchpad.sales_targets (
  id uuid primary key default gen_random_uuid(),
  -- Null: a team-wide target.
  staff_id text references launchpad.staff (id) on delete cascade,
  period text not null check (period in ('month', 'quarter')),
  period_start date not null,
  target smallint not null check (target >= 0),
  set_by text,
  set_at timestamptz not null default now(),
  unique nulls not distinct (staff_id, period, period_start)
);

create table launchpad.commission_rules (
  id uuid primary key default gen_random_uuid(),
  buyer_type text not null,
  base_amount numeric(12, 2) not null check (base_amount >= 0),
  discount_share numeric(4, 3) not null default 0 check (discount_share between 0 and 1),
  effective_from date not null,
  note text,
  unique (buyer_type, effective_from)
);

create table launchpad.discount_approvals (
  id uuid primary key default gen_random_uuid(),
  hubspot_deal_id bigint,
  client_label text not null,
  plan text,
  discount numeric(12, 2) not null check (discount > 0),
  company_contribution numeric(12, 2) not null default 0 check (company_contribution >= 0),
  requested_by text references launchpad.staff (id),
  requested_at timestamptz not null default now(),
  status text not null default 'pending' check (status in ('pending', 'approved', 'declined')),
  decided_by text,
  decided_at timestamptz,
  note text,
  check ((status = 'pending') = (decided_at is null))
);

create table launchpad.todos (
  id uuid primary key default gen_random_uuid(),
  staff_id text not null references launchpad.staff (id) on delete cascade,
  body text not null check (btrim(body) <> ''),
  done_at timestamptz,
  created_at timestamptz not null default now()
);

create sequence launchpad.submission_no_seq start 200;

create table launchpad.submissions (
  id uuid primary key default gen_random_uuid(),
  number text not null unique default ('S-' || nextval('launchpad.submission_no_seq')),
  hubspot_deal_id bigint,
  client_label text not null,
  builder text not null,
  rep_staff_id text references launchpad.staff (id),
  status text not null default 'draft' check (status in ('draft', 'review', 'changes', 'approved')),
  submitted_at timestamptz,
  decided_by text,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- One row per item on the builder's checklist. The file itself is in launchpad-files.
create table launchpad.submission_documents (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references launchpad.submissions (id) on delete cascade,
  ref text not null,
  category text not null check (category in ('build', 'land', 'finance')),
  name text not null,
  required boolean not null default true,
  file_path text,
  original_filename text,
  -- The date on the document, for its validity period.
  dated_on date,
  state text not null default 'missing' check (state in ('missing', 'uploaded', 'verified', 'fix')),
  fix_note text,
  uploaded_by text,
  uploaded_at timestamptz,
  verified_by text,
  verified_at timestamptz,
  unique (submission_id, ref),
  check (state <> 'fix' or (fix_note is not null and btrim(fix_note) <> ''))
);

create sequence launchpad.quote_no_seq start 1001;

create table launchpad.quotes (
  id uuid primary key default gen_random_uuid(),
  number text not null unique default ('HS-' || nextval('launchpad.quote_no_seq')),
  -- Alison's rule: no quote without the rep who prepared it.
  prepared_by text not null references launchpad.staff (id),
  builder text not null,
  model text,
  spec_range text,
  elevation text,
  address text,
  client_names text,
  total numeric(12, 2),
  -- The whole estimate (contacts, lot, site costs, lines) as the HomeScope screens hold it.
  estimate jsonb not null,
  pdf_options jsonb,
  generated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- A builder's HomeScope catalogue: today a snapshot, later read from Monday's price boards.
create table launchpad.homescope_catalogues (
  id uuid primary key default gen_random_uuid(),
  builder text not null,
  captured_at timestamptz not null,
  source text not null check (source in ('snapshot', 'monday')),
  data jsonb not null,
  is_current boolean not null default true,
  created_at timestamptz not null default now()
);
create unique index homescope_catalogues_current on launchpad.homescope_catalogues (builder) where is_current;

select launchpad.secure_schemas();
```

- [ ] **Step 4: Write the tickets, portals and shared migration**

Create `supabase/migrations/20261008000700_launchpad_work_portals.sql`:

```sql
-- Tickets (the board and IT's help desk), the Client and Developer portals, and
-- what every module shares: notifications, the audit log, announcements, knowledge.

create table launchpad.ticket_projects (
  id text primary key check (id ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null,
  owner_staff_id text references launchpad.staff (id),
  state text not null default 'in_build' check (state in ('in_build', 'validation', 'deploying')),
  created_at timestamptz not null default now()
);

create sequence launchpad.ticket_no_seq start 100;

create table launchpad.tickets (
  id uuid primary key default gen_random_uuid(),
  -- Shown as LP-<ticket_no>.
  ticket_no integer not null unique default nextval('launchpad.ticket_no_seq'),
  title text not null check (btrim(title) <> ''),
  details text,
  module_id text,
  project_id text references launchpad.ticket_projects (id),
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high', 'urgent')),
  status text not null default 'todo' check (status in ('todo', 'in_progress', 'testing', 'done')),
  raised_by text not null,
  assignee_staff_id text references launchpad.staff (id),
  archived_at timestamptz,
  archived_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table launchpad.ticket_replies (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references launchpad.tickets (id) on delete cascade,
  author text not null,
  body text not null,
  at timestamptz not null default now()
);

create table launchpad.ticket_events (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references launchpad.tickets (id) on delete cascade,
  actor text not null,
  at timestamptz not null default now(),
  action text not null check (action in ('created', 'updated', 'moved', 'archived', 'restored')),
  -- [{ "field", "from", "to" }]
  changes jsonb
);

create sequence launchpad.it_ticket_no_seq start 1;

-- IT's help desk. Pablo's system adds email intake (source) and ideas (kind).
create table launchpad.it_tickets (
  id uuid primary key default gen_random_uuid(),
  ticket_no integer not null unique default nextval('launchpad.it_ticket_no_seq'),
  category text not null,
  summary text not null,
  description text,
  requester text not null,
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high')),
  status text not null default 'open' check (status in ('open', 'in_progress', 'resolved')),
  kind text not null default 'request' check (kind in ('request', 'incident', 'idea')),
  source text not null default 'portal' check (source in ('portal', 'email')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz
);

-- A builder's site update on a job, posted in the Developer portal.
create table launchpad.portal_updates (
  id uuid primary key default gen_random_uuid(),
  monday_item_id bigint,
  job_ref text not null,
  builder text,
  milestone text,
  note text,
  posted_by text,
  posted_at timestamptz not null default now()
);

create table launchpad.portal_update_photos (
  id uuid primary key default gen_random_uuid(),
  update_id uuid not null references launchpad.portal_updates (id) on delete cascade,
  file_path text not null,
  created_at timestamptz not null default now()
);

create table launchpad.portal_messages (
  id uuid primary key default gen_random_uuid(),
  monday_item_id bigint,
  job_ref text not null,
  sender_kind text not null check (sender_kind in ('client', 'consultant', 'operations', 'builder')),
  sender_name text not null,
  body text not null check (btrim(body) <> ''),
  sent_at timestamptz not null default now()
);

create table launchpad.portal_message_reads (
  message_id uuid not null references launchpad.portal_messages (id) on delete cascade,
  reader text not null,
  read_at timestamptz not null default now(),
  primary key (message_id, reader)
);

-- The client's answer on learning from their journey after the 7-year retention.
create table launchpad.client_consents (
  job_ref text primary key,
  learn_after_retention boolean not null,
  decided_at timestamptz not null default now()
);

create table launchpad.notifications (
  id uuid primary key default gen_random_uuid(),
  -- Null: everyone with the module.
  recipient text references launchpad.staff (id) on delete cascade,
  module_id text,
  kind text not null default 'ok' check (kind in ('ok', 'red')),
  event text not null,
  message text not null,
  link text,
  entity_type text,
  entity_id text,
  dedupe_key text unique,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  resolved_at timestamptz
);
create index notifications_inbox on launchpad.notifications (recipient, created_at desc) where resolved_at is null;

create table launchpad.audit_log (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  actor text not null,
  action_type text not null,
  action text not null,
  detail text,
  target_systems text[] not null default '{}',
  entity_type text,
  entity_id text,
  before_value jsonb,
  after_value jsonb
);
create index audit_log_entity on launchpad.audit_log (entity_type, entity_id, at desc);

create table launchpad.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  meta text,
  pinned boolean not null default false,
  published_at timestamptz not null default now(),
  created_by text
);

create table launchpad.knowledge_materials (
  id uuid primary key default gen_random_uuid(),
  category text not null,
  title text not null,
  meta text,
  kind text not null check (kind in ('doc', 'video')),
  file_path text,
  url text,
  created_at timestamptz not null default now()
);

select launchpad.secure_schemas();
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `node --import tsx --test src/server/db/sales-work-schema.test.ts src/server/db/schema.test.ts`
Expected: PASS, 12 tests.

- [ ] **Step 6: Checkpoint**

Run: `npm test` and `git status --short`. Expected new files: the two migrations and `src/server/db/sales-work-schema.test.ts`. Don't commit.

---

### Task 6: Exclusive Land: lots, holds and their rules

> **Changed in review (2026-10-08).** In the repo:
> - `settle_land_holds` takes lots in id order with `for update skip locked`, so it never waits and can't deadlock;
> - `release_hold` ends a queued hold before settling, so no false "hold started" notice;
> - two named checks tie an outcome to whether the hold started;
> - `mark_lot_sold` raises `land_hold_not_open` for a hold ended elsewhere.
>
> Copy from the repo, not from here.


**Files:**
- Create: `supabase/migrations/20261008000800_exclusive_land.sql`
- Test: `src/server/db/land.test.ts`

**Interfaces:**
- Consumes: `migratedTestDb()`, `addStaff()`, `launchpad.notifications` (Task 5).
- Produces:
  - Tables: `launchpad.land_lots` and `launchpad.land_holds`.
  - The view `launchpad.land_lot_board`: one row per lot that isn't withdrawn, with `holds jsonb` (open holds, active first: `[{ id, staffId, name, client, note, queuedAt, startedAt, expiresAt }]`) and `sold_by_name`.
  - `launchpad.place_hold(p_lot_id uuid, p_staff_id text, p_client text default null, p_note text default null, p_now timestamptz default now()) returns launchpad.land_holds`.
  - `launchpad.release_hold(p_hold_id uuid, p_staff_id text, p_now timestamptz default now()) returns void`.
  - `launchpad.mark_lot_sold(p_hold_id uuid, p_staff_id text, p_client text default null, p_now timestamptz default now()) returns void`.
  - `launchpad.settle_land_holds(p_lot_id uuid default null, p_now timestamptz default now()) returns setof launchpad.land_holds` (the holds it started).
  - Errors raised: `land_lot_not_found`, `land_lot_not_available`, `land_hold_already_yours`, `land_hold_queue_full`, `land_hold_not_open`, `land_hold_not_yours`, `land_hold_not_active`.

- [ ] **Step 1: Write the failing test**

Create `src/server/db/land.test.ts`:

```ts
import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { migratedTestDb } from "./pglite";
import { addStaff } from "./test-fixtures";
import type { Db } from "./types";

let db: Db;
let close: () => Promise<void>;
before(async () => {
  ({ db, close } = await migratedTestDb());
  for (const id of ["test-rep-a", "test-rep-b", "test-rep-c", "test-rep-d"]) await addStaff(db, id);
});
after(async () => close());

const T0 = "2026-10-08T00:00:00.000Z";
const at = (hours: number) => new Date(Date.parse(T0) + hours * 3_600_000).toISOString();

interface Hold {
  id: string;
  staff_id: string;
  started_at: Date | null;
  expires_at: Date | null;
  ended_at: Date | null;
  outcome: string | null;
}

let lotCount = 0;
async function newLot(): Promise<string> {
  lotCount += 1;
  const [row] = await db.query<{ id: string }>(
    "insert into launchpad.land_lots (lot_label, source) values ($1, 'launchpad') returning id",
    [`Lot ${lotCount} Test Street`],
  );
  return row.id;
}

async function place(lot: string, staff: string, now: string, client: string | null = null): Promise<Hold> {
  const [row] = await db.query<Hold>("select * from launchpad.place_hold($1::uuid, $2, $3, null, $4::timestamptz)", [
    lot, staff, client, now,
  ]);
  return row;
}

const holds = (lot: string) =>
  db.query<Hold>("select * from launchpad.land_holds where lot_id = $1::uuid order by queued_at, id", [lot]);

test("land: the first hold starts at once and runs 24 hours", async () => {
  const lot = await newLot();
  const h = await place(lot, "test-rep-a", T0, "Test Client A");
  assert.equal(h.started_at?.toISOString(), T0);
  assert.equal(h.expires_at?.toISOString(), at(24));
});

test("land: two reps on one lot, one straight after the other: one holds, the other queues (Review Focus 1)", async () => {
  const lot = await newLot();
  await place(lot, "test-rep-a", T0);
  const second = await place(lot, "test-rep-b", at(0.01));
  assert.equal(second.started_at, null);
  const open = (await holds(lot)).filter((h) => h.ended_at === null);
  assert.equal(open.filter((h) => h.started_at !== null).length, 1);
});

test("land: the database itself refuses a second active hold on one lot (Review Focus 1)", async () => {
  // PGlite has one connection, so two truly concurrent place_hold calls can't be staged
  // here. Under real concurrency the lot's row lock serialises them, and this index is
  // the last line: even a write that skipped the functions can't make two active holds.
  const lot = await newLot();
  await place(lot, "test-rep-a", T0);
  await assert.rejects(
    db.query(
      `insert into launchpad.land_holds (lot_id, staff_id, queued_at, started_at, expires_at)
       values ($1::uuid, 'test-rep-b', $2::timestamptz, $2::timestamptz, $2::timestamptz + interval '24 hours')`,
      [lot, at(1)],
    ),
    /land_holds_one_active/,
  );
});

test("land: a rep can't hold twice, and the queue stops at three", async () => {
  const lot = await newLot();
  await place(lot, "test-rep-a", T0);
  await assert.rejects(place(lot, "test-rep-a", at(1)), /land_hold_already_yours/);
  await place(lot, "test-rep-b", at(1));
  await place(lot, "test-rep-c", at(2));
  await assert.rejects(place(lot, "test-rep-d", at(3)), /land_hold_queue_full/);
});

test("land: releasing the active hold starts the next with a fresh 24 hours, and tells that rep", async () => {
  const lot = await newLot();
  const first = await place(lot, "test-rep-a", T0);
  await place(lot, "test-rep-b", at(1));
  await db.query("select launchpad.release_hold($1::uuid, 'test-rep-a', $2::timestamptz)", [first.id, at(5)]);
  const [a, b] = await holds(lot);
  assert.equal(a.outcome, "released");
  assert.equal(b.started_at?.toISOString(), at(5));
  assert.equal(b.expires_at?.toISOString(), at(29));
  const notes = await db.query<{ recipient: string }>(
    "select recipient from launchpad.notifications where event = 'land_hold_started' and entity_id = $1",
    [b.id],
  );
  assert.deepEqual(notes.map((n) => n.recipient), ["test-rep-b"]);
});

test("land: settling lapses an expired hold and starts the next from the time of settling", async () => {
  const lot = await newLot();
  await place(lot, "test-rep-a", T0);
  await place(lot, "test-rep-b", at(2));
  const started = await db.query<Hold>("select * from launchpad.settle_land_holds(null, $1::timestamptz)", [at(30)]);
  assert.ok(started.some((h) => h.staff_id === "test-rep-b"));
  const [a, b] = await holds(lot);
  assert.equal(a.outcome, "lapsed");
  assert.equal(a.ended_at?.toISOString(), at(24));
  assert.equal(b.started_at?.toISOString(), at(30));
});

test("land: placing a hold settles first, so a lapsed holder doesn't block the lot", async () => {
  const lot = await newLot();
  await place(lot, "test-rep-a", T0);
  const b = await place(lot, "test-rep-b", at(25));
  assert.equal(b.started_at?.toISOString(), at(25));
});

test("land: only the active holder sells, the queue ends, and a sold lot takes no holds", async () => {
  const lot = await newLot();
  const a = await place(lot, "test-rep-a", T0, "Test Client A");
  const b = await place(lot, "test-rep-b", at(1));
  await assert.rejects(
    db.query("select launchpad.mark_lot_sold($1::uuid, 'test-rep-b', null, $2::timestamptz)", [a.id, at(2)]),
    /land_hold_not_yours/,
  );
  await assert.rejects(
    db.query("select launchpad.mark_lot_sold($1::uuid, 'test-rep-b', null, $2::timestamptz)", [b.id, at(2)]),
    /land_hold_not_active/,
  );
  await db.query("select launchpad.mark_lot_sold($1::uuid, 'test-rep-a', null, $2::timestamptz)", [a.id, at(3)]);
  const [lotRow] = await db.query<{ sale_status: string; sold_by: string; sold_client: string }>(
    "select sale_status, sold_by, sold_client from launchpad.land_lots where id = $1::uuid",
    [lot],
  );
  assert.deepEqual(lotRow, { sale_status: "sold", sold_by: "test-rep-a", sold_client: "Test Client A" });
  const after = await holds(lot);
  assert.deepEqual(after.map((h) => h.outcome), ["converted", "lot_sold"]);
  await assert.rejects(place(lot, "test-rep-c", at(4)), /land_lot_not_available/);
});

test("land: an expired holder can't sell", async () => {
  const lot = await newLot();
  const a = await place(lot, "test-rep-a", T0);
  await assert.rejects(
    db.query("select launchpad.mark_lot_sold($1::uuid, 'test-rep-a', null, $2::timestamptz)", [a.id, at(25)]),
    /land_hold_not_active/,
  );
});

test("land: releasing a hold that has already run out records it as lapsed", async () => {
  const lot = await newLot();
  const a = await place(lot, "test-rep-a", T0);
  await place(lot, "test-rep-b", at(1));
  await db.query("select launchpad.release_hold($1::uuid, 'test-rep-a', $2::timestamptz)", [a.id, at(30)]);
  const [first, next] = await holds(lot);
  assert.equal(first.outcome, "lapsed");
  assert.equal(first.ended_at?.toISOString(), at(24));
  assert.equal(next.started_at?.toISOString(), at(30));
});

test("land: leaving the queue doesn't disturb the holder", async () => {
  const lot = await newLot();
  await place(lot, "test-rep-a", T0);
  const b = await place(lot, "test-rep-b", at(1));
  await db.query("select launchpad.release_hold($1::uuid, 'test-rep-b', $2::timestamptz)", [b.id, at(2)]);
  const [a, left] = await holds(lot);
  assert.equal(left.outcome, "left_queue");
  assert.equal(a.ended_at, null);
});

test("land: the board view lists open holds, active first, with names", async () => {
  const lot = await newLot();
  await place(lot, "test-rep-a", T0, "Test Client A");
  await place(lot, "test-rep-b", at(1));
  const [row] = await db.query<{ holds: { staffId: string; name: string; client: string | null; startedAt: string | null }[] }>(
    "select holds from launchpad.land_lot_board where id = $1::uuid",
    [lot],
  );
  assert.deepEqual(row.holds.map((h) => [h.staffId, h.name, h.client, h.startedAt !== null]), [
    ["test-rep-a", "Test Rep A", "Test Client A", true],
    ["test-rep-b", "Test Rep B", null, false],
  ]);
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node --import tsx --test src/server/db/land.test.ts`
Expected: FAIL, `relation "launchpad.land_lots" does not exist`.

- [ ] **Step 3: Write the migration**

Create `supabase/migrations/20261008000800_exclusive_land.sql`:

```sql
-- Exclusive Land. Lots come from the Monday board, where Alison keeps adding them;
-- holds, the queue and sold status belong to Launchpad (decided 8 Oct). The rules
-- are functions that lock the lot's row, so two reps can't take the same hold.
-- p_now is a parameter only so tests can move the clock: callers leave it out.

create table launchpad.land_lots (
  id uuid primary key default gen_random_uuid(),
  monday_item_id bigint unique,
  source text not null default 'monday' check (source in ('monday', 'launchpad')),
  lot_label text not null,
  street text,
  suburb text,
  state text,
  estate text,
  developer text,
  -- Null: any builder.
  builder text,
  land_price numeric(12, 2),
  package_price numeric(12, 2),
  package_design text,
  area_sqm numeric(8, 2),
  frontage_m numeric(6, 2),
  zoning text,
  title_status text check (title_status in ('titled', 'untitled', 'delayed')),
  title_eta date,
  rebate_note text,
  -- The Monday board's own status label, as last mirrored. Shown, never obeyed.
  monday_status text,
  -- Set when the item left Monday while a hold was active, for the maintainer to see.
  monday_removed_at timestamptz,
  sale_status text not null default 'available' check (sale_status in ('available', 'sold', 'withdrawn')),
  sold_at timestamptz,
  sold_by text references launchpad.staff (id),
  sold_client text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((sale_status = 'sold') = (sold_at is not null))
);

create table launchpad.land_holds (
  id uuid primary key default gen_random_uuid(),
  lot_id uuid not null references launchpad.land_lots (id) on delete cascade,
  staff_id text not null references launchpad.staff (id),
  client_name text,
  note text,
  queued_at timestamptz not null default now(),
  -- Set when this becomes the lot's active hold. It then runs 24 hours.
  started_at timestamptz,
  expires_at timestamptz,
  ended_at timestamptz,
  outcome text check (outcome in ('lapsed', 'released', 'left_queue', 'converted', 'lot_sold', 'lot_withdrawn')),
  check ((ended_at is null) = (outcome is null)),
  check ((started_at is null) = (expires_at is null)),
  check (started_at is null or expires_at = started_at + interval '24 hours')
);
create unique index land_holds_one_active on launchpad.land_holds (lot_id)
  where ended_at is null and started_at is not null;
create unique index land_holds_one_per_rep on launchpad.land_holds (lot_id, staff_id)
  where ended_at is null;
create index land_holds_open on launchpad.land_holds (lot_id, queued_at) where ended_at is null;
create index land_holds_expiring on launchpad.land_holds (expires_at)
  where ended_at is null and started_at is not null;

-- Starts the first queued hold on a lot with no active one, and tells that rep.
-- Returns the hold it started, or null. Call with the lot's row locked.
create or replace function launchpad.start_next_hold(p_lot_id uuid, p_now timestamptz)
returns launchpad.land_holds
language plpgsql as $$
declare
  v_hold launchpad.land_holds;
  v_label text;
begin
  if exists (
    select 1 from launchpad.land_holds
    where lot_id = p_lot_id and ended_at is null and started_at is not null
  ) then
    return null;
  end if;
  select lot_label into v_label from launchpad.land_lots where id = p_lot_id and sale_status = 'available';
  if not found then
    return null;
  end if;
  update launchpad.land_holds h
     set started_at = p_now, expires_at = p_now + interval '24 hours'
   where h.id = (
     select q.id from launchpad.land_holds q
     where q.lot_id = p_lot_id and q.ended_at is null and q.started_at is null
     order by q.queued_at, q.id
     limit 1
   )
  returning h.* into v_hold;
  if v_hold.id is not null then
    insert into launchpad.notifications (recipient, module_id, kind, event, message, link, entity_type, entity_id, dedupe_key)
    values (
      v_hold.staff_id, 'consultant', 'red', 'land_hold_started',
      'Your hold on ' || v_label || ' has started. It runs for 24 hours.',
      '/consultant?tab=land', 'land_hold', v_hold.id::text, 'land_hold_started:' || v_hold.id::text
    )
    on conflict (dedupe_key) do nothing;
  end if;
  return v_hold;
end
$$;

-- Ends every active hold whose 24 hours are up and starts the next in its queue,
-- with a fresh 24 hours from p_now. Returns the holds it started. Runs on a
-- schedule, and first thing in every hold function, so a late schedule never
-- leaves a lapsed hold standing.
create or replace function launchpad.settle_land_holds(p_lot_id uuid default null, p_now timestamptz default now())
returns setof launchpad.land_holds
language plpgsql as $$
declare
  v_lot uuid;
  v_next launchpad.land_holds;
begin
  for v_lot in
    select distinct h.lot_id from launchpad.land_holds h
    where h.ended_at is null and h.started_at is not null and h.expires_at <= p_now
      and (p_lot_id is null or h.lot_id = p_lot_id)
  loop
    perform 1 from launchpad.land_lots where id = v_lot for update;
    update launchpad.land_holds
       set ended_at = expires_at, outcome = 'lapsed'
     where lot_id = v_lot and ended_at is null and started_at is not null and expires_at <= p_now;
    v_next := launchpad.start_next_hold(v_lot, p_now);
    if v_next.id is not null then
      return next v_next;
    end if;
  end loop;
end
$$;

create or replace function launchpad.place_hold(
  p_lot_id uuid,
  p_staff_id text,
  p_client text default null,
  p_note text default null,
  p_now timestamptz default now()
)
returns launchpad.land_holds
language plpgsql as $$
declare
  v_status text;
  v_open integer;
  v_active boolean;
  v_hold launchpad.land_holds;
begin
  select sale_status into v_status from launchpad.land_lots where id = p_lot_id for update;
  if not found then
    raise exception 'land_lot_not_found';
  end if;
  perform launchpad.settle_land_holds(p_lot_id, p_now);
  if v_status <> 'available' then
    raise exception 'land_lot_not_available';
  end if;
  if exists (
    select 1 from launchpad.land_holds
    where lot_id = p_lot_id and staff_id = p_staff_id and ended_at is null
  ) then
    raise exception 'land_hold_already_yours';
  end if;
  select count(*), coalesce(bool_or(started_at is not null), false)
    into v_open, v_active
    from launchpad.land_holds
   where lot_id = p_lot_id and ended_at is null;
  if v_open >= 3 then
    raise exception 'land_hold_queue_full';
  end if;
  insert into launchpad.land_holds (lot_id, staff_id, client_name, note, queued_at, started_at, expires_at)
  values (
    p_lot_id, p_staff_id, nullif(btrim(p_client), ''), nullif(btrim(p_note), ''), p_now,
    case when v_active then null else p_now end,
    case when v_active then null else p_now + interval '24 hours' end
  )
  returning * into v_hold;
  return v_hold;
end
$$;

-- The holder releasing their hold, or a queued rep leaving the queue.
create or replace function launchpad.release_hold(p_hold_id uuid, p_staff_id text, p_now timestamptz default now())
returns void
language plpgsql as $$
declare
  v_hold launchpad.land_holds;
begin
  select * into v_hold from launchpad.land_holds where id = p_hold_id;
  if not found or v_hold.ended_at is not null then
    raise exception 'land_hold_not_open';
  end if;
  if v_hold.staff_id <> p_staff_id then
    raise exception 'land_hold_not_yours';
  end if;
  perform 1 from launchpad.land_lots where id = v_hold.lot_id for update;
  -- Settle first, as every hold function does: a hold that has already run out is
  -- recorded as lapsed, not released, and the release then has nothing left to end.
  perform launchpad.settle_land_holds(v_hold.lot_id, p_now);
  update launchpad.land_holds
     set ended_at = p_now,
         outcome = case when started_at is null then 'left_queue' else 'released' end
   where id = p_hold_id and ended_at is null;
  perform launchpad.start_next_hold(v_hold.lot_id, p_now);
end
$$;

-- Deposit received: only the active holder. The lot is sold and the queue ends.
create or replace function launchpad.mark_lot_sold(
  p_hold_id uuid,
  p_staff_id text,
  p_client text default null,
  p_now timestamptz default now()
)
returns void
language plpgsql as $$
declare
  v_hold launchpad.land_holds;
  v_label text;
  r record;
begin
  select * into v_hold from launchpad.land_holds where id = p_hold_id;
  if not found or v_hold.ended_at is not null then
    raise exception 'land_hold_not_open';
  end if;
  if v_hold.staff_id <> p_staff_id then
    raise exception 'land_hold_not_yours';
  end if;
  select lot_label into v_label from launchpad.land_lots where id = v_hold.lot_id for update;
  perform launchpad.settle_land_holds(v_hold.lot_id, p_now);
  select * into v_hold from launchpad.land_holds where id = p_hold_id;
  if v_hold.ended_at is not null or v_hold.started_at is null then
    raise exception 'land_hold_not_active';
  end if;
  update launchpad.land_lots
     set sale_status = 'sold', sold_at = p_now, sold_by = p_staff_id,
         sold_client = coalesce(nullif(btrim(p_client), ''), v_hold.client_name)
   where id = v_hold.lot_id;
  update launchpad.land_holds set ended_at = p_now, outcome = 'converted' where id = p_hold_id;
  for r in
    update launchpad.land_holds
       set ended_at = p_now, outcome = 'lot_sold'
     where lot_id = v_hold.lot_id and ended_at is null
    returning id, staff_id
  loop
    insert into launchpad.notifications (recipient, module_id, kind, event, message, link, entity_type, entity_id, dedupe_key)
    values (
      r.staff_id, 'consultant', 'ok', 'land_lot_sold',
      v_label || ' has sold, so your place in its hold queue has ended.',
      '/consultant?tab=land', 'land_hold', r.id::text, 'land_lot_sold:' || r.id::text
    )
    on conflict (dedupe_key) do nothing;
  end loop;
end
$$;

-- What the Exclusive Land screen reads: every lot that isn't withdrawn, with its
-- open holds (the active one first, then the queue in order) and who sold it.
create or replace view launchpad.land_lot_board as
select
  l.*,
  coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'id', h.id,
        'staffId', h.staff_id,
        'name', coalesce(s.name, h.staff_id),
        'client', h.client_name,
        'note', h.note,
        'queuedAt', h.queued_at,
        'startedAt', h.started_at,
        'expiresAt', h.expires_at
      )
      order by (h.started_at is null), h.queued_at, h.id
    )
    from launchpad.land_holds h
    left join launchpad.staff s on s.id = h.staff_id
    where h.lot_id = l.id and h.ended_at is null
  ), '[]'::jsonb) as holds,
  (select s.name from launchpad.staff s where s.id = l.sold_by) as sold_by_name
from launchpad.land_lots l
where l.sale_status <> 'withdrawn';

select launchpad.secure_schemas();
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --import tsx --test src/server/db/land.test.ts src/server/db/schema.test.ts`
Expected: PASS, 19 tests.

- [ ] **Step 5: Checkpoint**

Run: `npm test` and `git status --short`. Expected new files: the migration and `src/server/db/land.test.ts`. Don't commit.

---

### Task 7: Typed views over the Monday mirror, and the lot sync

> **Changed in review (2026-10-08).** In the repo:
> - the views read each row's fields with a per-row LATERAL, and `monday_item_fields` is gone;
> - the sync guards numeric fields with `pg_input_is_valid`, touches only `source = 'monday'` lots, imports sold only for labels starting "Sold", and does nothing until the land board has `lot_status` mapped;
> - titled is anchored, and "Not yet titled" is untitled;
> - the readers fall through empty strings.
>
> Copy from the repo, not from here.


**Files:**
- Create: `supabase/migrations/20261008000900_monday_views.sql`
- Test: `src/server/db/monday-views.test.ts`

**Interfaces:**
- Consumes: the mirror tables (Task 3), `launchpad.land_lots` and `land_holds` (Task 6), `addStaff()`.
- Produces:
  - Value readers: `mirror.value_text(jsonb) returns text`, `mirror.value_label(jsonb) returns text`, `mirror.value_date(jsonb) returns date`, `mirror.value_number(jsonb) returns numeric`.
  - Views:
    - `launchpad.monday_jobs`: `item_id`, `board_id`, `board_key`, `purpose`, `division`, `region`, `group_id`, `group_title`, `deal_name`, `job_number`, `site_address`, `site_suburb`, `site_state`, `sales_rep`, `builder`, `buyer_type`, `block_titled`, `title_due_date date`, `sale_won_date date`, `construction_stage`, `handover_date date`, `hubspot_deal_id bigint`, `updated_at`.
    - `launchpad.monday_job_milestones`: `item_id`, `job_item_id`, `board_id`, `name`, `status_label`, `due_date`, `date_completed`, `people`, `notes`, `file_count`, `monday_created_at`, `updated_at`.
    - `launchpad.monday_job_files`: `asset_id`, `item_id` (the top-level item), `subitem_id`, `name`, `file_extension`, `file_size`, `storage_path`, `downloaded_at`, `monday_created_at`.
    - `launchpad.monday_land_lots`: `item_id`, `name`, `status_label`, `street`, `suburb`, `state`, `estate`, `developer`, `builder`, `land_price`, `package_price`, `package_design`, `area_sqm`, `frontage_m`, `zoning`, `title_label`, `title_eta`, `rebate_note`, `removed_at`, `updated_at`.
    - `launchpad.staff_hours_daily`: `staff_id`, `date`, `tracked_hours`.
  - Functions: `launchpad.title_status_of(text) returns text` and `launchpad.sync_land_lots_from_monday(p_now timestamptz default now()) returns integer` (rows changed).

- [ ] **Step 1: Write the failing test**

Create `src/server/db/monday-views.test.ts`:

```ts
import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { migratedTestDb } from "./pglite";
import { addStaff } from "./test-fixtures";
import type { Db } from "./types";

let db: Db;
let close: () => Promise<void>;

const value = (type: string, text: string | null, extra: Record<string, unknown> = {}) => ({ type, text, value: null, ...extra });

async function item(id: number, board: number, name: string, values: Record<string, unknown>, parent: number | null = null) {
  await db.query(
    `insert into mirror.monday_items (id, board_id, parent_item_id, name, monday_updated_at, column_values)
     values ($1, $2, $3, $4, '2026-10-07T00:00:00Z', $5::jsonb)`,
    [id, board, parent, name, JSON.stringify(values)],
  );
}

before(async () => {
  ({ db, close } = await migratedTestDb());
  await db.query("insert into mirror.monday_workspaces (id, name) values (1, 'Test workspace')");
  await db.query(`insert into mirror.monday_boards (id, workspace_id, name, board_key, purpose, division, region, sync_enabled)
                  values (10, 1, 'Test sales board', 'homes_sales_wa', 'sales', 'homes', 'WA', true),
                         (30, 1, 'Test land board', 'exclusive_land', 'exclusive_land', null, null, true)`);
  await db.query(`insert into mirror.monday_boards (id, workspace_id, name, type, board_key, parent_board_id, sync_enabled)
                  values (11, 1, 'Subitems of Test sales board', 'sub_items_board', 'homes_sales_wa:subitems', 10, true)`);
  await db.query(`insert into mirror.monday_field_map (board_id, field_key, column_id) values
    (10, 'job_number', 'text4'), (10, 'builder', 'color_b'), (10, 'sale_won_date', 'date4'),
    (10, 'block_titled', 'color_t'), (10, 'hubspot_id', 'text_h'), (10, 'sales_rep', 'text_r'),
    (11, 'milestone_status', 'status'), (11, 'date_completed', 'date_c'), (11, 'files', 'files_f'),
    (30, 'lot_status', 'status'), (30, 'lot_estate', 'text_e'), (30, 'lot_land_price', 'numbers'),
    (30, 'lot_title', 'color_title'), (30, 'lot_title_eta', 'date_eta')`);

  await item(1001, 10, "Test Client A", {
    text4: value("text", "12345"),
    color_b: value("status", "Test Builder", { label: "Test Builder", index: 1 }),
    date4: value("date", "2026-09-01", { date: "2026-09-01" }),
    color_t: value("status", "No", { label: "No" }),
    text_h: value("text", "999"),
    text_r: value("text", " Test Rep A "),
  });
  await item(1002, 10, "Test Client B (removed)", {});
  await db.query("update mirror.monday_items set removed_at = now(), state = 'deleted' where id = 1002");
  await item(2001, 11, "Slab Down", {
    status: value("status", "Done", { label: "Done", index: 1 }),
    date_c: value("date", "2026-10-01", { date: "2026-10-01" }),
    files_f: value("file", "a.pdf, b.pdf", { value: { files: [{ assetId: 9001 }, { assetId: 9002 }] } }),
  }, 1001);
  await db.query(`insert into mirror.monday_assets (id, item_id, column_id, name) values
    (9001, 2001, 'files_f', 'a.pdf'), (9002, 2001, 'files_f', 'b.pdf'), (9003, 1001, null, 'c.pdf')`);

  await item(3001, 30, "Lot 1 Test Street, Testville", {
    status: value("status", "Available", { label: "Available" }),
    text_e: value("text", "Test Estate"),
    numbers: value("numbers", "364000"),
    color_title: value("status", "Untitled", { label: "Untitled" }),
    date_eta: value("date", "2026-09-30", { date: "2026-09-30" }),
  });
  await item(3002, 30, "Lot 2 Test Street, Testville", {
    status: value("status", "Sold", { label: "Sold" }),
    numbers: value("numbers", "$365,000"),
  });
  await addStaff(db, "test-rep-a", { email: "rep.a@example.com" });
});
after(async () => close());

test("views: a job row reads its mapped columns, and removed items are left out", async () => {
  const rows = await db.query<Record<string, unknown>>("select * from launchpad.monday_jobs order by item_id");
  assert.equal(rows.length, 1);
  const [job] = rows;
  assert.equal(job.job_number, "12345");
  assert.equal(job.builder, "Test Builder");
  assert.equal(job.block_titled, "No");
  assert.equal(job.hubspot_deal_id, 999);
  assert.equal(job.sales_rep, "Test Rep A");
  assert.equal(job.purpose, "sales");
  const [{ d }] = await db.query<{ d: string }>("select sale_won_date::text as d from launchpad.monday_jobs");
  assert.equal(d, "2026-09-01");
});

test("views: a subitem becomes a milestone of its job, with its file count", async () => {
  const [m] = await db.query<{ job_item_id: number; status_label: string; done: string; file_count: number }>(
    "select job_item_id, status_label, date_completed::text as done, file_count from launchpad.monday_job_milestones",
  );
  assert.deepEqual(m, { job_item_id: 1001, status_label: "Done", done: "2026-10-01", file_count: 2 });
});

test("views: files on a job or its milestones all belong to the job", async () => {
  const rows = await db.query<{ asset_id: number; item_id: number; subitem_id: number | null }>(
    "select asset_id, item_id, subitem_id from launchpad.monday_job_files order by asset_id",
  );
  assert.deepEqual(rows, [
    { asset_id: 9001, item_id: 1001, subitem_id: 2001 },
    { asset_id: 9002, item_id: 1001, subitem_id: 2001 },
    { asset_id: 9003, item_id: 1001, subitem_id: null },
  ]);
});

test("views: a value that isn't a date or a number reads as null, not an error (Review Focus 5)", async () => {
  const [r] = await db.query<{ d: string | null; impossible: string | null; n: string | null }>(
    `select mirror.value_date('{"text": "next week"}'::jsonb)::text as d,
            mirror.value_date('{"date": "2026-02-30"}'::jsonb)::text as impossible,
            mirror.value_number('{"text": "TBC"}'::jsonb)::text as n`,
  );
  assert.deepEqual(r, { d: null, impossible: null, n: null });
});

test("lots: the first sync adds every lot, sold ones as sold", async () => {
  const changed = await db.query<{ n: number }>("select launchpad.sync_land_lots_from_monday() as n");
  assert.equal(changed[0].n, 2);
  const lots = await db.query<{ lot_label: string; sale_status: string; land_price: string | null; title_status: string | null }>(
    "select lot_label, sale_status, land_price::text, title_status from launchpad.land_lots order by lot_label",
  );
  assert.deepEqual(lots, [
    { lot_label: "Lot 1 Test Street, Testville", sale_status: "available", land_price: "364000.00", title_status: "untitled" },
    { lot_label: "Lot 2 Test Street, Testville", sale_status: "sold", land_price: "365000.00", title_status: null },
  ]);
});

test("lots: later syncs follow Monday's details but never its status", async () => {
  await db.query(`update mirror.monday_items
                  set column_values = jsonb_set(column_values, '{numbers}', '{"type":"numbers","text":"370000","value":null}')
                    || '{"status": {"type":"status","text":"Sold","label":"Sold","value":null}}'::jsonb
                  where id = 3001`);
  await db.query("select launchpad.sync_land_lots_from_monday()");
  const [lot] = await db.query<{ sale_status: string; land_price: string; monday_status: string }>(
    "select sale_status, land_price::text, monday_status from launchpad.land_lots where monday_item_id = 3001",
  );
  assert.deepEqual(lot, { sale_status: "available", land_price: "370000.00", monday_status: "Sold" });
  const again = await db.query<{ n: number }>("select launchpad.sync_land_lots_from_monday() as n");
  assert.equal(again[0].n, 0, "nothing changed, nothing written");
});

test("lots: a lot that leaves Monday is withdrawn, unless a hold is active", async () => {
  const [lot] = await db.query<{ id: string }>("select id from launchpad.land_lots where monday_item_id = 3001");
  await db.query("select launchpad.place_hold($1::uuid, 'test-rep-a')", [lot.id]);
  await db.query("update mirror.monday_items set removed_at = now(), state = 'deleted' where id = 3001");
  await db.query("select launchpad.sync_land_lots_from_monday()");
  const [held] = await db.query<{ sale_status: string; flagged: boolean }>(
    "select sale_status, monday_removed_at is not null as flagged from launchpad.land_lots where monday_item_id = 3001",
  );
  assert.deepEqual(held, { sale_status: "available", flagged: true });

  await db.query(
    "update launchpad.land_holds set ended_at = now(), outcome = 'released' where lot_id = $1::uuid and ended_at is null and started_at is not null",
    [lot.id],
  );
  await db.query("select launchpad.sync_land_lots_from_monday()");
  const [gone] = await db.query<{ sale_status: string }>(
    "select sale_status from launchpad.land_lots where monday_item_id = 3001",
  );
  assert.equal(gone.sale_status, "withdrawn");
});

test("lots: a withdrawn lot whose item comes back to Monday is available again", async () => {
  await db.query("update mirror.monday_items set removed_at = null, state = 'active' where id = 3001");
  await db.query("select launchpad.sync_land_lots_from_monday()");
  const [lot] = await db.query<{ sale_status: string; flagged: boolean }>(
    "select sale_status, monday_removed_at is not null as flagged from launchpad.land_lots where monday_item_id = 3001",
  );
  assert.deepEqual(lot, { sale_status: "available", flagged: false });
});

test("hours: Hubstaff days add up per staff member", async () => {
  await db.query("update launchpad.staff set hubstaff_user_id = 42 where id = 'test-rep-a'");
  await db.query(`insert into mirror.hubstaff_daily_activities (id, organization_id, user_id, project_id, date, tracked_seconds)
                  values (1, 7, 42, 1, '2026-10-06', 18000), (2, 7, 42, 2, '2026-10-06', 9000)`);
  const [row] = await db.query<{ staff_id: string; hours: string }>(
    "select staff_id, tracked_hours::text as hours from launchpad.staff_hours_daily",
  );
  assert.deepEqual(row, { staff_id: "test-rep-a", hours: "7.50" });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node --import tsx --test src/server/db/monday-views.test.ts`
Expected: FAIL, `relation "launchpad.monday_jobs" does not exist`.

- [ ] **Step 3: Write the migration**

Create `supabase/migrations/20261008000900_monday_views.sql`:

```sql
-- Typed views over the raw Monday mirror. Which column holds which field comes from
-- mirror.monday_field_map, filled at setup, so nothing here names a column id.

-- Readers for one stored column value ({ type, text, value, label, date, ... }).
-- They return null for anything they can't read, never an error.
create or replace function mirror.value_text(v jsonb) returns text
language sql stable as $$
  select nullif(btrim(coalesce(v ->> 'text', v ->> 'display_value', v ->> 'label', '')), '')
$$;

create or replace function mirror.value_label(v jsonb) returns text
language sql stable as $$
  select nullif(btrim(coalesce(v ->> 'label', v ->> 'text', '')), '')
$$;

-- pg_input_is_valid (Postgres 16+) turns away a well-formed but impossible date such
-- as 2026-02-30 without raising, so one bad value can't break every view that reads it.
create or replace function mirror.value_date(v jsonb) returns date
language sql stable as $$
  select case
    when coalesce(v ->> 'date', v ->> 'text', '') ~ '^\d{4}-\d{2}-\d{2}'
     and pg_input_is_valid(left(coalesce(v ->> 'date', v ->> 'text', ''), 10), 'date')
      then left(coalesce(v ->> 'date', v ->> 'text'), 10)::date
  end
$$;

create or replace function mirror.value_number(v jsonb) returns numeric
language sql stable as $$
  select case when n ~ '^-?\d+(\.\d+)?$' then n::numeric end
  from (select regexp_replace(coalesce(v ->> 'text', ''), '[^0-9.\-]', '', 'g') as n) s
$$;

-- Every item's mapped fields as one JSON object: { "<field key>": <stored value> }.
create or replace view mirror.monday_item_fields as
select i.id as item_id, jsonb_object_agg(m.field_key, i.column_values -> m.column_id) as f
from mirror.monday_items i
join mirror.monday_field_map m on m.board_id = i.board_id
group by i.id;

create or replace view launchpad.monday_jobs as
select
  i.id as item_id,
  b.id as board_id,
  b.board_key,
  b.purpose,
  b.division,
  b.region,
  i.group_id,
  g.title as group_title,
  i.name as deal_name,
  mirror.value_text(fx.f -> 'job_number') as job_number,
  mirror.value_text(fx.f -> 'site_address') as site_address,
  mirror.value_text(fx.f -> 'site_suburb') as site_suburb,
  mirror.value_text(fx.f -> 'site_state') as site_state,
  mirror.value_text(fx.f -> 'sales_rep') as sales_rep,
  mirror.value_label(fx.f -> 'builder') as builder,
  mirror.value_label(fx.f -> 'buyer_type') as buyer_type,
  mirror.value_label(fx.f -> 'block_titled') as block_titled,
  mirror.value_date(fx.f -> 'title_due_date') as title_due_date,
  mirror.value_date(fx.f -> 'sale_won_date') as sale_won_date,
  mirror.value_label(fx.f -> 'construction_stage') as construction_stage,
  mirror.value_date(fx.f -> 'handover_date') as handover_date,
  case
    when mirror.value_text(fx.f -> 'hubspot_id') ~ '^\d{1,15}$' then mirror.value_text(fx.f -> 'hubspot_id')::bigint
  end as hubspot_deal_id,
  i.monday_updated_at as updated_at
from mirror.monday_items i
join mirror.monday_boards b on b.id = i.board_id and b.purpose in ('sales', 'construction', 'handed_over')
left join mirror.monday_groups g on g.board_id = i.board_id and g.id = i.group_id
left join mirror.monday_item_fields fx on fx.item_id = i.id
where i.parent_item_id is null and i.removed_at is null and i.state = 'active';

create or replace view launchpad.monday_job_milestones as
select
  s.id as item_id,
  s.parent_item_id as job_item_id,
  s.board_id,
  s.name,
  mirror.value_label(fx.f -> 'milestone_status') as status_label,
  mirror.value_date(fx.f -> 'due_date') as due_date,
  mirror.value_date(fx.f -> 'date_completed') as date_completed,
  mirror.value_text(fx.f -> 'people') as people,
  mirror.value_text(fx.f -> 'notes') as notes,
  case
    when jsonb_typeof(fx.f -> 'files' -> 'value' -> 'files') = 'array'
      then jsonb_array_length(fx.f -> 'files' -> 'value' -> 'files')
    else 0
  end as file_count,
  s.monday_created_at,
  s.monday_updated_at as updated_at
from mirror.monday_items s
join mirror.monday_boards sb on sb.id = s.board_id and sb.type = 'sub_items_board'
join mirror.monday_boards pb on pb.id = sb.parent_board_id and pb.purpose in ('sales', 'construction', 'handed_over')
left join mirror.monday_item_fields fx on fx.item_id = s.id
where s.parent_item_id is not null and s.removed_at is null and s.state = 'active';

-- One row per file, filed under the top-level item (a job or a lot) it belongs to.
create or replace view launchpad.monday_job_files as
select
  a.id as asset_id,
  coalesce(i.parent_item_id, i.id) as item_id,
  case when i.parent_item_id is not null then i.id end as subitem_id,
  a.name,
  a.file_extension,
  a.file_size,
  a.storage_path,
  a.downloaded_at,
  a.monday_created_at
from mirror.monday_assets a
join mirror.monday_items i on i.id = a.item_id
where a.removed_at is null and i.removed_at is null;

create or replace view launchpad.monday_land_lots as
select
  i.id as item_id,
  i.name,
  mirror.value_label(fx.f -> 'lot_status') as status_label,
  mirror.value_text(fx.f -> 'lot_address') as street,
  mirror.value_text(fx.f -> 'lot_suburb') as suburb,
  mirror.value_text(fx.f -> 'lot_state') as state,
  mirror.value_text(fx.f -> 'lot_estate') as estate,
  mirror.value_text(fx.f -> 'lot_developer') as developer,
  mirror.value_text(fx.f -> 'lot_builder') as builder,
  mirror.value_number(fx.f -> 'lot_land_price') as land_price,
  mirror.value_number(fx.f -> 'lot_package_price') as package_price,
  mirror.value_text(fx.f -> 'lot_design') as package_design,
  mirror.value_number(fx.f -> 'lot_area') as area_sqm,
  mirror.value_number(fx.f -> 'lot_frontage') as frontage_m,
  mirror.value_text(fx.f -> 'lot_zoning') as zoning,
  mirror.value_label(fx.f -> 'lot_title') as title_label,
  mirror.value_date(fx.f -> 'lot_title_eta') as title_eta,
  mirror.value_text(fx.f -> 'lot_rebate') as rebate_note,
  i.removed_at,
  i.monday_updated_at as updated_at
from mirror.monday_items i
join mirror.monday_boards b on b.id = i.board_id and b.purpose = 'exclusive_land'
left join mirror.monday_item_fields fx on fx.item_id = i.id
where i.parent_item_id is null;

-- A Monday title label to our title status. Untitled is checked before titled.
create or replace function launchpad.title_status_of(p_label text) returns text
language sql immutable as $$
  select case
    when p_label is null then null
    when p_label ilike '%delay%' then 'delayed'
    when p_label ilike '%untitled%' or p_label ilike '%not titled%' or lower(btrim(p_label)) = 'no' then 'untitled'
    when p_label ilike '%titled%' or lower(btrim(p_label)) = 'yes' then 'titled'
  end
$$;

-- Brings Monday's lots into launchpad.land_lots. New items become available lots
-- (sold, if Monday says so at the first import). While a lot's source is 'monday'
-- its details follow Monday; its sale status never does. A lot whose item left
-- Monday is withdrawn, unless a hold is active: then it is only flagged. If the
-- item comes back, so does the lot. Returns how many rows (lots and holds) it changed.
create or replace function launchpad.sync_land_lots_from_monday(p_now timestamptz default now())
returns integer
language plpgsql as $$
declare
  r record;
  v_changed integer := 0;
  v_count integer;
begin
  -- Lots in a fixed order, and each lot's row locked before its holds are read or changed: the
  -- same order the hold functions use (lot, then holds), so the sync can't deadlock with them.
  for r in select * from launchpad.monday_land_lots order by item_id loop
    if r.removed_at is not null then
      perform 1 from launchpad.land_lots where monday_item_id = r.item_id for update;
      if exists (
        select 1 from launchpad.land_holds h
        join launchpad.land_lots l on l.id = h.lot_id
        where l.monday_item_id = r.item_id and h.ended_at is null and h.started_at is not null
      ) then
        update launchpad.land_lots set monday_removed_at = r.removed_at
         where monday_item_id = r.item_id and monday_removed_at is null;
      else
        update launchpad.land_holds h
           set ended_at = p_now, outcome = 'lot_withdrawn'
          from launchpad.land_lots l
         where l.id = h.lot_id and l.monday_item_id = r.item_id and h.ended_at is null;
        get diagnostics v_count = row_count;
        v_changed := v_changed + v_count;
        update launchpad.land_lots
           set sale_status = 'withdrawn', monday_removed_at = coalesce(monday_removed_at, r.removed_at)
         where monday_item_id = r.item_id and source = 'monday' and sale_status = 'available';
      end if;
      get diagnostics v_count = row_count;
      v_changed := v_changed + v_count;
      continue;
    end if;

    insert into launchpad.land_lots as l (
      monday_item_id, source, lot_label, street, suburb, state, estate, developer, builder,
      land_price, package_price, package_design, area_sqm, frontage_m, zoning,
      title_status, title_eta, rebate_note, monday_status, sale_status, sold_at
    ) values (
      r.item_id, 'monday', r.name, r.street, r.suburb, r.state, r.estate, r.developer,
      nullif(r.builder, 'Any builder'),
      r.land_price, r.package_price, r.package_design, r.area_sqm, r.frontage_m, r.zoning,
      launchpad.title_status_of(r.title_label), r.title_eta, r.rebate_note, r.status_label,
      case when r.status_label ilike '%sold%' then 'sold' else 'available' end,
      case when r.status_label ilike '%sold%' then p_now end
    )
    on conflict (monday_item_id) do update set
      lot_label = excluded.lot_label,
      street = excluded.street,
      suburb = excluded.suburb,
      state = excluded.state,
      estate = excluded.estate,
      developer = excluded.developer,
      builder = excluded.builder,
      land_price = excluded.land_price,
      package_price = excluded.package_price,
      package_design = excluded.package_design,
      area_sqm = excluded.area_sqm,
      frontage_m = excluded.frontage_m,
      zoning = excluded.zoning,
      title_status = excluded.title_status,
      title_eta = excluded.title_eta,
      rebate_note = excluded.rebate_note,
      monday_status = excluded.monday_status,
      monday_removed_at = null,
      -- An item back in Monday brings back the lot its removal withdrew.
      sale_status = case
        when l.sale_status = 'withdrawn' and l.monday_removed_at is not null then 'available'
        else l.sale_status
      end
    where l.source = 'monday' and (
      l.lot_label, l.street, l.suburb, l.state, l.estate, l.developer, l.builder,
      l.land_price, l.package_price, l.package_design, l.area_sqm, l.frontage_m, l.zoning,
      l.title_status, l.title_eta, l.rebate_note, l.monday_status, l.monday_removed_at
    ) is distinct from (
      excluded.lot_label, excluded.street, excluded.suburb, excluded.state, excluded.estate,
      excluded.developer, excluded.builder, excluded.land_price, excluded.package_price,
      excluded.package_design, excluded.area_sqm, excluded.frontage_m, excluded.zoning,
      excluded.title_status, excluded.title_eta, excluded.rebate_note, excluded.monday_status,
      null::timestamptz
    );
    get diagnostics v_count = row_count;
    v_changed := v_changed + v_count;
  end loop;
  return v_changed;
end
$$;

-- Hubstaff's tracked hours per staff member per day.
create or replace view launchpad.staff_hours_daily as
select s.id as staff_id, a.date, round(sum(a.tracked_seconds) / 3600.0, 2) as tracked_hours
from mirror.hubstaff_daily_activities a
join launchpad.staff s on s.hubstaff_user_id = a.user_id
group by s.id, a.date;

select launchpad.secure_schemas();
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --import tsx --test src/server/db/monday-views.test.ts src/server/db/schema.test.ts`
Expected: PASS, 16 tests.

- [ ] **Step 5: Checkpoint**

Run: `npm test` and `git status --short`. Expected new files: the migration and `src/server/db/monday-views.test.ts`. Don't commit.

---

### Task 8: Staff from the org chart

The live screens need real staff rows: holds name a rep, and My clients matches Monday's rep text to a person. Until the Employee Master Roster branch merges, they come from today's `ORG_SEED`.

**Files:**
- Create: `src/server/db/seed-staff.ts`
- Test: `src/server/db/seed-staff.test.ts`
- Create: `scripts/db/seed.ts`
- Modify: `package.json` (`scripts`)

**Interfaces:**
- Consumes: `ORG_SEED`, `ORG_DEPARTMENTS`, `EMPLOYEE_RECORDS`, `orgDepartmentOf` from `src/components/modules/hr/data.ts`; `Db`.
- Produces:
  - `staffSeedRows(people?: OrgPerson[]): StaffSeedRow[]` and `departmentHeads(): { id: string; head: string }[]`.
  - `seedStaff(db: Db, rows: StaffSeedRow[]): Promise<{ written: number; heads: number }>`.

- [ ] **Step 1: Write the failing test**

Create `src/server/db/seed-staff.test.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { departmentHeads, seedStaff, staffSeedRows } from "./seed-staff";
import { migratedTestDb } from "./pglite";

test("seed: Kane's seat reads as Information Technology, under Jerry", () => {
  const kane = staffSeedRows().find((r) => r.id === "jan-kane-reroma");
  assert.ok(kane);
  assert.equal(kane.department_id, "it");
  assert.equal(kane.reports_to, "jerry-delos-santos");
  assert.equal(kane.work_email, "jan@localegroup.au");
});

test("seed: every reporting line points at a seat in the same list", () => {
  const rows = staffSeedRows();
  const ids = new Set(rows.map((r) => r.id));
  assert.deepEqual(rows.filter((r) => r.reports_to && !ids.has(r.reports_to)).map((r) => r.id), []);
});

test("seed: work fields only, no personal email addresses", () => {
  const json = JSON.stringify(staffSeedRows());
  assert.doesNotMatch(json, /outlook\.com|gmail\.com|yahoo\.com|bigpond\.com|icloud\.com/);
});

test("seed: departments map to the roster's ids", () => {
  const ids = departmentHeads().map((d) => d.id);
  assert.ok(ids.includes("it") && ids.includes("accounting"));
  assert.ok(!ids.includes("ai") && !ids.includes("accounts"));
});

test("seed: writes into a migrated database, and leaves roster rows alone", async () => {
  const { db, close } = await migratedTestDb();
  try {
    const rows = staffSeedRows();
    const first = await seedStaff(db, rows);
    assert.equal(first.written, rows.length);
    assert.ok(first.heads >= 5);
    await db.query("update launchpad.staff set source = 'roster', role = 'Roster role' where id = 'jan-kane-reroma'");
    await seedStaff(db, rows);
    const [kane] = await db.query<{ role: string }>("select role from launchpad.staff where id = 'jan-kane-reroma'");
    assert.equal(kane.role, "Roster role");
  } finally {
    await close();
  }
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node --import tsx --test src/server/db/seed-staff.test.ts`
Expected: FAIL, `Cannot find module './seed-staff'`.

- [ ] **Step 3: Write the implementation**

Create `src/server/db/seed-staff.ts`:

```ts
import {
  EMPLOYEE_RECORDS,
  ORG_DEPARTMENTS,
  ORG_SEED,
  orgDepartmentOf,
  type OrgPerson,
} from "@/components/modules/hr/data";
import type { Db } from "./types";

/**
 * Today's chart departments to the roster's (the Employee Master Roster spec,
 * section 3): "AI & Growth" is Information Technology, "Accounts" is Accounting.
 */
const DEPARTMENT_OF: Record<string, string> = {
  leadership: "leadership",
  finance: "finance",
  sales: "sales",
  marketing: "marketing",
  accounts: "accounting",
  ai: "it",
};

export interface StaffSeedRow {
  id: string;
  name: string | null;
  preferred_name: string | null;
  role: string;
  brand: string | null;
  department_id: string;
  reports_to: string | null;
  link: string | null;
  team: string | null;
  note: string | null;
  work_email: string | null;
  start_date: string | null;
  status: "active" | "pending";
  vacant: boolean;
}

/** One row per seat on the org chart. Work fields only: no personal emails or numbers. */
export function staffSeedRows(people: OrgPerson[] = ORG_SEED): StaffSeedRow[] {
  return people.map((p) => {
    const record = EMPLOYEE_RECORDS[p.id];
    return {
      id: p.id,
      name: p.name,
      preferred_name: record?.preferredName ?? null,
      role: p.role,
      brand: p.brands?.[0] ?? null,
      department_id: DEPARTMENT_OF[orgDepartmentOf(people, p.id)] ?? "leadership",
      reports_to: p.managerId,
      link: p.link ?? null,
      team: p.team ?? null,
      note: p.note ?? null,
      work_email: record?.workEmail ?? null,
      start_date: record?.commenced ?? null,
      status: p.name === null ? "pending" : "active",
      vacant: p.name === null,
    };
  });
}

export function departmentHeads(): { id: string; head: string }[] {
  return ORG_DEPARTMENTS.map((d) => ({ id: DEPARTMENT_OF[d.id], head: d.headId }));
}

/**
 * Writes the rows. A row already owned by the roster or edited by hand
 * (source <> 'org_seed') is left alone. Department heads are set where the
 * head's row exists.
 */
export async function seedStaff(db: Db, rows: StaffSeedRow[]): Promise<{ written: number; heads: number }> {
  return db.transaction(async (tx) => {
    const written = await tx.query<{ id: string }>(
      `insert into launchpad.staff as s (
         id, name, preferred_name, role, brand, department_id, reports_to, link, team, note,
         work_email, start_date, status, vacant, source
       )
       select x.id, x.name, x.preferred_name, x.role, x.brand, x.department_id, x.reports_to, x.link,
              x.team, x.note, x.work_email, x.start_date, x.status, x.vacant, 'org_seed'
       from jsonb_to_recordset($1::jsonb) as x(
         id text, name text, preferred_name text, role text, brand text, department_id text,
         reports_to text, link text, team text, note text, work_email text, start_date date,
         status text, vacant boolean
       )
       on conflict (id) do update set
         name = excluded.name,
         preferred_name = excluded.preferred_name,
         role = excluded.role,
         brand = excluded.brand,
         department_id = excluded.department_id,
         reports_to = excluded.reports_to,
         link = excluded.link,
         team = excluded.team,
         note = excluded.note,
         work_email = excluded.work_email,
         start_date = excluded.start_date,
         status = excluded.status,
         vacant = excluded.vacant
       where s.source = 'org_seed'
       returning s.id`,
      [JSON.stringify(rows)],
    );
    const heads = await tx.query<{ id: string }>(
      `update launchpad.departments d set head_staff_id = x.head
       from jsonb_to_recordset($1::jsonb) as x(id text, head text)
       where d.id = x.id and exists (select 1 from launchpad.staff s where s.id = x.head)
       returning d.id`,
      [JSON.stringify(departmentHeads())],
    );
    return { written: written.length, heads: heads.length };
  });
}
```

Create `scripts/db/seed.ts`:

```ts
/**
 * npm run db:seed
 *
 * Writes departments' heads and one staff row per seat on today's org chart
 * (src/components/modules/hr/data.ts). Safe to re-run: rows from the roster or
 * edited by hand are left alone.
 */
import { closeDb, getDb } from "../../src/server/db/postgres";
import { seedStaff, staffSeedRows } from "../../src/server/db/seed-staff";

async function main() {
  const db = getDb();
  if (!db) {
    console.error("SUPABASE_DB_URL is not set. Put it in .env.local (see .env.example).");
    process.exit(1);
  }
  const rows = staffSeedRows();
  const result = await seedStaff(db, rows);
  console.log(`staff: ${result.written} of ${rows.length} written; department heads set: ${result.heads}`);
  await closeDb();
}

main().catch(async (e) => {
  console.error(e instanceof Error ? e.message : e);
  await closeDb();
  process.exit(1);
});
```

In `package.json` `"scripts"`, add:

```json
    "db:seed": "node --env-file-if-exists=.env.local --import tsx scripts/db/seed.ts",
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --import tsx --test src/server/db/seed-staff.test.ts`
Expected: PASS, 5 tests. If "every reporting line" fails, a seat's `managerId` points outside `ORG_SEED`: list it for Kane rather than editing `hr/data.ts`.

- [ ] **Step 5: Checkpoint**

Run: `npm test`, `npx tsc --noEmit` and `git status --short`. Expected new files: `src/server/db/seed-staff.ts`, `src/server/db/seed-staff.test.ts`, `scripts/db/seed.ts`; `package.json` modified. Don't commit.

---

# Phase B: The Monday mirror

### Task 9: The Monday client

**Files:**
- Create: `src/server/mirror/monday/client.ts`
- Create: `src/server/mirror/monday/ledger.ts`
- Create: `src/server/mirror/monday/test-fakes.ts`
- Test: `src/server/mirror/monday/client.test.ts`

**Interfaces:**
- Produces:
  - `MONDAY_API_URL`, `MONDAY_API_VERSION = "2026-10"`.
  - `interface MondayLedger { claim(): Promise<boolean>; dailyLimitHit(): Promise<void> }` and `interface Complexity { query: number; after: number; resetInSeconds: number }`.
  - `interface MondayClient { query<T>(document: string, variables?: Record<string, unknown>): Promise<T>; readonly stats: { calls: number; complexity: number; lastComplexity: Complexity | null } }`.
  - `createMondayClient(opts: { token: string; ledger: MondayLedger; fetch?: typeof fetch; sleep?: (ms: number) => Promise<void>; maxRetries?: number; timeoutMs?: number; deadline?: Date; now?: () => number }): MondayClient`. (`timeoutMs`, `deadline` and `now` were added in review; with a deadline, the client claims nothing, waits for nothing and times no attempt out past it, and throws `MondayDeadlineError`.)
  - `isWriteOperation(document: string): boolean` and `withComplexity(document: string): string`.
  - Errors: `MondayError` (`code`, `status`), `MondayDailyLimitError`, `MondayCapReachedError`, and `MondayDeadlineError` (code `DEADLINE`, added in review).
  - `dbLedger(db: Db, source: string, cap: number): MondayLedger`.
  - Test fake: `fakeMonday(handler: (document: string, variables: Record<string, unknown>) => unknown): MondayClient & { documents: string[] }`.

- [ ] **Step 1: Write the failing test**

Create `src/server/mirror/monday/client.test.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  MONDAY_API_VERSION,
  MondayCapReachedError,
  MondayDailyLimitError,
  MondayError,
  createMondayClient,
  isWriteOperation,
  withComplexity,
  type MondayLedger,
} from "./client";

function fakeFetch(responses: { status?: number; body: unknown; headers?: Record<string, string> }[]) {
  const sent: { url: string; init: RequestInit }[] = [];
  const fn = (async (url: string, init: RequestInit) => {
    sent.push({ url, init });
    const next = responses.shift();
    if (!next) throw new Error("no fake response left");
    return new Response(JSON.stringify(next.body), { status: next.status ?? 200, headers: next.headers });
  }) as unknown as typeof fetch;
  return { fn, sent };
}

function ledger(allow = true): MondayLedger & { claims: number; limitHits: number } {
  const l = {
    claims: 0,
    limitHits: 0,
    claim: async () => { l.claims += 1; return allow; },
    dailyLimitHit: async () => { l.limitHits += 1; },
  };
  return l;
}

const sleeps: number[] = [];
const sleep = async (ms: number) => { sleeps.push(ms); };
const complexity = (after = 9_000_000) => ({ complexity: { query: 1000, after, reset_in_x_seconds: 30 } });

test("monday client: spots a write in any spelling, but not the word inside a string", () => {
  assert.equal(isWriteOperation("mutation { create_item(board_id: 1, item_name: \"x\") { id } }"), true);
  assert.equal(isWriteOperation("  # a comment\n mutation Rename($id: ID!) { change_item_name(id: $id) { id } }"), true);
  assert.equal(isWriteOperation("subscription { x }"), true);
  assert.equal(isWriteOperation("query { boards(ids: [1]) { name } }"), false);
  assert.equal(isWriteOperation('{ items_page(query_params: { rules: [{ compare_value: ["mutation"] }] }) { cursor } }'), false);
  assert.equal(isWriteOperation("query { mutations_count }"), false);
});

test("monday client: refuses a write before touching the network or the budget", async () => {
  const f = fakeFetch([]);
  const l = ledger();
  const monday = createMondayClient({ token: "t", ledger: l, fetch: f.fn, sleep });
  await assert.rejects(monday.query("mutation { delete_item(item_id: 1) { id } }"), (e: unknown) =>
    e instanceof MondayError && e.code === "WRITE_REFUSED");
  assert.equal(f.sent.length, 0);
  assert.equal(l.claims, 0);
});

test("monday client: pins the version, adds complexity, and records it", async () => {
  const f = fakeFetch([{ body: { data: { boards: [{ id: "1" }], ...complexity() } } }]);
  const monday = createMondayClient({ token: "secret-token", ledger: ledger(), fetch: f.fn, sleep });
  const data = await monday.query<{ boards: { id: string }[] }>("query { boards(ids: [1]) { id } }");
  assert.equal(data.boards[0].id, "1");
  const headers = f.sent[0].init.headers as Record<string, string>;
  assert.equal(headers["API-Version"], MONDAY_API_VERSION);
  assert.equal(headers.Authorization, "secret-token");
  assert.match(String(f.sent[0].init.body), /complexity \{ query after reset_in_x_seconds \}/);
  assert.deepEqual(monday.stats.lastComplexity, { query: 1000, after: 9_000_000, resetInSeconds: 30 });
  assert.equal(monday.stats.calls, 1);
});

test("monday client: adds complexity to the operation's own selection", () => {
  assert.equal(
    withComplexity("query ($b: [ID!]) { boards(ids: $b) { id } }"),
    "query ($b: [ID!]) { complexity { query after reset_in_x_seconds }  boards(ids: $b) { id } }",
  );
  assert.equal(withComplexity("query { complexity { query } boards { id } }"), "query { complexity { query } boards { id } }");
});

test("monday client: stops at the day's cap without sending", async () => {
  const f = fakeFetch([]);
  const monday = createMondayClient({ token: "t", ledger: ledger(false), fetch: f.fn, sleep });
  await assert.rejects(monday.query("query { me { id } }"), MondayCapReachedError);
  assert.equal(f.sent.length, 0);
});

test("monday client: waits out a rate limit, then succeeds", async () => {
  sleeps.length = 0;
  const l = ledger();
  const f = fakeFetch([
    { status: 429, body: { errors: [{ message: "Budget exhausted", extensions: { code: "COMPLEXITY_BUDGET_EXHAUSTED", retry_in_seconds: 3 } }] } },
    { body: { data: { me: { id: "1" }, ...complexity() } } },
  ]);
  const monday = createMondayClient({ token: "t", ledger: l, fetch: f.fn, sleep });
  await monday.query("query { me { id } }");
  assert.deepEqual(sleeps, [3000]);
  assert.equal(l.claims, 2, "a retried request is a second call");
});

test("monday client: the daily limit stops cold, no retry, and is recorded for the rest of the day", async () => {
  const f = fakeFetch([{ status: 429, body: { errors: [{ message: "Daily limit exceeded", extensions: { code: "DAILY_LIMIT_EXCEEDED" } }] } }]);
  const l = ledger();
  const monday = createMondayClient({ token: "t", ledger: l, fetch: f.fn, sleep });
  await assert.rejects(monday.query("query { me { id } }"), MondayDailyLimitError);
  assert.equal(f.sent.length, 1);
  assert.equal(l.limitHits, 1, "the ledger refuses every call until 00:00 UTC");
});

test("monday client: an ordinary GraphQL error isn't retried", async () => {
  const f = fakeFetch([{ body: { errors: [{ message: "Field 'nope' doesn't exist", extensions: { code: "undefinedField" } }] } }]);
  const monday = createMondayClient({ token: "t", ledger: ledger(), fetch: f.fn, sleep });
  await assert.rejects(monday.query("query { nope }"), (e: unknown) => e instanceof MondayError && /nope/.test(e.message));
  assert.equal(f.sent.length, 1);
});

test("monday client: waits for the minute budget when the last answer left it low", async () => {
  sleeps.length = 0;
  const f = fakeFetch([
    { body: { data: { a: 1, complexity: { query: 1000, after: 500_000, reset_in_x_seconds: 7 } } } },
    { body: { data: { b: 2, ...complexity() } } },
  ]);
  const monday = createMondayClient({ token: "t", ledger: ledger(), fetch: f.fn, sleep });
  await monday.query("query { a }");
  await monday.query("query { b }");
  assert.deepEqual(sleeps, [7000]);
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node --import tsx --test src/server/mirror/monday/client.test.ts`
Expected: FAIL, `Cannot find module './client'`.

- [ ] **Step 3: Write the client, the ledger and the test fake**

Create `src/server/mirror/monday/client.ts`:

```ts
/**
 * The only way this repo talks to Monday, and it only reads: query() refuses
 * any document containing a mutation or subscription before the network or the
 * call budget is touched. Every request:
 *   - pins API-Version 2026-10;
 *   - asks for `complexity` (free when bundled) and waits for the minute budget
 *     to reset when the last answer left it low;
 *   - is counted against the day's cap first (ledger.claim());
 *   - is retried on rate limits and server errors, and stops cold on
 *     DAILY_LIMIT_EXCEEDED.
 */
export const MONDAY_API_URL = "https://api.monday.com/v2";
export const MONDAY_API_VERSION = "2026-10";

export interface MondayLedger {
  /** Counts one call before it is sent. False: the day's cap is reached, or Monday's limit was hit today, so don't send. */
  claim(): Promise<boolean>;
  /** Monday answered DAILY_LIMIT_EXCEEDED: refuse every claim until 00:00 UTC. */
  dailyLimitHit(): Promise<void>;
}

export interface Complexity {
  query: number;
  after: number;
  resetInSeconds: number;
}

export interface MondayClient {
  query<T>(document: string, variables?: Record<string, unknown>): Promise<T>;
  readonly stats: { calls: number; complexity: number; lastComplexity: Complexity | null };
}

export class MondayError extends Error {
  constructor(
    message: string,
    readonly code: string | null = null,
    readonly status: number | null = null,
  ) {
    super(message);
    this.name = "MondayError";
  }
}

/** Monday refused: the account's daily limit is spent. Nothing more until 00:00 UTC. */
export class MondayDailyLimitError extends MondayError {}

/** Our own cap (MONDAY_DAILY_CALL_CAP) is reached. Nothing more until 00:00 UTC. */
export class MondayCapReachedError extends MondayError {}

export interface MondayClientOptions {
  token: string;
  ledger: MondayLedger;
  fetch?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  maxRetries?: number;
}

/** True when a GraphQL document contains a mutation or subscription operation. */
export function isWriteOperation(document: string): boolean {
  const code = document
    .replace(/"""[\s\S]*?"""/g, '""')
    .replace(/"(?:\\.|[^"\\])*"/g, '""')
    .replace(/#[^\n\r]*/g, "");
  return /(^|[^A-Za-z0-9_])(mutation|subscription)(?=[\s({@]|$)/.test(code);
}

/** Adds `complexity { ... }` to the operation's top-level selection, unless it asks already. */
export function withComplexity(document: string): string {
  if (/\bcomplexity\s*\{/.test(document)) return document;
  const at = document.indexOf("{");
  if (at < 0) return document;
  return `${document.slice(0, at + 1)} complexity { query after reset_in_x_seconds } ${document.slice(at + 1)}`;
}

interface MondayBody {
  data?: Record<string, unknown> & { complexity?: { query: number; after: number; reset_in_x_seconds: number } };
  errors?: { message?: string; extensions?: { code?: string; retry_in_seconds?: number } }[];
  error_code?: string;
  error_message?: string;
  retry_in_seconds?: number;
}

function firstError(body: MondayBody | null): { code: string | null; message: string; retryIn: number | null } | null {
  if (!body) return null;
  const e = body.errors?.[0];
  if (e) return { code: e.extensions?.code ?? null, message: e.message ?? "Monday error", retryIn: e.extensions?.retry_in_seconds ?? null };
  if (body.error_code || body.error_message) {
    return { code: body.error_code ?? null, message: body.error_message ?? body.error_code ?? "Monday error", retryIn: body.retry_in_seconds ?? null };
  }
  return null;
}

const RETRYABLE = new Set([
  "COMPLEXITY_BUDGET_EXHAUSTED",
  "ComplexityException",
  "RATE_LIMIT_EXCEEDED",
  "RateLimitExceeded",
  "IP_RATE_LIMIT_EXCEEDED",
  "CONCURRENCY_LIMIT_EXCEEDED",
  "maxConcurrencyExceeded",
  "INTERNAL_SERVER_ERROR",
]);
const MAX_WAIT_MS = 65_000;
/** Below this many points left in the minute, wait for the reset before the next request. */
const LOW_BUDGET = 1_000_000;
const backoff = (attempt: number) => Math.min(MAX_WAIT_MS, 1000 * 2 ** attempt);

export function createMondayClient(opts: MondayClientOptions): MondayClient {
  const fetchFn = opts.fetch ?? fetch;
  const sleep = opts.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const maxRetries = opts.maxRetries ?? 4;
  const stats: MondayClient["stats"] = { calls: 0, complexity: 0, lastComplexity: null };

  async function query<T>(document: string, variables: Record<string, unknown> = {}): Promise<T> {
    if (isWriteOperation(document)) {
      throw new MondayError("Refused: the mirror only reads Monday, and this document writes.", "WRITE_REFUSED");
    }
    const body = JSON.stringify({ query: withComplexity(document), variables });
    for (let attempt = 0; ; attempt++) {
      const last = stats.lastComplexity;
      if (last && last.after < LOW_BUDGET && last.resetInSeconds > 0) {
        await sleep(Math.min(MAX_WAIT_MS, last.resetInSeconds * 1000));
        stats.lastComplexity = null;
      }
      if (!(await opts.ledger.claim())) {
        throw new MondayCapReachedError(
          "No Monday calls left today: the call cap is reached, or Monday's daily limit was hit. The mirror waits for 00:00 UTC.",
          "CAP_REACHED",
        );
      }
      stats.calls += 1;

      let res: Response;
      try {
        res = await fetchFn(MONDAY_API_URL, {
          method: "POST",
          headers: { Authorization: opts.token, "Content-Type": "application/json", "API-Version": MONDAY_API_VERSION },
          body,
        });
      } catch (e) {
        if (attempt >= maxRetries) throw new MondayError(`Monday is unreachable: ${(e as Error).message}`, "NETWORK");
        await sleep(backoff(attempt));
        continue;
      }

      const json = (await res.json().catch(() => null)) as MondayBody | null;
      const err = firstError(json);
      if (res.ok && json?.data && !err) {
        const c = json.data.complexity;
        if (c) {
          stats.lastComplexity = { query: c.query, after: c.after, resetInSeconds: c.reset_in_x_seconds };
          stats.complexity += c.query;
        }
        return json.data as T;
      }

      const code = err?.code ?? null;
      const message = err?.message ?? `Monday answered HTTP ${res.status}`;
      if (code === "DAILY_LIMIT_EXCEEDED" || /daily limit/i.test(message)) {
        await opts.ledger.dailyLimitHit();
        throw new MondayDailyLimitError(message, "DAILY_LIMIT_EXCEEDED", res.status);
      }
      const retryable = res.status === 429 || res.status >= 500 || (code !== null && RETRYABLE.has(code));
      if (!retryable || attempt >= maxRetries) throw new MondayError(message, code, res.status);
      const header = Number(res.headers.get("retry-after"));
      const waitSeconds = err?.retryIn ?? (Number.isFinite(header) && header > 0 ? header : null);
      await sleep(waitSeconds !== null ? Math.min(MAX_WAIT_MS, waitSeconds * 1000) : backoff(attempt));
    }
  }

  return { query, stats };
}
```

Create `src/server/mirror/monday/ledger.ts`:

```ts
import type { Db } from "../../db/types";
import type { MondayLedger } from "./client";

/**
 * Counts calls in mirror.api_calls (per source, per UTC day). Refuses past the cap,
 * and for the rest of the UTC day once Monday has said DAILY_LIMIT_EXCEEDED.
 */
export function dbLedger(db: Db, source: string, cap: number): MondayLedger {
  return {
    claim: async () =>
      (await db.query<{ ok: boolean }>("select mirror.record_api_call($1, 1, $2) as ok", [source, cap]))[0]?.ok === true,
    dailyLimitHit: async () => {
      await db.query("select mirror.record_daily_limit($1)", [source]);
    },
  };
}
```

Create `src/server/mirror/monday/test-fakes.ts`:

```ts
import type { MondayClient } from "./client";

/**
 * A MondayClient whose answers come from `handler`. Tests only. Write handlers
 * that look at the document's root field ("items_page", "activity_logs", ...).
 */
export function fakeMonday(
  handler: (document: string, variables: Record<string, unknown>) => unknown,
): MondayClient & { documents: string[] } {
  const stats: MondayClient["stats"] = { calls: 0, complexity: 0, lastComplexity: null };
  const documents: string[] = [];
  return {
    stats,
    documents,
    async query<T>(document: string, variables: Record<string, unknown> = {}): Promise<T> {
      stats.calls += 1;
      documents.push(document);
      return handler(document, variables) as T;
    },
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --import tsx --test src/server/mirror/monday/client.test.ts`
Expected: PASS, 9 tests.

- [ ] **Step 5: Checkpoint**

Run: `npm test` and `git status --short`. Expected new files: `client.ts`, `ledger.ts`, `test-fakes.ts`, `client.test.ts` under `src/server/mirror/monday/`. Don't commit.

---

### Task 10: The queries, the normaliser and the activity-log parser

**Files:**
- Create: `src/server/mirror/monday/queries.ts`, test `queries.test.ts`
- Create: `src/server/mirror/monday/normalise.ts`, test `normalise.test.ts`
- Create: `src/server/mirror/monday/activity.ts`, test `activity.test.ts`

**Interfaces:**
- Produces:
  - `Q`: every GraphQL document the mirror sends (`workspaces`, `boardsInWorkspaces`, `boardsById`, `users`, `firstItemsPage`, `nextItemsPage`, `firstStampsPage`, `nextStampsPage`, `recentStampsPage`, `itemsByIds`, `boardUpdatesPage`, `activityWithUpdates`, `activityPage`, `assets`).
  - Raw API shapes: `RawColumnValue`, `RawItem`, `RawUpdate`.
  - Row shapes: `StoredValue`, `ItemRow`, `AssetRef`, `UpdateRow`.
  - `normaliseValue(cv: RawColumnValue): StoredValue`, `fileAssets(value: unknown): { id: number; name: string }[]`.
  - `normaliseItem(raw: RawItem, boardIdFallback?: number): { item: ItemRow; assets: AssetRef[] } | null`.
  - `normaliseUpdate(raw: RawUpdate): { update: UpdateRow; assets: AssetRef[] } | null`.
  - `RawActivityLog`, `BoardActivity`, `ActivityScan`.
  - `activityTime(createdAt: string): Date | null`, `parseActivityLogs(boards: BoardActivity[], pageLimit: number): ActivityScan`.

- [ ] **Step 1: Write the failing tests**

Create `src/server/mirror/monday/normalise.test.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { fileAssets, normaliseItem, normaliseUpdate, type RawItem } from "./normalise";

const raw = (over: Partial<RawItem> = {}): RawItem => ({
  id: "1001",
  name: "Test Client A",
  state: "active",
  created_at: "2026-09-01T00:00:00Z",
  updated_at: "2026-10-07T03:00:00Z",
  creator_id: "77",
  group: { id: "topics" },
  board: { id: "10", name: "Test board" },
  parent_item: null,
  column_values: [],
  ...over,
});

test("normalise: keeps every column value with what its type adds", () => {
  const n = normaliseItem(raw({
    column_values: [
      { id: "text4", type: "text", text: "12345", value: "\"12345\"" },
      { id: "status", type: "status", text: "Done", value: "{\"index\":1}", index: 1, label: "Done" },
      { id: "date4", type: "date", text: "2026-09-01", value: "{\"date\":\"2026-09-01\"}", date: "2026-09-01" },
      { id: "link", type: "board_relation", text: null, value: null, linked_item_ids: ["5", "6"], display_value: "A, B" },
    ],
  }));
  assert.ok(n);
  assert.equal(n.item.id, 1001);
  assert.equal(n.item.board_id, 10);
  assert.equal(n.item.group_id, "topics");
  assert.deepEqual(n.item.column_values.text4, { type: "text", text: "12345", value: "12345" });
  assert.deepEqual(n.item.column_values.status, { type: "status", text: "Done", value: { index: 1 }, label: "Done", index: 1 });
  assert.equal(n.item.column_values.date4.date, "2026-09-01");
  assert.deepEqual(n.item.column_values.link.linked_item_ids, ["5", "6"]);
});

test("normalise: an unexpected shape still keeps the item (Review Focus 5)", () => {
  const n = normaliseItem(raw({
    column_values: [
      { id: "odd", type: "brand_new_type", text: null, value: "not json {" },
      { id: "empty", type: "text", text: null, value: null },
    ],
  }));
  assert.ok(n);
  assert.deepEqual(n.item.column_values.odd, { type: "brand_new_type", text: null, value: "not json {" });
  assert.deepEqual(n.item.column_values.empty, { type: "text", text: null, value: null });
  assert.ok(normaliseItem(raw({ column_values: null })), "no column values at all is still an item");
});

test("normalise: a file column's assets are listed, links and docs are not", () => {
  const value = { files: [{ assetId: 9001, name: "plan.pdf", fileType: "ASSET" }, { fileType: "LINK", linkToFile: "https://example.com" }] };
  assert.deepEqual(fileAssets(value), [{ id: 9001, name: "plan.pdf" }]);
  const n = normaliseItem(raw({ column_values: [{ id: "files_f", type: "file", text: "plan.pdf", value: JSON.stringify(value) }] }));
  assert.deepEqual(n?.assets, [{ id: 9001, item_id: 1001, column_id: "files_f", update_id: null, name: "plan.pdf" }]);
});

test("normalise: a subitem knows its parent; unknown states read as active; junk ids are dropped", () => {
  const sub = normaliseItem(raw({ id: "2001", parent_item: { id: "1001" }, state: "weird" }));
  assert.equal(sub?.item.parent_item_id, 1001);
  assert.equal(sub?.item.state, "active");
  assert.equal(normaliseItem(raw({ id: "not-a-number" })), null);
  assert.equal(normaliseItem(raw({ board: null }), 99)?.item.board_id, 99, "falls back to the board being read");
});

test("normalise: an update and its attachments", () => {
  const n = normaliseUpdate({
    id: "500",
    item_id: "1001",
    body: "<p>Contract attached</p>",
    text_body: "Contract attached",
    created_at: "2026-10-01T00:00:00Z",
    updated_at: "2026-10-01T00:00:00Z",
    creator_id: "77",
    assets: [{ id: "9100", name: "contract.pdf" }],
  });
  assert.equal(n?.update.item_id, 1001);
  assert.deepEqual(n?.assets, [{ id: 9100, item_id: 1001, column_id: null, update_id: 500, name: "contract.pdf" }]);
  assert.equal(normaliseUpdate({ id: "501", item_id: null }), null, "an update with no item is skipped");
});
```

Create `src/server/mirror/monday/activity.test.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { activityTime, parseActivityLogs, type BoardActivity } from "./activity";

const log = (event: string, data: object | null, at = "17597952000000000") => ({
  id: `${event}-${Math.random()}`,
  event,
  entity: "pulse",
  data: data ? JSON.stringify(data) : null,
  created_at: at,
});

test("activity: 17-digit times are tenths of a microsecond", () => {
  assert.equal(activityTime("17597952000000000")?.toISOString(), "2025-10-07T00:00:00.000Z");
  assert.equal(activityTime("2026-10-08T01:00:00Z")?.toISOString(), "2026-10-08T01:00:00.000Z");
  assert.equal(activityTime("garbage"), null);
});

test("activity: item ids from every event, a subitem's parent too, removals hinted, the newest time kept", () => {
  const boards: BoardActivity[] = [
    {
      id: "10",
      activity_logs: [
        log("update_column_value", { pulse_id: 1001, column_id: "status" }, "17598816000000000"),
        log("create_pulse", { pulse_id: 1002 }),
        log("delete_pulse", { pulse_id: 1003 }),
        log("move_pulse_into_group", { pulse_id: 1001 }),
      ],
    },
    {
      id: "11",
      activity_logs: [
        log("archive_pulse", { pulse_id: 2001, parent_item_id: 1001 }),
        log("update_column_value", { pulse_id: 2002, parent_item_id: 1004 }),
      ],
    },
  ];
  const scan = parseActivityLogs(boards, 1000);
  assert.deepEqual(scan.itemIds.sort(), [1001, 1002, 1003, 1004, 2001, 2002]);
  assert.deepEqual(scan.removedHints.sort(), [1003, 2001], "archiving a subitem doesn't hint its parent away");
  assert.equal(scan.latest?.toISOString(), "2025-10-08T00:00:00.000Z");
  assert.deepEqual(scan.fullBoards, []);
});

test("activity: board-level column events ask for a column refresh; junk data is skipped", () => {
  const scan = parseActivityLogs(
    [{ id: "10", activity_logs: [log("create_column", { column_id: "new" }), log("update_name", null), { ...log("x", null), data: "{bad" }] }],
    1000,
  );
  assert.deepEqual(scan.itemIds, []);
  assert.deepEqual(scan.columnsChangedBoards, [10]);
});

test("activity: a full page marks the board for another page (Review Focus 2)", () => {
  const logs = Array.from({ length: 3 }, (_, i) => log("update_column_value", { pulse_id: 1000 + i }));
  const scan = parseActivityLogs([{ id: "10", activity_logs: logs }, { id: "11", activity_logs: [] }], 3);
  assert.deepEqual(scan.fullBoards, [10]);
});
```

Create `src/server/mirror/monday/queries.test.ts`. The pass tests use `fakeMonday`, which skips the client's guard and complexity injection, so this checks every document the mirror sends against the real ones (Task 9):

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { isWriteOperation, withComplexity } from "./client";
import { Q } from "./queries";

test("queries: every document is a read the client sends, with complexity added once", () => {
  for (const [name, document] of Object.entries(Q)) {
    assert.equal(isWriteOperation(document), false, `${name} must read as a query`);
    const sent = withComplexity(document);
    assert.equal(sent.split("complexity {").length - 1, 1, `${name} gets complexity once`);
    assert.equal(isWriteOperation(sent), false, `${name} is still a query once complexity is added`);
  }
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `node --import tsx --test src/server/mirror/monday/normalise.test.ts src/server/mirror/monday/activity.test.ts src/server/mirror/monday/queries.test.ts`
Expected: FAIL, modules not found.

- [ ] **Step 3: Write the queries**

Create `src/server/mirror/monday/queries.ts`:

```ts
/**
 * Every GraphQL document the mirror sends. All of them are queries: the client
 * refuses anything else. Multi-board queries set `limit`, because Monday's
 * `boards` returns 25 by default. Column values ask only for fragments known to
 * exist in 2026-10; file assets are read from a file column's raw `value`.
 */
const COLUMN_VALUES = `column_values {
  id type text value
  ... on StatusValue { index label }
  ... on DateValue { date }
  ... on BoardRelationValue { linked_item_ids display_value }
  ... on MirrorValue { display_value }
}`;

export const ITEM_FIELDS = `id name state created_at updated_at creator_id group { id } board { id name } parent_item { id } ${COLUMN_VALUES}`;

const UPDATE_FIELDS = "id item_id body text_body created_at updated_at creator_id assets { id name }";

const BOARD_FIELDS = "id name type state updated_at workspace { id } columns { id title type } groups { id title color position archived deleted }";

export const Q = {
  workspaces: "query { workspaces(limit: 100) { id name kind } }",
  boardsInWorkspaces: `query ($ws: [ID!], $page: Int!) { boards(workspace_ids: $ws, limit: 100, page: $page, state: all) { ${BOARD_FIELDS} } }`,
  boardsById: `query ($ids: [ID!]) { boards(ids: $ids, limit: 100, state: all) { ${BOARD_FIELDS} } }`,
  users: "query ($page: Int!) { users(limit: 200, page: $page) { id name email enabled is_guest } }",
  firstItemsPage: `query ($board: [ID!], $limit: Int!) { boards(ids: $board) { items_page(limit: $limit) { cursor items { ${ITEM_FIELDS} } } } }`,
  nextItemsPage: `query ($cursor: String!, $limit: Int!) { next_items_page(cursor: $cursor, limit: $limit) { cursor items { ${ITEM_FIELDS} } } }`,
  firstStampsPage: "query ($board: [ID!], $limit: Int!) { boards(ids: $board) { items_page(limit: $limit) { cursor items { id updated_at } } } }",
  nextStampsPage: "query ($cursor: String!, $limit: Int!) { next_items_page(cursor: $cursor, limit: $limit) { cursor items { id updated_at } } }",
  recentStampsPage: `query ($board: [ID!], $limit: Int!) { boards(ids: $board) { items_page(limit: $limit, query_params: { rules: [{ column_id: "__last_updated__", compare_value: ["TODAY", "YESTERDAY"], compare_attribute: "UPDATED_AT", operator: any_of }] }) { cursor items { id updated_at } } } }`,
  itemsByIds: `query ($ids: [ID!], $limit: Int!) { items(ids: $ids, limit: $limit, exclude_nonactive: false) { ${ITEM_FIELDS} } }`,
  boardUpdatesPage: `query ($board: [ID!], $limit: Int!, $page: Int!) { boards(ids: $board) { updates(limit: $limit, page: $page) { ${UPDATE_FIELDS} } } }`,
  activityWithUpdates: `query ($boards: [ID!], $from: ISO8601DateTime!, $limit: Int!) { boards(ids: $boards, limit: 100) { id activity_logs(from: $from, limit: $limit, page: 1) { id event entity data created_at } updates(limit: 25) { ${UPDATE_FIELDS} } } }`,
  activityPage: "query ($boards: [ID!], $from: ISO8601DateTime!, $limit: Int!, $page: Int!) { boards(ids: $boards, limit: 100) { id activity_logs(from: $from, limit: $limit, page: $page) { id event entity data created_at } } }",
  assets: "query ($ids: [ID!]!) { assets(ids: $ids) { id name file_extension file_size public_url created_at } }",
} as const;
```

- [ ] **Step 4: Write the normaliser and the parser**

Create `src/server/mirror/monday/normalise.ts`:

```ts
/** API items and updates to the rows the mirror stores. Tolerant: nothing here throws on odd data. */

export interface RawColumnValue {
  id: string;
  type: string;
  text: string | null;
  value: string | null;
  index?: number | null;
  label?: string | null;
  date?: string | null;
  linked_item_ids?: (string | number)[] | null;
  display_value?: string | null;
}

export interface RawItem {
  id: string;
  name: string;
  state?: string | null;
  created_at?: string | null;
  updated_at: string;
  creator_id?: string | null;
  group?: { id: string } | null;
  board?: { id: string; name?: string | null } | null;
  parent_item?: { id: string } | null;
  column_values?: RawColumnValue[] | null;
}

export interface RawUpdate {
  id: string;
  item_id: string | null;
  body?: string | null;
  text_body?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  creator_id?: string | null;
  assets?: { id: string; name: string }[] | null;
}

/** One column value as stored in mirror.monday_items.column_values. */
export interface StoredValue {
  type: string;
  text: string | null;
  value: unknown;
  label?: string;
  index?: number;
  date?: string;
  display_value?: string;
  linked_item_ids?: string[];
}

export interface ItemRow {
  id: number;
  board_id: number;
  /** For creating a placeholder board row when the item is on a board we haven't seen. Not stored on the item. */
  board_name: string | null;
  group_id: string | null;
  parent_item_id: number | null;
  name: string;
  state: "active" | "archived" | "deleted";
  creator_id: number | null;
  monday_created_at: string | null;
  monday_updated_at: string;
  column_values: Record<string, StoredValue>;
}

export interface AssetRef {
  id: number;
  item_id: number;
  column_id: string | null;
  update_id: number | null;
  name: string;
}

export interface UpdateRow {
  id: number;
  item_id: number;
  creator_id: number | null;
  body: string | null;
  text_body: string | null;
  monday_created_at: string | null;
  monday_updated_at: string | null;
}

export function toId(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}

function parseJson(raw: string | null | undefined): unknown {
  if (raw === null || raw === undefined) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

const STATES = new Set(["active", "archived", "deleted"]);

export function normaliseValue(cv: RawColumnValue): StoredValue {
  const out: StoredValue = { type: cv.type ?? "unknown", text: cv.text ?? null, value: parseJson(cv.value) };
  if (cv.label != null) out.label = cv.label;
  if (cv.index != null) out.index = cv.index;
  if (cv.date != null) out.date = cv.date;
  if (cv.display_value != null) out.display_value = cv.display_value;
  if (Array.isArray(cv.linked_item_ids)) out.linked_item_ids = cv.linked_item_ids.map(String);
  return out;
}

/** The uploaded files a file column holds ({"files": [{"assetId": ...}]}). Links and docs have no asset. */
export function fileAssets(value: unknown): { id: number; name: string }[] {
  const files = (value as { files?: unknown } | null)?.files;
  if (!Array.isArray(files)) return [];
  return files.flatMap((f) => {
    const file = f as { assetId?: unknown; name?: unknown };
    const id = toId(file.assetId);
    if (id === null) return [];
    return [{ id, name: typeof file.name === "string" && file.name ? file.name : `file-${id}` }];
  });
}

export function normaliseItem(raw: RawItem, boardIdFallback?: number): { item: ItemRow; assets: AssetRef[] } | null {
  const id = toId(raw.id);
  const boardId = toId(raw.board?.id) ?? boardIdFallback ?? null;
  if (id === null || boardId === null || !raw.updated_at) return null;

  const column_values: Record<string, StoredValue> = {};
  const assets: AssetRef[] = [];
  for (const cv of raw.column_values ?? []) {
    if (!cv || typeof cv.id !== "string") continue;
    const stored = normaliseValue(cv);
    column_values[cv.id] = stored;
    if (stored.type === "file") {
      for (const f of fileAssets(stored.value)) {
        assets.push({ id: f.id, item_id: id, column_id: cv.id, update_id: null, name: f.name });
      }
    }
  }

  return {
    item: {
      id,
      board_id: boardId,
      board_name: raw.board?.name ?? null,
      group_id: raw.group?.id ?? null,
      parent_item_id: toId(raw.parent_item?.id),
      name: raw.name || `Item ${id}`,
      state: raw.state && STATES.has(raw.state) ? (raw.state as ItemRow["state"]) : "active",
      creator_id: toId(raw.creator_id),
      monday_created_at: raw.created_at ?? null,
      monday_updated_at: raw.updated_at,
      column_values,
    },
    assets,
  };
}

export function normaliseUpdate(raw: RawUpdate): { update: UpdateRow; assets: AssetRef[] } | null {
  const id = toId(raw.id);
  const itemId = toId(raw.item_id);
  if (id === null || itemId === null) return null;
  const assets = (raw.assets ?? []).flatMap((a) => {
    const assetId = toId(a?.id);
    return assetId === null ? [] : [{ id: assetId, item_id: itemId, column_id: null, update_id: id, name: a.name || `file-${assetId}` }];
  });
  return {
    update: {
      id,
      item_id: itemId,
      creator_id: toId(raw.creator_id),
      body: raw.body ?? null,
      text_body: raw.text_body ?? null,
      monday_created_at: raw.created_at ?? null,
      monday_updated_at: raw.updated_at ?? null,
    },
    assets,
  };
}
```

Create `src/server/mirror/monday/activity.ts`:

```ts
import { toId, type RawUpdate } from "./normalise";

/**
 * Monday's activity logs, read as hints: which items changed since the
 * watermark. Monday doesn't document the keys inside `data`; we read the item
 * ids we find (pulse_id, item_id and their plurals) and skip what we can't place.
 * The daily safety pass and the weekly sweep catch anything this misses.
 */
export interface RawActivityLog {
  id?: string;
  event: string;
  entity?: string | null;
  data?: string | null;
  created_at: string;
}

export interface BoardActivity {
  id: string;
  activity_logs: RawActivityLog[] | null;
  updates?: RawUpdate[] | null;
}

export interface ActivityScan {
  /** Every item (or subitem) id an entry names. Refetch them all. */
  itemIds: number[];
  /** Ids named by a delete or archive entry. */
  removedHints: number[];
  /** Boards whose columns changed (an entry with no item id that mentions a column). */
  columnsChangedBoards: number[];
  latest: Date | null;
  /** Boards that returned a full page: there may be more entries. */
  fullBoards: number[];
}

/** Activity times are 17 digits, tenths of a microsecond since the epoch. ISO strings pass through. */
export function activityTime(createdAt: string): Date | null {
  if (/^\d{16,18}$/.test(createdAt)) return new Date(Number(BigInt(createdAt) / BigInt(10000)));
  const t = Date.parse(createdAt);
  return Number.isNaN(t) ? null : new Date(t);
}

function parseData(raw: string | null | undefined): Record<string, unknown> | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw);
    return v && typeof v === "object" ? (v as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/** The items an entry names, and a subitem's parent, which is refetched with it but never hinted removed. */
function idsIn(data: Record<string, unknown> | null): { ids: number[]; parents: number[] } {
  if (!data) return { ids: [], parents: [] };
  const out = new Set<number>();
  for (const key of ["pulse_id", "item_id"]) {
    const id = toId(data[key]);
    if (id !== null) out.add(id);
  }
  for (const key of ["pulse_ids", "item_ids"]) {
    const list = data[key];
    if (Array.isArray(list)) for (const v of list) {
      const id = toId(v);
      if (id !== null) out.add(id);
    }
  }
  const parent = toId(data.parent_item_id);
  return { ids: [...out], parents: parent === null ? [] : [parent] };
}

const REMOVAL = /delete|archive/i;
const RESTORE = /restore|unarchive/i;

export function parseActivityLogs(boards: BoardActivity[], pageLimit: number): ActivityScan {
  const items = new Set<number>();
  const removed = new Set<number>();
  const columns = new Set<number>();
  const full: number[] = [];
  let latest: number | null = null;

  for (const board of boards) {
    const boardId = Number(board.id);
    const logs = board.activity_logs ?? [];
    if (logs.length >= pageLimit) full.push(boardId);
    for (const entry of logs) {
      const t = activityTime(entry.created_at)?.getTime() ?? null;
      if (t !== null && (latest === null || t > latest)) latest = t;
      const { ids, parents } = idsIn(parseData(entry.data));
      if (ids.length === 0 && parents.length === 0) {
        if (/column/i.test(entry.event)) columns.add(boardId);
        continue;
      }
      for (const id of parents) items.add(id);
      for (const id of ids) {
        items.add(id);
        if (REMOVAL.test(entry.event) && !RESTORE.test(entry.event)) removed.add(id);
      }
    }
  }

  return {
    itemIds: [...items],
    removedHints: [...removed],
    columnsChangedBoards: [...columns],
    latest: latest === null ? null : new Date(latest),
    fullBoards: full,
  };
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `node --import tsx --test src/server/mirror/monday/normalise.test.ts src/server/mirror/monday/activity.test.ts src/server/mirror/monday/queries.test.ts`
Expected: PASS, 10 tests.

- [ ] **Step 6: Checkpoint**

Run: `npm test`, `npx tsc --noEmit` and `git status --short`. Expected new files: `queries.ts`, `queries.test.ts`, `normalise.ts`, `normalise.test.ts`, `activity.ts`, `activity.test.ts`. Don't commit.

---

### Task 11: Storing, discovering, and setup

> **Changed in review (2026-10-08).** In the repo:
> - `matchRepAliases` indexes only the name keys exactly one person claims, so a contested name, such as "Sam Lee" for Sam Lee and Samuel "Sam" Lee, goes to `unmatched` and is never matched to whoever is read last;
> - `endRun` always releases the lease, `beginRun` unlocks if logging fails, and an absent watermark is SQL NULL;
> - setup fails clearly on a thin config, reports subitems boards it can't see, folds accents in names, knows all eight regions, and stops re-listing names that already have an alias.
>
> Copy from the repo, not from here.

**Files:**
- Create: `src/server/mirror/runs.ts`
- Create: `src/server/mirror/monday/store.ts`, test `store.test.ts`
- Create: `src/server/mirror/monday/discover.ts`
- Create: `src/server/mirror/monday/setup.ts`, test `setup.test.ts`

**Interfaces:**
- Consumes: `Db`, `MondayClient`, `Q`, `normaliseItem`, `normaliseUpdate`, `ItemRow`, `AssetRef`, `UpdateRow`, `RawItem`, `RawUpdate`, `toId`.
- Produces:
  - Run bookkeeping (`runs.ts`):
    - `beginRun(db, source: "monday" | "hubspot" | "hubstaff", mode: string, trigger: "cron" | "cli" | "manual", lockSeconds: number, lockKey?: string): Promise<RunHandle | null>`;
    - `endRun(db, run: RunHandle, result: RunOutcome): Promise<void>`;
    - `getWatermark(db, source, scope): Promise<Date | null>` and `setWatermark(db, source, scope, at: Date)`;
    - `markState(db, source, scope, field: "backfilled_at" | "swept_at")`.
  - Store (`store.ts`):
    - writers: `upsertWorkspaces`, `upsertBoards`, `replaceColumns`, `replaceGroups`, `upsertItems(db, items: ItemRow[]): Promise<number>`, `syncFileAssets(db, itemIds: number[], assets: AssetRef[]): Promise<void>`, `upsertUpdates(db, updates: UpdateRow[], assets: AssetRef[]): Promise<number>`, `markRemoved(db, ids: number[]): Promise<number>`, `upsertUsers`;
    - readers: `itemStamps(db, boardId): Promise<Map<number, number>>`, `syncedBoards(db, boardKey?): Promise<SyncedBoard[]>`.
    - Shape: `SyncedBoard { id: number; name: string; board_key: string | null; purpose: string | null; parent_board_id: number | null }`.
  - Discovery (`discover.ts`): `discoverWorkspaces`, `discoverBoards(db, monday, workspaceIds)`, `discoverBoardsById(db, monday, ids): Promise<number[]>`, `discoverUsers`.
  - Setup (`setup.ts`), pure: `planFromJerryConfig(config, vocabulary: Set<string>)`, `purposeOf`, `divisionOf`, `regionOf`, `matchLotColumns`, `matchRepAliases`, `normaliseName`.
  - Setup (`setup.ts`), with side effects: `runSetup(db, monday, opts: { jerryConfigPath: string | null; log })` and `matchReps(db)`.

- [ ] **Step 1: Write the failing tests**

Create `src/server/mirror/monday/store.test.ts`:

```ts
import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { migratedTestDb } from "../../db/pglite";
import type { Db } from "../../db/types";
import { normaliseItem, type RawItem } from "./normalise";
import { itemStamps, markRemoved, syncFileAssets, syncedBoards, upsertBoards, upsertItems, upsertWorkspaces } from "./store";

let db: Db;
let close: () => Promise<void>;
before(async () => {
  ({ db, close } = await migratedTestDb());
  await upsertWorkspaces(db, [{ id: 1, name: "Test workspace", kind: "open" }]);
  await upsertBoards(db, [{ id: 10, workspace_id: 1, name: "Test board", type: "board", state: "active", monday_updated_at: null }]);
});
after(async () => close());

const item = (id: string, updated: string, over: Partial<RawItem> = {}) =>
  normaliseItem({ id, name: `Test item ${id}`, updated_at: updated, board: { id: "10", name: "Test board" }, ...over })!;

test("store: items upsert once, and only a newer copy counts as a change", async () => {
  assert.equal(await upsertItems(db, [item("1001", "2026-10-07T00:00:00Z").item]), 1);
  assert.equal(await upsertItems(db, [item("1001", "2026-10-07T00:00:00Z").item]), 0);
  assert.equal(await upsertItems(db, [item("1001", "2026-10-08T00:00:00Z").item]), 1);
  const stamps = await itemStamps(db, 10);
  assert.equal(stamps.get(1001), Date.parse("2026-10-08T00:00:00Z"));
});

test("store: duplicate ids in one batch don't break the upsert", async () => {
  const a = item("1002", "2026-10-07T00:00:00Z").item;
  assert.equal(await upsertItems(db, [a, a]), 1);
});

test("store: an item on a board we haven't seen gets a placeholder board", async () => {
  await upsertItems(db, [item("1003", "2026-10-07T00:00:00Z", { board: { id: "99", name: "Moved here" } }).item]);
  const [b] = await db.query<{ name: string; sync_enabled: boolean }>("select name, sync_enabled from mirror.monday_boards where id = 99");
  assert.deepEqual(b, { name: "Moved here", sync_enabled: false });
});

test("store: removing marks the item, and a returning item is live again", async () => {
  assert.equal(await markRemoved(db, [1001]), 1);
  const [gone] = await db.query<{ state: string; removed: boolean }>("select state, removed_at is not null as removed from mirror.monday_items where id = 1001");
  assert.deepEqual(gone, { state: "deleted", removed: true });
  await upsertItems(db, [item("1001", "2026-10-09T00:00:00Z").item]);
  const [back] = await db.query<{ state: string; removed: boolean }>("select state, removed_at is not null as removed from mirror.monday_items where id = 1001");
  assert.deepEqual(back, { state: "active", removed: false });
});

test("store: a file taken out of a column is marked removed", async () => {
  await syncFileAssets(db, [1002], [
    { id: 9001, item_id: 1002, column_id: "files", update_id: null, name: "a.pdf" },
    { id: 9002, item_id: 1002, column_id: "files", update_id: null, name: "b.pdf" },
  ]);
  await syncFileAssets(db, [1002], [{ id: 9001, item_id: 1002, column_id: "files", update_id: null, name: "a.pdf" }]);
  const rows = await db.query<{ id: number; removed: boolean }>("select id, removed_at is not null as removed from mirror.monday_assets order by id");
  assert.deepEqual(rows, [{ id: 9001, removed: false }, { id: 9002, removed: true }]);
});

test("store: synced boards are the enabled ones, parents first", async () => {
  await db.query("update mirror.monday_boards set sync_enabled = true, board_key = 'test_board' where id = 10");
  const boards = await syncedBoards(db);
  assert.deepEqual(boards.map((b) => b.id), [10]);
  assert.deepEqual((await syncedBoards(db, "nope")).map((b) => b.id), []);
});

test("store: a NUL or a lone surrogate in Monday's text can't fail the batch", async () => {
  // Postgres refuses both in json and text. The store drops NULs and replaces a lone surrogate with U+FFFD.
  const nul = String.fromCharCode(0);
  const surrogate = String.fromCharCode(0xd800);
  const odd = item("1004", "2026-10-07T00:00:00Z", { name: `Test${nul} item ${surrogate}` }).item;
  assert.equal(await upsertItems(db, [odd]), 1);
  const [row] = await db.query<{ name: string }>("select name from mirror.monday_items where id = 1004");
  assert.equal(row.name, `Test item ${String.fromCharCode(0xfffd)}`);
});
```

Create `src/server/mirror/monday/setup.test.ts`. The config here is invented: the real one is read from Jerry's folder at run time and never copied into the repo.

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { matchLotColumns, matchRepAliases, normaliseName, planFromJerryConfig, purposeOf, regionOf, runSetup } from "./setup";

const VOCAB = new Set([
  "job_number", "site_address", "sales_rep", "builder", "hubspot_id", "construction_stage",
  "milestone_status", "due_date", "date_completed", "files", "notes", "people",
]);

const config = {
  boards: {
    _note: "ignored",
    homes_sales_wa: { parent: 100, subitems: 101 },
    homes_construction_wa: { parent: 200, subitems: 201 },
    exclusive_land: { parent: 300, subitems: null, access: "read" },
  },
  parentColumns: {
    _note: "ignored",
    shared_homes: { _applies_to: ["homes_sales_wa", "homes_construction_wa"], job_number: "text4", sales_rep: "text_r" },
    legacy_note_only: { job_number: "text_x", _note: "no _applies_to, so skipped" },
    per_board: {
      _note: "ignored",
      homes_sales_wa: { builder: "color_a", hubspot_id: "text_h", invented_field: "x" },
      homes_construction_wa: { construction_stage: "color_c" },
    },
  },
  subitemColumns: {
    all_boards: { milestone_status: "status", due_date: "date", files: "files_a", people: "people_p" },
    per_board: { homes_construction_wa: { due_date: "date0", people: null } },
  },
};

test("setup: labels each board from its key", () => {
  assert.equal(purposeOf("homes_sales_wa"), "sales");
  assert.equal(purposeOf("wealth_construction"), "construction");
  assert.equal(purposeOf("homes_handed_over_wa"), "handed_over");
  assert.equal(purposeOf("exclusive_land"), "exclusive_land");
  assert.equal(purposeOf("models"), "models");
  assert.equal(regionOf("homes_sales_qld"), "QLD");
  assert.equal(regionOf("wealth_sales"), null);
});

test("setup: Jerry's config becomes boards and a field map", () => {
  const plan = planFromJerryConfig(config, VOCAB);
  assert.deepEqual(
    plan.boards.map((b) => [b.boardKey, b.parentId, b.subitemsId, b.purpose]),
    [
      ["homes_sales_wa", 100, 101, "sales"],
      ["homes_construction_wa", 200, 201, "construction"],
      ["exclusive_land", 300, null, "exclusive_land"],
    ],
  );
  const fields = (board: number) => Object.fromEntries(plan.fields.filter((f) => f.boardId === board).map((f) => [f.fieldKey, f.columnId]));
  assert.deepEqual(fields(100), { job_number: "text4", sales_rep: "text_r", builder: "color_a", hubspot_id: "text_h" });
  assert.deepEqual(fields(200), { job_number: "text4", sales_rep: "text_r", construction_stage: "color_c" });
  assert.deepEqual(fields(101), { milestone_status: "status", due_date: "date", files: "files_a", people: "people_p" });
  assert.deepEqual(fields(201), { milestone_status: "status", due_date: "date0", files: "files_a" });
  assert.deepEqual(plan.unknownFields, ["invented_field"]);
});

test("setup: Exclusive Land columns are matched by title, each column once", () => {
  const matched = matchLotColumns([
    { id: "name", title: "Name", type: "name" },
    { id: "status", title: "Status", type: "status" },
    { id: "text_e", title: "Estate", type: "text" },
    { id: "num_p", title: "Land Price", type: "numbers" },
    { id: "num_q", title: "Price", type: "numbers" },
    { id: "files", title: "Plans & Files", type: "file" },
    { id: "odd", title: "Something else", type: "text" },
  ]);
  assert.deepEqual(matched.fields, [
    { fieldKey: "lot_status", columnId: "status" },
    { fieldKey: "lot_estate", columnId: "text_e" },
    { fieldKey: "lot_land_price", columnId: "num_p" },
    { fieldKey: "lot_files", columnId: "files" },
  ]);
  assert.deepEqual(matched.unmatched, ["Price", "Something else"]);
});

test("setup: rep names match a person by full name, go-by name or without a middle name", () => {
  const staff = [
    { id: "jan-kane-reroma", name: "Jan Kane Reroma", preferred_name: "Kane" },
    { id: "test-rep-a", name: "Test Rep A", preferred_name: null },
  ];
  const result = matchRepAliases([" Jan Kane Reroma ", "kane reroma", "TEST REP A", "Nobody Known", ""], staff);
  // Monday's own text comes back: matchReps turns it into the key the loaders look up.
  assert.deepEqual(result.matched, [
    { rep: " Jan Kane Reroma ", staffId: "jan-kane-reroma" },
    { rep: "kane reroma", staffId: "jan-kane-reroma" },
    { rep: "TEST REP A", staffId: "test-rep-a" },
  ]);
  assert.deepEqual(result.unmatched, ["Nobody Known"]);
  assert.equal(normaliseName("  O’Neill,  Sean "), "o'neill sean");
});

test("setup: a config file with no boards stops before touching the database or Monday", async () => {
  const path = join(mkdtempSync(join(tmpdir(), "lp-setup-")), "monday.json");
  writeFileSync(path, JSON.stringify({ workspaces: {} }));
  // Any use of either fails the test with "touched" instead of the expected message.
  const untouchable = new Proxy({}, { get: () => { throw new Error("touched"); } }) as never;
  await assert.rejects(runSetup(untouchable, untouchable, { jerryConfigPath: path, log: () => {} }), /No boards/);
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `node --import tsx --test src/server/mirror/monday/store.test.ts src/server/mirror/monday/setup.test.ts`
Expected: FAIL, modules not found.

- [ ] **Step 3: Write the run bookkeeping**

Create `src/server/mirror/runs.ts`:

```ts
import { randomUUID } from "node:crypto";
import type { Db } from "../db/types";

export type MirrorSource = "monday" | "hubspot" | "hubstaff";
export type Trigger = "cron" | "cli" | "manual";

export interface RunHandle {
  id: number;
  lockKey: string;
  owner: string;
}

export interface RunOutcome {
  status: "ok" | "partial" | "failed" | "skipped";
  calls: number;
  complexity: number;
  seen: number;
  changed: number;
  note: string | null;
  error: string | null;
  watermarkBefore: Date | null;
  watermarkAfter: Date | null;
}

/**
 * Opens a run under the lease for `lockKey` (default: the source). Returns null,
 * after recording a skipped run, when another pass holds the lease.
 */
export async function beginRun(
  db: Db,
  source: MirrorSource,
  mode: string,
  trigger: Trigger,
  lockSeconds: number,
  lockKey: string = source,
): Promise<RunHandle | null> {
  const owner = `${mode}:${randomUUID()}`;
  const [lock] = await db.query<{ ok: boolean }>("select mirror.try_lock($1, $2, $3) as ok", [lockKey, owner, lockSeconds]);
  if (!lock?.ok) {
    await db.query(
      `insert into mirror.sync_runs (source, mode, trigger, finished_at, status, note)
       values ($1, $2, $3, now(), 'skipped', 'another pass was running')`,
      [source, mode, trigger],
    );
    return null;
  }
  const [run] = await db.query<{ id: number }>(
    "insert into mirror.sync_runs (source, mode, trigger) values ($1, $2, $3) returning id",
    [source, mode, trigger],
  );
  return { id: run.id, lockKey, owner };
}

export async function endRun(db: Db, run: RunHandle, outcome: RunOutcome): Promise<void> {
  await db.query(
    `update mirror.sync_runs set
       finished_at = now(), status = $2, api_calls = $3, complexity = $4, records_seen = $5,
       records_changed = $6, note = $7, error = left($8, 2000),
       watermark_before = $9::jsonb, watermark_after = $10::jsonb
     where id = $1`,
    [
      run.id,
      outcome.status,
      Math.round(outcome.calls),
      Math.round(outcome.complexity),
      outcome.seen,
      outcome.changed,
      outcome.note,
      outcome.error,
      JSON.stringify(outcome.watermarkBefore?.toISOString() ?? null),
      JSON.stringify(outcome.watermarkAfter?.toISOString() ?? null),
    ],
  );
  await db.query("select mirror.unlock($1, $2)", [run.lockKey, run.owner]);
}

export async function getWatermark(db: Db, source: MirrorSource, scope: string): Promise<Date | null> {
  const [row] = await db.query<{ watermark: Date | null }>(
    "select watermark from mirror.sync_state where source = $1 and scope = $2",
    [source, scope],
  );
  return row?.watermark ?? null;
}

export async function setWatermark(db: Db, source: MirrorSource, scope: string, at: Date): Promise<void> {
  await db.query(
    `insert into mirror.sync_state (source, scope, watermark) values ($1, $2, $3::timestamptz)
     on conflict (source, scope) do update set watermark = excluded.watermark`,
    [source, scope, at.toISOString()],
  );
}

export async function markState(
  db: Db,
  source: MirrorSource,
  scope: string,
  field: "backfilled_at" | "swept_at",
): Promise<void> {
  await db.query(
    `insert into mirror.sync_state (source, scope, ${field}) values ($1, $2, now())
     on conflict (source, scope) do update set ${field} = now()`,
    [source, scope],
  );
}
```

- [ ] **Step 4: Write the store**

Create `src/server/mirror/monday/store.ts`:

```ts
import type { Db } from "../../db/types";
import type { AssetRef, ItemRow, UpdateRow } from "./normalise";

/** Upserts into mirror.monday_*. Batches travel as one JSON parameter; duplicate ids are dropped first. */

const dedupe = <T extends { id: number | string }>(rows: T[]): T[] => [...new Map(rows.map((r) => [r.id, r])).values()];
/**
 * Rows as JSON text for `$n::jsonb`. Postgres refuses a NUL character (and a lone surrogate) anywhere in json
 * or text, which would fail the whole batch, and the same window would fail on every run after. So each string
 * drops its NULs and has any lone surrogate replaced (U+FFFD) before it's written.
 */
const json = (v: unknown) =>
  JSON.stringify(v, (_key, x) => (typeof x === "string" ? x.replaceAll("\u0000", "").toWellFormed() : x));

export interface BoardRow {
  id: number;
  workspace_id: number | null;
  name: string;
  type: string;
  state: string;
  monday_updated_at: string | null;
}

export interface ColumnRow {
  id: string;
  title: string;
  type: string;
  position: number;
}

export interface GroupRow {
  id: string;
  title: string;
  color: string | null;
  position: string | null;
  archived: boolean;
  deleted: boolean;
}

export interface SyncedBoard {
  id: number;
  name: string;
  board_key: string | null;
  purpose: string | null;
  parent_board_id: number | null;
}

export async function upsertWorkspaces(db: Db, rows: { id: number; name: string; kind: string | null }[]): Promise<void> {
  if (rows.length === 0) return;
  await db.query(
    `insert into mirror.monday_workspaces as w (id, name, kind)
     select x.id, x.name, x.kind from jsonb_to_recordset($1::jsonb) as x(id bigint, name text, kind text)
     on conflict (id) do update set name = excluded.name, kind = excluded.kind, synced_at = now()`,
    [json(dedupe(rows))],
  );
}

export async function upsertBoards(db: Db, rows: BoardRow[]): Promise<void> {
  if (rows.length === 0) return;
  const unique = dedupe(rows);
  // A board can sit in a workspace we haven't listed: add a placeholder for it.
  await db.query(
    `insert into mirror.monday_workspaces (id, name)
     select distinct x.workspace_id, 'Workspace ' || x.workspace_id
     from jsonb_to_recordset($1::jsonb) as x(workspace_id bigint)
     where x.workspace_id is not null
     on conflict (id) do nothing`,
    [json(unique)],
  );
  await db.query(
    `insert into mirror.monday_boards as b (id, workspace_id, name, type, state, monday_updated_at)
     select x.id, x.workspace_id, x.name, coalesce(x.type, 'board'),
            case when x.state in ('active', 'archived', 'deleted') then x.state else 'active' end,
            x.monday_updated_at
     from jsonb_to_recordset($1::jsonb) as x(
       id bigint, workspace_id bigint, name text, type text, state text, monday_updated_at timestamptz)
     on conflict (id) do update set
       workspace_id = coalesce(excluded.workspace_id, b.workspace_id), name = excluded.name, type = excluded.type,
       state = excluded.state, monday_updated_at = excluded.monday_updated_at, synced_at = now()`,
    [json(unique)],
  );
}

/** Makes a board's columns match `rows`: upserts them and drops columns Monday no longer has. */
export async function replaceColumns(db: Db, boardId: number, rows: ColumnRow[]): Promise<void> {
  await db.query(
    `with incoming as (
       select * from jsonb_to_recordset($2::jsonb) as x(id text, title text, type text, position integer)
     ), up as (
       insert into mirror.monday_columns as c (board_id, id, title, type, position)
       select $1, id, title, type, position from incoming
       on conflict (board_id, id) do update set
         title = excluded.title, type = excluded.type, position = excluded.position, synced_at = now()
       returning 1
     )
     delete from mirror.monday_columns c
     where c.board_id = $1 and not exists (select 1 from incoming i where i.id = c.id)`,
    [boardId, json(dedupe(rows))],
  );
}

export async function replaceGroups(db: Db, boardId: number, rows: GroupRow[]): Promise<void> {
  await db.query(
    `with incoming as (
       select * from jsonb_to_recordset($2::jsonb)
         as x(id text, title text, color text, position text, archived boolean, deleted boolean)
     ), up as (
       insert into mirror.monday_groups as g (board_id, id, title, color, position, archived, deleted)
       select $1, id, title, color, position, coalesce(archived, false), coalesce(deleted, false) from incoming
       on conflict (board_id, id) do update set
         title = excluded.title, color = excluded.color, position = excluded.position,
         archived = excluded.archived, deleted = excluded.deleted, synced_at = now()
       returning 1
     )
     delete from mirror.monday_groups g
     where g.board_id = $1 and not exists (select 1 from incoming i where i.id = g.id)`,
    [boardId, json(dedupe(rows))],
  );
}

/** Upserts items. Returns how many rows were new or changed (a copy with the same updated_at is skipped). */
export async function upsertItems(db: Db, items: ItemRow[]): Promise<number> {
  if (items.length === 0) return 0;
  const unique = dedupe(items);
  const boards = dedupe(unique.map((i) => ({ id: i.board_id, name: i.board_name ?? `Board ${i.board_id}` })));
  await db.query(
    `insert into mirror.monday_boards (id, name)
     select x.id, x.name from jsonb_to_recordset($1::jsonb) as x(id bigint, name text)
     on conflict (id) do nothing`,
    [json(boards)],
  );
  const rows = await db.query<{ id: number }>(
    `insert into mirror.monday_items as i (
       id, board_id, group_id, parent_item_id, name, state, creator_id,
       monday_created_at, monday_updated_at, column_values, synced_at, removed_at
     )
     select x.id, x.board_id, x.group_id, x.parent_item_id, x.name, x.state, x.creator_id,
            x.monday_created_at, x.monday_updated_at, x.column_values, now(),
            case when x.state = 'active' then null else now() end
     from jsonb_to_recordset($1::jsonb) as x(
       id bigint, board_id bigint, group_id text, parent_item_id bigint, name text, state text,
       creator_id bigint, monday_created_at timestamptz, monday_updated_at timestamptz, column_values jsonb)
     on conflict (id) do update set
       board_id = excluded.board_id,
       group_id = excluded.group_id,
       parent_item_id = excluded.parent_item_id,
       name = excluded.name,
       state = excluded.state,
       creator_id = excluded.creator_id,
       monday_created_at = excluded.monday_created_at,
       monday_updated_at = excluded.monday_updated_at,
       column_values = excluded.column_values,
       synced_at = now(),
       removed_at = case when excluded.state = 'active' then null else coalesce(i.removed_at, now()) end
     where (i.monday_updated_at, i.state, i.board_id, i.group_id, i.name, i.parent_item_id, i.removed_at is null)
       is distinct from
       (excluded.monday_updated_at, excluded.state, excluded.board_id, excluded.group_id, excluded.name,
        excluded.parent_item_id, excluded.state = 'active')
     returning i.id`,
    [json(unique.map(({ board_name: _board, ...row }) => row))],
  );
  return rows.length;
}

/**
 * Records the files these items' file columns hold now, and marks removed any
 * file a column no longer holds. Files attached to updates are left alone.
 */
export async function syncFileAssets(db: Db, itemIds: number[], assets: AssetRef[]): Promise<void> {
  if (itemIds.length === 0) return;
  const unique = dedupe(assets);
  if (unique.length > 0) {
    await db.query(
      `insert into mirror.monday_assets as a (id, item_id, column_id, update_id, name)
       select x.id, x.item_id, x.column_id, x.update_id, x.name
       from jsonb_to_recordset($1::jsonb) as x(id bigint, item_id bigint, column_id text, update_id bigint, name text)
       on conflict (id) do update set
         item_id = excluded.item_id, column_id = coalesce(excluded.column_id, a.column_id),
         update_id = coalesce(excluded.update_id, a.update_id), name = excluded.name,
         removed_at = null, synced_at = now()`,
      [json(unique)],
    );
  }
  await db.query(
    `update mirror.monday_assets a set removed_at = now()
     where a.item_id in (select (jsonb_array_elements_text($1::jsonb))::bigint)
       and a.column_id is not null and a.removed_at is null
       and a.id not in (select (jsonb_array_elements_text($2::jsonb))::bigint)`,
    [json([...new Set(itemIds)]), json(unique.map((a) => a.id))],
  );
}

export async function upsertUpdates(db: Db, updates: UpdateRow[], assets: AssetRef[]): Promise<number> {
  if (updates.length === 0) return 0;
  const rows = await db.query<{ id: number }>(
    `insert into mirror.monday_updates as u (id, item_id, creator_id, body, text_body, monday_created_at, monday_updated_at)
     select x.id, x.item_id, x.creator_id, x.body, x.text_body, x.monday_created_at, x.monday_updated_at
     from jsonb_to_recordset($1::jsonb) as x(
       id bigint, item_id bigint, creator_id bigint, body text, text_body text,
       monday_created_at timestamptz, monday_updated_at timestamptz)
     on conflict (id) do update set
       body = excluded.body, text_body = excluded.text_body,
       monday_updated_at = excluded.monday_updated_at, synced_at = now()
     where u.monday_updated_at is distinct from excluded.monday_updated_at
     returning u.id`,
    [json(dedupe(updates))],
  );
  const unique = dedupe(assets);
  if (unique.length > 0) {
    await db.query(
      `insert into mirror.monday_assets as a (id, item_id, column_id, update_id, name)
       select x.id, x.item_id, null, x.update_id, x.name
       from jsonb_to_recordset($1::jsonb) as x(id bigint, item_id bigint, update_id bigint, name text)
       on conflict (id) do update set update_id = coalesce(a.update_id, excluded.update_id), synced_at = now()`,
      [json(unique)],
    );
  }
  return rows.length;
}

/** Marks items gone. Returns how many were live until now. */
export async function markRemoved(db: Db, ids: number[]): Promise<number> {
  if (ids.length === 0) return 0;
  const rows = await db.query<{ id: number }>(
    `update mirror.monday_items
        set removed_at = now(), state = case when state = 'active' then 'deleted' else state end
      where id in (select (jsonb_array_elements_text($1::jsonb))::bigint) and removed_at is null
      returning id`,
    [json([...new Set(ids)])],
  );
  return rows.length;
}

export async function upsertUsers(
  db: Db,
  rows: { id: number; name: string | null; email: string | null; enabled: boolean | null; is_guest: boolean | null }[],
): Promise<void> {
  if (rows.length === 0) return;
  await db.query(
    `insert into mirror.monday_users as u (id, name, email, enabled, is_guest)
     select x.id, x.name, x.email, x.enabled, x.is_guest
     from jsonb_to_recordset($1::jsonb) as x(id bigint, name text, email text, enabled boolean, is_guest boolean)
     on conflict (id) do update set
       name = excluded.name, email = excluded.email, enabled = excluded.enabled, is_guest = excluded.is_guest, synced_at = now()`,
    [json(dedupe(rows))],
  );
}

/** Live items on a board: id to Monday's updated_at in milliseconds. */
export async function itemStamps(db: Db, boardId: number): Promise<Map<number, number>> {
  const rows = await db.query<{ id: number; updated: Date }>(
    "select id, monday_updated_at as updated from mirror.monday_items where board_id = $1 and removed_at is null",
    [boardId],
  );
  return new Map(rows.map((r) => [r.id, new Date(r.updated).getTime()]));
}

/** Boards being mirrored, parents before their subitems boards. With a key, that board and its subitems board. */
export async function syncedBoards(db: Db, boardKey?: string): Promise<SyncedBoard[]> {
  return db.query<SyncedBoard>(
    `select b.id, b.name, b.board_key, b.purpose, b.parent_board_id
     from mirror.monday_boards b
     left join mirror.monday_boards p on p.id = b.parent_board_id
     where b.sync_enabled
       and ($1::text is null or b.board_key = $1 or p.board_key = $1)
     order by b.parent_board_id nulls first, b.id`,
    [boardKey ?? null],
  );
}
```

- [ ] **Step 5: Write discovery**

Create `src/server/mirror/monday/discover.ts`:

```ts
import type { Db } from "../../db/types";
import type { MondayClient } from "./client";
import { toId } from "./normalise";
import { Q } from "./queries";
import { replaceColumns, replaceGroups, upsertBoards, upsertUsers, upsertWorkspaces } from "./store";

interface RawBoard {
  id: string;
  name: string;
  type?: string | null;
  state?: string | null;
  updated_at?: string | null;
  workspace?: { id: string | null } | null;
  columns?: { id: string; title: string; type: string }[] | null;
  groups?: { id: string; title: string; color?: string | null; position?: string | null; archived?: boolean | null; deleted?: boolean | null }[] | null;
}

async function saveBoards(db: Db, boards: RawBoard[]): Promise<number[]> {
  const rows = boards.flatMap((b) => {
    const id = toId(b.id);
    return id === null
      ? []
      : [{ id, workspace_id: toId(b.workspace?.id), name: b.name, type: b.type ?? "board", state: b.state ?? "active", monday_updated_at: b.updated_at ?? null }];
  });
  await upsertBoards(db, rows);
  for (const b of boards) {
    const id = toId(b.id);
    if (id === null) continue;
    await replaceColumns(db, id, (b.columns ?? []).map((c, position) => ({ id: c.id, title: c.title, type: c.type, position })));
    await replaceGroups(
      db,
      id,
      (b.groups ?? []).map((g) => ({
        id: g.id, title: g.title, color: g.color ?? null, position: g.position ?? null,
        archived: g.archived ?? false, deleted: g.deleted ?? false,
      })),
    );
  }
  return rows.map((r) => r.id);
}

/** Every workspace the token can see. One call. */
export async function discoverWorkspaces(db: Db, monday: MondayClient): Promise<number> {
  const data = await monday.query<{ workspaces: { id: string; name: string; kind?: string | null }[] }>(Q.workspaces);
  const rows = data.workspaces.flatMap((w) => {
    const id = toId(w.id);
    return id === null ? [] : [{ id, name: w.name, kind: w.kind ?? null }];
  });
  await upsertWorkspaces(db, rows);
  return rows.length;
}

/** Every board in these workspaces, with columns and groups. One call per 100 boards. */
export async function discoverBoards(db: Db, monday: MondayClient, workspaceIds: number[]): Promise<number> {
  let total = 0;
  for (let page = 1; page <= 50; page++) {
    const data = await monday.query<{ boards: RawBoard[] }>(Q.boardsInWorkspaces, { ws: workspaceIds.map(String), page });
    total += (await saveBoards(db, data.boards)).length;
    if (data.boards.length < 100) break;
  }
  return total;
}

/** These boards by id (subitems boards, or boards outside the workspace). Returns the ids Monday returned. */
export async function discoverBoardsById(db: Db, monday: MondayClient, ids: number[]): Promise<number[]> {
  if (ids.length === 0) return [];
  const found: number[] = [];
  for (let i = 0; i < ids.length; i += 100) {
    const data = await monday.query<{ boards: RawBoard[] }>(Q.boardsById, { ids: ids.slice(i, i + 100).map(String) });
    found.push(...(await saveBoards(db, data.boards)));
  }
  return found;
}

export async function discoverUsers(db: Db, monday: MondayClient): Promise<number> {
  let total = 0;
  for (let page = 1; page <= 20; page++) {
    const data = await monday.query<{ users: { id: string; name?: string | null; email?: string | null; enabled?: boolean | null; is_guest?: boolean | null }[] }>(
      Q.users,
      { page },
    );
    const rows = data.users.flatMap((u) => {
      const id = toId(u.id);
      return id === null ? [] : [{ id, name: u.name ?? null, email: u.email ?? null, enabled: u.enabled ?? null, is_guest: u.is_guest ?? null }];
    });
    await upsertUsers(db, rows);
    total += rows.length;
    if (data.users.length < 200) break;
  }
  return total;
}
```

- [ ] **Step 6: Write setup**

Create `src/server/mirror/monday/setup.ts`:

```ts
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Db } from "../../db/types";
import type { MondayClient } from "./client";
import { discoverBoards, discoverBoardsById, discoverUsers, discoverWorkspaces } from "./discover";

/**
 * Turns the mirror on for Locale's boards. Board ids and column ids come from
 * Jerry's config/environments/monday.json, read from the folder next to this
 * repo on Kane's machine, and land in the database: they are never copied
 * into git. Exclusive Land isn't in Jerry's column map, so its columns are
 * matched by title and Kane confirms the result.
 */
export const DEFAULT_JERRY_CONFIG = join(process.cwd(), "..", "Locale_Launchpad-main", "config", "environments", "monday.json");

type Purpose = "sales" | "construction" | "handed_over" | "exclusive_land" | "models" | "other";

export interface BoardPlan {
  boardKey: string;
  parentId: number;
  subitemsId: number | null;
  purpose: Purpose;
  division: "homes" | "wealth" | null;
  region: string | null;
}

export interface FieldPlan {
  boardId: number;
  fieldKey: string;
  columnId: string;
}

interface JerryProduction {
  boards: Record<string, unknown>;
  parentColumns: Record<string, unknown>;
  subitemColumns: Record<string, unknown>;
}

export function purposeOf(key: string): Purpose {
  if (key.includes("exclusive_land")) return "exclusive_land";
  if (key === "models") return "models";
  if (key.includes("handed_over")) return "handed_over";
  if (key.includes("construction")) return "construction";
  if (key.includes("sales")) return "sales";
  return "other";
}

export const divisionOf = (key: string): "homes" | "wealth" | null =>
  key.startsWith("homes_") ? "homes" : key.startsWith("wealth_") ? "wealth" : null;

export const regionOf = (key: string): string | null => /_(wa|vic|qld|nsw|sa)$/.exec(key)?.[1].toUpperCase() ?? null;

const entries = (o: unknown): [string, unknown][] =>
  o && typeof o === "object" ? Object.entries(o as Record<string, unknown>).filter(([k]) => !k.startsWith("_")) : [];

const columnsOf = (o: unknown): [string, string][] =>
  entries(o).filter((e): e is [string, string] => typeof e[1] === "string");

export function planFromJerryConfig(
  config: JerryProduction,
  vocabulary: Set<string>,
): { boards: BoardPlan[]; fields: FieldPlan[]; unknownFields: string[] } {
  const boards: BoardPlan[] = [];
  for (const [key, value] of entries(config.boards)) {
    const b = value as { parent?: unknown; subitems?: unknown };
    if (typeof b?.parent !== "number") continue;
    boards.push({
      boardKey: key,
      parentId: b.parent,
      subitemsId: typeof b.subitems === "number" ? b.subitems : null,
      purpose: purposeOf(key),
      division: divisionOf(key),
      region: regionOf(key),
    });
  }
  const byKey = new Map(boards.map((b) => [b.boardKey, b]));
  const fields = new Map<string, FieldPlan>();
  const unknown = new Set<string>();
  const add = (boardId: number, fieldKey: string, columnId: string) => {
    if (!vocabulary.has(fieldKey)) {
      unknown.add(fieldKey);
      return;
    }
    fields.set(`${boardId}:${fieldKey}`, { boardId, fieldKey, columnId });
  };

  for (const [groupKey, group] of entries(config.parentColumns)) {
    if (groupKey === "per_board") continue;
    const appliesTo = (group as { _applies_to?: unknown })._applies_to;
    if (!Array.isArray(appliesTo)) continue;
    for (const boardKey of appliesTo) {
      const board = byKey.get(String(boardKey));
      if (board) for (const [field, column] of columnsOf(group)) add(board.parentId, field, column);
    }
  }
  for (const [boardKey, cols] of entries((config.parentColumns as Record<string, unknown>).per_board)) {
    const board = byKey.get(boardKey);
    if (board) for (const [field, column] of columnsOf(cols)) add(board.parentId, field, column);
  }

  const shared = columnsOf((config.subitemColumns as Record<string, unknown>).all_boards);
  const overrides = (config.subitemColumns as Record<string, unknown>).per_board as Record<string, Record<string, unknown>> | undefined;
  for (const board of boards) {
    if (board.subitemsId === null) continue;
    const merged = new Map<string, string | null>(shared);
    for (const [field, column] of entries(overrides?.[board.boardKey])) {
      merged.set(field, typeof column === "string" ? column : null);
    }
    for (const [field, column] of merged) if (column) add(board.subitemsId, field, column);
  }

  return { boards, fields: [...fields.values()], unknownFields: [...unknown] };
}

/** Lower-case, straight apostrophes, no punctuation but apostrophes, ampersands and hyphens, single spaces. */
export function normaliseName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[’`]/g, "'")
    .replace(/[^a-z0-9'& -]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const LOT_TITLES: Record<string, string[]> = {
  lot_status: ["status", "lot status", "availability"],
  lot_address: ["address", "street", "street address", "lot address"],
  lot_suburb: ["suburb"],
  lot_state: ["state"],
  lot_estate: ["estate", "estate name", "development"],
  lot_developer: ["developer", "land developer"],
  lot_builder: ["builder", "package builder"],
  lot_land_price: ["land price", "lot price"],
  lot_package_price: ["package price", "house and land price", "h&l price"],
  lot_design: ["design", "house design", "home design"],
  lot_area: ["lot size", "land size", "area", "size", "sqm"],
  lot_frontage: ["frontage"],
  lot_zoning: ["zoning", "r code", "r-code", "rcode"],
  lot_title: ["title", "titled", "title status"],
  lot_title_eta: ["title eta", "title date", "titles expected", "expected titles", "title due"],
  lot_rebate: ["rebate", "rebates", "incentive"],
  lot_files: ["files", "plans", "plans and files", "plans & files", "documents"],
};

/** Exclusive Land's columns by title. Each column is used once; what doesn't match is listed for Kane. */
export function matchLotColumns(columns: { id: string; title: string; type: string }[]): {
  fields: { fieldKey: string; columnId: string }[];
  unmatched: string[];
} {
  const used = new Set<string>();
  const fields: { fieldKey: string; columnId: string }[] = [];
  for (const [fieldKey, titles] of Object.entries(LOT_TITLES)) {
    const column = columns.find((c) => !used.has(c.id) && titles.includes(normaliseName(c.title)));
    if (column) {
      used.add(column.id);
      fields.push({ fieldKey, columnId: column.id });
    }
  }
  const unmatched = columns.filter((c) => !used.has(c.id) && c.type !== "name").map((c) => c.title);
  return { fields, unmatched };
}

/**
 * Monday's free-text rep names to staff: full name, go-by name plus surname, or first plus
 * last name, compared loosely (normaliseName). Each match keeps Monday's own text: the
 * loaders look an alias up by `lower(btrim(sales_rep))`, so matchReps stores that key.
 */
export function matchRepAliases(
  names: string[],
  staff: { id: string; name: string | null; preferred_name: string | null }[],
): { matched: { rep: string; staffId: string }[]; unmatched: string[] } {
  const index = new Map<string, string>();
  for (const s of staff) {
    if (!s.name) continue;
    const parts = normaliseName(s.name).split(" ");
    const last = parts[parts.length - 1];
    index.set(normaliseName(s.name), s.id);
    if (parts.length > 2) index.set(`${parts[0]} ${last}`, s.id);
    if (s.preferred_name) index.set(`${normaliseName(s.preferred_name)} ${last}`, s.id);
  }
  const matched = new Map<string, string>();
  const unmatched = new Set<string>();
  for (const raw of names) {
    const key = normaliseName(raw);
    if (!key) continue;
    const id = index.get(key);
    if (id) matched.set(raw, id);
    else unmatched.add(raw.trim());
  }
  return { matched: [...matched].map(([rep, staffId]) => ({ rep, staffId })), unmatched: [...unmatched] };
}

export interface SetupReport {
  boardsEnabled: string[];
  notVisible: string[];
  fieldsMapped: number;
  unknownFields: string[];
  lotFields: { fieldKey: string; columnId: string }[];
  lotUnmatched: string[];
}

export async function runSetup(
  db: Db,
  monday: MondayClient,
  opts: { jerryConfigPath: string | null; log: (line: string) => void },
): Promise<SetupReport> {
  const path = opts.jerryConfigPath ?? DEFAULT_JERRY_CONFIG;
  if (!existsSync(path)) throw new Error(`Jerry's Monday config isn't at ${path}. Pass --jerry-config <path>.`);
  const config = JSON.parse(readFileSync(path, "utf8")) as { workspaces?: { production?: { id?: number; name?: string } }; production?: JerryProduction };
  // A wrong file stops here, before anything is read from Monday or written.
  const production = config.production;
  if (!production?.boards || Object.keys(production.boards).length === 0) {
    throw new Error(`No boards in ${path}. Is it Jerry's monday.json, with production.boards in it?`);
  }

  const vocabulary = new Set((await db.query<{ key: string }>("select key from mirror.monday_fields")).map((r) => r.key));
  const plan = planFromJerryConfig(production, vocabulary);

  opts.log("discovering workspaces and users");
  await discoverWorkspaces(db, monday);
  await discoverUsers(db, monday);
  const workspaceId = config.workspaces?.production?.id;
  if (typeof workspaceId === "number") {
    await db.query("update mirror.monday_workspaces set sync_enabled = true where id = $1", [workspaceId]);
    opts.log(`discovering boards in workspace ${workspaceId}`);
    await discoverBoards(db, monday, [workspaceId]);
  }
  const wanted = plan.boards.flatMap((b) => (b.subitemsId === null ? [b.parentId] : [b.parentId, b.subitemsId]));
  const known = new Set((await db.query<{ id: number }>("select id from mirror.monday_boards")).map((r) => r.id));
  const missing = wanted.filter((id) => !known.has(id));
  const found = new Set([...known, ...(await discoverBoardsById(db, monday, missing))]);

  const report: SetupReport = { boardsEnabled: [], notVisible: [], fieldsMapped: 0, unknownFields: plan.unknownFields, lotFields: [], lotUnmatched: [] };
  for (const b of plan.boards) {
    if (!found.has(b.parentId)) {
      report.notVisible.push(b.boardKey);
      continue;
    }
    await db.query(
      `update mirror.monday_boards set board_key = $2, purpose = $3, division = $4, region = $5, sync_enabled = true
       where id = $1`,
      [b.parentId, b.boardKey, b.purpose, b.division, b.region],
    );
    if (b.subitemsId !== null && found.has(b.subitemsId)) {
      await db.query(
        `update mirror.monday_boards set board_key = $2, parent_board_id = $3, type = 'sub_items_board', sync_enabled = true
         where id = $1`,
        [b.subitemsId, `${b.boardKey}:subitems`, b.parentId],
      );
    }
    report.boardsEnabled.push(b.boardKey);
  }

  for (const f of plan.fields) {
    if (!found.has(f.boardId)) continue;
    await db.query(
      `insert into mirror.monday_field_map (board_id, field_key, column_id, source) values ($1, $2, $3, 'jerry_config')
       on conflict (board_id, field_key) do update set column_id = excluded.column_id, source = 'jerry_config'
       where mirror.monday_field_map.source <> 'manual'`,
      [f.boardId, f.fieldKey, f.columnId],
    );
    report.fieldsMapped += 1;
  }

  const land = plan.boards.find((b) => b.purpose === "exclusive_land");
  if (land && found.has(land.parentId)) {
    const columns = await db.query<{ id: string; title: string; type: string }>(
      "select id, title, type from mirror.monday_columns where board_id = $1 order by position",
      [land.parentId],
    );
    const lots = matchLotColumns(columns);
    for (const f of lots.fields) {
      await db.query(
        `insert into mirror.monday_field_map (board_id, field_key, column_id, source) values ($1, $2, $3, 'title_match')
         on conflict (board_id, field_key) do nothing`,
        [land.parentId, f.fieldKey, f.columnId],
      );
    }
    report.lotFields = lots.fields;
    report.lotUnmatched = lots.unmatched;
  }
  return report;
}

/** Matches Monday's rep names to staff and stores the aliases it finds. Run after a backfill. */
export async function matchReps(db: Db): Promise<{ matched: number; unmatched: string[] }> {
  const names = (await db.query<{ rep: string }>(
    "select distinct btrim(sales_rep) as rep from launchpad.monday_jobs where sales_rep is not null",
  )).map((r) => r.rep);
  const staff = await db.query<{ id: string; name: string | null; preferred_name: string | null }>(
    "select id, name, preferred_name from launchpad.staff where not vacant",
  );
  const result = matchRepAliases(names, staff);
  for (const m of result.matched) {
    // The key the loaders join on, lower(btrim(sales_rep)), made by the same SQL here.
    await db.query(
      "insert into launchpad.staff_aliases (alias, staff_id, source) values (lower(btrim($1::text)), $2, 'setup') on conflict (alias) do nothing",
      [m.rep, m.staffId],
    );
  }
  return { matched: result.matched.length, unmatched: result.unmatched };
}
```

- [ ] **Step 7: Run the tests to verify they pass**

Run: `node --import tsx --test src/server/mirror/monday/store.test.ts src/server/mirror/monday/setup.test.ts`
Expected: PASS, 12 tests. If `matchLotColumns` puts "Price" on `lot_land_price`, check that `LOT_TITLES.lot_land_price` doesn't list plain "price": a bare "Price" is ambiguous and must stay unmatched for Kane to place.

- [ ] **Step 8: Checkpoint**

Run: `npm test`, `npx tsc --noEmit` and `git status --short`. Expected new files: `src/server/mirror/runs.ts`, and `store.ts`, `store.test.ts`, `discover.ts`, `setup.ts`, `setup.test.ts` under `src/server/mirror/monday/`. Don't commit.

---

### Task 12: The passes: backfill, changes, safety, sweep

**Files:**
- Create: `src/server/mirror/monday/passes.ts`
- Test: `src/server/mirror/monday/passes.test.ts`

**Interfaces:**
- Consumes: `MondayClient`, `Q`, `normaliseItem`, `normaliseUpdate`, `parseActivityLogs`, everything in `store.ts`, `discoverBoardsById`, and `runs.ts`.
- Produces:
  - `type MondayMode = "backfill" | "changes" | "safety" | "sweep"`.
  - `interface PassLimits { activityLimit: number; activityMaxPages: number; idsPerCall: number; updatePages: number }`.
  - `interface PassOptions { trigger: Trigger; boardKey?: string; now?: () => Date; log?: (line: string) => void; limits?: Partial<PassLimits>; deadline?: Date }`. With a `deadline`, the pass sends no Monday call after it and ends `partial` (the cron routes set one; the CLI doesn't).
  - `interface PassResult { status: "ok" | "partial" | "failed" | "skipped"; calls: number; seen: number; changed: number; note: string | null; error: string | null }`.
  - `runMondayPass(db: Db, monday: MondayClient, mode: MondayMode, opts: PassOptions): Promise<PassResult>`.
  - `nextPageSize(queryCost: number | null, limit: number): number`.

- [ ] **Step 1: Write the failing test**

Create `src/server/mirror/monday/passes.test.ts`. The world is invented: two boards, a few items, and an activity log the test controls.

```ts
import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { migratedTestDb } from "../../db/pglite";
import type { Db } from "../../db/types";
import type { RawActivityLog } from "./activity";
import type { RawItem } from "./normalise";
import { nextPageSize, runMondayPass } from "./passes";
import { fakeMonday } from "./test-fakes";

let db: Db;
let close: () => Promise<void>;

const raw = (id: number, board: number, updated: string, parent: number | null = null): RawItem => ({
  id: String(id),
  name: `Test item ${id}`,
  state: "active",
  updated_at: updated,
  board: { id: String(board), name: `Board ${board}` },
  parent_item: parent ? { id: String(parent) } : null,
  column_values: [],
});

// What "Monday" holds. Tests change it between passes.
const world = {
  items: new Map<number, RawItem>(),
  logs: new Map<string, RawActivityLog[][]>(), // board id -> pages of entries
  recent: [] as { id: string; updated_at: string }[],
  asked: [] as string[], // boards asked for a first items page, in order
};
const onBoard = (board: number) => [...world.items.values()].filter((i) => i.board?.id === String(board));

const monday = fakeMonday((doc, vars) => {
  if (doc.includes("activity_logs")) {
    const page = Number(vars.page ?? 1);
    return {
      boards: (vars.boards as string[]).map((id) => ({ id, activity_logs: world.logs.get(id)?.[page - 1] ?? [], updates: [] })),
    };
  }
  if (doc.includes("__last_updated__")) return { boards: [{ items_page: { cursor: null, items: world.recent } }] };
  if (doc.includes("updates(limit")) return { boards: [{ updates: [] }] };
  if (doc.includes("items(ids")) {
    return { items: (vars.ids as string[]).map((id) => world.items.get(Number(id))).filter(Boolean) };
  }
  const full = doc.includes("id name state");
  if (doc.includes("next_items_page")) {
    // Only board 10 pages: its second page is everything after the first item.
    const rest = onBoard(10).slice(1);
    return { next_items_page: { cursor: null, items: full ? rest : rest.map((i) => ({ id: i.id, updated_at: i.updated_at })) } };
  }
  if (doc.includes("items_page")) {
    const board = Number((vars.board as string[])[0]);
    world.asked.push(String(board));
    const items = onBoard(board);
    const firstPage = board === 10 ? items.slice(0, 1) : items;
    return {
      boards: [{
        items_page: {
          cursor: board === 10 && items.length > 1 ? "cursor-1" : null,
          items: full ? firstPage : firstPage.map((i) => ({ id: i.id, updated_at: i.updated_at })),
        },
      }],
    };
  }
  throw new Error(`unexpected document: ${doc.slice(0, 80)}`);
});

const NOW = new Date("2026-10-08T06:00:00Z");
const opts = { trigger: "cli" as const, now: () => NOW };

before(async () => {
  ({ db, close } = await migratedTestDb());
  await db.query("insert into mirror.monday_workspaces (id, name) values (1, 'Test workspace')");
  await db.query(`insert into mirror.monday_boards (id, workspace_id, name, board_key, purpose, sync_enabled)
                  values (10, 1, 'Test sales', 'test_sales', 'sales', true)`);
  await db.query(`insert into mirror.monday_boards (id, workspace_id, name, type, board_key, parent_board_id, sync_enabled)
                  values (11, 1, 'Subitems of Test sales', 'sub_items_board', 'test_sales:subitems', 10, true)`);
  world.items.set(1001, raw(1001, 10, "2026-10-07T00:00:00Z"));
  world.items.set(1002, raw(1002, 10, "2026-10-07T00:00:00Z"));
  world.items.set(2001, raw(2001, 11, "2026-10-07T00:00:00Z", 1001));
});
after(async () => close());

const lastRun = async () =>
  (await db.query<{ status: string; api_calls: number; note: string | null }>(
    "select status, api_calls, note from mirror.sync_runs order by id desc limit 1",
  ))[0];

test("passes: page size follows the measured complexity", () => {
  assert.equal(nextPageSize(null, 100), 100);
  assert.equal(nextPageSize(400_000, 100), 500, "cheap pages grow to the 500 maximum");
  assert.equal(nextPageSize(4_000_000, 100), 50);
  assert.equal(nextPageSize(100_000_000, 100), 25, "never below 25");
});

test("passes: changes before any backfill is skipped, with the reason", async () => {
  const r = await runMondayPass(db, monday, "changes", opts);
  assert.equal(r.status, "skipped");
  assert.match(r.note ?? "", /backfill/);
});

test("passes: backfill pages through every board and sets the watermark", async () => {
  const before = monday.stats.calls;
  const r = await runMondayPass(db, monday, "backfill", opts);
  assert.equal(r.status, "ok");
  const [{ n }] = await db.query<{ n: number }>("select count(*)::int as n from mirror.monday_items");
  assert.equal(n, 3);
  // Board 10: two item pages and one updates page. Board 11: one of each.
  assert.equal(monday.stats.calls - before, 5);
  assert.equal((await lastRun()).api_calls, 5);
  const [{ w }] = await db.query<{ w: Date }>("select watermark as w from mirror.sync_state where scope = 'account'");
  assert.equal(new Date(w).toISOString(), NOW.toISOString());
});

test("passes: changes refetch what the log names; what Monday no longer returns is removed", async () => {
  world.items.set(1001, raw(1001, 10, "2026-10-08T05:00:00Z"));
  world.items.delete(1002);
  world.logs.set("10", [[
    { event: "update_column_value", data: JSON.stringify({ pulse_id: 1001 }), created_at: "17599032000000000" },
    { event: "delete_pulse", data: JSON.stringify({ pulse_id: 1002 }), created_at: "17599032000000000" },
  ]]);
  const r = await runMondayPass(db, monday, "changes", opts);
  assert.equal(r.status, "ok");
  const rows = await db.query<{ id: number; updated: Date; removed: boolean }>(
    "select id, monday_updated_at as updated, removed_at is not null as removed from mirror.monday_items where id in (1001, 1002) order by id",
  );
  assert.equal(new Date(rows[0].updated).toISOString(), "2026-10-08T05:00:00.000Z");
  assert.equal(rows[1].removed, true);
});

test("passes: an item Monday returns but we can't place stays live, never marked removed", async () => {
  // A copy with no board can't be stored, but Monday did return it: only absence means removed.
  const live = world.items.get(1001)!;
  world.items.set(1001, { ...live, board: null });
  world.logs.set("10", [[{ event: "update_column_value", data: JSON.stringify({ pulse_id: 1001 }), created_at: "17599032000000000" }]]);
  await runMondayPass(db, monday, "changes", opts);
  const [row] = await db.query<{ removed: boolean }>("select removed_at is not null as removed from mirror.monday_items where id = 1001");
  assert.equal(row.removed, false);
  world.items.set(1001, live);
  world.logs.clear();
});

test("passes: a log still full after the page cap runs the safety check, ends partial and says so (Review Focus 2)", async () => {
  const entry = (id: number) => ({ event: "update_column_value", data: JSON.stringify({ pulse_id: id }), created_at: "17599032000000000" });
  world.logs.set("10", [[entry(1001), entry(1001)], [entry(1001), entry(1001)], [entry(1001), entry(1001)]]);
  const sent = monday.documents.length;
  const r = await runMondayPass(db, monday, "changes", { ...opts, limits: { activityLimit: 2, activityMaxPages: 2 } });
  assert.equal(r.status, "partial");
  assert.match(r.note ?? "", /safety/);
  assert.ok(monday.documents.slice(sent).some((d) => d.includes("__last_updated__")), "the safety check ran on the full board");
  world.logs.clear();
});

test("passes: safety refetches anything updated today or yesterday that we hold an older copy of", async () => {
  world.items.set(1001, raw(1001, 10, "2026-10-08T05:30:00Z"));
  world.recent = [{ id: "1001", updated_at: "2026-10-08T05:30:00Z" }];
  const r = await runMondayPass(db, monday, "safety", opts);
  assert.equal(r.status, "ok");
  const [row] = await db.query<{ updated: Date }>("select monday_updated_at as updated from mirror.monday_items where id = 1001");
  assert.equal(new Date(row.updated).toISOString(), "2026-10-08T05:30:00.000Z");
});

test("passes: the sweep removes items Monday no longer has", async () => {
  await db.query(`insert into mirror.monday_items (id, board_id, name, monday_updated_at)
                  values (1003, 10, 'Test item 1003', '2026-10-01T00:00:00Z')`);
  const r = await runMondayPass(db, monday, "sweep", opts);
  assert.equal(r.status, "ok");
  const [row] = await db.query<{ removed: boolean }>("select removed_at is not null as removed from mirror.monday_items where id = 1003");
  assert.equal(row.removed, true);
});

test("passes: a second pass while one holds the lease is skipped", async () => {
  await db.query("select mirror.try_lock('monday', 'another-pass', 600)");
  const r = await runMondayPass(db, monday, "changes", opts);
  assert.equal(r.status, "skipped");
  assert.equal((await lastRun()).status, "skipped");
  await db.query("select mirror.unlock('monday', 'another-pass')");
});

test("passes: past its time limit a pass sends no Monday call, ends partial, and leaves the watermark", async () => {
  const watermark = async () =>
    (await db.query<{ w: string | null }>("select watermark::text as w from mirror.sync_state where source = 'monday' and scope = 'account'"))[0]?.w;
  const before = await watermark();
  const sent = monday.documents.length;
  const r = await runMondayPass(db, monday, "changes", { ...opts, deadline: new Date(NOW.getTime() - 1000) });
  assert.equal(r.status, "partial");
  assert.match(r.note ?? "", /time limit/);
  assert.equal(monday.documents.length, sent, "nothing is sent once the time limit has passed");
  assert.equal(await watermark(), before, "the next run re-reads the same changes");
});

test("passes: the sweep starts with the board swept longest ago, so a sweep cut short resumes there", async () => {
  await db.query("update mirror.sync_state set swept_at = '2000-01-01' where source = 'monday' and scope = 'board:11'");
  await db.query("update mirror.sync_state set swept_at = now() where source = 'monday' and scope = 'board:10'");
  world.asked.length = 0;
  const r = await runMondayPass(db, monday, "sweep", opts);
  assert.equal(r.status, "ok");
  assert.equal(world.asked[0], "11");
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node --import tsx --test src/server/mirror/monday/passes.test.ts`
Expected: FAIL, `Cannot find module './passes'`.

- [ ] **Step 3: Write the passes**

Create `src/server/mirror/monday/passes.ts`:

```ts
import type { Db } from "../../db/types";
import { beginRun, endRun, getWatermark, markState, setWatermark, type Trigger } from "../runs";
import { parseActivityLogs, type BoardActivity } from "./activity";
import { MondayCapReachedError, MondayDailyLimitError, MondayDeadlineError, type MondayClient } from "./client";
import { discoverBoardsById } from "./discover";
import {
  normaliseItem,
  normaliseUpdate,
  toId,
  type AssetRef,
  type ItemRow,
  type RawItem,
  type RawUpdate,
  type UpdateRow,
} from "./normalise";
import { Q } from "./queries";
import * as store from "./store";

/**
 * The Monday passes (spec section 4.3):
 *   backfill  every item on every synced board, once
 *   changes   one activity-log request across all boards, then only the items it names
 *   safety    items updated today or yesterday, compared by updated_at
 *   sweep     every board's ids, to catch deletes the log missed
 * Each runs under the 'monday' lease and writes one mirror.sync_runs row.
 */
export type MondayMode = "backfill" | "changes" | "safety" | "sweep";

export interface PassLimits {
  activityLimit: number;
  activityMaxPages: number;
  idsPerCall: number;
  updatePages: number;
}

const DEFAULT_LIMITS: PassLimits = { activityLimit: 1000, activityMaxPages: 10, idsPerCall: 100, updatePages: 200 };

export interface PassOptions {
  trigger: Trigger;
  boardKey?: string;
  now?: () => Date;
  log?: (line: string) => void;
  limits?: Partial<PassLimits>;
  /** No Monday call starts after this; the pass ends partial and the next run picks up. Cron routes set it, the CLI doesn't. */
  deadline?: Date;
}

export interface PassResult {
  status: "ok" | "partial" | "failed" | "skipped";
  calls: number;
  seen: number;
  changed: number;
  note: string | null;
  error: string | null;
}

const LOCK_SECONDS: Record<MondayMode, number> = { backfill: 3300, changes: 600, safety: 1500, sweep: 3300 };

interface ItemsPage {
  cursor: string | null;
  items: RawItem[];
}

interface StampsPage {
  cursor: string | null;
  items: { id: string; updated_at: string }[];
}

interface Ctx {
  db: Db;
  monday: MondayClient;
  limits: PassLimits;
  log: (line: string) => void;
  tally: { seen: number; changed: number };
}

/** After the first page, size pages to about 2M complexity points: Monday allows 5M a query and 10M a minute. */
export function nextPageSize(queryCost: number | null, limit: number): number {
  if (!queryCost || queryCost <= 0) return limit;
  const perItem = queryCost / limit;
  return Math.max(25, Math.min(500, Math.floor(2_000_000 / Math.max(perItem, 1))));
}

async function storeItems(ctx: Ctx, raws: RawItem[], boardFallback?: number): Promise<number[]> {
  const items: ItemRow[] = [];
  const assets: AssetRef[] = [];
  for (const raw of raws) {
    const n = normaliseItem(raw, boardFallback);
    if (n) {
      items.push(n.item);
      assets.push(...n.assets);
    }
  }
  ctx.tally.seen += items.length;
  ctx.tally.changed += await store.upsertItems(ctx.db, items);
  await store.syncFileAssets(ctx.db, items.map((i) => i.id), assets);
  return items.map((i) => i.id);
}

async function storeUpdates(ctx: Ctx, raws: RawUpdate[]): Promise<void> {
  const updates: UpdateRow[] = [];
  const assets: AssetRef[] = [];
  for (const raw of raws) {
    const n = normaliseUpdate(raw);
    if (n) {
      updates.push(n.update);
      assets.push(...n.assets);
    }
  }
  ctx.tally.changed += await store.upsertUpdates(ctx.db, updates, assets);
}

/** Fetches items by id, archived and deleted ones included. Ids Monday doesn't return are gone. */
async function refetch(ctx: Ctx, ids: number[]): Promise<void> {
  const unique = [...new Set(ids)];
  for (let i = 0; i < unique.length; i += ctx.limits.idsPerCall) {
    const chunk = unique.slice(i, i + ctx.limits.idsPerCall);
    const data = await ctx.monday.query<{ items: RawItem[] | null }>(Q.itemsByIds, { ids: chunk.map(String), limit: chunk.length });
    await storeItems(ctx, data.items ?? []);
    // Gone means Monday didn't return the id. An item it did return but we couldn't place (a null board, say)
    // stays as it was, never marked removed.
    const returned = new Set((data.items ?? []).map((r) => toId(r?.id)).filter((id): id is number => id !== null));
    ctx.tally.changed += await store.markRemoved(ctx.db, chunk.filter((id) => !returned.has(id)));
  }
}

async function backfill(ctx: Ctx, boards: store.SyncedBoard[]): Promise<void> {
  for (const board of boards) {
    ctx.log(`backfill ${board.board_key ?? board.id}`);
    let limit = 100;
    let cursor: string | null = null;
    let first = true;
    while (first || cursor) {
      let page: ItemsPage | undefined;
      if (first) {
        const data = await ctx.monday.query<{ boards: { items_page: ItemsPage }[] }>(Q.firstItemsPage, {
          board: [String(board.id)],
          limit,
        });
        page = data.boards?.[0]?.items_page;
        limit = nextPageSize(ctx.monday.stats.lastComplexity?.query ?? null, limit);
        first = false;
      } else {
        const data: { next_items_page: ItemsPage } = await ctx.monday.query(Q.nextItemsPage, { cursor, limit });
        page = data.next_items_page;
      }
      if (!page) break;
      await storeItems(ctx, page.items ?? [], board.id);
      cursor = page.cursor;
    }
    for (let p = 1; p <= ctx.limits.updatePages; p++) {
      const data = await ctx.monday.query<{ boards: { updates: RawUpdate[] | null }[] }>(Q.boardUpdatesPage, {
        board: [String(board.id)],
        limit: 100,
        page: p,
      });
      const updates = data.boards?.[0]?.updates ?? [];
      await storeUpdates(ctx, updates);
      if (updates.length < 100) break;
    }
    await markState(ctx.db, "monday", `board:${board.id}`, "backfilled_at");
  }
}

async function changes(
  ctx: Ctx,
  boards: store.SyncedBoard[],
  startedAt: Date,
): Promise<{ status: "ok" | "partial" | "skipped"; note: string | null; before: Date | null; after: Date | null }> {
  const before = await getWatermark(ctx.db, "monday", "account");
  if (!before) return { status: "skipped", note: "no watermark yet: run `npm run mirror -- backfill` first", before, after: null };

  const from = new Date(before.getTime() - 2 * 60_000).toISOString();
  const { activityLimit, activityMaxPages } = ctx.limits;
  const first = await ctx.monday.query<{ boards: BoardActivity[] | null }>(Q.activityWithUpdates, {
    boards: boards.map((b) => String(b.id)),
    from,
    limit: activityLimit,
  });
  const pages: BoardActivity[][] = [first.boards ?? []];
  await storeUpdates(ctx, (first.boards ?? []).flatMap((b) => b.updates ?? []));
  let full = parseActivityLogs(first.boards ?? [], activityLimit).fullBoards;
  for (let page = 2; full.length > 0 && page <= activityMaxPages; page++) {
    const more = await ctx.monday.query<{ boards: BoardActivity[] | null }>(Q.activityPage, {
      boards: full.map(String),
      from,
      limit: activityLimit,
      page,
    });
    pages.push(more.boards ?? []);
    full = parseActivityLogs(more.boards ?? [], activityLimit).fullBoards;
  }

  const scan = parseActivityLogs(pages.flat(), Number.POSITIVE_INFINITY);
  if (scan.columnsChangedBoards.length > 0) await discoverBoardsById(ctx.db, ctx.monday, scan.columnsChangedBoards);
  await refetch(ctx, scan.itemIds);
  await setWatermark(ctx.db, "monday", "account", startedAt);

  if (full.length > 0) {
    // This pass never reads the entries past the page cap. Rather than leave them to the
    // daily safety pass, check those boards' recent updates now: a few calls a board.
    await safety(ctx, boards.filter((b) => full.includes(b.id)));
    return {
      status: "partial",
      note: `the activity log was still full after ${activityMaxPages} pages on ${full.length} board(s), so the safety check ran on those boards too`,
      before,
      after: startedAt,
    };
  }
  return { status: "ok", note: scan.itemIds.length === 0 ? "nothing changed" : null, before, after: startedAt };
}

async function walkStamps(
  ctx: Ctx,
  boardId: number,
  firstDocument: string,
  visit: (id: number, updatedMs: number) => void,
): Promise<void> {
  let cursor: string | null = null;
  let first = true;
  while (first || cursor) {
    let page: StampsPage | undefined;
    if (first) {
      const data = await ctx.monday.query<{ boards: { items_page: StampsPage }[] }>(firstDocument, {
        board: [String(boardId)],
        limit: 500,
      });
      page = data.boards?.[0]?.items_page;
      first = false;
    } else {
      const data: { next_items_page: StampsPage } = await ctx.monday.query(Q.nextStampsPage, { cursor, limit: 500 });
      page = data.next_items_page;
    }
    if (!page) break;
    for (const item of page.items ?? []) {
      const id = Number(item.id);
      const t = Date.parse(item.updated_at);
      if (Number.isSafeInteger(id) && !Number.isNaN(t)) visit(id, t);
    }
    cursor = page.cursor;
  }
}

async function safety(ctx: Ctx, boards: store.SyncedBoard[]): Promise<void> {
  for (const board of boards) {
    const stamps = await store.itemStamps(ctx.db, board.id);
    const stale: number[] = [];
    await walkStamps(ctx, board.id, Q.recentStampsPage, (id, t) => {
      if (stamps.get(id) !== t) stale.push(id);
    });
    await refetch(ctx, stale);
  }
}

async function sweep(ctx: Ctx, boards: store.SyncedBoard[]): Promise<void> {
  // Boards swept longest ago (or never) first: a sweep cut short by its time limit resumes there next time.
  const sweptAt = new Map(
    (await ctx.db.query<{ scope: string; swept_at: Date | null }>(
      "select scope, swept_at from mirror.sync_state where source = 'monday' and scope like 'board:%'",
    )).map((r) => [r.scope, r.swept_at ? new Date(r.swept_at).getTime() : 0]),
  );
  const order = [...boards].sort((a, b) => (sweptAt.get(`board:${a.id}`) ?? 0) - (sweptAt.get(`board:${b.id}`) ?? 0) || a.id - b.id);
  for (const board of order) {
    const stamps = await store.itemStamps(ctx.db, board.id);
    const seen = new Set<number>();
    const stale: number[] = [];
    await walkStamps(ctx, board.id, Q.firstStampsPage, (id, t) => {
      seen.add(id);
      if (stamps.get(id) !== t) stale.push(id);
    });
    const missing = [...stamps.keys()].filter((id) => !seen.has(id));
    await refetch(ctx, [...stale, ...missing]);
    await markState(ctx.db, "monday", `board:${board.id}`, "swept_at");
  }
}

/**
 * The same client, refusing to start a call after `deadline`, so a cron route ends before the host stops it.
 * (The real client also honours the deadline inside a call, Task 14 passes it there; the test fake doesn't.)
 */
function withDeadline(monday: MondayClient, deadline: Date, now: () => Date): MondayClient {
  return {
    query: (document, variables) => {
      if (now().getTime() >= deadline.getTime()) return Promise.reject(new MondayDeadlineError("time limit reached", "DEADLINE"));
      return monday.query(document, variables);
    },
    get stats() {
      return monday.stats;
    },
  };
}

export async function runMondayPass(db: Db, monday: MondayClient, mode: MondayMode, opts: PassOptions): Promise<PassResult> {
  const now = opts.now ?? (() => new Date());
  const run = await beginRun(db, "monday", mode, opts.trigger, LOCK_SECONDS[mode]);
  if (!run) return { status: "skipped", calls: 0, seen: 0, changed: 0, note: "another Monday pass is running", error: null };

  const ctx: Ctx = {
    db,
    monday: opts.deadline ? withDeadline(monday, opts.deadline, now) : monday,
    limits: { ...DEFAULT_LIMITS, ...opts.limits },
    log: opts.log ?? (() => {}),
    tally: { seen: 0, changed: 0 },
  };
  const callsBefore = monday.stats.calls;
  const complexityBefore = monday.stats.complexity;
  const startedAt = now();
  let status: PassResult["status"] = "ok";
  let note: string | null = null;
  let error: string | null = null;
  let watermarkBefore: Date | null = null;
  let watermarkAfter: Date | null = null;

  try {
    const boards = await store.syncedBoards(db, opts.boardKey);
    if (boards.length === 0) {
      status = "skipped";
      note = "no boards are enabled: run `npm run mirror -- setup` first";
    } else if (mode === "backfill") {
      await backfill(ctx, boards);
      if (!(await getWatermark(db, "monday", "account"))) {
        await setWatermark(db, "monday", "account", startedAt);
        watermarkAfter = startedAt;
      }
    } else if (mode === "changes") {
      const r = await changes(ctx, boards, startedAt);
      ({ status, note } = r);
      watermarkBefore = r.before;
      watermarkAfter = r.after;
    } else if (mode === "safety") {
      await safety(ctx, boards);
    } else {
      await sweep(ctx, boards);
    }
    if (status !== "skipped") await db.query("select launchpad.sync_land_lots_from_monday()");
  } catch (e) {
    if (e instanceof MondayDeadlineError) {
      status = "partial";
      note = "stopped at the run's time limit; the next run picks up from here";
    } else {
      error = e instanceof Error ? e.message : String(e);
      status = e instanceof MondayCapReachedError || e instanceof MondayDailyLimitError ? "partial" : "failed";
    }
  } finally {
    await endRun(db, run, {
      status,
      calls: monday.stats.calls - callsBefore,
      complexity: monday.stats.complexity - complexityBefore,
      seen: ctx.tally.seen,
      changed: ctx.tally.changed,
      note,
      error,
      watermarkBefore,
      watermarkAfter,
    });
  }
  return { status, calls: monday.stats.calls - callsBefore, seen: ctx.tally.seen, changed: ctx.tally.changed, note, error };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --import tsx --test src/server/mirror/monday/passes.test.ts`
Expected: PASS, 11 tests.

- [ ] **Step 5: Checkpoint**

Run: `npm test`, `npx tsc --noEmit` and `git status --short`. Expected new files: `passes.ts` and `passes.test.ts`. Don't commit.

---

### Task 13: Files into Storage

**Files:**
- Create: `src/server/storage.ts`
- Create: `src/server/mirror/monday/files.ts`
- Test: `src/server/mirror/monday/files.test.ts`

**Interfaces:**
- Consumes: `Db`, `MondayClient`, `Q.assets`, `readServerEnv`.
- Produces:
  - `interface FileStore { ensureBucket(name, fileSizeLimit): Promise<void>; upload(bucket, path, body: Uint8Array, contentType): Promise<void>; signedUrl(bucket, path, seconds): Promise<string> }`.
  - `BUCKETS = { mondayFiles: "monday-files", launchpadFiles: "launchpad-files" }`.
  - `supabaseFileStore(env?): FileStore | null` and `memoryFileStore()` (tests).
  - `MAX_FILE_BYTES` (50 MiB) and `storagePath(boardId, itemId, assetId, name): string`.
  - `downloadPendingFiles(deps: { db; monday; store; fetch? }, opts: { max: number; deadline?: Date }): Promise<FilesResult>`, where `FilesResult = { downloaded: number; tooLarge: number; failed: number; pending: number }`. No Monday call or download starts after `deadline`; whatever is left stays pending for the next run. Each download times out after 60 s.

- [ ] **Step 1: Write the failing test**

Create `src/server/mirror/monday/files.test.ts`:

```ts
import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { migratedTestDb } from "../../db/pglite";
import type { Db } from "../../db/types";
import { memoryFileStore } from "../../storage";
import { MAX_FILE_BYTES, downloadPendingFiles, storagePath } from "./files";
import { fakeMonday } from "./test-fakes";

let db: Db;
let close: () => Promise<void>;
before(async () => {
  ({ db, close } = await migratedTestDb());
  await db.query("insert into mirror.monday_boards (id, name) values (10, 'Test board')");
  await db.query("insert into mirror.monday_items (id, board_id, name, monday_updated_at) values (1001, 10, 'Test item', now())");
  await db.query(`insert into mirror.monday_assets (id, item_id, column_id, name) values
    (9001, 1001, 'files', 'Plan v2.pdf'), (9002, 1001, 'files', 'huge.mov'), (9003, 1001, 'files', 'flaky.jpg')`);
});
after(async () => close());

const monday = fakeMonday((_doc, vars) => ({
  assets: (vars.ids as string[]).map((id) => ({
    id,
    name: { "9001": "Plan v2.pdf", "9002": "huge.mov", "9003": "flaky.jpg" }[id],
    file_extension: { "9001": ".pdf", "9002": ".mov", "9003": ".jpg" }[id],
    file_size: id === "9002" ? MAX_FILE_BYTES + 1 : 3,
    public_url: `https://files.example.test/${id}`,
  })),
}));

const fetchFile = (async (url: string) =>
  url.endsWith("/9003") ? new Response("nope", { status: 500 }) : new Response(new Uint8Array([1, 2, 3]))) as unknown as typeof fetch;

test("files: paths are board/item/asset/name with unsafe characters swapped", () => {
  assert.equal(storagePath(10, 1001, 9001, "Plan v2 (final).pdf"), "10/1001/9001/Plan_v2_final.pdf");
  const sneaky = storagePath(10, 1001, 9001, "../../etc/passwd");
  assert.equal(sneaky.split("/").length, 4, "a name can't add path segments");
  assert.ok(!sneaky.includes("../"));
  assert.equal(storagePath(10, 1001, 9001, ".."), "10/1001/9001/file");
  assert.equal(storagePath(10, 1001, 9001, ""), "10/1001/9001/file");
});

test("files: past its deadline a run fetches nothing and leaves every file for the next one", async () => {
  const store = memoryFileStore();
  const sent = monday.documents.length;
  const r = await downloadPendingFiles({ db, monday, store, fetch: fetchFile }, { max: 10, deadline: new Date(Date.now() - 1000) });
  assert.equal(r.downloaded + r.tooLarge + r.failed, 0);
  assert.equal(monday.documents.length, sent, "no Monday call after the deadline");
  assert.equal(store.files.size, 0);
});

test("files: downloads what it can, skips what's too big, and retries what failed", async () => {
  const store = memoryFileStore();
  const r = await downloadPendingFiles({ db, monday, store, fetch: fetchFile }, { max: 10 });
  assert.deepEqual(r, { downloaded: 1, tooLarge: 1, failed: 1, pending: 1 });

  const saved = store.files.get("monday-files/10/1001/9001/Plan_v2.pdf");
  assert.ok(saved);
  assert.equal(saved.contentType, "application/pdf");
  const rows = await db.query<{ id: number; storage_path: string | null; sha256: string | null; download_error: string | null; download_attempts: number }>(
    "select id, storage_path, sha256, download_error, download_attempts from mirror.monday_assets order by id",
  );
  assert.equal(rows[0].storage_path, "10/1001/9001/Plan_v2.pdf");
  assert.equal(rows[0].sha256, createHash("sha256").update(new Uint8Array([1, 2, 3])).digest("hex"));
  assert.equal(rows[1].download_error, "too_large");
  assert.deepEqual([rows[2].download_attempts, rows[2].download_error], [1, null]);
});

test("files: a file that keeps failing stops being tried after three attempts", async () => {
  const store = memoryFileStore();
  await downloadPendingFiles({ db, monday, store, fetch: fetchFile }, { max: 10 });
  await downloadPendingFiles({ db, monday, store, fetch: fetchFile }, { max: 10 });
  const [row] = await db.query<{ download_attempts: number; download_error: string | null }>(
    "select download_attempts, download_error from mirror.monday_assets where id = 9003",
  );
  assert.equal(row.download_attempts, 3);
  assert.match(row.download_error ?? "", /500/);
  const again = await downloadPendingFiles({ db, monday, store, fetch: fetchFile }, { max: 10 });
  assert.equal(again.pending, 0);
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node --import tsx --test src/server/mirror/monday/files.test.ts`
Expected: FAIL, `Cannot find module '../../storage'`.

- [ ] **Step 3: Write Storage and the files pass**

Create `src/server/storage.ts`:

```ts
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { readServerEnv, type ServerEnv } from "./env";

/**
 * Files in Supabase Storage, reached only from the server with the service role
 * key. Both buckets are private: people download through short-lived signed URLs.
 */
export interface FileStore {
  ensureBucket(name: string, fileSizeLimit: number): Promise<void>;
  upload(bucket: string, path: string, body: Uint8Array, contentType: string): Promise<void>;
  signedUrl(bucket: string, path: string, seconds: number): Promise<string>;
}

export const BUCKETS = { mondayFiles: "monday-files", launchpadFiles: "launchpad-files" } as const;

let client: SupabaseClient | null = null;

/** Null when NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY isn't set. */
export function supabaseFileStore(env: ServerEnv = readServerEnv()): FileStore | null {
  if (!env.supabaseUrl || !env.serviceRoleKey) return null;
  client ??= createClient(env.supabaseUrl, env.serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const storage = client.storage;
  return {
    async ensureBucket(name, fileSizeLimit) {
      const { data } = await storage.getBucket(name);
      if (data) return;
      const { error } = await storage.createBucket(name, { public: false, fileSizeLimit });
      if (error && !/already exists/i.test(error.message)) throw new Error(`Storage: ${error.message}`);
    },
    async upload(bucket, path, body, contentType) {
      const { error } = await storage.from(bucket).upload(path, body, { contentType, upsert: true });
      if (error) throw new Error(`Storage upload failed: ${error.message}`);
    },
    async signedUrl(bucket, path, seconds) {
      const { data, error } = await storage.from(bucket).createSignedUrl(path, seconds);
      if (error || !data?.signedUrl) throw new Error(`Storage: ${error?.message ?? "no signed URL"}`);
      return data.signedUrl;
    },
  };
}

/** An in-memory FileStore, for tests. Keys are "<bucket>/<path>". */
export function memoryFileStore(): FileStore & { files: Map<string, { body: Uint8Array; contentType: string }> } {
  const files = new Map<string, { body: Uint8Array; contentType: string }>();
  return {
    files,
    async ensureBucket() {},
    async upload(bucket, path, body, contentType) {
      files.set(`${bucket}/${path}`, { body, contentType });
    },
    async signedUrl(bucket, path) {
      return `memory://${bucket}/${path}`;
    },
  };
}
```

Create `src/server/mirror/monday/files.ts`:

```ts
import { createHash } from "node:crypto";
import type { Db } from "../../db/types";
import { BUCKETS, type FileStore } from "../../storage";
import type { MondayClient } from "./client";
import { Q } from "./queries";

/**
 * Copies Monday's files into the monday-files bucket. Monday's public URLs last
 * an hour, so each batch asks for fresh ones (one call per 50 files) and
 * downloads straight away. Files are kept by asset id, which never changes.
 */
export const MAX_FILE_BYTES = 50 * 1024 * 1024;
const ASSET_IDS_PER_CALL = 50;
const MAX_ATTEMPTS = 3;
const DOWNLOAD_TIMEOUT_MS = 60_000;

export interface FilesResult {
  downloaded: number;
  tooLarge: number;
  failed: number;
  /** Still to try after this run. */
  pending: number;
}

interface RawAsset {
  id: string;
  name?: string | null;
  file_extension?: string | null;
  file_size?: number | null;
  public_url?: string | null;
  created_at?: string | null;
}

const TYPES: Record<string, string> = {
  pdf: "application/pdf",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
  heic: "image/heic",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  csv: "text/csv",
  txt: "text/plain",
  zip: "application/zip",
  mp4: "video/mp4",
  mov: "video/quicktime",
};

const extensionOf = (ext: string | null | undefined, name: string) =>
  (ext ?? name.split(".").pop() ?? "").replace(/^\./, "").toLowerCase();

const safeName = (name: string) => {
  const s = name
    .normalize("NFKD")
    .replace(/[^\w.\-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/_+\./g, ".")
    .slice(-120);
  // Empty, or only dots ("." or ".."), which would read as a path step.
  return /^\.*$/.test(s) ? "file" : s;
};

export function storagePath(boardId: number, itemId: number, assetId: number, name: string): string {
  return `${boardId}/${itemId}/${assetId}/${safeName(name)}`;
}

export async function downloadPendingFiles(
  deps: { db: Db; monday: MondayClient; store: FileStore; fetch?: typeof fetch },
  opts: { max: number; deadline?: Date },
): Promise<FilesResult> {
  const fetchFile = deps.fetch ?? fetch;
  // A cron route's run ends before its host stops it: nothing new starts after the deadline.
  const pastDeadline = () => opts.deadline !== undefined && Date.now() >= opts.deadline.getTime();
  const result: FilesResult = { downloaded: 0, tooLarge: 0, failed: 0, pending: 0 };
  const pending = await deps.db.query<{ id: number; item_id: number; board_id: number; name: string }>(
    `select a.id, a.item_id, i.board_id, a.name
     from mirror.monday_assets a
     join mirror.monday_items i on i.id = a.item_id
     where a.storage_path is null and a.removed_at is null and a.download_error is null and a.download_attempts < $1
     order by a.monday_created_at desc nulls last, a.id
     limit $2`,
    [MAX_ATTEMPTS, opts.max],
  );

  const recordFailure = async (id: number, message: string) => {
    await deps.db.query(
      `update mirror.monday_assets
          set download_attempts = download_attempts + 1,
              download_error = case when download_attempts + 1 >= $2 then left($3, 300) end
        where id = $1`,
      [id, MAX_ATTEMPTS, message],
    );
    result.failed += 1;
  };

  chunks: for (let i = 0; i < pending.length; i += ASSET_IDS_PER_CALL) {
    if (pastDeadline()) break;
    const chunk = pending.slice(i, i + ASSET_IDS_PER_CALL);
    const data = await deps.monday.query<{ assets: RawAsset[] | null }>(Q.assets, { ids: chunk.map((a) => String(a.id)) });
    const byId = new Map((data.assets ?? []).map((a) => [Number(a.id), a]));

    for (const row of chunk) {
      if (pastDeadline()) break chunks;
      const info = byId.get(row.id);
      if (!info?.public_url) {
        await recordFailure(row.id, "Monday didn't return this file");
        continue;
      }
      const name = info.name || row.name;
      const ext = extensionOf(info.file_extension, name);
      if ((info.file_size ?? 0) > MAX_FILE_BYTES) {
        await deps.db.query(
          "update mirror.monday_assets set download_error = 'too_large', file_size = $2, file_extension = $3 where id = $1",
          [row.id, info.file_size, ext],
        );
        result.tooLarge += 1;
        continue;
      }
      try {
        // A stalled download mustn't hold the run: 60 s is plenty for a file under the 50 MiB limit.
        const res = await fetchFile(info.public_url, { signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS) });
        if (!res.ok) throw new Error(`download failed: HTTP ${res.status}`);
        const body = new Uint8Array(await res.arrayBuffer());
        if (body.byteLength > MAX_FILE_BYTES) {
          await deps.db.query("update mirror.monday_assets set download_error = 'too_large' where id = $1", [row.id]);
          result.tooLarge += 1;
          continue;
        }
        const path = storagePath(row.board_id, row.item_id, row.id, name);
        await deps.store.upload(BUCKETS.mondayFiles, path, body, TYPES[ext] ?? "application/octet-stream");
        await deps.db.query(
          `update mirror.monday_assets
              set storage_path = $2, sha256 = $3, file_size = $4, file_extension = $5,
                  monday_created_at = coalesce(monday_created_at, $6::timestamptz),
                  downloaded_at = now(), download_error = null
            where id = $1`,
          [row.id, path, createHash("sha256").update(body).digest("hex"), body.byteLength, ext, info.created_at ?? null],
        );
        result.downloaded += 1;
      } catch (e) {
        await recordFailure(row.id, e instanceof Error ? e.message : String(e));
      }
    }
  }

  const [left] = await deps.db.query<{ n: number }>(
    `select count(*)::int as n from mirror.monday_assets
     where storage_path is null and removed_at is null and download_error is null and download_attempts < $1`,
    [MAX_ATTEMPTS],
  );
  result.pending = left?.n ?? 0;
  return result;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --import tsx --test src/server/mirror/monday/files.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 5: Checkpoint**

Run: `npm test`, `npx tsc --noEmit` and `git status --short`. Expected new files: `src/server/storage.ts`, `src/server/mirror/monday/files.ts`, `src/server/mirror/monday/files.test.ts`. Don't commit.

---

### Task 14: Running it: the CLI, the cron routes, and the lot settler

**Files:**
- Create: `src/server/cron-auth.ts`, test `src/server/cron-auth.test.ts`
- Create: `src/server/mirror/run-source.ts`
- Create: `scripts/mirror.ts`
- Create: `app/api/mirror/[source]/route.ts`
- Create: `app/api/land/settle/route.ts`
- Modify: `package.json` (`scripts`)

**Interfaces:**
- Consumes: `runMondayPass`, `downloadPendingFiles`, `createMondayClient`, `dbLedger`, `supabaseFileStore`, `BUCKETS`, `runSetup`, `matchReps`, `discoverWorkspaces`, `discoverBoards`, `beginRun`, `endRun`, `getDb`, `closeDb`, `readServerEnv`.
- Produces:
  - `isCronAuthorized(header: string | null, secret: string | null): boolean`.
  - `runSource(db, env, source: string, mode: string, trigger, opts?: { boardKey?: string; maxFiles?: number; maxCalls?: number; log?: (line: string) => void }): Promise<PassResult>`.
  - `npm run mirror -- <command>`.
  - `GET /api/mirror/[source]?mode=` and `GET /api/land/settle`.

- [ ] **Step 1: Write the failing test**

Create `src/server/cron-auth.test.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { isCronAuthorized } from "./cron-auth";

test("cron auth: only the exact bearer secret passes", () => {
  const secret = "a-long-random-test-secret";
  assert.equal(isCronAuthorized(`Bearer ${secret}`, secret), true);
  assert.equal(isCronAuthorized(`Bearer ${secret}x`, secret), false);
  assert.equal(isCronAuthorized(secret, secret), false);
  assert.equal(isCronAuthorized(null, secret), false);
});

test("cron auth: with no secret configured, nothing passes", () => {
  assert.equal(isCronAuthorized("Bearer anything", null), false);
  assert.equal(isCronAuthorized("Bearer ", ""), false);
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node --import tsx --test src/server/cron-auth.test.ts`
Expected: FAIL, `Cannot find module './cron-auth'`.

- [ ] **Step 3: Write the auth check and the shared runner**

Create `src/server/cron-auth.ts`:

```ts
import { timingSafeEqual } from "node:crypto";

/** Vercel cron (and pg_cron, if used) send "Authorization: Bearer <CRON_SECRET>". No secret, no entry. */
export function isCronAuthorized(header: string | null, secret: string | null): boolean {
  if (!secret || !header) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const given = Buffer.from(header);
  return given.length === expected.length && timingSafeEqual(given, expected);
}
```

Create `src/server/mirror/run-source.ts`:

```ts
import type { Db } from "../db/types";
import type { ServerEnv } from "../env";
import { supabaseFileStore } from "../storage";
import { createMondayClient, MondayCapReachedError, type MondayClient, type MondayLedger } from "./monday/client";
import { downloadPendingFiles } from "./monday/files";
import { dbLedger } from "./monday/ledger";
import { runMondayPass, type MondayMode, type PassResult } from "./monday/passes";
import { beginRun, endRun, type Trigger } from "./runs";

/** One entry point for the CLI and the cron routes: a source, a mode, and the run's options. */
export interface RunSourceOptions {
  boardKey?: string;
  maxFiles?: number;
  /** Stop this run after this many Monday calls (for small trial runs). */
  maxCalls?: number;
  /** No Monday call or download starts after this (the cron routes set it). */
  deadline?: Date;
  log?: (line: string) => void;
}

const failed = (error: string): PassResult => ({ status: "failed", calls: 0, seen: 0, changed: 0, note: null, error });

export function mondayClientFor(db: Db, env: ServerEnv, maxCalls?: number, deadline?: Date): MondayClient | null {
  if (!env.mondayToken) return null;
  const base = dbLedger(db, "monday", env.mondayDailyCallCap);
  let used = 0;
  const ledger: MondayLedger = {
    claim: async () => {
      // A trial run's own limit says so, rather than the day's cap message.
      if (maxCalls !== undefined && used >= maxCalls) {
        throw new MondayCapReachedError(`Stopped after --max-calls ${maxCalls}, as asked.`, "MAX_CALLS");
      }
      used += 1;
      return base.claim();
    },
    dailyLimitHit: () => base.dailyLimitHit(),
  };
  return createMondayClient({ token: env.mondayToken, ledger, deadline });
}

async function runFiles(db: Db, env: ServerEnv, monday: MondayClient, trigger: Trigger, max: number, deadline?: Date): Promise<PassResult> {
  const store = supabaseFileStore(env);
  if (!store) return failed("Storage isn't configured: set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
  const run = await beginRun(db, "monday", "files", trigger, 1500, "monday:files");
  if (!run) return { status: "skipped", calls: 0, seen: 0, changed: 0, note: "another files run is going", error: null };
  const before = monday.stats.calls;
  let result: PassResult;
  try {
    const r = await downloadPendingFiles({ db, monday, store }, { max, deadline });
    result = {
      status: r.failed > 0 ? "partial" : "ok",
      calls: monday.stats.calls - before,
      seen: r.downloaded + r.tooLarge + r.failed,
      changed: r.downloaded,
      note: `${r.downloaded} downloaded, ${r.tooLarge} too large, ${r.failed} failed, ${r.pending} waiting`,
      error: null,
    };
  } catch (e) {
    result = { ...failed(e instanceof Error ? e.message : String(e)), calls: monday.stats.calls - before };
  }
  await endRun(db, run, {
    status: result.status,
    calls: result.calls,
    complexity: 0,
    seen: result.seen,
    changed: result.changed,
    note: result.note,
    error: result.error,
    watermarkBefore: null,
    watermarkAfter: null,
  });
  return result;
}

const MONDAY_MODES = new Set(["backfill", "changes", "safety", "sweep", "files"]);

export async function runSource(
  db: Db,
  env: ServerEnv,
  source: string,
  mode: string,
  trigger: Trigger,
  opts: RunSourceOptions = {},
): Promise<PassResult> {
  if (source === "monday") {
    if (!MONDAY_MODES.has(mode)) return failed(`unknown Monday mode "${mode}"`);
    const monday = mondayClientFor(db, env, opts.maxCalls, opts.deadline);
    if (!monday) return failed("MONDAY_API_TOKEN is not set");
    if (mode === "files") return runFiles(db, env, monday, trigger, opts.maxFiles ?? 200, opts.deadline);
    return runMondayPass(db, monday, mode as MondayMode, { trigger, boardKey: opts.boardKey, log: opts.log, deadline: opts.deadline });
  }
  return failed(`unknown source "${source}"`);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --import tsx --test src/server/cron-auth.test.ts`
Expected: PASS, 2 tests.

- [ ] **Step 5: Write the CLI**

Create `scripts/mirror.ts`:

```ts
/**
 * npm run mirror -- <command> [options]
 *
 *   status                      boards, items, files, today's calls, recent runs
 *   buckets                     create the private Storage buckets
 *   discover [--workspace <id>] list the workspaces (and one workspace's boards) the token can see
 *   setup [--jerry-config <p>]  enable Locale's boards and map their columns from Jerry's config
 *   reps                        match Monday's sales rep names to staff (after a backfill)
 *   backfill | changes | safety | sweep [--board <key>] [--max-calls <n>]
 *   files [--max-files <n>]     copy Monday's files into Storage
 *
 * Reads .env.local. Monday is only ever queried.
 */
import { closeDb, getDb } from "../src/server/db/postgres";
import type { Db } from "../src/server/db/types";
import { readServerEnv } from "../src/server/env";
import { discoverBoards, discoverWorkspaces } from "../src/server/mirror/monday/discover";
import { MAX_FILE_BYTES } from "../src/server/mirror/monday/files";
import type { PassResult } from "../src/server/mirror/monday/passes";
import { matchReps, runSetup } from "../src/server/mirror/monday/setup";
import { mondayClientFor, runSource } from "../src/server/mirror/run-source";
import { BUCKETS, supabaseFileStore } from "../src/server/storage";

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

function printResult(r: PassResult) {
  console.log(`${r.status}: ${r.calls} call(s), ${r.seen} seen, ${r.changed} changed${r.note ? `. ${r.note}` : ""}`);
  if (r.error) console.error(`error: ${r.error}`);
}

async function printStatus(db: Db, cap: number) {
  const [boards] = await db.query<{ parents: number; subitems: number }>(
    `select count(*) filter (where parent_board_id is null)::int as parents,
            count(*) filter (where parent_board_id is not null)::int as subitems
     from mirror.monday_boards where sync_enabled`,
  );
  const [items] = await db.query<{ live: number; removed: number }>(
    `select count(*) filter (where removed_at is null)::int as live, count(*) filter (where removed_at is not null)::int as removed
     from mirror.monday_items`,
  );
  const [files] = await db.query<{ done: number; waiting: number; large: number }>(
    `select count(*) filter (where storage_path is not null)::int as done,
            count(*) filter (where storage_path is null and download_error is null and removed_at is null)::int as waiting,
            count(*) filter (where download_error = 'too_large')::int as large
     from mirror.monday_assets`,
  );
  const [calls] = await db.query<{ n: string; limit_hit: boolean }>(
    `select coalesce(sum(calls), 0)::text as n, bool_or(limit_hit_at is not null) is true as limit_hit
     from mirror.api_calls where source = 'monday' and day = (now() at time zone 'utc')::date`,
  );
  // The lot sync does nothing until the Exclusive Land board's status column is mapped (setup does it).
  const [lots] = await db.query<{ mapped: boolean; count: number }>(
    `select exists (select 1 from mirror.monday_field_map m join mirror.monday_boards b on b.id = m.board_id
                    where b.purpose = 'exclusive_land' and m.field_key = 'lot_status') as mapped,
            (select count(*)::int from launchpad.land_lots where source = 'monday') as count`,
  );
  console.log(`boards enabled: ${boards.parents} (+ ${boards.subitems} subitems boards)`);
  console.log(`items: ${items.live} live, ${items.removed} removed`);
  console.log(`files: ${files.done} copied, ${files.waiting} waiting, ${files.large} over the size limit`);
  console.log(
    `Exclusive Land: ${lots.count} lot(s) from Monday; ${lots.mapped ? "status column mapped" : "status column NOT mapped yet, so lots don't sync (run setup)"}`,
  );
  console.log(
    `Monday calls today (UTC): ${calls.n} of the ${cap} cap${calls.limit_hit ? "; Monday's daily limit was hit, so calls wait for 00:00 UTC" : ""}`,
  );
  const runs = await db.query<{ started: Date; source: string; mode: string; status: string; api_calls: number; note: string | null; error: string | null }>(
    "select started_at as started, source, mode, status, api_calls, note, error from mirror.sync_runs order by id desc limit 10",
  );
  for (const r of runs) {
    console.log(`  ${new Date(r.started).toISOString()}  ${r.source}/${r.mode}  ${r.status}  ${r.api_calls} call(s)  ${r.note ?? r.error ?? ""}`);
  }
}

async function main() {
  const [command = "status", ...args] = process.argv.slice(2);
  const flag = (name: string): string | undefined => {
    const i = args.indexOf(`--${name}`);
    return i >= 0 ? args[i + 1] : undefined;
  };
  const env = readServerEnv();
  const db = getDb();
  if (!db) fail("SUPABASE_DB_URL is not set. Put it in .env.local (see .env.example).");

  try {
    switch (command) {
      case "status":
        await printStatus(db, env.mondayDailyCallCap);
        break;
      case "buckets": {
        const store = supabaseFileStore(env);
        if (!store) fail("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY first.");
        await store.ensureBucket(BUCKETS.mondayFiles, MAX_FILE_BYTES);
        await store.ensureBucket(BUCKETS.launchpadFiles, MAX_FILE_BYTES);
        console.log(`buckets ready: ${BUCKETS.mondayFiles}, ${BUCKETS.launchpadFiles}`);
        break;
      }
      case "discover": {
        const monday = mondayClientFor(db, env) ?? fail("MONDAY_API_TOKEN is not set.");
        await discoverWorkspaces(db, monday);
        const workspaces = await db.query<{ id: number; name: string }>("select id, name from mirror.monday_workspaces order by name");
        for (const w of workspaces) console.log(`workspace ${w.id}  ${w.name}`);
        const ws = flag("workspace");
        if (ws) {
          await discoverBoards(db, monday, [Number(ws)]);
          const boards = await db.query<{ id: number; name: string; type: string }>(
            "select id, name, type from mirror.monday_boards where workspace_id = $1 order by name",
            [Number(ws)],
          );
          for (const b of boards) console.log(`  board ${b.id}  ${b.name}  (${b.type})`);
        }
        console.log(`${monday.stats.calls} Monday call(s)`);
        break;
      }
      case "setup": {
        const monday = mondayClientFor(db, env) ?? fail("MONDAY_API_TOKEN is not set.");
        const report = await runSetup(db, monday, { jerryConfigPath: flag("jerry-config") ?? null, log: console.log });
        console.log(`boards enabled: ${report.boardsEnabled.join(", ") || "none"}`);
        if (report.notVisible.length) console.log(`not visible to this token: ${report.notVisible.join(", ")}`);
        console.log(`fields mapped: ${report.fieldsMapped}`);
        if (report.unknownFields.length) console.log(`fields in Jerry's config we don't read: ${report.unknownFields.join(", ")}`);
        console.log(`Exclusive Land, matched by title: ${report.lotFields.map((f) => `${f.fieldKey} <- ${f.columnId}`).join(", ") || "nothing"}`);
        if (report.lotUnmatched.length) console.log(`Exclusive Land columns to place by hand: ${report.lotUnmatched.join(", ")}`);
        console.log(`${monday.stats.calls} Monday call(s)`);
        break;
      }
      case "reps": {
        const r = await matchReps(db);
        console.log(`matched ${r.matched} rep name(s)`);
        if (r.unmatched.length) console.log(`no staff match, add to launchpad.staff_aliases by hand: ${r.unmatched.join("; ")}`);
        break;
      }
      case "backfill":
      case "changes":
      case "safety":
      case "sweep":
      case "files": {
        const maxCalls = flag("max-calls");
        const maxFiles = flag("max-files");
        const r = await runSource(db, env, "monday", command, "cli", {
          boardKey: flag("board"),
          maxCalls: maxCalls ? Number(maxCalls) : undefined,
          maxFiles: maxFiles ? Number(maxFiles) : undefined,
          log: console.log,
        });
        printResult(r);
        if (r.status === "failed") process.exitCode = 1;
        break;
      }
      default:
        fail(`Unknown command "${command}". See the comment at the top of scripts/mirror.ts.`);
    }
  } finally {
    await closeDb();
  }
}

main().catch(async (e) => {
  console.error(e instanceof Error ? e.message : e);
  await closeDb();
  process.exit(1);
});
```

In `package.json` `"scripts"`, add:

```json
    "mirror": "node --env-file-if-exists=.env.local --import tsx scripts/mirror.ts",
```

- [ ] **Step 6: Write the cron routes**

Create `app/api/mirror/[source]/route.ts`:

```ts
import { NextResponse } from "next/server";
import { isCronAuthorized } from "@/server/cron-auth";
import { getDb } from "@/server/db/postgres";
import { readServerEnv } from "@/server/env";
import { runSource } from "@/server/mirror/run-source";

export const dynamic = "force-dynamic";
// Vercel Pro allows 300s. Nothing starts or waits past 120s (RUN_SECONDS): the pass refuses new calls, and the
// client claims, waits and times out no attempt beyond it. So the pass ends partial well before the host stops
// the function, its lease is released, and the next run carries on.
export const maxDuration = 300;
const RUN_SECONDS = 120;

/** GET /api/mirror/monday?mode=changes (or backfill, safety, sweep, files), with Authorization: Bearer CRON_SECRET. */
export async function GET(request: Request, { params }: { params: Promise<{ source: string }> }) {
  const env = readServerEnv();
  if (!isCronAuthorized(request.headers.get("authorization"), env.cronSecret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const db = getDb();
  if (!db) return NextResponse.json({ error: "No database is configured" }, { status: 503 });
  const { source } = await params;
  const mode = new URL(request.url).searchParams.get("mode") ?? "";
  const result = await runSource(db, env, source, mode, "cron", { deadline: new Date(Date.now() + RUN_SECONDS * 1000) });
  return NextResponse.json(result, { status: result.status === "failed" ? 500 : 200 });
}
```

Create `app/api/land/settle/route.ts`:

```ts
import { NextResponse } from "next/server";
import { isCronAuthorized } from "@/server/cron-auth";
import { getDb } from "@/server/db/postgres";
import { readServerEnv } from "@/server/env";

export const dynamic = "force-dynamic";

/** Every 5 minutes: ends lapsed Exclusive Land holds and starts (and notifies) the next in each queue. */
export async function GET(request: Request) {
  const env = readServerEnv();
  if (!isCronAuthorized(request.headers.get("authorization"), env.cronSecret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const db = getDb();
  if (!db) return NextResponse.json({ error: "No database is configured" }, { status: 503 });
  const [row] = await db.query<{ started: number }>("select count(*)::int as started from launchpad.settle_land_holds()");
  return NextResponse.json({ started: row?.started ?? 0 });
}
```

- [ ] **Step 7: Check that it builds without a database**

Run: `npx tsc --noEmit` then `npm run build`.
Expected: both pass with no `.env.local`. The two routes show as dynamic (`ƒ`) in the build output.

Run: `npm run mirror -- status` with no `.env.local`.
Expected: `SUPABASE_DB_URL is not set...` and exit code 1.

- [ ] **Step 8: Checkpoint**

Run: `npm test` and `git status --short`. Expected new files: `src/server/cron-auth.ts`, `src/server/cron-auth.test.ts`, `src/server/mirror/run-source.ts`, `scripts/mirror.ts`, the two route files; `package.json` modified. Don't commit.

---

# Phase C: The four screens on live data

### Task 15: Loaders and the shapes the screens read

**Files:**
- Create: `src/data/live/types.ts`
- Create: `src/server/read/to-job.ts`, test `src/server/read/to-job.test.ts`
- Create: `src/lib/perth-time.ts`
- Create: `src/components/modules/sales/land/live-lots.ts`, test `src/components/modules/sales/land/live-lots.test.ts`
- Create: `src/server/read/jobs.ts`, `src/server/read/lots.ts`, `src/server/read/reps.ts`, `src/server/read/files.ts`, `src/server/read/live-data.ts`
- Test: `src/server/read/live-data.test.ts`

**Interfaces:**
- Consumes: `Job`, `Milestone`, `MilestoneStatus`, `CONSTRUCTION_MILESTONES` (`src/data/jobs.ts`); `LandLot` (`sales/data.ts`); `Db`, `getDb()`; the views from Tasks 6 and 7.
- Produces:
  - `src/data/live/types.ts`:
    - `RepOption { id: string; name: string }`;
    - `LiveHold { id; staffId; name; client: string | null; note: string | null; queuedAt: string; startedAt: string | null; expiresAt: string | null }`;
    - `LiveLot { id; lot; estate; developer; builder; landPrice; packagePrice; design; areaSqm; frontageM; zoning; titleStatus; titleEta; rebate; saleStatus: "available" | "sold"; soldBy; soldClient; mondayItemId: number | null; removedFromMonday: boolean; holds: LiveHold[] }`;
    - `LiveFile { assetId: number; name: string; size: number | null; ready: boolean; milestone: string | null }`;
    - `LiveData = { status: "ok"; asOf: string; jobs: Job[]; lots: LiveLot[]; reps: RepOption[] } | { status: "error"; message: string }`.
  - Job mapping: `toJob(row: JobRow, milestones: MilestoneRow[]): Job`, `milestoneStatus(label, completed): MilestoneStatus`, `displayDate(iso): string`.
  - Lot view: `viewLot(lot: LiveLot, viewerId: string | null, now: number): LandLot`, `formatHoldExpiry(expiresAt: string, now: number): string`, `lotPrice`, `lotSpecs`, `lotTitled`.
  - Perth time (`src/lib/perth-time.ts`): `PERTH` and `perthClock(t: number | string | Date): string` ("11:42am").
  - Loaders: `loadJobs(db): Promise<Job[]>`, `loadLots(db): Promise<LiveLot[]>` (settles holds first), `loadReps(db): Promise<RepOption[]>`, `loadItemFiles(db, itemId): Promise<LiveFile[]>`, `parseAssetId(raw: string): number | null`.
  - `loadLiveData(db?: Db | null, now?: () => Date): Promise<LiveData | null>`: null without a database; `{ status: "error" }` when the database can't be read.

- [ ] **Step 1: Write the shared types**

Create `src/data/live/types.ts`:

```ts
import type { Job } from "@/data/jobs";

/**
 * What the live screens read when a database is connected. Built on the server
 * (src/server/read/), passed to the browser through LiveDataProvider. With no
 * database there is no LiveData and every screen keeps its sample data.
 */
export interface RepOption {
  id: string;
  name: string;
}

export interface LiveHold {
  id: string;
  staffId: string;
  name: string;
  client: string | null;
  note: string | null;
  queuedAt: string;
  /** Set on the lot's active hold; null while queued. */
  startedAt: string | null;
  expiresAt: string | null;
}

export interface LiveLot {
  id: string;
  lot: string;
  estate: string | null;
  developer: string | null;
  /** Null: any builder. */
  builder: string | null;
  landPrice: number | null;
  packagePrice: number | null;
  design: string | null;
  areaSqm: number | null;
  frontageM: number | null;
  zoning: string | null;
  titleStatus: "titled" | "untitled" | "delayed" | null;
  titleEta: string | null;
  rebate: string | null;
  saleStatus: "available" | "sold";
  soldBy: string | null;
  soldClient: string | null;
  mondayItemId: number | null;
  removedFromMonday: boolean;
  /** Open holds: the active one first, then the queue in order. */
  holds: LiveHold[];
}

export interface LiveFile {
  assetId: number;
  name: string;
  size: number | null;
  /** Copied into Storage and ready to open. */
  ready: boolean;
  /** The milestone (subitem) it's on, or null for the job or lot itself. */
  milestone: string | null;
}

export type LiveData =
  | { status: "ok"; asOf: string; jobs: Job[]; lots: LiveLot[]; reps: RepOption[] }
  | { status: "error"; message: string };
```

- [ ] **Step 2: Write the failing tests for the mappers**

Create `src/server/read/to-job.test.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { displayDate, milestoneStatus, toJob, type JobRow, type MilestoneRow } from "./to-job";

const row = (over: Partial<JobRow> = {}): JobRow => ({
  item_id: 1001,
  purpose: "construction",
  job_number: "12345",
  deal_name: "Test Client A",
  site_address: "Lot 1, 2 Test Street",
  site_suburb: "Testville",
  site_state: "WA",
  builder: "Test Builder",
  buyer_type: "Investor - Retail",
  block_titled: "No",
  title_due_date: "2026-09-30",
  sale_won_date: "2026-03-14",
  construction_stage: "Slab Down",
  hubspot_deal_id: 999,
  updated_at: "2026-10-07T03:00:00Z",
  rep: "Test Rep A",
  ...over,
});

const ms = (name: string, label: string | null, completed: string | null = null): MilestoneRow => ({
  job_item_id: 1001,
  name,
  status_label: label,
  due_date: null,
  date_completed: completed,
  monday_created_at: null,
});

test("to-job: dates read like the prototype's", () => {
  assert.equal(displayDate("2026-03-04"), "04 Mar 2026");
  assert.equal(displayDate(null), "");
  assert.equal(displayDate("soon"), "");
});

test("to-job: milestone labels map onto the prototype's statuses", () => {
  assert.equal(milestoneStatus("Done", "2026-10-01"), "done");
  assert.equal(milestoneStatus("Completed", null), "pendingDate", "done without a date is awaiting one");
  assert.equal(milestoneStatus("Working on it", null), "prog");
  assert.equal(milestoneStatus("Overdue", null), "prog");
  assert.equal(milestoneStatus("N/A", null), "na");
  assert.equal(milestoneStatus("Not Started", null), "open");
  assert.equal(milestoneStatus(null, null), "open");
});

test("to-job: a Monday job becomes the prototype's Job", () => {
  const job = toJob(row(), [
    ms("Slab Down", "Done", "2026-10-01"),
    ms("Contracts Signed", "Done", "2026-04-02"),
    ms("Builder Acceptance", "Done", "2026-03-20"),
    ms("Date to Site", "Done", "2026-09-01"),
    ms("Some Monday-only step", "Not Started"),
  ]);
  assert.equal(job.id, 1001);
  assert.equal(job.jobNo, "12345");
  assert.equal(job.recordId, "999");
  assert.equal(job.client, "Test Client A");
  assert.equal(job.address, "Lot 1, 2 Test Street, Testville, WA");
  assert.equal(job.board, "construction");
  assert.equal(job.hsStage, "Slab Down");
  assert.equal(job.rep, "Test Rep A");
  assert.equal(job.saleWon, "14 Mar 2026");
  assert.equal(job.blockTitled, "Untitled");
  assert.equal(job.blockDue, "30 Sep 2026");
  assert.deepEqual(job.precon.map((m) => m.name), ["Builder Acceptance", "Contracts Signed", "Some Monday-only step"]);
  assert.deepEqual(job.milestones.map((m) => [m.name, m.status, m.date]), [
    ["Date to Site", "done", "01 Sep 2026"],
    ["Slab Down", "done", "01 Oct 2026"],
  ]);
});

test("to-job: steps outside the known order keep the order they were made in", () => {
  const made = (name: string, at: string): MilestoneRow => ({ ...ms(name, "Not Started"), monday_created_at: new Date(at) });
  // A Wednesday, then a Friday: sorted by time, not by the weekday's name.
  const job = toJob(row(), [made("Extra step B", "2026-10-09T00:00:00Z"), made("Extra step A", "2026-10-07T00:00:00Z")]);
  assert.deepEqual(job.precon.map((m) => m.name), ["Extra step A", "Extra step B"]);
});

test("to-job: the address doesn't repeat a suburb it already has, and a titled block has no due date", () => {
  const job = toJob(row({ site_address: "2 Test Street, Testville WA", block_titled: "Yes" }), []);
  assert.equal(job.address, "2 Test Street, Testville WA");
  assert.equal(job.blockTitled, "Titled");
  assert.equal(job.blockDue, "");
  assert.equal(toJob(row({ purpose: "sales", construction_stage: null }), []).hsStage, "Sale Won");
});
```

Create `src/components/modules/sales/land/live-lots.test.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import type { LiveLot } from "@/data/live/types";
import { formatHoldExpiry, lotPrice, lotSpecs, lotTitled, viewLot } from "./live-lots";

const NOW = Date.parse("2026-10-08T00:00:00Z"); // 8:00am Thursday in Perth

const lot = (over: Partial<LiveLot> = {}): LiveLot => ({
  id: "11111111-1111-1111-1111-111111111111",
  lot: "Lot 1 Test Street, Testville",
  estate: "Test Estate",
  developer: null,
  builder: null,
  landPrice: 364000,
  packagePrice: null,
  design: null,
  areaSqm: 319,
  frontageM: 8.97,
  zoning: "R40",
  titleStatus: "untitled",
  titleEta: "2026-09-30",
  rebate: "Test rebate",
  saleStatus: "available",
  soldBy: null,
  soldClient: null,
  mondayItemId: 3001,
  removedFromMonday: false,
  holds: [],
  ...over,
});

const hold = (staffId: string, startedAt: string | null, expiresAt: string | null, client: string | null = null) => ({
  id: `hold-${staffId}`,
  staffId,
  name: staffId === "test-rep-a" ? "Test Rep A" : "Test Rep B",
  client,
  note: null,
  queuedAt: "2026-10-07T23:00:00Z",
  startedAt,
  expiresAt,
});

test("live lots: hold expiry reads in Perth time, whatever the server's timezone (Review Focus 3)", () => {
  assert.equal(formatHoldExpiry("2026-10-09T00:00:00Z", NOW), "8:00am tomorrow");
  assert.equal(formatHoldExpiry("2026-10-08T03:42:00Z", NOW), "11:42am today");
  const later = formatHoldExpiry("2026-10-10T02:00:00Z", NOW);
  assert.ok(later.startsWith("10:00am on "), later);
  assert.match(later, /10 Oct/);
});

test("live lots: prices, specs and title read like the prototype's", () => {
  assert.equal(lotPrice(lot()), "Land $364k");
  assert.equal(lotPrice(lot({ packagePrice: 791000, design: "Test Design" })), "Package $791k · Test Design");
  assert.equal(lotPrice(lot({ landPrice: null })), "Price on request");
  assert.equal(lotSpecs(lot()), "319 sqm · 8.97m frontage · R40");
  assert.equal(lotTitled(lot()), "Title ETA 30 Sep");
  assert.equal(lotTitled(lot({ titleStatus: "titled" })), "Titled");
  assert.equal(lotTitled(lot({ titleStatus: "delayed", titleEta: null })), "Title delayed");
});

test("live lots: the active holder sees it as theirs", () => {
  const view = viewLot(lot({ holds: [hold("test-rep-a", "2026-10-08T00:00:00Z", "2026-10-09T00:00:00Z", "Test Client A")] }), "test-rep-a", NOW);
  assert.equal(view.status, "hold");
  assert.equal(view.mine, true);
  assert.equal(view.holder, "Test Rep A for Test Client A");
  assert.equal(view.expires, "Hold expires 8:00am tomorrow");
  assert.equal(view.queue, 1);
  assert.equal(view.builder, "Any builder");
});

test("live lots: a queued rep sees their place; anyone else sees the hold", () => {
  const l = lot({
    holds: [hold("test-rep-a", "2026-10-08T00:00:00Z", "2026-10-09T00:00:00Z"), hold("test-rep-b", null, null)],
  });
  const queued = viewLot(l, "test-rep-b", NOW);
  assert.deepEqual([queued.mine, queued.queuedAt, queued.queue], [false, 2, 2]);
  const other = viewLot(l, "someone-else", NOW);
  assert.deepEqual([other.status, other.mine, other.queuedAt], ["hold", false, undefined]);
});

test("live lots: a sold lot shows who sold it, and an expired hold no longer shows", () => {
  assert.equal(viewLot(lot({ saleStatus: "sold", soldBy: "Test Rep A" }), null, NOW).holder, "Test Rep A");
  const lapsed = viewLot(lot({ holds: [hold("test-rep-a", "2026-10-06T00:00:00Z", "2026-10-07T00:00:00Z")] }), null, NOW);
  assert.equal(lapsed.status, "available");
});
```

- [ ] **Step 3: Run them to verify they fail**

Run: `node --import tsx --test src/server/read/to-job.test.ts src/components/modules/sales/land/live-lots.test.ts`
Expected: FAIL, modules not found.

- [ ] **Step 4: Write the mappers**

Create `src/server/read/to-job.ts`:

```ts
import { CONSTRUCTION_MILESTONES, type Job, type Milestone, type MilestoneStatus } from "@/data/jobs";

/** A row of launchpad.monday_jobs, with the rep's name resolved through staff_aliases. */
export interface JobRow {
  item_id: number;
  purpose: string;
  job_number: string | null;
  deal_name: string;
  site_address: string | null;
  site_suburb: string | null;
  site_state: string | null;
  builder: string | null;
  buyer_type: string | null;
  block_titled: string | null;
  title_due_date: string | null;
  sale_won_date: string | null;
  construction_stage: string | null;
  hubspot_deal_id: number | null;
  updated_at: Date | string;
  rep: string | null;
}

/** A row of launchpad.monday_job_milestones. */
export interface MilestoneRow {
  job_item_id: number;
  name: string;
  status_label: string | null;
  due_date: string | null;
  date_completed: string | null;
  monday_created_at: Date | string | null;
}

/** The prototype's preconstruction order (src/data/jobs.ts). Names Monday adds sort after these. */
export const PRECON_ORDER = [
  "Builder Acceptance",
  "Compliance Sketch and Quote received",
  "Compliance Sketch and Quote approved",
  "Contracts Received",
  "Contracts Signed",
  "Formal Finance Approval",
  "Settlement Confirmation",
  "Deposit Claim",
  "Prestart Meeting",
  "Build Permit Received",
  "Variations",
];

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2026-03-04" → "04 Mar 2026", the prototype's display form. */
export function displayDate(iso: string | null): string {
  if (!iso || !/^\d{4}-\d{2}-\d{2}/.test(iso)) return "";
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return `${String(d).padStart(2, "0")} ${MONTHS[m - 1]} ${y}`;
}

/** A Monday status label to the prototype's status. Done without a date is "awaiting date". */
export function milestoneStatus(label: string | null, completed: string | null): MilestoneStatus {
  const l = (label ?? "").trim().toLowerCase();
  if (l === "done" || l.includes("complete")) return completed ? "done" : "pendingDate";
  if (l.includes("n/a") || l.includes("not applicable")) return "na";
  if (l.includes("progress") || l.includes("working") || l.includes("overdue") || l.includes("stuck")) return "prog";
  return completed ? "done" : "open";
}

/** Monday's Block Titled labels are Yes and No; the prototype says Titled and Untitled. */
function titledLabel(v: string | null): string {
  const l = (v ?? "").trim().toLowerCase();
  if (l === "yes" || l === "titled") return "Titled";
  if (l === "no" || l === "untitled") return "Untitled";
  return v?.trim() ?? "";
}

const CONSTRUCTION = new Set(CONSTRUCTION_MILESTONES.map((n) => n.toLowerCase()));

const createdAt = (m: MilestoneRow) => (m.monday_created_at ? new Date(m.monday_created_at).getTime() : 0);

/** Known steps in the prototype's order; anything else after them, oldest first. */
function ordered(rows: MilestoneRow[], order: readonly string[]): MilestoneRow[] {
  const rank = (name: string) => {
    const i = order.findIndex((o) => o.toLowerCase() === name.trim().toLowerCase());
    return i < 0 ? order.length : i;
  };
  return [...rows].sort((a, b) => rank(a.name) - rank(b.name) || createdAt(a) - createdAt(b));
}

const toMilestone = (m: MilestoneRow): Milestone => ({
  name: m.name.trim(),
  status: milestoneStatus(m.status_label, m.date_completed),
  date: displayDate(m.date_completed),
  due: displayDate(m.due_date),
});

function address(row: JobRow): string {
  let out = row.site_address?.trim() ?? "";
  for (const part of [row.site_suburb, row.site_state]) {
    const p = part?.trim();
    if (p && !out.toLowerCase().includes(p.toLowerCase())) out = out ? `${out}, ${p}` : p;
  }
  return out;
}

function stamp(updated: Date | string): string {
  const d = new Date(updated);
  return Number.isNaN(d.getTime()) ? "Monday" : `Monday, ${displayDate(d.toISOString())}`;
}

export function toJob(row: JobRow, milestones: MilestoneRow[]): Job {
  const own = milestones.filter((m) => m.job_item_id === row.item_id);
  const construction = own.filter((m) => CONSTRUCTION.has(m.name.trim().toLowerCase()));
  const precon = own.filter((m) => !CONSTRUCTION.has(m.name.trim().toLowerCase()));
  const titled = titledLabel(row.block_titled);
  return {
    id: row.item_id,
    jobNo: row.job_number ?? "",
    recordId: row.hubspot_deal_id ? String(row.hubspot_deal_id) : "",
    buyerType: row.buyer_type ?? "",
    client: row.deal_name,
    builder: row.builder ?? "",
    address: address(row),
    board: row.purpose === "sales" ? "sales" : "construction",
    hsStage: row.construction_stage ?? (row.purpose === "sales" ? "Sale Won" : "Construction"),
    rep: row.rep?.trim() ?? "",
    saleWon: displayDate(row.sale_won_date),
    blockTitled: titled,
    blockDue: titled === "Titled" ? "" : displayDate(row.title_due_date),
    sync: "ok",
    lastSource: stamp(row.updated_at),
    precon: ordered(precon, PRECON_ORDER).map(toMilestone),
    milestones: ordered(construction, CONSTRUCTION_MILESTONES).map(toMilestone),
  };
}
```

Create `src/lib/perth-time.ts` (the Exclusive Land cards and the live note both show Perth times):

```ts
/** Locale works in Perth: times show in Perth's zone, the same on the server and in the browser. */
export const PERTH = "Australia/Perth";

/** "11:42am", in Perth. */
export const perthClock = (t: number | string | Date): string =>
  new Intl.DateTimeFormat("en-AU", { timeZone: PERTH, hour: "numeric", minute: "2-digit", hour12: true })
    .format(new Date(t))
    .replace(/\s/g, "")
    .toLowerCase();
```

Create `src/components/modules/sales/land/live-lots.ts`:

```ts
import type { LiveHold, LiveLot } from "@/data/live/types";
import { PERTH, perthClock } from "@/lib/perth-time";
import type { LandLot } from "../data";

/**
 * A live lot as the Exclusive Land screen draws it, for one viewer: the same
 * LandLot shape the sample data uses, so the cards don't change. Times are
 * Perth's, wherever the code runs.
 */
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const dayKey = (t: number) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: PERTH, year: "numeric", month: "2-digit", day: "2-digit" }).format(t);

/** "11:42am today", "8:00am tomorrow", "10:00am on Sat 10 Oct". */
export function formatHoldExpiry(expiresAt: string, now: number): string {
  const t = Date.parse(expiresAt);
  const day = dayKey(t);
  const when =
    day === dayKey(now)
      ? "today"
      : day === dayKey(now + 86_400_000)
        ? "tomorrow"
        : `on ${new Intl.DateTimeFormat("en-AU", { timeZone: PERTH, weekday: "short", day: "numeric", month: "short" }).format(t)}`;
  return `${perthClock(t)} ${when}`;
}

const thousands = (n: number) => `$${Math.round(n / 1000)}k`;
const plain = (n: number) => String(Number(n));

export function lotPrice(lot: LiveLot): string {
  if (lot.packagePrice) return `Package ${thousands(lot.packagePrice)}${lot.design ? ` · ${lot.design}` : ""}`;
  if (lot.landPrice) return `Land ${thousands(lot.landPrice)}`;
  return "Price on request";
}

export function lotSpecs(lot: LiveLot): string {
  return [
    lot.areaSqm ? `${plain(lot.areaSqm)} sqm` : null,
    lot.frontageM ? `${plain(lot.frontageM)}m frontage` : null,
    lot.zoning,
  ]
    .filter(Boolean)
    .join(" · ");
}

export function lotTitled(lot: LiveLot): string {
  if (lot.titleStatus === "titled") return "Titled";
  if (lot.titleEta && /^\d{4}-\d{2}-\d{2}/.test(lot.titleEta)) {
    const [, m, d] = lot.titleEta.split("-").map(Number);
    return `Title ETA ${d} ${MONTHS[m - 1]}`;
  }
  if (lot.titleStatus === "delayed") return "Title delayed";
  if (lot.titleStatus === "untitled") return "Untitled";
  return "";
}

const holderOf = (h: LiveHold) => (h.client ? `${h.name} for ${h.client}` : h.name);

export function viewLot(lot: LiveLot, viewerId: string | null, now: number): LandLot {
  const sold = lot.saleStatus === "sold";
  const active = sold
    ? undefined
    : lot.holds.find((h) => h.startedAt !== null && (h.expiresAt === null || Date.parse(h.expiresAt) > now));
  const position = viewerId ? lot.holds.findIndex((h) => h.staffId === viewerId) : -1;
  const queued = !sold && position >= 0 && lot.holds[position] !== active;
  return {
    id: lot.id,
    lot: lot.lot,
    estate: lot.estate ?? "",
    builder: lot.builder ?? "Any builder",
    status: sold ? "sold" : active ? "hold" : "available",
    price: lotPrice(lot),
    specs: lotSpecs(lot),
    titled: lotTitled(lot),
    note: lot.rebate ?? undefined,
    holder: sold ? (lot.soldBy ?? undefined) : active ? holderOf(active) : undefined,
    expires: active?.expiresAt ? `Hold expires ${formatHoldExpiry(active.expiresAt, now)}` : undefined,
    queue: !sold && lot.holds.length > 0 ? lot.holds.length : undefined,
    mine: Boolean(active && active.staffId === viewerId),
    queuedAt: queued ? position + 1 : undefined,
  };
}
```

- [ ] **Step 5: Run the mapper tests to verify they pass**

Run: `node --import tsx --test src/server/read/to-job.test.ts src/components/modules/sales/land/live-lots.test.ts`
Expected: PASS, 10 tests.

- [ ] **Step 6: Write the failing loader test**

Create `src/server/read/live-data.test.ts`:

```ts
import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { migratedTestDb } from "../db/pglite";
import { addStaff } from "../db/test-fixtures";
import type { Db } from "../db/types";
import { matchReps } from "../mirror/monday/setup";
import { loadItemFiles, parseAssetId } from "./files";
import { loadLiveData } from "./live-data";

let db: Db;
let close: () => Promise<void>;
before(async () => {
  ({ db, close } = await migratedTestDb());
  await addStaff(db, "test-rep-a", { department: "sales" });
  await addStaff(db, "test-ops-a", { department: "operations" });
  await db.query("insert into mirror.monday_workspaces (id, name) values (1, 'Test workspace')");
  await db.query(`insert into mirror.monday_boards (id, workspace_id, name, board_key, purpose, sync_enabled)
                  values (10, 1, 'Test sales', 'homes_sales_wa', 'sales', true), (20, 1, 'Test handed over', 'homes_handed_over_wa', 'handed_over', true)`);
  await db.query(`insert into mirror.monday_boards (id, workspace_id, name, type, parent_board_id, sync_enabled)
                  values (11, 1, 'Subitems', 'sub_items_board', 10, true)`);
  await db.query(`insert into mirror.monday_field_map (board_id, field_key, column_id) values
                  (10, 'job_number', 'text4'), (10, 'sales_rep', 'text_r'), (20, 'sales_rep', 'text_r'), (11, 'milestone_status', 'status')`);
  const values = JSON.stringify({ text4: { type: "text", text: "12345", value: null }, text_r: { type: "text", text: "TEST REP A", value: null } });
  await db.query(`insert into mirror.monday_items (id, board_id, name, monday_updated_at, column_values) values
                  (1001, 10, 'Test Client A', now(), $1::jsonb), (1501, 20, 'Test Client Old', now(), $1::jsonb)`, [values]);
  await db.query(`insert into mirror.monday_items (id, board_id, parent_item_id, name, monday_updated_at, column_values)
                  values (2001, 11, 1001, 'Builder Acceptance', now(), '{"status": {"type": "status", "text": "Done", "label": "Done", "value": null}}'::jsonb)`);
  await db.query("insert into launchpad.staff_aliases (alias, staff_id) values ('test rep a', 'test-rep-a')");
  await db.query(`insert into mirror.monday_assets (id, item_id, column_id, name, storage_path) values
                  (9001, 2001, 'files', 'plan.pdf', '10/2001/9001/plan.pdf'), (9002, 1001, null, 'waiting.pdf', null)`);
  const [lot] = await db.query<{ id: string }>("insert into launchpad.land_lots (lot_label, source, land_price) values ('Lot 1 Test Street', 'launchpad', 364000) returning id");
  await db.query("select launchpad.place_hold($1::uuid, 'test-rep-a', 'Test Client A')", [lot.id]);
});
after(async () => close());

test("live data: jobs, lots and reps from the database", async () => {
  const data = await loadLiveData(db, () => new Date("2026-10-08T00:00:00Z"));
  assert.ok(data && data.status === "ok");
  assert.equal(data.asOf, "2026-10-08T00:00:00.000Z");
  assert.deepEqual(data.jobs.map((j) => [j.id, j.jobNo, j.rep]), [[1001, "12345", "Test Rep A"]], "handed-over jobs stay out");
  assert.deepEqual(data.jobs[0].precon.map((m) => [m.name, m.status]), [["Builder Acceptance", "pendingDate"]]);
  assert.equal(data.lots.length, 1);
  assert.equal(data.lots[0].landPrice, 364000);
  assert.deepEqual(data.lots[0].holds.map((h) => [h.staffId, h.client]), [["test-rep-a", "Test Client A"]]);
  assert.deepEqual(data.reps, [{ id: "test-rep-a", name: "Test Rep A" }], "only Sales staff are reps");
});

test("live data: no database, no live data", async () => {
  assert.equal(await loadLiveData(null), null);
});

test("live data: a database that can't be read gives an error the screens can show (Review Focus 4)", async () => {
  const broken: Db = {
    query: async () => {
      throw new Error("connect ECONNREFUSED");
    },
    transaction: async () => {
      throw new Error("connect ECONNREFUSED");
    },
  };
  const original = console.error;
  console.error = () => {};
  try {
    const data = await loadLiveData(broken);
    assert.ok(data && data.status === "error");
    assert.match(data.message, /sample data/);
  } finally {
    console.error = original;
  }
});

test("files: the job's own files first, then each milestone's, ready or still copying", async () => {
  const files = await loadItemFiles(db, 1001);
  assert.deepEqual(files.map((f) => [f.assetId, f.ready, f.milestone]), [
    [9002, false, null],
    [9001, true, "Builder Acceptance"],
  ]);
  assert.equal(parseAssetId("9001"), 9001);
  assert.equal(parseAssetId("9001; drop table"), null);
  assert.equal(parseAssetId("-1"), null);
});

test("live data: a rep spelt Monday's way resolves once setup has stored the alias", async () => {
  // Curly apostrophe, double space, trailing full stop: matchReps (Task 11) matches it
  // loosely and stores the exact key loadJobs looks up.
  await addStaff(db, "test-rep-b", { name: "Test O'Rep", department: "sales" });
  const values = JSON.stringify({ text_r: { type: "text", text: " Test  O’Rep. ", value: null } });
  await db.query(
    "insert into mirror.monday_items (id, board_id, name, monday_updated_at, column_values) values (1002, 10, 'Test Client B', now(), $1::jsonb)",
    [values],
  );
  assert.deepEqual(await matchReps(db), { matched: 2, unmatched: [] });
  const data = await loadLiveData(db, () => new Date("2026-10-08T00:00:00Z"));
  assert.ok(data && data.status === "ok");
  assert.equal(data.jobs.find((j) => j.id === 1002)?.rep, "Test O'Rep");
});
```

- [ ] **Step 7: Run it to verify it fails**

Run: `node --import tsx --test src/server/read/live-data.test.ts`
Expected: FAIL, `Cannot find module './files'`.

- [ ] **Step 8: Write the loaders**

Create `src/server/read/jobs.ts`:

```ts
import type { Job } from "@/data/jobs";
import type { Db } from "../db/types";
import { toJob, type JobRow, type MilestoneRow } from "./to-job";

/**
 * Live jobs for My clients, All clients and the Operations job list: the sales
 * and construction boards. Handed-over jobs stay in the mirror but out of the
 * screens, which keeps the page payload small.
 */
export async function loadJobs(db: Db): Promise<Job[]> {
  const rows = await db.query<JobRow>(
    `select j.item_id, j.purpose, j.job_number, j.deal_name, j.site_address, j.site_suburb, j.site_state,
            j.builder, j.buyer_type, j.block_titled, j.title_due_date::text as title_due_date,
            j.sale_won_date::text as sale_won_date, j.construction_stage, j.hubspot_deal_id, j.updated_at,
            coalesce(s.name, nullif(btrim(j.sales_rep), '')) as rep
     from launchpad.monday_jobs j
     left join launchpad.staff_aliases a on a.alias = lower(btrim(j.sales_rep))
     left join launchpad.staff s on s.id = a.staff_id
     where j.purpose in ('sales', 'construction')
     order by j.sale_won_date desc nulls last, j.item_id desc`,
  );
  if (rows.length === 0) return [];
  const milestones = await db.query<MilestoneRow>(
    `select m.job_item_id, m.name, m.status_label, m.due_date::text as due_date,
            m.date_completed::text as date_completed, m.monday_created_at
     from launchpad.monday_job_milestones m
     join launchpad.monday_jobs j on j.item_id = m.job_item_id and j.purpose in ('sales', 'construction')`,
  );
  const byJob = new Map<number, MilestoneRow[]>();
  for (const m of milestones) {
    const list = byJob.get(m.job_item_id) ?? [];
    list.push(m);
    byJob.set(m.job_item_id, list);
  }
  return rows.map((r) => toJob(r, byJob.get(r.item_id) ?? []));
}
```

Create `src/server/read/lots.ts`:

```ts
import type { LiveHold, LiveLot } from "@/data/live/types";
import type { Db } from "../db/types";

interface LotRow {
  id: string;
  lot_label: string;
  estate: string | null;
  developer: string | null;
  builder: string | null;
  land_price: number | null;
  package_price: number | null;
  package_design: string | null;
  area_sqm: number | null;
  frontage_m: number | null;
  zoning: string | null;
  title_status: LiveLot["titleStatus"];
  title_eta: string | null;
  rebate_note: string | null;
  sale_status: "available" | "sold";
  sold_by_name: string | null;
  sold_client: string | null;
  monday_item_id: number | null;
  removed: boolean;
  holds: LiveHold[];
}

/** Exclusive Land's lots and open holds. Settles lapsed holds first, so what's read is current. */
export async function loadLots(db: Db): Promise<LiveLot[]> {
  await db.query("select count(*) from launchpad.settle_land_holds()");
  const rows = await db.query<LotRow>(
    `select id::text as id, lot_label, estate, developer, builder,
            land_price::float8 as land_price, package_price::float8 as package_price, package_design,
            area_sqm::float8 as area_sqm, frontage_m::float8 as frontage_m, zoning, title_status,
            title_eta::text as title_eta, rebate_note, sale_status, sold_by_name, sold_client,
            monday_item_id, monday_removed_at is not null as removed, holds
     from launchpad.land_lot_board
     order by (sale_status = 'sold'), estate nulls last, lot_label`,
  );
  return rows.map((r) => ({
    id: r.id,
    lot: r.lot_label,
    estate: r.estate,
    developer: r.developer,
    builder: r.builder,
    landPrice: r.land_price,
    packagePrice: r.package_price,
    design: r.package_design,
    areaSqm: r.area_sqm,
    frontageM: r.frontage_m,
    zoning: r.zoning,
    titleStatus: r.title_status,
    titleEta: r.title_eta,
    rebate: r.rebate_note,
    saleStatus: r.sale_status,
    soldBy: r.sold_by_name,
    soldClient: r.sold_client,
    mondayItemId: r.monday_item_id,
    removedFromMonday: r.removed,
    holds: r.holds ?? [],
  }));
}
```

Create `src/server/read/reps.ts`:

```ts
import type { RepOption } from "@/data/live/types";
import type { Db } from "../db/types";

/** Everyone in Sales, for the "Viewing as" picker and as the people who hold lots. */
export async function loadReps(db: Db): Promise<RepOption[]> {
  return db.query<RepOption>(
    `select id, name from launchpad.staff
     where department_id = 'sales' and status = 'active' and not vacant
     order by name`,
  );
}
```

Create `src/server/read/files.ts`:

```ts
import type { LiveFile } from "@/data/live/types";
import type { Db } from "../db/types";

/** A Monday asset id from a URL segment, or null. */
export function parseAssetId(raw: string): number | null {
  return /^\d{1,15}$/.test(raw) ? Number(raw) : null;
}

/** The files on a job (or lot) and its milestones: the item's own first, then by milestone. */
export async function loadItemFiles(db: Db, itemId: number): Promise<LiveFile[]> {
  return db.query<LiveFile>(
    `select f.asset_id as "assetId", f.name, f.file_size::float8 as size,
            f.storage_path is not null as ready, s.name as milestone
     from launchpad.monday_job_files f
     left join mirror.monday_items s on s.id = f.subitem_id
     where f.item_id = $1
     order by s.name nulls first, f.name`,
    [itemId],
  );
}
```

Create `src/server/read/live-data.ts`:

```ts
import type { LiveData } from "@/data/live/types";
import { getDb } from "../db/postgres";
import type { Db } from "../db/types";
import { loadJobs } from "./jobs";
import { loadLots } from "./lots";
import { loadReps } from "./reps";

/**
 * Everything the live screens need, read once per page load by the dashboard
 * layout. Null with no database (the screens keep sample data). When the
 * database can't be read, an error the screens show, never a crash.
 */
export async function loadLiveData(db: Db | null = getDb(), now: () => Date = () => new Date()): Promise<LiveData | null> {
  if (!db) return null;
  try {
    const [jobs, lots, reps] = await Promise.all([loadJobs(db), loadLots(db), loadReps(db)]);
    return { status: "ok", asOf: now().toISOString(), jobs, lots, reps };
  } catch (e) {
    console.error("[live-data] couldn't read the database, showing sample data:", e);
    return { status: "error", message: "Live data is unavailable right now, so these screens show sample data." };
  }
}
```

- [ ] **Step 9: Run the tests to verify they pass**

Run: `node --import tsx --test src/server/read/live-data.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 10: Checkpoint**

Run: `npm test`, `npx tsc --noEmit` and `git status --short`. Expected new files: `src/data/live/types.ts`, the six files under `src/server/read/` with their two tests, `src/lib/perth-time.ts`, `src/components/modules/sales/land/live-lots.ts` and its test. Don't commit.

---

### Task 16: The live-data provider, the layout, and the shared pieces

**Files:**
- Create: `src/data/live/viewer.ts`, test `src/data/live/viewer.test.ts`
- Create: `src/state/live-data.tsx`
- Create: `src/components/ui/live-note.tsx`
- Create: `src/components/modules/sales/ViewingAs.tsx`
- Modify: `app/(dashboard)/layout.tsx`

**Interfaces:**
- Consumes: `LiveData`, `RepOption`, `perthClock` (Task 15), `loadLiveData`, `hasDatabase`, `useLaunchpad`, `SmoothSelect`.
- Produces:
  - `pickViewer(reps: RepOption[], asked: string | null): RepOption | null`.
  - `<LiveDataProvider data={LiveData | null}>`.
  - `useLiveState(): { kind: "off" } | { kind: "error"; message } | { kind: "live"; value: LiveValue }`.
  - `useLiveData(): LiveValue | null`, where `LiveValue = { asOf; jobs; lots; setLots; reps }`.
  - `useJobs(): { jobs: Job[]; live: boolean }`.
  - `useViewer(): { viewer: RepOption | null; reps: RepOption[]; setViewer(id) }`.
  - `<LiveNote readOnly? />` and `<ViewingAs />`.

- [ ] **Step 1: Write the failing test**

Create `src/data/live/viewer.test.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { pickViewer } from "./viewer";

const reps = [
  { id: "test-rep-a", name: "Test Rep A" },
  { id: "test-rep-b", name: "Test Rep B" },
];

test("viewer: the rep in ?as=, else the first rep, else nobody", () => {
  assert.equal(pickViewer(reps, "test-rep-b")?.id, "test-rep-b");
  assert.equal(pickViewer(reps, "not-a-rep")?.id, "test-rep-a");
  assert.equal(pickViewer(reps, null)?.id, "test-rep-a");
  assert.equal(pickViewer([], "test-rep-a"), null);
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node --import tsx --test src/data/live/viewer.test.ts`
Expected: FAIL, `Cannot find module './viewer'`.

- [ ] **Step 3: Write the viewer rule, the provider and the shared pieces**

Create `src/data/live/viewer.ts`:

```ts
import type { RepOption } from "./types";

/** Until sign-in exists: the rep named in ?as=, else the first Sales rep, else nobody. */
export function pickViewer(reps: RepOption[], asked: string | null): RepOption | null {
  return reps.find((r) => r.id === asked) ?? reps[0] ?? null;
}
```

Create `src/state/live-data.tsx`:

```tsx
"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { Job } from "@/data/jobs";
import type { LiveData, LiveLot, RepOption } from "@/data/live/types";
import { pickViewer } from "@/data/live/viewer";
import { useLaunchpad } from "./launchpad-store";

/**
 * Live data for the four screens wired to the database (Exclusive Land, My
 * clients, All clients, the Operations job list). It sits in the dashboard
 * layout beside the sample stores; every other module keeps reading those.
 */
interface LiveValue {
  asOf: string;
  jobs: Job[];
  lots: LiveLot[];
  setLots: (lots: LiveLot[]) => void;
  reps: RepOption[];
}

type LiveState = { kind: "off" } | { kind: "error"; message: string } | { kind: "live"; value: LiveValue };

const Ctx = React.createContext<LiveState>({ kind: "off" });

export function LiveDataProvider({ data, children }: { data: LiveData | null; children: React.ReactNode }) {
  const [lots, setLots] = React.useState<LiveLot[]>(data?.status === "ok" ? data.lots : []);
  // A fresh server render (a refresh) brings new lots; the hold actions bring them in between.
  React.useEffect(() => {
    if (data?.status === "ok") setLots(data.lots);
  }, [data]);

  const state = React.useMemo<LiveState>(() => {
    if (!data) return { kind: "off" };
    if (data.status === "error") return { kind: "error", message: data.message };
    return { kind: "live", value: { asOf: data.asOf, jobs: data.jobs, reps: data.reps, lots, setLots } };
  }, [data, lots]);

  return <Ctx.Provider value={state}>{children}</Ctx.Provider>;
}

export const useLiveState = (): LiveState => React.useContext(Ctx);

export function useLiveData(): LiveValue | null {
  const state = useLiveState();
  return state.kind === "live" ? state.value : null;
}

/** The live jobs when a database is connected, otherwise the store's sample jobs. */
export function useJobs(): { jobs: Job[]; live: boolean } {
  const live = useLiveData();
  const { jobs } = useLaunchpad();
  return live ? { jobs: live.jobs, live: true } : { jobs, live: false };
}

/** Who the live screens act for until sign-in exists, kept in the URL as ?as=<staff id>. */
export function useViewer(): { viewer: RepOption | null; reps: RepOption[]; setViewer: (id: string) => void } {
  const live = useLiveData();
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const reps = live?.reps ?? [];
  const viewer = pickViewer(reps, params.get("as"));
  const setViewer = React.useCallback(
    (id: string) => {
      const next = new URLSearchParams(params.toString());
      next.set("as", id);
      router.replace(`${pathname}?${next.toString()}`, { scroll: false });
    },
    [params, pathname, router],
  );
  return { viewer, reps, setViewer };
}
```

Create `src/components/ui/live-note.tsx`:

```tsx
"use client";

import { CloudOff, Radio } from "lucide-react";
import { perthClock } from "@/lib/perth-time";
import { useLiveState } from "@/state/live-data";

/**
 * Says where a live screen's data comes from: "Live from Monday · as of
 * 10:42am", plus "read only during the Dash Sync hold" where asked. Shows the
 * error when the database couldn't be read, and nothing with no database.
 */
export function LiveNote({ readOnly = false }: { readOnly?: boolean }) {
  const state = useLiveState();
  if (state.kind === "off") return null;
  if (state.kind === "error") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-amber-700 dark:text-amber-300">
        <CloudOff className="size-3.5 shrink-0" aria-hidden />
        {state.message}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-subtle-foreground">
      <Radio className="size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
      Live from Monday · as of {perthClock(state.value.asOf)}
      {readOnly ? " · read only during the Dash Sync hold" : ""}
    </span>
  );
}
```

Create `src/components/modules/sales/ViewingAs.tsx`:

```tsx
"use client";

import { SmoothSelect } from "@/components/ui/select";
import { useViewer } from "@/state/live-data";

/** Until sign-in exists, the live Sales screens act for the rep picked here (kept in the URL as ?as=). */
export function ViewingAs() {
  const { viewer, reps, setViewer } = useViewer();
  if (reps.length === 0) return null;
  return (
    <SmoothSelect
      value={viewer?.id ?? ""}
      onChange={setViewer}
      options={reps.map((r) => ({ value: r.id, label: r.name }))}
      leading="Viewing as"
      size="sm"
      align="end"
      ariaLabel="Viewing as"
    />
  );
}
```

- [ ] **Step 4: Wire the layout**

Replace the whole of `app/(dashboard)/layout.tsx` with:

```tsx
import { connection } from "next/server";
import { AppShell } from "@/components/shell/AppShell";
import { LaunchpadProvider } from "@/state/launchpad-store";
import { PortalProvider } from "@/state/portal-store";
import { TicketsProvider } from "@/state/tickets-store";
import { LiveDataProvider } from "@/state/live-data";
import { SalesStateProvider } from "@/components/modules/sales/sales-state";
import type { LiveData } from "@/data/live/types";
import { hasDatabase } from "@/server/env";
import { loadLiveData } from "@/server/read/live-data";

/**
 * Every Launchpad screen shares this layout. It stays mounted across
 * navigations, so the store (jobs, audit log, notifications) survives moving
 * between modules. The portals (Client, Developer) live here too, so what a
 * builder sends a client in one portal is waiting in the other. Tickets sit
 * inside the Launchpad store (a new ticket lands in the inbox) and around the
 * shell, so any dashboard's rail can raise one and Jarvis can read them.
 * Sales' deals, to-dos and lots live here as well, so the Sales Manager
 * dashboard and the Sales Representative portal show the same board.
 *
 * With a database configured (SUPABASE_DB_URL), the layout renders per request
 * and reads live data for Exclusive Land, My clients, All clients and the
 * Operations job list. Without one it stays static and nothing is read.
 */
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  let live: LiveData | null = null;
  if (hasDatabase()) {
    await connection();
    live = await loadLiveData();
  }
  return (
    <LaunchpadProvider>
      <PortalProvider>
        <TicketsProvider>
          <SalesStateProvider>
            <LiveDataProvider data={live}>
              <AppShell>{children}</AppShell>
            </LiveDataProvider>
          </SalesStateProvider>
        </TicketsProvider>
      </PortalProvider>
    </LaunchpadProvider>
  );
}
```

- [ ] **Step 5: Run the test and the build**

Run: `node --import tsx --test src/data/live/viewer.test.ts`
Expected: PASS, 1 test.

Run: `npx tsc --noEmit` then `npm run build` with no `.env.local`.
Expected: both pass, and the dashboard routes stay static (`○`) in the build output, as before.

- [ ] **Step 6: Checkpoint**

Run: `npm test` and `git status --short`. Expected new files: `src/data/live/viewer.ts` and its test, `src/state/live-data.tsx`, `src/components/ui/live-note.tsx`, `src/components/modules/sales/ViewingAs.tsx`; modified: `app/(dashboard)/layout.tsx`. Don't commit.

---

### Task 17: Monday documents: the download route, the file list and the job page's card

**Files:**
- Create: `app/api/files/monday/[assetId]/route.ts`
- Create: `src/server/actions/files.ts`
- Create: `src/components/ui/file-list.tsx`
- Create: `src/components/modules/operations/jobs/detail/LiveDocumentsCard.tsx`
- Modify: `src/server/read/files.ts` (adds `loadAssetPath`)
- Modify: `src/server/read/live-data.test.ts` (adds one test at the end)

**Interfaces:**
- Consumes: `parseAssetId`, `loadItemFiles` (Task 15), `supabaseFileStore`, `BUCKETS` (Task 13), `getDb`, `LiveFile`, `Reveal`, `Card*`.
- Produces:
  - `loadAssetPath(db, rawAssetId): Promise<{ path: string | null } | null>`: one asset's storage path (`null` path while it's still copying), or `null` when there's no such asset.
  - `GET /api/files/monday/<assetId>`: a 307 redirect to a 5-minute signed URL. Answers 404 for an unknown asset and 409 for one not yet copied.
  - `listItemFiles(itemId: number): Promise<LiveFile[]>` (a server action).
  - `<FileList files={LiveFile[]} empty={string} />`.
  - `<LiveDocumentsCard job={Job} />`.

Every piece here is a thin shell over Task 15's tested loader, so this task's check is the build plus the browser check in Task 22.

- [ ] **Step 1: Write the route and the action**

Create `app/api/files/monday/[assetId]/route.ts`:

```ts
import { NextResponse } from "next/server";
import { getDb } from "@/server/db/postgres";
import { loadAssetPath } from "@/server/read/files";
import { BUCKETS, supabaseFileStore } from "@/server/storage";

export const dynamic = "force-dynamic";

/**
 * Opens a mirrored Monday file through a signed URL that lasts 5 minutes.
 * There's no sign-in yet, so a deployment with real data must sit behind
 * Vercel Deployment Protection (spec section 7).
 */
export async function GET(_request: Request, { params }: { params: Promise<{ assetId: string }> }) {
  const { assetId } = await params;
  const db = getDb();
  const store = supabaseFileStore();
  if (!db || !store) return NextResponse.json({ error: "Files need a database and Storage" }, { status: 503 });
  const found = await loadAssetPath(db, assetId);
  if (found === null) return NextResponse.json({ error: "File not found" }, { status: 404 });
  if (!found.path) {
    return NextResponse.json({ error: "This file hasn't been copied from Monday yet. Try again in a few minutes." }, { status: 409 });
  }
  const url = await store.signedUrl(BUCKETS.mondayFiles, found.path, 300);
  return NextResponse.redirect(url, 307);
}
```

Add to `src/server/read/files.ts`, after `loadItemFiles`:

```ts
/** Where an asset's bytes are, or null when there's no such asset. `path` is null until it's copied. */
export async function loadAssetPath(db: Db, rawAssetId: string): Promise<{ path: string | null } | null> {
  const assetId = parseAssetId(rawAssetId);
  if (assetId === null) return null;
  const [row] = await db.query<{ path: string | null }>(
    "select storage_path as path from launchpad.monday_job_files where asset_id = $1",
    [assetId],
  );
  return row ?? null;
}
```

And add this test to the end of `src/server/read/live-data.test.ts` (it shares the database built in `before`):

```ts
test("files: a copied file has a path, a waiting one doesn't, an unknown one isn't found", async () => {
  const { loadAssetPath } = await import("./files");
  assert.deepEqual(await loadAssetPath(db, "9001"), { path: "10/2001/9001/plan.pdf" });
  assert.deepEqual(await loadAssetPath(db, "9002"), { path: null });
  assert.equal(await loadAssetPath(db, "4242"), null);
  assert.equal(await loadAssetPath(db, "../9001"), null);
});
```

Create `src/server/actions/files.ts`:

```ts
"use server";

import type { LiveFile } from "@/data/live/types";
import { getDb } from "@/server/db/postgres";
import { loadItemFiles } from "@/server/read/files";

/** The files on a Monday job or lot, for the job page and Exclusive Land's "Plans and files". */
export async function listItemFiles(itemId: number): Promise<LiveFile[]> {
  if (!Number.isSafeInteger(itemId) || itemId <= 0) return [];
  const db = getDb();
  if (!db) return [];
  return loadItemFiles(db, itemId);
}
```

- [ ] **Step 2: Write the file list and the card**

Create `src/components/ui/file-list.tsx`:

```tsx
"use client";

import { Download, FileText, Hourglass } from "lucide-react";
import type { LiveFile } from "@/data/live/types";
import { Reveal } from "@/components/ui/reveal";

const size = (n: number | null) =>
  n === null ? "" : n < 1024 ? `${n} B` : n < 1_048_576 ? `${Math.round(n / 1024)} KB` : `${(n / 1_048_576).toFixed(1)} MB`;

/** Files copied from Monday. A file still being copied says so instead of linking. */
export function FileList({ files, empty }: { files: LiveFile[]; empty: string }) {
  if (files.length === 0) return <p className="text-xs text-muted-foreground">{empty}</p>;
  return (
    <ul className="flex flex-col gap-1.5">
      {files.map((f, i) => (
        <Reveal
          as="li"
          key={f.assetId}
          index={i}
          className="flex items-center gap-2.5 rounded-lg border border-hairline bg-card px-3 py-2"
        >
          <FileText className="size-3.5 shrink-0 text-subtle-foreground" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs text-foreground">{f.name}</p>
            <p className="text-xs text-subtle-foreground">{[f.milestone, size(f.size)].filter(Boolean).join(" · ")}</p>
          </div>
          {f.ready ? (
            <a
              href={`/api/files/monday/${f.assetId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded-sm text-xs font-medium text-tone-ink underline-offset-2 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/45"
            >
              <Download className="size-3.5" aria-hidden /> Open
            </a>
          ) : (
            <span className="inline-flex items-center gap-1 text-xs text-subtle-foreground">
              <Hourglass className="size-3.5" aria-hidden /> Copying
            </span>
          )}
        </Reveal>
      ))}
    </ul>
  );
}
```

Check `src/components/ui/reveal.tsx` accepts `className` with `as="li"`, as `ExclusiveLand.tsx` uses it. If `className` isn't passed through, wrap the row's contents in a `div` with those classes inside the `Reveal`.

Create `src/components/modules/operations/jobs/detail/LiveDocumentsCard.tsx`:

```tsx
"use client";

import * as React from "react";
import { FolderOpen } from "lucide-react";
import type { Job } from "@/data/jobs";
import type { LiveFile } from "@/data/live/types";
import { listItemFiles } from "@/server/actions/files";
import { Card, CardContent, CardDescription, CardHeader, CardMeta, CardTitle } from "@/components/ui/card";
import { FileList } from "@/components/ui/file-list";

/** A live job's files as copied from Monday: the job's own and each milestone's. Read only during the hold. */
export function LiveDocumentsCard({ job }: { job: Job }) {
  const [files, setFiles] = React.useState<LiveFile[] | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    listItemFiles(job.id).then(
      (f) => !cancelled && setFiles(f),
      () => !cancelled && setFiles([]),
    );
    return () => {
      cancelled = true;
    };
  }, [job.id]);

  return (
    <Card>
      <CardHeader>
        <FolderOpen className="size-4 text-tone-ink" aria-hidden />
        <CardTitle>Documents</CardTitle>
        <CardMeta>{files === null ? "Loading" : `${files.length} from Monday`}</CardMeta>
        <CardDescription>
          Files on this job and its milestones in Monday, copied into Launchpad. Uploading here waits for the Dash
          Sync go-live.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {files === null ? (
          <p className="text-xs text-muted-foreground">Loading files…</p>
        ) : (
          <FileList files={files} empty="No files on this job in Monday." />
        )}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 3: Run the tests and the build**

Run: `node --import tsx --test src/server/read/live-data.test.ts`
Expected: PASS, 6 tests.

Run: `npx tsc --noEmit` then `npm run build` with no `.env.local`.
Expected: both pass.

- [ ] **Step 4: Checkpoint**

Run: `npm test` and `git status --short`. Expected new files: the route, `src/server/actions/files.ts`, `src/components/ui/file-list.tsx`, `LiveDocumentsCard.tsx`; modified: `src/server/read/files.ts`, `src/server/read/live-data.test.ts`. Don't commit.

---

### Task 18: Exclusive Land on live lots

**Files:**
- Create: `src/server/actions/land-rules.ts`, test `src/server/actions/land-rules.test.ts`
- Create: `src/server/actions/land.ts`
- Modify: `src/components/modules/sales/land/ExclusiveLand.tsx` (full replacement)

**Interfaces:**
- Consumes: `place_hold`, `release_hold`, `mark_lot_sold` (Task 6), `loadLots` (Task 15), `viewLot` (Task 15), `useLiveData`, `useViewer`, `ViewingAs`, `LiveNote`, `FileList`, `listItemFiles` (Tasks 16, 17).
- Produces:
  - `type LandActionResult = { ok: true; lots: LiveLot[] | null } | { ok: false; error: string; lots: LiveLot[] | null }`. On success, `lots` is null only when the reload after the action failed.
  - `checkHoldInput(input: { lotId?: string; holdId?: string; staffId: string; client?: string }): string | null`.
  - `landErrorMessage(e: unknown): string`.
  - Server actions: `placeHoldAction(lotId, staffId, client)`, `releaseHoldAction(holdId, staffId)`, `markLotSoldAction(holdId, staffId, client)`.

- [ ] **Step 1: Write the failing test**

Create `src/server/actions/land-rules.test.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { checkHoldInput, landErrorMessage } from "./land-rules";

const LOT = "11111111-1111-1111-1111-111111111111";

test("land rules: inputs are checked before the database is asked", () => {
  assert.equal(checkHoldInput({ lotId: LOT, staffId: "test-rep-a", client: "Test Client A" }), null);
  assert.match(checkHoldInput({ lotId: "lot-318", staffId: "test-rep-a" }) ?? "", /Reload/);
  assert.match(checkHoldInput({ lotId: LOT, staffId: "" }) ?? "", /viewing as/);
  assert.match(checkHoldInput({ holdId: "nope", staffId: "test-rep-a" }) ?? "", /Reload/);
  assert.match(checkHoldInput({ lotId: LOT, staffId: "test-rep-a", client: "x".repeat(121) }) ?? "", /120/);
});

test("land rules: the database's refusals read as sentences", () => {
  assert.match(landErrorMessage(new Error('land_lot_not_available')), /got there first/);
  assert.match(landErrorMessage(new Error("ERROR: land_hold_queue_full")), /queue is full/);
  assert.match(landErrorMessage(new Error("land_hold_not_active")), /lapsed/);
  const original = console.error;
  console.error = () => {};
  try {
    assert.match(landErrorMessage(new Error("connection reset")), /didn't go through/);
  } finally {
    console.error = original;
  }
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node --import tsx --test src/server/actions/land-rules.test.ts`
Expected: FAIL, `Cannot find module './land-rules'`.

- [ ] **Step 3: Write the rules and the actions**

Create `src/server/actions/land-rules.ts`:

```ts
import type { LiveLot } from "@/data/live/types";

/** What every Exclusive Land action returns: the fresh lots either way, so the screen redraws. */
/** The board after an action. `lots` is null when the reload failed: on success that still means the action went through. */
export type LandActionResult = { ok: true; lots: LiveLot[] | null } | { ok: false; error: string; lots: LiveLot[] | null };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const STAFF_ID = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/**
 * Checked before the database is asked. There's no sign-in yet, so the staff id
 * is whoever "Viewing as" names: the deployment must be protected (spec section 7).
 */
export function checkHoldInput(input: { lotId?: string; holdId?: string; staffId: string; client?: string }): string | null {
  if (input.lotId !== undefined && !UUID.test(input.lotId)) return "That lot isn't recognised. Reload the page.";
  if (input.holdId !== undefined && !UUID.test(input.holdId)) return "That hold isn't recognised. Reload the page.";
  if (!STAFF_ID.test(input.staffId)) return "Pick who you're viewing as first.";
  if ((input.client ?? "").length > 120) return "Keep the client's name under 120 characters.";
  return null;
}

const MESSAGES: Record<string, string> = {
  land_lot_not_found: "That lot has gone from the list. Reload the page.",
  land_lot_not_available: "Someone got there first: this lot isn't available any more.",
  land_hold_already_yours: "You already hold this lot, or you're in its queue.",
  land_hold_queue_full: "The hold queue is full: three reps are already on this lot.",
  land_hold_not_open: "That hold has already ended.",
  land_hold_not_yours: "Only the rep who placed the hold can do that.",
  land_hold_not_active: "Your hold has lapsed, so the lot can't be marked sold from it.",
};

export function landErrorMessage(e: unknown): string {
  const text = e instanceof Error ? e.message : String(e);
  for (const [code, message] of Object.entries(MESSAGES)) if (text.includes(code)) return message;
  console.error("[exclusive-land] unexpected error:", e);
  return "That didn't go through. Try again in a moment.";
}
```

Create `src/server/actions/land.ts`:

```ts
"use server";

import { getDb } from "@/server/db/postgres";
import { loadLots } from "@/server/read/lots";
import { checkHoldInput, landErrorMessage, type LandActionResult } from "./land-rules";

async function run(sql: string, params: unknown[]): Promise<LandActionResult> {
  const db = getDb();
  if (!db) return { ok: false, error: "Live data isn't connected.", lots: null };
  try {
    await db.query(sql, params);
  } catch (e) {
    return { ok: false, error: landErrorMessage(e), lots: await loadLots(db).catch(() => null) };
  }
  // The action went through: a reload that fails mustn't report it as failed.
  return { ok: true, lots: await loadLots(db).catch(() => null) };
}

/** Places a 24-hour hold, or joins the queue when the lot is already held. */
export async function placeHoldAction(lotId: string, staffId: string, client: string): Promise<LandActionResult> {
  const bad = checkHoldInput({ lotId, staffId, client });
  if (bad) return { ok: false, error: bad, lots: null };
  return run("select launchpad.place_hold($1::uuid, $2, $3)", [lotId, staffId, client.trim() || null]);
}

/** Releases the holder's hold, or takes a queued rep out of the queue. */
export async function releaseHoldAction(holdId: string, staffId: string): Promise<LandActionResult> {
  const bad = checkHoldInput({ holdId, staffId });
  if (bad) return { ok: false, error: bad, lots: null };
  return run("select launchpad.release_hold($1::uuid, $2)", [holdId, staffId]);
}

/** Deposit received: the holder marks the lot sold. */
export async function markLotSoldAction(holdId: string, staffId: string, client: string): Promise<LandActionResult> {
  const bad = checkHoldInput({ holdId, staffId, client });
  if (bad) return { ok: false, error: bad, lots: null };
  return run("select launchpad.mark_lot_sold($1::uuid, $2, $3)", [holdId, staffId, client.trim() || null]);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --import tsx --test src/server/actions/land-rules.test.ts`
Expected: PASS, 2 tests.

- [ ] **Step 5: Replace the Exclusive Land screen**

Back up the current file first (another session may have edits in it): copy `src/components/modules/sales/land/ExclusiveLand.tsx` to the scratchpad. Then replace the whole file with:

```tsx
"use client";

import * as React from "react";
import { toast } from "sonner";
import { Clock, ExternalLink, FolderOpen, HandCoins, Lock, Users } from "lucide-react";
import { useLaunchpad, confirm } from "@/state/launchpad-store";
import { useLiveData, useViewer } from "@/state/live-data";
import { useNow } from "@/hooks/useNow";
import { cn } from "@/lib/utils";
import type { LiveFile, LiveLot } from "@/data/live/types";
import { PageHeader } from "@/components/ui/page";
import { Card } from "@/components/ui/card";
import { Pill } from "@/components/ui/pill";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/input";
import { Reveal } from "@/components/ui/reveal";
import { NoMatches } from "@/components/ui/states";
import { SlidingTabs } from "@/components/ui/sliding-tabs";
import { LiveNote } from "@/components/ui/live-note";
import { FileList } from "@/components/ui/file-list";
import { listItemFiles } from "@/server/actions/files";
import { markLotSoldAction, placeHoldAction, releaseHoldAction } from "@/server/actions/land";
import type { LandActionResult } from "@/server/actions/land-rules";
import {
  CURRENT_REP,
  ESTATE_FILTERS,
  HOLD_QUEUE_MAX,
  lotMatchesEstate,
  type EstateFilter,
  type LandLot,
} from "../data";
import { useSalesState } from "../sales-state";
import { Footnote } from "../parts";
import { ViewingAs } from "../ViewingAs";
import { viewLot } from "./live-lots";

/** "11:42am" — the clock time a 24-hour hold placed now runs out tomorrow. */
function holdExpiry(): string {
  return new Date()
    .toLocaleTimeString("en-AU", { hour: "numeric", minute: "2-digit", hour12: true })
    .replace(/\s/g, "")
    .toLowerCase();
}

function ordinal(n: number): string {
  return n === 1 ? "1st" : n === 2 ? "2nd" : n === 3 ? "3rd" : `${n}th`;
}

/** "Any builder", or the builder the lot is packaged with. */
function builderLabel(builder: string): string {
  return builder === "Any builder" ? builder : `Builder: ${builder}`;
}

/**
 * Exclusive land, on the Sales Manager dashboard and in the Sales Representative
 * portal: lots land developers give Locale alone to sell. A rep can place a
 * 24-hour hold on an available lot, or join the queue (three holds per lot)
 * behind someone else's. The holder marks the lot sold once the client's
 * deposit is in; otherwise the hold lapses and the next rep in the queue has it.
 *
 * Lots come from the Exclusive Land board in Monday; holds, the queue and sold
 * status are Launchpad's (decided 8 Oct). With a database connected the lots
 * are live and every action goes through the database's hold rules; without
 * one, the sample lots work as before.
 */
export function ExclusiveLand() {
  const { lots: sampleLots, setLots: setSampleLots } = useSalesState();
  const live = useLiveData();
  const { viewer } = useViewer();
  const now = useNow(30_000);
  const { notify } = useLaunchpad();
  const [estate, setEstate] = React.useState<string>("All estates");
  const [holdLot, setHoldLot] = React.useState<LandLot | null>(null);
  const [holdOpen, setHoldOpen] = React.useState(false);
  const [soldLot, setSoldLot] = React.useState<LandLot | null>(null);
  const [soldOpen, setSoldOpen] = React.useState(false);
  const [filesLot, setFilesLot] = React.useState<LandLot | null>(null);
  const [files, setFiles] = React.useState<LiveFile[] | null>(null);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [client, setClient] = React.useState("");
  const clientId = React.useId();

  // Before mount, render at the time the data was read, so server and browser agree.
  const at = now ?? (live ? Date.parse(live.asOf) : 0);
  const lots: LandLot[] = live ? live.lots.map((l) => viewLot(l, viewer?.id ?? null, at)) : sampleLots;
  // Live lots bring their own estates; the sample lots keep the sample chips.
  const estates: string[] = live
    ? ["All estates", ...[...new Set(lots.map((l) => l.estate).filter(Boolean))].sort()]
    : [...ESTATE_FILTERS];
  const shown = lots.filter((l) =>
    live ? estate === "All estates" || l.estate === estate : lotMatchesEstate(l, estate as EstateFilter),
  );
  const liveLot = (id: string): LiveLot | undefined => live?.lots.find((l) => l.id === id);
  const myHold = (id: string) => liveLot(id)?.holds.find((h) => h.staffId === viewer?.id);

  const patch = (id: string, p: Partial<LandLot>) =>
    setSampleLots((prev) => prev.map((l) => (l.id === id ? { ...l, ...p } : l)));

  /** Runs a hold action against the database, redraws from what it returns, and gives back the lot as the viewer sees it. */
  const runLive = async (lotId: string, action: () => Promise<LandActionResult>): Promise<LandLot | null> => {
    if (!live) return null;
    setBusy(lotId);
    try {
      const r = await action();
      if (r.lots) live.setLots(r.lots);
      if (!r.ok) {
        toast.error(r.error);
        return null;
      }
      if (!r.lots) {
        toast.success("Done. The board catches up when you refresh.");
        return null;
      }
      const updated = r.lots.find((l) => l.id === lotId);
      return updated ? viewLot(updated, viewer?.id ?? null, Date.now()) : null;
    } catch {
      toast.error("That didn't go through. Check your connection and try again.");
      return null;
    } finally {
      setBusy(null);
    }
  };

  /**
   * Places a live hold for the viewer. The database starts it at once or queues it,
   * and the confirmation says which, with the lines given for each case.
   */
  const placeLive = async (lot: LandLot, who: string, lines: { started: (held: LandLot) => string; queued: string }) => {
    if (!viewer) return;
    const result = await runLive(lot.id, () => placeHoldAction(lot.id, viewer.id, who));
    if (result?.mine) {
      confirm(`24-hour hold placed · ${lot.lot}`, lines.started(result));
      notify(`24-hour hold placed on ${lot.lot}`);
    } else if (result?.queuedAt) {
      confirm(`Joined the hold queue · ${ordinal(result.queuedAt)} of ${HOLD_QUEUE_MAX}`, lines.queued);
    }
  };

  /** Runs an action on the viewer's own hold on a live lot. True when it went through. */
  const onMyHold = async (lot: LandLot, action: (holdId: string, staffId: string) => Promise<LandActionResult>) => {
    const hold = myHold(lot.id);
    if (!viewer || !hold) return false;
    return (await runLive(lot.id, () => action(hold.id, viewer.id))) !== null;
  };

  const noViewer = () => {
    if (live && !viewer) {
      toast.error("Pick who you're viewing as first.");
      return true;
    }
    return false;
  };

  const startHold = (lot: LandLot) => {
    if (noViewer()) return;
    setHoldLot(lot);
    setClient("");
    setHoldOpen(true);
  };

  const placeHold = async () => {
    if (!holdLot) return;
    const lot = holdLot;
    const who = client.trim();
    setHoldOpen(false);
    if (live) {
      await placeLive(lot, who, {
        started: (held) => (held.expires ? `Every rep sees it now. ${held.expires}.` : "Every rep sees it now."),
        queued: `${lot.lot}. Someone held it just before you. You're told the moment their hold ends.`,
      });
      return;
    }
    const expires = holdExpiry();
    patch(lot.id, {
      status: "hold",
      holder: who ? `${CURRENT_REP} for ${who}` : CURRENT_REP,
      expires: `Hold expires ${expires} tomorrow`,
      queue: 1,
      mine: true,
    });
    confirm(`24-hour hold placed · ${lot.lot}`, `Every rep sees it now. Expires ${expires} tomorrow.`);
    notify(`24-hour hold placed on ${lot.lot}`);
  };

  const startSold = (lot: LandLot) => {
    setSoldLot(lot);
    setSoldOpen(true);
  };

  const markSold = async () => {
    if (!soldLot) return;
    const lot = soldLot;
    const queued = (lot.queue ?? 1) > 1;
    setSoldOpen(false);
    if (live) {
      if (!(await onMyHold(lot, (holdId, staffId) => markLotSoldAction(holdId, staffId, "")))) return;
    } else {
      patch(lot.id, { status: "sold", expires: undefined, queue: undefined, queuedAt: undefined });
    }
    confirm(
      `Sold · ${lot.lot}`,
      queued ? "Deposit received. The reps in the hold queue are told it's gone." : "Deposit received. It's off the available list for every rep.",
    );
    notify(`${lot.lot} sold · deposit received`);
  };

  const releaseHold = async (lot: LandLot) => {
    if (live) {
      if (!(await onMyHold(lot, releaseHoldAction))) return;
    } else {
      patch(lot.id, { status: "available", holder: undefined, expires: undefined, queue: undefined, mine: false });
    }
    confirm(`Hold released · ${lot.lot}`, "The next rep in the queue has it now, or it's available again.");
  };

  const joinQueue = async (lot: LandLot) => {
    if (live) {
      if (noViewer()) return;
      await placeLive(lot, "", {
        started: () => "The hold ahead of yours had ended, so the lot is yours for 24 hours.",
        queued: `${lot.lot}. You're told the moment ${lot.holder}'s hold ends.`,
      });
      return;
    }
    const place = (lot.queue ?? 1) + 1;
    patch(lot.id, { queue: place, queuedAt: place });
    confirm(
      `Joined the hold queue · ${ordinal(place)} of ${HOLD_QUEUE_MAX}`,
      `${lot.lot}. You're told the moment ${lot.holder}'s hold ends.`,
    );
  };

  const leaveQueue = async (lot: LandLot) => {
    if (live) {
      if (!(await onMyHold(lot, releaseHoldAction))) return;
    } else {
      patch(lot.id, { queue: Math.max(1, (lot.queue ?? 2) - 1), queuedAt: undefined });
    }
    confirm(`Left the hold queue · ${lot.lot}`);
  };

  const openFiles = async (lot: LandLot) => {
    const itemId = liveLot(lot.id)?.mondayItemId;
    if (!live || !itemId) {
      confirm(`Plans and files · ${lot.lot}`, "They come from the Exclusive Land board in Monday once live data is connected.");
      return;
    }
    setFilesLot(lot);
    setFiles(null);
    setFiles(await listItemFiles(itemId).catch(() => []));
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Exclusive land"
        description="Lots land developers have given Locale alone to sell. Place a 24-hour hold to lock one in for your client, and up to three holds queue per lot."
        actions={
          <>
            <LiveNote />
            {live ? (
              <ViewingAs />
            ) : (
              <span className="text-xs text-subtle-foreground">Lots from the Exclusive Land board in Monday. Holds are kept in Launchpad.</span>
            )}
          </>
        }
      />

      <div className="flex flex-col gap-3">
        <SlidingTabs
          ariaLabel="Filter by estate"
          value={estate}
          onChange={setEstate}
          items={estates.map((e) => ({ value: e, label: e }))}
          className="self-start"
        />

        {shown.length === 0 ? (
          <Card>
            <NoMatches query={estate} onClear={() => setEstate("All estates")} />
          </Card>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {shown.map((lot, i) => (
              <Reveal as="li" key={`${estate}:${lot.id}`} index={i}>
                <LotCard
                  lot={lot}
                  busy={busy === lot.id}
                  onHold={() => startHold(lot)}
                  onSold={() => startSold(lot)}
                  onRelease={() => void releaseHold(lot)}
                  onJoin={() => void joinQueue(lot)}
                  onLeave={() => void leaveQueue(lot)}
                  onFiles={() => void openFiles(lot)}
                />
              </Reveal>
            ))}
          </ul>
        )}

        <Footnote className="text-xs">
          Holds expire after 24 hours unless the client&apos;s deposit is in, and the next rep in the queue is told.
          Lots come from the Exclusive Land board in Monday; holds are kept here.
        </Footnote>
      </div>

      <Dialog
        open={holdOpen}
        onClose={() => setHoldOpen(false)}
        icon={Lock}
        title="Place 24-hour hold"
        description={
          holdLot
            ? `${holdLot.lot} is locked to you for 24 hours. If no deposit comes in, the hold expires and the next rep in the queue is told.`
            : undefined
        }
        footer={
          <>
            <Button variant="outline" onClick={() => setHoldOpen(false)}>
              Cancel
            </Button>
            <Button variant="brand" onClick={() => void placeHold()}>
              <Lock aria-hidden /> Place hold
            </Button>
          </>
        }
      >
        {holdLot ? (
          <div className="flex flex-col gap-3">
            <LotSummary lot={holdLot} />
            <Field label="For client" htmlFor={clientId} hint="Optional. Every rep sees it on the hold.">
              <Input
                id={clientId}
                value={client}
                onChange={(e) => setClient(e.target.value)}
                placeholder="e.g. W. and K. Tan"
                autoComplete="off"
                maxLength={120}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void placeHold();
                }}
              />
            </Field>
          </div>
        ) : null}
      </Dialog>

      <Dialog
        open={soldOpen}
        onClose={() => setSoldOpen(false)}
        icon={HandCoins}
        title="Mark as sold"
        description={
          soldLot
            ? `Only once the client's deposit is in. ${soldLot.lot} moves to Sold for every rep, and any holds queued behind yours end.`
            : undefined
        }
        footer={
          <>
            <Button variant="outline" onClick={() => setSoldOpen(false)}>
              Cancel
            </Button>
            <Button variant="brand" onClick={() => void markSold()}>
              <HandCoins aria-hidden /> Deposit received
            </Button>
          </>
        }
      >
        {soldLot ? <LotSummary lot={soldLot} holder /> : null}
      </Dialog>

      <Dialog
        open={filesLot !== null}
        onClose={() => setFilesLot(null)}
        icon={FolderOpen}
        title="Plans and files"
        description={filesLot?.lot}
        footer={
          <Button variant="outline" onClick={() => setFilesLot(null)}>
            Close
          </Button>
        }
      >
        {files === null ? (
          <p className="text-xs text-muted-foreground">Loading files…</p>
        ) : (
          <FileList files={files} empty="No plans or files on this lot in Monday yet." />
        )}
      </Dialog>
    </div>
  );
}

/** The lot at the top of a dialog: address, estate, builder and price, and who holds it when asked. */
function LotSummary({ lot, holder = false }: { lot: LandLot; holder?: boolean }) {
  return (
    <div className="rounded-lg border border-border bg-canvas px-3 py-2.5">
      <p className="text-[13px] font-semibold">{lot.lot}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">
        {lot.estate} · {builderLabel(lot.builder)}
      </p>
      <p className="mt-1 text-[13px] font-semibold text-foreground tabular-nums">{lot.price}</p>
      {holder && lot.holder ? <p className="mt-1 text-xs text-muted-foreground">Held by {lot.holder}</p> : null}
    </div>
  );
}

function LotCard({
  lot,
  busy,
  onHold,
  onSold,
  onRelease,
  onJoin,
  onLeave,
  onFiles,
}: {
  lot: LandLot;
  busy: boolean;
  onHold: () => void;
  onSold: () => void;
  onRelease: () => void;
  onJoin: () => void;
  onLeave: () => void;
  onFiles: () => void;
}) {
  const queue = lot.queue ?? 1;
  const queueFull = queue >= HOLD_QUEUE_MAX;
  return (
    <Card
      className={cn(
        "flex h-full flex-col px-4 py-3.5 transition-[transform,box-shadow] duration-200 ease-out hover:-translate-y-0.5 hover:shadow-md motion-reduce:transition-none motion-reduce:hover:translate-y-0",
        lot.status === "available" && "border-tone-line",
        lot.status === "sold" && "opacity-65",
      )}
    >
      <div className="flex items-baseline gap-2">
        <h2 className="text-[13px] font-semibold">{lot.lot}</h2>
        <span className="ml-auto">
          {lot.status === "available" ? (
            <Pill tone="ok">Available</Pill>
          ) : lot.status === "hold" ? (
            <Pill tone="pending">On hold</Pill>
          ) : (
            <Pill tone="neutral">Sold</Pill>
          )}
        </span>
      </div>
      <p className="mt-0.5 mb-2 text-xs text-muted-foreground">
        {lot.estate} · {builderLabel(lot.builder)}
      </p>
      <p className="text-[13px] font-semibold text-foreground tabular-nums">{lot.price}</p>
      <p className="my-0.5 text-xs text-muted-foreground tabular-nums">{lot.specs}</p>
      <p
        className={cn(
          "text-xs",
          lot.titled === "Titled" ? "text-emerald-700 dark:text-emerald-300" : "text-amber-700 dark:text-amber-300",
        )}
      >
        {lot.titled}
      </p>
      {lot.note ? (
        <p className="mt-2 rounded-md bg-muted px-2.5 py-1.5 text-xs text-foreground">
          {lot.note}
        </p>
      ) : null}
      {lot.status === "hold" ? (
        <p className="mt-2 flex items-center gap-1 text-xs text-amber-700 dark:text-amber-300">
          <Clock className="size-3 shrink-0" aria-hidden />
          {lot.holder} · {lot.expires}
        </p>
      ) : null}
      {lot.status === "hold" && lot.queuedAt ? (
        <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
          <Users className="size-3 shrink-0" aria-hidden />
          You&apos;re {ordinal(lot.queuedAt)} of {HOLD_QUEUE_MAX} in the hold queue
        </p>
      ) : null}
      {lot.status === "sold" && lot.holder ? <p className="mt-2 text-xs text-subtle-foreground">Sold by {lot.holder}</p> : null}

      <div className="mt-auto flex flex-wrap items-center gap-2 pt-3">
        {lot.status === "available" ? (
          <Button size="sm" disabled={busy} onClick={onHold}>
            Place 24-hour hold
          </Button>
        ) : null}
        {lot.status === "hold" && lot.mine ? (
          <>
            <Button size="sm" disabled={busy} onClick={onSold}>
              Deposit received
            </Button>
            <Button size="sm" variant="outline" disabled={busy} onClick={onRelease}>
              Release hold
            </Button>
          </>
        ) : null}
        {lot.status === "hold" && !lot.mine && !lot.queuedAt ? (
          <Button
            size="sm"
            variant="outline"
            className="border-foreground/70"
            disabled={queueFull || busy}
            onClick={onJoin}
          >
            {queueFull ? "Hold queue full" : `Join hold queue (${queue + 1} of ${HOLD_QUEUE_MAX})`}
          </Button>
        ) : null}
        {lot.status === "hold" && lot.queuedAt ? (
          <Button size="sm" variant="outline" disabled={busy} onClick={onLeave}>
            Leave queue
          </Button>
        ) : null}
        <Button size="sm" variant="ghost" className="text-tone-ink hover:text-foreground" onClick={onFiles}>
          Plans and files <ExternalLink className="size-3" aria-hidden />
        </Button>
      </div>
    </Card>
  );
}
```

If the scratchpad backup shows another session changed the file since this plan was written (compare it with the version this replacement was based on: the `git show HEAD:` copy), merge their change into the new file instead of dropping it.

- [ ] **Step 6: Build and check**

Run: `npx tsc --noEmit` then `npm run build` with no `.env.local`.
Expected: both pass.

Run: `npm run dev` with no `.env.local` and open `/sales?tab=land`.
Expected: the four sample lots, and a hold, queue, release and sell all work as before. The header reads "Lots from the Exclusive Land board in Monday. Holds are kept in Launchpad." and no toast says Monday was updated.

- [ ] **Step 7: Checkpoint**

Run: `npm test` and `git status --short`. Expected new files: `src/server/actions/land-rules.ts`, its test, `src/server/actions/land.ts`; modified: `ExclusiveLand.tsx`. Don't commit.

---

### Task 19: My clients, All clients and the Operations job list on live jobs

**Files:**
- Modify: `src/components/modules/sales/clients/MyClients.tsx`
- Modify: `src/components/modules/operations/jobs/CrmDashSync.tsx`
- Modify: `src/components/modules/operations/jobs/detail/JobDetailScreen.tsx`
- Modify: `src/components/modules/operations/sync/OperationsSyncProvider.tsx`
- Modify: `app/(dashboard)/operations/jobs/[id]/page.tsx`
- Test: `src/components/modules/sales/clients/group-by-rep.test.ts` (one added case)

**Interfaces:**
- Consumes: `useJobs`, `useViewer`, `LiveNote`, `ViewingAs`, `LiveDocumentsCard`, `groupByRep`.
- Produces: no new exports. While live data shows, every Operations write (`syncMilestone`, `syncDetails`, `handOver`, `resolveConflict`, `fileReview`, `releaseReview`, `dismissReview`) only shows a "Read only for now" toast, a live job's page has its edit cards disabled, and a link to a sample job still opens it.

Back up the four component files to the scratchpad before editing them.

- [ ] **Step 1: Write the pinning test**

Add to the end of `src/components/modules/sales/clients/group-by-rep.test.ts`:

```ts
test("groupByRep: live data, with no sample order, goes A to Z and keeps Unassigned last", () => {
  const job = (rep: string) => ({ rep }) as unknown as import("@/data/jobs").Job;
  const groups = groupByRep([job("Test Rep B"), job(""), job("Test Rep A"), job("Test Rep B")], []);
  assert.deepEqual(groups.map((g) => [g.rep, g.jobs.length]), [["Test Rep A", 1], ["Test Rep B", 2], [UNASSIGNED, 1]]);
});
```

- [ ] **Step 2: Run it**

Run: `node --import tsx --test src/components/modules/sales/clients/group-by-rep.test.ts`
Expected: PASS. `groupByRep` already handles an empty order; the test pins the behaviour live data now relies on. If it fails, fix `groupByRep` before going on.

- [ ] **Step 3: My clients and All clients**

In `src/components/modules/sales/clients/MyClients.tsx`, after the line `import { groupByRep } from "./group-by-rep";` add:

```tsx
import { useJobs, useViewer } from "@/state/live-data";
import { LiveNote } from "@/components/ui/live-note";
import { ViewingAs } from "../ViewingAs";
```

Replace:

```tsx
function RepClients({ rep }: { rep: string }) {
  const { jobs, openJob } = useLaunchpad();
  const mine = jobs.filter((j) => j.rep === rep);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="My clients" description="You only see clients assigned to you." />
```

with:

```tsx
function RepClients({ rep }: { rep: string }) {
  const { openJob } = useLaunchpad();
  const { jobs, live } = useJobs();
  const { viewer } = useViewer();
  // Live jobs name real reps, so they follow "Viewing as". The sample rep stays for the sample screens.
  const who = live ? (viewer?.name ?? "") : rep;
  const mine = jobs.filter((j) => j.rep === who);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="My clients"
        description="You only see clients assigned to you."
        actions={
          <>
            <LiveNote />
            {live ? <ViewingAs /> : null}
          </>
        }
      />
```

Replace:

```tsx
function TeamClients() {
  const { jobs, openJob } = useLaunchpad();
  const groups = groupByRep(jobs, REPS);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="All clients" description="Every rep's clients in preconstruction and construction." />
```

with:

```tsx
function TeamClients() {
  const { openJob } = useLaunchpad();
  const { jobs, live } = useJobs();
  // The sample reps lead the sample list; live reps go A to Z.
  const groups = groupByRep(jobs, live ? [] : REPS);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="All clients"
        description="Every rep's clients in preconstruction and construction."
        actions={<LiveNote />}
      />
```

- [ ] **Step 4: The Operations job list**

In `src/components/modules/operations/jobs/CrmDashSync.tsx`, replace `import { useLaunchpad } from "@/state/launchpad-store";` with:

```tsx
import { useJobs } from "@/state/live-data";
import { LiveNote } from "@/components/ui/live-note";
```

Replace `const { jobs } = useLaunchpad();` with `const { jobs, live } = useJobs();`.

Replace:

```tsx
        description="Every job, served from Launchpad. Edit here once and it goes to Monday and HubSpot."
```

with:

```tsx
        description={
          live
            ? "Every job on Monday's sales and construction boards. Read only while the Dash Sync go-live is on hold."
            : "Every job, served from Launchpad. Edit here once and it goes to Monday and HubSpot."
        }
```

Replace:

```tsx
          />
        }
      />

      <Reveal index={0} className="flex flex-col gap-2.5">
```

with:

```tsx
          />
        }
      />
      <LiveNote readOnly />

      <Reveal index={0} className="flex flex-col gap-2.5">
```

If `useLaunchpad` is still used elsewhere in the file, keep its import as well.

- [ ] **Step 5: The job page**

In `src/components/modules/operations/jobs/detail/JobDetailScreen.tsx`, add after `import { useLaunchpad } from "@/state/launchpad-store";`:

```tsx
import { useJobs } from "@/state/live-data";
import { LiveNote } from "@/components/ui/live-note";
import { LiveDocumentsCard } from "./LiveDocumentsCard";
```

In `JobDetailScreen`, replace:

```tsx
  const { jobs } = useLaunchpad();
  const job = jobs.find((j) => String(j.id) === id);
```

with:

```tsx
  const { jobs, live } = useJobs();
  const { jobs: sampleJobs } = useLaunchpad();
  const liveJob = jobs.find((j) => String(j.id) === id);
  // Screens still on sample data (Home, the portals) link to sample jobs: those still open.
  const job = liveJob ?? (live ? sampleJobs.find((j) => String(j.id) === id) : undefined);
```

and `return <JobDetail job={job} />;` with `return <JobDetail job={job} live={live && liveJob !== undefined} />;`.

Replace `function JobDetail({ job }: { job: Job }) {` with `function JobDetail({ job, live }: { job: Job; live: boolean }) {`.

Replace:

```tsx
            <>
              <SyncBadge sync={job.sync} className="text-[13px]" />
```

with:

```tsx
            <>
              {live ? <LiveNote readOnly /> : null}
              <SyncBadge sync={job.sync} className="text-[13px]" />
```

Switch editing off on a live job (spec section 8): the left column's cards are all edits, so they go in a disabled `fieldset`, which turns off every input, select and button inside it. Replace:

```tsx
        <div className="flex min-w-0 flex-col gap-5">
          <Reveal index={1}>
            <DealDetailsCard job={job} />
```

with:

```tsx
        {/* A live job is Monday's: no editing during the Dash Sync hold, as the note above says. */}
        <fieldset disabled={live} className="flex min-w-0 flex-col gap-5">
          <Reveal index={1}>
            <DealDetailsCard job={job} />
```

and replace:

```tsx
          ) : null}
        </div>

        <div className="flex min-w-0 flex-col gap-5">
          <Reveal index={2}>
            <DocumentsCard job={job} />
          </Reveal>
```

with:

```tsx
          ) : null}
        </fieldset>

        <div className="flex min-w-0 flex-col gap-5">
          <Reveal index={2}>
            {live ? <LiveDocumentsCard job={job} /> : <DocumentsCard job={job} />}
          </Reveal>
```

The Operations writes still go through the read-only guard in Step 6, which covers the dialogs and the list's quick actions.

- [ ] **Step 6: Make the Operations writes read only while live**

In `src/components/modules/operations/sync/OperationsSyncProvider.tsx`, add after `import { confirm, useLaunchpad } from "@/state/launchpad-store";`:

```tsx
import { useJobs } from "@/state/live-data";
```

Replace:

```tsx
  const { jobs, updateJob, logActivity, reviewItems, setReviewItems, later } = useLaunchpad();
```

with:

```tsx
  const { updateJob, logActivity, reviewItems, setReviewItems, later } = useLaunchpad();
  // Live jobs are Monday's own: nothing writes back while the Dash Sync go-live is held (Meeting3).
  const { jobs, live } = useJobs();
```

Replace the whole `const value = React.useMemo<OperationsSync>(...)` block with:

```tsx
  const value = React.useMemo<OperationsSync>(() => {
    const api: OperationsSync = {
      syncMilestone,
      syncDetails,
      handOver,
      resolveConflict,
      fileReview,
      releaseReview,
      dismissReview,
      trailForJob,
      viewTrail,
      syncing,
    };
    if (!live) return api;
    const readOnly = () =>
      toast.info("Read only for now", {
        description: "This is live Monday data. Nothing is written back to Monday or HubSpot while the Dash Sync go-live is on hold.",
      });
    return {
      ...api,
      syncMilestone: readOnly,
      syncDetails: readOnly,
      handOver: readOnly,
      resolveConflict: readOnly,
      fileReview: readOnly,
      releaseReview: readOnly,
      dismissReview: readOnly,
    };
  }, [
    syncMilestone,
    syncDetails,
    handOver,
    resolveConflict,
    fileReview,
    releaseReview,
    dismissReview,
    trailForJob,
    viewTrail,
    syncing,
    live,
  ]);
```

- [ ] **Step 7: Let a live job's page have a title**

In `app/(dashboard)/operations/jobs/[id]/page.tsx`, replace `if (!job) return { title: "Job not found" };` with:

```tsx
  // Live jobs (Monday item ids) aren't in the sample list; the page finds them in the live data.
  if (!job) return { title: "Job" };
```

- [ ] **Step 8: Build and check**

Run: `npm test`, `npx tsc --noEmit`, then `npm run build` with no `.env.local`.
Expected: all pass.

Run: `npm run dev` with no `.env.local`. Then open `/consultant?tab=clients`, `/sales?tab=clients` and `/operations?tab=jobs`, and one job page.
Expected: the sample data and behaviour unchanged, no "Live from Monday" note, and saving a milestone still runs the simulated sync.

- [ ] **Step 9: Checkpoint**

Run: `git status --short`. Expected modified: the five files above and `group-by-rep.test.ts`. Don't commit.

---

# Phase D: Hubstaff and HubSpot

### Task 20: Hubstaff hours

> **Cancelled (2026-10-09).** Kane: "we dont have hubstaff its hubspot". Steps 1 to 4 were built, then removed. Step 5 is never built. Only `src/server/mirror/limits.ts` stays, because Task 21 uses it; its code is in Step 3, item 0, below. The schema's Hubstaff tables stay, empty, until a later migration drops them. Task 22 schedules no Hubstaff run and asks for no Hubstaff credentials.

> **Changed in review, before build (2026-10-09).** Apply these on top of the code below. They give Hubstaff the same protections the Monday client got in review: a per-request timeout, retried network errors, and a run's time limit that a cron route passes in.
>
> 1. **Create `src/server/mirror/limits.ts`.** Task 21 shares it. The code is under Step 3, item 0, below.
> 2. **`createHubstaffClient` takes `timeoutMs?: number` and `deadline?: Date`.** `timeoutMs` defaults to 30 000. It must be a whole number from 1 to 2 147 483 647, checked when the client is made (throw a `RangeError` otherwise). In both `get` and the token exchange:
>    - call `checkDeadline(opts.deadline, now)` before each request;
>    - pass `signal: AbortSignal.timeout(attemptTimeoutMs(timeoutMs, opts.deadline, now))` to every `fetch`;
>    - in `get` only: a `fetch` that rejects (a timeout or a reset), or a 2xx body that can't be read as JSON, is retried like a 5xx within the same 5 attempts. After the last attempt, throw `HubstaffError("Hubstaff is unreachable: <reason>")`, keeping the original error as `cause`;
>    - call `checkWait(ms, opts.deadline, now, "the retry")` before every sleep.
>
>    The token exchange isn't retried, because a refused token is final, but it gets the timeout and the deadline check.
> 3. **`runHubstaffPass` handles the time limit.** When it catches a `RunDeadlineError`, it ends `partial` with the note "stopped at the run's time limit; the next run picks up from here", not `failed`. The watermark stays where it was: it is only set after both reads finish, as the code below already does.
> 4. **Tests to add to `hubstaff.test.ts`:**
>    - a client whose deadline has passed sends nothing and throws `RunDeadlineError`;
>    - a 429 whose `Retry-After` would end past the deadline throws `RunDeadlineError` without sleeping;
>    - a `fetch` that rejects once is retried, then succeeds;
>    - a pass whose client is past its deadline ends `partial` with the time-limit note, and leaves the watermark.
>
>    Step 4's expected count becomes 8 tests.
> 5. **The wiring.** Step 5 passes `deadline: opts.deadline` from `runSource` into `createHubstaffClient`.

**Files:**
- Create: `src/server/mirror/limits.ts` (shared with Task 21)
- Create: `src/server/mirror/hubstaff/client.ts`
- Create: `src/server/mirror/hubstaff/pass.ts`
- Test: `src/server/mirror/hubstaff/hubstaff.test.ts`
- Modify: `src/server/mirror/run-source.ts`, `scripts/mirror.ts`

**Interfaces:**
- Consumes: `Db`, `beginRun`, `endRun`, `getWatermark`, `setWatermark`, `PassResult` (type only, from `monday/passes.ts`).
- Produces:
  - `HUBSTAFF_API`, `HUBSTAFF_TOKEN_ENDPOINT`, and `HubstaffError` (with `status`).
  - `createHubstaffClient(opts: { token: string; db: Db; fetch?; sleep?; now?: () => number }): HubstaffClient`, where `HubstaffClient = { get<T>(path, params?): Promise<T>; readonly stats: { calls: number } }`.
  - `runHubstaffPass(db, hubstaff, orgId: string, mode: "daily" | "backfill", opts: { trigger; now? }): Promise<PassResult>`.
  - `runSource(..., "hubstaff", "daily" | "backfill", ...)` and `npm run mirror -- hubstaff [--backfill]`.

- [ ] **Step 1: Write the failing test**

Create `src/server/mirror/hubstaff/hubstaff.test.ts`:

```ts
import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { migratedTestDb } from "../../db/pglite";
import { addStaff } from "../../db/test-fixtures";
import type { Db } from "../../db/types";
import { HUBSTAFF_TOKEN_ENDPOINT, createHubstaffClient } from "./client";
import { runHubstaffPass } from "./pass";

let db: Db;
let close: () => Promise<void>;
before(async () => {
  ({ db, close } = await migratedTestDb());
  await addStaff(db, "test-rep-a", { email: "rep.a@example.com" });
});
after(async () => close());

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

const ORG_TOKEN = "hsoat_" + "t".repeat(20);

function fakeHubstaff() {
  const sent: { url: string; auth: string | null }[] = [];
  const fn = (async (url: string, init?: RequestInit) => {
    const headers = (init?.headers ?? {}) as Record<string, string>;
    sent.push({ url, auth: headers.Authorization ?? null });
    if (url === HUBSTAFF_TOKEN_ENDPOINT) return json({ access_token: "access-1", refresh_token: "refresh-2", expires_in: 86400 });
    if (url.includes("/members")) {
      return json({
        members: [{ user_id: 42, membership_status: "active" }],
        users: [{ id: 42, name: "Test Rep A", email: "REP.A@example.com" }],
        pagination: {},
      });
    }
    if (url.includes("/activities/daily/updates")) {
      return json({ daily_activities: [{ id: 2, date: "2026-10-07", user_id: 42, tracked: 3600, updated_at: "2026-10-07T10:00:00Z" }] });
    }
    if (url.includes("/activities/daily")) {
      return json({ daily_activities: [{ id: 1, date: "2026-10-06", user_id: 42, project_id: 5, tracked: 27000, updated_at: "2026-10-06T10:00:00Z" }] });
    }
    return json({ error: "not found" }, 404);
  }) as unknown as typeof fetch;
  return { fn, sent };
}

test("hubstaff: an organisation token is sent as it is, with no exchange", async () => {
  const f = fakeHubstaff();
  await createHubstaffClient({ token: ORG_TOKEN, db, fetch: f.fn }).get("/v2/organizations/7/members");
  assert.equal(f.sent.length, 1);
  assert.equal(f.sent[0].auth, `Bearer ${ORG_TOKEN}`);
});

test("hubstaff: a personal token is exchanged once, and the rotated refresh token is kept", async () => {
  const f = fakeHubstaff();
  const client = createHubstaffClient({ token: "test-personal-refresh-token", db, fetch: f.fn });
  await client.get("/v2/organizations/7/members");
  await client.get("/v2/organizations/7/members");
  assert.equal(f.sent.filter((s) => s.url === HUBSTAFF_TOKEN_ENDPOINT).length, 1);
  assert.equal(f.sent.at(-1)?.auth, "Bearer access-1");
  const [row] = await db.query<{ value: { refreshToken: string; seedHash: string } }>(
    "select value from mirror.integration_secrets where key = 'hubstaff.token_chain'",
  );
  assert.equal(row.value.refreshToken, "refresh-2");
  assert.doesNotMatch(JSON.stringify(row.value), /test-personal-refresh-token/, "the token itself isn't stored, only its hash");
});

test("hubstaff: the client only reads v2", async () => {
  await assert.rejects(createHubstaffClient({ token: ORG_TOKEN, db, fetch: fakeHubstaff().fn }).get("/v1/anything"), /v2/);
});

test("hubstaff: the first daily pass reads the last month and links staff by email; the next reads only updates", async () => {
  const f = fakeHubstaff();
  const client = createHubstaffClient({ token: ORG_TOKEN, db, fetch: f.fn });
  const first = await runHubstaffPass(db, client, "7", "daily", { trigger: "cli", now: () => new Date("2026-10-08T00:00:00Z") });
  assert.equal(first.status, "ok");
  assert.ok(f.sent.some((s) => s.url.includes("/activities/daily?")));
  const [staff] = await db.query<{ hubstaff_user_id: number }>("select hubstaff_user_id from launchpad.staff where id = 'test-rep-a'");
  assert.equal(staff.hubstaff_user_id, 42);

  const second = await runHubstaffPass(db, client, "7", "daily", { trigger: "cli", now: () => new Date("2026-10-08T06:00:00Z") });
  assert.equal(second.status, "ok");
  assert.ok(f.sent.some((s) => s.url.includes("/activities/daily/updates?")));
  const rows = await db.query<{ id: number }>("select id from mirror.hubstaff_daily_activities order by id");
  assert.deepEqual(rows.map((r) => r.id), [1, 2]);
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node --import tsx --test src/server/mirror/hubstaff/hubstaff.test.ts`
Expected: FAIL, `Cannot find module './client'`.

- [ ] **Step 3: Write the client and the pass**

0\. Create `src/server/mirror/limits.ts`. Task 21's HubSpot client uses it too. Monday's client keeps its own version of the same rules (Task 9).

```ts
/**
 * A run's time limit, for the Hubstaff and HubSpot clients. A cron route gives each run a deadline. The client then
 * starts no request and no wait past it, and caps each attempt's timeout by the time left, so the pass ends partial
 * before the host stops the function.
 */
export class RunDeadlineError extends Error {
  constructor(message = "The run's time limit was reached, so nothing more is sent.") {
    super(message);
    this.name = "RunDeadlineError";
  }
}

/** Throws once the deadline has passed. Call before every request. */
export function checkDeadline(deadline: Date | undefined, now: () => number): void {
  if (deadline && now() >= deadline.getTime()) throw new RunDeadlineError();
}

/** Throws instead of starting a wait that would end at or past the deadline. */
export function checkWait(ms: number, deadline: Date | undefined, now: () => number, what: string): void {
  if (deadline && now() + ms >= deadline.getTime()) {
    throw new RunDeadlineError(`The run's time limit was reached: waiting ${Math.ceil(ms / 1000)} s for ${what} would end past it.`);
  }
}

/** One attempt may take timeoutMs, or the time left before the deadline if that is less, but at least a second. */
export function attemptTimeoutMs(timeoutMs: number, deadline: Date | undefined, now: () => number): number {
  if (!deadline) return timeoutMs;
  return Math.min(timeoutMs, Math.max(1_000, Math.ceil(deadline.getTime() - now())));
}
```

Create `src/server/mirror/hubstaff/client.ts`:

```ts
import { createHash } from "node:crypto";
import type { Db } from "../../db/types";

/**
 * Hubstaff's REST API v2, read only. HUBSTAFF_TOKEN is either an organisation
 * access token (hsoat_...), sent as it is, or a personal access token: a
 * refresh token that is exchanged for a 24-hour access token. Hubstaff rotates
 * the refresh token on every exchange, so the newest one is kept in
 * mirror.integration_secrets, under a hash of the configured token. Changing
 * HUBSTAFF_TOKEN starts a fresh chain. The token itself is never stored.
 */
export const HUBSTAFF_API = "https://api.hubstaff.com";
export const HUBSTAFF_TOKEN_ENDPOINT = "https://account.hubstaff.com/access_tokens";
const CHAIN_KEY = "hubstaff.token_chain";
const EARLY_MS = 5 * 60_000;

export class HubstaffError extends Error {
  constructor(
    message: string,
    readonly status: number | null = null,
  ) {
    super(message);
    this.name = "HubstaffError";
  }
}

export interface HubstaffClient {
  get<T>(path: string, params?: Record<string, string>): Promise<T>;
  readonly stats: { calls: number };
}

interface Chain {
  seedHash: string;
  refreshToken: string;
  accessToken: string | null;
  expiresAt: number | null;
}

export function createHubstaffClient(opts: {
  token: string;
  db: Db;
  fetch?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
}): HubstaffClient {
  const fetchFn = opts.fetch ?? fetch;
  const sleep = opts.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const now = opts.now ?? Date.now;
  const stats = { calls: 0 };
  const organisationToken = opts.token.startsWith("hsoat_");
  const seedHash = createHash("sha256").update(opts.token).digest("hex");

  async function readChain(): Promise<Chain | null> {
    const [row] = await opts.db.query<{ value: Chain }>("select value from mirror.integration_secrets where key = $1", [CHAIN_KEY]);
    return row?.value && row.value.seedHash === seedHash ? row.value : null;
  }

  async function accessToken(): Promise<string> {
    if (organisationToken) return opts.token;
    const chain = await readChain();
    if (chain?.accessToken && chain.expiresAt && chain.expiresAt - EARLY_MS > now()) return chain.accessToken;
    const refresh = chain?.refreshToken ?? opts.token;
    stats.calls += 1;
    const res = await fetchFn(HUBSTAFF_TOKEN_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: refresh }),
    });
    if (!res.ok) {
      throw new HubstaffError(
        `Hubstaff refused the token (HTTP ${res.status}). Create a new one and update HUBSTAFF_TOKEN.`,
        res.status,
      );
    }
    const body = (await res.json()) as { access_token?: string; refresh_token?: string; expires_in?: number };
    if (!body.access_token) throw new HubstaffError("Hubstaff's token answer had no access_token");
    const next: Chain = {
      seedHash,
      refreshToken: body.refresh_token ?? refresh,
      accessToken: body.access_token,
      expiresAt: now() + (body.expires_in ?? 86_400) * 1000,
    };
    await opts.db.query(
      `insert into mirror.integration_secrets (key, value) values ($1, $2::jsonb)
       on conflict (key) do update set value = excluded.value`,
      [CHAIN_KEY, JSON.stringify(next)],
    );
    return body.access_token;
  }

  async function get<T>(path: string, params: Record<string, string> = {}): Promise<T> {
    if (!path.startsWith("/v2/")) throw new HubstaffError(`Refused: ${path} isn't a v2 read`);
    const token = await accessToken();
    const query = Object.keys(params).length > 0 ? `?${new URLSearchParams(params)}` : "";
    for (let attempt = 0; ; attempt++) {
      stats.calls += 1;
      const res = await fetchFn(`${HUBSTAFF_API}${path}${query}`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) return (await res.json()) as T;
      const retryable = res.status === 429 || res.status >= 500;
      if (!retryable || attempt >= 4) throw new HubstaffError(`Hubstaff answered HTTP ${res.status} for ${path}`, res.status);
      const after = Number(res.headers.get("retry-after"));
      await sleep(Number.isFinite(after) && after > 0 ? Math.min(60_000, after * 1000) : Math.min(60_000, 1000 * 2 ** attempt));
    }
  }

  return { get, stats };
}
```

Create `src/server/mirror/hubstaff/pass.ts`:

```ts
import type { Db } from "../../db/types";
import type { PassResult } from "../monday/passes";
import { beginRun, endRun, getWatermark, setWatermark, type Trigger } from "../runs";
import type { HubstaffClient } from "./client";

/**
 * Hubstaff into mirror.hubstaff_*: members (with their emails), and daily
 * activities. The first pass reads the last 31 days (backfill: 90); after that,
 * only what Hubstaff says changed since the last pass, less an hour. Staff are
 * linked to Hubstaff users by matching work email.
 */
export type HubstaffMode = "daily" | "backfill";

interface Paged {
  pagination?: { next_page_start_id?: number | null } | null;
}

interface MembersPage extends Paged {
  members?: { user_id: number; membership_status?: string | null }[];
  users?: { id: number; name?: string | null; email?: string | null }[];
}

interface RawDaily {
  id: number;
  date: string;
  user_id: number;
  project_id?: number | null;
  task_id?: number | null;
  tracked?: number | null;
  overall?: number | null;
  idle?: number | null;
  manual?: number | null;
  billable?: number | null;
  updated_at?: string | null;
}

interface DailyPage extends Paged {
  daily_activities?: RawDaily[];
}

const DAY_MS = 86_400_000;
const isoDay = (t: number) => new Date(t).toISOString().slice(0, 10);

async function eachPage<T extends Paged>(
  hubstaff: HubstaffClient,
  path: string,
  params: Record<string, string>,
  onPage: (page: T) => Promise<void>,
): Promise<void> {
  let start: number | null = null;
  for (let guard = 0; guard < 200; guard++) {
    const page: T = await hubstaff.get<T>(path, { ...params, page_limit: "500", ...(start ? { page_start_id: String(start) } : {}) });
    await onPage(page);
    start = page.pagination?.next_page_start_id ?? null;
    if (!start) break;
  }
}

async function upsertActivities(db: Db, orgId: number, rows: RawDaily[]): Promise<number> {
  if (rows.length === 0) return 0;
  const unique = [...new Map(rows.map((r) => [r.id, r])).values()];
  const out = await db.query<{ id: number }>(
    `insert into mirror.hubstaff_daily_activities as a (
       id, organization_id, user_id, project_id, task_id, date, tracked_seconds, overall_seconds,
       idle_seconds, manual_seconds, billable_seconds, hs_updated_at
     )
     select x.id, $1, x.user_id, x.project_id, x.task_id, x.date, coalesce(x.tracked, 0), x.overall,
            x.idle, x.manual, x.billable, x.updated_at
     from jsonb_to_recordset($2::jsonb) as x(
       id bigint, user_id bigint, project_id bigint, task_id bigint, date date, tracked integer,
       overall integer, idle integer, manual integer, billable integer, updated_at timestamptz)
     on conflict (id) do update set
       tracked_seconds = excluded.tracked_seconds, overall_seconds = excluded.overall_seconds,
       idle_seconds = excluded.idle_seconds, manual_seconds = excluded.manual_seconds,
       billable_seconds = excluded.billable_seconds, hs_updated_at = excluded.hs_updated_at, synced_at = now()
     where a.hs_updated_at is distinct from excluded.hs_updated_at
        or a.tracked_seconds is distinct from excluded.tracked_seconds
     returning a.id`,
    [orgId, JSON.stringify(unique)],
  );
  return out.length;
}

export async function runHubstaffPass(
  db: Db,
  hubstaff: HubstaffClient,
  orgId: string,
  mode: HubstaffMode,
  opts: { trigger: Trigger; now?: () => Date },
): Promise<PassResult> {
  const run = await beginRun(db, "hubstaff", mode, opts.trigger, 1800);
  if (!run) return { status: "skipped", calls: 0, seen: 0, changed: 0, note: "another Hubstaff pass is running", error: null };

  const startedAt = (opts.now ?? (() => new Date()))();
  const callsBefore = hubstaff.stats.calls;
  let seen = 0;
  let changed = 0;
  let status: PassResult["status"] = "ok";
  let error: string | null = null;
  let before: Date | null = null;
  let after: Date | null = null;

  try {
    const org = Number(orgId);
    if (!Number.isSafeInteger(org) || org <= 0) throw new Error("HUBSTAFF_ORG_ID must be the organisation's number");

    await eachPage<MembersPage>(hubstaff, `/v2/organizations/${org}/members`, { include: "users" }, async (page) => {
      const users = new Map((page.users ?? []).map((u) => [u.id, u]));
      const rows = (page.members ?? []).map((m) => ({
        user_id: m.user_id,
        name: users.get(m.user_id)?.name ?? null,
        email: users.get(m.user_id)?.email ?? null,
        membership_status: m.membership_status ?? null,
      }));
      seen += rows.length;
      if (rows.length === 0) return;
      await db.query(
        `insert into mirror.hubstaff_members as m (user_id, organization_id, name, email, membership_status)
         select x.user_id, $1, x.name, x.email, x.membership_status
         from jsonb_to_recordset($2::jsonb) as x(user_id bigint, name text, email text, membership_status text)
         on conflict (user_id) do update set
           name = excluded.name, email = excluded.email, membership_status = excluded.membership_status, synced_at = now()`,
        [org, JSON.stringify(rows)],
      );
    });

    const store = async (page: DailyPage) => {
      const rows = page.daily_activities ?? [];
      seen += rows.length;
      changed += await upsertActivities(db, org, rows);
    };
    before = await getWatermark(db, "hubstaff", "account");
    const t = startedAt.getTime();
    // The updates endpoint only reaches back a month.
    if (mode === "daily" && before && t - before.getTime() < 30 * DAY_MS) {
      await eachPage<DailyPage>(
        hubstaff,
        `/v2/organizations/${org}/activities/daily/updates`,
        { "updated[start]": new Date(before.getTime() - 3_600_000).toISOString() },
        store,
      );
    } else {
      const days = mode === "backfill" ? 90 : 31;
      // At most 31 days a request, both ends inclusive.
      for (let end = t; end > t - days * DAY_MS; end -= 31 * DAY_MS) {
        const start = Math.max(t - days * DAY_MS, end - 30 * DAY_MS);
        await eachPage<DailyPage>(
          hubstaff,
          `/v2/organizations/${org}/activities/daily`,
          { "date[start]": isoDay(start), "date[stop]": isoDay(end) },
          store,
        );
      }
    }
    await setWatermark(db, "hubstaff", "account", startedAt);
    after = startedAt;

    await db.query(
      `update launchpad.staff s set hubstaff_user_id = m.user_id
       from mirror.hubstaff_members m
       where s.hubstaff_user_id is null and s.work_email is not null and m.email is not null
         and lower(s.work_email) = lower(m.email)
         and not exists (select 1 from launchpad.staff t where t.hubstaff_user_id = m.user_id)`,
    );
  } catch (e) {
    status = "failed";
    error = e instanceof Error ? e.message : String(e);
  } finally {
    await endRun(db, run, {
      status,
      calls: hubstaff.stats.calls - callsBefore,
      complexity: 0,
      seen,
      changed,
      note: null,
      error,
      watermarkBefore: before,
      watermarkAfter: after,
    });
  }
  return { status, calls: hubstaff.stats.calls - callsBefore, seen, changed, note: null, error };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --import tsx --test src/server/mirror/hubstaff/hubstaff.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 5: Add Hubstaff to the runner and the CLI**

In `src/server/mirror/run-source.ts`, add the imports:

```ts
import { createHubstaffClient } from "./hubstaff/client";
import { runHubstaffPass } from "./hubstaff/pass";
```

and insert before the final `return failed(\`unknown source "${source}"\`);`:

```ts
  if (source === "hubstaff") {
    if (mode !== "daily" && mode !== "backfill") return failed(`unknown Hubstaff mode "${mode}"`);
    if (!env.hubstaffToken || !env.hubstaffOrgId) return failed("HUBSTAFF_TOKEN and HUBSTAFF_ORG_ID must both be set");
    const hubstaff = createHubstaffClient({ token: env.hubstaffToken, db });
    return runHubstaffPass(db, hubstaff, env.hubstaffOrgId, mode, { trigger });
  }
```

In `scripts/mirror.ts`, add to the comment at the top:

```ts
 *   hubstaff [--backfill]       Hubstaff members and daily hours (backfill: the last 90 days)
```

and insert before `default:` in the `switch`:

```ts
      case "hubstaff": {
        const r = await runSource(db, env, "hubstaff", args.includes("--backfill") ? "backfill" : "daily", "cli");
        printResult(r);
        if (r.status === "failed") process.exitCode = 1;
        break;
      }
```

- [ ] **Step 6: Checkpoint**

Run: `npm test`, `npx tsc --noEmit` and `git status --short`. Expected new files: the two Hubstaff modules and their test; modified: `run-source.ts`, `scripts/mirror.ts`. Don't commit.

---

### Task 21: HubSpot deals, contacts, meetings and notes

> **Changed in review, before build (2026-10-09).** Apply these on top of the code below. They use `src/server/mirror/limits.ts` from Task 20 (`RunDeadlineError`, `checkDeadline`, `checkWait`, `attemptTimeoutMs`).
>
> 1. **`createHubSpotClient` takes `timeoutMs?: number` and `deadline?: Date`.** `timeoutMs` defaults to 30 000. It must be a whole number from 1 to 2 147 483 647, checked when the client is made. In `send`:
>    - call `checkDeadline(opts.deadline, now)` before each request;
>    - put the search pacing wait and every retry wait through `checkWait(..., "the search pace")` or `checkWait(..., "the retry")` before sleeping;
>    - give every `fetch` `signal: AbortSignal.timeout(attemptTimeoutMs(timeoutMs, opts.deadline, now))`;
>    - retry a `fetch` that rejects, or a 2xx body that can't be read as JSON, like a 5xx within the same 5 attempts. After the last attempt, throw `HubSpotError("HubSpot is unreachable: <reason>")`, keeping the original error as `cause`.
>
>    A 401 and the daily limit stay final, as below.
> 2. **`runHubSpotPass` handles the time limit.** When it catches a `RunDeadlineError`, it ends `partial` with the note "stopped at the run's time limit; the next run picks up from here", not `failed`. An object whose search didn't finish keeps its watermark, so the next run re-reads it. Each watermark is set only after its object's search, as the code below already does.
> 3. **Tests to add to `hubspot.test.ts`:**
>    - a client past its deadline sends nothing and throws `RunDeadlineError`;
>    - a 429 whose `Retry-After` would end past the deadline throws `RunDeadlineError` without sleeping;
>    - a `fetch` that rejects once is retried, then succeeds;
>    - a pass whose client reaches its deadline during the second object ends `partial`, with the first object's watermark moved and the second's unchanged.
>
>    Step 4's expected count becomes 8 tests.
> 4. **The wiring.** Step 5 passes `deadline: opts.deadline` from `runSource` into `createHubSpotClient`.

**Files:**
- Create: `src/server/mirror/hubspot/client.ts`
- Create: `src/server/mirror/hubspot/properties.ts`
- Create: `src/server/mirror/hubspot/pass.ts`
- Test: `src/server/mirror/hubspot/hubspot.test.ts`
- Modify: `src/server/mirror/run-source.ts`, `scripts/mirror.ts`

**Interfaces:**
- Consumes: `Db`, `beginRun`, `endRun`, `getWatermark`, `setWatermark`, `PassResult`.
- Produces:
  - `HUBSPOT_API`, `isAllowedHubSpotRequest(method: string, path: string): boolean`, and `HubSpotError` (with `status` and `policy`).
  - `createHubSpotClient(opts: { token: string; fetch?; sleep?; now?: () => number }): HubSpotClient`, where `HubSpotClient = { get<T>(path, params?); post<T>(path, body); readonly stats: { calls: number } }`.
  - `OBJECTS`, `MODIFIED`, `PROPERTIES`.
  - `runHubSpotPass(db, hubspot, portalId: string, opts: { trigger; now? }): Promise<PassResult>`.
  - `runSource(..., "hubspot", "changes", ...)` and `npm run mirror -- hubspot`.

- [ ] **Step 1: Write the failing test**

Create `src/server/mirror/hubspot/hubspot.test.ts`:

```ts
import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { migratedTestDb } from "../../db/pglite";
import type { Db } from "../../db/types";
import { createHubSpotClient, isAllowedHubSpotRequest } from "./client";
import { runHubSpotPass } from "./pass";

let db: Db;
let close: () => Promise<void>;
before(async () => ({ db, close } = await migratedTestDb()));
after(async () => close());

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const deal = (id: number, updated: string) => ({
  id: String(id),
  properties: { dealname: `Test deal ${id}`, hs_lastmodifieddate: updated },
  createdAt: "2026-09-01T00:00:00Z",
  updatedAt: updated,
  archived: false,
});

function fakeHubSpot(portal = 1234) {
  const sent: { method: string; path: string; body: { after?: string; filterGroups: { filters: { value: string }[] }[] } | null }[] = [];
  const fn = (async (url: string, init?: RequestInit) => {
    const u = new URL(url);
    const method = init?.method ?? "GET";
    sent.push({ method, path: u.pathname, body: init?.body ? JSON.parse(String(init.body)) : null });
    if (u.pathname === "/account-info/v3/details") return json({ portalId: portal });
    if (u.pathname === "/crm/v3/owners") {
      return json({
        results: u.searchParams.get("archived") === "true"
          ? []
          : [{ id: "77", email: "rep.a@example.com", firstName: "Test", lastName: "Rep A", userId: 7, teams: [], archived: false, updatedAt: "2026-10-01T00:00:00Z" }],
      });
    }
    if (u.pathname === "/crm/v3/pipelines/deals") {
      return json({ results: [{ id: "default", label: "Test pipeline", displayOrder: 0, archived: false, stages: [{ id: "s1", label: "Stage 1" }] }] });
    }
    if (u.pathname === "/crm/v3/objects/deals/search") {
      const n = sent.filter((s) => s.path === "/crm/v3/objects/deals/search").length;
      // The first page claims 9,800 results already: the pass must restart from the newest it saw.
      return n === 1
        ? json({ total: 9801, results: [deal(1001, "2026-10-07T01:00:00Z")], paging: { next: { after: "9800" } } })
        : json({ total: 1, results: [deal(1002, "2026-10-07T02:00:00Z")] });
    }
    if (u.pathname.endsWith("/search")) return json({ total: 0, results: [] });
    if (u.pathname === "/crm/v4/associations/deals/contacts/batch/read") {
      return json({ results: [{ from: { id: "1001" }, to: [{ toObjectId: 501 }] }] });
    }
    return json({ message: "not found" }, 404);
  }) as unknown as typeof fetch;
  return { fn, sent };
}

const noSleep = async () => {};

test("hubspot: only the reads the mirror makes are allowed", () => {
  assert.equal(isAllowedHubSpotRequest("GET", "/crm/v3/owners?limit=500"), true);
  assert.equal(isAllowedHubSpotRequest("POST", "/crm/v3/objects/deals/search"), true);
  assert.equal(isAllowedHubSpotRequest("POST", "/crm/v3/objects/deals"), false, "that creates a deal");
  assert.equal(isAllowedHubSpotRequest("PATCH", "/crm/v3/objects/deals/1"), false);
  assert.equal(isAllowedHubSpotRequest("DELETE", "/crm/v3/objects/contacts/1"), false);
  assert.equal(isAllowedHubSpotRequest("POST", "/crm/v4/associations/deals/contacts/batch/create"), false);
});

test("hubspot: the client refuses a write without sending it", async () => {
  const f = fakeHubSpot();
  const hubspot = createHubSpotClient({ token: "test-token", fetch: f.fn, sleep: noSleep });
  await assert.rejects(hubspot.post("/crm/v3/objects/deals", {}), /Refused/);
  assert.equal(f.sent.length, 0);
});

test("hubspot: a token for the wrong portal stops the pass before anything is read", async () => {
  const f = fakeHubSpot(9999);
  const r = await runHubSpotPass(db, createHubSpotClient({ token: "t", fetch: f.fn, sleep: noSleep }), "1234", { trigger: "cli" });
  assert.equal(r.status, "failed");
  assert.match(r.error ?? "", /9999/);
  assert.equal(f.sent.length, 1);
});

test("hubspot: owners, pipelines and changed objects land, past the 10,000 search cap", async () => {
  const f = fakeHubSpot();
  const r = await runHubSpotPass(db, createHubSpotClient({ token: "t", fetch: f.fn, sleep: noSleep }), "1234", { trigger: "cli" });
  assert.equal(r.status, "ok", r.error ?? "");

  const deals = await db.query<{ id: number; contacts: number[] | null }>(
    "select id, associations -> 'contacts' as contacts from mirror.hubspot_objects where object_type = 'deals' order by id",
  );
  assert.deepEqual(deals, [{ id: 1001, contacts: [501] }, { id: 1002, contacts: null }]);

  const searches = f.sent.filter((s) => s.path === "/crm/v3/objects/deals/search");
  assert.equal(searches.length, 2);
  assert.equal(searches[1].body?.after, undefined, "restarted without a cursor");
  assert.equal(searches[1].body?.filterGroups[0].filters[0].value, String(Date.parse("2026-10-07T01:00:00Z")));

  const [owner] = await db.query<{ email: string }>("select email from mirror.hubspot_owners where id = 77");
  assert.equal(owner.email, "rep.a@example.com");
  const [state] = await db.query<{ w: Date }>("select watermark as w from mirror.sync_state where scope = 'object:deals'");
  assert.equal(new Date(state.w).toISOString(), "2026-10-07T02:00:00.000Z");
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node --import tsx --test src/server/mirror/hubspot/hubspot.test.ts`
Expected: FAIL, `Cannot find module './client'`.

- [ ] **Step 3: Write the client, the property lists and the pass**

Create `src/server/mirror/hubspot/client.ts`:

```ts
/**
 * HubSpot's CRM API, read only. Every request is checked against an allowlist
 * of the reads the mirror makes, and nothing else is sent. Searches are paced
 * to stay under HubSpot's 5 a second, and rate limits are waited out, except
 * the daily one.
 */
export const HUBSPOT_API = "https://api.hubapi.com";

const ALLOWED: { method: "GET" | "POST"; path: RegExp }[] = [
  { method: "GET", path: /^\/account-info\/v3\/details$/ },
  { method: "GET", path: /^\/crm\/v3\/owners\/?$/ },
  { method: "GET", path: /^\/crm\/v3\/pipelines\/deals$/ },
  // Search is a POST, and still only a read.
  { method: "POST", path: /^\/crm\/v3\/objects\/(deals|contacts|meetings|notes)\/search$/ },
  { method: "POST", path: /^\/crm\/v4\/associations\/(deals|meetings)\/(contacts|deals)\/batch\/read$/ },
];

export function isAllowedHubSpotRequest(method: string, path: string): boolean {
  const bare = path.split("?")[0];
  return ALLOWED.some((a) => a.method === method && a.path.test(bare));
}

export class HubSpotError extends Error {
  constructor(
    message: string,
    readonly status: number | null = null,
    readonly policy: string | null = null,
  ) {
    super(message);
    this.name = "HubSpotError";
  }
}

export interface HubSpotClient {
  get<T>(path: string, params?: Record<string, string>): Promise<T>;
  post<T>(path: string, body: unknown): Promise<T>;
  readonly stats: { calls: number };
}

const SEARCH_GAP_MS = 250;

export function createHubSpotClient(opts: {
  token: string;
  fetch?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
}): HubSpotClient {
  const fetchFn = opts.fetch ?? fetch;
  const sleep = opts.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const now = opts.now ?? Date.now;
  const stats = { calls: 0 };
  let lastSearch = 0;

  async function send<T>(method: "GET" | "POST", path: string, body?: unknown): Promise<T> {
    if (!isAllowedHubSpotRequest(method, path)) {
      throw new HubSpotError(`Refused: ${method} ${path} isn't a read the mirror makes.`);
    }
    if (path.endsWith("/search")) {
      const wait = lastSearch + SEARCH_GAP_MS - now();
      if (wait > 0) await sleep(wait);
      lastSearch = now();
    }
    for (let attempt = 0; ; attempt++) {
      stats.calls += 1;
      const res = await fetchFn(`${HUBSPOT_API}${path}`, {
        method,
        headers: { Authorization: `Bearer ${opts.token}`, "Content-Type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      if (res.ok) return (await res.json()) as T;
      const err = (await res.json().catch(() => null)) as { message?: string; policyName?: string } | null;
      if (res.status === 401) throw new HubSpotError("HubSpot rejected the token (401): it may have been rotated or deactivated.", 401);
      if (res.status === 429 && err?.policyName === "DAILY") throw new HubSpotError("HubSpot's daily API limit is reached.", 429, "DAILY");
      const retryable = res.status === 429 || res.status >= 500;
      if (!retryable || attempt >= 4) throw new HubSpotError(`HubSpot answered HTTP ${res.status}: ${err?.message ?? ""}`.trim(), res.status);
      const after = Number(res.headers.get("retry-after"));
      await sleep(Number.isFinite(after) && after > 0 ? Math.min(30_000, after * 1000) : Math.min(30_000, 1000 * 2 ** attempt));
    }
  }

  return {
    get: <T>(path: string, params: Record<string, string> = {}) =>
      send<T>("GET", Object.keys(params).length > 0 ? `${path}?${new URLSearchParams(params)}` : path),
    post: <T>(path: string, body: unknown) => send<T>("POST", path, body),
    stats,
  };
}
```

Create `src/server/mirror/hubspot/properties.ts`:

```ts
/**
 * What the mirror reads from each HubSpot object. Property names are HubSpot's
 * internal names. A search body must stay under 3,000 characters, so the lists
 * are short; add to them as screens need more. Deals include Jerry's job fields
 * (builder, builder_job_no, ...), so his Dash Sync could later read them from here.
 */
export const OBJECTS = ["deals", "contacts", "meetings", "notes"] as const;
export type HubSpotObject = (typeof OBJECTS)[number];

/** The last-modified property each object's search filters and sorts on. */
export const MODIFIED: Record<HubSpotObject, string> = {
  deals: "hs_lastmodifieddate",
  contacts: "lastmodifieddate",
  meetings: "hs_lastmodifieddate",
  notes: "hs_lastmodifieddate",
};

export const PROPERTIES: Record<HubSpotObject, string[]> = {
  deals: [
    "dealname", "pipeline", "dealstage", "hubspot_owner_id", "amount", "closedate", "createdate",
    "hs_lastmodifieddate", "hs_priority", "hs_next_step", "builder", "builder_job_no", "street_address",
    "site_suburb", "site_state", "buyer_type", "block_titled_", "expected_title_date", "finance_type",
    "house_type", "developer", "broker", "land_price", "package_price", "total_updown",
  ],
  contacts: [
    "firstname", "lastname", "email", "phone", "mobilephone", "address", "city", "state", "zip",
    "hubspot_owner_id", "lifecyclestage", "hs_lead_status", "createdate", "lastmodifieddate",
  ],
  meetings: [
    "hs_meeting_title", "hs_meeting_start_time", "hs_meeting_end_time", "hs_meeting_outcome",
    "hs_timestamp", "hubspot_owner_id", "hs_createdate", "hs_lastmodifieddate",
  ],
  notes: ["hs_note_body", "hs_timestamp", "hubspot_owner_id", "hs_createdate", "hs_lastmodifieddate"],
};
```

Create `src/server/mirror/hubspot/pass.ts`:

```ts
import type { Db } from "../../db/types";
import type { PassResult } from "../monday/passes";
import { beginRun, endRun, getWatermark, setWatermark, type Trigger } from "../runs";
import type { HubSpotClient } from "./client";
import { MODIFIED, OBJECTS, PROPERTIES, type HubSpotObject } from "./properties";

/**
 * HubSpot into mirror.hubspot_*: the portal check, owners, deal pipelines,
 * then each object changed since its watermark (less 5 minutes), oldest first,
 * restarting from the newest seen before the search API's 10,000-result cap.
 * Changed deals get their contact associations.
 */
interface SearchResult {
  id: string;
  properties?: Record<string, string | null>;
  createdAt?: string | null;
  updatedAt?: string | null;
  archived?: boolean;
}

interface SearchPage {
  results?: SearchResult[];
  paging?: { next?: { after?: string } };
}

interface OwnersPage {
  results?: {
    id: string;
    email?: string | null;
    firstName?: string | null;
    lastName?: string | null;
    userId?: number | null;
    teams?: unknown[] | null;
    archived?: boolean;
    updatedAt?: string | null;
  }[];
  paging?: { next?: { after?: string } };
}

const OVERLAP_MS = 5 * 60_000;

async function upsertObjects(db: Db, type: HubSpotObject, results: SearchResult[]): Promise<number> {
  if (results.length === 0) return 0;
  const rows = [...new Map(results.map((r) => [r.id, r])).values()].map((r) => ({
    id: Number(r.id),
    properties: r.properties ?? {},
    archived: r.archived ?? false,
    created_at: r.createdAt ?? null,
    updated_at: r.updatedAt ?? null,
  }));
  const out = await db.query<{ id: number }>(
    `insert into mirror.hubspot_objects as o (object_type, id, properties, archived, hs_created_at, hs_updated_at)
     select $1, x.id, x.properties, x.archived, x.created_at, x.updated_at
     from jsonb_to_recordset($2::jsonb) as x(id bigint, properties jsonb, archived boolean, created_at timestamptz, updated_at timestamptz)
     on conflict (object_type, id) do update set
       properties = excluded.properties, archived = excluded.archived,
       hs_created_at = excluded.hs_created_at, hs_updated_at = excluded.hs_updated_at, synced_at = now()
     where o.hs_updated_at is distinct from excluded.hs_updated_at
     returning o.id`,
    [type, JSON.stringify(rows)],
  );
  return out.length;
}

/** Pages through everything changed since `sinceMs`. Returns the newest modified time seen. */
async function searchChanged(
  hubspot: HubSpotClient,
  type: HubSpotObject,
  sinceMs: number,
  onPage: (results: SearchResult[]) => Promise<void>,
): Promise<number | null> {
  const prop = MODIFIED[type];
  let from = sinceMs;
  let after: string | undefined;
  let latest: number | null = null;
  for (let guard = 0; guard < 1000; guard++) {
    const page = await hubspot.post<SearchPage>(`/crm/v3/objects/${type}/search`, {
      filterGroups: [{ filters: [{ propertyName: prop, operator: "GTE", value: String(from) }] }],
      sorts: [{ propertyName: prop, direction: "ASCENDING" }],
      properties: PROPERTIES[type],
      limit: 200,
      ...(after ? { after } : {}),
    });
    const results = page.results ?? [];
    await onPage(results);
    for (const r of results) {
      const t = Date.parse(r.updatedAt ?? r.properties?.[prop] ?? "");
      if (!Number.isNaN(t) && (latest === null || t > latest)) latest = t;
    }
    after = page.paging?.next?.after;
    if (!after) break;
    if (Number(after) >= 9800 && latest !== null) {
      from = latest;
      after = undefined;
    }
  }
  return latest;
}

export async function runHubSpotPass(
  db: Db,
  hubspot: HubSpotClient,
  portalId: string,
  opts: { trigger: Trigger; now?: () => Date },
): Promise<PassResult> {
  const run = await beginRun(db, "hubspot", "changes", opts.trigger, 900);
  if (!run) return { status: "skipped", calls: 0, seen: 0, changed: 0, note: "another HubSpot pass is running", error: null };

  const callsBefore = hubspot.stats.calls;
  let seen = 0;
  let changed = 0;
  let status: PassResult["status"] = "ok";
  let error: string | null = null;

  try {
    const info = await hubspot.get<{ portalId: number }>("/account-info/v3/details");
    if (String(info.portalId) !== portalId) {
      throw new Error(`HUBSPOT_TOKEN reaches portal ${info.portalId}, not HUBSPOT_PORTAL_ID ${portalId}. Nothing was read.`);
    }

    for (const archived of [false, true]) {
      let after: string | undefined;
      do {
        const page: OwnersPage = await hubspot.get<OwnersPage>("/crm/v3/owners", {
          limit: "500",
          archived: String(archived),
          ...(after ? { after } : {}),
        });
        const rows = (page.results ?? []).map((o) => ({
          id: Number(o.id),
          user_id: o.userId ?? null,
          email: o.email ?? null,
          first_name: o.firstName ?? null,
          last_name: o.lastName ?? null,
          teams: o.teams ?? [],
          archived: o.archived ?? archived,
          updated_at: o.updatedAt ?? null,
        }));
        if (rows.length > 0) {
          await db.query(
            `insert into mirror.hubspot_owners as o (id, user_id, email, first_name, last_name, teams, archived, hs_updated_at)
             select x.id, x.user_id, x.email, x.first_name, x.last_name, coalesce(x.teams, '[]'::jsonb), x.archived, x.updated_at
             from jsonb_to_recordset($1::jsonb) as x(
               id bigint, user_id bigint, email text, first_name text, last_name text, teams jsonb, archived boolean, updated_at timestamptz)
             on conflict (id) do update set
               user_id = excluded.user_id, email = excluded.email, first_name = excluded.first_name,
               last_name = excluded.last_name, teams = excluded.teams, archived = excluded.archived,
               hs_updated_at = excluded.hs_updated_at, synced_at = now()`,
            [JSON.stringify(rows)],
          );
        }
        after = page.paging?.next?.after;
      } while (after);
    }

    const pipelines = await hubspot.get<{
      results?: { id: string; label: string; displayOrder?: number; archived?: boolean; stages?: unknown[] }[];
    }>("/crm/v3/pipelines/deals");
    const pipelineRows = (pipelines.results ?? []).map((p) => ({
      id: p.id, label: p.label, display_order: p.displayOrder ?? null, archived: p.archived ?? false, stages: p.stages ?? [],
    }));
    if (pipelineRows.length > 0) {
      await db.query(
        `insert into mirror.hubspot_pipelines as p (object_type, id, label, display_order, archived, stages)
         select 'deals', x.id, x.label, x.display_order, x.archived, x.stages
         from jsonb_to_recordset($1::jsonb) as x(id text, label text, display_order integer, archived boolean, stages jsonb)
         on conflict (object_type, id) do update set
           label = excluded.label, display_order = excluded.display_order, archived = excluded.archived,
           stages = excluded.stages, synced_at = now()`,
        [JSON.stringify(pipelineRows)],
      );
    }

    const changedDeals: string[] = [];
    for (const type of OBJECTS) {
      const scope = `object:${type}`;
      const watermark = await getWatermark(db, "hubspot", scope);
      const since = watermark ? watermark.getTime() - OVERLAP_MS : 0;
      const latest = await searchChanged(hubspot, type, since, async (results) => {
        seen += results.length;
        changed += await upsertObjects(db, type, results);
        if (type === "deals") changedDeals.push(...results.map((r) => r.id));
      });
      if (latest !== null) await setWatermark(db, "hubspot", scope, new Date(latest));
    }

    for (let i = 0; i < changedDeals.length; i += 1000) {
      const chunk = [...new Set(changedDeals.slice(i, i + 1000))];
      const assoc = await hubspot.post<{ results?: { from: { id: string }; to?: { toObjectId: number }[] }[] }>(
        "/crm/v4/associations/deals/contacts/batch/read",
        { inputs: chunk.map((id) => ({ id })) },
      );
      const rows = (assoc.results ?? []).map((r) => ({ id: Number(r.from.id), contacts: (r.to ?? []).map((t) => t.toObjectId) }));
      if (rows.length > 0) {
        await db.query(
          `update mirror.hubspot_objects o
              set associations = o.associations || jsonb_build_object('contacts', x.contacts)
             from jsonb_to_recordset($1::jsonb) as x(id bigint, contacts jsonb)
            where o.object_type = 'deals' and o.id = x.id`,
          [JSON.stringify(rows)],
        );
      }
    }
  } catch (e) {
    status = "failed";
    error = e instanceof Error ? e.message : String(e);
  } finally {
    await endRun(db, run, {
      status,
      calls: hubspot.stats.calls - callsBefore,
      complexity: 0,
      seen,
      changed,
      note: null,
      error,
      watermarkBefore: null,
      watermarkAfter: null,
    });
  }
  return { status, calls: hubspot.stats.calls - callsBefore, seen, changed, note: null, error };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --import tsx --test src/server/mirror/hubspot/hubspot.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 5: Add HubSpot to the runner and the CLI**

In `src/server/mirror/run-source.ts`, add the imports:

```ts
import { createHubSpotClient } from "./hubspot/client";
import { runHubSpotPass } from "./hubspot/pass";
```

and insert before the final `return failed(\`unknown source "${source}"\`);`:

```ts
  if (source === "hubspot") {
    if (mode !== "changes") return failed(`unknown HubSpot mode "${mode}"`);
    if (!env.hubspotToken || !env.hubspotPortalId) return failed("HUBSPOT_TOKEN and HUBSPOT_PORTAL_ID must both be set");
    return runHubSpotPass(db, createHubSpotClient({ token: env.hubspotToken }), env.hubspotPortalId, { trigger });
  }
```

In `scripts/mirror.ts`, add to the comment at the top:

```ts
 *   hubspot                     HubSpot owners, pipelines, and deals/contacts/meetings/notes changed since last time
```

and insert before `default:`:

```ts
      case "hubspot": {
        const r = await runSource(db, env, "hubspot", "changes", "cli");
        printResult(r);
        if (r.status === "failed") process.exitCode = 1;
        break;
      }
```

- [ ] **Step 6: Checkpoint**

Run: `npm test`, `npx tsc --noEmit` and `git status --short`. Expected new files: the three HubSpot modules and their test; modified: `run-source.ts`, `scripts/mirror.ts`. Don't commit.

---

# Phase E: Ship it

### Task 22: Scheduling, the README, and the first run against the dev project

> **Changed in review (2026-10-09).** Apply these on top of the steps below.
>
> - **No Hubstaff** (Kane: "we dont have hubstaff its hubspot"):
>   - Step 1 drops the `launchpad-hubstaff-daily` job.
>   - Step 2's `vercel.json` drops the `/api/mirror/hubstaff` entry.
>   - Its sentence reads: "`hubspot` does the same for HubSpot."
>   - Nothing asks for Hubstaff credentials.
> - **Step 2 adds a "When something goes wrong" section to the README, after the schedule:**
>   - **Look at our tables in the SQL editor:** `set role launchpad_app;` first.
>   - **Files retired by a Storage outage** (a `download_error` other than `too_large`). As `launchpad_app`, run:
>     `update mirror.monday_assets set download_attempts = 0, download_error = null where download_error is not null and download_error <> 'too_large';`
>   - **A run shown as "stale (no end recorded)":** its end couldn't be written. The lease frees itself when it expires, so nothing is needed unless it keeps happening.
>   - **`reps` lists names with "no single staff match":** expect a long list on the first run. Add one alias each, as `launchpad_app`:
>     `insert into launchpad.staff_aliases (alias, staff_id) values (lower(btrim('<the name exactly as Monday has it>')), '<staff id>');`
>   - **"SUPABASE_DB_URL isn't a valid connection string":** check the port, and URL-encode any `@`, `#`, `/` or `:` in the password.
>   - **HubSpot:**
>     - `HUBSPOT_TOKEN` is a private app's token (`pat-…`) with read scopes only.
>     - "reaches portal X, not HUBSPOT_PORTAL_ID" means the token belongs to another HubSpot account.
>     - The first HubSpot load is quickest from the CLI (`npm run mirror -- hubspot`). After that, the schedule keeps it current.
>   - **`--max-calls` and `--max-files`** take positive whole numbers.
>   - **A tip:** run the app's functions in Sydney (`"regions": ["syd1"]` in `vercel.json`), next to the database. Each page load reads it several times.
>   - **Deploying:** set `SUPABASE_DB_URL` (and the other server variables) for the build as well as at runtime. A build without it prerenders the sample-data shell, and the deployment then serves sample data. With it set, every dashboard route renders per request, and each full page load waits for the database: about 10 s at most (`connect_timeout`) when the database can't be reached, before sample data shows.
> - **Step 4 starts with 4.0:** `npm run db:status` prints `connected as launchpad_app (login launchpad_app)` and lists 11 pending migrations: the nine from Tasks 2 to 7, plus two from review, `20261009000100_job_files_copy_state.sql` and `20261009000200_drop_hubstaff.sql`. Only then migrate.
> - **The README and the checkpoint say so too:** a deployment with live data needs Deployment Protection. Until sign-in exists, any copied Monday file opens by its numeric id. Enable syncing only on the boards Launchpad should show, because the download route serves every file on every mirrored board.
> - **Step 4 adds the live checks gathered in review.** Run them in this order once `setup` and the small backfill work:
>   1. `recentStampsPage`'s two-token `any_of`.
>   2. The activity log's `data` key names per event type (is `pulse_id` where the parser looks?).
>   3. `boards(ids:)` with an archived board (does it need `state: all`?).
>   4. Whether a file column's value still carries `files[].assetId`.
>   5. The fragment fields `StatusValue`, `BoardRelationValue` and `MirrorValue`.
>   6. What Monday does to an item moved to another board.
>   7. `select pg_input_is_valid('12345678', 'numeric(6,2)')`, which should give false.
>   8. The bootstrap result's `creates_only_in_own_schemas`. If it reads false on Jerry's project, ask Jerry to revoke CREATE on `public`.
>   9. Before 13 Oct, a two-connection race script against the dev project:
>      - 2 simultaneous `place_hold` calls give 1 active hold and 1 queued;
>      - 4 give 3 open holds and `queue_full`;
>      - two settles plus the sync over 2 or more expired lots give no `40P01`.
>   10. With real data, the layout loader's time and the page's RSC payload size. Past about 1 s or 1 MB, switch to list-level milestone summaries.
>   11. Kane confirms Exclusive Land's real status and title labels.
>   12. The HubSpot checks listed in `task-21-report.md`, once a working token exists. Among them: does the v4 association batch report a deal with no contacts under `errors` (for example `NO_ASSOCIATIONS_FOUND`)? If so, a deal that loses its last contact keeps its old list until that's handled.
>   13. `mirror -- buckets` succeeds, and Storage accepts the 52,428,800-byte bucket limit. A lower project-wide upload limit would make every files run fail. Each run would say why, and nothing would be charged.
>   14. From the final review:
>       - Run cron-style `changes` (the route, or the CLI with a deadline) after a deliberately long gap. It must make progress run over run, through the refetch queue.
>       - Check whether any mapped field is a Monday mirror column. Those never change an item's `updated_at`, so they would freeze.
>       - Backfill a board enabled after the first backfill with `backfill --board <key>`.

**Files:**
- Create: `scripts/db/schedule-pg-cron.sql`
- Modify: `README.md`
- Modify, only if Monday rejects a field in Step 4.4: `src/server/mirror/monday/queries.ts`

This task finishes the code, then runs the mirror for real. Steps 4 onward need Kane's credentials in `.env.local` (spec section 2). Stop and ask for them if they're not there; don't guess or reuse the leaked values.

- [ ] **Step 1: Write the Supabase-side schedule (used only if the host has no frequent cron)**

Create `scripts/db/schedule-pg-cron.sql`:

```sql
-- OPTIONAL. Schedules the mirror from Supabase instead of Vercel cron, for a host
-- without frequent crons (Vercel Hobby allows one run a day). Run as the project
-- owner in the SQL editor after enabling the pg_cron and pg_net extensions
-- (Database > Extensions). In Jerry's production project that's his call: ask first.
--
-- 1. Keep the cron secret in Vault (the same value as the app's CRON_SECRET):
--      select vault.create_secret('<CRON_SECRET>', 'launchpad_cron_secret');
-- 2. Replace every https://<app-host> below with the app's address, then run the rest.
-- All times are UTC: 18:30 UTC is 02:30 in Perth.

select cron.schedule('launchpad-monday-changes', '*/5 * * * *', $$
  select net.http_get(
    url := 'https://<app-host>/api/mirror/monday?mode=changes',
    headers := jsonb_build_object('Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'launchpad_cron_secret')),
    timeout_milliseconds := 300000)
$$);

select cron.schedule('launchpad-monday-files', '*/15 * * * *', $$
  select net.http_get(
    url := 'https://<app-host>/api/mirror/monday?mode=files',
    headers := jsonb_build_object('Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'launchpad_cron_secret')),
    timeout_milliseconds := 300000)
$$);

select cron.schedule('launchpad-monday-safety', '30 18 * * *', $$
  select net.http_get(
    url := 'https://<app-host>/api/mirror/monday?mode=safety',
    headers := jsonb_build_object('Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'launchpad_cron_secret')),
    timeout_milliseconds := 300000)
$$);

select cron.schedule('launchpad-monday-sweep', '0 19 * * 0', $$
  select net.http_get(
    url := 'https://<app-host>/api/mirror/monday?mode=sweep',
    headers := jsonb_build_object('Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'launchpad_cron_secret')),
    timeout_milliseconds := 300000)
$$);

select cron.schedule('launchpad-hubspot-changes', '*/10 * * * *', $$
  select net.http_get(
    url := 'https://<app-host>/api/mirror/hubspot?mode=changes',
    headers := jsonb_build_object('Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'launchpad_cron_secret')),
    timeout_milliseconds := 300000)
$$);

select cron.schedule('launchpad-hubstaff-daily', '0 20 * * *', $$
  select net.http_get(
    url := 'https://<app-host>/api/mirror/hubstaff?mode=daily',
    headers := jsonb_build_object('Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'launchpad_cron_secret')),
    timeout_milliseconds := 300000)
$$);

select cron.schedule('launchpad-land-settle', '*/5 * * * *', $$
  select net.http_get(
    url := 'https://<app-host>/api/land/settle',
    headers := jsonb_build_object('Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'launchpad_cron_secret')),
    timeout_milliseconds := 60000)
$$);
```

- [ ] **Step 2: Update the README**

In `README.md`, replace:

```md
> **Static prototype.** Every figure comes from `src/data/` or an in-memory store. There is
> no backend, no sign-in and no RBAC yet. A reload resets the demo to its seed data.
```

with:

```md
> **Sample data by default.** With no `.env.local`, every figure comes from `src/data/` or an
> in-memory store and a reload resets the demo. With a Supabase database connected, Exclusive
> Land, My clients, All clients and the Operations job list show live Monday data (read only);
> everything else keeps its sample data. There's no sign-in or RBAC yet, so a deployment with
> live data must sit behind Vercel Deployment Protection.
```

and insert after the "Run it" section (before `## Modules`):

````md
## Live data (Supabase)

Spec: `docs/superpowers/specs/2026-10-08-supabase-mirror-design.md`. Monday and HubSpot are only
ever read; nothing writes back while the Dash Sync go-live is on hold.

One-time setup for a Supabase project (Sydney):

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
npm run db:migrate          # applies supabase/migrations (db:status lists them)
npm run db:seed             # staff and department heads from the org chart
npm run mirror -- buckets   # the private Storage buckets
npm run mirror -- setup     # Locale's Monday boards, mapped from Jerry's config next door
npm run mirror -- backfill --board homes_sales_wa --max-calls 50   # a small first run
npm run mirror -- backfill  # then everything
npm run mirror -- reps      # match Monday's sales rep names to staff
npm run mirror -- files     # copy Monday's files into Storage
npm run mirror -- status    # boards, items, files, today's calls, recent runs
```

After that, `changes` (every 5 minutes), `files`, `safety` (daily) and `sweep` (weekly) keep it
current. `hubspot` and `hubstaff` do the same for those two. In production the routes under
`/api/mirror/*` and `/api/land/settle` run them on a schedule, with `Authorization: Bearer $CRON_SECRET`.
On Vercel Pro, add these to `vercel.json`:

```json
{
  "crons": [
    { "path": "/api/mirror/monday?mode=changes", "schedule": "*/5 * * * *" },
    { "path": "/api/mirror/monday?mode=files", "schedule": "*/15 * * * *" },
    { "path": "/api/mirror/monday?mode=safety", "schedule": "30 18 * * *" },
    { "path": "/api/mirror/monday?mode=sweep", "schedule": "0 19 * * 0" },
    { "path": "/api/mirror/hubspot?mode=changes", "schedule": "*/10 * * * *" },
    { "path": "/api/mirror/hubstaff?mode=daily", "schedule": "0 20 * * *" },
    { "path": "/api/land/settle", "schedule": "*/5 * * * *" }
  ]
}
```

Elsewhere (or on Vercel Hobby), `scripts/db/schedule-pg-cron.sql` schedules the same calls from Supabase.

`npm run check:secrets` scans staged files for tokens. Enable it as a pre-commit hook once per clone
with `git config core.hooksPath .githooks`.
````

- [ ] **Step 3: Run the whole suite and the build**

Run: `npm test`, `npx tsc --noEmit`, `npm run check:secrets -- --all`, then `npm run build` with no `.env.local`.
Expected: every test passes (the original 50 plus the new ones), no type errors, no secrets found, and the build passes with the dashboard routes static.

- [ ] **Step 4: First run against the dev project**

These steps need Kane's dev credentials in `.env.local`.

1. **Apply the schema.** Run `npm run db:migrate`, then `npm run db:status`.
   - Expected: the nine migrations applied, nothing pending.
2. **Seed the staff.** Run `npm run db:seed`.
   - Expected: `staff: N of N written; department heads set: 6`.
3. **Create the buckets.** Run `npm run mirror -- buckets`.
   - Expected: `buckets ready`.
4. **Probe Monday first.** Run `npm run mirror -- discover`. It is a handful of calls. If Monday rejects a field in `queries.ts` (an "undefined field" error), fix the document and run `discover` again before going on.
5. **Set up the boards.** Run `npm run mirror -- setup`.
   - Expected: the eight job boards plus Exclusive Land and Models enabled, and a field count.
   - If `exclusive_land` is listed as "not visible to this token", Jerry hasn't shared the board yet. Carry on without it; re-run `setup` once he has.
   - Show Kane the Exclusive Land title matches and the unmatched columns. He confirms them, and anything unmatched is placed with `insert into mirror.monday_field_map ... source 'manual'`.
6. **Try a small backfill.** Run `npm run mirror -- backfill --board homes_sales_wa --max-calls 50`, then `npm run mirror -- status`.
   - Expected: items on that board. Calls today in the ledger equal the calls the run printed.
7. **Backfill everything.** Run `npm run mirror -- backfill`, then `npm run mirror -- reps`, then `npm run mirror -- files --max-files 50`.
   - Show Kane the unmatched rep names.
8. **Check the ledger after a day.** Run `npm run mirror -- changes` twice, a few minutes apart. Each pass should cost about 1 to 3 calls.

- [ ] **Step 5: Check the screens on live data**

Run `npm run dev` with `.env.local` in place:

- **`/sales?tab=land`:** the lots from Monday, a "Live from Monday" note, and "Viewing as".
  - Place a hold on a test lot as one rep, then switch "Viewing as" and join the queue. Release, then mark sold.
  - Each action redraws from the database.
- **`/consultant?tab=clients`:** the chosen rep's jobs. Switching "Viewing as" changes them.
- **`/sales?tab=clients`:** every rep's jobs, A to Z, then Unassigned.
- **`/operations?tab=jobs` and a job page:**
  - live jobs, the read-only note, and Monday's files under Documents opening through the download route;
  - saving a milestone shows "Read only for now" and changes nothing.
- **The fallback:** stop the database URL working (point `SUPABASE_DB_URL` at a wrong password) and reload. The screens show sample data and the amber "Live data is unavailable" note, with no crash.

- [ ] **Step 6: Checkpoint**

Run: `git status --short` and confirm nothing under `.env*` (other than `.env.example`), no mirrored data and no IDs are staged or tracked. Report to Kane:

- the call counts;
- the Exclusive Land field map;
- the unmatched reps;
- anything that failed.

Don't commit.

