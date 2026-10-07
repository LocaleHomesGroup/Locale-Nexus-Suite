# Meeting 2 Prototype Updates Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Launchpad prototype changes asked for on the 2026-10-06 Operations call that need no decision still owed by someone else.

**Architecture:** Each change is a pure, unit-tested logic module (`*.ts`, no React) plus the screen that renders it. All state stays in the existing in-memory stores (`sales-state.tsx`, `launchpad-store.tsx`, `employee/invoice-store.ts`). Anything that would talk to HubSpot, Monday, Teams or Xero is simulated, the way the rest of the prototype already does it. Tests use Node's built-in runner through `tsx`, the setup Simple HRIS uses.

**Tech Stack:** Next.js 16, React 19, TypeScript 5.9, Tailwind 4, `motion`, `sonner`, Node 24 `node:test` + `tsx`.

**Spec:** [docs/Meeting2.md](../../Meeting2.md), mainly "Action Items / Next Steps" and "What this call means for this prototype".

> **Note (2026-10-06): the Sales portal, once `feat/sales-portal` is merged.** My clients and My week now show in the Sales portal (`/consultant`), not on the Sales dashboard. Their files haven't moved (`sales/clients/`, `sales/week/`). `MyClients.tsx` now has a rep view and a team view: Task 1's grouping by builder belongs in the rep view (`RepClients`). The test runner is already on `main`, so Task 1 Step 1 is only the branch. `src/hooks/useNow.ts` already exists with Task 2's code. Task 2's `useNavBadge("sales:week", ...)` goes in `consultant/ConsultantScreen.tsx` as `"consultant:week"`. `sales-state.tsx` changed shape: its provider is in `app/(dashboard)/layout.tsx`, and `reselect` and the scope are on `SalesViewProvider`.

## Scope

**In this plan** (Meeting2 action-item rows in brackets):

| # | Task | Meeting2 |
|---|---|---|
| 1 | Test runner, and Sales › My clients grouped by builder | row 6 |
| 2 | Sales › My week: this week's appointments with a one-pick outcome | row 6 |
| 3 | Sales › Team: lead response time per rep, median and slowest, live | row 17 |
| 4 | Submission review: a validity period per document type | row 10 |
| 5 | Sales › Price lists for reps, and Teams on publish (simulated) | row 12 |
| 6 | Employee portal: invoice received, approved, returned and paid updates | row 15 |
| 7 | Operations and Leadership: per-builder overview | row 14 (the overview half) |
| 8 | Rapid costing: every discount needs a manager (**Kane decides, see below**) | prototype item 1 |
| 9 | Seed spelling, README, and Meeting2 follow-through | prototype item 8 |

**Not in this plan, and why:**

- Live Monday and HubSpot migration, and Alison's contract upload bug (rows 1, 2): Jerry's live build, not this repo.
- Real Teams, SharePoint, HubSpot or Xero calls (rows 11, 12): the prototype is static on purpose.
- Pipeline value by commission (row 14, first half): blocked on Alison's formula.
- A discount policy beyond Task 8 (row 8): blocked on the session with Sean O'Neill.
- Rapid Costing variations, ups and downs, HomeScope (row 9): parked by Shannan until she is back.
- Renamed-design templates (row 13): Alison hasn't named the three builders.
- Global Master List for clients and builders (row 18): waiting on Jerry's list.
- Commission or bonus added notifications (row 15, second half): the Employee portal has no commissions yet.
- Renaming the "Shannan Hart" persona (prototype item 9): ask Kane first.

## Decisions for Kane before execution

1. **Task 8.** Alison said *"Pretty much any discount at the moment would need manager approval."* Task 8 makes the prototype say that. Rapid Costing is parked, so dropping Task 8 is also reasonable. **Recommendation: keep it.** The prototype is what Jerry demos to Ops, and it currently states a rule Alison corrected on the call.
2. **Placeholders.** These values go in one constant each, labelled as placeholders:
   - Validity periods: 90 days for an LOE or pre-approval (Alison: *"within three months"*), and 90 days for a deposit receipt (not stated on the call).
   - The lead response target: 60 minutes (not stated).
3. **Held appointments.** Marking an appointment Held does not move its deal automatically. It offers a "Move deal to Appointment held" button that uses the pipeline's existing move, with that move's own undo. Say so if you want it automatic.
4. **New dev dependency.** `tsx@^4.21.0`, the same version Simple HRIS uses.

## Global Constraints

- Static prototype: no backend, auth, RBAC or database. Data comes from `src/data/` and in-memory stores, and a reload resets it (README, "Static prototype").
- Next.js 16 has breaking changes. Before using any Next API this plan doesn't already show (only `next/link` and `next/navigation` hooks are used here), read `node_modules/next/dist/docs/` (AGENTS.md).
- Build UI from `src/components/ui/` and follow `docs/UI-GUIDE.md`. Never modify `Reference/`.
- Anything that sends to HubSpot, Monday, Xero, Teams or a builder goes through `undoable()` from `src/lib/undoable.ts` (UI-GUIDE § 5.1).
- Motion uses only `EASE_OUT` and `EASE_SWAP` from `src/lib/motion.ts`. Gate `transition` on `useReducedMotion()`, never `initial` (UI-GUIDE § 6). New lists animate in the first pass, using `Reveal` for sections and `rowDelay` for rows.
- Don't change the Switch view card or the Jarvis button.
- Every placeholder value lives in one named constant. Its doc comment says "Placeholder, not confirmed" and who confirms it.
- No em dashes in new copy, code comments or docs.
- Wall-clock rendering: anything that formats or filters by the current time renders only after mount (`useNow()` returns `null` first), so the server's HTML and the browser's agree.
- Verify every task with `npm test` and `npx tsc --noEmit`. Task 9 also runs `npx next build` (stop the dev server first, they share `.next/`) and checks light and dark themes at 375px and desktop widths.
- Work on branch `meeting2-prototype-updates`. Stage only each task's files: `docs/UI-GUIDE.md` has an unrelated uncommitted change. End every commit message with:
  `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`

## Review Focus

1. **Accounting approves the same invoice twice, or resets it to pending.** The employee gets exactly one "approved" update, and none for pending. Covered in Task 6 by `alertForDecision`.
2. **A finance or deposit document with no readable date.** Its check shows "No date found" and fails. It never passes silently. Covered in Task 4.
3. **A rep with no inquiries, or a contact logged before the inquiry arrived.** The table shows dashes, never `NaN` or negative minutes. Covered in Task 3.
4. **Held on an appointment whose deal is already past Appointment booked, or is lost.** No stage move is offered. Covered in Task 2.
5. **An appointment at Sunday 23:30 or Monday 00:00.** It lands in the right week, in local time. Covered in Task 2.

---

### Task 1: Test runner, and My clients grouped by builder

Alison: *"it would be great if for this page where they could see their clients in pre-construction, construction that can be grouped by builder."*

**Files:**
- Modify: `package.json` (add the `test` script and the `tsx` dev dependency)
- Modify: `src/data/jobs.ts` (add `NO_BUILDER` after the `Job` interface, around line 58)
- Create: `src/components/modules/sales/clients/group.ts`
- Test: `src/components/modules/sales/clients/group.test.ts`
- Modify: `src/components/modules/sales/clients/MyClients.tsx`

**Interfaces:**
- Produces:
  - `NO_BUILDER: "No builder"` from `@/data/jobs`, which Task 7 uses.
  - `groupByBuilder(jobs: Job[]): BuilderGroup[]`, where `BuilderGroup = { builder: string; jobs: Job[] }`.
  - The `npm test` script, which every later task uses.

- [ ] **Step 1: Create the branch and add the test runner**

```bash
git checkout -b meeting2-prototype-updates
npm install --save-dev tsx@^4.21.0
```

In `package.json`, add the script after `"lint"`:

```json
    "lint": "tsc --noEmit",
    "test": "node --import tsx --test \"src/**/*.test.ts\""
```

- [ ] **Step 2: Add `NO_BUILDER` to `src/data/jobs.ts`**, directly after the closing `}` of `export interface Job`:

```ts
/** What a job with a blank builder is filed under, so it still shows. */
export const NO_BUILDER = "No builder";
```

- [ ] **Step 3: Write the failing test** `src/components/modules/sales/clients/group.test.ts`

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import type { Job } from "@/data/jobs";
import { groupByBuilder } from "./group";

const job = (id: number, builder: string): Job => ({ id, builder, client: `Client ${id}` }) as Job;

test("groups a rep's clients by builder, A to Z, keeping each group's order", () => {
  const groups = groupByBuilder([job(1, "Move Homes"), job(2, "Forma"), job(3, "La Vida"), job(4, "Forma")]);
  assert.deepEqual(
    groups.map((g) => g.builder),
    ["Forma", "La Vida", "Move Homes"],
  );
  assert.deepEqual(
    groups[0].jobs.map((j) => j.id),
    [2, 4],
  );
});

test("a rep with no clients has no groups", () => {
  assert.deepEqual(groupByBuilder([]), []);
});

test("a job with a blank builder goes in a last group of its own", () => {
  const groups = groupByBuilder([job(1, "  "), job(2, "Forma")]);
  assert.deepEqual(
    groups.map((g) => g.builder),
    ["Forma", "No builder"],
  );
});
```

- [ ] **Step 4: Run it to make sure it fails**

Run: `node --import tsx --test src/components/modules/sales/clients/group.test.ts`
Expected: FAIL, `Cannot find module './group'`.

- [ ] **Step 5: Write `src/components/modules/sales/clients/group.ts`**

```ts
import { NO_BUILDER, type Job } from "@/data/jobs";

export interface BuilderGroup {
  builder: string;
  jobs: Job[];
}

/**
 * A rep's clients grouped by builder, A to Z, with blank builders last. Each
 * group keeps its jobs in the order they came in. Ali asked for this on the
 * 2026-10-06 Operations call (docs/Meeting2.md).
 */
export function groupByBuilder(jobs: Job[]): BuilderGroup[] {
  const groups = new Map<string, Job[]>();
  for (const job of jobs) {
    const builder = job.builder.trim() || NO_BUILDER;
    groups.set(builder, [...(groups.get(builder) ?? []), job]);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => (a === NO_BUILDER ? 1 : b === NO_BUILDER ? -1 : a.localeCompare(b, "en-AU")))
    .map(([builder, list]) => ({ builder, jobs: list }));
}
```

- [ ] **Step 6: Run the test to make sure it passes**

Run: `npm test`
Expected: PASS, 3 tests.

- [ ] **Step 7: Group the cards in `MyClients.tsx`**

Make these changes to the imports:
- Add `Users` to the `lucide-react` import.
- Add `import type { Job } from "@/data/jobs";`
- Add `import { EmptyState } from "@/components/ui/states";`
- Add `import { groupByBuilder } from "./group";`

After `const mine = ...`, add:

```tsx
  const groups = groupByBuilder(mine);
