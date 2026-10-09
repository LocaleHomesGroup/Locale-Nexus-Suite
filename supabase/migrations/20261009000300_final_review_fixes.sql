-- The final review's fixes (2026-10-09). The migrations they touch were reviewed, so this one replaces
-- what it changes rather than editing them.

-- 1. A lot whose Monday item was moved to another board ("Move to board") leaves Exclusive Land, the way
--    a lot whose item left Monday does. The refetch stores the item's new board, so the item drops out
--    of launchpad.monday_land_lots, and until now the sync never saw it again.

-- What happens to a Monday lot whose item has left the Exclusive Land board, removed from Monday or
-- moved to another board: it is withdrawn, with its open holds ended, unless a hold is active, when it is
-- only flagged (monday_removed_at, for the maintainer to see). p_left_at is when it left, as far as the
-- mirror knows. Locks the lot's row before its holds are read or changed, the order the hold functions
-- use. Returns how many rows (the lot and the holds it ended) it changed: none for an item with no
-- Monday lot, because it was never imported or Launchpad owns the lot.
create or replace function launchpad.withdraw_monday_lot(p_item_id bigint, p_left_at timestamptz, p_now timestamptz)
returns integer
language plpgsql as $$
declare
  v_changed integer := 0;
  v_count integer;
begin
  perform 1 from launchpad.land_lots where monday_item_id = p_item_id and source = 'monday' for update;
  if not found then
    return 0;
  end if;
  if exists (
    select 1 from launchpad.land_holds h
    join launchpad.land_lots l on l.id = h.lot_id
    where l.monday_item_id = p_item_id and h.ended_at is null and h.started_at is not null
  ) then
    update launchpad.land_lots set monday_removed_at = p_left_at
     where monday_item_id = p_item_id and monday_removed_at is null;
  else
    -- Only a lot that follows Monday, like the lot update below: a lot Launchpad owns keeps its holds.
    update launchpad.land_holds h
       set ended_at = p_now, outcome = 'lot_withdrawn'
      from launchpad.land_lots l
     where l.id = h.lot_id and l.monday_item_id = p_item_id and l.source = 'monday' and h.ended_at is null;
    get diagnostics v_count = row_count;
    v_changed := v_changed + v_count;
    update launchpad.land_lots
       set sale_status = 'withdrawn', monday_removed_at = coalesce(monday_removed_at, p_left_at)
     where monday_item_id = p_item_id and source = 'monday' and sale_status = 'available';
  end if;
  get diagnostics v_count = row_count;
  return v_changed + v_count;
end
$$;

