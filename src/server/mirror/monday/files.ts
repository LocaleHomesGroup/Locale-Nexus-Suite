import { createHash } from "node:crypto";
import type { Db } from "../../db/types";
import { BUCKETS, type FileStore } from "../../storage";
import type { MondayClient } from "./client";
import { Q } from "./queries";

/**
 * Copies Monday's files into the monday-files bucket. Monday's public URLs last
 * an hour, so each batch asks for fresh ones (one call per 50 files) and
 * downloads straight away. Files are kept by asset id, which never changes.
 */
export const MAX_FILE_BYTES = 50 * 1024 * 1024;
const ASSET_IDS_PER_CALL = 50;
const MAX_ATTEMPTS = 3;
const DOWNLOAD_TIMEOUT_MS = 60_000;
/** Uploads Storage may refuse in a row before the run stops: past this it looks like Storage, not the files. */
const MAX_REFUSALS_IN_A_ROW = 3;

export interface FilesResult {
  downloaded: number;
  tooLarge: number;
  failed: number;
  /** Still to try after this run. */
  pending: number;
}

interface RawAsset {
  id: string;
  name?: string | null;
  file_extension?: string | null;
  file_size?: number | null;
  public_url?: string | null;
  created_at?: string | null;
}

const TYPES: Record<string, string> = {
  pdf: "application/pdf",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
  heic: "image/heic",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  csv: "text/csv",
  txt: "text/plain",
  zip: "application/zip",
  mp4: "video/mp4",
  mov: "video/quicktime",
};

const extensionOf = (ext: string | null | undefined, name: string) =>
  (ext ?? name.split(".").pop() ?? "").replace(/^\./, "").toLowerCase();

const safeName = (name: string) => {
  const s = name
    .normalize("NFKD")
    .replace(/[^\w.\-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/_+\./g, ".")
    .slice(-120);
  // Empty, or only dots ("." or ".."), which would read as a path step.
  return /^\.*$/.test(s) ? "file" : s;
};

export function storagePath(boardId: number, itemId: number, assetId: number, name: string): string {
  return `${boardId}/${itemId}/${assetId}/${safeName(name)}`;
}

/**
 * The files still to fetch, shared by the queue and the closing count so `pending` is only what a run could
 * take. The first three conditions are the monday_assets_pending index's. A file on an item we don't have yet
 * has no board for its path, so it waits outside the queue until the item arrives.
 */
const QUEUE = `from mirror.monday_assets a
     join mirror.monday_items i on i.id = a.item_id
     where a.storage_path is null and a.removed_at is null and a.download_error is null and a.download_attempts < $1`;

/**
 * A download's bytes, read as they arrive and given up as soon as they pass MAX_FILE_BYTES (null then; the rest
 * is never read). The chunks are joined once all are in, so memory peaks at about twice the limit: the chunk list
 * plus the joined copy.
 */
async function readCapped(res: Response): Promise<Uint8Array | null> {
  if (!res.body) return new Uint8Array(0);
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_FILE_BYTES) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  const body = new Uint8Array(total);
  let at = 0;
  for (const chunk of chunks) {
    body.set(chunk, at);
    at += chunk.byteLength;
  }
  return body;
}

