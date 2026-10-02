-- Schema v2 for comms (T33): profile language and phone, invitations, translatable notifications and
-- activity, notification preferences, consents, and deletes that keep project data (GDPR).
--
--   profiles.locale / phone             the saved UI language ('pl' | 'en', the source of truth) and a phone
--   invitations                         project invites; created by a server function only (T40)
--   notifications.params / emailed_at   a stable `kind` + `params` the app translates; title/body are legacy
--   activity_log.params                 { entity, action, label } the app translates; summary is legacy
--   notification_preferences            per user, kind and channel; notification_pref() applies the defaults
--   consents                            privacy policy / terms acceptance: insert-only audit trail
--   messages.sender_id                  `on delete set null`: a deleted user's messages stay, as a "Former member"
--
-- See README "Data deletion (GDPR)" for which rows cascade with a user and which are kept.

-- ---------------------------------------------------------------------------
-- Profiles: language and phone
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column locale text not null default 'pl' check (locale in ('en', 'pl')),
  add column phone text check (phone is null or length(phone) <= 40);

comment on column public.profiles.locale is
  'The saved UI language and the source of truth for it: profile, then the locale cookie, then Accept-Language, then pl. '
  'The app mirrors it onto auth.users user_metadata.locale, which the Supabase Auth email templates read.';

-- Users edit their own name, photo, language and phone; account_type stays admin-only.
grant update (full_name, avatar_url, locale, phone) on public.profiles to authenticated;

-- A language picked at sign-up (user_metadata.locale) becomes the profile's.
create or replace function private.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, full_name, locale)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    case when new.raw_user_meta_data ->> 'locale' in ('en', 'pl') then new.raw_user_meta_data ->> 'locale' else 'pl' end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Invitations (the invite flow itself is T40)
-- ---------------------------------------------------------------------------
create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  email text not null check (email = lower(trim(email)) and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  role public.project_role not null,
  -- Null for a staff-only invite (later).
  project_id uuid references public.projects (id) on delete cascade,
  invited_by uuid references public.profiles (id) on delete set null,
  -- SHA-256 of the token in the invite link; the token itself is never stored.
  token_hash text not null unique,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);
create index invitations_email_idx on public.invitations (lower(email));
create index invitations_project_idx on public.invitations (project_id, created_at desc);

alter table public.invitations enable row level security;

-- Managers read their project's invitations. Clients and other users have no policy, so see none.
create policy "invitations: managers read" on public.invitations
for select to authenticated
using (project_id is not null and public.is_project_manager(project_id));

-- No insert/update/delete for the API roles: a server function creates invitations with the admin
-- client, and managers revoke through revoke_invitation(). token_hash is not readable at all.
revoke all on public.invitations from anon, authenticated;
grant select (id, email, role, project_id, invited_by, expires_at, accepted_at, revoked_at, created_at)
  on public.invitations to authenticated;

