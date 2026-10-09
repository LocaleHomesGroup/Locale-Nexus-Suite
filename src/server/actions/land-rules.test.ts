import { test } from "node:test";
import assert from "node:assert/strict";
import { checkHoldInput, landErrorMessage } from "./land-rules";

const LOT = "11111111-1111-1111-1111-111111111111";

test("land rules: inputs are checked before the database is asked", () => {
  assert.equal(checkHoldInput({ lotId: LOT, staffId: "test-rep-a", client: "Test Client A" }), null);
  assert.match(checkHoldInput({ lotId: "lot-318", staffId: "test-rep-a" }) ?? "", /Reload/);
  assert.match(checkHoldInput({ lotId: LOT, staffId: "" }) ?? "", /viewing as/);
  assert.match(checkHoldInput({ holdId: "nope", staffId: "test-rep-a" }) ?? "", /Reload/);
  assert.match(checkHoldInput({ lotId: LOT, staffId: "test-rep-a", client: "x".repeat(121) }) ?? "", /120/);
});

test("land rules: the database's refusals read as sentences", () => {
  assert.match(landErrorMessage(new Error('land_lot_not_available')), /got there first/);
  assert.match(landErrorMessage(new Error("ERROR: land_hold_queue_full")), /queue is full/);
  assert.match(landErrorMessage(new Error("land_hold_not_active")), /lapsed/);
  const original = console.error;
  console.error = () => {};
  try {
    assert.match(landErrorMessage(new Error("connection reset")), /didn't go through/);
  } finally {
    console.error = original;
  }
});

test("land rules: every code the database raises has its own sentence, never the generic one", () => {
  // The seven exceptions in supabase/migrations/20261008000800_exclusive_land.sql.
  const sentences: Record<string, string> = {
    land_lot_not_found: "That lot has gone from the list. Reload the page.",
    land_lot_not_available: "Someone got there first: this lot isn't available any more.",
    land_hold_already_yours: "You already hold this lot, or you're in its queue.",
    land_hold_queue_full: "The hold queue is full: three reps are already on this lot.",
    land_hold_not_open: "That hold has already ended.",
    land_hold_not_yours: "Only the rep who placed the hold can do that.",
    land_hold_not_active: "Your hold has lapsed, so the lot can't be marked sold from it.",
  };
  const original = console.error;
  console.error = () => {};
  let generic: string;
  try {
    generic = landErrorMessage(new Error("connection reset"));
  } finally {
    console.error = original;
  }
  for (const [code, sentence] of Object.entries(sentences)) {
    assert.equal(landErrorMessage(new Error(code)), sentence, code);
    assert.equal(landErrorMessage(new Error(`ERROR: ${code}`)), sentence, `${code} with Postgres's prefix`);
    assert.notEqual(sentence, generic, code);
  }
});

test("land rules: a client name of 120 characters is allowed and 121 is not", () => {
  assert.equal(checkHoldInput({ lotId: LOT, staffId: "test-rep-a", client: "x".repeat(120) }), null);
  assert.match(checkHoldInput({ lotId: LOT, staffId: "test-rep-a", client: "x".repeat(121) }) ?? "", /120/);
});

test("land rules: a staff id is lower-case words joined by hyphens, so an uppercase one is refused", () => {
  assert.equal(checkHoldInput({ lotId: LOT, staffId: "test-rep-a" }), null);
  assert.match(checkHoldInput({ lotId: LOT, staffId: "Test-Rep-A" }) ?? "", /viewing as/);
});
