import { test } from "node:test";
import assert from "node:assert/strict";
import { num, toCatalogue } from "./to-catalogue";
import { boards, item } from "./test-boards";

const A = () => item("builders", "Test Builder A", { address: "1 Test Street, Perth WA, Australia", allowanceOnPrelim: true, logo: 77 }, { id: 1 });
const B = () => item("builders", "Test Builder B", { bundleAllowance: true }, { id: 2 });
const base = () => item("levels", "Base", { position: 1 }, { id: 31 });
const level1 = () => item("levels", "Level 1", { position: 2 }, { id: 32 });

test("builders: one per item on the Builders board, in board order, with the flags and the logo", () => {
  const { builders } = toCatalogue(boards({ builders: [A(), B()] }));
  assert.deepEqual(builders.map((b) => b.name), ["Test Builder A", "Test Builder B"]);
  assert.equal(builders[0].address, "1 Test Street, Perth WA, Australia");
  assert.equal(builders[0].allowanceOnPrelim, true);
  assert.equal(builders[0].bundleAllowance, false);
  assert.equal(builders[1].bundleAllowance, true);
  assert.deepEqual(builders[0].logo, { assetId: "77", name: "image-77.jpg" });
  assert.equal(builders[1].logo, null);
});

test("spec ranges: the price column's letter, and the linked level's name and position", () => {
  const { builders } = toCatalogue(
    boards({
      builders: [A()],
      levels: [base(), level1()],
      ranges: [
        item("ranges", "Test Range One", { builder: ["1"], priceColumn: "Specs Range A Price", level: ["31"] }),
        item("ranges", "Test Range Two", { builder: ["1"], priceColumn: "Specs Range C Price", level: ["32"] }),
      ],
    }),
  );
  assert.deepEqual(builders[0].ranges, [
    { name: "Test Range One", level: "Base", position: 1, column: "A" },
    { name: "Test Range Two", level: "Level 1", position: 2, column: "C" },
  ]);
});

test("spec ranges: one with an unreadable price column or no level is skipped and reported", () => {
  const { builders, warnings } = toCatalogue(
    boards({
      builders: [A()],
      levels: [base()],
      ranges: [
        item("ranges", "Test Range Odd", { builder: ["1"], priceColumn: "Price A", level: ["31"] }),
        item("ranges", "Test Range Loose", { builder: ["1"], priceColumn: "Specs Range B Price", level: [] }),
      ],
    }),
  );
  assert.deepEqual(builders[0].ranges, []);
  assert.deepEqual(
    warnings.filter((w) => w.board === "Specification Ranges").map((w) => [w.board, w.items]),
    [
      ["Specification Ranges", ["Test Range Odd"]],
      ["Specification Ranges", ["Test Range Loose"]],
    ],
  );
});

test("models: every field, prices only for letters that have one, and a blank price left out (not $0)", () => {
  const { builders } = toCatalogue(
    boards({
      builders: [A()],
      models: [
        item("models", "Test Model", {
          builder: ["1"],
          priceA: 300000,
          priceB: null,
          priceC: 0,
          frontage: 12.5,
          houseArea: 150.5,
          totalArea: 201,
          beds: 4,
          baths: 2,
          corner: true,
          blockType: "Dual Living",
          notes: "Carport",
        }),
      ],
    }),
  );
  assert.deepEqual(builders[0].models, [
    {
      name: "Test Model",
      frontage: 12.5,
      houseArea: 150.5,
      totalArea: 201,
      beds: 4,
      baths: 2,
      corner: true,
      prices: { A: 300000, C: 0 },
      blockType: "Dual Living",
      notes: "Carport",
    },
  ]);
});

test("models: an unlinked model is left out, as HomeScope leaves it out, and reported once by name", () => {
  const { builders, warnings } = toCatalogue(
    boards({
      builders: [A()],
      models: [item("models", "Test Loose", { priceA: 1 }), item("models", "Test Loose", { priceA: 2 })],
    }),
  );
  assert.deepEqual(builders[0].models, []);
  assert.deepEqual(warnings.filter((w) => w.board === "Models"), [
    { board: "Models", message: "isn't linked to a builder, so HomeScope doesn't show it", items: ["Test Loose"] },
  ]);
});

