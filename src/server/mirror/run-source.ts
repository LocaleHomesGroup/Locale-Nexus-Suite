import type { Db } from "../db/types";
import type { ServerEnv } from "../env";
import { supabaseFileStore } from "../storage";
import { createHubSpotClient } from "./hubspot/client";
import { runHubSpotPass } from "./hubspot/pass";
import {
  createMondayClient,
  MondayCapReachedError,
  MondayDailyLimitError,
  MondayDeadlineError,
  type MondayClient,
  type MondayLedger,
} from "./monday/client";
import { downloadPendingFiles } from "./monday/files";
import { dbLedger } from "./monday/ledger";
import { runMondayPass, type MondayMode, type PassResult } from "./monday/passes";
import { beginRun, endRun, type Trigger } from "./runs";

/** One entry point for the CLI and the cron routes: a source, a mode, and the run's options. */
export interface RunSourceOptions {
  boardKey?: string;
  maxFiles?: number;
  /** Stop this run after this many Monday calls (for small trial runs). */
  maxCalls?: number;
  /** No Monday call, HubSpot request or download starts after this (the cron routes set it). */
  deadline?: Date;
  log?: (line: string) => void;
}

const failed = (error: string): PassResult => ({ status: "failed", calls: 0, seen: 0, changed: 0, note: null, error });

/**
 * An error's message, or else its code, or else its string form, so a failed result always says something. (Node's
 * failures to connect to a host with several addresses are AggregateErrors with no message and a code such as
 * ECONNREFUSED: a database outage would otherwise be a blank failure.)
 */
const messageOf = (e: unknown): string => {
  if (e instanceof Error && e.message) return e.message;
  const code = typeof e === "object" && e !== null ? (e as { code?: unknown }).code : undefined;
  return typeof code === "string" && code ? code : String(e);
};

/** A message added to an error that may hold one already. */
const addTo = (error: string | null, message: string): string => (error ? `${error}; ${message}` : message);

export function mondayClientFor(db: Db, env: ServerEnv, maxCalls?: number, deadline?: Date): MondayClient | null {
  if (!env.mondayToken) return null;
  const base = dbLedger(db, "monday", env.mondayDailyCallCap);
  let used = 0;
  const ledger: MondayLedger = {
    claim: async () => {
      // A trial run's own limit says so, rather than the day's cap message.
      if (maxCalls !== undefined && used >= maxCalls) {
        throw new MondayCapReachedError(`Stopped after --max-calls ${maxCalls}, as asked.`, "MAX_CALLS");
      }
      used += 1;
      return base.claim();
    },
    dailyLimitHit: () => base.dailyLimitHit(),
  };
  return createMondayClient({ token: env.mondayToken, ledger, deadline });
}

async function runFiles(db: Db, env: ServerEnv, monday: MondayClient, trigger: Trigger, max: number, deadline?: Date): Promise<PassResult> {
  const store = supabaseFileStore(env);
  if (!store) return failed("Storage isn't configured: set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
  const run = await beginRun(db, "monday", "files", trigger, 1500, "monday:files");
  if (!run) return { status: "skipped", calls: 0, seen: 0, changed: 0, note: "another files run is going", error: null };
  const before = monday.stats.calls;
  let result: PassResult;
  try {
    const r = await downloadPendingFiles({ db, monday, store }, { max, deadline });
    result = {
      status: r.failed > 0 ? "partial" : "ok",
      calls: monday.stats.calls - before,
      seen: r.downloaded + r.tooLarge + r.failed,
      changed: r.downloaded,
      note: `${r.downloaded} downloaded, ${r.tooLarge} too large, ${r.failed} failed, ${r.pending} waiting`,
      error: null,
    };
  } catch (e) {
    const calls = monday.stats.calls - before;
    if (e instanceof MondayDeadlineError) {
      // The same stops runMondayPass ends partial: the run was cut short, nothing is wrong, the next run carries on.
      result = { status: "partial", calls, seen: 0, changed: 0, note: "stopped at the run's time limit; the next run picks up from here", error: null };
    } else if (e instanceof MondayCapReachedError || e instanceof MondayDailyLimitError) {
      result = { status: "partial", calls, seen: 0, changed: 0, note: null, error: e.message };
    } else {
      result = { ...failed(messageOf(e)), calls };
    }
  }
  try {
    await endRun(db, run, {
      status: result.status,
      calls: result.calls,
      complexity: 0,
      seen: result.seen,
      changed: result.changed,
      note: result.note,
      error: result.error,
      watermarkBefore: null,
      watermarkAfter: null,
    });
  } catch (e) {
    // endRun frees the lease whatever happens, as runMondayPass relies on. The result still tells the caller what the run did.
    result = { ...result, error: addTo(result.error, `the run couldn't be recorded: ${messageOf(e)}`) };
  }
  return result;
}

const MONDAY_MODES = new Set(["backfill", "changes", "safety", "sweep", "files"]);

/**
 * Where each source and mode goes. A source added here may return its pass's promise as it is: runSource awaits this
 * whole function, so whatever it throws, and whatever its pass rejects with, is turned into a failed result there.
 */
async function dispatch(
  db: Db,
  env: ServerEnv,
  source: string,
  mode: string,
  trigger: Trigger,
  opts: RunSourceOptions,
): Promise<PassResult> {
  if (source === "monday") {
    if (!MONDAY_MODES.has(mode)) return failed(`unknown Monday mode "${mode}"`);
    const monday = mondayClientFor(db, env, opts.maxCalls, opts.deadline);
    if (!monday) return failed("MONDAY_API_TOKEN is not set");
    if (mode === "files") return runFiles(db, env, monday, trigger, opts.maxFiles ?? 200, opts.deadline);
    return runMondayPass(db, monday, mode as MondayMode, { trigger, boardKey: opts.boardKey, log: opts.log, deadline: opts.deadline });
  }
  if (source === "hubspot") {
    if (mode !== "changes") return failed(`unknown HubSpot mode "${mode}"`);
    if (!env.hubspotToken || !env.hubspotPortalId) return failed("HUBSPOT_TOKEN and HUBSPOT_PORTAL_ID must both be set");
    // The client throws here for a token or limit it can't use, and runSource turns that into a failed result.
    return runHubSpotPass(db, createHubSpotClient({ token: env.hubspotToken, deadline: opts.deadline }), env.hubspotPortalId, { trigger });
  }
  return failed(`unknown source "${source}"`);
}

/**
 * Runs one source in one mode and says how it went. It never rejects. Anything that throws on the way (a client the
 * settings can't make, Storage that can't be set up, a database that can't be reached) comes back as a failed result
 * carrying the message, so a route can answer with it and the CLI can print it.
 */
export async function runSource(
  db: Db,
  env: ServerEnv,
  source: string,
  mode: string,
  trigger: Trigger,
  opts: RunSourceOptions = {},
): Promise<PassResult> {
  try {
    // The await is what lets the catch see a rejection: a promise returned as it is would pass the catch by.
    return await dispatch(db, env, source, mode, trigger, opts);
  } catch (e) {
    return failed(messageOf(e));
  }
}
