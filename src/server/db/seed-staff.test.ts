import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { EMPLOYEE_RECORDS, ORG_SEED, orgDepartmentOf } from "@/components/modules/hr/data";
import { departmentHeads, seedStaff, staffSeedRows, type StaffSeedRow } from "./seed-staff";
import { migratedTestDb } from "./pglite";
import type { Db } from "./types";

/**
 * The seed is the real org chart, but no test here names anyone in it (tests use invented data): a seat is picked by
 * what it holds, and what is checked is how every seat maps, not who sits where.
 */
const rows = staffSeedRows();

/** The company's own domain: every work email the seed carries is at it. */
const COMPANY_DOMAIN = "@localegroup.au";

/**
 * The seat the tests below edit, picked by its properties: filled, with a manager, and holding none of the values the
 * edits write, so that each edit changes something.
 */
const PICKED = rows.find(
  (r) => !r.vacant && r.reports_to !== null && r.brand !== "homes" && r.department_id !== "sales" && r.link !== "peer",
);
function seat(): StaffSeedRow {
  assert.ok(PICKED, "the chart has no filled seat with a manager outside Sales and Homes, so these tests can't run");
  return PICKED;
}

/** Every field a seed row may carry. A new one (a mobile number, a birthday, a remark) has to be added here on purpose. */
const WORK_FIELDS = [
  "brand", "department_id", "id", "link", "name", "note", "preferred_name",
  "reports_to", "role", "start_date", "status", "team", "vacant", "work_email",
];
const SELECT_WORK_FIELDS = WORK_FIELDS.map((f) => (f === "start_date" ? "start_date::text as start_date" : f)).join(", ");

let db: Db;
let close: () => Promise<void>;
let first: { written: number; heads: number };
// One database for the file, seeded once. A test that changes it puts it back.
before(async () => {
  ({ db, close } = await migratedTestDb());
  first = await seedStaff(db, rows);
});
after(async () => close());

test("seed: each seat takes its department, manager and work email from the chart and its employee record", () => {
  // The chart's departments by the roster's ids: "AI & Growth" is Information Technology, "Accounts" is Accounting.
  const rosterId: Record<string, string> = { ai: "it", accounts: "accounting" };
  for (const p of ORG_SEED) {
    const row = rows.find((r) => r.id === p.id);
    const chart = orgDepartmentOf(ORG_SEED, p.id);
    assert.deepEqual(
      { department: row?.department_id, manager: row?.reports_to, email: row?.work_email },
      { department: rosterId[chart] ?? chart, manager: p.managerId, email: EMPLOYEE_RECORDS[p.id]?.workEmail ?? null },
      `seat ${p.id}`,
    );
  }
  // Positive controls: the renamed departments have seats, and some seats have managers and work emails.
  assert.ok(rows.some((r) => r.department_id === "it") && rows.some((r) => r.department_id === "accounting"));
  assert.ok(rows.some((r) => r.reports_to !== null), "no seat has a manager, so the check above proves little");
  assert.ok(rows.some((r) => r.work_email !== null), "no seat has a work email, so the check above proves little");
});

test("seed: once stored, staff have work emails at the company domain, every manager is a staff row, and every department has its head", async () => {
  const stored = await db.query<{ id: string; reports_to: string | null; work_email: string | null }>(
    "select id, reports_to, work_email from launchpad.staff",
  );
  assert.ok(stored.some((s) => s.work_email?.endsWith(COMPANY_DOMAIN)), `no stored seat has a work email at ${COMPANY_DOMAIN}`);
  const ids = new Set(stored.map((s) => s.id));
  const managed = stored.filter((s) => s.reports_to !== null);
  assert.ok(managed.length > 0, "no stored seat has a manager, so this proves nothing");
  assert.deepEqual(managed.filter((s) => !ids.has(s.reports_to ?? "")).map((s) => s.id), [], "a manager id with no staff row");

  const heads = await db.query<{ id: string; head: string | null }>("select id, head_staff_id as head from launchpad.departments");
  const headOf = new Map(heads.map((d) => [d.id, d.head]));
  for (const d of departmentHeads()) {
    assert.equal(headOf.get(d.id), d.head, `the head of ${d.id} is set, as the chart has it`);
    assert.ok(ids.has(d.head), `the head of ${d.id} is a staff row`);
  }
});

