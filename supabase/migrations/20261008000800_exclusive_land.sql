-- Exclusive Land. Lots come from the Monday board, where Alison keeps adding them;
-- holds, the queue and sold status belong to Launchpad (decided 8 Oct). The rules
-- are functions that lock the lot's row, so two reps can't take the same hold.
-- p_now is a parameter only so tests can move the clock: callers leave it out.
-- The functions rely on READ COMMITTED (Postgres's default) and are called on their own:
-- under REPEATABLE READ the queue count would use a snapshot from before the lock.

create table launchpad.land_lots (
  id uuid primary key default gen_random_uuid(),
  monday_item_id bigint unique,
  source text not null default 'monday' check (source in ('monday', 'launchpad')),
  lot_label text not null,
  street text,
  suburb text,
  state text,
  estate text,
  developer text,
  -- Null: any builder.
  builder text,
  land_price numeric(12, 2),
  package_price numeric(12, 2),
  package_design text,
  area_sqm numeric(8, 2),
  frontage_m numeric(6, 2),
  zoning text,
  title_status text check (title_status in ('titled', 'untitled', 'delayed')),
  title_eta date,
  rebate_note text,
  -- The Monday board's own status label, as last mirrored. Shown, never obeyed.
  monday_status text,
  -- Set when the item left Monday while a hold was active, for the maintainer to see.
  monday_removed_at timestamptz,
  sale_status text not null default 'available' check (sale_status in ('available', 'sold', 'withdrawn')),
  sold_at timestamptz,
  sold_by text references launchpad.staff (id),
  sold_client text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((sale_status = 'sold') = (sold_at is not null))
);

create table launchpad.land_holds (
  id uuid primary key default gen_random_uuid(),
  lot_id uuid not null references launchpad.land_lots (id) on delete cascade,
  staff_id text not null references launchpad.staff (id),
  client_name text,
  note text,
  queued_at timestamptz not null default now(),
  -- Set when this becomes the lot's active hold. It then runs 24 hours.
  started_at timestamptz,
  expires_at timestamptz,
  ended_at timestamptz,
  outcome text check (outcome in ('lapsed', 'released', 'left_queue', 'converted', 'lot_sold', 'lot_withdrawn')),
  check ((ended_at is null) = (outcome is null)),
  check ((started_at is null) = (expires_at is null)),
  check (started_at is null or expires_at = started_at + interval '24 hours'),
  -- The outcome says whether the hold ever ran: one that left the queue never started, and
  -- one that lapsed, was released or converted always had.
  constraint land_holds_left_queue_not_started check (outcome <> 'left_queue' or started_at is null),
  constraint land_holds_active_outcome_started check (outcome not in ('lapsed', 'released', 'converted') or started_at is not null)
);
create unique index land_holds_one_active on launchpad.land_holds (lot_id)
  where ended_at is null and started_at is not null;
create unique index land_holds_one_per_rep on launchpad.land_holds (lot_id, staff_id)
  where ended_at is null;
create index land_holds_open on launchpad.land_holds (lot_id, queued_at) where ended_at is null;
create index land_holds_expiring on launchpad.land_holds (expires_at)
  where ended_at is null and started_at is not null;

-- Starts the first queued hold on a lot with no active one, and tells that rep.
-- Returns the hold it started, or null. Call with the lot's row locked.
create or replace function launchpad.start_next_hold(p_lot_id uuid, p_now timestamptz)
returns launchpad.land_holds
language plpgsql as $$
declare
  v_hold launchpad.land_holds;
  v_label text;
begin
  if exists (
    select 1 from launchpad.land_holds
    where lot_id = p_lot_id and ended_at is null and started_at is not null
  ) then
    return null;
  end if;
  select lot_label into v_label from launchpad.land_lots where id = p_lot_id and sale_status = 'available';
  if not found then
    return null;
  end if;
  update launchpad.land_holds h
     set started_at = p_now, expires_at = p_now + interval '24 hours'
   where h.id = (
     select q.id from launchpad.land_holds q
     where q.lot_id = p_lot_id and q.ended_at is null and q.started_at is null
     order by q.queued_at, q.id
     limit 1
   )
  returning h.* into v_hold;
  if v_hold.id is not null then
    insert into launchpad.notifications (recipient, module_id, kind, event, message, link, entity_type, entity_id, dedupe_key)
    values (
      v_hold.staff_id, 'consultant', 'red', 'land_hold_started',
      'Your hold on ' || v_label || ' has started. It runs for 24 hours.',
      '/consultant?tab=land', 'land_hold', v_hold.id::text, 'land_hold_started:' || v_hold.id::text
    )
    on conflict (dedupe_key) do nothing;
  end if;
  return v_hold;
end
$$;

-- Ends every active hold whose 24 hours are up and starts the next in its queue,
-- with a fresh 24 hours from p_now. Returns the holds it started. Runs on a
-- schedule, and first thing in every hold function, so a late schedule never
-- leaves a lapsed hold standing.
create or replace function launchpad.settle_land_holds(p_lot_id uuid default null, p_now timestamptz default now())
returns setof launchpad.land_holds
language plpgsql as $$
declare
  v_lot uuid;
  v_next launchpad.land_holds;
begin
  for v_lot in
    select distinct h.lot_id from launchpad.land_holds h
    where h.ended_at is null and h.started_at is not null and h.expires_at <= p_now
      and (p_lot_id is null or h.lot_id = p_lot_id)
    order by h.lot_id
  loop
    -- skip locked: a settle never waits for a lot, so it can't deadlock with another settle or
    -- with the Monday lot sync, which holds many lots at once. A lot it skips is settled by whoever
    -- holds it (each hold function settles its own lot first) or by the next run. A lot this
    -- transaction already holds is still returned, so inside the hold functions it settles as before.
    perform 1 from launchpad.land_lots where id = v_lot for update skip locked;
    if not found then
      continue;
    end if;
    update launchpad.land_holds
       set ended_at = expires_at, outcome = 'lapsed'
     where lot_id = v_lot and ended_at is null and started_at is not null and expires_at <= p_now;
    v_next := launchpad.start_next_hold(v_lot, p_now);
    if v_next.id is not null then
      return next v_next;
    end if;
  end loop;
end
$$;

create or replace function launchpad.place_hold(
  p_lot_id uuid,
  p_staff_id text,
  p_client text default null,
  p_note text default null,
  p_now timestamptz default now()
)
returns launchpad.land_holds
language plpgsql as $$
declare
  v_status text;
  v_open integer;
  v_active boolean;
  v_hold launchpad.land_holds;
begin
  select sale_status into v_status from launchpad.land_lots where id = p_lot_id for update;
  if not found then
    raise exception 'land_lot_not_found';
  end if;
  perform launchpad.settle_land_holds(p_lot_id, p_now);
  if v_status <> 'available' then
    raise exception 'land_lot_not_available';
  end if;
  if exists (
    select 1 from launchpad.land_holds
    where lot_id = p_lot_id and staff_id = p_staff_id and ended_at is null
  ) then
    raise exception 'land_hold_already_yours';
  end if;
  select count(*), coalesce(bool_or(started_at is not null), false)
    into v_open, v_active
    from launchpad.land_holds
   where lot_id = p_lot_id and ended_at is null;
  if v_open >= 3 then
    raise exception 'land_hold_queue_full';
  end if;
  insert into launchpad.land_holds (lot_id, staff_id, client_name, note, queued_at, started_at, expires_at)
  values (
    p_lot_id, p_staff_id, nullif(btrim(p_client), ''), nullif(btrim(p_note), ''), p_now,
    case when v_active then null else p_now end,
    case when v_active then null else p_now + interval '24 hours' end
  )
  returning * into v_hold;
  return v_hold;
end
$$;

-- The holder releasing their hold, or a queued rep leaving the queue.
create or replace function launchpad.release_hold(p_hold_id uuid, p_staff_id text, p_now timestamptz default now())
returns void
language plpgsql as $$
declare
  v_hold launchpad.land_holds;
begin
  select * into v_hold from launchpad.land_holds where id = p_hold_id;
  if not found or v_hold.ended_at is not null then
    raise exception 'land_hold_not_open';
  end if;
  if v_hold.staff_id <> p_staff_id then
    raise exception 'land_hold_not_yours';
  end if;
  perform 1 from launchpad.land_lots where id = v_hold.lot_id for update;
  -- A queued hold leaves first, so the settle below can't promote it and tell its rep the hold started.
  update launchpad.land_holds set ended_at = p_now, outcome = 'left_queue'
   where id = p_hold_id and ended_at is null and started_at is null;
  -- Then settle, as every hold function does: an active hold that already ran out is recorded as lapsed.
  perform launchpad.settle_land_holds(v_hold.lot_id, p_now);
  update launchpad.land_holds set ended_at = p_now, outcome = 'released'
   where id = p_hold_id and ended_at is null;
  perform launchpad.start_next_hold(v_hold.lot_id, p_now);
end
$$;

-- Deposit received: only the active holder. The lot is sold and the queue ends.
create or replace function launchpad.mark_lot_sold(
  p_hold_id uuid,
  p_staff_id text,
  p_client text default null,
  p_now timestamptz default now()
)
returns void
language plpgsql as $$
declare
  v_hold launchpad.land_holds;
  v_label text;
  r record;
begin
  select * into v_hold from launchpad.land_holds where id = p_hold_id;
  if not found or v_hold.ended_at is not null then
    raise exception 'land_hold_not_open';
  end if;
  if v_hold.staff_id <> p_staff_id then
    raise exception 'land_hold_not_yours';
  end if;
  select lot_label into v_label from launchpad.land_lots where id = v_hold.lot_id for update;
  perform launchpad.settle_land_holds(v_hold.lot_id, p_now);
  select * into v_hold from launchpad.land_holds where id = p_hold_id;
  -- Ended while this call waited for the lot, other than by running out (released in another tab, say):
  -- it isn't open any more. A lapsed or queued hold gets land_hold_not_active.
  if v_hold.ended_at is not null and v_hold.outcome <> 'lapsed' then
    raise exception 'land_hold_not_open';
  end if;
  if v_hold.ended_at is not null or v_hold.started_at is null then
    raise exception 'land_hold_not_active';
  end if;
  update launchpad.land_lots
     set sale_status = 'sold', sold_at = p_now, sold_by = p_staff_id,
         sold_client = coalesce(nullif(btrim(p_client), ''), v_hold.client_name)
   where id = v_hold.lot_id;
  update launchpad.land_holds set ended_at = p_now, outcome = 'converted' where id = p_hold_id;
  for r in
    update launchpad.land_holds
       set ended_at = p_now, outcome = 'lot_sold'
     where lot_id = v_hold.lot_id and ended_at is null
    returning id, staff_id
  loop
    insert into launchpad.notifications (recipient, module_id, kind, event, message, link, entity_type, entity_id, dedupe_key)
    values (
      r.staff_id, 'consultant', 'ok', 'land_lot_sold',
      v_label || ' has sold, so your place in its hold queue has ended.',
      '/consultant?tab=land', 'land_hold', r.id::text, 'land_lot_sold:' || r.id::text
    )
    on conflict (dedupe_key) do nothing;
  end loop;
end
$$;

-- What the Exclusive Land screen reads: every lot that isn't withdrawn, with its
-- open holds (the active one first, then the queue in order) and who sold it.
create or replace view launchpad.land_lot_board as
select
  l.*,
  coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'id', h.id,
        'staffId', h.staff_id,
        'name', coalesce(s.name, h.staff_id),
        'client', h.client_name,
        'note', h.note,
        'queuedAt', h.queued_at,
        'startedAt', h.started_at,
        'expiresAt', h.expires_at
      )
      order by (h.started_at is null), h.queued_at, h.id
    )
    from launchpad.land_holds h
    left join launchpad.staff s on s.id = h.staff_id
    where h.lot_id = l.id and h.ended_at is null
  ), '[]'::jsonb) as holds,
  (select s.name from launchpad.staff s where s.id = l.sold_by) as sold_by_name
from launchpad.land_lots l
where l.sale_status <> 'withdrawn';

select launchpad.secure_schemas();
