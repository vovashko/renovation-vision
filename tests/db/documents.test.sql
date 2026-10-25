-- Project documents (#58, simplified in T62): a shelf of final files. No versioning, no archive, the file name is
-- the title, managers delete, clients read everything of their project, staff writes need 2FA, a document_new
-- notification and the activity log. Run against a freshly seeded database with `bun run test:db`
-- (see tests/db/README.md); everything is rolled back. Prints "documents tests passed" on success; any failed
-- assertion aborts with an error. The data move of the migration is checked by
-- tests/db/documents-v2-migration.check.sql (it needs a database at the previous migration).

begin;

create or replace function pg_temp.as_user_aal(p_user uuid, p_aal text) returns void language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claim.sub', p_user::text, true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', p_user, 'role', 'authenticated', 'aal', p_aal)::text, true);
end $$;

create or replace function pg_temp.as_user(p_user uuid) returns void language plpgsql as $$
begin
  perform pg_temp.as_user_aal(p_user, 'aal2');
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

-- A document in project 1 (the demo project).
create or replace function pg_temp.add_doc(p_name text, p_category public.document_category) returns uuid
language plpgsql as $$
declare v_id uuid;
begin
  insert into public.documents (project_id, category, storage_path, file_name, mime_type, size_bytes)
  values ('b0000000-0000-4000-8000-000000000001', p_category,
          'b0000000-0000-4000-8000-000000000001/' || p_category || '/' || gen_random_uuid() || '.pdf', p_name || '.pdf',
          'application/pdf', 1024)
  returning id into v_id;
  return v_id;
end $$;

-- An unrelated manager with their own project.
insert into auth.users (id, email, aud, role) values
  ('a0000000-0000-4000-8000-0000000000ff', 'other@renovision.demo', 'authenticated', 'authenticated');
insert into public.profiles (id, full_name, account_type)
values ('a0000000-0000-4000-8000-0000000000ff', 'Other Manager', 'admin')
on conflict (id) do update set account_type = 'admin';

select pg_temp.as_user('a0000000-0000-4000-8000-0000000000ff');
select public.create_project('Elm Road House');
select pg_temp.as_admin();
create temp table other_project as select id from public.projects where name = 'Elm Road House';
grant select on other_project to public;
create temp table ids (name text primary key, id uuid);
grant all on ids to public;
-- A document of the other project, written as the table owner.
insert into public.documents (id, project_id, category, storage_path, file_name, mime_type, size_bytes)
select 'f0000000-0000-4000-8000-0000000000f1', id, 'contract', id || '/contract/o.pdf', 'o.pdf', 'application/pdf', 5 from other_project;

-- ===========================================================================
-- Shape
-- ===========================================================================
select pg_temp.check(
  (select string_agg(e::text, ',' order by e) from unnest(enum_range(null::public.document_category)) e)
  = 'contract,estimate,invoices,installation_photos,warranties,manuals',
  'the enum keeps installation_photos (unused), so the value list is unchanged');
select pg_temp.check(not exists (
  select 1 from information_schema.columns
  where table_schema = 'public' and table_name = 'documents'
    and column_name in ('title', 'version_group', 'version', 'is_current', 'room_id', 'task_id', 'archived_at', 'archived_by')),
  'versioning, archive, title, room and task columns are gone');
select pg_temp.check(not exists (
  select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'private'
    and p.proname in ('check_document_refs', 'documents_before_insert', 'documents_before_update', 'documents_after_archive')),
  'the versioning and room/task guard functions are gone');
select pg_temp.check((select not public from storage.buckets where id = 'project-documents'), 'the documents bucket is private');
select pg_temp.check((select file_size_limit from storage.buckets where id = 'project-documents') = 26214400, 'bucket limit is 25 MB');
select pg_temp.check((select cardinality(allowed_mime_types) from storage.buckets where id = 'project-documents') = 6,
  'bucket allows pdf, jpeg, png, webp, docx, xlsx');

-- ===========================================================================
-- Manager: upload, edit the description, delete
-- ===========================================================================
select pg_temp.as_user('a0000000-0000-4000-8000-000000000001');

