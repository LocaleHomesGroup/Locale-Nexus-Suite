# Employee Master Roster Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Locale's Employee Master Roster spreadsheet the source of every employee record in the Launchpad. The Global Master List carries its fields, and every dashboard that reads people agrees with it.

**Architecture:**
- **Import:** `npm run roster` (Node + `exceljs`) reads the xlsx in `Reference/` and writes two files:
  - `src/data/roster.ts`: the work fields. Committed.
  - `src/data/roster.private.ts`: birthdays, folder links and remarks. Git-ignored.
  A Turbopack alias falls back to a committed stub when the private file is missing.
- **People model:** a new `hr/people.ts` builds the org chart, the master list, headcounts and seed pay rates from the roster plus a small committed overlay. `hr/data.ts` re-exports it, so every reader keeps its import path.
- **Editing:** HR becomes read-only for people (roster-only). Pay rates and one-off pay stay.

**Tech Stack:** Next.js 16 App Router (Turbopack), React 19, TypeScript, `motion/react`, Tailwind 4, `lucide-react`. The importer uses `exceljs` 4.4 (devDependency). Verification uses:
- `npx tsc --noEmit`;
- `node scripts/check-roster.mjs`;
- scratch `tsx` logic checks;
- scratch `playwright-core` browser scripts.

**Spec:** `docs/superpowers/specs/2026-10-06-employee-master-roster-design.md` (commit `3eef8f7`). Read it first. This plan argues from it.

## Global Constraints

- **Workspace:**
  - Work only in the worktree `C:\Users\Kane\Desktop\Locale-launchpad-roster`, on branch `feat/employee-master-roster` cut from `main`.
  - Never edit `C:\Users\Kane\Desktop\Locale-launchpad`: other sessions work there.
  - Reading its git-ignored `Reference/` folder is fine. All paths below are relative to the worktree root.
- **The roster file:** `ROSTER_XLSX="C:/Users/Kane/Desktop/Locale-launchpad/Reference/Employee Master Roster 1.xlsx"`.
- **Import date:** always import with `--on 2026-10-06`, so every count in this plan holds whatever day the plan runs.
- **Privacy (the repo is public):**
  - Never commit `src/data/roster.private.ts`.
  - Never put a birthday, a folder link or a remark in a commit, a commit message, a console log you paste anywhere, or this plan's notes.
  - The committed `src/data/roster.ts` must not contain the keys `birthday`, `folderUrl` or `remarks`, or any `http` URL.
- **Dependencies:** one new devDependency, `exceljs@^4.4.0` (Task 1). Nothing else changes in `package.json` apart from the `roster` script.
- **Next.js 16:** before using `turbopack.resolveAlias`, read `node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/turbopack.md` ("Resolving aliases") (AGENTS.md).
- **Ids are stable:**
  - Today's seat ids survive: `brad-linford`, `jerry-delos-santos`, `pablo-lopez`, `maria-soriano`, `jan-kane-reroma` and the rest. The Tickets branch (`feat/tickets-dashboard`) depends on them.
  - Keep the export names `ORG_SEED`, `masterList`, `useOrg`, `orgDepartmentOf` and `orgDepartment`.
- **Wording:**
  - Copy about employee records says "Employee Master Roster", not Horilla.
  - Leave, attendance, assets, recruitment and **pay rates** keep Horilla. The roster holds no pay, so the Rates dialog's toasts stay as they are. This corrects a slip in the spec's Wording section.
  - New copy uses no em dashes.
- **UI rules:**
  - **Motion:** only `EASE_OUT` / `EASE_SWAP` from `src/lib/motion.ts`, durations gated with `useReducedMotion()`.
  - **Type scale:** `text-[10px]`, `text-xs`, `text-[13px]`, `text-sm` and the component sizes.
  - **Colour:** status colour sits beside its word (amber for overdue, never colour alone). No Sky Blue outside Wealth.
- **Hydration:** anything counted on the viewer's clock (tenure) carries `suppressHydrationWarning` where it renders on the server.
- **Checks:**
  - After every task, `npx tsc --noEmit` must pass.
  - Browser checks run against the worktree dev server on `http://localhost:3200`.
  - A console error is a failure unless it also appears on `main` for the same page; note it if so.
- **Commits:** on the branch only, staging paths explicitly. End every message with `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`.
- **Scratchpad:** `S="C:/Users/Kane/AppData/Local/Temp/claude/c--Users-Kane-Desktop-Locale-launchpad/62fc1d3e-43fb-4bb0-8bae-e2d74e3ec21d/scratchpad"`. The tsx checks, browser scripts and backups live there and are never committed.

## Review Focus

Five failure modes the spec implies, most likely first, each pinned to a test in the task that owns the code:

1. **A re-import drops someone a seed names** (a department head in the overlay, `PAYEE_SEED`, `EXTRA_ROLES`, `PRESENCE_SEED`, `UNSENT`).
   - Expect the import to refuse a missing department head by name.
   - Expect the seed lists to skip anyone who has gone instead of crashing at module load.
   - *(Task 1, `check-roster.mjs` synthetic case; Task 6, `check-accounting.mts`)*
2. **A Reports To that matches nobody** (a typo, or a manager not on the sheet yet). Expect `npm run roster` to exit non-zero, name the row, and write nothing. *(Task 1, `check-roster.mjs`)*
3. **A build from a clean clone with no private file.**
   - Expect it to build.
   - Expect Birthday and Remarks to read "Kept locally", and the CSV to have no private columns.
   - Expect the committed "No folder link in the roster" to still show.
   - *(Task 9, build without the private file + `stub.mjs` browser check)*
4. **People with no start date, or a start still ahead.**
   - Seven leavers have no start date; Christopher Wootton starts 2 Nov.
   - Expect "Left", "Starts 2 Nov" or a dash, and never "NaN" or "Invalid".
   - *(Task 3, `check-people.mts`; Task 4, `hr-roster.mjs`)*
5. **A new starter whose first name is already a sign-in** (a second Adam or Kristen). Expect the surname initial, then a number, and every sign-in unique. *(Task 3, `check-people.mts`)*

## File map

| File | Task | Responsibility |
| --- | --- | --- |
| `scripts/roster-lib.mjs` (new) | 1 | Read the xlsx into committed records and private fields; resolve Reports To; refuse what can't be placed |
| `scripts/import-roster.mjs` (new) | 1 | CLI: write `roster.ts` and `roster.private.ts`, report the changes |
| `scripts/check-roster.mjs` (new) | 1 | Asserts on the real roster, plus the error cases |
| `src/data/roster-types.ts` (new) | 1 | `RosterRecord`, `RosterSource`, `RosterPrivate` |
| `src/data/roster-overlay.json` (new) | 1 | Directors, id aliases, go-by names, links, vacancies, department heads, placeholder sign-ins |
| `src/data/roster.ts` (generated, committed) | 1 | `ROSTER_SOURCE`, `ROSTER` |
| `src/data/roster.private.ts` (generated, git-ignored) | 1 | `ROSTER_PRIVATE` |
| `src/data/roster.private.stub.ts` (new) | 1 | `ROSTER_PRIVATE = null` for builds without the private file |
| `src/data/roster-private.d.ts` (new) | 1 | Types the `@roster-private` alias |
| `next.config.ts`, `.gitignore`, `package.json`, `README.md` | 1 | Alias, ignore, script and dependency, docs |
| `src/components/modules/hr/AddPersonDialog.tsx` (deleted) | 2 | — |
| `src/components/modules/hr/master-list/EditPersonDialog.tsx` → `RatesDialog.tsx` | 2 | Pay rates only |
| `src/components/modules/hr/org-store.ts` | 2 | Read-only `useOrg()` |
| `src/components/modules/hr/people.ts` (new) | 3 | The roster-derived people model |
| `src/components/modules/hr/data.ts` | 4 | Re-exports `people.ts`; keeps the Horilla fixtures |
| `src/components/modules/hr/tabs/HrMasterListTab.tsx`, `master-list/RecordDialog.tsx`, `master-list/parts.tsx`, `master-list/PayDialog.tsx` | 2, 4 | The Global Master List on roster fields |
| `src/components/modules/hr/OrgChart.tsx`, `tabs/HrOverviewTab.tsx` | 2, 5 | Read-only chart, departments, the roster's KPIs and Probation |
| `src/components/modules/admin/{data.ts,AdminMasterList.tsx,AdminRoles.tsx,AdminOverview.tsx}` | 4 | Active staff, roster fields, department grants |
| `src/components/modules/accounting/data.ts` | 6 | Payees from the roster, history from start dates |
| `src/components/modules/employee/{data.ts,EmployeeProfile.tsx,EmployeeDepartment.tsx,EmployeeScreen.tsx}` | 2, 4, 6, 7 | Kane's roster record and first week |
| `src/components/shell/dashboards.ts` | 7 | Persona line |
| `src/components/shell/assistant/jarvis-knowledge.ts` | 4, 8 | Staff-only answers, the roster headcount |
| `src/components/modules/leadership/{data.ts,LeadershipOverview.tsx}`, `src/components/modules/it/data.ts`, `src/components/modules/hr/HrScreen.tsx` | 8 | Headcounts and wording |

---

### Task 1: Roster import

**Files:**
- Create: `scripts/roster-lib.mjs`, `scripts/import-roster.mjs`, `scripts/check-roster.mjs`
- Create: `src/data/roster-types.ts`, `src/data/roster-overlay.json`, `src/data/roster.private.stub.ts`, `src/data/roster-private.d.ts`
- Generate: `src/data/roster.ts` (committed), `src/data/roster.private.ts` (git-ignored)
- Modify: `package.json`, `package-lock.json`, `.gitignore`, `next.config.ts`, `README.md`

**Interfaces:**
- Produces from `roster-lib.mjs`:
  - `readRoster(file, overlay) → Promise<{ records, privateById, problems }>`
  - `buildRoster(rows, overlay)`, the same result for raw rows; it throws when a row can't be placed
  - `newestRoster(dir)`, `slug(name)`, `clean(v)`, `isoDate(v)`
- Produces from `@/data/roster`: `ROSTER_SOURCE: RosterSource` and `ROSTER: RosterRecord[]`.
- Produces from `@roster-private`: `ROSTER_PRIVATE: Record<string, RosterPrivate> | null`. It's null in a build without the private file.
- Produces from `@/data/roster-overlay.json`: `{ ids, goesBy, vacancies, directors, links, departmentHeads, placeholderEmails }`.

- [ ] **Step 1: Create the worktree and install**

Use superpowers:using-git-worktrees. Put the worktree at `C:\Users\Kane\Desktop\Locale-launchpad-roster`, on a new branch `feat/employee-master-roster` from `main`. Then:

```bash
cd C:/Users/Kane/Desktop/Locale-launchpad-roster
git log --oneline -2          # expect this plan's commit, then 3eef8f7 (the spec)
npm ci
npx tsc --noEmit              # expect: no output (clean baseline)
npm i -D exceljs@^4.4.0
```

Then add the `roster` script to `package.json`'s `scripts`, after `"lint"`:

```json
    "lint": "tsc --noEmit",
    "roster": "node scripts/import-roster.mjs"
```

- [ ] **Step 2: Write the failing check**

Create `scripts/check-roster.mjs`:

```js
#!/usr/bin/env node
/**
 * node scripts/check-roster.mjs [path/to/roster.xlsx]
 *
 * Checks the Employee Master Roster import: the real file against what we
 * know is in it (as of the 6 Oct 2026 copy), the cases the import must refuse,
 * and that the committed src/data/roster.ts matches the file and holds no
 * private field. Run it after `npm run roster`.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildRoster, newestRoster, readRoster } from "./roster-lib.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const overlay = JSON.parse(fs.readFileSync(path.join(ROOT, "src", "data", "roster-overlay.json"), "utf8"));
const file = process.argv[2] ? path.resolve(process.argv[2]) : newestRoster(path.join(ROOT, "Reference"));

/* ── The real roster ───────────────────────────────────────────────────── */

const { records, privateById } = await readRoster(file, overlay);
const get = (id) => records.find((r) => r.id === id);
const ids = new Set(records.map((r) => r.id));
const onSheet = records.filter((r) => r.status !== "inactive");

assert.equal(ids.size, records.length, "ids are unique");
assert.equal(onSheet.filter((r) => !r.vacant).length, 80, "80 people on the Active sheet");
assert.equal(records.filter((r) => r.vacant).length, 1, "one vacant seat");
assert.equal(records.filter((r) => r.status === "inactive").length, 31, "31 leavers");
assert.deepEqual(
  records.filter((r) => r.status === "pending" && !r.vacant).map((r) => r.id),
  ["christopher-wootton"],
  "one start still TBA",
);

const departments = {};
for (const r of onSheet) departments[r.department] = (departments[r.department] ?? 0) + 1;
assert.deepEqual(departments, {
  Finance: 8,
  Sales: 53,
  Operations: 4,
  Marketing: 10,
  Accounting: 1,
  "Information Technology": 4,
  "Executive Office": 1,
});

// Today's ids survive the roster's legal names.
for (const id of [
  "brad-linford",
  "jerry-delos-santos",
  "oli-chevellas",
  "nat-mason",
  "roni-nelson",
  "lori-pirozzi",
  "nash-sivayanam",
  "pablo-lopez",
  "maria-soriano",
  "sean-oneill",
  "tim-hill",
  "jian-wen",
  "jan-kane-reroma",
]) {
  assert.ok(ids.has(id), `id ${id}`);
}
assert.equal(get("brad-linford").name, "Bradley Linford");
assert.equal(get("sean-oneill").name, "Sean O'Neill");
assert.equal(get("tim-hill").name, "Tim Hill");
assert.equal(get("tim-hill").note, "VIC");
assert.equal(get("jian-wen").note, "Jay Tan");

// Reports To: full names, go-by names, a vacant seat, a director, the first of two.
for (const r of onSheet) assert.ok(r.reportsTo, `${r.name || r.role} reports to someone`);
assert.equal(get("brad-linford").reportsTo, "adam-schaal");
assert.equal(get("ankit-kausik").reportsTo, "brad-linford");
assert.equal(get("andre-mikhail-serra").reportsTo, "jerry-delos-santos");
assert.equal(get("nam-su-byun").reportsTo, "oli-chevellas");
assert.equal(get("shannan-murray").reportsTo, "alison-carter");
assert.equal(get("brendan-ford").reportsTo, "advocate-manager-qld");
assert.equal(get("maria-soriano").reportsTo, "adam-schaal");
assert.equal(get("maria-soriano").reportsToText, "Adam Schaal / Yasmin Georgiadis");

// Dates: real dates, dates typed as text, Confirmation formulas.
assert.equal(get("jan-kane-reroma").start, "2026-09-29");
assert.equal(get("ciaran-fahy").start, "2026-05-01");
assert.equal(get("nathan-good").start, "2025-02-18");
assert.equal(get("brad-linford").confirmation, "2025-10-11");
assert.equal(get("keira-whitbread").confirmation, "2025-11-12");
assert.equal(get("christopher-wootton").start, "2026-11-02");

// Cleaning: spaces, N/A and TBA.
assert.equal(get("oli-chevellas").role, "Group Performance Manager");
assert.equal(get("keira-whitbread").role, "Social Media Lead");
assert.equal(get("ankit-kausik").probation, null);
assert.equal(get("aled-smith").probation, "On Probation");
assert.equal(get("pablo-lopez").location, "Nicaragua");

const qld = get("advocate-manager-qld");
assert.equal(qld.vacant, true);
assert.equal(qld.name, "");
assert.equal(qld.reportsTo, "sean-oneill");
assert.equal(qld.location, null);

const leaver = get("raymond-shanks");
assert.equal(leaver.status, "inactive");
assert.equal(leaver.location, null, "the Inactive sheet has no Location");

assert.equal(onSheet.filter((r) => !r.vacant && !r.folderOnFile).length, 6, "six Link cells with no link");

// Private fields: only for real people, never for the vacant seat.
assert.ok(Object.keys(privateById).every((id) => ids.has(id) && !get(id).vacant));
assert.ok(privateById["jan-kane-reroma"]?.birthday, "Kane's birthday is in the private file");

/* ── What the import must refuse (synthetic rows) ──────────────────────── */

const row = (over = {}) => ({
  sheet: "Active",
  line: 90,
  name: "Pat Example",
  company: "Locale Homes Australia Pty Ltd",
  division: "Locale Homes",
  department: "Sales",
  location: "Australia",
  reportsTo: "Sean O’Neill",
  role: "New Home Advocate",
  birthday: null,
  employmentType: "Contractor",
  probation: "N/A",
  start: new Date(Date.UTC(2026, 9, 1)),
  confirmation: "N/A",
  confirmationFormula: null,
  end: null,
  status: "Active",
  folder: "Link",
  folderLink: "https://example.test/folder",
  remarks: null,
  ...over,
});
const sean = row({ line: 2, name: "Sean O’Neill", reportsTo: "Adam Schaal", role: "Head of Sales" });
const heads = { ...overlay, departmentHeads: { sales: "sean-oneill" } };

const fine = buildRoster([sean, row()], heads);
assert.equal(fine.records[1].reportsTo, "sean-oneill", "a curly apostrophe still resolves");

assert.throws(() => buildRoster([sean, row({ reportsTo: "Nobody Known" })], heads), /can't find "Nobody Known"/);
assert.throws(() => buildRoster([sean, row({ department: "Space Program" })], heads), /unknown department "Space Program"/);
assert.throws(() => buildRoster([sean, row(), row({ line: 91 })], heads), /already/);
assert.throws(
  () => buildRoster([sean, row()], { ...overlay, departmentHeads: { sales: "nobody-here" } }),
  /head of sales, "nobody-here", isn't/,
);

const left = buildRoster([sean, row({ sheet: "Inactive", reportsTo: "Someone Gone" })], heads).records[1];
assert.equal(left.status, "inactive");
assert.equal(left.reportsTo, null);
assert.equal(left.reportsToText, "Someone Gone");

const typed = buildRoster([sean, row({ start: " 3 Mar 2026", confirmation: null, confirmationFormula: "N9+90" })], heads)
  .records[1];
assert.equal(typed.start, "2026-03-03");
assert.equal(typed.confirmation, "2026-06-01", "start + 90 when the formula has no saved result");

/* ── The committed file ────────────────────────────────────────────────── */

const generated = fs.readFileSync(path.join(ROOT, "src", "data", "roster.ts"), "utf8");
assert.ok(!/birthday|folderUrl|remarks|https?:\/\//i.test(generated), "roster.ts holds no private field");
const committed = JSON.parse(/export const ROSTER: RosterRecord\[\] = (\[[\s\S]*\]);\s*$/.exec(generated)[1]);
assert.deepEqual(committed, records, "roster.ts matches the spreadsheet: run npm run roster");

console.log(`check-roster: ok (${records.length} rows from ${path.basename(file)})`);
```

- [ ] **Step 3: Run it and watch it fail**

```bash
node scripts/check-roster.mjs "$ROSTER_XLSX"
```

Expected: `ERR_MODULE_NOT_FOUND` for `./roster-lib.mjs`.

- [ ] **Step 4: Write the overlay**

Create `src/data/roster-overlay.json`. These are the ids and sign-ins today's org chart already uses; nothing private:

```json
{
  "ids": {
    "Bradley Linford": "brad-linford",
    "Jericho Delos Santos": "jerry-delos-santos",
    "Natalie Mason": "nat-mason",
    "Ronalyn Nelson": "roni-nelson",
    "Loretana Pirozzi": "lori-pirozzi",
    "Naresh Sivayanam": "nash-sivayanam",
    "Pablo Rafael Lopez Solorzano": "pablo-lopez",
    "Maria Joana Soriano": "maria-soriano",
    "Oliver Cheveralls": "oli-chevellas"
  },
  "goesBy": {
    "brad-linford": "Brad",
    "jerry-delos-santos": "Jerry",
    "nat-mason": "Nat",
    "roni-nelson": "Roni",
    "lori-pirozzi": "Lori",
    "nash-sivayanam": "Nash",
    "oli-chevellas": "Oli",
    "jan-kane-reroma": "Kane"
  },
  "vacancies": {
    "Advocate Manager QLD": "advocate-manager-qld"
  },
  "directors": [
    { "id": "adam-schaal", "name": "Adam Schaal", "role": "Managing Director", "reportsTo": null },
    {
      "id": "yasmin-georgiadis",
      "name": "Yasmin Georgiadis",
      "role": "Non-Exec Director",
      "reportsTo": "adam-schaal",
      "link": "peer"
    }
  ],
  "links": {
    "maria-soriano": "assistant"
  },
  "departmentHeads": {
    "leadership": "adam-schaal",
    "finance": "brad-linford",
    "sales": "sean-oneill",
    "marketing": "kellie-boyer",
    "operations": "larnie-clark",
    "it": "jerry-delos-santos",
    "accounting": "aled-smith",
    "executive": "maria-soriano"
  },
  "placeholderEmails": {
    "adam-schaal": "adam@localegroup.au",
    "yasmin-georgiadis": "yasmin@localegroup.au",
    "oli-chevellas": "oli@localegroup.au",
    "larnie-clark": "larnie@localegroup.au",
    "kristian-charlon-serrano": "kristian@localegroup.au",
    "maria-soriano": "maria@localegroup.au",
    "sean-oneill": "sean@localegroup.au",
    "keira-whitbread": "keira@localegroup.au",
    "brad-linford": "brad@localegroup.au",
    "quentin-smith": "quentin@localegroup.au",
    "aled-smith": "aled@localegroup.au",
    "mitch-forbes": "mitch@localegroup.au",
    "conor-lloyd-fox": "conor@localegroup.au",
    "adam-orlando": "adamo@localegroup.au",
    "tayla-juratovac": "tayla@localegroup.au",
    "kellie-boyer": "kellie@localegroup.au",
    "oumi-kapila": "oumi@localegroup.au",
    "bavinder-singh": "bavinder@localegroup.au",
    "josh-beardsell": "josh@localegroup.au",
    "thales-ferreira": "thales@localegroup.au",
    "jessica-williamson": "jessica@localegroup.au",
    "james-francis": "james@localegroup.au",
    "sebastian-tindale": "sebastian@localegroup.au",
    "shea-connolly": "shea@localegroup.au",
    "kate-grierson": "kate@localegroup.au",
    "nathan-good": "nathan@localegroup.au",
    "omar-khirzad": "omar@localegroup.au",
    "jian-wen": "jian@localegroup.au",
    "nat-mason": "nat@localegroup.au",
    "nash-sivayanam": "nash@localegroup.au",
    "lane-dula": "lane@localegroup.au",
    "rachel-riggio": "rachel@localegroup.au",
    "dianne-alvarez": "dianne@localegroup.au",
    "shannan-murray": "shannan@localegroup.au",
    "lori-pirozzi": "lori@localegroup.au",
    "ciaran-fahy": "ciaran@localegroup.au",
    "hayden-wilson": "hayden@localegroup.au",
    "jordan-dench": "jordan@localegroup.au",
    "de-wet-de-la-porte": "dewet@localegroup.au",
    "rachal-maffina": "rachal@localegroup.au",
    "sharni-clavarino": "sharni@localegroup.au",
    "pryncess-bungard": "pryncess@localegroup.au",
    "jerry-delos-santos": "jerry@localegroup.au",
    "sarah-jasmin": "sarah@localegroup.au",
    "kristen-margetts": "kristen@localegroup.au",
    "elisa-kalliosalo": "elisa@localegroup.au",
    "kathryn-carr": "kathryn@localegroup.au",
    "emily-dann": "emily@localegroup.au",
    "renae-dysart": "renae@localegroup.au",
    "krystal-mosca": "krystal@localegroup.au",
    "monique-juratovac": "monique@localegroup.au",
    "brendan-ford": "brendan@localegroup.au",
    "audris-quek": "audris@localegroup.au",
    "brett-jenkinson": "brett@localegroup.au",
    "tomas-watson": "tomas@localegroup.au",
    "andre-mikhail-serra": "andre@localegroup.au",
    "matt-raven": "matt@localegroup.au",
    "jasmin-bainbridge": "jasmin@localegroup.au",
    "roni-nelson": "roni@localegroup.au",
    "tim-hill": "tim@localegroup.au",
    "karina-saxby": "karina@localegroup.au",
    "alison-carter": "alison@localegroup.au",
    "ankit-kausik": "ankit@localegroup.au",
    "pablo-lopez": "pablo@localegroup.au",
    "kristen-jackson": "kristenj@localegroup.au",
    "khai-tran": "khai@localegroup.au",
    "michael-fox": "michael@localegroup.au",
    "steph-stritch": "steph@localegroup.au",
    "tristan-hatt": "tristan@localegroup.au",
    "jan-kane-reroma": "jan@localegroup.au",
    "nam-su-byun": "nam@localegroup.au"
  }
}
```

