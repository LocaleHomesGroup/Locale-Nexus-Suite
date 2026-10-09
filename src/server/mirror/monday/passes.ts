import type { Db } from "../../db/types";
import { beginRun, endRun, getWatermark, markState, setWatermark, type Trigger } from "../runs";
import { parseActivityLogs, type BoardActivity } from "./activity";
import { MondayCapReachedError, MondayDailyLimitError, MondayDeadlineError, type MondayClient } from "./client";
import { discoverBoardsById } from "./discover";
import {
  normaliseItem,
  normaliseUpdate,
  toId,
  type AssetRef,
  type ItemRow,
  type RawItem,
  type RawUpdate,
  type UpdateRow,
} from "./normalise";
import { Q } from "./queries";
import * as store from "./store";

/**
 * The Monday passes (spec section 4.3):
 *   backfill  every item on every synced board, once
 *   changes   one activity-log request across all boards, then only the items it names
 *   safety    items updated today or yesterday, compared by updated_at
 *   sweep     every board's ids, to catch deletes the log missed
 * Each runs under the 'monday' lease and writes one mirror.sync_runs row. After any pass that ran, finished or cut
 * short, the Exclusive Land lot sync runs on what is stored.
 */
export type MondayMode = "backfill" | "changes" | "safety" | "sweep";

export interface PassLimits {
  activityLimit: number;
  activityMaxPages: number;
  idsPerCall: number;
  updatePages: number;
}

const DEFAULT_LIMITS: PassLimits = { activityLimit: 1000, activityMaxPages: 10, idsPerCall: 100, updatePages: 200 };

export interface PassOptions {
  trigger: Trigger;
  /**
   * Limits the pass to this board and its subitems board. A pass limited this way never starts or moves the account-wide
   * watermark (a `changes` pass would skip the other boards' logs, and a `backfill` hasn't read them): only a pass over
   * every board does.
   */
  boardKey?: string;
  now?: () => Date;
  log?: (line: string) => void;
  /**
   * Overrides for the defaults. Each must be a positive whole number, and no larger than Monday takes: `idsPerCall`
   * at most 100, `activityLimit` at most 10000. Anything else is refused before the pass starts.
   */
  limits?: Partial<PassLimits>;
  /** No Monday call starts after this; the pass ends partial, and its note says where the next run starts. Cron routes set it, the CLI doesn't. */
  deadline?: Date;
}

export interface PassResult {
  status: "ok" | "partial" | "failed" | "skipped";
  calls: number;
  seen: number;
  changed: number;
  note: string | null;
  error: string | null;
}

const LOCK_SECONDS: Record<MondayMode, number> = { backfill: 3300, changes: 600, safety: 1500, sweep: 3300 };

/** What a pass cut short by its time limit says about the next run, which depends on where that run starts. */
const STOPPED: Record<MondayMode, string> = {
  backfill: "stopped at the run's time limit; run backfill again to finish (it starts from the first board)",
  changes: "stopped at the run's time limit; the next run picks up from here",
  safety: "stopped at the run's time limit; the next safety run starts again from the first board",
  sweep: "stopped at the run's time limit; the next run picks up from here",
};

interface ItemsPage {
  cursor: string | null;
  items: RawItem[];
}

interface StampsPage {
  cursor: string | null;
  items: { id: string; updated_at: string }[];
}

interface Ctx {
  db: Db;
  monday: MondayClient;
  limits: PassLimits;
  log: (line: string) => void;
  tally: { seen: number; changed: number };
}

/** After the first page, size pages to about 2M complexity points: Monday allows 5M a query and 10M a minute. */
export function nextPageSize(queryCost: number | null, limit: number): number {
  if (!queryCost || queryCost <= 0) return limit;
  const perItem = queryCost / limit;
  return Math.max(25, Math.min(500, Math.floor(2_000_000 / Math.max(perItem, 1))));
}

