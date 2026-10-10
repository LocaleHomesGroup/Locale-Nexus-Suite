/**
 * npm run homescope:import -- [--dry-run] [--compare-snapshot]
 *
 * Reads HomeScope's catalogue from Monday (the HomeScope workspace's "Estimation
 * Source Data" boards) and saves a new version for each builder whose catalogue
 * changed. About 30 Monday calls, counted against the day's cap.
 *
 *   --dry-run            read and check only; save nothing
 *   --compare-snapshot   also show how each builder differs from catalogue.json
 *
 * Reads .env.local. Monday is only ever queried. Nothing read is written to disk.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import type { HsBuilder, ImportSummary } from "../src/data/homescope";
import { closeDb, getDb } from "../src/server/db/postgres";
import { readServerEnv } from "../src/server/env";
import { compareWithSnapshot } from "../src/server/homescope/compare";
import { importCatalogue } from "../src/server/homescope/run";
import { mondayClientFor } from "../src/server/mirror/run-source";

const FLAGS = new Set(["--dry-run", "--compare-snapshot"]);
/** No run should need more; the guard stops a loop, not a normal import. */
const MAX_CALLS = 60;

function print(s: ImportSummary) {
  console.log(`${s.status}${s.dryRun ? " (dry run, nothing saved)" : ""}: ${s.calls} Monday call(s)`);
  for (const b of s.builders) {
    console.log(
      `  ${b.name}: ${b.models} designs, ${b.ranges} ranges, ${b.elevations} elevations, ${b.colours} colours, ` +
        `${b.siteCosts} site works, ${b.variations} variations, ${b.boltOnModels} bolt-on designs`,
    );
  }
  if (!s.dryRun && s.status === "ok") {
    console.log(`  changed: ${s.changed.join(", ") || "none"}${s.retired.length ? `; retired: ${s.retired.join(", ")}` : ""}`);
  }
  for (const w of s.warnings) {
    const names = w.items.length > 8 ? `${w.items.slice(0, 8).join(", ")} and ${w.items.length - 8} more` : w.items.join(", ");
    console.log(`  ! ${w.board}: ${w.message}: ${names}`);
  }
  if (s.error) console.error(`  ${s.error}`);
}

export async function main(args: string[]) {
  const unknown = args.filter((a) => !FLAGS.has(a));
  if (unknown.length) throw new Error(`Unknown option ${unknown.join(" ")}. See the comment at the top of scripts/homescope-import.ts.`);
  const env = readServerEnv();
  const db = getDb();
  if (!db) throw new Error("Set SUPABASE_DB_URL in .env.local: the import counts its Monday calls in the database, and saves there.");
  try {
    const monday = mondayClientFor(db, env, MAX_CALLS);
    if (!monday) throw new Error("Set MONDAY_API_TOKEN in .env.local.");
    const { summary, builders } = await importCatalogue({ db, monday, trigger: "cli", dryRun: args.includes("--dry-run") });
    print(summary);
    if (args.includes("--compare-snapshot") && summary.status === "ok") {
      const path = join(process.cwd(), "src", "components", "modules", "sales", "costing", "homescope", "catalogue.json");
      const snapshot = JSON.parse(readFileSync(path, "utf8")) as { builders: HsBuilder[] };
      console.log("Against catalogue.json (6 October):");
      for (const line of compareWithSnapshot(builders, snapshot.builders)) console.log(`  ${line}`);
    }
    if (summary.status === "failed") process.exitCode = 1;
  } finally {
    await closeDb();
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main(process.argv.slice(2)).catch(async (e) => {
    console.error(e instanceof Error ? e.message : e);
    await closeDb();
    process.exit(1);
  });
}
