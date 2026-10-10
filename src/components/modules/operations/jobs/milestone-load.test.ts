import { test } from "node:test";
import assert from "node:assert/strict";
import type { Job, JobProgress, Milestone } from "@/data/jobs";
import { withMilestones, type FetchedMilestones } from "./milestone-load";

const ms = (name: string, status: Milestone["status"] = "open", date = ""): Milestone => ({ name, status, date });
const progress: JobProgress = { done: 1, total: 2, needsDate: false };

// A live list job: a summary, and none of its milestones.
const listed = (id = 1001): Job => ({ id, client: "Test Client A", board: "construction", precon: [], milestones: [], progress }) as unknown as Job;
// A sample job: its own milestones, no summary.
const sample = (): Job =>
  ({ id: 1, client: "Test Client S", board: "construction", precon: [ms("Builder Acceptance", "done", "01 Mar 2026")], milestones: [ms("Slab Down")] }) as unknown as Job;

const found = (id: number, precon: Milestone[], milestones: Milestone[]): FetchedMilestones => ({ id, found: { precon, milestones } });

test("withMilestones: a sample job is as it is, ready, whatever was fetched", () => {
  const job = sample();
  assert.deepEqual(withMilestones(job, false, null), { job, load: "ready" });
  assert.equal(withMilestones(job, false, null).job, job, "the same object, so nothing re-renders");
  assert.equal(withMilestones(job, false, found(1, [], [])).job, job);
  assert.equal(withMilestones(job, false, { id: 1, found: "failed" }).load, "ready");
});

test("withMilestones: no job is no job, ready", () => {
  assert.deepEqual(withMilestones(undefined, true, null), { job: undefined, load: "ready" });
});

test("withMilestones: a live job with nothing fetched yet is loading, never 'no milestones'", () => {
  const job = listed();
  const out = withMilestones(job, true, null);
  assert.equal(out.load, "loading");
  assert.equal(out.job, job);
});

test("withMilestones: what was fetched for another job is never shown on this one", () => {
  const out = withMilestones(listed(1002), true, found(1001, [ms("Builder Acceptance", "done", "01 Mar 2026")], [ms("Slab Down")]));
  assert.equal(out.load, "loading");
  assert.deepEqual([out.job.precon, out.job.milestones], [[], []]);
  assert.equal(withMilestones(listed(1002), true, { id: 1001, found: "failed" }).load, "loading", "nor another job's failure");
});

test("withMilestones: a fetch that failed is failed, not 'no milestones'", () => {
  const out = withMilestones(listed(), true, { id: 1001, found: "failed" });
  assert.equal(out.load, "failed");
  assert.deepEqual([out.job.precon, out.job.milestones], [[], []]);
});

test("withMilestones: a fetch that came back carries its milestones onto the job, which keeps its summary", () => {
  const precon = [ms("Builder Acceptance", "done", "01 Mar 2026")];
  const milestones = [ms("Date to Site", "done", "01 Sep 2026"), ms("Slab Down")];
  const out = withMilestones(listed(), true, found(1001, precon, milestones));
  assert.equal(out.load, "ready");
  assert.equal(out.job.precon, precon);
  assert.equal(out.job.milestones, milestones);
  assert.equal(out.job.progress, progress, "the list's summary stays with the job");
  assert.equal(out.job.client, "Test Client A");
});

test("withMilestones: a fetch that came back empty is ready and empty: the one case that means 'no milestones in Monday yet'", () => {
  const out = withMilestones(listed(), true, found(1001, [], []));
  assert.equal(out.load, "ready");
  assert.deepEqual([out.job.precon, out.job.milestones], [[], []]);
});
