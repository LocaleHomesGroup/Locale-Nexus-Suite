-- People, access and leave: what HR, Admin and the Employee portal own. Staff rows
-- carry work fields only (the roster's rule: no birthdays, folder links or remarks),
-- and keep today's org-chart ids (jan-kane-reroma) so nothing that links to them breaks.

create table launchpad.departments (
  id text primary key,
  name text not null,
  head_staff_id text,
  sort smallint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
insert into launchpad.departments (id, name, sort) values
  ('leadership', 'Leadership', 1),
  ('finance', 'Finance', 2),
  ('sales', 'Sales', 3),
  ('marketing', 'Marketing', 4),
  ('operations', 'Operations', 5),
  ('it', 'Information Technology', 6),
  ('accounting', 'Accounting', 7),
  ('executive', 'Executive Office', 8);

create table launchpad.staff (
  id text primary key check (id ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  -- Null while the seat is vacant.
  name text,
  preferred_name text,
  role text not null,
  company text,
  division text,
  brand text check (brand in ('homes', 'financial', 'wealth')),
  department_id text references launchpad.departments (id),
  location text,
  reports_to text references launchpad.staff (id) deferrable initially deferred,
  link text check (link in ('peer', 'assistant')),
  team text,
  employment_type text,
  probation text,
  start_date date,
  confirmation_date date,
  end_date date,
  status text not null default 'active' check (status in ('active', 'pending', 'inactive')),
  vacant boolean not null default false,
  folder_on_file boolean not null default false,
  note text,
  -- The Launchpad sign-in. Today's are placeholders (first@localegroup.au).
  work_email text,
  hubspot_owner_id bigint unique,
  monday_user_id bigint unique,
  hubstaff_user_id bigint unique,
  source text not null default 'org_seed' check (source in ('org_seed', 'roster', 'manual')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (vacant = (name is null)),
  -- Nobody is their own manager: a seat that was would send the org chart's walk up to a department head round in circles.
  check (reports_to is distinct from id)
);
create unique index staff_work_email on launchpad.staff (lower(work_email)) where work_email is not null;
create index staff_department on launchpad.staff (department_id);

alter table launchpad.departments
  add constraint departments_head_staff_fk
  foreign key (head_staff_id) references launchpad.staff (id) deferrable initially deferred;

-- Other spellings of a person, lower-cased and trimmed: Monday's free-text sales
-- rep column, HubSpot owners, HomeScope's staff picker.
create table launchpad.staff_aliases (
  alias text primary key check (alias = lower(btrim(alias)) and alias <> ''),
  staff_id text not null references launchpad.staff (id) on delete cascade,
  source text not null default 'manual' check (source in ('setup', 'manual')),
  created_at timestamptz not null default now()
);

-- Dated pay rates. A future effective_from is a booked change.
create table launchpad.pay_rates (
  id uuid primary key default gen_random_uuid(),
  staff_id text not null references launchpad.staff (id) on delete cascade,
  hourly numeric(10, 2) not null check (hourly >= 0),
  overtime numeric(10, 2) not null check (overtime >= 0),
  currency char(3) not null default 'AUD' check (currency ~ '^[A-Z]{3}$'),
  effective_from date not null,
  set_by text,
  created_at timestamptz not null default now(),
  unique (staff_id, effective_from)
);

create table launchpad.one_off_payments (
  id uuid primary key default gen_random_uuid(),
  staff_id text not null references launchpad.staff (id) on delete cascade,
  kind text not null check (kind in ('bonus', 'commission', 'overtime', 'reimbursement', 'back_pay', 'other')),
  amount numeric(12, 2) not null check (amount > 0),
  currency char(3) not null default 'AUD' check (currency ~ '^[A-Z]{3}$'),
  hours numeric(6, 2),
  rate numeric(10, 2),
  note text,
  pay_on date not null,
  status text not null default 'requested' check (status in ('requested', 'paid', 'cancelled')),
  requested_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- A sign-in: a staff member, or an off-roster account (staff_id null).
create table launchpad.app_users (
  id uuid primary key default gen_random_uuid(),
  staff_id text unique references launchpad.staff (id) on delete set null,
  email text not null,
  display_name text,
  -- Supabase Auth's user id, once sign-in exists.
  auth_user_id uuid unique,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index app_users_email on launchpad.app_users (lower(email));

-- The dashboards and their rail sections (src/components/shell/dashboards.ts).
create table launchpad.modules (
  id text primary key,
  label text not null,
  space text not null default 'launchpad' check (space in ('launchpad', 'portal')),
  sort smallint not null default 0
);

create table launchpad.module_sections (
  key text primary key,
  module_id text not null references launchpad.modules (id) on delete cascade,
  label text not null,
  sort smallint not null default 0
);

-- One role per dashboard (Admin > Roles and permissions).
create table launchpad.role_grants (
  app_user_id uuid not null references launchpad.app_users (id) on delete cascade,
  module_id text not null references launchpad.modules (id) on delete cascade,
  granted_by text,
  granted_at timestamptz not null default now(),
  primary key (app_user_id, module_id)
);

create table launchpad.section_access (
  app_user_id uuid not null references launchpad.app_users (id) on delete cascade,
  section_key text not null references launchpad.module_sections (key) on delete cascade,
  access text not null check (access in ('hidden', 'view', 'edit')),
  updated_by text,
  updated_at timestamptz not null default now(),
  primary key (app_user_id, section_key)
);

create table launchpad.leave_requests (
  id uuid primary key default gen_random_uuid(),
  staff_id text not null references launchpad.staff (id) on delete cascade,
  type text not null check (type in ('Vacation', 'Sick', 'Personal', 'Bereavement', 'Other')),
  starts_on date not null,
  ends_on date not null,
  days numeric(4, 1) not null check (days > 0),
  note text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'declined', 'cancelled')),
  approver_staff_id text references launchpad.staff (id),
  balance_before numeric(5, 1),
  filed_at timestamptz not null default now(),
  decided_by text,
  decided_at timestamptz,
  decision_note text,
  updated_at timestamptz not null default now(),
  check (ends_on >= starts_on),
  check (type <> 'Other' or (note is not null and btrim(note) <> ''))
);
create index leave_requests_staff on launchpad.leave_requests (staff_id, starts_on desc);
create index leave_requests_waiting on launchpad.leave_requests (approver_staff_id) where status = 'pending';

create table launchpad.leave_allowances (
  staff_id text not null references launchpad.staff (id) on delete cascade,
  year smallint not null,
  type text not null check (type in ('Vacation', 'Sick', 'Personal')),
  days numeric(4, 1) not null check (days >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (staff_id, year, type)
);

select launchpad.secure_schemas();