async function storeItems(ctx: Ctx, raws: RawItem[], boardFallback?: number): Promise<number[]> {
  const items: ItemRow[] = [];
  const assets: AssetRef[] = [];
  for (const raw of raws) {
    const n = normaliseItem(raw, boardFallback);
    if (n) {
      items.push(n.item);
      assets.push(...n.assets);
    }
  }
  ctx.tally.seen += items.length;
  ctx.tally.changed += await store.upsertItems(ctx.db, items);
  await store.syncFileAssets(ctx.db, items.map((i) => i.id), assets);
  return items.map((i) => i.id);
}

async function storeUpdates(ctx: Ctx, raws: RawUpdate[]): Promise<void> {
  const updates: UpdateRow[] = [];
  const assets: AssetRef[] = [];
  for (const raw of raws) {
    const n = normaliseUpdate(raw);
    if (n) {
      updates.push(n.update);
      assets.push(...n.assets);
    }
  }
  ctx.tally.changed += await store.upsertUpdates(ctx.db, updates, assets);
}

/** Fetches items by id, archived and deleted ones included. Ids Monday doesn't return are gone. */
async function refetch(ctx: Ctx, ids: number[]): Promise<void> {
  const unique = [...new Set(ids)];
  for (let i = 0; i < unique.length; i += ctx.limits.idsPerCall) {
    const chunk = unique.slice(i, i + ctx.limits.idsPerCall);
    const data = await ctx.monday.query<{ items: RawItem[] | null }>(Q.itemsByIds, { ids: chunk.map(String), limit: chunk.length });
    await storeItems(ctx, data.items ?? []);
    // Gone means Monday didn't return the id. An item it did return but we couldn't place (a null board, say)
    // stays as it was, never marked removed.
    const returned = new Set((data.items ?? []).map((r) => toId(r?.id)).filter((id): id is number => id !== null));
    ctx.tally.changed += await store.markRemoved(ctx.db, chunk.filter((id) => !returned.has(id)));
  }
}

/** Reads every board in full. Returns a note for each board whose comments ran into the page limit. */
async function backfill(ctx: Ctx, boards: store.SyncedBoard[]): Promise<string[]> {
  const notes: string[] = [];
  for (const board of boards) {
    ctx.log(`backfill ${board.board_key ?? board.id}`);
    let limit = 100;
    let cursor: string | null = null;
    let first = true;
    while (first || cursor) {
      let page: ItemsPage | undefined;
      if (first) {
        const data = await ctx.monday.query<{ boards: { items_page: ItemsPage }[] }>(Q.firstItemsPage, {
          board: [String(board.id)],
          limit,
        });
        page = data.boards?.[0]?.items_page;
        limit = nextPageSize(ctx.monday.stats.lastComplexity?.query ?? null, limit);
        first = false;
      } else {
        const data: { next_items_page: ItemsPage } = await ctx.monday.query(Q.nextItemsPage, { cursor, limit });
        page = data.next_items_page;
      }
      if (!page) break;
      await storeItems(ctx, page.items ?? [], board.id);
      cursor = page.cursor;
    }
    // Comments, 100 a page. A page still full at the page limit may have older ones behind it.
    let capped = true;
    for (let p = 1; p <= ctx.limits.updatePages; p++) {
      const data = await ctx.monday.query<{ boards: { updates: RawUpdate[] | null }[] }>(Q.boardUpdatesPage, {
        board: [String(board.id)],
        limit: 100,
        page: p,
      });
      const updates = data.boards?.[0]?.updates ?? [];
      await storeUpdates(ctx, updates);
      if (updates.length < 100) {
        capped = false;
        break;
      }
    }
    if (capped) notes.push(`${board.board_key ?? board.id}: comments stopped at ${ctx.limits.updatePages} pages, so older ones may be missing`);
    await markState(ctx.db, "monday", `board:${board.id}`, "backfilled_at");
  }
  return notes;
}

