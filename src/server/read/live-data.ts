import type { LiveData } from "@/data/live/types";
import { getDb } from "../db/postgres";
import type { Db } from "../db/types";
import { getWatermark } from "../mirror/runs";
import { loadJobs } from "./jobs";
import { loadLots } from "./lots";
import { loadReps } from "./reps";

/**
 * Everything the live screens need, read once per page load by the dashboard
 * layout. Null with no database (the screens keep sample data). When the
 * database can't be read, an error the screens show, never a crash. "As of" is
 * Monday's last full sync, so a stalled mirror doesn't look current.
 */
export async function loadLiveData(db?: Db | null, now: () => Date = () => new Date()): Promise<LiveData | null> {
  try {
    // Resolved inside the try: a malformed connection string throws, and the screens
    // show sample data instead of an error page.
    const conn = db === undefined ? getDb() : db;
    if (!conn) return null;
    const [jobs, lots, reps, synced] = await Promise.all([
      loadJobs(conn),
      loadLots(conn),
      loadReps(conn),
      getWatermark(conn, "monday", "account"),
    ]);
    const readAt = now();
    return { status: "ok", asOf: (synced ?? readAt).toISOString(), readAt: readAt.toISOString(), jobs, lots, reps };
  } catch (e) {
    console.error("[live-data] couldn't read the database, showing sample data:", e);
    return { status: "error", message: "Live data is unavailable right now, so these screens show sample data." };
  }
}
