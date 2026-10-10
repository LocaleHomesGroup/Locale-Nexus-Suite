import type { Catalogue, HsBuilder, ImportRecord, ImportTrigger, ImportWarning } from "@/data/homescope";
import type { Db } from "../db/types";

export interface SavedImport {
  importId: string;
  /** Builders that got a new current version. */
  changed: string[];
  /** Builders no longer on Monday, no longer current. */
  retired: string[];
}

/**
 * Saves one import in a single transaction: the run, a new current version for each
 * builder whose catalogue changed, and the retirement of any builder gone from Monday.
 * An unchanged builder keeps its row, so running the import again adds nothing.
 */
export async function saveImport(
  db: Db,
  input: { builders: HsBuilder[]; warnings: ImportWarning[]; calls: number; trigger: ImportTrigger },
): Promise<SavedImport> {
  if (input.builders.length === 0) {
    throw new Error("No builders to save, so nothing was imported");
  }
  return db.transaction(async (tx) => {
    const [run] = await tx.query<{ id: string }>(
      "insert into launchpad.homescope_imports (trigger, status, calls, builders, warnings) values ($1, 'ok', $2, $3, $4::jsonb) returning id",
      [input.trigger, input.calls, input.builders.length, JSON.stringify(input.warnings)],
    );
    const changed: string[] = [];
    for (const b of input.builders) {
      const data = JSON.stringify(b);
      const [now] = await tx.query<{ same: boolean }>(
        "select data = $2::jsonb as same from launchpad.homescope_catalogues where builder = $1 and is_current",
        [b.name, data],
      );
      if (now?.same) continue;
      await tx.query("update launchpad.homescope_catalogues set is_current = false where builder = $1 and is_current", [b.name]);
      await tx.query(
        "insert into launchpad.homescope_catalogues (builder, captured_at, source, data, is_current, import_id) values ($1, now(), 'monday', $2::jsonb, true, $3)",
        [b.name, data, run.id],
      );
      changed.push(b.name);
    }
    const retired = await tx.query<{ builder: string }>(
      `update launchpad.homescope_catalogues set is_current = false
       where is_current and builder not in (select jsonb_array_elements_text($1::jsonb))
       returning builder`,
      [JSON.stringify(input.builders.map((b) => b.name))],
    );
    await tx.query("update launchpad.homescope_imports set changed = $2 where id = $1", [run.id, changed.length + retired.length]);
    return { importId: run.id, changed, retired: retired.map((r) => r.builder).sort() };
  });
}

/** A run that saved nothing, with why. */
export async function recordFailedImport(db: Db, input: { error: string; calls: number; trigger: ImportTrigger }): Promise<void> {
  await db.query("insert into launchpad.homescope_imports (trigger, status, calls, error) values ($1, 'failed', $2, $3)", [
    input.trigger,
    input.calls,
    input.error,
  ]);
}

/** Every builder's current catalogue from Monday, by name (snapshot rows never count), as of the last good import. Null when there's none. */
export async function loadCatalogue(db: Db): Promise<Catalogue | null> {
  const rows = await db.query<{ data: HsBuilder; ms: number }>(
    "select data, (extract(epoch from captured_at) * 1000)::float8 as ms from launchpad.homescope_catalogues where is_current and source = 'monday'",
  );
  if (!rows.length) return null;
  const [run] = await db.query<{ ms: number | null }>(
    "select (extract(epoch from max(finished_at)) * 1000)::float8 as ms from launchpad.homescope_imports where status = 'ok'",
  );
  const ms = run?.ms ?? Math.max(...rows.map((r) => r.ms));
  return {
    builders: rows.map((r) => r.data).sort((a, b) => a.name.localeCompare(b.name)),
    source: "monday",
    asOf: new Date(ms).toISOString(),
  };
}

interface ImportRow {
  id: string;
  ms: number;
  trigger: ImportRecord["trigger"];
  status: ImportRecord["status"];
  calls: number;
  builders: number;
  changed: number;
  warnings: ImportWarning[];
  error: string | null;
}

/** The latest run, good or failed. */
export async function loadLastImport(db: Db): Promise<ImportRecord | null> {
  const [r] = await db.query<ImportRow>(
    `select id, (extract(epoch from finished_at) * 1000)::float8 as ms, trigger, status, calls, builders, changed, warnings, error
     from launchpad.homescope_imports order by finished_at desc limit 1`,
  );
  if (!r) return null;
  const { ms, ...rest } = r;
  return { ...rest, finishedAt: new Date(ms).toISOString() };
}
