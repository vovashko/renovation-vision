-- Project documents (#58): categories, versioning (one current per group), archive, RLS, storage and the
-- room/work project guard. Run against a freshly seeded database with `bun run test:db` (see tests/db/README.md);
-- everything is rolled back. Prints "documents tests passed" on success; any failed assertion aborts with an error.

begin;

create or replace function pg_temp.as_user(p_user uuid) returns void language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claim.sub', p_user::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
end $$;

create or replace function pg_temp.as_admin() returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claims', '', true);
end $$;

create or replace function pg_temp.check(ok boolean, what text) returns void language plpgsql as $$
begin
  if not coalesce(ok, false) then raise exception 'FAILED: %', what; end if;
end $$;

-- Fails unless `sql` raises insufficient_privilege (42501).
create or replace function pg_temp.denied(sql text, what text) returns void language plpgsql as $$
begin
  execute sql;
  raise exception 'FAILED: %', what;
exception when insufficient_privilege then null;
end $$;

-- Fails unless `sql` violates a check constraint (or a unique index).
create or replace function pg_temp.rejected(sql text, what text) returns void language plpgsql as $$
begin
  execute sql;
  raise exception 'FAILED: %', what;
exception when check_violation or not_null_violation or unique_violation then null;
end $$;

-- Fails unless `sql` changes no rows (RLS filtered the statement).
create or replace function pg_temp.no_rows(sql text, what text) returns void language plpgsql as $$
declare n int;
begin
  execute sql;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FAILED: %', what; end if;
end $$;

-- A doc in project 1 (the demo project): title, category, optional group, optional room.
create or replace function pg_temp.add_doc(p_title text, p_category public.document_category, p_group uuid default null,
                                           p_room uuid default null, p_task uuid default null) returns uuid
language plpgsql as $$
declare v_id uuid;
begin
  insert into public.documents (project_id, category, title, storage_path, file_name, mime_type, size_bytes,
                                version_group, room_id, task_id)
  values ('b0000000-0000-4000-8000-000000000001', p_category, p_title,
          'b0000000-0000-4000-8000-000000000001/' || p_category || '/' || gen_random_uuid() || '.pdf', p_title || '.pdf',
          'application/pdf', 1024, coalesce(p_group, gen_random_uuid()), p_room, p_task)
  returning id into v_id;
  return v_id;
end $$;

-- An unrelated manager with their own project.
insert into auth.users (id, email, aud, role) values
  ('a0000000-0000-4000-8000-0000000000ff', 'other@renovision.demo', 'authenticated', 'authenticated');
insert into public.profiles (id, full_name, account_type)
values ('a0000000-0000-4000-8000-0000000000ff', 'Other Manager', 'manager')
on conflict (id) do update set account_type = 'manager';

select pg_temp.as_user('a0000000-0000-4000-8000-0000000000ff');
select public.create_project('Elm Road House');
select pg_temp.as_admin();
create temp table other_project as select id from public.projects where name = 'Elm Road House';
grant select on other_project to public;
create temp table ids (name text primary key, id uuid, grp uuid);
grant all on ids to public;
insert into public.rooms (id, project_id, key, name) select 'd0000000-0000-4000-8000-0000000000f1', id, 'hall', 'Hall' from other_project;
insert into public.stages (id, project_id, key, name, start_date, end_date)
select 'c0000000-0000-4000-8000-0000000000f1', id, 'x', 'Other stage', current_date, current_date + 1 from other_project;
insert into public.tasks (id, project_id, stage_id, name)
select 'aa000000-0000-4000-8000-0000000000f1', id, 'c0000000-0000-4000-8000-0000000000f1', 'Other task' from other_project;

-- ===========================================================================
-- Shape
-- ===========================================================================
select pg_temp.check(
  (select string_agg(e::text, ',' order by e) from unnest(enum_range(null::public.document_category)) e)
  = 'contract,estimate,invoices,installation_photos,warranties,manuals', 'exactly the six categories, in order');
select pg_temp.check((select not public from storage.buckets where id = 'project-documents'), 'the documents bucket is private');
select pg_temp.check((select file_size_limit from storage.buckets where id = 'project-documents') = 26214400, 'bucket limit is 25 MB');
select pg_temp.check((select cardinality(allowed_mime_types) from storage.buckets where id = 'project-documents') = 7,
  'bucket allows pdf, jpeg, png, webp, heic, docx, xlsx');

-- ===========================================================================
-- Manager: upload, versions
-- ===========================================================================
select pg_temp.as_user('a0000000-0000-4000-8000-000000000001');

-- Contract: a new version keeps the old one and takes over as current.
insert into ids (name, id) values ('c1', pg_temp.add_doc('Contract', 'contract'));
update ids set grp = (select version_group from public.documents where id = ids.id) where name = 'c1';
select pg_temp.check((select version = 1 and is_current from public.documents where id = (select id from ids where name = 'c1')),
  'a first contract is version 1 and current');
insert into ids (name, id) values ('c2', pg_temp.add_doc('Contract v2', 'contract', (select grp from ids where name = 'c1')));
select pg_temp.check((select count(*) from public.documents where version_group = (select grp from ids where name = 'c1')) = 2,
  'uploading a new version keeps the old one');
select pg_temp.check((select version = 2 and is_current from public.documents where id = (select id from ids where name = 'c2')),
  'the new version is version 2 and current');
select pg_temp.check((select version = 1 and not is_current from public.documents where id = (select id from ids where name = 'c1')),
  'the previous version is history, no longer current');
insert into ids (name, id) values ('c3', pg_temp.add_doc('Contract v3', 'contract', (select grp from ids where name = 'c1')));
select pg_temp.check((select count(*) from public.documents where version_group = (select grp from ids where name = 'c1') and is_current) = 1,
  'exactly one current version after three uploads');
select pg_temp.check((select version = 3 from public.documents where is_current and version_group = (select grp from ids where name = 'c1')),
  'and it is the latest');

-- A second estimate group in the same project is independent.
insert into ids (name, id) values ('e1', pg_temp.add_doc('Estimate', 'estimate'));
insert into ids (name, id) values ('e2', pg_temp.add_doc('Estimate other', 'estimate'));
select pg_temp.check((select count(*) from public.documents where category = 'estimate' and is_current) = 2,
  'separate estimate groups each have their own current version');

-- Invoices, warranties, manuals are one-row groups; version_group sent by the client is ignored.
insert into ids (name, id) values ('i1', pg_temp.add_doc('Invoice 1', 'invoices'));
insert into ids (name, id) values ('i2', pg_temp.add_doc('Invoice 2', 'invoices', (select grp from ids where name = 'c1')));
select pg_temp.check((select count(*) from public.documents where category = 'invoices' and version = 1 and is_current) = 2,
  'non-versioned categories are never versioned, even if a group is passed');
select pg_temp.check((select count(*) from public.documents where version_group = (select grp from ids where name = 'c1')) = 3,
  'passing a contract group to an invoice did not touch the contract group');

-- The partial unique index backs the trigger: a second current row in a group is refused.
select pg_temp.as_admin();
select pg_temp.rejected(
  format($q$update public.documents set is_current = true where id = %L$q$, (select id from ids where name = 'c1')),
  'two current rows in one group');
select pg_temp.as_user('a0000000-0000-4000-8000-000000000001');

-- is_current, version and the file columns are not writable through the API.
select pg_temp.denied(format($q$update public.documents set is_current = false where id = %L$q$, (select id from ids where name = 'c3')),
  'manager set is_current');
select pg_temp.denied(format($q$update public.documents set storage_path = 'x' where id = %L$q$, (select id from ids where name = 'c3')),
  'manager rewrote storage_path');
select pg_temp.denied(format($q$update public.documents set project_id = %L where id = %L$q$, (select id from other_project),
  (select id from ids where name = 'c3')), 'manager moved a document to another project');
select pg_temp.denied(format($q$delete from public.documents where id = %L$q$, (select id from ids where name = 'i1')),
  'manager hard-deleted a document');
select pg_temp.denied($q$insert into public.documents (project_id, category, title, storage_path, file_name, mime_type, size_bytes, is_current, version)
  values ('b0000000-0000-4000-8000-000000000001', 'invoices', 'x', 'b0000000-0000-4000-8000-000000000001/invoices/x.pdf', 'x.pdf', 'application/pdf', 1, true, 9)$q$,
  'manager inserted with an explicit version');

-- Editing title/description works.
update public.documents set title = 'Renamed', description = 'Note' where id = (select id from ids where name = 'i1');
select pg_temp.check((select title = 'Renamed' and description = 'Note' from public.documents where id = (select id from ids where name = 'i1')),
  'manager edits title and description');

-- ===========================================================================
-- Upload hardening
-- ===========================================================================
select pg_temp.rejected($q$insert into public.documents (project_id, category, title, storage_path, file_name, mime_type, size_bytes)
  values ('b0000000-0000-4000-8000-000000000001', 'manuals', 'x', 'b0000000-0000-4000-8000-000000000001/manuals/a.exe', 'a.exe', 'application/x-msdownload', 10)$q$,
  'a disallowed mime type');
select pg_temp.rejected($q$insert into public.documents (project_id, category, title, storage_path, file_name, mime_type, size_bytes)
  values ('b0000000-0000-4000-8000-000000000001', 'manuals', 'x', 'b0000000-0000-4000-8000-000000000001/manuals/b.pdf', 'b.pdf', 'application/pdf', 26214401)$q$,
  'a file over 25 MB');
select pg_temp.rejected($q$insert into public.documents (project_id, category, title, storage_path, file_name, mime_type, size_bytes)
  values ('b0000000-0000-4000-8000-000000000001', 'manuals', '   ', 'b0000000-0000-4000-8000-000000000001/manuals/c.pdf', 'c.pdf', 'application/pdf', 10)$q$,
  'a blank title');
select pg_temp.rejected($q$insert into public.documents (project_id, category, title, storage_path, file_name, mime_type, size_bytes)
  values ('b0000000-0000-4000-8000-000000000001', 'manuals', 'x', 'b0000000-0000-4000-8000-0000000000aa/manuals/d.pdf', 'd.pdf', 'application/pdf', 10)$q$,
  'a storage path outside the project folder');

-- ===========================================================================
-- Installation photos: room required, work optional, both in the same project
-- ===========================================================================
select pg_temp.rejected($q$select pg_temp.add_doc('Wiring', 'installation_photos')$q$, 'an installation photo without a room');
select pg_temp.rejected($q$select pg_temp.add_doc('Wiring', 'invoices', null, 'd0000000-0000-4000-8000-000000000001')$q$,
  'a room on an invoice');
insert into ids (name, id) values ('p1', pg_temp.add_doc('Wiring behind wall', 'installation_photos', null, 'd0000000-0000-4000-8000-000000000001'));
insert into ids (name, id)
select 'p2', pg_temp.add_doc('Wiring with work', 'installation_photos', null, 'd0000000-0000-4000-8000-000000000001',
  (select id from public.tasks where project_id = 'b0000000-0000-4000-8000-000000000001' limit 1));
select pg_temp.check((select task_id is not null from public.documents where id = (select id from ids where name = 'p2')),
  'an installation photo can point at a work (task)');

do $$
begin
  perform pg_temp.add_doc('Foreign room', 'installation_photos', null, 'd0000000-0000-4000-8000-0000000000f1');
  raise exception 'FAILED: a room of another project was accepted';
exception when check_violation then null;
end $$;
do $$
begin
  perform pg_temp.add_doc('Foreign work', 'installation_photos', null, 'd0000000-0000-4000-8000-000000000001', 'aa000000-0000-4000-8000-0000000000f1');
  raise exception 'FAILED: a work of another project was accepted';
exception when check_violation then null;
end $$;
do $$
begin
  update public.documents set room_id = 'd0000000-0000-4000-8000-0000000000f1' where id = (select id from ids where name = 'p1');
  raise exception 'FAILED: moving a photo to a room of another project was accepted';
exception when check_violation then null;
end $$;
select pg_temp.rejected(format($q$update public.documents set room_id = null where id = %L$q$, (select id from ids where name = 'p1')),
  'clearing the room of an installation photo');
update public.documents set room_id = 'd0000000-0000-4000-8000-000000000002' where id = (select id from ids where name = 'p1');
select pg_temp.check((select room_id = 'd0000000-0000-4000-8000-000000000002' from public.documents where id = (select id from ids where name = 'p1')),
  'moving an installation photo to another room of the project');

-- A version group of another project/category cannot be hijacked.
select pg_temp.as_admin();
insert into public.documents (id, project_id, category, title, storage_path, file_name, mime_type, size_bytes, version_group)
select 'f0000000-0000-4000-8000-0000000000f1', id, 'contract', 'Other contract', id || '/contract/o.pdf', 'o.pdf', 'application/pdf', 5,
       'f1111111-1111-4111-8111-111111111111' from other_project;
select pg_temp.as_user('a0000000-0000-4000-8000-000000000001');
do $$
begin
  perform pg_temp.add_doc('Hijack', 'contract', 'f1111111-1111-4111-8111-111111111111');
  raise exception 'FAILED: a version group of another project was accepted';
exception when check_violation then null;
end $$;
select pg_temp.as_admin();
select pg_temp.check((select is_current and version = 1 from public.documents where id = 'f0000000-0000-4000-8000-0000000000f1'),
  'the other project''s current version is untouched');

-- ===========================================================================
-- Archive
-- ===========================================================================
select pg_temp.as_user('a0000000-0000-4000-8000-000000000001');
-- Archiving the current contract (v3) promotes v2.
update public.documents set archived_at = now() where id = (select id from ids where name = 'c3');
select pg_temp.check((select archived_by = auth.uid() and not is_current from public.documents where id = (select id from ids where name = 'c3')),
  'archiving records who archived and drops currency');
select pg_temp.check((select is_current from public.documents where id = (select id from ids where name = 'c2')),
  'archiving the current version promotes the newest non-archived older one');
select pg_temp.check((select count(*) from public.documents where version_group = (select grp from ids where name = 'c1') and is_current) = 1,
  'still exactly one current version');
-- Restoring v3 while v2 is current keeps v2 current (v3 goes to history).
update public.documents set archived_at = null where id = (select id from ids where name = 'c3');
select pg_temp.check((select archived_at is null and archived_by is null and not is_current from public.documents where id = (select id from ids where name = 'c3')),
  'a restored version joins the history when the group already has a current one');
select pg_temp.check((select count(*) from public.documents where version_group = (select grp from ids where name = 'c1') and is_current) = 1,
  'restoring never creates a second current version');
-- Archiving every version of a group leaves no current one; restoring one makes it current again.
update public.documents set archived_at = now() where version_group = (select grp from ids where name = 'c1');
select pg_temp.check((select count(*) from public.documents where version_group = (select grp from ids where name = 'c1') and is_current) = 0,
  'a fully archived group has no current version');
update public.documents set archived_at = null where id = (select id from ids where name = 'c1');
select pg_temp.check((select is_current from public.documents where id = (select id from ids where name = 'c1')),
  'restoring into an empty group makes the version current');
-- Archive an invoice.
update public.documents set archived_at = now() where id = (select id from ids where name = 'i2');

select pg_temp.check((select count(*) from public.documents where archived_at is not null) = 3,
  'manager still reads archived documents (c2, c3 and the invoice)');

-- ===========================================================================
-- Client: Sarah (read-only, archived hidden)
-- ===========================================================================
select pg_temp.as_admin();
select pg_temp.as_user('a0000000-0000-4000-8000-000000000002');
select pg_temp.check((select count(*) from public.documents where archived_at is not null) = 0, 'client never sees archived documents');
select pg_temp.check((select count(*) from public.documents where id = (select id from ids where name = 'i2')) = 0,
  'the archived invoice is hidden from the client');
select pg_temp.check((select count(*) from public.documents) > 0, 'client reads the project''s documents');
select pg_temp.check((select count(*) from public.documents where project_id = (select id from other_project)) = 0,
  'client sees nothing of other projects');
select pg_temp.denied($q$insert into public.documents (project_id, category, title, storage_path, file_name, mime_type, size_bytes)
  values ('b0000000-0000-4000-8000-000000000001', 'manuals', 'x', 'b0000000-0000-4000-8000-000000000001/manuals/client.pdf', 'client.pdf', 'application/pdf', 10)$q$,
  'client uploaded a document') ;
select pg_temp.no_rows(format($q$update public.documents set title = 'hacked' where id = %L$q$, (select id from ids where name = 'i1')),
  'client edited a document');
select pg_temp.no_rows(format($q$update public.documents set archived_at = now() where id = %L$q$, (select id from ids where name = 'i1')),
  'client archived a document');
select pg_temp.denied(format($q$delete from public.documents where id = %L$q$, (select id from ids where name = 'i1')), 'client deleted a document');

-- Storage: clients read non-archived files, never upload.
-- What the Storage API does for a delete (storage.protect_delete refuses direct SQL deletes otherwise).
select set_config('storage.allow_delete_query', 'true', true);
select pg_temp.as_admin();
insert into storage.objects (bucket_id, name)
select 'project-documents', storage_path from public.documents where project_id = 'b0000000-0000-4000-8000-000000000001';
insert into storage.objects (bucket_id, name) select 'project-documents', id || '/contract/o.pdf' from other_project;
insert into storage.objects (bucket_id, name) values ('project-documents', 'b0000000-0000-4000-8000-000000000001/manuals/orphan.pdf');
select pg_temp.as_user('a0000000-0000-4000-8000-000000000002');
select pg_temp.check((select count(*) from storage.objects where bucket_id = 'project-documents')
  = (select count(*) from public.documents where project_id = 'b0000000-0000-4000-8000-000000000001' and archived_at is null),
  'client reads the files of non-archived documents only (not archived ones, orphans or other projects)');
select pg_temp.denied($q$insert into storage.objects (bucket_id, name) values ('project-documents', 'b0000000-0000-4000-8000-000000000001/manuals/c.pdf')$q$,
  'client uploaded to the documents bucket');
select pg_temp.no_rows($q$delete from storage.objects where bucket_id = 'project-documents'$q$, 'client deleted documents files');

-- ===========================================================================
-- Manager: storage
-- ===========================================================================
select pg_temp.as_user('a0000000-0000-4000-8000-000000000001');
select pg_temp.check((select count(*) from storage.objects where bucket_id = 'project-documents')
  = (select count(*) from public.documents where project_id = 'b0000000-0000-4000-8000-000000000001') + 1,
  'manager reads every file of the project, archived and orphan included, but not other projects''');
insert into storage.objects (bucket_id, name) values ('project-documents', 'b0000000-0000-4000-8000-000000000001/manuals/new.pdf');
select pg_temp.denied($q$insert into storage.objects (bucket_id, name) values ('project-documents', 'a0000000-0000-4000-8000-0000000000aa/manuals/x.pdf')$q$,
  'manager uploaded outside a project they manage');
select pg_temp.no_rows(format($q$delete from storage.objects where bucket_id = 'project-documents' and name = %L$q$,
  (select storage_path from public.documents where id = (select id from ids where name = 'i1'))),
  'manager deleted a file a document points at');
delete from storage.objects where bucket_id = 'project-documents' and name = 'b0000000-0000-4000-8000-000000000001/manuals/orphan.pdf';
select pg_temp.check((select count(*) from storage.objects where name like '%/orphan.pdf') = 0, 'manager removes an orphan upload');

-- ===========================================================================
-- Cross-project isolation
-- ===========================================================================
select pg_temp.check((select count(*) from public.documents where project_id = (select id from other_project)) = 0,
  'manager of project 1 cannot read the other project''s documents');
select pg_temp.denied(format($q$insert into public.documents (project_id, category, title, storage_path, file_name, mime_type, size_bytes)
  values (%L, 'manuals', 'x', %L, 'x.pdf', 'application/pdf', 10)$q$, (select id from other_project), (select id from other_project) || '/manuals/x.pdf'),
  'manager uploaded into a project they do not manage');
select pg_temp.no_rows(format($q$update public.documents set title = 'hacked' where id = 'f0000000-0000-4000-8000-0000000000f1'$q$),
  'manager edited another project''s document');

select pg_temp.as_user('a0000000-0000-4000-8000-0000000000ff');
select pg_temp.check((select count(*) from public.documents) = 1, 'the other manager sees only their own project''s document');
select pg_temp.check((select count(*) from storage.objects where bucket_id = 'project-documents') = 1,
  'and only their own file');

-- ===========================================================================
-- Anonymous and room deletion
-- ===========================================================================
select pg_temp.as_admin();
set local role anon;
select pg_temp.denied($q$select count(*) from public.documents$q$, 'anon read documents');
reset role;
select pg_temp.as_admin();
do $$
begin
  delete from public.rooms where id = 'd0000000-0000-4000-8000-000000000002';
  raise exception 'FAILED: a room with installation photos was deleted';
exception when foreign_key_violation then null;
end $$;

select 'documents tests passed' as result;
rollback;
