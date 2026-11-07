-- T62 data-move check for supabase/migrations/20261025000300_documents_v2.sql. NOT part of `bun run test:db`
-- (the runner only picks *.test.sql): it needs a database that is at the migration BEFORE documents_v2, because it
-- inserts old-shape documents, runs the migration inside the transaction and asserts the result. Everything is
-- rolled back. Run from the repo root against such a database:
--
--   supabase db reset --version 20261014000100
--   psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f tests/db/documents-v2-migration.check.sql
--
-- (or pipe it through `docker exec -i <db container> psql -U postgres -d postgres -v ON_ERROR_STOP=1`, replacing the
-- \i line with the migration's text, since \i reads the client's filesystem).
-- Prints "documents v2 migration check passed".

begin;

create or replace function pg_temp.check(ok boolean, what text) returns void language plpgsql as $$
begin
  if not coalesce(ok, false) then raise exception 'FAILED: %', what; end if;
end $$;

-- Old-shape fixtures for project 1 (the demo project).
create temp table fx (name text primary key, id uuid default gen_random_uuid());
insert into fx (name) values ('contract_v1'), ('contract_v2'), ('invoice'), ('invoice_archived'), ('photo_room'), ('photo_task'), ('photo_archived');

create or replace function pg_temp.fx_id(p_name text) returns uuid language sql as $$ select id from fx where name = p_name $$;

insert into public.documents (id, project_id, category, title, storage_path, file_name, mime_type, size_bytes, version_group, version, is_current,
                              room_id, task_id, created_at)
select pg_temp.fx_id(v.name), 'b0000000-0000-4000-8000-000000000001', v.category::public.document_category, v.title,
       'b0000000-0000-4000-8000-000000000001/' || v.category || '/' || pg_temp.fx_id(v.name) || v.ext, v.title || v.ext, v.mime, 100,
       v.grp, v.version, v.cur, v.room, v.task, v.created
from (values
  ('contract_v1', 'contract', 'Contract', '.pdf', 'application/pdf', 'f1111111-1111-4111-8111-111111111111'::uuid, 1, false, null::uuid, null::uuid, null::timestamptz, '2026-10-01 10:00+00'::timestamptz),
  ('contract_v2', 'contract', 'Contract v2', '.pdf', 'application/pdf', 'f1111111-1111-4111-8111-111111111111'::uuid, 2, true, null, null, null, '2026-10-05 10:00+00'),
  ('invoice', 'invoices', 'Invoice', '.pdf', 'application/pdf', gen_random_uuid(), 1, true, null, null, null, '2026-10-06 10:00+00'),
  ('invoice_archived', 'invoices', 'Old invoice', '.pdf', 'application/pdf', gen_random_uuid(), 1, false, null, null, '2026-10-07 10:00+00', '2026-10-02 10:00+00'),
  ('photo_room', 'installation_photos', 'Wiring', '.jpg', 'image/jpeg', gen_random_uuid(), 1, true, 'd0000000-0000-4000-8000-000000000001', null, null, '2026-10-03 10:00+00'),
  ('photo_task', 'installation_photos', 'Pipes', '.jpg', 'image/jpeg', gen_random_uuid(), 1, true, 'd0000000-0000-4000-8000-000000000002',
     (select id from public.tasks where project_id = 'b0000000-0000-4000-8000-000000000001' and stage_id is not null limit 1), null, '2026-10-04 10:00+00'),
  ('photo_archived', 'installation_photos', 'Hidden', '.jpg', 'image/jpeg', gen_random_uuid(), 1, false, 'd0000000-0000-4000-8000-000000000001', null, '2026-10-08 10:00+00', '2026-10-02 12:00+00')
) as v(name, category, title, ext, mime, grp, version, cur, room, task, archived, created);

-- The insert trigger numbers versions and never accepts archived rows, so archive afterwards.
update public.documents set archived_at = '2026-10-07 10:00+00' where id = pg_temp.fx_id('invoice_archived');
update public.documents set archived_at = '2026-10-08 10:00+00' where id = pg_temp.fx_id('photo_archived');

create temp table before as
select (select count(*) from public.photos) as photos,
       (select count(*) from public.notifications where kind = 'photo_published') as photo_notifications,
       (select count(*) from public.activity_log where entity_type = 'photos') as photo_activity;

-- ---- the migration ----
\i supabase/migrations/20261025000300_documents_v2.sql
-- ---- end ----

-- Every non-archived, non-photo file stays, older versions included; the archived ones are gone.
select pg_temp.check((select count(*) from public.documents where id in (pg_temp.fx_id('contract_v1'), pg_temp.fx_id('contract_v2'), pg_temp.fx_id('invoice'))) = 3,
  'all non-archived files stay as plain documents, older versions too');
select pg_temp.check((select count(*) from public.documents where id in (pg_temp.fx_id('invoice_archived'), pg_temp.fx_id('photo_archived'))) = 0,
  'archived documents are deleted');
select pg_temp.check((select count(*) from public.documents where category = 'installation_photos') = 0,
  'no installation-photo documents are left');

-- The two live installation photos are normal published photos with their room, work and date.
select pg_temp.check((select count(*) from public.photos) = (select photos from before) + 2, 'exactly two photos were added');
select pg_temp.check((select room_id = 'd0000000-0000-4000-8000-000000000001' and task_id is null and status = 'published'
                         and taken_at = '2026-10-03 10:00+00' and created_at = '2026-10-03 10:00+00'
                         and storage_path = 'b0000000-0000-4000-8000-000000000001/photos/' || pg_temp.fx_id('photo_room') || '.jpg'
                         and caption = 'Wiring'
                      from public.photos where id = pg_temp.fx_id('photo_room')),
  'a room photo keeps its room and date and gets the new storage path');
select pg_temp.check((select room_id = 'd0000000-0000-4000-8000-000000000002' and task_id is not null
                         and stage_id = (select stage_id from public.tasks where id = photos.task_id)
                      from public.photos where id = pg_temp.fx_id('photo_task')),
  'a photo with a work keeps room and work, and the stage is derived from the work');
select pg_temp.check((select count(*) from public.photos where id = pg_temp.fx_id('photo_archived')) = 0, 'the archived photo was not moved');

-- Nobody is told about "new" photos, and the activity log does not list them.
select pg_temp.check((select count(*) from public.notifications where kind = 'photo_published') = (select photo_notifications from before),
  'moving the photos sent no photo_published notifications');
select pg_temp.check((select count(*) from public.activity_log where entity_type = 'photos') = (select photo_activity from before),
  'moving the photos wrote no activity rows');
select pg_temp.check((select count(*) from pg_trigger where tgrelid = 'public.photos'::regclass and tgname in ('notify_photo', 'log_activity') and tgenabled = 'O') = 2,
  'the photo triggers are enabled again');

-- Housekeeping is in place.
select pg_temp.check((select count(*) from pg_trigger where tgrelid = 'public.documents'::regclass and tgname in ('log_activity', 'notify_document')) = 2,
  'log_activity and notify_document are attached to documents');

select 'documents v2 migration check passed' as result;
rollback;