- [ ] **Step 5: Write the importer library**

Create `scripts/roster-lib.mjs`:

```js
/**
 * Reads Locale's Employee Master Roster (an .xlsx with sheets "Active" and
 * "Inactive") into what the Launchpad commits (work fields) and what it never
 * commits (birthdays, Employee Folder links, remarks). import-roster.mjs writes
 * the files; check-roster.mjs tests this.
 *
 * Columns are found by header text, never by position: the Inactive sheet has
 * no Location column, so the two sheets don't line up.
 */
import fs from "node:fs";
import path from "node:path";
import ExcelJS from "exceljs";

const HEADERS = {
  company: "company name",
  division: "division",
  department: "department",
  location: "location",
  name: "employee name",
  reportsTo: "reports to",
  role: "role",
  birthday: "birthday",
  employmentType: "employment type",
  probation: "probation status",
  start: "start date",
  confirmation: "confirmation date",
  end: "end date",
  status: "status",
  folder: "employee folder",
  remarks: "remarks",
};

/** The roster's departments. The app maps each to a department id; anything else stops the import. */
export const DEPARTMENTS = [
  "Finance",
  "Sales",
  "Marketing",
  "Operations",
  "Information Technology",
  "Accounting",
  "Executive Office",
];

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const DAY = 86_400_000;

/** "Sean O'Neill" → "sean-oneill", as the app's org chart ids are. */
export function slug(name) {
  return name
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/** Trimmed, single-spaced, straight apostrophes. Null when blank. */
export function clean(v) {
  if (v == null) return null;
  const s = String(v)
    .replace(/[\u2018\u2019\u00b4\ufffd]/g, "'")
    .replace(/\s+/g, " ")
    .trim();
  return s || null;
}

/** "TBA" and "N/A" mean nothing is known yet. */
const known = (s) => (s && !/^(tba|n\/a)$/i.test(s) ? s : null);

const iso = (d) => d.toISOString().slice(0, 10);
const addDays = (isoDay, n) => iso(new Date(Date.parse(`${isoDay}T00:00:00Z`) + n * DAY));

/**
 * A Date, an Excel serial or text like "1 May 2026" → "2026-05-01". Null for
 * blank, TBA or N/A; undefined for text that isn't a date (the caller reports it).
 */
export function isoDate(v) {
  if (v == null) return null;
  if (v instanceof Date) return iso(v);
  if (typeof v === "number") return iso(new Date(Date.UTC(1899, 11, 30) + Math.round(v) * DAY));
  const s = known(clean(v));
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = /^(\d{1,2}) ([A-Za-z]{3})[A-Za-z]* (\d{4})$/.exec(s);
  const month = m ? MONTHS.indexOf(m[2].toLowerCase()) : -1;
  return m && month >= 0 ? iso(new Date(Date.UTC(Number(m[3]), month, Number(m[1])))) : undefined;
}

/** A cell unwrapped: a link's text and target, rich text joined, a formula's saved result. */
function unwrap(cell) {
  let value = cell.value;
  let link = null;
  let formula = null;
  if (value && typeof value === "object" && !(value instanceof Date)) {
    if ("formula" in value || "sharedFormula" in value) {
      formula = value.formula ?? null;
      value = value.result ?? null;
    } else if ("hyperlink" in value) {
      link = value.hyperlink || null;
      value = value.text;
    }
    if (value && typeof value === "object" && "richText" in value) value = value.richText.map((t) => t.text).join("");
    if (value && typeof value === "object" && "error" in value) value = null;
  }
  return { value, link, formula };
}

/** One sheet's rows as raw values, keyed like HEADERS. Rows without a name are skipped. */
function readSheet(ws) {
  const col = {};
  ws.getRow(1).eachCell((cell, n) => {
    const header = clean(unwrap(cell).value)?.toLowerCase();
    for (const [key, label] of Object.entries(HEADERS)) if (header === label) col[key] = n;
  });
  for (const key of ["name", "role", "reportsTo", "status"]) {
    if (!col[key]) throw new Error(`Sheet "${ws.name}" has no "${HEADERS[key]}" column.`);
  }
  const rows = [];
  ws.eachRow((row, line) => {
    if (line === 1) return;
    const cell = (key) => (col[key] ? unwrap(row.getCell(col[key])) : { value: null, link: null, formula: null });
    const name = clean(cell("name").value);
    if (!name) return;
    const raw = { sheet: ws.name, line, name };
    for (const key of Object.keys(HEADERS)) if (key !== "name") raw[key] = cell(key).value;
    raw.folderLink = cell("folder").link;
    raw.confirmationFormula = cell("confirmation").formula;
    rows.push(raw);
  });
  return rows;
}

/**
 * Raw rows (Active first, then Inactive) → { records, privateById, problems }.
 * `problems` are things the import coped with; anything that would put a
 * person in the wrong place on the chart throws instead, and nothing is written.
 */
export function buildRoster(rows, overlay) {
  const problems = [];
  const fail = [];
  const where = (r) => `${r.sheet} row ${r.line} (${clean(r.name)})`;

  const people = rows.map((r) => {
    const full = clean(r.name) ?? "";
    const vacant = /^tba$/i.test(full);
    const bracket = /^(.*?)\s*\((.+)\)$/.exec(full);
    const name = vacant ? "" : bracket ? bracket[1] : full;
    const role = clean(r.role) ?? "";
    const id = vacant ? (overlay.vacancies[role] ?? slug(role)) : (overlay.ids[name] ?? slug(name));
    const status = r.sheet === "Inactive" ? "inactive" : clean(r.status) === "Active" ? "active" : "pending";

    /** A date field; `secret` keeps its value out of the report. */
    const date = (key, label, secret = false) => {
      const out = isoDate(r[key]);
      if (out === undefined) {
        problems.push(`${where(r)}: ${label} ${secret ? "" : `"${clean(r[key])}" `}isn't a date; left blank.`);
        return null;
      }
      if (out && typeof r[key] === "string" && !secret) {
        problems.push(`${where(r)}: ${label} is typed as text ("${clean(r[key])}"); read as ${out}.`);
      }
      return out;
    };

    const start = date("start", "Start Date");
    let confirmation = date("confirmation", "Confirmation Date");
    const plus = /\+\s*(\d+)\s*$/.exec(r.confirmationFormula ?? "");
    if (!confirmation && start && plus) confirmation = addDays(start, Number(plus[1]));

    const department = known(clean(r.department));
    if (department && !DEPARTMENTS.includes(department)) fail.push(`${where(r)}: unknown department "${department}".`);
    if (!department && status !== "inactive") fail.push(`${where(r)}: no department.`);

    const folderText = known(clean(r.folder));
    if (!vacant && folderText && !r.folderLink) {
      problems.push(`${where(r)}: Employee Folder says "${folderText}" but has no link behind it.`);
    }

    return {
      raw: r,
      record: {
        id,
        ...(vacant ? { vacant: true } : {}),
        name,
        ...(bracket && !vacant ? { note: bracket[2].trim() } : {}),
        role,
        company: known(clean(r.company)),
        division: known(clean(r.division)),
        department,
        location: known(clean(r.location)),
        reportsTo: null,
        reportsToText: known(clean(r.reportsTo)),
        employmentType: known(clean(r.employmentType)),
        probation: known(clean(r.probation)),
        start,
        confirmation,
        end: date("end", "End Date"),
        status,
        folderOnFile: Boolean(r.folderLink),
      },
      private: {
        birthday: date("birthday", "Birthday", true) ?? undefined,
        folderUrl: r.folderLink ?? undefined,
        remarks: clean(r.remarks) ?? undefined,
      },
    };
  });

  // One id per person. A leaver who shares a slug with someone still here gets "-left".
  const byId = new Map();
  for (const p of people) {
    const prior = byId.get(p.record.id);
    if (prior && p.record.status === "inactive" && prior.record.status !== "inactive") p.record.id = `${p.record.id}-left`;
    else if (prior) {
      fail.push(
        `${where(p.raw)}: id "${p.record.id}" is already ${where(prior.raw)}. Give one of them an id under "ids" in roster-overlay.json.`,
      );
    }
    byId.set(p.record.id, p);
  }

  // Reports To, by full name, by the name someone goes by, or by a vacant seat's role.
  const index = new Map();
  const add = (n, id) => n && index.set(n.toLowerCase(), id);
  for (const d of overlay.directors) add(d.name, d.id);
  for (const { record: p } of people) {
    if (p.status === "inactive") continue;
    if (p.vacant) {
      add(p.role, p.id);
      continue;
    }
    add(p.name, p.id);
    const goesBy = overlay.goesBy[p.id];
    if (goesBy) add(`${goesBy} ${p.name.split(" ").slice(1).join(" ")}`, p.id);
  }
  for (const { raw, record: p } of people) {
    const text = p.reportsToText;
    if (!text) {
      if (p.status !== "inactive") fail.push(`${where(raw)}: no Reports To.`);
      continue;
    }
    const first = text.split("/")[0].trim();
    if (first !== text) problems.push(`${where(raw)}: reports to "${text}"; the chart uses ${first}.`);
    p.reportsTo = index.get(first.toLowerCase()) ?? null;
    if (!p.reportsTo && p.status !== "inactive") {
      fail.push(
        `${where(raw)}: can't find "${first}" (Reports To) on the roster. Fix the name in the sheet, or add who they go by under "goesBy" in roster-overlay.json.`,
      );
    } else if (p.reportsTo && byId.get(p.reportsTo)?.record.vacant) {
      problems.push(`${where(raw)}: reports to the vacant ${first} seat.`);
    }
  }

  // Every department head must still be here: the app hangs each department off its head.
  const here = new Set([
    ...overlay.directors.map((d) => d.id),
    ...people.filter((p) => p.record.status !== "inactive" && !p.record.vacant).map((p) => p.record.id),
  ]);
  for (const [dept, id] of Object.entries(overlay.departmentHeads)) {
    if (!here.has(id)) fail.push(`The head of ${dept}, "${id}", isn't on the Active sheet. Update "departmentHeads" in roster-overlay.json.`);
  }

  if (fail.length) throw new Error(`The roster can't be imported:\n  ${fail.join("\n  ")}`);

  const privateById = {};
  for (const p of people) {
    if (p.record.vacant) continue;
    const fields = Object.fromEntries(Object.entries(p.private).filter(([, v]) => v !== undefined));
    if (Object.keys(fields).length) privateById[p.record.id] = fields;
  }
  return { records: people.map((p) => p.record), privateById, problems };
}

/** Reads the workbook and builds the roster. */
export async function readRoster(file, overlay) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(file);
  const sheet = (name) => {
    const ws = wb.getWorksheet(name);
    if (!ws) throw new Error(`${path.basename(file)} has no "${name}" sheet.`);
    return ws;
  };
  return buildRoster([...readSheet(sheet("Active")), ...readSheet(sheet("Inactive"))], overlay);
}

/** The newest Employee Master Roster*.xlsx in `dir`, Excel's ~$ lock files aside. */
export function newestRoster(dir) {
  const files = fs.existsSync(dir)
    ? fs.readdirSync(dir).filter((f) => /^Employee Master Roster.*\.xlsx$/i.test(f) && !f.startsWith("~$"))
    : [];
  if (!files.length) {
    throw new Error(`No "Employee Master Roster*.xlsx" in ${dir}. Pass its path: npm run roster -- "path/to/roster.xlsx"`);
  }
  const mtime = (f) => fs.statSync(path.join(dir, f)).mtimeMs;
  return path.join(dir, files.sort((a, b) => mtime(b) - mtime(a))[0]);
}
```

- [ ] **Step 6: Write the importer CLI**

Create `scripts/import-roster.mjs`:

```js
#!/usr/bin/env node
/**
 * npm run roster [-- path/to/roster.xlsx] [--on YYYY-MM-DD]
 *
 * Imports Locale's Employee Master Roster: the newest
 * Reference/Employee Master Roster*.xlsx unless a path is given. It writes:
 *   src/data/roster.ts           the work fields, committed
 *   src/data/roster.private.ts   birthdays, folder links and remarks, git-ignored
 * and reports who's new, who's gone and what changed since the last import.
 * `--on` sets the import date (the as-of date for every roster fact); it
 * defaults to today. Nothing is written if a row can't be placed.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { newestRoster, readRoster } from "./roster-lib.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DATA = path.join(ROOT, "src", "data");
const OUT = path.join(DATA, "roster.ts");
const OUT_PRIVATE = path.join(DATA, "roster.private.ts");

function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** What the last import committed, to report the changes. */
function previous() {
  if (!fs.existsSync(OUT)) return [];
  const m = /export const ROSTER: RosterRecord\[\] = (\[[\s\S]*\]);\s*$/.exec(fs.readFileSync(OUT, "utf8"));
  return m ? JSON.parse(m[1]) : [];
}

const label = (r) => r.name || `Vacant ${r.role}`;

function list(title, items) {
  if (!items.length) return;
  console.log(`\n${title} (${items.length}):`);
  for (const item of items) console.log(`  - ${item}`);
}

async function main() {
  const args = process.argv.slice(2);
  const at = args.indexOf("--on");
  const importedOn = at >= 0 ? args.splice(at, 2)[1] : today();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(importedOn ?? "")) throw new Error(`--on needs a date like 2026-10-06, not "${importedOn}".`);
  const file = args[0] ? path.resolve(args[0]) : newestRoster(path.join(ROOT, "Reference"));
  const overlay = JSON.parse(fs.readFileSync(path.join(DATA, "roster-overlay.json"), "utf8"));

  const { records, privateById, problems } = await readRoster(file, overlay);
  const before = previous();
  const source = { file: path.basename(file), importedOn };

  fs.writeFileSync(
    OUT,
    [
      `// Generated by \`npm run roster\` from ${source.file} on ${importedOn}. Don't edit by hand:`,
      "// change the spreadsheet, then run it again.",
      'import type { RosterRecord, RosterSource } from "./roster-types";',
      "",
      `export const ROSTER_SOURCE: RosterSource = ${JSON.stringify(source)};`,
      "",
      `export const ROSTER: RosterRecord[] = ${JSON.stringify(records, null, 2)};`,
      "",
    ].join("\n"),
  );
  fs.writeFileSync(
    OUT_PRIVATE,
    [
      `// Generated by \`npm run roster\` from ${source.file} on ${importedOn}. Git-ignored and never committed:`,
      "// birthdays, Employee Folder links and remarks from the Employee Master Roster.",
      'import type { RosterPrivate } from "./roster-types";',
      "",
      `export const ROSTER_PRIVATE: Record<string, RosterPrivate> | null = ${JSON.stringify(privateById, null, 2)};`,
      "",
    ].join("\n"),
  );

  const count = (s) => records.filter((r) => r.status === s && !r.vacant).length;
  console.log(
    `Imported ${source.file} as of ${importedOn}: ${count("active")} active, ${count("pending")} start TBA, ` +
      `${records.filter((r) => r.vacant).length} vacant, ${count("inactive")} inactive.`,
  );
  if (before.length) {
    const was = new Map(before.map((r) => [r.id, r]));
    const now = new Map(records.map((r) => [r.id, r]));
    list("New", records.filter((r) => !was.has(r.id)).map((r) => `${label(r)} (${r.status})`));
    list("Gone", before.filter((r) => !now.has(r.id)).map(label));
    list(
      "Changed",
      records.flatMap((r) => {
        const b = was.get(r.id);
        if (!b) return [];
        const keys = Object.keys({ ...b, ...r }).filter((k) => JSON.stringify(b[k]) !== JSON.stringify(r[k]));
        return keys.length
          ? [`${label(r)}: ${keys.map((k) => `${k} ${JSON.stringify(b[k] ?? null)} → ${JSON.stringify(r[k] ?? null)}`).join(", ")}`]
          : [];
      }),
    );
  }
  list("Coped with", problems);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
```

- [ ] **Step 7: Write the types, the stub and the alias**

Create `src/data/roster-types.ts`:

```ts
/**
 * The Employee Master Roster as the Launchpad holds it. `npm run roster`
 * (scripts/import-roster.mjs) writes `roster.ts` from the spreadsheet in
 * Reference/. Only work fields are committed: birthdays, Employee Folder links
 * and remarks go to the git-ignored `roster.private.ts`, because the repo is public.
 */

/** "pending" is an Active-sheet row marked TBA: a start still to confirm, or a vacant seat. */
export type RosterStatus = "active" | "pending" | "inactive";

export interface RosterRecord {
  /** Stable across imports: today's org-chart id, or a slug of the roster name. */
  id: string;
  /** A row named "TBA": a seat with nobody in it. */
  vacant?: true;
  /** "" for a vacant seat. A bracket in the roster ("Tim Hill (VIC)") becomes `note`. */
  name: string;
  note?: string;
  role: string;
  /** The legal entity: "Locale Homes Australia Pty Ltd". */
  company: string | null;
  /** "Locale Homes", "Locale Property Group", "Locale Wealth" or "Locale Financial". */
  division: string | null;
  /** One of the roster's seven departments. */
  department: string | null;
  /** A country. The Inactive sheet has no Location column. */
  location: string | null;
  /** The manager's id. Null for a leaver whose manager can't be found. */
  reportsTo: string | null;
  /** Reports To as the roster words it: "Adam Schaal / Yasmin Georgiadis". */
  reportsToText: string | null;
  /** "Contractor", "Employment - Full Time", "Employment - Part Time" or "Casual". */
  employmentType: string | null;
  /** "Passed", "On Probation" or "Failed". Null for N/A. */
  probation: string | null;
  /** ISO dates. */
  start: string | null;
  confirmation: string | null;
  end: string | null;
  status: RosterStatus;
  /** The Employee Folder cell links somewhere. The link itself is private. */
  folderOnFile: boolean;
}

export interface RosterSource {
  /** The spreadsheet's file name. */
  file: string;
  /** The import date (ISO): the as-of date for every roster fact. */
  importedOn: string;
}

/** Fields kept out of git. */
export interface RosterPrivate {
  birthday?: string;
  folderUrl?: string;
  remarks?: string;
}
```

Create `src/data/roster.private.stub.ts`:

```ts
import type { RosterPrivate } from "./roster-types";

/**
 * What a build without the git-ignored `roster.private.ts` gets: nothing. The
 * Launchpad then shows birthdays, folder links and remarks as "Kept locally".
 */
export const ROSTER_PRIVATE: Record<string, RosterPrivate> | null = null;
```

Create `src/data/roster-private.d.ts`:

```ts
/**
 * `@roster-private` is `roster.private.ts` when `npm run roster` has written it
 * here, and `roster.private.stub.ts` (null) when it hasn't. See
 * `turbopack.resolveAlias` in next.config.ts.
 */
declare module "@roster-private" {
  import type { RosterPrivate } from "@/data/roster-types";
  export const ROSTER_PRIVATE: Record<string, RosterPrivate> | null;
}
```

Read the "Resolving aliases" section of `node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/turbopack.md`. Then replace `next.config.ts` with:

```ts
import type { NextConfig } from "next";
import fs from "fs";
import path from "path";

// Birthdays, folder links and remarks from the Employee Master Roster live in a
// git-ignored file `npm run roster` writes. A clone without it builds with the
// stub, which shows them as "Kept locally". Restart `npm run dev` after the
// first import: the alias is read once, at start-up.
const rosterPrivate = fs.existsSync(path.resolve(__dirname, "src/data/roster.private.ts"))
  ? "./src/data/roster.private.ts"
  : "./src/data/roster.private.stub.ts";

const nextConfig: NextConfig = {
  turbopack: {
    root: path.resolve(__dirname),
    resolveAlias: {
      "@roster-private": rosterPrivate,
    },
  },
};

export default nextConfig;
```

Append to `.gitignore`:

```gitignore

# Employee Master Roster: birthdays, folder links and remarks (npm run roster). Never commit.
src/data/roster.private.ts
```

- [ ] **Step 8: Import the roster**

```bash
npm run roster -- "$ROSTER_XLSX" --on 2026-10-06
```

Expected output: `Imported Employee Master Roster 1.xlsx as of 2026-10-06: 79 active, 1 start TBA, 1 vacant, 31 inactive.`, followed by a "Coped with" list. That list is local output; don't paste it anywhere, since remarks never appear in it but names do. It should cover:
- the two text start dates (Ciaran Fahy, Nathan Good);
- the six Link cells with no link;
- Brendan Ford's vacant manager;
- Maria's two managers.

A few lines about leavers may follow.

Then:

```bash
git status --short src/data      # expect roster.ts and the new files; NOT roster.private.ts
git check-ignore -v src/data/roster.private.ts   # expect the .gitignore line
```

- [ ] **Step 9: Run the check and the type-check**

```bash
node scripts/check-roster.mjs "$ROSTER_XLSX"
npx tsc --noEmit
```

Expected: `check-roster: ok (112 rows from Employee Master Roster 1.xlsx)` (81 Active-sheet rows + 31 Inactive), and no tsc output. If a count assertion fails, compare it with the spec's section 1. The roster is the truth, so only change an expectation after re-reading the sheet.

- [ ] **Step 10: Document it**

In `README.md`, after the `## Run it` section's code block and its "Requires Node" line, add:

````md
## Employee records

Every employee record comes from Locale's **Employee Master Roster**, the HR spreadsheet kept (git-ignored) at
`Reference/Employee Master Roster*.xlsx`. When HR updates it:

```bash
npm run roster                    # reads the newest roster in Reference/, writes src/data/roster.ts, reports what changed
node scripts/check-roster.mjs     # re-checks the import (its counts are for the 6 Oct 2026 copy)
```

`src/data/roster.ts` (work fields) is committed. Birthdays, Employee Folder links and remarks go to
`src/data/roster.private.ts`, which git ignores, because this repo is public. A build without it shows them as
"Kept locally". Restart `npm run dev` after the first import. Deploy from git, never from a working copy that
has the private file. People, roles and reporting lines change in the spreadsheet; the Launchpad doesn't edit them.
`src/data/roster-overlay.json` holds what the roster doesn't: the directors, the names people go by, each
department's head and the placeholder sign-ins.
````

- [ ] **Step 11: Commit**

```bash
git add package.json package-lock.json .gitignore next.config.ts README.md scripts/roster-lib.mjs scripts/import-roster.mjs scripts/check-roster.mjs src/data/roster-types.ts src/data/roster-overlay.json src/data/roster.private.stub.ts src/data/roster-private.d.ts src/data/roster.ts
git status --short    # roster.private.ts must not be staged
git commit -m "Import the Employee Master Roster into src/data

npm run roster reads the xlsx in Reference/ and writes the work fields to
src/data/roster.ts. Birthdays, folder links and remarks go to a git-ignored
file that a Turbopack alias swaps for a stub when it's missing.

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: HR goes read-only

People now change in the roster, so the Launchpad's people editing goes. This includes Add person, Fill seat, Edit profile, department moves and the transition plumbing. Pay rates and one-off Pay stay. This task runs on today's data, before the swap.

**Files:**
- Delete: `src/components/modules/hr/AddPersonDialog.tsx`
- Rename: `src/components/modules/hr/master-list/EditPersonDialog.tsx` → `RatesDialog.tsx`
- Modify: `src/components/modules/hr/org-store.ts`, `OrgChart.tsx`, `master-list/parts.tsx`, `master-list/RecordDialog.tsx`, `master-list/PayDialog.tsx`, `tabs/HrMasterListTab.tsx`, `tabs/HrOverviewTab.tsx`
- Modify: `src/components/modules/employee/EmployeeDepartment.tsx`
- Scratch: `$S/pw/lib.mjs`, `$S/pw/hr-readonly.mjs`

**Interfaces:**
- Produces:
  - `useOrg(): OrgState`, where `OrgState = { people: OrgPerson[] }`. There's no `pending`, `scheduled` or `saving`.
  - `RatesDialog({ row, today, onClose, onView })`.
  - `type Mode = "view" | "rates" | "pay"`.

- [ ] **Step 1: Set up the browser checks**

```bash
mkdir -p "$S/pw" "$S/shots" && cd "$S/pw" && npm init -y >/dev/null && npm i playwright-core@^1.63.0
```

Create `$S/pw/lib.mjs`:

```js
import { chromium } from "playwright-core";

