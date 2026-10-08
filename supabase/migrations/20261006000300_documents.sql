-- Project documents (#58): six fixed categories, private storage bucket, versioned contract/estimate.
--
--   documents            one row per uploaded file. Managers read/write; the project's clients read every
--                        row that is not archived. There is no anonymous access and no DELETE: a manager
--                        archives (archived_at), nothing is hard-deleted from the API.
--   project-documents    private bucket, '<project_id>/<category>/<uuid>.<ext>'. Managers insert; members read
--                        through signed URLs (clients only while the row is not archived).
--
-- Versioning (contract, estimate): rows of one document share a version_group. Uploading a new version inserts a
-- row into the same group; the trigger numbers it, makes it the single current one and keeps the old rows as
-- history. Invariants (enforced here, tested in tests/db/documents.test.sql):
--   * at most one is_current row per (project, category, version_group)  -- partial unique index
--   * a current row is never archived; archiving the current version promotes the newest non-archived older one
--   * other categories are one-row groups (version 1, current)
-- Documents created from investor decisions (#55) are NOT added automatically: only this upload path writes here.

create type public.document_category as enum (
  'contract', 'estimate', 'invoices', 'installation_photos', 'warranties', 'manuals'
);

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  category public.document_category not null,
  title text not null check (length(trim(title)) between 1 and 200),
  description text not null default '' check (length(description) <= 2000),
  storage_path text not null, -- bucket 'project-documents', '<project_id>/<category>/<uuid>.<ext>'
  file_name text not null check (length(trim(file_name)) between 1 and 255),
  mime_type text not null check (mime_type in (
    'application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  )),
  size_bytes bigint not null check (size_bytes > 0 and size_bytes <= 26214400), -- 25 MB
  -- Versions of one document (contract, estimate). Any other category is its own one-row group.
  version_group uuid not null default gen_random_uuid(),
  version integer not null default 1 check (version >= 1),
  is_current boolean not null default true,
  -- Installation photos: the room is required, the work (a task) optional.
  room_id uuid references public.rooms (id),
  task_id uuid references public.tasks (id) on delete set null,
  uploaded_by uuid default auth.uid() references public.profiles (id) on delete set null,
  archived_at timestamptz,
  archived_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (storage_path),
  check (storage_path like project_id::text || '/%'),
  check (category in ('contract', 'estimate') or version = 1),
  check (not (is_current and archived_at is not null)),
  check (category = 'installation_photos' or (room_id is null and task_id is null)),
  check (category <> 'installation_photos' or room_id is not null)
);
create index documents_project_idx on public.documents (project_id, category, created_at desc);
create index documents_group_idx on public.documents (project_id, version_group, version desc);
create index documents_room_idx on public.documents (room_id) where room_id is not null;
create index documents_task_idx on public.documents (task_id) where task_id is not null;
-- Exactly one current version per document.
create unique index documents_one_current_idx on public.documents (project_id, category, version_group) where is_current;

comment on table public.documents is
  'Project documents in six categories. Managers read/write and archive (no delete); clients read non-archived rows. Contract and estimate are versioned by version_group + is_current.';
comment on column public.documents.room_id is
  'Installation photos only. NO ACTION on delete: a room that still has installation photos cannot be deleted until they are moved.';

-- ---------------------------------------------------------------------------
-- Guards and version bookkeeping (security definer: they touch other rows of the group)
-- ---------------------------------------------------------------------------
-- The room and the work belong to the document's project, and the file lives under the project's folder.
create or replace function private.check_document_refs()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.room_id is not null and not exists (
    select 1 from public.rooms r where r.id = new.room_id and r.project_id = new.project_id
  ) then
    raise exception 'Document room must belong to the same project' using errcode = '23514';
  end if;
  if new.task_id is not null and not exists (
    select 1 from public.tasks t where t.id = new.task_id and t.project_id = new.project_id
  ) then
    raise exception 'Document work must belong to the same project' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger a_check_document_refs before insert or update of project_id, room_id, task_id on public.documents
for each row execute function private.check_document_refs();

-- Before insert: number the new row and make it the only current one of its group.
create or replace function private.documents_before_insert()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_max integer;
begin
  new.is_current := true;
  new.archived_at := null;
  new.archived_by := null;
  if new.category not in ('contract', 'estimate') then
    new.version_group := gen_random_uuid();
    new.version := 1;
    return new;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(new.version_group::text, 0));
  -- A group id of another project or category is refused (it would let one project flip another's versions).
  if exists (
    select 1 from public.documents d
    where d.version_group = new.version_group and (d.project_id <> new.project_id or d.category <> new.category)
  ) then
    raise exception 'Version group belongs to another project or category' using errcode = '23514';
  end if;

  select max(d.version) into v_max from public.documents d where d.version_group = new.version_group;
  new.version := coalesce(v_max, 0) + 1;
  update public.documents set is_current = false where version_group = new.version_group and is_current;
  return new;
end;
$$;

create trigger b_documents_before_insert before insert on public.documents
for each row execute function private.documents_before_insert();

-- Before update: archive bookkeeping. A current row that is archived stops being current; an archived row that is
-- restored becomes current again only when its group has no current row left.
create or replace function private.documents_before_update()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.archived_at is not null and old.archived_at is null then
    perform pg_advisory_xact_lock(hashtextextended(new.version_group::text, 0));
    new.archived_by := (select auth.uid());
    new.is_current := false;
  elsif new.archived_at is null and old.archived_at is not null then
    perform pg_advisory_xact_lock(hashtextextended(new.version_group::text, 0));
    new.archived_by := null;
    new.is_current := not exists (
      select 1 from public.documents d where d.version_group = new.version_group and d.is_current and d.id <> new.id
    );
  end if;
  return new;
end;
$$;

create trigger b_documents_before_update before update of archived_at on public.documents
for each row execute function private.documents_before_update();

-- After update: archiving the current version promotes the newest non-archived older one.
create or replace function private.documents_after_archive()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if old.is_current and not new.is_current and new.archived_at is not null then
    update public.documents set is_current = true
    where id = (
      select d.id from public.documents d
      where d.version_group = new.version_group and d.id <> new.id and d.archived_at is null
      order by d.version desc limit 1
    );
  end if;
  return null;
end;
$$;

create trigger c_documents_after_archive after update of archived_at on public.documents
for each row execute function private.documents_after_archive();

create trigger set_updated_at before update on public.documents
for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS + grants
-- ---------------------------------------------------------------------------
alter table public.documents enable row level security;

create policy "documents: managers read, clients read unarchived" on public.documents
for select to authenticated
using (public.is_project_manager(project_id) or (archived_at is null and public.is_project_client(project_id)));

create policy "documents: managers insert" on public.documents
for insert to authenticated with check (public.is_project_manager(project_id));

create policy "documents: managers update" on public.documents
for update to authenticated
using (public.is_project_manager(project_id)) with check (public.is_project_manager(project_id));

-- No delete policy and no delete privilege: archive instead. Column grants keep the file, version and ownership
-- columns immutable from the API (the triggers above write version/is_current/archived_by as the table owner).
revoke all on public.documents from anon, authenticated;
grant select on public.documents to authenticated;
grant insert (project_id, category, title, description, storage_path, file_name, mime_type, size_bytes, version_group, room_id, task_id)
  on public.documents to authenticated;
grant update (title, description, room_id, task_id, archived_at) on public.documents to authenticated;

-- ---------------------------------------------------------------------------
-- Storage: private bucket 'project-documents'
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'project-documents', 'project-documents', false, 26214400,
  array[
    'application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ]
)
on conflict (id) do nothing;

create policy "documents: managers read" on storage.objects
for select to authenticated
using (bucket_id = 'project-documents' and public.is_project_manager(private.path_project_id(name)));

-- documents' own RLS already hides archived rows from clients; the explicit filter keeps this policy honest.
create policy "documents: clients read unarchived" on storage.objects
for select to authenticated
using (
  bucket_id = 'project-documents'
  and public.is_project_client(private.path_project_id(name))
  and exists (
    select 1 from public.documents d where d.storage_path = name and d.archived_at is null
  )
);

create policy "documents: managers upload" on storage.objects
for insert to authenticated
with check (bucket_id = 'project-documents' and public.is_project_manager(private.path_project_id(name)));

-- Only an orphan (an upload whose row insert failed) can be removed; a file a document points at is kept forever.
create policy "documents: managers delete orphans" on storage.objects
for delete to authenticated
using (
  bucket_id = 'project-documents'
  and public.is_project_manager(private.path_project_id(name))
  and not exists (select 1 from public.documents d where d.storage_path = name)
);
