import { NextResponse } from "next/server";
import { isCronAuthorized } from "@/server/cron-auth";
import { getDb } from "@/server/db/postgres";
import { readServerEnv } from "@/server/env";

export const dynamic = "force-dynamic";

/** Every 5 minutes: ends lapsed Exclusive Land holds and starts (and notifies) the next in each queue. */
export async function GET(request: Request) {
  const env = readServerEnv();
  if (!isCronAuthorized(request.headers.get("authorization"), env.cronSecret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const db = getDb();
  if (!db) return NextResponse.json({ error: "No database is configured" }, { status: 503 });
  const [row] = await db.query<{ started: number }>("select count(*)::int as started from launchpad.settle_land_holds()");
  return NextResponse.json({ started: row?.started ?? 0 });
}
