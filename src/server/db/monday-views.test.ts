import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { migratedTestDb } from "./pglite";
import { addStaff } from "./test-fixtures";
import type { Db } from "./types";

let db: Db;
let close: () => Promise<void>;

const value = (type: string, text: string | null, extra: Record<string, unknown> = {}) => ({ type, text, value: null, ...extra });

async function item(id: number, board: number, name: string, values: Record<string, unknown>, parent: number | null = null) {
  await db.query(
    `insert into mirror.monday_items (id, board_id, parent_item_id, name, monday_updated_at, column_values)
     values ($1, $2, $3, $4, '2026-10-07T00:00:00Z', $5::jsonb)`,
    [id, board, parent, name, JSON.stringify(values)],
  );
}

before(async () => {
  ({ db, close } = await migratedTestDb());
  await db.query("insert into mirror.monday_workspaces (id, name) values (1, 'Test workspace')");
  await db.query(`insert into mirror.monday_boards (id, workspace_id, name, board_key, purpose, division, region, sync_enabled)
                  values (10, 1, 'Test sales board', 'homes_sales_wa', 'sales', 'homes', 'WA', true),
                         (30, 1, 'Test land board', 'exclusive_land', 'exclusive_land', null, null, true)`);
  await db.query(`insert into mirror.monday_boards (id, workspace_id, name, type, board_key, parent_board_id, sync_enabled)
                  values (11, 1, 'Subitems of Test sales board', 'sub_items_board', 'homes_sales_wa:subitems', 10, true)`);
  await db.query(`insert into mirror.monday_field_map (board_id, field_key, column_id) values
    (10, 'job_number', 'text4'), (10, 'builder', 'color_b'), (10, 'sale_won_date', 'date4'),
    (10, 'block_titled', 'color_t'), (10, 'hubspot_id', 'text_h'), (10, 'sales_rep', 'text_r'),
    (11, 'milestone_status', 'status'), (11, 'date_completed', 'date_c'), (11, 'files', 'files_f'),
    (30, 'lot_status', 'status'), (30, 'lot_estate', 'text_e'), (30, 'lot_land_price', 'numbers'),
    (30, 'lot_title', 'color_title'), (30, 'lot_title_eta', 'date_eta')`);

  await item(1001, 10, "Test Client A", {
    text4: value("text", "12345"),
    color_b: value("status", "Test Builder", { label: "Test Builder", index: 1 }),
    date4: value("date", "2026-09-01", { date: "2026-09-01" }),
    color_t: value("status", "No", { label: "No" }),
    text_h: value("text", "999"),
    text_r: value("text", " Test Rep A "),
  });
  await item(1002, 10, "Test Client B (removed)", {});
  await db.query("update mirror.monday_items set removed_at = now(), state = 'deleted' where id = 1002");
  await item(2001, 11, "Slab Down", {
    status: value("status", "Done", { label: "Done", index: 1 }),
    date_c: value("date", "2026-10-01", { date: "2026-10-01" }),
    files_f: value("file", "a.pdf, b.pdf", { value: { files: [{ assetId: 9001 }, { assetId: 9002 }] } }),
  }, 1001);
  await db.query(`insert into mirror.monday_assets (id, item_id, column_id, name) values
    (9001, 2001, 'files_f', 'a.pdf'), (9002, 2001, 'files_f', 'b.pdf'), (9003, 1001, null, 'c.pdf')`);

  await item(3001, 30, "Lot 1 Test Street, Testville", {
    status: value("status", "Available", { label: "Available" }),
    text_e: value("text", "Test Estate"),
    numbers: value("numbers", "364000"),
    color_title: value("status", "Untitled", { label: "Untitled" }),
    date_eta: value("date", "2026-09-30", { date: "2026-09-30" }),
  });
  await item(3002, 30, "Lot 2 Test Street, Testville", {
    status: value("status", "Sold", { label: "Sold" }),
    numbers: value("numbers", "$365,000"),
  });
  await addStaff(db, "test-rep-a", { email: "rep.a@example.com" });
});
after(async () => close());

test("views: a job row reads its mapped columns, and removed items are left out", async () => {
  const rows = await db.query<Record<string, unknown>>("select * from launchpad.monday_jobs order by item_id");
  assert.equal(rows.length, 1);
  const [job] = rows;
  assert.equal(job.job_number, "12345");
  assert.equal(job.builder, "Test Builder");
  assert.equal(job.block_titled, "No");
  assert.equal(job.hubspot_deal_id, 999);
  assert.equal(job.sales_rep, "Test Rep A");
  assert.equal(job.purpose, "sales");
  const [{ d }] = await db.query<{ d: string }>("select sale_won_date::text as d from launchpad.monday_jobs");
  assert.equal(d, "2026-09-01");
});

