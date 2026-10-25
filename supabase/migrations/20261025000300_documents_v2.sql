-- Documents v2 (T62): a simple shelf of final, signed files.
--
--   * No versioning, no archive: a manager deletes a document (row first, then the object, from the
--     deleteDocument server function). version_group, version, is_current, archived_at and archived_by go.
--   * No title: the original file name (file_name) is the title. The description stays optional.
--   * Installation photos are not documents: each one becomes a normal row in `photos` (same room, same work,
--     same upload date; the stage is derived from the work by check_photo_task). documents.room_id/task_id and
--     their guards go. `installation_photos` stays in the enum (an enum value cannot be dropped without
--     rebuilding the type) but nothing uses it.
--   * Housekeeping: log_activity on documents (trigger only), staff writes need 2FA (restrictive policies like
--     expenses), clients get a `document_new` notification (kind + params: { name, category }).
--
-- Data moves (run once, in this order):
--   1. archived rows are deleted (an archived document was hidden from the client; "delete" is the new meaning);
--   2. every remaining installation-photo document becomes a published photo whose storage_path is
--      '<project>/photos/<same file name>': the object itself is copied by scripts/move-installation-photos.ts;
--   3. those documents are deleted. Every other row stays as a plain document, older versions included.
-- The photo triggers that notify clients and write the activity log are switched off for the move, so nobody is
-- told about "new" site photos that already existed.

-- ---------------------------------------------------------------------------
-- 1. Data moves
-- ---------------------------------------------------------------------------
alter table public.photos disable trigger notify_photo;
alter table public.photos disable trigger log_activity;

delete from public.documents where archived_at is not null;

insert into public.photos (
  id, project_id, room_id, task_id, storage_path, alt, caption, taken_at, uploaded_by, status, published_at,
  created_at, updated_at
)
select
  d.id,
  d.project_id,
  d.room_id,
  d.task_id,
  regexp_replace(d.storage_path, '^[^/]+/installation_photos/', d.project_id::text || '/photos/'),
  d.title,
  d.title,
  d.created_at,
  d.uploaded_by,
  'published',
  d.created_at,
  d.created_at,
  d.updated_at
from public.documents d
where d.category = 'installation_photos'
  and d.storage_path like d.project_id::text || '/installation_photos/%';

-- A document of that category with a path outside the convention cannot be mapped; fail loudly instead of
-- deleting it unmoved.
do $$
declare v_unmapped integer;
begin
  select count(*) into v_unmapped
  from public.documents d
  where d.category = 'installation_photos'
    and not exists (select 1 from public.photos p where p.id = d.id);
  if v_unmapped > 0 then
    raise exception 'T62: % installation photo(s) could not be moved into photos', v_unmapped;
  end if;
end $$;

delete from public.documents where category = 'installation_photos';

alter table public.photos enable trigger notify_photo;
alter table public.photos enable trigger log_activity;

-- ---------------------------------------------------------------------------
-- 2. Drop what depended on the removed columns
-- ---------------------------------------------------------------------------
drop policy "documents: managers read, clients read unarchived" on public.documents;
drop policy "documents: managers insert" on public.documents;
drop policy "documents: managers update" on public.documents;
drop policy "documents: clients read unarchived" on storage.objects;

drop trigger a_check_document_refs on public.documents;
drop trigger b_documents_before_insert on public.documents;
drop trigger b_documents_before_update on public.documents;
drop trigger c_documents_after_archive on public.documents;
drop function private.check_document_refs();
drop function private.documents_before_insert();
drop function private.documents_before_update();
drop function private.documents_after_archive();

drop index public.documents_group_idx;
drop index public.documents_one_current_idx;
drop index public.documents_room_idx;
drop index public.documents_task_idx;

-- Dropping a column also drops the check constraints that mention it.
alter table public.documents
  drop column title,
  drop column version_group,
  drop column version,
  drop column is_current,
  drop column room_id,
  drop column task_id,
  drop column archived_at,
  drop column archived_by;

comment on table public.documents is
  'Project documents: a shelf of final files in five categories (contract and amendments, estimate, invoices, warranties, manuals). file_name is the title. Managers read, write and delete; the project''s clients read. installation_photos is unused (the value stays in the enum).';

-- ---------------------------------------------------------------------------
-- 3. RLS + grants
-- ---------------------------------------------------------------------------
create policy "documents: managers and clients read" on public.documents
for select to authenticated
using (public.is_project_manager(project_id) or public.is_project_client(project_id));

create policy "documents: managers insert" on public.documents
for insert to authenticated with check (public.is_project_manager(project_id));

create policy "documents: managers update" on public.documents
for update to authenticated
using (public.is_project_manager(project_id)) with check (public.is_project_manager(project_id));

create policy "documents: managers delete" on public.documents
for delete to authenticated using (public.is_project_manager(project_id));

-- Staff writes need a 2FA session (aal2), like expenses (20260930000200_auth_hardening.sql). Restrictive policies
-- are ANDed with the permissive ones above. Reads stay open to AAL1 sessions (clients never have 2FA).
create policy "documents: staff mfa insert" on public.documents
as restrictive for insert to authenticated with check ((select private.staff_mfa_ok()));
create policy "documents: staff mfa delete" on public.documents
as restrictive for delete to authenticated using ((select private.staff_mfa_ok()));

revoke all on public.documents from anon, authenticated;
grant select, delete on public.documents to authenticated;
grant insert (project_id, category, description, storage_path, file_name, mime_type, size_bytes)
  on public.documents to authenticated;
grant update (description) on public.documents to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Storage: private bucket 'project-documents'
-- ---------------------------------------------------------------------------
-- A client reads the file a document row points at; an object without a row (a failed upload, a deleted
-- document, an installation photo not yet copied) stays hidden. The existing manager policies stay: read,
-- upload, and delete of an object no row points at (which is what deleteDocument does after the row delete).
create policy "documents: clients read" on storage.objects
for select to authenticated
using (
  bucket_id = 'project-documents'
  and public.is_project_client(private.path_project_id(name))
  and exists (select 1 from public.documents d where d.storage_path = name)
);

create policy "documents: staff mfa upload" on storage.objects
as restrictive for insert to authenticated
with check (bucket_id <> 'project-documents' or (select private.staff_mfa_ok()));
create policy "documents: staff mfa delete" on storage.objects
as restrictive for delete to authenticated
using (bucket_id <> 'project-documents' or (select private.staff_mfa_ok()));

-- ---------------------------------------------------------------------------
-- 5. Activity log + client notification
-- ---------------------------------------------------------------------------
-- Trigger only: private.log_activity() is not redefined here (the coordinator adds the 'document' label).
create trigger log_activity after insert or update or delete on public.documents
for each row execute function private.log_activity();

-- Notification kind `document_new`, params { name, category }: the app renders it through i18n (comms namespace).
create or replace function private.notify_document_new()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform private.notify_clients(
    new.project_id, 'document_new',
    jsonb_build_object('name', new.file_name, 'category', new.category),
    'New document: ' || new.file_name, new.description, '/documents', 'documents', new.id
  );
  return null;
end;
$$;

create trigger notify_document after insert on public.documents
for each row execute function private.notify_document_new();

revoke execute on function private.notify_document_new() from public, anon, authenticated;
