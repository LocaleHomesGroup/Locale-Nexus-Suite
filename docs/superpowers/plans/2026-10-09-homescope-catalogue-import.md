# HomeScope Catalogue Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Read HomeScope's catalogue from Monday's "Estimation Source Data" boards into Launchpad, in the format HomeScope already prices from, so HomeScope quotes from live data and Ops can see the catalogue under Operations.

**Architecture:** A read-only importer (`src/server/homescope/`) finds the twelve boards by title, reads every item through the mirror's existing Monday client, and turns them into one `HsBuilder` per builder using a title-and-type field map. Each run saves a new version of a builder's catalogue only when it changed (`launchpad.homescope_catalogues`) and records the run, with its warnings, in a new `launchpad.homescope_imports` table. HomeScope and a new Operations › HomeScope pricing screen read the current catalogue from `GET /api/homescope/catalogue`, and fall back to `catalogue.json` (the 6 October snapshot) when there is no database or nothing has been imported yet.

**Tech Stack:** Next.js 16 (App Router, route handlers, server actions), TypeScript 5.9, Postgres on Supabase (postgres.js in the app, PGlite in tests), `node --test` through tsx, Monday GraphQL API 2026-10 (read only).

**Spec:** [docs/Meeting4.md](../../Meeting4.md), decision 5 and action row 6 ("HomeScope's catalogue moves into Launchpad, under Operations"), plus the Design section below. It was written from a read of the live boards on 2026-10-09: 29 calls, read only, with output kept in the scratchpad.

## Global Constraints

- Monday is only ever read. Every Monday request goes through `createMondayClient` (via `mondayClientFor`), whose guard refuses mutations. GraphQL documents must not contain a single quote (the guard refuses them).
- Boards and columns are found by **title** (and a column also by **type**), never by id. Board ids, column ids, item data and prices never go into git: the repo is public.
- Tests use made-up builders ("Test Builder A"), made-up prices and made-up ids. Nothing read from Monday goes into a test, a fixture or this plan.
- `catalogue.json` stays as the fallback. Whether to replace its real prices with sample data is Kane's call, not this plan's.
- No sign-in exists yet. A deployment that serves the imported catalogue must sit behind Vercel Deployment Protection, like the mirrored files (mirror spec section 7).
- Work in the main folder (`C:\Users\Kane\Desktop\Locale-launchpad`). No worktree, no branch, **no commits**: Kane commits. Each task ends by listing the files it changed.
- Another session (`locale-launchpad-57`) is running the Supabase mirror plan in this folder with uncommitted work. Before editing a file that session also changes (`package.json`, anything in `supabase/migrations/`), copy it to the scratchpad. Never use bare `git stash`. Never edit `.superpowers/sdd/` files.
- The SQL must run on both postgres.js and PGlite: positional `$1` parameters, JSON passed as text and cast (`$1::jsonb`), timestamps read back as epoch milliseconds (`::float8`). Lists are passed as JSON, not as arrays.
- Next.js 16 differs from older versions: before writing the route handler or the server action, read `node_modules/next/dist/docs/` for route handlers and server actions, and copy the patterns in `app/api/files/monday/[assetId]/route.ts` and `src/server/actions/land.ts`.
- UI follows the HRIS standard already in this repo: `PageHeader`, `KpiCard`, `Card`, `Table`, `Reveal`, `SlidingTabs` / `TabPanels`, `AutoHeight`. Motion ships in the first pass and respects reduced motion (the shared components already do).
- No em dashes in UI copy, code comments or docs written for this plan.
- Run `npm test` and `npm run lint` (which is `tsc --noEmit`) at the end of every task. Both must pass.

## Review Focus

1. **A column renamed or deleted on Monday** (for example Ops rename "Specs Range B Price"). The import must stop, name the column, and leave the current catalogue untouched. It must never save blank prices. Tests: Task 1 Step 1 and Task 6 Step 1.
2. **Monday stops part-way through a read** (the daily limit, a timeout, the run's deadline). Nothing is saved, and a failed run is recorded with Monday's message. Test: Task 6 Step 1.
3. **The import runs again with no changes on Monday.** No new versions are written and `changed` is 0, so the history only grows when prices do. Test: Task 5 Step 1.
4. **A builder disappears from the Builders board.** Its catalogue is retired, so HomeScope stops offering it, as Monday's HomeScope does. Test: Task 5 Step 1.
5. **No database, or the catalogue route fails.** HomeScope and the Operations screen use the snapshot and say so. They never show a blank screen or an endless spinner. Test: Task 8 Step 1.

---

## Design: the format and the fields read from Monday

### Where the catalogue is

Monday workspace **HomeScope**, folder **Estimation Source Data**. It holds twelve boards, and Ops edit all of them today. The same workspace has a second folder, **Estimation Leads and Agreements** (Leads, Agreements, Dev_Leads, Dev_Agreements). That folder holds HomeScope's submitted quotes and generated agreements, which aren't catalogue, so they are **not imported** here.

Live counts on 2026-10-09: 9 builders, 365 models, 28 spec ranges, 4 levels, 91 elevations, 28 colour options, 26 site works, 8 title allowance rules, 88 BAL, 56 coastal and 81 noise rates, and 3,316 variations (including the bolt-on lines).

### The format

The format is the `HsBuilder` shape that HomeScope already prices from (`catalogue.ts`), so `catalogue.json` stays valid. The interfaces move to `src/data/homescope.ts`, so that server code can share them. They gain the optional fields marked **new** below. One builder:

| Field | Type | Notes |
|---|---|---|
| `name`, `address` | string | |
| `bundleAllowance` | boolean | The delayed-title allowance sits inside the base price (LaVida) |
| `allowanceOnPrelim` | boolean | Allowance percentages apply to the preliminary contract (New Choice) |
| `logo` **new** | `HsImage \| null` | `{ assetId, name }`. Referenced, not copied |
| `models[]` | `HsModel` | `name, frontage, houseArea, totalArea, beds, baths, corner, prices{A..D}`, plus `blockType` **new** and `notes` **new** |
| `ranges[]` | `HsRange` | `name, level, position, column` (the letter a model's price is read from) |
| `elevations[]` | `HsElevation` | `name, price`, plus `image` **new** |
| `colours[]` | `HsColour` | `name, price` (always 0), plus `description` **new** and `image` **new** |
| `siteCosts[]` | `HsSiteCost` | `name, workType, price`, plus `costType` **new** ("Fixed", "Provisional Sum") |
| `allowances[]` | `HsAllowanceRule` | `due, holdMonths, type, value, monthlyStep, initial` |
| `bal[]`, `coastal[]`, `noise[]` | `HsRate` | `name, price, area` (floor-area band, or null) |
| `variations[]` | `HsVariation` | `area, code, description, unit, charge, credit` |
| `boltOns{model}` | `HsBoltOn[]` | `description, charge, credit` |

### Field map (title and type on Monday, then the field)

The builder comes from the **Builder** link column on every board except Variations. Variations take it from the **Builder status**, because HomeScope does: all 164 of Move's variations have no link. These rules reproduce the snapshot exactly for its four builders. That includes Forma's 29 bolt-on designs and 521 bolt-on lines.

| Board | Monday column (type) | Field |
|---|---|---|
| Builders | item name | `name` |
| | Address (location) | `address` |
| | Logo (file) | `logo` |
| | Title Allowances In Base (checkbox) | `bundleAllowance` |
| | Calculate Allowance On Prelim (checkbox) | `allowanceOnPrelim` |
| Models | item name | `name` |
| | Builder (board_relation) | which builder. Unlinked models are left out, as HomeScope leaves them out |
| | Specs Range A / B / C / D Price (numbers) | `prices.A` to `prices.D`. A blank cell leaves the letter out |
| | To Suit Block (numbers) | `frontage` |
| | House Area (m²), Total Area (m²) (numbers) | `houseArea`, `totalArea` |
| | Bedroom, Bathroom (numbers) | `beds`, `baths` |
| | Corner Block (checkbox) | `corner` |
| | Block Type (text) | `blockType` ("Standard", "Dual Living") |
| | Notes (text) | `notes` |
| Levels | item name, Level Position (numbers) | a range's `level` and `position` |
| Specification Ranges | item name | `name` |
| | Builder (board_relation) | which builder |
| | Model Price Column (text) | `column`: "Specs Range B Price" gives "B" |
| | Levels (board_relation) | `level`, `position` (from Levels) |
| Elevation Styles | Style Name (text) | `name` (the item name is always "Front Elevation") |
| | Style Price (numbers) | `price` (blank is 0) |
| | Main Image (file) | `image` |
| | Builder (board_relation) | which builder |
| Color Options | item name | `name` |
| | Description (text) | `description` |
| | Main Image (file) | `image` |
| | Builder (board_relation) | which builders (one option is linked to two) |
| Site Works Costs | item name, Work Type (text), Cost Type (text), Price (numbers) | `name, workType, costType, price` |
| | Builder (board_relation) | which builder |
| Title Allowances | item name | `due` ("More than 6 months") |
| | Price Hold Period, Allowance Value, Monthly Step % (numbers) | `holdMonths, value, monthlyStep` |
| | Allowance Type (status) | `type` |
| | Topup Amount (numbers) | `initial` |
| | Builders (board_relation) | which builders (the rule is copied to each) |
| Site Costs - BAL Rating / Coastal Distance / Noise Package | item name, Price, Total Floor Area (numbers) | `name, price, area` |
| | Builder (board_relation) | which builder |
| Variations | Builder (status) | which builder |
| | item name | `area` ("Electrical") |
| | Item Code, Unit (text), Description (long_text), Charge, Credit (numbers) | `code, unit, description, charge, credit` |
| | item name "Bolt On Pricing - *design*" | instead of a variation: a bolt-on line for that design, matched without regard to case. Lines for a design the builder doesn't have are skipped |

**Not imported, on purpose:** "Agreement docotive View ID" (Builders: the agreement generator, not pricing), Variations' "Builder Linked" and "Net" (HomeScope doesn't use them), every board's Leads links, the Subitems boards (all empty), the "Locale Estimation Admin" and "Build Vibe app" objects, and the Models board's 60 stray text columns titled "Builder", "Leads" and "Corner Block". The typed columns win over the stray ones because columns are matched on type as well as title.

### What the import reports (warnings)

Warnings are grouped by board and message, with the item names. They are saved with the run and shown on Operations › HomeScope pricing. From the live read, these are expected on the first run:

- Models: 8 aren't linked to a builder. One is "New model", with no prices at all.
- Models: 4 have no To Suit Block (they only show for corner blocks if ticked).
- Models: New Era has two designs named "rosewood".
- Variations: Forma has bolt-on pricing for 10 designs it doesn't have (114 lines), including the misspelt "Riveira".
- Title Allowances: Redink SW has no delayed-title rule.

### Not in this plan

Editing the catalogue in Launchpad. The import still makes Monday the source until that exists, and editing gets its own plan. Also out: copying images into Storage (this plan only references them), the Doc formatter's commission box and publish targets (Andre's area), and scheduling a recurring import (it runs from the CLI and the Operations button).

---

## File Structure

| File | Responsibility |
|---|---|
| `src/data/homescope.ts` (create) | The catalogue format and the import's shared types, used by server and client |
| `src/server/homescope/boards.ts` (create) | Where the catalogue is on Monday, the field map, column resolution |
| `src/server/homescope/test-boards.ts` (create) | Made-up boards and items for tests |
| `src/server/homescope/to-catalogue.ts` (create) | Pure transform: twelve boards to `HsBuilder[]` and warnings |
| `src/server/homescope/read.ts` (create) | Reads the twelve boards from Monday |
| `src/server/homescope/store.ts` (create) | Saves versions and runs, loads the current catalogue and the last run |
| `src/server/homescope/run.ts` (create) | One import: read, transform, save or dry run, failures recorded |
| `src/server/homescope/compare.ts` (create) | How an import differs from `catalogue.json`, for the dry run |
| `supabase/migrations/20261010000100_homescope_imports.sql` (create) | `launchpad.homescope_imports`, and `import_id` on catalogue versions |
| `scripts/homescope-import.ts` (create) | `npm run homescope:import -- [--dry-run] [--compare-snapshot]` |
| `app/api/homescope/catalogue/route.ts` (create) | The current catalogue and the last run, as JSON |
| `src/server/actions/homescope.ts` (create) | The Operations screen's "Import from Monday" |
| `src/components/modules/sales/costing/homescope/catalogue-state.ts` (create) | Pure: route answer to screen state, and the source label |
| `src/components/modules/sales/costing/homescope/catalogue-context.tsx` (create) | `useLiveCatalogue`, `CatalogueProvider`, `useCatalogue` |
| `src/components/modules/operations/homescope/HomeScopePricing.tsx` (create) | Operations › HomeScope pricing |
| `src/components/modules/operations/homescope/BuilderCatalogue.tsx` (create) | One builder's catalogue, section by section |
| `catalogue.ts`, `pricing.ts`, `store.ts`, `HomeScope.tsx`, `steps/ClientStep.tsx`, `steps/PickSteps.tsx`, `steps/SiteSteps.tsx` (modify, in `sales/costing/homescope/`) | Price from the provided catalogue instead of the bundled one |
| `package.json` (modify) | One script line |
| `src/components/shell/dashboards.ts`, `src/components/modules/operations/OperationsScreen.tsx` (modify) | The rail entry and the tab |

---

### Task 1: The catalogue format, the field map and column resolution

**Files:**
- Create: `src/data/homescope.ts`
- Modify: `src/components/modules/sales/costing/homescope/catalogue.ts:16-103` (the interfaces)
- Create: `src/server/homescope/boards.ts`
- Create: `src/server/homescope/test-boards.ts`
- Test: `src/server/homescope/boards.test.ts`

**Interfaces:**
- Consumes: `ItemRow`, `StoredValue` from `src/server/mirror/monday/normalise.ts`.
- Produces: the types in `@/data/homescope` (`HsBuilder` and friends, `HsImage`, `HsElevation`, `HsColour`, `Catalogue`, `ImportWarning`, `ImportTrigger`, `ImportRecord`, `ImportSummary`, `BuilderCounts`, `CatalogueResponse`). From `boards.ts`: `HOMESCOPE_WORKSPACE`, `SOURCE_FOLDER`, `BOARDS`, `BoardKey`, `FIELDS`, `ColumnInfo`, `BoardDump`, `EstimationBoards`, `ColumnIds`, `resolveColumns(columns: Record<BoardKey, ColumnInfo[]>): ColumnIds`, `CatalogueFormatError`. From `test-boards.ts`: `columnsFor(key)`, `allColumns()`, `item(key, name, cells?, over?)`, `boards(items?)`, `testBuilder(name, priceA?)`.

- [ ] **Step 1: Write the shared types.** Create `src/data/homescope.ts`:

