-- Run ONCE per Supabase project, as the project owner (postgres), in the Supabase SQL editor.
-- It creates the login Launchpad runs as and the three schemas it owns, so the app and its
-- migrations can't create or touch anything else in the database (in production: Jerry's schemas).
--
-- It makes up the login's password and shows it once, in the result of the last statement.
-- Copy it straight into SUPABASE_DB_URL: Supabase > Connect > Transaction pooler, with the user
-- launchpad_app.<project-ref>. Lost it? As postgres: alter role launchpad_app with password '<new>';
-- Every column after the password should read true. If creates_only_in_own_schemas is false,
-- PUBLIC can still create objects in some schema (often public). Tell the project owner before
-- going on: it is fixed in their schema (revoke create on schema public from public), not here.

-- 1. The login, with a password nobody typed (two random UUIDs, 244 random bits).
select set_config('launchpad.bootstrap_password', replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''), false);
do $$
begin
  execute format('create role launchpad_app with login password %L', current_setting('launchpad.bootstrap_password'));
end
$$;

-- 2. The owner can act as launchpad_app (set role launchpad_app) to manage what it owns, but
--    doesn't inherit its rights. So a view or function the owner makes elsewhere, such as in
--    public, where Supabase grants anon access by default, can't read our tables by accident.
grant launchpad_app to postgres with inherit false, set true;

-- 3. Our three schemas, owned by launchpad_app. It gets no right to create schemas of its own,
--    so it can't plant one that another role's search_path would find.
create schema mirror authorization launchpad_app;
create schema launchpad authorization launchpad_app;
create schema launchpad_meta authorization launchpad_app;

-- 4. Show the password once, and check the setup.
select
  current_setting('launchpad.bootstrap_password') as launchpad_app_password,
  pg_has_role('postgres', 'launchpad_app', 'SET') as owner_can_set_role,
  not pg_has_role('postgres', 'launchpad_app', 'USAGE') as owner_does_not_inherit,
  not has_database_privilege('launchpad_app', current_database(), 'CREATE') as no_create_on_database,
  (select count(*) from pg_namespace
    where nspname in ('mirror', 'launchpad', 'launchpad_meta') and nspowner = 'launchpad_app'::regrole) = 3 as owns_three_schemas,
  not exists (
    select 1 from pg_namespace
    where nspname not in ('mirror', 'launchpad', 'launchpad_meta')
      and nspname !~ '^pg_(toast_)?temp_' -- temp schemas: a session's own counts as creatable, and is that session's alone
      and has_schema_privilege('launchpad_app', oid, 'CREATE')
  ) as creates_only_in_own_schemas;
