import { after, before, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { migratedTestDb } from "../db/pglite";
import type { Db } from "../db/types";
import { MondayCapReachedError, MondayDailyLimitError, type MondayClient } from "../mirror/monday/client";
import { fakeMonday } from "../mirror/monday/test-fakes";
import type { EstimationBoards } from "./boards";
import { importCatalogue, importErrorMessage } from "./run";
import { loadCatalogue, loadLastImport, saveImport } from "./store";
import { boards, columnsFor, item, testBuilder } from "./test-boards";

let db: Db;
let close: () => Promise<void>;
before(async () => ({ db, close } = await migratedTestDb()));
after(async () => close());
beforeEach(async () => {
  await db.query("delete from launchpad.homescope_catalogues");
  await db.query("delete from launchpad.homescope_imports");
});

/** A Monday that answers anything with {}; the stub reader below makes `calls` of its own first. */
const monday = () => fakeMonday(() => ({}));
const reader = (calls: number, result: () => EstimationBoards) => async (m: MondayClient) => {
  for (let i = 0; i < calls; i++) await m.query("query { me { id } }");
  return result();
};
const goodBoards = () =>
  boards({
    builders: [item("builders", "Test Builder A", {}, { id: 1 })],
    levels: [item("levels", "Base", { position: 1 }, { id: 31 })],
    ranges: [item("ranges", "Test Range", { builder: ["1"], priceColumn: "Specs Range A Price", level: ["31"] })],
    models: [item("models", "Test Model", { builder: ["1"], priceA: 300000, frontage: 10 })],
  });

test("import: saves the catalogue, counts each builder, and records the run with its calls", async () => {
  const m = monday();
  const { summary } = await importCatalogue({ db, monday: m, trigger: "cli", read: reader(5, goodBoards) });
  assert.equal(summary.status, "ok");
  assert.equal(summary.calls, 5);
  assert.deepEqual(summary.changed, ["Test Builder A"]);
  assert.deepEqual(summary.builders, [
    { name: "Test Builder A", models: 1, ranges: 1, elevations: 0, colours: 0, siteCosts: 0, variations: 0, boltOnModels: 0 },
  ]);
  assert.equal((await loadCatalogue(db))?.builders[0].models[0].prices.A, 300000);
  assert.equal((await loadLastImport(db))?.calls, 5);
});

test("import: a dry run reads and checks, and writes nothing at all", async () => {
  const { summary, builders } = await importCatalogue({ db, monday: monday(), trigger: "cli", dryRun: true, read: reader(2, goodBoards) });
  assert.equal(summary.status, "ok");
  assert.equal(summary.dryRun, true);
  assert.equal(builders.length, 1);
  assert.equal(await loadCatalogue(db), null);
  assert.equal(await loadLastImport(db), null);
});

test("import: Monday stopping part-way saves nothing, records the failure, and keeps the current catalogue", async () => {
  await saveImport(db, { builders: [testBuilder("Test Builder A")], warnings: [], calls: 1, trigger: "cli" });
  const failing = async (m: MondayClient): Promise<EstimationBoards> => {
    await m.query("query { me { id } }");
    throw new MondayDailyLimitError("Monday's daily limit is spent", "DAILY_LIMIT_EXCEEDED");
  };
  const { summary } = await importCatalogue({ db, monday: monday(), trigger: "screen", read: failing });
  assert.equal(summary.status, "failed");
  assert.match(summary.error ?? "", /daily limit/);
  assert.equal((await loadCatalogue(db))?.builders[0].models[0].prices.A, 300_000);
  const last = await loadLastImport(db);
  assert.equal(last?.status, "failed");
  assert.equal(last?.calls, 1);
});

test("import: a renamed column fails with the column's name, and the current catalogue stays", async () => {
  await saveImport(db, { builders: [testBuilder("Test Builder A")], warnings: [], calls: 1, trigger: "cli" });
  const renamed = () => {
    const b = goodBoards();
    b.models.columns = columnsFor("models").map((c) => (c.id === "models.priceB" ? { ...c, title: "Range B" } : c));
    return b;
  };
  const { summary } = await importCatalogue({ db, monday: monday(), trigger: "cli", read: reader(1, renamed) });
  assert.equal(summary.status, "failed");
  assert.match(summary.error ?? "", /Models has no numbers column titled "Specs Range B Price"/);
  assert.equal((await loadCatalogue(db))?.builders.length, 1);
});

test("import: an empty Builders board fails instead of retiring every builder", async () => {
  await saveImport(db, { builders: [testBuilder("Test Builder A")], warnings: [], calls: 1, trigger: "cli" });
  const { summary } = await importCatalogue({ db, monday: monday(), trigger: "cli", read: reader(1, () => boards()) });
  assert.equal(summary.status, "failed");
  assert.match(summary.error ?? "", /no builders/);
  assert.equal((await loadCatalogue(db))?.builders.length, 1);
});

test("import: hitting the call cap reads as a plain message for Ops, and saves nothing", async () => {
  const capped = async () => {
    throw new MondayCapReachedError("Stopped after --max-calls 60, as asked.", "CAP_REACHED");
  };
  const { summary } = await importCatalogue({ db, monday: monday(), trigger: "cli", read: capped });
  assert.equal(summary.status, "failed");
  assert.equal(summary.error, "The import stopped at its limit of Monday calls before it finished, so nothing was saved. Tell the AI team.");
  assert.equal(await loadCatalogue(db), null);
});

test("import: error mapping words a cap, a unique violation and anything else", () => {
  assert.match(importErrorMessage(new MondayCapReachedError("x")), /limit of Monday calls/);
  const dup = Object.assign(new Error('duplicate key value violates unique constraint "x"'), { code: "23505" });
  assert.equal(
    importErrorMessage(dup),
    "Another import was saving at the same time, so this one stopped. The catalogue is up to date; refresh to see it.",
  );
  assert.equal(importErrorMessage(new Error("boom")), "boom");
});
