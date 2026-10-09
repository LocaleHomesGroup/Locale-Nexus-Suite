-- Monday, mirrored generically: boards, columns, groups, items with every column
-- value as JSON, updates, file assets and users. Nothing here knows a column id;
-- monday_field_map (filled at setup, never committed) names the columns we read.

create table mirror.monday_workspaces (
  id bigint primary key,
  name text not null,
  kind text,
  sync_enabled boolean not null default false,
  synced_at timestamptz not null default now()
);

create table mirror.monday_boards (
  id bigint primary key,
  workspace_id bigint references mirror.monday_workspaces (id),
  name text not null,
  type text not null default 'board',
  state text not null default 'active' check (state in ('active', 'archived', 'deleted')),
  -- Set on a subitems board: the board whose items own its subitems.
  parent_board_id bigint references mirror.monday_boards (id),
  -- Our labels, set by setup. A subitems board's key is '<parent key>:subitems'.
  board_key text unique,
  purpose text check (purpose in ('sales', 'construction', 'handed_over', 'exclusive_land', 'models', 'other')),
  division text check (division in ('homes', 'wealth')),
  region text check (region in ('WA', 'VIC', 'QLD', 'NSW', 'SA', 'NT', 'TAS', 'ACT')),
  sync_enabled boolean not null default false,
  monday_updated_at timestamptz,
  synced_at timestamptz not null default now()
);

create table mirror.monday_columns (
  board_id bigint not null references mirror.monday_boards (id) on delete cascade,
  id text not null,
  title text not null,
  type text not null,
  position integer,
  synced_at timestamptz not null default now(),
  primary key (board_id, id)
);

create table mirror.monday_groups (
  board_id bigint not null references mirror.monday_boards (id) on delete cascade,
  id text not null,
  title text not null,
  color text,
  position text,
  archived boolean not null default false,
  deleted boolean not null default false,
  synced_at timestamptz not null default now(),
  primary key (board_id, id)
);

create table mirror.monday_items (
  id bigint primary key,
  board_id bigint not null references mirror.monday_boards (id),
  group_id text,
  -- Set on a subitem. No foreign key: a subitem can arrive before its parent.
  parent_item_id bigint,
  name text not null,
  state text not null default 'active' check (state in ('active', 'archived', 'deleted')),
  creator_id bigint,
  monday_created_at timestamptz,
  monday_updated_at timestamptz not null,
  -- { "<column id>": { "type", "text", "value", "label"?, "index"?, "date"?, "display_value"?, "linked_item_ids"? } }
  column_values jsonb not null default '{}'::jsonb,
  first_seen_at timestamptz not null default now(),
  synced_at timestamptz not null default now(),
  -- When we learned it was archived, deleted or gone. Null while it is live.
  removed_at timestamptz
);
create index monday_items_board on mirror.monday_items (board_id) where removed_at is null;
create index monday_items_parent on mirror.monday_items (parent_item_id) where parent_item_id is not null;

create table mirror.monday_updates (
  id bigint primary key,
  item_id bigint not null,
  creator_id bigint,
  body text,
  text_body text,
  monday_created_at timestamptz,
  monday_updated_at timestamptz,
  synced_at timestamptz not null default now()
);
create index monday_updates_item on mirror.monday_updates (item_id);

create table mirror.monday_assets (
  id bigint primary key,
  item_id bigint not null,
  -- The file column it sits in, or null when it was attached to an update.
  column_id text,
  update_id bigint,
  name text not null,
  file_extension text,
  file_size bigint,
  monday_created_at timestamptz,
  -- Where its bytes are in the monday-files bucket. Null until downloaded.
  storage_path text unique,
  sha256 text check (sha256 is null or sha256 ~ '^[0-9a-f]{64}$'),
  downloaded_at timestamptz,
  download_attempts smallint not null default 0,
  download_error text,
  removed_at timestamptz,
  synced_at timestamptz not null default now()
);
create index monday_assets_item on mirror.monday_assets (item_id);
-- Serves the downloader's queue: files not yet fetched and not failed for good, newest first.
create index monday_assets_pending on mirror.monday_assets (monday_created_at desc nulls last, id)
  where storage_path is null and removed_at is null and download_error is null;

create table mirror.monday_users (
  id bigint primary key,
  name text,
  email text,
  enabled boolean,
  is_guest boolean,
  synced_at timestamptz not null default now()
);

-- Our names for the columns we read. Vocabulary only: no ids.
create table mirror.monday_fields (
  key text primary key,
  scope text not null check (scope in ('parent', 'subitem')),
  label text not null
);
insert into mirror.monday_fields (key, scope, label) values
  ('job_number', 'parent', 'Job number'),
  ('site_address', 'parent', 'Site address'),
  ('site_suburb', 'parent', 'Site suburb'),
  ('site_state', 'parent', 'Site state'),
  ('sales_rep', 'parent', 'Sales rep'),
  ('builder', 'parent', 'Builder'),
  ('buyer_type', 'parent', 'Buyer type'),
  ('block_titled', 'parent', 'Block titled'),
  ('title_due_date', 'parent', 'Title due date'),
  ('sale_won_date', 'parent', 'Sale won date'),
  ('construction_stage', 'parent', 'Construction stage'),
  ('handover_date', 'parent', 'Handover date'),
  ('hubspot_id', 'parent', 'HubSpot deal id'),
  ('milestone_status', 'subitem', 'Milestone status'),
  ('due_date', 'subitem', 'Due date'),
  ('date_completed', 'subitem', 'Date completed'),
  ('people', 'subitem', 'People'),
  ('files', 'subitem', 'Files'),
  ('notes', 'subitem', 'Notes'),
  ('lot_status', 'parent', 'Lot status'),
  ('lot_address', 'parent', 'Lot address'),
  ('lot_suburb', 'parent', 'Lot suburb'),
  ('lot_state', 'parent', 'Lot state'),
  ('lot_estate', 'parent', 'Estate'),
  ('lot_developer', 'parent', 'Land developer'),
  ('lot_builder', 'parent', 'Builder'),
  ('lot_land_price', 'parent', 'Land price'),
  ('lot_package_price', 'parent', 'Package price'),
  ('lot_design', 'parent', 'Design'),
  ('lot_area', 'parent', 'Lot area'),
  ('lot_frontage', 'parent', 'Frontage'),
  ('lot_zoning', 'parent', 'Zoning'),
  ('lot_title', 'parent', 'Title status'),
  ('lot_title_eta', 'parent', 'Title ETA'),
  ('lot_rebate', 'parent', 'Rebate'),
  ('lot_files', 'parent', 'Plans and files');

