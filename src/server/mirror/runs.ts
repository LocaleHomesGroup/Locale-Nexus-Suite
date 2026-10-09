import { randomUUID } from "node:crypto";
import type { Db } from "../db/types";

export type MirrorSource = "monday" | "hubspot";
export type Trigger = "cron" | "cli" | "manual";

export interface RunHandle {
  id: number;
  lockKey: string;
  owner: string;
}

export interface RunOutcome {
  status: "ok" | "partial" | "failed" | "skipped";
  calls: number;
  complexity: number;
  seen: number;
  changed: number;
  note: string | null;
  error: string | null;
  watermarkBefore: Date | null;
  watermarkAfter: Date | null;
}

/**
 * Opens a run under the lease for `lockKey` (default: the source). Returns null,
 * after recording a skipped run, when another pass holds the lease.
 */
export async function beginRun(
  db: Db,
  source: MirrorSource,
  mode: string,
  trigger: Trigger,
  lockSeconds: number,
  lockKey: string = source,
): Promise<RunHandle | null> {
  const owner = `${mode}:${randomUUID()}`;
  const [lock] = await db.query<{ ok: boolean }>("select mirror.try_lock($1, $2, $3) as ok", [lockKey, owner, lockSeconds]);
  if (!lock?.ok) {
    await db.query(
      `insert into mirror.sync_runs (source, mode, trigger, finished_at, status, note)
       values ($1, $2, $3, now(), 'skipped', 'another pass was running')`,
      [source, mode, trigger],
    );
    return null;
  }
  try {
    const [run] = await db.query<{ id: number }>(
      "insert into mirror.sync_runs (source, mode, trigger) values ($1, $2, $3) returning id",
      [source, mode, trigger],
    );
    return { id: run.id, lockKey, owner };
  } catch (e) {
    // The lease is taken but the run can't start: give it back, or no pass could start until it expires. A failure
    // to unlock is ignored, so that the error that matters is the one rethrown.
    await db.query("select mirror.unlock($1, $2)", [lockKey, owner]).catch(() => {});
    throw e;
  }
}

/** A watermark as the jsonb parameter: a JSON string, or SQL NULL when there is none (JSON.stringify(null) would store a JSON null). */
const asJson = (at: Date | null) => (at ? JSON.stringify(at.toISOString()) : null);

export async function endRun(db: Db, run: RunHandle, outcome: RunOutcome): Promise<void> {
  try {
    await db.query(
      `update mirror.sync_runs set
         finished_at = now(), status = $2, api_calls = $3, complexity = $4, records_seen = $5,
         records_changed = $6, note = $7, error = left($8, 2000),
         watermark_before = $9::jsonb, watermark_after = $10::jsonb
       where id = $1`,
      [
        run.id,
        outcome.status,
        Math.round(outcome.calls),
        Math.round(outcome.complexity),
        outcome.seen,
        outcome.changed,
        outcome.note,
        outcome.error,
        asJson(outcome.watermarkBefore),
        asJson(outcome.watermarkAfter),
      ],
    );
  } finally {
    // Whether or not the update worked: a run that can't be recorded must not keep the lease until it expires.
    await db.query("select mirror.unlock($1, $2)", [run.lockKey, run.owner]);
  }
}

export async function getWatermark(db: Db, source: MirrorSource, scope: string): Promise<Date | null> {
  const [row] = await db.query<{ watermark: Date | null }>(
    "select watermark from mirror.sync_state where source = $1 and scope = $2",
    [source, scope],
  );
  return row?.watermark ?? null;
}

export async function setWatermark(db: Db, source: MirrorSource, scope: string, at: Date): Promise<void> {
  await db.query(
    `insert into mirror.sync_state (source, scope, watermark) values ($1, $2, $3::timestamptz)
     on conflict (source, scope) do update set watermark = excluded.watermark`,
    [source, scope, at.toISOString()],
  );
}

export async function markState(
  db: Db,
  source: MirrorSource,
  scope: string,
  field: "backfilled_at" | "swept_at",
): Promise<void> {
  await db.query(
    `insert into mirror.sync_state (source, scope, ${field}) values ($1, $2, now())
     on conflict (source, scope) do update set ${field} = now()`,
    [source, scope],
  );
}
