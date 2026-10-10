import { test } from "node:test";
import assert from "node:assert/strict";
import { jobProgress, summariseMilestones, type JobProgress, type Milestone, type MilestoneStatus } from "./jobs";

// Invented milestones: only the status and the date matter to the summary.
const m = (status: MilestoneStatus, date = ""): Milestone => ({ name: "Test step", status, date });

test("summariseMilestones: done and total count the construction milestones only", () => {
  const precon = [m("done", "01 Mar 2026"), m("done", "02 Mar 2026"), m("open")];
  const build = [m("done", "03 Apr 2026"), m("prog"), m("open"), m("na")];
  assert.deepEqual(summariseMilestones(precon, build), { done: 1, total: 4, needsDate: false });
});

test("summariseMilestones: not applicable counts toward the total but not toward done, as the pill and the Progress band have always read it", () => {
  assert.deepEqual(summariseMilestones([], [m("na"), m("na"), m("done", "03 Apr 2026")]), { done: 1, total: 3, needsDate: false });
});

test("summariseMilestones: a job with no milestones is 0 of 0 and needs no date", () => {
  assert.deepEqual(summariseMilestones([], []), { done: 0, total: 0, needsDate: false });
});

test("summariseMilestones: needsDate is the builder-date rule, over precon and construction both", () => {
  const dated = m("done", "01 Mar 2026");
  // Awaiting a date, in either list.
  assert.equal(summariseMilestones([m("pendingDate")], []).needsDate, true);
  assert.equal(summariseMilestones([], [m("pendingDate")]).needsDate, true);
  // Marked done but with no completion date on file, in either list.
  assert.equal(summariseMilestones([m("done")], []).needsDate, true);
  assert.equal(summariseMilestones([dated], [m("done", "")]).needsDate, true);
  // Done with its date, and every other status, need nothing.
  assert.equal(summariseMilestones([dated, m("prog"), m("open"), m("na")], [dated, m("prog"), m("open"), m("na")]).needsDate, false);
});

test("summariseMilestones: a milestone awaiting a date is not done, but a done one with no date is", () => {
  // pendingDate is not a done status; "done" with an empty date is, and still needs its date.
  assert.deepEqual(summariseMilestones([], [m("pendingDate"), m("done")]), { done: 1, total: 2, needsDate: true });
});

test("jobProgress: a summary on the job wins, even with empty milestone lists", () => {
  const progress: JobProgress = { done: 3, total: 8, needsDate: true };
  assert.equal(jobProgress({ progress, precon: [], milestones: [] }), progress);
});

test("jobProgress: with no summary it reads the job's own milestones, the same three values", () => {
  const precon = [m("pendingDate")];
  const milestones = [m("done", "03 Apr 2026"), m("done", "04 Apr 2026"), m("open")];
  const job = { precon, milestones };
  assert.deepEqual(jobProgress(job), summariseMilestones(precon, milestones));
  assert.deepEqual(jobProgress(job), { done: 2, total: 3, needsDate: true });
});

test("jobProgress: a job with neither a summary nor milestones is 0 of 0", () => {
  assert.deepEqual(jobProgress({ precon: [], milestones: [] }), { done: 0, total: 0, needsDate: false });
});