-- Revoke a pending invitation (the project's managers only). Returns false when it was already
-- accepted or revoked.
create or replace function public.revoke_invitation(p_invitation uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
declare v_project uuid;
begin
  select i.project_id into v_project from public.invitations i where i.id = p_invitation;
  if v_project is null or not public.is_project_manager(v_project) then
    raise exception 'Only the project''s managers can revoke this invitation' using errcode = '42501';
  end if;
  update public.invitations set revoked_at = now()
  where id = p_invitation and accepted_at is null and revoked_at is null;
  return found;
end;
$$;

-- ---------------------------------------------------------------------------
-- Notifications: stable kind + params
-- ---------------------------------------------------------------------------
-- Kinds and their params (the app renders them through i18n, comms namespace `notifications.*`):
--   stage_status      { stage, status }             status: work_status
--   room_status       { room, status, note }        status: work_status; note: the room's client note
--   photo_published   { caption }
--   render_published  { title, description }
--   schedule_status   { status, note }              status: schedule_status
--   message           { sender, preview, attachment } sender: the sender's name (null if unknown)
--   manual            { title, body }                an announcement, shown as written
alter table public.notifications
  add column params jsonb not null default '{}'::jsonb check (jsonb_typeof(params) = 'object'),
  add column emailed_at timestamptz;

comment on column public.notifications.kind is
  'Stable notification kind: stage_status | room_status | photo_published | render_published | schedule_status | message | manual. '
  'Rows written before T33 carry the old kinds (stage, room, photo, render, schedule); the app shows their title/body.';
comment on column public.notifications.params is 'Values for the kind''s translated text (see the T33 migration for each kind''s keys).';
comment on column public.notifications.title is 'Legacy: English text, still filled for older readers. Render kind + params instead.';
comment on column public.notifications.body is 'Legacy: English text, still filled for older readers. Render kind + params instead.';
comment on column public.notifications.emailed_at is 'When this notification was sent by email (instant or in a digest); null until then.';

drop function private.notify_clients(uuid, text, text, text, text, text, uuid);

create function private.notify_clients(
  p_project uuid, p_kind text, p_params jsonb, p_title text, p_body text, p_link text,
  p_entity_type text, p_entity_id uuid
) returns void language sql security definer set search_path = '' as $$
  insert into public.notifications (project_id, recipient_id, kind, params, title, body, link, entity_type, entity_id, created_by)
  select p_project, m.user_id, p_kind, coalesce(p_params, '{}'::jsonb), p_title, coalesce(p_body, ''), p_link,
         p_entity_type, p_entity_id, auth.uid()
  from public.project_members m
  where m.project_id = p_project and m.role = 'client';
$$;

create or replace function private.notify_on_change()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_table_name = 'stages' then
    if new.is_visible and new.status is distinct from old.status then
      perform private.notify_clients(new.project_id, 'stage_status',
        jsonb_build_object('stage', new.name, 'status', new.status),
        'Stage update: ' || new.name,
        new.name || ' is now ' || lower(private.status_label(new.status)) || '.', '/stages', 'stages', new.id);
    end if;
  elsif tg_table_name = 'rooms' then
    if new.is_visible and new.status is distinct from old.status then
      perform private.notify_clients(new.project_id, 'room_status',
        jsonb_build_object('room', new.name, 'status', new.status, 'note', new.client_note),
        new.name || ' is now ' || lower(private.status_label(new.status)),
        coalesce(nullif(new.client_note, ''), ''), '/plan', 'rooms', new.id);
    end if;
  elsif tg_table_name = 'photos' then
    if new.status = 'published' and (tg_op = 'INSERT' or old.status <> 'published') then
      perform private.notify_clients(new.project_id, 'photo_published',
        jsonb_build_object('caption', new.caption),
        'New site photo', new.caption, '/photos', 'photos', new.id);
    end if;
  elsif tg_table_name = 'renders' then
    if new.is_visible and (tg_op = 'INSERT' or not old.is_visible) then
      perform private.notify_clients(new.project_id, 'render_published',
        jsonb_build_object('title', new.title, 'description', new.description),
        'New design render: ' || new.title, new.description, '/design', 'renders', new.id);
    end if;
  elsif tg_table_name = 'projects' then
    if new.schedule_status is distinct from old.schedule_status then
      perform private.notify_clients(new.id, 'schedule_status',
        jsonb_build_object('status', new.schedule_status, 'note', new.schedule_note),
        'Schedule: ' || case new.schedule_status when 'on_schedule' then 'On schedule'
                         when 'at_risk' then 'At risk' else 'Delayed' end,
        new.schedule_note, '/', 'projects', new.id);
    end if;
  end if;
  return null;
end;
$$;

-- New chat message -> notify every other member.
create or replace function private.notify_message()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_sender text;
begin
  select nullif(full_name, '') into v_sender from public.profiles where id = new.sender_id;
  insert into public.notifications (project_id, recipient_id, kind, params, title, body, link, entity_type, entity_id, created_by)
  select new.project_id, m.user_id, 'message',
         jsonb_build_object('sender', v_sender, 'preview', left(new.body, 140), 'attachment', new.attachment_path is not null),
         'New message from ' || coalesce(v_sender, 'your project'),
         left(coalesce(nullif(new.body, ''), 'Sent an attachment'), 140), '/chat', 'messages', new.id, new.sender_id
  from public.project_members m
  where m.project_id = new.project_id and m.user_id is distinct from new.sender_id;
  return null;
end;
$$;

-- Manual announcement to all clients of a project.
create or replace function public.notify_project_clients(p_project uuid, p_title text, p_body text, p_link text default null)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_project_manager(p_project) then
    raise exception 'Only project managers can send notifications' using errcode = '42501';
  end if;
  perform private.notify_clients(p_project, 'manual',
    jsonb_build_object('title', p_title, 'body', coalesce(p_body, '')),
    p_title, coalesce(p_body, ''), p_link, null, null);
end;
$$;

-- ---------------------------------------------------------------------------
-- Activity log: structured params
-- ---------------------------------------------------------------------------
alter table public.activity_log
  add column params jsonb not null default '{}'::jsonb check (jsonb_typeof(params) = 'object');

comment on column public.activity_log.params is
  '{ entity, action, label }: entity is a stable key (stage, room, task, photo, render, expense, project, internal_notes, '
  'member, ai_knowledge, crew_member, or the table name), action is insert | update | delete, label the row''s name.';
comment on column public.activity_log.summary is 'Legacy: English text. Render params instead.';
comment on column public.activity_log.actor_id is
  'Who made the change. Deliberately no foreign key (like project_id): the audit trail outlives deleted users and projects.';

create or replace function private.log_activity()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  rec jsonb;
  v_project uuid;
  v_label text;
  v_changes jsonb := '{}'::jsonb;
  v_action text := lower(tg_op);
  v_entity text := case tg_table_name
    when 'projects' then 'project'
    when 'project_internal' then 'internal notes'
    when 'project_members' then 'member'
    when 'rooms' then 'room'
    when 'stages' then 'stage'
    when 'tasks' then 'task'
    when 'photos' then 'photo'
    when 'renders' then 'render'
    when 'expenses' then 'expense'
    when 'ai_knowledge' then 'AI knowledge entry'
    when 'project_crew' then 'crew member'
    else tg_table_name end;
  -- Stable key for params.entity (the app translates it).
  v_entity_key text := case tg_table_name
    when 'projects' then 'project'
    when 'project_internal' then 'internal_notes'
    when 'project_members' then 'member'
    when 'rooms' then 'room'
    when 'stages' then 'stage'
    when 'tasks' then 'task'
    when 'photos' then 'photo'
    when 'renders' then 'render'
    when 'expenses' then 'expense'
    when 'ai_knowledge' then 'ai_knowledge'
    when 'project_crew' then 'crew_member'
    else tg_table_name end;
begin
  rec := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  v_project := case when tg_table_name = 'projects' then (rec ->> 'id')::uuid
                    else (rec ->> 'project_id')::uuid end;

  if tg_op = 'UPDATE' then
    select coalesce(jsonb_object_agg(n.key, jsonb_build_object('from', o.value, 'to', n.value)), '{}'::jsonb)
    into v_changes
    from jsonb_each(to_jsonb(new)) n
    join jsonb_each(to_jsonb(old)) o using (key)
    where n.value is distinct from o.value
      and n.key not in ('updated_at', 'spent', 'last_read_at', 'completed_at');
    if v_changes = '{}'::jsonb then
      return null;
    end if;
  end if;

  v_label := left(coalesce(rec ->> 'name', rec ->> 'title', nullif(rec ->> 'caption', ''),
                           rec ->> 'description', rec ->> 'role', ''), 80);

  insert into public.activity_log (project_id, actor_id, action, entity_type, entity_id, summary, changes, params)
  values (
    v_project,
    auth.uid(),
    v_action,
    tg_table_name,
    case when rec ? 'id' then (rec ->> 'id')::uuid
         when rec ? 'user_id' then (rec ->> 'user_id')::uuid
         else v_project end,
    initcap(case tg_op when 'INSERT' then 'added' when 'UPDATE' then 'updated' else 'removed' end)
      || ' ' || v_entity || case when v_label <> '' then ' "' || v_label || '"' else '' end,
    v_changes,
    jsonb_build_object('entity', v_entity_key, 'action', v_action, 'label', v_label)
  );
  return null;
end;
$$;

-- ---------------------------------------------------------------------------
-- Notification preferences (the settings UI is T41)
-- ---------------------------------------------------------------------------
create type public.notification_channel as enum ('in_app', 'email');
create type public.notification_frequency as enum ('instant', 'daily', 'off');

create table public.notification_preferences (
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  kind text not null check (kind ~ '^[a-z_]+$'),
  channel public.notification_channel not null,
  frequency public.notification_frequency not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, kind, channel)
);

create trigger set_updated_at before update on public.notification_preferences
for each row execute function private.set_updated_at();

alter table public.notification_preferences enable row level security;
create policy "notification_preferences: own rows" on public.notification_preferences
for all to authenticated
using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

revoke all on public.notification_preferences from anon;
grant select, insert, update, delete on public.notification_preferences to authenticated;

-- The effective frequency for a user, kind and channel: their saved row, or the default.
--   in_app                         instant
--   email, kind 'message'          instant
--   email, other kinds, client     daily (a digest)
--   email, other kinds, staff      off (staff cause those events themselves: stage changes, photos, ...)
-- Callable by the user for themselves, and by the server (service role, no auth.uid()) for anyone.
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
  if p_channel = 'in_app' or p_kind = 'message' then
    return 'instant';
  end if;
  if exists (select 1 from public.profiles p where p.id = p_user and p.account_type in ('manager', 'admin')) then
    return 'off';
  end if;
  return 'daily';
end;
$$;

-- ---------------------------------------------------------------------------
-- Consents: an insert-only audit trail
-- ---------------------------------------------------------------------------
create table public.consents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  kind text not null check (kind ~ '^[a-z_]+$'), -- 'privacy_policy', 'terms', ...
  version text not null check (length(trim(version)) > 0),
  granted_at timestamptz not null default now(),
  unique (user_id, kind, version)
);