test("models: no price, no frontage on a non-corner design, or a name used twice are kept and reported", () => {
  const { builders, warnings } = toCatalogue(
    boards({
      builders: [A()],
      models: [
        item("models", "Test Unpriced", { builder: ["1"], frontage: 10 }),
        item("models", "Test Narrow", { builder: ["1"], priceA: 1 }),
        item("models", "Test Twin", { builder: ["1"], priceA: 1, frontage: 10 }),
        item("models", "test twin", { builder: ["1"], priceA: 2, frontage: 10 }),
      ],
    }),
  );
  assert.equal(builders[0].models.length, 4);
  const said = Object.fromEntries(warnings.map((w) => [w.message, w.items]));
  assert.deepEqual(said["has no price in any spec range"], ["Test Unpriced"]);
  assert.deepEqual(said["has no To Suit Block and isn't a corner design, so no block search finds it"], ["Test Narrow"]);
  assert.deepEqual(said["appears twice at Test Builder A; HomeScope prices the first"], ["test twin"]);
});

test("archived and deleted items are ignored", () => {
  const { builders } = toCatalogue(
    boards({
      builders: [A(), item("builders", "Test Builder Gone", {}, { id: 9, state: "archived" })],
      models: [item("models", "Test Old", { builder: ["1"], priceA: 1, frontage: 10 }, { state: "deleted" })],
    }),
  );
  assert.deepEqual(builders.map((b) => b.name), ["Test Builder A"]);
  assert.deepEqual(builders[0].models, []);
});

test("numbers: commas, a dollar sign and spaces are dropped; blank or unreadable is null", () => {
  assert.equal(num({ type: "numbers", text: "$1,234.50", value: "$1,234.50" }), 1234.5);
  assert.equal(num({ type: "numbers", text: "0", value: "0" }), 0);
  assert.equal(num({ type: "numbers", text: "", value: null }), null);
  assert.equal(num({ type: "numbers", text: "n/a", value: "n/a" }), null);
  assert.equal(num(undefined), null);
});

test("elevations use Style Name and Style Price; colours are free and keep their description and image", () => {
  const { builders } = toCatalogue(
    boards({
      builders: [A(), B()],
      elevations: [
        item("elevations", "Front Elevation", { builder: ["1"], style: "Test Gable", price: 1500, image: 5 }),
        item("elevations", "Front Elevation", { builder: ["1"], style: null, price: null }),
      ],
      colours: [item("colours", "Test Scheme", { builder: ["1", "2"], description: "Test", image: 6 })],
    }),
  );
  assert.deepEqual(builders[0].elevations, [
    { name: "Test Gable", price: 1500, image: { assetId: "5", name: "image-5.jpg" } },
    { name: "Front Elevation", price: 0, image: null },
  ]);
  const scheme = { name: "Test Scheme", price: 0, description: "Test", image: { assetId: "6", name: "image-6.jpg" } };
  assert.deepEqual(builders[0].colours, [scheme]);
  assert.deepEqual(builders[1].colours, [scheme]);
});

test("site works keep their work type and cost type", () => {
  const { builders } = toCatalogue(
    boards({
      builders: [A()],
      siteCosts: [item("siteCosts", "Test Site Option", { builder: ["1"], workType: "Test Footing", costType: "Provisional Sum", price: 9000 })],
    }),
  );
  assert.deepEqual(builders[0].siteCosts, [{ name: "Test Site Option", workType: "Test Footing", costType: "Provisional Sum", price: 9000 }]);
});

test("title allowances: one rule copied to each linked builder, with Topup Amount as the rule's initial amount", () => {
  const { builders } = toCatalogue(
    boards({
      builders: [A(), B()],
      allowances: [
        item("allowances", "More than 6 months", { builders: ["1", "2"], holdMonths: 6, type: "Cumulative Percentage of Base Price", value: 1.5, monthlyStep: 0.5, topUp: 250 }),
      ],
    }),
  );
  const rule = { due: "More than 6 months", holdMonths: 6, type: "Cumulative Percentage of Base Price", value: 1.5, monthlyStep: 0.5, initial: 250 };
  assert.deepEqual(builders[0].allowances, [rule]);
  assert.deepEqual(builders[1].allowances, [rule]);
});