```

Replace the whole `<ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">` … `</ul>` block (the `mine.map` cards) with:

```tsx
      {groups.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No clients yet"
          description="A client shows here once their deal is won and the job is on Monday."
        />
      ) : (
        <div className="flex flex-col gap-5">
          {groups.map((g, gi) => {
            const offset = groups.slice(0, gi).reduce((n, x) => n + x.jobs.length, 0);
            return (
              <section key={g.builder} aria-label={`${g.builder} clients`} className="flex flex-col gap-2.5">
                <h2 className="flex items-baseline gap-2 text-[13px] font-semibold">
                  {g.builder}
                  <span className="text-xs font-normal text-muted-foreground tabular-nums">
                    {g.jobs.length} {g.jobs.length === 1 ? "client" : "clients"}
                  </span>
                </h2>
                <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {g.jobs.map((j, i) => (
                    <ClientCard key={j.id} job={j} index={offset + i} onOpen={openJob} />
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}
```

Add this component at the bottom of the file. It is the old card, with the builder dropped from its subtitle because the group heading now says it:

```tsx
function ClientCard({ job: j, index: i, onOpen }: { job: Job; index: number; onOpen: (id: number) => void }) {
  const complete = j.milestones.filter((m) => m.status === "done").length;
  const total = j.milestones.length || 8;
  const building = j.board === "construction";
  const pct = building ? Math.round((complete / total) * 100) : 0;
  return (
    <Reveal as="li" index={i}>
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
          {building ? "Under construction" : "Preconstruction"}
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
}
```

Update the file's doc comment to say the clients are "grouped by builder".

- [ ] **Step 8: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 9: Commit**

```bash
git add package.json package-lock.json src/data/jobs.ts src/components/modules/sales/clients/
git commit -m "Group Sales › My clients by builder; add the node:test runner"
```

---

### Task 2: My week, this week's appointments with a one-pick outcome

Alison: *"for a rep to update a meeting outcome ... it's about five or six clicks ... So most of the reps just don't do it."*

**Files:**
- Create: `src/hooks/useNow.ts`
- Create: `src/components/modules/sales/week/appointments.ts`
- Test: `src/components/modules/sales/week/appointments.test.ts`
- Create: `src/components/modules/sales/week/use-appointment-writes.ts`
- Create: `src/components/modules/sales/week/Appointments.tsx`
- Modify: `src/components/modules/sales/sales-state.tsx`
- Modify: `src/components/modules/sales/week/MyWeek.tsx`
- Modify: `src/components/modules/sales/SalesScreen.tsx`

**Interfaces:**
- Consumes: `useDealWrites().moveDeal(id: string, to: PipelineStage)` from `../pipeline/deal-writes`; `useNavBadge(key, badge)` from `@/components/shell/nav-state`.
- Produces:
  - `useNow(everyMs?: number): number | null`, used by Task 3.
  - `Appointment`, `Outcome`, `OUTCOMES`, `OUTCOME_LABEL`.
  - `weekBounds(now)`, `appointmentsThisWeek(list, rep, now)`, `needsOutcome(a, now)`.
  - `stageAfterOutcome(deal, outcome)` and `seedAppointments(now)`.
  - `appointments` and `setAppointments` on `useSalesState()`.

- [ ] **Step 1: Write the failing test** `src/components/modules/sales/week/appointments.test.ts`

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { appointmentsThisWeek, needsOutcome, stageAfterOutcome, weekBounds, type Appointment } from "./appointments";

// Local time. Monday 5 October 2026 is a Monday.
const at = (d: number, h = 0, m = 0) => new Date(2026, 9, d, h, m).getTime();
const WED = at(7, 10);

const appt = (id: string, when: number, extra: Partial<Appointment> = {}): Appointment => ({
  id,
  dealId: null,
  client: id,
  kind: "First appointment",
  place: "Phone",
  at: when,
  rep: "A. Mercer",
  outcome: "scheduled",
  ...extra,
});

test("the week runs Monday 00:00 to the next Monday 00:00, local time", () => {
  assert.deepEqual(weekBounds(WED), { start: at(5), end: at(12) });
  assert.deepEqual(weekBounds(at(11, 23, 30)), { start: at(5), end: at(12) });
  assert.deepEqual(weekBounds(at(12)), { start: at(12), end: at(19) });
});

test("this week's appointments are the rep's own, inside the week, soonest first", () => {
  const list = [
    appt("next-monday", at(12)),
    appt("sunday-late", at(11, 23, 30)),
    appt("monday", at(5, 9)),
    appt("other-rep", at(6, 9), { rep: "K. Ellery" }),
    appt("last-week", at(4, 16)),
  ];
  assert.deepEqual(
    appointmentsThisWeek(list, "A. Mercer", WED).map((a) => a.id),
    ["monday", "sunday-late"],
  );
});

test("an appointment needs an outcome once it has happened and is still scheduled", () => {
  assert.equal(needsOutcome(appt("past", at(6, 9)), WED), true);
  assert.equal(needsOutcome(appt("future", at(8, 9)), WED), false);
  assert.equal(needsOutcome(appt("held", at(6, 9), { outcome: "held" }), WED), false);
});

test("only a held appointment on a deal still at Appointment booked offers a stage move", () => {
  assert.equal(stageAfterOutcome({ stage: "Appointment booked" }, "held"), "Appointment held");
  assert.equal(stageAfterOutcome({ stage: "Appointment booked" }, "no_show"), null);
  assert.equal(stageAfterOutcome({ stage: "Potential sale" }, "held"), null);
  assert.equal(stageAfterOutcome({ stage: "Appointment booked", lost: { at: 1, by: "A. Mercer" } }, "held"), null);
  assert.equal(stageAfterOutcome(undefined, "held"), null);
});
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `node --import tsx --test src/components/modules/sales/week/appointments.test.ts`
Expected: FAIL, `Cannot find module './appointments'`.

- [ ] **Step 3: Write `src/components/modules/sales/week/appointments.ts`**

```ts
import type { PipelineDeal, PipelineStage } from "../data";

/**
 * My week's appointments: every booked meeting in one list, with its outcome
 * one pick away. Sample data, built around the current time, until HubSpot's
 * meetings are mirrored.
 */
export const OUTCOMES = ["scheduled", "held", "no_show", "cancelled", "rescheduled"] as const;
export type Outcome = (typeof OUTCOMES)[number];

export const OUTCOME_LABEL: Record<Outcome, string> = {
  scheduled: "Scheduled",
  held: "Held",
  no_show: "No-show",
  cancelled: "Cancelled",
  rescheduled: "Rescheduled",
};

export interface Appointment {
  id: string;
  /** The pipeline deal it belongs to, when there is one. */
  dealId: string | null;
  client: string;
  /** "First appointment", "Prestart", "Finance catch-up". */
  kind: string;
  place: string;
  /** Epoch ms. */
  at: number;
  rep: string;
  outcome: Outcome;
}

const HOUR = 3_600_000;

/** Monday 00:00 to the next Monday 00:00 around `now`, in local time. */
export function weekBounds(now: number): { start: number; end: number } {
  const d = new Date(now);
  const sinceMonday = (d.getDay() + 6) % 7;
  const start = new Date(d.getFullYear(), d.getMonth(), d.getDate() - sinceMonday).getTime();
  const end = new Date(d.getFullYear(), d.getMonth(), d.getDate() - sinceMonday + 7).getTime();
  return { start, end };
}

/** The rep's appointments inside this week, soonest first. */
export function appointmentsThisWeek(list: Appointment[], rep: string, now: number): Appointment[] {
  const { start, end } = weekBounds(now);
  return list.filter((a) => a.rep === rep && a.at >= start && a.at < end).sort((a, b) => a.at - b.at);
}

/** It has happened and nobody has said how it went. */
export const needsOutcome = (a: Appointment, now: number) => a.outcome === "scheduled" && a.at <= now;

/**
 * The stage to offer after an outcome. Only a held appointment on an open
 * deal still at "Appointment booked" moves it on; anything else stays put.
 */
export function stageAfterOutcome(
  deal: Pick<PipelineDeal, "stage" | "lost"> | undefined,
  outcome: Outcome,
): PipelineStage | null {
  if (!deal || deal.lost) return null;
  return outcome === "held" && deal.stage === "Appointment booked" ? "Appointment held" : null;
}

/** Sample appointments around `now`, so some have happened and some are coming up. */
export function seedAppointments(now: number): Appointment[] {
  const at = (hours: number) => now + hours * HOUR;
  return [
    { id: "ap-whitmore", dealId: "d-whitmore", client: "S. and A. Whitmore", kind: "First appointment", place: "Baldivis display", at: at(-3), rep: "A. Mercer", outcome: "scheduled" },
    { id: "ap-barber", dealId: null, client: "B. Barber", kind: "Prestart", place: "Move Homes office", at: at(-26), rep: "A. Mercer", outcome: "held" },
    { id: "ap-okonkwo", dealId: null, client: "P. Okonkwo", kind: "Finance catch-up", place: "Phone", at: at(-50), rep: "A. Mercer", outcome: "scheduled" },
    { id: "ap-osei", dealId: "d-osei", client: "F. and R. Osei", kind: "Second appointment", place: "Lakelands display", at: at(20), rep: "A. Mercer", outcome: "scheduled" },
    { id: "ap-perera", dealId: "d-perera", client: "N. Perera", kind: "First appointment", place: "Baldivis display", at: at(4), rep: "K. Ellery", outcome: "scheduled" },
  ];
}
```

- [ ] **Step 4: Run the test to make sure it passes**

Run: `npm test`
Expected: PASS, every test so far.

- [ ] **Step 5: Write `src/hooks/useNow.ts`**

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

- [ ] **Step 6: Hold the appointments in `sales-state.tsx`**

Add the import:

```ts
import { seedAppointments, type Appointment } from "./week/appointments";
```

Add to `interface SalesState`, after `setLots`:

```ts
  appointments: Appointment[];
  setAppointments: Setter<Appointment[]>;
```

Add to `SalesStateProvider`, after the `lots` state:

```ts
  const [appointments, setAppointments] = React.useState<Appointment[]>(() => seedAppointments(Date.now()));
```

Add `appointments, setAppointments` to the memo's value object, and `appointments` to its dependency list.

- [ ] **Step 7: Write `src/components/modules/sales/week/use-appointment-writes.ts`**

