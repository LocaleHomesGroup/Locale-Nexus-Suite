import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { migratedTestDb } from "../db/pglite";
import type { Db } from "../db/types";
import { beginRun, endRun, getWatermark, markState, renewRun, setWatermark, type RunOutcome } from "./runs";

let db: Db;
let close: () => Promise<void>;
before(async () => ({ db, close } = await migratedTestDb()));
after(async () => close());

const outcome = (over: Partial<RunOutcome> = {}): RunOutcome => ({
  status: "ok",
  calls: 3,
  complexity: 1200,
  seen: 10,
  changed: 4,
  note: null,
  error: null,
  watermarkBefore: null,
  watermarkAfter: null,
  ...over,
});

interface RunRow {
  id: number;
  mode: string;
  trigger: string;
  status: string;
  finished: boolean;
  api_calls: number;
  complexity: number;
  records_seen: number;
  records_changed: number;
  note: string | null;
  error: string | null;
  watermark_before: unknown;
  watermark_after: unknown;
}
const runsOf = (source: string) =>
  db.query<RunRow>(
    `select id, mode, trigger, status, finished_at is not null as finished, api_calls, complexity, records_seen,
            records_changed, note, error, watermark_before, watermark_after
       from mirror.sync_runs where source = $1 order by id`,
    [source],
  );
const leases = () => db.query<{ source: string }>("select source from mirror.sync_locks order by source");

test("runs: one pass per source at a time; a second is turned away and logged as skipped", async () => {
  const first = await beginRun(db, "hubspot", "changes", "cron", 60);
  assert.ok(first);
  assert.equal(first.lockKey, "hubspot", "the lease is the source's own by default");
  assert.equal(await beginRun(db, "hubspot", "safety", "cli", 60), null);

  const log = await runsOf("hubspot");
  assert.deepEqual(
    log.map((r) => [r.mode, r.trigger, r.status, r.finished]),
    [
      ["changes", "cron", "running", false],
      ["safety", "cli", "skipped", true],
    ],
  );
  assert.match(log[1].note ?? "", /another pass/);

  const other = await beginRun(db, "monday", "changes", "cron", 60);
  assert.ok(other, "another source has a lease of its own");
  await endRun(db, other, outcome());

  await endRun(db, first, outcome());
  const next = await beginRun(db, "hubspot", "changes", "cron", 60);
  assert.ok(next, "ending a run frees the lease");
  await endRun(db, next, outcome());
  assert.deepEqual(await leases(), []);
});

test("runs: a lease key of its own lets a pass run beside the source's, but not beside itself", async () => {
  const main = await beginRun(db, "monday", "changes", "cron", 60);
  const files = await beginRun(db, "monday", "files", "cron", 60, "monday:files");
  assert.ok(main && files);
  assert.equal(files.lockKey, "monday:files");
  assert.deepEqual((await leases()).map((l) => l.source), ["monday", "monday:files"]);
  assert.equal(await beginRun(db, "monday", "files", "cli", 60, "monday:files"), null);

  await endRun(db, files, outcome());
  assert.deepEqual((await leases()).map((l) => l.source), ["monday"], "ending one pass frees only its own lease");
  await endRun(db, main, outcome());
  assert.deepEqual(await leases(), []);
});

test("runs: the outcome is stored, counts rounded, the error cut to 2000 characters, watermarks as ISO text", async () => {
  const run = await beginRun(db, "hubspot", "backfill", "manual", 60);
  assert.ok(run);
  await endRun(
    db,
    run,
    outcome({
      status: "partial",
      calls: 2.6,
      complexity: 1200.4,
      seen: 7,
      changed: 5,
      note: "stopped at the time limit",
      error: "x".repeat(2500),
      watermarkBefore: new Date("2026-10-07T00:00:00Z"),
      watermarkAfter: new Date("2026-10-08T01:02:03.004Z"),
    }),
  );
  const row = (await runsOf("hubspot")).find((r) => r.id === run.id);
  assert.ok(row);
  assert.deepEqual(
    [row.status, row.finished, row.api_calls, row.complexity, row.records_seen, row.records_changed, row.note],
    ["partial", true, 3, 1200, 7, 5, "stopped at the time limit"],
  );
  assert.equal(row.error?.length, 2000);
  assert.equal(row.watermark_before, "2026-10-07T00:00:00.000Z");
  assert.equal(row.watermark_after, "2026-10-08T01:02:03.004Z");
});