test("views: a subitem becomes a milestone of its job, with its file count", async () => {
  const [m] = await db.query<{ job_item_id: number; status_label: string; done: string; file_count: number }>(
    "select job_item_id, status_label, date_completed::text as done, file_count from launchpad.monday_job_milestones",
  );
  assert.deepEqual(m, { job_item_id: 1001, status_label: "Done", done: "2026-10-01", file_count: 2 });
});

test("views: files on a job or its milestones all belong to the job", async () => {
  const rows = await db.query<{ asset_id: number; item_id: number; subitem_id: number | null }>(
    "select asset_id, item_id, subitem_id from launchpad.monday_job_files order by asset_id",
  );
  assert.deepEqual(rows, [
    { asset_id: 9001, item_id: 1001, subitem_id: 2001 },
    { asset_id: 9002, item_id: 1001, subitem_id: 2001 },
    { asset_id: 9003, item_id: 1001, subitem_id: null },
  ]);
});

test("views: a value that isn't a date or a number reads as null, not an error (Review Focus 5)", async () => {
  const [r] = await db.query<{ d: string | null; impossible: string | null; n: string | null }>(
    `select mirror.value_date('{"text": "next week"}'::jsonb)::text as d,
            mirror.value_date('{"date": "2026-02-30"}'::jsonb)::text as impossible,
            mirror.value_number('{"text": "TBC"}'::jsonb)::text as n`,
  );
  assert.deepEqual(r, { d: null, impossible: null, n: null });
});

test("views: a blank text or label falls through to the next field", async () => {
  const cases: Array<[string, string, string | null]> = [
    ["value_text", '{"text": "", "display_value": "X"}', "X"],
    ["value_text", '{"text": "", "display_value": "", "label": "L"}', "L"],
    ["value_text", '{"text": "A", "display_value": "X"}', "A"],
    ["value_text", '{"text": "", "display_value": "", "label": ""}', null],
    ["value_label", '{"label": "", "text": "Y"}', "Y"],
    ["value_label", '{"label": "B", "text": "Y"}', "B"],
    ["value_label", '{"label": "", "text": ""}', null],
  ];
  for (const [reader, json, expected] of cases) {
    const [row] = await db.query<{ v: string | null }>(`select mirror.${reader}($1::jsonb) as v`, [json]);
    assert.equal(row.v, expected, `${reader}(${json})`);
  }
});

test("views: a Monday title label becomes a title status, erring towards not titled", async () => {
  const expected: Array<[string, string | null]> = [
    ["Titled", "titled"],
    ["Titled - registered", "titled"],
    ["Untitled", "untitled"],
    ["Not titled", "untitled"],
    ["Not yet titled", "untitled"],
    ["Title delayed", "delayed"],
    ["To be titled", null],
    ["Soon titled", null],
  ];
  for (const [label, status] of expected) {
    const [row] = await db.query<{ status: string | null }>("select launchpad.title_status_of($1) as status", [label]);
    assert.equal(row.status, status, label);
  }
});

test("lots: the first sync adds every lot, sold ones as sold", async () => {
  const changed = await db.query<{ n: number }>("select launchpad.sync_land_lots_from_monday() as n");
  assert.equal(changed[0].n, 2);
  const lots = await db.query<{ lot_label: string; sale_status: string; land_price: string | null; title_status: string | null }>(
    "select lot_label, sale_status, land_price::text, title_status from launchpad.land_lots order by lot_label",
  );
  assert.deepEqual(lots, [
    { lot_label: "Lot 1 Test Street, Testville", sale_status: "available", land_price: "364000.00", title_status: "untitled" },
    { lot_label: "Lot 2 Test Street, Testville", sale_status: "sold", land_price: "365000.00", title_status: null },
  ]);
});

test("lots: later syncs follow Monday's details but never its status", async () => {
  await db.query(`update mirror.monday_items
                  set column_values = jsonb_set(column_values, '{numbers}', '{"type":"numbers","text":"370000","value":null}')
                    || '{"status": {"type":"status","text":"Sold","label":"Sold","value":null}}'::jsonb
                  where id = 3001`);
  await db.query("select launchpad.sync_land_lots_from_monday()");
  const [lot] = await db.query<{ sale_status: string; land_price: string; monday_status: string }>(
    "select sale_status, land_price::text, monday_status from launchpad.land_lots where monday_item_id = 3001",
  );
  assert.deepEqual(lot, { sale_status: "available", land_price: "370000.00", monday_status: "Sold" });
  const again = await db.query<{ n: number }>("select launchpad.sync_land_lots_from_monday() as n");
  assert.equal(again[0].n, 0, "nothing changed, nothing written");
});

