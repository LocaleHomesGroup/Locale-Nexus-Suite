import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { migratedTestDb } from "./pglite";
import { addStaff } from "./test-fixtures";
import type { Db } from "./types";

let db: Db;
let close: () => Promise<void>;
before(async () => {
  ({ db, close } = await migratedTestDb());
  for (const id of ["test-rep-a", "test-rep-b", "test-rep-c", "test-rep-d"]) await addStaff(db, id);
});
after(async () => close());

const T0 = "2026-10-08T00:00:00.000Z";
const at = (hours: number) => new Date(Date.parse(T0) + hours * 3_600_000).toISOString();

interface Hold {
  id: string;
  staff_id: string;
  started_at: Date | null;
  expires_at: Date | null;
  ended_at: Date | null;
  outcome: string | null;
}

let lotCount = 0;
async function newLot(): Promise<string> {
  lotCount += 1;
  const [row] = await db.query<{ id: string }>(
    "insert into launchpad.land_lots (lot_label, source) values ($1, 'launchpad') returning id",
    [`Lot ${lotCount} Test Street`],
  );
  return row.id;
}

async function place(lot: string, staff: string, now: string, client: string | null = null): Promise<Hold> {
  const [row] = await db.query<Hold>("select * from launchpad.place_hold($1::uuid, $2, $3, null, $4::timestamptz)", [
    lot, staff, client, now,
  ]);
  return row;
}

const holds = (lot: string) =>
  db.query<Hold>("select * from launchpad.land_holds where lot_id = $1::uuid order by queued_at, id", [lot]);

test("land: the first hold starts at once and runs 24 hours", async () => {
  const lot = await newLot();
  const h = await place(lot, "test-rep-a", T0, "Test Client A");
  assert.equal(h.started_at?.toISOString(), T0);
  assert.equal(h.expires_at?.toISOString(), at(24));
});

test("land: two reps on one lot, one straight after the other: one holds, the other queues (Review Focus 1)", async () => {
  const lot = await newLot();
  await place(lot, "test-rep-a", T0);
  const second = await place(lot, "test-rep-b", at(0.01));
  assert.equal(second.started_at, null);
  const open = (await holds(lot)).filter((h) => h.ended_at === null);
  assert.equal(open.filter((h) => h.started_at !== null).length, 1);
});

test("land: the database itself refuses a second active hold on one lot (Review Focus 1)", async () => {
  // PGlite has one connection, so two truly concurrent place_hold calls can't be staged
  // here. Under real concurrency the lot's row lock serialises them, and this index is
  // the last line: even a write that skipped the functions can't make two active holds.
  const lot = await newLot();
  await place(lot, "test-rep-a", T0);
  await assert.rejects(
    db.query(
      `insert into launchpad.land_holds (lot_id, staff_id, queued_at, started_at, expires_at)
       values ($1::uuid, 'test-rep-b', $2::timestamptz, $2::timestamptz, $2::timestamptz + interval '24 hours')`,
      [lot, at(1)],
    ),
    /land_holds_one_active/,
  );
});

test("land: a rep can't hold twice, and the queue stops at three", async () => {
  const lot = await newLot();
  await place(lot, "test-rep-a", T0);
  await assert.rejects(place(lot, "test-rep-a", at(1)), /land_hold_already_yours/);
  await place(lot, "test-rep-b", at(1));
  await place(lot, "test-rep-c", at(2));
  await assert.rejects(place(lot, "test-rep-d", at(3)), /land_hold_queue_full/);
});

test("land: releasing the active hold starts the next with a fresh 24 hours, and tells that rep", async () => {
  const lot = await newLot();
  const first = await place(lot, "test-rep-a", T0);
  await place(lot, "test-rep-b", at(1));
  await db.query("select launchpad.release_hold($1::uuid, 'test-rep-a', $2::timestamptz)", [first.id, at(5)]);
  const [a, b] = await holds(lot);
  assert.equal(a.outcome, "released");
  assert.equal(b.started_at?.toISOString(), at(5));
  assert.equal(b.expires_at?.toISOString(), at(29));
  const notes = await db.query<{ recipient: string }>(
    "select recipient from launchpad.notifications where event = 'land_hold_started' and entity_id = $1",
    [b.id],
  );
  assert.deepEqual(notes.map((n) => n.recipient), ["test-rep-b"]);
});