insert into ids (name, id) values ('c1', pg_temp.add_doc('Contract', 'contract'));
insert into ids (name, id) values ('c2', pg_temp.add_doc('Annex 1', 'contract'));
insert into ids (name, id) values ('i1', pg_temp.add_doc('Invoice 1', 'invoices'));
insert into ids (name, id) values ('i2', pg_temp.add_doc('Invoice 2', 'invoices'));
insert into ids (name, id) values ('m1', pg_temp.add_doc('Boiler manual', 'manuals'));
select pg_temp.check((select count(*) from public.documents where category = 'contract' and project_id = 'b0000000-0000-4000-8000-000000000001') = 2,
  'an amendment is just another contract file (no versions)');
select pg_temp.check((select file_name = 'Contract.pdf' from public.documents where id = (select id from ids where name = 'c1')),
  'the file name is kept as the title');

update public.documents set description = 'Signed 12 Oct' where id = (select id from ids where name = 'c1');
select pg_temp.check((select description = 'Signed 12 Oct' from public.documents where id = (select id from ids where name = 'c1')),
  'manager edits the description');
select pg_temp.denied(format($q$update public.documents set file_name = 'x.pdf' where id = %L$q$, (select id from ids where name = 'c1')),
  'manager renamed a document');
select pg_temp.denied(format($q$update public.documents set storage_path = 'x' where id = %L$q$, (select id from ids where name = 'c1')),
  'manager rewrote storage_path');
select pg_temp.denied(format($q$update public.documents set project_id = %L where id = %L$q$, (select id from other_project),
  (select id from ids where name = 'c1')), 'manager moved a document to another project');

-- Upload hardening.
select pg_temp.rejected($q$insert into public.documents (project_id, category, storage_path, file_name, mime_type, size_bytes)
  values ('b0000000-0000-4000-8000-000000000001', 'manuals', 'b0000000-0000-4000-8000-000000000001/manuals/a.exe', 'a.exe', 'application/x-msdownload', 10)$q$,
  'a disallowed mime type');
select pg_temp.rejected($q$insert into public.documents (project_id, category, storage_path, file_name, mime_type, size_bytes)
  values ('b0000000-0000-4000-8000-000000000001', 'manuals', 'b0000000-0000-4000-8000-000000000001/manuals/a.heic', 'a.heic', 'image/heic', 10)$q$,
  'HEIC (converted to JPEG in the browser)');
select pg_temp.rejected($q$insert into public.documents (project_id, category, storage_path, file_name, mime_type, size_bytes)
  values ('b0000000-0000-4000-8000-000000000001', 'manuals', 'b0000000-0000-4000-8000-000000000001/manuals/b.pdf', 'b.pdf', 'application/pdf', 26214401)$q$,
  'a file over 25 MB');
select pg_temp.rejected($q$insert into public.documents (project_id, category, storage_path, file_name, mime_type, size_bytes)
  values ('b0000000-0000-4000-8000-000000000001', 'manuals', 'b0000000-0000-4000-8000-000000000001/manuals/c.pdf', '   ', 'application/pdf', 10)$q$,
  'a blank file name');
select pg_temp.rejected($q$insert into public.documents (project_id, category, storage_path, file_name, mime_type, size_bytes)
  values ('b0000000-0000-4000-8000-000000000001', 'manuals', 'b0000000-0000-4000-8000-0000000000aa/manuals/d.pdf', 'd.pdf', 'application/pdf', 10)$q$,
  'a storage path outside the project folder');

-- Delete works.
delete from public.documents where id = (select id from ids where name = 'i2');
select pg_temp.check((select count(*) from public.documents where id = (select id from ids where name = 'i2')) = 0, 'manager deletes a document');

-- ===========================================================================
-- Notification + activity log
-- ===========================================================================
select pg_temp.as_admin();
select pg_temp.check(
  (select count(*) from public.notifications n where n.kind = 'document_new' and n.entity_id = (select id from ids where name = 'm1'))
  = (select count(*) from public.project_members where project_id = 'b0000000-0000-4000-8000-000000000001' and role = 'client'),
  'every client of the project gets one document_new notification');