test("seed: every reporting line points at a seat in the same list", () => {
  const rows = staffSeedRows();
  const ids = new Set(rows.map((r) => r.id));
  assert.deepEqual(rows.filter((r) => r.reports_to && !ids.has(r.reports_to)).map((r) => r.id), []);
});

test(`seed: work fields only, and no email address that isn't ${COMPANY_DOMAIN}`, () => {
  const seeded = staffSeedRows();
  const emails = JSON.stringify(seeded).match(/[\w.+-]+@[\w.-]+/g) ?? [];
  assert.ok(emails.length > 0, "found no email addresses at all, so this check would pass on anything");
  // An allow-list, so a personal domain nobody thought to list is caught too. It reports a count, never the addresses.
  const stray = emails.filter((a) => !a.endsWith(COMPANY_DOMAIN));
  assert.equal(stray.length, 0, `${stray.length} email address(es) in the seed rows are not ${COMPANY_DOMAIN}`);
  for (const r of seeded) assert.deepEqual(Object.keys(r).sort(), WORK_FIELDS, `the fields of seat ${r.id}`);
});

test("seed: departments map to the roster's ids", () => {
  const ids = departmentHeads().map((d) => d.id);
  assert.ok(ids.includes("it") && ids.includes("accounting"));
  assert.ok(!ids.includes("ai") && !ids.includes("accounts"));
});

test("seed: the first run writes every seat and fills every department head", async () => {
  assert.equal(first.written, rows.length);
  assert.equal(first.heads, departmentHeads().length);
  const [{ n }] = await db.query<{ n: number }>("select count(*)::int as n from launchpad.staff");
  assert.equal(n, rows.length);
});

test("seed: the two vacant seats have no name, are vacant and pending, and no other seat is", async () => {
  const vacant = ORG_SEED.filter((p) => p.name === null).map((p) => p.id).sort();
  assert.equal(vacant.length, 2);
  const stored = await db.query(
    "select id, name, vacant, status from launchpad.staff where vacant or name is null or status <> 'active' order by id",
  );
  assert.deepEqual(stored, vacant.map((id) => ({ id, name: null, vacant: true, status: "pending" })));
});

test("seed: a seat with two brands keeps the first", async () => {
  const two = ORG_SEED.filter((p) => (p.brands?.length ?? 0) > 1);
  assert.ok(two.length > 0, "the chart has no seat with two brands, so this proves nothing");
  const stored = await db.query<{ id: string; brand: string | null }>("select id, brand from launchpad.staff");
  const brandOf = new Map(stored.map((r) => [r.id, r.brand]));
  for (const p of two) assert.equal(brandOf.get(p.id), p.brands?.[0], `the brand of seat ${p.id}`);
});

test("seed: an identical re-run writes nothing and leaves updated_at alone", async () => {
  const stamps = () =>
    db.query<{ id: string; updated_at: string }>("select id, updated_at::text as updated_at from launchpad.staff order by id");
  const stamped = await stamps();
  await new Promise((resolve) => setTimeout(resolve, 20)); // PGlite's clock moves in whole milliseconds: a rewrite must land on a later one
  const again = await seedStaff(db, rows);
  const moved = (await stamps()).filter((s, i) => s.updated_at !== stamped[i].updated_at);
  assert.equal(moved.length, 0, `${moved.length} seat(s) had updated_at moved by a re-run that changed nothing`);
  assert.deepEqual(again, { written: 0, heads: 0 });
});

/**
 * Edits that each give one written column of the seat a value the seed doesn't write for it. `vacant` is left out: a
 * check ties it to `name`, so it can't change on its own, and the `name` edit covers it.
 */
