# Sales Portal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a fourth portal, **Sales** (`/consultant`), that is one consultant's own pipeline, clients, week, progress and deal submissions, and turn the Sales dashboard into the team's view.

**Architecture:** The Sales store moves from `SalesScreen` into the dashboard layout, so the dashboard and the portal read the same deals, to-dos, tasks and lots. Each screen wraps its panes in a `SalesViewProvider` that says whose Sales it shows (the team, or one rep) and carries the rail re-click counter. `Pipeline`, `DealDialog` and `MyClients` read that scope. The progress rules are pure functions with unit tests. The portal is a new module folder that reuses the Sales sections and adds its own Overview and My progress.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript 5.9, Tailwind 4, `motion`, `lucide-react`. Tests: Node 24 `node:test` through `tsx`.

**Spec:** [docs/superpowers/specs/2026-10-06-sales-portal-design.md](../specs/2026-10-06-sales-portal-design.md)

## Where this plan departs from the spec

Each departure is small. Each one is here so a reviewer doesn't read it as a mistake.

1. **The shared rules live in `sales/progress/`, not `consultant/progress/`.** Team (commission column) and My week (streak sentence) are in `sales/` and read them too. Keeping them in `sales/` means `sales/` never imports from `consultant/`. The portal's UI is still `consultant/MyProgress.tsx`.
2. **The week's forecast is stored as typed text** (`Record<ScorecardBuilder, string>`), not numbers. The form allows an empty box while typing, as it does today. `forecastTotal()` reads an empty box as 0.
3. **Old links to the moved sections redirect.** `/sales?tab=week` and `/sales?tab=submissions` go to the portal's sections instead of falling back to Sales › Overview (Review Focus 2).
4. **A seventh seed deal.** M. Lindqvist, A. Mercer's, 17 days in Appointment held, so My progress's stale list has something to show in a demo. Without it A. Mercer has no stale deal.
5. **Team's footnote changes.** It said consultants never see commission. It now says they see only their own, in the Sales portal.
6. **File names follow the repo's hooks:** `src/hooks/useGreeting.ts` and `src/hooks/useNow.ts` (camelCase, like `useTabParam.ts`), not `use-greeting.ts`.

## Decision for Kane before execution

**The commission rate.** The spec says a flat **$3,000** a sale. Rapid costing already quotes a commission base of **$4,800 retail / $3,200 wholesale** (`sales/costing/data.ts`), and Jarvis repeats it. Two rates in one app would look like a bug in a demo.

**Recommendation: use Rapid costing's retail base, $4,800.** This plan writes `COMMISSION_PER_SALE = COMMISSION_BASE.Retail`. If Kane wants $3,000, change that one line to `3000`. The figures in Task 4 Step 6 and Task 6's checks then become $9,000 / $6,000 / $3,000.

## Global Constraints

- Static prototype: no backend, auth, RBAC or database. Data comes from seeds and in-memory stores, and a reload resets it.
- Next.js 16 has breaking changes. Use only the Next APIs this repo already uses: `next/link`, `next/navigation` hooks, `Metadata`, and the `app/(dashboard)/<route>/page.tsx` shape. Before using any other, read `node_modules/next/dist/docs/` (AGENTS.md).
- Build UI from `src/components/ui/` and follow `docs/UI-GUIDE.md`. Never modify `Reference/`.
- Motion: only `EASE_OUT`, `EASE_SWAP`, `DURATION`, `rowDelay` and `RISE_VARIANTS` from `src/lib/motion.ts`. Gate `transition` on `useReducedMotion()`, never `initial`. New lists animate in the first pass: `Reveal` for sections and cards, `rowDelay` for rows, `CountUp` for figures, `RateBar` for bars.
- Don't change the Switch view card or the Jarvis button.
- Every placeholder value is one named constant. Its doc comment says "Placeholder, not confirmed" and names who confirms it: Sean O'Neill for targets, Alison Carter for commission.
- No em dashes in new copy, code comments or docs.
- Anything that reads the clock renders only after mount (`useNow()` returns `null` first), so the server's HTML and the browser's agree.
- Portal label **Sales**, title **Sales portal**, path `/consultant`, `ModuleId` `"consultant"`, tone `haven`, persona `{ name: "A. Mercer", role: "Sales consultant · staff preview" }`.
- Targets: `MONTH_TARGET = 2`, `QUARTER_TARGET = 8`. Stale line: `STALE_DAYS = 14`.
- Work in the git worktree `.claude/worktrees/sales-portal` on branch `feat/sales-portal`, cut from `main`. Never edit the main working tree, apart from the one note in Task 6 Step 4. Other sessions have uncommitted work there (`operations/review/`, `sales/submissions/`, `docs/UI-GUIDE.md`).
- Verify every task with `npm test` and `npx tsc --noEmit`. Task 6 also runs `npx next build`, with the worktree's dev server stopped, because they share `.next/`.
- End every commit message with:
  `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`

## Review Focus

1. **A deal changed in one view, then the other is opened.** Moving a deal to Sale won in the portal shows on the dashboard's board and in the portal's Won this month. Undoing the move takes both back. The reverse holds too. Pinned by Task 1's `wonInSession` tests and Task 5 Step 12's browser check.
2. **An old link to a moved section** (a bookmark, a shared URL, an old Jarvis answer: `/sales?tab=week`, `/sales?tab=submissions`). It lands on the portal's section, not silently on Sales › Overview. Pinned by Task 5's `portalHrefFor` test.
3. **A job with a blank rep, or a rep outside `REPS`, on the team's Clients.** It still shows, under Unassigned or its rep's name. A rep with no clients gets no empty heading. Pinned by Task 3's `groupByRep` tests.
4. **Time-based figures on first paint.** The stale list and the greeting fill in after mount, with no hydration warning in the console. A deal exactly 14 days in a stage counts as stale. Pinned by Task 1's stale tests and the console checks in Tasks 4 and 5.
5. **A deal that isn't the rep's.** Another rep's deals never reach the portal's funnel, stale list, commission or board. The portal can't reassign a deal; a manager can, from the dashboard, and the deal then leaves the portal. Pinned by the other-rep cases in Task 1's tests and Task 5 Step 12.

---

### Task 1: Worktree, test runner and the progress rules

**Files:**
- Modify: `package.json` (dev dependency `tsx`, script `test`)
- Create: `src/components/modules/sales/progress/data.ts`
- Create: `src/components/modules/sales/progress/progress.ts`
- Test: `src/components/modules/sales/progress/progress.test.ts`

**Interfaces:**
- Consumes: from `src/components/modules/sales/data.ts`: `PIPELINE_STAGES`, `SALES_WON_QTD`, `STAGE_REPORT_DEALS`, `STAGE_REPORT_LEADS`, `isOpenDeal`, `seedDeals(now: number): PipelineDeal[]`, types `PipelineDeal`, `PipelineStage`. From `sales/costing/data.ts`: `COMMISSION_BASE`. From `sales/week/data.ts`: `LAST_WEEK`.
- Produces (later tasks import these exact names):
  - `progress/data.ts`: `MONTH_TARGET`, `QUARTER_TARGET`, `COMMISSION_PER_SALE`, `STALE_DAYS`, `FORECAST_HISTORY: readonly ForecastWeek[]`, type `ForecastWeek = { weekEnding: string; forecast: number; signed: number }`.
  - `progress/progress.ts`:
    - `wonInSession(deals, seed, rep): number`
    - `wonToDate(rep, inSession): { month: number; quarter: number }`
    - `wonSoFar(deals, rep): { month: number; quarter: number }`
    - `wonVsTarget(won, target): TargetProgress`
    - `forecastStreak(weeks): number`
    - `funnel(deals, rep): FunnelStep[]`
    - `LEAD_STATUSES`, `leadsFor(rep): number[]`
    - `staleDeals(deals, rep, now): StaleDeal[]`
    - `commissionPipeline(deals, rep, perSale?): number`
    - `commissionEarned(won, perSale?): number`
    - `percent(ratio): string`
    - types `TargetProgress`, `FunnelStep`, `StaleDeal`.
  - `npm test`.

- [ ] **Step 1: Create the worktree and install**

```bash
cd /c/Users/Kane/Desktop/Locale-launchpad
git worktree add .claude/worktrees/sales-portal -b feat/sales-portal main
cd .claude/worktrees/sales-portal
npm ci
npm install --save-dev tsx@^4.21.0
```

`next.config.ts` pins Turbopack's root to the project, so the worktree needs its own `node_modules` (a link won't do). Every later command runs in `.claude/worktrees/sales-portal`.

- [ ] **Step 2: Add the test script**

In `package.json`, after `"lint": "tsc --noEmit"`:

```json
    "lint": "tsc --noEmit",
    "test": "node --import tsx --test \"src/**/*.test.ts\""
```

- [ ] **Step 3: Write the placeholder data** `src/components/modules/sales/progress/data.ts`

```ts
/**
 * Sales progress: the figures My progress (the Sales portal) and Team's
 * commission column read that nothing in the prototype records yet. Each one
 * is named once, here. Static prototype data: nothing is fetched.
 */
import { COMMISSION_BASE } from "../costing/data";
import { LAST_WEEK } from "../week/data";

/** Sales a consultant is asked to sign in a month. Placeholder, not confirmed: Sean O'Neill sets targets. */
export const MONTH_TARGET = 2;

/** Sales a consultant is asked to sign in a quarter. Placeholder, not confirmed: Sean O'Neill sets targets. */
export const QUARTER_TARGET = 8;

/**
 * Commission per sale, AUD. Placeholder, not confirmed: Alison Carter confirms
 * the formula. Meeting 2 ruled out HubSpot's amount field, which is the build
 * price. Rapid costing's retail commission base, so the Launchpad quotes one
 * rate.
 */
export const COMMISSION_PER_SALE = COMMISSION_BASE.Retail;

/** An open deal this many days in one stage is stale. */
export const STALE_DAYS = 14;

export interface ForecastWeek {
  /** The Sunday the week ends: "2 Aug". */
  weekEnding: string;
  forecast: number;
  signed: number;
}

/**
 * The consultant's last six weeks, oldest first. Placeholder, not confirmed:
 * sample weeks. Each is within one of its forecast and the last is My week's
 * LAST_WEEK, so My week's "within one for 6 weeks running" stays true.
 */
export const FORECAST_HISTORY: readonly ForecastWeek[] = [
  { weekEnding: "28 Jun", forecast: 5, signed: 4 },
  { weekEnding: "5 Jul", forecast: 5, signed: 5 },
  { weekEnding: "12 Jul", forecast: 6, signed: 7 },
  { weekEnding: "19 Jul", forecast: 6, signed: 5 },
  { weekEnding: "26 Jul", forecast: 6, signed: 6 },
  { weekEnding: "2 Aug", forecast: LAST_WEEK.forecast, signed: LAST_WEEK.signed },
];
```

- [ ] **Step 4: Write the failing tests** `src/components/modules/sales/progress/progress.test.ts`

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { seedDeals, type PipelineDeal, type PipelineStage } from "../data";
import { LAST_WEEK } from "../week/data";
import { FORECAST_HISTORY } from "./data";
import {
  commissionEarned,
  commissionPipeline,
  forecastStreak,
  funnel,
  leadsFor,
  percent,
  staleDeals,
  wonInSession,
  wonSoFar,
  wonToDate,
  wonVsTarget,
} from "./progress";

const DAY = 86_400_000;
const NOW = new Date(2026, 9, 6, 12).getTime();

let n = 0;
const deal = (stage: PipelineStage, extra: Partial<PipelineDeal> = {}): PipelineDeal => {
  n += 1;
  return {
    id: `t-${n}`,
    no: 2000 + n,
    stage,
    client: `Client ${n}`,
    suburb: "Baldivis",
    value: "$500k",
    rep: "A. Mercer",
    priority: "medium",
    pkg: "",
    notes: "",
    nextStep: "",
    createdAt: NOW - 30 * DAY,
    stageSince: NOW - DAY,
    updates: [],
    history: [],
    ...extra,
  };
};

test("won in session: zero on the seed, +1 for a move to Sale won, never negative", () => {
  const seed = seedDeals(0);
  assert.equal(wonInSession(seed, seed, "A. Mercer"), 0);
  const moved = seed.map((d) => (d.id === "d-whitmore" ? { ...d, stage: "Sale won" as const } : d));
  assert.equal(wonInSession(moved, seed, "A. Mercer"), 1);
  assert.equal(wonInSession(moved, seed, "K. Ellery"), 0);
  // K. Ellery's seeded win moved back out (an undo): net -1, shown as 0.
  const undone = seed.map((d) => (d.id === "d-mallillin" ? { ...d, stage: "Potential sale" as const } : d));
  assert.equal(wonInSession(undone, seed, "K. Ellery"), 0);
});

test("a lost deal sitting in Sale won is not a win", () => {
  assert.equal(wonInSession([deal("Sale won", { lost: { at: NOW, by: "A. Mercer" } })], [], "A. Mercer"), 0);
});

test("won to date adds this session's wins to HubSpot's month and quarter", () => {
  assert.deepEqual(wonToDate("A. Mercer", 0), { month: 1, quarter: 7 });
  assert.deepEqual(wonToDate("A. Mercer", 2), { month: 3, quarter: 9 });
  assert.deepEqual(wonToDate("Nobody", 1), { month: 1, quarter: 1 });
  assert.deepEqual(wonSoFar(seedDeals(0), "A. Mercer"), { month: 1, quarter: 7 });
});

test("won vs target: under, at, over, and no target", () => {
  assert.deepEqual(wonVsTarget(1, 2), { won: 1, target: 2, ratio: 0.5, hit: false });
  assert.deepEqual(wonVsTarget(2, 2), { won: 2, target: 2, ratio: 1, hit: true });
  assert.deepEqual(wonVsTarget(3, 2), { won: 3, target: 2, ratio: 1, hit: true });
  assert.deepEqual(wonVsTarget(3, 0), { won: 3, target: 0, ratio: null, hit: false });
});