test("runs: a pass with no watermark and no error ends with neither, and an absent watermark is SQL NULL", async () => {
  const run = await beginRun(db, "hubspot", "safety", "cron", 60);
  assert.ok(run);
  await endRun(db, run, outcome());
  const row = (await runsOf("hubspot")).find((r) => r.id === run.id);
  assert.ok(row);
  assert.equal(row.status, "ok");
  assert.equal(row.error, null);

  // Asked of SQL, not of the driver: a JSON null also reads back as null in JS, but `is null` is false for it.
  const nulls = async (id: number) =>
    (
      await db.query<{ before_null: boolean; after_null: boolean }>(
        "select watermark_before is null as before_null, watermark_after is null as after_null from mirror.sync_runs where id = $1",
        [id],
      )
    )[0];
  assert.deepEqual(await nulls(run.id), { before_null: true, after_null: true });

  // Only the watermark that was given is set.
  const second = await beginRun(db, "hubspot", "changes", "cron", 60);
  assert.ok(second);
  await endRun(db, second, outcome({ watermarkAfter: new Date("2026-10-08T00:00:00Z") }));
  assert.deepEqual(await nulls(second.id), { before_null: true, after_null: false });
});

test("runs: watermarks are kept per source and scope, and milestones leave them alone", async () => {
  assert.equal(await getWatermark(db, "monday", "account"), null);
  await setWatermark(db, "monday", "account", new Date("2026-10-07T00:00:00Z"));
  assert.equal((await getWatermark(db, "monday", "account"))?.toISOString(), "2026-10-07T00:00:00.000Z");
  await setWatermark(db, "monday", "account", new Date("2026-10-08T00:00:00Z"));
  assert.equal((await getWatermark(db, "monday", "account"))?.toISOString(), "2026-10-08T00:00:00.000Z");
  assert.equal(await getWatermark(db, "hubspot", "account"), null, "another source");
  assert.equal(await getWatermark(db, "monday", "board:10"), null, "another scope");

  await markState(db, "monday", "account", "backfilled_at");
  await markState(db, "monday", "board:10", "swept_at");
  await setWatermark(db, "monday", "board:10", new Date("2026-10-09T00:00:00Z"));
  const state = await db.query<{ scope: string; watermark: boolean; backfilled: boolean; swept: boolean }>(
    `select scope, watermark is not null as watermark, backfilled_at is not null as backfilled, swept_at is not null as swept
       from mirror.sync_state where source = 'monday' order by scope`,
  );
  assert.deepEqual(state, [
    { scope: "account", watermark: true, backfilled: true, swept: false },
    { scope: "board:10", watermark: true, backfilled: false, swept: true },
  ]);
  assert.equal((await getWatermark(db, "monday", "account"))?.toISOString(), "2026-10-08T00:00:00.000Z", "a milestone doesn't move the watermark");
});

test("runs: when a sweep started a board is a milestone of its own, beside when it finished one", async () => {
  await markState(db, "monday", "board:20", "sweep_attempted_at");
  const [row] = await db.query<{ attempted: boolean; swept: boolean; watermark: boolean }>(
    `select sweep_attempted_at is not null as attempted, swept_at is not null as swept, watermark is not null as watermark
       from mirror.sync_state where source = 'monday' and scope = 'board:20'`,
  );
  assert.deepEqual(row, { attempted: true, swept: false, watermark: false });
});