-- Brings Monday's lots into launchpad.land_lots. New items become available lots
-- (sold, if Monday's status starts with Sold at the first import). While a lot's source is
-- 'monday' its details follow Monday; its sale status never does. A lot whose item left the
-- Exclusive Land board (removed from Monday, or moved to another board) is withdrawn, unless a hold
-- is active: then it is only flagged. If the item comes back, so does the lot. A lot Launchpad owns is
-- never touched. Returns how many rows (lots and holds) it changed, and none until the Exclusive Land
-- board's status is mapped.
create or replace function launchpad.sync_land_lots_from_monday(p_now timestamptz default now())
returns integer
language plpgsql as $$
declare
  r record;
  v_changed integer := 0;
  v_count integer;
begin
  -- Sale status never follows Monday after a lot's first import, so importing before the board's status
  -- column is mapped would make every lot available for good, a sold one included. Wait until it is.
  if not exists (
    select 1
    from mirror.monday_field_map m
    join mirror.monday_boards b on b.id = m.board_id and b.purpose = 'exclusive_land'
    where m.field_key = 'lot_status'
  ) then
    return 0;
  end if;

  -- One loop over two sets, in item order: every item on an Exclusive Land board (the view), and every
  -- Monday lot whose item the mirror holds on a board that isn't one ("Move to board"). The sets don't
  -- overlap. An item the mirror doesn't hold isn't taken for moved, and nor is one on an Exclusive Land
  -- board that isn't synced: it is still in the view. Each lot's row is locked before its holds are read
  -- or changed, the order the hold functions use (lot, then holds), and every sync takes its lots in this
  -- one order, whatever it read, so two syncs can't wait on each other in a circle.
  for r in
    select v.item_id, v.name, v.status_label, v.street, v.suburb, v.state, v.estate, v.developer, v.builder,
           v.land_price, v.package_price, v.package_design, v.area_sqm, v.frontage_m, v.zoning, v.title_label,
           v.title_eta, v.rebate_note, v.removed_at, false as moved_off
    from launchpad.monday_land_lots v
    union all
    select l.monday_item_id, null, null, null, null, null, null, null, null,
           null, null, null, null, null, null, null,
           null, null, i.removed_at, true
    from launchpad.land_lots l
    join mirror.monday_items i on i.id = l.monday_item_id
    join mirror.monday_boards b on b.id = i.board_id
    where l.source = 'monday' and b.purpose is distinct from 'exclusive_land'
    order by item_id
  loop
    if r.moved_off then
      -- Moved, and maybe removed since on its new board: either way it is gone from Exclusive Land.
      v_changed := v_changed + launchpad.withdraw_monday_lot(r.item_id, coalesce(r.removed_at, p_now), p_now);
      continue;
    end if;
    if r.removed_at is not null then
      v_changed := v_changed + launchpad.withdraw_monday_lot(r.item_id, r.removed_at, p_now);
      continue;
    end if;

    insert into launchpad.land_lots as l (
      monday_item_id, source, lot_label, street, suburb, state, estate, developer, builder,
      land_price, package_price, package_design, area_sqm, frontage_m, zoning,
      title_status, title_eta, rebate_note, monday_status, sale_status, sold_at
    ) values (
      r.item_id, 'monday', r.name, r.street, r.suburb, r.state, r.estate, r.developer,
      nullif(r.builder, 'Any builder'),
      -- A number too big for its column reads as null, like any other value we can't use, so one bad
      -- cell can't stop the sync for every lot. pg_input_is_valid applies the column's own precision,
      -- rounding included: keep these types the same as land_lots'.
      case when pg_input_is_valid(r.land_price::text, 'numeric(12,2)') then r.land_price end,
      case when pg_input_is_valid(r.package_price::text, 'numeric(12,2)') then r.package_price end,
      r.package_design,
      case when pg_input_is_valid(r.area_sqm::text, 'numeric(8,2)') then r.area_sqm end,
      case when pg_input_is_valid(r.frontage_m::text, 'numeric(6,2)') then r.frontage_m end,
      r.zoning,
      launchpad.title_status_of(r.title_label), r.title_eta, r.rebate_note, r.status_label,
      -- Sold only when the status starts with Sold: "Unsold" and "Not sold" contain it too.
      case when r.status_label ~* '^\s*sold\y' then 'sold' else 'available' end,
      case when r.status_label ~* '^\s*sold\y' then p_now end
    )
    on conflict (monday_item_id) do update set
      lot_label = excluded.lot_label,
      street = excluded.street,
      suburb = excluded.suburb,
      state = excluded.state,
      estate = excluded.estate,
      developer = excluded.developer,
      builder = excluded.builder,
      land_price = excluded.land_price,
      package_price = excluded.package_price,
      package_design = excluded.package_design,
      area_sqm = excluded.area_sqm,
      frontage_m = excluded.frontage_m,
      zoning = excluded.zoning,
      title_status = excluded.title_status,
      title_eta = excluded.title_eta,
      rebate_note = excluded.rebate_note,
      monday_status = excluded.monday_status,
      monday_removed_at = null,
      -- An item back on the board brings back the lot its leaving withdrew.
      sale_status = case
        when l.sale_status = 'withdrawn' and l.monday_removed_at is not null then 'available'
        else l.sale_status
      end
    where l.source = 'monday' and (
      l.lot_label, l.street, l.suburb, l.state, l.estate, l.developer, l.builder,
      l.land_price, l.package_price, l.package_design, l.area_sqm, l.frontage_m, l.zoning,
      l.title_status, l.title_eta, l.rebate_note, l.monday_status, l.monday_removed_at
    ) is distinct from (
      excluded.lot_label, excluded.street, excluded.suburb, excluded.state, excluded.estate,
      excluded.developer, excluded.builder, excluded.land_price, excluded.package_price,
      excluded.package_design, excluded.area_sqm, excluded.frontage_m, excluded.zoning,
      excluded.title_status, excluded.title_eta, excluded.rebate_note, excluded.monday_status,
      null::timestamptz
    );
    get diagnostics v_count = row_count;
    v_changed := v_changed + v_count;
  end loop;
  return v_changed;
end
$$;

-- 2. The changes pass's refetch queue. A pass puts every item the activity log names here, moves the
--    watermark once the log is read, then refetches the queue oldest first, taking each item out only
--    once its copy is stored. A pass cut short by its time limit leaves the rest here, and the next pass
--    refetches them, so a window too big for one run is finished by the next ones instead of read again.
create table mirror.monday_refetch_queue (
  item_id bigint primary key,
  queued_at timestamptz not null default clock_timestamp()
);
-- The order the pass takes them in.
create index monday_refetch_queue_order on mirror.monday_refetch_queue (queued_at, item_id);

-- 3. When a sweep last started each board. The sweep takes boards by the later of this and swept_at,
--    so a board its time limit cut short goes to the back instead of holding up every other board.
alter table mirror.sync_state add column sweep_attempted_at timestamptz;

select launchpad.secure_schemas();
