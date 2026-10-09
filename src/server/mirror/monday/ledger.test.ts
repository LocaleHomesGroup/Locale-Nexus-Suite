import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { migratedTestDb } from "../../db/pglite";
import type { Db } from "../../db/types";
import { MondayCapReachedError, MondayDailyLimitError, createMondayClient } from "./client";
import { dbLedger } from "./ledger";

let db: Db;
let close: () => Promise<void>;
before(async () => ({ db, close } = await migratedTestDb()));
after(async () => close());

const counted = async (source: string) =>
  (await db.query<{ calls: string }>("select calls::text from mirror.api_calls where source = $1", [source]))[0]?.calls;
const sleep = async () => {};

/** A fetch that answers every request with `body`, and remembers how many it was sent. */
function answering(body: unknown, status = 200) {
  const state = { sent: 0 };
  const fn = (async () => {
    state.sent += 1;
    return new Response(JSON.stringify(body), { status });
  }) as unknown as typeof fetch;
  return { fn, state };
}

test("dbLedger: claims up to the cap, then refuses without counting", async () => {
  const ledger = dbLedger(db, "test-cap", 2);
  assert.equal(await ledger.claim(), true);
  assert.equal(await ledger.claim(), true);
  assert.equal(await ledger.claim(), false);
  assert.equal(await counted("test-cap"), "2.0");
});

test("dbLedger: after dailyLimitHit, claims are refused for that source, and count nothing", async () => {
  const ledger = dbLedger(db, "test-limit", 100);
  assert.equal(await ledger.claim(), true);
  await ledger.dailyLimitHit();
  assert.equal(await ledger.claim(), false);
  assert.equal(await counted("test-limit"), "1.0");
  assert.equal(await dbLedger(db, "test-limit-other", 100).claim(), true, "another source is unaffected");
});

test("monday client over dbLedger: every request sent is one call in the ledger, and the cap stops the next", async () => {
  const f = answering({ data: { me: { id: "1" }, complexity: { query: 10, after: 9_000_000, reset_in_x_seconds: 30 } } });
  const monday = createMondayClient({ token: "t", ledger: dbLedger(db, "test-e2e-cap", 2), fetch: f.fn, sleep });
  await monday.query("query { me { id } }");
  await monday.query("query { me { id } }");
  await assert.rejects(monday.query("query { me { id } }"), MondayCapReachedError);
  assert.equal(f.state.sent, 2);
  assert.equal(monday.stats.calls, 2);
  assert.equal(await counted("test-e2e-cap"), "2.0");
});

test("monday client over dbLedger: Monday's daily limit turns the next run away before it sends anything", async () => {
  const f = answering({ errors: [{ message: "Daily limit exceeded", extensions: { code: "DAILY_LIMIT_EXCEEDED" } }] }, 429);
  const first = createMondayClient({ token: "t", ledger: dbLedger(db, "test-e2e-limit", 100), fetch: f.fn, sleep });
  await assert.rejects(first.query("query { me { id } }"), MondayDailyLimitError);
  assert.equal(f.state.sent, 1);

  // A later run is a new client on the same ledger: nothing goes out until 00:00 UTC.
  const next = createMondayClient({ token: "t", ledger: dbLedger(db, "test-e2e-limit", 100), fetch: f.fn, sleep });
  await assert.rejects(next.query("query { me { id } }"), MondayCapReachedError);
  assert.equal(f.state.sent, 1);
  assert.equal(await counted("test-e2e-limit"), "1.0");
});
