"use server";

import type { ImportSummary } from "@/data/homescope";
import { getDb } from "@/server/db/postgres";
import { readServerEnv } from "@/server/env";
import { failedSummary, importCatalogue } from "@/server/homescope/run";
import { mondayClientFor } from "@/server/mirror/run-source";

/** Operations › HomeScope pricing's "Import from Monday": about 30 read-only calls, then a summary. */
export async function importCatalogueAction(): Promise<ImportSummary> {
  const db = getDb();
  if (!db) return failedSummary("Live data isn't connected, so there's nowhere to save an import.");
  const monday = mondayClientFor(db, readServerEnv(), 60, new Date(Date.now() + 120_000));
  if (!monday) return failedSummary("MONDAY_API_TOKEN isn't set, so Monday can't be read.");
  return (await importCatalogue({ db, monday, trigger: "screen" })).summary;
}