```ts
"use client";

import * as React from "react";
import { undoable } from "@/lib/undoable";
import { useSalesState } from "../sales-state";
import { OUTCOME_LABEL, type Outcome } from "./appointments";

/**
 * Setting a meeting outcome writes to HubSpot, so it waits out the undo window
 * (UI guide § 5.1). The row shows the new outcome at once with "Saving…";
 * undo puts the old one back if nothing newer has replaced it.
 */
export function useAppointmentWrites() {
  const { appointments, setAppointments } = useSalesState();
  const [saving, setSaving] = React.useState<Record<string, true>>({});
  const ref = React.useRef(appointments);
  ref.current = appointments;

  const setOutcome = React.useCallback(
    (id: string, outcome: Outcome) => {
      const appt = ref.current.find((a) => a.id === id);
      if (!appt || appt.outcome === outcome) return;
      const before = appt.outcome;
      const settle = () =>
        setSaving((s) => {
          const next = { ...s };
          delete next[id];
          return next;
        });
      setAppointments((prev) => prev.map((a) => (a.id === id ? { ...a, outcome } : a)));
      setSaving((s) => ({ ...s, [id]: true }));
      undoable({
        message: `${appt.client} · ${OUTCOME_LABEL[outcome]}`,
        description: "Meeting outcome goes to HubSpot",
        commit: settle,
        undo: () => {
          setAppointments((prev) => prev.map((a) => (a.id === id && a.outcome === outcome ? { ...a, outcome: before } : a)));
          settle();
        },
        done: { message: `Outcome saved · ${appt.client}`, description: `${OUTCOME_LABEL[outcome]} · updated in HubSpot` },
      });
    },
    [setAppointments],
  );

  return { setOutcome, saving };
}
```

- [ ] **Step 8: Write `src/components/modules/sales/week/Appointments.tsx`**

```tsx
"use client";

import { CalendarClock, MoveRight } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { useNow } from "@/hooks/useNow";
import { EASE_OUT, rowDelay } from "@/lib/motion";
import { Card, CardContent, CardDescription, CardHeader, CardMeta, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Pill } from "@/components/ui/pill";
import { SmoothSelect } from "@/components/ui/select";
import { EmptyState } from "@/components/ui/states";
import { CURRENT_REP } from "../data";
import { useSalesState } from "../sales-state";
import { useDealWrites } from "../pipeline/deal-writes";
import { OUTCOMES, OUTCOME_LABEL, appointmentsThisWeek, needsOutcome, stageAfterOutcome, type Outcome } from "./appointments";
import { useAppointmentWrites } from "./use-appointment-writes";

const WHEN = new Intl.DateTimeFormat("en-AU", {
  weekday: "short",
  day: "numeric",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
});
const OPTIONS = OUTCOMES.map((o) => ({ value: o, label: OUTCOME_LABEL[o] }));

/**
 * My week › This week's appointments. Every appointment in one list with its
 * outcome one pick away, because HubSpot takes five or six clicks and reps
 * skip it (Ali, docs/Meeting2.md). Held on a booked deal offers the stage move.
 */
export function Appointments() {
  const now = useNow();
  const reduce = useReducedMotion();
  const { appointments, deals } = useSalesState();
  const { setOutcome, saving } = useAppointmentWrites();
  const { moveDeal } = useDealWrites();

  const week = now === null ? [] : appointmentsThisWeek(appointments, CURRENT_REP, now);
  const missing = now === null ? 0 : week.filter((a) => needsOutcome(a, now)).length;

  return (
    <Card>
      <CardHeader>
        <CalendarClock className="size-3.5 text-tone-ink" aria-hidden />
        <CardTitle as="h3" className="text-sm">
          This week&apos;s appointments
        </CardTitle>
        <CardMeta>{missing ? `${missing} need an outcome` : "Every outcome is in"}</CardMeta>
        <CardDescription>Pick how each one went. It goes to HubSpot for you.</CardDescription>
      </CardHeader>
      <CardContent>
        {now === null ? (
          <div className="h-24" aria-hidden />
        ) : week.length === 0 ? (
          <EmptyState
            icon={CalendarClock}
            title="No appointments this week"
            description="Appointments you book in HubSpot show here."
          />
        ) : (
          <ul className="divide-y divide-hairline">
            {week.map((a, i) => {
              const deal = a.dealId ? deals.find((d) => d.id === a.dealId) : undefined;
              const next = stageAfterOutcome(deal, a.outcome);
              return (
                <motion.li
                  key={a.id}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: reduce ? 0 : 0.2, ease: EASE_OUT, delay: rowDelay(i, reduce, 0.04) }}
                  className="flex flex-wrap items-center gap-x-3 gap-y-1.5 py-2.5"
                >
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2 text-[13px] font-semibold">
                      {a.client}
                      {needsOutcome(a, now) ? <Pill tone="pending">Outcome needed</Pill> : null}
                    </p>
                    <p className="text-xs text-muted-foreground tabular-nums">
                      {WHEN.format(a.at)} · {a.kind} · {a.place}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {saving[a.id] ? <span className="text-xs text-subtle-foreground">Saving…</span> : null}
                    <SmoothSelect<Outcome>
                      size="sm"
                      align="end"
                      ariaLabel={`Outcome for ${a.client}`}
                      value={a.outcome}
                      onChange={(o) => setOutcome(a.id, o)}
                      options={OPTIONS}
                    />
                  </div>
                  {next && deal ? (
                    <Button variant="outline" size="xs" className="basis-full sm:basis-auto" onClick={() => moveDeal(deal.id, next)}>
                      <MoveRight aria-hidden /> Move deal to {next}
                    </Button>
                  ) : null}
                </motion.li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 9: Show it in `MyWeek.tsx`**

Add `import { Appointments } from "./Appointments";`. After the closing `</div>` of the two-card grid (`<div className="grid items-start gap-5 lg:grid-cols-2">`), add:

```tsx
      <Reveal index={2}>
        <Appointments />
      </Reveal>
```

- [ ] **Step 10: Badge My week in the rail from `SalesScreen.tsx`**

Make these changes to the imports:
- Change the `nav-state` import to `import { useNavBadge, useNavReselect } from "@/components/shell/nav-state";`
- Change the `sales-state` import to `import { SalesStateProvider, useSalesState } from "./sales-state";`
- Add:

```tsx
import { useNow } from "@/hooks/useNow";
import { CURRENT_REP } from "./data";
import { appointmentsThisWeek, needsOutcome } from "./week/appointments";
```

Add `<OutcomeBadge />` as the first child of `<SalesStateProvider reselect={reselect}>`, before `<PageContainer>`. Then add this at the bottom of the file:

```tsx
/** My week's rail badge: appointments that have happened with no outcome yet. */
function OutcomeBadge() {
  const { appointments } = useSalesState();
  const now = useNow(60_000);
  const count =
    now === null ? 0 : appointmentsThisWeek(appointments, CURRENT_REP, now).filter((a) => needsOutcome(a, now)).length;
  useNavBadge("sales:week", {
    count,
    tone: "pending",
    label: count === 1 ? "appointment needs an outcome" : "appointments need an outcome",
  });
  return null;
}
```

- [ ] **Step 11: Verify**

Run: `npm test` and `npx tsc --noEmit`
Expected: all tests pass, no type errors.

Manual check (`npm run dev`, open `/sales?tab=week`):
- S. and A. Whitmore shows "Outcome needed", and the rail's My week has a badge.
- Picking Held shows "Saving…" and an undo toast, and the badge drops.
- A "Move deal to Appointment held" button appears, and clicking it moves the deal on `/sales?tab=pipeline`.

- [ ] **Step 12: Commit**

```bash
git add src/hooks/useNow.ts src/components/modules/sales/week/ src/components/modules/sales/sales-state.tsx src/components/modules/sales/SalesScreen.tsx
git commit -m "Add this week's appointments with one-pick outcomes to Sales › My week"
```

---

### Task 3: Lead response time per rep, in the manager's Team view

Alison: *"if they've had one client that they missed and it took them three days, then their average is going to blow out."* So the card shows each rep's median and their slowest, never an average, and lists inquiries still waiting with a live timer.

**Files:**
- Create: `src/components/modules/sales/team/response-time.ts`
- Test: `src/components/modules/sales/team/response-time.test.ts`
- Create: `src/components/modules/sales/team/LeadResponse.tsx`
- Modify: `src/components/modules/sales/team/Team.tsx` (insert before the "Stage report by rep" `<Reveal index={4}>`, around line 360)

**Interfaces:**
- Consumes: `useNow()` from Task 2; `REPS` from `../data`; `Footnote`, `ManagersOnly` from `../parts`.
- Produces:
  - `Inquiry`, `RESPONSE_TARGET_MIN`.
  - `minutesToContact(i, now)`, `median(values)`, `repResponse(inquiries, reps, now)`.
  - `waitingForContact(inquiries)`, `formatMinutes(m)`, `seedInquiries(now)`.

- [ ] **Step 1: Write the failing test** `src/components/modules/sales/team/response-time.test.ts`

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { formatMinutes, median, minutesToContact, repResponse, waitingForContact, type Inquiry } from "./response-time";

const MIN = 60_000;
const NOW = new Date(2026, 9, 7, 12).getTime();
const inq = (id: string, rep: string, receivedMinAgo: number, contactedAfterMin: number | null): Inquiry => ({
  id,
  rep,
  client: id,
  receivedAt: NOW - receivedMinAgo * MIN,
  contactedAt: contactedAfterMin === null ? null : NOW - receivedMinAgo * MIN + contactedAfterMin * MIN,
});

test("minutes to contact, or minutes waiting so far, never negative", () => {
  assert.equal(minutesToContact(inq("a", "A", 100, 12), NOW), 12);
  assert.equal(minutesToContact(inq("b", "A", 45, null), NOW), 45);
  assert.equal(minutesToContact(inq("c", "A", 100, -30), NOW), 0);
});

test("median handles empty, odd and even lists", () => {
  assert.equal(median([]), null);
  assert.equal(median([30, 5, 10]), 10);
  assert.equal(median([5, 10, 20, 4380]), 15);
});

test("one three-day miss shows as the slowest without moving the median", () => {
  const [ellery] = repResponse([inq("walsh", "K", 7200, 4380), inq("kaur", "K", 4320, 9), inq("ito", "K", 1800, 14)], ["K"], NOW);
  assert.equal(ellery.median, 14);
  assert.deepEqual(ellery.slowest, { client: "walsh", minutes: 4380 });
  assert.equal(ellery.contacted, 3);
  assert.equal(ellery.waiting, 0);
  assert.equal(ellery.overTarget, 1);
});

test("a rep with no inquiries has nothing to show, not zeros dressed as data", () => {
  assert.deepEqual(repResponse([], ["Nobody"], NOW), [
    { rep: "Nobody", contacted: 0, median: null, slowest: null, waiting: 0, overTarget: 0 },
  ]);
});

test("still-waiting inquiries count against the target as their wait grows", () => {
  const [r] = repResponse([inq("old", "D", 125, null), inq("new", "D", 25, null)], ["D"], NOW);
  assert.equal(r.waiting, 2);
  assert.equal(r.overTarget, 1);
  assert.deepEqual(
    waitingForContact([inq("new", "D", 25, null), inq("done", "D", 300, 5), inq("old", "D", 125, null)]).map((i) => i.id),
    ["old", "new"],
  );
});

test("minutes read as minutes, hours or days", () => {
  assert.equal(formatMinutes(45), "45m");
  assert.equal(formatMinutes(120), "2h");
  assert.equal(formatMinutes(135), "2h 15m");
  assert.equal(formatMinutes(4380), "3d 1h");
  assert.equal(formatMinutes(2880), "2d");
});
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `node --import tsx --test src/components/modules/sales/team/response-time.test.ts`
Expected: FAIL, `Cannot find module './response-time'`.

- [ ] **Step 3: Write `src/components/modules/sales/team/response-time.ts`**

```ts
/**
 * Lead response time: how long each fresh inquiry waited for its rep's first
 * contact. HubSpot only reports an average, which one missed lead blows out,
 * so this reports each rep's median and their slowest (docs/Meeting2.md).
 * Sample data until HubSpot is mirrored.
 */