-- Per board, the column that holds each field. Filled by `npm run mirror -- setup`.
create table mirror.monday_field_map (
  board_id bigint not null references mirror.monday_boards (id) on delete cascade,
  field_key text not null references mirror.monday_fields (key),
  column_id text not null,
  source text not null default 'manual' check (source in ('jerry_config', 'title_match', 'manual')),
  primary key (board_id, field_key)
);

-- One row per pass of any source.
create table mirror.sync_runs (
  id bigint generated always as identity primary key,
  source text not null check (source in ('monday', 'hubspot', 'hubstaff')),
  mode text not null,
  trigger text not null check (trigger in ('cron', 'cli', 'manual')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null default 'running' check (status in ('running', 'ok', 'partial', 'failed', 'skipped')),
  api_calls integer not null default 0,
  complexity bigint not null default 0,
  records_seen integer not null default 0,
  records_changed integer not null default 0,
  watermark_before jsonb,
  watermark_after jsonb,
  note text,
  error text
);
create index sync_runs_recent on mirror.sync_runs (source, started_at desc);

-- Watermarks and milestones per source and scope ('account', 'board:<id>', 'object:deals').
create table mirror.sync_state (
  source text not null,
  scope text not null,
  watermark timestamptz,
  backfilled_at timestamptz,
  swept_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (source, scope)
);

-- One pass per source at a time. A lease that expires on its own, because session
-- advisory locks don't survive Supabase's transaction pooler.
create table mirror.sync_locks (
  source text primary key,
  owner text not null,
  locked_until timestamptz not null
);

-- clock_timestamp(), not now(): the time of the call, even inside a longer transaction. Call these on their own, not in a transaction that might roll back, or a call already sent is un-counted.
create or replace function mirror.try_lock(p_source text, p_owner text, p_seconds integer)
returns boolean
language plpgsql as $$
begin
  insert into mirror.sync_locks as l (source, owner, locked_until)
  values (p_source, p_owner, clock_timestamp() + make_interval(secs => p_seconds))
  on conflict (source) do update
    set owner = excluded.owner, locked_until = excluded.locked_until
    where l.locked_until < clock_timestamp() or l.owner = excluded.owner;
  return found;
end
$$;

create or replace function mirror.unlock(p_source text, p_owner text)
returns void
language sql as $$
  delete from mirror.sync_locks where source = p_source and owner = p_owner;
$$;

-- Calls per source per UTC day (Monday's day resets at 00:00 UTC).
create table mirror.api_calls (
  source text not null,
  day date not null,
  -- Costs are whole tenths (1, or 0.1 for a rate-limited retry): finer values round.
  calls numeric(10, 1) not null default 0,
  -- Set when Monday answers DAILY_LIMIT_EXCEEDED: nothing more is sent that UTC day.
  limit_hit_at timestamptz,
  primary key (source, day)
);

-- Counts p_calls against today's total when it stays within p_cap and the source's
-- daily limit hasn't been hit today. False (and nothing counted) otherwise: the
-- caller must not send the request.
-- clock_timestamp(), not now(): the time of the call, even inside a longer transaction. Call these on their own, not in a transaction that might roll back, or a call already sent is un-counted.
create or replace function mirror.record_api_call(p_source text, p_calls numeric, p_cap numeric)
returns boolean
language plpgsql as $$
declare
  v_day date := (clock_timestamp() at time zone 'utc')::date;
begin
  insert into mirror.api_calls (source, day, calls) values (p_source, v_day, 0)
  on conflict (source, day) do nothing;
  update mirror.api_calls
     set calls = calls + p_calls
   where source = p_source and day = v_day and calls + p_calls <= p_cap and limit_hit_at is null;
  return found;
end
$$;

-- Monday said DAILY_LIMIT_EXCEEDED: refuse every call for the rest of the UTC day,
-- so no pass keeps knocking until the limit resets at 00:00 UTC.
create or replace function mirror.record_daily_limit(p_source text)
returns void
language sql as $$
  insert into mirror.api_calls as a (source, day, calls, limit_hit_at)
  values (p_source, (clock_timestamp() at time zone 'utc')::date, 0, clock_timestamp())
  on conflict (source, day) do update set limit_hit_at = coalesce(a.limit_hit_at, excluded.limit_hit_at);
$$;

-- Tokens that rotate (a Hubstaff personal access token's refresh chain).
create table mirror.integration_secrets (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

select launchpad.secure_schemas();
