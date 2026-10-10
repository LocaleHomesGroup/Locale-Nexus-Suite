import pg from "pg";
import type { Db } from "./types";
import { readServerEnv } from "../env";

/**
 * The app's database client: node-postgres over Supabase's pooler.
 *
 * Why node-postgres and not postgres.js (live run, 2026-10-10): postgres.js sends a query that has
 * parameters as Parse + Describe + Flush and waits for the reply before it binds. Through Supabase's
 * pooler (Supavisor), on a connection that has already run a transaction, that reply never comes:
 * the query, and the page waiting on it, hang until the server's 120 s statement timeout. That was
 * reproduced every time with one pooled connection. node-postgres sends Parse, Bind, Execute and Sync
 * together, which passes through both pooler modes.
 */

/** A pool: what pgDb needs from pg.Pool. */
interface PoolLike {
  connect(): Promise<pg.PoolClient>;
}

/** One client inside a transaction: queries alone. */
interface ClientLike {
  query(text: string, values?: unknown[]): Promise<{ rows: unknown[] }>;
}

const INT8 = 20;
const INT8_ARRAY = 1016;

/** int8 as a JS number, as PGlite returns it. Monday and HubSpot ids fit in 2^53; anything bigger is refused, not rounded. */
function parseInt8(text: string): number {
  const n = Number(text);
  if (!Number.isSafeInteger(n)) throw new Error(`int8 ${text} is too large for a JS number`);
  return n;
}

/**
 * Type parsers for this pool only: pg.types.setTypeParser would change them for every pool in the process.
 * node-postgres already parses json and jsonb, and passes a string parameter through unchanged, so JSON
 * text cast in SQL (`$1::jsonb`) reaches the database as it does on PGlite.
 */
const TYPES = {
  getTypeParser: ((oid: number, format?: "text" | "binary") => {
    if (oid === INT8) return parseInt8;
    if (oid === INT8_ARRAY) {
      const strings = pg.types.getTypeParser(INT8_ARRAY as never, "text") as (text: string) => (string | null)[];
      return (text: string) => strings(text).map((x) => (x === null ? null : parseInt8(x)));
    }
    return pg.types.getTypeParser(oid, format as "text");
  }) as pg.CustomTypesConfig["getTypeParser"],
};

/** node-postgres settings for Supabase's pooler. Exported for its test. */
export const POOL_OPTIONS = {
  // Supabase's pooler takes TLS: never send rows in the clear. This encrypts without checking the
  // certificate; checking it needs the project's CA certificate (a later step). checkDbUrl refuses a URL
  // that sets its own ssl options, which node-postgres would otherwise let override these.
  ssl: { rejectUnauthorized: false },
  max: 5,
  idleTimeoutMillis: 20_000,
  connectionTimeoutMillis: 15_000,
  keepAlive: true,
  // node-postgres passes 0, which leaves the OS default (two hours on Windows); a minute, as postgres.js had.
  keepAliveInitialDelayMillis: 60_000,
  // A query that hasn't answered in 60 s fails and its connection is closed, so nothing waits forever.
  // A page load's reads use a shorter one (getDb's queryTimeoutMs) and try once more.
  query_timeout: 60_000,
  types: TYPES,
} satisfies pg.PoolConfig;

/** node-postgres's error when a query timeout fires. The statement is still running on that connection. */
export const isQueryTimeout = (e: unknown): boolean => e instanceof Error && e.message === "Query read timeout";

/**
 * The server refused a statement: the connection itself is fine and can be reused. Not a FATAL or PANIC
 * error: the server sends those as it closes the session, so that connection is about to die.
 */
const serverRefused = (e: unknown) => e instanceof pg.DatabaseError && e.severity !== "FATAL" && e.severity !== "PANIC";

const asError = (e: unknown) => (e instanceof Error ? e : new Error(String(e)));

/**
 * Runs fn on one checked-out client and gives it back. A client the pool hands out has no error listener
 * of its own, so a connection that drops while it's out would otherwise throw an uncaught error: it's
 * caught here, and that client is closed rather than reused.
 */
async function withClient<T>(pool: PoolLike, fn: (client: pg.PoolClient, markBroken: (e: Error) => void) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  let broken: Error | undefined;
  const markBroken = (e: Error) => {
    broken ??= e;
  };
  client.on("error", markBroken);
  try {
    return await fn(client, markBroken);
  } finally {
    client.off("error", markBroken);
    client.release(broken);
  }
}

