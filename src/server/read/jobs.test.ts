import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { summariseMilestones } from "@/data/jobs";
import { migratedTestDb } from "../db/pglite";
import { addStaff } from "../db/test-fixtures";
import type { Db } from "../db/types";
import { loadJobMilestones, loadJobs } from "./jobs";

// Invented mirror data: a sales board (10), a construction board (30) and a handed-over board (20), each with a
// subitems board (11, 31, 21) whose milestone fields are mapped to the columns used below.
let db: Db;
let close: () => Promise<void>;

/** One milestone subitem: its status label, and the date it was completed when there is one. */
async function sub(id: number, board: number, parent: number, name: string, label: string | null, completed: string | null = null, createdAt = "2026-09-01T00:00:00Z") {
  const values: Record<string, unknown> = {};
  if (label) values.status = { type: "status", text: label, label, value: null };
  if (completed) values.done_on = { type: "date", text: completed, date: completed, value: null };
  await db.query(
    `insert into mirror.monday_items (id, board_id, parent_item_id, name, monday_created_at, monday_updated_at, column_values)
     values ($1, $2, $3, $4, $5, now(), $6::jsonb)`,
    [id, board, parent, name, createdAt, JSON.stringify(values)],
  );
}

before(async () => {
  ({ db, close } = await migratedTestDb());
  await addStaff(db, "test-rep-a", { department: "sales" });
  await db.query("insert into launchpad.staff_aliases (alias, staff_id) values ('test rep a', 'test-rep-a')");
  await db.query("insert into mirror.monday_workspaces (id, name) values (1, 'Test workspace')");
  await db.query(`insert into mirror.monday_boards (id, workspace_id, name, board_key, purpose, sync_enabled) values
    (10, 1, 'Test sales', 'homes_sales_wa', 'sales', true),
    (30, 1, 'Test construction', 'homes_construction_wa', 'construction', true),
    (20, 1, 'Test handed over', 'homes_handed_over_wa', 'handed_over', true)`);
  await db.query(`insert into mirror.monday_boards (id, workspace_id, name, type, parent_board_id, sync_enabled) values
    (11, 1, 'Sales subitems', 'sub_items_board', 10, true),
    (31, 1, 'Construction subitems', 'sub_items_board', 30, true),
    (21, 1, 'Handed over subitems', 'sub_items_board', 20, true)`);
  await db.query(`insert into mirror.monday_field_map (board_id, field_key, column_id) values
    (10, 'sales_rep', 'text_r'), (30, 'sales_rep', 'text_r'), (20, 'sales_rep', 'text_r'),
    (11, 'milestone_status', 'status'), (11, 'date_completed', 'done_on'),
    (31, 'milestone_status', 'status'), (31, 'date_completed', 'done_on'),
    (21, 'milestone_status', 'status'), (21, 'date_completed', 'done_on')`);
  const rep = JSON.stringify({ text_r: { type: "text", text: "TEST REP A", value: null } });
  await db.query(
    `insert into mirror.monday_items (id, board_id, name, monday_updated_at, column_values) values
     (1001, 10, 'Test Client A', now(), $1::jsonb), (1002, 30, 'Test Client B', now(), $1::jsonb),
     (1003, 10, 'Test Client C', now(), $1::jsonb), (1004, 10, 'Test Client D', now(), $1::jsonb),
     (1501, 20, 'Test Client Old', now(), $1::jsonb)`,
    [rep],
  );

  // 1001: five construction rows (two done, one in progress, one open, one not applicable) and two precon rows, one done with no date.
  await sub(2001, 11, 1001, "Builder Acceptance", "Done", null, "2026-09-01T00:01:00Z");
  await sub(2002, 11, 1001, "Contracts Signed", "Done", "2026-04-02", "2026-09-01T00:02:00Z");
  await sub(2003, 11, 1001, "Slab Down", "Done", "2026-10-01", "2026-09-01T00:03:00Z");
  await sub(2004, 11, 1001, "Date to Site", "Done", "2026-09-01", "2026-09-01T00:04:00Z");
  await sub(2005, 11, 1001, "Plate Height", "Working on it", null, "2026-09-01T00:05:00Z");
  await sub(2006, 11, 1001, "Roof Cover", "Not Started", null, "2026-09-01T00:06:00Z");
  await sub(2007, 11, 1001, "Maintenance", "N/A", null, "2026-09-01T00:07:00Z");
  // 1002: every done milestone has its date.
  await sub(3001, 31, 1002, "Date to Site", "Done", "2026-09-02");
  await sub(3002, 31, 1002, "Slab Down", "Working on it");
  await sub(3003, 31, 1002, "Contracts Signed", "Done", "2026-04-03");
  // 1003 has no milestones. 1004's one construction milestone is done with no date on file.
  await sub(3101, 11, 1004, "Slab Down", "Done");
  // 1501 is handed over: out of the list, and out of the milestone reads.
  await sub(4001, 21, 1501, "Slab Down", "Done", "2026-05-01");
});
after(async () => close());