```ts
/**
 * HomeScope's catalogue format: what Launchpad keeps for each builder, read from
 * the "Estimation Source Data" boards in Monday's HomeScope workspace (Meeting4,
 * decision 5). catalogue.json, the 6 October snapshot, is the same shape without
 * the optional fields. Shared by the importer, the route and the screens.
 */

/** A file in a Monday file column. Referenced, not copied: the bytes stay on Monday for now. */
export interface HsImage {
  assetId: string;
  name: string;
}

export interface HsModel {
  name: string;
  /** "To suit block" frontage in metres. */
  frontage: number | null;
  houseArea: number | null;
  totalArea: number | null;
  beds: number | null;
  baths: number | null;
  /** Ticked in Monday as a corner-block design. */
  corner: boolean;
  /** Price per spec-range column, by letter: { A: 300000, B: 320000 }. A letter with no price is absent. */
  prices: Record<string, number>;
  /** "Standard" or "Dual Living". */
  blockType?: string | null;
  notes?: string | null;
}

export interface HsRange {
  name: string;
  /** "Base", "Level 1"… */
  level: string;
  position: number;
  /** The model price column this range reads: "A" is Specs Range A Price. */
  column: string;
}

export interface HsPriced {
  name: string;
  price: number;
}

export interface HsElevation extends HsPriced {
  image?: HsImage | null;
}

export interface HsColour extends HsPriced {
  description?: string | null;
  image?: HsImage | null;
}

export interface HsSiteCost extends HsPriced {
  workType: string;
  /** "Fixed" or "Provisional Sum". */
  costType?: string | null;
}

export interface HsAllowanceRule {
  /** "More than 6 months", "Up to 3 months", "Between 3-6 months". */
  due: string;
  /** How long the builder holds its price before titles are late. */
  holdMonths: number;
  /** "Fixed Price", "Percentage of Base Price", "Cumulative Percentage of Base Price". */
  type: string;
  value: number;
  /** Cumulative only: extra percent for each month after the first. */
  monthlyStep: number;
  /** Monday's "Topup Amount": added to the allowance once. */
  initial: number;
}

/** A BAL, coastal or noise rate. `area` is set when the builder prices by total floor area. */
export interface HsRate extends HsPriced {
  area: number | null;
}

export interface HsVariation {
  /** The variation area, "Electrical". */
  area: string;
  code: string;
  description: string;
  unit: string;
  /** Per unit when included. */
  charge: number;
  /** Per unit when excluded (0 = no credit rate). */
  credit: number;
}

export interface HsBoltOn {
  description: string;
  charge: number;
  credit: number;
}

export interface HsBuilder {
  name: string;
  address: string;
  /** LaVida: the delayed-title allowance sits inside the base build price. */
  bundleAllowance: boolean;
  /** New Choice: allowance percentages apply to the preliminary contract, not the base price. */
  allowanceOnPrelim: boolean;
  logo?: HsImage | null;
  models: HsModel[];
  ranges: HsRange[];
  elevations: HsElevation[];
  siteCosts: HsSiteCost[];
  allowances: HsAllowanceRule[];
  bal: HsRate[];
  coastal: HsRate[];
  noise: HsRate[];
  colours: HsColour[];
  variations: HsVariation[];
  /** Bolt-on pricing per model name. */
  boltOns: Record<string, HsBoltOn[]>;
}

/** The catalogue a screen prices from. */
export interface Catalogue {
  builders: HsBuilder[];
  /** "monday": imported by Launchpad. "snapshot": catalogue.json. */
  source: "monday" | "snapshot";
  /** An import's finish time (ISO), or the snapshot's date (YYYY-MM-DD). */
  asOf: string;
}

/** Something an import couldn't use, or that Ops should check, on one board. */
export interface ImportWarning {
  /** The Monday board's title. */
  board: string;
  /** What's wrong, and what HomeScope does about it. */
  message: string;
  /** The items it applies to, by name, each once. */
  items: string[];
}

export type ImportTrigger = "cli" | "screen";

/** One import run, as launchpad.homescope_imports keeps it. */
export interface ImportRecord {
  id: string;
  finishedAt: string;
  trigger: ImportTrigger;
  status: "ok" | "failed";
  calls: number;
  builders: number;
  changed: number;
  warnings: ImportWarning[];
  error: string | null;
}

export interface BuilderCounts {
  name: string;
  models: number;
  ranges: number;
  elevations: number;
  colours: number;
  siteCosts: number;
  variations: number;
  boltOnModels: number;
}

/** What an import did, for the CLI and the Operations screen. */
export interface ImportSummary {
  status: "ok" | "failed";
  dryRun: boolean;
  calls: number;
  builders: BuilderCounts[];
  /** Builders that got a new version. */
  changed: string[];
  /** Builders no longer on Monday, now retired. */
  retired: string[];
  warnings: ImportWarning[];
  error: string | null;
}

/** GET /api/homescope/catalogue. */
export type CatalogueResponse =
  | { kind: "off" }
  | { kind: "live"; catalogue: Catalogue | null; lastImport: ImportRecord | null }
  | { kind: "error"; message: string };
```

- [ ] **Step 2: Point `catalogue.ts` at the shared types.** In `src/components/modules/sales/costing/homescope/catalogue.ts`, delete the interfaces from `export interface HsModel {` (line 16) to the end of `export interface HsBuilder { ... }` (line 103). Put this in their place:

```ts
export type {
  HsAllowanceRule,
  HsBoltOn,
  HsBuilder,
  HsColour,
  HsElevation,
  HsImage,
  HsModel,
  HsPriced,
  HsRange,
  HsRate,
  HsSiteCost,
  HsVariation,
} from "@/data/homescope";
import type { HsBuilder, HsModel, HsRange, HsRate } from "@/data/homescope";
```

Move the `import type` line up beside the other imports at the top of the file, after `import { ORG_SEED, orgDepartmentOf } from "@/components/modules/hr/data";`. Leave every function in the file as it is for now (Task 8 changes `builderByName`).

- [ ] **Step 3: Check that nothing else broke.**

Run: `npm run lint`
Expected: no errors. Every importer of `./catalogue` still gets the same names.

- [ ] **Step 4: Write the field map.** Create `src/server/homescope/boards.ts`:

```ts
import type { ItemRow } from "../mirror/monday/normalise";

/**
 * Where HomeScope's catalogue lives on Monday, and which column holds each field.
 * Boards and columns are found by title (a column also by type), never by id, so
 * no Monday id enters this public repo. Ops edit these boards today, in the
 * HomeScope workspace's "Estimation Source Data" folder. The Design section of
 * docs/superpowers/plans/2026-10-09-homescope-catalogue-import.md explains each field.
 */
export const HOMESCOPE_WORKSPACE = "HomeScope";
export const SOURCE_FOLDER = "Estimation Source Data";

/** The twelve boards, by their titles on Monday. */
export const BOARDS = {
  builders: "Builders",
  models: "Models",
  levels: "Levels",
  ranges: "Specification Ranges",
  elevations: "Elevation Styles",
  colours: "Color Options",
  siteCosts: "Site Works Costs",
  allowances: "Title Allowances",
  bal: "Site Costs - BAL Rating",
  coastal: "Site Costs - Coastal Distance",
  noise: "Site Costs - Noise Package",
  variations: "Variations",
} as const;

export type BoardKey = keyof typeof BOARDS;

type Field = readonly [title: string, type: string];

/**
 * Each field the import reads: the column's title and type. Matching the type as well
 * as the title skips the Models board's stray text columns titled "Builder", "Leads"
 * and "Corner Block". Variations' builder is the "Builder" status, not "Builder
 * Linked": HomeScope reads the status, and Move's variations have no link.
 */
export const FIELDS = {
  builders: {
    address: ["Address", "location"],
    logo: ["Logo", "file"],
    bundleAllowance: ["Title Allowances In Base", "checkbox"],
    allowanceOnPrelim: ["Calculate Allowance On Prelim", "checkbox"],
  },
  models: {
    builder: ["Builder", "board_relation"],
    priceA: ["Specs Range A Price", "numbers"],
    priceB: ["Specs Range B Price", "numbers"],
    priceC: ["Specs Range C Price", "numbers"],
    priceD: ["Specs Range D Price", "numbers"],
    frontage: ["To Suit Block", "numbers"],
    houseArea: ["House Area (m²)", "numbers"],
    totalArea: ["Total Area (m²)", "numbers"],
    beds: ["Bedroom", "numbers"],
    baths: ["Bathroom", "numbers"],
    corner: ["Corner Block", "checkbox"],
    blockType: ["Block Type", "text"],
    notes: ["Notes", "text"],
  },
  levels: {
    position: ["Level Position", "numbers"],
  },
  ranges: {
    builder: ["Builder", "board_relation"],
    priceColumn: ["Model Price Column", "text"],
    level: ["Levels", "board_relation"],
  },
  elevations: {
    builder: ["Builder", "board_relation"],
    style: ["Style Name", "text"],
    price: ["Style Price", "numbers"],
    image: ["Main Image", "file"],
  },
  colours: {
    builder: ["Builder", "board_relation"],
    description: ["Description", "text"],
    image: ["Main Image", "file"],
  },
  siteCosts: {
    builder: ["Builder", "board_relation"],
    workType: ["Work Type", "text"],
    costType: ["Cost Type", "text"],
    price: ["Price", "numbers"],
  },
  allowances: {
    builders: ["Builders", "board_relation"],
    holdMonths: ["Price Hold Period", "numbers"],
    type: ["Allowance Type", "status"],
    value: ["Allowance Value", "numbers"],
    monthlyStep: ["Monthly Step %", "numbers"],
    topUp: ["Topup Amount", "numbers"],
  },
  bal: {
    builder: ["Builder", "board_relation"],
    area: ["Total Floor Area", "numbers"],
    price: ["Price", "numbers"],
  },
  coastal: {
    builder: ["Builder", "board_relation"],
    area: ["Total Floor Area", "numbers"],
    price: ["Price", "numbers"],
  },
  noise: {
    builder: ["Builder", "board_relation"],
    area: ["Total Floor Area", "numbers"],
    price: ["Price", "numbers"],
  },
  variations: {
    builder: ["Builder", "status"],
    description: ["Description", "long_text"],
    unit: ["Unit", "text"],
    charge: ["Charge", "numbers"],
    credit: ["Credit", "numbers"],
    code: ["Item Code", "text"],
  },
} as const satisfies Record<BoardKey, Record<string, Field>>;

export type FieldOf<K extends BoardKey> = keyof (typeof FIELDS)[K];

/** Each board's column ids, by field. */
export type ColumnIds = { [K in BoardKey]: Record<FieldOf<K>, string> };

export interface ColumnInfo {
  id: string;
  title: string;
  type: string;
}

/** One board as read: its columns and its items. */
export interface BoardDump {
  columns: ColumnInfo[];
  items: ItemRow[];
}

export type EstimationBoards = Record<BoardKey, BoardDump>;

/** The boards no longer have a column the import needs. Nothing is imported, and the current catalogue stays. */
export class CatalogueFormatError extends Error {
  constructor(readonly problems: string[]) {
    super(`HomeScope's Monday boards have changed: ${problems.join("; ")}. Nothing was imported.`);
    this.name = "CatalogueFormatError";
  }
}

/**
 * Each board's column ids by field. A title matches without regard to case or
 * surrounding spaces, and the type must match exactly; the first match wins.
 * Throws CatalogueFormatError naming every missing field, so a renamed column
 * stops the import instead of reading as blank prices.
 */
export function resolveColumns(columns: Record<BoardKey, ColumnInfo[]>): ColumnIds {
  const problems: string[] = [];
  const out = {} as Record<BoardKey, Record<string, string>>;
  for (const key of Object.keys(BOARDS) as BoardKey[]) {
    out[key] = {};
    for (const [field, [title, type]] of Object.entries(FIELDS[key]) as [string, Field][]) {
      const col = (columns[key] ?? []).find((c) => c.title.trim().toLowerCase() === title.toLowerCase() && c.type === type);
      if (col) out[key][field] = col.id;
      else problems.push(`${BOARDS[key]} has no ${type} column titled "${title}"`);
    }
  }
  if (problems.length) throw new CatalogueFormatError(problems);
  return out as ColumnIds;
}
```

- [ ] **Step 5: Write the test fixtures.** Create `src/server/homescope/test-boards.ts`:

```ts
import type { HsBuilder } from "@/data/homescope";
import type { ItemRow, StoredValue } from "../mirror/monday/normalise";
import { BOARDS, FIELDS, type BoardKey, type ColumnInfo, type EstimationBoards } from "./boards";

/**
 * Made-up Monday boards for the catalogue tests. Column ids are "<board>.<field>".
 * No real builder, price or Monday id belongs here: the repo is public.
 */

export function columnsFor(key: BoardKey): ColumnInfo[] {
  return [
    { id: "name", title: "Name", type: "name" },
    ...Object.entries(FIELDS[key]).map(([field, [title, type]]) => ({ id: `${key}.${field}`, title, type })),
  ];
}

export function allColumns(): Record<BoardKey, ColumnInfo[]> {
  const out = {} as Record<BoardKey, ColumnInfo[]>;
  for (const key of Object.keys(BOARDS) as BoardKey[]) out[key] = columnsFor(key);
  return out;
}

/** A cell as the mirror stores it, from a plain value: a number, text, a label, true for a ticked box, ids for a link, or an asset id for a file. */
function cellFor(type: string, v: unknown): StoredValue {
  switch (type) {
    case "numbers":
      return { type, text: v == null ? "" : String(v), value: v == null ? null : String(v) };
    case "checkbox":
      return { type, text: v ? "v" : "", value: v ? { checked: "true" } : null };
    case "status":
      return v == null ? { type, text: null, value: null } : { type, text: String(v), value: null, label: String(v) };
    case "board_relation":
      return { type, text: null, value: null, linked_item_ids: ((v as (string | number)[] | null) ?? []).map(String) };
    case "file":
      return { type, text: "", value: v == null ? null : { files: [{ assetId: Number(v), name: `image-${v}.jpg` }] } };
    default:
      return { type, text: v == null ? null : String(v), value: null };
  }
}

let nextId = 1;

/** An active item on `key`'s board. `cells` are keyed by field: { builder: ["1"], priceA: 300000 }. */
export function item(key: BoardKey, name: string, cells: Record<string, unknown> = {}, over: Partial<ItemRow> = {}): ItemRow {
  const column_values: Record<string, StoredValue> = {};
  for (const [field, v] of Object.entries(cells)) {
    const spec = (FIELDS[key] as Record<string, readonly [string, string]>)[field];
    if (!spec) throw new Error(`${BOARDS[key]} has no field "${field}" in FIELDS`);
    column_values[`${key}.${field}`] = cellFor(spec[1], v);
  }
  return {
    id: nextId++,
    board_id: 1,
    board_name: BOARDS[key],
    group_id: null,
    parent_item_id: null,
    name,
    state: "active",
    creator_id: null,
    monday_created_at: null,
    monday_updated_at: "2026-10-09T00:00:00Z",
    column_values,
    ...over,
  };
}

/** All twelve boards with every FIELDS column, empty unless given items. */
export function boards(items: Partial<Record<BoardKey, ItemRow[]>> = {}): EstimationBoards {
  const out = {} as EstimationBoards;
  for (const key of Object.keys(BOARDS) as BoardKey[]) out[key] = { columns: columnsFor(key), items: items[key] ?? [] };
  return out;
}

/** A builder with one made-up model and nothing else, for the store and run tests. */
export function testBuilder(name: string, priceA = 300_000): HsBuilder {
  return {
    name,
    address: "1 Test Street, Perth WA, Australia",
    bundleAllowance: false,
    allowanceOnPrelim: false,
    logo: null,
    models: [{ name: "Test Model", frontage: 12.5, houseArea: 150, totalArea: 200, beds: 4, baths: 2, corner: false, prices: { A: priceA } }],
    ranges: [],
    elevations: [],
    siteCosts: [],
    allowances: [],
    bal: [],
    coastal: [],
    noise: [],
    colours: [],
    variations: [],
    boltOns: {},
  };
}
```

- [ ] **Step 6: Write the failing tests.** Create `src/server/homescope/boards.test.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { CatalogueFormatError, resolveColumns } from "./boards";
import { allColumns } from "./test-boards";

test("columns: found by title and type, so a stray text column with the same title is skipped", () => {
  const columns = allColumns();
  // The Models board has dozens of text columns titled "Builder" before the real link column.
  columns.models = [
    { id: "stray_1", title: "Builder", type: "text" },
    { id: "stray_2", title: "Builder", type: "text" },
    ...columns.models,
  ];
  const ids = resolveColumns(columns);
  assert.equal(ids.models.builder, "models.builder");
  assert.equal(ids.variations.builder, "variations.builder");
});

test("columns: a title matches without regard to case or surrounding spaces", () => {
  const columns = allColumns();
  columns.models = columns.models.map((c) => (c.id === "models.priceB" ? { ...c, title: "  specs range b price " } : c));
  assert.equal(resolveColumns(columns).models.priceB, "models.priceB");
});

test("columns: a renamed or deleted column stops the import and names every one missing", () => {
  const columns = allColumns();
  columns.models = columns.models.filter((c) => c.id !== "models.priceB");
  columns.variations = columns.variations.map((c) => (c.id === "variations.charge" ? { ...c, title: "Charge (inc GST)" } : c));
  assert.throws(
    () => resolveColumns(columns),
    (e: unknown) =>
      e instanceof CatalogueFormatError &&
      e.problems.length === 2 &&
      /Models has no numbers column titled "Specs Range B Price"/.test(e.message) &&
      /Variations has no numbers column titled "Charge"/.test(e.message) &&
      /Nothing was imported/.test(e.message),
  );
});
```

- [ ] **Step 7: Run the tests.**

Run: `node --import tsx --test src/server/homescope/boards.test.ts`
Expected: 3 pass. (They pass once Steps 4 and 5 exist. If one fails, fix `boards.ts`, not the test.)

- [ ] **Step 8: Run the whole suite and the type check.**

Run: `npm test` then `npm run lint`
Expected: everything passes.

- [ ] **Step 9: Leave it uncommitted.** Run `git status --short` and check that the only new or changed paths from this task are `src/data/homescope.ts`, `src/server/homescope/` and `src/components/modules/sales/costing/homescope/catalogue.ts`.

---

### Task 2: Transform part 1: builders, spec ranges and models

**Files:**
- Create: `src/server/homescope/to-catalogue.ts`
- Test: `src/server/homescope/to-catalogue.test.ts`

**Interfaces:**
- Consumes: `BOARDS`, `EstimationBoards`, `ColumnIds`, `resolveColumns`, `BoardKey`, `BoardDump` (Task 1); `fileAssets` and the `ItemRow` / `StoredValue` types from `src/server/mirror/monday/normalise.ts`; `HsBuilder`, `HsImage`, `HsModel`, `ImportWarning` from `@/data/homescope`.
- Produces: `toCatalogue(boards: EstimationBoards): CatalogueResult`, `CatalogueResult = { builders: HsBuilder[]; warnings: ImportWarning[] }`, and `num(cell)` (exported for tests).

- [ ] **Step 1: Write the failing tests.** Create `src/server/homescope/to-catalogue.test.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { num, toCatalogue } from "./to-catalogue";
import { boards, item } from "./test-boards";

const A = () => item("builders", "Test Builder A", { address: "1 Test Street, Perth WA, Australia", allowanceOnPrelim: true, logo: 77 }, { id: 1 });
const B = () => item("builders", "Test Builder B", { bundleAllowance: true }, { id: 2 });
const base = () => item("levels", "Base", { position: 1 }, { id: 31 });
const level1 = () => item("levels", "Level 1", { position: 2 }, { id: 32 });

