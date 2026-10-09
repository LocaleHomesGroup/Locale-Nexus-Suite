/**
 * npm run db:migrate   apply pending migrations
 * npm run db:status    list applied and pending migrations, and change nothing
 *
 * Applies supabase/migrations/*.sql over SUPABASE_DB_URL, each in its own transaction, and
 * records it in launchpad_meta.migrations: our own history table, so it can't clash with the
 * Supabase CLI's or Jerry's. It runs as launchpad_app only (scripts/db/bootstrap.sql creates
 * that login and our schemas) and refuses any other role before it writes anything. Status
 * does no DDL at all. Refuses to run when a file that was already applied has changed since.
 */
import postgres from "postgres";
import { META_SQL, planMigrations, readMigrations, type MigrationFile } from "../../src/server/db/migrations";
import { POOL_OPTIONS } from "../../src/server/db/postgres";

/** What a failed migration prints: the file, the server's message, then its detail, hint and position when it gave them. */
function failure(f: MigrationFile, e: unknown): Error {
  const err = e as { message?: string; detail?: string; hint?: string; position?: string };
  const lines = [`migration ${f.version}_${f.name} failed: ${err.message ?? String(e)}`];
  if (err.detail) lines.push(`detail: ${err.detail}`);
  if (err.hint) lines.push(`hint: ${err.hint}`);
  if (err.position) lines.push(`at character ${err.position}`);
  return new Error(lines.join("\n"));
}

async function main() {
  const url = process.env.SUPABASE_DB_URL?.trim();
  if (!url) {
    console.error("SUPABASE_DB_URL is not set. Put it in .env.local (see .env.example).");
    process.exit(1);
  }
  const statusOnly = process.argv.includes("--status");
  const files = readMigrations(); // local only: a bad folder is refused before any connection
  const sql = postgres(url, { ...POOL_OPTIONS, max: 1 });
  try {
    // Both must be launchpad_app: a session logged in as someone else with `role` set to launchpad_app
    // passes on current_user alone, and a migration's own SQL could `reset role` back to that login.
    const [{ role_name, login_name }] = await sql<{ role_name: string; login_name: string }[]>`
      select current_user as role_name, session_user as login_name`;
    console.log(`connected as ${role_name} (login ${login_name})`);
    if (role_name !== "launchpad_app" || login_name !== "launchpad_app") {
      console.error(
        "Migrations run as launchpad_app only (scripts/db/bootstrap.sql creates it). Check the user in SUPABASE_DB_URL.",
      );
      process.exitCode = 1;
      return;
    }

    // Status changes nothing, not even the history table: without one, nothing has been applied.
    if (!statusOnly) await sql.unsafe(META_SQL).simple();
    const [{ present }] = await sql<{ present: boolean }[]>`
      select to_regclass('launchpad_meta.migrations') is not null as present`;
    const applied = present
      ? await sql<{ version: string; checksum: string }[]>`
          select version, checksum from launchpad_meta.migrations order by version`
      : [];
    const plan = planMigrations(files, applied);

    if (plan.changed.length > 0) {
      console.error("These migrations were applied and have changed since. Add a new migration instead:");
      for (const f of plan.changed) console.error(`  ${f.version}_${f.name}`);
      process.exitCode = 1;
      return;
    }
    if (plan.unknown.length > 0) {
      console.warn(`Applied but not in supabase/migrations: ${plan.unknown.join(", ")}`);
    }
    for (const f of files) {
      console.log(`${plan.pending.includes(f) ? "pending" : "applied"}  ${f.version}_${f.name}`);
    }
    if (statusOnly) return;
    if (plan.pending.length === 0) {
      console.log("Nothing to apply.");
      return;
    }
    for (const f of plan.pending) {
      try {
        await sql.begin(async (tx) => {
          await tx.unsafe(f.sql).simple();
          await tx`insert into launchpad_meta.migrations (version, name, checksum)
                   values (${f.version}, ${f.name}, ${f.checksum})`;
        });
      } catch (e) {
        throw failure(f, e);
      }
      console.log(`done     ${f.version}_${f.name}`);
    }
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
