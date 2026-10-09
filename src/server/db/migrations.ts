import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/** One file in supabase/migrations: `<14-digit version>_<name>.sql`. */
export interface MigrationFile {
  version: string;
  name: string;
  sql: string;
  checksum: string;
}

export interface AppliedMigration {
  version: string;
  checksum: string;
}

export interface MigrationPlan {
  /** Not applied yet, in order. */
  pending: MigrationFile[];
  /** Applied, but the file has changed since: the runner refuses to go on. */
  changed: MigrationFile[];
  /** Applied versions with no file any more. */
  unknown: string[];
}

export const MIGRATIONS_DIR = join(process.cwd(), "supabase", "migrations");

const FILE_NAME = /^(\d{14})_([a-z0-9_]+)\.sql$/;

/** sha256 of the file, with Windows line endings evened out so a checkout can't change it. */
export const checksum = (sql: string): string =>
  createHash("sha256").update(sql.replace(/\r\n/g, "\n")).digest("hex");

/** Launchpad's own migration history, in its own schema. The runner makes it before applying anything. */
export const META_SQL = `
  create table if not exists launchpad_meta.migrations (
    version text primary key,
    name text not null,
    checksum text not null,
    applied_at timestamptz not null default now()
  );
  alter table launchpad_meta.migrations enable row level security;
  revoke all on schema launchpad_meta from public, anon, authenticated, service_role;
  revoke all on table launchpad_meta.migrations from public, anon, authenticated, service_role;
`;

export function readMigrations(dir: string = MIGRATIONS_DIR): MigrationFile[] {
  const files = readdirSync(dir)
    .filter((f) => FILE_NAME.test(f))
    .sort()
    .map((f) => {
      const [, version, name] = FILE_NAME.exec(f)!;
      const sql = readFileSync(join(dir, f), "utf8");
      return { version, name, sql, checksum: checksum(sql) };
    });
  const names = new Map<string, string>();
  for (const f of files) {
    const other = names.get(f.version);
    if (other !== undefined) throw new Error(`two migrations share version ${f.version}: ${other} and ${f.name}`);
    names.set(f.version, f.name);
  }
  return files;
}

export function planMigrations(files: MigrationFile[], applied: AppliedMigration[]): MigrationPlan {
  const appliedSums = new Map(applied.map((a) => [a.version, a.checksum]));
  const known = new Set(files.map((f) => f.version));
  return {
    pending: files.filter((f) => !appliedSums.has(f.version)),
    changed: files.filter((f) => appliedSums.has(f.version) && appliedSums.get(f.version) !== f.checksum),
    unknown: applied.map((a) => a.version).filter((v) => !known.has(v)),
  };
}
