import postgres from "postgres";
import type { Db } from "./types";
import { readServerEnv } from "../env";

type Sql = postgres.Sql | postgres.TransactionSql;

export function postgresDb(sql: Sql): Db {
  return {
    query: async <T>(text: string, params: readonly unknown[] = []) =>
      (await sql.unsafe(text, [...params] as never)) as unknown as T[],
    transaction: async <T>(fn: (tx: Db) => Promise<T>): Promise<T> => {
      // Only the pool has begin(): start a transaction.
      const pool = sql as postgres.Sql;
      if (typeof pool.begin === "function") return pool.begin((tx) => fn(postgresDb(tx))) as unknown as Promise<T>;
      // Only a transaction handle has savepoint(): already inside one, so join it, as pgliteDb does.
      if (typeof (sql as postgres.TransactionSql).savepoint === "function") return fn(postgresDb(sql));
      // Anything else, such as the handle reserve() gives, would run fn outside any transaction.
      throw new Error("transaction() needs the pool or a transaction handle");
    },
  };
}

/** postgres.js settings for Supabase's transaction pooler. Exported for its test. */
export const POOL_OPTIONS = {
  prepare: false, // Supavisor's transaction mode can't keep prepared statements
  // Supabase's pooler takes TLS: never send rows in the clear. "require" encrypts without checking
  // the certificate; checking it needs the project's CA certificate (a later step).
  ssl: "require" as const,
  max: 5,
  idle_timeout: 20,
  connect_timeout: 10,
  onnotice: () => {},
  types: {
    // int8 as a JS number, as PGlite returns it. Monday and HubSpot ids fit in 2^53; anything
    // bigger is refused, not rounded.
    int8: {
      to: 20,
      from: [20],
      serialize: (x: number) => String(x),
      parse: (x: string) => {
        const n = Number(x);
        if (!Number.isSafeInteger(n)) throw new Error(`int8 ${x} is too large for a JS number`);
        return n;
      },
    },
    // Our SQL passes JSON as text and casts it (`$1::jsonb`), which PGlite takes as it
    // is. postgres.js's default would JSON.stringify that text again and store a string.
    json: {
      to: 3802,
      from: [114, 3802],
      serialize: (x: unknown) => (typeof x === "string" ? x : JSON.stringify(x)),
      parse: (x: string) => JSON.parse(x),
    },
  },
};

const cache = globalThis as unknown as { __launchpadSql?: postgres.Sql };

/** The app's pool, or null when SUPABASE_DB_URL isn't set (the screens keep sample data). */
export function getDb(): Db | null {
  const url = readServerEnv().dbUrl;
  if (!url) return null;
  if (!cache.__launchpadSql) {
    try {
      cache.__launchpadSql = postgres(url, POOL_OPTIONS);
    } catch {
      // Node's URL error keeps the whole URL, password included, in its `input`, so it
      // never leaves here: no cause, no URL text.
      throw new Error(
        "SUPABASE_DB_URL isn't a valid connection string: check the port, and URL-encode any @, #, / or : in the password.",
      );
    }
  }
  return postgresDb(cache.__launchpadSql);
}

/** Ends the pool, for scripts that must exit. */
export async function closeDb(): Promise<void> {
  await cache.__launchpadSql?.end({ timeout: 5 });
  cache.__launchpadSql = undefined;
}
