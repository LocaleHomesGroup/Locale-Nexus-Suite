import { NextResponse } from "next/server";
import type { CatalogueResponse } from "@/data/homescope";
import { getDb } from "@/server/db/postgres";
import { loadCatalogue, loadLastImport } from "@/server/homescope/store";

export const dynamic = "force-dynamic";

/**
 * HomeScope's catalogue as last imported from Monday, and the last import run.
 * "off" with no database: the screens keep catalogue.json. There's no sign-in yet,
 * so a deployment serving this must sit behind Vercel Deployment Protection, like
 * the mirrored files (spec section 7).
 */
export async function GET() {
  try {
    const db = getDb();
    if (!db) return NextResponse.json({ kind: "off" } satisfies CatalogueResponse);
    const [catalogue, lastImport] = await Promise.all([loadCatalogue(db), loadLastImport(db)]);
    return NextResponse.json({ kind: "live", catalogue, lastImport } satisfies CatalogueResponse);
  } catch (e) {
    // A malformed connection string or a database error must not reach the browser as a bare 500.
    console.error("[homescope] couldn't read the catalogue:", e);
    return NextResponse.json(
      { kind: "error", message: "The imported catalogue can't be read right now, so these are the 6 October snapshot prices." } satisfies CatalogueResponse,
      { status: 502 },
    );
  }
}
