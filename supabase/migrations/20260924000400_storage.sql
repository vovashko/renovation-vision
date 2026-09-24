-- Storage: one folder per project.
--
--   project-media     <project_id>/photos/<file>    site photos (drafts hidden from clients)
--                     <project_id>/renders/<file>   design renders
--                     <project_id>/chat/<file>      chat attachments (any member)
--   project-internal  <project_id>/receipts/<file>  expense receipts (managers only)
--
-- Both buckets are private; apps use signed URLs (createSignedUrl), which honour these policies.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('project-media', 'project-media', false, 15728640,
   array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf']),
  ('project-internal', 'project-internal', false, 15728640,
   array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
on conflict (id) do nothing;

-- project-media: read
create policy "media: managers read" on storage.objects
for select to authenticated
using (bucket_id = 'project-media' and public.is_project_manager(private.path_project_id(name)));

create policy "media: clients read published" on storage.objects
for select to authenticated
using (
  bucket_id = 'project-media'
  and public.is_project_client(private.path_project_id(name))
  and (
    split_part(name, '/', 2) = 'chat'
    -- photos/renders RLS already restricts clients to published/visible rows
    or exists (select 1 from public.photos p where p.storage_path = name)
    or exists (select 1 from public.renders r where r.storage_path = name)
  )
);

-- project-media: write
create policy "media: managers write" on storage.objects
for insert to authenticated
with check (bucket_id = 'project-media' and public.is_project_manager(private.path_project_id(name)));

create policy "media: members upload chat attachments" on storage.objects
for insert to authenticated
with check (
  bucket_id = 'project-media'
  and split_part(name, '/', 2) = 'chat'
  and public.is_project_member(private.path_project_id(name))
);

create policy "media: managers update" on storage.objects
for update to authenticated
using (bucket_id = 'project-media' and public.is_project_manager(private.path_project_id(name)))
with check (bucket_id = 'project-media' and public.is_project_manager(private.path_project_id(name)));

create policy "media: managers delete" on storage.objects
for delete to authenticated
using (bucket_id = 'project-media' and public.is_project_manager(private.path_project_id(name)));

-- project-internal: managers only, every operation
create policy "internal: managers all" on storage.objects
for all to authenticated
using (bucket_id = 'project-internal' and public.is_project_manager(private.path_project_id(name)))
with check (bucket_id = 'project-internal' and public.is_project_manager(private.path_project_id(name)));
