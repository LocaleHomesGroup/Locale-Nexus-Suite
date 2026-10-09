-- Typed views over the raw Monday mirror. Which column holds which field comes from
-- mirror.monday_field_map, filled at setup, so nothing here names a column id.

-- Readers for one stored column value ({ type, text, value, label, date, ... }).
-- They return null for anything they can't read, never an error. value_text and value_label
-- take the first field that isn't blank, so {"text": "", "display_value": "X"} reads X.
create or replace function mirror.value_text(v jsonb) returns text
language sql stable as $$
  select nullif(btrim(coalesce(nullif(v ->> 'text', ''), nullif(v ->> 'display_value', ''), nullif(v ->> 'label', ''), '')), '')
$$;

create or replace function mirror.value_label(v jsonb) returns text
language sql stable as $$
  select nullif(btrim(coalesce(nullif(v ->> 'label', ''), nullif(v ->> 'text', ''), '')), '')
$$;

-- pg_input_is_valid (Postgres 16+) turns away a well-formed but impossible date such
-- as 2026-02-30 without raising, so one bad value can't break every view that reads it.
create or replace function mirror.value_date(v jsonb) returns date
language sql stable as $$
  select case
    when coalesce(v ->> 'date', v ->> 'text', '') ~ '^\d{4}-\d{2}-\d{2}'
     and pg_input_is_valid(left(coalesce(v ->> 'date', v ->> 'text', ''), 10), 'date')
      then left(coalesce(v ->> 'date', v ->> 'text'), 10)::date
  end
$$;

create or replace function mirror.value_number(v jsonb) returns numeric
language sql stable as $$
  select case when n ~ '^-?\d+(\.\d+)?$' then n::numeric end
  from (select regexp_replace(coalesce(v ->> 'text', ''), '[^0-9.\-]', '', 'g') as n) s
$$;

-- Each view below reads an item's mapped fields as one JSON object, { "<field key>": <stored value> },
-- built for that row alone by a LATERAL subquery. A shared view that aggregated every item could not
-- have the item's key pushed into it, so every list read would build the objects for the whole mirror,
-- subitems and lots included. Built per row, a list costs what it returns.
create or replace view launchpad.monday_jobs as
select
  i.id as item_id,
  b.id as board_id,
  b.board_key,
  b.purpose,
  b.division,
  b.region,
  i.group_id,
  g.title as group_title,
  i.name as deal_name,
  mirror.value_text(fx.f -> 'job_number') as job_number,
  mirror.value_text(fx.f -> 'site_address') as site_address,
  mirror.value_text(fx.f -> 'site_suburb') as site_suburb,
  mirror.value_text(fx.f -> 'site_state') as site_state,
  mirror.value_text(fx.f -> 'sales_rep') as sales_rep,
  mirror.value_label(fx.f -> 'builder') as builder,
  mirror.value_label(fx.f -> 'buyer_type') as buyer_type,
  mirror.value_label(fx.f -> 'block_titled') as block_titled,
  mirror.value_date(fx.f -> 'title_due_date') as title_due_date,
  mirror.value_date(fx.f -> 'sale_won_date') as sale_won_date,
  mirror.value_label(fx.f -> 'construction_stage') as construction_stage,
  mirror.value_date(fx.f -> 'handover_date') as handover_date,
  case
    when mirror.value_text(fx.f -> 'hubspot_id') ~ '^\d{1,15}$' then mirror.value_text(fx.f -> 'hubspot_id')::bigint
  end as hubspot_deal_id,
  i.monday_updated_at as updated_at
from mirror.monday_items i
join mirror.monday_boards b on b.id = i.board_id and b.purpose in ('sales', 'construction', 'handed_over')
left join mirror.monday_groups g on g.board_id = i.board_id and g.id = i.group_id
left join lateral (
  select jsonb_object_agg(m.field_key, i.column_values -> m.column_id) as f
  from mirror.monday_field_map m where m.board_id = i.board_id
) fx on true
where i.parent_item_id is null and i.removed_at is null and i.state = 'active';

create or replace view launchpad.monday_job_milestones as
select
  s.id as item_id,
  s.parent_item_id as job_item_id,
  s.board_id,
  s.name,
  mirror.value_label(fx.f -> 'milestone_status') as status_label,
  mirror.value_date(fx.f -> 'due_date') as due_date,
  mirror.value_date(fx.f -> 'date_completed') as date_completed,
  mirror.value_text(fx.f -> 'people') as people,
  mirror.value_text(fx.f -> 'notes') as notes,
  case
    when jsonb_typeof(fx.f -> 'files' -> 'value' -> 'files') = 'array'
      then jsonb_array_length(fx.f -> 'files' -> 'value' -> 'files')
    else 0
  end as file_count,
  s.monday_created_at,
  s.monday_updated_at as updated_at
from mirror.monday_items s
join mirror.monday_boards sb on sb.id = s.board_id and sb.type = 'sub_items_board'
join mirror.monday_boards pb on pb.id = sb.parent_board_id and pb.purpose in ('sales', 'construction', 'handed_over')
left join lateral (
  select jsonb_object_agg(m.field_key, s.column_values -> m.column_id) as f
  from mirror.monday_field_map m where m.board_id = s.board_id
) fx on true
where s.parent_item_id is not null and s.removed_at is null and s.state = 'active';

