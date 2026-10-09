import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { migratedTestDb } from "./pglite";
import type { Db } from "./types";

let db: Db;
let close: () => Promise<void>;
before(async () => ({ db, close } = await migratedTestDb()));
after(async () => close());

test("mirror: record_api_call admits calls up to the cap, then refuses without counting", async () => {
  const take = async () =>
    (await db.query<{ ok: boolean }>("select mirror.record_api_call('monday', 1, 2) as ok"))[0].ok;
  assert.equal(await take(), true);
  assert.equal(await take(), true);
  assert.equal(await take(), false);
  const [row] = await db.query<{ calls: string }>("select calls::text from mirror.api_calls where source = 'monday'");
  assert.equal(row.calls, "2.0");
});

test("mirror: after the daily limit is hit, record_api_call refuses until the UTC day ends", async () => {
  const take = async () =>
    (await db.query<{ ok: boolean }>("select mirror.record_api_call('hubspot', 1, 100) as ok"))[0].ok;
  const counted = async () =>
    (await db.query<{ calls: string }>("select calls::text from mirror.api_calls where source = 'hubspot'"))[0].calls;
  assert.equal(await take(), true);
  await db.query("select mirror.record_daily_limit('hubspot')");
  assert.equal(await counted(), "1.0", "hitting the limit doesn't touch the count");
  assert.equal(await take(), false);
  assert.equal(await counted(), "1.0", "a call refused after the limit counts nothing");
  // Make today's row yesterday's: the new day starts clear.
  await db.query("update mirror.api_calls set day = day - 1 where source = 'hubspot'");
  assert.equal(await take(), true);
});

test("mirror: the ledger's day is the UTC date, whatever the session's time zone", async () => {
  // These two zones are 26 hours apart, so at any moment at least one of them has a different local date
  // from UTC: a day key taken from the session's zone (current_date, now()::date) fails here.
  const storedDays = async () =>
    (await db.query<{ day: string }>("select day::text as day from mirror.api_calls where source = 'test-tz' order by day")).map(
      (r) => r.day,
    );
  const utcToday = async () => (await db.query<{ day: string }>("select (now() at time zone 'utc')::date::text as day"))[0].day;
  try {
    for (const zone of ["Etc/GMT+12", "Pacific/Kiritimati"]) {
      await db.query(`set time zone '${zone}'`);
      await db.query("select mirror.record_api_call('test-tz', 1, 100)");
      assert.deepEqual(await storedDays(), [await utcToday()], `under ${zone}, the one row is keyed on the UTC date`);
    }
  } finally {
    await db.query("reset time zone"); // the database is shared by the whole file
  }
});

test("mirror: a lease lock has one holder until it expires or is released", async () => {
  const lock = async (owner: string, secs = 60) =>
    (await db.query<{ ok: boolean }>("select mirror.try_lock('monday', $1, $2) as ok", [owner, secs]))[0].ok;
  assert.equal(await lock("a"), true);
  assert.equal(await lock("b"), false);
  assert.equal(await lock("a"), true, "the holder can renew");
  await db.query("select mirror.unlock('monday', 'a')");
  assert.equal(await lock("b"), true);
  await db.query("select mirror.unlock('monday', 'a')"); // a is not the holder any more: this must not release b's lease
  assert.equal(await lock("c"), false, "only the holder can release a lease");
  await db.query("update mirror.sync_locks set locked_until = now() - interval '1 second' where source = 'monday'");
  assert.equal(await lock("c"), true, "an expired lease can be taken");
});

test("mirror: the field vocabulary covers job, milestone and lot fields", async () => {
  const rows = await db.query<{ key: string; scope: string }>("select key, scope from mirror.monday_fields");
  const keys = new Set(rows.map((r) => r.key));
  for (const k of ["job_number", "sales_rep", "hubspot_id", "milestone_status", "date_completed", "files", "lot_estate"]) {
    assert.ok(keys.has(k), `missing field ${k}`);
  }
  assert.equal(rows.find((r) => r.key === "milestone_status")?.scope, "subitem");
});

test("mirror: an item keeps every column value as JSON, and the field map points at one column", async () => {
  await db.query("insert into mirror.monday_workspaces (id, name) values (1, 'Test workspace')");
  await db.query("insert into mirror.monday_boards (id, workspace_id, name) values (10, 1, 'Test board')");
  await db.query(
    `insert into mirror.monday_items (id, board_id, name, monday_updated_at, column_values)
     values (100, 10, 'Test Client A', now(), $1::jsonb)`,
    [JSON.stringify({ text4: { type: "text", text: "12345", value: "\"12345\"" } })],
  );
  await db.query("insert into mirror.monday_field_map (board_id, field_key, column_id) values (10, 'job_number', 'text4')");
  const [row] = await db.query<{ job: string }>(`
    select i.column_values -> m.column_id ->> 'text' as job
    from mirror.monday_items i join mirror.monday_field_map m on m.board_id = i.board_id
    where i.id = 100 and m.field_key = 'job_number'`);
  assert.equal(row.job, "12345");
  await assert.rejects(
    db.query("insert into mirror.monday_field_map (board_id, field_key, column_id) values (10, 'not_a_field', 'x')"),
    /foreign key/i,
  );
});

test("mirror: HubSpot rows land in their own table, as one of the object types the mirror reads", async () => {
  await db.query(
    `insert into mirror.hubspot_objects (object_type, id, properties) values ('deals', 555, $1::jsonb)`,
    [JSON.stringify({ dealname: "Test deal" })],
  );
  const [deal] = await db.query<{ n: string }>("select properties ->> 'dealname' as n from mirror.hubspot_objects");
  assert.equal(deal.n, "Test deal");
  await assert.rejects(
    db.query("insert into mirror.hubspot_objects (object_type, id) values ('tickets', 1)"),
    /check/i,
  );
});
