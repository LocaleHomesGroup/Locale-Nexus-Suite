import type { LiveFile } from "@/data/live/types";
import type { Db } from "../db/types";

/** A Monday asset id from a URL segment, or null. */
export function parseAssetId(raw: string): number | null {
  return /^[1-9]\d{0,14}$/.test(raw) ? Number(raw) : null;
}

/** The files on a job (or lot) and its milestones: the item's own first, then by milestone. */
export async function loadItemFiles(db: Db, itemId: number): Promise<LiveFile[]> {
  return db.query<LiveFile>(
    `select f.asset_id as "assetId", f.name, f.file_size::float8 as size,
            f.storage_path is not null as ready, f.copy_error as "copyError", s.name as milestone
     from launchpad.monday_job_files f
     left join mirror.monday_items s on s.id = f.subitem_id
     where f.item_id = $1
     order by s.name nulls first, f.name`,
    [itemId],
  );
}

/**
 * Where an asset's bytes are, or null when there's no such asset (one removed from Monday, or sitting
 * under a removed job, counts as none). `path` is null until it's copied, and `copyError` says why when
 * it never will be.
 */
export async function loadAssetPath(
  db: Db,
  rawAssetId: string,
): Promise<{ path: string | null; copyError: LiveFile["copyError"] } | null> {
  const assetId = parseAssetId(rawAssetId);
  if (assetId === null) return null;
  const [row] = await db.query<{ path: string | null; copyError: LiveFile["copyError"] }>(
    `select storage_path as path, copy_error as "copyError" from launchpad.monday_job_files where asset_id = $1`,
    [assetId],
  );
  return row ?? null;
}
