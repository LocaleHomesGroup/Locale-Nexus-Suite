import { test } from "node:test";
import assert from "node:assert/strict";
import { isCronAuthorized } from "./cron-auth";

test("cron auth: only the exact bearer secret passes", () => {
  const secret = "a-long-random-test-secret";
  assert.equal(isCronAuthorized(`Bearer ${secret}`, secret), true);
  assert.equal(isCronAuthorized(`Bearer ${secret}x`, secret), false);
  assert.equal(isCronAuthorized(secret, secret), false);
  assert.equal(isCronAuthorized(null, secret), false);
});

test("cron auth: with no secret configured, nothing passes", () => {
  assert.equal(isCronAuthorized("Bearer anything", null), false);
  assert.equal(isCronAuthorized("Bearer ", ""), false);
});