alter table public.consents enable row level security;
create policy "consents: read own" on public.consents
for select to authenticated using (user_id = (select auth.uid()));
create policy "consents: insert own" on public.consents
for insert to authenticated with check (user_id = (select auth.uid()));

-- No update or delete for anyone through the API; granted_at is always the server's now().
revoke all on public.consents from anon, authenticated;
grant select on public.consents to authenticated;
grant insert (user_id, kind, version) on public.consents to authenticated;

-- ---------------------------------------------------------------------------
-- GDPR-safe deletes: a deleted user's messages stay, with no sender
-- ---------------------------------------------------------------------------
-- Personal rows still cascade with the profile: project_members (membership), notifications they
-- received, notification_preferences and consents. Project data keeps its row with the author nulled:
-- messages.sender_id (below), and the already `set null` photos.uploaded_by, expenses.created_by,
-- ai_knowledge.created_by, notifications.created_by, invitations.invited_by and projects.created_by.
alter table public.messages drop constraint messages_sender_id_fkey;
alter table public.messages alter column sender_id drop not null;
alter table public.messages
  add constraint messages_sender_id_fkey foreign key (sender_id) references public.profiles (id) on delete set null;
comment on column public.messages.sender_id is 'The author; null once their account was deleted (shown as "Former member").';

-- ---------------------------------------------------------------------------
-- Privileges
-- ---------------------------------------------------------------------------
revoke execute on all functions in schema private from public, anon, authenticated;
grant execute on function private.path_project_id(text) to authenticated; -- storage policies
grant execute on function private.staff_mfa_ok() to authenticated; -- restrictive policies

revoke execute on function public.notify_project_clients(uuid, text, text, text) from public, anon;
revoke execute on function public.revoke_invitation(uuid) from public, anon;
revoke execute on function public.notification_pref(uuid, text, public.notification_channel) from public, anon;
grant execute on function public.notify_project_clients(uuid, text, text, text), public.revoke_invitation(uuid),
  public.notification_pref(uuid, text, public.notification_channel) to authenticated;
grant execute on function public.notification_pref(uuid, text, public.notification_channel) to service_role;
