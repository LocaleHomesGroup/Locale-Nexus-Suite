-- Staff pay (invoices, payment methods), Accounting's pay runs, and Accounts'
-- builder invoices and expense claims.

create table launchpad.payment_methods (
  id uuid primary key default gen_random_uuid(),
  staff_id text not null references launchpad.staff (id) on delete cascade,
  processor text not null check (processor in ('bank', 'wise', 'wire')),
  -- The processor's fields: bank (account name, BSB, account number); wise (email,
  -- account name); wire (account name, bank, account number, SWIFT, bank address).
  details jsonb not null,
  is_current boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index payment_methods_current on launchpad.payment_methods (staff_id) where is_current;

create table launchpad.invoice_senders (
  staff_id text primary key references launchpad.staff (id) on delete cascade,
  entity_name text,
  name text,
  address text,
  city_state_zip text,
  country text,
  logo_path text,
  updated_at timestamptz not null default now()
);

create table launchpad.staff_invoices (
  id uuid primary key default gen_random_uuid(),
  staff_id text not null references launchpad.staff (id),
  number text not null,
  issued_on date not null,
  due_on date,
  -- The Sunday the billed pay week starts on, when it bills one.
  pay_week_start date,
  -- Snapshots, so a later profile edit doesn't rewrite a sent invoice.
  sender jsonb not null,
  payment jsonb,
  notes text,
  currency char(3) not null default 'AUD' check (currency ~ '^[A-Z]{3}$'),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'paid', 'retracted')),
  decision_note text,
  decided_by text,
  decided_at timestamptz,
  paid_on date,
  -- Pesos per A$1 on the pay run that paid it, and what it came to.
  paid_rate numeric(10, 4),
  paid_php numeric(14, 2),
  sent_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((status = 'paid') = (paid_on is not null))
);
create index staff_invoices_staff on launchpad.staff_invoices (staff_id, issued_on desc);
-- An invoice number is unique per sender, and a person has one live invoice per pay week.
-- A retracted invoice frees both, as it does in the Employee portal.
create unique index staff_invoices_number on launchpad.staff_invoices (staff_id, number) where status <> 'retracted';
create unique index staff_invoices_week on launchpad.staff_invoices (staff_id, pay_week_start)
  where pay_week_start is not null and status <> 'retracted';

create table launchpad.staff_invoice_lines (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references launchpad.staff_invoices (id) on delete cascade,
  position smallint not null,
  description text not null,
  notes text,
  qty numeric(10, 2) not null,
  rate numeric(10, 2) not null,
  tax_pct numeric(5, 2) not null default 0,
  auto text check (auto in ('regular', 'overtime')),
  unique (invoice_id, position)
);

create table launchpad.invoice_alerts (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references launchpad.staff_invoices (id) on delete cascade,
  kind text not null check (kind in ('received', 'approved', 'rejected', 'paid', 'unpaid')),
  at timestamptz not null default now(),
  read_at timestamptz
);

create table launchpad.pay_runs (
  id uuid primary key default gen_random_uuid(),
  run_on date not null,
  -- Pesos per A$1, set by Accounting for the run.
  fx_rate numeric(10, 4) not null check (fx_rate between 10 and 100),
  run_by text,
  status text not null default 'draft' check (status in ('draft', 'dispatched')),
  payees integer,
  skipped integer,
  total_aud numeric(14, 2),
  total_php numeric(16, 2),
  dispatched_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table launchpad.pay_run_invoices (
  pay_run_id uuid not null references launchpad.pay_runs (id) on delete cascade,
  invoice_id uuid not null unique references launchpad.staff_invoices (id),
  primary key (pay_run_id, invoice_id)
);

create table launchpad.pay_run_holds (
  pay_run_id uuid not null references launchpad.pay_runs (id) on delete cascade,
  staff_id text not null references launchpad.staff (id),
  reason text not null,
  primary key (pay_run_id, staff_id)
);

create table launchpad.payouts (
  id uuid primary key default gen_random_uuid(),
  -- No cascade: a stray delete of a pay run must not wipe the record of money sent. A draft run with no payouts can still go.
  pay_run_id uuid not null references launchpad.pay_runs (id),
  staff_id text not null references launchpad.staff (id),
  aud numeric(14, 2) not null,
  php numeric(16, 2) not null,
  method jsonb not null,
  status text not null default 'pending' check (status in ('pending', 'paid', 'problem')),
  sent_ref text,
  sent_from text,
  sent_on date,
  sent_by text,
  problem text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (pay_run_id, staff_id),
  check ((status = 'paid') = (sent_on is not null))
);

create table launchpad.payout_invoices (
  payout_id uuid not null references launchpad.payouts (id) on delete cascade,
  invoice_id uuid not null references launchpad.staff_invoices (id),
  primary key (payout_id, invoice_id)
);

-- Accounts: the draft and final invoices Locale sends builders. Amounts exclude GST.
create table launchpad.builder_invoices (
  id uuid primary key default gen_random_uuid(),
  number text not null unique,
  job_number text,
  monday_item_id bigint,
  hubspot_deal_id bigint,
  client_label text,
  builder text not null,
  stage text not null,
  amount_ex_gst numeric(12, 2) not null check (amount_ex_gst >= 0),
  note text,
  status text not null default 'draft' check (status in ('draft', 'approved', 'paid')),
  approved_by text,
  approved_at timestamptz,
  xero_invoice_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table launchpad.expense_claims (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  staff_id text references launchpad.staff (id),
  amount numeric(12, 2) not null check (amount > 0),
  account_code text,
  account_name text,
  status text not null default 'awaiting_approval'
    check (status in ('awaiting_approval', 'approved', 'paid', 'declined')),
  decided_by text,
  decided_at timestamptz,
  receipt_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

select launchpad.secure_schemas();
