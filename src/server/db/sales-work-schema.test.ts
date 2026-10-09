import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { migratedTestDb } from "./pglite";
import { addStaff } from "./test-fixtures";
import type { Db } from "./types";

let db: Db;
let close: () => Promise<void>;
before(async () => {
  ({ db, close } = await migratedTestDb());
  await addStaff(db, "test-rep-a");
});
after(async () => close());

/** What Postgres says when a row breaks a named constraint. The name pins which one, so another can't satisfy a test. */
const breaks = {
  check: (name: string) => new RegExp(`violates check constraint "${name}"`),
  unique: (name: string) => new RegExp(`violates unique constraint "${name}"`),
  foreignKey: (name: string) => new RegExp(`violates foreign key constraint "${name}"`),
  notNull: (table: string, column: string) => new RegExp(`null value in column "${column}" of relation "${table}"`),
};

test("quotes: numbered HS-1001 upward, and never without a rep", async () => {
  const add = (by: string | null) =>
    db.query<{ number: string }>(
      "insert into launchpad.quotes (prepared_by, builder, estimate) values ($1, 'Test Builder', '{}'::jsonb) returning number",
      [by],
    );
  assert.equal((await add("test-rep-a"))[0].number, "HS-1001");
  assert.equal((await add("test-rep-a"))[0].number, "HS-1002");
  await assert.rejects(add(null), breaks.notNull("quotes", "prepared_by"));
});

test("submissions: a document sent back for a fix says why, and each ref appears once", async () => {
  const [s] = await db.query<{ id: string; number: string }>(
    "insert into launchpad.submissions (client_label, builder) values ('Test Client A', 'Test Builder') returning id, number",
  );
  assert.equal(s.number, "S-200");
  // Every state but 'missing' has its file, so the only check that can refuse these rows is the one under test.
  const doc = (ref: string, state: string, note: string | null) =>
    db.query(
      `insert into launchpad.submission_documents (submission_id, ref, category, name, state, fix_note, file_path)
       values ($1, $2, 'build', 'Test document', $3, $4, $5)`,
      [s.id, ref, state, note, state === "missing" ? null : `test/${ref}.pdf`],
    );
  await assert.rejects(doc("DOC1", "fix", null), breaks.check("submission_documents_fix_note"));
  await doc("DOC1", "fix", "Unsigned on the last page");
  await assert.rejects(doc("DOC1", "uploaded", null), breaks.unique("submission_documents_submission_id_ref_key"));
});

test("sales: one team-wide target per period, even with no rep", async () => {
  const add = () =>
    db.query("insert into launchpad.sales_targets (staff_id, period, period_start, target) values (null, 'month', '2026-10-01', 2)");
  await add();
  await assert.rejects(add(), breaks.unique("sales_targets_staff_id_period_period_start_key"));
});

test("tickets: numbered from 100, with the board's priorities only", async () => {
  const add = (priority: string) =>
    db.query<{ ticket_no: number }>(
      "insert into launchpad.tickets (title, raised_by, priority) values ('Test ticket', 'Test Rep A', $1) returning ticket_no",
      [priority],
    );
  assert.equal((await add("high"))[0].ticket_no, 100);
  assert.equal((await add("urgent"))[0].ticket_no, 101);
  await assert.rejects(add("someday"), breaks.check("tickets_priority_check"));
});

test("notifications: a dedupe key is written once", async () => {
  const add = () =>
    db.query(
      "insert into launchpad.notifications (recipient, event, message, dedupe_key) values ('test-rep-a', 'test', 'Hello', 'test:1')",
    );
  await add();
  await assert.rejects(add(), breaks.unique("notifications_dedupe_key_key"));
});

test("notifications: on conflict do nothing on the dedupe key leaves one row, and a new key adds one", async () => {
  // How the notification writer sends: a repeat of a key is skipped and returns no row.
  const send = (message: string, key: string) =>
    db.query<{ id: string }>(
      `insert into launchpad.notifications (recipient, event, message, dedupe_key)
       values ('test-rep-a', 'test', $1, $2)
       on conflict (dedupe_key) do nothing
       returning id`,
      [message, key],
    );
  assert.equal((await send("First", "test:dedupe-1")).length, 1);
  assert.equal((await send("Second", "test:dedupe-1")).length, 0, "the repeat is skipped");
  assert.equal((await send("Third", "test:dedupe-2")).length, 1, "a different key is a new notification");
  const rows = await db.query<{ message: string }>(
    "select message from launchpad.notifications where dedupe_key like 'test:dedupe-%' order by message",
  );
  assert.deepEqual(rows.map((r) => r.message), ["First", "Third"]);
});

