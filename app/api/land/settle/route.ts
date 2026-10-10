import { NextResponse } from "next/server";
import { isCronAuthorized } from "@/server/cron-auth";
import { getDb } from "@/server/db/postgres";
import { readServerEnv } from "@/server/env";
import { messageOf } from "@/server/error-message";

export const dynamic = "force-dynamic";

/** Every 5 minutes: ends lapsed Exclusive Land holds and starts (and notifies) the next in each queue. */
export async function GET(request: Request) {
  const env = readServerEnv();
  if (!isCronAuthorized(request.headers.get("authorization"), env.cronSecret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const db = getDb();
    if (!db) return NextResponse.json({ error: "No database is configured" }, { status: 503 });
    const [row] = await db.query<{ started: number }>("select count(*)::int as started from launchpad.settle_land_holds()");
    return NextResponse.json({ started: row?.started ?? 0 });
  } catch (e) {
    // A connection string that doesn't parse, or a database that can't be reached. Next would answer with a bare 500,
    // so the route answers JSON itself, and logs one line: the message, never the error with its stack.
    console.error("[land] settle failed:", messageOf(e));
    return NextResponse.json({ error: "Settling the holds failed. The function log has the reason." }, { status: 500 });
  }
}