test("land: settling lapses an expired hold and starts the next from the time of settling", async () => {
  const lot = await newLot();
  await place(lot, "test-rep-a", T0);
  await place(lot, "test-rep-b", at(2));
  const started = await db.query<Hold>("select * from launchpad.settle_land_holds(null, $1::timestamptz)", [at(30)]);
  assert.ok(started.some((h) => h.staff_id === "test-rep-b"));
  const [a, b] = await holds(lot);
  assert.equal(a.outcome, "lapsed");
  assert.equal(a.ended_at?.toISOString(), at(24));
  assert.equal(b.started_at?.toISOString(), at(30));
});

test("land: placing a hold settles first, so a lapsed holder doesn't block the lot", async () => {
  const lot = await newLot();
  await place(lot, "test-rep-a", T0);
  const b = await place(lot, "test-rep-b", at(25));
  assert.equal(b.started_at?.toISOString(), at(25));
});

test("land: only the active holder sells, the queue ends, and a sold lot takes no holds", async () => {
  const lot = await newLot();
  const a = await place(lot, "test-rep-a", T0, "Test Client A");
  const b = await place(lot, "test-rep-b", at(1));
  await assert.rejects(
    db.query("select launchpad.mark_lot_sold($1::uuid, 'test-rep-b', null, $2::timestamptz)", [a.id, at(2)]),
    /land_hold_not_yours/,
  );
  await assert.rejects(
    db.query("select launchpad.mark_lot_sold($1::uuid, 'test-rep-b', null, $2::timestamptz)", [b.id, at(2)]),
    /land_hold_not_active/,
  );
  await db.query("select launchpad.mark_lot_sold($1::uuid, 'test-rep-a', null, $2::timestamptz)", [a.id, at(3)]);
  const [lotRow] = await db.query<{ sale_status: string; sold_by: string; sold_client: string }>(
    "select sale_status, sold_by, sold_client from launchpad.land_lots where id = $1::uuid",
    [lot],
  );
  assert.deepEqual(lotRow, { sale_status: "sold", sold_by: "test-rep-a", sold_client: "Test Client A" });
  const after = await holds(lot);
  assert.deepEqual(after.map((h) => h.outcome), ["converted", "lot_sold"]);
  await assert.rejects(place(lot, "test-rep-c", at(4)), /land_lot_not_available/);
});

test("land: an expired holder can't sell", async () => {
  const lot = await newLot();
  const a = await place(lot, "test-rep-a", T0);
  await assert.rejects(
    db.query("select launchpad.mark_lot_sold($1::uuid, 'test-rep-a', null, $2::timestamptz)", [a.id, at(25)]),
    /land_hold_not_active/,
  );
});

test("land: releasing a hold that has already run out records it as lapsed", async () => {
  const lot = await newLot();
  const a = await place(lot, "test-rep-a", T0);
  await place(lot, "test-rep-b", at(1));
  await db.query("select launchpad.release_hold($1::uuid, 'test-rep-a', $2::timestamptz)", [a.id, at(30)]);
  const [first, next] = await holds(lot);
  assert.equal(first.outcome, "lapsed");
  assert.equal(first.ended_at?.toISOString(), at(24));
  assert.equal(next.started_at?.toISOString(), at(30));
});

test("land: leaving the queue doesn't disturb the holder", async () => {
  const lot = await newLot();
  await place(lot, "test-rep-a", T0);
  const b = await place(lot, "test-rep-b", at(1));
  await db.query("select launchpad.release_hold($1::uuid, 'test-rep-b', $2::timestamptz)", [b.id, at(2)]);
  const [a, left] = await holds(lot);
  assert.equal(left.outcome, "left_queue");
  assert.equal(a.ended_at, null);
});