async function changes(
  ctx: Ctx,
  boards: store.SyncedBoard[],
  startedAt: Date,
  oneBoard: boolean,
): Promise<{ status: "ok" | "partial" | "skipped"; note: string | null; before: Date | null; after: Date | null }> {
  const before = await getWatermark(ctx.db, "monday", "account");
  if (!before) {
    return { status: "skipped", note: "no watermark yet: run `npm run mirror -- backfill` (all boards) first", before, after: null };
  }

  const from = new Date(before.getTime() - 2 * 60_000).toISOString();
  const { activityLimit, activityMaxPages } = ctx.limits;
  const first = await ctx.monday.query<{ boards: BoardActivity[] | null }>(Q.activityWithUpdates, {
    boards: boards.map((b) => String(b.id)),
    from,
    limit: activityLimit,
  });
  const pages: BoardActivity[][] = [first.boards ?? []];
  await storeUpdates(ctx, (first.boards ?? []).flatMap((b) => b.updates ?? []));
  let full = parseActivityLogs(first.boards ?? [], activityLimit).fullBoards;
  for (let page = 2; full.length > 0 && page <= activityMaxPages; page++) {
    const more = await ctx.monday.query<{ boards: BoardActivity[] | null }>(Q.activityPage, {
      boards: full.map(String),
      from,
      limit: activityLimit,
      page,
    });
    pages.push(more.boards ?? []);
    full = parseActivityLogs(more.boards ?? [], activityLimit).fullBoards;
  }

  const scan = parseActivityLogs(pages.flat(), Number.POSITIVE_INFINITY);
  if (scan.columnsChangedBoards.length > 0) await discoverBoardsById(ctx.db, ctx.monday, scan.columnsChangedBoards);
  await refetch(ctx, scan.itemIds);

  if (full.length > 0) {
    // This pass never reads the entries past the page cap. Rather than leave them to the daily safety pass,
    // check those boards' recent updates now: a few calls a board. The watermark waits for the check, so a
    // pass cut short leaves it where it was and the next run re-reads this window.
    await safety(ctx, boards.filter((b) => full.includes(b.id)));
  }
  // A pass limited to one board has not read the other boards' logs, so it never moves the account-wide watermark.
  if (!oneBoard) await setWatermark(ctx.db, "monday", "account", startedAt);

  const notes: string[] = [];
  if (full.length > 0) {
    notes.push(
      `the activity log was still full after ${activityMaxPages} pages on ${full.length} board(s), so the safety check ran on those boards too; ` +
        "entries older than yesterday wait for the weekly sweep",
    );
  } else if (scan.itemIds.length === 0) {
    notes.push("nothing changed");
  }
  if (oneBoard) notes.push("watermark unchanged: one board only");
  return {
    status: full.length > 0 ? "partial" : "ok",
    note: notes.length > 0 ? notes.join("; ") : null,
    before,
    after: oneBoard ? null : startedAt,
  };
}

async function walkStamps(
  ctx: Ctx,
  boardId: number,
  firstDocument: string,
  visit: (id: number, updatedMs: number) => void,
): Promise<void> {
  let cursor: string | null = null;
  let first = true;
  while (first || cursor) {
    let page: StampsPage | undefined;
    if (first) {
      const data = await ctx.monday.query<{ boards: { items_page: StampsPage }[] }>(firstDocument, {
        board: [String(boardId)],
        limit: 500,
      });
      page = data.boards?.[0]?.items_page;
      first = false;
    } else {
      const data: { next_items_page: StampsPage } = await ctx.monday.query(Q.nextStampsPage, { cursor, limit: 500 });
      page = data.next_items_page;
    }
    if (!page) break;
    for (const item of page.items ?? []) {
      const id = Number(item.id);
      const t = Date.parse(item.updated_at);
      if (Number.isSafeInteger(id) && !Number.isNaN(t)) visit(id, t);
    }
    cursor = page.cursor;
  }
}

