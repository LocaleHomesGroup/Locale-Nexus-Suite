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