test("land: the board view lists open holds, active first, with names", async () => {
  const lot = await newLot();
  await place(lot, "test-rep-a", T0, "Test Client A");
  await place(lot, "test-rep-b", at(1));
  const [row] = await db.query<{ holds: { staffId: string; name: string; client: string | null; startedAt: string | null }[] }>(
    "select holds from launchpad.land_lot_board where id = $1::uuid",
    [lot],
  );
  assert.deepEqual(row.holds.map((h) => [h.staffId, h.name, h.client, h.startedAt !== null]), [
    ["test-rep-a", "Test Rep A", "Test Client A", true],
    ["test-rep-b", "Test Rep B", null, false],
  ]);
});

const release = (hold: string, staff: string, now: string) =>
  db.query("select launchpad.release_hold($1::uuid, $2, $3::timestamptz)", [hold, staff, now]);

const sell = (hold: string, staff: string, now: string, client: string | null = null) =>
  db.query("select launchpad.mark_lot_sold($1::uuid, $2, $3, $4::timestamptz)", [hold, staff, client, now]);

const startedNotices = (hold: string) =>
  db.query<{ recipient: string }>(
    "select recipient from launchpad.notifications where event = 'land_hold_started' and entity_id = $1",
    [hold],
  );

const NO_SUCH_ID = "00000000-0000-0000-0000-000000000000";

test("land: a queued rep who leaves after the holder ran out leaves the queue, and isn't told a hold started", async () => {
  const lot = await newLot();
  const a = await place(lot, "test-rep-a", T0);
  const b = await place(lot, "test-rep-b", at(1));
  const c = await place(lot, "test-rep-c", at(2));
  // a's 24 hours ended at 24h and nothing has settled since. b leaves the queue at 30h.
  await release(b.id, "test-rep-b", at(30));
  const [first, second, third] = await holds(lot);
  assert.deepEqual([first.id, second.id, third.id], [a.id, b.id, c.id]);
  const told = async (hold: string) => (await startedNotices(hold)).map((n) => n.recipient);
  // One comparison, so a failure shows every part at once. b never held the lot, so b isn't told it started.
  assert.deepEqual(
    {
      a: { outcome: first.outcome, endedAt: first.ended_at?.toISOString() },
      b: { outcome: second.outcome, startedAt: second.started_at, told: await told(b.id) },
      c: { startedAt: third.started_at?.toISOString(), expiresAt: third.expires_at?.toISOString(), told: await told(c.id) },
    },
    {
      a: { outcome: "lapsed", endedAt: at(24) },
      b: { outcome: "left_queue", startedAt: null, told: [] },
      c: { startedAt: at(30), expiresAt: at(54), told: ["test-rep-c"] },
    },
  );
});

test("land: a settle that meets a lot locked by its own transaction still settles it", async () => {
  // settle_land_holds locks each lot `for update skip locked`, so it never waits for a lot that another session
  // holds (that is what keeps it from deadlocking with another settle or with the Monday lot sync). PGlite has one
  // connection, so a lot held by a second session can't be staged here. What can be staged is the other half: a lot
  // this same transaction already holds must still be settled, as it is inside every hold function.
  const lot = await newLot();
  await place(lot, "test-rep-a", T0);
  await place(lot, "test-rep-b", at(2));
  const started = await db.transaction(async (tx) => {
    await tx.query("select id from launchpad.land_lots where id = $1::uuid for update", [lot]);
    return tx.query<Hold>("select * from launchpad.settle_land_holds($1::uuid, $2::timestamptz)", [lot, at(30)]);
  });
  assert.deepEqual(started.map((h) => h.staff_id), ["test-rep-b"]);
  const [a, b] = await holds(lot);
  assert.equal(a.outcome, "lapsed");
  assert.equal(b.started_at?.toISOString(), at(30));
});

