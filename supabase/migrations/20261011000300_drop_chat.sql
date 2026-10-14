-- T66: remove the in-app chat (conversations move to WhatsApp).
--
-- Drops, in order:
--   * `messages` from the realtime publication, then the table itself (its policies, grants, indexes and the
--     `notify_message` trigger go with it) and the trigger function private.notify_message(),
--   * public.mark_chat_read(): it only moved project_members.last_read_at, which nothing reads or writes now
--     (the column stays; T50 decides whether to drop it),
--   * the chat-attachment storage policy, and the `chat` folder branch of "media: clients read published",
--   * the `message` notifications already sent (the kind is gone from the app).
--
-- Kept on purpose: the `ai_knowledge` table (the Knowledge page and the rule-based assistant are gone from the
-- app; T50 drops the table). private.log_activity is not touched.

-- Notifications of the removed kind.
delete from public.notifications where kind = 'message';

comment on column public.notifications.kind is
  'Stable notification kind: stage_status | room_status | photo_published | render_published | schedule_status | manual | decision_*. '
  'Rows written before T33 carry the old kinds (stage, room, photo, render, schedule); the app shows their title/body.';

-- Realtime: stop streaming messages before the table goes.
do $$
begin
  if exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'messages') then
    alter publication supabase_realtime drop table public.messages;
  end if;
end $$;

-- The trigger, its function and the read marker.
drop trigger if exists notify_message on public.messages;
drop function if exists private.notify_message();
drop function if exists public.mark_chat_read(uuid);

-- The table. Policies, grants, indexes and constraints are dropped with it.
drop table public.messages;

-- Storage: nobody uploads to <project>/chat/ any more, and clients no longer get a blanket read there.
drop policy "media: members upload chat attachments" on storage.objects;

drop policy "media: clients read published" on storage.objects;
create policy "media: clients read published" on storage.objects
for select to authenticated
using (
  bucket_id = 'project-media'
  and public.is_project_client(private.path_project_id(name))
  and (
    -- photos/renders RLS already restricts clients to published/visible rows
    exists (select 1 from public.photos p where p.storage_path = name)
    or exists (select 1 from public.renders r where r.storage_path = name)
  )
);

-- notification_pref(): the default no longer special-cases the removed `message` kind (it used to email those
-- instantly). Same signature, so the grants stay.
create or replace function public.notification_pref(
  p_user uuid, p_kind text, p_channel public.notification_channel
) returns public.notification_frequency language plpgsql stable security definer set search_path = '' as $$
declare v_freq public.notification_frequency;
begin
  if (select auth.uid()) is not null and p_user is distinct from (select auth.uid()) then
    raise exception 'You can only read your own notification preferences' using errcode = '42501';
  end if;
  select np.frequency into v_freq from public.notification_preferences np
  where np.user_id = p_user and np.kind = p_kind and np.channel = p_channel;
  if found then
    return v_freq;
  end if;
  if p_channel = 'in_app' then
    return 'instant';
  end if;
  if exists (select 1 from public.profiles p where p.id = p_user and p.account_type in ('manager', 'admin')) then
    return 'off';
  end if;
  return 'daily';
end;
$$;
