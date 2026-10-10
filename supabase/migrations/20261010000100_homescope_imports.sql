-- HomeScope's catalogue, imported from the "Estimation Source Data" boards in Monday's
-- HomeScope workspace (Meeting4, decision 5). One row per run: when it finished, how
-- many Monday calls it made, how many builders changed, and what Ops should fix on the
-- boards. A failed run has its error and saved nothing.
create table launchpad.homescope_imports (
  id uuid primary key default gen_random_uuid(),
  finished_at timestamptz not null default now(),
  trigger text not null check (trigger in ('cli', 'screen')),
  status text not null check (status in ('ok', 'failed')),
  calls integer not null default 0 check (calls >= 0),
  builders integer not null default 0 check (builders >= 0),
  changed integer not null default 0 check (changed >= 0),
  warnings jsonb not null default '[]'::jsonb check (jsonb_typeof(warnings) = 'array'),
  error text,
  constraint homescope_imports_error_when_failed check ((status = 'failed') = (error is not null))
);
create index homescope_imports_latest on launchpad.homescope_imports (finished_at desc);

-- Which run wrote each catalogue version. Snapshot rows have none.
alter table launchpad.homescope_catalogues
  add column import_id uuid references launchpad.homescope_imports (id);

select launchpad.secure_schemas();