test("land: the database refuses an outcome that doesn't fit whether the hold ever started", async () => {
  const lot = await newLot();
  const a = await place(lot, "test-rep-a", T0);
  const b = await place(lot, "test-rep-b", at(1));
  const end = (hold: string, outcome: string) =>
    db.query("update launchpad.land_holds set ended_at = $2::timestamptz, outcome = $3 where id = $1::uuid", [hold, at(2), outcome]);
  // a started, so it can't have left the queue.
  await assert.rejects(end(a.id, "left_queue"), /land_holds_left_queue_not_started/);
  // b never started, so it can't have lapsed, been released or converted.
  for (const outcome of ["lapsed", "released", "converted"]) {
    await assert.rejects(end(b.id, outcome), /land_holds_active_outcome_started/, outcome);
  }
  // The true outcomes still go in.
  await end(b.id, "left_queue");
  await end(a.id, "released");
});

test("land: marking sold with a hold that was released elsewhere says it is no longer open", async () => {
  const lot = await newLot();
  const a = await place(lot, "test-rep-a", T0);
  await release(a.id, "test-rep-a", at(1));
  await assert.rejects(sell(a.id, "test-rep-a", at(2)), /land_hold_not_open/);
});

test("land: a hold released while mark_lot_sold waited for the lot is not open, not just not active", async () => {
  // The case: another tab releases the hold, and that commits while this call waits for the lot's lock. PGlite has
  // one connection, so it is staged: a trigger, in a transaction that rolls back when the call raises as it should,
  // makes the settle inside the call end the hold as released. The call re-reads the hold just after that settle, so
  // it finds a hold that ended some way other than lapsing, which is what a release that got in first looks like.
  const lot = await newLot();
  const a = await place(lot, "test-rep-a", T0);
  try {
    await assert.rejects(
      db.transaction(async (tx) => {
        await tx.query(`
          create function launchpad.test_end_as_released() returns trigger language plpgsql as $$
          begin
            if new.outcome = 'lapsed' then new.outcome := 'released'; end if;
            return new;
          end
          $$`);
        await tx.query(`
          create trigger test_end_as_released before update on launchpad.land_holds
          for each row execute function launchpad.test_end_as_released()`);
        // Through tx, not the helper: PGlite has one connection, and the open transaction holds it.
        await tx.query("select launchpad.mark_lot_sold($1::uuid, 'test-rep-a', null, $2::timestamptz)", [a.id, at(25)]);
      }),
      /land_hold_not_open/,
    );
    const [left] = await db.query<{ n: number }>(
      "select count(*)::int as n from pg_proc where proname = 'test_end_as_released'",
    );
    assert.equal(left.n, 0, "the rollback took the test trigger with it");
    assert.equal((await holds(lot))[0].ended_at, null, "and left the hold as it was");
  } finally {
    // If mark_lot_sold ever stopped raising, the transaction would commit and the trigger would stay for the rest of the
    // file, rewriting every later lapse to released. Drop it whatever happened (cascade takes the trigger with it).
    await db.query("drop function if exists launchpad.test_end_as_released() cascade");
  }
});

test("land: a hold on a lot that doesn't exist, or that is withdrawn, is refused", async () => {
  await assert.rejects(place(NO_SUCH_ID, "test-rep-a", T0), /land_lot_not_found/);
  const lot = await newLot();
  await db.query("update launchpad.land_lots set sale_status = 'withdrawn' where id = $1::uuid", [lot]);
  await assert.rejects(place(lot, "test-rep-a", T0), /land_lot_not_available/);
});

