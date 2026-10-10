import { test } from "node:test";
import assert from "node:assert/strict";
import { writesHeld, type LiveKind } from "./read-only-guard";

test("with no database the sample writes run: that is the prototype", () => {
  assert.equal(writesHeld("off"), false);
});

test("with live data showing the writes are held", () => {
  assert.equal(writesHeld("live"), true);
});

test("with a database configured but unreadable the writes are held too, so a sample sync can't claim a write", () => {
  assert.equal(writesHeld("error"), true);
});

test("the writes are held in every state except no database", () => {
  const kinds: LiveKind[] = ["off", "error", "live"];
  assert.deepEqual(
    kinds.filter((k) => writesHeld(k)),
    ["error", "live"],
  );
});
