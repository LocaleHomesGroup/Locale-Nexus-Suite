import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { migratedTestDb } from "../db/pglite";
import { addStaff } from "../db/test-fixtures";
import type { Db } from "../db/types";
import type { LandActionResult } from "./land-rules";
import { markLotSold, placeHold, releaseHold } from "./land-run";

let db: Db;
let close: () => Promise<void>;
before(async () => {
  ({ db, close } = await migratedTestDb());
  for (const id of ["test-rep-a", "test-rep-b"]) await addStaff(db, id);
});
after(async () => close());

const UUID = "11111111-1111-1111-1111-111111111111";
const errorOf = (r: LandActionResult) => (r.ok ? "" : r.error);

let lotCount = 0;
async function newLot(): Promise<string> {
  lotCount += 1;
  const [row] = await db.query<{ id: string }>(
    "insert into launchpad.land_lots (lot_label, source) values ($1, 'launchpad') returning id::text as id",
    [`Lot ${lotCount} Test Street`],
  );
  return row.id;
}
const lotIn = (r: LandActionResult, id: string) => r.lots?.find((l) => l.id === id);

/** A database that fails the test if anything asks it a question. */
const untouchable: Db = {
  query: async () => {
    throw new Error("the database was asked");
  },
  transaction: async () => {
    throw new Error("the database was asked");
  },
};

/** The same database, but the board's reload (settle, then read) fails. */
const withoutReload: Db = {
  query: <T>(text: string, params?: readonly unknown[]) =>
    /land_lot_board|settle_land_holds\(\)/.test(text) ? Promise.reject(new Error("reload failed")) : db.query<T>(text, params),
  transaction: (fn) => db.transaction(fn),
};

test("land run: bad input is refused with the check's own sentence, and the database is never asked", async () => {
  for (const r of [
    await placeHold(untouchable, "lot-318", "test-rep-a", ""),
    await releaseHold(untouchable, "nope", "test-rep-a"),
    await markLotSold(untouchable, "nope", "test-rep-a", ""),
  ]) {
    assert.equal(r.ok, false);
    assert.match(errorOf(r), /Reload/);
    assert.equal(r.lots, null);
  }
  assert.deepEqual(await placeHold(untouchable, UUID, "", ""), { ok: false, error: "Pick who you're viewing as first.", lots: null });
  assert.match(errorOf(await placeHold(untouchable, UUID, "test-rep-a", "x".repeat(121))), /120/);
});

test("land run: with no database it says live data isn't connected", async () => {
  const expected = { ok: false, error: "Live data isn't connected.", lots: null };
  assert.deepEqual(await placeHold(null, UUID, "test-rep-a", ""), expected);
  assert.deepEqual(await releaseHold(null, UUID, "test-rep-a"), expected);
  assert.deepEqual(await markLotSold(null, UUID, "test-rep-a", ""), expected);
});

test("land run: a place holds the lot for the rep (client trimmed) and returns the fresh board", async () => {
  const lot = await newLot();
  const r = await placeHold(db, lot, "test-rep-a", "  Test Client A  ");
  assert.equal(r.ok, true);
  const holds = lotIn(r, lot)?.holds ?? [];
  assert.equal(holds.length, 1);
  assert.equal(holds[0].staffId, "test-rep-a");
  assert.equal(holds[0].client, "Test Client A");
  assert.ok(holds[0].startedAt, "the first hold starts at once");
});

test("land run: placing again is refused with the readable sentence, and the board still comes back", async () => {
  const lot = await newLot();
  await placeHold(db, lot, "test-rep-a", "");
  const r = await placeHold(db, lot, "test-rep-a", "");
  assert.equal(r.ok, false);
  assert.equal(errorOf(r), "You already hold this lot, or you're in its queue.");
  assert.equal(lotIn(r, lot)?.holds.length, 1, "the reloaded board shows the one hold");
});

test("land run: a reload that fails after a successful place still says it went through, with no board", async () => {
  const lot = await newLot();
  const r = await placeHold(withoutReload, lot, "test-rep-a", "");
  assert.deepEqual(r, { ok: true, lots: null });
  const rows = await db.query<{ staff_id: string }>(
    "select staff_id from launchpad.land_holds where lot_id = $1::uuid and ended_at is null",
    [lot],
  );
  assert.deepEqual(rows.map((x) => x.staff_id), ["test-rep-a"], "the hold really exists");
  // And when the action is refused and the reload fails too, the sentence still comes back.
  const again = await placeHold(withoutReload, lot, "test-rep-a", "");
  assert.deepEqual(again, { ok: false, error: "You already hold this lot, or you're in its queue.", lots: null });
});

test("land run: a release ends the hold", async () => {
  const lot = await newLot();
  const placed = await placeHold(db, lot, "test-rep-a", "");
  const holdId = lotIn(placed, lot)?.holds[0].id ?? "";
  const r = await releaseHold(db, holdId, "test-rep-a");
  assert.equal(r.ok, true);
  assert.equal(lotIn(r, lot)?.holds.length, 0);
  const [row] = await db.query<{ ended_at: Date | null; outcome: string }>(
    "select ended_at, outcome from launchpad.land_holds where id = $1::uuid",
    [holdId],
  );
  assert.ok(row.ended_at, "the hold has an end");
  assert.equal(row.outcome, "released");
});

test("land run: marking sold with no client keeps the hold's client", async () => {
  const lot = await newLot();
  const placed = await placeHold(db, lot, "test-rep-a", "Test Client A");
  const holdId = lotIn(placed, lot)?.holds[0].id ?? "";
  const r = await markLotSold(db, holdId, "test-rep-a", "");
  assert.equal(r.ok, true);
  const sold = lotIn(r, lot);
  assert.equal(sold?.saleStatus, "sold");
  assert.equal(sold?.soldClient, "Test Client A");
  assert.equal(sold?.soldBy, "Test Rep A");
});

test("land run: values from a forged request body are refused or ignored, and nothing throws", async () => {
  const lot = await newLot();
  let refused: LandActionResult[] = [];
  await assert.doesNotReject(async () => {
    refused = [
      await placeHold(untouchable, 123, "test-rep-a", ""),
      await placeHold(untouchable, undefined, "test-rep-a", null),
      await releaseHold(untouchable, ["x"], "test-rep-a"),
      await markLotSold(untouchable, { id: UUID }, "test-rep-a", ""),
    ];
  });
  for (const r of refused) assert.match(errorOf(r), /Reload/);
  assert.equal(errorOf(await placeHold(untouchable, UUID, 42, "")), "Pick who you're viewing as first.");
  // A client that isn't a string counts as no client; it can't reach .trim().
  const r = await placeHold(db, lot, "test-rep-b", { name: "x" });
  assert.equal(r.ok, true);
  assert.equal(lotIn(r, lot)?.holds[0].client, null);
});
