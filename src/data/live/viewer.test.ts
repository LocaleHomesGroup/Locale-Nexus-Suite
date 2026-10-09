import { test } from "node:test";
import assert from "node:assert/strict";
import { askedRep, pickViewer, readRememberedViewer, VIEWER_KEY, writeRememberedViewer } from "./viewer";

const reps = [
  { id: "test-rep-a", name: "Test Rep A" },
  { id: "test-rep-b", name: "Test Rep B" },
];

test("viewer: the rep in ?as=, else the first rep, else nobody", () => {
  assert.equal(pickViewer(reps, "test-rep-b")?.id, "test-rep-b");
  assert.equal(pickViewer(reps, "not-a-rep")?.id, "test-rep-a");
  assert.equal(pickViewer(reps, null)?.id, "test-rep-a");
  assert.equal(pickViewer([], "test-rep-a"), null);
});

test("viewer: with no ?as=, the rep picked last wins over the first rep", () => {
  assert.equal(pickViewer(reps, null, "test-rep-b")?.id, "test-rep-b");
});

test("viewer: with an unknown ?as=, the rep picked last wins over the first rep", () => {
  assert.equal(pickViewer(reps, "not-a-rep", "test-rep-b")?.id, "test-rep-b");
});

test("viewer: ?as= beats the rep picked last", () => {
  assert.equal(pickViewer(reps, "test-rep-a", "test-rep-b")?.id, "test-rep-a");
});

test("viewer: a remembered rep who is not on the list falls back to the first rep", () => {
  assert.equal(pickViewer(reps, null, "gone-rep")?.id, "test-rep-a");
});

test("viewer: only a ?as= that names a rep on the list is an explicit pick worth remembering", () => {
  assert.equal(askedRep(reps, "test-rep-b"), "test-rep-b");
  assert.equal(askedRep(reps, "not-a-rep"), null);
  assert.equal(askedRep(reps, null), null);
  assert.equal(askedRep([], "test-rep-a"), null);
});

/** A stand-in for sessionStorage: getItem and setItem over a Map. */
function memoryStore(initial: Record<string, string> = {}) {
  const items = new Map(Object.entries(initial));
  return {
    items,
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => void items.set(key, value),
  };
}

test("viewer: the pick is kept under one storage key and read back from it", () => {
  const store = memoryStore();
  assert.equal(readRememberedViewer(() => store), null);
  writeRememberedViewer(() => store, "test-rep-b");
  assert.equal(VIEWER_KEY, "launchpad:viewing-as");
  assert.equal(store.items.get(VIEWER_KEY), "test-rep-b");
  assert.equal(readRememberedViewer(() => store), "test-rep-b");
  assert.equal(readRememberedViewer(() => memoryStore({ [VIEWER_KEY]: "" })), null);
});

test("viewer: storage that throws is read as nothing remembered, and a failed write is not an error", () => {
  // Chrome throws from the `sessionStorage` property itself when site data is blocked.
  const blocked = (): never => {
    throw new DOMException("Access is denied for this document.", "SecurityError");
  };
  // Other browsers throw from the calls: a private window, or a full store.
  const broken = {
    getItem: (): never => {
      throw new Error("storage read failed");
    },
    setItem: (): never => {
      throw new Error("storage is full");
    },
  };
  assert.equal(readRememberedViewer(blocked), null);
  assert.equal(readRememberedViewer(() => broken), null);
  assert.doesNotThrow(() => writeRememberedViewer(blocked, "test-rep-b"));
  assert.doesNotThrow(() => writeRememberedViewer(() => broken, "test-rep-b"));
});