test("builders: one per item on the Builders board, in board order, with the flags and the logo", () => {
  const { builders } = toCatalogue(boards({ builders: [A(), B()] }));
  assert.deepEqual(builders.map((b) => b.name), ["Test Builder A", "Test Builder B"]);
  assert.equal(builders[0].address, "1 Test Street, Perth WA, Australia");
  assert.equal(builders[0].allowanceOnPrelim, true);
  assert.equal(builders[0].bundleAllowance, false);
  assert.equal(builders[1].bundleAllowance, true);
  assert.deepEqual(builders[0].logo, { assetId: "77", name: "image-77.jpg" });
  assert.equal(builders[1].logo, null);
});

test("spec ranges: the price column's letter, and the linked level's name and position", () => {
  const { builders } = toCatalogue(
    boards({
      builders: [A()],
      levels: [base(), level1()],
      ranges: [
        item("ranges", "Test Range One", { builder: ["1"], priceColumn: "Specs Range A Price", level: ["31"] }),
        item("ranges", "Test Range Two", { builder: ["1"], priceColumn: "Specs Range C Price", level: ["32"] }),
      ],
    }),
  );
  assert.deepEqual(builders[0].ranges, [
    { name: "Test Range One", level: "Base", position: 1, column: "A" },
    { name: "Test Range Two", level: "Level 1", position: 2, column: "C" },
  ]);
});

test("spec ranges: one with an unreadable price column or no level is skipped and reported", () => {
  const { builders, warnings } = toCatalogue(
    boards({
      builders: [A()],
      levels: [base()],
      ranges: [
        item("ranges", "Test Range Odd", { builder: ["1"], priceColumn: "Price A", level: ["31"] }),
        item("ranges", "Test Range Loose", { builder: ["1"], priceColumn: "Specs Range B Price", level: [] }),
      ],
    }),
  );
  assert.deepEqual(builders[0].ranges, []);
  assert.deepEqual(
    warnings.map((w) => [w.board, w.items]),
    [
      ["Specification Ranges", ["Test Range Odd"]],
      ["Specification Ranges", ["Test Range Loose"]],
    ],
  );
});

test("models: every field, prices only for letters that have one, and a blank price left out (not $0)", () => {
  const { builders } = toCatalogue(
    boards({
      builders: [A()],
      models: [
        item("models", "Test Model", {
          builder: ["1"],
          priceA: 300000,
          priceB: null,
          priceC: 0,
          frontage: 12.5,
          houseArea: 150.5,
          totalArea: 201,
          beds: 4,
          baths: 2,
          corner: true,
          blockType: "Dual Living",
          notes: "Carport",
        }),
      ],
    }),
  );
  assert.deepEqual(builders[0].models, [
    {
      name: "Test Model",
      frontage: 12.5,
      houseArea: 150.5,
      totalArea: 201,
      beds: 4,
      baths: 2,
      corner: true,
      prices: { A: 300000, C: 0 },
      blockType: "Dual Living",
      notes: "Carport",
    },
  ]);
});

test("models: an unlinked model is left out, as HomeScope leaves it out, and reported once by name", () => {
  const { builders, warnings } = toCatalogue(
    boards({
      builders: [A()],
      models: [item("models", "Test Loose", { priceA: 1 }), item("models", "Test Loose", { priceA: 2 })],
    }),
  );
  assert.deepEqual(builders[0].models, []);
  assert.deepEqual(warnings, [
    { board: "Models", message: "isn't linked to a builder, so HomeScope doesn't show it", items: ["Test Loose"] },
  ]);
});

test("models: no price, no frontage on a non-corner design, or a name used twice are kept and reported", () => {
  const { builders, warnings } = toCatalogue(
    boards({
      builders: [A()],
      models: [
        item("models", "Test Unpriced", { builder: ["1"], frontage: 10 }),
        item("models", "Test Narrow", { builder: ["1"], priceA: 1 }),
        item("models", "Test Twin", { builder: ["1"], priceA: 1, frontage: 10 }),
        item("models", "test twin", { builder: ["1"], priceA: 2, frontage: 10 }),
      ],
    }),
  );
  assert.equal(builders[0].models.length, 4);
  const said = Object.fromEntries(warnings.map((w) => [w.message, w.items]));
  assert.deepEqual(said["has no price in any spec range"], ["Test Unpriced"]);
  assert.deepEqual(said["has no To Suit Block and isn't a corner design, so no block search finds it"], ["Test Narrow"]);
  assert.deepEqual(said["appears twice at Test Builder A; HomeScope prices the first"], ["test twin"]);
});

test("archived and deleted items are ignored", () => {
  const { builders } = toCatalogue(
    boards({
      builders: [A(), item("builders", "Test Builder Gone", {}, { id: 9, state: "archived" })],
      models: [item("models", "Test Old", { builder: ["1"], priceA: 1, frontage: 10 }, { state: "deleted" })],
    }),
  );
  assert.deepEqual(builders.map((b) => b.name), ["Test Builder A"]);
  assert.deepEqual(builders[0].models, []);
});

test("numbers: commas, a dollar sign and spaces are dropped; blank or unreadable is null", () => {
  assert.equal(num({ type: "numbers", text: "$1,234.50", value: "$1,234.50" }), 1234.5);
  assert.equal(num({ type: "numbers", text: "0", value: "0" }), 0);
  assert.equal(num({ type: "numbers", text: "", value: null }), null);
  assert.equal(num({ type: "numbers", text: "n/a", value: "n/a" }), null);
  assert.equal(num(undefined), null);
});
```

- [ ] **Step 2: Run them to see them fail.**

Run: `node --import tsx --test src/server/homescope/to-catalogue.test.ts`
Expected: FAIL, `Cannot find module './to-catalogue'`.

- [ ] **Step 3: Write the transform.** Create `src/server/homescope/to-catalogue.ts`:

```ts
import type { HsBuilder, HsImage, HsModel, ImportWarning } from "@/data/homescope";
import { fileAssets, type ItemRow, type StoredValue } from "../mirror/monday/normalise";
import { BOARDS, resolveColumns, type BoardDump, type BoardKey, type ColumnIds, type EstimationBoards } from "./boards";

/**
 * The twelve "Estimation Source Data" boards, as HomeScope's catalogue: one
 * HsBuilder per builder on the Builders board, in board order. It reads them the way
 * HomeScope does, so it shows what HomeScope shows, and it says what it left out.
 * Pure: no database, no network. Throws CatalogueFormatError when a column is missing.
 */
export interface CatalogueResult {
  builders: HsBuilder[];
  warnings: ImportWarning[];
}

type Cell = StoredValue | undefined;

/** Warnings grouped by board and message, each item named once. */
class Warnings {
  private readonly byKey = new Map<string, ImportWarning>();
  add(board: string, message: string, itemName: string) {
    const key = `${board}\u0000${message}`;
    const w = this.byKey.get(key) ?? { board, message, items: [] };
    if (!w.items.includes(itemName)) w.items.push(itemName);
    this.byKey.set(key, w);
  }
  list(): ImportWarning[] {
    return [...this.byKey.values()];
  }
}

interface Ctx {
  boards: EstimationBoards;
  cols: ColumnIds;
  warnings: Warnings;
  /** Builders by name, in the Builders board's order. */
  byName: Map<string, HsBuilder>;
  /** Builder names by Monday item id, for the link columns. */
  nameById: Map<string, string>;
}

const cell = (it: ItemRow, columnId: string): Cell => it.column_values[columnId];
const active = (d: BoardDump) => d.items.filter((i) => i.state === "active");

