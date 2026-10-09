import { test } from "node:test";
import assert from "node:assert/strict";
import { matchRepAliases, normaliseName, planFromJerryConfig, regionOf } from "./setup";

/** The pure rules in setup.ts that setup.test.ts doesn't pin. The people here are invented. */

/** A tilde as a mark of its own: with the n before it, the same letter as the one-character n-tilde, written the other way. */
const COMBINING_TILDE = String.fromCharCode(0x303);

type Staff = { id: string; name: string | null; preferred_name: string | null };
const person = (id: string, name: string, preferred_name: string | null = null): Staff => ({ id, name, preferred_name });

/** The result with the staff as given, and with them reversed: a name must never depend on which row comes first. */
const inBothOrders = (names: string[], staff: Staff[]) => [matchRepAliases(names, staff), matchRepAliases(names, [...staff].reverse())];

test("rep names: a name that is one person's full name and another's go-by plus surname matches nobody", () => {
  // "Sam Testlee" is Sam's full name, and Samuel's go-by (Sam) plus his surname.
  const staff = [person("test-sam-testlee", "Sam Testlee"), person("test-samuel-testlee", "Samuel Testlee", "Sam")];
  for (const result of inBothOrders(["Sam Testlee", "Samuel Testlee"], staff)) {
    assert.deepEqual(result.unmatched, ["Sam Testlee"]);
    assert.deepEqual(result.matched, [{ rep: "Samuel Testlee", staffId: "test-samuel-testlee" }]);
  }
});

test("rep names: a first-plus-last name that two people share matches nobody, and each full name still matches", () => {
  // "John Testsmith" is the first plus last name of both. Michael also goes by Mick, which is his alone.
  const staff = [person("test-john-michael", "John Michael Testsmith", "Mick"), person("test-john-paul", "John Paul Testsmith")];
  for (const result of inBothOrders(["John Testsmith", "John Michael Testsmith", "John Paul Testsmith", "Mick Testsmith"], staff)) {
    assert.deepEqual(result.unmatched, ["John Testsmith"]);
    assert.deepEqual(result.matched, [
      { rep: "John Michael Testsmith", staffId: "test-john-michael" },
      { rep: "John Paul Testsmith", staffId: "test-john-paul" },
      { rep: "Mick Testsmith", staffId: "test-john-michael" },
    ]);
  }
});

test("rep names: two people with one full name match nobody", () => {
  const staff = [person("test-alex-testchen-a", "Alex Testchen"), person("test-alex-testchen-b", "Alex Testchen")];
  for (const result of inBothOrders(["Alex Testchen"], staff)) {
    assert.deepEqual(result.matched, []);
    assert.deepEqual(result.unmatched, ["Alex Testchen"]);
  }
});

test("rep names: one person claiming a key twice is still one person", () => {
  // Full name "Sam Testlee", and go-by "Sam" plus the surname: the same key, claimed twice by one person.
  const staff = [person("test-sam-testlee", "Sam Testlee", "Sam")];
  const result = matchRepAliases(["Sam Testlee"], staff);
  assert.deepEqual(result.matched, [{ rep: "Sam Testlee", staffId: "test-sam-testlee" }]);
  assert.deepEqual(result.unmatched, []);
});

test("rep names: accents are folded, so Peña and Pena are one name", () => {
  assert.equal(normaliseName("Cris Peña"), "cris pena");
  assert.equal(normaliseName("Cris Pena"), "cris pena");
  assert.equal(normaliseName("CRIS PEÑA"), "cris pena");
  assert.equal(normaliseName("Cris Pen" + COMBINING_TILDE + "a"), "cris pena", "the tilde as a separate mark too");
  assert.equal(normaliseName("  O’Neill,  Seán "), "o'neill sean", "and the rest of normalising still applies");

  const accented = [person("test-cris-pena", "Cris Peña")];
  assert.deepEqual(
    matchRepAliases(["cris pena", "CRIS PEÑA"], accented).matched,
    [
      { rep: "cris pena", staffId: "test-cris-pena" },
      { rep: "CRIS PEÑA", staffId: "test-cris-pena" },
    ],
  );
  const plain = [person("test-cris-pena", "Cris Pena")];
  assert.deepEqual(matchRepAliases(["Cris Peña"], plain).matched, [{ rep: "Cris Peña", staffId: "test-cris-pena" }]);
});

test("rep names: a name with nothing left once normalised is listed as unmatched, and a blank one is not", () => {
  // Wholly in another script, or only punctuation: there is a name, so a person should see it listed.
  const result = matchRepAliases(["王小明", "???", "   ", "", "Test Rep A"], [person("test-rep-a", "Test Rep A")]);
  assert.deepEqual(result.unmatched, ["王小明", "???"]);
  assert.deepEqual(result.matched, [{ rep: "Test Rep A", staffId: "test-rep-a" }]);
});

test("regions: all eight that the table allows are read from the end of the board key", () => {
  for (const code of ["wa", "vic", "qld", "nsw", "sa", "nt", "tas", "act"]) {
    assert.equal(regionOf(`homes_sales_${code}`), code.toUpperCase());
    assert.equal(regionOf(`wealth_construction_${code}`), code.toUpperCase());
  }
  assert.equal(regionOf("wealth_sales"), null, "no region in the key");
  assert.equal(regionOf("homes_sales_xyz"), null, "not a region");
  assert.equal(regionOf("homes_contract"), null, "the suffix needs its own underscore");
  assert.equal(regionOf("exclusive_land"), null);
});

test("plan: null entries inside the column sections are skipped, not an error", () => {
  const vocabulary = new Set(["job_number"]);
  const boards = { homes_sales_wa: { parent: 100, subitems: 101 }, _note: null, models: null };
  const config = {
    boards,
    parentColumns: { shared_homes: null, per_board: null },
    subitemColumns: { all_boards: null, per_board: null },
  };
  const plan = planFromJerryConfig(config, vocabulary);
  assert.deepEqual(plan.boards.map((b) => b.boardKey), ["homes_sales_wa"]);
  assert.deepEqual(plan.fields, []);
});

test("plan: a config with boards but no column sections gives the boards and no fields, not an error", () => {
  const vocabulary = new Set(["job_number"]);
  const boards = { homes_sales_wa: { parent: 100, subitems: 101 } };
  const thin = [{ boards }, { boards, parentColumns: {} }, { boards, subitemColumns: {} }, { boards, parentColumns: {}, subitemColumns: {} }];
  for (const config of thin) {
    const plan = planFromJerryConfig(config, vocabulary);
    assert.deepEqual(plan.boards.map((b) => [b.boardKey, b.parentId, b.subitemsId]), [["homes_sales_wa", 100, 101]]);
    assert.deepEqual(plan.fields, []);
    assert.deepEqual(plan.unknownFields, []);
  }
});
