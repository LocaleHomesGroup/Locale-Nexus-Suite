import type { Db } from "../db/types";

/**
 * What `npm run mirror -- status` and `reps` print, apart from console.log: the queries and the wording live here
 * so tests can run them on PGlite. A run still marked running after an hour has lost its end (endRun's update can
 * fail, though its lease is freed), so the list calls it stale rather than running.
 */
const STALE_RUN_MS = 60 * 60 * 1000;

export interface RunRow {
  started: Date;
  source: string;
  mode: string;
  status: string;
  api_calls: number;
  note: string | null;
  error: string | null;
}

export interface MirrorStatus {
  /** `keys`: what `--board` takes, the enabled parent boards' keys in key order (a subitems board comes with its parent). */
  boards: { parents: number; subitems: number; keys: string[] };
  items: { live: number; removed: number };
  files: { done: number; waiting: number; large: number };
  calls: { today: number; cap: number; limitHit: boolean };
  lots: { mapped: boolean; count: number };
  runs: RunRow[];
}

export async function readStatus(db: Db, cap: number): Promise<MirrorStatus> {
  const [boards] = await db.query<{ parents: number; subitems: number }>(
    `select count(*) filter (where parent_board_id is null)::int as parents,
            count(*) filter (where parent_board_id is not null)::int as subitems
     from mirror.monday_boards where sync_enabled`,
  );
  // A board with no key isn't set up yet, so nothing can name it.
  const keys = await db.query<{ board_key: string }>(
    "select board_key from mirror.monday_boards where sync_enabled and parent_board_id is null and board_key is not null order by board_key",
  );
  const [items] = await db.query<{ live: number; removed: number }>(
    `select count(*) filter (where removed_at is null)::int as live, count(*) filter (where removed_at is not null)::int as removed
     from mirror.monday_items`,
  );
  const [files] = await db.query<{ done: number; waiting: number; large: number }>(
    `select count(*) filter (where storage_path is not null)::int as done,
            count(*) filter (where storage_path is null and download_error is null and removed_at is null)::int as waiting,
            count(*) filter (where download_error = 'too_large')::int as large
     from mirror.monday_assets`,
  );
  // Whole tenths at most (a rate-limited retry costs 0.1), so a float is exact and prints as 12 or 12.5.
  const [calls] = await db.query<{ n: number; limit_hit: boolean }>(
    `select coalesce(sum(calls), 0)::float8 as n, bool_or(limit_hit_at is not null) is true as limit_hit
     from mirror.api_calls where source = 'monday' and day = (now() at time zone 'utc')::date`,
  );
  // The lot sync does nothing until the Exclusive Land board's status column is mapped (setup does it).
  const [lots] = await db.query<{ mapped: boolean; count: number }>(
    `select exists (select 1 from mirror.monday_field_map m join mirror.monday_boards b on b.id = m.board_id
                    where b.purpose = 'exclusive_land' and m.field_key = 'lot_status') as mapped,
            (select count(*)::int from launchpad.land_lots where source = 'monday') as count`,
  );
  const runs = await db.query<RunRow>(
    "select started_at as started, source, mode, status, api_calls, note, error from mirror.sync_runs order by id desc limit 10",
  );
  return {
    boards: { ...boards, keys: keys.map((k) => k.board_key) },
    items,
    files,
    calls: { today: calls.n, cap, limitHit: calls.limit_hit },
    lots,
    runs,
  };
}

const runState = (r: RunRow, now: Date): string =>
  r.status === "running" && now.getTime() - new Date(r.started).getTime() > STALE_RUN_MS ? "stale (no end recorded)" : r.status;

/** What a run says about itself. A run can carry both: a pass that finished but whose lot sync failed is partial, with a note and an error. */
const runDetail = (r: RunRow): string => [r.note, r.error].filter(Boolean).join("; ");

/** The lines `status` prints. `now` is when it is read, for telling a running run from a stale one. */
export function statusLines(s: MirrorStatus, now: Date): string[] {
  const keys = s.boards.keys.length > 0 ? `: ${s.boards.keys.join(", ")}` : "";
  const lines = [
    `boards enabled: ${s.boards.parents} (+ ${s.boards.subitems} subitems boards)${keys}`,
    `items: ${s.items.live} live, ${s.items.removed} removed`,
    `files: ${s.files.done} copied, ${s.files.waiting} waiting, ${s.files.large} over the size limit`,
    `Exclusive Land: ${s.lots.count} lot(s) from Monday; ${s.lots.mapped ? "status column mapped" : "status column NOT mapped yet, so lots don't sync (run setup)"}`,
    `Monday calls today (UTC): ${s.calls.today} of the ${s.calls.cap} cap${s.calls.limitHit ? "; Monday's daily limit was hit, so calls wait for 00:00 UTC" : ""}`,
  ];
  for (const r of s.runs) {
    lines.push(`  ${new Date(r.started).toISOString()}  ${r.source}/${r.mode}  ${runState(r, now)}  ${r.api_calls} call(s)  ${runDetail(r)}`.trimEnd());
  }
  return lines;
}

/** The lines `reps` prints. A name listed as unmatched either matches no staff member or could be more than one. */
export function repsLines(r: { matched: number; unmatched: string[] }): string[] {
  const lines = [`matched ${r.matched} rep name(s)`];
  if (r.unmatched.length > 0) {
    lines.push(`no single staff match, add an alias to launchpad.staff_aliases by hand: ${r.unmatched.join("; ")}`);
  }
  return lines;
}
