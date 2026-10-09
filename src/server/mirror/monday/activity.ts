import { toId, type RawUpdate } from "./normalise";

/**
 * Monday's activity logs, read as hints: which items changed since the
 * watermark. Monday doesn't document the keys inside `data`; we read the item
 * ids we find (pulse_id, item_id and their plurals) and skip what we can't place.
 * The daily safety pass and the weekly sweep catch anything this misses.
 */
export interface RawActivityLog {
  id?: string;
  event: string;
  entity?: string | null;
  data?: string | null;
  created_at: string;
}

export interface BoardActivity {
  id: string;
  activity_logs: RawActivityLog[] | null;
  updates?: RawUpdate[] | null;
}

export interface ActivityScan {
  /** Every item (or subitem) id an entry names. Refetch them all. */
  itemIds: number[];
  /**
   * Ids named by a delete or archive entry about the item itself. Advisory: the changes pass marks an item removed
   * when a refetch no longer returns it, not because it is listed here.
   */
  removedHints: number[];
  /** Boards whose columns changed (an entry with no item id that mentions a column). */
  columnsChangedBoards: number[];
  latest: Date | null;
  /** Boards that returned a full page: there may be more entries. */
  fullBoards: number[];
}

/**
 * Activity times are 17 digits, tenths of a microsecond since the epoch. ISO strings pass through. Only exactly 17
 * digits count: a 16 or 18 digit string would read as 1975 or 2527, so other lengths go to Date.parse, which reads
 * them as unknown.
 */
export function activityTime(createdAt: string): Date | null {
  if (/^\d{17}$/.test(createdAt)) return new Date(Number(BigInt(createdAt) / BigInt(10000)));
  const t = Date.parse(createdAt);
  return Number.isNaN(t) ? null : new Date(t);
}

function parseData(raw: string | null | undefined): Record<string, unknown> | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw);
    return v && typeof v === "object" ? (v as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/** The items an entry names, and a subitem's parent, which is refetched with it but never hinted removed. */
function idsIn(data: Record<string, unknown> | null): { ids: number[]; parents: number[] } {
  if (!data) return { ids: [], parents: [] };
  const out = new Set<number>();
  for (const key of ["pulse_id", "item_id"]) {
    const id = toId(data[key]);
    if (id !== null) out.add(id);
  }
  for (const key of ["pulse_ids", "item_ids"]) {
    const list = data[key];
    if (Array.isArray(list)) for (const v of list) {
      const id = toId(v);
      if (id !== null) out.add(id);
    }
  }
  const parent = toId(data.parent_item_id);
  return { ids: [...out], parents: parent === null ? [] : [parent] };
}

const REMOVAL = /delete|archive/i;
const RESTORE = /restore|unarchive/i;
/** An update is a post on an item. Deleting one names the item, but the item is still there. */
const ABOUT_UPDATE = /update/i;

export function parseActivityLogs(boards: BoardActivity[], pageLimit: number): ActivityScan {
  const items = new Set<number>();
  const removed = new Set<number>();
  const columns = new Set<number>();
  const full: number[] = [];
  let latest: number | null = null;

  for (const board of boards) {
    if (!board) continue;
    const boardId = toId(board.id);
    // fullBoards and columnsChangedBoards are ids we send back to Monday, so a board whose id we can't read is skipped.
    if (boardId === null) continue;
    const logs = board.activity_logs ?? [];
    if (logs.length >= pageLimit) full.push(boardId);
    for (const entry of logs) {
      if (!entry) continue;
      const t = activityTime(entry.created_at)?.getTime() ?? null;
      if (t !== null && (latest === null || t > latest)) latest = t;
      const { ids, parents } = idsIn(parseData(entry.data));
      if (ids.length === 0 && parents.length === 0) {
        if (/column/i.test(entry.event)) columns.add(boardId);
        continue;
      }
      for (const id of parents) items.add(id);
      for (const id of ids) {
        items.add(id);
        if (REMOVAL.test(entry.event) && !RESTORE.test(entry.event) && !ABOUT_UPDATE.test(entry.event)) removed.add(id);
      }
    }
  }

  return {
    itemIds: [...items],
    removedHints: [...removed],
    columnsChangedBoards: [...columns],
    latest: latest === null ? null : new Date(latest),
    fullBoards: full,
  };
}