test("lots: a lot that leaves Monday is withdrawn, unless a hold is active", async () => {
  const [lot] = await db.query<{ id: string }>("select id from launchpad.land_lots where monday_item_id = 3001");
  await db.query("select launchpad.place_hold($1::uuid, 'test-rep-a')", [lot.id]);
  await db.query("update mirror.monday_items set removed_at = now(), state = 'deleted' where id = 3001");
  await db.query("select launchpad.sync_land_lots_from_monday()");
  const [held] = await db.query<{ sale_status: string; flagged: boolean }>(
    "select sale_status, monday_removed_at is not null as flagged from launchpad.land_lots where monday_item_id = 3001",
  );
  assert.deepEqual(held, { sale_status: "available", flagged: true });

  await db.query(
    "update launchpad.land_holds set ended_at = now(), outcome = 'released' where lot_id = $1::uuid and ended_at is null and started_at is not null",
    [lot.id],
  );
  await db.query("select launchpad.sync_land_lots_from_monday()");
  const [gone] = await db.query<{ sale_status: string }>(
    "select sale_status from launchpad.land_lots where monday_item_id = 3001",
  );
  assert.equal(gone.sale_status, "withdrawn");
});

test("lots: a withdrawn lot whose item comes back to Monday is available again", async () => {
  await db.query("update mirror.monday_items set removed_at = null, state = 'active' where id = 3001");
  await db.query("select launchpad.sync_land_lots_from_monday()");
  const [lot] = await db.query<{ sale_status: string; flagged: boolean }>(
    "select sale_status, monday_removed_at is not null as flagged from launchpad.land_lots where monday_item_id = 3001",
  );
  assert.deepEqual(lot, { sale_status: "available", flagged: false });
});

test("lots: a first import is sold only when Monday's status starts with Sold", async () => {
  await item(3401, 30, "Lot 6 Test Street, Testville", { status: value("status", "Unsold", { label: "Unsold" }) });
  await item(3402, 30, "Lot 7 Test Street, Testville", { status: value("status", "Not sold", { label: "Not sold" }) });
  await item(3403, 30, "Lot 8 Test Street, Testville", { status: value("status", "Sold - deposit paid", { label: "Sold - deposit paid" }) });
  await db.query("select launchpad.sync_land_lots_from_monday()");
  const lots = await db.query<{ lot_label: string; sale_status: string; sold_at_set: boolean }>(
    `select lot_label, sale_status, sold_at is not null as sold_at_set
     from launchpad.land_lots where monday_item_id in (3401, 3402, 3403) order by monday_item_id`,
  );
  assert.deepEqual(lots, [
    { lot_label: "Lot 6 Test Street, Testville", sale_status: "available", sold_at_set: false },
    { lot_label: "Lot 7 Test Street, Testville", sale_status: "available", sold_at_set: false },
    { lot_label: "Lot 8 Test Street, Testville", sale_status: "sold", sold_at_set: true },
  ]);
});

test("lots: nothing imports until the Exclusive Land board's status column is mapped", async () => {
  // Sale status never follows Monday after a lot's first import, so an import before the status column is
  // mapped would make every lot available for good. This runs on a database of its own, so the shared
  // fixture keeps its mapping.
  const other = await migratedTestDb();
  try {
    await other.db.query("insert into mirror.monday_workspaces (id, name) values (1, 'Test workspace')");
    await other.db.query(`insert into mirror.monday_boards (id, workspace_id, name, board_key, purpose, sync_enabled)
                          values (30, 1, 'Test land board', 'exclusive_land', 'exclusive_land', true)`);
    await other.db.query(
      `insert into mirror.monday_items (id, board_id, name, monday_updated_at, column_values)
       values (3001, 30, 'Lot 1 Test Street, Testville', '2026-10-07T00:00:00Z', $1::jsonb)`,
      [JSON.stringify({ status: value("status", "Sold", { label: "Sold" }) })],
    );
    // Another field is mapped, but not the status.
    await other.db.query("insert into mirror.monday_field_map (board_id, field_key, column_id) values (30, 'lot_estate', 'text_e')");
    const first = await other.db.query<{ n: number }>("select launchpad.sync_land_lots_from_monday() as n");
    assert.equal(first[0].n, 0);
    const [none] = await other.db.query<{ n: number }>("select count(*)::int as n from launchpad.land_lots");
    assert.equal(none.n, 0, "no lot is created while the status column is unmapped");

    await other.db.query("insert into mirror.monday_field_map (board_id, field_key, column_id) values (30, 'lot_status', 'status')");
    const second = await other.db.query<{ n: number }>("select launchpad.sync_land_lots_from_monday() as n");
    assert.equal(second[0].n, 1);
    const [lot] = await other.db.query<{ sale_status: string }>("select sale_status from launchpad.land_lots");
    assert.equal(lot.sale_status, "sold", "once the status is mapped, the first import reads it");
  } finally {
    await other.close();
  }
});