/** A numbers cell. Blank or unreadable is null, never 0: a blank price means "not offered", not "free". */
export function num(c: Cell): number | null {
  const raw = typeof c?.value === "string" || typeof c?.value === "number" ? String(c.value) : (c?.text ?? "");
  const t = raw.replace(/[$,\s]/g, "");
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

const str = (c: Cell): string | null => c?.text?.trim() || null;
const checked = (c: Cell): boolean => {
  const v = (c?.value as { checked?: unknown } | null)?.checked;
  return v === true || v === "true" || c?.text === "v";
};
const linked = (c: Cell): string[] => c?.linked_item_ids ?? [];
const label = (c: Cell): string | null => c?.label?.trim() || str(c);
const image = (c: Cell): HsImage | null => {
  const f = fileAssets(c?.value)[0];
  return f ? { assetId: String(f.id), name: f.name } : null;
};

/** The builders an item links to. None: HomeScope doesn't show it, so neither does Launchpad, and Ops hear about it. */
function buildersOf(ctx: Ctx, key: BoardKey, it: ItemRow, columnId: string): HsBuilder[] {
  const found = linked(cell(it, columnId)).flatMap((id) => {
    const name = ctx.nameById.get(id);
    const b = name ? ctx.byName.get(name) : undefined;
    return b ? [b] : [];
  });
  if (!found.length) ctx.warnings.add(BOARDS[key], "isn't linked to a builder, so HomeScope doesn't show it", it.name.trim());
  return found;
}

function addBuilders(ctx: Ctx) {
  const c = ctx.cols.builders;
  for (const it of active(ctx.boards.builders)) {
    const name = it.name.trim();
    if (ctx.byName.has(name)) {
      ctx.warnings.add(BOARDS.builders, "appears twice; the first is used", name);
      continue;
    }
    ctx.nameById.set(String(it.id), name);
    ctx.byName.set(name, {
      name,
      address: str(cell(it, c.address)) ?? "",
      bundleAllowance: checked(cell(it, c.bundleAllowance)),
      allowanceOnPrelim: checked(cell(it, c.allowanceOnPrelim)),
      logo: image(cell(it, c.logo)),
      models: [],
      ranges: [],
      elevations: [],
      siteCosts: [],
      allowances: [],
      bal: [],
      coastal: [],
      noise: [],
      colours: [],
      variations: [],
      boltOns: {},
    });
  }
}

const RANGE_COLUMN = /^specs range ([a-z]) price$/i;

function addRanges(ctx: Ctx) {
  const lc = ctx.cols.levels;
  const rc = ctx.cols.ranges;
  const levels = new Map(
    active(ctx.boards.levels).map((it) => [String(it.id), { name: it.name.trim(), position: num(cell(it, lc.position)) ?? 0 }]),
  );
  for (const it of active(ctx.boards.ranges)) {
    const name = it.name.trim();
    const column = RANGE_COLUMN.exec(str(cell(it, rc.priceColumn)) ?? "")?.[1]?.toUpperCase();
    if (!column) {
      ctx.warnings.add(BOARDS.ranges, 'has no Model Price Column like "Specs Range A Price", so it can\'t be priced', name);
      continue;
    }
    const level = levels.get(linked(cell(it, rc.level))[0] ?? "");
    if (!level) {
      ctx.warnings.add(BOARDS.ranges, "isn't linked to a level, so HomeScope can't place it", name);
      continue;
    }
    for (const b of buildersOf(ctx, "ranges", it, rc.builder)) b.ranges.push({ name, level: level.name, position: level.position, column });
  }
}

const PRICE_FIELDS = [
  ["A", "priceA"],
  ["B", "priceB"],
  ["C", "priceC"],
  ["D", "priceD"],
] as const;

function addModels(ctx: Ctx) {
  const c = ctx.cols.models;
  for (const it of active(ctx.boards.models)) {
    const name = it.name.trim();
    const builders = buildersOf(ctx, "models", it, c.builder);
    if (!builders.length) continue;
    const prices: Record<string, number> = {};
    for (const [letter, field] of PRICE_FIELDS) {
      const p = num(cell(it, c[field]));
      if (p != null) prices[letter] = p;
    }
    const model: HsModel = {
      name,
      frontage: num(cell(it, c.frontage)),
      houseArea: num(cell(it, c.houseArea)),
      totalArea: num(cell(it, c.totalArea)),
      beds: num(cell(it, c.beds)),
      baths: num(cell(it, c.baths)),
      corner: checked(cell(it, c.corner)),
      prices,
      blockType: str(cell(it, c.blockType)),
      notes: str(cell(it, c.notes)),
    };
    if (!Object.keys(prices).length) ctx.warnings.add(BOARDS.models, "has no price in any spec range", name);
    if (model.frontage == null && !model.corner) {
      ctx.warnings.add(BOARDS.models, "has no To Suit Block and isn't a corner design, so no block search finds it", name);
    }
    for (const b of builders) {
      if (b.models.some((m) => m.name.toLowerCase() === name.toLowerCase())) {
        ctx.warnings.add(BOARDS.models, `appears twice at ${b.name}; HomeScope prices the first`, name);
      }
      b.models.push({ ...model, prices: { ...prices } });
    }
  }
}

export function toCatalogue(boards: EstimationBoards): CatalogueResult {
  const columns = Object.fromEntries(Object.entries(boards).map(([k, d]) => [k, d.columns])) as Record<BoardKey, BoardDump["columns"]>;
  const ctx: Ctx = { boards, cols: resolveColumns(columns), warnings: new Warnings(), byName: new Map(), nameById: new Map() };
  addBuilders(ctx);
  addRanges(ctx);
  addModels(ctx);
  return { builders: [...ctx.byName.values()], warnings: ctx.warnings.list() };
}
```

- [ ] **Step 4: Run the tests.**

Run: `node --import tsx --test src/server/homescope/to-catalogue.test.ts`
Expected: 8 pass.

- [ ] **Step 5: Run the whole suite and the type check.**

Run: `npm test` then `npm run lint`
Expected: everything passes.

- [ ] **Step 6: Leave it uncommitted.** `git status --short` shows only the two new files from this task, on top of Task 1's.

---

### Task 3: Transform part 2: elevations, colours, site works, allowances, rates, variations and bolt-ons

**Files:**
- Modify: `src/server/homescope/to-catalogue.ts`
- Test: `src/server/homescope/to-catalogue.test.ts` (add tests)

**Interfaces:**
- Consumes: everything in `to-catalogue.ts` from Task 2 (`Ctx`, `cell`, `active`, `num`, `str`, `label`, `image`, `buildersOf`).
- Produces: `toCatalogue` now fills every `HsBuilder` field. Same signature.

- [ ] **Step 1: Add the failing tests.** Append to `src/server/homescope/to-catalogue.test.ts`:

```ts
test("elevations use Style Name and Style Price; colours are free and keep their description and image", () => {
  const { builders } = toCatalogue(
    boards({
      builders: [A(), B()],
      elevations: [
        item("elevations", "Front Elevation", { builder: ["1"], style: "Test Gable", price: 1500, image: 5 }),
        item("elevations", "Front Elevation", { builder: ["1"], style: null, price: null }),
      ],
      colours: [item("colours", "Test Scheme", { builder: ["1", "2"], description: "Test", image: 6 })],
    }),
  );
  assert.deepEqual(builders[0].elevations, [
    { name: "Test Gable", price: 1500, image: { assetId: "5", name: "image-5.jpg" } },
    { name: "Front Elevation", price: 0, image: null },
  ]);
  const scheme = { name: "Test Scheme", price: 0, description: "Test", image: { assetId: "6", name: "image-6.jpg" } };
  assert.deepEqual(builders[0].colours, [scheme]);
  assert.deepEqual(builders[1].colours, [scheme]);
});

test("site works keep their work type and cost type", () => {
  const { builders } = toCatalogue(
    boards({
      builders: [A()],
      siteCosts: [item("siteCosts", "Test Site Option", { builder: ["1"], workType: "Test Footing", costType: "Provisional Sum", price: 9000 })],
    }),
  );
  assert.deepEqual(builders[0].siteCosts, [{ name: "Test Site Option", workType: "Test Footing", costType: "Provisional Sum", price: 9000 }]);
});

test("title allowances: one rule copied to each linked builder, with Topup Amount as the rule's initial amount", () => {
  const { builders } = toCatalogue(
    boards({
      builders: [A(), B()],
      allowances: [
        item("allowances", "More than 6 months", { builders: ["1", "2"], holdMonths: 6, type: "Cumulative Percentage of Base Price", value: 1.5, monthlyStep: 0.5, topUp: 250 }),
      ],
    }),
  );
  const rule = { due: "More than 6 months", holdMonths: 6, type: "Cumulative Percentage of Base Price", value: 1.5, monthlyStep: 0.5, initial: 250 };
  assert.deepEqual(builders[0].allowances, [rule]);
  assert.deepEqual(builders[1].allowances, [rule]);
});

test("BAL, coastal and noise rates keep their floor-area band, or null when the builder doesn't band", () => {
  const { builders } = toCatalogue(
    boards({
      builders: [A()],
      bal: [item("bal", "Test BAL", { builder: ["1"], price: 4000, area: 200 })],
      coastal: [item("coastal", "Test Coastal", { builder: ["1"], price: 0 })],
      noise: [item("noise", "Test Noise", { builder: ["1"], price: 5000, area: null })],
    }),
  );
  assert.deepEqual(builders[0].bal, [{ name: "Test BAL", price: 4000, area: 200 }]);
  assert.deepEqual(builders[0].coastal, [{ name: "Test Coastal", price: 0, area: null }]);
  assert.deepEqual(builders[0].noise, [{ name: "Test Noise", price: 5000, area: null }]);
});

test("variations: the builder comes from the Builder status, with no link at all, as HomeScope reads it", () => {
  const { builders, warnings } = toCatalogue(
    boards({
      builders: [A()],
      variations: [
        item("variations", "Electrical", { builder: "Test Builder A", code: "T_EL_001", description: "Test point", unit: "EA", charge: 120, credit: null }),
        item("variations", "Electrical", { builder: "Test Builder Z", code: "T_EL_002" }),
        item("variations", "Electrical", { code: "T_EL_003" }),
      ],
    }),
  );
  assert.deepEqual(builders[0].variations, [
    { area: "Electrical", code: "T_EL_001", description: "Test point", unit: "EA", charge: 120, credit: 0 },
  ]);
  assert.deepEqual(
    warnings.filter((w) => w.board === "Variations").map((w) => w.message),
    ['names builder "Test Builder Z", which isn\'t on the Builders board', "has no Builder"],
  );
});

test("bolt-ons: 'Bolt On Pricing - <design>' lines go to that design, matched without regard to case; others are skipped and reported once", () => {
  const { builders, warnings } = toCatalogue(
    boards({
      builders: [A()],
      models: [item("models", "Test Model", { builder: ["1"], priceA: 1, frontage: 10 })],
      variations: [
        item("variations", "Bolt On Pricing - test model", { builder: "Test Builder A", description: "Test cooling", charge: 9000 }),
        item("variations", "Bolt On Pricing - Test Model", { builder: "Test Builder A", description: "Test flooring", charge: 4000, credit: 100 }),
        item("variations", "Bolt On Pricing - Test Retired", { builder: "Test Builder A", description: "Test", charge: 1 }),
        item("variations", "Bolt On Pricing - Test Retired", { builder: "Test Builder A", description: "Test", charge: 2 }),
      ],
    }),
  );
  assert.deepEqual(builders[0].boltOns, {
    "Test Model": [
      { description: "Test cooling", charge: 9000, credit: 0 },
      { description: "Test flooring", charge: 4000, credit: 100 },
    ],
  });
  assert.deepEqual(builders[0].variations, []);
  assert.deepEqual(warnings.filter((w) => w.board === "Variations"), [
    {
      board: "Variations",
      message: "is bolt-on pricing for a design Test Builder A doesn't have, so HomeScope skips it",
      items: ["Bolt On Pricing - Test Retired"],
    },
  ]);
});

test("a builder with designs but no spec ranges, or with no delayed-title rule, is reported", () => {
  const { warnings } = toCatalogue(
    boards({ builders: [A()], models: [item("models", "Test Model", { builder: ["1"], priceA: 1, frontage: 10 })] }),
  );
  const said = Object.fromEntries(warnings.map((w) => [w.message, w.items]));
  assert.deepEqual(said["has designs but no spec ranges, so none of them can be priced"], ["Test Builder A"]);
  assert.deepEqual(said["has no delayed-title rule, so HomeScope adds no title allowance"], ["Test Builder A"]);
});
```

- [ ] **Step 2: Run them to see them fail.**

Run: `node --import tsx --test src/server/homescope/to-catalogue.test.ts`
Expected: the 7 new tests FAIL (empty sections, missing warnings). The 8 from Task 2 still pass.

- [ ] **Step 3: Add the sections.** In `src/server/homescope/to-catalogue.ts`, change the first import line to bring in the extra types:

```ts
import type { HsAllowanceRule, HsBuilder, HsImage, HsModel, HsRate, ImportWarning } from "@/data/homescope";
```

Add these functions above `export function toCatalogue`:

```ts
function addPricedLists(ctx: Ctx) {
  const e = ctx.cols.elevations;
  for (const it of active(ctx.boards.elevations)) {
    // The item name is always "Front Elevation" on this board: the style's own name is a column.
    const name = str(cell(it, e.style)) ?? it.name.trim();
    const elevation = { name, price: num(cell(it, e.price)) ?? 0, image: image(cell(it, e.image)) };
    for (const b of buildersOf(ctx, "elevations", it, e.builder)) b.elevations.push({ ...elevation });
  }
  const k = ctx.cols.colours;
  for (const it of active(ctx.boards.colours)) {
    // Colour schemes carry no price on Monday: HomeScope prices them at 0.
    const colour = { name: it.name.trim(), price: 0, description: str(cell(it, k.description)), image: image(cell(it, k.image)) };
    for (const b of buildersOf(ctx, "colours", it, k.builder)) b.colours.push({ ...colour });
  }
  const s = ctx.cols.siteCosts;
  for (const it of active(ctx.boards.siteCosts)) {
    const site = {
      name: it.name.trim(),
      workType: str(cell(it, s.workType)) ?? "",
      costType: str(cell(it, s.costType)),
      price: num(cell(it, s.price)) ?? 0,
    };
    for (const b of buildersOf(ctx, "siteCosts", it, s.builder)) b.siteCosts.push({ ...site });
  }
}

function addAllowances(ctx: Ctx) {
  const a = ctx.cols.allowances;
  for (const it of active(ctx.boards.allowances)) {
    const rule: HsAllowanceRule = {
      due: it.name.trim(),
      holdMonths: num(cell(it, a.holdMonths)) ?? 0,
      type: label(cell(it, a.type)) ?? "",
      value: num(cell(it, a.value)) ?? 0,
      monthlyStep: num(cell(it, a.monthlyStep)) ?? 0,
      initial: num(cell(it, a.topUp)) ?? 0,
    };
    for (const b of buildersOf(ctx, "allowances", it, a.builders)) b.allowances.push({ ...rule });
  }
}

function addRates(ctx: Ctx) {
  for (const key of ["bal", "coastal", "noise"] as const) {
    const r = ctx.cols[key];
    for (const it of active(ctx.boards[key])) {
      const rate: HsRate = { name: it.name.trim(), price: num(cell(it, r.price)) ?? 0, area: num(cell(it, r.area)) };
      for (const b of buildersOf(ctx, key, it, r.builder)) b[key].push({ ...rate });
    }
  }
}

const BOLT_ON = /^bolt on pricing\s*-\s*(.+)$/i;

/** Runs after addModels: a bolt-on line attaches to one of the builder's designs. */
function addVariations(ctx: Ctx) {
  const v = ctx.cols.variations;
  for (const it of active(ctx.boards.variations)) {
    const name = it.name.trim();
    // HomeScope reads a variation's builder from this status, not from "Builder Linked".
    const builderName = label(cell(it, v.builder));
    const b = builderName ? ctx.byName.get(builderName) : undefined;
    if (!b) {
      ctx.warnings.add(
        BOARDS.variations,
        builderName ? `names builder "${builderName}", which isn't on the Builders board` : "has no Builder",
        name,
      );
      continue;
    }
    const charge = num(cell(it, v.charge)) ?? 0;
    const credit = num(cell(it, v.credit)) ?? 0;
    const description = str(cell(it, v.description)) ?? "";
    const bolt = BOLT_ON.exec(name);
    if (bolt) {
      const design = bolt[1].trim().toLowerCase();
      const model = b.models.find((m) => m.name.toLowerCase() === design);
      if (!model) {
        ctx.warnings.add(BOARDS.variations, `is bolt-on pricing for a design ${b.name} doesn't have, so HomeScope skips it`, name);
        continue;
      }
      (b.boltOns[model.name] ??= []).push({ description, charge, credit });
      continue;
    }
    b.variations.push({ area: name, code: str(cell(it, v.code)) ?? "", description, unit: str(cell(it, v.unit)) ?? "", charge, credit });
  }
}

/** Gaps a quote would hit, per builder. */
function checkBuilders(ctx: Ctx) {
  for (const b of ctx.byName.values()) {
    if (b.models.length && !b.ranges.length) {
      ctx.warnings.add(BOARDS.ranges, "has designs but no spec ranges, so none of them can be priced", b.name);
    }
    if (!b.allowances.length) {
      ctx.warnings.add(BOARDS.allowances, "has no delayed-title rule, so HomeScope adds no title allowance", b.name);
    }
  }
}
```

Then make `toCatalogue` call them in this order:

```ts
export function toCatalogue(boards: EstimationBoards): CatalogueResult {
  const columns = Object.fromEntries(Object.entries(boards).map(([k, d]) => [k, d.columns])) as Record<BoardKey, BoardDump["columns"]>;
  const ctx: Ctx = { boards, cols: resolveColumns(columns), warnings: new Warnings(), byName: new Map(), nameById: new Map() };
  addBuilders(ctx);
  addRanges(ctx);
  addModels(ctx);
  addPricedLists(ctx);
  addAllowances(ctx);
  addRates(ctx);
  addVariations(ctx);
  checkBuilders(ctx);
  return { builders: [...ctx.byName.values()], warnings: ctx.warnings.list() };
}
```

- [ ] **Step 4: Fix the Task 2 tests that now see the new builder checks.** Two Task 2 tests compare the whole warnings list, and `checkBuilders` now adds a "has no delayed-title rule" line (on the Title Allowances board) to it. In "spec ranges: one with an unreadable price column or no level is skipped and reported", compare only the Specification Ranges board:

```ts
  assert.deepEqual(
    warnings.filter((w) => w.board === "Specification Ranges").map((w) => [w.board, w.items]),
    [
      ["Specification Ranges", ["Test Range Odd"]],
      ["Specification Ranges", ["Test Range Loose"]],
    ],
  );
```

In "models: an unlinked model is left out...", compare only the Models board:

```ts
  assert.deepEqual(warnings.filter((w) => w.board === "Models"), [
    { board: "Models", message: "isn't linked to a builder, so HomeScope doesn't show it", items: ["Test Loose"] },
  ]);
```

- [ ] **Step 5: Run the tests.**

Run: `node --import tsx --test src/server/homescope/to-catalogue.test.ts`
Expected: 15 pass.

- [ ] **Step 6: Run the whole suite and the type check.**

Run: `npm test` then `npm run lint`
Expected: everything passes.

- [ ] **Step 7: Leave it uncommitted.** `git status --short`: no new paths beyond Tasks 1 and 2.

---

### Task 4: Read the twelve boards from Monday

**Files:**
- Create: `src/server/homescope/read.ts`
- Test: `src/server/homescope/read.test.ts`

**Interfaces:**
- Consumes: `MondayClient` (`src/server/mirror/monday/client.ts`); `Q.workspaces`, `Q.boardsById`, `Q.firstItemsPage`, `Q.nextItemsPage` (`src/server/mirror/monday/queries.ts`); `normaliseItem`, `RawItem`, `ItemRow`; `fakeMonday` (`src/server/mirror/monday/test-fakes.ts`); `BOARDS`, `HOMESCOPE_WORKSPACE`, `SOURCE_FOLDER`, `BoardKey`, `ColumnInfo`, `EstimationBoards` (Task 1).
- Produces: `readEstimationBoards(monday: MondayClient): Promise<EstimationBoards>`, `CatalogueSourceError`, `PAGE_SIZE`.

- [ ] **Step 1: Write the failing tests.** Create `src/server/homescope/read.test.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { fakeMonday } from "../mirror/monday/test-fakes";
import { BOARDS, type BoardKey } from "./boards";
import { CatalogueSourceError, PAGE_SIZE, readEstimationBoards } from "./read";

const KEYS = Object.keys(BOARDS) as BoardKey[];
/** Made-up ids: board n is "10n". */
const boardId = (key: BoardKey) => String(100 + KEYS.indexOf(key));
const raw = (id: number, name: string) => ({ id: String(id), name, state: "active", updated_at: "2026-10-09T00:00:00Z", column_values: [] });

/** A Monday with the HomeScope workspace and folder. `variations` gets two pages; every other board one item. */
function monday(over: { folderName?: string; drop?: string; workspace?: string } = {}) {
  const children = KEYS.filter((k) => BOARDS[k] !== over.drop).map((k) => ({ id: boardId(k), name: BOARDS[k] }));
  return fakeMonday((doc, vars) => {
    if (doc.includes("workspaces(")) return { workspaces: [{ id: "1", name: "Other" }, { id: "2", name: over.workspace ?? "HomeScope" }] };
    if (doc.includes("folders(")) {
      assert.deepEqual(vars.ws, ["2"]);
      return { folders: [{ id: "f1", name: "Estimation Leads and Agreements", children: [] }, { id: "f2", name: over.folderName ?? "Estimation Source Data", children }] };
    }
    if (doc.includes("next_items_page")) {
      assert.equal(vars.cursor, "page-2");
      assert.equal(vars.limit, PAGE_SIZE);
      return { next_items_page: { cursor: null, items: [raw(902, "Test Variation Two")] } };
    }
    if (doc.includes("items_page")) {
      const id = (vars.board as string[])[0];
      const key = KEYS.find((k) => boardId(k) === id)!;
      return { boards: [{ items_page: { cursor: key === "variations" ? "page-2" : null, items: [raw(Number(id) * 10, `Test ${BOARDS[key]}`)] } }] };
    }
    if (doc.includes("boards(ids: $ids")) {
      return { boards: (vars.ids as string[]).map((id) => ({ id, name: "x", columns: [{ id: "name", title: "Name", type: "name" }] })) };
    }
    throw new Error(`unexpected document: ${doc.slice(0, 60)}`);
  });
}

test("read: finds the twelve boards by title in the HomeScope folder and follows each board's pages", async () => {
  const m = monday();
  const boards = await readEstimationBoards(m);
  assert.deepEqual(Object.keys(boards).sort(), [...KEYS].sort());
  assert.deepEqual(boards.builders.items.map((i) => i.name), ["Test Builders"]);
  assert.deepEqual(boards.variations.items.map((i) => i.name), ["Test Variations", "Test Variation Two"]);
  assert.deepEqual(boards.models.columns, [{ id: "name", title: "Name", type: "name" }]);
  // workspaces + folders + boards, then one page per board and one more for variations.
  assert.equal(m.stats.calls, 3 + KEYS.length + 1);
});

test("read: the workspace, the folder or a board not where it should be stops the read with what's missing", async () => {
  await assert.rejects(readEstimationBoards(monday({ workspace: "Renamed" })), (e) => e instanceof CatalogueSourceError && /No Monday workspace named "HomeScope"/.test(e.message));
  await assert.rejects(readEstimationBoards(monday({ folderName: "Old Data" })), (e) => e instanceof CatalogueSourceError && /no folder named "Estimation Source Data"/.test(e.message));
  await assert.rejects(readEstimationBoards(monday({ drop: "Levels" })), (e) => e instanceof CatalogueSourceError && /is missing Levels/.test(e.message));
});
```

- [ ] **Step 2: Run them to see them fail.**

Run: `node --import tsx --test src/server/homescope/read.test.ts`
Expected: FAIL, `Cannot find module './read'`.

- [ ] **Step 3: Write the reader.** Create `src/server/homescope/read.ts`:

```ts
import type { MondayClient } from "../mirror/monday/client";
import { normaliseItem, type ItemRow, type RawItem } from "../mirror/monday/normalise";
import { Q } from "../mirror/monday/queries";
import { BOARDS, HOMESCOPE_WORKSPACE, SOURCE_FOLDER, type BoardKey, type ColumnInfo, type EstimationBoards } from "./boards";

/** Monday doesn't have the workspace, the folder or a board where the import expects it. Nothing is imported. */
export class CatalogueSourceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CatalogueSourceError";
  }
}

const FOLDERS = "query ($ws: [ID]) { folders(workspace_ids: $ws, limit: 100) { id name children { id name } } }";

/** Items per call. 250 keeps the widest board (Models, 76 columns) far under Monday's complexity limit. */
export const PAGE_SIZE = 250;

const same = (a: string, b: string) => a.trim().toLowerCase() === b.toLowerCase();

/**
 * Every item on the catalogue's twelve boards. Three calls find them (workspaces,
 * the workspace's folders, the boards' columns), then one per 250 items: about 29 in
 * all at October 2026's size. Read only, through the mirror's client.
 */
export async function readEstimationBoards(monday: MondayClient): Promise<EstimationBoards> {
  const { workspaces } = await monday.query<{ workspaces: { id: string; name: string }[] }>(Q.workspaces);
  const ws = workspaces.find((w) => same(w.name, HOMESCOPE_WORKSPACE));
  if (!ws) throw new CatalogueSourceError(`No Monday workspace named "${HOMESCOPE_WORKSPACE}" is visible to this token`);

  type Folder = { id: string; name: string; children: ({ id: string; name: string } | null)[] | null };
  const { folders } = await monday.query<{ folders: Folder[] }>(FOLDERS, { ws: [ws.id] });
  const folder = folders.find((f) => same(f.name, SOURCE_FOLDER));
  if (!folder) throw new CatalogueSourceError(`The ${HOMESCOPE_WORKSPACE} workspace has no folder named "${SOURCE_FOLDER}"`);

  const ids = {} as Record<BoardKey, string>;
  const missing: string[] = [];
  for (const [key, title] of Object.entries(BOARDS) as [BoardKey, string][]) {
    const child = (folder.children ?? []).find((c) => c != null && same(c.name, title));
    if (child) ids[key] = child.id;
    else missing.push(title);
  }
  if (missing.length) throw new CatalogueSourceError(`"${SOURCE_FOLDER}" is missing ${missing.join(", ")}`);

  const { boards } = await monday.query<{ boards: { id: string; columns: ColumnInfo[] | null }[] }>(Q.boardsById, {
    ids: Object.values(ids),
  });
  const out = {} as EstimationBoards;
  for (const [key, id] of Object.entries(ids) as [BoardKey, string][]) {
    const columns = (boards.find((b) => b.id === id)?.columns ?? []).map((c) => ({ id: c.id, title: c.title, type: c.type }));
    out[key] = { columns, items: await readItems(monday, id) };
  }
  return out;
}