select pg_temp.check(
  (select bool_and(n.params ->> 'name' = 'Boiler manual.pdf' and n.params ->> 'category' = 'manuals' and n.link = '/documents'
                   and n.recipient_id in (select user_id from public.project_members where role = 'client'))
   from public.notifications n where n.kind = 'document_new' and n.entity_id = (select id from ids where name = 'm1')),
  'document_new carries the file name and category and goes to clients only');
select pg_temp.check(
  (select count(*) from public.notifications n where n.kind = 'document_new'
     and n.recipient_id = 'a0000000-0000-4000-8000-000000000001') = 0,
  'the manager is not notified');
select pg_temp.check((select count(*) from public.activity_log where entity_type = 'documents' and action = 'insert') >= 5,
  'documents inserts are written to the activity log');
select pg_temp.check((select count(*) from public.activity_log where entity_type = 'documents' and action = 'delete') = 1,
  'and the delete');

-- ===========================================================================
-- Staff 2FA: an AAL1 manager cannot add or delete, an AAL2 one can
-- ===========================================================================
update private.app_settings set enforce_staff_mfa = true;
select pg_temp.as_user_aal('a0000000-0000-4000-8000-000000000001', 'aal1');
select pg_temp.denied($q$insert into public.documents (project_id, category, storage_path, file_name, mime_type, size_bytes)
  values ('b0000000-0000-4000-8000-000000000001', 'manuals', 'b0000000-0000-4000-8000-000000000001/manuals/aal1.pdf', 'aal1.pdf', 'application/pdf', 10)$q$,
  'an AAL1 manager added a document');
select pg_temp.no_rows(format($q$delete from public.documents where id = %L$q$, (select id from ids where name = 'i1')),
  'an AAL1 manager deleted a document');
select pg_temp.denied($q$insert into storage.objects (bucket_id, name) values ('project-documents', 'b0000000-0000-4000-8000-000000000001/manuals/aal1.pdf')$q$,
  'an AAL1 manager uploaded a file');
select pg_temp.check((select count(*) from public.documents where project_id = 'b0000000-0000-4000-8000-000000000001') > 0,
  'an AAL1 manager can still read');
select pg_temp.as_user_aal('a0000000-0000-4000-8000-000000000001', 'aal2');
insert into ids (name, id) values ('aal2', pg_temp.add_doc('Two factor', 'estimate'));
delete from public.documents where id = (select id from ids where name = 'aal2');
select pg_temp.check((select count(*) from public.documents where id = (select id from ids where name = 'aal2')) = 0,
  'an AAL2 manager adds and deletes');
select pg_temp.as_admin();
update private.app_settings set enforce_staff_mfa = false;

-- ===========================================================================
-- Client: Sarah reads every document of her project and nothing else; read-only
-- ===========================================================================
select pg_temp.as_user_aal('a0000000-0000-4000-8000-000000000002', 'aal1');
select pg_temp.check((select count(*) from public.documents)
  = (select count(*) from public.documents where project_id = 'b0000000-0000-4000-8000-000000000001'),
  'client sees only the project''s documents');
select pg_temp.check((select count(*) from public.documents) = 4, 'client reads all four documents (contract, annex, invoice, manual)');
select pg_temp.check((select count(*) from public.documents where project_id = (select id from other_project)) = 0,
  'client sees nothing of other projects');
select pg_temp.denied($q$insert into public.documents (project_id, category, storage_path, file_name, mime_type, size_bytes)
  values ('b0000000-0000-4000-8000-000000000001', 'manuals', 'b0000000-0000-4000-8000-000000000001/manuals/client.pdf', 'client.pdf', 'application/pdf', 10)$q$,
  'client uploaded a document');
select pg_temp.no_rows(format($q$update public.documents set description = 'hacked' where id = %L$q$, (select id from ids where name = 'i1')),
  'client edited a document');
select pg_temp.no_rows(format($q$delete from public.documents where id = %L$q$, (select id from ids where name = 'i1')),
  'client deleted a document');