test("lots: a number too big for its column reads as null, and every other lot still syncs (Review Focus 5)", async () => {
  await db.query(`insert into mirror.monday_field_map (board_id, field_key, column_id) values
    (30, 'lot_package_price', 'pkg'), (30, 'lot_area', 'area'), (30, 'lot_frontage', 'front')`);
  // Lot 3 has the biggest frontage its column holds. Every number on lot 4 is too big for its column,
  // the price only once it is rounded to cents.
  await item(3101, 30, "Lot 3 Test Street, Testville", {
    status: value("status", "Available", { label: "Available" }),
    numbers: value("numbers", "380000"),
    area: value("numbers", "450.5"),
    front: value("numbers", "9999.99"),
  });
  await item(3102, 30, "Lot 4 Test Street, Testville", {
    status: value("status", "Available", { label: "Available" }),
    text_e: value("text", "Test Estate"),
    numbers: value("numbers", "9999999999.995"),
    pkg: value("numbers", "10000000000"),
    area: value("numbers", "12345678"),
    front: value("numbers", "10000"),
  });
  try {
    const changed = await db.query<{ n: number }>("select launchpad.sync_land_lots_from_monday() as n");
    assert.equal(changed[0].n, 2);
    const lots = await db.query<Record<string, string | null>>(
      `select lot_label, estate, land_price::text, package_price::text, area_sqm::text, frontage_m::text
       from launchpad.land_lots where monday_item_id in (3101, 3102) order by monday_item_id`,
    );
    assert.deepEqual(lots, [
      { lot_label: "Lot 3 Test Street, Testville", estate: null, land_price: "380000.00", package_price: null, area_sqm: "450.50", frontage_m: "9999.99" },
      { lot_label: "Lot 4 Test Street, Testville", estate: "Test Estate", land_price: null, package_price: null, area_sqm: null, frontage_m: null },
    ]);
    const again = await db.query<{ n: number }>("select launchpad.sync_land_lots_from_monday() as n");
    assert.equal(again[0].n, 0, "the unusable numbers settle as null, so nothing is rewritten");
  } finally {
    // Whatever happened above, leave nothing for the next lot test's sync to trip over.
    await db.query("delete from launchpad.land_lots where monday_item_id in (3101, 3102)");
    await db.query("delete from mirror.monday_items where id in (3101, 3102)");
  }
});

test("lots: Monday never touches a lot Launchpad owns, its holds and its flag included", async () => {
  await item(3201, 30, "Lot 5 Test Street, Testville", { status: value("status", "Available", { label: "Available" }) });
  await db.query("select launchpad.sync_land_lots_from_monday()");
  const [lot] = await db.query<{ id: string }>("select id from launchpad.land_lots where monday_item_id = 3201");
  await db.query("update launchpad.land_lots set source = 'launchpad' where id = $1::uuid", [lot.id]);
  await addStaff(db, "test-rep-b");
  await db.query("select launchpad.place_hold($1::uuid, 'test-rep-a')", [lot.id]);
  await db.query("select launchpad.place_hold($1::uuid, 'test-rep-b')", [lot.id]);
  const holds = () =>
    db.query<{ staff_id: string; outcome: string | null }>(
      "select staff_id, outcome from launchpad.land_holds where lot_id = $1::uuid order by staff_id",
      [lot.id],
    );
  const lotNow = async () => {
    const [row] = await db.query<{ source: string; sale_status: string; flagged: boolean }>(
      "select source, sale_status, monday_removed_at is not null as flagged from launchpad.land_lots where id = $1::uuid",
      [lot.id],
    );
    return row;
  };

  // With an active hold, a Monday lot whose item is removed is only flagged. This lot isn't touched at all.
  await db.query("update mirror.monday_items set removed_at = now(), state = 'deleted' where id = 3201");
  await db.query("select launchpad.sync_land_lots_from_monday()");
  assert.deepEqual(await lotNow(), { source: "launchpad", sale_status: "available", flagged: false });
  assert.deepEqual(await holds(), [
    { staff_id: "test-rep-a", outcome: null },
    { staff_id: "test-rep-b", outcome: null },
  ]);

  // With no active hold, the sync withdraws a Monday lot and ends its open holds. Release the active one
  // directly, so that only the queued hold is left to end.
  await db.query(
    "update launchpad.land_holds set ended_at = now(), outcome = 'released' where lot_id = $1::uuid and ended_at is null and started_at is not null",
    [lot.id],
  );
  await db.query("select launchpad.sync_land_lots_from_monday()");
  assert.deepEqual(await lotNow(), { source: "launchpad", sale_status: "available", flagged: false });
  assert.deepEqual(await holds(), [
    { staff_id: "test-rep-a", outcome: "released" },
    { staff_id: "test-rep-b", outcome: null },
  ]);
});