test("homescope: one current catalogue per builder, so the old one is retired before the new one goes in", async () => {
  const add = (builder: string, current = true) =>
    db.query(
      "insert into launchpad.homescope_catalogues (builder, captured_at, source, data, is_current) values ($1, now(), 'snapshot', '{}'::jsonb, $2)",
      [builder, current],
    );
  await add("Test Builder A");
  await assert.rejects(add("Test Builder A"), breaks.unique("homescope_catalogues_current"));
  // Another builder has its own current catalogue, and past ones are unlimited.
  await add("Test Builder B");
  await add("Test Builder A", false);
  await add("Test Builder A", false);
  // Retire the old one first, and the new current one is accepted.
  await db.transaction(async (tx) => {
    await tx.query("update launchpad.homescope_catalogues set is_current = false where builder = 'Test Builder A' and is_current");
    await tx.query(
      "insert into launchpad.homescope_catalogues (builder, captured_at, source, data) values ('Test Builder A', now(), 'monday', '[]'::jsonb)",
    );
  });
  const rows = await db.query<{ builder: string; n: number }>(
    "select builder, count(*)::int as n from launchpad.homescope_catalogues where is_current group by builder order by builder",
  );
  assert.deepEqual(rows, [
    { builder: "Test Builder A", n: 1 },
    { builder: "Test Builder B", n: 1 },
  ]);
});

test("it desk: numbered from 1 on its own, with three priorities and not the board's urgent", async () => {
  const add = (priority: string) =>
    db.query<{ ticket_no: number }>(
      "insert into launchpad.it_tickets (category, summary, requester, priority) values ('Access', 'Test summary', 'Test Rep A', $1) returning ticket_no",
      [priority],
    );
  assert.equal((await add("low"))[0].ticket_no, 1, "the desk's own first number, not the board's 100");
  assert.equal((await add("high"))[0].ticket_no, 2);
  await assert.rejects(add("urgent"), breaks.check("it_tickets_priority_check"));
});

test("commission rules: the buyer type is retail or wholesale, so a spelling can't dodge the unique key", async () => {
  const add = (buyerType: string, from = "2026-10-01") =>
    db.query("insert into launchpad.commission_rules (buyer_type, base_amount, effective_from) values ($1, 1000, $2)", [buyerType, from]);
  await add("retail");
  await add("wholesale");
  await assert.rejects(add("Retail"), breaks.check("commission_rules_buyer_type_check"));
  await assert.rejects(add("retail"), breaks.unique("commission_rules_buyer_type_effective_from_key"));
  await add("retail", "2027-01-01");
});

test("commission rules: a rule records who set it, and that is a member of staff", async () => {
  const add = (from: string, setBy: string | null) =>
    db.query("insert into launchpad.commission_rules (buyer_type, base_amount, effective_from, set_by) values ('wholesale', 1000, $1, $2)", [
      from,
      setBy,
    ]);
  await add("2028-01-01", "test-rep-a");
  await add("2028-02-01", null);
  await assert.rejects(add("2028-03-01", "test-nobody"), breaks.foreignKey("commission_rules_set_by_fkey"));
});

test("knowledge: a material's category is one of the module's five, stored as its slug", async () => {
  const add = (category: string) =>
    db.query("insert into launchpad.knowledge_materials (category, title, kind) values ($1, 'Test material', 'doc')", [category]);
  for (const slug of ["sops", "builders", "training", "security", "systems"]) await add(slug);
  // The display name isn't the slug, and a sixth category isn't one of the five.
  await assert.rejects(add("Builder guides"), breaks.check("knowledge_materials_category_check"));
  await assert.rejects(add("onboarding"), breaks.check("knowledge_materials_category_check"));
});