-- ===========================================================================
-- Storage
-- ===========================================================================
-- What the Storage API does for a delete (storage.protect_delete refuses direct SQL deletes otherwise).
select set_config('storage.allow_delete_query', 'true', true);
select pg_temp.as_admin();
insert into storage.objects (bucket_id, name)
select 'project-documents', storage_path from public.documents where project_id = 'b0000000-0000-4000-8000-000000000001';
insert into storage.objects (bucket_id, name) select 'project-documents', id || '/contract/o.pdf' from other_project;
insert into storage.objects (bucket_id, name) values ('project-documents', 'b0000000-0000-4000-8000-000000000001/manuals/orphan.pdf');
select pg_temp.as_user_aal('a0000000-0000-4000-8000-000000000002', 'aal1');
select pg_temp.check((select count(*) from storage.objects where bucket_id = 'project-documents')
  = (select count(*) from public.documents where project_id = 'b0000000-0000-4000-8000-000000000001'),
  'client reads the files of the project''s documents only (not orphans or other projects'')');
select pg_temp.denied($q$insert into storage.objects (bucket_id, name) values ('project-documents', 'b0000000-0000-4000-8000-000000000001/manuals/c.pdf')$q$,
  'client uploaded to the documents bucket');
select pg_temp.no_rows($q$delete from storage.objects where bucket_id = 'project-documents'$q$, 'client deleted documents files');

select pg_temp.as_user('a0000000-0000-4000-8000-000000000001');
select pg_temp.denied($q$insert into storage.objects (bucket_id, name) values ('project-documents', 'a0000000-0000-4000-8000-0000000000aa/manuals/x.pdf')$q$,
  'manager uploaded outside a project they manage');
select pg_temp.no_rows(format($q$delete from storage.objects where bucket_id = 'project-documents' and name = %L$q$,
  (select storage_path from public.documents where id = (select id from ids where name = 'i1'))),
  'manager deleted a file a document still points at');
-- The server function's order: row first, then the (now orphan) object.
create temp table i1_path as select storage_path from public.documents where id = (select id from ids where name = 'i1');
grant select on i1_path to public;
delete from public.documents where id = (select id from ids where name = 'i1');
delete from storage.objects where bucket_id = 'project-documents' and name = (select storage_path from i1_path);
select pg_temp.check((select count(*) from storage.objects where name = (select storage_path from i1_path)) = 0, 'manager removes the object after the row');
delete from storage.objects where bucket_id = 'project-documents' and name = 'b0000000-0000-4000-8000-000000000001/manuals/orphan.pdf';
select pg_temp.check((select count(*) from storage.objects where name like '%/orphan.pdf') = 0, 'manager removes an orphan upload');

-- ===========================================================================
-- Cross-project isolation
-- ===========================================================================
select pg_temp.check((select count(*) from public.documents where project_id = (select id from other_project)) = 0,
  'manager of project 1 cannot read the other project''s documents');
select pg_temp.denied(format($q$insert into public.documents (project_id, category, storage_path, file_name, mime_type, size_bytes)
  values (%L, 'manuals', %L, 'x.pdf', 'application/pdf', 10)$q$, (select id from other_project), (select id from other_project) || '/manuals/x.pdf'),
  'manager uploaded into a project they do not manage');
select pg_temp.no_rows($q$update public.documents set description = 'hacked' where id = 'f0000000-0000-4000-8000-0000000000f1'$q$,
  'manager edited another project''s document');
select pg_temp.no_rows($q$delete from public.documents where id = 'f0000000-0000-4000-8000-0000000000f1'$q$,
  'manager deleted another project''s document');

select pg_temp.as_user('a0000000-0000-4000-8000-0000000000ff');
select pg_temp.check((select count(*) from public.documents) = 1, 'the other manager sees only their own project''s document');

-- ===========================================================================
-- Anonymous, and a room can be deleted (no installation-photo block any more)
-- ===========================================================================
select pg_temp.as_admin();
set local role anon;
select pg_temp.denied($q$select count(*) from public.documents$q$, 'anon read documents');
reset role;
select pg_temp.as_admin();
delete from public.rooms where id = 'd0000000-0000-4000-8000-000000000002';
select pg_temp.check(not exists (select 1 from public.rooms where id = 'd0000000-0000-4000-8000-000000000002'),
  'a room can be deleted: documents no longer reference rooms');

select 'documents tests passed' as result;
rollback;
