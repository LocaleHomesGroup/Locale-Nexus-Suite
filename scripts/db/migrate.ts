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
import pg from "pg";
import { META_SQL, planMigrations, readMigrations, type MigrationFile } from "../../src/server/db/migrations";
import { checkDbUrl, POOL_OPTIONS } from "../../src/server/db/postgres";

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
  // One connection for the whole run. No client-side query timeout: DDL may run long; the server's own
  // statement_timeout still applies. Every migration's SQL goes as one simple query (no parameters).
  const { query_timeout: _none, ...clientOptions } = POOL_OPTIONS;
  checkDbUrl(url); // a clean message for a malformed URL, and no ?sslmode= overriding our TLS
  const sql = new pg.Client({ ...clientOptions, connectionString: url });
  // A connection that drops mid-run fails the statement in flight, which failure() reports; without a
  // listener the client's own error event would also end the process with a bare stack trace.
  sql.on("error", () => {});
  await sql.connect();
  try {
    // Both must be launchpad_app: a session logged in as someone else with `role` set to launchpad_app
    // passes on current_user alone, and a migration's own SQL could `reset role` back to that login.
    const {
      rows: [{ role_name, login_name }],
    } = await sql.query<{ role_name: string; login_name: string }>(
      "select current_user as role_name, session_user as login_name",
    );
    console.log(`connected as ${role_name} (login ${login_name})`);
    if (role_name !== "launchpad_app" || login_name !== "launchpad_app") {
      console.error(
        "Migrations run as launchpad_app only (scripts/db/bootstrap.sql creates it). Check the user in SUPABASE_DB_URL.",
      );
      process.exitCode = 1;
      return;
    }

    // Status changes nothing, not even the history table: without one, nothing has been applied.
    if (!statusOnly) await sql.query(META_SQL);
    const {
      rows: [{ present }],
    } = await sql.query<{ present: boolean }>("select to_regclass('launchpad_meta.migrations') is not null as present");
    const applied = present
      ? (await sql.query<{ version: string; checksum: string }>("select version, checksum from launchpad_meta.migrations order by version"))
          .rows
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
        await sql.query("begin");
        await sql.query(f.sql); // no parameters, so one simple query: a file may hold many statements
        await sql.query("insert into launchpad_meta.migrations (version, name, checksum) values ($1, $2, $3)", [
          f.version,
          f.name,
          f.checksum,
        ]);
        await sql.query("commit");
      } catch (e) {
        await sql.query("rollback").catch(() => {});
        throw failure(f, e);
      }
      console.log(`done     ${f.version}_${f.name}`);
    }
  } finally {
    await sql.end();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