test("loadJobs: a list job carries its summary and none of its milestones", async () => {
  const jobs = await loadJobs(db);
  assert.deepEqual(jobs.map((j) => j.id).sort(), [1001, 1002, 1003, 1004], "handed-over jobs stay out");
  for (const j of jobs) {
    assert.deepEqual(j.precon, [], `${j.id} has no preconstruction milestones in the list`);
    assert.deepEqual(j.milestones, [], `${j.id} has no construction milestones in the list`);
  }
  const progress = Object.fromEntries(jobs.map((j) => [j.id, j.progress]));
  assert.deepEqual(progress, {
    1001: { done: 2, total: 5, needsDate: true }, // Builder Acceptance is done with no date
    1002: { done: 1, total: 2, needsDate: false },
    1003: { done: 0, total: 0, needsDate: false }, // a job with no milestones
    1004: { done: 0, total: 1, needsDate: true }, // done with no date is awaiting one, not done
  });
});

test("loadJobs: a list job is still the job: its board, rep and number are there for the screens that read them", async () => {
  const jobs = await loadJobs(db);
  assert.deepEqual(
    jobs.map((j) => [j.id, j.board, j.rep]).sort(),
    [[1001, "sales", "Test Rep A"], [1002, "construction", "Test Rep A"], [1003, "sales", "Test Rep A"], [1004, "sales", "Test Rep A"]],
  );
});

test("loadJobMilestones: a job's own milestones, preconstruction and construction apart, each in its own order", async () => {
  const { precon, milestones } = await loadJobMilestones(db, 1001);
  assert.deepEqual(precon.map((m) => [m.name, m.status, m.date]), [
    ["Builder Acceptance", "pendingDate", ""],
    ["Contracts Signed", "done", "02 Apr 2026"],
  ]);
  assert.deepEqual(milestones.map((m) => [m.name, m.status, m.date]), [
    ["Date to Site", "done", "01 Sep 2026"],
    ["Slab Down", "done", "01 Oct 2026"],
    ["Plate Height", "prog", ""],
    ["Roof Cover", "open", ""],
    ["Maintenance", "na", ""],
  ]);
  const other = await loadJobMilestones(db, 1002);
  assert.deepEqual(other.milestones.map((m) => m.name), ["Date to Site", "Slab Down"], "only its own rows");
  assert.deepEqual(other.precon.map((m) => m.name), ["Contracts Signed"]);
});

test("loadJobMilestones: a job with none, a job not in the list and a job that isn't there give empty lists", async () => {
  assert.deepEqual(await loadJobMilestones(db, 1003), { precon: [], milestones: [] }, "no milestones");
  assert.deepEqual(await loadJobMilestones(db, 1501), { precon: [], milestones: [] }, "handed over");
  assert.deepEqual(await loadJobMilestones(db, 987654321), { precon: [], milestones: [] }, "unknown");
});

test("the list's summary and a job's own milestones agree, job by job (the same rows through the same mapping)", async () => {
  const jobs = await loadJobs(db);
  assert.ok(jobs.length > 0);
  for (const j of jobs) {
    const detail = await loadJobMilestones(db, j.id);
    assert.deepEqual(j.progress, summariseMilestones(detail.precon, detail.milestones), `job ${j.id}`);
  }
});

test("loadJobs: with no jobs it reads no milestones", async () => {
  const queries: string[] = [];
  const empty: Db = {
    query: async (text) => {
      queries.push(text);
      return [];
    },
    transaction: async () => {
      throw new Error("not used");
    },
  };
  assert.deepEqual(await loadJobs(empty), []);
  assert.equal(queries.length, 1, "one read, the jobs, and no second one for milestones");
});
