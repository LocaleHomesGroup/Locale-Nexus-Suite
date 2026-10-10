import { test } from "node:test";
import assert from "node:assert/strict";
import { CatalogueFormatError, resolveColumns } from "./boards";
import { allColumns } from "./test-boards";

test("columns: found by title and type, so a stray text column with the same title is skipped", () => {
  const columns = allColumns();
  // The Models board has dozens of text columns titled "Builder" before the real link column.
  columns.models = [
    { id: "stray_1", title: "Builder", type: "text" },
    { id: "stray_2", title: "Builder", type: "text" },
    ...columns.models,
  ];
  const ids = resolveColumns(columns);
  assert.equal(ids.models.builder, "models.builder");
  assert.equal(ids.variations.builder, "variations.builder");
});

test("columns: a title matches without regard to case or surrounding spaces", () => {
  const columns = allColumns();
  columns.models = columns.models.map((c) => (c.id === "models.priceB" ? { ...c, title: "  specs range b price " } : c));
  assert.equal(resolveColumns(columns).models.priceB, "models.priceB");
});

test("columns: a renamed or deleted column stops the import and names every one missing", () => {
  const columns = allColumns();
  columns.models = columns.models.filter((c) => c.id !== "models.priceB");
  columns.variations = columns.variations.map((c) => (c.id === "variations.charge" ? { ...c, title: "Charge (inc GST)" } : c));
  assert.throws(
    () => resolveColumns(columns),
    (e: unknown) =>
      e instanceof CatalogueFormatError &&
      e.problems.length === 2 &&
      /Models has no numbers column titled "Specs Range B Price"/.test(e.message) &&
      /Variations has no numbers column titled "Charge"/.test(e.message) &&
      /Nothing was imported/.test(e.message),
  );
});
