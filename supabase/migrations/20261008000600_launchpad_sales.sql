-- Sales: forecasts, targets, commission rules, discount approvals, to-dos, deal
-- submissions and HomeScope quotes. Targets and commission rules start empty: the
-- prototype's figures are placeholders (Sean sets targets, Alison the formula).

create table launchpad.weekly_forecasts (
  staff_id text not null references launchpad.staff (id) on delete cascade,
  week_ending date not null,
  builder text not null,
  forecast smallint not null check (forecast >= 0),
  submitted_at timestamptz not null default now(),
  primary key (staff_id, week_ending, builder)
);

create table launchpad.sales_targets (
  id uuid primary key default gen_random_uuid(),
  -- Null: a team-wide target.
  staff_id text references launchpad.staff (id) on delete cascade,
  period text not null check (period in ('month', 'quarter')),
  period_start date not null,
  target smallint not null check (target >= 0),
  set_by text,
  set_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique nulls not distinct (staff_id, period, period_start)
);

create table launchpad.commission_rules (
  id uuid primary key default gen_random_uuid(),
  -- Slugs, so a spelling can't dodge the unique key below.
  buyer_type text not null check (buyer_type in ('retail', 'wholesale')),
  base_amount numeric(12, 2) not null check (base_amount >= 0),
  discount_share numeric(4, 3) not null default 0 check (discount_share between 0 and 1),
  effective_from date not null,
  note text,
  set_by text references launchpad.staff (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (buyer_type, effective_from)
);

create table launchpad.discount_approvals (
  id uuid primary key default gen_random_uuid(),
  hubspot_deal_id bigint,
  client_label text not null,
  plan text,
  discount numeric(12, 2) not null check (discount > 0),
  company_contribution numeric(12, 2) not null default 0 check (company_contribution >= 0),
  requested_by text references launchpad.staff (id),
  requested_at timestamptz not null default now(),
  status text not null default 'pending' check (status in ('pending', 'approved', 'declined')),
  decided_by text,
  decided_at timestamptz,
  note text,
  check ((status = 'pending') = (decided_at is null))
);

-- Personal to-dos, and Team tasks a manager sets (set_by) with a due date.
create table launchpad.todos (
  id uuid primary key default gen_random_uuid(),
  staff_id text not null references launchpad.staff (id) on delete cascade,
  body text not null check (btrim(body) <> ''),
  -- Both null: the rep's own to-do.
  due_on date,
  set_by text references launchpad.staff (id),
  done_at timestamptz,
  created_at timestamptz not null default now()
);
create index todos_staff on launchpad.todos (staff_id);

create sequence launchpad.submission_no_seq start 200;

create table launchpad.submissions (
  id uuid primary key default gen_random_uuid(),
  number text not null unique default ('S-' || nextval('launchpad.submission_no_seq')),
  hubspot_deal_id bigint,
  client_label text not null,
  builder text not null,
  rep_staff_id text references launchpad.staff (id),
  -- Steps 1 to 3 as the rep submitted them (buyers, lot, titles, finance, deposit), for Ops' compare view.
  deal jsonb,
  status text not null default 'draft' check (status in ('draft', 'review', 'changes', 'approved')),
  submitted_at timestamptz,
  decided_by text,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- One row per item on the builder's checklist. The file itself is in launchpad-files.
create table launchpad.submission_documents (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references launchpad.submissions (id) on delete cascade,
  ref text not null,
  category text not null check (category in ('build', 'land', 'finance')),
  name text not null,
  required boolean not null default true,
  file_path text,
  original_filename text,
  -- The date on the document, for its validity period.
  dated_on date,
  state text not null default 'missing' check (state in ('missing', 'uploaded', 'verified', 'fix')),
  fix_note text,
  uploaded_by text,
  uploaded_at timestamptz,
  verified_by text,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (submission_id, ref),
  constraint submission_documents_fix_note check (state <> 'fix' or (fix_note is not null and btrim(fix_note) <> '')),
  -- A file goes with every state but 'missing'.
  constraint submission_documents_file_matches_state check ((state = 'missing') = (file_path is null))
);

create sequence launchpad.quote_no_seq start 1001;

create table launchpad.quotes (
  id uuid primary key default gen_random_uuid(),
  number text not null unique default ('HS-' || nextval('launchpad.quote_no_seq')),
  -- Alison's rule: no quote without the rep who prepared it.
  prepared_by text not null references launchpad.staff (id),
  builder text not null,
  model text,
  spec_range text,
  elevation text,
  address text,
  client_names text,
  total numeric(12, 2),
  -- The whole estimate (contacts, lot, site costs, lines) as the HomeScope screens hold it.
  estimate jsonb not null,
  pdf_options jsonb,
  generated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- A builder's HomeScope catalogue: today a snapshot, later read from Monday's price boards.
create table launchpad.homescope_catalogues (
  id uuid primary key default gen_random_uuid(),
  builder text not null,
  captured_at timestamptz not null,
  source text not null check (source in ('snapshot', 'monday')),
  data jsonb not null,
  is_current boolean not null default true,
  created_at timestamptz not null default now()
);
create unique index homescope_catalogues_current on launchpad.homescope_catalogues (builder) where is_current;

select launchpad.secure_schemas();
