import type { LiveData } from "@/data/live/types";
import { getDb, isQueryTimeout } from "../db/postgres";
import type { Db } from "../db/types";
import { getWatermark } from "../mirror/runs";
import { loadJobs } from "./jobs";
import { loadLots } from "./lots";
import { loadReps } from "./reps";

/**
 * Everything the live screens need, read once per navigation into a live section
 * (Sales, Consultant, Operations) by LiveBoundary. Null with no database (the screens keep sample data). When the
 * database can't be read, an error the screens show, never a crash. "As of" is
 * the time up to which the mirror holds every change Monday logged (the
 * 'complete' mark), so a stalled mirror, or a refetch queue still catching up,
 * doesn't look current. Before the first such mark it is Monday's watermark.
 *
 * Each read gives up after READ_TIMEOUT_MS and the whole load is tried once more: on a slow or flaky link to the pooler a
 * large result now and then never arrives although the server sent it, and a fresh connection gets it at once.
 */
export const READ_TIMEOUT_MS = 15_000;

/** A load slower than this is noted in the log, its time and nothing else, so a slow page shows without a stopwatch. */
export const SLOW_LOAD_MS = 3_000;

export async function loadLiveData(db?: Db | null, now: () => Date = () => new Date()): Promise<LiveData | null> {
  const started = now().getTime();
  try {
    // Resolved inside the try: a malformed connection string throws, and the screens
    // show sample data instead of an error page.
    const conn = db === undefined ? getDb({ queryTimeoutMs: READ_TIMEOUT_MS }) : db;
    if (!conn) return null;
    const read = () =>
      Promise.all([
        loadJobs(conn),
        loadLots(conn),
        loadReps(conn),
        getWatermark(conn, "monday", "complete"),
        getWatermark(conn, "monday", "account"),
      ]);
    const [jobs, lots, reps, complete, synced] = await read().catch((e: unknown) => {
      if (!isQueryTimeout(e)) throw e;
      console.warn("[live-data] a database read timed out, so the load is tried once more");
      return read();
    });
    const readAt = now();
    return { status: "ok", asOf: (complete ?? synced ?? readAt).toISOString(), readAt: readAt.toISOString(), jobs, lots, reps };
  } catch (e) {
    console.error("[live-data] couldn't read the database, showing sample data:", e);
    return { status: "error", message: "Live data is unavailable right now, so these screens show sample data." };
  } finally {
    // The whole call, a retry included, and a failed load as much as a good one. The time only: no data in the line.
    const took = now().getTime() - started;
    if (took > SLOW_LOAD_MS) console.warn(`[live-data] a load took ${took} ms`);
  }
}
