import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { migratedTestDb } from "./pglite";
import { addStaff } from "./test-fixtures";
import type { Db } from "./types";

let db: Db;
let close: () => Promise<void>;
before(async () => ({ db, close } = await migratedTestDb()));
after(async () => close());

test("people: the roster's eight departments are there", async () => {
  const rows = await db.query<{ id: string }>("select id from launchpad.departments order by sort");
  assert.deepEqual(rows.map((r) => r.id), [
    "leadership", "finance", "sales", "marketing", "operations", "it", "accounting", "executive",
  ]);
});

test("people: a report can be written before their manager inside one transaction", async () => {
  await db.transaction(async (tx) => {
    await addStaff(tx, "test-report", { reportsTo: "test-manager" });
    await addStaff(tx, "test-manager");
  });
  const [row] = await db.query<{ reports_to: string }>("select reports_to from launchpad.staff where id = 'test-report'");
  assert.equal(row.reports_to, "test-manager");

  // The foreign key is deferred, not dropped: the insert goes in, and a manager who
  // never turns up fails the transaction at commit.
  let inserted = false;
  await assert.rejects(
    db.transaction(async (tx) => {
      await addStaff(tx, "test-orphan", { reportsTo: "test-nobody" });
      inserted = true;
    }),
    /foreign key/i,
  );
  assert.equal(inserted, true, "the insert itself is accepted: the check waits for the commit");
  assert.deepEqual(await db.query("select id from launchpad.staff where id = 'test-orphan'"), [], "and the transaction rolled back");
});

test("people: ids are slugs, and a vacant seat has no name", async () => {
  await assert.rejects(addStaff(db, "Not A Slug"), /check/i);
  await addStaff(db, "test-vacancy", { name: null });
  // Both ways: a name on a vacant seat, and no name on a seat that isn't vacant.
  await assert.rejects(
    db.query("insert into launchpad.staff (id, name, role, vacant) values ('test-bad-vacancy', 'Someone', 'x', true)"),
    /check/i,
  );
  await assert.rejects(
    db.query("insert into launchpad.staff (id, name, role, vacant) values ('test-bad-nameless', null, 'x', false)"),
    /check/i,
  );
});

test("people: nobody reports to themselves", async () => {
  // A seat that is its own manager would send the org chart's walk up to a department head round in circles.
  await assert.rejects(addStaff(db, "test-loop", { reportsTo: "test-loop" }), /check/i);
  await addStaff(db, "test-boss");
  await addStaff(db, "test-underling", { reportsTo: "test-boss" });
  await assert.rejects(db.query("update launchpad.staff set reports_to = id where id = 'test-underling'"), /check/i);
});

test("people: updated_at moves on update", async () => {
  // Start from a past updated_at, so the test doesn't depend on the clock ticking
  // between two statements (PGlite's clock moves in whole milliseconds).
  await db.query(
    `insert into launchpad.staff (id, name, role, department_id, vacant, created_at, updated_at)
     values ('test-touch', 'Test Touch', 'Test role', 'sales', false, '2000-01-01', '2000-01-01')`,
  );
  await db.query("update launchpad.staff set role = 'Another role' where id = 'test-touch'");
  const [row] = await db.query<{ moved: boolean }>(
    "select updated_at > '2000-01-02'::timestamptz as moved from launchpad.staff where id = 'test-touch'",
  );
  assert.equal(row.moved, true);
});

test("people: departments and leave allowances keep created_at and updated_at", async () => {
  await addStaff(db, "test-head");
  await addStaff(db, "test-allowed");
  // Past timestamps again, for the same reason as above.
  await db.query(
    `insert into launchpad.departments (id, name, created_at, updated_at)
     values ('test-dept', 'Test department', '2000-01-01', '2000-01-01')`,
  );
  await db.query(
    `insert into launchpad.leave_allowances (staff_id, year, type, days, created_at, updated_at)
     values ('test-allowed', 2026, 'Vacation', 20, '2000-01-01', '2000-01-01')`,
  );
  await db.query("update launchpad.departments set head_staff_id = 'test-head' where id = 'test-dept'");
  await db.query("update launchpad.leave_allowances set days = 21 where staff_id = 'test-allowed'");
  const rows = await db.query<{ what: string; moved: boolean; kept: boolean }>(`
    select 'departments' as what, updated_at > '2000-01-02'::timestamptz as moved, created_at < '2000-01-02'::timestamptz as kept
    from launchpad.departments where id = 'test-dept'
    union all
    select 'leave_allowances', updated_at > '2000-01-02'::timestamptz, created_at < '2000-01-02'::timestamptz
    from launchpad.leave_allowances where staff_id = 'test-allowed'`);
  assert.deepEqual(rows, [
    { what: "departments", moved: true, kept: true },
    { what: "leave_allowances", moved: true, kept: true },
  ]);
  await db.query("delete from launchpad.departments where id = 'test-dept'"); // the eight stay the only departments
});