test("tickets: a reply can't be blank", async () => {
  const [t] = await db.query<{ id: string }>("insert into launchpad.tickets (title, raised_by) values ('Test ticket', 'Test Rep A') returning id");
  const reply = (body: string) =>
    db.query("insert into launchpad.ticket_replies (ticket_id, author, body) values ($1, 'Test Rep A', $2)", [t.id, body]);
  await reply("On it");
  await assert.rejects(reply("   "), breaks.check("ticket_replies_body_check"));
  await assert.rejects(reply(""), breaks.check("ticket_replies_body_check"));
});

test("submissions: a document has its file in every state but missing", async () => {
  const [s] = await db.query<{ id: string }>(
    "insert into launchpad.submissions (client_label, builder) values ('Test Client B', 'Test Builder') returning id",
  );
  const doc = (ref: string, state: string, file: string | null) =>
    db.query(
      `insert into launchpad.submission_documents (submission_id, ref, category, name, state, fix_note, file_path)
       values ($1, $2, 'land', 'Test document', $3, 'Test note', $4)`,
      [s.id, ref, state, file],
    );
  const fileMatchesState = breaks.check("submission_documents_file_matches_state");
  await doc("A", "missing", null);
  await doc("B", "uploaded", "test/b.pdf");
  await doc("C", "verified", "test/c.pdf");
  await doc("D", "fix", "test/d.pdf");
  await assert.rejects(doc("E", "missing", "test/e.pdf"), fileMatchesState);
  await assert.rejects(doc("F", "uploaded", null), fileMatchesState);
  await assert.rejects(doc("G", "verified", null), fileMatchesState);
  await assert.rejects(doc("H", "fix", null), fileMatchesState);
  // Dropping a file means going back to missing, in the same step.
  const ref = (r: string) => [s.id, r];
  await assert.rejects(
    db.query("update launchpad.submission_documents set file_path = null where submission_id = $1 and ref = $2", ref("B")),
    fileMatchesState,
  );
  await db.query("update launchpad.submission_documents set state = 'missing', file_path = null where submission_id = $1 and ref = $2", ref("B"));
});

// Rows people create and edit keep created_at, and updated_at moves when they change. Each row starts in 2000, so
// the test doesn't depend on the clock ticking between two statements.
const edited: { table: string; insert: () => Promise<unknown>; set: string }[] = [
  {
    table: "commission_rules",
    insert: () =>
      db.query(
        `insert into launchpad.commission_rules (buyer_type, base_amount, effective_from, created_at, updated_at)
         values ('wholesale', 3200, '2030-01-01', '2000-01-01', '2000-01-01')`,
      ),
    set: "note = 'Changed'",
  },
  {
    table: "submission_documents",
    insert: async () => {
      const [s] = await db.query<{ id: string }>(
        "insert into launchpad.submissions (client_label, builder) values ('Test Client C', 'Test Builder') returning id",
      );
      await db.query(
        `insert into launchpad.submission_documents (submission_id, ref, category, name, created_at, updated_at)
         values ($1, 'DOC1', 'build', 'Test document', '2000-01-01', '2000-01-01')`,
        [s.id],
      );
    },
    set: "name = 'Changed'",
  },
  {
    table: "sales_targets",
    insert: () =>
      db.query(
        `insert into launchpad.sales_targets (staff_id, period, period_start, target, created_at, updated_at)
         values ('test-rep-a', 'quarter', '2026-07-01', 3, '2000-01-01', '2000-01-01')`,
      ),
    set: "target = 4",
  },
  {
    table: "ticket_projects",
    insert: () =>
      db.query(
        `insert into launchpad.ticket_projects (id, name, created_at, updated_at)
         values ('test-project', 'Test Project', '2000-01-01', '2000-01-01')`,
      ),
    set: "state = 'validation'",
  },
  {
    table: "client_consents",
    insert: () =>
      db.query(
        `insert into launchpad.client_consents (job_ref, learn_after_retention, created_at, updated_at)
         values ('TEST-JOB-1', false, '2000-01-01', '2000-01-01')`,
      ),
    set: "learn_after_retention = true",
  },
  {
    table: "announcements",
    insert: () =>
      db.query(
        `insert into launchpad.announcements (title, body, created_at, updated_at)
         values ('Test announcement', 'Test body', '2000-01-01', '2000-01-01')`,
      ),
    set: "pinned = true",
  },
  {
    table: "knowledge_materials",
    insert: () =>
      db.query(
        `insert into launchpad.knowledge_materials (category, title, kind, created_at, updated_at)
         values ('sops', 'Test material', 'doc', '2000-01-01', '2000-01-01')`,
      ),
    set: "title = 'Changed'",
  },
];
for (const { table, insert, set } of edited) {
  test(`timestamps: ${table} keeps created_at and moves updated_at on update`, async () => {
    await insert();
    const rows = await db.query<{ moved: boolean; kept: boolean }>(
      `update launchpad.${table} set ${set} where created_at = '2000-01-01'
       returning updated_at > '2000-01-02'::timestamptz as moved, created_at = '2000-01-01'::timestamptz as kept`,
    );
    assert.deepEqual(rows, [{ moved: true, kept: true }]);
  });
}