test("land: only a rep's own open hold can be released", async () => {
  const lot = await newLot();
  const a = await place(lot, "test-rep-a", T0);
  await place(lot, "test-rep-b", at(1));
  await assert.rejects(release(a.id, "test-rep-b", at(2)), /land_hold_not_yours/);
  await release(a.id, "test-rep-a", at(3));
  await assert.rejects(release(a.id, "test-rep-a", at(4)), /land_hold_not_open/, "a hold that has ended");
  await assert.rejects(release(NO_SUCH_ID, "test-rep-a", at(4)), /land_hold_not_open/, "a hold that was never there");
});

test("land: the database itself refuses a second open hold for one rep on one lot", async () => {
  const lot = await newLot();
  const a = await place(lot, "test-rep-a", T0);
  const again = () =>
    db.query("insert into launchpad.land_holds (lot_id, staff_id, queued_at) values ($1::uuid, 'test-rep-a', $2::timestamptz)", [
      lot, at(1),
    ]);
  await assert.rejects(again(), /land_holds_one_per_rep/);
  // Only an open hold counts: once it has ended, the same rep can hold the lot again.
  await release(a.id, "test-rep-a", at(2));
  await again();
});

test("land: when a lot sells, each queued rep gets one sold notice and the seller gets none", async () => {
  const lot = await newLot();
  const a = await place(lot, "test-rep-a", T0, "Test Client A");
  const b = await place(lot, "test-rep-b", at(1));
  const c = await place(lot, "test-rep-c", at(2));
  await sell(a.id, "test-rep-a", at(3));
  const notes = await db.query<{ recipient: string }>(
    "select recipient from launchpad.notifications where event = 'land_lot_sold' and entity_id in ($1, $2, $3) order by recipient",
    [a.id, b.id, c.id],
  );
  assert.deepEqual(notes.map((n) => n.recipient), ["test-rep-b", "test-rep-c"]);
});

test("land: the board leaves out a withdrawn lot, and names who sold a sold one", async () => {
  const withdrawn = await newLot();
  await db.query("update launchpad.land_lots set sale_status = 'withdrawn' where id = $1::uuid", [withdrawn]);
  const sold = await newLot();
  const a = await place(sold, "test-rep-a", T0, "Test Client A");
  await sell(a.id, "test-rep-a", at(1));
  const rows = await db.query<{ id: string; sale_status: string; sold_by_name: string | null; holds: unknown[] }>(
    "select id, sale_status, sold_by_name, holds from launchpad.land_lot_board where id in ($1::uuid, $2::uuid)",
    [withdrawn, sold],
  );
  assert.deepEqual(rows.map((r) => r.id), [sold], "the withdrawn lot isn't on the board");
  assert.equal(rows[0].sale_status, "sold");
  assert.equal(rows[0].sold_by_name, "Test Rep A");
  assert.deepEqual(rows[0].holds, [], "a sold lot's queue has ended");
});

test("land: a settle over every lot goes through them in id order, the order every settle takes locks in", async () => {
  // Settles that take their locks in one order can't end up waiting on each other in a circle. Whether the order by
  // matters depends on the plan: a database with statistics hashes the distinct and hands the lots back in no
  // particular order, while a fresh one sorts them by accident and would pass without the clause. So give this one
  // statistics (ANALYZE) and plan the settle afresh, with the real parameters: plpgsql reuses a plan once it has run
  // the settle a few times, and the earlier tests have. Last in the file, because this settle at 30h also settles
  // whatever the earlier tests left running.
  const lots: string[] = [];
  for (let i = 0; i < 6; i += 1) {
    const lot = await newLot();
    await place(lot, "test-rep-a", T0);
    await place(lot, "test-rep-b", at(1));
    lots.push(lot);
  }
  await db.query("analyze launchpad.land_holds");
  await db.query("set plan_cache_mode = force_custom_plan");
  try {
    const started = await db.query<Hold & { lot_id: string }>("select * from launchpad.settle_land_holds(null, $1::timestamptz)", [at(30)]);
    assert.deepEqual(started.map((h) => h.lot_id).filter((id) => lots.includes(id)), [...lots].sort());
  } finally {
    await db.query("reset plan_cache_mode");
  }
});
