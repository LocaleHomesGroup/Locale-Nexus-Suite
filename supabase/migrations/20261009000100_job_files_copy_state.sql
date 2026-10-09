-- Say why a file will never be copied (copy_error), and list a milestone's file only while its job is mirrored and not removed.
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
  a.monday_created_at,
  -- Null while the file is copied or still on its way. Otherwise the downloader gave up on it: over the size
  -- limit, or failed for good. Only that much leaves the mirror, never the failure message.
  case
    when a.storage_path is not null or a.download_error is null then null
    when a.download_error = 'too_large' then 'too_large'
    else 'failed'
  end as copy_error
from mirror.monday_assets a
join mirror.monday_items i on i.id = a.item_id
-- A subitem's job. There is no foreign key (a subitem can arrive before its job), so it may not be mirrored.
left join mirror.monday_items p on p.id = i.parent_item_id
where a.removed_at is null and i.removed_at is null
  and (i.parent_item_id is null or (p.id is not null and p.removed_at is null));

select launchpad.secure_schemas();