export const BASE = process.env.BASE ?? "http://localhost:3200";
const EXE = "C:/Users/Kane/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe";

/** A page at `path`, with every console error and page error collected. */
export async function open(path, { width = 1440, height = 900 } = {}) {
  const browser = await chromium.launch({ executablePath: EXE });
  const page = await browser.newPage({ viewport: { width, height }, acceptDownloads: true });
  const errors = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto(BASE + path, { waitUntil: "networkidle" });
  return { browser, page, errors };
}

export async function go(page, path) {
  await page.goto(BASE + path, { waitUntil: "networkidle" });
}

/** Fails the run on any console error, then closes. */
export async function done({ browser, errors }, name) {
  if (errors.length) {
    console.error(`${name}: console errors:\n  ${errors.join("\n  ")}`);
    process.exitCode = 1;
  } else console.log(`${name}: ok`);
  await browser.close();
}
```

Start the dev server in the worktree. Run it in the background and leave it running across tasks:

```bash
cd C:/Users/Kane/Desktop/Locale-launchpad-roster && npm run dev -- --port 3200
```

- [ ] **Step 2: Write the failing browser check**

Create `$S/pw/hr-readonly.mjs`:

```js
import assert from "node:assert/strict";
import { done, go, open } from "./lib.mjs";

const s = await open("/hr?tab=overview");
const { page } = s;
await page.getByText("Organisation chart").first().waitFor();
assert.equal(await page.getByRole("button", { name: "Add person" }).count(), 0, "no Add person");
assert.equal(await page.getByRole("button", { name: /^Add someone under/ }).count(), 0, "no + under seats");
assert.equal(await page.getByRole("button", { name: /^Add to / }).count(), 0, "no Add to team");
assert.equal(await page.getByRole("button", { name: "Fill seat" }).count(), 0, "no Fill seat");

await go(page, "/hr?tab=people");
await page.getByRole("button", { name: /^Rates for / }).first().click();
const dialog = page.getByRole("dialog");
await dialog.getByText(/^Pay rates · /).waitFor();
assert.equal(await dialog.getByRole("tab", { name: "Profile" }).count(), 0, "no Profile tab");
assert.equal(await dialog.getByText("Department", { exact: true }).count(), 0, "no Department tab");
await page.keyboard.press("Escape");

await page.getByRole("button", { name: /^View / }).first().click();
await page.getByRole("dialog").getByRole("button", { name: "Rates" }).waitFor();
await done(s, "hr-readonly");
```

Run: `node "$S/pw/hr-readonly.mjs"`. Expected: an assertion fails on `no Add person`.

- [ ] **Step 3: Make the org store read-only**

Replace `src/components/modules/hr/org-store.ts` with:

```ts
import { ORG_SEED, type OrgPerson } from "./data";

/**
 * The org chart, as the Employee Master Roster draws it. Read-only: people,
 * roles and reporting lines change in the roster and arrive with
 * `npm run roster`. Pay rates (`pay-store.ts`) are still edited here.
 */
export interface OrgState {
  people: OrgPerson[];
}

const STATE: OrgState = { people: ORG_SEED };

/** The chart every HR, Admin and Employee screen reads. */
export function useOrg(): OrgState {
  return STATE;
}
```

- [ ] **Step 4: Cut Edit down to pay rates**

```bash
git mv src/components/modules/hr/master-list/EditPersonDialog.tsx src/components/modules/hr/master-list/RatesDialog.tsx
git rm src/components/modules/hr/AddPersonDialog.tsx
```

In `RatesDialog.tsx`, make three edits.

1. Replace everything from line 1 to the end of `EditPersonDialog`, the closing `}` just before `/* ── Profile ── */`, with:

```tsx
"use client";

import * as React from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Eye, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";
import { EASE_OUT } from "@/lib/motion";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/input";
import { DatePicker, formatDayLong, toIso } from "@/components/ui/date-picker";
import { OVERTIME_MULTIPLIER, formatIsoDate, roundCents, type MasterRow, type PayRate } from "../data";
import { cancelRateChange, changeRates, money, overtimeBasis, usePay } from "../pay-store";
import { FieldError, MoneyInput, Notice, datePresets, parseMoney } from "./parts";

/**
 * Rates: someone's hourly and overtime pay from an effective date, which was
 * Edit › Pay rates. Everything else on their record comes from the Employee
 * Master Roster, so it changes there. A change effective today waits out the
 * 6s undo window before it reaches Horilla; a later date books it.
 */
export function RatesDialog({
  row,
  today,
  onClose,
  onView,
}: {
  row: MasterRow | null;
  today: Date;
  onClose: () => void;
  onView: (id: string) => void;
}) {
  const pay = usePay();
  const form = useRatesForm(row, row ? pay.rates[row.id] : undefined, today);
  const saving = row ? Boolean(pay.pending[row.id]) : false;

  return (
    <Dialog
      open={row !== null}
      onClose={onClose}
      size="lg"
      icon={Pencil}
      title={row ? `Pay rates · ${row.name}` : ""}
      description="Hourly and overtime, from an effective date. A change today reaches Horilla after 6 seconds to undo."
      footer={
        row ? (
          <>
            <Button variant="ghost" className="mr-auto" onClick={() => onView(row.id)} aria-label="View record">
              <Eye /> <span className="hidden sm:inline">View record</span>
            </Button>
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={() => form.save() && onClose()} disabled={!form.dirty || saving}>
              {form.booking ? "Book new rates" : "Save rates"}
            </Button>
          </>
        ) : null
      }
    >
      {row ? <RatesPanel row={row} form={form} saving={saving} booked={pay.scheduled[row.id]} today={today} /> : null}
    </Dialog>
  );
}
```

2. Delete the whole `/* ── Profile ── */` section, from that comment up to, not including, `/* ── Pay rates ── */`.

3. Delete from `/* ── Department ── */` to the end of the file.

The `/* ── Pay rates ── */` section stays exactly as it is: `Basis`, `basisOf`, `useRatesForm`, `Delta` and `RatesPanel`.

- [ ] **Step 5: Shared parts lose the booked move**

In `src/components/modules/hr/master-list/parts.tsx`:

- Replace the imports block's two lines

```tsx
import { addDays, formatDayLong, toIso } from "@/components/ui/date-picker";
import { ORG_BRANDS, formatIsoDate, orgDepartment, type MasterRow, type OrgPerson } from "../data";
import type { ScheduledTransfer } from "../org-store";
```

with

```tsx
import { addDays, toIso } from "@/components/ui/date-picker";
import { ORG_BRANDS, formatIsoDate, type MasterRow, type OrgPerson } from "../data";
```

- Delete the line `import { Button } from "@/components/ui/button";`.
- Change the header comment and `Mode`:

```tsx
/** Shared pieces of the Global Master List and its View, Rates and Pay dialogs. */

export type Mode = "view" | "rates" | "pay";
```

- Delete the whole `BookedMove` function and its doc comment.

- [ ] **Step 6: The record dialog loses moves and Edit**

In `src/components/modules/hr/master-list/RecordDialog.tsx`:

- Delete `import type { OrgState } from "../org-store";`.
- Remove `BookedMove, ` from the `./parts` import.
- In the props, delete `org,` from the destructuring and `org: Pick<OrgState, "pending" | "scheduled" | "saving">;` from the type.
- Delete `const booked = row ? org.scheduled[row.id] : undefined;`.
- Replace the `status` expression with:

```tsx
  const status = !row
    ? null
    : pay.pending[row.id]
      ? { label: "Saving…", tone: "neutral" as const }
      : row.takingOverFrom
        ? { label: "In transition", tone: "pending" as const }
        : row.isNew
          ? { label: "New starter", tone: "tone" as const }
          : { label: "Active", tone: "ok" as const };
```

- Delete `{booked ? <BookedMove booked={booked} /> : null}`.
- Replace the footer's Edit button with:

```tsx
            <Button onClick={() => onOpen(row.id, "rates")}>
              <Pencil /> Rates
            </Button>
```

- [ ] **Step 7: The master list loses moves and Edit**

In `src/components/modules/hr/tabs/HrMasterListTab.tsx`:

- **Imports:**
  - Delete `CalendarClock,` from the lucide import.
  - Replace `import { useOrg, type OrgState, type PendingKind, type ScheduledTransfer } from "../org-store";` with `import { useOrg } from "../org-store";`.
  - Replace `import { EMAIL_LINK, Email, shortDate, type Mode, type OpenFn } from "../master-list/parts";` with `import { EMAIL_LINK, Email, type Mode, type OpenFn } from "../master-list/parts";`.
  - Replace `import { EditPersonDialog } from "../master-list/EditPersonDialog";` with `import { RatesDialog } from "../master-list/RatesDialog";`.
- **Doc comment:** in the component's comment, replace "Pay (a one-off payment), View (the full record) and Edit (profile, pay rates, department)" with "Pay (a one-off payment), View (the full record) and Rates (pay rates)".
- **State:** replace `const { people, pending, scheduled, saving } = useOrg();` with `const { people } = useOrg();`. Delete `const org = { pending, scheduled, saving };`.
- **`viewProps`:** replace it with `const viewProps: ViewProps = { rows: shown, payPending: pay.pending, today, onOpen };`.
- **`RecordDialog`:** delete the `org={org}` line.
- **Dialogs:** replace the whole `<EditPersonDialog … />` element with:

```tsx
      <RatesDialog row={opened?.mode === "rates" ? openRow : null} today={today} onClose={close} onView={(id) => onOpen(id, "view")} />
```

- **`ViewProps`:** make it

```tsx
interface ViewProps {
  rows: MasterRow[];
  payPending: PayState["pending"];
  today: Date;
  onOpen: OpenFn;
}
```

- **`NameTags`:** replace it with:

```tsx
/** What follows a name: the chart's bracket note, the name they go by, a transition, then a state. */
function NameTags({ row, saving }: { row: MasterRow; saving?: boolean }) {
  const goesBy = row.record?.preferredName;
  return (
    <>
      {row.note ? <span className="text-xs whitespace-nowrap text-subtle-foreground">({row.note})</span> : null}
      {goesBy && goesBy !== row.note ? (
        <span className="text-xs whitespace-nowrap text-subtle-foreground">({goesBy})</span>
      ) : null}
      {row.takingOverFrom ? (
        <span className="text-xs whitespace-nowrap text-amber-700 dark:text-amber-300">(transition)</span>
      ) : null}
      {saving ? (
        <Pill tone="neutral" className="px-2 py-0">
          Saving…
        </Pill>
      ) : row.isNew ? (
        <Pill tone="tone" className="px-2 py-0">
          New
        </Pill>
      ) : null}
    </>
  );
}
```

- **`BookedLine`:** delete the function and its comment.
- **`RowActions`:** replace the third button with:

```tsx
      <Button variant="outline" size="xs" onClick={open("rates")} aria-label={`Rates for ${row.name}`}>
        <Pencil /> <span className="hidden sm:inline">Rates</span>
      </Button>
```

- **`MasterTable` and `MasterCards`:** both signatures become `({ rows, payPending, today, onOpen }: ViewProps)`. In each:
  - delete `const booked = scheduled[r.id];`;
  - delete every `booked ? … : null` use (the table's Department cell and the cards' "Moving" `CardLine`);
  - replace `saving={Boolean(saving[r.id] || payPending[r.id])}` with `saving={Boolean(payPending[r.id])}`;
  - drop the `pending=` prop from `NameTags`.

In `src/components/modules/hr/master-list/PayDialog.tsx`, replace both occurrences of `Set one in Edit › Pay rates first.` with `Set one in Rates first.`.

- [ ] **Step 8: The org chart loses its add controls**

In `src/components/modules/hr/OrgChart.tsx`:

1. **Imports:**
   - The lucide import becomes `import { ArrowRight, Maximize2, Minimize2, Minus, Plus, Scan, UserRound } from "lucide-react";`.
   - Replace the two lines `import { useOrg, type PendingKind } from "./org-store";` and `import { AddPersonDialog, type AddTarget } from "./AddPersonDialog";` with `import { useOrg } from "./org-store";`.
2. **Doc comment:** replace its last paragraph (from "Adding someone:" to the end of the comment) with:

```tsx
 * Read-only: people, roles and reporting lines change in the Employee Master
 * Roster and arrive with `npm run roster`.
 */