test("lots: a removed lot with queued holds and no active one is withdrawn with its holds, and the count includes them", async () => {
  await item(3501, 30, "Lot 9 Test Street, Testville", { status: value("status", "Available", { label: "Available" }) });
  await db.query("select launchpad.sync_land_lots_from_monday()");
  const [lot] = await db.query<{ id: string }>("select id from launchpad.land_lots where monday_item_id = 3501");
  for (const id of ["test-rep-c", "test-rep-d"]) await addStaff(db, id);
  // Placed through the hold functions: rep a's hold is active, and c and d queue behind it. Those functions
  // never leave a queue with no active hold, so rep a's is then ended directly, as in the test above.
  for (const id of ["test-rep-a", "test-rep-c", "test-rep-d"]) {
    await db.query("select launchpad.place_hold($1::uuid, $2)", [lot.id, id]);
  }
  await db.query(
    "update launchpad.land_holds set ended_at = now(), outcome = 'released' where lot_id = $1::uuid and ended_at is null and started_at is not null",
    [lot.id],
  );
  await db.query("update mirror.monday_items set removed_at = now(), state = 'deleted' where id = 3501");
  const first = await db.query<{ n: number }>("select launchpad.sync_land_lots_from_monday() as n");
  assert.equal(first[0].n, 3, "two holds ended and one lot withdrawn");
  const holds = await db.query<{ staff_id: string; outcome: string | null }>(
    "select staff_id, outcome from launchpad.land_holds where lot_id = $1::uuid order by staff_id",
    [lot.id],
  );
  assert.deepEqual(holds, [
    { staff_id: "test-rep-a", outcome: "released" },
    { staff_id: "test-rep-c", outcome: "lot_withdrawn" },
    { staff_id: "test-rep-d", outcome: "lot_withdrawn" },
  ]);
  const [after] = await db.query<{ sale_status: string }>("select sale_status from launchpad.land_lots where id = $1::uuid", [lot.id]);
  assert.equal(after.sale_status, "withdrawn");
  const again = await db.query<{ n: number }>("select launchpad.sync_land_lots_from_monday() as n");
  assert.equal(again[0].n, 0, "nothing left to change");
});

test("lots: the sync's number guards name the same types as the land_lots columns they protect", async () => {
  // The guards are type names written into the sync. If a column's type changed and its guard didn't, a
  // value that passes the guard could overflow the column and stop the whole sync again.
  const [{ src }] = await db.query<{ src: string }>(
    "select prosrc as src from pg_proc where oid = 'launchpad.sync_land_lots_from_monday(timestamptz)'::regprocedure",
  );
  const byColumn = (a: { col: string }, b: { col: string }) => a.col.localeCompare(b.col);
  const guards = [...src.matchAll(/pg_input_is_valid\(r\.(\w+)::text, '([^']+)'\)/g)]
    .map((m) => ({ col: m[1], type: m[2] }))
    .sort(byColumn);
  const columns = (
    await db.query<{ col: string; type: string }>(
      `select a.attname as col, format_type(a.atttypid, a.atttypmod) as type
       from pg_attribute a
       where a.attrelid = 'launchpad.land_lots'::regclass and a.attname in ('land_price', 'package_price', 'area_sqm', 'frontage_m')`,
    )
  ).sort(byColumn);
  assert.equal(columns.length, 4);
  assert.deepEqual(guards, columns);
});