/**
 * A Db over a pool, or over one client inside a transaction (inTransaction). queryTimeoutMs, when given,
 * replaces the pool's query timeout for this Db's own statements (not those inside a transaction).
 */
export function pgDb(q: PoolLike | ClientLike, inTransaction = false, queryTimeoutMs?: number): Db {
  const run = async (text: string, params: readonly unknown[]) => {
    // node-postgres sends a statement without parameters as a simple query: one statement per string,
    // as PGlite requires (several would come back with no rows).
    const values = [...params];
    if (inTransaction) return (await (q as ClientLike).query(text, values)).rows;
    return withClient(q as PoolLike, async (client, markBroken) => {
      try {
        const result = queryTimeoutMs
          ? await client.query({ text, values, query_timeout: queryTimeoutMs } as pg.QueryConfig)
          : await client.query(text, values);
        return result.rows;
      } catch (e) {
        // A refused statement leaves the connection usable; anything else (a timeout, a drop) doesn't.
        if (!serverRefused(e)) markBroken(asError(e));
        throw e;
      }
    });
  };
  return {
    query: async <T>(text: string, params: readonly unknown[] = []) => (await run(text, params)) as T[],
    transaction: async <T>(fn: (tx: Db) => Promise<T>): Promise<T> => {
      // Already inside one: join it, as pgliteDb does.
      if (inTransaction) return fn(pgDb(q, true));
      return withClient(q as PoolLike, async (client, markBroken) => {
        await client.query("begin").catch((e: unknown) => {
          if (!serverRefused(e)) markBroken(asError(e));
          throw e;
        });
        try {
          const result = await fn(pgDb({ query: (text, values) => client.query(text, values) }, true));
          await client.query("commit");
          return result;
        } catch (e) {
          if (isQueryTimeout(e)) {
            // The timed-out statement still holds the client, so a rollback would only wait as long again.
            // Closing the connection ends the transaction instead.
            markBroken(asError(e));
          } else {
            await client.query("rollback").catch((rollbackFailed: unknown) => markBroken(asError(rollbackFailed)));
          }
          throw e;
        }
      });
    },
  };
}

const URL_MESSAGE =
  "SUPABASE_DB_URL isn't a valid connection string: check the port, and URL-encode any @, #, / or : in the password.";

/**
 * Checks SUPABASE_DB_URL before any client is built, with messages that quote none of it (Node's URL error
 * keeps the whole URL, password included, in its `input`). Refuses a URL that sets its own TLS options:
 * node-postgres lets those override POOL_OPTIONS.ssl, so `?sslmode=disable` would send rows in the clear.
 */
export function checkDbUrl(url: string): void {
  let parsed: URL;
  try {
    parsed = new URL(url);
    decodeURIComponent(parsed.username);
    decodeURIComponent(parsed.password);
  } catch {
    throw new Error(URL_MESSAGE);
  }
  for (const key of ["ssl", "sslmode", "sslcert", "sslkey", "sslrootcert", "sslnegotiation"]) {
    if (parsed.searchParams.has(key)) {
      throw new Error(`Remove ?${key}= from SUPABASE_DB_URL: Launchpad sets TLS itself.`);
    }
  }
}

const cache = globalThis as unknown as { __launchpadPool?: pg.Pool };

/**
 * The app's pool, or null when SUPABASE_DB_URL isn't set (the screens keep sample data). queryTimeoutMs gives
 * this Db's statements their own timeout on the same pool, for reads that should fail fast and retry.
 */
export function getDb(options: { queryTimeoutMs?: number } = {}): Db | null {
  const url = readServerEnv().dbUrl;
  if (!url) return null;
  if (!cache.__launchpadPool) {
    checkDbUrl(url);
    const pool = new pg.Pool({ ...POOL_OPTIONS, connectionString: url });
    // An idle connection that fails must not crash the process; the pool replaces it.
    pool.on("error", (e) => console.error("[db] an idle database connection failed:", e.message));
    cache.__launchpadPool = pool;
  }
  return pgDb(cache.__launchpadPool, false, options.queryTimeoutMs);
}

/** Ends the pool, for scripts that must exit. */
export async function closeDb(): Promise<void> {
  const pool = cache.__launchpadPool;
  cache.__launchpadPool = undefined;
  await pool?.end();
}
