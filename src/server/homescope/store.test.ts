import { after, before, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { migratedTestDb } from "../db/pglite";
import type { Db } from "../db/types";
import { loadCatalogue, loadLastImport, recordFailedImport, saveImport } from "./store";
import { testBuilder } from "./test-boards";

let db: Db;
let close: () => Promise<void>;
before(async () => ({ db, close } = await migratedTestDb()));
after(async () => close());
beforeEach(async () => {
  await db.query("delete from launchpad.homescope_catalogues");
  await db.query("delete from launchpad.homescope_imports");
});

const save = (builders = [testBuilder("Test Builder A"), testBuilder("Test Builder B")]) =>
  saveImport(db, { builders, warnings: [{ board: "Models", message: "has no price in any spec range", items: ["Test Model"] }], calls: 29, trigger: "cli" });
const current = () =>
  db.query<{ builder: string; source: string; has_import: boolean }>(
    "select builder, source, import_id is not null as has_import from launchpad.homescope_catalogues where is_current order by builder",
  );

test("save: the first import writes one current version per builder, from Monday, tied to its run", async () => {
  const r = await save();
  assert.deepEqual(r.changed, ["Test Builder A", "Test Builder B"]);
  assert.deepEqual(r.retired, []);
  assert.deepEqual(await current(), [
    { builder: "Test Builder A", source: "monday", has_import: true },
    { builder: "Test Builder B", source: "monday", has_import: true },
  ]);
});

test("save: importing the same catalogue again writes no new version and records 0 changed", async () => {
  await save();
  const again = await save();
  assert.deepEqual(again.changed, []);
  const [{ n }] = await db.query<{ n: number }>("select count(*)::int as n from launchpad.homescope_catalogues");
  assert.equal(n, 2);
  assert.equal((await loadLastImport(db))?.changed, 0);
});

test("save: a changed builder gets a new current version and keeps the old one as history", async () => {
  await save();
  const r = await save([testBuilder("Test Builder A", 310_000), testBuilder("Test Builder B")]);
  assert.deepEqual(r.changed, ["Test Builder A"]);
  const versions = await db.query<{ is_current: boolean; price: number }>(
    "select is_current, (data->'models'->0->'prices'->>'A')::int as price from launchpad.homescope_catalogues where builder = 'Test Builder A' order by captured_at, is_current",
  );
  assert.deepEqual(versions, [
    { is_current: false, price: 300_000 },
    { is_current: true, price: 310_000 },
  ]);
});

test("save: a builder gone from Monday is retired, so HomeScope stops offering it", async () => {
  await save();
  const r = await save([testBuilder("Test Builder A")]);
  assert.deepEqual(r.retired, ["Test Builder B"]);
  assert.deepEqual((await current()).map((c) => c.builder), ["Test Builder A"]);
  assert.equal((await loadLastImport(db))?.changed, 1);
});

test("a failed import is recorded with its error and leaves the current catalogue alone", async () => {
  await save();
  await recordFailedImport(db, { error: "Monday's daily limit is spent", calls: 12, trigger: "screen" });
  assert.equal((await current()).length, 2);
  const last = await loadLastImport(db);
  assert.equal(last?.status, "failed");
  assert.equal(last?.error, "Monday's daily limit is spent");
  assert.equal(last?.calls, 12);
  assert.equal(last?.trigger, "screen");
});

test("load: null before any import; then every current builder by name, as of the last good import", async () => {
  assert.equal(await loadCatalogue(db), null);
  assert.equal(await loadLastImport(db), null);
  await save([testBuilder("Test Builder B"), testBuilder("Test Builder A")]);
  const c = await loadCatalogue(db);
  assert.equal(c?.source, "monday");
  assert.deepEqual(c?.builders.map((b) => b.name), ["Test Builder A", "Test Builder B"]);
  const last = await loadLastImport(db);
  assert.equal(c?.asOf, last?.finishedAt);
  assert.deepEqual(last?.warnings, [{ board: "Models", message: "has no price in any spec range", items: ["Test Model"] }]);
  assert.equal(last?.builders, 2);
});

test("save: empty builders list is rejected before any transaction, leaving the catalogue untouched", async () => {
  await save();
  const before = await current();
  try {
    await saveImport(db, { builders: [], warnings: [], calls: 0, trigger: "cli" });
    assert.fail("should have thrown");
  } catch (e) {
    assert.match(String(e), /No builders to save/);
  }
  const after = await current();
  assert.deepEqual(after, before);
  assert.equal((await loadLastImport(db))?.builders, 2);
});

test("save: a failed insert mid-transaction rolls back the entire save", async () => {
  await save();
  const before = await current();
  try {
    await saveImport(db, {
      builders: [testBuilder("Test Builder A", 310_000), { ...testBuilder("Test Builder C"), name: null as unknown as string }],
      warnings: [],
      calls: 0,
      trigger: "cli",
    });
    assert.fail("should have thrown");
  } catch (e) {
    // Expected to fail due to null name violating builder not null constraint
  }
  const [{ n: imports }] = await db.query<{ n: number }>("select count(*)::int as n from launchpad.homescope_imports");
  assert.equal(imports, 1, "should have exactly 1 import row (the first one)");
  const versions = await db.query<{ is_current: boolean; price: number }>(
    "select is_current, (data->'models'->0->'prices'->>'A')::int as price from launchpad.homescope_catalogues where builder = 'Test Builder A' order by captured_at, is_current",
  );
  assert.equal(versions.length, 1, "Test Builder A should have exactly 1 version");
  assert.equal(versions[0]?.price, 300_000, "Test Builder A price should still be 300_000");
  const after = await current();
  assert.deepEqual(after, before);
});

test("load: a current snapshot-source row is ignored, so the catalogue is always labelled from Monday", async () => {
  await save([testBuilder("Test Builder A")]);
  await db.query(
    "insert into launchpad.homescope_catalogues (builder, captured_at, source, data, is_current) values ('Test Builder Z', now(), 'snapshot', $1::jsonb, true)",
    [JSON.stringify(testBuilder("Test Builder Z"))],
  );
  const c = await loadCatalogue(db);
  assert.equal(c?.source, "monday");
  assert.deepEqual(c?.builders.map((b) => b.name), ["Test Builder A"]);
});
