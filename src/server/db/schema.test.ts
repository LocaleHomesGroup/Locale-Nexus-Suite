import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { bootstrappedTestDb, migratedTestDb } from "./pglite";
import { readMigrations } from "./migrations";
import type { Db } from "./types";

let db: Db;
let close: (() => Promise<void>) | undefined;
let baseline: { db: Db; close: () => Promise<void> } | undefined;
before(async () => ({ db, close } = await migratedTestDb()));
after(async () => {
  await close?.(); // unset when a migration failed, and that failure is the one to read
  await baseline?.close();
});

test("schema: our three schemas exist", async () => {
  const rows = await db.query<{ nspname: string }>(
    "select nspname from pg_namespace where nspname in ('mirror', 'launchpad', 'launchpad_meta') order by 1",
  );
  assert.deepEqual(rows.map((r) => r.nspname), ["launchpad", "launchpad_meta", "mirror"]);
});

test("schema: tests run as launchpad_app, which can't create schemas, as on Supabase", async () => {
  const [row] = await db.query<{ role_name: string }>("select current_user as role_name");
  assert.equal(row.role_name, "launchpad_app");
  await assert.rejects(db.query("create schema planted"), /permission denied/);
});

test("schema: every table in our schemas has row level security on", async () => {
  const rows = await db.query<{ name: string }>(`
    select n.nspname || '.' || c.relname as name
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname in ('mirror', 'launchpad', 'launchpad_meta') and c.relkind in ('r', 'p') and not c.relrowsecurity`);
  assert.deepEqual(rows.map((r) => r.name), []);
});

test("schema: anon, authenticated and service_role can't reach our schemas, tables, views, sequences or routines", async () => {
  const rows = await db.query<{ what: string }>(`
    select r.rolname || ' has ' || p.priv || ' on schema ' || n.nspname as what
    from pg_namespace n cross join pg_roles r cross join (values ('USAGE'), ('CREATE')) as p(priv)
    where n.nspname in ('mirror', 'launchpad', 'launchpad_meta')
      and r.rolname in ('anon', 'authenticated', 'service_role')
      and has_schema_privilege(r.oid, n.oid, p.priv)
    union all
    select r.rolname || ' can touch ' || n.nspname || '.' || c.relname
    from pg_class c join pg_namespace n on n.oid = c.relnamespace cross join pg_roles r
    where n.nspname in ('mirror', 'launchpad', 'launchpad_meta') and c.relkind in ('r', 'p', 'v', 'm', 'f')
      and r.rolname in ('anon', 'authenticated', 'service_role')
      and has_table_privilege(r.oid, c.oid, 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
    union all
    select r.rolname || ' can use sequence ' || n.nspname || '.' || c.relname
    from pg_class c join pg_namespace n on n.oid = c.relnamespace cross join pg_roles r
    where n.nspname in ('mirror', 'launchpad', 'launchpad_meta') and c.relkind = 'S'
      and r.rolname in ('anon', 'authenticated', 'service_role')
      and has_sequence_privilege(r.oid, c.oid, 'USAGE,SELECT,UPDATE')
    union all
    select r.rolname || ' can run ' || n.nspname || '.' || p.proname
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace cross join pg_roles r
    where n.nspname in ('mirror', 'launchpad', 'launchpad_meta')
      and r.rolname in ('anon', 'authenticated', 'service_role')
      and has_function_privilege(r.oid, p.oid, 'EXECUTE')
    order by 1`);
  assert.deepEqual(rows.map((r) => r.what), []);
});

test("schema: every table with updated_at keeps it current", async () => {
  const rows = await db.query<{ name: string }>(`
    select n.nspname || '.' || c.relname as name
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    join pg_attribute a on a.attrelid = c.oid and a.attname = 'updated_at' and not a.attisdropped
    where n.nspname in ('mirror', 'launchpad', 'launchpad_meta') and c.relkind = 'r'
      and not exists (select 1 from pg_trigger t where t.tgrelid = c.oid and t.tgname = 'touch_updated_at')`);
  assert.deepEqual(rows.map((r) => r.name), []);
});

test("schema: every migration ends by calling secure_schemas()", () => {
  for (const m of readMigrations()) {
    // The last non-empty line, exactly: a commented-out call (`-- select ...`) doesn't count.
    const lastLine = m.sql.split("\n").map((l) => l.trimEnd()).filter((l) => l !== "").at(-1);
    assert.equal(
      lastLine,
      "select launchpad.secure_schemas();",
      `${m.version}_${m.name}.sql must end with the line: select launchpad.secure_schemas();`,
    );
  }
});

test("schema: the migrations create nothing outside our schemas", async () => {
  baseline = await bootstrappedTestDb();
  // Relations, routines, types and extensions anywhere but our schemas and the system's own.
  const outside = (d: Db) =>
    d.query<{ what: string }>(`
      select 'relation ' || n.nspname || '.' || c.relname || ' (' || c.relkind::text || ')' as what
      from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname not in ('mirror', 'launchpad', 'launchpad_meta', 'pg_catalog', 'information_schema', 'pg_toast')
      union all
      select 'routine ' || n.nspname || '.' || p.proname || ' (' || p.prokind::text || ')'
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname not in ('mirror', 'launchpad', 'launchpad_meta', 'pg_catalog', 'information_schema', 'pg_toast')
      union all
      select 'type ' || n.nspname || '.' || t.typname
      from pg_type t join pg_namespace n on n.oid = t.typnamespace
      where n.nspname not in ('mirror', 'launchpad', 'launchpad_meta', 'pg_catalog', 'information_schema', 'pg_toast')
      union all
      select 'extension ' || extname from pg_extension
      order by 1`);
  const before = (await outside(baseline.db)).map((r) => r.what);
  assert.ok(before.length > 0, "the baseline query should at least see plpgsql, or it is checking nothing");
  assert.deepEqual((await outside(db)).map((r) => r.what), before);
});
