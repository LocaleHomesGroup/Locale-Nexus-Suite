import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { matchLotColumns, matchRepAliases, normaliseName, planFromJerryConfig, purposeOf, regionOf, runSetup } from "./setup";

const VOCAB = new Set([
  "job_number", "site_address", "sales_rep", "builder", "hubspot_id", "construction_stage",
  "milestone_status", "due_date", "date_completed", "files", "notes", "people",
]);

const config = {
  boards: {
    _note: "ignored",
    homes_sales_wa: { parent: 100, subitems: 101 },
    homes_construction_wa: { parent: 200, subitems: 201 },
    exclusive_land: { parent: 300, subitems: null, access: "read" },
  },
  parentColumns: {
    _note: "ignored",
    shared_homes: { _applies_to: ["homes_sales_wa", "homes_construction_wa"], job_number: "text4", sales_rep: "text_r" },
    legacy_note_only: { job_number: "text_x", _note: "no _applies_to, so skipped" },
    per_board: {
      _note: "ignored",
      homes_sales_wa: { builder: "color_a", hubspot_id: "text_h", invented_field: "x" },
      homes_construction_wa: { construction_stage: "color_c" },
    },
  },
  subitemColumns: {
    all_boards: { milestone_status: "status", due_date: "date", files: "files_a", people: "people_p" },
    per_board: { homes_construction_wa: { due_date: "date0", people: null } },
  },
};

test("setup: labels each board from its key", () => {
  assert.equal(purposeOf("homes_sales_wa"), "sales");
  assert.equal(purposeOf("wealth_construction"), "construction");
  assert.equal(purposeOf("homes_handed_over_wa"), "handed_over");
  assert.equal(purposeOf("exclusive_land"), "exclusive_land");
  assert.equal(purposeOf("models"), "models");
  assert.equal(regionOf("homes_sales_qld"), "QLD");
  assert.equal(regionOf("wealth_sales"), null);
});

test("setup: Jerry's config becomes boards and a field map", () => {
  const plan = planFromJerryConfig(config, VOCAB);
  assert.deepEqual(
    plan.boards.map((b) => [b.boardKey, b.parentId, b.subitemsId, b.purpose]),
    [
      ["homes_sales_wa", 100, 101, "sales"],
      ["homes_construction_wa", 200, 201, "construction"],
      ["exclusive_land", 300, null, "exclusive_land"],
    ],
  );
  const fields = (board: number) => Object.fromEntries(plan.fields.filter((f) => f.boardId === board).map((f) => [f.fieldKey, f.columnId]));
  assert.deepEqual(fields(100), { job_number: "text4", sales_rep: "text_r", builder: "color_a", hubspot_id: "text_h" });
  assert.deepEqual(fields(200), { job_number: "text4", sales_rep: "text_r", construction_stage: "color_c" });
  assert.deepEqual(fields(101), { milestone_status: "status", due_date: "date", files: "files_a", people: "people_p" });
  assert.deepEqual(fields(201), { milestone_status: "status", due_date: "date0", files: "files_a" });
  assert.deepEqual(plan.unknownFields, ["invented_field"]);
});

test("setup: Exclusive Land columns are matched by title, each column once", () => {
  const matched = matchLotColumns([
    { id: "name", title: "Name", type: "name" },
    { id: "status", title: "Status", type: "status" },
    { id: "text_e", title: "Estate", type: "text" },
    { id: "num_p", title: "Land Price", type: "numbers" },
    { id: "num_q", title: "Price", type: "numbers" },
    { id: "files", title: "Plans & Files", type: "file" },
    { id: "odd", title: "Something else", type: "text" },
  ]);
  assert.deepEqual(matched.fields, [
    { fieldKey: "lot_status", columnId: "status" },
    { fieldKey: "lot_estate", columnId: "text_e" },
    { fieldKey: "lot_land_price", columnId: "num_p" },
    { fieldKey: "lot_files", columnId: "files" },
  ]);
  assert.deepEqual(matched.unmatched, ["Price", "Something else"]);
});

test("setup: rep names match a person by full name, go-by name or without a middle name", () => {
  const staff = [
    { id: "jan-kane-reroma", name: "Jan Kane Reroma", preferred_name: "Kane" },
    { id: "test-rep-a", name: "Test Rep A", preferred_name: null },
  ];
  const result = matchRepAliases([" Jan Kane Reroma ", "kane reroma", "TEST REP A", "Nobody Known", ""], staff);
  // Monday's own text comes back: matchReps turns it into the key the loaders look up.
  assert.deepEqual(result.matched, [
    { rep: " Jan Kane Reroma ", staffId: "jan-kane-reroma" },
    { rep: "kane reroma", staffId: "jan-kane-reroma" },
    { rep: "TEST REP A", staffId: "test-rep-a" },
  ]);
  assert.deepEqual(result.unmatched, ["Nobody Known"]);
  assert.equal(normaliseName("  O’Neill,  Sean "), "o'neill sean");
});

test("setup: a config file with no boards stops before touching the database or Monday", async () => {
  const path = join(mkdtempSync(join(tmpdir(), "lp-setup-")), "monday.json");
  writeFileSync(path, JSON.stringify({ workspaces: {} }));
  // Any use of either fails the test with "touched" instead of the expected message.
  const untouchable = new Proxy({}, { get: () => { throw new Error("touched"); } }) as never;
  await assert.rejects(runSetup(untouchable, untouchable, { jerryConfigPath: path, log: () => {} }), /No boards/);
});
