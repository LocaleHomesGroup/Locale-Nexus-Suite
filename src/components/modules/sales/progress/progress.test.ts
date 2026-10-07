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
