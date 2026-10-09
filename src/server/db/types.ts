/**
 * The one database interface the server code uses. The app runs it on
 * postgres.js over Supabase's pooler; tests run it on PGlite in memory. Keep
 * SQL to what both accept: positional $1 parameters, JSON passed as text and
 * cast (`$1::jsonb`), `date` columns read back as text (`col::text`).
 */
export interface Db {
  query<T = Record<string, unknown>>(text: string, params?: readonly unknown[]): Promise<T[]>;
  /** Runs `fn` in one transaction: everything it does commits together, or none of it. */
  transaction<T>(fn: (tx: Db) => Promise<T>): Promise<T>;
}
