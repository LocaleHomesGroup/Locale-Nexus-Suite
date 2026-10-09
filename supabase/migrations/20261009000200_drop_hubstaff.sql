-- Locale has no Hubstaff (Kane, 2026-10-09).

-- The hours view first: it is the only thing that reads the activities table and the staff link.
drop view launchpad.staff_hours_daily;

-- Its index goes with it.
drop table mirror.hubstaff_daily_activities;
drop table mirror.hubstaff_members;

-- Its only use was a Hubstaff personal access token's refresh chain.
drop table mirror.integration_secrets;

-- Its unique constraint goes with it.
alter table launchpad.staff drop column hubstaff_user_id;

-- The same check under the same name, without 'hubstaff'.
alter table mirror.sync_runs drop constraint sync_runs_source_check;
alter table mirror.sync_runs add constraint sync_runs_source_check check (source in ('monday', 'hubspot'));

comment on schema mirror is 'Read-only copies of Monday and HubSpot. Written only by the sync code.';

select launchpad.secure_schemas();