async function safety(ctx: Ctx, boards: store.SyncedBoard[]): Promise<void> {
  for (const board of boards) {
    const stamps = await store.itemStamps(ctx.db, board.id);
    const stale: number[] = [];
    await walkStamps(ctx, board.id, Q.recentStampsPage, (id, t) => {
      if (stamps.get(id) !== t) stale.push(id);
    });
    await refetch(ctx, stale);
  }
}

async function sweep(ctx: Ctx, boards: store.SyncedBoard[]): Promise<void> {
  // Boards swept longest ago (or never) first: a sweep cut short by its time limit resumes there next time.
  const sweptAt = new Map(
    (await ctx.db.query<{ scope: string; swept_at: Date | null }>(
      "select scope, swept_at from mirror.sync_state where source = 'monday' and scope like 'board:%'",
    )).map((r) => [r.scope, r.swept_at ? new Date(r.swept_at).getTime() : 0]),
  );
  const order = [...boards].sort((a, b) => (sweptAt.get(`board:${a.id}`) ?? 0) - (sweptAt.get(`board:${b.id}`) ?? 0) || a.id - b.id);
  for (const board of order) {
    const stamps = await store.itemStamps(ctx.db, board.id);
    const seen = new Set<number>();
    const stale: number[] = [];
    await walkStamps(ctx, board.id, Q.firstStampsPage, (id, t) => {
      seen.add(id);
      if (stamps.get(id) !== t) stale.push(id);
    });
    const missing = [...stamps.keys()].filter((id) => !seen.has(id));
    await refetch(ctx, [...stale, ...missing]);
    await markState(ctx.db, "monday", `board:${board.id}`, "swept_at");
  }
}

/**
 * The same client, refusing to start a call after `deadline`, so a cron route ends before the host stops it.
 * (The real client also honours the deadline inside a call, Task 14 passes it there; the test fake doesn't.)
 */
function withDeadline(monday: MondayClient, deadline: Date, now: () => Date): MondayClient {
  return {
    query: (document, variables) => {
      if (now().getTime() >= deadline.getTime()) return Promise.reject(new MondayDeadlineError("time limit reached", "DEADLINE"));
      return monday.query(document, variables);
    },
    get stats() {
      return monday.stats;
    },
  };
}

/**
 * The largest value Monday takes for the limits that go to it: `items(ids:)` takes at most 100 ids a call, and an
 * activity log page holds at most 10,000 entries. Above the first, ids past Monday's cap could read as absent and be
 * marked removed; above the second, a full page could never be told from a short one.
 */
const MAX_LIMITS: Partial<Record<keyof PassLimits, number>> = { idsPerCall: 100, activityLimit: 10_000 };

/** Every limit is a positive whole number, and none is larger than Monday takes: 0 or a fraction would stop a loop from ever advancing. */
function checkLimits(limits: PassLimits): void {
  for (const key of Object.keys(DEFAULT_LIMITS) as (keyof PassLimits)[]) {
    const value: unknown = limits[key];
    const max = MAX_LIMITS[key];
    if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 1 || (max !== undefined && value > max)) {
      const range = max === undefined ? "a positive whole number" : `a whole number from 1 to ${max}`;
      throw new RangeError(`limits.${key} must be ${range}, not ${typeof value === "string" ? JSON.stringify(value) : String(value)}`);
    }
  }
}

/** Why a pass found no board to run on: no board has that key, or none is enabled at all. */
async function noBoardsNote(db: Db, boardKey: string | undefined): Promise<string> {
  if (boardKey != null && (await store.syncedBoards(db)).length > 0) {
    return `no enabled board is called ${boardKey}: \`npm run mirror -- status\` lists them`;
  }
  return "no boards are enabled: run `npm run mirror -- setup` first";
}

/** A message added to an error that may hold one already. */
const addTo = (error: string | null, message: string): string => (error ? `${error}; ${message}` : message);