test("forecast streak counts back from the latest week until one is more than one out", () => {
  const w = (forecast: number, signed: number) => ({ weekEnding: "", forecast, signed });
  assert.equal(forecastStreak([w(5, 4), w(5, 5), w(6, 7), w(6, 5), w(6, 6), w(6, 5)]), 6);
  assert.equal(forecastStreak([w(5, 4), w(5, 5), w(6, 7), w(6, 4), w(6, 6), w(6, 5)]), 2);
  assert.equal(forecastStreak([]), 0);
});

test("the sample history agrees with My week: six weeks running, ending on last week", () => {
  assert.equal(FORECAST_HISTORY.length, 6);
  assert.equal(forecastStreak(FORECAST_HISTORY), 6);
  const last = FORECAST_HISTORY[FORECAST_HISTORY.length - 1];
  assert.deepEqual([last.forecast, last.signed], [LAST_WEEK.forecast, LAST_WEEK.signed]);
});

test("funnel: a deal reaches every stage up to its own; a lost deal counts up to where it was lost", () => {
  const steps = funnel(
    [
      deal("Appointment booked"),
      deal("Potential sale"),
      deal("Appointment held", { lost: { at: NOW, by: "A. Mercer" } }),
      deal("Sale won", { rep: "K. Ellery" }),
    ],
    "A. Mercer",
  );
  assert.deepEqual(steps.map((s) => s.reached), [3, 2, 1, 0]);
  assert.deepEqual(steps.map((s) => s.now), [1, 0, 1, 0]);
  assert.deepEqual(steps.map((s) => s.conversion), [null, 2 / 3, 0.5, 0]);
});

test("funnel: with no deals every conversion is null, never NaN", () => {
  const steps = funnel([], "A. Mercer");
  assert.deepEqual(steps.map((s) => s.conversion), [null, null, null, null]);
  assert.ok(steps.every((s) => s.reached === 0 && s.now === 0));
});

test("stale: exactly 14 days counts, a minute less doesn't; lost, won and other reps' deals never do", () => {
  const exactly = deal("Appointment held", { stageSince: NOW - 14 * DAY });
  const almost = deal("Appointment held", { stageSince: NOW - 14 * DAY + 60_000 });
  const old = deal("Potential sale", { stageSince: NOW - 20 * DAY });
  const lost = deal("Appointment held", { stageSince: NOW - 30 * DAY, lost: { at: NOW, by: "A. Mercer" } });
  const won = deal("Sale won", { stageSince: NOW - 30 * DAY });
  const theirs = deal("Appointment held", { stageSince: NOW - 30 * DAY, rep: "D. Okafor" });
  const stale = staleDeals([exactly, almost, old, lost, won, theirs], "A. Mercer", NOW);
  assert.deepEqual(
    stale.map((s) => [s.deal.id, s.days]),
    [
      [old.id, 20],
      [exactly.id, 14],
    ],
  );
});

test("commission: open deals and wins at the per-sale rate; nothing open is zero", () => {
  const deals = [
    deal("Appointment booked"),
    deal("Potential sale"),
    deal("Sale won"),
    deal("Appointment held", { lost: { at: NOW, by: "A. Mercer" } }),
    deal("Appointment held", { rep: "K. Ellery" }),
  ];
  assert.equal(commissionPipeline(deals, "A. Mercer", 3000), 6000);
  assert.equal(commissionPipeline(deals, "K. Ellery", 3000), 3000);
  assert.equal(commissionPipeline([], "A. Mercer", 3000), 0);
  assert.equal(commissionEarned(7, 3000), 21000);
  assert.equal(commissionEarned(-1, 3000), 0);
});

test("leads: the rep's row, or zeros for a rep with none", () => {
  assert.deepEqual(leadsFor("A. Mercer"), [6, 4, 3, 2]);
  assert.deepEqual(leadsFor("Nobody"), [0, 0, 0, 0]);
});

test("percent rounds to a whole number", () => {
  assert.equal(percent(2 / 3), "67%");
  assert.equal(percent(0), "0%");
});
```

- [ ] **Step 5: Run the tests to see them fail**

Run: `npm test`
Expected: FAIL, `Cannot find module` for `./progress`.

- [ ] **Step 6: Write the rules** `src/components/modules/sales/progress/progress.ts`

```ts
/**
 * Sales progress rules, pure (no React). What My progress, the Sales portal's
 * Overview, Team's commission column and Jarvis quote. Every figure is for
 * one rep, from the live deals in the Sales store.
 */
import {
  PIPELINE_STAGES,
  SALES_WON_QTD,
  STAGE_REPORT_DEALS,
  STAGE_REPORT_LEADS,
  isOpenDeal,
  seedDeals,
  type PipelineDeal,
  type PipelineStage,
} from "../data";
import { COMMISSION_PER_SALE, STALE_DAYS, type ForecastWeek } from "./data";

const DAY = 86_400_000;

/** The board as seeded. Seed stages don't depend on the clock, so any `now` gives the same stages. */
const SEED_BOARD = seedDeals(0);

const wonBy = (deals: readonly PipelineDeal[], rep: string) =>
  deals.filter((d) => d.rep === rep && !d.lost && d.stage === "Sale won").length;

/** Deals the rep has moved to Sale won since the board was seeded, net of any moved back out. Never below zero. */
export function wonInSession(deals: readonly PipelineDeal[], seed: readonly PipelineDeal[], rep: string): number {
  return Math.max(0, wonBy(deals, rep) - wonBy(seed, rep));
}

/** Sales won month and quarter to date: HubSpot's figure for the rep (sample) plus this session's wins. */
export function wonToDate(rep: string, inSession: number): { month: number; quarter: number } {
  const month = STAGE_REPORT_DEALS.find(([r]) => r === rep)?.[1][3] ?? 0;
  const quarter = SALES_WON_QTD.find(([r]) => r === rep)?.[1] ?? 0;
  return { month: month + inSession, quarter: quarter + inSession };
}

/** `wonToDate` for the live board. */
export function wonSoFar(deals: readonly PipelineDeal[], rep: string): { month: number; quarter: number } {
  return wonToDate(rep, wonInSession(deals, SEED_BOARD, rep));
}

export interface TargetProgress {
  won: number;
  /** 0 when there's no target. */
  target: number;
  /** won ÷ target, capped at 1. Null with no target: draw no bar. */
  ratio: number | null;
  hit: boolean;
}

export function wonVsTarget(won: number, target: number): TargetProgress {
  if (!(target > 0)) return { won, target: 0, ratio: null, hit: false };
  return { won, target, ratio: Math.min(1, won / target), hit: won >= target };
}

/** Weeks in a row, counted back from the latest, that the rep signed within one of their forecast. */
export function forecastStreak(weeks: readonly ForecastWeek[]): number {
  let n = 0;
  for (let i = weeks.length - 1; i >= 0 && Math.abs(weeks[i].signed - weeks[i].forecast) <= 1; i--) n++;
  return n;
}

export interface FunnelStep {
  stage: PipelineStage;
  /** The rep's deals in this stage now. Lost deals excluded. */
  now: number;
  /** Deals that reached this stage: each deal reaches every stage up to its own, a lost one up to where it was lost. */
  reached: number;
  /** Share of the previous step's deals that reached this one. Null for the first step, and when nothing reached the previous one. */
  conversion: number | null;
}

export function funnel(deals: readonly PipelineDeal[], rep: string): FunnelStep[] {
  const mine = deals.filter((d) => d.rep === rep).map((d) => ({ rank: PIPELINE_STAGES.indexOf(d.stage), lost: Boolean(d.lost) }));
  const reachedAt = (i: number) => mine.filter((d) => d.rank >= i).length;
  return PIPELINE_STAGES.map((stage, i) => {
    const prev = i === 0 ? 0 : reachedAt(i - 1);
    return {
      stage,
      now: mine.filter((d) => d.rank === i && !d.lost).length,
      reached: reachedAt(i),
      conversion: prev === 0 ? null : reachedAt(i) / prev,
    };
  });
}

/** HubSpot's lead statuses, in order. */
export const LEAD_STATUSES = ["New", "Attempting", "Connected", "Qualified"] as const;

/** The rep's leads per status (sample, from HubSpot), or zeros. */
export function leadsFor(rep: string): number[] {
  return STAGE_REPORT_LEADS.find(([r]) => r === rep)?.[1] ?? [0, 0, 0, 0];
}

export interface StaleDeal {
  deal: PipelineDeal;
  /** Whole days in its stage. */
  days: number;
}

/** The rep's open deals that have sat in their stage STALE_DAYS or more, longest first. Exactly STALE_DAYS counts. */
export function staleDeals(deals: readonly PipelineDeal[], rep: string, now: number): StaleDeal[] {
  return deals
    .filter((d) => d.rep === rep && isOpenDeal(d) && now - d.stageSince >= STALE_DAYS * DAY)
    .map((deal) => ({ deal, days: Math.floor((now - deal.stageSince) / DAY) }))
    .sort((a, b) => b.days - a.days);
}

/** Commission on the rep's open deals: one sale's commission each, at the placeholder rate. */
export function commissionPipeline(deals: readonly PipelineDeal[], rep: string, perSale = COMMISSION_PER_SALE): number {
  return deals.filter((d) => d.rep === rep && isOpenDeal(d)).length * perSale;
}

/** Commission on sales won, at the placeholder rate. */
export function commissionEarned(won: number, perSale = COMMISSION_PER_SALE): number {
  return Math.max(0, won) * perSale;
}

/** 0.6667 → "67%". */
export const percent = (ratio: number) => `${Math.round(ratio * 100)}%`;
```

- [ ] **Step 7: Run the tests to see them pass**

Run: `npm test`
Expected: PASS, 12 tests, 0 failures.

Run: `npx tsc --noEmit`
Expected: no output.

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json src/components/modules/sales/progress/
git commit -m "Sales progress rules and a test runner

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: One Sales store for both views

**Files:**
- Modify: `src/components/modules/sales/sales-state.tsx` (rewrite)
- Modify: `app/(dashboard)/layout.tsx`
- Modify: `src/components/modules/sales/SalesScreen.tsx`
- Modify: `src/components/modules/sales/week/MyWeek.tsx`

**Interfaces:**
- Consumes: `forecastStreak`, `FORECAST_HISTORY` (Task 1).
- Produces:
  - `SalesStateProvider({ children })`, now with no `reselect` prop.
  - `useSalesState()`, which adds `weekForecast: WeekForecast`, `setWeekForecast`, `weekSubmitted: boolean` and `setWeekSubmitted`.
  - `type WeekForecast = Record<ScorecardBuilder, string>` and `forecastTotal(f: WeekForecast): number`.
  - `type SalesScope = { kind: "team" } | { kind: "rep"; rep: string }`, `TEAM_SCOPE` and `scopeRep(scope): string | null`.
  - `SalesViewProvider({ scope, reselect, children })`, `useSalesScope(): SalesScope` and `useSalesTabReselect(): number`.

- [ ] **Step 1: Rewrite `src/components/modules/sales/sales-state.tsx`**

```tsx
"use client";

import * as React from "react";
import {
  ALL_PLANS,
  seedDeals,
  SEED_DISCOUNTS,
  SEED_LOTS,
  SEED_TEAM_TASKS,
  SEED_TODOS,
  type DiscountApproval,
  type LandLot,
  type PipelineDeal,
  type TeamTask,
  type Todo,
} from "./data";
import { LAST_WEEK_FORECAST, SCORECARD_BUILDERS, type ScorecardBuilder } from "./week/data";

/**
 * Sales' shared state: the deals, to-dos, tasks, lots, discounts and the
 * week's forecast behind both the Sales dashboard (the team's view) and the
 * Sales portal (one consultant's). The provider sits in the dashboard layout,
 * beside the Launchpad and portal stores, so a deal moved in one view is
 * moved in the other, and it all lasts until a reload, as jobs do.
 *
 * What differs between the two views (whose Sales, the rail re-click) isn't
 * state. Each screen says it with `SalesViewProvider`, below.
 */
type Setter<T> = React.Dispatch<React.SetStateAction<T>>;

/** My week's forecast per builder, as typed: an empty box is "". */
export type WeekForecast = Record<ScorecardBuilder, string>;

const initialForecast = (): WeekForecast =>
  Object.fromEntries(SCORECARD_BUILDERS.map((b) => [b, String(LAST_WEEK_FORECAST[b])])) as WeekForecast;

/** The forecast's total. An empty box counts as 0. */
export const forecastTotal = (f: WeekForecast) => SCORECARD_BUILDERS.reduce((sum, b) => sum + (Number(f[b]) || 0), 0);

interface SalesState {
  deals: PipelineDeal[];
  setDeals: Setter<PipelineDeal[]>;
  todos: Todo[];
  setTodos: Setter<Todo[]>;
  plan: string;
  setPlan: Setter<string>;
  discounts: DiscountApproval[];
  setDiscounts: Setter<DiscountApproval[]>;
  tasks: TeamTask[];
  setTasks: Setter<TeamTask[]>;
  lots: LandLot[];
  setLots: Setter<LandLot[]>;
  weekForecast: WeekForecast;
  setWeekForecast: Setter<WeekForecast>;
  weekSubmitted: boolean;
  setWeekSubmitted: Setter<boolean>;
}

const Ctx = React.createContext<SalesState | null>(null);

