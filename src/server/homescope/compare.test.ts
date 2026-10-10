import { test } from "node:test";
import assert from "node:assert/strict";
import { compareWithSnapshot } from "./compare";
import { testBuilder } from "./test-boards";

const siteCost = (name: string, price: number) => ({ name, price, workType: "Test" });

test("compare: matching builders say so; differences are listed per section; new and missing builders are named", () => {
  const snapA = testBuilder("Test Builder A");
  const snapB = testBuilder("Test Builder B");
  const nowA = testBuilder("Test Builder A");
  const nowB = { ...testBuilder("Test Builder B"), variations: [{ area: "Test", code: "T1", description: "Test", unit: "EA", charge: 1, credit: 0 }] };
  const nowC = testBuilder("Test Builder C");
  assert.deepEqual(compareWithSnapshot([nowA, nowB, nowC], [snapA, snapB, testBuilder("Test Builder D")]), [
    "Test Builder A: matches the snapshot",
    'Test Builder B: variations 0 -> 1, variations row 0 differs: undefined vs {"area":"Test","charge":1,"code":"T1","credit":0,"description":"Test","unit":"EA"}',
    "Test Builder D: in the snapshot, not on Monday",
    "Test Builder C: new, 1 designs",
  ]);
});

test("compare: a row that differs only in price is reported with its row index", () => {
  const snap = { ...testBuilder("Test Builder A"), siteCosts: [siteCost("Test One", 100), siteCost("Test Two", 200)] };
  const now = { ...testBuilder("Test Builder A"), siteCosts: [siteCost("Test One", 100), siteCost("Test Two", 250)] };
  assert.deepEqual(compareWithSnapshot([now], [snap]), [
    'Test Builder A: siteCosts row 1 differs: {"name":"Test Two","price":200,"workType":"Test"} vs {"name":"Test Two","price":250,"workType":"Test"}',
  ]);
});

test("compare: a builder that differs only in import-only fields still matches the snapshot", () => {
  const snap = { ...testBuilder("Test Builder A"), siteCosts: [siteCost("Test One", 100)], colours: [{ name: "Test Colour", price: 0 }] };
  const now = {
    ...testBuilder("Test Builder A"),
    logo: { assetId: "1", name: "logo.png" },
    siteCosts: [{ ...siteCost("Test One", 100), costType: "Fixed" }],
    colours: [{ name: "Test Colour", price: 0, description: "Test", image: { assetId: "2", name: "c.jpg" } }],
  };
  now.models = [{ ...now.models[0], blockType: "Test", notes: "Test" }];
  assert.deepEqual(compareWithSnapshot([now], [snap]), ["Test Builder A: matches the snapshot"]);
});

test("compare: a bolt-on difference is reported", () => {
  const snap = { ...testBuilder("Test Builder A"), boltOns: { "Test Model": [{ description: "Test", charge: 10, credit: 0 }] } };
  const now = { ...testBuilder("Test Builder A"), boltOns: { "Test Model": [{ description: "Test", charge: 15, credit: 0 }] } };
  const [line] = compareWithSnapshot([now], [snap]);
  assert.match(line, /^Test Builder A: boltOns row 0 differs: /);
  assert.match(line, /"charge":10/);
  assert.match(line, /"charge":15/);
});

test("compare: long rows are cut to about 120 characters", () => {
  const long = "x".repeat(300);
  const snap = { ...testBuilder("Test Builder A"), siteCosts: [siteCost(long, 1)] };
  const now = { ...testBuilder("Test Builder A"), siteCosts: [siteCost(long, 2)] };
  const [line] = compareWithSnapshot([now], [snap]);
  assert.ok(line.length < 330, line.length.toString());
  assert.match(line, /\.\.\./);
});