-- One row per file, filed under the top-level item (a job or a lot) it belongs to.
create or replace view launchpad.monday_job_files as
select
  a.id as asset_id,
  coalesce(i.parent_item_id, i.id) as item_id,
  case when i.parent_item_id is not null then i.id end as subitem_id,
  a.name,
  a.file_extension,
  a.file_size,
  a.storage_path,
  a.downloaded_at,
  a.monday_created_at
from mirror.monday_assets a
join mirror.monday_items i on i.id = a.item_id
where a.removed_at is null and i.removed_at is null;

create or replace view launchpad.monday_land_lots as
select
  i.id as item_id,
  i.name,
  mirror.value_label(fx.f -> 'lot_status') as status_label,
  mirror.value_text(fx.f -> 'lot_address') as street,
  mirror.value_text(fx.f -> 'lot_suburb') as suburb,
  mirror.value_text(fx.f -> 'lot_state') as state,
  mirror.value_text(fx.f -> 'lot_estate') as estate,
  mirror.value_text(fx.f -> 'lot_developer') as developer,
  mirror.value_text(fx.f -> 'lot_builder') as builder,
  mirror.value_number(fx.f -> 'lot_land_price') as land_price,
  mirror.value_number(fx.f -> 'lot_package_price') as package_price,
  mirror.value_text(fx.f -> 'lot_design') as package_design,
  mirror.value_number(fx.f -> 'lot_area') as area_sqm,
  mirror.value_number(fx.f -> 'lot_frontage') as frontage_m,
  mirror.value_text(fx.f -> 'lot_zoning') as zoning,
  mirror.value_label(fx.f -> 'lot_title') as title_label,
  mirror.value_date(fx.f -> 'lot_title_eta') as title_eta,
  mirror.value_text(fx.f -> 'lot_rebate') as rebate_note,
  i.removed_at,
  i.monday_updated_at as updated_at
from mirror.monday_items i
join mirror.monday_boards b on b.id = i.board_id and b.purpose = 'exclusive_land'
left join lateral (
  select jsonb_object_agg(m.field_key, i.column_values -> m.column_id) as f
  from mirror.monday_field_map m where m.board_id = i.board_id
) fx on true
where i.parent_item_id is null;

-- A Monday title label to our title status. Untitled is checked before titled, because
-- "Untitled", "Not titled" and "Not yet titled" all contain "titled" too. Only a label that
-- starts with "Titled" (or says Yes) counts as titled: a label we can't read, such as
-- "To be titled", is null, never titled.
create or replace function launchpad.title_status_of(p_label text) returns text
language sql immutable as $$
  select case
    when p_label is null then null
    when p_label ilike '%delay%' then 'delayed'
    when p_label ilike '%untitled%' or p_label ilike '%not%titled%' or lower(btrim(p_label)) = 'no' then 'untitled'
    when p_label ~* '^\s*titled\y' or lower(btrim(p_label)) = 'yes' then 'titled'
  end
$$;

-- Brings Monday's lots into launchpad.land_lots. New items become available lots
-- (sold, if Monday's status starts with Sold at the first import). While a lot's source is
-- 'monday' its details follow Monday; its sale status never does. A lot whose item left
-- Monday is withdrawn, unless a hold is active: then it is only flagged. If the
-- item comes back, so does the lot. A lot Launchpad owns is never touched. Returns how many
-- rows (lots and holds) it changed, and none until the Exclusive Land board's status is mapped.
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

  -- Lots in a fixed order, and each lot's row locked before its holds are read or changed: the
  -- same order the hold functions use (lot, then holds), so the sync can't deadlock with them.
  for r in select * from launchpad.monday_land_lots order by item_id loop
    if r.removed_at is not null then
      -- Only a lot that follows Monday: a lot Launchpad owns is never touched, and an item that was
      -- never imported has no lot to withdraw. What follows only ever sees a Monday lot.
      perform 1 from launchpad.land_lots where monday_item_id = r.item_id and source = 'monday' for update;
      if not found then
        continue;
      end if;
      if exists (
        select 1 from launchpad.land_holds h
        join launchpad.land_lots l on l.id = h.lot_id
        where l.monday_item_id = r.item_id and h.ended_at is null and h.started_at is not null
      ) then
        update launchpad.land_lots set monday_removed_at = r.removed_at
         where monday_item_id = r.item_id and monday_removed_at is null;
      else
        -- Only a lot that follows Monday, like the lot update below: a lot Launchpad owns keeps its holds.
        update launchpad.land_holds h
           set ended_at = p_now, outcome = 'lot_withdrawn'
          from launchpad.land_lots l
         where l.id = h.lot_id and l.monday_item_id = r.item_id and l.source = 'monday' and h.ended_at is null;
        get diagnostics v_count = row_count;
        v_changed := v_changed + v_count;
        update launchpad.land_lots
           set sale_status = 'withdrawn', monday_removed_at = coalesce(monday_removed_at, r.removed_at)
         where monday_item_id = r.item_id and source = 'monday' and sale_status = 'available';
      end if;
      get diagnostics v_count = row_count;
      v_changed := v_changed + v_count;
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
      -- An item back in Monday brings back the lot its removal withdrew.
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

-- Hubstaff's tracked hours per staff member per day.
create or replace view launchpad.staff_hours_daily as
select s.id as staff_id, a.date, round(sum(a.tracked_seconds) / 3600.0, 2) as tracked_hours
from mirror.hubstaff_daily_activities a
join launchpad.staff s on s.hubstaff_user_id = a.user_id
group by s.id, a.date;

select launchpad.secure_schemas();
