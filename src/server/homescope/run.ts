import type { BuilderCounts, HsBuilder, ImportSummary, ImportTrigger } from "@/data/homescope";
import type { Db } from "../db/types";
import { messageOf } from "../error-message";
import { MondayCapReachedError, type MondayClient } from "../mirror/monday/client";
import type { EstimationBoards } from "./boards";
import { readEstimationBoards } from "./read";
import { recordFailedImport, saveImport } from "./store";
import { toCatalogue } from "./to-catalogue";

export const countsOf = (b: HsBuilder): BuilderCounts => ({
  name: b.name,
  models: b.models.length,
  ranges: b.ranges.length,
  elevations: b.elevations.length,
  colours: b.colours.length,
  siteCosts: b.siteCosts.length,
  variations: b.variations.length,
  boltOnModels: Object.keys(b.boltOns).length,
});

export const failedSummary = (error: string, calls = 0, dryRun = false): ImportSummary => ({
  status: "failed",
  dryRun,
  calls,
  builders: [],
  changed: [],
  retired: [],
  warnings: [],
  error,
});

/** What Ops read when an import fails: plain words for a few known causes, the error's own message otherwise. */
export function importErrorMessage(e: unknown): string {
  if (e instanceof MondayCapReachedError) {
    return "The import stopped at its limit of Monday calls before it finished, so nothing was saved. Tell the AI team.";
  }
  if ((e as { code?: string } | null)?.code === "23505") {
    return "Another import was saving at the same time, so this one stopped. The catalogue is up to date; refresh to see it.";
  }
  return messageOf(e);
}

/**
 * One import: read the twelve boards, turn them into the catalogue, and save it
 * (or, on a dry run, only check it). Nothing is saved unless the whole read and
 * the transform succeed. A failure is recorded as a failed run, never thrown, so the
 * CLI and the Operations screen both get a summary.
 */
export async function importCatalogue(opts: {
  db: Db | null;
  monday: MondayClient;
  trigger: ImportTrigger;
  dryRun?: boolean;
  /** For tests. */
  read?: (monday: MondayClient) => Promise<EstimationBoards>;
}): Promise<{ summary: ImportSummary; builders: HsBuilder[] }> {
  const dryRun = opts.dryRun ?? false;
  const before = opts.monday.stats.calls;
  const calls = () => opts.monday.stats.calls - before;
  try {
    const { builders, warnings } = toCatalogue(await (opts.read ?? readEstimationBoards)(opts.monday));
    if (!builders.length) throw new Error("Monday's Builders board has no builders, so nothing was imported");
    let saved = { changed: [] as string[], retired: [] as string[] };
    if (!dryRun) {
      if (!opts.db) throw new Error("There's no database to save to. Set SUPABASE_DB_URL, or use --dry-run");
      saved = await saveImport(opts.db, { builders, warnings, calls: calls(), trigger: opts.trigger });
    }
    return {
      builders,
      summary: { status: "ok", dryRun, calls: calls(), builders: builders.map(countsOf), changed: saved.changed, retired: saved.retired, warnings, error: null },
    };
  } catch (e) {
    const error = importErrorMessage(e);
    if (!dryRun && opts.db) {
      await recordFailedImport(opts.db, { error, calls: calls(), trigger: opts.trigger }).catch((recordError) =>
        console.error("[homescope] couldn't record a failed import:", messageOf(recordError)),
      );
    }
    return { builders: [], summary: failedSummary(error, calls(), dryRun) };
  }
}