export interface Inquiry {
  id: string;
  rep: string;
  client: string;
  /** Epoch ms. */
  receivedAt: number;
  /** Epoch ms of the first contact, or null while it is still waiting. */
  contactedAt: number | null;
}

/** Placeholder, not confirmed: the first-contact target in minutes. Shannan and the sales managers set the real one. */
export const RESPONSE_TARGET_MIN = 60;

const MIN = 60_000;

/** Minutes from arrival to first contact; for one still waiting, the minutes so far. Never negative. */
export function minutesToContact(i: Inquiry, now: number): number {
  return Math.max(0, Math.round(((i.contactedAt ?? now) - i.receivedAt) / MIN));
}

export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

export interface RepResponse {
  rep: string;
  contacted: number;
  /** Median minutes to first contact over contacted inquiries; null with none. */
  median: number | null;
  /** The slowest contacted inquiry, so a three-day miss shows as itself. */
  slowest: { client: string; minutes: number } | null;
  /** Inquiries still waiting for first contact. */
  waiting: number;
  /** Contacted later than the target, or already waiting longer than it. */
  overTarget: number;
}

export function repResponse(inquiries: Inquiry[], reps: readonly string[], now: number): RepResponse[] {
  return reps.map((rep) => {
    const mine = inquiries.filter((i) => i.rep === rep);
    const contacted = mine.filter((i) => i.contactedAt !== null);
    const slowest = contacted.reduce<Inquiry | null>(
      (worst, i) => (!worst || minutesToContact(i, now) > minutesToContact(worst, now) ? i : worst),
      null,
    );
    return {
      rep,
      contacted: contacted.length,
      median: median(contacted.map((i) => minutesToContact(i, now))),
      slowest: slowest ? { client: slowest.client, minutes: minutesToContact(slowest, now) } : null,
      waiting: mine.length - contacted.length,
      overTarget: mine.filter((i) => minutesToContact(i, now) > RESPONSE_TARGET_MIN).length,
    };
  });
}

/** Inquiries nobody has contacted yet, longest waiting first. */
export function waitingForContact(inquiries: Inquiry[]): Inquiry[] {
  return inquiries.filter((i) => i.contactedAt === null).sort((a, b) => a.receivedAt - b.receivedAt);
}

/** 45 → "45m", 135 → "2h 15m", 4380 → "3d 1h". */
export function formatMinutes(m: number): string {
  if (m < 60) return `${m}m`;
  if (m < 1440) {
    const h = Math.floor(m / 60);
    const rest = m % 60;
    return rest ? `${h}h ${rest}m` : `${h}h`;
  }
  const d = Math.floor(m / 1440);
  const h = Math.floor((m % 1440) / 60);
  return h ? `${d}d ${h}h` : `${d}d`;
}

/** Sample inquiries around `now`: K. Ellery's three-day miss, and two still waiting. */
export function seedInquiries(now: number): Inquiry[] {
  const row = (id: string, rep: string, client: string, receivedMinAgo: number, contactedAfterMin: number | null): Inquiry => {
    const receivedAt = now - receivedMinAgo * MIN;
    return { id, rep, client, receivedAt, contactedAt: contactedAfterMin === null ? null : receivedAt + contactedAfterMin * MIN };
  };
  return [
    row("iq-1", "A. Mercer", "J. Pham", 2880, 12),
    row("iq-2", "A. Mercer", "L. Brooks", 1560, 38),
    row("iq-3", "A. Mercer", "M. Rossi", 125, null),
    row("iq-4", "K. Ellery", "D. Walsh", 7200, 4380),
    row("iq-5", "K. Ellery", "S. Kaur", 4320, 9),
    row("iq-6", "K. Ellery", "R. Ito", 1800, 14),
    row("iq-7", "D. Okafor", "C. Byrne", 5760, 21),
    row("iq-8", "D. Okafor", "T. Nolan", 25, null),
  ];
}
```

- [ ] **Step 4: Run the test to make sure it passes**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Write `src/components/modules/sales/team/LeadResponse.tsx`**

```tsx
"use client";

