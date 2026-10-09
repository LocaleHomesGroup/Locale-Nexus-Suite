import { test } from "node:test";
import assert from "node:assert/strict";
import { fileAnswer } from "./file-answer";

const PATH = "10/2001/9001/plan.pdf";

const STILL_COPYING = { kind: "error", status: 409, error: "This file hasn't been copied from Monday yet. Try again in a few minutes." };

test("file answer: no such asset is a 404", () => {
  assert.deepEqual(fileAnswer(null), { kind: "error", status: 404, error: "File not found" });
});

test("file answer: a file over the size limit is a 410 that says so and points to Monday", () => {
  assert.deepEqual(fileAnswer({ path: null, copyError: "too_large" }), {
    kind: "error",
    status: 410,
    error: "This file is too large to copy from Monday (over 50 MB). Open it in Monday.",
  });
});

test("file answer: a file that failed to copy is a 410 that says so and points to Monday", () => {
  assert.deepEqual(fileAnswer({ path: null, copyError: "failed" }), {
    kind: "error",
    status: 410,
    error: "This file couldn't be copied from Monday. Open it in Monday.",
  });
});

test("file answer: a file still being copied is a 409 that says to try again", () => {
  assert.deepEqual(fileAnswer({ path: null, copyError: null }), STILL_COPYING);
});

test("file answer: an empty path counts as not copied yet, as the route has always treated it", () => {
  assert.deepEqual(fileAnswer({ path: "", copyError: null }), STILL_COPYING);
});

test("file answer: a copied file redirects to its path", () => {
  assert.deepEqual(fileAnswer({ path: PATH, copyError: null }), { kind: "redirect", path: PATH });
});

test("file answer: a path with a copy error can't come from the view, but the copy error wins and the path stays out of the answer", () => {
  for (const copyError of ["too_large", "failed"] as const) {
    const answer = fileAnswer({ path: PATH, copyError });
    assert.ok(answer.kind === "error", `${copyError} wins over a path`);
    assert.equal(answer.status, 410, copyError);
    assert.ok(!JSON.stringify(answer).includes(PATH), "the answer never carries the storage path");
  }
});
