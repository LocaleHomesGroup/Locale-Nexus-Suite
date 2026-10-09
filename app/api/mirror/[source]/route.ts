import { NextResponse } from "next/server";
import { isCronAuthorized } from "@/server/cron-auth";
import { getDb } from "@/server/db/postgres";
import { readServerEnv } from "@/server/env";
import { runSource } from "@/server/mirror/run-source";

export const dynamic = "force-dynamic";
// Vercel Pro allows 300s. Nothing starts or waits past 120s (RUN_SECONDS): the pass refuses new calls, and the
// client claims, waits and times out no attempt beyond it. So the pass ends partial well before the host stops
// the function, its lease is released, and the next run carries on.
export const maxDuration = 300;
const RUN_SECONDS = 120;

/**
 * GET /api/mirror/monday?mode=changes (or backfill, safety, sweep, files), or /api/mirror/hubspot?mode=changes, with
 * Authorization: Bearer CRON_SECRET.
 */
export async function GET(request: Request, { params }: { params: Promise<{ source: string }> }) {
  const env = readServerEnv();
  if (!isCronAuthorized(request.headers.get("authorization"), env.cronSecret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const db = getDb();
  if (!db) return NextResponse.json({ error: "No database is configured" }, { status: 503 });
  const { source } = await params;
  const mode = new URL(request.url).searchParams.get("mode") ?? "";
  const result = await runSource(db, env, source, mode, "cron", { deadline: new Date(Date.now() + RUN_SECONDS * 1000) });
  // A failure before any run row exists (a mistyped schedule, a missing token, a database that can't be reached) is
  // otherwise recorded only in the response body. The message only, never the object.
  if (result.status === "failed") console.error(`[mirror] ${source} ${mode} failed:`, result.error);
  return NextResponse.json(result, { status: result.status === "failed" ? 500 : 200 });
}
