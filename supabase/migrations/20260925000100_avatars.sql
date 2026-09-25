-- Profile photos (Settings page in the manager portal; the client app can reuse it).
--
--   avatars  <user_id>/<file>   public read (shown next to names in chat, team, etc.)
--
-- Users may only write inside their own folder. profiles.avatar_url stores the public URL.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "avatars: read own folder" on storage.objects
for select to authenticated
using (bucket_id = 'avatars' and split_part(name, '/', 1) = (select auth.uid())::text);

create policy "avatars: upload to own folder" on storage.objects
for insert to authenticated
with check (bucket_id = 'avatars' and split_part(name, '/', 1) = (select auth.uid())::text);

create policy "avatars: replace own files" on storage.objects
for update to authenticated
using (bucket_id = 'avatars' and split_part(name, '/', 1) = (select auth.uid())::text)
with check (bucket_id = 'avatars' and split_part(name, '/', 1) = (select auth.uid())::text);

create policy "avatars: delete own files" on storage.objects
for delete to authenticated
using (bucket_id = 'avatars' and split_part(name, '/', 1) = (select auth.uid())::text);