test("people: an alias is a lower-case, trimmed key, and one spelling belongs to one person", async () => {
  await addStaff(db, "test-aliased-a");
  await addStaff(db, "test-aliased-b");
  const claim = (alias: string, staffId = "test-aliased-a") =>
    db.query("insert into launchpad.staff_aliases (alias, staff_id) values ($1, $2)", [alias, staffId]);
  // A spelling's key: lower-cased and trimmed, with anything inside it left as it is.
  const [{ key }] = await db.query<{ key: string }>("select lower(btrim(' Test  O’Rep. ')) as key");
  assert.equal(key, "test  o’rep.");
  await claim(key);
  await assert.rejects(claim("Upper"), /staff_aliases_alias_check/);
  await assert.rejects(claim(" padded "), /staff_aliases_alias_check/);
  await assert.rejects(claim("   "), /staff_aliases_alias_check/);
  await assert.rejects(claim(""), /staff_aliases_alias_check/);
  await assert.rejects(claim(key, "test-aliased-b"), /staff_aliases_pkey/);
});

test("leave: Other needs a note, and a request can't end before it starts", async () => {
  await addStaff(db, "test-leaver");
  const file = (type: string, start: string, end: string, note: string | null) =>
    db.query(
      `insert into launchpad.leave_requests (staff_id, type, starts_on, ends_on, days, note)
       values ('test-leaver', $1, $2, $3, 1, $4)`,
      [type, start, end, note],
    );
  await assert.rejects(file("Other", "2026-10-12", "2026-10-12", null), /check/i);
  await assert.rejects(file("Vacation", "2026-10-12", "2026-10-09", null), /check/i);
  await file("Other", "2026-10-12", "2026-10-12", "Moving house");
  await file("Vacation", "2026-10-13", "2026-10-14", null);
});

test("pay: one current payment method per person", async () => {
  await addStaff(db, "test-payee");
  const add = (current = true) =>
    db.query(
      "insert into launchpad.payment_methods (staff_id, processor, details, is_current) values ('test-payee', 'wise', $1::jsonb, $2)",
      [JSON.stringify({ email: "payee@example.com", accountName: "Test Payee" }), current],
    );
  await add();
  await assert.rejects(add(), /payment_methods_current|unique/i);
  // Past methods are kept: rows that aren't current can pile up beside the one that is.
  await add(false);
  await add(false);
});

test("pay: an invoice is paid exactly when it has a paid date", async () => {
  await addStaff(db, "test-invoicer");
  const insert = (status: string, paidOn: string | null) =>
    db.query(
      `insert into launchpad.staff_invoices (staff_id, number, issued_on, sender, status, paid_on)
       values ('test-invoicer', $1, '2026-10-04', '{}'::jsonb, $2, $3)`,
      [`test-${status}-${paidOn ?? "none"}`, status, paidOn],
    );
  await assert.rejects(insert("paid", null), /check/i);
  await assert.rejects(insert("pending", "2026-10-07"), /check/i);
  await insert("paid", "2026-10-07");
});

test("pay: an invoice number is unique per sender, and a person has one live invoice per pay week", async () => {
  await addStaff(db, "test-sender-a");
  await addStaff(db, "test-sender-b");
  const send = (staffId: string, number: string, week: string | null) =>
    db.query<{ id: string }>(
      `insert into launchpad.staff_invoices (staff_id, number, issued_on, pay_week_start, sender)
       values ($1, $2, '2026-10-04', $3, '{}'::jsonb) returning id`,
      [staffId, number, week],
    );
  const [first] = await send("test-sender-a", "INV-001", "2026-09-27");
  // Another person's identical number (and week) is a different invoice.
  await send("test-sender-b", "INV-001", "2026-09-27");
  // The same person can't reuse a live number, or bill a week twice. The quotes pin the constraint's whole name.
  await assert.rejects(send("test-sender-a", "INV-001", "2026-10-04"), /"staff_invoices_number"/);
  await assert.rejects(send("test-sender-a", "INV-002", "2026-09-27"), /"staff_invoices_week"/);
  // Retracting frees both, as it does in the Employee portal. The retracted row stays, and no longer blocks.
  await db.query("update launchpad.staff_invoices set status = 'retracted' where id = $1", [first.id]);
  await send("test-sender-a", "INV-001", "2026-09-27");
  const kept = await db.query<{ status: string }>(
    "select status from launchpad.staff_invoices where staff_id = 'test-sender-a' and number = 'INV-001' order by status",
  );
  assert.deepEqual(kept.map((r) => r.status), ["pending", "retracted"]);
  // A one-off invoice bills no week, so those can repeat.
  await send("test-sender-a", "INV-003", null);
  await send("test-sender-a", "INV-004", null);
});

