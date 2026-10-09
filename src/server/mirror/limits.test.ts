import { test } from "node:test";
import assert from "node:assert/strict";
import { RunDeadlineError, attemptTimeoutMs, checkDeadline, checkWait, checkedToken, clientLimits, failureReason } from "./limits";

const at = (ms: number) => () => ms;

test("limits: the deadline, a wait and an attempt's timeout, at their boundaries", () => {
  const deadline = new Date(10_000);
  assert.throws(() => checkDeadline(deadline, at(10_000)), RunDeadlineError, "at the deadline");
  assert.doesNotThrow(() => checkDeadline(deadline, at(9_999)), "1 ms before it");
  assert.throws(() => checkWait(1_000, deadline, at(9_000), "the retry"), RunDeadlineError, "a wait ending exactly at it");
  assert.doesNotThrow(() => checkWait(999, deadline, at(9_000), "the retry"), "a wait ending 1 ms before it");
  assert.equal(attemptTimeoutMs(30_000, undefined, at(0)), 30_000, "no deadline");
  assert.equal(attemptTimeoutMs(30_000, new Date(60_000), at(0)), 30_000, "60 s left: capped at 30 s");
  assert.equal(attemptTimeoutMs(30_000, new Date(5_000), at(0)), 5_000, "5 s left");
  assert.equal(attemptTimeoutMs(30_000, new Date(200), at(0)), 1_000, "200 ms left: the 1 s floor");
  assert.equal(attemptTimeoutMs(500, new Date(200), at(0)), 500, "a timeoutMs of 500 stays under the floor");
});

test("limits: clientLimits takes a whole number of milliseconds from 1 to 2^31 - 1, and nothing else", () => {
  for (const bad of [0, -1, 1.5, 2 ** 31, Number.NaN, "30000"]) {
    assert.throws(() => clientLimits({ timeoutMs: bad as number }), RangeError, `timeoutMs ${String(bad)}`);
  }
  for (const fine of [1, 2 ** 31 - 1]) assert.equal(clientLimits({ timeoutMs: fine }).timeoutMs, fine);
  assert.equal(clientLimits({}).timeoutMs, 30_000);
});

test("limits: failureReason repeats only fetch's own failures, never another error's message", () => {
  const reset = Object.assign(new TypeError("fetch failed"), { cause: Object.assign(new Error("read ECONNRESET"), { code: "ECONNRESET" }) });
  const cutOff = Object.assign(new TypeError("terminated"), { cause: Object.assign(new Error("other side closed"), { code: "UND_ERR_SOCKET" }) });
  assert.equal(failureReason(reset), "fetch failed (ECONNRESET)");
  assert.equal(failureReason(cutOff), "terminated (UND_ERR_SOCKET)");
  assert.equal(failureReason(new DOMException("The operation was aborted due to timeout", "TimeoutError")), "The operation was aborted due to timeout (TimeoutError)");
  assert.equal(failureReason(new DOMException("This operation was aborted", "AbortError")), "This operation was aborted (AbortError)");

  // What fetch throws for a header value with a line break: its message quotes the whole value, token and all.
  let invalidHeader: unknown;
  try {
    new Headers({ Authorization: "Bearer test-token-abc\ndef" });
  } catch (e) {
    invalidHeader = e;
  }
  assert.match(String((invalidHeader as Error).message), /test-token-abc/, "the fixture really does quote it");
  assert.equal(failureReason(invalidHeader), "TypeError");
  assert.equal(failureReason(Object.assign(new Error("test-token-abc"), { code: "ERR_TEST" })), "Error (ERR_TEST)");
  assert.equal(failureReason("test-token-abc"), "Error", "a thrown string");
  assert.equal(failureReason(null), "Error");
});

test("limits: checkedToken trims a token, says when it is empty, and refuses a bad character without quoting it", () => {
  assert.equal(checkedToken("  test-token-abc\n", "TEST_TOKEN"), "test-token-abc");
  for (const empty of ["", "   ", "\n\t"]) {
    assert.throws(
      () => checkedToken(empty, "TEST_TOKEN"),
      (e: unknown) => e instanceof TypeError && e.message === "TEST_TOKEN is empty",
      JSON.stringify(empty),
    );
  }
  for (const bad of ["test-token-abc\ndef", "test-token-abc def", "test-token-abc\u0000def"]) {
    assert.throws(
      () => checkedToken(bad, "TEST_TOKEN"),
      (e: unknown) =>
        e instanceof TypeError &&
        e.message === "TEST_TOKEN has a character a token can't have, such as a line break or a space. Copy it again.",
      JSON.stringify(bad),
    );
  }
});
