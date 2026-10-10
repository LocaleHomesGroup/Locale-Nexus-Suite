import { test } from "node:test";
import assert from "node:assert/strict";
import type { Job, JobProgress, Milestone } from "@/data/jobs";
import { needsBuilderDate } from "./filters";

const ms = (status: Milestone["status"], date = ""): Milestone => ({ name: "Test step", status, date });
const job = (over: Partial<Job>): Job => ({ precon: [], milestones: [], ...over }) as Job;

test("needsBuilderDate: a sample job is read from its own milestones, in either list", () => {
  assert.equal(needsBuilderDate(job({ milestones: [ms("pendingDate")] })), true);
  assert.equal(needsBuilderDate(job({ precon: [ms("done")] })), true, "done with no date on file");
  assert.equal(needsBuilderDate(job({ precon: [ms("done", "01 Mar 2026")], milestones: [ms("prog"), ms("open")] })), false);
  assert.equal(needsBuilderDate(job({})), false);
});

test("needsBuilderDate: a live list job is read from its summary, though it carries no milestones", () => {
  const progress = (needsDate: boolean): JobProgress => ({ done: 0, total: 0, needsDate });
  assert.equal(needsBuilderDate(job({ progress: progress(true) })), true);
  assert.equal(needsBuilderDate(job({ progress: progress(false) })), false);
});
