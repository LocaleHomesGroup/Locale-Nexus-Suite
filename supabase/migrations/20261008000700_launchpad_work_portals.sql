-- Tickets (the board and IT's help desk), the Client and Developer portals, and
-- what every module shares: notifications, the audit log, announcements, knowledge.

create table launchpad.ticket_projects (
  id text primary key check (id ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null,
  owner_staff_id text references launchpad.staff (id),
  state text not null default 'in_build' check (state in ('in_build', 'validation', 'deploying')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create sequence launchpad.ticket_no_seq start 100;

create table launchpad.tickets (
  id uuid primary key default gen_random_uuid(),
  -- Shown as LP-<ticket_no>.
  ticket_no integer not null unique default nextval('launchpad.ticket_no_seq'),
  title text not null check (btrim(title) <> ''),
  details text,
  module_id text,
  project_id text references launchpad.ticket_projects (id),
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high', 'urgent')),
  status text not null default 'todo' check (status in ('todo', 'in_progress', 'testing', 'done')),
  raised_by text not null,
  assignee_staff_id text references launchpad.staff (id),
  archived_at timestamptz,
  archived_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table launchpad.ticket_replies (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references launchpad.tickets (id) on delete cascade,
  author text not null,
  body text not null check (btrim(body) <> ''),
  at timestamptz not null default now()
);
create index ticket_replies_ticket on launchpad.ticket_replies (ticket_id);

create table launchpad.ticket_events (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references launchpad.tickets (id) on delete cascade,
  actor text not null,
  at timestamptz not null default now(),
  action text not null check (action in ('created', 'updated', 'moved', 'archived', 'restored')),
  -- [{ "field", "from", "to" }]
  changes jsonb
);
create index ticket_events_ticket on launchpad.ticket_events (ticket_id);

create sequence launchpad.it_ticket_no_seq start 1;

-- IT's help desk. Pablo's system adds email intake (source) and ideas (kind).
create table launchpad.it_tickets (
  id uuid primary key default gen_random_uuid(),
  ticket_no integer not null unique default nextval('launchpad.it_ticket_no_seq'),
  category text not null,
  summary text not null,
  description text,
  requester text not null,
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high')),
  status text not null default 'open' check (status in ('open', 'in_progress', 'resolved')),
  kind text not null default 'request' check (kind in ('request', 'incident', 'idea')),
  source text not null default 'portal' check (source in ('portal', 'email')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz
);

-- A builder's site update on a job, posted in the Developer portal.
create table launchpad.portal_updates (
  id uuid primary key default gen_random_uuid(),
  monday_item_id bigint,
  job_ref text not null,
  builder text,
  milestone text,
  note text,
  posted_by text,
  posted_at timestamptz not null default now()
);

create table launchpad.portal_update_photos (
  id uuid primary key default gen_random_uuid(),
  update_id uuid not null references launchpad.portal_updates (id) on delete cascade,
  file_path text not null,
  created_at timestamptz not null default now()
);
create index portal_update_photos_update on launchpad.portal_update_photos (update_id);

create table launchpad.portal_messages (
  id uuid primary key default gen_random_uuid(),
  monday_item_id bigint,
  job_ref text not null,
  sender_kind text not null check (sender_kind in ('client', 'consultant', 'operations', 'builder')),
  sender_name text not null,
  body text not null check (btrim(body) <> ''),
  sent_at timestamptz not null default now()
);

create table launchpad.portal_message_reads (
  message_id uuid not null references launchpad.portal_messages (id) on delete cascade,
  reader text not null,
  read_at timestamptz not null default now(),
  primary key (message_id, reader)
);

-- The client's answer on learning from their journey after the 7-year retention.
create table launchpad.client_consents (
  job_ref text primary key,
  learn_after_retention boolean not null,
  decided_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table launchpad.notifications (
  id uuid primary key default gen_random_uuid(),
  -- Null: everyone with the module.
  recipient text references launchpad.staff (id) on delete cascade,
  module_id text,
  kind text not null default 'ok' check (kind in ('ok', 'red')),
  event text not null,
  message text not null,
  link text,
  entity_type text,
  entity_id text,
  dedupe_key text unique,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  resolved_at timestamptz
);
create index notifications_inbox on launchpad.notifications (recipient, created_at desc) where resolved_at is null;

create table launchpad.audit_log (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  actor text not null,
  action_type text not null,
  action text not null,
  detail text,
  target_systems text[] not null default '{}',
  entity_type text,
  entity_id text,
  -- The jobs an entry concerns: null means every job, as in the app's activity feed.
  job_ids bigint[],
  before_value jsonb,
  after_value jsonb
);
create index audit_log_entity on launchpad.audit_log (entity_type, entity_id, at desc);

create table launchpad.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  meta text,
  pinned boolean not null default false,
  published_at timestamptz not null default now(),
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table launchpad.knowledge_materials (
  id uuid primary key default gen_random_uuid(),
  -- The Knowledge module's five categories, as its slugs (src/components/modules/knowledge/data.ts).
  category text not null check (category in ('sops', 'builders', 'training', 'security', 'systems')),
  title text not null,
  meta text,
  kind text not null check (kind in ('doc', 'video')),
  file_path text,
  url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

select launchpad.secure_schemas();