```

3. **`ChartCtx`:** becomes

```tsx
interface ChartCtx {
  byId: Map<string, OrgPerson>;
  /** Seats drawn beneath a seat, in chart order. */
  reportsOf: (id: string) => OrgPerson[];
  counts: Record<OrgDepartmentId, number>;
  openDept: (id: OrgDepartmentId) => void;
}
```

4. **`OrgChartCard`'s opening,** from `export function OrgChartCard() {` through `const root = people.find((p) => p.managerId === null);`, becomes:

```tsx
export function OrgChartCard() {
  const { people } = useOrg();
  const reduce = useReducedMotion();
  const [view, setView] = React.useState<OrgView>("all");

  const chart = React.useMemo(() => {
    const byId = new Map(people.map((p) => [p.id, p]));
    const beneath = new Map<string, OrgPerson[]>();
    for (const p of people) {
      if (!p.managerId || p.link) continue;
      beneath.set(p.managerId, [...(beneath.get(p.managerId) ?? []), p]);
    }
    const counts = Object.fromEntries(ORG_DEPARTMENTS.map((d) => [d.id, 0])) as Record<OrgDepartmentId, number>;
    for (const p of people) if (p.name) counts[orgDepartmentOf(people, p.id)] += 1;
    return { byId, reportsOf: (id: string) => beneath.get(id) ?? [], counts };
  }, [people]);

  const named = people.filter((p) => p.name).length;
  const vacant = people.length - named;

  const ctx = React.useMemo<ChartCtx>(() => ({ ...chart, openDept: setView }), [chart]);

  const root = people.find((p) => p.managerId === null);
```

5. **`CardMeta`:** keeps only the `<span>{named} people…</span>`. Delete the Add person `<Button>`.
6. **`ChartCanvas`:** delete `ref={canvasRef}` from it.
7. **Footer hint:** becomes `Double-click or Ctrl + scroll to zoom · drag to move`.
8. **`AddPersonDialog`:** delete the `<AddPersonDialog … />` element.
9. **`PersonNode`:** replace it with:

```tsx
function PersonNode({ person: p, root }: { person: OrgPerson; root?: boolean; side?: boolean }) {
  const vacant = p.name === null;

  return (
    <div data-org-id={p.id} className="relative w-48 shrink-0">
      <div
        className={cn(
          "relative flex items-start gap-2.5 overflow-hidden rounded-lg border bg-card py-2.5 pr-3 pl-3.5 shadow-xs",
          root ? "border-zinc-400 dark:border-zinc-500" : "border-border",
          vacant && "border-dashed border-zinc-400 bg-canvas shadow-none dark:border-zinc-500",
        )}
      >
        <BrandRim brands={p.brands} />
        {vacant ? (
          <span
            aria-hidden
            className="flex size-7 shrink-0 items-center justify-center rounded-full border border-dashed border-zinc-400 text-subtle-foreground dark:border-zinc-500"
          >
            <UserRound className="size-3.5" />
          </span>
        ) : (
          <Avatar name={p.name!} tone={orgTone(p.brands)} size="sm" />
        )}
        <div className="min-w-0 flex-1">
          <p className="text-[13px] leading-tight font-semibold break-words">
            {vacant ? <span className="text-muted-foreground">Vacant</span> : p.name}
            {p.note ? <span className="font-normal text-muted-foreground"> ({p.note})</span> : null}
          </p>
          <p className="mt-0.5 text-xs leading-snug text-muted-foreground">
            {p.role}
            <span className="sr-only"> · {brandWords(p.brands)}</span>
          </p>
          {p.transition ? (
            <p className="mt-1 text-xs leading-snug text-amber-700 dark:text-amber-300">
              {p.transition} (transition)
            </p>
          ) : null}
          {p.isNew ? (
            <Pill tone="tone" className="mt-1.5 px-2 py-0">
              New
            </Pill>
          ) : null}
        </div>
      </div>
    </div>
  );
}
```

10. **`TeamBlock`:** replace it with the version below, and make `Branches` build it as `<TeamBlock key={`team:${team}`} team={team} members={members} />`:

```tsx
/** A manager's like seats as one block, like the paper chart's coloured lists. */
function TeamBlock({ team, members }: { team: string; members: OrgPerson[] }) {
  const brand = members[0]?.brands?.[0] ?? "group";
  const wash = WASH[brand];

  return (
    <div className={cn("w-48 shrink-0 overflow-hidden rounded-lg border", wash.box)}>
      <p className={cn("flex items-baseline gap-2 px-3 pt-2.5 pb-1.5", wash.ink)}>
        <span className="min-w-0 flex-1 text-[10px] leading-tight font-semibold tracking-[0.12em] uppercase">
          {team}
        </span>
        <span className="text-[10px] font-semibold tabular-nums">{members.length}</span>
      </p>
      <ul className="px-1.5 pb-1.5">
        {members.map((m) => (
          <li key={m.id} data-org-id={m.id} className="flex items-center gap-2 rounded-md px-1.5 py-1">
            <Avatar name={m.name ?? "?"} tone={orgTone(m.brands)} size="xs" />
            <span className="min-w-0 flex-1 truncate text-[13px]" title={m.name ?? undefined}>
              {m.name ?? "Vacant"}
              {m.note ? <span className="text-muted-foreground"> ({m.note})</span> : null}
              {m.role !== members[0].role ? <span className="sr-only"> · {m.role}</span> : null}
            </span>
            {m.isNew ? (
              <Pill tone="tone" className="px-1.5 py-0">
                New
              </Pill>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
```

`ChartCanvas` keeps its `forwardRef` and `reveal` handle. Nothing passes a ref now, and that's harmless.

In `src/components/modules/hr/tabs/HrOverviewTab.tsx`'s doc comment, replace "and the group's org chart, where HR can add someone under any department." with "and the group's org chart.".

- [ ] **Step 9: Employee › Department loses HR's pending marks**

In `src/components/modules/employee/EmployeeDepartment.tsx`:

- **Org store:** the import becomes `import { useOrg } from "@/components/modules/hr/org-store";`, and `const { people, pending } = useOrg();` becomes `const { people } = useOrg();`.
- **`MemberCards` call:** `<MemberCards rows={shown} headId={dept.headId} today={today} onOpen={setOpenId} />`.
- **`NameTags`:** its comment becomes `/** What follows a name: You, Head or New. */`, and its signature `function NameTags({ row, headId }: { row: MasterRow; headId: string })`. Its last block becomes:

```tsx
      {row.isNew && row.id !== EMPLOYEE_ID ? (
        <Pill tone="tone" className="px-2 py-0">
          New
        </Pill>
      ) : null}
```

- **`MemberCards`:** delete the `pending` parameter and its `pending: Record<string, PendingKind>;` type line, and call `<NameTags row={r} headId={headId} />`.

- [ ] **Step 10: Verify**

```bash
npx tsc --noEmit
grep -rn "AddPersonDialog\|EditPersonDialog\|transferNow\|scheduleTransfer\|updateProfile\|PendingKind" src   # expect nothing
node "$S/pw/hr-readonly.mjs"
```

Expected: tsc is clean, grep finds nothing, and the script prints `hr-readonly: ok`.

- [ ] **Step 11: Commit**

```bash
git add -A src/components/modules/hr src/components/modules/employee/EmployeeDepartment.tsx
git commit -m "Make HR read-only for people; keep pay rates

People, roles and reporting lines now change in the Employee Master Roster.
Edit becomes Rates, and Add person, Fill seat and department moves go.

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: The people model

A new module builds everything about people from the roster. Nothing imports it yet, so this task changes no screen.

**Files:**
- Create: `src/components/modules/hr/people.ts`
- Scratch: `$S/tsconfig.check.json`, `$S/check-people.mts`

**Interfaces:**
- Consumes: `ROSTER`, `ROSTER_SOURCE` (`@/data/roster`); `ROSTER_PRIVATE` (`@roster-private`); the overlay JSON.
- Produces:
  - **Dates and roster:** `AS_OF`, `ROSTER_SOURCE`, `NEW_SINCE`, `daysFromImport(iso)`.
  - **Departments:** `ORG_DEPARTMENTS` (8 entries), `type OrgDepartmentId` (`"leadership" | "finance" | "sales" | "marketing" | "operations" | "it" | "accounting" | "executive"`), `orgDepartment(id)`, `orgDepartmentOf(people, id)`.
  - **Brands:** `type OrgBrand`, `ORG_BRANDS`, `orgTone(brands)`.
  - **Org chart:** `interface OrgPerson` (with `department: OrgDepartmentId`), `ORG_SEED`, `orgReports(people, id)`.
  - **Records and rows:** `type EmployeeRecord = RosterRecord`, `EMPLOYEE_RECORDS`, `type PersonStatus` (`"active" | "probation" | "starting" | "inactive"`), `statusOf(record)`, `interface MasterRow`, `masterList(people)`, `staffList(people)`, `signInFor(name, taken)`.
  - **Counts:** `EMPLOYED`, `VACANCIES`, `HR_KPIS` (`{ totalEmployees, onLeaveToday, newJoiners, openPositions }`), `DIVISIONS`, `ON_PROBATION`.
  - **Private fields:** `HAS_PRIVATE`, `rosterPrivate(id)`.
  - **Pay:** `type PayRate`, `RATE_REVIEW`, `OVERTIME_MULTIPLIER`, `roundCents`, `seedPayRate(row)`.

`MasterRow` is:

```ts
interface MasterRow {
  id: string;
  name: string;
  role: string;
  note?: string;
  preferredName?: string;
  brands?: OrgBrand[];
  managerId: string | null;
  link?: "peer" | "assistant";
  department: OrgDepartmentId;
  isNew?: boolean;
  status: PersonStatus;
  workEmail: string | null;
  record?: EmployeeRecord;
  director?: true;
}
```

- [ ] **Step 1: Write the failing check**

Create `$S/tsconfig.check.json`:

```json
{
  "extends": "C:/Users/Kane/Desktop/Locale-launchpad-roster/tsconfig.json",
  "compilerOptions": {
    "baseUrl": "C:/Users/Kane/Desktop/Locale-launchpad-roster",
    "paths": {
      "@/*": ["./src/*"],
      "@roster-private": ["./src/data/roster.private.stub.ts"]
    }
  }
}
```

Create `$S/check-people.mts`:

```ts
import assert from "node:assert/strict";

const P = await import("file:///C:/Users/Kane/Desktop/Locale-launchpad-roster/src/components/modules/hr/people.ts");

assert.equal(P.AS_OF, "2026-10-06");
assert.equal(P.NEW_SINCE, "2026-09-06");

// The chart: 2 directors + 80 roster people + 1 vacant seat.
const seat = (id: string) => P.ORG_SEED.find((p: { id: string }) => p.id === id);
assert.equal(P.ORG_SEED.length, 83);
assert.equal(P.ORG_SEED.filter((p: { name: string | null }) => p.name).length, 82);
assert.equal(seat("adam-schaal").managerId, null);
assert.equal(seat("yasmin-georgiadis").link, "peer");
assert.equal(seat("maria-soriano").link, "assistant");
assert.equal(seat("advocate-manager-qld").name, null);
assert.equal(seat("brad-linford").name, "Bradley Linford");

// Departments are the roster's field, not the tree's.
assert.equal(P.orgDepartmentOf(P.ORG_SEED, "jan-kane-reroma"), "it");
assert.equal(P.orgDepartmentOf(P.ORG_SEED, "alison-carter"), "operations");
assert.equal(P.orgDepartmentOf(P.ORG_SEED, "advocate-manager-qld"), "sales");
assert.equal(P.orgDepartmentOf(P.ORG_SEED, "adam-schaal"), "leadership");
assert.equal(P.orgDepartmentOf(P.ORG_SEED, "maria-soriano"), "executive");
for (const d of P.ORG_DEPARTMENTS) assert.ok(seat(d.headId)?.name, `head of ${d.id} is on the chart`);
assert.equal(P.orgDepartment("it").name, "Information Technology");

// Brands from Division; Locale Property Group has none.
assert.deepEqual(seat("brad-linford").brands, ["financial"]);
assert.deepEqual(seat("conor-lloyd-fox").brands, ["wealth"]);
assert.equal(seat("kellie-boyer").brands, undefined);

// Team blocks are worked out: 2+ like reports who lead no one.
assert.equal(seat("ankit-kausik").team, "Finance Brokers");
assert.equal(seat("lane-dula").team, "Broker Support");
assert.equal(seat("brett-jenkinson").team, "New Home Advocates");
assert.equal(seat("khai-tran").team, "Property Investment Partners");
assert.equal(seat("andre-mikhail-serra").team, "AI Engineers");
assert.equal(seat("tristan-hatt").team, undefined, "the only advocate under Sean");
assert.equal(seat("brendan-ford").team, undefined);

// New: started in the 30 days to the import, or not yet.
assert.equal(seat("jan-kane-reroma").isNew, true);
assert.equal(seat("christopher-wootton").isNew, true);
assert.equal(seat("lane-dula").isNew, undefined);

// The master list: everyone named, plus the 31 leavers, A to Z.
const rows = P.masterList(P.ORG_SEED);
const row = (id: string) => rows.find((r: { id: string }) => r.id === id);
assert.equal(rows.length, 82 + 31);
const names = rows.map((r: { name: string }) => r.name);
assert.deepEqual(names, [...names].sort((a, b) => a.localeCompare(b)));
assert.equal(row("christopher-wootton").status, "starting");
assert.equal(row("candice-joyce").status, "starting", "starts 13 Oct, after the import");
assert.equal(row("edward-matkovic").status, "active", "started 5 Oct");
assert.equal(row("aled-smith").status, "probation");
assert.equal(row("raymond-shanks").status, "inactive");
assert.equal(row("raymond-shanks").workEmail, null);
assert.equal(row("adam-schaal").director, true);
assert.equal(row("adam-schaal").record, undefined);
assert.equal(row("brad-linford").preferredName, "Brad");
assert.equal(row("jan-kane-reroma").preferredName, "Kane");
assert.equal(row("jan-kane-reroma").record.start, "2026-09-29");

// Sign-ins: placeholders carried over, first@ for anyone new, all unique.
assert.equal(row("jan-kane-reroma").workEmail, "jan@localegroup.au");
assert.equal(row("luisa-travan").workEmail, "luisa@localegroup.au");
const emails = rows.map((r: { workEmail: string | null }) => r.workEmail).filter(Boolean);
assert.equal(new Set(emails).size, emails.length, "every sign-in is unique");
assert.equal(P.signInFor("Adam Example", new Set(["adam@localegroup.au"])), "adame@localegroup.au");
assert.equal(P.signInFor("Adam Example", new Set(["adam@localegroup.au", "adame@localegroup.au"])), "adam2@localegroup.au");

// Missing and future dates never produce NaN anywhere downstream.
const noStart = rows.filter((r: { status: string; record?: { start: string | null } }) => r.status === "inactive" && !r.record?.start);
assert.equal(noStart.length, 7, "seven leavers have no start date");

// Staff (no leavers) and the headcounts, as of 6 Oct 2026.
assert.equal(P.staffList(P.ORG_SEED).length, 82);
assert.deepEqual({ ...P.HR_KPIS }, { totalEmployees: 76, onLeaveToday: 1, newJoiners: 9, openPositions: 1 });
assert.deepEqual(P.DIVISIONS, [
  { name: "Locale Homes", count: 39, share: 51 },
  { name: "Locale Property Group", count: 19, share: 25 },
  { name: "Locale Wealth", count: 10, share: 13 },
  { name: "Locale Financial", count: 8, share: 11 },
]);
assert.deepEqual(
  P.ON_PROBATION.map((r: { id: string }) => r.id),
  ["aled-smith", "oli-chevellas", "kristen-jackson", "hayden-wilson", "larnie-clark"],
);
assert.equal(P.daysFromImport("2026-10-17"), 11);

// Seed pay rates: everyone still here with a roster record has one; directors and leavers don't.
for (const r of P.staffList(P.ORG_SEED)) if (r.record) assert.ok(P.seedPayRate(r), `a rate for ${r.role}`);
assert.equal(P.seedPayRate(row("adam-schaal")), null);
assert.equal(P.seedPayRate(row("raymond-shanks")), null);
assert.deepEqual(P.seedPayRate(row("jan-kane-reroma")), { hourly: 55, overtime: 82.5, effective: "2026-09-29" });

// The check runs against the stub: no private fields.
assert.equal(P.HAS_PRIVATE, false);
assert.equal(P.rosterPrivate("jan-kane-reroma"), null);

console.log("check-people: ok");
```

Run:

```bash
npx -y tsx --tsconfig "$S/tsconfig.check.json" "$S/check-people.mts"
```

Expected: a module-not-found error for `people.ts`.

- [ ] **Step 2: Write `people.ts`**

Create `src/components/modules/hr/people.ts`:

```ts
/**
 * Locale's people, from the Employee Master Roster. `npm run roster` writes
 * `src/data/roster.ts` from the spreadsheet; `src/data/roster-overlay.json`
 * adds what the roster doesn't hold: the two directors, the ids people had
 * before the roster (so grants and seeds keep pointing at them), the names
 * people go by, each department's head, and the Launchpad sign-ins.
 *
 * The org chart, the Global Master List, the headcounts and the seed pay rates
 * all come from here. Every roster fact (status, "new", the counts) is as of
 * the import date, so the server and the client agree and the figures match
 * the snapshot. Only tenure runs on the viewer's clock.
 */
import { ROSTER, ROSTER_SOURCE } from "@/data/roster";
import type { RosterPrivate, RosterRecord } from "@/data/roster-types";
import OVERLAY from "@/data/roster-overlay.json";
import { ROSTER_PRIVATE } from "@roster-private";

export { ROSTER_SOURCE };

/** The as-of date for every roster fact: the day it was imported. */
export const AS_OF = ROSTER_SOURCE.importedOn;

const DAY = 86_400_000;
const utc = (iso: string) => Date.parse(`${iso}T00:00:00Z`);
const shiftIso = (iso: string, days: number) => new Date(utc(iso) + days * DAY).toISOString().slice(0, 10);

/** Whole days from the import date to `iso`: negative once it's past. */
export const daysFromImport = (iso: string) => Math.round((utc(iso) - utc(AS_OF)) / DAY);

/** Started in the 30 days up to the import, or not yet: "New" on the chart. */
export const NEW_SINCE = shiftIso(AS_OF, -30);

interface Director {
  id: string;
  name: string;
  role: string;
  reportsTo: string | null;
  link?: "peer" | "assistant";
}

const DIRECTORS = OVERLAY.directors as Director[];
const GOES_BY: Record<string, string> = OVERLAY.goesBy;
const LINKS = OVERLAY.links as Record<string, "peer" | "assistant">;
const HEADS = OVERLAY.departmentHeads;

/* ── Departments ───────────────────────────────────────────────────────── */

/**
 * The roster's seven departments, plus Leadership for the two directors. A
 * department is a field on each roster row. Its head is fixed here, because
 * members can report outside it (Alison Carter is Operations, under Sean).
 */
export const ORG_DEPARTMENTS = [
  { id: "leadership", name: "Leadership", headId: HEADS.leadership },
  { id: "finance", name: "Finance", headId: HEADS.finance },
  { id: "sales", name: "Sales", headId: HEADS.sales },
  { id: "marketing", name: "Marketing", headId: HEADS.marketing },
  { id: "operations", name: "Operations", headId: HEADS.operations },
  { id: "it", name: "Information Technology", headId: HEADS.it },
  { id: "accounting", name: "Accounting", headId: HEADS.accounting },
  { id: "executive", name: "Executive Office", headId: HEADS.executive },
] as const;

export type OrgDepartmentId = (typeof ORG_DEPARTMENTS)[number]["id"];

export const orgDepartment = (id: OrgDepartmentId) => ORG_DEPARTMENTS.find((d) => d.id === id)!;

const DEPARTMENT_BY_NAME = new Map<string, OrgDepartmentId>(ORG_DEPARTMENTS.map((d) => [d.name, d.id]));

/** A roster department → its id. The import refuses a department it doesn't know. */
const departmentOf = (name: string | null): OrgDepartmentId => (name ? DEPARTMENT_BY_NAME.get(name) : undefined) ?? "leadership";

/* ── Brands ────────────────────────────────────────────────────────────── */

export type OrgBrand = "homes" | "financial" | "wealth";

export const ORG_BRANDS: Record<OrgBrand, { label: string; tone: "haven" | "nectar" | "skyblue" }> = {
  homes: { label: "Locale Homes", tone: "haven" },
  financial: { label: "Locale Financial", tone: "nectar" },
  wealth: { label: "Locale Wealth", tone: "skyblue" },
};

/** Division → sub-brand. Locale Property Group is the group itself: no sub-brand. */
const BRAND_BY_DIVISION: Record<string, OrgBrand> = {
  "Locale Homes": "homes",
  "Locale Financial": "financial",
  "Locale Wealth": "wealth",
};

const brandsOf = (division: string | null): OrgBrand[] | undefined => {
  const brand = division ? BRAND_BY_DIVISION[division] : undefined;
  return brand ? [brand] : undefined;
};

/** A seat's avatar colour: its sub-brand's tint, or charcoal for the group. */
export const orgTone = (brands?: OrgBrand[]) => (brands?.length ? ORG_BRANDS[brands[0]].tone : "charcoal");

/* ── Org chart ─────────────────────────────────────────────────────────── */

export interface OrgPerson {
  id: string;
  /** Null while the seat is vacant ("TBA" on the roster). */
  name: string | null;
  role: string;
  /** The seat they report to. Null only for the managing director. */
  managerId: string | null;
  /** Drawn beside the manager on a dotted line (a board seat) or off the stem (an assistant), not beneath. */
  link?: "peer" | "assistant";
  /** A manager's block of like seats, drawn as one list: "New Home Advocates". */
  team?: string;
  /** The sub-brand the seat works for. None means the group. */
  brands?: OrgBrand[];
  /** Shown in brackets after the name: a state, or another name. */
  note?: string;
  /** Started in the 30 days to the import, or not yet: "New" on the chart. */
  isNew?: boolean;
  /** The roster's department. */
  department: OrgDepartmentId;
}

/** "New Home Advocate" → "New Home Advocates". "Broker Support" already names the team. */
const teamName = (role: string) => (/Support$/.test(role) ? role : `${role}s`);

function seatOf(r: RosterRecord): OrgPerson {
  const brands = brandsOf(r.division);
  return {
    id: r.id,
    name: r.vacant ? null : r.name,
    role: r.role,
    managerId: r.reportsTo,
    department: departmentOf(r.department),
    ...(LINKS[r.id] ? { link: LINKS[r.id] } : {}),
    ...(brands ? { brands } : {}),
    ...(r.note ? { note: r.note } : {}),
    ...(!r.vacant && r.start && r.start >= NEW_SINCE ? { isNew: true } : {}),
  };
}

/** Two or more reports of one manager who share a role and lead no one draw as one block. */
function withTeams(people: OrgPerson[]): OrgPerson[] {
  const leads = new Set(people.map((p) => p.managerId));
  const groups = new Map<string, OrgPerson[]>();
  for (const p of people) {
    if (!p.managerId || p.link || leads.has(p.id)) continue;
    const key = `${p.managerId}|${p.role}`;
    groups.set(key, [...(groups.get(key) ?? []), p]);
  }
  const team = new Map<string, string>();
  for (const members of groups.values()) if (members.length > 1) for (const m of members) team.set(m.id, teamName(m.role));
  return people.map((p) => (team.has(p.id) ? { ...p, team: team.get(p.id) } : p));
}

/** The chart: the two directors, then the roster's Active sheet (vacant seats included), in sheet order. */
export const ORG_SEED: OrgPerson[] = withTeams([
  ...DIRECTORS.map(
    (d): OrgPerson => ({
      id: d.id,
      name: d.name,
      role: d.role,
      managerId: d.reportsTo,
      department: "leadership",
      ...(d.link ? { link: d.link } : {}),
    }),
  ),
  ...ROSTER.filter((r) => r.status !== "inactive").map(seatOf),
]);

/** Seats drawn beneath this one (not its board peers or assistants), in chart order. */
export function orgReports(people: OrgPerson[], id: string): OrgPerson[] {
  return people.filter((p) => p.managerId === id && !p.link);
}

/** The department a seat belongs to: the roster's, Leadership for the directors. */
export function orgDepartmentOf(people: OrgPerson[], id: string): OrgDepartmentId {
  return people.find((p) => p.id === id)?.department ?? "leadership";
}

/* ── Records and the master list ───────────────────────────────────────── */

/** Someone's row on the Employee Master Roster. */
export type EmployeeRecord = RosterRecord;

/** Every person on the roster, leavers included, by id. */
export const EMPLOYEE_RECORDS: Record<string, EmployeeRecord> = Object.fromEntries(
  ROSTER.filter((r) => !r.vacant).map((r) => [r.id, r]),
);

/** A Launchpad sign-in for someone new: first@, then with their surname's initial, then numbered. */
export function signInFor(name: string, taken: Set<string>): string {
  const words = name
    .toLowerCase()
    .replace(/[^a-z\s-]/g, "")
    .split(/[\s-]+/)
    .filter(Boolean);
  const first = words[0] ?? "staff";
  const initial = words.length > 1 ? words[words.length - 1][0] : "";
  for (const local of [first, `${first}${initial}`]) {
    if (!taken.has(`${local}@localegroup.au`)) return `${local}@localegroup.au`;
  }
  for (let n = 2; ; n++) if (!taken.has(`${first}${n}@localegroup.au`)) return `${first}${n}@localegroup.au`;
}

/** Sign-ins: today's placeholders, then one each for anyone new. Placeholders until the roster has emails. */
const SIGN_INS: Record<string, string> = (() => {
  const out: Record<string, string> = { ...OVERLAY.placeholderEmails };
  const taken = new Set(Object.values(out));
  for (const r of ROSTER) {
    if (r.vacant || r.status === "inactive" || out[r.id]) continue;
    out[r.id] = signInFor(r.name, taken);
    taken.add(out[r.id]);
  }
  return out;
})();

export type PersonStatus = "active" | "probation" | "starting" | "inactive";

/** Where someone stands on the import date. */
export function statusOf(r: RosterRecord): PersonStatus {
  if (r.status === "inactive") return "inactive";
  if (r.status === "pending" || !r.start || r.start > AS_OF) return "starting";
  if (r.probation === "On Probation") return "probation";
  return "active";
}

/** One person on the master list: their seat on the chart plus their roster record. */
export interface MasterRow {
  id: string;
  name: string;
  role: string;
  /** Shown in brackets after the name, as on the chart: "VIC", "Jay Tan". */
  note?: string;
  /** The name they go by: "Brad", "Kane". */
  preferredName?: string;
  brands?: OrgBrand[];
  managerId: string | null;
  link?: OrgPerson["link"];
  department: OrgDepartmentId;
  isNew?: boolean;
  status: PersonStatus;
  /** Their Launchpad sign-in, a placeholder until the roster has emails. Null once they've left. */
  workEmail: string | null;
  /** Their roster row. Missing for the two directors, who aren't on the roster. */
  record?: EmployeeRecord;
  director?: true;
}

/**
 * Everyone on the master list, A to Z: each named seat on the chart (the
 * directors included), plus everyone on the roster's Inactive sheet. Vacant
 * seats aren't people, so they stay off.
 */
export function masterList(people: OrgPerson[]): MasterRow[] {
  const rows: MasterRow[] = [];
  for (const p of people) {
    if (p.name === null) continue;
    const record = EMPLOYEE_RECORDS[p.id];
    rows.push({
      id: p.id,
      name: p.name,
      role: p.role,
      ...(p.note ? { note: p.note } : {}),
      ...(GOES_BY[p.id] ? { preferredName: GOES_BY[p.id] } : {}),
      brands: p.brands,
      managerId: p.managerId,
      link: p.link,
      department: p.department,
      isNew: p.isNew,
      status: record ? statusOf(record) : "active",
      workEmail: SIGN_INS[p.id] ?? null,
      ...(record ? { record } : { director: true as const }),
    });
  }
  for (const r of ROSTER) {
    if (r.status !== "inactive" || r.vacant) continue;
    rows.push({
      id: r.id,
      name: r.name,
      role: r.role,
      ...(r.note ? { note: r.note } : {}),
      brands: brandsOf(r.division),
      managerId: r.reportsTo,
      department: departmentOf(r.department),
      status: "inactive",
      workEmail: null,
      record: r,
    });
  }
  return rows.sort((a, b) => a.name.localeCompare(b.name));
}

/** Everyone still with Locale: the master list without the leavers. Admin, Accounting and Department read this. */
export const staffList = (people: OrgPerson[]) => masterList(people).filter((r) => r.status !== "inactive");

/* ── Headcounts ────────────────────────────────────────────────────────── */

/** On the books by the import date: roster staff who have started. The directors aren't on the roster. */
export const EMPLOYED: MasterRow[] = staffList(ORG_SEED).filter(
  (r) => r.record && (r.status === "active" || r.status === "probation"),
);

/** Seats the roster lists with nobody in them. */
export const VACANCIES: OrgPerson[] = ORG_SEED.filter((p) => !p.name);

export const HR_KPIS = {
  totalEmployees: EMPLOYED.length,
  /** Sample: leave is Horilla's. */
  onLeaveToday: 1,
  newJoiners: EMPLOYED.filter((r) => (r.record?.start ?? "") >= NEW_SINCE).length,
  openPositions: VACANCIES.length,
};

/** Division, headcount and share of headcount (%), biggest first. */
export const DIVISIONS: { name: string; count: number; share: number }[] = (() => {
  const counts = new Map<string, number>();
  for (const r of EMPLOYED) {
    const division = r.record?.division ?? "Unknown";
    counts.set(division, (counts.get(division) ?? 0) + 1);
  }
  return [...counts]
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => ({ name, count, share: Math.round((count / EMPLOYED.length) * 100) }));
})();

/** Everyone on probation, the soonest confirmation first. */
export const ON_PROBATION: MasterRow[] = EMPLOYED.filter((r) => r.status === "probation").sort((a, b) =>
  (a.record?.confirmation ?? "9999").localeCompare(b.record?.confirmation ?? "9999"),
);

/* ── Private fields ────────────────────────────────────────────────────── */

/** Built with the git-ignored roster.private.ts. Without it, birthdays, folder links and remarks are "Kept locally". */
export const HAS_PRIVATE = ROSTER_PRIVATE !== null;

/** Someone's private roster fields; null in a build without them. */
export const rosterPrivate = (id: string): RosterPrivate | null => (ROSTER_PRIVATE ? (ROSTER_PRIVATE[id] ?? {}) : null);

/* ── Pay rates ─────────────────────────────────────────────────────────── */

/** An hourly pay rate in AUD: ordinary time and overtime, and the day it applies from. */
export interface PayRate {
  hourly: number;
  overtime: number;
  /** Effective date (ISO). */
  effective: string;
}

/** The last rate review (start of the financial year). Seed rates apply from here, or from the start date if later. */
export const RATE_REVIEW = "2026-07-01";

/** Overtime is time-and-a-half unless set otherwise. */
export const OVERTIME_MULTIPLIER = 1.5;

/** Ordinary hourly rate by the roster's position titles (AUD, before super). Placeholder until Horilla is wired in. */
const HOURLY_BY_ROLE: Record<string, number> = {
  "Head of Finance": 92,
  "Finance Broker": 52,
  "Broker Support": 34,
  "Head of Sales": 95,
  "Advocate Manager WA": 62,
  "Advocate Manager VIC": 62,
  "Advocate Manager QLD": 62,
  "New Home Advocate": 40,
  "Sales Operations Manager": 58,
  "Workflow & Compliance Lead": 46,
  "Sales Associate": 36,
  "Operations Manager": 60,
  "Business Development Manager": 60,
  "Wealth Manager": 70,
  "Property Investment Partner": 48,
  "Head of Marketing": 88,
  "Marketing Manager - Wealth & Financial": 58,
  "Marketing Manager - Homes": 58,
  "Group Performance Manager": 64,
  "Social Media Lead": 44,
  "Marketing & Content Coordinator": 36,
  "Marketing Specialist": 42,
  "Senior Video Editor & Content Production Lead": 48,
  "Graphic Designer": 40,
  "Senior Media Buyer": 50,
  "Company Accountant": 72,
  "Head of AI & Growth Systems": 90,
  "IT Systems Engineer": 52,
  "AI Engineer": 55,
  "Senior Executive Assistant": 42,
};

/** Cents-safe rounding for a dollar figure. */
export const roundCents = (n: number) => Math.round(n * 100) / 100;

/**
 * Someone's rate at the last review: their position's rate plus 50c an hour
 * for each full year of service (up to five), overtime at time-and-a-half.
 * Null for the directors, leavers, and a position with no rate on file.
 */
export function seedPayRate(row: MasterRow): PayRate | null {
  const start = row.record?.start;
  const base = HOURLY_BY_ROLE[row.role];
  if (base == null || !start || row.status === "inactive") return null;
  const [y, m, d] = start.split("-").map(Number);
  const [ry, rm, rd] = RATE_REVIEW.split("-").map(Number);
  const years = Math.max(0, ry - y - (rm < m || (rm === m && rd < d) ? 1 : 0));
  const hourly = roundCents(base + Math.min(years, 5) * 0.5);
  return {
    hourly,
    overtime: roundCents(hourly * OVERTIME_MULTIPLIER),
    effective: start > RATE_REVIEW ? start : RATE_REVIEW,
  };
}
```

- [ ] **Step 3: Run the checks**

```bash
npx -y tsx --tsconfig "$S/tsconfig.check.json" "$S/check-people.mts"
npx tsc --noEmit
```

Expected: `check-people: ok`, and no tsc output. If a team or count differs, re-read section 3 of the spec before changing the code.

- [ ] **Step 4: Commit**

```bash
git add src/components/modules/hr/people.ts
git commit -m "Add the roster-built people model

The org chart, master list, headcounts and seed pay rates come from the
Employee Master Roster plus its overlay. Nothing reads it yet.

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Every reader moves onto the roster

`hr/data.ts` re-exports `people.ts`. Then the Global Master List, its dialogs, Admin, the Employee portal's record screens and Jarvis read the new fields. The person fields `employeeId`, `commenced`, `personalEmail`, `mobile` and `takingOverFrom` stop existing in this task.

**Files:**
- Modify: `src/components/modules/hr/data.ts`
- Rewrite: `src/components/modules/hr/tabs/HrMasterListTab.tsx`, `src/components/modules/hr/master-list/RecordDialog.tsx`
- Modify: `src/components/modules/hr/master-list/parts.tsx`, `PayDialog.tsx`, `src/components/modules/hr/OrgChart.tsx`
- Modify: `src/components/modules/admin/data.ts`, `AdminMasterList.tsx`, `AdminRoles.tsx`, `AdminOverview.tsx`
- Modify: `src/components/modules/employee/data.ts`, `EmployeeProfile.tsx`, `EmployeeDepartment.tsx`
- Modify: `src/components/shell/assistant/jarvis-knowledge.ts`
- Scratch: `$S/pw/hr-roster.mjs`

**Interfaces:**
- Consumes: everything Task 3 produces, through `hr/data.ts`.
- Produces from `master-list/parts.tsx`: `STATUS_LABEL`, `StatusPill({ status, caps? })`, `employmentLabel(type)`, `tenureLabel(row, today)`. `reportsTo(row, seats)` falls back to the roster's own words for a leaver.

- [ ] **Step 1: Write the failing browser check**

Create `$S/pw/hr-roster.mjs`:

```js
import assert from "node:assert/strict";
import fs from "node:fs";
import { done, go, open } from "./lib.mjs";

const s = await open("/hr?tab=people");
const { page } = s;

await page.getByText("Everyone on Locale's Employee Master Roster").waitFor();
for (const [tab, n] of [["Active", 82], ["Inactive", 31], ["All", 113]]) {
  const text = await page.getByRole("tab", { name: new RegExp(`^${tab}`) }).first().innerText();
  assert.ok(text.includes(String(n)), `${tab} tab counts ${n}, got "${text}"`);
}
const search = page.getByRole("searchbox", { name: "Search the master list" });

// A starter not yet started, and a leaver.
await search.fill("Christopher");
await page.getByText("Starts 2 Nov").first().waitFor();
await page.getByText("Starting", { exact: true }).first().waitFor();
await page.getByRole("tab", { name: /^Inactive/ }).click();
await search.fill("Raymond");
await page.getByText("Left", { exact: true }).first().waitFor();
await page.getByRole("button", { name: "View Raymond Shanks" }).click();
const dialog = page.getByRole("dialog");
await dialog.getByText("End date").waitFor();
assert.equal(await page.getByRole("button", { name: "Rates for Raymond Shanks" }).count(), 0, "no rates for a leaver");
await page.keyboard.press("Escape");
const inactiveText = await page.locator("main").innerText();
assert.ok(!/NaN|Invalid/.test(inactiveText), "no NaN or Invalid among leavers");

// Kane's record: roster fields, and the private fields from the local file.
await page.getByRole("tab", { name: /^Active/ }).click();
await search.fill("Jan Kane");
await page.getByRole("button", { name: "View Jan Kane Reroma" }).click();
for (const text of ["Information Technology", "Contractor", "Philippines", "Locale Homes Australia Pty Ltd", "Goes by Kane"]) {
  await dialog.getByText(text, { exact: false }).first().waitFor();
}
assert.equal(await dialog.getByText("Kept locally").count(), 0, "private fields come from the local file");
assert.equal(await dialog.getByText(/Employee ID/).count(), 0, "no employee ID");
await page.keyboard.press("Escape");

// A director.
await search.fill("Adam Schaal");
await page.getByRole("button", { name: "View Adam Schaal" }).click();
await dialog.getByText("not on the Employee Master Roster").waitFor();
await page.keyboard.press("Escape");

// CSV has the roster's columns, and the private ones while the local file exists.
await search.fill("");
const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Export CSV" }).click()]);
const head = fs.readFileSync(await download.path(), "utf8").split("\r\n")[0];
for (const col of ["Company", "Division", "Employment type", "Probation status", "Confirmation date", "Birthday"]) {
  assert.ok(head.includes(`"${col}"`), `CSV column ${col}`);
}

// Admin lists staff only, with roster fields.
await go(page, "/admin?tab=people&person=candice-joyce");
await page.getByText("No dashboards yet").waitFor();
await page.getByText("Employment type").first().waitFor();
await page.getByRole("searchbox", { name: "Search the roster" }).fill("Raymond");
await page.getByText(/No matches|Nobody/).first().waitFor();

// Employee › Profile.
await go(page, "/employee?tab=profile");
await page.getByText("From the Employee Master Roster").waitFor();
await page.getByText("Information Technology").first().waitFor();
assert.equal(await page.getByText("Employee ID").count(), 0);

await done(s, "hr-roster");
```

Run: `node "$S/pw/hr-roster.mjs"`. Expected: it fails waiting for "Everyone on Locale's Employee Master Roster".

- [ ] **Step 2: `hr/data.ts` re-exports the people model**

In `src/components/modules/hr/data.ts`, replace everything from the top of the file to the end of `seedPayRate` with the block below. That's everything above `/* ── Employees ── */`. Leave everything from `/* ── Employees ── */` to the end of the file unchanged.

```ts
/**
 * HR: the tabs, and the figures Horilla still mirrors (leave, attendance,
 * recruitment, performance and assets), static from the mockup (`xm`). The
 * people themselves come from the Employee Master Roster: see `people.ts`,
 * re-exported here so every dashboard keeps importing from one place.
 */
export * from "./people";

export const HR_TABS = ["overview", "people", "attendance", "leave", "recruitment", "performance", "assets"] as const;
export type HrTab = (typeof HR_TABS)[number];

export const HR_TAB_LABELS: Record<HrTab, string> = {
  overview: "Overview",
  people: "Global Master List",
  attendance: "Attendance",
  leave: "Leave",
  recruitment: "Recruitment",
  performance: "Performance",
  assets: "Assets",
};

/* ── Overview ──────────────────────────────────────────────────────────── */

export const ON_LEAVE_TODAY = { name: "K. Ellery", note: "K. Ellery · Personal leave · back tomorrow" };

export const ATTENDANCE_TODAY: { label: string; value: string; caution?: boolean }[] = [
  { label: "Clocked in", value: "19 of 22" },
  { label: "Working from home", value: "4" },
  { label: "Not yet in", value: "2", caution: true },
];

/* ── Dates ─────────────────────────────────────────────────────────────── */

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2026-09-07" → "7 Sep 2026". */
export function formatIsoDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

/** Time served from the start date to `today`, as HRIS writes it: "4y 2m", "4y", "8mo", "12d", "New". */
export function tenure(start: string, today: Date): string {
  const [y, m, d] = start.split("-").map(Number);
  const months = (today.getFullYear() - y) * 12 + today.getMonth() + 1 - m - (today.getDate() < d ? 1 : 0);
  if (months < 1) {
    const days = Math.floor((today.getTime() - new Date(y, m - 1, d).getTime()) / 86_400_000);
    return days <= 0 ? "New" : `${days}d`;
  }
  const yrs = Math.floor(months / 12);
  const mos = months % 12;
  return yrs && mos ? `${yrs}y ${mos}m` : yrs ? `${yrs}y` : `${mos}mo`;
}
```

- [ ] **Step 3: Shared master-list parts**

In `src/components/modules/hr/master-list/parts.tsx`:

- Add `import { Pill, type PillTone } from "@/components/ui/pill";` to the imports.
- Change the `../data` import to `import { ORG_BRANDS, formatIsoDate, tenure, type MasterRow, type OrgPerson, type PersonStatus } from "../data";`.
- Replace `reportsTo` with the version below.
- Add the rest of the block after `reportsTo`.

```tsx
/** Who someone answers to: their manager, the seat's title while it's vacant, the board, or the roster's own words for a leaver. */
export function reportsTo(row: MasterRow, seats: Map<string, OrgPerson>): string | null {
  if (row.link === "peer") return "The board";
  const manager = row.managerId ? seats.get(row.managerId) : undefined;
  if (!manager) return row.record?.reportsToText ?? null;
  return manager.name ? `${manager.name} · ${manager.role}` : `${manager.role} (vacant)`;
}

export const STATUS_LABEL: Record<PersonStatus, string> = {
  active: "Active",
  probation: "On probation",
  starting: "Starting",
  inactive: "Inactive",
};

const STATUS_TONE: Record<PersonStatus, PillTone> = { active: "ok", probation: "pending", starting: "tone", inactive: "neutral" };

/** Where someone stands on the roster, as a pill. */
export function StatusPill({ status, caps }: { status: PersonStatus; caps?: boolean }) {
  return (
    <Pill tone={STATUS_TONE[status]} variant={caps ? "caps" : "soft"} className={caps ? undefined : "px-2 py-0"}>
      {STATUS_LABEL[status]}
    </Pill>
  );
}

/** "Employment - Full Time" → "Full time"; "Contractor" stays. */
export function employmentLabel(type: string | null): string | null {
  if (!type) return null;
  const s = type.replace(/^Employment\s*-\s*/i, "");
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

/** Tenure as the master list shows it: time served, "Starts 2 Nov" ahead of a start, "Left" for a leaver. */
export function tenureLabel(row: MasterRow, today: Date): string | null {
  const start = row.record?.start;
  if (row.status === "inactive") return "Left";
  if (!start) return null;
  if (row.status === "starting") return `Starts ${shortDate(start, today)}`;
  return tenure(start, today);
}
```

- [ ] **Step 4: Rewrite the Global Master List**

Replace `src/components/modules/hr/tabs/HrMasterListTab.tsx` with:

```tsx
"use client";

import * as React from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  Banknote,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Download,
  Eye,
  LayoutGrid,
  Pencil,
  Table2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { DURATION, EASE_OUT, EASE_SWAP, PANEL_VARIANTS, RISE_VARIANTS, rowDelay } from "@/lib/motion";
import { confirm } from "@/state/launchpad-store";
import { PageHeader } from "@/components/ui/page";
import { Card, CardFooter, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dash, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SearchInput } from "@/components/ui/input";
import { SmoothSelect } from "@/components/ui/select";
import { SlidingTabs } from "@/components/ui/sliding-tabs";
import { NoMatches } from "@/components/ui/states";
import { Pill } from "@/components/ui/pill";
import { Avatar } from "@/components/ui/avatar";
import { Reveal } from "@/components/ui/reveal";
import { AutoHeight, Ticker, useCascading } from "@/components/ui/list-motion";
import { toIso } from "@/components/ui/date-picker";
import { useOrg } from "../org-store";
import { usePay, type PayState } from "../pay-store";
import {
  HAS_PRIVATE,
  ORG_DEPARTMENTS,
  ROSTER_SOURCE,
  formatIsoDate,
  masterList,
  orgDepartment,
  orgTone,
  rosterPrivate,
  type MasterRow,
  type OrgDepartmentId,
  type OrgPerson,
} from "../data";
import { STATUS_LABEL, StatusPill, employmentLabel, tenureLabel, type Mode, type OpenFn } from "../master-list/parts";
import { RecordDialog } from "../master-list/RecordDialog";
import { RatesDialog } from "../master-list/RatesDialog";
import { PayDialog } from "../master-list/PayDialog";

type ViewMode = "table" | "cards";
type DeptFilter = "all" | OrgDepartmentId;
/** Active is everyone still with Locale: on probation and starting soon included. */
type StatusFilter = "active" | "inactive" | "all";
type Opened = { id: string; mode: Mode } | null;

/** The table pages in 10s, as in HRIS; the cards in 12s, so the grid fills evenly two, three or four up. */
const PAGE_SIZE: Record<ViewMode, number> = { table: 10, cards: 12 };

// The view choice survives a section switch (this tab unmounts) without browser
// storage, so the server always renders the table and hydration matches (HRIS).
let viewMemory: ViewMode = "table";

/**
 * How the list body swaps. Paging slides sideways the way you're going, like a
 * step flow (§ 11.1); a new view, status, department or search rises in like
 * a section (§ 1.1).
 */
interface Swap {
  kind: "page" | "view";
  dir: number;
}

const VIEW_SWAP: Swap = { kind: "view", dir: 1 };

const PANE_VARIANTS = {
  enter: (s: Swap) => (s.kind === "page" ? PANEL_VARIANTS.enter(s.dir) : RISE_VARIANTS.enter(1)),
  center: { opacity: 1, x: 0, y: 0 },
  exit: (s: Swap) => (s.kind === "page" ? PANEL_VARIANTS.exit(s.dir) : RISE_VARIANTS.exit(1)),
};

const inStatus = (r: MasterRow, s: StatusFilter) => s === "all" || (s === "inactive") === (r.status === "inactive");

/** Pay, View and Rates for anyone still with Locale; View only for a leaver or a director. */
const payable = (r: MasterRow) => r.status !== "inactive" && !r.director;

const haystack = (r: MasterRow) =>
  [
    r.name,
    r.note,
    r.preferredName,
    r.role,
    orgDepartment(r.department).name,
    r.record?.division,
    r.record?.company,
    r.record?.location,
    employmentLabel(r.record?.employmentType ?? null),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

const IMPORTED = `imported ${formatIsoDate(ROSTER_SOURCE.importedOn)} from ${ROSTER_SOURCE.file}`;

/** Download the rows in view as a CSV: the roster's columns, pay rates, and the private ones when this build has them. */
function exportCsv(rows: MasterRow[], rates: PayState["rates"], seats: Map<string, OrgPerson>, today: Date) {
  const head = [
    "Name",
    "Preferred name",
    "Company",
    "Division",
    "Department",
    "Location",
    "Position",
    "Reports to",
    "Employment type",
    "Probation status",
    "Start date",
    "Confirmation date",
    "End date",
    "Tenure",
    "Status",
    "Hourly rate (AUD)",
    "Overtime rate (AUD)",
    ...(HAS_PRIVATE ? ["Birthday", "Employee folder", "Remarks"] : []),
  ];
  const body = rows.map((r) => {
    const rec = r.record;
    const priv = rosterPrivate(r.id);
    const manager = r.managerId ? seats.get(r.managerId) : undefined;
    return [
      r.name,
      r.preferredName ?? "",
      rec?.company ?? "",
      rec?.division ?? "",
      orgDepartment(r.department).name,
      rec?.location ?? "",
      r.role,
      manager?.name ?? manager?.role ?? rec?.reportsToText ?? "",
      rec?.employmentType ?? "",
      rec?.probation ?? "",
      rec?.start ?? "",
      rec?.confirmation ?? "",
      rec?.end ?? "",
      tenureLabel(r, today) ?? "",
      STATUS_LABEL[r.status],
      rates[r.id] ? rates[r.id].hourly.toFixed(2) : "",
      rates[r.id] ? rates[r.id].overtime.toFixed(2) : "",
      ...(HAS_PRIVATE ? [priv?.birthday ?? "", priv?.folderUrl ?? "", priv?.remarks ?? ""] : []),
    ];
  });
  const csv = [head, ...body].map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(",")).join("\r\n");
  const file = `locale-global-master-list-${toIso(today)}.csv`;
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = file;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  confirm("Master list exported", `${rows.length} ${rows.length === 1 ? "person" : "people"} · ${file}`);
}

/**
 * HR › Global Master List: everyone on Locale's Employee Master Roster, leavers
 * included, modelled on HRIS's Global Master List. Status, department and
 * search filters; export; a table or cards view, paged; and per person Pay
 * (a one-off payment), View (the full record) and Rates (pay rates). Records
 * change in the roster and arrive with `npm run roster`.
 *
 * Motion (HRIS § 14): a new view, status, department or page swaps the body
 * and replays the row cascade, and the card glides to its new height. Typing
 * a search never replays it: rows that drop out drift away, the rest close the
 * gap, and rows the search brings back fade straight in.
 */
export function HrMasterListTab() {
  const { people } = useOrg();
  const pay = usePay();
  const reduce = useReducedMotion();
  const [view, setView] = React.useState<ViewMode>(viewMemory);
  const [status, setStatus] = React.useState<StatusFilter>("active");
  const [dept, setDept] = React.useState<DeptFilter>("all");
  const [query, setQuery] = React.useState("");
  const [page, setPage] = React.useState(0);
  const [swap, setSwap] = React.useState<Swap>(VIEW_SWAP);
  const [opened, setOpened] = React.useState<Opened>(null);
  const today = React.useMemo(() => new Date(), []);

  const everyone = React.useMemo(() => masterList(people), [people]);
  const seats = React.useMemo(() => new Map(people.map((p) => [p.id, p])), [people]);
  const all = React.useMemo(() => everyone.filter((r) => inStatus(r, status)), [everyone, status]);

  const statusCounts = React.useMemo(
    () => ({
      active: everyone.filter((r) => r.status !== "inactive").length,
      inactive: everyone.filter((r) => r.status === "inactive").length,
      all: everyone.length,
    }),
    [everyone],
  );

  const counts = React.useMemo(() => {
    const c = Object.fromEntries(ORG_DEPARTMENTS.map((d) => [d.id, 0])) as Record<OrgDepartmentId, number>;
    for (const r of all) c[r.department] += 1;
    return c;
  }, [all]);

  const q = query.trim().toLowerCase();
  const rows = React.useMemo(
    () => all.filter((r) => (dept === "all" || r.department === dept) && (!q || haystack(r).includes(q))),
    [all, dept, q],
  );

  const size = PAGE_SIZE[view];
  const pages = Math.max(1, Math.ceil(rows.length / size));
  const current = Math.min(page, pages - 1);
  const shown = rows.slice(current * size, (current + 1) * size);
  const openRow = opened ? (everyone.find((r) => r.id === opened.id) ?? null) : null;

  const restart = () => {
    setSwap(VIEW_SWAP);
    setPage(0);
  };
  const goPage = (n: number) => {
    setSwap({ kind: "page", dir: n > current ? 1 : -1 });
    setPage(n);
  };
  const onQuery = (v: string) => {
    setQuery(v);
    restart();
  };
  const onStatus = (v: StatusFilter) => {
    setStatus(v);
    restart();
  };
  const onDept = (v: DeptFilter) => {
    setDept(v);
    restart();
  };
  const onView = (v: ViewMode) => {
    viewMemory = v;
    setView(v);
    restart();
  };
  const onOpen: OpenFn = (id, mode) => setOpened({ id, mode });
  const close = () => setOpened(null);

  const viewProps: ViewProps = { rows: shown, payPending: pay.pending, today, onOpen };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Global Master List" description={`Everyone on Locale's Employee Master Roster · ${IMPORTED}.`} />

      <Reveal index={0}>
        {/* Not overflow-hidden: the department menu drops below short results. The body clips itself. */}
        <Card className="min-w-0">
          <CardHeader className="gap-y-3 border-b border-hairline pb-3">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <SlidingTabs
                value={status}
                onChange={onStatus}
                ariaLabel="Show"
                items={[
                  { value: "active" as StatusFilter, label: "Active", count: statusCounts.active },
                  { value: "inactive" as StatusFilter, label: "Inactive", count: statusCounts.inactive },
                  { value: "all" as StatusFilter, label: "All", count: statusCounts.all },
                ]}
              />
              <p className="text-xs text-muted-foreground tabular-nums">
                <Ticker value={rows.length} /> of {all.length} shown
              </p>
            </div>
            <div className="flex w-full flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center lg:ml-auto lg:w-auto">
              <SmoothSelect
                value={dept}
                onChange={onDept}
                ariaLabel="Filter by department"
                className="sm:w-52"
                options={[
                  { value: "all" as DeptFilter, label: "All departments", hint: all.length },
                  ...ORG_DEPARTMENTS.map((d) => ({ value: d.id as DeptFilter, label: d.name, hint: counts[d.id] })),
                ]}
              />
              <SearchInput
                value={query}
                onChange={onQuery}
                count={q ? rows.length : undefined}
                placeholder="Search name, role, location…"
                aria-label="Search the master list"
                className="sm:w-64"
              />
              <Button variant="outline" onClick={() => exportCsv(rows, pay.rates, seats, today)} disabled={!rows.length}>
                <Download /> Export CSV
              </Button>
              <SlidingTabs
                value={view}
                onChange={onView}
                ariaLabel="View as"
                className="self-start sm:self-auto"
                items={[
                  { value: "table" as ViewMode, label: "Table", icon: Table2 },
                  { value: "cards" as ViewMode, label: "Cards", icon: LayoutGrid },
                ]}
              />
            </div>
          </CardHeader>

          <AutoHeight>
            <AnimatePresence mode="wait" initial={false} custom={swap}>
              <motion.div
                key={rows.length ? `${view}:${current}:${dept}:${status}` : "none"}
                custom={swap}
                variants={PANE_VARIANTS}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: reduce ? 0 : swap.kind === "page" ? 0.22 : DURATION.swap, ease: EASE_SWAP }}
              >
                {!rows.length ? (
                  <NoMatches query={query.trim()} onClear={() => onQuery("")} />
                ) : view === "table" ? (
                  <MasterTable {...viewProps} />
                ) : (
                  <MasterCards {...viewProps} />
                )}
              </motion.div>
            </AnimatePresence>
          </AutoHeight>

          <CardFooter className="justify-between text-xs text-muted-foreground">
            <span className="tabular-nums">
              {rows.length
                ? `${current * size + 1}–${Math.min((current + 1) * size, rows.length)} of ${rows.length}`
                : "No matches"}
            </span>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="icon-sm" aria-label="First page" disabled={current === 0} onClick={() => goPage(0)}>
                <ChevronsLeft />
              </Button>
              <Button
                variant="outline"
                size="icon-sm"
                aria-label="Previous page"
                disabled={current === 0}
                onClick={() => goPage(current - 1)}
              >
                <ChevronLeft />
              </Button>
              <span className="sr-only" aria-live="polite">
                Page {current + 1} of {pages}
              </span>
              <span className="min-w-14 text-center tabular-nums" aria-hidden>
                <Ticker value={current + 1} /> / {pages}
              </span>
              <Button
                variant="outline"
                size="icon-sm"
                aria-label="Next page"
                disabled={current >= pages - 1}
                onClick={() => goPage(current + 1)}
              >
                <ChevronRight />
              </Button>
              <Button
                variant="outline"
                size="icon-sm"
                aria-label="Last page"
                disabled={current >= pages - 1}
                onClick={() => goPage(pages - 1)}
              >
                <ChevronsRight />
              </Button>
            </div>
          </CardFooter>
        </Card>
      </Reveal>

      <RecordDialog
        row={opened?.mode === "view" ? openRow : null}
        people={people}
        seats={seats}
        today={today}
        onClose={close}
        onOpen={onOpen}
      />
      <RatesDialog row={opened?.mode === "rates" ? openRow : null} today={today} onClose={close} onView={(id) => onOpen(id, "view")} />
      <PayDialog row={opened?.mode === "pay" ? openRow : null} today={today} onClose={close} />
    </div>
  );
}

interface ViewProps {
  rows: MasterRow[];
  payPending: PayState["pending"];
  today: Date;
  onOpen: OpenFn;
}

/** What follows a name: the chart's bracket note, the name they go by, then Saving… or New. */
function NameTags({ row, saving }: { row: MasterRow; saving?: boolean }) {
  return (
    <>
      {row.note ? <span className="text-xs whitespace-nowrap text-subtle-foreground">({row.note})</span> : null}
      {row.preferredName && row.preferredName !== row.note ? (
        <span className="text-xs whitespace-nowrap text-subtle-foreground">({row.preferredName})</span>
      ) : null}
      {saving ? (
        <Pill tone="neutral" className="px-2 py-0">
          Saving…
        </Pill>
      ) : row.isNew && row.status !== "starting" ? (
        <Pill tone="tone" className="px-2 py-0">
          New
        </Pill>
      ) : null}
    </>
  );
}

/** The line under a name: their division, or Director for the two who aren't on the roster. */
const subline = (r: MasterRow) => r.record?.division ?? (r.director ? "Director" : null);

/**
 * The pinned Actions column. It stays in view while a narrow screen scrolls the
 * table, and casts a shadow only while there's something under it. `--card` is
 * see-through (the glass card over the page), so the cell paints the same card
 * layer over the page background: it looks identical but hides what slides
 * beneath. The row's hover tint comes through an overlay.
 */
const STICKY_GROUND = "bg-background bg-[linear-gradient(var(--card),var(--card))]";
const STICKY_CELL = cn(
  "sticky right-0 z-10",
  STICKY_GROUND,
  "before:pointer-events-none before:absolute before:inset-0 before:bg-tone-soft/70 before:opacity-0 before:transition-opacity group-hover:before:opacity-100",
);
const STICKY_SHADOW = "shadow-[-14px_0_14px_-14px_rgb(0_0_0/0.28)] dark:shadow-[-14px_0_14px_-14px_rgb(0_0_0/0.9)]";

/** True while the table runs on past the right edge of its scroller. */
function useClippedRight(probe: React.RefObject<HTMLDivElement | null>) {
  const [clipped, setClipped] = React.useState(false);
  React.useEffect(() => {
    const scroller = probe.current?.firstElementChild as HTMLElement | null;
    if (!scroller) return;
    const check = () => setClipped(scroller.scrollLeft + scroller.clientWidth < scroller.scrollWidth - 1);
    check();
    scroller.addEventListener("scroll", check, { passive: true });
    const observer = new ResizeObserver(check);
    observer.observe(scroller);
    if (scroller.firstElementChild) observer.observe(scroller.firstElementChild);
    return () => {
      scroller.removeEventListener("scroll", check);
      observer.disconnect();
    };
  }, [probe]);
  return clipped;
}

/** Pay, View and Rates, as in HRIS's People roster; View alone for a leaver or a director. Icons only on a phone. */
function RowActions({ row, onOpen, compact }: { row: MasterRow; onOpen: OpenFn; compact?: boolean }) {
  const open = (mode: Mode) => (e: React.MouseEvent) => {
    e.stopPropagation();
    onOpen(row.id, mode);
  };
  return (
    <span className={cn("relative flex items-center justify-end", compact ? "gap-1 [&>button]:px-1.5" : "gap-1.5")}>
      {payable(row) ? (
        <Button variant="outline" size="xs" onClick={open("pay")} aria-label={`Pay ${row.name}`}>
          <Banknote /> <span className="hidden sm:inline">Pay</span>
        </Button>
      ) : null}
      <Button variant="outline" size="xs" onClick={open("view")} aria-label={`View ${row.name}`}>
        <Eye /> <span className="hidden sm:inline">View</span>
      </Button>
      {payable(row) ? (
        <Button variant="outline" size="xs" onClick={open("rates")} aria-label={`Rates for ${row.name}`}>
          <Pencil /> <span className="hidden sm:inline">Rates</span>
        </Button>
      ) : null}
    </span>
  );
}

function MasterTable({ rows, payPending, today, onOpen }: ViewProps) {
  const reduce = useReducedMotion();
  const cascading = useCascading();
  const probe = React.useRef<HTMLDivElement>(null);
  const clipped = useClippedRight(probe);

  return (
    <div ref={probe}>
      <Table className="min-w-[1120px]">
        <TableHeader>
          <TableRow className="hover:bg-transparent dark:hover:bg-transparent">
            <TableHead className="pl-5">Employee</TableHead>
            <TableHead>Department</TableHead>
            <TableHead>Position</TableHead>
            <TableHead>Location</TableHead>
            <TableHead>Employment</TableHead>
            <TableHead>Start date</TableHead>
            <TableHead>Tenure</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className={cn("sticky right-0 z-10 pr-4 pl-2 text-right", STICKY_GROUND, clipped && STICKY_SHADOW)}>
              Actions
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <AnimatePresence>
            {rows.map((r, i) => (
              <motion.tr
                key={r.id}
                layout="position"
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -14, transition: { duration: reduce ? 0 : 0.12, ease: EASE_OUT } }}
                transition={{
                  duration: reduce ? 0 : 0.18,
                  ease: EASE_OUT,
                  delay: cascading ? rowDelay(i, reduce, 0.03) : 0,
                  layout: { duration: reduce ? 0 : 0.22, ease: EASE_SWAP, delay: 0 },
                }}
                onClick={() => onOpen(r.id, "view")}
                className="group cursor-pointer border-b border-hairline transition-colors hover:bg-tone-soft/70"
              >
                <TableCell className="pl-5">
                  <span className="flex items-center gap-2.5">
                    <Avatar name={r.name} tone={orgTone(r.brands)} size="sm" />
                    <span className="min-w-0">
                      <span className="flex flex-wrap items-center gap-x-1.5">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpen(r.id, "view");
                          }}
                          className="rounded-sm font-medium whitespace-nowrap outline-none focus-visible:ring-3 focus-visible:ring-ring/45"
                        >
                          {r.name}
                        </button>
                        <NameTags row={r} saving={Boolean(payPending[r.id])} />
                      </span>
                      <span className="block text-xs text-muted-foreground">{subline(r) ?? <Dash />}</span>
                    </span>
                  </span>
                </TableCell>
                <TableCell className="text-foreground/80">{orgDepartment(r.department).name}</TableCell>
                {/* Positions wrap so the table fits a laptop. */}
                <TableCell className="text-foreground/80">
                  <span className="block min-w-28 leading-snug">{r.role}</span>
                </TableCell>
                <TableCell className="whitespace-nowrap">{r.record?.location ?? <Dash />}</TableCell>
                <TableCell className="whitespace-nowrap">{employmentLabel(r.record?.employmentType ?? null) ?? <Dash />}</TableCell>
                <TableCell className="whitespace-nowrap tabular-nums">
                  {r.record?.start ? formatIsoDate(r.record.start) : <Dash />}
                </TableCell>
                {/* Counted on the viewer's clock, which can be a day off the server's. */}
                <TableCell className="whitespace-nowrap tabular-nums" suppressHydrationWarning>
                  {tenureLabel(r, today) ?? <Dash />}
                </TableCell>
                <TableCell>
                  <StatusPill status={r.status} />
                </TableCell>
                <TableCell className={cn(STICKY_CELL, "pr-4 pl-2", clipped && STICKY_SHADOW)}>
                  <RowActions row={r} onOpen={onOpen} compact />
                </TableCell>
              </motion.tr>
            ))}
          </AnimatePresence>
        </TableBody>
      </Table>
    </div>
  );
}

function MasterCards({ rows, payPending, today, onOpen }: ViewProps) {
  const reduce = useReducedMotion();
  const cascading = useCascading();
  return (
    <ul className="grid gap-3 bg-canvas/60 p-3 [grid-template-columns:repeat(auto-fill,minmax(280px,1fr))] sm:p-4">
      <AnimatePresence>
        {rows.map((r, i) => (
          <motion.li
            key={r.id}
            layout="position"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, transition: { duration: reduce ? 0 : 0.14, ease: EASE_OUT } }}
            transition={{
              duration: reduce ? 0 : 0.22,
              ease: EASE_OUT,
              delay: cascading ? rowDelay(i, reduce, 0.03, 0.24) : 0,
              layout: { duration: reduce ? 0 : 0.24, ease: EASE_SWAP, delay: 0 },
            }}
            className="flex min-w-0 flex-col rounded-xl border border-border bg-card p-3.5 shadow-xs transition-[translate,box-shadow,border-color] duration-200 ease-out hover:-translate-y-0.5 hover:border-tone-line hover:shadow-md motion-reduce:transition-none motion-reduce:hover:translate-y-0"
          >
            <div className="flex items-start gap-3">
              <Avatar name={r.name} tone={orgTone(r.brands)} size="md" />
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                  <span className="truncate text-[13px] font-semibold">{r.name}</span>
                  <NameTags row={r} saving={Boolean(payPending[r.id])} />
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">{subline(r)}</p>
              </div>
              <Pill tone="neutral" className="max-w-[45%] truncate">
                {orgDepartment(r.department).name}
              </Pill>
            </div>

            <dl className="mt-3 mb-3 space-y-1.5 border-t border-hairline pt-3">
              <CardLine label="Position">{r.role}</CardLine>
              <CardLine label="Location">{r.record?.location ?? null}</CardLine>
              <CardLine label="Employment">{employmentLabel(r.record?.employmentType ?? null)}</CardLine>
              <CardLine label="Started">
                {r.record?.start ? (
                  <span suppressHydrationWarning>
                    {formatIsoDate(r.record.start)} <span className="text-subtle-foreground">·</span> {tenureLabel(r, today)}
                  </span>
                ) : null}
              </CardLine>
              <CardLine label="Status">
                <StatusPill status={r.status} />
              </CardLine>
            </dl>

            <div className="mt-auto flex items-center justify-end gap-1.5 border-t border-hairline pt-3">
              <RowActions row={r} onOpen={onOpen} />
            </div>
          </motion.li>
        ))}
      </AnimatePresence>
    </ul>
  );
}

function CardLine({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="shrink-0 text-[10px] font-semibold tracking-[0.12em] text-subtle-foreground uppercase">{label}</dt>
      <dd className="min-w-0 truncate text-right text-xs tabular-nums">{children ?? <Dash />}</dd>
    </div>
  );
}
```

- [ ] **Step 5: Rewrite the record dialog**

Replace `src/components/modules/hr/master-list/RecordDialog.tsx` with:

```tsx
"use client";

import {
  AtSign,
  BadgeCheck,
  Banknote,
  Briefcase,
  Building2,
  Cake,
  CalendarCheck,
  CalendarDays,
  CalendarX,
  Clock,
  FileText,
  FolderOpen,
  Hourglass,
  IdCard,
  Landmark,
  Layers,
  MapPin,
  Network,
  NotebookPen,
  Pencil,
  ReceiptText,
  ShieldCheck,
  Tag,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { Pill } from "@/components/ui/pill";
import { formatDayLong } from "@/components/ui/date-picker";
import { formatIsoDate, orgDepartment, orgTone, rosterPrivate, type MasterRow, type OrgPerson } from "../data";
import { money, overtimeBasis, usePay } from "../pay-store";
import {
  Detail,
  DetailGroup,
  EMAIL_LINK,
  Email,
  Notice,
  StatusPill,
  employmentLabel,
  reportsTo,
  shortDate,
  tenureLabel,
  type Mode,
} from "./parts";

/** A private roster field in a build without the private file. */
const KEPT = <span className="text-muted-foreground">Kept locally</span>;

/**
 * View: one person's record from the Employee Master Roster, in HRIS's
 * master-list detail grid: employment, personal, reporting line, pay and their
 * Launchpad sign-in, plus any booked rate change and the one-off payments
 * filed for them here. Birthday, folder link and remarks stay out of git, and
 * a build without them says so. Pay and Rates sit in the footer for anyone
 * still with Locale. The tiles cascade in behind the dialog's own entrance.
 */
export function RecordDialog({
  row,
  people,
  seats,
  today,
  onClose,
  onOpen,
}: {
  row: MasterRow | null;
  people: OrgPerson[];
  seats: Map<string, OrgPerson>;
  today: Date;
  onClose: () => void;
  onOpen: (id: string, mode: Mode) => void;
}) {
  const pay = usePay();
  const record = row?.record;
  const priv = row ? rosterPrivate(row.id) : null;
  const seat = row ? seats.get(row.id) : undefined;
  const left = row?.status === "inactive";
  const reports = row && !left ? people.filter((p) => p.managerId === row.id && !p.link) : [];
  const rate = row ? pay.rates[row.id] : undefined;
  const bookedRate = row ? pay.scheduled[row.id] : undefined;
  const payments = row ? pay.payments.filter((p) => p.personId === row.id).slice(0, 4) : [];
  const payable = Boolean(row && !left && !row.director);
  const saving = row ? Boolean(pay.pending[row.id]) : false;

  // The roster says whether there's a folder; only the private file has the link.
  const folder = !record ? null : !record.folderOnFile ? (
    "No folder link in the roster"
  ) : priv === null ? (
    KEPT
  ) : priv.folderUrl ? (
    <a href={priv.folderUrl} target="_blank" rel="noreferrer" className={EMAIL_LINK}>
      Open folder
    </a>
  ) : null;

  return (
    <Dialog
      open={row !== null}
      onClose={onClose}
      size="lg"
      icon={IdCard}
      title={row?.name ?? ""}
      description={row ? `${row.role} · ${orgDepartment(row.department).name}` : null}
      footer={
        row ? (
          <>
            <Button variant="outline" className="mr-auto" onClick={onClose}>
              Close
            </Button>
            {payable ? (
              <>
                <Button variant="outline" onClick={() => onOpen(row.id, "pay")}>
                  <Banknote /> Pay
                </Button>
                <Button onClick={() => onOpen(row.id, "rates")}>
                  <Pencil /> Rates
                </Button>
              </>
            ) : null}
          </>
        ) : null
      }
    >
      {row ? (
        <div className="flex flex-col gap-5">
          <div className="flex min-w-0 items-center gap-3">
            <Avatar name={row.name} tone={orgTone(row.brands)} size="lg" />
            <div className="flex min-w-0 flex-wrap items-center gap-1.5">
              {row.preferredName ? <span className="text-[13px] text-muted-foreground">Goes by {row.preferredName}</span> : null}
              <Pill tone="neutral">{orgDepartment(row.department).name}</Pill>
              {saving ? (
                <Pill tone="neutral" variant="caps">
                  Saving…
                </Pill>
              ) : (
                <StatusPill status={row.status} caps />
              )}
            </div>
          </div>

          {row.director ? (
            <Notice>Director · not on the Employee Master Roster, so the org chart is all there is to show.</Notice>
          ) : null}

          <DetailGroup title="Employment">
            <Detail index={0} icon={Briefcase} label="Position">
              {row.role}
            </Detail>
            <Detail index={1} icon={Building2} label="Department">
              {orgDepartment(row.department).name}
            </Detail>
            <Detail index={2} icon={Tag} label="Division">
              {record?.division ?? (row.director ? "Locale Property Group" : null)}
            </Detail>
            <Detail index={3} icon={Landmark} label="Company">
              {record?.company}
            </Detail>
            <Detail index={4} icon={FileText} label="Employment type">
              {employmentLabel(record?.employmentType ?? null)}
            </Detail>
            <Detail index={5} icon={ShieldCheck} label="Probation status">
              {record?.probation}
            </Detail>
            <Detail index={6} icon={CalendarDays} label="Start date">
              {record?.start ? formatIsoDate(record.start) : null}
            </Detail>
            <Detail index={7} icon={CalendarCheck} label="Confirmation date">
              {record?.confirmation ? formatIsoDate(record.confirmation) : null}
            </Detail>
            <Detail index={8} icon={CalendarX} label="End date">
              {record?.end ? formatIsoDate(record.end) : null}
            </Detail>
            <Detail index={9} icon={Hourglass} label="Tenure">
              {tenureLabel(row, today)}
            </Detail>
            <Detail index={10} icon={BadgeCheck} label="Status" wide>
              <StatusPill status={row.status} />
            </Detail>
          </DetailGroup>

          {record ? (
            <DetailGroup title="Personal">
              <Detail index={11} icon={MapPin} label="Location">
                {record.location}
              </Detail>
              <Detail index={12} icon={Cake} label="Birthday">
                {priv === null ? KEPT : priv.birthday ? formatIsoDate(priv.birthday) : null}
              </Detail>
              <Detail index={13} icon={FolderOpen} label="Employee folder" wide>
                {folder}
              </Detail>
              <Detail index={14} icon={NotebookPen} label="Remarks" wide>
                {priv === null ? KEPT : priv.remarks}
              </Detail>
            </DetailGroup>
          ) : null}

          <DetailGroup title="Reporting line">
            <Detail index={15} icon={Network} label="Reports to">
              {reportsTo(row, seats)}
            </Detail>
            <Detail index={16} icon={Layers} label="Team">
              {seat?.team ?? null}
            </Detail>
            {!left ? (
              <Detail index={17} icon={Users} label={`Direct reports${reports.length ? ` · ${reports.length}` : ""}`} wide>
                {reports.length ? (
                  <span className="mt-1 flex flex-wrap gap-1">
                    {reports.map((p) => (
                      <span
                        key={p.id}
                        className={cn(
                          "rounded-full border border-hairline bg-card px-2 py-0.5 text-xs",
                          !p.name && "border-dashed text-muted-foreground",
                        )}
                      >
                        {p.name ?? `Vacant · ${p.role}`}
                      </span>
                    ))}
                  </span>
                ) : null}
              </Detail>
            ) : null}
          </DetailGroup>

          {payable ? (
            <DetailGroup title="Pay">
              <Detail index={18} icon={Banknote} label="Hourly rate">
                {rate ? (
                  <>
                    <span className="font-medium tabular-nums">{money(rate.hourly)}</span>
                    <span className="text-muted-foreground">/hr</span>
                  </>
                ) : null}
              </Detail>
              <Detail index={19} icon={Clock} label="Overtime rate">
                {rate ? (
                  <>
                    <span className="font-medium tabular-nums">{money(rate.overtime)}</span>
                    <span className="text-muted-foreground">/hr · {overtimeBasis(rate)}</span>
                  </>
                ) : null}
              </Detail>
              <Detail index={20} icon={CalendarDays} label="Rates since" wide>
                {rate ? formatIsoDate(rate.effective) : null}
              </Detail>
              {bookedRate ? (
                <div className="sm:col-span-2">
                  <Notice>
                    Changing to <span className="font-semibold tabular-nums">{money(bookedRate.hourly)}</span>/hr, overtime{" "}
                    <span className="font-semibold tabular-nums">{money(bookedRate.overtime)}</span>/hr, on{" "}
                    <span className="font-semibold tabular-nums">{formatDayLong(bookedRate.effective)}</span>
                  </Notice>
                </div>
              ) : null}
              {payments.length ? (
                <Detail index={21} icon={ReceiptText} label="One-off payments" wide>
                  <ul className="mt-1 divide-y divide-hairline">
                    {payments.map((p) => (
                      <li key={p.id} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 py-1.5 first:pt-0 last:pb-0">
                        <span className="min-w-0">
                          <span className="font-medium tabular-nums">{money(p.amount)}</span> {p.kind.toLowerCase()}
                          {p.hours ? ` · ${p.hours} h at ${money(p.rate ?? 0)}` : ""}
                          {p.note ? <span className="text-muted-foreground"> · {p.note}</span> : null}
                        </span>
                        <span className={cn("text-xs whitespace-nowrap", p.status === "filing" ? "text-subtle-foreground" : "text-muted-foreground")}>
                          {p.status === "filing" ? "Filing…" : "With payroll"} · pays {shortDate(p.payOn, today)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </Detail>
              ) : null}
            </DetailGroup>
          ) : null}

          <DetailGroup title="Launchpad sign-in">
            <Detail index={22} icon={AtSign} label="Work email" mono wide>
              {row.workEmail ? (
                <>
                  <a href={`mailto:${row.workEmail}`} className={EMAIL_LINK}>
                    <Email value={row.workEmail} />
                  </a>
                  <span className="mt-0.5 block font-sans text-xs text-muted-foreground">Placeholder until the roster has emails.</span>
                </>
              ) : left ? (
                <span className="font-sans">None: they&apos;ve left Locale.</span>
              ) : null}
            </Detail>
          </DetailGroup>
        </div>
      ) : null}
    </Dialog>
  );
}
```

If `tsc` reports that a lucide icon doesn't exist in `lucide-react@0.577` (check `node_modules/lucide-react/dist/lucide-react.d.ts`), swap it for the nearest one that does. `NotebookPen` can become `StickyNote`, `Cake` can become `Gift`, `CalendarX` can become `CalendarMinus`.

- [ ] **Step 6: Pay dialog and org chart**

In `src/components/modules/hr/master-list/PayDialog.tsx`, the person line becomes:

```tsx
              <span className="block text-xs break-words text-muted-foreground">
                {row.role} · {orgDepartment(row.department).name}
              </span>
```

In `src/components/modules/hr/OrgChart.tsx`'s `PersonNode`, delete the `{p.transition ? ( … ) : null}` block. The roster has no transitions; Alison Carter holds Sales Operations Manager.

- [ ] **Step 7: Admin reads staff and roster fields**

In `src/components/modules/admin/data.ts`:

- The hr import becomes `import { ORG_SEED, staffList, type MasterRow, type OrgDepartmentId } from "@/components/modules/hr/data";`.
- `identityEmail` becomes:

```ts
/** Their Launchpad sign-in. Null: nothing can be granted. */
export const identityEmail = (row: MasterRow) => row.workEmail;
```

- `Principal.email`'s comment becomes `/** Their Launchpad sign-in. Null: nothing can be granted. */`.
- In `directory`, the `onRoster` set becomes:

```ts
  const onRoster = new Set(rows.map((r) => r.workEmail?.toLowerCase()).filter((e): e is string => !!e));
```

- Replace `DEPARTMENT_ROLES` and `EXTRA_ROLES` with:

```ts
/** Each department's own dashboards. Wealth's partners sit in Sales on the roster but work in Wealth. */
const DEPARTMENT_ROLES: Record<OrgDepartmentId, RoleKey[]> = {
  leadership: ["leadership"],
  finance: ["finance"],
  sales: ["sales"],
  marketing: ["marketing"],
  operations: ["operations", "projects"],
  it: ["it"],
  accounting: ["accounts", "accounting"],
  executive: ["hr", "knowledge"],
};

/** On top of their department's. */
const EXTRA_ROLES: Record<string, RoleKey[]> = {
  "adam-schaal": ["sales", "finance", "accounts", "hr", "knowledge"],
  "brad-linford": ["accounts", "leadership"],
  "sean-oneill": ["operations", "projects", "leadership"],
  "larnie-clark": ["operations", "projects", "knowledge"],
  "alison-carter": ["operations", "projects"],
  "shannan-murray": ["operations", "knowledge"],
  "steph-stritch": ["wealth"],
  "kellie-boyer": ["leadership"],
  "aled-smith": ["finance"],
  "jerry-delos-santos": ["admin", "leadership"],
  "pablo-lopez": ["projects"],
  "andre-mikhail-serra": ["sales", "marketing"],
  "jan-kane-reroma": ["admin"],
};
```

- In `seedRoles`, replace the first two lines of its body (the "A new starter waits for their grants" comment and the `if (row.isNew && …) return [];` line) with:

```ts
  // Nobody gets a dashboard before their first day, as in HRIS: Candice Joyce starts on 13 Oct.
  if (row.status === "starting") return [];
```

- `const SEED_ROWS = masterList(ORG_SEED);` becomes `const SEED_ROWS = staffList(ORG_SEED);`.

In `AdminMasterList.tsx`:

- **Imports:**
  - The lucide list loses `Clock` and `Phone` and gains `BadgeCheck`, `FileText` and `Tag`.
  - The hr import becomes `import { ORG_DEPARTMENTS, formatIsoDate, orgDepartment, staffList, type OrgDepartmentId, type OrgPerson } from "@/components/modules/hr/data";`.
  - The parts import becomes `import { Detail, DetailGroup, EMAIL_LINK, Email, StatusPill, employmentLabel, reportsTo } from "@/components/modules/hr/master-list/parts";`.
- **Rows:** `const rows = React.useMemo(() => masterList(people), [people]);` becomes `const rows = React.useMemo(() => staffList(people), [people]);`.
- **Search haystack:** in the `filtered` memo, the array becomes `[p.name, p.email, p.row?.preferredName, p.row?.role, p.row && orgDepartment(p.row.department).name]`, and the `SearchInput` placeholder becomes `"Search name, email, role…"`.
- **`RecordPane`:** delete its `now` prop (type, destructuring, and `now={now}` at the call), along with `const today = React.useMemo(() => new Date(now), [now]);`.
- **Master list information group:** replace it with:

```tsx
                <DetailGroup title="Master list information">
                  <Detail index={0} icon={Briefcase} label="Position">
                    {person.row.role}
                  </Detail>
                  <Detail index={1} icon={Building2} label="Department">
                    {orgDepartment(person.row.department).name}
                  </Detail>
                  <Detail index={2} icon={Tag} label="Division">
                    {person.row.record?.division ?? (person.row.director ? "Locale Property Group" : null)}
                  </Detail>
                  <Detail index={3} icon={UserRound} label="Reports to">
                    {reportsTo(person.row, seats)}
                  </Detail>
                  <Detail index={4} icon={MapPin} label="Location">
                    {person.row.record?.location}
                  </Detail>
                  <Detail index={5} icon={FileText} label="Employment type">
                    {employmentLabel(person.row.record?.employmentType ?? null)}
                  </Detail>
                  <Detail index={6} icon={Calendar} label="Start date">
                    {person.row.record?.start ? formatIsoDate(person.row.record.start) : null}
                  </Detail>
                  <Detail index={7} icon={BadgeCheck} label="Status">
                    <StatusPill status={person.row.status} />
                  </Detail>
                  <Detail index={8} icon={Mail} label="Sign-in email" mono wide>
                    {person.row.workEmail ? (
                      <a href={`mailto:${person.row.workEmail}`} className={EMAIL_LINK}>
                        <Email value={person.row.workEmail} />
                      </a>
                    ) : null}
                  </Detail>
                </DetailGroup>
```

In `AdminRoles.tsx`:

- **Imports and rows:** the hr import's `masterList` becomes `staffList`, and `const rows = React.useMemo(() => masterList(people), [people]);` becomes `staffList(people)`.
- **Search haystack:** in the `filtered` memo, the array becomes `[p.name, p.email, p.row?.preferredName, p.row?.role, p.row && orgDepartment(p.row.department).name]`.
- **`addByEmail`:** `known` becomes `dir.find((p) => p.email === raw || p.row?.workEmail?.toLowerCase() === raw)`.
- **No-email notice:** its text becomes `{person.name} has no sign-in email yet, so no role can be granted. Sign-ins arrive with the Employee Master Roster once it carries emails.`

In `AdminOverview.tsx`, `masterList` becomes `staffList` in the import and in `const rows = …`.

- [ ] **Step 8: The Employee portal reads Kane's roster record**

In `src/components/modules/employee/data.ts`:

- The hr import becomes `import { ORG_SEED, orgDepartment, staffList } from "@/components/modules/hr/data";`.
- In the file's doc comment, "AI Engineer in AI & Growth (the org chart's `jan-kane-reroma`). Their seat, record and department come from HR's data." becomes "AI Engineer in Information Technology (`jan-kane-reroma`). Their seat, record and department come from the Employee Master Roster."
- Replace from `export const GOES_BY = "Kane";` through `const ACCOUNTS_HEAD = …` with:

```ts
const ROW = staffList(ORG_SEED).find((r) => r.id === EMPLOYEE_ID)!;

/** The name they go by: the greeting's "Good afternoon, Kane." */
export const GOES_BY = ROW.preferredName ?? ROW.name.split(" ")[0];

export const EMPLOYEE = {
  name: ROW.name,
  role: ROW.role,
  managerId: ROW.managerId!,
  record: ROW.record!,
  department: ROW.department,
  workEmail: ROW.workEmail,
};

/** The portal's "today": the Sunday the latest week closed and its invoice is due to go. */
export const EMPLOYEE_TODAY = "2026-10-04";

/** Who reviews staff invoices: the head of Accounting. */
const ACCOUNTS_HEAD = ORG_SEED.find((p) => p.id === orgDepartment("accounting").headId)!;
```

(`EMPLOYEE_TODAY` moves into this block unchanged. Delete its old copy.)

In `EmployeeProfile.tsx`:

- **Employment card:** `<CardMeta>From Horilla</CardMeta>` becomes `<CardMeta>From the Employee Master Roster</CardMeta>`, and its `<dl>` children become:

```tsx
                  <Detail index={0} icon={Building2} label="Department">
                    {DEPT}
                  </Detail>
                  <Detail index={1} icon={Briefcase} label="Position">
                    {EMPLOYEE.role}
                  </Detail>
                  <Detail index={2} icon={Network} label="Reports to">
                    {MANAGER.name} · {MANAGER.role}
                  </Detail>
                  <Detail index={3} icon={IdCard} label="Employment type">
                    {record.employmentType}
                  </Detail>
                  <Detail index={4} icon={CalendarDays} label="Started">
                    {record.start ? formatIsoDate(record.start) : null}
                  </Detail>
                  <Detail index={5} icon={Hourglass} label="Tenure">
                    {record.start ? tenure(record.start, today) : null}
                  </Detail>
                  <Detail index={6} icon={MapPin} label="Location">
                    {record.location}
                  </Detail>
                  <Detail index={7} icon={Mail} label="Work email" mono>
                    {EMPLOYEE.workEmail}
                  </Detail>
```

- **ID card:** `Employee ID` becomes `Location` with `{record.location ?? "—"}`, and `Started` uses `{record.start ? formatIsoDate(record.start) : "—"}`.
- **Icons:** add `MapPin` to the lucide import. tsc flags unknown names, not unused ones, so remove any icon the file no longer uses (likely `AtSign`) by hand.

In `EmployeeDepartment.tsx`:

- **Imports:**
  - The hr import's `masterList` becomes `staffList`.
  - Add `MapPin` to the lucide import and delete `IdCard` there if nothing else uses it. `IdCard` stays if `MemberDialog`'s `icon={IdCard}` still uses it.
- **`haystack`:** becomes `[r.name, r.note, r.preferredName, r.role, r.workEmail].filter(Boolean).join(" ").toLowerCase()`.
- **`members`:** `masterList(people)` becomes `staffList(people)`.
- **`newest` and `joinedThisYear`:**

```tsx
  const newest = React.useMemo(
    () =>
      members
        .filter((m) => m.record?.start)
        .reduce<MasterRow | null>((best, m) => (!best || m.record!.start! > best.record!.start! ? m : best), null),
    [members],
  );
  const joinedThisYear = members.filter((m) => m.record?.start?.startsWith(EMPLOYEE_TODAY.slice(0, 4))).length;
```

- **Newest KPI sub:** `newest?.record?.start ? `${newest.id === EMPLOYEE_ID ? "You · " : ""}joined ${formatIsoDate(newest.record.start)}` : undefined`.
- **`MemberCards`:**
  - The Email line uses `r.workEmail` (`href={`mailto:${r.workEmail}`}` and text `{r.workEmail}`, shown when `r.workEmail`).
  - The Joined line uses `r.record?.start` (`formatIsoDate(r.record.start)` and `tenure(r.record.start, today)`, shown when `r.record?.start`).
  - The footer's mono `employeeId` paragraph becomes `<p className="min-w-0 truncate text-xs text-muted-foreground">{r.record?.location ?? ""}</p>`.
- **`MemberDialog`:**
  - The Employee ID tile becomes `<Detail index={0} icon={MapPin} label="Location">{record?.location}</Detail>`.
  - Work email reads `row.workEmail`.
  - Joined and Tenure read `record?.start`, rendering `null` when there's no start.
- **Doc comment:** "(here, "AI & Growth")" becomes "(here, Information Technology)", and "It reads HR's live org chart, so someone HR adds to your department shows here at once." becomes "It reads the org chart the Employee Master Roster draws."

- [ ] **Step 9: Jarvis counts staff, not leavers**

In `src/components/shell/assistant/jarvis-knowledge.ts`:

- The hr import on the `masterList, orgDepartment, orgDepartmentOf, type OrgPerson` line becomes `staffList, orgDepartment, orgDepartmentOf, type OrgPerson`.
- Replace `masterList(ctx.people)` with `staffList(ctx.people)` in all four places: the three Admin answers and the Employee "Who's in my department?" answer.

- [ ] **Step 10: Verify**

```bash
npx tsc --noEmit
grep -rn "employeeId\b" src --include=*.tsx | grep -v "accounting\|payrun"   # expect nothing: accounting's employeeId is a person id
grep -rn "commenced\|personalEmail\|takingOverFrom\|record?.mobile\|record.mobile" src   # expect nothing
npx -y tsx --tsconfig "$S/tsconfig.check.json" "$S/check-people.mts"
```

Restart the dev server so the alias picks up `roster.private.ts`, then:

```bash
node "$S/pw/hr-readonly.mjs" && node "$S/pw/hr-roster.mjs"
```

Expected: `hr-readonly: ok` and `hr-roster: ok`. Also take a 1440-wide screenshot of `/hr?tab=people` (table and cards) and a 390-wide one into `$S/shots/`. Look at them:
- the table fits a laptop with Actions pinned;
- nothing overflows at phone width;
- every status pill has its word.

- [ ] **Step 11: Commit**

```bash
git add src/components/modules/hr src/components/modules/admin src/components/modules/employee/data.ts src/components/modules/employee/EmployeeProfile.tsx src/components/modules/employee/EmployeeDepartment.tsx src/components/shell/assistant/jarvis-knowledge.ts
git commit -m "Read every employee record from the Employee Master Roster

The Global Master List gets the roster's fields, a status filter and leavers.
Admin and Jarvis read active staff. The Employee portal shows Kane's roster
record.

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Org chart by department, and the HR Overview

**Files:**
- Modify: `src/components/modules/hr/OrgChart.tsx`
- Rewrite: `src/components/modules/hr/tabs/HrOverviewTab.tsx`
- Scratch: `$S/pw/hr-overview.mjs`

**Interfaces:**
- Consumes: `HR_KPIS`, `DIVISIONS`, `ON_PROBATION`, `VACANCIES`, `ROSTER_SOURCE`, `daysFromImport`, `RecordDialog`, `RatesDialog`, `PayDialog`.

- [ ] **Step 1: Write the failing browser check**

Create `$S/pw/hr-overview.mjs`:

```js
import assert from "node:assert/strict";
import { done, open } from "./lib.mjs";

const s = await open("/hr?tab=overview");
const { page } = s;
const main = page.locator("main");

await page.getByText("From the Employee Master Roster").first().waitFor();
assert.ok(/Headcount\s*76/.test(await main.innerText()), "headcount 76");
assert.ok(/New joiners\s*9/.test(await main.innerText()), "9 new joiners");

await page.getByText("Due in 11 days").waitFor();
await page.getByRole("button", { name: /Aled Smith/ }).first().click();
await page.getByRole("dialog").getByText("Confirmation date").waitFor();
await page.keyboard.press("Escape");

await page.getByText(/82 people · 1 vacant · roster imported 6 Oct/).waitFor();
await page.getByRole("tab", { name: /^Operations/ }).click();
for (const name of ["Larnie Clark", "Alison Carter", "Shannan Murray", "Rachel Riggio"]) {
  await page.locator(`[data-org-id]`).filter({ hasText: name }).first().waitFor();
}
assert.equal(await page.locator(`[data-org-id="sean-oneill"]`).count(), 0, "Sean isn't drawn in Operations");

await page.getByRole("tab", { name: /^Information Technology/ }).click();
await page.getByText("AI Engineers", { exact: true }).waitFor();

await page.getByRole("tab", { name: /^Executive Office/ }).click();
await page.locator(`[data-org-id="maria-soriano"]`).waitFor();

await done(s, "hr-overview");
```

Run: `node "$S/pw/hr-overview.mjs"`. Expected: it fails at "From the Employee Master Roster".

- [ ] **Step 2: Draw a department as its own forest**

In `src/components/modules/hr/OrgChart.tsx`:

1. **Imports:** the `./data` import gains `ROSTER_SOURCE` and `formatIsoDate`, and drops `orgDepartmentOf`.
2. **Counts:** in the `chart` memo, the counts line becomes `for (const p of people) if (p.name) counts[p.department] += 1;`.
3. **Card meta:** becomes

```tsx
            <span>
              {named} people{vacant ? ` · ${vacant} vacant` : ""} · roster imported{" "}
              {formatIsoDate(ROSTER_SOURCE.importedOn).replace(/ \d{4}$/, "")}
            </span>
```

4. **`DepartmentTree`:** replace it with:

```tsx
/**
 * One department on its own: its head's tree first, then anyone in it whose
 * manager sits in another department, each as a root of their own. Operations
 * is Larnie Clark, then Alison Carter with Shannan Murray and Rachel Riggio.
 * Reports in other departments are cut, so every seat drawn belongs here.
 */
function DepartmentTree({ id }: { id: OrgDepartmentId }) {
  const chart = useChart();
  const headId = orgDepartment(id).headId;
  const scoped = React.useMemo(() => {
    const members = [...chart.byId.values()].filter((p) => p.department === id);
    const inDept = new Set(members.map((p) => p.id));
    const roots = members
      .filter((p) => !p.managerId || !inDept.has(p.managerId))
      .sort((a, b) => Number(b.id === headId) - Number(a.id === headId));
    const ctx: ChartCtx = { ...chart, reportsOf: (pid) => chart.reportsOf(pid).filter((p) => inDept.has(p.id)) };
    return { ctx, roots };
  }, [chart, id, headId]);

  if (!scoped.roots.length) return null;
  return (
    <Ctx.Provider value={scoped.ctx}>
      <div className="flex items-start gap-12">
        {scoped.roots.map((p) => (
          <Subtree key={p.id} person={p} root={p.id === headId} />
        ))}
      </div>
    </Ctx.Provider>
  );
}
```

- [ ] **Step 3: Rewrite the HR Overview**

Replace `src/components/modules/hr/tabs/HrOverviewTab.tsx` with:

```tsx
"use client";

import * as React from "react";
import { ArrowRight, CalendarClock, CalendarDays, CircleAlert, Clock, ListChecks, Sparkles, Target, UserPlus, Users } from "lucide-react";
import { useReducedMotion } from "motion/react";
import { rowDelay } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardMeta, CardRow, CardTitle } from "@/components/ui/card";
import { RateBar } from "@/components/ui/progress";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Reveal } from "@/components/ui/reveal";
import { DashboardOverview } from "../../overview/DashboardOverview";
import {
  ATTENDANCE_TODAY,
  ATTENDANCE_TO_VALIDATE,
  DIVISIONS,
  HR_KPIS,
  OKRS,
  OKR_ON_TRACK_AT,
  ONBOARDING,
  ON_LEAVE_TODAY,
  ON_PROBATION,
  ROSTER_SOURCE,
  VACANCIES,
  daysFromImport,
  formatIsoDate,
  orgTone,
  personTone,
  type HrTab,
} from "../data";
import { useLeave } from "../leave-store";
import { useOrg } from "../org-store";
import { OrgChartCard } from "../OrgChart";
import { RecordDialog } from "../master-list/RecordDialog";
import { RatesDialog } from "../master-list/RatesDialog";
import { PayDialog } from "../master-list/PayDialog";
import type { Mode } from "../master-list/parts";

/**
 * HR › Overview (the mockup's "HR dashboard"): the KPI cards every dashboard
 * opens on, then divisions and probation from the Employee Master Roster,
 * today's leave and attendance from Horilla, and the group's org chart. The
 * leave queue is live (`leave-store`), so a decision on Leave moves its card here.
 */
export function HrOverviewTab({ goTab }: { goTab: (tab: HrTab) => void }) {
  const reduce = useReducedMotion();
  const { requests } = useLeave();
  const pending = requests.filter((r) => r.status === "Pending").length;
  const [clockedIn, wfh] = ATTENDANCE_TODAY;
  const onTrack = OKRS.filter((o) => o.score >= OKR_ON_TRACK_AT).length;
  const tasksLeft = ONBOARDING.total - ONBOARDING.done;

  return (
    <DashboardOverview
      title="HR overview"
      description={`From the Employee Master Roster (imported ${formatIsoDate(ROSTER_SOURCE.importedOn)}) · leave and attendance mirrored from Horilla.`}
      headline={[
        { label: "Headcount", value: HR_KPIS.totalEmployees, sub: `across ${DIVISIONS.length} divisions`, icon: Users, to: "hr:people" },
        {
          label: "On leave today",
          value: HR_KPIS.onLeaveToday,
          sub: `${ON_LEAVE_TODAY.name} · ${ON_LEAVE_TODAY.note.split(" · ").pop()}`,
          icon: CalendarDays,
          to: "hr:leave",
        },
        {
          label: "Leave to approve",
          value: pending,
          sub: pending ? "requests waiting" : "all requests decided",
          icon: CalendarClock,
          tone: pending ? "pending" : "ok",
          to: "hr:leave",
        },
        {
          label: "Open positions",
          value: HR_KPIS.openPositions,
          sub: VACANCIES.length ? `Vacant: ${VACANCIES.map((v) => v.role).join(", ")}` : "No vacant seats",
          icon: UserPlus,
          to: "hr:recruitment",
        },
      ]}
      moreLabel="More from each section"
      more={[
        { label: "New joiners", value: HR_KPIS.newJoiners, sub: "started in the last 30 days", icon: Sparkles, to: "hr:people" },
        { label: "Clocked in", value: clockedIn.value, sub: `${wfh.value} working from home`, icon: Clock, to: "hr:attendance" },
        {
          label: "Records to validate",
          value: ATTENDANCE_TO_VALIDATE,
          sub: "before July payroll",
          icon: CircleAlert,
          tone: ATTENDANCE_TO_VALIDATE ? "pending" : "ok",
          to: "hr:attendance",
        },
        { label: "OKRs on track", value: `${onTrack} of ${OKRS.length}`, sub: `Q3 score ${OKR_ON_TRACK_AT} or more`, icon: Target, to: "hr:performance" },
        {
          label: "Onboarding",
          value: `${ONBOARDING.done} of ${ONBOARDING.total}`,
          sub: `${ONBOARDING.name} · ${tasksLeft} task${tasksLeft === 1 ? "" : "s"} left`,
          icon: ListChecks,
          to: "hr:recruitment",
        },
      ]}
    >
      <div className="grid items-start gap-5 lg:grid-cols-2">
        <div className="flex min-w-0 flex-col gap-5">
          <Reveal index={2}>
            <Card>
              <CardHeader>
                <CardTitle>Employees by division</CardTitle>
                <CardMeta>{HR_KPIS.totalEmployees} people</CardMeta>
              </CardHeader>
              <CardContent>
                <ul className="flex flex-col gap-3 pt-1">
                  {DIVISIONS.map((d, i) => (
                    <li key={d.name}>
                      <div className="mb-1.5 flex items-baseline gap-3 text-xs">
                        <span className="min-w-0 flex-1 truncate font-medium">{d.name}</span>
                        <span className="shrink-0 text-muted-foreground tabular-nums">
                          {d.count}
                          <span className="ml-1.5 text-subtle-foreground">{d.share}%</span>
                        </span>
                      </div>
                      <RateBar
                        value={d.share / 100}
                        tone={i === 0 ? "tone" : "neutral"}
                        height="h-[7px]"
                        delay={rowDelay(i, reduce, 0.09, 0.3)}
                        label={`${d.name}: ${d.count} of ${HR_KPIS.totalEmployees} employees (${d.share}%)`}
                      />
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </Reveal>

          <Reveal index={3}>
            <ProbationCard />
          </Reveal>
        </div>

        <div className="flex min-w-0 flex-col gap-5">
          <Reveal index={4}>
            <Card>
              <CardHeader>
                <CardTitle>On leave today</CardTitle>
                <CardMeta>
                  <Button variant="link" size="xs" className="gap-1 text-xs" onClick={() => goTab("leave")}>
                    Leave <ArrowRight aria-hidden />
                  </Button>
                </CardMeta>
              </CardHeader>
              <CardContent className="flex items-center gap-2.5 text-[13px]">
                <Avatar name={ON_LEAVE_TODAY.name} tone={personTone(ON_LEAVE_TODAY.name)} size="sm" />
                <span className="min-w-0">{ON_LEAVE_TODAY.note}</span>
              </CardContent>
            </Card>
          </Reveal>

          <Reveal index={5}>
            <Card>
              <CardHeader>
                <CardTitle>Attendance today</CardTitle>
                <CardMeta>
                  <Button variant="link" size="xs" className="gap-1 text-xs" onClick={() => goTab("attendance")}>
                    Attendance <ArrowRight aria-hidden />
                  </Button>
                </CardMeta>
              </CardHeader>
              <CardContent>
                {ATTENDANCE_TODAY.map((row) => (
                  <CardRow key={row.label} className="flex items-baseline py-2 text-xs">
                    <span className="text-muted-foreground">{row.label}</span>
                    <span className={cn("ml-auto font-semibold tabular-nums", row.caution && "text-amber-700 dark:text-amber-300")}>
                      {row.value}
                    </span>
                  </CardRow>
                ))}
              </CardContent>
            </Card>
          </Reveal>
        </div>
      </div>

      <Reveal index={6}>
        <OrgChartCard />
      </Reveal>
    </DashboardOverview>
  );
}

/** "Due in 11 days", "Due tomorrow", "Due today", "Overdue": counted from the import date. */
function dueLabel(days: number): string {
  if (days < 0) return "Overdue";
  if (days === 0) return "Due today";
  return days === 1 ? "Due tomorrow" : `Due in ${days} days`;
}

/** Everyone on probation from the roster, soonest confirmation first. A row opens their record. */
function ProbationCard() {
  const { people } = useOrg();
  const seats = React.useMemo(() => new Map(people.map((p) => [p.id, p])), [people]);
  const [opened, setOpened] = React.useState<{ id: string; mode: Mode } | null>(null);
  const today = React.useMemo(() => new Date(), []);
  const row = opened ? (ON_PROBATION.find((r) => r.id === opened.id) ?? null) : null;
  const onOpen = (id: string, mode: Mode) => setOpened({ id, mode });
  const close = () => setOpened(null);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Probation</CardTitle>
        <CardMeta>{ON_PROBATION.length} on probation</CardMeta>
      </CardHeader>
      <CardContent className="pt-0">
        {ON_PROBATION.length ? (
          <ul className="flex flex-col">
            {ON_PROBATION.map((r) => {
              const confirmation = r.record?.confirmation ?? null;
              const days = confirmation ? daysFromImport(confirmation) : null;
              return (
                <li key={r.id} className="border-b border-hairline last:border-0">
                  <button
                    type="button"
                    onClick={() => onOpen(r.id, "view")}
                    className="flex w-full items-center gap-2.5 rounded-md px-1 py-2 text-left outline-none transition-colors hover:bg-tone-soft/50 focus-visible:ring-3 focus-visible:ring-ring/45"
                  >
                    <Avatar name={r.name} tone={orgTone(r.brands)} size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-medium">{r.name}</span>
                      <span className="block truncate text-xs text-muted-foreground">{r.role}</span>
                    </span>
                    <span className="shrink-0 text-right text-xs tabular-nums">
                      <span className="block">{confirmation ? formatIsoDate(confirmation) : "No date"}</span>
                      {days != null ? (
                        <span className={cn("block", days < 0 ? "font-medium text-amber-700 dark:text-amber-300" : "text-muted-foreground")}>
                          {dueLabel(days)}
                        </span>
                      ) : null}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="py-2 text-[13px] text-muted-foreground">Nobody is on probation.</p>
        )}
      </CardContent>
      <RecordDialog row={opened?.mode === "view" ? row : null} people={people} seats={seats} today={today} onClose={close} onOpen={onOpen} />
      <RatesDialog row={opened?.mode === "rates" ? row : null} today={today} onClose={close} onView={(id) => onOpen(id, "view")} />
      <PayDialog row={opened?.mode === "pay" ? row : null} today={today} onClose={close} />
    </Card>
  );
}
```

- [ ] **Step 4: Verify**

```bash
npx tsc --noEmit
node "$S/pw/hr-overview.mjs" && node "$S/pw/hr-roster.mjs"
```

Expected: `hr-overview: ok` and `hr-roster: ok`. Take screenshots of `/hr?tab=overview` at 1440 and 390 wide, showing the Operations and IT chart tabs. Check that both Operations roots sit side by side without overlapping, and the Probation card's dates line up.

- [ ] **Step 5: Commit**

```bash
git add src/components/modules/hr/OrgChart.tsx src/components/modules/hr/tabs/HrOverviewTab.tsx
git commit -m "Chart departments from the roster; HR Overview from roster counts

A department draws its head's tree, then anyone whose manager is elsewhere.
The Overview gets roster headcounts, new joiners and a Probation card.

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: Accounting pays the roster's offshore contractors

**Files:**
- Modify: `src/components/modules/employee/data.ts` (adds `PAY_CALENDAR`)
- Modify: `src/components/modules/accounting/data.ts`
- Scratch: `$S/check-accounting.mts`, `$S/pw/accounting.mjs`

**Interfaces:**
- Produces:
  - `PAY_CALENDAR: readonly string[]`: the six pay-week Sundays, `2026-08-23` to `2026-09-27`.
  - `isOffshoreContractor(row)`.
  - `PAYEE_IDS`, now derived (previewed employee first, then A to Z).

- [ ] **Step 1: Write the failing check**

Create `$S/check-accounting.mts`:

```ts
import assert from "node:assert/strict";

const A = await import("file:///C:/Users/Kane/Desktop/Locale-launchpad-roster/src/components/modules/accounting/data.ts");

assert.deepEqual(A.PAYEE_IDS, [
  "jan-kane-reroma",
  "andre-mikhail-serra",
  "dianne-alvarez",
  "jerry-delos-santos",
  "kristian-charlon-serrano",
  "lane-dula",
  "maria-soriano",
  "nam-su-byun",
  "pablo-lopez",
  "sarah-jasmin",
]);

const inv = (id: string) => A.SEED_PAYEE_INVOICES.filter((i: { employeeId: string }) => i.employeeId === id);
assert.equal(inv("nam-su-byun").length, 1, "Nam started 30 Sep: one week");
assert.equal(inv("nam-su-byun")[0].week, "2026-09-27");
assert.equal(inv("nam-su-byun")[0].status, "pending");
assert.equal(inv("lane-dula").length, 6);
assert.equal(inv("andre-mikhail-serra").length, 7, "six weeks and a one-off");
assert.equal(inv("pablo-lopez")[0].from.country, "Nicaragua");
assert.equal(inv("jerry-delos-santos")[0].from.name, "Jericho Delos Santos");
for (const id of A.PAYEE_IDS) assert.notEqual(A.personOf(id).name, id, `${id} has a name`);
for (const id of A.PAYEE_IDS.slice(1)) assert.ok(id in A.SEED_METHODS, `${id} has a seeded method entry`);
// Seeds follow the roster: no invoice for anyone who isn't a payee (someone who left drops out, no crash).
assert.ok(A.SEED_PAYEE_INVOICES.every((i: { employeeId: string }) => A.PAYEE_IDS.includes(i.employeeId)));

console.log("check-accounting: ok");
```

Run: `npx -y tsx --tsconfig "$S/tsconfig.check.json" "$S/check-accounting.mts"`. Expected: the `PAYEE_IDS` assertion fails, with today's hand-picked list of eight.

- [ ] **Step 2: Add the pay calendar**

In `src/components/modules/employee/data.ts`, add this above the `PayWeek` interface:

```ts
/**
 * Locale's pay calendar: every pay week (its Sunday) the pay runs so far have
 * covered, oldest first. Accounting builds each payee's history from the weeks
 * they'd started by. Sample dates.
 */
export const PAY_CALENDAR: readonly string[] = ["2026-08-23", "2026-08-30", "2026-09-06", "2026-09-13", "2026-09-20", "2026-09-27"];
```

- [ ] **Step 3: Payees and history from the roster**

In `src/components/modules/accounting/data.ts`:

1. **Imports:**
   - The first import becomes `import { ORG_SEED, masterList, seedPayRate, staffList, type MasterRow, type PayRate } from "@/components/modules/hr/data";`.
   - In the employee import, replace `PAY_WEEKS,` with `PAY_CALENDAR,`.
2. **`PAYEE_SEED`:**
   - Its doc comment becomes "Payment details for Locale's offshore team, besides the previewed employee, whose method is their Employee portal Profile. Placeholder: addresses and payment details are sample figures. Who's paid comes from the roster (`PAYEE_IDS`)."
   - Account names become the roster's names: `wise("msoriano@hotmail.com", "Maria Joana Soriano")`, `wire("Jericho Delos Santos", …)`, `wise("pablol78@yahoo.com.au", "Pablo Rafael Lopez Solorzano")`.
   - Append:

```ts
  { id: "lane-dula", street: "27 Osmeña Blvd, Capitol Site", city: "Cebu City, Cebu 6000", method: wise("lane_dula@bigpond.com", "Lane Dula") },
  {
    id: "nam-su-byun",
    street: "5 Katipunan Ave, Loyola Heights",
    city: "Quezon City, Metro Manila 1108",
    method: wire("Nam Su Byun", "Metrobank", "2087345519", "MBTCPHMM"),
  },
```

3. **`PAYEE_IDS`:** replace its declaration and comment with:

```ts
/** Offshore contractors: still with Locale, contracted, based outside Australia. They invoice; Accounting pays them in pesos. */
export const isOffshoreContractor = (r: MasterRow) =>
  r.status !== "inactive" && r.record?.employmentType === "Contractor" && Boolean(r.record.location) && r.record.location !== "Australia";

/** Everyone Accounting pays by invoice, from the Employee Master Roster: the previewed employee first, then A to Z. */
export const PAYEE_IDS: readonly string[] = [
  EMPLOYEE_ID,
  ...staffList(ORG_SEED)
    .filter((r) => r.id !== EMPLOYEE_ID && isOffshoreContractor(r))
    .map((r) => r.id),
];
```

4. **`seedInvoices`:**
   - The comment above it becomes "Each payee's invoice for every closed week since they started. The past runs paid those before 29 Sep on the Tuesday after; the latest week's arrived today and is pending. Andre also sent a one-off for a tool subscription."
   - Its loop becomes the version below. Someone who leaves the roster drops out instead of crashing, and history starts from each start date:

```ts
  PAYEE_SEED.filter((p) => PAYEE_IDS.includes(p.id)).forEach((p, pi) => {
    const row = ROWS.get(p.id)!;
    const rate = seedPayRate(row);
    if (!rate) return;
    const from = {
      entityName: row.name,
      name: row.name,
      address: p.street,
      cityStateZip: p.city,
      country: row.record?.location ?? "",
      logo: null,
    };
    // A week counts once it ends on or after their first day.
    const start = row.record?.start ?? "";
    const weeks = PAY_CALENDAR.filter((week) => addDays(week, 6) >= start);
    weeks.forEach((week, wi) => {
      const date = addDays(week, 7);
      const lines = hoursLines(week, HOURS[(pi * 3 + wi * 7) % HOURS.length], rate, makeId);
      const on = runFor(week);
      const settled = PAST_RATES.some((r) => r.on === on);
      const unsent = settled && on === LAST_RUN && UNSENT.has(p.id);
      const paid = settled && !unsent ? { on, rate: rateOn(on), php: toPhp(invoiceTotals(lines).total, rateOn(on)) } : undefined;
      out.push({
        id: `acct-${p.id}-${week}`,
        employeeId: p.id,
        number: invoiceNumber(row.name, date, wi + 1),
        date,
        due: addDays(date, 7),
        week,
        from,
        lines,
        notes: "",
        payment: p.method,
        status: settled ? "approved" : "pending",
        ...(paid ? { paid, decision: paidDecision(paid) } : unsent ? { decision: `Approved by ${ACCOUNTANT} · ${dayMonth(on)}` } : {}),
      });
    });
```

   - In the Andre one-off block, `number: invoiceNumber(row.name, date, PAY_WEEKS.length + 1)` becomes `number: invoiceNumber(row.name, date, weeks.length + 1)`. Keep the rest of that block.

5. **`personOf`:** its comment becomes `/** Name and position from the Employee Master Roster. */`.

- [ ] **Step 4: Verify**

```bash
npx tsc --noEmit
npx -y tsx --tsconfig "$S/tsconfig.check.json" "$S/check-accounting.mts"
```

Create `$S/pw/accounting.mjs`:

```js
import { done, go, open } from "./lib.mjs";

const s = await open("/accounting?tab=payrun");
const { page } = s;
await page.getByText("Pay run").first().waitFor();
await go(page, "/accounting?tab=history");
await page.getByText(/Pay history/).first().waitFor();
await done(s, "accounting");
```

Run: `node "$S/pw/accounting.mjs"`. Expected: `check-accounting: ok` and `accounting: ok`. In the Invoices step, check by eye that Nam Su Byun's pending invoice and Lane Dula's invoices appear.

- [ ] **Step 5: Commit**

```bash
git add src/components/modules/accounting/data.ts src/components/modules/employee/data.ts
git commit -m "Pay the roster's offshore contractors from their start dates

Payees are active contractors based outside Australia. That adds Lane Dula
and Nam Su Byun. Each payee's history starts with the week they started.

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: Kane's Employee portal starts on 29 Sep

**Files:**
- Modify: `src/components/modules/employee/data.ts`, `EmployeeScreen.tsx`
- Modify: `src/components/modules/accounting/data.ts` (one comment)
- Modify: `src/components/shell/dashboards.ts`
- Scratch: `$S/check-employee.mts`, `$S/pw/employee.mjs`

- [ ] **Step 1: Write the failing check**

Create `$S/check-employee.mts`:

```ts
import assert from "node:assert/strict";

const R = "file:///C:/Users/Kane/Desktop/Locale-launchpad-roster/src/components/modules";
const E = await import(`${R}/employee/data.ts`);
const A = await import(`${R}/accounting/data.ts`);

assert.deepEqual(E.PAY_WEEKS.map((w: { start: string }) => w.start), ["2026-09-27"]);
assert.deepEqual([...E.PAY_WEEKS[0].hours], [0, 0, 8, 8, 8, 8, 0]);
assert.equal(E.SEED_INVOICES.length, 0);
assert.equal(E.EMPLOYEE.record.start, "2026-09-29");
assert.equal(E.EMPLOYEE.department, "it");
assert.equal(E.GOES_BY, "Kane");
assert.equal(E.INVOICE_APPROVER, "Aled Smith");
assert.ok(!A.SEED_PAYOUTS.some((p: { employeeId: string }) => p.employeeId === "jan-kane-reroma"), "Kane is in no past run");
assert.ok(A.SEED_RUNS.every((r: { skipped: number }) => r.skipped === 0));

console.log("check-employee: ok");
```

Run: `npx -y tsx --tsconfig "$S/tsconfig.check.json" "$S/check-employee.mts"`. Expected: the `PAY_WEEKS` assertion fails, with six weeks.

- [ ] **Step 2: Kane's weeks follow the roster**

In `src/components/modules/employee/data.ts`:

- **Pay weeks:** replace the `PayWeek` doc comment, `PAY_WEEKS` and its comment with:

```ts
/** A pay week runs Sunday to Saturday, as HRIS's pay periods do. Hours are the tracked hours for each day, Sunday first. */
export interface PayWeek {
  /** The Sunday it starts (ISO). */
  start: string;
  hours: readonly [number, number, number, number, number, number, number];
}

/** Kane's tracked hours by pay week. Sample figures; only the weeks since their start date are used. */
const TRACKED: Record<string, PayWeek["hours"]> = {
  "2026-08-23": [0, 8, 8, 8, 8, 8, 0],
  "2026-08-30": [0, 8, 8.5, 8, 9, 8, 0],
  "2026-09-06": [0, 8, 8, 7.5, 8, 8, 0],
  "2026-09-13": [0, 8, 9, 8.5, 9, 8, 3],
  "2026-09-20": [0, 8, 8, 8, 8, 6.5, 0],
  "2026-09-27": [0, 0, 8, 8, 8, 8, 0],
};

/**
 * Kane's pay weeks, oldest first: the calendar's weeks since their start date
 * on the Employee Master Roster (Tuesday 29 Sep 2026), so for now just the
 * week that closed yesterday (Saturday 3 Oct).
 */
const NO_HOURS: PayWeek["hours"] = [0, 0, 0, 0, 0, 0, 0];

export const PAY_WEEKS: PayWeek[] = PAY_CALENDAR.filter((start) => addDays(start, 6) >= (EMPLOYEE.record.start ?? "")).map(
  (start): PayWeek => ({ start, hours: TRACKED[start] ?? NO_HOURS }),
);
```

`PAY_CALENDAR` must come above this block. Move it there if Task 6 put it lower. `addDays` is a function declaration, so it's hoisted.

- **Paid weeks:** replace `SEED_PAID_ON` and its comment with:

```ts
/**
 * One sent invoice per closed week but the latest, invoiced the Sunday after
 * it and due a week later. Accounting's Tuesday pay run paid the weeks listed
 * here; any other week is still with Accounts. Kane's first week is the latest,
 * so there's nothing sent yet.
 */
const PAID_ON: Record<string, string> = {
  "2026-08-23": "2026-09-01",
  "2026-08-30": "2026-09-08",
  "2026-09-06": "2026-09-15",
  "2026-09-13": "2026-09-22",
};
```

- **`SEED_INVOICES`'s map:** `const on = SEED_PAID_ON[i];` becomes `const on = PAID_ON[week.start];`.

In `src/components/modules/accounting/data.ts`'s `seedRuns`, the comment `// The 29 Sep run left Kane's week of 20 Sep undecided.` becomes `// Kane's invoices still with Accounts on a run's date were left for the next one.`.

In `src/components/shell/dashboards.ts`, the employee persona becomes `persona: { name: "Jan Kane Reroma", role: "Information Technology · AI Engineer" },`.

In `src/components/modules/employee/EmployeeScreen.tsx`'s doc comment, "AI Engineer in AI & Growth" becomes "AI Engineer in Information Technology".

- [ ] **Step 3: Verify**

```bash
npx tsc --noEmit
npx -y tsx --tsconfig "$S/tsconfig.check.json" "$S/check-employee.mts"
npx -y tsx --tsconfig "$S/tsconfig.check.json" "$S/check-accounting.mts"
```

Create `$S/pw/employee.mjs`:

```js
import assert from "node:assert/strict";
import { done, go, open } from "./lib.mjs";

const s = await open("/employee");
const { page } = s;
await page.getByText(/27 Sep – 3 Oct/).first().waitFor();
assert.ok(await page.getByText("Information Technology · AI Engineer").count(), "persona line");
await go(page, "/employee?tab=invoices&view=history");
await page.waitForTimeout(300);
await go(page, "/employee?tab=department");
await page.getByText("Information Technology").first().waitFor();
for (const name of ["Jericho Delos Santos", "Pablo Rafael Lopez Solorzano", "Andre Mikhail Serra", "Jan Kane Reroma"]) {
  await page.getByText(name).first().waitFor();
}
await done(s, "employee");
```

Run: `node "$S/pw/employee.mjs"`. Expected: `check-employee: ok`, `check-accounting: ok` and `employee: ok`. Look at the Invoices › History screenshot. An empty history must show the screen's empty state, not a blank card. If it's blank, note it for the final review rather than redesigning it here.

- [ ] **Step 4: Commit**

```bash
git add src/components/modules/employee/data.ts src/components/modules/employee/EmployeeScreen.tsx src/components/modules/accounting/data.ts src/components/shell/dashboards.ts
git commit -m "Start Kane's Employee portal on the roster's 29 Sep

Their history is the week of 27 Sep, ready to invoice, and they drop out
of the past pay runs. The persona line names their roster department.

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 8: Leadership, IT, Jarvis and wording

**Files:**
- Modify: `src/components/modules/leadership/data.ts`, `LeadershipOverview.tsx`, `src/components/modules/it/data.ts`
- Modify: `src/components/shell/assistant/jarvis-knowledge.ts`, `src/components/modules/hr/HrScreen.tsx`
- Scratch: `$S/check-counts.mts`, `$S/pw/jarvis.mjs`

- [ ] **Step 1: Write the failing check**

Create `$S/check-counts.mts`:

```ts
import assert from "node:assert/strict";

const R = "file:///C:/Users/Kane/Desktop/Locale-launchpad-roster/src/components/modules";
const L = await import(`${R}/leadership/data.ts`);
const I = await import(`${R}/it/data.ts`);

const head = Object.values(L)
  .flat()
  .find((w: unknown) => (w as { id?: string })?.id === "head") as { value: string; delta: string };
assert.equal(head.value, "76");
assert.equal(head.delta, "1 vacant seat");
const phishing = Object.values(I).find((v: unknown) => typeof v === "object" && v !== null && "phishingDue" in v) as { phishingDue: number };
assert.equal(phishing.phishingDue, 76);

console.log("check-counts: ok");
```

Run: `npx -y tsx --tsconfig "$S/tsconfig.check.json" "$S/check-counts.mts"`. Expected: it fails on `"23"`.

- [ ] **Step 2: Headcounts read the roster**

In `src/components/modules/leadership/data.ts`, add `import { HR_KPIS } from "../hr/data";` to the imports. The `head` widget becomes:

```ts
  {
    id: "head",
    group: "People",
    label: "Headcount",
    value: String(HR_KPIS.totalEmployees),
    delta: `${HR_KPIS.openPositions} vacant ${HR_KPIS.openPositions === 1 ? "seat" : "seats"}`,
    type: "kpi",
  },
```

In `LeadershipOverview.tsx`, the Headcount card's sub becomes ``sub: `HR · ${HR_KPIS.openPositions} vacant ${HR_KPIS.openPositions === 1 ? "seat" : "seats"}`,``.

In `src/components/modules/it/data.ts`, add `import { HR_KPIS } from "../hr/data";`. Replace `phishingDue: 23,` with `phishingDue: HR_KPIS.totalEmployees,`, keeping its comment.

- [ ] **Step 3: Jarvis answers from the roster**

In `src/components/shell/assistant/jarvis-knowledge.ts`:

- **Imports:** add `ON_PROBATION`, `ROSTER_SOURCE` and `formatIsoDate` to the hr import that already brings `HR_KPIS` and `DIVISIONS`.
- **"How many people work here?":** its `answer` becomes:

```ts
        answer: () => ({
          text: `${HR_KPIS.totalEmployees} people across ${DIVISIONS.length} divisions, from the Employee Master Roster:`,
          bullets: [
            ...DIVISIONS.map((d) => `${d.name}: ${d.count} (${d.share}%).`),
            `${plural(HR_KPIS.newJoiners, "new joiner")} in the 30 days to ${formatIsoDate(ROSTER_SOURCE.importedOn)}.`,
            ON_PROBATION.length ? `On probation: ${ON_PROBATION.map((r) => r.name).join(", ")}.` : "Nobody is on probation.",
          ],
          actions: [{ label: "Open the Global Master List", href: "/hr?tab=people" }],
          source: `Employee Master Roster · imported ${formatIsoDate(ROSTER_SOURCE.importedOn)}`,
        }),
```

- **Employee "Who's in my department?":** `source: "HR's org chart · live"` becomes `source: "Employee Master Roster"`.

(`plural(n, one, many = one + "s")` is defined near the top of the file.)

- [ ] **Step 4: Wording sweep**

In `src/components/modules/hr/HrScreen.tsx`, the doc comment's first sentence becomes: "HR — the mockup's `xm`, in seven sections: people from the Employee Master Roster, and leave, attendance, recruitment, performance and assets mirrored from Horilla."

Then list what's left:

```bash
grep -rn "Horilla" src
```

Every remaining hit must be about leave, attendance, assets, recruitment, performance, onboarding or pay rates (`pay-store.ts`, `RatesDialog.tsx`, `PayDialog.tsx`). Change any hit about employee records, the org chart, the master list or emails to "Employee Master Roster". Re-run the grep and read it once more.

- [ ] **Step 5: Verify**

Create `$S/pw/jarvis.mjs`:

```js
import { done, open } from "./lib.mjs";

const s = await open("/hr");
const { page } = s;
await page.getByRole("button", { name: /Jarvis|assistant/i }).first().click();
await page.getByText("How many people work here?").first().click();
await page.getByText(/76 people across 4 divisions, from the Employee Master Roster/).waitFor();
await page.getByText(/9 new joiners/).waitFor();
await done(s, "jarvis");
```

```bash
npx tsc --noEmit
npx -y tsx --tsconfig "$S/tsconfig.check.json" "$S/check-counts.mts"
node "$S/pw/jarvis.mjs"
```

Expected: `check-counts: ok` and `jarvis: ok`. If the bubble's accessible name differs, read `JarvisBubble.tsx` for its `aria-label` and fix the selector, not the component.

- [ ] **Step 6: Commit**

```bash
git add src/components/modules/leadership src/components/modules/it/data.ts src/components/shell/assistant/jarvis-knowledge.ts src/components/modules/hr/HrScreen.tsx
git commit -m "Read headcounts from the roster in Leadership, IT and Jarvis

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

If the wording sweep changed other files, stage those too.

---

### Task 9: Full verification

**Files:**
- Scratch: `$S/leak-check.mjs`, `$S/pw/stub.mjs`

- [ ] **Step 1: Every check, from clean**

```bash
node scripts/check-roster.mjs "$ROSTER_XLSX"
npx tsc --noEmit
for f in check-people check-accounting check-employee check-counts; do npx -y tsx --tsconfig "$S/tsconfig.check.json" "$S/$f.mts" || break; done
```

Expected: every line ends `ok`.

- [ ] **Step 2: Build with the private file, and confirm it's bundled**

Create `$S/leak-check.mjs`. It reports only counts, never values:

```js
/** node leak-check.mjs <private.ts> <expect: "some" | "none">: are any private folder links in .next/static? */
import fs from "node:fs";
import path from "node:path";

const [file, expect] = process.argv.slice(2);
const text = fs.readFileSync(file, "utf8");
const urls = [...text.matchAll(/"folderUrl": "([^"]+)"/g)].map((m) => m[1]);
const root = "C:/Users/Kane/Desktop/Locale-launchpad-roster/.next/static";
let hits = 0;
const walk = (dir) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (/\.(js|json|html)$/.test(e.name)) {
      const body = fs.readFileSync(p, "utf8");
      hits += urls.filter((u) => body.includes(u)).length;
    }
  }
};
walk(root);
console.log(`leak-check: ${hits} private links found in .next/static (expected ${expect})`);
if ((expect === "none") !== (hits === 0)) process.exitCode = 1;
```

Stop the dev server first: it shares `.next/`. Then:

```bash
npm run build
cp src/data/roster.private.ts "$S/roster.private.ts.bak"
node "$S/leak-check.mjs" src/data/roster.private.ts some
```

Expected: the build passes, and leak-check finds some private links. That proves the alias picked up the private file.

- [ ] **Step 3: Build without it, as a public clone would**

```bash
mv src/data/roster.private.ts "$S/roster.private.ts.moved"
rm -rf .next
npm run build
node "$S/leak-check.mjs" "$S/roster.private.ts.bak" none
```

Expected: the build passes, and leak-check finds no private links.

Then start the dev server without the private file (`npm run dev -- --port 3200`). Create `$S/pw/stub.mjs`:

```js
import assert from "node:assert/strict";
import fs from "node:fs";
import { done, open } from "./lib.mjs";

const s = await open("/hr?tab=people");
const { page } = s;
await page.getByRole("searchbox", { name: "Search the master list" }).fill("Jan Kane");
await page.getByRole("button", { name: "View Jan Kane Reroma" }).click();
const dialog = page.getByRole("dialog");
assert.equal(await dialog.getByText("Kept locally").count(), 3, "birthday, folder and remarks are kept locally");
await page.keyboard.press("Escape");
await page.getByRole("searchbox", { name: "Search the master list" }).fill("Thales");
await page.getByRole("button", { name: "View Thales Ferreira" }).click();
await dialog.getByText("No folder link in the roster").waitFor();
await page.keyboard.press("Escape");
await page.getByRole("searchbox", { name: "Search the master list" }).fill("");
const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Export CSV" }).click()]);
const head = fs.readFileSync(await download.path(), "utf8").split("\r\n")[0];
assert.ok(!head.includes('"Birthday"') && !head.includes('"Remarks"'), "no private columns without the private file");
await done(s, "stub");
```

Run: `node "$S/pw/stub.mjs"`. Expected: `stub: ok`.

- [ ] **Step 4: Put the private file back and re-run the browser checks**

Stop the dev server, then:

```bash
mv "$S/roster.private.ts.moved" src/data/roster.private.ts
rm -f "$S/roster.private.ts.bak"
rm -rf .next
```

Start the dev server again, then run every browser check:

```bash
for f in hr-readonly hr-roster hr-overview accounting employee jarvis; do node "$S/pw/$f.mjs" || break; done
```

Expected: six `ok` lines. Take a final set of screenshots: HR master list (table, cards, phone), the record dialog, the HR Overview, Admin's Global Master List, the Accounting pay run and Employee › Overview. Light and dark: add `?theme=dark`, or toggle the theme switch in the header. Look at each one.

- [ ] **Step 5: Confirm nothing private is staged or committed**

```bash
git status --short                      # roster.private.ts must not appear
git log -p main..HEAD -- src/data | grep -ciE '"(birthday|folderUrl|remarks)"'   # expect 0
```

- [ ] **Step 6: Hand back**

Use superpowers:finishing-a-development-branch. In the summary to Kane, include:
- what the import reported under "Coped with", as counts per kind with no names or values;
- the open points from the spec: Pablo's currency, and Jesse vs Jessica Williamson;
- the pay rates wording deviation (Global Constraints);
- the order of the merges with `feat/tickets-dashboard`, whose `projects` → `tickets` swap touches `DEPARTMENT_ROLES.operations` and `EXTRA_ROLES`.
