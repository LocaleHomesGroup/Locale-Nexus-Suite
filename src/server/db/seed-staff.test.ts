import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { ORG_SEED } from "@/components/modules/hr/data";
import { departmentHeads, seedStaff, staffSeedRows } from "./seed-staff";
import { migratedTestDb } from "./pglite";
import type { Db } from "./types";

const rows = staffSeedRows();
const KANE = "jan-kane-reroma";

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

test("seed: Kane's seat reads as Information Technology, under Jerry", () => {
  const kane = staffSeedRows().find((r) => r.id === "jan-kane-reroma");
  assert.ok(kane);
  assert.equal(kane.department_id, "it");
  assert.equal(kane.reports_to, "jerry-delos-santos");
  assert.equal(kane.work_email, "jan@localegroup.au");
});

test("seed: every reporting line points at a seat in the same list", () => {
  const rows = staffSeedRows();
  const ids = new Set(rows.map((r) => r.id));
  assert.deepEqual(rows.filter((r) => r.reports_to && !ids.has(r.reports_to)).map((r) => r.id), []);
});

test("seed: work fields only, and no email address that isn't @localegroup.au", () => {
  const seeded = staffSeedRows();
  const emails = JSON.stringify(seeded).match(/[\w.+-]+@[\w.-]+/g) ?? [];
  assert.ok(emails.length > 0, "found no email addresses at all, so this check would pass on anything");
  // An allow-list, so a personal domain nobody thought to list is caught too. It reports a count, never the addresses.
  const stray = emails.filter((a) => !a.endsWith("@localegroup.au"));
  assert.equal(stray.length, 0, `${stray.length} email address(es) in the seed rows are not @localegroup.au`);
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

// Each edit gives one written column of Kane's seat a value the seed doesn't write for it. `vacant` is left out:
// a check ties it to `name`, so it can't change on its own, and the `name` edit covers it.
const EDITS: [column: string, set: string][] = [
  ["name", "name = name || ' (edited)'"],
  ["preferred_name", "preferred_name = 'Edited'"],
  ["role", "role = 'Edited'"],
  ["brand", "brand = 'homes'"],
  ["department_id", "department_id = 'sales'"],
  ["reports_to", "reports_to = 'adam-schaal'"],
  ["link", "link = 'peer'"],
  ["team", "team = 'Edited'"],
  ["note", "note = 'Edited'"],
  ["work_email", "work_email = 'edited@localegroup.au'"],
  ["start_date", "start_date = '2000-01-01'"],
  ["status", "status = 'inactive'"],
];

test("seed: a seat changed by hand while still org_seed is restored, and only that seat is written", async () => {
  const kane = rows.find((r) => r.id === KANE);
  for (const [column, set] of EDITS) {
    await db.query(`update launchpad.staff set ${set} where id = $1`, [KANE]);
    assert.deepEqual(await seedStaff(db, rows), { written: 1, heads: 0 }, `${column}: restored, and only that seat written`);
    const [stored] = await db.query(`select ${SELECT_WORK_FIELDS} from launchpad.staff where id = $1`, [KANE]);
    assert.deepEqual(stored, kane, `${column}: the seat is back as the seed writes it`);
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
  await db.query("update launchpad.staff set source = 'roster', role = 'Roster role' where id = $1", [KANE]);
  try {
    assert.deepEqual(await seedStaff(db, rows), { written: 0, heads: 0 });
    const [kane] = await db.query<{ role: string }>("select role from launchpad.staff where id = $1", [KANE]);
    assert.equal(kane.role, "Roster role");
  } finally {
    await db.query("update launchpad.staff set source = 'org_seed' where id = $1", [KANE]);
    await seedStaff(db, rows); // puts the seat back as the seed writes it
  }
});

test("seed: a bad manager id rolls the whole run back, and the error names the id", async () => {
  const fresh = await migratedTestDb();
  try {
    const bad = rows.map((r) => (r.id === KANE ? { ...r, reports_to: "no-such-seat" } : r));
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
