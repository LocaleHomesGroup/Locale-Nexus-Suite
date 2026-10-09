/**
 * npm run db:seed
 *
 * Writes one staff row per seat on today's org chart (src/components/modules/hr/data.ts)
 * and fills each department's head. Safe to re-run: a row the roster owns or someone
 * edited by hand (source <> 'org_seed') is left alone, a row that already matches the
 * chart is not rewritten, and a head that is already set is kept. The counts it prints
 * are the staff rows added or changed, and the heads filled.
 */
import { closeDb, getDb } from "../../src/server/db/postgres";
import { seedStaff, staffSeedRows } from "../../src/server/db/seed-staff";

async function main() {
  const db = getDb();
  if (!db) {
    console.error("SUPABASE_DB_URL is not set. Put it in .env.local (see .env.example).");
    process.exit(1);
  }
  const rows = staffSeedRows();
  const result = await seedStaff(db, rows);
  console.log(`staff: ${result.written} of ${rows.length} added or changed; department heads filled: ${result.heads}`);
  await closeDb();
}

main().catch(async (e) => {
  console.error(e instanceof Error ? e.message : e);
  // A PostgresError says which value was refused in `detail` (a bad manager's seat id is there), and sometimes how to fix it in `hint`.
  const { detail, hint } = (typeof e === "object" && e !== null ? e : {}) as { detail?: string; hint?: string };
  if (detail) console.error(`detail: ${detail}`);
  if (hint) console.error(`hint: ${hint}`);
  await closeDb();
  process.exit(1);
});
