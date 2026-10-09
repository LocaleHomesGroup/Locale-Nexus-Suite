/**
 * npm run mirror -- <command> [options]
 *
 *   status                      boards (and their keys), items, files, today's calls, recent runs
 *   buckets                     create the private Storage buckets
 *   discover [--workspace <id>] [--max-calls <n>]
 *                               list the workspaces (and one workspace's boards) the token can see
 *   setup [--jerry-config <p>] [--max-calls <n>]
 *                               enable Locale's boards and map their columns from Jerry's config
 *   reps                        match Monday's sales rep names to staff (after a backfill)
 *   backfill | changes | safety | sweep [--board <key>] [--max-calls <n>]
 *   files [--max-files <n>] [--max-calls <n>]
 *                               copy Monday's files into Storage
 *   hubspot                     HubSpot owners, pipelines, and deals/contacts/meetings/notes changed since last time
 *
 * --max-calls stops a command after that many Monday calls, for a trial run. Every number is a positive whole number.
 * A flag a command doesn't take is refused, so a typo can't quietly widen a run.
 *
 * Reads .env.local. Monday and HubSpot are only ever read.
 */
import { closeDb } from "../src/server/db/postgres";
import { main } from "../src/server/mirror/cli-main";

// No condition decides whether this runs: this file exists to run the command, so it always does, however it was reached
// (a symlinked folder, a path without .ts). The commands are in src/server/mirror/cli-main.ts. A failure is printed
// and the process exits 1; nothing here can end quietly without having run.
main(process.argv.slice(2)).catch(async (e) => {
  console.error(e instanceof Error ? e.message : e);
  await closeDb();
  process.exit(1);
});
