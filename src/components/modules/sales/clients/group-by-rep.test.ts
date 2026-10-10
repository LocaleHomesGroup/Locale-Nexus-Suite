import { test } from "node:test";
import assert from "node:assert/strict";
import type { Job } from "@/data/jobs";
import { UNASSIGNED, buildProgress, clientsOf, filterClients, groupByRep } from "./group-by-rep";

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

test("filterClients: null rep keeps every rep, and a rep keeps only theirs, Unassigned included", () => {
  const jobs = [job(1, "Test Rep A"), job(2, " "), job(3, "Test Rep B"), job(4, "Test Rep A")];
  assert.deepEqual(filterClients(jobs, { rep: null, progress: null, query: "" }).map((j) => j.id), [1, 2, 3, 4]);
  assert.deepEqual(filterClients(jobs, { rep: "Test Rep A", progress: null, query: "" }).map((j) => j.id), [1, 4]);
  assert.deepEqual(filterClients(jobs, { rep: UNASSIGNED, progress: null, query: "" }).map((j) => j.id), [2]);
});

test("filterClients: the search matches client, job number, builder, address or rep, any case, inside the rep", () => {
  const jobs = [
    { ...job(1, "Test Rep A"), jobNo: "LH-1042", builder: "Forma", address: "12 Elm St" },
    { ...job(2, "Test Rep B"), jobNo: "", builder: "Kingsbridge", address: "4 Oak Rd" },
    { ...job(3, "Test Rep A"), jobNo: "LH-2001", builder: "Kingsbridge", address: "9 Pine Ave" },
  ];
  assert.deepEqual(filterClients(jobs, { rep: null, progress: null, query: "  kingsBRIDGE " }).map((j) => j.id), [2, 3]);
  assert.deepEqual(filterClients(jobs, { rep: null, progress: null, query: "lh-1042" }).map((j) => j.id), [1]);
  assert.deepEqual(filterClients(jobs, { rep: null, progress: null, query: "oak" }).map((j) => j.id), [2]);
  assert.deepEqual(filterClients(jobs, { rep: null, progress: null, query: "client 3" }).map((j) => j.id), [3]);
  assert.deepEqual(filterClients(jobs, { rep: null, progress: null, query: "rep b" }).map((j) => j.id), [2]);
  assert.deepEqual(filterClients(jobs, { rep: "Test Rep A", progress: null, query: "kingsbridge" }).map((j) => j.id), [3]);
});

const built = (id: number, board: "sales" | "construction", statuses: string[]): Job =>
  ({ ...job(id, "Test Rep A"), board, precon: [], milestones: statuses.map((status, i) => ({ name: `M${i}`, status, date: "" })) }) as Job;

test("buildProgress: preconstruction awaits site start; construction counts milestones, eight when Monday has none", () => {
  assert.deepEqual(buildProgress(built(1, "sales", [])), { band: "awaiting", done: 0, total: 0 });
  assert.deepEqual(buildProgress(built(2, "construction", [])), { band: "building", done: 0, total: 8 });
  assert.deepEqual(buildProgress(built(3, "construction", ["done", "open", "prog"])), { band: "building", done: 1, total: 3 });
  assert.deepEqual(buildProgress(built(4, "construction", ["done", "done"])), { band: "complete", done: 2, total: 2 });
});

test("filterClients: a progress band keeps only its clients, alongside the rep and the search", () => {
  const jobs = [
    built(1, "sales", []),
    built(2, "construction", ["done", "open"]),
    built(3, "construction", ["done"]),
    { ...built(4, "construction", ["open"]), rep: "Test Rep B" },
  ];
  assert.deepEqual(filterClients(jobs, { rep: null, progress: "awaiting", query: "" }).map((j) => j.id), [1]);
  assert.deepEqual(filterClients(jobs, { rep: null, progress: "building", query: "" }).map((j) => j.id), [2, 4]);
  assert.deepEqual(filterClients(jobs, { rep: null, progress: "complete", query: "" }).map((j) => j.id), [3]);
  assert.deepEqual(filterClients(jobs, { rep: "Test Rep A", progress: "building", query: "" }).map((j) => j.id), [2]);
  assert.deepEqual(filterClients(jobs, { rep: null, progress: "building", query: "client 4" }).map((j) => j.id), [4]);
});

// A live list job: the summary stands in for the milestones, which it doesn't carry.
const listed = (id: number, board: "sales" | "construction", done: number, total: number): Job =>
  ({ ...job(id, "Test Rep A"), board, precon: [], milestones: [], progress: { done, total, needsDate: false } }) as Job;

test("buildProgress: a live list job is read from its summary, with eight when Monday has no construction milestones", () => {
  assert.deepEqual(buildProgress(listed(1, "construction", 3, 8)), { band: "building", done: 3, total: 8 });
  assert.deepEqual(buildProgress(listed(2, "construction", 8, 8)), { band: "complete", done: 8, total: 8 });
  assert.deepEqual(buildProgress(listed(3, "construction", 2, 5)), { band: "building", done: 2, total: 5 });
  assert.deepEqual(buildProgress(listed(4, "construction", 0, 0)), { band: "building", done: 0, total: 8 });
  assert.deepEqual(buildProgress(listed(5, "sales", 0, 0)), { band: "awaiting", done: 0, total: 0 });
});

test("filterClients: the Progress bands work on live list jobs", () => {
  const jobs = [listed(1, "sales", 0, 0), listed(2, "construction", 1, 3), listed(3, "construction", 3, 3), listed(4, "construction", 0, 0)];
  assert.deepEqual(filterClients(jobs, { rep: null, progress: "awaiting", query: "" }).map((j) => j.id), [1]);
  assert.deepEqual(filterClients(jobs, { rep: null, progress: "building", query: "" }).map((j) => j.id), [2, 4]);
  assert.deepEqual(filterClients(jobs, { rep: null, progress: "complete", query: "" }).map((j) => j.id), [3]);
});