export function SalesStateProvider({ children }: { children: React.ReactNode }) {
  const [deals, setDeals] = React.useState<PipelineDeal[]>(() => seedDeals(Date.now()));
  const [todos, setTodos] = React.useState<Todo[]>(SEED_TODOS);
  const [plan, setPlan] = React.useState<string>(ALL_PLANS);
  const [discounts, setDiscounts] = React.useState<DiscountApproval[]>(SEED_DISCOUNTS);
  const [tasks, setTasks] = React.useState<TeamTask[]>(SEED_TEAM_TASKS);
  const [lots, setLots] = React.useState<LandLot[]>(SEED_LOTS);
  const [weekForecast, setWeekForecast] = React.useState<WeekForecast>(initialForecast);
  const [weekSubmitted, setWeekSubmitted] = React.useState(false);

  const value = React.useMemo<SalesState>(
    () => ({
      deals,
      setDeals,
      todos,
      setTodos,
      plan,
      setPlan,
      discounts,
      setDiscounts,
      tasks,
      setTasks,
      lots,
      setLots,
      weekForecast,
      setWeekForecast,
      weekSubmitted,
      setWeekSubmitted,
    }),
    [deals, todos, plan, discounts, tasks, lots, weekForecast, weekSubmitted],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSalesState(): SalesState {
  const v = React.useContext(Ctx);
  if (!v) throw new Error("useSalesState must be used inside <SalesStateProvider>");
  return v;
}

/* ── The view: whose Sales, and the rail re-click ──────────────────────── */

/** Whose Sales a screen shows: the whole team (the dashboard) or one rep (the portal). */
export type SalesScope = { kind: "team" } | { kind: "rep"; rep: string };

export const TEAM_SCOPE: SalesScope = { kind: "team" };

/** The rep a scope is limited to, or null for the team. */
export const scopeRep = (scope: SalesScope): string | null => (scope.kind === "rep" ? scope.rep : null);

interface SalesView {
  scope: SalesScope;
  /** Clicks on the rail item that is already showing. */
  reselect: number;
}

const ViewCtx = React.createContext<SalesView>({ scope: TEAM_SCOPE, reselect: 0 });

/**
 * Set by each screen around its panes. Pass a module-constant `scope`, so the
 * context doesn't change every render.
 *
 * `reselect` counts clicks on the rail item that is already active. The
 * mockup's tab setter always cleared the open deal submission (`f(null)`).
 * Switching sections does that by remounting the pane; a pane that wants the
 * re-click behaviour too watches `useSalesTabReselect()`.
 */
export function SalesViewProvider({
  scope,
  reselect,
  children,
}: {
  scope: SalesScope;
  reselect: number;
  children: React.ReactNode;
}) {
  const value = React.useMemo<SalesView>(() => ({ scope, reselect }), [scope, reselect]);
  return <ViewCtx.Provider value={value}>{children}</ViewCtx.Provider>;
}

/** The nearest screen's scope: the team outside any screen. */
export function useSalesScope(): SalesScope {
  return React.useContext(ViewCtx).scope;
}

/** Bumps each time the rail item already showing is clicked. 0 outside a Sales screen. */
export function useSalesTabReselect(): number {
  return React.useContext(ViewCtx).reselect;
}
```

- [ ] **Step 2: Mount the store in `app/(dashboard)/layout.tsx`**

Replace the whole file with:

```tsx
import { AppShell } from "@/components/shell/AppShell";
import { LaunchpadProvider } from "@/state/launchpad-store";
import { PortalProvider } from "@/state/portal-store";
import { SalesStateProvider } from "@/components/modules/sales/sales-state";

/**
 * Every Launchpad screen shares this layout. It stays mounted across
 * navigations, so the store (jobs, audit log, notifications) survives moving
 * between modules. The portals (Client, Developer) live here too, so what a
 * builder sends a client in one portal is waiting in the other. Sales' deals,
 * to-dos and lots live here as well, so the Sales dashboard and the Sales
 * portal show the same board.
 */
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <LaunchpadProvider>
      <PortalProvider>
        <SalesStateProvider>
          <AppShell>{children}</AppShell>
        </SalesStateProvider>
      </PortalProvider>
    </LaunchpadProvider>
  );
}
```

- [ ] **Step 3: Point `SalesScreen.tsx` at the view provider**

In `src/components/modules/sales/SalesScreen.tsx`, replace:

```tsx
import { SalesStateProvider } from "./sales-state";
```

with:

```tsx
import { SalesViewProvider, TEAM_SCOPE } from "./sales-state";
```

Replace:

```tsx
    <SalesStateProvider reselect={reselect}>
```

with:

```tsx
    <SalesViewProvider scope={TEAM_SCOPE} reselect={reselect}>
```

and the closing `</SalesStateProvider>` with `</SalesViewProvider>`.

- [ ] **Step 4: Move My week's forecast into the store**

In `src/components/modules/sales/week/MyWeek.tsx`, replace:

```tsx
import { LAST_WEEK, LAST_WEEK_FORECAST, SCORECARD_BUILDERS, SIGNED_THIS_WEEK, type ScorecardBuilder } from "./data";

type Forecast = Record<ScorecardBuilder, string>;

const initialForecast = (): Forecast =>
  Object.fromEntries(SCORECARD_BUILDERS.map((b) => [b, String(LAST_WEEK_FORECAST[b])])) as Forecast;
```

with:

```tsx
import { LAST_WEEK, SCORECARD_BUILDERS, SIGNED_THIS_WEEK, type ScorecardBuilder } from "./data";
import { forecastTotal, useSalesState } from "../sales-state";
import { FORECAST_HISTORY } from "../progress/data";
import { forecastStreak } from "../progress/progress";
```

Replace:

```tsx
  const [forecast, setForecast] = React.useState<Forecast>(initialForecast);
  const [submitted, setSubmitted] = React.useState(false);

  const totalSigned = SCORECARD_BUILDERS.reduce((sum, b) => sum + SIGNED_THIS_WEEK[b], 0);
  const totalForecast = SCORECARD_BUILDERS.reduce((sum, b) => sum + (Number(forecast[b]) || 0), 0);
```

with:

```tsx
  // In the Sales store, so the portal's Overview reads what the rep submitted.
  const {
    weekForecast: forecast,
    setWeekForecast: setForecast,
    weekSubmitted: submitted,
    setWeekSubmitted: setSubmitted,
  } = useSalesState();
  const streak = forecastStreak(FORECAST_HISTORY);

  const totalSigned = SCORECARD_BUILDERS.reduce((sum, b) => sum + SIGNED_THIS_WEEK[b], 0);
  const totalForecast = forecastTotal(forecast);
```

Replace:

```tsx
                signed <strong className="font-semibold tabular-nums">{LAST_WEEK.signed}</strong>. Your forecasts have
                been within one for six weeks running.
```

with:

```tsx
                signed <strong className="font-semibold tabular-nums">{LAST_WEEK.signed}</strong>.{" "}
                {streak > 1
                  ? `Your forecasts have been within one for ${streak} weeks running.`
                  : streak === 1
                    ? "That's within one."
                    : "That's more than one out."}
```

If nothing else in the file uses `React.`, delete `import * as React from "react";`. `ScorecardBuilder` is still used by `step`.

- [ ] **Step 5: Type-check and test**

Run: `npx tsc --noEmit`
Expected: no output.

Run: `npm test`
Expected: PASS.

- [ ] **Step 6: Check the Sales dashboard still works**

Run `npx next dev -p 3200` in the worktree, in the background. In the browser:

1. `http://localhost:3200/sales?tab=pipeline`: drag a deal one column. Open Operations from Switch view, then come back to Sales › Pipeline. The deal is still moved. Before this task it reset.
2. `/sales?tab=week`: change a forecast box. Go to Pipeline and back. The value is kept.
3. `/sales?tab=submissions`: open a submission, then click "My Deal Submissions" in the rail again. It closes, as before.
4. The console shows no errors and no hydration warning.

- [ ] **Step 7: Commit**

```bash
git add src/components/modules/sales/sales-state.tsx "app/(dashboard)/layout.tsx" src/components/modules/sales/SalesScreen.tsx src/components/modules/sales/week/MyWeek.tsx
git commit -m "Share the Sales store across the layout; add the Sales view scope

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Rep scope in Pipeline, the deal dialog and Clients; the team's Overview

**Files:**
- Create: `src/components/modules/sales/clients/group-by-rep.ts`
- Test: `src/components/modules/sales/clients/group-by-rep.test.ts`
- Modify: `src/components/modules/sales/clients/MyClients.tsx` (rewrite)
- Modify: `src/components/modules/sales/pipeline/Pipeline.tsx`
- Modify: `src/components/modules/sales/pipeline/DealDialog.tsx`
- Modify: `src/components/modules/sales/SalesOverview.tsx` (rewrite)
- Modify: `src/components/shell/dashboards.ts` (Sales' "My clients" becomes "Clients")

**Interfaces:**
- Consumes: `scopeRep`, `useSalesScope` and `useSalesState` (Task 2); `REPS` and `FORECAST` from `sales/data.ts`; `Job` from `@/data/jobs`.
- Produces:
  - `groupByRep(jobs: readonly Job[], order: readonly string[]): RepGroup[]`, with `RepGroup = { rep: string; jobs: Job[] }` and `UNASSIGNED = "Unassigned"`.
  - `DealDialog` prop `ownerLocked?: boolean`.
  - `MyClients` renders the rep view in a rep scope and the team view otherwise.

- [ ] **Step 1: Write the failing test** `src/components/modules/sales/clients/group-by-rep.test.ts`

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import type { Job } from "@/data/jobs";
import { UNASSIGNED, groupByRep } from "./group-by-rep";

const job = (id: number, rep: string): Job => ({ id, rep, client: `Client ${id}` }) as Job;
const ORDER = ["A. Mercer", "K. Ellery", "D. Okafor"];

test("groups by rep in the given order, then other reps A to Z, then Unassigned", () => {
  const groups = groupByRep(
    [job(1, "K. Ellery"), job(2, "Z. New"), job(3, "  "), job(4, "A. Mercer"), job(5, "B. Other"), job(6, "K. Ellery")],
    ORDER,
  );
  assert.deepEqual(
    groups.map((g) => g.rep),
    ["A. Mercer", "K. Ellery", "B. Other", "Z. New", UNASSIGNED],
  );
  assert.deepEqual(
    groups[1].jobs.map((j) => j.id),
    [1, 6],
  );
  assert.deepEqual(
    groups[4].jobs.map((j) => j.id),
    [3],
  );
});

test("a rep with no clients gets no group, and no jobs means no groups", () => {
  assert.ok(!groupByRep([job(1, "A. Mercer")], ORDER).some((g) => g.rep === "D. Okafor"));
  assert.deepEqual(groupByRep([], ORDER), []);
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npm test`
Expected: FAIL, `Cannot find module` for `./group-by-rep`.

- [ ] **Step 3: Write `src/components/modules/sales/clients/group-by-rep.ts`**

```ts
import type { Job } from "@/data/jobs";

/** Where a job with no rep is filed, so it still shows. */
export const UNASSIGNED = "Unassigned";

export interface RepGroup {
  rep: string;
  jobs: Job[];
}

/**
 * The team's clients, one group per rep: `order` first (Sales' REPS), then any
 * other rep A to Z, then Unassigned. A rep with no clients is left out. Each
 * group keeps the jobs' own order.
 */
export function groupByRep(jobs: readonly Job[], order: readonly string[]): RepGroup[] {
  const repOf = (j: Job) => j.rep.trim() || UNASSIGNED;
  const others = [...new Set(jobs.map(repOf))]
    .filter((r) => r !== UNASSIGNED && !order.includes(r))
    .sort((a, b) => a.localeCompare(b));
  return [...order, ...others, UNASSIGNED]
    .map((rep) => ({ rep, jobs: jobs.filter((j) => repOf(j) === rep) }))
    .filter((g) => g.jobs.length > 0);
}
```

- [ ] **Step 4: Run it to see it pass**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Rewrite `src/components/modules/sales/clients/MyClients.tsx`**