export async function runMondayPass(db: Db, monday: MondayClient, mode: MondayMode, opts: PassOptions): Promise<PassResult> {
  // All of this is built before the lease is taken, so a mistake (a bad limit, a clock or a client that throws) leaves no
  // trace, and nothing between taking the lease and the try below can throw and strand it.
  const limits = { ...DEFAULT_LIMITS, ...opts.limits };
  checkLimits(limits);
  const now = opts.now ?? (() => new Date());
  const ctx: Ctx = {
    db,
    monday: opts.deadline ? withDeadline(monday, opts.deadline, now) : monday,
    limits,
    log: opts.log ?? (() => {}),
    tally: { seen: 0, changed: 0 },
  };
  const callsBefore = monday.stats.calls;
  const complexityBefore = monday.stats.complexity;
  const startedAt = now();

  const run = await beginRun(db, "monday", mode, opts.trigger, LOCK_SECONDS[mode]);
  if (!run) return { status: "skipped", calls: 0, seen: 0, changed: 0, note: "another Monday pass is running", error: null };

  let status: PassResult["status"] = "ok";
  let note: string | null = null;
  let error: string | null = null;
  let watermarkBefore: Date | null = null;
  let watermarkAfter: Date | null = null;

  try {
    try {
      const boards = await store.syncedBoards(db, opts.boardKey);
      if (boards.length === 0) {
        status = "skipped";
        note = await noBoardsNote(db, opts.boardKey);
      } else if (mode === "backfill") {
        const capped = await backfill(ctx, boards);
        const notes = [...capped];
        // Comments that stopped at the page limit leave older ones unread. "ok" means complete, as it does for the
        // activity log's page cap, so the pass is partial and its note says which boards.
        if (capped.length > 0) status = "partial";
        // Only a pass over every board starts the watermark. One limited to a board leaves the others unread, and
        // `changes` would then run over every board while the rest held only what changed since.
        if (!(await getWatermark(db, "monday", "account"))) {
          if (opts.boardKey == null) {
            await setWatermark(db, "monday", "account", startedAt);
            watermarkAfter = startedAt;
          } else {
            // The first run in the README is exactly this: say why `changes` will wait for a backfill of every board.
            notes.push("watermark not started: one board only");
          }
        }
        if (notes.length > 0) note = notes.join("; ");
      } else if (mode === "changes") {
        const r = await changes(ctx, boards, startedAt, opts.boardKey != null);
        ({ status, note } = r);
        watermarkBefore = r.before;
        watermarkAfter = r.after;
      } else if (mode === "safety") {
        await safety(ctx, boards);
      } else {
        await sweep(ctx, boards);
      }
    } catch (e) {
      if (e instanceof MondayDeadlineError) {
        status = "partial";
        note = STOPPED[mode];
      } else {
        error = e instanceof Error ? e.message : String(e);
        status = e instanceof MondayCapReachedError || e instanceof MondayDailyLimitError ? "partial" : "failed";
      }
    }
    if (status !== "skipped") {
      // After every pass that ran, finished or not, so the lots it stored needn't wait for the next one. It reads only
      // what is stored, so its failing never undoes the Monday work: the error says so, and an ok pass becomes partial.
      try {
        await db.query("select launchpad.sync_land_lots_from_monday()");
      } catch (e) {
        error = addTo(error, `land lot sync failed: ${e instanceof Error ? e.message : String(e)}`);
        if (status === "ok") status = "partial";
      }
    }
  } finally {
    try {
      await endRun(db, run, {
        status,
        calls: monday.stats.calls - callsBefore,
        complexity: monday.stats.complexity - complexityBefore,
        seen: ctx.tally.seen,
        changed: ctx.tally.changed,
        note,
        error,
        watermarkBefore,
        watermarkAfter,
      });
    } catch (e) {
      // endRun frees the lease whatever happens. The result still tells the caller what the pass did.
      error = addTo(error, `the run couldn't be recorded: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  return { status, calls: monday.stats.calls - callsBefore, seen: ctx.tally.seen, changed: ctx.tally.changed, note, error };
}
