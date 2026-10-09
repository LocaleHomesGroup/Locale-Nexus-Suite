import { NextResponse } from "next/server";
import { getDb } from "@/server/db/postgres";
import { fileAnswer } from "@/server/file-answer";
import { loadAssetPath } from "@/server/read/files";
import { BUCKETS, supabaseFileStore } from "@/server/storage";

export const dynamic = "force-dynamic";

/**
 * Opens a mirrored Monday file through a signed URL that lasts 5 minutes. A file that will never be copied answers
 * 410, one still on its way 409, and one that doesn't exist 404 (file-answer.ts decides).
 * There's no sign-in yet, so a deployment with real data must sit behind
 * Vercel Deployment Protection (spec section 7).
 */
export async function GET(_request: Request, { params }: { params: Promise<{ assetId: string }> }) {
  try {
    const { assetId } = await params;
    const db = getDb();
    const store = supabaseFileStore();
    if (!db || !store) return NextResponse.json({ error: "Files need a database and Storage" }, { status: 503 });
    const answer = fileAnswer(await loadAssetPath(db, assetId));
    if (answer.kind === "error") return NextResponse.json({ error: answer.error }, { status: answer.status });
    const url = await store.signedUrl(BUCKETS.mondayFiles, answer.path, 300);
    return NextResponse.redirect(url, 307);
  } catch (e) {
    // A malformed connection string or a Storage error must not reach the browser as a bare 500.
    console.error("[files] couldn't open a Monday file:", e);
    return NextResponse.json({ error: "Couldn't open that file right now. Try again in a moment." }, { status: 502 });
  }
}
