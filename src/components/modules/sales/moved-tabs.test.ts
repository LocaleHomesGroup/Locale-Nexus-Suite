import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { portalHrefFor } from "./moved-tabs";

/** Every .ts/.tsx under `dir`, tests excluded. */
function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sources(path);
    return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
  });
}

test("nothing in the app still links to a Sales section that moved to the portal", () => {
  // A rail key, a built URL, or the store's go(): go() builds its URL at run time.
  const stale = /"sales:(week|submissions)"|\/sales\?tab=(week|submissions)\b|go\(\s*"sales"\s*,\s*"(week|submissions)"/;
  const offenders = [...sources("src"), ...sources("app")]
    .filter((f) => !f.endsWith("moved-tabs.ts"))
    .filter((f) => stale.test(readFileSync(f, "utf8")))
    .map((f) => relative(".", f));
  assert.deepEqual(offenders, []);
});

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