test("runs: renewing a run extends its lease, even one that lapsed, and fails once another owner holds it", async () => {
  const run = await beginRun(db, "hubspot", "changes", "cron", 60);
  assert.ok(run);
  /** Seconds from now until the lease ends. */
  const left = async () =>
    (await db.query<{ s: number }>(
      "select extract(epoch from locked_until - clock_timestamp())::float8 as s from mirror.sync_locks where source = 'hubspot'",
    ))[0]?.s;
  try {
    assert.ok((await left()) <= 60);
    assert.equal(await renewRun(db, run, 3600), true);
    assert.ok((await left()) > 3500, "extended to an hour from now");

    // It lapses, and nobody has taken it: the run's own renewal takes it back.
    await db.query("update mirror.sync_locks set locked_until = clock_timestamp() - interval '1 second' where source = 'hubspot'");
    assert.equal(await renewRun(db, run, 60), true);
    assert.ok((await left()) > 50);

    // It lapses again, and another pass takes it: the renewal fails, and the other pass keeps it.
    await db.query("update mirror.sync_locks set locked_until = clock_timestamp() - interval '1 second' where source = 'hubspot'");
    const other = await beginRun(db, "hubspot", "changes", "cron", 60);
    assert.ok(other, "the other pass took the lapsed lease");
    assert.equal(await renewRun(db, run, 60), false);
    assert.deepEqual(await db.query("select owner from mirror.sync_locks where source = 'hubspot'"), [{ owner: other.owner }]);

    // The other pass finishes and lets the lease go. The first run's renewal still fails: its lease was taken in between,
    // and whatever it has in hand may be older than what the other pass wrote. (try_lock would take the lease back.)
    await endRun(db, other, outcome());
    assert.equal(await renewRun(db, run, 60), false);
    assert.deepEqual(await leases(), [], "and the renewal took nothing");
    await endRun(db, run, outcome()); // its unlock frees nothing: the lease is gone already
  } finally {
    await db.query("delete from mirror.sync_locks where source = 'hubspot'"); // a stranded lease would turn the later tests into skips
  }
});

test("runs: a run that can't be recorded as finished still frees its lease (a check violation)", async () => {
  const run = await beginRun(db, "hubspot", "changes", "cron", 60);
  assert.ok(run);
  // A status the table's check refuses, so the update fails.
  await assert.rejects(endRun(db, run, outcome({ status: "bogus" as never })), /check constraint/);
  assert.deepEqual(await leases(), [], "the lease is gone, not left to run out");

  const next = await beginRun(db, "hubspot", "changes", "cron", 60);
  assert.ok(next, "so the next pass can start at once");
  await endRun(db, next, outcome());
});

test("runs: a run that can't be recorded as finished still frees its lease (a NUL in the error)", async () => {
  const run = await beginRun(db, "monday", "safety", "cron", 60);
  assert.ok(run);
  // Postgres refuses a NUL in text, so the update fails and the original error comes through.
  await assert.rejects(endRun(db, run, outcome({ status: "failed", error: `broke${String.fromCharCode(0)}here` })), /invalid byte sequence/);
  assert.deepEqual(await leases(), []);

  const next = await beginRun(db, "monday", "safety", "cron", 60);
  assert.ok(next);
  await endRun(db, next, outcome());
});

test("runs: a run that can't be recorded as started gives back the lease it took, and the error comes through", async () => {
  // A trigger the table's check refuses, so the insert fails after the lease was taken.
  await assert.rejects(beginRun(db, "hubspot", "changes", "bogus" as never, 60), /check constraint/);
  assert.deepEqual(await leases(), [], "nothing is left holding the lease");

  const next = await beginRun(db, "hubspot", "changes", "cron", 60);
  assert.ok(next, "so the next pass can start at once");
  await endRun(db, next, outcome());
});