test("BAL, coastal and noise rates keep their floor-area band, or null when the builder doesn't band", () => {
  const { builders } = toCatalogue(
    boards({
      builders: [A()],
      bal: [item("bal", "Test BAL", { builder: ["1"], price: 4000, area: 200 })],
      coastal: [item("coastal", "Test Coastal", { builder: ["1"], price: 0 })],
      noise: [item("noise", "Test Noise", { builder: ["1"], price: 5000, area: null })],
    }),
  );
  assert.deepEqual(builders[0].bal, [{ name: "Test BAL", price: 4000, area: 200 }]);
  assert.deepEqual(builders[0].coastal, [{ name: "Test Coastal", price: 0, area: null }]);
  assert.deepEqual(builders[0].noise, [{ name: "Test Noise", price: 5000, area: null }]);
});

test("variations: the builder comes from the Builder status, with no link at all, as HomeScope reads it", () => {
  const { builders, warnings } = toCatalogue(
    boards({
      builders: [A()],
      variations: [
        item("variations", "Electrical", { builder: "Test Builder A", code: "T_EL_001", description: "Test point", unit: "EA", charge: 120, credit: null }),
        item("variations", "Electrical", { builder: "Test Builder Z", code: "T_EL_002" }),
        item("variations", "Electrical", { code: "T_EL_003" }),
      ],
    }),
  );
  assert.deepEqual(builders[0].variations, [
    { area: "Electrical", code: "T_EL_001", description: "Test point", unit: "EA", charge: 120, credit: 0 },
  ]);
  assert.deepEqual(
    warnings.filter((w) => w.board === "Variations").map((w) => w.message),
    ['names builder "Test Builder Z", which isn\'t on the Builders board', "has no Builder"],
  );
});

test("bolt-ons: 'Bolt On Pricing - <design>' lines go to that design, matched without regard to case; others are skipped and reported once", () => {
  const { builders, warnings } = toCatalogue(
    boards({
      builders: [A()],
      models: [item("models", "Test Model", { builder: ["1"], priceA: 1, frontage: 10 })],
      variations: [
        item("variations", "Bolt On Pricing - test model", { builder: "Test Builder A", description: "Test cooling", charge: 9000 }),
        item("variations", "Bolt On Pricing - Test Model", { builder: "Test Builder A", description: "Test flooring", charge: 4000, credit: 100 }),
        item("variations", "Bolt On Pricing - Test Retired", { builder: "Test Builder A", description: "Test", charge: 1 }),
        item("variations", "Bolt On Pricing - Test Retired", { builder: "Test Builder A", description: "Test", charge: 2 }),
      ],
    }),
  );
  assert.deepEqual(builders[0].boltOns, {
    "Test Model": [
      { description: "Test cooling", charge: 9000, credit: 0 },
      { description: "Test flooring", charge: 4000, credit: 100 },
    ],
  });
  assert.deepEqual(builders[0].variations, []);
  assert.deepEqual(warnings.filter((w) => w.board === "Variations"), [
    {
      board: "Variations",
      message: "is bolt-on pricing for a design Test Builder A doesn't have, so HomeScope skips it",
      items: ["Bolt On Pricing - Test Retired"],
    },
  ]);
});

test("a builder with designs but no spec ranges, or with no delayed-title rule, is reported", () => {
  const { warnings } = toCatalogue(
    boards({ builders: [A()], models: [item("models", "Test Model", { builder: ["1"], priceA: 1, frontage: 10 })] }),
  );
  const said = Object.fromEntries(warnings.map((w) => [w.message, w.items]));
  assert.deepEqual(said["has designs but no spec ranges, so none of them can be priced"], ["Test Builder A"]);
  assert.deepEqual(said["has no delayed-title rule, so HomeScope adds no title allowance"], ["Test Builder A"]);
});