export async function downloadPendingFiles(
  deps: { db: Db; monday: MondayClient; store: FileStore; fetch?: typeof fetch },
  opts: { max: number; deadline?: Date },
): Promise<FilesResult> {
  const fetchFile = deps.fetch ?? fetch;
  // A cron route's run ends before its host stops it: nothing new starts after the deadline.
  const pastDeadline = () => opts.deadline !== undefined && Date.now() >= opts.deadline.getTime();
  const result: FilesResult = { downloaded: 0, tooLarge: 0, failed: 0, pending: 0 };
  // Newest first. monday_created_at is only known once a file is downloaded, so in practice this is by asset id,
  // which Monday hands out in increasing order. The index holds only the backlog, so the sort stays small.
  const pending = await deps.db.query<{ id: number; item_id: number; board_id: number; name: string }>(
    `select a.id, a.item_id, i.board_id, a.name
     ${QUEUE}
     order by a.monday_created_at desc nulls last, a.id desc
     limit $2`,
    [MAX_ATTEMPTS, opts.max],
  );
  // Before any file is charged an attempt: Storage that can't take files (a bad key, no permission, unreachable)
  // fails the run here, where a failed upload would count against each file in turn and retire them all.
  if (pending.length > 0) await deps.store.ensureBucket(BUCKETS.mondayFiles, MAX_FILE_BYTES);

  /** `size` is what Monday or the download declared; null when the download just ran past the limit. */
  const recordTooLarge = async (id: number, size: number | null, ext: string) => {
    await deps.db.query(
      "update mirror.monday_assets set download_error = 'too_large', file_size = $2, file_extension = $3 where id = $1",
      [id, size, ext],
    );
    result.tooLarge += 1;
  };

  const recordFailure = async (id: number, message: string) => {
    await deps.db.query(
      `update mirror.monday_assets
          set download_attempts = download_attempts + 1,
              download_error = case when download_attempts + 1 >= $2 then left($3, 300) end
        where id = $1`,
      [id, MAX_ATTEMPTS, message],
    );
    result.failed += 1;
  };

  // Storage that starts refusing after the bucket check (a full quota, a partial outage) would charge every file
  // in the run. Each refusal is charged, since the first can't be told from one bad file, but the run stops at the
  // third in a row. Any stored file starts the count again.
  let refusedInARow = 0;

  chunks: for (let i = 0; i < pending.length; i += ASSET_IDS_PER_CALL) {
    if (pastDeadline()) break;
    const chunk = pending.slice(i, i + ASSET_IDS_PER_CALL);
    const data = await deps.monday.query<{ assets: RawAsset[] | null }>(Q.assets, { ids: chunk.map((a) => String(a.id)) });
    const byId = new Map((data.assets ?? []).map((a) => [Number(a.id), a]));

    for (const row of chunk) {
      if (pastDeadline()) break chunks;
      const info = byId.get(row.id);
      if (!info?.public_url) {
        await recordFailure(row.id, "Monday didn't return this file");
        continue;
      }
      const name = info.name || row.name;
      const ext = extensionOf(info.file_extension, name);
      if ((info.file_size ?? 0) > MAX_FILE_BYTES) {
        await recordTooLarge(row.id, info.file_size ?? null, ext);
        continue;
      }
      let uploading = false;
      try {
        // A stalled download mustn't hold the run: 60 s is plenty for a file under the 50 MiB limit.
        const res = await fetchFile(info.public_url, { signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS) });
        if (!res.ok) {
          await res.body?.cancel();
          throw new Error(`download failed: HTTP ${res.status}`);
        }
        // Monday's size can be missing or stale, so the download's own is checked too: first the length it
        // declares, then the bytes as they arrive.
        const declared = Number(res.headers.get("content-length") ?? 0);
        if (declared > MAX_FILE_BYTES) {
          await res.body?.cancel();
          await recordTooLarge(row.id, declared, ext);
          continue;
        }
        const body = await readCapped(res);
        if (body === null) {
          // Its real size is unknown, only that it passed the limit, so file_size stays null.
          await recordTooLarge(row.id, null, ext);
          continue;
        }
        const path = storagePath(row.board_id, row.item_id, row.id, name);
        // Own keys only: an extension like "constructor" mustn't find something on Object.prototype.
        const contentType = Object.hasOwn(TYPES, ext) ? TYPES[ext] : "application/octet-stream";
        uploading = true;
        await deps.store.upload(BUCKETS.mondayFiles, path, body, contentType);
        uploading = false;
        refusedInARow = 0;
        await deps.db.query(
          `update mirror.monday_assets
              set storage_path = $2, sha256 = $3, file_size = $4, file_extension = $5,
                  monday_created_at = coalesce(monday_created_at, $6::timestamptz),
                  downloaded_at = now(), download_error = null
            where id = $1`,
          [row.id, path, createHash("sha256").update(body).digest("hex"), body.byteLength, ext, info.created_at ?? null],
        );
        result.downloaded += 1;
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        await recordFailure(row.id, message);
        if (uploading && ++refusedInARow >= MAX_REFUSALS_IN_A_ROW) {
          throw new Error(`Storage refused ${MAX_REFUSALS_IN_A_ROW} uploads in a row, so this run stopped: ${message}`);
        }
      }
    }
  }

  const [left] = await deps.db.query<{ n: number }>(`select count(*)::int as n ${QUEUE}`, [MAX_ATTEMPTS]);
  result.pending = left?.n ?? 0;
  return result;
}
