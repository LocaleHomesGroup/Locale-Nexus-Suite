import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { migratedTestDb } from "./pglite";
import type { Db } from "./types";

/** Locale has no Hubstaff (Kane, 2026-10-09): migration 20261009000200 drops what the earlier migrations made for it. */
let db: Db;
let close: () => Promise<void>;
before(async () => ({ db, close } = await migratedTestDb()));
after(async () => close());

test("drop hubstaff: its two tables, the token-chain table and the hours view are gone", async () => {
  for (const name of [
    "mirror.hubstaff_daily_activities",
    "mirror.hubstaff_members",
    "mirror.integration_secrets",
    "launchpad.staff_hours_daily",
  ]) {
    const [row] = await db.query<{ found: string | null }>("select to_regclass($1)::text as found", [name]);
    assert.equal(row.found, null, name);
  }
});

test("drop hubstaff: launchpad.staff has no hubstaff_user_id column", async () => {
  const columns = await db.query<{ name: string }>(
    `select attname as name from pg_attribute
      where attrelid = 'launchpad.staff'::regclass and attnum > 0 and not attisdropped`,
  );
  assert.ok(columns.some((c) => c.name === "work_email"), "the table itself is still there");
  assert.ok(!columns.some((c) => c.name === "hubstaff_user_id"));
});

test("drop hubstaff: a sync run's source is monday or hubspot, and no longer hubstaff", async () => {
  await assert.rejects(
    db.query("insert into mirror.sync_runs (source, mode, trigger) values ('hubstaff', 'daily', 'cli')"),
    /sync_runs_source_check/,
  );
  for (const source of ["monday", "hubspot"]) {
    const [run] = await db.query<{ source: string }>(
      "insert into mirror.sync_runs (source, mode, trigger) values ($1, 'changes', 'cli') returning source",
      [source],
    );
    assert.equal(run.source, source);
  }
  const checks = await db.query<{ name: string }>(
    "select conname as name from pg_constraint where conrelid = 'mirror.sync_runs'::regclass and contype = 'c' order by conname",
  );
  assert.deepEqual(checks.map((c) => c.name), ["sync_runs_source_check", "sync_runs_status_check", "sync_runs_trigger_check"], "the check keeps its name");
});

test("drop hubstaff: the mirror schema's comment names Monday and HubSpot only", async () => {
  const [row] = await db.query<{ comment: string | null }>("select obj_description('mirror'::regnamespace, 'pg_namespace') as comment");
  assert.equal(row.comment, "Read-only copies of Monday and HubSpot. Written only by the sync code.");
});