type Page = { cursor: string | null; items: RawItem[] };

async function readItems(monday: MondayClient, boardId: string): Promise<ItemRow[]> {
  const first = await monday.query<{ boards: { items_page: Page }[] }>(Q.firstItemsPage, { board: [boardId], limit: PAGE_SIZE });
  let page: Page | undefined = first.boards[0]?.items_page;
  const items: ItemRow[] = [];
  while (page) {
    for (const raw of page.items) {
      const n = normaliseItem(raw, Number(boardId));
      if (n) items.push(n.item);
    }
    if (!page.cursor) break;
    const next: { next_items_page: Page } = await monday.query(Q.nextItemsPage, { cursor: page.cursor, limit: PAGE_SIZE });
    page = next.next_items_page;
  }
  return items;
}
```

- [ ] **Step 4: Run the tests.**

Run: `node --import tsx --test src/server/homescope/read.test.ts`
Expected: 2 pass.

- [ ] **Step 5: Run the whole suite and the type check.**

Run: `npm test` then `npm run lint`
Expected: everything passes.

- [ ] **Step 6: Leave it uncommitted.** `git status --short`: `read.ts` and `read.test.ts` are the only additions from this task.

---

### Task 5: Save versions and runs

**Files:**
- Create: `supabase/migrations/20261010000100_homescope_imports.sql`
- Create: `src/server/homescope/store.ts`
- Test: `src/server/homescope/store.test.ts`

**Interfaces:**
- Consumes: `Db` (`src/server/db/types.ts`); `migratedTestDb` (`src/server/db/pglite.ts`); `testBuilder` (Task 1); the types in `@/data/homescope`.
- Produces: `saveImport(db, { builders, warnings, calls, trigger }): Promise<SavedImport>`, `SavedImport = { importId: string; changed: string[]; retired: string[] }`, `recordFailedImport(db, { error, calls, trigger }): Promise<void>`, `loadCatalogue(db): Promise<Catalogue | null>`, `loadLastImport(db): Promise<ImportRecord | null>`.

- [ ] **Step 1: Write the failing tests.** Create `src/server/homescope/store.test.ts`:

```ts
import { after, before, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { migratedTestDb } from "../db/pglite";
import type { Db } from "../db/types";
import { loadCatalogue, loadLastImport, recordFailedImport, saveImport } from "./store";
import { testBuilder } from "./test-boards";

let db: Db;
let close: () => Promise<void>;
before(async () => ({ db, close } = await migratedTestDb()));
after(async () => close());
beforeEach(async () => {
  await db.query("delete from launchpad.homescope_catalogues");
  await db.query("delete from launchpad.homescope_imports");
});

const save = (builders = [testBuilder("Test Builder A"), testBuilder("Test Builder B")]) =>
  saveImport(db, { builders, warnings: [{ board: "Models", message: "has no price in any spec range", items: ["Test Model"] }], calls: 29, trigger: "cli" });
const current = () =>
  db.query<{ builder: string; source: string; has_import: boolean }>(
    "select builder, source, import_id is not null as has_import from launchpad.homescope_catalogues where is_current order by builder",
  );

test("save: the first import writes one current version per builder, from Monday, tied to its run", async () => {
  const r = await save();
  assert.deepEqual(r.changed, ["Test Builder A", "Test Builder B"]);
  assert.deepEqual(r.retired, []);
  assert.deepEqual(await current(), [
    { builder: "Test Builder A", source: "monday", has_import: true },
    { builder: "Test Builder B", source: "monday", has_import: true },
  ]);
});

test("save: importing the same catalogue again writes no new version and records 0 changed", async () => {
  await save();
  const again = await save();
  assert.deepEqual(again.changed, []);
  const [{ n }] = await db.query<{ n: number }>("select count(*)::int as n from launchpad.homescope_catalogues");
  assert.equal(n, 2);
  assert.equal((await loadLastImport(db))?.changed, 0);
});

test("save: a changed builder gets a new current version and keeps the old one as history", async () => {
  await save();
  const r = await save([testBuilder("Test Builder A", 310_000), testBuilder("Test Builder B")]);
  assert.deepEqual(r.changed, ["Test Builder A"]);
  const versions = await db.query<{ is_current: boolean; price: number }>(
    "select is_current, (data->'models'->0->'prices'->>'A')::int as price from launchpad.homescope_catalogues where builder = 'Test Builder A' order by captured_at, is_current",
  );
  assert.deepEqual(versions, [
    { is_current: false, price: 300_000 },
    { is_current: true, price: 310_000 },
  ]);
});

test("save: a builder gone from Monday is retired, so HomeScope stops offering it", async () => {
  await save();
  const r = await save([testBuilder("Test Builder A")]);
  assert.deepEqual(r.retired, ["Test Builder B"]);
  assert.deepEqual((await current()).map((c) => c.builder), ["Test Builder A"]);
  assert.equal((await loadLastImport(db))?.changed, 1);
});

test("a failed import is recorded with its error and leaves the current catalogue alone", async () => {
  await save();
  await recordFailedImport(db, { error: "Monday's daily limit is spent", calls: 12, trigger: "screen" });
  assert.equal((await current()).length, 2);
  const last = await loadLastImport(db);
  assert.equal(last?.status, "failed");
  assert.equal(last?.error, "Monday's daily limit is spent");
  assert.equal(last?.calls, 12);
  assert.equal(last?.trigger, "screen");
});

test("load: null before any import; then every current builder by name, as of the last good import", async () => {
  assert.equal(await loadCatalogue(db), null);
  assert.equal(await loadLastImport(db), null);
  await save([testBuilder("Test Builder B"), testBuilder("Test Builder A")]);
  const c = await loadCatalogue(db);
  assert.equal(c?.source, "monday");
  assert.deepEqual(c?.builders.map((b) => b.name), ["Test Builder A", "Test Builder B"]);
  const last = await loadLastImport(db);
  assert.equal(c?.asOf, last?.finishedAt);
  assert.deepEqual(last?.warnings, [{ board: "Models", message: "has no price in any spec range", items: ["Test Model"] }]);
  assert.equal(last?.builders, 2);
});
```

- [ ] **Step 2: Run them to see them fail.**

Run: `node --import tsx --test src/server/homescope/store.test.ts`
Expected: FAIL, `Cannot find module './store'`.

- [ ] **Step 3: Write the migration.** First run `ls supabase/migrations` and check that `20261010000100` is newer than every file there and not taken. If another session has used it, take the next free version and name the file to match. Copy nothing else in that folder. Create `supabase/migrations/20261010000100_homescope_imports.sql`:

```sql
-- HomeScope's catalogue, imported from the "Estimation Source Data" boards in Monday's
-- HomeScope workspace (Meeting4, decision 5). One row per run: when it finished, how
-- many Monday calls it made, how many builders changed, and what Ops should fix on the
-- boards. A failed run has its error and saved nothing.
create table launchpad.homescope_imports (
  id uuid primary key default gen_random_uuid(),
  finished_at timestamptz not null default now(),
  trigger text not null check (trigger in ('cli', 'screen')),
  status text not null check (status in ('ok', 'failed')),
  calls integer not null default 0 check (calls >= 0),
  builders integer not null default 0 check (builders >= 0),
  changed integer not null default 0 check (changed >= 0),
  warnings jsonb not null default '[]'::jsonb check (jsonb_typeof(warnings) = 'array'),
  error text,
  constraint homescope_imports_error_when_failed check ((status = 'failed') = (error is not null))
);
create index homescope_imports_latest on launchpad.homescope_imports (finished_at desc);

-- Which run wrote each catalogue version. Snapshot rows have none.
alter table launchpad.homescope_catalogues
  add column import_id uuid references launchpad.homescope_imports (id);

select launchpad.secure_schemas();
```

- [ ] **Step 4: Write the store.** Create `src/server/homescope/store.ts`:

```ts
import type { Catalogue, HsBuilder, ImportRecord, ImportTrigger, ImportWarning } from "@/data/homescope";
import type { Db } from "../db/types";

export interface SavedImport {
  importId: string;
  /** Builders that got a new current version. */
  changed: string[];
  /** Builders no longer on Monday, no longer current. */
  retired: string[];
}

/**
 * Saves one import in a single transaction: the run, a new current version for each
 * builder whose catalogue changed, and the retirement of any builder gone from Monday.
 * An unchanged builder keeps its row, so running the import again adds nothing.
 */
export async function saveImport(
  db: Db,
  input: { builders: HsBuilder[]; warnings: ImportWarning[]; calls: number; trigger: ImportTrigger },
): Promise<SavedImport> {
  return db.transaction(async (tx) => {
    const [run] = await tx.query<{ id: string }>(
      "insert into launchpad.homescope_imports (trigger, status, calls, builders, warnings) values ($1, 'ok', $2, $3, $4::jsonb) returning id",
      [input.trigger, input.calls, input.builders.length, JSON.stringify(input.warnings)],
    );
    const changed: string[] = [];
    for (const b of input.builders) {
      const data = JSON.stringify(b);
      const [now] = await tx.query<{ same: boolean }>(
        "select data = $2::jsonb as same from launchpad.homescope_catalogues where builder = $1 and is_current",
        [b.name, data],
      );
      if (now?.same) continue;
      await tx.query("update launchpad.homescope_catalogues set is_current = false where builder = $1 and is_current", [b.name]);
      await tx.query(
        "insert into launchpad.homescope_catalogues (builder, captured_at, source, data, is_current, import_id) values ($1, now(), 'monday', $2::jsonb, true, $3)",
        [b.name, data, run.id],
      );
      changed.push(b.name);
    }
    const retired = await tx.query<{ builder: string }>(
      `update launchpad.homescope_catalogues set is_current = false
       where is_current and builder not in (select jsonb_array_elements_text($1::jsonb))
       returning builder`,
      [JSON.stringify(input.builders.map((b) => b.name))],
    );
    await tx.query("update launchpad.homescope_imports set changed = $2 where id = $1", [run.id, changed.length + retired.length]);
    return { importId: run.id, changed, retired: retired.map((r) => r.builder).sort() };
  });
}

/** A run that saved nothing, with why. */
export async function recordFailedImport(db: Db, input: { error: string; calls: number; trigger: ImportTrigger }): Promise<void> {
  await db.query("insert into launchpad.homescope_imports (trigger, status, calls, error) values ($1, 'failed', $2, $3)", [
    input.trigger,
    input.calls,
    input.error,
  ]);
}

/** Every builder's current catalogue, by name, as of the last good import. Null when there's none. */
export async function loadCatalogue(db: Db): Promise<Catalogue | null> {
  const rows = await db.query<{ data: HsBuilder; source: string; ms: number }>(
    "select data, source, (extract(epoch from captured_at) * 1000)::float8 as ms from launchpad.homescope_catalogues where is_current",
  );
  if (!rows.length) return null;
  const [run] = await db.query<{ ms: number | null }>(
    "select (extract(epoch from max(finished_at)) * 1000)::float8 as ms from launchpad.homescope_imports where status = 'ok'",
  );
  const ms = run?.ms ?? Math.max(...rows.map((r) => r.ms));
  return {
    builders: rows.map((r) => r.data).sort((a, b) => a.name.localeCompare(b.name)),
    source: rows.every((r) => r.source === "monday") ? "monday" : "snapshot",
    asOf: new Date(ms).toISOString(),
  };
}

interface ImportRow {
  id: string;
  ms: number;
  trigger: ImportRecord["trigger"];
  status: ImportRecord["status"];
  calls: number;
  builders: number;
  changed: number;
  warnings: ImportWarning[];
  error: string | null;
}

/** The latest run, good or failed. */
export async function loadLastImport(db: Db): Promise<ImportRecord | null> {
  const [r] = await db.query<ImportRow>(
    `select id, (extract(epoch from finished_at) * 1000)::float8 as ms, trigger, status, calls, builders, changed, warnings, error
     from launchpad.homescope_imports order by finished_at desc limit 1`,
  );
  if (!r) return null;
  const { ms, ...rest } = r;
  return { ...rest, finishedAt: new Date(ms).toISOString() };
}
```

- [ ] **Step 5: Run the tests.**

Run: `node --import tsx --test src/server/homescope/store.test.ts`
Expected: 6 pass. (The two saves in "a changed builder..." are separate transactions, so their `now()` differs and `order by captured_at` puts the old version first.)

- [ ] **Step 6: Run the whole suite and the type check.**

Run: `npm test` then `npm run lint`
Expected: everything passes. That includes `src/server/db/schema.test.ts`, which checks that the new table is closed to anon, authenticated and service_role.

- [ ] **Step 7: Leave it uncommitted.** `git status --short`: the migration, `store.ts` and `store.test.ts` are the only additions.

---

### Task 6: One import run, the snapshot comparison and the CLI

**Files:**
- Create: `src/server/homescope/run.ts`
- Create: `src/server/homescope/compare.ts`
- Create: `scripts/homescope-import.ts`
- Modify: `package.json` (`scripts`)
- Test: `src/server/homescope/run.test.ts`, `src/server/homescope/compare.test.ts`

**Interfaces:**
- Consumes: `readEstimationBoards` (Task 4), `toCatalogue` (Tasks 2 and 3), `saveImport` / `recordFailedImport` / `loadLastImport` (Task 5), `mondayClientFor` (`src/server/mirror/run-source.ts`), `getDb` / `closeDb` (`src/server/db/postgres.ts`), `readServerEnv` (`src/server/env.ts`), `fakeMonday`, `MondayDailyLimitError`.
- Produces: `importCatalogue(opts: { db: Db | null; monday: MondayClient; trigger: ImportTrigger; dryRun?: boolean; read?: (m: MondayClient) => Promise<EstimationBoards> }): Promise<{ summary: ImportSummary; builders: HsBuilder[] }>`, `failedSummary(error: string): ImportSummary`, `countsOf(b: HsBuilder): BuilderCounts`, `compareWithSnapshot(imported: HsBuilder[], snapshot: HsBuilder[]): string[]`.

- [ ] **Step 1: Write the failing tests.** Create `src/server/homescope/run.test.ts`:

```ts
import { after, before, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { migratedTestDb } from "../db/pglite";
import type { Db } from "../db/types";
import { MondayDailyLimitError, type MondayClient } from "../mirror/monday/client";
import { fakeMonday } from "../mirror/monday/test-fakes";
import type { EstimationBoards } from "./boards";
import { importCatalogue } from "./run";
import { loadCatalogue, loadLastImport, saveImport } from "./store";
import { boards, columnsFor, item, testBuilder } from "./test-boards";

let db: Db;
let close: () => Promise<void>;
before(async () => ({ db, close } = await migratedTestDb()));
after(async () => close());
beforeEach(async () => {
  await db.query("delete from launchpad.homescope_catalogues");
  await db.query("delete from launchpad.homescope_imports");
});

/** A Monday that answers anything with {}; the stub reader below makes `calls` of its own first. */
const monday = () => fakeMonday(() => ({}));
const reader = (calls: number, result: () => EstimationBoards) => async (m: MondayClient) => {
  for (let i = 0; i < calls; i++) await m.query("query { me { id } }");
  return result();
};
const goodBoards = () =>
  boards({
    builders: [item("builders", "Test Builder A", {}, { id: 1 })],
    levels: [item("levels", "Base", { position: 1 }, { id: 31 })],
    ranges: [item("ranges", "Test Range", { builder: ["1"], priceColumn: "Specs Range A Price", level: ["31"] })],
    models: [item("models", "Test Model", { builder: ["1"], priceA: 300000, frontage: 10 })],
  });

test("import: saves the catalogue, counts each builder, and records the run with its calls", async () => {
  const m = monday();
  const { summary } = await importCatalogue({ db, monday: m, trigger: "cli", read: reader(5, goodBoards) });
  assert.equal(summary.status, "ok");
  assert.equal(summary.calls, 5);
  assert.deepEqual(summary.changed, ["Test Builder A"]);
  assert.deepEqual(summary.builders, [
    { name: "Test Builder A", models: 1, ranges: 1, elevations: 0, colours: 0, siteCosts: 0, variations: 0, boltOnModels: 0 },
  ]);
  assert.equal((await loadCatalogue(db))?.builders[0].models[0].prices.A, 300000);
  assert.equal((await loadLastImport(db))?.calls, 5);
});

test("import: a dry run reads and checks, and writes nothing at all", async () => {
  const { summary, builders } = await importCatalogue({ db, monday: monday(), trigger: "cli", dryRun: true, read: reader(2, goodBoards) });
  assert.equal(summary.status, "ok");
  assert.equal(summary.dryRun, true);
  assert.equal(builders.length, 1);
  assert.equal(await loadCatalogue(db), null);
  assert.equal(await loadLastImport(db), null);
});

test("import: Monday stopping part-way saves nothing, records the failure, and keeps the current catalogue", async () => {
  await saveImport(db, { builders: [testBuilder("Test Builder A")], warnings: [], calls: 1, trigger: "cli" });
  const failing = async (m: MondayClient): Promise<EstimationBoards> => {
    await m.query("query { me { id } }");
    throw new MondayDailyLimitError("Monday's daily limit is spent", "DAILY_LIMIT_EXCEEDED");
  };
  const { summary } = await importCatalogue({ db, monday: monday(), trigger: "screen", read: failing });
  assert.equal(summary.status, "failed");
  assert.match(summary.error ?? "", /daily limit/);
  assert.equal((await loadCatalogue(db))?.builders[0].models[0].prices.A, 300_000);
  const last = await loadLastImport(db);
  assert.equal(last?.status, "failed");
  assert.equal(last?.calls, 1);
});

test("import: a renamed column fails with the column's name, and the current catalogue stays", async () => {
  await saveImport(db, { builders: [testBuilder("Test Builder A")], warnings: [], calls: 1, trigger: "cli" });
  const renamed = () => {
    const b = goodBoards();
    b.models.columns = columnsFor("models").map((c) => (c.id === "models.priceB" ? { ...c, title: "Range B" } : c));
    return b;
  };
  const { summary } = await importCatalogue({ db, monday: monday(), trigger: "cli", read: reader(1, renamed) });
  assert.equal(summary.status, "failed");
  assert.match(summary.error ?? "", /Models has no numbers column titled "Specs Range B Price"/);
  assert.equal((await loadCatalogue(db))?.builders.length, 1);
});

test("import: an empty Builders board fails instead of retiring every builder", async () => {
  await saveImport(db, { builders: [testBuilder("Test Builder A")], warnings: [], calls: 1, trigger: "cli" });
  const { summary } = await importCatalogue({ db, monday: monday(), trigger: "cli", read: reader(1, () => boards()) });
  assert.equal(summary.status, "failed");
  assert.match(summary.error ?? "", /no builders/);
  assert.equal((await loadCatalogue(db))?.builders.length, 1);
});
```

Create `src/server/homescope/compare.test.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { compareWithSnapshot } from "./compare";
import { testBuilder } from "./test-boards";

test("compare: matching builders say so; differences are listed per section; new and missing builders are named", () => {
  const snapA = testBuilder("Test Builder A");
  const snapB = testBuilder("Test Builder B");
  const nowA = testBuilder("Test Builder A");
  const nowB = { ...testBuilder("Test Builder B", 310_000), variations: [{ area: "Test", code: "T1", description: "Test", unit: "EA", charge: 1, credit: 0 }] };
  const nowC = testBuilder("Test Builder C");
  assert.deepEqual(compareWithSnapshot([nowA, nowB, nowC], [snapA, snapB, testBuilder("Test Builder D")]), [
    "Test Builder A: matches the snapshot",
    "Test Builder B: variations 0 -> 1, 1 design price(s) changed",
    "Test Builder D: in the snapshot, not on Monday",
    "Test Builder C: new, 1 designs",
  ]);
});
```

- [ ] **Step 2: Run them to see them fail.**

Run: `node --import tsx --test src/server/homescope/run.test.ts src/server/homescope/compare.test.ts`
Expected: FAIL, `Cannot find module './run'` and `'./compare'`.

- [ ] **Step 3: Write the run.** Create `src/server/homescope/run.ts`:

```ts
import type { BuilderCounts, HsBuilder, ImportSummary, ImportTrigger } from "@/data/homescope";
import type { Db } from "../db/types";
import type { MondayClient } from "../mirror/monday/client";
import type { EstimationBoards } from "./boards";
import { readEstimationBoards } from "./read";
import { recordFailedImport, saveImport } from "./store";
import { toCatalogue } from "./to-catalogue";

export const countsOf = (b: HsBuilder): BuilderCounts => ({
  name: b.name,
  models: b.models.length,
  ranges: b.ranges.length,
  elevations: b.elevations.length,
  colours: b.colours.length,
  siteCosts: b.siteCosts.length,
  variations: b.variations.length,
  boltOnModels: Object.keys(b.boltOns).length,
});

export const failedSummary = (error: string, calls = 0, dryRun = false): ImportSummary => ({
  status: "failed",
  dryRun,
  calls,
  builders: [],
  changed: [],
  retired: [],
  warnings: [],
  error,
});

const messageOf = (e: unknown): string => (e instanceof Error && e.message ? e.message : String(e));

/**
 * One import: read the twelve boards, turn them into the catalogue, and save it
 * (or, on a dry run, only check it). Nothing is saved unless the whole read and
 * the transform succeed. A failure is recorded as a failed run, never thrown, so the
 * CLI and the Operations screen both get a summary.
 */
export async function importCatalogue(opts: {
  db: Db | null;
  monday: MondayClient;
  trigger: ImportTrigger;
  dryRun?: boolean;
  /** For tests. */
  read?: (monday: MondayClient) => Promise<EstimationBoards>;
}): Promise<{ summary: ImportSummary; builders: HsBuilder[] }> {
  const dryRun = opts.dryRun ?? false;
  const before = opts.monday.stats.calls;
  const calls = () => opts.monday.stats.calls - before;
  try {
    const { builders, warnings } = toCatalogue(await (opts.read ?? readEstimationBoards)(opts.monday));
    if (!builders.length) throw new Error("Monday's Builders board has no builders, so nothing was imported");
    let saved = { changed: [] as string[], retired: [] as string[] };
    if (!dryRun) {
      if (!opts.db) throw new Error("There's no database to save to. Set SUPABASE_DB_URL, or use --dry-run");
      saved = await saveImport(opts.db, { builders, warnings, calls: calls(), trigger: opts.trigger });
    }
    return {
      builders,
      summary: { status: "ok", dryRun, calls: calls(), builders: builders.map(countsOf), changed: saved.changed, retired: saved.retired, warnings, error: null },
    };
  } catch (e) {
    const error = messageOf(e);
    if (!dryRun && opts.db) {
      await recordFailedImport(opts.db, { error, calls: calls(), trigger: opts.trigger }).catch((recordError) =>
        console.error("[homescope] couldn't record a failed import:", messageOf(recordError)),
      );
    }
    return { builders: [], summary: failedSummary(error, calls(), dryRun) };
  }
}
```

- [ ] **Step 4: Write the comparison.** Create `src/server/homescope/compare.ts`:

```ts
import type { HsBuilder } from "@/data/homescope";

const SECTIONS = ["models", "ranges", "elevations", "siteCosts", "allowances", "bal", "coastal", "noise", "colours", "variations"] as const;

/**
 * How an import differs from catalogue.json, builder by builder, for the dry run's
 * --compare-snapshot. Counts per section, bolt-on designs, and designs whose prices
 * moved. Prices can have moved since 6 October for good reason: this is a check, not a test.
 */
export function compareWithSnapshot(imported: HsBuilder[], snapshot: HsBuilder[]): string[] {
  const lines: string[] = [];
  for (const s of snapshot) {
    const b = imported.find((x) => x.name === s.name);
    if (!b) {
      lines.push(`${s.name}: in the snapshot, not on Monday`);
      continue;
    }
    const diffs = SECTIONS.flatMap((k) => (b[k].length === s[k].length ? [] : [`${k} ${s[k].length} -> ${b[k].length}`]));
    const boltS = Object.keys(s.boltOns).length;
    const boltB = Object.keys(b.boltOns).length;
    if (boltS !== boltB) diffs.push(`bolt-on designs ${boltS} -> ${boltB}`);
    const repriced = s.models.filter((m) => {
      const now = b.models.find((x) => x.name === m.name);
      return now && JSON.stringify(now.prices) !== JSON.stringify(m.prices);
    }).length;
    if (repriced) diffs.push(`${repriced} design price(s) changed`);
    lines.push(`${s.name}: ${diffs.length ? diffs.join(", ") : "matches the snapshot"}`);
  }
  for (const b of imported) if (!snapshot.some((s) => s.name === b.name)) lines.push(`${b.name}: new, ${b.models.length} designs`);
  return lines;
}
```

- [ ] **Step 5: Run the tests.**

Run: `node --import tsx --test src/server/homescope/run.test.ts src/server/homescope/compare.test.ts`
Expected: 6 pass.

- [ ] **Step 6: Write the CLI.** Create `scripts/homescope-import.ts`:

```ts
/**
 * npm run homescope:import -- [--dry-run] [--compare-snapshot]
 *
 * Reads HomeScope's catalogue from Monday (the HomeScope workspace's "Estimation
 * Source Data" boards) and saves a new version for each builder whose catalogue
 * changed. About 30 Monday calls, counted against the day's cap.
 *
 *   --dry-run            read and check only; save nothing
 *   --compare-snapshot   also show how each builder differs from catalogue.json
 *
 * Reads .env.local. Monday is only ever queried. Nothing read is written to disk.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import type { HsBuilder, ImportSummary } from "../src/data/homescope";
import { closeDb, getDb } from "../src/server/db/postgres";
import { readServerEnv } from "../src/server/env";
import { compareWithSnapshot } from "../src/server/homescope/compare";
import { importCatalogue } from "../src/server/homescope/run";
import { mondayClientFor } from "../src/server/mirror/run-source";

const FLAGS = new Set(["--dry-run", "--compare-snapshot"]);
/** No run should need more; the guard stops a loop, not a normal import. */
const MAX_CALLS = 60;

function print(s: ImportSummary) {
  console.log(`${s.status}${s.dryRun ? " (dry run, nothing saved)" : ""}: ${s.calls} Monday call(s)`);
  for (const b of s.builders) {
    console.log(
      `  ${b.name}: ${b.models} designs, ${b.ranges} ranges, ${b.elevations} elevations, ${b.colours} colours, ` +
        `${b.siteCosts} site works, ${b.variations} variations, ${b.boltOnModels} bolt-on designs`,
    );
  }
  if (!s.dryRun && s.status === "ok") {
    console.log(`  changed: ${s.changed.join(", ") || "none"}${s.retired.length ? `; retired: ${s.retired.join(", ")}` : ""}`);
  }
  for (const w of s.warnings) {
    const names = w.items.length > 8 ? `${w.items.slice(0, 8).join(", ")} and ${w.items.length - 8} more` : w.items.join(", ");
    console.log(`  ! ${w.board}: ${w.message}: ${names}`);
  }
  if (s.error) console.error(`  ${s.error}`);
}

export async function main(args: string[]) {
  const unknown = args.filter((a) => !FLAGS.has(a));
  if (unknown.length) throw new Error(`Unknown option ${unknown.join(" ")}. See the comment at the top of scripts/homescope-import.ts.`);
  const env = readServerEnv();
  const db = getDb();
  if (!db) throw new Error("Set SUPABASE_DB_URL in .env.local: the import counts its Monday calls in the database, and saves there.");
  try {
    const monday = mondayClientFor(db, env, MAX_CALLS);
    if (!monday) throw new Error("Set MONDAY_API_TOKEN in .env.local.");
    const { summary, builders } = await importCatalogue({ db, monday, trigger: "cli", dryRun: args.includes("--dry-run") });
    print(summary);
    if (args.includes("--compare-snapshot") && summary.status === "ok") {
      const path = join(process.cwd(), "src", "components", "modules", "sales", "costing", "homescope", "catalogue.json");
      const snapshot = JSON.parse(readFileSync(path, "utf8")) as { builders: HsBuilder[] };
      console.log("Against catalogue.json (6 October):");
      for (const line of compareWithSnapshot(builders, snapshot.builders)) console.log(`  ${line}`);
    }
    if (summary.status === "failed") process.exitCode = 1;
  } finally {
    await closeDb();
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main(process.argv.slice(2)).catch(async (e) => {
    console.error(e instanceof Error ? e.message : e);
    await closeDb();
    process.exit(1);
  });
}
```

- [ ] **Step 7: Add the npm script.** Copy `package.json` to the scratchpad first (another session has uncommitted edits in it). Then add one line to `scripts`, after the `"mirror"` line:

```json
    "homescope:import": "node --env-file-if-exists=.env.local --import tsx scripts/homescope-import.ts"
```

Remember the comma on the line before it. Run `git diff package.json` and check that the only new line from you is this one.

- [ ] **Step 8: Run the whole suite and the type check.**

Run: `npm test` then `npm run lint`
Expected: everything passes.

- [ ] **Step 9: Leave it uncommitted.** `git status --short`: this task adds `run.ts`, `compare.ts`, their tests, and `scripts/homescope-import.ts`, and changes `package.json`.

---

### Task 7: Run it against Monday (checkpoint)

This task changes no code. It proves the field map against the live boards before any screen depends on it. **It needs Kane:** it uses `.env.local`, makes about 30 Monday calls, and the real import writes to the dev database.

- [ ] **Step 1: Apply the migration to dev.**

Run: `npm run db:status` then `npm run db:migrate`
Expected: `20261010000100_homescope_imports` is listed as pending, then applied. Nothing else is pending unless the other session has new migrations. If it does, stop and ask Kane before applying theirs.

- [ ] **Step 2: Dry run with the snapshot comparison.**

Run: `npm run homescope:import -- --dry-run --compare-snapshot`
Expected:
- `ok (dry run, nothing saved): ` with about 29 calls.
- 9 builders: Forma, LaVida, Move, My Homes WA, New Choice, New Era, Redink SW, Select Living, SW1.
- Against catalogue.json: `Forma`, `LaVida`, `New Choice` and `Move` say `matches the snapshot`, or list only `design price(s) changed` (prices can have moved since 6 October). The other five are listed as `new`.
- Warnings matching the Design section: 8 unlinked models, 4 with no To Suit Block, New Era's "rosewood" twice, Forma's 10 unmatched bolt-on designs, Redink SW with no delayed-title rule.

If any section count differs for the four snapshot builders, stop. Compare against the Design section's rules and fix `to-catalogue.ts` with a new test that pins the case, using made-up data. Do not copy live data into the test.

- [ ] **Step 3: The real import.**

Run: `npm run homescope:import`
Expected: `ok`, the same counts, and `changed:` listing all 9 builders.

- [ ] **Step 4: Run it again.**

Run: `npm run homescope:import`
Expected: `ok`, and `changed: none`.

- [ ] **Step 5: Note the results for Kane** in the task report: call counts, the warnings, and the snapshot comparison lines. They go in the report, not into a file in the repo.

---

### Task 8: HomeScope prices from the imported catalogue

**Files:**
- Create: `app/api/homescope/catalogue/route.ts`
- Create: `src/components/modules/sales/costing/homescope/catalogue-state.ts`
- Create: `src/components/modules/sales/costing/homescope/catalogue-context.tsx`
- Modify: `src/components/modules/sales/costing/homescope/catalogue.ts` (`builderByName`)
- Modify: `src/components/modules/sales/costing/homescope/pricing.ts:1,123-124`
- Modify: `src/components/modules/sales/costing/homescope/store.ts:4,253-256,370-380`
- Modify: `src/components/modules/sales/costing/homescope/HomeScope.tsx:18,54,90-100,146-147,169-171,196-198,485-490`
- Modify: `src/components/modules/sales/costing/homescope/steps/ClientStep.tsx:11,35-38`
- Modify: `src/components/modules/sales/costing/homescope/steps/PickSteps.tsx:9,22-24`
- Modify: `src/components/modules/sales/costing/homescope/steps/SiteSteps.tsx:130`
- Test: `src/components/modules/sales/costing/homescope/catalogue-state.test.ts`

**Interfaces:**
- Consumes: `loadCatalogue`, `loadLastImport` (Task 5); `getDb`; `Catalogue`, `CatalogueResponse`, `ImportRecord`, `HsBuilder` (`@/data/homescope`); `perthDate`, `perthClock` (`src/lib/perth-time.ts`).
- Produces: `GET /api/homescope/catalogue` (`CatalogueResponse`). `stateFrom(response: CatalogueResponse | null, snapshot: Catalogue): CatalogueState`. `catalogueLabel(c: Catalogue): string`. `CatalogueState = { status: "loading" | "ready"; catalogue: Catalogue; lastImport: ImportRecord | null; live: boolean; note: string | null }`. `SNAPSHOT: Catalogue`, `useLiveCatalogue(): CatalogueState & { reload(): void }`, `CatalogueProvider`, `useCatalogue(): Catalogue`. `builderIn(builders, name)`. `price(e, builders)`. `chooseFloorArea(area, builder)`.

- [ ] **Step 1: Write the failing tests.** Create `src/components/modules/sales/costing/homescope/catalogue-state.test.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import type { Catalogue, ImportRecord } from "@/data/homescope";
import { catalogueLabel, stateFrom } from "./catalogue-state";

const snapshot: Catalogue = { builders: [], source: "snapshot", asOf: "2026-10-06" };
const imported: Catalogue = { builders: [], source: "monday", asOf: "2026-10-10T07:12:00.000Z" };
const run: ImportRecord = { id: "r1", finishedAt: imported.asOf, trigger: "cli", status: "ok", calls: 29, builders: 9, changed: 9, warnings: [], error: null };

test("state: an import is used when there is one", () => {
  const s = stateFrom({ kind: "live", catalogue: imported, lastImport: run }, snapshot);
  assert.equal(s.status, "ready");
  assert.equal(s.catalogue, imported);
  assert.equal(s.live, true);
  assert.equal(s.lastImport, run);
  assert.equal(s.note, null);
});

test("state: no database, nothing imported yet, a route error or no answer all fall back to the snapshot and say why", () => {
  const off = stateFrom({ kind: "off" }, snapshot);
  assert.deepEqual([off.status, off.catalogue, off.live, off.note], ["ready", snapshot, false, null]);

  const none = stateFrom({ kind: "live", catalogue: null, lastImport: null }, snapshot);
  assert.equal(none.catalogue, snapshot);
  assert.equal(none.live, true);
  assert.match(none.note ?? "", /Nothing has been imported from Monday yet/);

  const failed = stateFrom({ kind: "error", message: "The imported catalogue can't be read right now." }, snapshot);
  assert.equal(failed.catalogue, snapshot);
  assert.equal(failed.note, "The imported catalogue can't be read right now.");

  const silent = stateFrom(null, snapshot);
  assert.equal(silent.status, "ready");
  assert.equal(silent.catalogue, snapshot);
  assert.match(silent.note ?? "", /Couldn't reach the imported catalogue/);
});

test("label: an import shows Monday and its Perth date and time; the snapshot shows its date", () => {
  assert.equal(catalogueLabel(snapshot), "Price snapshot · 6 Oct 2026");
  // 07:12 UTC is 3:12pm in Perth.
  assert.equal(catalogueLabel(imported), "Monday · 10 Oct 2026, 3:12pm");
});
```

- [ ] **Step 2: Run them to see them fail.**

Run: `node --import tsx --test src/components/modules/sales/costing/homescope/catalogue-state.test.ts`
Expected: FAIL, `Cannot find module './catalogue-state'`.

- [ ] **Step 3: Write the state helpers.** Create `src/components/modules/sales/costing/homescope/catalogue-state.ts`:

```ts
import type { Catalogue, CatalogueResponse, ImportRecord } from "@/data/homescope";
import { MONTHS, perthClock, perthDay } from "@/lib/perth-time";

/** What HomeScope and Operations › HomeScope pricing show: the catalogue, and why it's that one. */
export interface CatalogueState {
  status: "loading" | "ready";
  catalogue: Catalogue;
  lastImport: ImportRecord | null;
  /** A database is connected, so an import can be run and saved. */
  live: boolean;
  /** Why the snapshot is showing, when it shouldn't be. */
  note: string | null;
}

/** The route's answer (null when there was none) as screen state. Anything short of an import falls back to the snapshot. */
export function stateFrom(response: CatalogueResponse | null, snapshot: Catalogue): CatalogueState {
  const ready = (over: Partial<CatalogueState>): CatalogueState => ({
    status: "ready",
    catalogue: snapshot,
    lastImport: null,
    live: false,
    note: null,
    ...over,
  });
  if (!response) return ready({ note: "Couldn't reach the imported catalogue, so these are the 6 October snapshot prices." });
  if (response.kind === "off") return ready({});
  if (response.kind === "error") return ready({ note: response.message });
  if (!response.catalogue) {
    return ready({
      live: true,
      lastImport: response.lastImport,
      note: "Nothing has been imported from Monday yet, so these are the 6 October snapshot prices.",
    });
  }
  return ready({ live: true, catalogue: response.catalogue, lastImport: response.lastImport });
}

/** "10 Oct 2026", the date in Perth, from perth-time's tables so server and browser agree. */
function dateLabel(t: string): string {
  const [y, m, d] = perthDay(t).split("-").map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

/** "Monday · 10 Oct 2026, 3:12pm" for an import (Perth time), "Price snapshot · 6 Oct 2026" for the snapshot. */
export function catalogueLabel(c: Catalogue): string {
  if (c.source === "monday") return `Monday · ${dateLabel(c.asOf)}, ${perthClock(c.asOf)}`;
  return `Price snapshot · ${dateLabel(`${c.asOf}T00:00:00+08:00`)}`;
}
```

- [ ] **Step 4: Run the tests.**

Run: `node --import tsx --test src/components/modules/sales/costing/homescope/catalogue-state.test.ts`
Expected: 3 pass.

- [ ] **Step 5: Write the route.** Read `node_modules/next/dist/docs/` on route handlers first. Create `app/api/homescope/catalogue/route.ts`:

```ts
import { NextResponse } from "next/server";
import type { CatalogueResponse } from "@/data/homescope";
import { getDb } from "@/server/db/postgres";
import { loadCatalogue, loadLastImport } from "@/server/homescope/store";

export const dynamic = "force-dynamic";

/**
 * HomeScope's catalogue as last imported from Monday, and the last import run.
 * "off" with no database: the screens keep catalogue.json. There's no sign-in yet,
 * so a deployment serving this must sit behind Vercel Deployment Protection, like
 * the mirrored files (spec section 7).
 */
export async function GET() {
  try {
    const db = getDb();
    if (!db) return NextResponse.json({ kind: "off" } satisfies CatalogueResponse);
    const [catalogue, lastImport] = await Promise.all([loadCatalogue(db), loadLastImport(db)]);
    return NextResponse.json({ kind: "live", catalogue, lastImport } satisfies CatalogueResponse);
  } catch (e) {
    // A malformed connection string or a database error must not reach the browser as a bare 500.
    console.error("[homescope] couldn't read the catalogue:", e);
    return NextResponse.json(
      { kind: "error", message: "The imported catalogue can't be read right now, so these are the 6 October snapshot prices." } satisfies CatalogueResponse,
      { status: 502 },
    );
  }
}
```

- [ ] **Step 6: Write the context.** Create `src/components/modules/sales/costing/homescope/catalogue-context.tsx`:

```tsx
"use client";

import * as React from "react";
import type { Catalogue, CatalogueResponse } from "@/data/homescope";
import { CATALOGUE } from "./catalogue";
import { stateFrom, type CatalogueState } from "./catalogue-state";

/** catalogue.json, the 6 October snapshot: what every screen shows without an import. */
export const SNAPSHOT: Catalogue = { builders: CATALOGUE.builders, source: "snapshot", asOf: CATALOGUE.snapshot };

const Ctx = React.createContext<Catalogue>(SNAPSHOT);

/** Sets the catalogue HomeScope prices from, for everything inside it. */
export const CatalogueProvider = Ctx.Provider;

/** The catalogue HomeScope prices from: the last import from Monday, or the snapshot. */
export const useCatalogue = (): Catalogue => React.useContext(Ctx);

/** Reads /api/homescope/catalogue once on mount. `reload` reads it again, after an import. */
export function useLiveCatalogue(): CatalogueState & { reload: () => void } {
  const [state, setState] = React.useState<CatalogueState>({
    status: "loading",
    catalogue: SNAPSHOT,
    lastImport: null,
    live: false,
    note: null,
  });
  const [tick, setTick] = React.useState(0);
  React.useEffect(() => {
    let alive = true;
    fetch("/api/homescope/catalogue", { cache: "no-store" })
      .then((r) => r.json() as Promise<CatalogueResponse>)
      .catch(() => null)
      .then((res) => {
        if (alive) setState(stateFrom(res, SNAPSHOT));
      });
    return () => {
      alive = false;
    };
  }, [tick]);
  const reload = React.useCallback(() => setTick((t) => t + 1), []);
  return { ...state, reload };
}
```

- [ ] **Step 7: Price from a given list of builders.** In `catalogue.ts`, replace

```ts
export const builderByName = (name: string | null) => CATALOGUE.builders.find((b) => b.name === name) ?? null;
```

with

```ts
/** The builder with this name in a catalogue's builders, or null. */
export const builderIn = (builders: HsBuilder[], name: string | null) => builders.find((b) => b.name === name) ?? null;
```

and delete the `SNAPSHOT_LABEL` constant (lines 107 to 112), since `catalogueLabel` replaces it. Update the file's top comment from "is a read-only snapshot of four builders" to say that `catalogue.json` is the fallback used when nothing has been imported (Task 8, `catalogue-context.tsx`).

In `pricing.ts`, line 1, change `builderByName` to `builderIn`, then change the signature and first line of `price`:

```ts
export function price(e: Estimate, builders: HsBuilder[]): Pricing {
  const builder = builderIn(builders, e.builder);
```

In `store.ts`, line 4, change `builderByName` to `builderIn` (remove it if TypeScript reports it unused), and add `import type { HsBuilder } from "./catalogue";` and `import { useCatalogue } from "./catalogue-context";`. Change `useEstimate`:

```ts
/** The estimate with its figures worked out, from the catalogue HomeScope is pricing with. */
export function useEstimate() {
  const s = useHomeScope();
  const { builders } = useCatalogue();
  const pricing = React.useMemo(() => price(s.estimate, builders), [s.estimate, builders]);
  return { ...s, pricing };
}
```

Change `chooseFloorArea` to take the builder its caller already has:

```ts
/** A new floor area band keeps each rate only if the band has one by that name (HomeScope's revalidate). */
export function chooseFloorArea(area: number, b: HsBuilder) {
  edit((e) => {
    const keep = (list: "bal" | "coastal" | "noise", name: string | null) =>
      name && b[list].some((r) => r.area === area && r.name === name) ? name : null;
    return { ...e, floorArea: area, bal: keep("bal", e.bal), coastal: keep("coastal", e.coastal), noise: keep("noise", e.noise) };
  });
}
```

In `steps/SiteSteps.tsx` line 130, pass the builder `b` (declared at line 114 and non-null there): `onChange={(v) => chooseFloorArea(Number(v), b)}`.

- [ ] **Step 8: Read the catalogue in the steps.** In `steps/ClientStep.tsx`, remove `CATALOGUE` from the `../catalogue` import, add `import { useCatalogue } from "../catalogue-context";`, and in `ClientStep()` add `const { builders } = useCatalogue();` after `useEstimate()`. Then change `CATALOGUE.builders.map(` to `builders.map(`.

In `steps/PickSteps.tsx`, remove `CATALOGUE` from the `../catalogue` import, add `import { useCatalogue } from "../catalogue-context";`, and in `BuilderStep()` add `const { builders: all } = useCatalogue();`. Then change `const builders = CATALOGUE.builders` to `const builders = all`.

- [ ] **Step 9: Load the catalogue before HomeScope opens.** In `HomeScope.tsx`:

1. Line 18: `import { STEPS, modelsForBlock, stepIndex, type HsBuilder, type StepId } from "./catalogue";`. Add `import { CatalogueProvider, useCatalogue, useLiveCatalogue } from "./catalogue-context";`, `import { catalogueLabel } from "./catalogue-state";` and `import { ScreenSkeleton } from "@/components/ui/screen-skeleton";`.
2. Line 54: change the comment to `* Prices come from the catalogue last imported from HomeScope's Monday boards, or catalogue.json (the 6 October snapshot) when there's none.`
3. `blocker`: give it the builders, `function blocker(id: StepId, e: Estimate, builders: HsBuilder[]): string | null {`, and use them: `if (!builders.some((b) => modelsForBlock(b, block).length)) return "No design suits this block";`.
4. Rename `export default function HomeScope() {` (line 146) to `function HomeScopeScreen({ note }: { note: string | null }) {`. Add `const catalogue = useCatalogue();` as its second line. Pass `catalogue.builders` to all three `blocker(...)` calls (lines 169, 171 and 242): `blocker(current.id, e, catalogue.builders)`, `blocker(s.id, e, catalogue.builders)`, `blocker(unready!.id, e, catalogue.builders)`.
5. Replace the snapshot pill (lines 196 to 198) with:

```tsx
            <Pill
              tone="neutral"
              icon={Database}
              title={catalogue.source === "monday" ? "Prices imported from HomeScope's Monday boards" : "Prices are a snapshot of HomeScope's Monday boards"}
            >
              {catalogueLabel(catalogue)}
            </Pill>
```

6. Right after the closing `/>` of that `PageHeader`, add `{note ? <p role="status" className="-mt-3 text-xs text-muted-foreground">{note}</p> : null}`.
7. In `LoadQuoteDialog`, add `const { builders } = useCatalogue();` after its `useHomeScope()` line, change `price(s.estimate)` to `price(s.estimate, builders)`, and add `builders` to that `useMemo`'s dependency list.
8. Add the new default export at the end of the file:

```tsx
/** Reads the catalogue first: the last import from Monday when there is one, else the 6 October snapshot. */
export default function HomeScope() {
  const live = useLiveCatalogue();
  if (live.status === "loading") return <ScreenSkeleton />;
  return (
    <CatalogueProvider value={live.catalogue}>
      <HomeScopeScreen note={live.note} />
    </CatalogueProvider>
  );
}
```

- [ ] **Step 10: Type check, test, and look.**

Run: `npm run lint` then `npm test`
Expected: no type errors (every old `builderByName`, `CATALOGUE.builders` and `SNAPSHOT_LABEL` use is gone, and every `price(...)` call has its builders) and every test passes.

Then open `http://localhost:3000/sales?tab=costing&view=homescope` (check the rail for the exact link). Expected: a skeleton, then HomeScope with the pill reading `Monday · <date>, <time>` and nine builders on step 2 for a 12.5 m block. Walk one estimate to Summary and check that the price card's base matches the model's price for the chosen range on Operations › HomeScope pricing (Task 9). Then remove `SUPABASE_DB_URL` from your shell's view (rename `.env.local` briefly, restart `npm run dev`), reload, and check that the pill reads `Price snapshot · 6 Oct 2026` with four builders. Restore `.env.local` straight away.

- [ ] **Step 11: Leave it uncommitted.** `git status --short`: the route, the two new `homescope/` files, the test, and the seven modified HomeScope files.

---

### Task 9: Operations › HomeScope pricing

**Files:**
- Create: `src/server/actions/homescope.ts`
- Create: `src/components/modules/operations/homescope/BuilderCatalogue.tsx`
- Create: `src/components/modules/operations/homescope/HomeScopePricing.tsx`
- Modify: `src/components/shell/dashboards.ts:202` (one rail line)
- Modify: `src/components/modules/operations/OperationsScreen.tsx` (one tab)

**Interfaces:**
- Consumes: `importCatalogue`, `failedSummary` (Task 6); `mondayClientFor`; `getDb`; `readServerEnv`; `useLiveCatalogue`, `catalogueLabel` (Task 8); `HsBuilder`, `ImportSummary`, `ImportWarning` (`@/data/homescope`); the UI components named below.
- Produces: `importCatalogueAction(): Promise<ImportSummary>`; `<HomeScopePricing />`; `<BuilderCatalogue builder={...} />`; the `operations` tab `homescope`.

- [ ] **Step 1: Write the server action.** Read `node_modules/next/dist/docs/` on server actions, and `src/server/actions/land.ts`. Create `src/server/actions/homescope.ts`:

```ts
"use server";

import type { ImportSummary } from "@/data/homescope";
import { getDb } from "@/server/db/postgres";
import { readServerEnv } from "@/server/env";
import { failedSummary, importCatalogue } from "@/server/homescope/run";
import { mondayClientFor } from "@/server/mirror/run-source";

/** Operations › HomeScope pricing's "Import from Monday": about 30 read-only calls, then a summary. */
export async function importCatalogueAction(): Promise<ImportSummary> {
  const db = getDb();
  if (!db) return failedSummary("Live data isn't connected, so there's nowhere to save an import.");
  const monday = mondayClientFor(db, readServerEnv(), 60, new Date(Date.now() + 120_000));
  if (!monday) return failedSummary("MONDAY_API_TOKEN isn't set, so Monday can't be read.");
  return (await importCatalogue({ db, monday, trigger: "screen" })).summary;
}
```

- [ ] **Step 2: Write one builder's sections.** Create `src/components/modules/operations/homescope/BuilderCatalogue.tsx`:

```tsx
"use client";

import * as React from "react";
import type { HsBuilder, HsRate } from "@/data/homescope";
import { aud, cn } from "@/lib/utils";
import { Card, CardHeader, CardMeta, CardTitle } from "@/components/ui/card";
import { SearchInput } from "@/components/ui/input";
import { Reveal } from "@/components/ui/reveal";
import { Dash, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface Column<T> {
  label: string;
  cell: (row: T) => React.ReactNode;
  align?: "right";
}

/** A blank value as a dash. */
const opt = (v: React.ReactNode) => (v == null || v === "" ? <Dash /> : v);
const money = (n: number) => aud(n);
/** Variations shown before a search narrows them: some builders have 700. */
const VARIATION_CAP = 100;

function Section<T>({
  index,
  title,
  meta,
  rows,
  columns,
  rowKey,
  tools,
}: {
  index: number;
  title: string;
  meta: string;
  rows: T[];
  columns: Column<T>[];
  rowKey: (row: T, n: number) => string;
  tools?: React.ReactNode;
}) {
  return (
    <Reveal index={index}>
      <Card className="min-w-0 overflow-hidden">
        <CardHeader className="flex flex-wrap items-end gap-3 border-b border-hairline pb-3">
          <div className="min-w-0">
            <CardTitle>{title}</CardTitle>
            <CardMeta className="text-xs text-muted-foreground">{meta}</CardMeta>
          </div>
          {tools ? <div className="ml-auto">{tools}</div> : null}
        </CardHeader>
        {rows.length ? (
          <div className="overflow-x-auto">
            <Table className="min-w-[560px]">
              <TableHeader>
                <TableRow className="hover:bg-transparent dark:hover:bg-transparent">
                  {columns.map((c, i) => (
                    <TableHead
                      key={c.label}
                      className={cn(i === 0 && "pl-5", i === columns.length - 1 && "pr-5", c.align === "right" && "text-right")}
                    >
                      {c.label}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r, n) => (
                  <TableRow key={rowKey(r, n)}>
                    {columns.map((c, i) => (
                      <TableCell
                        key={c.label}
                        className={cn(
                          "tabular-nums",
                          i === 0 && "pl-5 font-medium",
                          i === columns.length - 1 && "pr-5",
                          c.align === "right" && "text-right",
                        )}
                      >
                        {c.cell(r)}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <p className="px-5 py-4 text-[13px] text-muted-foreground">None on Monday for this builder.</p>
        )}
      </Card>
    </Reveal>
  );
}

const RATE_COLUMNS: Column<HsRate>[] = [
  { label: "Option", cell: (r) => r.name },
  { label: "Floor area", cell: (r) => opt(r.area == null ? null : `${r.area} m²`), align: "right" },
  { label: "Price", cell: (r) => money(r.price), align: "right" },
];

/** Everything HomeScope can quote for one builder, board by board, as last imported. */
export function BuilderCatalogue({ builder: b }: { builder: HsBuilder }) {
  const [q, setQ] = React.useState("");
  const letters = [...new Set(b.ranges.map((r) => r.column))].sort();
  const rangeName = (letter: string) => b.ranges.filter((r) => r.column === letter).map((r) => r.name).join(" / ") || `Range ${letter}`;
  const needle = q.trim().toLowerCase();
  const matching = needle
    ? b.variations.filter((v) => `${v.area} ${v.code} ${v.description}`.toLowerCase().includes(needle))
    : b.variations;
  const shown = matching.slice(0, VARIATION_CAP);

  return (
    <div className="flex flex-col gap-5">
      <Section
        index={0}
        title="Designs"
        meta={`${b.models.length} on the Models board, priced by spec range`}
        rows={b.models}
        rowKey={(m, n) => `${m.name}-${n}`}
        columns={[
          { label: "Design", cell: (m) => m.name },
          { label: "Frontage", cell: (m) => opt(m.frontage == null ? null : `${m.frontage} m`), align: "right" },
          { label: "Beds", cell: (m) => opt(m.beds), align: "right" },
          { label: "Baths", cell: (m) => opt(m.baths), align: "right" },
          { label: "House", cell: (m) => opt(m.houseArea == null ? null : `${m.houseArea} m²`), align: "right" },
          { label: "Block", cell: (m) => opt(m.corner ? "Corner" : m.blockType) },
          ...letters.map((l) => ({
            label: rangeName(l),
            cell: (m: HsBuilder["models"][number]) => (m.prices[l] == null ? <Dash /> : money(m.prices[l])),
            align: "right" as const,
          })),
        ]}
      />
      <Section
        index={1}
        title="Spec ranges"
        meta="Which price column each range reads"
        rows={[...b.ranges].sort((x, y) => x.position - y.position)}
        rowKey={(r) => r.name}
        columns={[
          { label: "Range", cell: (r) => r.name },
          { label: "Level", cell: (r) => r.level },
          { label: "Price column", cell: (r) => `Specs Range ${r.column} Price` },
        ]}
      />
      <Section
        index={2}
        title="Front elevations"
        meta={`${b.elevations.length} styles`}
        rows={b.elevations}
        rowKey={(e, n) => `${e.name}-${n}`}
        columns={[
          { label: "Style", cell: (e) => e.name },
          { label: "Price", cell: (e) => (e.price ? money(e.price) : "Included"), align: "right" },
        ]}
      />
      <Section
        index={3}
        title="Colour schemes"
        meta="Included in the price"
        rows={b.colours}
        rowKey={(c, n) => `${c.name}-${n}`}
        columns={[
          { label: "Scheme", cell: (c) => c.name },
          { label: "Description", cell: (c) => opt(c.description) },
        ]}
      />
      <Section
        index={4}
        title="Site works"
        meta="The fixed site cost options"
        rows={b.siteCosts}
        rowKey={(s, n) => `${s.name}-${n}`}
        columns={[
          { label: "Option", cell: (s) => s.name },
          { label: "Work type", cell: (s) => opt(s.workType) },
          { label: "Cost type", cell: (s) => opt(s.costType) },
          { label: "Price", cell: (s) => money(s.price), align: "right" },
        ]}
      />
      <Section
        index={5}
        title="Delayed title allowance"
        meta={b.bundleAllowance ? "Included in the base build price" : "Added when titles are later than the price hold"}
        rows={b.allowances}
        rowKey={(a, n) => `${a.due}-${n}`}
        columns={[
          { label: "When", cell: (a) => a.due },
          { label: "Price hold", cell: (a) => `${a.holdMonths} months`, align: "right" },
          { label: "Type", cell: (a) => a.type },
          { label: "Value", cell: (a) => (a.type.toLowerCase().includes("percent") ? `${a.value}%` : money(a.value)), align: "right" },
          { label: "Monthly step", cell: (a) => (a.monthlyStep ? `${a.monthlyStep}%` : <Dash />), align: "right" },
          { label: "Top-up", cell: (a) => (a.initial ? money(a.initial) : <Dash />), align: "right" },
        ]}
      />
      <Section index={6} title="BAL ratings" meta="Bushfire attack level" rows={b.bal} rowKey={(r, n) => `${r.name}-${r.area}-${n}`} columns={RATE_COLUMNS} />
      <Section index={7} title="Coastal distance" meta="How near the sea the block is" rows={b.coastal} rowKey={(r, n) => `${r.name}-${r.area}-${n}`} columns={RATE_COLUMNS} />
      <Section index={8} title="Noise package" meta="Road and rail noise" rows={b.noise} rowKey={(r, n) => `${r.name}-${r.area}-${n}`} columns={RATE_COLUMNS} />
      <Section
        index={9}
        title="Variations"
        meta={
          matching.length > shown.length
            ? `Showing ${shown.length} of ${matching.length}. Search to narrow`
            : `${matching.length} of ${b.variations.length}`
        }
        tools={<SearchInput value={q} onChange={setQ} placeholder="Search variations" count={needle ? matching.length : undefined} />}
        rows={shown}
        rowKey={(v, n) => `${v.code}-${n}`}
        columns={[
          { label: "Area", cell: (v) => v.area },
          { label: "Code", cell: (v) => opt(v.code) },
          { label: "Description", cell: (v) => <span className="line-clamp-2 font-normal">{v.description}</span> },
          { label: "Unit", cell: (v) => opt(v.unit) },
          { label: "Charge", cell: (v) => money(v.charge), align: "right" },
          { label: "Credit", cell: (v) => (v.credit ? money(v.credit) : <Dash />), align: "right" },
        ]}
      />
      <Section
        index={10}
        title="Bolt-on pricing"
        meta="Per design"
        rows={Object.entries(b.boltOns)}
        rowKey={([model]) => model}
        columns={[
          { label: "Design", cell: ([model]) => model },
          { label: "Items", cell: ([, items]) => items.length, align: "right" },
          { label: "Total charge", cell: ([, items]) => money(items.reduce((s, i) => s + i.charge, 0)), align: "right" },
        ]}
      />
    </div>
  );
}
```

- [ ] **Step 3: Write the screen.** Create `src/components/modules/operations/homescope/HomeScopePricing.tsx`:

```tsx
"use client";

import * as React from "react";
import { CloudDownload, Database, Layers, LayoutGrid, ListChecks, TriangleAlert } from "lucide-react";
import type { ImportSummary, ImportWarning } from "@/data/homescope";
import { perthClock, perthDate } from "@/lib/perth-time";
import { confirm, useLaunchpad } from "@/state/launchpad-store";
import { importCatalogueAction } from "@/server/actions/homescope";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardMeta, CardTitle } from "@/components/ui/card";
import { KpiCard, KpiGrid } from "@/components/ui/kpi-card";
import { AutoHeight } from "@/components/ui/list-motion";
import { PageHeader } from "@/components/ui/page";
import { Pill } from "@/components/ui/pill";
import { Reveal } from "@/components/ui/reveal";
import { ScreenSkeleton } from "@/components/ui/screen-skeleton";
import { SlidingTabs, TabPanels } from "@/components/ui/sliding-tabs";
import { useLiveCatalogue } from "@/components/modules/sales/costing/homescope/catalogue-context";
import { catalogueLabel } from "@/components/modules/sales/costing/homescope/catalogue-state";
import { BuilderCatalogue } from "./BuilderCatalogue";

const names = (items: string[]) => (items.length <= 6 ? items.join(", ") : `${items.slice(0, 6).join(", ")} and ${items.length - 6} more`);

function importedMessage(r: ImportSummary): string {
  if (r.status === "failed") return `Import from Monday failed: ${r.error}`;
  const n = r.changed.length + r.retired.length;
  return n ? `Imported from Monday: ${n} builder${n === 1 ? "" : "s"} updated` : "Imported from Monday: no changes";
}

/** Items the last import flagged, board by board. */
function ImportWarnings({ warnings }: { warnings: ImportWarning[] }) {
  return (
    <Card className="min-w-0 overflow-hidden">
      <CardHeader className="border-b border-hairline pb-3">
        <CardTitle>To check on Monday</CardTitle>
        <CardMeta className="text-xs text-muted-foreground">
          What the last import flagged on the Estimation Source Data boards. Fix them there, then import again.
        </CardMeta>
      </CardHeader>
      <ul className="divide-y divide-hairline">
        {warnings.map((w) => (
          <li key={`${w.board}-${w.message}`} className="flex gap-3 px-5 py-3 text-[13px]">
            <TriangleAlert className="mt-0.5 size-4 shrink-0 text-tone-ink" aria-hidden />
            <div className="min-w-0">
              <p>
                <span className="font-medium">{w.board}</span>: {names(w.items)} {w.message}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}

/**
 * Operations › HomeScope pricing (Meeting4, decision 5): the catalogue HomeScope
 * quotes from, builder by builder, as last imported from Monday's Estimation Source
 * Data boards. Read-only for now: Ops still edit on Monday, then press Import.
 */
export function HomeScopePricing() {
  const live = useLiveCatalogue();
  const { notify } = useLaunchpad();
  const [busy, setBusy] = React.useState(false);
  const [picked, setPicked] = React.useState<string | null>(null);
  const dirRef = React.useRef(0);

  const builders = live.catalogue.builders;
  const current = builders.find((b) => b.name === picked) ?? builders[0] ?? null;
  const choose = (name: string) => {
    dirRef.current = Math.sign(builders.findIndex((b) => b.name === name) - builders.findIndex((b) => b.name === current?.name));
    setPicked(name);
  };

  const runImport = async () => {
    setBusy(true);
    try {
      const r = await importCatalogueAction();
      const msg = importedMessage(r);
      notify(msg, r.status === "ok" ? "ok" : "red");
      if (r.status === "ok") confirm(msg);
      live.reload();
    } catch {
      notify("Import from Monday failed: the server didn't answer. Try again in a moment.", "red");
    } finally {
      setBusy(false);
    }
  };

  if (live.status === "loading") return <ScreenSkeleton />;

  const last = live.lastImport;
  const totals = builders.reduce(
    (t, b) => ({ models: t.models + b.models.length, variations: t.variations + b.variations.length }),
    { models: 0, variations: 0 },
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="HomeScope pricing"
        description="The builders, designs and prices HomeScope quotes from. Ops edit them on Monday's Estimation Source Data boards, then import them here."
        actions={
          <>
            <Pill tone="neutral" icon={Database}>
              {catalogueLabel(live.catalogue)}
            </Pill>
            <Button onClick={runImport} disabled={!live.live || busy} title={live.live ? undefined : "Live data isn't connected"}>
              <CloudDownload className="size-3.5" aria-hidden />
              {busy ? "Importing…" : "Import from Monday"}
            </Button>
          </>
        }
      />
      {live.note ? (
        <p role="status" className="-mt-3 text-xs text-muted-foreground">
          {live.note}
        </p>
      ) : null}

      <Reveal index={0}>
        <KpiGrid cols={4}>
          <KpiCard label="Builders" value={builders.length} sub={builders.map((b) => b.name).join(" · ")} icon={Layers} />
          <KpiCard label="Designs" value={totals.models} sub="on the Models board" icon={LayoutGrid} />
          <KpiCard label="Variations" value={totals.variations} sub="excluding bolt-on lines" icon={ListChecks} />
          <KpiCard
            label="Last import"
            value={last ? perthDate(last.finishedAt) : "Never"}
            sub={
              last
                ? `${perthClock(last.finishedAt)} · ${last.status === "ok" ? `${last.changed} changed` : "failed"} · ${last.calls} calls`
                : "Run one to read Monday"
            }
            icon={CloudDownload}
            tone={last?.status === "failed" ? "problem" : "charcoal"}
            alert={last?.status === "failed"}
          />
        </KpiGrid>
      </Reveal>

      {last?.status === "failed" && last.error ? (
        <Reveal index={1}>
          <Card className="px-5 py-3 text-[13px]">
            <span className="font-medium">The last import failed:</span> {last.error}
          </Card>
        </Reveal>
      ) : null}

      {last?.status === "ok" && last.warnings.length ? (
        <Reveal index={1}>
          <ImportWarnings warnings={last.warnings} />
        </Reveal>
      ) : null}

      {current ? (
        <Reveal index={2}>
          <div className="flex flex-col gap-4">
            <SlidingTabs
              value={current.name}
              onChange={choose}
              items={builders.map((b) => ({ value: b.name, label: b.name, count: b.models.length }))}
            />
            <AutoHeight>
              <TabPanels value={current.name} dir={dirRef.current} variant="slide">
                <BuilderCatalogue builder={current} />
              </TabPanels>
            </AutoHeight>
          </div>
        </Reveal>
      ) : null}
    </div>
  );
}
```

(`KpiCard` takes a string or number `value`, `alert`, and the `problem` and `charcoal` tones, as Doc formatter's review and Pricing use them. `SlidingTabs` items take `value`, `label` and `count`. `perthDate` gives "Sat 10 Oct" and `perthClock` "3:12pm".)

- [ ] **Step 4: Add the rail entry and the tab.** In `src/components/shell/dashboards.ts`, add a line after `tab("operations", "pricing", "Pricing", Tags),`. `Home` is already imported there, for Sales' HomeScope link:

```ts
      tab("operations", "homescope", "HomeScope pricing", Home),
```

In `src/components/modules/operations/OperationsScreen.tsx`:
- add `import { HomeScopePricing } from "./homescope/HomeScopePricing";` after the `PricingTab` import;
- add `"homescope"` to `TABS` after `"pricing"`;
- add a branch after the `pricing` one: `) : tab === "homescope" ? (` followed by `<HomeScopePricing />`.

- [ ] **Step 5: Type check and test.**

Run: `npm run lint` then `npm test`
Expected: everything passes.

- [ ] **Step 6: Look at it.** Open `http://localhost:3000/operations?tab=homescope`. Expected:
- The rail shows HomeScope pricing under Operations, after Pricing.
- After the skeleton: the pill `Monday · <date>, <time>`, four KPI cards (9 builders), the "To check on Monday" card listing the Design section's warnings, and a builder strip with design counts.
- Switching builders slides the panel, and the height eases. With reduced motion on in the OS, it switches without the slide.
- Forma's Designs table has three price columns named after its ranges. Variations shows "Showing 100 of …", and searching "electrical" narrows it.
- **Import from Monday** shows "Importing…", then a notification "Imported from Monday: no changes", and the Last import card updates. Only press it once: each press is about 30 Monday calls.
- Without a database (rename `.env.local` briefly and restart `npm run dev`): the snapshot's four builders, the button disabled, and the label `Price snapshot · 6 Oct 2026`. Restore `.env.local` straight away.

- [ ] **Step 7: Leave it uncommitted.** `git status --short`: the action, the two new Operations files, and the changes to `dashboards.ts` and `OperationsScreen.tsx`.

---

### Task 10: Final check

- [ ] **Step 1:** Run `npm test`, `npm run lint` and `npm run build`. Expected: all pass. (`npm run build` catches server-only imports in client components.)
- [ ] **Step 2:** Run `npm run check:secrets` and `git diff --stat`, and read `git status --short`. Check that nothing from Monday is in the diff (no board or column ids, no real prices, no client names), and that `package.json` only gained the one script line.
- [ ] **Step 3:** Report to Kane: what was built, the Task 7 results (calls, warnings, snapshot comparison), the migration to apply on production when it is time, and the open decisions:
  1. Whether `catalogue.json`'s real prices should now become sample data, since live prices come from the import.
  2. Who fixes the Monday warnings (the 8 unlinked designs, Forma's 10 orphaned bolt-on sets, Redink SW's missing title rule).
  3. When to plan editing in Launchpad (the next step in Meeting4's decision 5), and a schedule for the import until then.
