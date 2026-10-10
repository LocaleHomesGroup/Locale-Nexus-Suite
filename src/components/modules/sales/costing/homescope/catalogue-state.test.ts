import { test } from "node:test";
import assert from "node:assert/strict";
import type { Catalogue, ImportRecord } from "@/data/homescope";
import { catalogueLabel, nextState, readCatalogue, stateFrom } from "./catalogue-state";

const snapshot: Catalogue = { builders: [], source: "snapshot", asOf: "2026-10-06" };
const imported: Catalogue = { builders: [], source: "monday", asOf: "2026-10-10T07:12:00.000Z" };
const run: ImportRecord = { id: "r1", finishedAt: imported.asOf, trigger: "cli", status: "ok", calls: 29, builders: 9, changed: 9, warnings: [], error: null };

test("state: an import is used when there is one", () => {
  const s = stateFrom({ kind: "live", catalogue: imported, lastImport: run }, snapshot);
  assert.equal(s.status, "ready");
  assert.equal(s.catalogue, imported);
  assert.equal(s.live, true);
  assert.equal(s.lastImport, run);
  assert.equal(s.note, null);
});

test("state: no database, nothing imported yet, a route error or no answer all fall back to the snapshot and say why", () => {
  const off = stateFrom({ kind: "off" }, snapshot);
  assert.deepEqual([off.status, off.catalogue, off.live, off.note], ["ready", snapshot, false, null]);

  const none = stateFrom({ kind: "live", catalogue: null, lastImport: null }, snapshot);
  assert.equal(none.catalogue, snapshot);
  assert.equal(none.live, true);
  assert.match(none.note ?? "", /Nothing has been imported from Monday yet/);

  const failed = stateFrom({ kind: "error", message: "The imported catalogue can't be read right now." }, snapshot);
  assert.equal(failed.catalogue, snapshot);
  assert.equal(failed.note, "The imported catalogue can't be read right now.");

  const silent = stateFrom(null, snapshot);
  assert.equal(silent.status, "ready");
  assert.equal(silent.catalogue, snapshot);
  assert.match(silent.note ?? "", /Couldn't reach the imported catalogue/);
});

test("label: an import shows Monday and its Perth date and time; the snapshot shows its date", () => {
  assert.equal(catalogueLabel(snapshot), "Price snapshot · 6 Oct 2026");
  // 07:12 UTC is 3:12pm in Perth.
  assert.equal(catalogueLabel(imported), "Monday · 10 Oct 2026, 3:12pm");
});

test("read: a fetch that never answers gives up at the timeout", async () => {
  const hang = ((_url: string, init: RequestInit) =>
    new Promise((_, reject) => init.signal?.addEventListener("abort", () => reject(new Error("aborted"))))) as unknown as typeof fetch;
  assert.equal(await readCatalogue(hang, 50), null);
});

test("read: an answer that isn't JSON gives null", async () => {
  const page = (async () => ({ json: async () => Promise.reject(new SyntaxError("not json")) })) as unknown as typeof fetch;
  assert.equal(await readCatalogue(page), null);
});

test("read: a JSON answer comes back as it is", async () => {
  const ok = (async () => ({ json: async () => ({ kind: "off" }) })) as unknown as typeof fetch;
  assert.deepEqual(await readCatalogue(ok), { kind: "off" });
});

test("next: a failed refresh keeps the imported catalogue and says when it was loaded", () => {
  const cached = stateFrom({ kind: "live", catalogue: imported, lastImport: run }, snapshot);
  const fetched = stateFrom(null, snapshot);
  const next = nextState(cached, fetched);
  assert.equal(next.catalogue, imported);
  assert.equal(next.lastImport, run);
  assert.equal(next.note, "Couldn't refresh the imported catalogue, so these are the prices loaded at Monday · 10 Oct 2026, 3:12pm.");
});

test("next: an import fetched over a cached import is taken, and with no cache the fetch is taken", () => {
  const cached = stateFrom({ kind: "live", catalogue: imported, lastImport: run }, snapshot);
  const newer: Catalogue = { builders: [], source: "monday", asOf: "2026-10-11T01:00:00.000Z" };
  const fetched = stateFrom({ kind: "live", catalogue: newer, lastImport: run }, snapshot);
  assert.equal(nextState(cached, fetched), fetched);
  assert.equal(nextState(null, fetched), fetched);
  const snap = stateFrom(null, snapshot);
  assert.equal(nextState(null, snap), snap);
});