test("todos: a rep's own to-do has no setter or due date, and a Team task has both", async () => {
  await addStaff(db, "test-manager");
  await db.query("insert into launchpad.todos (staff_id, body) values ('test-rep-a', 'Call Test Client A')");
  await db.query(
    "insert into launchpad.todos (staff_id, body, due_on, set_by) values ('test-rep-a', 'Send the forecast', '2026-10-20', 'test-manager')",
  );
  const rows = await db.query<{ body: string; due_on: string | null; set_by: string | null }>(
    "select body, due_on::text as due_on, set_by from launchpad.todos where staff_id = 'test-rep-a' order by body",
  );
  assert.deepEqual(rows, [
    { body: "Call Test Client A", due_on: null, set_by: null },
    { body: "Send the forecast", due_on: "2026-10-20", set_by: "test-manager" },
  ]);
  await assert.rejects(
    db.query("insert into launchpad.todos (staff_id, body, set_by) values ('test-rep-a', 'x', 'test-nobody')"),
    breaks.foreignKey("todos_set_by_fkey"),
  );
});

test("audit log: an entry can name several jobs, or none for every job", async () => {
  const add = (jobs: string | null) =>
    db.query<{ job_ids: number[] | null; entity_type: string | null; entity_id: string | null }>(
      `insert into launchpad.audit_log (actor, action_type, action, entity_type, entity_id, job_ids)
       values ('Test Rep A', 'test', 'Did a thing', 'quote', 'HS-1001', $1::bigint[])
       returning job_ids, entity_type, entity_id`,
      [jobs],
    );
  assert.deepEqual(await add("{1001,1002}"), [{ job_ids: [1001, 1002], entity_type: "quote", entity_id: "HS-1001" }]);
  assert.deepEqual(await add(null), [{ job_ids: null, entity_type: "quote", entity_id: "HS-1001" }]);
});

test("submissions: the deal is kept as the rep entered it", async () => {
  const deal = { buyers: [{ name: "Test Client A" }], lot: { number: "12" }, deposit: 1000 };
  const [kept] = await db.query<{ deal: unknown }>(
    "insert into launchpad.submissions (client_label, builder, deal) values ('Test Client D', 'Test Builder', $1::jsonb) returning deal",
    [JSON.stringify(deal)],
  );
  assert.deepEqual(kept.deal, deal);
  const [bare] = await db.query<{ deal: unknown }>(
    "insert into launchpad.submissions (client_label, builder) values ('Test Client E', 'Test Builder') returning deal",
  );
  assert.equal(bare.deal, null);
});

test("lookups: a ticket's replies and events, an update's photos and a rep's to-dos are indexed by their parent", async () => {
  // Any index that leads with the column counts, whatever it is called.
  const rows = await db.query<{ what: string }>(`
    select c.relname || '.' || a.attname as what
    from pg_index i
    join pg_class c on c.oid = i.indrelid
    join pg_namespace n on n.oid = c.relnamespace
    join pg_attribute a on a.attrelid = c.oid and a.attnum = i.indkey[0]
    where n.nspname = 'launchpad' and c.relname in ('ticket_replies', 'ticket_events', 'portal_update_photos', 'todos')`);
  const indexed = new Set(rows.map((r) => r.what));
  const missing = ["ticket_replies.ticket_id", "ticket_events.ticket_id", "portal_update_photos.update_id", "todos.staff_id"].filter(
    (w) => !indexed.has(w),
  );
  assert.deepEqual(missing, []);
});
