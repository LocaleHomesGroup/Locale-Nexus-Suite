import { closeDb, getDb } from "../db/postgres";
import type { Db } from "../db/types";
import { readServerEnv, type ServerEnv } from "../env";
import { BUCKETS, supabaseFileStore } from "../storage";
import { checkFlags, flagValue, wholeNumberFlag } from "./cli-args";
import { readStatus, repsLines, statusLines } from "./cli-report";
import { discoverBoards, discoverWorkspaces } from "./monday/discover";
import { MAX_FILE_BYTES } from "./monday/files";
import type { PassResult } from "./monday/passes";
import { matchReps, runSetup } from "./monday/setup";
import { mondayClientFor, runSource } from "./run-source";

/**
 * The mirror CLI: what `npm run mirror -- <command>` runs. scripts/mirror.ts is the entry point and holds the usage
 * text; the commands live here so that tests can import them, and so that the entry has no condition to get wrong: it
 * always runs `main`. Add a command as a case in the switch below, and its usage line to the comment in scripts/mirror.ts.
 */

/** Stops the command with this message: the entry point prints it to stderr and exits 1. */
function fail(message: string): never {
  throw new Error(message);
}

function printResult(r: PassResult) {
  console.log(`${r.status}: ${r.calls} call(s), ${r.seen} seen, ${r.changed} changed${r.note ? `. ${r.note}` : ""}`);
  if (r.error) console.error(`error: ${r.error}`);
}

async function printStatus(db: Db, cap: number) {
  for (const line of statusLines(await readStatus(db, cap), new Date())) console.log(line);
}

/**
 * Runs one command. `injected` is for tests, which bring a database and settings of their own: without it the command
 * reads the environment, opens the pool from SUPABASE_DB_URL and closes it afterwards.
 */
export async function main(argv: string[], injected?: { db: Db; env: ServerEnv }): Promise<void> {
  const [command = "status", ...args] = argv;
  // Flags are checked here, at once, before the database or Monday is touched: a flag the command doesn't take, a limit
  // that isn't a positive whole number, or a value left out is refused, because quietly dropping it would run more than
  // was asked.
  checkFlags(command, args);
  const maxCalls = wholeNumberFlag(args, "max-calls");
  const maxFiles = wholeNumberFlag(args, "max-files");
  const workspace = wholeNumberFlag(args, "workspace");
  const board = flagValue(args, "board");
  const jerryConfig = flagValue(args, "jerry-config");

  const env = injected?.env ?? readServerEnv();
  const db = injected?.db ?? getDb();
  if (!db) fail("SUPABASE_DB_URL is not set. Put it in .env.local (see .env.example).");

  try {
    switch (command) {
      case "status":
        await printStatus(db, env.mondayDailyCallCap);
        break;
      case "buckets": {
        const store = supabaseFileStore(env);
        if (!store) fail("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY first.");
        await store.ensureBucket(BUCKETS.mondayFiles, MAX_FILE_BYTES);
        await store.ensureBucket(BUCKETS.launchpadFiles, MAX_FILE_BYTES);
        console.log(`buckets ready: ${BUCKETS.mondayFiles}, ${BUCKETS.launchpadFiles}`);
        break;
      }
      case "discover": {
        const monday = mondayClientFor(db, env, maxCalls) ?? fail("MONDAY_API_TOKEN is not set.");
        await discoverWorkspaces(db, monday);
        const workspaces = await db.query<{ id: number; name: string }>("select id, name from mirror.monday_workspaces order by name");
        for (const w of workspaces) console.log(`workspace ${w.id}  ${w.name}`);
        if (workspace !== undefined) {
          await discoverBoards(db, monday, [workspace]);
          const boards = await db.query<{ id: number; name: string; type: string }>(
            "select id, name, type from mirror.monday_boards where workspace_id = $1 order by name",
            [workspace],
          );
          for (const b of boards) console.log(`  board ${b.id}  ${b.name}  (${b.type})`);
        }
        console.log(`${monday.stats.calls} Monday call(s)`);
        break;
      }
      case "setup": {
        const monday = mondayClientFor(db, env, maxCalls) ?? fail("MONDAY_API_TOKEN is not set.");
        const report = await runSetup(db, monday, { jerryConfigPath: jerryConfig ?? null, log: console.log });
        console.log(`boards enabled: ${report.boardsEnabled.join(", ") || "none"}`);
        if (report.notVisible.length) console.log(`not visible to this token: ${report.notVisible.join(", ")}`);
        console.log(`fields mapped: ${report.fieldsMapped}`);
        if (report.unknownFields.length) console.log(`fields in Jerry's config we don't read: ${report.unknownFields.join(", ")}`);
        console.log(`Exclusive Land, matched by title: ${report.lotFields.map((f) => `${f.fieldKey} <- ${f.columnId}`).join(", ") || "nothing"}`);
        if (report.lotUnmatched.length) console.log(`Exclusive Land columns to place by hand: ${report.lotUnmatched.join(", ")}`);
        console.log(`${monday.stats.calls} Monday call(s)`);
        break;
      }
      case "reps":
        for (const line of repsLines(await matchReps(db))) console.log(line);
        break;
      case "backfill":
      case "changes":
      case "safety":
      case "sweep":
      case "files": {
        const r = await runSource(db, env, "monday", command, "cli", { boardKey: board, maxCalls, maxFiles, log: console.log });
        printResult(r);
        if (r.status === "failed") process.exitCode = 1;
        break;
      }
      case "hubspot": {
        const r = await runSource(db, env, "hubspot", "changes", "cli");
        printResult(r);
        if (r.status === "failed") process.exitCode = 1;
        break;
      }
      default:
        fail(`Unknown command "${command}". See the comment at the top of scripts/mirror.ts.`);
    }
  } finally {
    // A database a test brought is the test's to close. The pool this script opened is closed here.
    if (!injected) await closeDb();
  }
}