```tsx
"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Check, Circle, Flag, Users } from "lucide-react";
import { useLaunchpad } from "@/state/launchpad-store";
import { cn } from "@/lib/utils";
import { EASE_OUT, rowDelay } from "@/lib/motion";
import type { Job } from "@/data/jobs";
import { PageHeader } from "@/components/ui/page";
import { Card, CardContent, CardHeader, CardMeta, CardTitle } from "@/components/ui/card";
import { RateBar } from "@/components/ui/progress";
import { Reveal } from "@/components/ui/reveal";
import { Avatar } from "@/components/ui/avatar";
import { EmptyState } from "@/components/ui/states";
import { REPS } from "../data";
import { scopeRep, useSalesScope, useSalesState } from "../sales-state";
import { groupByRep } from "./group-by-rep";

/**
 * Clients: the jobs from the shared store, so a milestone synced in
 * Operations moves the bar here. A card opens the job in Operations.
 *
 * In the Sales portal it's one rep's My clients: their jobs, their to-dos and
 * the tasks their manager set them. On the Sales dashboard it's the team's
 * Clients: every rep's jobs, grouped by rep.
 */
export function MyClients() {
  const rep = scopeRep(useSalesScope());
  return rep ? <RepClients rep={rep} /> : <TeamClients />;
}

function RepClients({ rep }: { rep: string }) {
  const { jobs, openJob } = useLaunchpad();
  const mine = jobs.filter((j) => j.rep === rep);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="My clients" description="You only see clients assigned to you." />
      {mine.length ? (
        <ClientGrid jobs={mine} onOpen={openJob} />
      ) : (
        <EmptyState
          icon={Users}
          title="No clients yet"
          description="Your won deals become clients here once CRM Dash Sync creates the job."
          className="rounded-xl border border-dashed border-border"
        />
      )}
      <div className="grid items-start gap-5 lg:grid-cols-2">
        <Reveal index={mine.length} className="min-w-0">
          <TodosCard />
        </Reveal>
        <Reveal index={mine.length + 1} className="min-w-0">
          <TasksCard rep={rep} />
        </Reveal>
      </div>
    </div>
  );
}

function TeamClients() {
  const { jobs, openJob } = useLaunchpad();
  const groups = groupByRep(jobs, REPS);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Clients" description="Every rep's clients in preconstruction and construction." />
      {groups.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No clients yet"
          description="Won deals become clients here once CRM Dash Sync creates the job."
          className="rounded-xl border border-dashed border-border"
        />
      ) : null}
      {groups.map((g, gi) => (
        <Reveal as="section" key={g.rep} index={gi} className="flex flex-col gap-3">
          <h2 className="flex items-center gap-2 text-[13px] font-semibold">
            <Avatar name={g.rep} size="xs" />
            {g.rep}
            <span className="font-normal text-muted-foreground tabular-nums">
              · {g.jobs.length} {g.jobs.length === 1 ? "client" : "clients"}
            </span>
          </h2>
          <ClientGrid jobs={g.jobs} onOpen={openJob} />
        </Reveal>
      ))}
    </div>
  );
}

function ClientGrid({ jobs, onOpen }: { jobs: Job[]; onOpen: (id: number) => void }) {
  return (
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {jobs.map((j, i) => {
        const complete = j.milestones.filter((m) => m.status === "done").length;
        const total = j.milestones.length || 8;
        const building = j.board === "construction";
        const pct = building ? Math.round((complete / total) * 100) : 0;
        return (
          <Reveal as="li" key={j.id} index={i}>
            <button
              type="button"
              onClick={() => onOpen(j.id)}
              className="group flex h-full w-full flex-col rounded-xl border border-border bg-card px-4 py-3.5 text-left shadow-sm transition-[transform,box-shadow,border-color] duration-200 ease-out hover:-translate-y-0.5 hover:border-tone-line hover:shadow-md focus-visible:ring-3 focus-visible:ring-ring/45 focus-visible:outline-none motion-reduce:transition-none motion-reduce:hover:translate-y-0"
            >
              <span className="flex items-baseline justify-between gap-2">
                <span className="text-[13px] font-semibold">{j.client}</span>
                <span className={cn("shrink-0 text-xs text-muted-foreground", j.jobNo ? "font-mono tabular-nums" : "italic")}>
                  {j.jobNo || "Awaiting job no"}
                </span>
              </span>
              <span className="mt-0.5 mb-2.5 text-xs text-muted-foreground">
                {j.builder} · {building ? "Under construction" : "Preconstruction"}
              </span>
              <RateBar
                value={pct / 100}
                height="h-2"
                delay={Math.min(i * 0.05, 0.3)}
                label={building ? `${complete} of ${total} milestones` : "Awaiting site start"}
                className="mt-auto"
              />
              <span className="mt-1.5 text-xs text-muted-foreground tabular-nums">
                {building ? `${complete} of ${total} milestones` : "Awaiting site start"}
              </span>
            </button>
          </Reveal>
        );
      })}
    </ul>
  );
}

function TodosCard() {
  const { todos, setTodos } = useSalesState();
  const done = todos.filter((t) => t.done).length;

  return (
    <Card>
      <CardHeader>
        <CardTitle>To-dos</CardTitle>
        <CardMeta>
          {done} of {todos.length} done
        </CardMeta>
      </CardHeader>
      <CardContent>
        <ul className="flex flex-col">
          {todos.map((t, i) => (
            <li key={t.t}>
              <button
                type="button"
                role="checkbox"
                aria-checked={t.done}
                onClick={() => setTodos((prev) => prev.map((x, xi) => (xi === i ? { ...x, done: !x.done } : x)))}
                className="group flex w-full items-center gap-2.5 rounded-md py-1.5 text-left focus-visible:ring-3 focus-visible:ring-ring/45 focus-visible:outline-none"
              >
                <span className="relative flex size-4 shrink-0 items-center justify-center" aria-hidden>
                  <AnimatePresence initial={false} mode="popLayout">
                    {t.done ? (
                      <motion.span
                        key="done"
                        className="flex"
                        initial={{ scale: 0.4, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1, transition: { duration: 0.24, ease: EASE_OUT } }}
                        exit={{ opacity: 0, transition: { duration: 0.1 } }}
                      >
                        <Check className="size-3.5 text-emerald-600 dark:text-emerald-400" strokeWidth={2.5} />
                      </motion.span>
                    ) : (
                      <motion.span
                        key="open"
                        className="flex"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1, transition: { duration: 0.18 } }}
                        exit={{ opacity: 0, transition: { duration: 0.1 } }}
                      >
                        <Circle className="size-3.5 text-subtle-foreground group-hover:text-tone-ink" />
                      </motion.span>
                    )}
                  </AnimatePresence>
                </span>
                <span
                  className={cn(
                    "text-[13px] transition-colors",
                    t.done ? "text-subtle-foreground line-through" : "text-foreground",
                  )}
                >
                  {t.t}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

/** The tasks a manager set this rep on Team. Read-only here: managers set and reassign them. */
function TasksCard({ rep }: { rep: string }) {
  const { tasks } = useSalesState();
  const reduce = useReducedMotion();
  const mine = tasks.filter((t) => t.rep === rep);
  const isOverdue = (due: string) => /overdue/i.test(due);
  const overdue = mine.filter((t) => isOverdue(t.due)).length;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tasks</CardTitle>
        <CardMeta>{mine.length ? (overdue ? `${overdue} overdue` : "none overdue") : "from your manager"}</CardMeta>
      </CardHeader>
      <CardContent>
        {mine.length === 0 ? (
          <p className="py-1.5 text-[13px] text-muted-foreground">No tasks from your manager.</p>
        ) : (
          <ul className="flex flex-col">
            {mine.map((t, i) => (
              <motion.li
                key={t.id}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: reduce ? 0 : 0.22, ease: EASE_OUT, delay: rowDelay(i, reduce) }}
                className="flex items-start gap-2.5 py-1.5"
              >
                <Flag
                  className={cn("mt-0.5 size-3.5 shrink-0", t.flag ? "text-rose-600 dark:text-rose-400" : "text-subtle-foreground")}
                  aria-hidden
                />
                <span className="min-w-0 flex-1 text-[13px]">{t.task}</span>
                <span
                  className={cn(
                    "shrink-0 text-xs tabular-nums",
                    isOverdue(t.due) ? "font-medium text-rose-700 dark:text-rose-300" : "text-muted-foreground",
                  )}
                >
                  {t.due}
                </span>
              </motion.li>
            ))}
          </ul>
        )}
        <p className="mt-2 text-xs text-subtle-foreground">Set by your manager on the Sales dashboard&apos;s Team page.</p>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 6: Scope the pipeline** in `src/components/modules/sales/pipeline/Pipeline.tsx`

Replace the import:

```tsx
import { useSalesState } from "../sales-state";
```

with:

```tsx
import { scopeRep, useSalesScope, useSalesState } from "../sales-state";
```

Replace:

```tsx
  const { deals } = useSalesState();
  const { jobs, openJob } = useLaunchpad();
```

with:

```tsx
  const { deals } = useSalesState();
  // In the Sales portal the board is one rep's: their deals only, and no owner filter.
  const rep = scopeRep(useSalesScope());
  const { jobs, openJob } = useLaunchpad();
```

Replace:

```tsx
  const onBoard = React.useMemo(() => deals.filter((d) => !d.lost), [deals]);
  const lost = React.useMemo(
    () => deals.filter((d) => d.lost).sort((a, b) => (b.lost?.at ?? 0) - (a.lost?.at ?? 0)),
    [deals],
  );
```

with:

```tsx
  const scoped = React.useMemo(() => (rep ? deals.filter((d) => d.rep === rep) : deals), [deals, rep]);
  const onBoard = React.useMemo(() => scoped.filter((d) => !d.lost), [scoped]);
  const lost = React.useMemo(
    () => scoped.filter((d) => d.lost).sort((a, b) => (b.lost?.at ?? 0) - (a.lost?.at ?? 0)),
    [scoped],
  );
```

Replace:

```tsx
        title="Deal pipeline"
        description="Every deal by stage, owned by the consultant who made it. Open a deal to update it. Won deals flow straight into Operations."
```

with:

```tsx
        title={rep ? "My pipeline" : "Deal pipeline"}
        description={
          rep
            ? "Your deals, from first appointment to sale won. Open a deal to update it. Won deals flow straight into Operations."
            : "Every deal by stage, owned by the consultant who made it. Open a deal to update it. Won deals flow straight into Operations."
        }
```

Replace the owner filter (the first `SmoothSelect` in the toolbar):

```tsx
          <SmoothSelect
            value={owner}
            onChange={setOwner}
            ariaLabel="Filter by owner"
            className="sm:w-48"
            options={[
              { value: "all", label: "All owners" },
              ...REPS.map((r) => ({
                value: r,
                label: (
                  <span className="inline-flex items-center gap-2">
                    <Avatar name={r} size="xs" />
                    {r}
                  </span>
                ),
                hint: r === CURRENT_REP ? "you" : undefined,
              })),
            ]}
          />
```

with:

```tsx
          {rep ? null : (
            <SmoothSelect
              value={owner}
              onChange={setOwner}
              ariaLabel="Filter by owner"
              className="sm:w-48"
              options={[
                { value: "all", label: "All owners" },
                ...REPS.map((r) => ({
                  value: r,
                  label: (
                    <span className="inline-flex items-center gap-2">
                      <Avatar name={r} size="xs" />
                      {r}
                    </span>
                  ),
                  hint: r === CURRENT_REP ? "you" : undefined,
                })),
              ]}
            />
          )}
```

Replace:

```tsx
        onCreate={(draft) => {
          writes.createDeal(draft);
          setView("board");
        }}
```

with:

```tsx
        ownerLocked={rep !== null}
        onCreate={(draft) => {
          writes.createDeal(rep ? { ...draft, rep } : draft);
          setView("board");
        }}