test("pay: a currency is a three-letter upper-case code", async () => {
  await addStaff(db, "test-currency");
  let n = 0;
  // Each insert is otherwise valid, so the currency is the only thing that can refuse it.
  const inserts: Record<string, (currency: string) => Promise<unknown>> = {
    pay_rates: (currency) =>
      db.query(
        "insert into launchpad.pay_rates (staff_id, hourly, overtime, currency, effective_from) values ('test-currency', 30, 45, $1, $2)",
        [currency, `2026-01-${String(++n).padStart(2, "0")}`],
      ),
    one_off_payments: (currency) =>
      db.query(
        "insert into launchpad.one_off_payments (staff_id, kind, amount, currency, pay_on) values ('test-currency', 'bonus', 100, $1, '2026-10-10')",
        [currency],
      ),
    staff_invoices: (currency) =>
      db.query(
        "insert into launchpad.staff_invoices (staff_id, number, issued_on, sender, currency) values ('test-currency', $1, '2026-10-04', '{}'::jsonb, $2)",
        [`test-currency-${++n}`, currency],
      ),
  };
  const taken: string[] = [];
  for (const [table, insert] of Object.entries(inserts)) {
    for (const bad of ["aud", "Aud", "AU"]) {
      const refused = await insert(bad).then(
        () => false,
        (e: Error) => /currency_check/.test(e.message),
      );
      if (!refused) taken.push(`${table} took ${JSON.stringify(bad)}`);
    }
    await insert("AUD");
    await insert("USD");
  }
  assert.deepEqual(taken, []);
});

test("pay: a payout is paid exactly when it has a sent date", async () => {
  await addStaff(db, "test-paid-a");
  await addStaff(db, "test-pending-b");
  await addStaff(db, "test-problem-c");
  const [run] = await db.query<{ id: string }>(
    "insert into launchpad.pay_runs (run_on, fx_rate) values ('2026-10-09', 38.5) returning id",
  );
  const payout = (staffId: string, status: string, sentOn: string | null) =>
    db.query(
      `insert into launchpad.payouts (pay_run_id, staff_id, aud, php, method, status, sent_on)
       values ($1, $2, 200, 7700, '{}'::jsonb, $3, $4)`,
      [run.id, staffId, status, sentOn],
    );
  await assert.rejects(payout("test-paid-a", "paid", null), /check/i);
  await assert.rejects(payout("test-paid-a", "pending", "2026-10-09"), /check/i);
  await assert.rejects(payout("test-paid-a", "problem", "2026-10-09"), /check/i);
  await payout("test-paid-a", "paid", "2026-10-09");
  await payout("test-pending-b", "pending", null);
  await payout("test-problem-c", "problem", null);
  // Sending a payment back clears the status and the date together; changing one alone is refused.
  await db.query("update launchpad.payouts set status = 'pending', sent_on = null where staff_id = 'test-paid-a'");
  await assert.rejects(db.query("update launchpad.payouts set status = 'paid' where staff_id = 'test-pending-b'"), /check/i);
});

test("pay: a pay run with payouts can't be deleted, but a draft with none can", async () => {
  await addStaff(db, "test-run-payee");
  const newRun = async (runOn: string) =>
    (
      await db.query<{ id: string }>("insert into launchpad.pay_runs (run_on, fx_rate) values ($1, 38.5) returning id", [runOn])
    )[0].id;
  const count = async (table: string, runId: string) =>
    (await db.query<{ n: number }>(`select count(*)::int as n from launchpad.${table} where ${table === "pay_runs" ? "id" : "pay_run_id"} = $1`, [runId]))[0].n;

  const sent = await newRun("2026-10-23");
  await db.query(
    "insert into launchpad.payouts (pay_run_id, staff_id, aud, php, method) values ($1, 'test-run-payee', 200, 7700, '{}'::jsonb)",
    [sent],
  );
  await assert.rejects(db.query("delete from launchpad.pay_runs where id = $1", [sent]), /foreign key/i);
  assert.equal(await count("pay_runs", sent), 1);
  assert.equal(await count("payouts", sent), 1);

  // A draft has no payouts: it goes, taking its holds with it.
  const draft = await newRun("2026-10-30");
  await db.query("insert into launchpad.pay_run_holds (pay_run_id, staff_id, reason) values ($1, 'test-run-payee', 'Test hold')", [draft]);
  await db.query("delete from launchpad.pay_runs where id = $1", [draft]);
  assert.equal(await count("pay_runs", draft), 0);
  assert.equal(await count("pay_run_holds", draft), 0);
});
