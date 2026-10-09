-- Launchpad's own tables and functions. They sit beside anything else in the database
-- (Jerry's app, config, core, ops, api and hr in production) and touch none of it.
-- The schemas (mirror, launchpad and launchpad_meta) come from scripts/db/bootstrap.sql, owned by
-- launchpad_app, which is also the login that runs every migration. No migration creates a schema:
-- launchpad_app has no CREATE on the database.
-- Spec: docs/superpowers/specs/2026-10-08-supabase-mirror-design.md

-- Only a schema's owner can comment on it, so this fails loudly if a schema of the same name already exists and belongs to someone else.
comment on schema mirror is 'Read-only copies of Monday, HubSpot and Hubstaff. Written only by the sync code.';
comment on schema launchpad is 'Data Launchpad owns, and the views the app reads.';

-- Keeps updated_at current on every table that has one. secure_schemas() attaches it.
create or replace function launchpad.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end
$$;

-- Every migration ends by calling this. In all three of our schemas it turns row level security
-- on for every table, takes every privilege on the schemas, tables, views, routines and sequences
-- away from public, anon, authenticated and service_role, and attaches touch_updated_at wherever
-- there is an updated_at column. Safe to run any number of times.
create or replace function launchpad.secure_schemas() returns void
language plpgsql as $$
declare
  r record;
begin
  execute 'revoke all on schema mirror, launchpad, launchpad_meta from public, anon, authenticated, service_role';
  execute 'revoke all on all tables in schema mirror, launchpad, launchpad_meta from public, anon, authenticated, service_role';
  execute 'revoke all on all routines in schema mirror, launchpad, launchpad_meta from public, anon, authenticated, service_role';
  execute 'revoke all on all sequences in schema mirror, launchpad, launchpad_meta from public, anon, authenticated, service_role';
  for r in
    select n.nspname as schema_name, c.relname as table_name
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname in ('mirror', 'launchpad', 'launchpad_meta') and c.relkind in ('r', 'p')
  loop
    execute format('alter table %I.%I enable row level security', r.schema_name, r.table_name);
  end loop;
  for r in
    select n.nspname as schema_name, c.relname as table_name
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    join pg_attribute a on a.attrelid = c.oid and a.attname = 'updated_at' and not a.attisdropped
    where n.nspname in ('mirror', 'launchpad', 'launchpad_meta') and c.relkind = 'r'
      and not exists (select 1 from pg_trigger t where t.tgrelid = c.oid and t.tgname = 'touch_updated_at')
  loop
    execute format(
      'create trigger touch_updated_at before update on %I.%I for each row execute function launchpad.touch_updated_at()',
      r.schema_name, r.table_name
    );
  end loop;
end
$$;

select launchpad.secure_schemas();
