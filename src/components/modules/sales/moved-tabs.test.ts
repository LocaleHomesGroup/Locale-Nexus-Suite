import { test } from "node:test";
import assert from "node:assert/strict";
import { portalHrefFor } from "./moved-tabs";

test("an old link to a section that moved lands on the portal's", () => {
  assert.equal(portalHrefFor("week"), "/consultant?tab=week");
  assert.equal(portalHrefFor("submissions"), "/consultant?tab=submissions");
});

test("sections that stayed, no tab, and object keys don't redirect", () => {
  assert.equal(portalHrefFor("pipeline"), null);
  assert.equal(portalHrefFor("clients"), null);
  assert.equal(portalHrefFor(null), null);
  assert.equal(portalHrefFor("toString"), null);
});
