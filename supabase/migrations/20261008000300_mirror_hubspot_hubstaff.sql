-- HubSpot and Hubstaff, mirrored read only. Properties stay JSON: typed views
-- come with the screens that need them.

create table mirror.hubspot_objects (
  object_type text not null check (object_type in ('deals', 'contacts', 'meetings', 'notes')),
  id bigint not null,
  properties jsonb not null default '{}'::jsonb,
  -- { "contacts": [ids], "deals": [ids] }
  associations jsonb not null default '{}'::jsonb,
  archived boolean not null default false,
  hs_created_at timestamptz,
  hs_updated_at timestamptz,
  synced_at timestamptz not null default now(),
  primary key (object_type, id)
);
create index hubspot_objects_updated on mirror.hubspot_objects (object_type, hs_updated_at desc);

create table mirror.hubspot_owners (
  id bigint primary key,
  user_id bigint,
  email text,
  first_name text,
  last_name text,
  teams jsonb not null default '[]'::jsonb,
  archived boolean not null default false,
  hs_updated_at timestamptz,
  synced_at timestamptz not null default now()
);

create table mirror.hubspot_pipelines (
  object_type text not null,
  id text not null,
  label text not null,
  display_order integer,
  archived boolean not null default false,
  stages jsonb not null default '[]'::jsonb,
  synced_at timestamptz not null default now(),
  primary key (object_type, id)
);

create table mirror.hubstaff_members (
  user_id bigint primary key,
  organization_id bigint not null,
  name text,
  email text,
  membership_status text,
  synced_at timestamptz not null default now()
);

-- One row per Hubstaff daily activity: a user, a project (and task) and a day in
-- the organisation's timezone.
create table mirror.hubstaff_daily_activities (
  id bigint primary key,
  organization_id bigint not null,
  user_id bigint not null,
  project_id bigint,
  task_id bigint,
  date date not null,
  tracked_seconds integer not null default 0,
  overall_seconds integer,
  idle_seconds integer,
  manual_seconds integer,
  billable_seconds integer,
  hs_updated_at timestamptz,
  synced_at timestamptz not null default now()
);
create index hubstaff_daily_user_date on mirror.hubstaff_daily_activities (user_id, date);

select launchpad.secure_schemas();
