import { test } from "node:test";
import assert from "node:assert/strict";
import type { Job } from "@/data/jobs";
import { UNASSIGNED, clientsOf, groupByRep } from "./group-by-rep";

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

test("groupByRep: live data, with no sample order, goes A to Z and keeps Unassigned last", () => {
  const groups = groupByRep([job(1, "Test Rep B"), job(2, ""), job(3, "Test Rep A"), job(4, "Test Rep B")], []);
  assert.deepEqual(groups.map((g) => [g.rep, g.jobs.length]), [["Test Rep A", 1], ["Test Rep B", 2], [UNASSIGNED, 1]]);
});

test("clientsOf: with nobody named it is empty, even though the unassigned jobs have rep \"\"", () => {
  const jobs = [job(1, "Test Rep A"), job(2, ""), job(3, "Test Rep B"), job(4, "")];
  assert.deepEqual(clientsOf(jobs, ""), []);
});

test("clientsOf: a name gives only that rep's jobs, in the jobs' own order", () => {
  const jobs = [job(1, "Test Rep B"), job(2, "Test Rep A"), job(3, ""), job(4, "Test Rep A")];
  assert.deepEqual(clientsOf(jobs, "Test Rep A").map((j) => j.id), [2, 4]);
  assert.deepEqual(clientsOf(jobs, "Nobody Known"), []);
});
