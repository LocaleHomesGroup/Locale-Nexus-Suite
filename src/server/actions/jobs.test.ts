import { test } from "node:test";
import assert from "node:assert/strict";
import { jobMilestones } from "./jobs";

const EMPTY = { precon: [], milestones: [] };

/** Runs `fn` with SUPABASE_DB_URL set to `url` (or removed), then puts the real value back. */
async function withDbUrl<T>(url: string | undefined, fn: () => Promise<T>): Promise<T> {
  const saved = process.env.SUPABASE_DB_URL;
  if (url === undefined) delete process.env.SUPABASE_DB_URL;
  else process.env.SUPABASE_DB_URL = url;
  try {
    return await fn();
  } finally {
    if (saved === undefined) delete process.env.SUPABASE_DB_URL;
    else process.env.SUPABASE_DB_URL = saved;
  }
}

// A malformed connection string makes getDb throw, so it tells a call that reached the database from one that didn't.
const MALFORMED_URL = "postgresql://u:pa#ss@db.invalid:6543/x";

test("jobMilestones: with no database there are no milestones", async () => {
  await withDbUrl(undefined, async () => {
    assert.deepEqual(await jobMilestones(1001), EMPTY);
  });
});

test("jobMilestones: an id that isn't a safe positive integer is turned away before the database is reached", async () => {
  await withDbUrl(MALFORMED_URL, async () => {
    const bad: unknown[] = [0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1, "1001", null, undefined, {}, [1001]];
    for (const id of bad) {
      assert.deepEqual(await jobMilestones(id as number), EMPTY, `id ${String(id)}`);
    }
  });
});

test("jobMilestones: a failure rejects, so the screen can say it couldn't load them", async () => {
  const original = console.error;
  console.error = () => {};
  try {
    await withDbUrl(MALFORMED_URL, async () => {
      await assert.rejects(jobMilestones(1001));
    });
  } finally {
    console.error = original;
  }
});