import * as React from "react";
import { Timer } from "lucide-react";
import { useNow } from "@/hooks/useNow";
import { Card, CardContent, CardHeader, CardMeta, CardTitle } from "@/components/ui/card";
import { Pill } from "@/components/ui/pill";
import { SectionLabel } from "@/components/ui/page";
import { Dash, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { REPS } from "../data";
import { Footnote, ManagersOnly } from "../parts";
import {
  RESPONSE_TARGET_MIN,
  formatMinutes,
  minutesToContact,
  repResponse,
  seedInquiries,
  waitingForContact,
} from "./response-time";

/**
 * Sales › Team › Lead response time. Each rep's median and slowest first
 * contact, and every inquiry still waiting with a live timer. Shannan asked
 * for the time to first contact on fresh inquiries (docs/Meeting2.md).
 */
export function LeadResponse() {
  const now = useNow(30_000);
  const [inquiries] = React.useState(() => seedInquiries(Date.now()));
  const rows = now === null ? [] : repResponse(inquiries, REPS, now);
  const waiting = waitingForContact(inquiries);

  return (
    <Card>
      <CardHeader>
        <Timer className="size-3.5 text-tone-ink" aria-hidden />
        <CardTitle>Lead response time</CardTitle>
        <ManagersOnly />
        <CardMeta>Target {formatMinutes(RESPONSE_TARGET_MIN)} to first contact</CardMeta>
      </CardHeader>
      <CardContent className="flex min-w-0 flex-col gap-4">
        {now === null ? (
          <div className="h-32" aria-hidden />
        ) : (
          <>
            <Table className="text-xs">
              <TableHeader>
                <TableRow className="hover:bg-transparent dark:hover:bg-transparent">
                  <TableHead>Rep</TableHead>
                  <TableHead className="text-right">Contacted</TableHead>
                  <TableHead className="text-right">Median</TableHead>
                  <TableHead>Slowest</TableHead>
                  <TableHead className="text-right">Waiting now</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.rep}>
                    <TableCell className="font-medium">{r.rep}</TableCell>
                    <TableCell className="text-right tabular-nums">{r.contacted}</TableCell>
                    <TableCell className="text-right tabular-nums">{r.median === null ? <Dash /> : formatMinutes(r.median)}</TableCell>
                    <TableCell className="tabular-nums">
                      {r.slowest ? (
                        <>
                          {formatMinutes(r.slowest.minutes)}
                          <span className="text-muted-foreground"> · {r.slowest.client}</span>
                        </>
                      ) : (
                        <Dash />
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{r.waiting || <Dash />}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            <section>
              <SectionLabel>Waiting for first contact</SectionLabel>
              {waiting.length === 0 ? (
                <p className="py-2 text-xs text-muted-foreground">Every inquiry has been contacted.</p>
              ) : (
                <ul className="mt-1">
                  {waiting.map((i) => {
                    const mins = minutesToContact(i, now);
                    const late = mins > RESPONSE_TARGET_MIN;
                    return (
                      <li key={i.id} className="flex items-center gap-2 border-t border-hairline py-1.5 text-xs first:border-t-0">
                        <span className="font-medium">{i.client}</span>
                        <span className="text-muted-foreground">{i.rep}</span>
                        <span className="ml-auto tabular-nums">{formatMinutes(mins)}</span>
                        {late ? <Pill tone="problem">Over target</Pill> : null}
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            <Footnote>
              HubSpot shows an average, so one lead missed for three days blows a rep&apos;s figure out. This shows the
              median and the slowest one as itself.
            </Footnote>
          </>
        )}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 6: Add it to `Team.tsx`**

Add `import { LeadResponse } from "./LeadResponse";`. Directly before the `<Reveal index={4}>` that wraps "Stage report by rep", add:

```tsx
      <Reveal index={4}>
        <LeadResponse />
      </Reveal>
```

- [ ] **Step 7: Verify**

Run: `npm test` and `npx tsc --noEmit`
Expected: pass, no errors.

Manual check (`/sales?tab=team`):
- K. Ellery: median 14m, slowest "3d 1h · D. Walsh".
- M. Rossi: waiting about 2h 5m with an "Over target" pill.
- T. Nolan: waiting about 25m with no pill.
- After 30s, the waiting timers tick on.

- [ ] **Step 8: Commit**

```bash
git add src/components/modules/sales/team/
git commit -m "Add lead response time (median, slowest, live waiting list) to Sales › Team"
```

---

### Task 4: Submission review checks each document's date against its own period

Alison: an LOE *"has to be within three months"*, and *"even with deposit receipts, they could have paid us an engagement fee four months ago."*

**Files:**
- Modify: `src/lib/utils.ts` (add `localIsoDate`)
- Modify: `src/data/jobs.ts` (`SubmissionDoc` gains `dated?: string`, around line 1950)
- Create: `src/components/modules/operations/submissions/checks.ts`
- Test: `src/components/modules/operations/submissions/checks.test.ts`
- Modify: `src/components/modules/operations/submissions/data.ts` (remove `AUTOMATED_CHECKS`)
- Modify: `src/components/modules/operations/submissions/OpsReview.tsx` (the "Automated checks" list, around line 207)
- Modify: `src/components/modules/operations/submissions/ReviewDialogs.tsx` (the "Automated checks" list in `CompareDialog`, around line 155)
- Modify: `src/data/seed.ts` (`dated` on Nguyen's `PPADEP` and `DEALLOE`)
- Modify: `src/components/modules/sales/submissions/SubmissionDetail.tsx` (`upload`, around line 98)

**Interfaces:**
- Produces:
  - `localIsoDate(d: Date): string`.
  - `ValidityKind`, `VALIDITY_DAYS`, `validityKind(ref)`.
  - `validityCheck(doc, now): AutomatedCheck | null`.
  - `automatedChecks(doc, now): AutomatedCheck[]`, where `AutomatedCheck = { label: string; pass: boolean; detail?: string }`.

- [ ] **Step 1: Write the failing test** `src/components/modules/operations/submissions/checks.test.ts`

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { automatedChecks, validityCheck, validityKind } from "./checks";

const NOW = new Date(2026, 9, 6, 12).getTime(); // 6 Oct 2026, noon local

test("finance letters and deposit receipts have a period; other documents don't", () => {
  for (const ref of ["DEALLOE", "NCHLOE", "NELOE", "LVLOE"]) assert.equal(validityKind(ref), "finance");
  for (const ref of ["PPADEP", "NCHDEP", "NEDEP", "LVDEP"]) assert.equal(validityKind(ref), "deposit");
  assert.equal(validityKind("DEALPPA"), null);
  assert.equal(validityCheck({ ref: "DEALPPA" }, NOW), null);
});

test("a document is in date up to and including its last day", () => {
  assert.equal(validityCheck({ ref: "DEALLOE", dated: "2026-07-08" }, NOW)?.pass, true); // 90 days
  assert.equal(validityCheck({ ref: "DEALLOE", dated: "2026-07-07" }, NOW)?.pass, false); // 91 days
  assert.equal(validityCheck({ ref: "PPADEP", dated: "2026-09-24" }, NOW)?.pass, true);
});

test("a dated document says how old it is", () => {
  assert.deepEqual(validityCheck({ ref: "DEALLOE", dated: "2026-09-24" }, NOW), {
    label: "Dated within 90 days",
    pass: true,
    detail: "Dated 24 Sept 2026 · 12 days old",
  });
});

test("a document with no date, an unreadable date or a future date never passes", () => {
  assert.deepEqual(validityCheck({ ref: "DEALLOE" }, NOW), { label: "Dated within 90 days", pass: false, detail: "No date found" });
  assert.equal(validityCheck({ ref: "DEALLOE", dated: "soon" }, NOW)?.detail, "Date unreadable");
  assert.equal(validityCheck({ ref: "DEALLOE", dated: "2026-11-01" }, NOW)?.pass, false);
});

test("every document gets the three standing checks, plus its date check when it has a period", () => {
  assert.equal(automatedChecks({ ref: "DEALPPA" }, NOW).length, 3);
  assert.equal(automatedChecks({ ref: "DEALLOE", dated: "2026-09-24" }, NOW).length, 4);
});
```

`"24 Sept 2026"` is what `Intl` gives for `en-AU` on this machine's Node 24, checked when this plan was written.

- [ ] **Step 2: Run it to make sure it fails**

Run: `node --import tsx --test src/components/modules/operations/submissions/checks.test.ts`
Expected: FAIL, `Cannot find module './checks'`.

- [ ] **Step 3: Add `localIsoDate` to `src/lib/utils.ts`**

```ts
/** A date as "2026-10-06" in local time (toISOString would shift it to UTC). */
export function localIsoDate(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}
```

- [ ] **Step 4: Add `dated` to `SubmissionDoc` in `src/data/jobs.ts`**

```ts
export interface SubmissionDoc extends ChecklistItem {
  file: string;
  /** "" = not reviewed yet, "verified" = accepted by Ops, "fix" = returned to the rep (see fixNote). */
  state: "" | "verified" | "fix" | string;
  fixNote: string;
  /** The date read off the document, ISO ("2026-09-24"). Absent until one is read. */
  dated?: string;
}
```

- [ ] **Step 5: Write `src/components/modules/operations/submissions/checks.ts`**

```ts
import type { SubmissionDoc } from "@/data/jobs";

/**
 * The automated checks Ops read beside each submitted document. Three are
 * standing passes in the prototype; the date check is real: each kind of
 * document has its own validity period (docs/Meeting2.md).
 */
export interface AutomatedCheck {
  label: string;
  pass: boolean;
  detail?: string;
}

export type ValidityKind = "finance" | "deposit";

/**
 * Placeholder, not confirmed: how recent a document must be, in days. Ali sets
 * the real periods (Meeting2 row 10). She said an LOE "has to be within three
 * months"; no period was given for deposit receipts.
 */
export const VALIDITY_DAYS: Record<ValidityKind, number> = { finance: 90, deposit: 90 };

/** Which period a document falls under, from its checklist ref: DEALLOE, LVLOE, PPADEP, NEDEP… */
export function validityKind(ref: string): ValidityKind | null {
  if (ref.endsWith("LOE")) return "finance";
  if (ref.endsWith("DEP")) return "deposit";
  return null;
}

const STANDING: AutomatedCheck[] = [
  { label: "Filename matches convention", pass: true },
  { label: "Buyer names match the deal record", pass: true },
  { label: "Signature present on final page", pass: true },
];

const DAY = 86_400_000;
const DATE = new Intl.DateTimeFormat("en-AU", { day: "numeric", month: "short", year: "numeric" });

/** The date check for a document with a validity period, or null when it has none. */
export function validityCheck(doc: Pick<SubmissionDoc, "ref" | "dated">, now: number): AutomatedCheck | null {
  const kind = validityKind(doc.ref);
  if (!kind) return null;
  const days = VALIDITY_DAYS[kind];
  const label = `Dated within ${days} days`;
  if (!doc.dated) return { label, pass: false, detail: "No date found" };
  const dated = new Date(`${doc.dated}T00:00:00`);
  if (Number.isNaN(dated.getTime())) return { label, pass: false, detail: "Date unreadable" };
  const age = Math.floor((now - dated.getTime()) / DAY);
  if (age < 0) return { label, pass: false, detail: `Dated in the future · ${DATE.format(dated)}` };
  return { label, pass: age <= days, detail: `Dated ${DATE.format(dated)} · ${age} ${age === 1 ? "day" : "days"} old` };
}

export function automatedChecks(doc: Pick<SubmissionDoc, "ref" | "dated">, now: number): AutomatedCheck[] {
  const date = validityCheck(doc, now);
  return date ? [...STANDING, date] : STANDING;
}
```

- [ ] **Step 6: Run the test to make sure it passes**

Run: `npm test`
Expected: PASS.

- [ ] **Step 7: Use it in both review screens**

In `operations/submissions/data.ts`, delete the `AUTOMATED_CHECKS` constant and its doc comment.

In `OpsReview.tsx`:
- Drop `AUTOMATED_CHECKS` from the `./data` import.
- Add `import { automatedChecks } from "./checks";`.
- Replace `{AUTOMATED_CHECKS.map(([label, pass]) => (` and its `<li>` with:

```tsx
                        {automatedChecks(current, Date.now()).map(({ label, pass, detail }) => (
                          <li
                            key={label}
                            className="flex items-center gap-2 border-t border-hairline py-1.5 text-xs first:border-t-0"
                          >
                            {pass ? (
                              <Check className="size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
                            ) : (
                              <TriangleAlert className="size-3.5 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
                            )}
                            <span className="min-w-0">
                              {label}
                              {detail ? <span className="text-subtle-foreground"> · {detail}</span> : null}
                            </span>
                            <span
                              className={cn(
                                "ml-auto text-xs font-medium",
                                pass ? "text-emerald-700 dark:text-emerald-300" : "text-amber-700 dark:text-amber-300",
                              )}
                            >
                              {pass ? "Pass" : "Check"}
                            </span>
                          </li>
                        ))}
```

In `ReviewDialogs.tsx`:
- Drop `AUTOMATED_CHECKS` from the `./data` import.
- Add `import { automatedChecks } from "./checks";`.
- In `CompareDialog`, replace `{AUTOMATED_CHECKS.map(([label, pass]) => (` and its `<li>` with:

```tsx
              {automatedChecks(doc, Date.now()).map(({ label, pass, detail }) => (
                <li key={label} className="flex items-center gap-2 border-t border-hairline py-1.5 text-xs first:border-t-0">
                  {pass ? (
                    <Check className="size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
                  ) : (
                    <TriangleAlert className="size-3.5 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
                  )}
                  <span className="min-w-0 flex-1">
                    {label}
                    {detail ? <span className="text-subtle-foreground"> · {detail}</span> : null}
                  </span>
                  <span
                    className={cn(
                      "text-xs font-medium",
                      pass ? "text-emerald-700 dark:text-emerald-300" : "text-amber-700 dark:text-amber-300",
                    )}
                  >
                    {pass ? "Pass" : "Check"}
                  </span>
                </li>
              ))}
```

- [ ] **Step 8: Date the seeded Nguyen documents in `src/data/seed.ts`**

Add near the top, after the imports:

```ts
import { localIsoDate } from "@/lib/utils";

/** A date `days` before today, so a seeded document stays fresh or stale whatever day the demo runs. */
const isoDaysAgo = (days: number) => {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return localIsoDate(d);
};
```

In `SEED_SUBMISSION_DOCS`:
- Add `"dated": isoDaysAgo(12),` to the `PPADEP` entry, which should pass.
- Add `"dated": isoDaysAgo(131),` to the `DEALLOE` entry, which should fail. That is about four months, Alison's example.

- [ ] **Step 9: Date new uploads in `SubmissionDetail.tsx`**

Add `localIsoDate` to the `@/lib/utils` import. In `upload`, set the date with the file. In the prototype, a fresh upload reads as dated today:

```tsx
  const upload = (ref: string) =>
    setDocs((prev) =>
      prev.map((d) =>
        d.ref === ref ? { ...d, file: `${surname}_${ref}.pdf`, dated: localIsoDate(new Date()), state: "", fixNote: "" } : d,
      ),
    );
```

- [ ] **Step 10: Verify**

Run: `npm test`, `npx tsc --noEmit`, and `rg "AUTOMATED_CHECKS" src`
Expected: tests pass, no type errors, no matches left.

Manual check (Sales › My Deal Submissions, submit Nguyen, then Operations › Submission review):
- The finance LOE shows "Dated within 90 days · Dated … · 131 days old" with Check.
- The deposit passes.
- The Signed PPA shows only the three standing checks.

- [ ] **Step 11: Commit**

```bash
git add src/lib/utils.ts src/data/jobs.ts src/data/seed.ts src/components/modules/operations/submissions/ src/components/modules/sales/submissions/SubmissionDetail.tsx
git commit -m "Check each submission document's date against its own validity period"
```

---

### Task 5: Price lists for reps, and Teams on publish

Jerry: *"this pricing module, this should go to the sales [view] because salespersons are the ones reviewing this."* Alison confirmed reps need to see it. Shannan wanted *"a notification going out to the reps rather than like compiling it."*

**Files:**
- Modify: `src/components/modules/operations/pricing/data.ts` (add `RepPriceList`, `repPriceList`)
- Test: `src/components/modules/operations/pricing/data.test.ts`
- Create: `src/components/modules/sales/prices/PriceLists.tsx`
- Modify: `src/components/modules/sales/SalesScreen.tsx` (`TABS` and the pane switch)
- Modify: `src/components/shell/dashboards.ts` (Sales rail, around line 217)
- Modify: `src/components/modules/operations/formatter/data.ts` (`PUBLISH_TARGETS`, around line 122)
- Modify: `src/components/modules/operations/formatter/PriceChanges.tsx` (`publish`, around line 52)
- Modify: `src/components/modules/operations/pricing/PricingTab.tsx` (the `PageHeader` description)
- Modify: `README.md` (the Sales row of the modules table)

**Interfaces:**
- Consumes: `PRICE_LISTS`, `BuilderPriceList` from `operations/pricing/data.ts`.
- Produces: `repPriceList(p: BuilderPriceList): RepPriceList`, where `RepPriceList = { builder: string; quoteFrom: string; note: string; thisMonth: boolean }`. Also the `sales:prices` rail key.

- [ ] **Step 1: Write the failing test** `src/components/modules/operations/pricing/data.test.ts`

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { repPriceList, type BuilderPriceList } from "./data";

const list = (status: BuilderPriceList["status"], changes = 0): BuilderPriceList => ({
  builder: "Forma",
  version: "Aug 2026",
  received: "2 Aug",
  changes,
  status,
});

test("a published list is this month's, with its change count", () => {
  assert.deepEqual(repPriceList(list("Published", 9)), {
    builder: "Forma",
    quoteFrom: "Aug 2026",
    note: "9 prices changed",
    thisMonth: true,
  });
  assert.equal(repPriceList(list("Published", 0)).note, "No price changes");
  assert.equal(repPriceList(list("Published", 1)).note, "1 price changed");
});

test("a list still in review leaves reps on the previous one", () => {
  assert.deepEqual(repPriceList(list("In review", 22)), {
    builder: "Forma",
    quoteFrom: "Previous list",
    note: "Aug 2026 is being checked by Operations",
    thisMonth: false,
  });
});

test("a builder whose new PDF hasn't come keeps the version on file", () => {
  const r = repPriceList({ ...list("Awaiting PDF"), version: "Jul 2026" });
  assert.equal(r.quoteFrom, "Jul 2026");
  assert.equal(r.note, "Next list not received yet");
  assert.equal(r.thisMonth, false);
});
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `node --import tsx --test src/components/modules/operations/pricing/data.test.ts`
Expected: FAIL, `repPriceList` is not exported.

- [ ] **Step 3: Add `repPriceList` to `operations/pricing/data.ts`**

```ts
/** One builder's row in Sales › Price lists: the list a rep quotes from today. */
export interface RepPriceList {
  builder: string;
  quoteFrom: string;
  note: string;
  /** Published this month. */
  thisMonth: boolean;
}

export function repPriceList(p: BuilderPriceList): RepPriceList {
  switch (p.status) {
    case "Published":
      return {
        builder: p.builder,
        quoteFrom: p.version,
        note: p.changes ? `${p.changes} ${p.changes === 1 ? "price" : "prices"} changed` : "No price changes",
        thisMonth: true,
      };
    case "In review":
      return { builder: p.builder, quoteFrom: "Previous list", note: `${p.version} is being checked by Operations`, thisMonth: false };
    case "Awaiting PDF":
      return { builder: p.builder, quoteFrom: p.version, note: "Next list not received yet", thisMonth: false };
  }
}
```

- [ ] **Step 4: Run the test to make sure it passes**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Write `src/components/modules/sales/prices/PriceLists.tsx`**

```tsx
"use client";

import { Download, MessageSquare } from "lucide-react";
import { confirm } from "@/state/launchpad-store";
import { PageHeader } from "@/components/ui/page";
import { Card, CardHeader, CardMeta, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Pill } from "@/components/ui/pill";
import { Reveal } from "@/components/ui/reveal";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PRICE_LISTS, repPriceList } from "@/components/modules/operations/pricing/data";

/**
 * Sales › Price lists: the builder lists a rep quotes from, as Operations
 * published them from Doc formatter. Read-only; publishing stays in
 * Operations. Jerry and Ali agreed reps need it (docs/Meeting2.md).
 */
export function PriceLists() {
  const rows = PRICE_LISTS.map(repPriceList);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Price lists"
        description="The lists you quote from. Operations publishes them from Doc formatter, and Teams tells you what changed."
        actions={
          <Pill tone="neutral" icon={MessageSquare}>
            Changes posted to Teams
          </Pill>
        }
      />
      <Reveal index={0}>
        <Card className="min-w-0 overflow-hidden">
          <CardHeader className="border-b border-hairline pb-3">
            <CardTitle>Builder price lists</CardTitle>
            <CardMeta>Quote from the list shown here</CardMeta>
          </CardHeader>
          <Table className="min-w-[560px]">
            <TableHeader>
              <TableRow className="hover:bg-transparent dark:hover:bg-transparent">
                <TableHead className="pl-5">Builder</TableHead>
                <TableHead>Quote from</TableHead>
                <TableHead>What&apos;s new</TableHead>
                <TableHead className="pr-5 text-right">PDF</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.builder}>
                  <TableCell className="pl-5 font-medium">{r.builder}</TableCell>
                  <TableCell className="tabular-nums">
                    {r.quoteFrom}
                    {r.thisMonth ? (
                      <Pill tone="ok" className="ml-2">
                        This month
                      </Pill>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{r.note}</TableCell>
                  <TableCell className="pr-5 text-right">
                    <Button
                      variant="outline"
                      size="xs"
                      onClick={() => confirm(`${r.builder} price list downloaded`, `${r.quoteFrom} · PDF`)}
                    >
                      <Download aria-hidden /> PDF
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </Reveal>
    </div>
  );
}
```

- [ ] **Step 6: Add the Sales section**

In `SalesScreen.tsx`:
- Add `import { PriceLists } from "./prices/PriceLists";`.
- Make `TABS` `["overview", "pipeline", "clients", "week", "build", "costing", "prices", "submissions", "land", "team"]`.
- In the pane switch, after the `tab === "costing"` branch, add:

```tsx
          ) : tab === "prices" ? (
            <PriceLists />
```

In `dashboards.ts`, in the Sales `items`, after the `costing` line, add:

```ts
      tab("sales", "prices", "Price lists", Tags),
```

`Tags` is already imported for Operations › Pricing.

- [ ] **Step 7: Post to Teams on publish (simulated)**

In `operations/formatter/data.ts`, add a row to `PUBLISH_TARGETS`:

```ts
export const PUBLISH_TARGETS: [string, string][] = [
  ["Monday Models board", "312 model rows updated"],
  ["Branded PDF", "generated and filed to SharePoint"],
  ["Rapid costing", "picks up the new rates immediately"],
  ["Teams · Sales channel", "reps get what changed"],
];
```

In `PriceChanges.tsx` `publish`, change the message:

```ts
    const msg = "Forma August 2026 published · Monday, PDF and Teams updated";
```

In `PricingTab.tsx`, change the `PageHeader` description to:

```tsx
        description="Every list here was extracted and checked in Doc formatter, then published. Publishing writes the Monday Models board, generates the branded PDF, updates Rapid costing, emails the change report to Sean and posts what changed to the sales team in Teams."
```

In `README.md`, change the Sales row's sections to:
`pipeline` · `clients` · `week` · `build` · `costing` · `prices` · `submissions` · `land` · `team`

- [ ] **Step 8: Verify**

Run: `npm test` and `npx tsc --noEmit`
Expected: pass, no errors.

Manual check:
- The Sales rail lists "Price lists" after "Rapid costing".
- Forma and Move Homes show "This month".
- La Vida shows "Previous list".
- Publishing in Doc formatter › Price changes lists the Teams row.

- [ ] **Step 9: Commit**

```bash
git add src/components/modules/operations/pricing/ src/components/modules/sales/prices/ src/components/modules/sales/SalesScreen.tsx src/components/shell/dashboards.ts src/components/modules/operations/formatter/data.ts src/components/modules/operations/formatter/PriceChanges.tsx README.md
git commit -m "Add Sales › Price lists and a Teams post when a price list is published"
```

---

### Task 6: Employee portal invoice updates

Alison: *"if there's a way even like the rep could get a notification going, your invoice has been received, your invoice has been approved."*

**Files:**
- Create: `src/components/modules/employee/invoice-alerts.ts`
- Test: `src/components/modules/employee/invoice-alerts.test.ts`
- Modify: `src/components/modules/employee/invoice-store.ts`
- Modify: `src/components/modules/employee/EmployeeOverview.tsx` (inside the "Your invoices" card, between `</dl>` and the recent-invoices `<ul>`)
- Modify: `src/components/modules/employee/EmployeeScreen.tsx`

**Interfaces:**
- Consumes: `InvoiceStatus`, `StaffInvoice` from `./data`.
- Produces:
  - `AlertKind`, `InvoiceAlert`, `ALERT_TEXT`.
  - `alertForDecision(prev, next)`, `unreadCount(alerts)`.
  - `InvoiceState.alerts`, `markAlertsRead()`.

- [ ] **Step 1: Write the failing test** `src/components/modules/employee/invoice-alerts.test.ts`

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { ALERT_TEXT, alertForDecision, unreadCount, type InvoiceAlert } from "./invoice-alerts";

test("approving or returning an invoice tells its sender; a repeat or a reset does not", () => {
  assert.equal(alertForDecision("pending", "approved"), "approved");
  assert.equal(alertForDecision("pending", "rejected"), "rejected");
  assert.equal(alertForDecision("approved", "approved"), null);
  assert.equal(alertForDecision("approved", "pending"), null);
  assert.equal(alertForDecision("rejected", "approved"), "approved");
});

test("unread counts only what hasn't been seen", () => {
  const a = (read: boolean): InvoiceAlert => ({ id: String(read), invoiceId: "i", number: "INV-1", kind: "paid", at: 0, read });
  assert.equal(unreadCount([]), 0);
  assert.equal(unreadCount([a(false), a(true), a(false)]), 2);
});

test("each update reads as a sentence about the invoice", () => {
  assert.equal(ALERT_TEXT.received("INV-0007"), "INV-0007 received by Accounts");
  assert.equal(ALERT_TEXT.approved("INV-0007"), "INV-0007 approved · it goes in the next pay run");
  assert.equal(ALERT_TEXT.paid("INV-0007"), "INV-0007 paid");
  assert.equal(ALERT_TEXT.unpaid("INV-0007"), "Payment for INV-0007 was sent back · it's waiting to be paid again");
});
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `node --import tsx --test src/components/modules/employee/invoice-alerts.test.ts`
Expected: FAIL, `Cannot find module './invoice-alerts'`.

- [ ] **Step 3: Write `src/components/modules/employee/invoice-alerts.ts`**

```ts
import type { InvoiceStatus } from "./data";

/**
 * What a staff member hears about their own invoices: received, approved,
 * returned, paid, and a payment sent back. Ali asked for "received" and
 * "approved" on 2026-10-06 (docs/Meeting2.md).
 */
export type AlertKind = "received" | "approved" | "rejected" | "paid" | "unpaid";

export interface InvoiceAlert {
  id: string;
  invoiceId: string;
  number: string;
  kind: AlertKind;
  /** Epoch ms. */
  at: number;
  read: boolean;
}

export const ALERT_TEXT: Record<AlertKind, (number: string) => string> = {
  received: (n) => `${n} received by Accounts`,
  approved: (n) => `${n} approved · it goes in the next pay run`,
  rejected: (n) => `${n} returned by Accounts · see the note on it`,
  paid: (n) => `${n} paid`,
  unpaid: (n) => `Payment for ${n} was sent back · it's waiting to be paid again`,
};

/** The update a pay-run decision raises, or null when there's nothing new to tell. */
export function alertForDecision(prev: InvoiceStatus, next: InvoiceStatus): AlertKind | null {
  if (prev === next) return null;
  if (next === "approved") return "approved";
  if (next === "rejected") return "rejected";
  return null;
}

export const unreadCount = (alerts: InvoiceAlert[]) => alerts.filter((a) => !a.read).length;
```

- [ ] **Step 4: Run the test to make sure it passes**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Raise updates from `invoice-store.ts`**

Add the import:

```ts
import { alertForDecision, type AlertKind, type InvoiceAlert } from "./invoice-alerts";
```

Add `alerts: InvoiceAlert[];` to `InvoiceState`, with the doc comment `/** Updates on this person's invoices, newest first. */`. Change `SEED` to:

```ts
const SEED: InvoiceState = { invoices: SEED_INVOICES, sending: {}, sender: SEED_SENDER, payment: null, alerts: [] };
```

Add after `settled`:

```ts
let alertSeq = 0;
const raise = (inv: Pick<StaffInvoice, "id" | "number">, kind: AlertKind): InvoiceAlert => ({
  id: `al-${++alertSeq}`,
  invoiceId: inv.id,
  number: inv.number,
  kind,
  at: Date.now(),
  read: false,
});
```

In `sendInvoice`, make `commit` raise "received":

```ts
    commit: () => {
      setState((s) => ({ ...s, sending: settled(s, invoice.id), alerts: [raise(invoice, "received"), ...s.alerts] }));
      onSent?.();
    },
```

Replace `decideInvoices`, `payInvoices` and `unpayInvoices` with:

```ts
export function decideInvoices(ids: string[], status: InvoiceStatus, decision?: string) {
  const set = new Set(ids);
  setState((s) => {
    const raised: InvoiceAlert[] = [];
    const invoices = s.invoices.map((i) => {
      if (!set.has(i.id) || i.paid) return i;
      const kind = alertForDecision(i.status, status);
      if (kind) raised.push(raise(i, kind));
      const next: StaffInvoice = { ...i, status };
      if (decision) next.decision = decision;
      else delete next.decision;
      return next;
    });
    return { ...s, invoices, alerts: [...raised, ...s.alerts] };
  });
}

/** Accounting logged these approved invoices as paid on `on`, at a run's rate (pesos per A$1). */
export function payInvoices(ids: string[], on: string, rate: number) {
  const set = new Set(ids);
  setState((s) => {
    const raised: InvoiceAlert[] = [];
    const invoices = s.invoices.map((i) => {
      if (!set.has(i.id) || i.status !== "approved" || i.paid) return i;
      raised.push(raise(i, "paid"));
      const paid: InvoicePayment = { on, rate, php: toPhp(invoiceTotals(i.lines).total, rate) };
      return { ...i, paid, decision: paidDecision(paid) };
    });
    return { ...s, invoices, alerts: [...raised, ...s.alerts] };
  });
}

/** A payment sent back in Pay Dispatch: the invoices are approved again, not paid. */
export function unpayInvoices(ids: string[], decision: string) {
  const set = new Set(ids);
  setState((s) => {
    const raised: InvoiceAlert[] = [];
    const invoices = s.invoices.map((i) => {
      if (!set.has(i.id) || !i.paid) return i;
      raised.push(raise(i, "unpaid"));
      const next: StaffInvoice = { ...i, decision };
      delete next.paid;
      return next;
    });
    return { ...s, invoices, alerts: [...raised, ...s.alerts] };
  });
}

/** The person has seen their updates. */
export function markAlertsRead() {
  setState((s) => (s.alerts.some((a) => !a.read) ? { ...s, alerts: s.alerts.map((a) => ({ ...a, read: true })) } : s));
}
```

- [ ] **Step 6: Show updates in `EmployeeOverview.tsx`**

Make these changes to the imports:
- Add `markAlertsRead` to the `./invoice-store` import.
- Add `import { ALERT_TEXT, type InvoiceAlert } from "./invoice-alerts";`.
- `cn` is already imported. `React` should be imported as `* as React`; add it if it isn't.

Change the store read to `const { invoices, sending, sender, payment, alerts } = useInvoices();`. After it, add:

```tsx
  // Updates stay highlighted while you read them; they count as seen when you leave Overview.
  React.useEffect(() => () => markAlertsRead(), []);
```

Inside the "Your invoices" card, between `</dl>` and `<ul className="divide-y divide-hairline">`, add:

```tsx
            <InvoiceUpdates alerts={alerts} />
```

Add at the bottom of the file:

```tsx
const AT = new Intl.DateTimeFormat("en-AU", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

/** The three newest updates on your invoices; unread ones carry a dot. */
function InvoiceUpdates({ alerts }: { alerts: InvoiceAlert[] }) {
  if (alerts.length === 0) return null;
  return (
    <div className="border-b border-hairline px-5 py-3">
      <p className="mb-1.5 text-xs font-medium text-muted-foreground">Updates</p>
      <ul className="flex flex-col gap-1">
        {alerts.slice(0, 3).map((a) => (
          <li key={a.id} className="flex items-center gap-2 text-xs">
            <span aria-hidden className={cn("size-1.5 shrink-0 rounded-full", a.read ? "bg-transparent" : "bg-tone-ink")} />
            <span className={cn("min-w-0 flex-1 truncate", a.read ? "text-muted-foreground" : "font-medium")}>
              {a.read ? null : <span className="sr-only">New: </span>}
              {ALERT_TEXT[a.kind](a.number)}
            </span>
            <span className="shrink-0 text-subtle-foreground tabular-nums">{AT.format(a.at)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 7: Badge Overview in the rail from `EmployeeScreen.tsx`**

Add `import { unreadCount } from "./invoice-alerts";`. Change `const { invoices } = useInvoices();` to `const { invoices, alerts } = useInvoices();`, and add after the existing `useNavBadge` call:

```tsx
  const unread = unreadCount(alerts);
  useNavBadge("employee:overview", { count: unread, tone: "neutral", label: unread === 1 ? "invoice update" : "invoice updates" });
```

Confirm the key exists. Run `rg "overview\(\"employee\"\)" src/components/shell/dashboards.ts`; it should match. `overview()` builds the key `employee:overview`.

- [ ] **Step 8: Verify**

Run: `npm test` and `npx tsc --noEmit`
Expected: pass, no errors.

Manual check:
1. In Employee › New invoice, send an invoice and let the undo window close.
2. In Accounting › Pay run › Invoices, approve it.
3. Back in the Employee portal, Overview has a badge of 2.
4. The card shows "… approved" and "… received by Accounts" with dots.
5. Leave Overview and come back: the dots and the badge are gone.
6. Approving the same invoice again adds nothing.

- [ ] **Step 9: Commit**

```bash
git add src/components/modules/employee/
git commit -m "Tell staff when Accounts receives, approves, returns or pays their invoice"
```

---

### Task 7: Per-builder overview for Operations and Leadership

Alison: *"we've got 87 clients in pre-construction with Forma, we've got 75 in construction, we've got this many waiting formal finance"*, and *"even the management team would benefit."*

**Files:**
- Create: `src/components/modules/operations/builders.ts`
- Test: `src/components/modules/operations/builders.test.ts`
- Create: `src/components/modules/operations/BuilderBreakdown.tsx`
- Modify: `src/components/modules/operations/OperationsOverview.tsx`
- Modify: `src/components/modules/leadership/LeadershipOverview.tsx`

**Interfaces:**
- Consumes: `NO_BUILDER` from `@/data/jobs` (Task 1); `hrefForKey(key, extra)` from `@/components/shell/dashboards`. CRM dash sync already reads `?builder=` (`CrmDashSync.tsx:62`).
- Produces: `BuilderRow`, `awaitingFinance(job)`, `builderBreakdown(jobs)`, and `<BuilderBreakdown jobs index? />`.

- [ ] **Step 1: Write the failing test** `src/components/modules/operations/builders.test.ts`

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import type { Job, MilestoneStatus } from "@/data/jobs";
import { awaitingFinance, builderBreakdown } from "./builders";

const job = (builder: string, board: Job["board"], finance: MilestoneStatus = "done"): Job =>
  ({ builder, board, precon: [{ name: "Formal Finance Approval", status: finance, date: "" }] }) as Job;

test("waiting on formal finance means preconstruction with finance not done or not needed", () => {
  assert.equal(awaitingFinance(job("Forma", "sales", "open")), true);
  assert.equal(awaitingFinance(job("Forma", "sales", "prog")), true);
  assert.equal(awaitingFinance(job("Forma", "sales", "done")), false);
  assert.equal(awaitingFinance(job("Forma", "sales", "na")), false);
  assert.equal(awaitingFinance(job("Forma", "construction", "open")), false);
});

test("counts each builder's jobs, busiest first, then A to Z", () => {
  const rows = builderBreakdown([
    job("La Vida", "sales", "open"),
    job("Forma", "construction"),
    job("Forma", "sales", "open"),
    job("Forma", "sales", "done"),
    job("Move Homes", "construction"),
  ]);
  assert.deepEqual(rows, [
    { builder: "Forma", preconstruction: 2, construction: 1, awaitingFinance: 1, total: 3 },
    { builder: "La Vida", preconstruction: 1, construction: 0, awaitingFinance: 1, total: 1 },
    { builder: "Move Homes", preconstruction: 0, construction: 1, awaitingFinance: 0, total: 1 },
  ]);
});

test("no jobs, no rows; a blank builder is filed under No builder", () => {
  assert.deepEqual(builderBreakdown([]), []);
  assert.equal(builderBreakdown([job("", "sales")])[0].builder, "No builder");
});
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `node --import tsx --test src/components/modules/operations/builders.test.ts`
Expected: FAIL, `Cannot find module './builders'`.

- [ ] **Step 3: Write `src/components/modules/operations/builders.ts`**

```ts
import { NO_BUILDER, type Job } from "@/data/jobs";

/**
 * Every job per builder, for Operations and management: preconstruction,
 * construction, and how many are waiting on formal finance. Ali asked for
 * it on 2026-10-06 instead of a HubSpot report (docs/Meeting2.md).
 */
export interface BuilderRow {
  builder: string;
  preconstruction: number;
  construction: number;
  awaitingFinance: number;
  total: number;
}

const FORMAL_FINANCE = "Formal Finance Approval";

/** Still preconstruction, and formal finance is neither done nor marked not needed. */
export const awaitingFinance = (j: Job) =>
  j.board === "sales" && j.precon.some((m) => m.name === FORMAL_FINANCE && m.status !== "done" && m.status !== "na");

export function builderBreakdown(jobs: Job[]): BuilderRow[] {
  const rows = new Map<string, BuilderRow>();
  for (const j of jobs) {
    const builder = j.builder.trim() || NO_BUILDER;
    const row = rows.get(builder) ?? { builder, preconstruction: 0, construction: 0, awaitingFinance: 0, total: 0 };
    if (j.board === "construction") row.construction++;
    else row.preconstruction++;
    if (awaitingFinance(j)) row.awaitingFinance++;
    row.total++;
    rows.set(builder, row);
  }
  return [...rows.values()].sort((a, b) => b.total - a.total || a.builder.localeCompare(b.builder, "en-AU"));
}
```

- [ ] **Step 4: Run the test to make sure it passes**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Write `src/components/modules/operations/BuilderBreakdown.tsx`**

```tsx
"use client";

import Link from "next/link";
import { Building2 } from "lucide-react";
import { NO_BUILDER, type Job } from "@/data/jobs";
import { hrefForKey } from "@/components/shell/dashboards";
import { Card, CardHeader, CardMeta, CardTitle } from "@/components/ui/card";
import { Reveal } from "@/components/ui/reveal";
import { EmptyState } from "@/components/ui/states";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { builderBreakdown } from "./builders";

/**
 * By builder: each builder's jobs in preconstruction, waiting on formal finance
 * and in construction. A builder opens CRM dash sync filtered to it. Shown on
 * Operations' and Leadership's Overview.
 */
export function BuilderBreakdown({ jobs, index = 2 }: { jobs: Job[]; index?: number }) {
  const rows = builderBreakdown(jobs);

  return (
    <Reveal index={index}>
      <Card className="min-w-0 overflow-hidden">
        <CardHeader className="border-b border-hairline pb-3">
          <Building2 className="size-3.5 text-tone-ink" aria-hidden />
          <CardTitle>By builder</CardTitle>
          <CardMeta>Every job on CRM dash sync</CardMeta>
        </CardHeader>
        {rows.length === 0 ? (
          <EmptyState className="py-8" icon={Building2} title="No jobs yet" description="Jobs show here once they're on Monday." />
        ) : (
          <Table className="min-w-[520px]">
            <TableHeader>
              <TableRow className="hover:bg-transparent dark:hover:bg-transparent">
                <TableHead className="pl-5">Builder</TableHead>
                <TableHead className="text-right">Preconstruction</TableHead>
                <TableHead className="text-right">Waiting formal finance</TableHead>
                <TableHead className="text-right">Construction</TableHead>
                <TableHead className="pr-5 text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.builder}>
                  <TableCell className="pl-5 font-medium">
                    {r.builder === NO_BUILDER ? (
                      r.builder
                    ) : (
                      <Link
                        href={hrefForKey("operations:jobs", { builder: r.builder })}
                        className="rounded-sm text-tone-ink hover:underline focus-visible:ring-3 focus-visible:ring-ring/45 focus-visible:outline-none"
                      >
                        {r.builder}
                      </Link>
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{r.preconstruction}</TableCell>
                  <TableCell className="text-right tabular-nums">{r.awaitingFinance}</TableCell>
                  <TableCell className="text-right tabular-nums">{r.construction}</TableCell>
                  <TableCell className="pr-5 text-right font-semibold tabular-nums">{r.total}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </Reveal>
  );
}
```

- [ ] **Step 6: Show it on both Overviews**

In `OperationsOverview.tsx`:
- Add `import { BuilderBreakdown } from "./BuilderBreakdown";`.
- Change the self-closing `<DashboardOverview ... />` to pass a child: replace the final `/>` with `>`, then add `<BuilderBreakdown jobs={jobs} />` and `</DashboardOverview>`.

In `LeadershipOverview.tsx`:
- Add `import { BuilderBreakdown } from "@/components/modules/operations/BuilderBreakdown";`.
- It already reads `jobs` from `useLaunchpad()` (line 23). Pass `<BuilderBreakdown jobs={jobs} />` as the child the same way.

- [ ] **Step 7: Verify**

Run: `npm test` and `npx tsc --noEmit`
Expected: pass, no errors.

Manual check:
- `/operations` and `/leadership` show "By builder", with Forma and La Vida at the top.
- Clicking Forma opens `/operations?tab=jobs&builder=Forma` with the Builder filter set.

- [ ] **Step 8: Commit**

```bash
git add src/components/modules/operations/builders.ts src/components/modules/operations/builders.test.ts src/components/modules/operations/BuilderBreakdown.tsx src/components/modules/operations/OperationsOverview.tsx src/components/modules/leadership/LeadershipOverview.tsx
git commit -m "Add a per-builder job overview to Operations and Leadership"
```

---

### Task 8: Rapid costing, every discount needs a manager (Kane decides)

Skip this task if Kane drops it at approval. Alison: *"Pretty much any discount at the moment would need manager approval."*

**Files:**
- Modify: `src/components/modules/sales/costing/data.ts` (around line 51)
- Test: `src/components/modules/sales/costing/data.test.ts`
- Modify: `src/components/modules/sales/costing/RapidCosting.tsx` (line 95 and the copy at lines 398 to 403)

**Interfaces:**
- Produces: `needsManagerApproval(discount: number): boolean`.

- [ ] **Step 1: Write the failing test** `src/components/modules/sales/costing/data.test.ts`

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { needsManagerApproval } from "./data";

test("any discount needs a sales manager; none doesn't", () => {
  assert.equal(needsManagerApproval(0), false);
  assert.equal(needsManagerApproval(1), true);
  assert.equal(needsManagerApproval(5000), true);
  assert.equal(needsManagerApproval(8500), true);
});
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `node --import tsx --test src/components/modules/sales/costing/data.test.ts`
Expected: FAIL, `needsManagerApproval` is not exported.

- [ ] **Step 3: Change the rule in `costing/data.ts`**

Replace the `DISCOUNT_APPROVAL_THRESHOLD` doc comment and constant with:

```ts
/**
 * Every discount needs a sales manager's sign-off today: "Pretty much any
 * discount at the moment would need manager approval" (Ali, docs/Meeting2.md).
 * A threshold may come back after the policy session with Sean O'Neill.
 */
export const DISCOUNT_APPROVAL_THRESHOLD = 0;

export const needsManagerApproval = (discount: number) => discount > DISCOUNT_APPROVAL_THRESHOLD;
```

- [ ] **Step 4: Run the test to make sure it passes**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Use it in `RapidCosting.tsx`**

Replace `DISCOUNT_APPROVAL_THRESHOLD,` in the `./data` import with `needsManagerApproval,`. Change line 95 to:

```tsx
  const needsApproval = needsManagerApproval(discount);
```

Change the copy (lines 398 to 403) to:

```tsx
                    {needsApproval ? "Manager approval required" : "No discount"}
```

```tsx
                    {needsApproval
                      ? `A ${aud(discount)} discount needs a sales manager's sign-off before the deal can be submitted.`
                      : "No discount, so no approval is needed."}
```

Then run `rg "builder's allowance|company contribution" src/components/modules/sales/costing` and reword any remaining copy that still states a dollar threshold. The `contribution` field on `SEED_DISCOUNTS` stays: Team's approval queue still shows it.

- [ ] **Step 6: Verify**

Run: `npm test` and `npx tsc --noEmit`
Expected: pass, no errors.

Manual check (`/sales?tab=costing`): a $1,000 discount shows "Manager approval required", and $0 shows "No discount".

- [ ] **Step 7: Commit**

```bash
git add src/components/modules/sales/costing/
git commit -m "Rapid costing: every discount needs a sales manager, as Ops do today"
```

---

### Task 9: Seed spelling, final verification, and Meeting2 follow-through

**Files:**
- Modify: `src/components/modules/operations/submissions/data.ts` ("Levita" ×3)
- Modify: `docs/Meeting2.md` (Action Items statuses and "What this call means for this prototype")

- [ ] **Step 1: Spell the builder one way**

Replace each `"Levita"` with `"La Vida"` in `operations/submissions/data.ts`: two in `STATIC_QUEUE`, one in `DELIVERY_METHODS`.

Run: `rg -n "Levita" src`
Expected: no matches.

- [ ] **Step 2: Full verification**

Stop any running `npm run dev` first. Then run:

```bash
npm test
npx tsc --noEmit
npx next build
```

Expected: every test passes, no type errors, and the build completes.

Then `npm run dev` and check each changed screen in light and dark, at 375px and at desktop width. No horizontal scroll and no clipped text:
- `/sales?tab=clients`, `/sales?tab=week`, `/sales?tab=team`, `/sales?tab=prices`, `/sales?tab=costing`
- `/operations`, `/operations?tab=submissions`, `/operations?tab=formatter&view=changes`
- `/leadership`
- `/employee`

The `run` skill can launch and screenshot these.

- [ ] **Step 3: Close the loop in `docs/Meeting2.md`**

Use the date the work lands, and no em dashes.
- In "Action Items / Next Steps", change the Status cells:
  - Row 6: "Prototype done (date), on `meeting2-prototype-updates`".
  - Row 10: "Prototype done with placeholder periods (90 days). Ali to set the real ones".
  - Row 12: "Prototype done (Teams simulated)".
  - Row 14: "Per-builder overview done; pipeline formula still blocked on Ali".
  - Row 15: "Received, approved, returned, paid done; commission updates wait for commissions".
  - Row 17: "Prototype done with a placeholder 60-minute target".
- In "What this call means for this prototype (proposed, not applied)":
  - Strike through items 3 to 8 (and item 1 if Task 8 shipped) with a dated note, in the house style: `~~text~~ **Applied (date):** what changed`.
  - Leave item 2 (pipeline value) and item 9 (the Shannan persona) as they are.

- [ ] **Step 4: Commit**

```bash
git add src/components/modules/operations/submissions/data.ts docs/Meeting2.md
git commit -m "Spell La Vida consistently; record what Meeting2 changed in the prototype"
```
