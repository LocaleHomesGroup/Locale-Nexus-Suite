import { PGlite } from "@electric-sql/pglite";
import type { Db } from "./types";
import { META_SQL, readMigrations } from "./migrations";

/** What scripts/db/bootstrap.sql sets up on Supabase, for PGlite: Supabase's roles, our login and its schemas. */
const BOOTSTRAP = `
  do $$ begin
    if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
    if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
    if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin; end if;
    if not exists (select 1 from pg_roles where rolname = 'launchpad_app') then create role launchpad_app nologin; end if;
  end $$;
  create schema mirror authorization launchpad_app;
  create schema launchpad authorization launchpad_app;
  create schema launchpad_meta authorization launchpad_app;
  set role launchpad_app;
`;

interface Queryable {
  query<T>(text: string, params?: unknown[]): Promise<{ rows: T[] }>;
}

/** Wraps PGlite (or a PGlite transaction) as a `Db`. Tests only. */
export function pgliteDb(pg: Queryable & { transaction?: PGlite["transaction"] }): Db {
  return {
    query: async <T>(text: string, params: readonly unknown[] = []) => (await pg.query<T>(text, [...params])).rows,
    transaction: async <T>(fn: (tx: Db) => Promise<T>): Promise<T> => {
      if (!pg.transaction) return fn(pgliteDb(pg)); // already inside one
      return pg.transaction((tx) => fn(pgliteDb(tx)));
    },
  };
}

/**
 * A fresh PGlite as Supabase has it once bootstrap.sql and the runner's first step are done: roles,
 * schemas and the history table. Everything after this runs as launchpad_app.
 */
async function bootstrapped(): Promise<PGlite> {
  const pg = new PGlite();
  try {
    await pg.exec(BOOTSTRAP);
    await pg.exec(META_SQL);
    return pg;
  } catch (e) {
    await pg.close(); // left open, a failed instance holds the test process for about ten seconds
    throw e;
  }
}

/**
 * A fresh in-memory database with the bootstrap and the history table applied, and no migrations. Tests only.
 * Tests run as launchpad_app. In a test, `reset role` goes back to PGlite's superuser, not to launchpad_app:
 * switch back with `set role launchpad_app`.
 */
export async function bootstrappedTestDb(): Promise<{ db: Db; close: () => Promise<void> }> {
  const pg = await bootstrapped();
  return { db: pgliteDb(pg), close: () => pg.close() };
}

/** A fresh in-memory database with every migration applied, as launchpad_app. Takes about a second: share one per test file. */
export async function migratedTestDb(): Promise<{ db: Db; close: () => Promise<void> }> {
  const migrations = readMigrations(); // before the database exists, so a bad folder fails at once
  const pg = await bootstrapped();
  for (const m of migrations) {
    try {
      await pg.exec(m.sql);
    } catch (e) {
      await pg.close();
      throw new Error(`migration ${m.version}_${m.name} failed: ${(e as Error).message}`);
    }
  }
  return { db: pgliteDb(pg), close: () => pg.close() };
}