function editsOf(s: StaffSeedRow): [column: string, set: string][] {
  // Another seat to report to: neither the seat itself nor its manager now. Seat ids are plain slugs (the table checks).
  const otherManager = rows.find((r) => r.id !== s.id && r.id !== s.reports_to)?.id;
  assert.ok(otherManager, "no other seat to report to");
  return [
    ["name", "name = name || ' (edited)'"],
    ["preferred_name", "preferred_name = 'Edited'"],
    ["role", "role = 'Edited'"],
    ["brand", "brand = 'homes'"],
    ["department_id", "department_id = 'sales'"],
    ["reports_to", `reports_to = '${otherManager}'`],
    ["link", "link = 'peer'"],
    ["team", "team = 'Edited'"],
    ["note", "note = 'Edited'"],
    ["work_email", "work_email = 'edited@example.com'"],
    ["start_date", "start_date = '2000-01-01'"],
    ["status", "status = 'inactive'"],
  ];
}

test("seed: a seat changed by hand while still org_seed is restored, and only that seat is written", async () => {
  const s = seat();
  for (const [column, set] of editsOf(s)) {
    await db.query(`update launchpad.staff set ${set} where id = $1`, [s.id]);
    assert.deepEqual(await seedStaff(db, rows), { written: 1, heads: 0 }, `${column}: restored, and only that seat written`);
    const [stored] = await db.query(`select ${SELECT_WORK_FIELDS} from launchpad.staff where id = $1`, [s.id]);
    assert.deepEqual(stored, s, `${column}: the seat is back as the seed writes it`);
  }
});

test("seed: department heads are fill-only: one set by hand survives a re-seed, and an empty one is filled", async () => {
  const [kept, emptied] = departmentHeads();
  const elsewhere = rows.find((r) => r.id !== kept.head)!.id;
  await db.query("update launchpad.departments set head_staff_id = $1 where id = $2", [elsewhere, kept.id]);
  await db.query("update launchpad.departments set head_staff_id = null where id = $1", [emptied.id]);
  try {
    const again = await seedStaff(db, rows);
    const stored = await db.query<{ id: string; head: string | null }>(
      "select id, head_staff_id as head from launchpad.departments",
    );
    const headOf = new Map(stored.map((d) => [d.id, d.head]));
    assert.equal(headOf.get(kept.id), elsewhere, "a head changed by hand is kept");
    assert.equal(headOf.get(emptied.id), emptied.head, "an empty head is filled from the chart");
    assert.deepEqual(again, { written: 0, heads: 1 });
  } finally {
    for (const d of [kept, emptied]) {
      await db.query("update launchpad.departments set head_staff_id = $1 where id = $2", [d.head, d.id]);
    }
  }
});

test("seed: a seat the roster owns is left alone", async () => {
  const { id } = seat();
  await db.query("update launchpad.staff set source = 'roster', role = 'Roster role' where id = $1", [id]);
  try {
    assert.deepEqual(await seedStaff(db, rows), { written: 0, heads: 0 });
    const [stored] = await db.query<{ role: string }>("select role from launchpad.staff where id = $1", [id]);
    assert.equal(stored.role, "Roster role");
  } finally {
    await db.query("update launchpad.staff set source = 'org_seed' where id = $1", [id]);
    await seedStaff(db, rows); // puts the seat back as the seed writes it
  }
});

test("seed: a bad manager id rolls the whole run back, and the error names the id", async () => {
  const fresh = await migratedTestDb();
  try {
    const bad = rows.map((r) => (r.id === seat().id ? { ...r, reports_to: "no-such-seat" } : r));
    const error = await seedStaff(fresh.db, bad).then(
      () => null,
      (e: unknown) => e as { message: string; detail?: string },
    );
    assert.ok(error, "the run should have been refused");
    assert.match(error.message, /foreign key/i);
    assert.match(error.detail ?? "", /no-such-seat/, "the database's detail names the id that has no seat");
    assert.deepEqual(await fresh.db.query("select id from launchpad.staff"), [], "no seat from that run was kept");
    assert.deepEqual(
      await fresh.db.query("select id from launchpad.departments where head_staff_id is not null"),
      [],
      "and no head",
    );
  } finally {
    await fresh.close();
  }
});