```

- [ ] **Step 7: Lock the owner in `src/components/modules/sales/pipeline/DealDialog.tsx`**

Replace:

```tsx
  onOpenJob,
}: {
```

with:

```tsx
  onOpenJob,
  ownerLocked = false,
}: {
```

Replace:

```tsx
  onOpenJob: () => void;
}) {
```

with:

```tsx
  onOpenJob: () => void;
  /** The Sales portal: the deal stays the rep's. Managers reassign from the Sales dashboard. */
  ownerLocked?: boolean;
}) {
```

Replace both occurrences (use replace-all):

```tsx
<OwnerField id={`${formId}-rep`} value={draft.rep} onChange={(v) => set("rep", v)} />
```

with:

```tsx
<OwnerField id={`${formId}-rep`} value={draft.rep} onChange={(v) => set("rep", v)} locked={ownerLocked} />
```

Replace the start of `OwnerField`:

```tsx
function OwnerField({ id, value, onChange }: { id: string; value: string; onChange: (v: string) => void }) {
  const reps = REPS.includes(value as (typeof REPS)[number]) ? [...REPS] : [...REPS, value];
```

with:

```tsx
function OwnerField({
  id,
  value,
  onChange,
  locked,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  locked?: boolean;
}) {
  if (locked) {
    return (
      <Field label="Owner" htmlFor={id} hint="Managers reassign deals from the Sales dashboard.">
        <Input id={id} value={value} readOnly aria-readonly className="bg-muted/40 text-muted-foreground" />
      </Field>
    );
  }
  const reps = REPS.includes(value as (typeof REPS)[number]) ? [...REPS] : [...REPS, value];
```

- [ ] **Step 8: Rewrite `src/components/modules/sales/SalesOverview.tsx` with team figures**

```tsx
"use client";

import { BadgePercent, CalendarDays, HardHat, ListTodo, MapPinned, Trophy, Users, Wallet } from "lucide-react";
import { useLaunchpad } from "@/state/launchpad-store";
import { DashboardOverview } from "../overview/DashboardOverview";
import { BUILD_HOMES, FORECAST, SALES_WON_MTD, isOpenDeal, millionsFromK, openPipelineK } from "./data";
import { useSalesState } from "./sales-state";

/** The team scorecard's last week, over every rep and builder: [signed, forecast]. */
const LAST_WEEK_TEAM = FORECAST["Last week"]
  .flatMap(([, cells]) => cells)
  .reduce<[number, number]>(([s, f], [cs, cf]) => [s + cs, f + cf], [0, 0]);

/**
 * Sales › Overview: the team's figures. Deals, tasks, lots and discounts come
 * from the shared Sales store and clients from the Launchpad's jobs, so moving
 * a deal or approving a discount shows here at once. A consultant's own
 * figures are on the Sales portal's Overview.
 */
export function SalesOverview() {
  const { jobs } = useLaunchpad();
  const { deals, tasks, lots, discounts } = useSalesState();

  const open = deals.filter(isOpenDeal).length;
  const flagged = tasks.filter((t) => t.flag);
  const overdue = flagged.filter((t) => /overdue/i.test(t.due)).length;
  const [signed, forecast] = LAST_WEEK_TEAM;
  const nearing = BUILD_HOMES.filter((h) => h.pct >= 90);
  const building = jobs.filter((j) => j.board === "construction").length;
  const count = (s: string) => lots.filter((l) => l.status === s).length;
  const requested = discounts.reduce((n, d) => n + d.discount, 0);

  return (
    <DashboardOverview
      title="Sales overview"
      description="The team's pipeline, sales and follow-ups."
      headline={[
        { label: "Pipeline value", value: millionsFromK(openPipelineK(deals)), sub: `${open} open deals`, icon: Wallet, to: "sales:pipeline" },
        { label: "Sales won", value: SALES_WON_MTD, sub: "August to date", icon: Trophy, to: "sales:team" },
        { label: "Signed last week", value: `${signed} of ${forecast}`, sub: "team scorecard", icon: CalendarDays, to: "sales:team" },
        {
          label: "Overdue tasks",
          value: flagged.length,
          sub: flagged.length ? `${overdue} overdue · ${flagged.length - overdue} due today` : "nothing overdue",
          icon: ListTodo,
          tone: flagged.length ? "pending" : "ok",
          to: "sales:team",
        },
      ]}
      moreLabel="More from each section"
      more={[
        {
          label: "Under construction",
          value: BUILD_HOMES.length,
          sub: nearing.length ? `key handover ${nearing[0].eta}` : "none near handover",
          icon: HardHat,
          to: "sales:build",
        },
        { label: "Clients", value: jobs.length, sub: `${building} in construction`, icon: Users, to: "sales:clients" },
        { label: "Lots available", value: count("available"), sub: `${count("hold")} on hold · ${count("sold")} sold`, icon: MapPinned, to: "sales:land" },
        {
          label: "Discounts to approve",
          value: discounts.length,
          sub: discounts.length ? `$${(requested / 1e3).toFixed(1)}k requested` : "none waiting",
          icon: BadgePercent,
          tone: discounts.length ? "pending" : "ok",
          to: "sales:team",
        },
      ]}
    />
  );
}
```

- [ ] **Step 9: Rename the rail item** in `src/components/shell/dashboards.ts`

Replace:

```ts
      tab("sales", "clients", "My clients", Users),
```

with:

```ts
      tab("sales", "clients", "Clients", Users),
```

- [ ] **Step 10: Type-check, test, look**

Run: `npx tsc --noEmit` (expected: no output) and `npm test` (expected: PASS).

With the dev server on :3200:

1. `/sales?tab=clients` reads "Clients", with three rep groups: A. Mercer, K. Ellery and D. Okafor, each headed with its count. There are no to-dos or tasks.
2. `/sales` Overview shows "Signed last week · 12 of 22 · team scorecard" and a "Clients" card. Every card opens its section.
3. `/sales?tab=pipeline` is unchanged: the owner filter is there and the owner field can be edited.
4. Light and dark, 375px and desktop: the group headings don't wrap badly.

- [ ] **Step 11: Commit**

```bash
git add src/components/modules/sales/clients/ src/components/modules/sales/pipeline/Pipeline.tsx src/components/modules/sales/pipeline/DealDialog.tsx src/components/modules/sales/SalesOverview.tsx src/components/shell/dashboards.ts
git commit -m "Sales: rep scope for the board and clients; the team's Clients and Overview

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: My progress, Team's commission column and a stale seed deal

**Files:**
- Create: `src/hooks/useNow.ts`
- Create: `src/components/modules/consultant/MyProgress.tsx`
- Modify: `src/components/modules/sales/data.ts` (one seed deal)
- Modify: `src/components/modules/sales/team/Team.tsx`

**Interfaces:**
- Consumes: everything Task 1 produces; `useSalesState`, `useSalesScope`, `scopeRep` and `forecastTotal` (Task 2); `aud` from `@/lib/utils` (`aud(4800)` → `"$4,800"`).
- Produces: `MyProgress()`, which takes no props and reads the scope; `useNow(everyMs?: number): number | null`. The code is the same as the Meeting 2 plan's Task 2, so whichever lands second merges cleanly.

- [ ] **Step 1: Write `src/hooks/useNow.ts`**

```ts
"use client";

import * as React from "react";

/**
 * The current time, re-read every `everyMs`. Null until mounted, so the server
 * and the browser render the same first frame; render time-based content only
 * once it is a number.
 */
export function useNow(everyMs = 30_000): number | null {
  const [now, setNow] = React.useState<number | null>(null);
  React.useEffect(() => {
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), everyMs);
    return () => window.clearInterval(id);
  }, [everyMs]);
  return now;
}
```

- [ ] **Step 2: Add A. Mercer's stale deal** to `seedDeals` in `src/components/modules/sales/data.ts`

Deal number 1041 is unused; check with `grep -n "no: 1041" src/components/modules/sales/data.ts`, which should return nothing. Replace:

```ts
    {
      id: "d-tran",
```

with:

```ts
    {
      id: "d-lindqvist",
      no: 1041,
      stage: "Appointment held",
      client: "M. Lindqvist",
      suburb: "Byford",
      value: "$548k",
      rep: "A. Mercer",
      priority: "low",
      pkg: "The Marlow · Move Homes",
      notes: "Second home buyers. Liked the Marlow at the display; waiting on a bank valuation before going further.",
      nextStep: "Follow up on the valuation",
      createdAt: ago(24 * DAY),
      // Well past the 14-day stale line, so My progress has one to show.
      stageSince: ago(17 * DAY),
      updates: [up("A. Mercer", ago(17 * DAY), "Appointment held at the Byford display. Waiting on their bank valuation.")],
      history: [
        ev("A. Mercer", ago(24 * DAY), "created"),
        moved("A. Mercer", ago(17 * DAY), "Appointment booked", "Appointment held"),
      ],
    },
    {
      id: "d-tran",
```

Run: `npm test`
Expected: PASS. Task 1's seed tests don't depend on this deal: it isn't in Sale won.

- [ ] **Step 3: Write `src/components/modules/consultant/MyProgress.tsx`**

```tsx
"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import { BadgeDollarSign, CalendarCheck, Check, Filter, Hourglass, Trophy } from "lucide-react";
import { aud } from "@/lib/utils";
import { EASE_OUT, rowDelay } from "@/lib/motion";
import { useNow } from "@/hooks/useNow";
import { hrefForKey } from "@/components/shell/dashboards";
import { PageHeader } from "@/components/ui/page";
import { Card, CardContent, CardHeader, CardMeta, CardTitle } from "@/components/ui/card";
import { Pill } from "@/components/ui/pill";
import { RateBar } from "@/components/ui/progress";
import { CountUp } from "@/components/ui/count-up";
import { Reveal } from "@/components/ui/reveal";
import { Dash, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CURRENT_REP, isOpenDeal, type PipelineDeal } from "../sales/data";
import { SIGNED_THIS_WEEK } from "../sales/week/data";
import { forecastTotal, scopeRep, useSalesScope, useSalesState } from "../sales/sales-state";
import { COMMISSION_PER_SALE, FORECAST_HISTORY, MONTH_TARGET, QUARTER_TARGET, STALE_DAYS } from "../sales/progress/data";
import {
  LEAD_STATUSES,
  commissionEarned,
  commissionPipeline,
  forecastStreak,
  funnel,
  leadsFor,
  percent,
  staleDeals,
  wonSoFar,
  wonVsTarget,
  type StaleDeal,
  type TargetProgress,
} from "../sales/progress/progress";

const signedThisWeek = Object.values(SIGNED_THIS_WEEK).reduce((a, b) => a + b, 0);

/**
 * Sales portal › My progress: how one consultant is tracking. Sales won
 * against target, forecast accuracy, their funnel with stale deals, and
 * commission. Deals are live from the Sales store; targets, the forecast
 * history and the commission rate are placeholders (sales/progress/data.ts).
 */
export function MyProgress() {
  const rep = scopeRep(useSalesScope()) ?? CURRENT_REP;
  const { deals, weekForecast } = useSalesState();
  const now = useNow();
  const won = wonSoFar(deals, rep);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="My progress"
        description="How you're tracking: sales against target, your forecasts, your funnel and your commission."
      />
      <div className="grid items-start gap-5 lg:grid-cols-2">
        <Reveal index={0} className="min-w-0">
          <TargetCard month={wonVsTarget(won.month, MONTH_TARGET)} quarter={wonVsTarget(won.quarter, QUARTER_TARGET)} />
        </Reveal>
        <Reveal index={1} className="min-w-0">
          <ForecastCard signed={signedThisWeek} forecast={forecastTotal(weekForecast)} />
        </Reveal>
        <Reveal index={2} className="min-w-0">
          <FunnelCard deals={deals} rep={rep} stale={now === null ? null : staleDeals(deals, rep, now)} />
        </Reveal>
        <Reveal index={3} className="min-w-0">
          <CommissionCard deals={deals} rep={rep} quarterWon={won.quarter} />
        </Reveal>
      </div>
    </div>
  );
}

function TargetCard({ month, quarter }: { month: TargetProgress; quarter: TargetProgress }) {
  return (
    <Card>
      <CardHeader>
        <Trophy className="size-3.5 text-tone-ink" aria-hidden />
        <CardTitle as="h3" className="text-sm">
          Sales won vs target
        </CardTitle>
        <CardMeta>HubSpot · sample targets</CardMeta>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <TargetRow label="This month" period="August to date" progress={month} delay={0} />
        <TargetRow label="This quarter" period="Quarter to date" progress={quarter} delay={0.08} />
        <p className="text-xs text-subtle-foreground">
          Targets are placeholders until Sean O&apos;Neill sets them. A deal you move to Sale won counts straight away.
        </p>
      </CardContent>
    </Card>
  );
}

function TargetRow({ label, period, progress, delay }: { label: string; period: string; progress: TargetProgress; delay: number }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className="text-[13px] font-semibold">{label}</span>
        <span className="text-xs text-muted-foreground">{period}</span>
        <span className="ml-auto text-[13px] tabular-nums">
          <span className="font-semibold">
            <CountUp value={progress.won} />
          </span>
          {progress.target ? <span className="text-muted-foreground"> of {progress.target}</span> : null}
        </span>
        {progress.hit ? (
          <Pill tone="ok" icon={Check}>
            Target hit
          </Pill>
        ) : null}
      </div>
      {progress.ratio === null ? null : (
        <RateBar
          value={progress.ratio}
          tone={progress.hit ? "ok" : "tone"}
          height="h-2"
          delay={delay}
          label={`${progress.won} of ${progress.target} sales`}
        />
      )}
    </div>
  );
}

function ForecastCard({ signed, forecast }: { signed: number; forecast: number }) {
  const reduce = useReducedMotion();
  const streak = forecastStreak(FORECAST_HISTORY);
  const scale = Math.max(1, ...FORECAST_HISTORY.flatMap((w) => [w.forecast, w.signed]));

  return (
    <Card>
      <CardHeader>
        <CalendarCheck className="size-3.5 text-tone-ink" aria-hidden />
        <CardTitle as="h3" className="text-sm">
          Forecast accuracy
        </CardTitle>
        <CardMeta>
          {streak ? `Within one for ${streak} ${streak === 1 ? "week" : "weeks"} running` : "More than one out last week"}
        </CardMeta>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <p className="rounded-lg border border-tone-line bg-tone-soft px-3 py-2.5 text-xs leading-relaxed">
          This week so far: <strong className="font-semibold tabular-nums">{signed}</strong> signed against your forecast of{" "}
          <strong className="font-semibold tabular-nums">{forecast}</strong>.
        </p>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-muted-foreground/40" aria-hidden />
            Forecast
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-tone-strong" aria-hidden />
            Signed
          </span>
        </div>
        <ul className="flex flex-col gap-2.5">
          {FORECAST_HISTORY.map((w, i) => {
            const off = Math.abs(w.signed - w.forecast) > 1;
            return (
              <motion.li
                key={w.weekEnding}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: reduce ? 0 : 0.22, ease: EASE_OUT, delay: rowDelay(i, reduce) }}
                className="grid grid-cols-[4.5rem_minmax(0,1fr)_3.5rem] items-center gap-x-3 gap-y-1"
              >
                <span className="row-span-2 text-xs text-muted-foreground">w/e {w.weekEnding}</span>
                <RateBar value={w.forecast / scale} tone="neutral" delay={0.05 * i} label={`Forecast ${w.forecast}`} />
                <span className="row-span-2 text-right text-xs tabular-nums">
                  <span className="font-semibold">{w.signed}</span> of {w.forecast}
                </span>
                <RateBar value={w.signed / scale} tone={off ? "problem" : "tone"} delay={0.05 * i + 0.03} label={`Signed ${w.signed}`} />
              </motion.li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}

function FunnelCard({ deals, rep, stale }: { deals: PipelineDeal[]; rep: string; stale: StaleDeal[] | null }) {
  const steps = funnel(deals, rep);
  const leads = leadsFor(rep);

  return (
    <Card>
      <CardHeader>
        <Filter className="size-3.5 text-tone-ink" aria-hidden />
        <CardTitle as="h3" className="text-sm">
          My funnel
        </CardTitle>
        <CardMeta>HubSpot · deals live</CardMeta>
      </CardHeader>
      <CardContent className="flex min-w-0 flex-col gap-4">
        <div>
          <p className="mb-1.5 text-[10px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">Leads</p>
          <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {LEAD_STATUSES.map((s, i) => (
              <div key={s} className="rounded-lg border border-border px-2.5 py-2">
                <dt className="text-xs text-muted-foreground">{s}</dt>
                <dd className="text-base font-semibold tabular-nums">
                  <CountUp value={leads[i]} />
                </dd>
              </div>
            ))}
          </dl>
        </div>

        <Table className="text-xs">
          <TableHeader>
            <TableRow className="hover:bg-transparent dark:hover:bg-transparent">
              <TableHead className="pl-0">Deals</TableHead>
              <TableHead>Now</TableHead>
              <TableHead>Reached</TableHead>
              <TableHead className="pr-0 text-right">Conversion</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {steps.map((s) => (
              <TableRow key={s.stage}>
                <TableCell className="py-2 pl-0 font-medium whitespace-nowrap">{s.stage}</TableCell>
                <TableCell className="py-2 tabular-nums">{s.now || <Dash />}</TableCell>
                <TableCell className="py-2 tabular-nums">{s.reached || <Dash />}</TableCell>
                <TableCell className="py-2 pr-0 text-right tabular-nums">
                  {s.conversion === null ? <Dash /> : percent(s.conversion)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        <StaleList stale={stale} />
      </CardContent>
    </Card>
  );
}

/** Reads the clock, so it fills in after mount (`stale` is null until then). */
function StaleList({ stale }: { stale: StaleDeal[] | null }) {
  const reduce = useReducedMotion();
  return (
    <div>
      <p className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
        <Hourglass className="size-3" aria-hidden /> Stale: {STALE_DAYS}+ days in a stage
      </p>
      {stale === null ? (
        <div className="h-9 animate-pulse rounded-lg bg-muted motion-reduce:animate-none" aria-hidden />
      ) : stale.length === 0 ? (
        <p className="text-[13px] text-muted-foreground">Nothing stale. Every open deal moved in the last {STALE_DAYS} days.</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {stale.map(({ deal, days }, i) => (
            <motion.li
              key={deal.id}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: reduce ? 0 : 0.22, ease: EASE_OUT, delay: rowDelay(i, reduce) }}
            >
              <Link
                href={hrefForKey("consultant:pipeline")}
                className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-[13px] transition-colors hover:border-tone-line hover:bg-tone-soft/50 focus-visible:ring-3 focus-visible:ring-ring/45 focus-visible:outline-none"
              >
                <span className="min-w-0 flex-1 truncate font-medium">{deal.client}</span>
                <span className="shrink-0 text-xs text-muted-foreground">{deal.stage}</span>
                <span className="shrink-0 text-xs font-semibold text-amber-700 tabular-nums dark:text-amber-300">{days} days</span>
              </Link>
            </motion.li>
          ))}
        </ul>
      )}
    </div>
  );
}

function CommissionCard({ deals, rep, quarterWon }: { deals: PipelineDeal[]; rep: string; quarterWon: number }) {
  const open = deals.filter((d) => d.rep === rep && isOpenDeal(d)).length;

  return (
    <Card>
      <CardHeader>
        <BadgeDollarSign className="size-3.5 text-tone-ink" aria-hidden />
        <CardTitle as="h3" className="text-sm">
          Commission
        </CardTitle>
        <Pill tone="neutral">Placeholder rate</Pill>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <dl className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-border px-3 py-2.5">
            <dt className="text-xs text-muted-foreground">Pipeline</dt>
            <dd className="font-heading text-xl font-bold tabular-nums">
              <CountUp value={aud(commissionPipeline(deals, rep))} />
            </dd>
            <dd className="text-xs text-muted-foreground tabular-nums">
              {open} open {open === 1 ? "deal" : "deals"} × {aud(COMMISSION_PER_SALE)}
            </dd>
          </div>
          <div className="rounded-lg border border-border px-3 py-2.5">
            <dt className="text-xs text-muted-foreground">Earned this quarter</dt>
            <dd className="font-heading text-xl font-bold tabular-nums">
              <CountUp value={aud(commissionEarned(quarterWon))} />
            </dd>
            <dd className="text-xs text-muted-foreground tabular-nums">
              {quarterWon} {quarterWon === 1 ? "sale" : "sales"} × {aud(COMMISSION_PER_SALE)}
            </dd>
          </div>
        </dl>
        <p className="text-xs text-subtle-foreground">
          A flat {aud(COMMISSION_PER_SALE)} a sale until Alison Carter confirms the commission formula. HubSpot&apos;s amount
          is the build price, not what you earn.
        </p>
      </CardContent>
    </Card>
  );
}
```

`hrefForKey("consultant:pipeline")` throws until Task 5 registers the portal. `MyProgress` isn't rendered anywhere until then, so nothing calls it.

- [ ] **Step 4: Team's commission column** in `src/components/modules/sales/team/Team.tsx`

Add after `import { WeeklyScorecard } from "./WeeklyScorecard";`:

```tsx
import { commissionPipeline } from "../progress/progress";
```

Replace:

```tsx
  const { discounts, setDiscounts, tasks, setTasks } = useSalesState();
```

with:

```tsx
  const { deals, discounts, setDiscounts, tasks, setTasks } = useSalesState();
```

Replace:

```tsx
            <ManagersOnly />
            <CardMeta>Values are commission payable, not contract value</CardMeta>
```

with:

```tsx
            <ManagersOnly />
            <Pill tone="neutral">Placeholder rate</Pill>
            <CardMeta>Values are commission payable, not contract value</CardMeta>
```

Replace:

```tsx
                {STAGE_REPORT_DEALS.map(([rep, counts, pipeline]) => (
```

with:

```tsx
                {STAGE_REPORT_DEALS.map(([rep, counts]) => (
```

Replace:

```tsx
                      {pipeline}
```

with:

```tsx
                      {aud(commissionPipeline(deals, rep))}
```

Replace the footnote's text (the existing copy has an em dash; the new copy doesn't):

```tsx
              Deals from the HubSpot sales pipeline; leads from HubSpot lead stages. Both mirrored live. Commission
              values on this card are visible to managers and leadership only — sales consultants never see them.
```

with:

```tsx
              Deals from the HubSpot sales pipeline; leads from HubSpot lead stages. Both mirrored live. The whole
              team&apos;s commission is visible to managers and leadership only; a consultant sees only their own, in the
              Sales portal.
```

`aud` here is Team's own local `const aud = (n: number) => ...` (line 48), which prints `$14,400`.

- [ ] **Step 5: Type-check and test**

Run: `npx tsc --noEmit` (expected: no output) and `npm test` (expected: PASS).

- [ ] **Step 6: Look at Team**

`/sales?tab=team` › Stage report by rep:

- The Pipeline column reads A. Mercer **$14,400**, K. Ellery **$9,600** and D. Okafor **$4,800**, with a "Placeholder rate" pill. That's 3, 2 and 1 open deals at $4,800. At $3,000 it would be $9,000, $6,000 and $3,000.
- `/sales?tab=pipeline` shows M. Lindqvist in Appointment held, "17d" in stage.

- [ ] **Step 7: Commit**

```bash
git add src/hooks/useNow.ts src/components/modules/consultant/MyProgress.tsx src/components/modules/sales/data.ts src/components/modules/sales/team/Team.tsx
git commit -m "My progress screen; Team's commission column reads the shared rule

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Register the Sales portal

**Files:**
- Modify: `src/state/launchpad-store.tsx` (`ModuleId`)
- Modify: `src/components/shell/dashboards.ts`
- Modify: `src/components/shell/dashboard-tones.ts` (comment)
- Modify: `src/components/shell/DashboardSwitchLoader.tsx` (`SHAPES`)
- Create: `app/(dashboard)/consultant/page.tsx`
- Create: `src/hooks/useGreeting.ts`
- Modify: `src/components/modules/employee/parts.tsx`, `src/components/modules/employee/EmployeeOverview.tsx`
- Create: `src/components/modules/consultant/use-changes-requested.ts`
- Create: `src/components/modules/consultant/ConsultantOverview.tsx`
- Create: `src/components/modules/consultant/ConsultantScreen.tsx`
- Create: `src/components/modules/sales/moved-tabs.ts`
- Test: `src/components/modules/sales/moved-tabs.test.ts`
- Modify: `src/components/modules/sales/SalesScreen.tsx` (rewrite)
- Modify: `src/components/modules/admin/data.ts` (blurbs, role label, Michael Fox's presence)
- Modify: `src/components/shell/assistant/jarvis-knowledge.ts`, `src/components/shell/assistant/JarvisBubble.tsx`

Every file here changes together. `ModuleId` is the key of `SHAPES`, Admin's `BLURBS`, Jarvis's `JARVIS` and `FEATURED`, so `tsc` fails until all of them have the new key. Admin's presence seed calls `hrefForKey` when the module loads, so removing `sales:submissions` breaks every page until Michael Fox's entry moves.

**Interfaces:**
- Consumes: `MyProgress` (Task 4); `SalesViewProvider`, `scopeRep` and `forecastTotal` (Task 2); `ownerLocked` on the scoped `Pipeline` (Task 3); `wonSoFar`, `wonVsTarget`, `commissionPipeline`, `commissionEarned`, `staleDeals`, `MONTH_TARGET`, `QUARTER_TARGET`, `COMMISSION_PER_SALE` and `STALE_DAYS` (Task 1).
- Produces: the `consultant` dashboard and its route; rail keys `consultant:overview|pipeline|clients|week|progress|submissions`; `useGreeting()` at `@/hooks/useGreeting`; `useChangesRequested(): number`; `portalHrefFor(tab: string | null): string | null`; `JarvisContext.deals`.

- [ ] **Step 1: Write the failing test** `src/components/modules/sales/moved-tabs.test.ts`

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { portalHrefFor } from "./moved-tabs";

test("an old link to a section that moved lands on the portal's", () => {
  assert.equal(portalHrefFor("week"), "/consultant?tab=week");
  assert.equal(portalHrefFor("submissions"), "/consultant?tab=submissions");
});

test("sections that stayed, no tab, and object keys don't redirect", () => {
  assert.equal(portalHrefFor("pipeline"), null);
  assert.equal(portalHrefFor("clients"), null);
  assert.equal(portalHrefFor(null), null);
  assert.equal(portalHrefFor("toString"), null);
});
```

Run: `npm test`
Expected: FAIL, `Cannot find module` for `./moved-tabs`.

- [ ] **Step 2: Write `src/components/modules/sales/moved-tabs.ts`**

```ts
/**
 * Sections that moved from the Sales dashboard to the Sales portal. An old link
 * to one (a bookmark, a shared URL) lands on the portal's, not on Overview.
 */
const MOVED_TO_PORTAL: Record<string, string> = {
  week: "/consultant?tab=week",
  submissions: "/consultant?tab=submissions",
};

export function portalHrefFor(tab: string | null): string | null {
  return tab !== null && Object.hasOwn(MOVED_TO_PORTAL, tab) ? MOVED_TO_PORTAL[tab] : null;
}
```

Run: `npm test`
Expected: PASS.

- [ ] **Step 3: Add the module id** in `src/state/launchpad-store.tsx`

Replace:

```ts
  | "developer"
  | "employee";
```

with:

```ts
  | "developer"
  | "employee"
  | "consultant";
```

- [ ] **Step 4: Register the portal** in `src/components/shell/dashboards.ts`

In the lucide import, replace `  Briefcase,` with:

```ts
  Briefcase,
  BriefcaseBusiness,
```

After `import { PAY_RUN } from "@/components/modules/accounting/data";` add:

```ts
import { CURRENT_REP } from "@/components/modules/sales/data";
```

In the doc comment above `DashboardSpace`, replace:

```ts
 * department. A portal's rail has its own Switch view listing only the portals
```

with:

```ts
 * department. The fourth is the Sales portal: one consultant's own pipeline,
 * clients, week, progress and deal submissions, where the Sales dashboard is
 * the team's. A portal's rail has its own Switch view listing only the portals
```

In the Sales entry, delete these two lines:

```ts
      tab("sales", "week", "My week", CalendarDays),
```

```ts
      tab("sales", "submissions", "My Deal Submissions", FileCheck2),
```

After the Employee entry's closing `},` (the one after `tab("employee", "department", "Department", Users),\n    ],`), add:

```ts
  {
    id: "consultant",
    label: "Sales",
    title: "Sales portal",
    href: "/consultant",
    icon: BriefcaseBusiness,
    // Locale Homes is the brand a consultant sells for.
    tone: "haven",
    space: "portal",
    persona: { name: CURRENT_REP, role: "Sales consultant · staff preview" },
    defaults: { tab: "overview" },
    // The sections that said "My" on the Sales dashboard, which is now the
    // team's view, plus the consultant's progress.
    items: [
      overview("consultant"),
      tab("consultant", "pipeline", "My pipeline", Columns3),
      tab("consultant", "clients", "My clients", Users),
      tab("consultant", "week", "My week", CalendarDays),
      tab("consultant", "progress", "My progress", Target),
      tab("consultant", "submissions", "My Deal Submissions", FileCheck2),
    ],
  },
```

- [ ] **Step 5: Tones comment and switch loader**

In `src/components/shell/dashboard-tones.ts`, replace:

```ts
 *   haven     Locale Homes      — Home, Operations, Sales; the Client portal
```

with:

```ts
 *   haven     Locale Homes      — Home, Operations, Sales; the Client and Sales portals
```

In `src/components/shell/DashboardSwitchLoader.tsx`, replace:

```ts
  employee: OVERVIEW,
};
```

with:

```ts
  employee: OVERVIEW,
  consultant: OVERVIEW,
};
```

- [ ] **Step 6: Move the greeting into `src/hooks/useGreeting.ts`**

```ts
"use client";

import * as React from "react";

const noSubscribe = () => () => {};

/**
 * "Good afternoon" on the viewer's clock (HRIS's greeting). The server can't
 * know the viewer's time, so it renders "Welcome back" and the first client
 * render swaps in the real one.
 */
export function useGreeting(): string {
  return React.useSyncExternalStore(
    noSubscribe,
    () => {
      const hour = new Date().getHours();
      return hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
    },
    () => "Welcome back",
  );
}
```

In `src/components/modules/employee/parts.tsx`:

- Delete the Greeting section: the `/* ── Greeting ───… */` banner line and everything after it up to the next banner (`/* ── Hidden values (HRIS HiddenValue) ───… */`), which stays. The deleted block is:

```tsx
const noSubscribe = () => () => {};

/**
 * "Good afternoon" on the viewer's clock (HRIS's greeting). The server can't
 * know the viewer's time, so it renders "Welcome back" and the first client
 * render swaps in the real one.
 */
export function useGreeting(): string {
  return React.useSyncExternalStore(
    noSubscribe,
    () => {
      const hour = new Date().getHours();
      return hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
    },
    () => "Welcome back",
  );
}
```

- In the file's top comment, replace `the greeting, HRIS's hidden` with `HRIS's hidden`.
- Run `grep -n "noSubscribe" src/components/modules/employee/parts.tsx`. It should return nothing.

In `src/components/modules/employee/EmployeeOverview.tsx`:

- Replace `uninvoicedWeeks, useGreeting } from "./parts";` with `uninvoicedWeeks } from "./parts";`.
- Add `import { useGreeting } from "@/hooks/useGreeting";` after `import { cn } from "@/lib/utils";`.

- [ ] **Step 7: Write `src/components/modules/consultant/use-changes-requested.ts`**

```ts
"use client";

import { useLaunchpad } from "@/state/launchpad-store";
import { isChangesRequested } from "../sales/submissions/data";
import { useLocalSubmissions } from "../sales/submissions/local-submissions";

/** Submissions in My Deal Submissions that Ops sent back: the shared Nguyen submission and any the rep started. */
export function useChangesRequested(): number {
  const { submissionStatus } = useLaunchpad();
  const local = useLocalSubmissions();
  return [submissionStatus, ...local.map((s) => s.status)].filter(isChangesRequested).length;
}
```

- [ ] **Step 8: Write `src/components/modules/consultant/ConsultantOverview.tsx`**

```tsx
"use client";

import { BadgeDollarSign, CalendarDays, FileCheck2, HardHat, ListChecks, ListTodo, Trophy, Wallet } from "lucide-react";
import { useLaunchpad } from "@/state/launchpad-store";
import { aud } from "@/lib/utils";
import { useGreeting } from "@/hooks/useGreeting";
import { DashboardOverview } from "../overview/DashboardOverview";
import { CURRENT_REP, isOpenDeal, millionsFromK, openPipelineK } from "../sales/data";
import { SIGNED_THIS_WEEK } from "../sales/week/data";
import { forecastTotal, useSalesState } from "../sales/sales-state";
import { MONTH_TARGET } from "../sales/progress/data";
import { commissionPipeline, wonSoFar, wonVsTarget } from "../sales/progress/progress";
import { useChangesRequested } from "./use-changes-requested";

const sum = (r: Record<string, number>) => Object.values(r).reduce((a, b) => a + b, 0);
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/**
 * Sales portal › Overview: one consultant's figures, each card a link to the
 * section it comes from. Deals, tasks, to-dos and the week's forecast come
 * from the shared Sales store, so a deal moved on either board shows here at
 * once.
 */
export function ConsultantOverview() {
  const rep = CURRENT_REP;
  const greeting = useGreeting();
  const { jobs } = useLaunchpad();
  const { deals, todos, tasks, weekForecast } = useSalesState();
  const changes = useChangesRequested();

  const mine = deals.filter((d) => d.rep === rep);
  const open = mine.filter(isOpenDeal).length;
  const month = wonVsTarget(wonSoFar(deals, rep).month, MONTH_TARGET);
  const flagged = tasks.filter((t) => t.rep === rep && t.flag);
  const overdue = flagged.filter((t) => /overdue/i.test(t.due)).length;
  const myJobs = jobs.filter((j) => j.rep === rep);
  const building = myJobs.filter((j) => j.board === "construction").length;
  const openTodos = todos.filter((t) => !t.done).length;

  const waiting = [
    overdue ? `${plural(overdue, "task")} ${overdue === 1 ? "is" : "are"} overdue.` : null,
    changes ? `${plural(changes, "submission")} came back with changes.` : null,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <DashboardOverview
      title={`${greeting}, ${rep}.`}
      description={waiting || "You're all caught up."}
      headline={[
        { label: "My pipeline", value: millionsFromK(openPipelineK(mine)), sub: plural(open, "open deal"), icon: Wallet, to: "consultant:pipeline" },
        {
          label: "Won this month",
          value: `${month.won} of ${MONTH_TARGET}`,
          sub: month.hit ? "target hit" : "against target",
          icon: Trophy,
          tone: month.hit ? "ok" : undefined,
          to: "consultant:progress",
        },
        {
          label: "Signed this week",
          value: `${sum(SIGNED_THIS_WEEK)} of ${forecastTotal(weekForecast)}`,
          sub: "against forecast",
          icon: CalendarDays,
          to: "consultant:week",
        },
        {
          label: "My overdue tasks",
          value: flagged.length,
          sub: flagged.length ? `${overdue} overdue · ${flagged.length - overdue} due today` : "nothing overdue",
          icon: ListTodo,
          tone: flagged.length ? "pending" : "ok",
          to: "consultant:clients",
        },
      ]}
      moreLabel="More from each section"
      more={[
        { label: "Under construction", value: building, sub: `${myJobs.length - building} in preconstruction`, icon: HardHat, to: "consultant:clients" },
        { label: "Open to-dos", value: openTodos, sub: "on My clients", icon: ListChecks, to: "consultant:clients" },
        {
          label: "Changes requested",
          value: changes,
          sub: changes ? "Ops sent back" : "none waiting",
          icon: FileCheck2,
          tone: changes ? "pending" : "ok",
          to: "consultant:submissions",
        },
        {
          label: "Commission pipeline",
          value: aud(commissionPipeline(deals, rep)),
          sub: "flat rate until Alison's formula",
          icon: BadgeDollarSign,
          sample: true,
          to: "consultant:progress",
        },
      ]}
    />
  );
}
```

- [ ] **Step 9: Write `src/components/modules/consultant/ConsultantScreen.tsx` and the route**

```tsx
"use client";

import * as React from "react";
import { useTabParam } from "@/hooks/useTabParam";
import { useNavBadge, useNavReselect } from "@/components/shell/nav-state";
import { PageContainer } from "@/components/ui/page";
import { TabPanels } from "@/components/ui/sliding-tabs";
import { CURRENT_REP } from "../sales/data";
import { SalesViewProvider, type SalesScope } from "../sales/sales-state";
import { Pipeline } from "../sales/pipeline/Pipeline";
import { MyClients } from "../sales/clients/MyClients";
import { MyWeek } from "../sales/week/MyWeek";
import { DealSubmissions } from "../sales/submissions/DealSubmissions";
import { ConsultantOverview } from "./ConsultantOverview";
import { MyProgress } from "./MyProgress";
import { useChangesRequested } from "./use-changes-requested";

const TABS = ["overview", "pipeline", "clients", "week", "progress", "submissions"] as const;

/** One consultant's Sales. A module constant, so the view context stays the same object. */
const SCOPE: SalesScope = { kind: "rep", rep: CURRENT_REP };

/**
 * The Sales portal: one consultant's own Sales, where the Sales dashboard is
 * the team's. My pipeline, My clients, My week and My Deal Submissions are the
 * Sales sections in the rep's scope, on the same store as the dashboard; the
 * Overview and My progress are the portal's own.
 *
 * Staff preview it as A. Mercer, the rep the rest of the prototype uses.
 */
export function ConsultantScreen() {
  const [tab, , dir] = useTabParam(TABS, "overview");
  const [reselect, setReselect] = React.useState(0);
  useNavReselect("consultant:", () => setReselect((n) => n + 1));
  const changes = useChangesRequested();
  useNavBadge("consultant:submissions", {
    count: changes,
    tone: "pending",
    label: changes === 1 ? "submission sent back" : "submissions sent back",
  });

  return (
    <SalesViewProvider scope={SCOPE} reselect={reselect}>
      <PageContainer>
        <TabPanels value={tab} dir={dir}>
          {tab === "overview" ? (
            <ConsultantOverview />
          ) : tab === "pipeline" ? (
            <Pipeline />
          ) : tab === "clients" ? (
            <MyClients />
          ) : tab === "week" ? (
            <MyWeek />
          ) : tab === "progress" ? (
            <MyProgress />
          ) : (
            <DealSubmissions />
          )}
        </TabPanels>
      </PageContainer>
    </SalesViewProvider>
  );
}
```

`app/(dashboard)/consultant/page.tsx`:

```tsx
import type { Metadata } from "next";
import { Suspense } from "react";
import { ScreenSkeleton } from "@/components/ui/screen-skeleton";
import { ConsultantScreen } from "@/components/modules/consultant/ConsultantScreen";

export const metadata: Metadata = { title: "Sales portal" };

export default function Page() {
  return (
    <Suspense fallback={<ScreenSkeleton tabs={false} />}>
      <ConsultantScreen />
    </Suspense>
  );
}
```

- [ ] **Step 10: Rewrite `src/components/modules/sales/SalesScreen.tsx` as the team's view**

```tsx
"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTabParam } from "@/hooks/useTabParam";
import { useNavReselect } from "@/components/shell/nav-state";
import { PageContainer } from "@/components/ui/page";
import { TabPanels } from "@/components/ui/sliding-tabs";
import { SalesViewProvider, TEAM_SCOPE } from "./sales-state";
import { Pipeline } from "./pipeline/Pipeline";
import { MyClients } from "./clients/MyClients";
import { UnderConstruction } from "./build/UnderConstruction";
import { ExclusiveLand } from "./land/ExclusiveLand";
import { Team } from "./team/Team";
import { RapidCosting } from "./costing/RapidCosting";
import { SalesOverview } from "./SalesOverview";
import { portalHrefFor } from "./moved-tabs";

const TABS = ["overview", "pipeline", "clients", "build", "costing", "land", "team"] as const;

/**
 * Sales: the team's view. An Overview (the default) and six sections in
 * `?tab=`, listed in the Sales rail with the "Open HomeScope" link. Each pane
 * renders its own PageHeader. A consultant's own Sales (My week, My Deal
 * Submissions, and the board and clients in their scope) is the Sales portal,
 * modules/consultant.
 */
export function SalesScreen() {
  const [tab, , dir] = useTabParam(TABS, "overview");
  // My week and My Deal Submissions moved to the portal: an old link follows them.
  const params = useSearchParams();
  const router = useRouter();
  const moved = portalHrefFor(params.get("tab"));
  React.useEffect(() => {
    if (moved) router.replace(moved);
  }, [moved, router]);

  // The mockup's tab setter also cleared the open submission (`f(null)`).
  // Switching sections remounts the pane, which does that; re-clicking the
  // section that is showing (in the rail) bumps this so a pane can reset
  // itself too (useSalesTabReselect).
  const [reselect, setReselect] = React.useState(0);
  useNavReselect("sales:", () => setReselect((n) => n + 1));

  return (
    <SalesViewProvider scope={TEAM_SCOPE} reselect={reselect}>
      <PageContainer>
        <TabPanels value={tab} dir={dir}>
          {tab === "overview" ? (
            <SalesOverview />
          ) : tab === "pipeline" ? (
            <Pipeline />
          ) : tab === "clients" ? (
            <MyClients />
          ) : tab === "build" ? (
            <UnderConstruction />
          ) : tab === "costing" ? (
            <RapidCosting />
          ) : tab === "land" ? (
            <ExclusiveLand />
          ) : (
            <Team />
          )}
        </TabPanels>
      </PageContainer>
    </SalesViewProvider>
  );
}
```

- [ ] **Step 11: Admin and Jarvis**

In `src/components/modules/admin/data.ts`:

- In the first import, replace `dashboardById, hrefForKey, type Dashboard` with `dashboardById, hrefForKey, spaceOf, type Dashboard`.
- In `Role`, replace `  /** "Sales". */` with `  /** "Sales", or a portal's title: "Sales portal". */`.
- In `ROLES`, replace `    label: d.label,` with:

```ts
    // A portal's role is named for the portal, so "Sales portal" and "Sales" never read the same.
    label: spaceOf(d) === "portal" ? d.title : d.label,
```

- In `BLURBS`, replace:

```ts
  sales: "Unlocks the Sales dashboard: the pipeline, clients, costing and deal submissions.",
```

with:

```ts
  sales: "Unlocks the Sales dashboard, the team's view: every rep's pipeline and clients, costing, land and Team.",
```

  and replace:

```ts
  employee: "Unlocks the Employee portal: pay week, invoices, profile and department.",
```

  with:

```ts
  employee: "Unlocks the Employee portal: pay week, invoices, profile and department.",
  consultant: "Unlocks the Sales portal: your own pipeline, clients, week, progress and deal submissions.",
```

- In `PRESENCE_SEED`, replace `  "michael-fox": { at: "sales:submissions" },` with `  "michael-fox": { at: "consultant:submissions" },`.

In `src/components/shell/assistant/jarvis-knowledge.ts`, make these edits in this order:

1. Replace the Sales data import:

```ts
import {
  SEED_DEALS,
  PIPELINE_STAGES,
  SALES_WON_QTD,
  SEED_LOTS,
  SEED_DISCOUNTS,
  HOLD_QUEUE_MAX,
} from "@/components/modules/sales/data";
```

   with:

```ts
import {
  CURRENT_REP,
  PIPELINE_STAGES,
  SALES_WON_QTD,
  SEED_LOTS,
  SEED_DISCOUNTS,
  HOLD_QUEUE_MAX,
  isOpenDeal,
  type PipelineDeal,
} from "@/components/modules/sales/data";
import { COMMISSION_PER_SALE, MONTH_TARGET, QUARTER_TARGET, STALE_DAYS } from "@/components/modules/sales/progress/data";
import {
  commissionEarned,
  commissionPipeline,
  staleDeals,
  wonSoFar,
  wonVsTarget,
  type TargetProgress,
} from "@/components/modules/sales/progress/progress";
```

2. In `JarvisContext`, after `  admin: AdminState;` add:

```ts
  /** Sales' live deals (the shared Sales store): the dashboard's board and the portal's. */
  deals: PipelineDeal[];
```

3. In `PORTAL_USING`, replace:

```ts
    keys: ["switch", "view", "client portal", "developer portal", "employee portal", "back to launchpad"],
    answer: () => ({
      text: `Use “Switch view” in the sidebar. The portals have their own: Client, Developer and Employee, plus “Back to Launchpad” for the staff dashboards. You're in the ${portal}.`,
```

   with:

```ts
    keys: ["switch", "view", "client portal", "developer portal", "employee portal", "sales portal", "back to launchpad"],
    answer: () => ({
      text: `Use “Switch view” in the sidebar. The portals have their own: Client, Developer, Employee and Sales, plus “Back to Launchpad” for the staff dashboards. You're in the ${portal}.`,
```

4. In the `sales` brief, replace:

```ts
    subtitle: "Pipeline, clients and land",
    greeting: "Ask me about your pipeline, land holds or the team's numbers.",
```

   with:

```ts
    subtitle: "The team's pipeline, clients and land",
    greeting: "Ask me about the pipeline, land holds or the team's numbers.",
```

   and replace:

```ts
        question: "What's in my pipeline?",
        keys: ["pipeline", "deals", "stage", "appointment"],
        answer: () => ({
          text: `${plural(SEED_DEALS.filter((d) => !d.lost).length, "deal")} across the pipeline:`,
          bullets: PIPELINE_STAGES.map((stage) => {
            const deals = SEED_DEALS.filter((d) => d.stage === stage && !d.lost);
```

   with:

```ts
        question: "What's in the pipeline?",
        keys: ["pipeline", "deals", "stage", "appointment"],
        answer: (ctx) => ({
          text: `${plural(ctx.deals.filter((d) => !d.lost).length, "deal")} across the pipeline:`,
          bullets: PIPELINE_STAGES.map((stage) => {
            const deals = ctx.deals.filter((d) => d.stage === stage && !d.lost);
```

5. In the `sales` brief, delete both FAQ objects whose `group` is `"My Deal Submissions"`: "Where is my deal submission?" and "Which documents does Forma need?". They move to the portal in edit 7. Replace its `fallback` with:

```ts
    fallback:
      "On Sales I can answer about the team's pipeline, what happens when a deal is won, discounts, land holds, the quarter's leaders and discounts waiting for approval.",
```

6. Run `grep -n "SEED_DEALS" src/components/shell/assistant/jarvis-knowledge.ts`. It should return nothing.

7. Replace the end of the `employee` brief:

```ts
    fallback:
      "In the Employee portal I can tell you this week's pay and your rates, which invoices are with Accounts, how to send one, and who's in your department.",
  },
};
```

   with:

```ts
    fallback:
      "In the Employee portal I can tell you this week's pay and your rates, which invoices are with Accounts, how to send one, and who's in your department.",
  },
  consultant: {
    subtitle: "Your pipeline, clients and progress",
    greeting: `Hi ${CURRENT_REP}, ask me how you're tracking against target, which of your deals have gone stale, or what your commission pipeline is.`,
    faqs: [
      {
        group: "My progress",
        question: "How am I tracking against target?",
        keys: ["target", "tracking", "on track", "how am i going", "how am i doing", "won this"],
        answer: (ctx) => {
          const won = wonSoFar(ctx.deals, CURRENT_REP);
          const month = wonVsTarget(won.month, MONTH_TARGET);
          const quarter = wonVsTarget(won.quarter, QUARTER_TARGET);
          const line = (label: string, p: TargetProgress) =>
            `${label}: ${p.won} of ${p.target}${p.hit ? ", target hit" : `, ${plural(p.target - p.won, "sale")} to go`}.`;
          return {
            text: month.hit && quarter.hit ? "You're on target for the month and the quarter:" : "Here's where you are against target:",
            bullets: [line("This month (August to date)", month), line("This quarter", quarter)],
            actions: [{ label: "Open My progress", href: "/consultant?tab=progress" }],
            source: "HubSpot · sample targets until Sean sets them",
          };
        },
      },
      {
        group: "My progress",
        question: "Which of my deals have gone stale?",
        keys: ["stale", "stuck", "sitting", "old deal", "14 days", "haven't moved"],
        answer: (ctx) => {
          const stale = staleDeals(ctx.deals, CURRENT_REP, Date.now());
          return {
            text: stale.length
              ? `${plural(stale.length, "deal")} ${stale.length === 1 ? "has" : "have"} sat in ${stale.length === 1 ? "its" : "their"} stage ${STALE_DAYS} days or more:`
              : `Nothing stale. Every one of your open deals moved in the last ${STALE_DAYS} days.`,
            bullets: stale.map(
              ({ deal, days }) =>
                `${deal.client} (${deal.suburb}, ${deal.value}): ${days} days in ${deal.stage}. Next step: ${deal.nextStep || "none set"}.`,
            ),
            actions: [{ label: "Open My pipeline", href: "/consultant?tab=pipeline" }],
            source: "HubSpot deals · live",
          };
        },
      },
      {
        group: "My progress",
        question: "What's my commission pipeline?",
        keys: ["commission", "earn", "earned", "money"],
        answer: (ctx) => {
          const open = ctx.deals.filter((d) => d.rep === CURRENT_REP && isOpenDeal(d)).length;
          const quarter = wonSoFar(ctx.deals, CURRENT_REP).quarter;
          return {
            text: `${aud(commissionPipeline(ctx.deals, CURRENT_REP))} across ${plural(open, "open deal")}, and ${aud(commissionEarned(quarter))} earned on ${plural(quarter, "sale")} this quarter.`,
            bullets: [`Both at a flat ${aud(COMMISSION_PER_SALE)} a sale until Alison Carter confirms the commission formula.`],
            actions: [{ label: "Open My progress", href: "/consultant?tab=progress" }],
            source: "Placeholder rate",
          };
        },
      },
      {
        group: "My pipeline",
        question: "What's in my pipeline?",
        keys: ["pipeline", "deals", "stage", "appointment"],
        answer: (ctx) => {
          const mine = ctx.deals.filter((d) => d.rep === CURRENT_REP && !d.lost);
          return {
            text: `${plural(mine.filter(isOpenDeal).length, "open deal")} in your pipeline:`,
            bullets: PIPELINE_STAGES.map((stage) => {
              const deals = mine.filter((d) => d.stage === stage);
              return `${stage}: ${deals.length ? deals.map((d) => `${d.client} (${d.suburb}, ${d.value})`).join(", ") : "none"}.`;
            }),
            actions: [{ label: "Open My pipeline", href: "/consultant?tab=pipeline" }],
            source: "HubSpot deals · live",
          };
        },
      },
      {
        group: "My Deal Submissions",
        question: "Where is my deal submission?",
        keys: ["submission", "nguyen", "upload"],
        answer: (ctx) => submissionAnswer(ctx, "/consultant?tab=submissions"),
      },
      {
        group: "My Deal Submissions",
        question: "Which documents does Forma need?",
        keys: ["documents", "forma", "checklist", "what do i need"],
        answer: () => ({
          text: "Forma's required documents:",
          bullets: BUILDER_CHECKLISTS.Forma.filter((d) => d.req).map((d) => `${d.name} (${d.cat}).`),
          actions: [{ label: "Start a submission", href: "/consultant?tab=submissions" }],
        }),
      },
      ...PORTAL_USING("Sales portal"),
    ],
    fallback:
      "In the Sales portal I can tell you how you're tracking against target, which of your deals have gone stale, your commission pipeline, what's in your pipeline, and where your deal submission is up to.",
  },
};
```

8. In `FEATURED`, replace:

```ts
  sales: ["What's in my pipeline?", "Which lots can I hold?", "Where is my deal submission?"],
```

   with:

```ts
  sales: ["What's in the pipeline?", "Which lots can I hold?", "Who's leading sales this quarter?"],
```

   and replace:

```ts
  employee: ["What's my pay this week?", "What are my current rates?", "Who's in my department?"],
};
```

   with:

```ts
  employee: ["What's my pay this week?", "What are my current rates?", "Who's in my department?"],
  consultant: ["How am I tracking against target?", "Which of my deals have gone stale?", "What's my commission pipeline?"],
};
```

In `src/components/shell/assistant/JarvisBubble.tsx`:

- After `import { useAdmin } from "@/components/modules/admin/admin-store";` add `import { useSalesState } from "@/components/modules/sales/sales-state";`.
- After `  const admin = useAdmin();` add `  const { deals } = useSalesState();`.
- In the `ctx` object, after `    admin,` add `    deals,`.

- [ ] **Step 12: Type-check, test, and check the portal in the browser**

Run: `npx tsc --noEmit` (expected: no output) and `npm test` (expected: PASS).

Run: `grep -rn "sales:week\|sales:submissions\|sales?tab=week\|sales?tab=submissions" src app`
Expected: only `moved-tabs.ts` and its test.

With the dev server on :3200, in light and dark, at 375px and desktop:

1. **Switch view** on the Launchpad lists Sales under Portals (and Sales under Locale Homes). Inside `/consultant` it lists only the portals and "Back to Launchpad". The rail's user card reads "A. Mercer · Sales consultant · staff preview".
2. **Overview** `/consultant`: the title is "Good …, A. Mercer." and the description is "2 tasks are overdue." The cards read:
   - My pipeline: $1.79m, 3 open deals.
   - Won this month: 1 of 2.
   - Signed this week: 4 of 7.
   - My overdue tasks: 2.
   - Commission pipeline: "Sample · flat rate until Alison's formula".
   
   Every card opens its section. The console shows no hydration warning.
3. **My pipeline:** only Whitmore, Osei and Lindqvist. There's no owner filter. Open a deal: Owner is read-only with the hint. New deal: the owner is A. Mercer, read-only.
4. **Shared board (Review Focus 1):** drag Whitmore to Sale won. Overview reads "Won this month 2 of 2", in green, "target hit". Open `/sales?tab=pipeline`: Whitmore is in Sale won. Undo inside the toast window: both go back. On `/sales?tab=pipeline`, reassign Osei to K. Ellery: it leaves My pipeline, and My progress's commission drops by one sale (Review Focus 5).
5. **My clients:** A. Mercer's jobs, To-dos, and Tasks showing two overdue tasks in rose.
6. **My week:** change a forecast and submit. The Overview's Signed this week reads the new total.
7. **My progress:**
   - Target bars fill.
   - Forecast accuracy reads "Within one for 6 weeks running", with six paired bars.
   - The funnel table has dashes for empty cells, never NaN.
   - The stale list shows "M. Lindqvist · Appointment held · 17 days" after a brief pulse, and the row opens My pipeline.
   - Commission reads $14,400 and $33,600 (7 × $4,800).
8. **My Deal Submissions:** open one, then click the rail item again. It closes.
9. **Old links (Review Focus 2):** `/sales?tab=week` lands on `/consultant?tab=week`, and `/sales?tab=submissions` on the portal's submissions.
10. **Sales dashboard rail:** Overview, Pipeline, Clients, Under construction, Rapid costing, Exclusive land, Team.
11. **Jarvis** in the portal offers the three featured questions, and each answers with live figures. On Sales it offers "What's in the pipeline?", "Which lots can I hold?" and "Who's leading sales this quarter?".
12. **Admin › Roles & permissions** lists "Sales portal" and "Sales" as separate roles. Michael Fox shows as online in My Deal Submissions.
13. Turn on reduced motion (OS setting or DevTools emulation): nothing slides or flies.

- [ ] **Step 13: Commit**

```bash
git add src/state/launchpad-store.tsx src/components/shell/dashboards.ts src/components/shell/dashboard-tones.ts src/components/shell/DashboardSwitchLoader.tsx "app/(dashboard)/consultant/page.tsx" src/hooks/useGreeting.ts src/components/modules/employee/parts.tsx src/components/modules/employee/EmployeeOverview.tsx src/components/modules/consultant/ src/components/modules/sales/moved-tabs.ts src/components/modules/sales/moved-tabs.test.ts src/components/modules/sales/SalesScreen.tsx src/components/modules/admin/data.ts src/components/shell/assistant/jarvis-knowledge.ts src/components/shell/assistant/JarvisBubble.tsx
git commit -m "Add the Sales portal; Sales becomes the team's view

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: Access, docs and final checks

**Files:**
- Modify: `src/components/modules/admin/data.ts` (seed grants, section limits, Kate Grierson's presence)
- Modify: `README.md`
- Modify (main working tree, not committed): `docs/superpowers/plans/2026-10-06-meeting2-prototype-updates.md`

**Interfaces:**
- Consumes: the `consultant` role (Task 5).
- Produces: seed grants where every Sales department member holds `consultant`, and New Home Advocates have `sales:pipeline`, `sales:clients` and `sales:team` hidden.

- [ ] **Step 1: Seed grants** in `src/components/modules/admin/data.ts`

Replace:

```ts
  sales: ["sales"],
```

with:

```ts
  sales: ["sales", "consultant"],
```

Replace:

```ts
  { who: (r) => r.role === "New Home Advocate", section: "sales:team", access: "view" },
```

with:

```ts
  // New Home Advocates work from the Sales portal. On the dashboard they keep the shared tools:
  // Under construction, Rapid costing and Exclusive land.
  { who: (r) => r.role === "New Home Advocate", section: "sales:pipeline", access: "hidden" },
  { who: (r) => r.role === "New Home Advocate", section: "sales:clients", access: "hidden" },
  { who: (r) => r.role === "New Home Advocate", section: "sales:team", access: "hidden" },
```

Kate Grierson is a New Home Advocate, so her section is now hidden. Replace:

```ts
  "kate-grierson": { at: "sales:pipeline", inactive: true },
```

with:

```ts
  "kate-grierson": { at: "consultant:pipeline", inactive: true },
```

- [ ] **Step 2: README**

In `README.md`'s Modules table, replace:

```md
| `/sales` | Sales | `pipeline` · `clients` · `week` · `build` · `costing` · `submissions` · `land` · `team` |
```

with:

```md
| `/sales` | Sales (the team's view) | `pipeline` · `clients` · `build` · `costing` · `land` · `team` |
```

and replace:

```md
| `/notifications` | Notifications inbox | — |
```

with:

```md
| `/notifications` | Notifications inbox | — |
| `/client` | Client portal | `finance` · `options` · `build` · `documents` · `messages` |
| `/developer` | Developer portal | `clients` · `updates` · `insights` · `products` · `terms` |
| `/employee` | Employee portal | `invoices` (`&view=new` · `history`) · `profile` · `department` |
| `/consultant` | Sales portal (one consultant's own) | `pipeline` · `clients` · `week` · `progress` · `submissions` |
```

- [ ] **Step 3: Type-check, test, build**

Run: `npx tsc --noEmit` (expected: no output) and `npm test` (expected: PASS, 16 tests).

Stop the worktree's dev server, then run: `npx next build`
Expected: the build succeeds and `/consultant` is in the route list.

- [ ] **Step 4: Note the change in the Meeting 2 plan** (main working tree, uncommitted)

`docs/superpowers/plans/2026-10-06-meeting2-prototype-updates.md` is untracked in `C:\Users\Kane\Desktop\Locale-launchpad`, so it isn't in this branch. Edit it there, directly under its `**Spec:**` line, and don't commit it:

```md
> **Note (2026-10-06): the Sales portal, once `feat/sales-portal` is merged.** My clients and My week now show in the Sales portal (`/consultant`), not on the Sales dashboard. Their files haven't moved (`sales/clients/`, `sales/week/`). `MyClients.tsx` now has a rep view and a team view: Task 1's grouping by builder belongs in the rep view (`RepClients`). The test runner is already on `main`, so Task 1 Step 1 is only the branch. `src/hooks/useNow.ts` already exists with Task 2's code. Task 2's `useNavBadge("sales:week", ...)` goes in `consultant/ConsultantScreen.tsx` as `"consultant:week"`. `sales-state.tsx` changed shape: its provider is in `app/(dashboard)/layout.tsx`, and `reselect` and the scope are on `SalesViewProvider`.
```

- [ ] **Step 5: Final browser checks** (dev server back on :3200)

1. Admin › Roles & permissions: a New Home Advocate (Michael Fox) holds Sales portal and Sales. In their Sales grant, Pipeline, Clients and Team are Hidden, and Under construction, Rapid costing and Exclusive land are Edit. Sean O'Neill holds Sales in full.
2. Admin › Global Master List: Kate Grierson is inactive in My pipeline, and Michael Fox online in My Deal Submissions.
3. Repeat Task 5 Step 12's checks 2, 4 and 9 once more after the build, in light and dark at 375px.

- [ ] **Step 6: Commit**

```bash
git add src/components/modules/admin/data.ts README.md
git commit -m "Sales portal access for the Sales department; README

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

Then hand over with superpowers:finishing-a-development-branch. When merging into `main`, merge the latest `main` into the branch first, and keep both sides of any conflict with `feat/tickets-dashboard`. Those conflicts are additive, in `dashboards.ts`, `ModuleId`, `SHAPES`, Admin's `BLURBS` and Jarvis's `JARVIS` and `FEATURED`.
