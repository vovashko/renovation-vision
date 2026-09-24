-- Helpers, integrity triggers, activity log, notifications and RPCs.
-- Security-definer functions pin search_path to '' and fully qualify every name.

-- ---------------------------------------------------------------------------
-- Membership helpers (security definer so policies on project_members don't recurse)
-- ---------------------------------------------------------------------------
create or replace function public.is_project_member(p_project uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.project_members m
    where m.project_id = p_project and m.user_id = (select auth.uid())
  );
$$;

create or replace function public.is_project_manager(p_project uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.project_members m
    where m.project_id = p_project and m.user_id = (select auth.uid()) and m.role = 'manager'
  );
$$;

create or replace function public.is_project_client(p_project uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.project_members m
    where m.project_id = p_project and m.user_id = (select auth.uid()) and m.role = 'client'
  );
$$;

create or replace function public.shares_project_with(p_user uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.project_members a
    join public.project_members b on b.project_id = a.project_id
    where a.user_id = (select auth.uid()) and b.user_id = p_user
  );
$$;

-- Storage object names are '<project_id>/<folder>/<file>'. Returns null when not a uuid.
create or replace function private.path_project_id(p_name text)
returns uuid language plpgsql immutable set search_path = '' as $$
begin
  return split_part(p_name, '/', 1)::uuid;
exception when others then
  return null;
end;
$$;

-- ---------------------------------------------------------------------------
-- updated_at
-- ---------------------------------------------------------------------------
create or replace function private.set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array['profiles','projects','project_internal','rooms','stages','tasks',
                           'photos','renders','expenses','ai_knowledge']
  loop
    execute format(
      'create trigger set_updated_at before update on public.%I
       for each row execute function private.set_updated_at()', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- New auth user -> profile
-- ---------------------------------------------------------------------------
create or replace function private.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function private.handle_new_user();

-- ---------------------------------------------------------------------------
-- Integrity
-- ---------------------------------------------------------------------------

-- tasks.project_id always equals its stage's project; room must be in the same project.
create or replace function private.sync_task_project()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_project uuid;
begin
  select s.project_id into v_project from public.stages s where s.id = new.stage_id;
  new.project_id := v_project;
  if new.room_id is not null and not exists (
    select 1 from public.rooms r where r.id = new.room_id and r.project_id = v_project
  ) then
    raise exception 'Task room must belong to the same project' using errcode = '23514';
  end if;
  if new.done and (tg_op = 'INSERT' or not old.done) then
    new.completed_at := coalesce(new.completed_at, now());
  elsif not new.done then
    new.completed_at := null;
  end if;
  return new;
end;
$$;

create trigger sync_task_project before insert or update on public.tasks
for each row execute function private.sync_task_project();

-- A room can't be "Completed" while tasks linked to it are still open
-- (the Bathroom 100% vs. "Bathroom tiling" unchecked inconsistency).
create or replace function private.guard_room_done()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_open text;
begin
  if new.status = 'done' then
    select string_agg(t.name, ', ') into v_open
    from public.tasks t where t.room_id = new.id and not t.done;
    if v_open is not null then
      raise exception '% cannot be marked Completed while tasks are open: %', new.name, v_open
        using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;

create trigger guard_room_done before insert or update of status on public.rooms
for each row execute function private.guard_room_done();

-- Re-opening a task on a completed room is also inconsistent.
create or replace function private.guard_task_reopen()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if not new.done and new.room_id is not null and exists (
    select 1 from public.rooms r where r.id = new.room_id and r.status = 'done'
  ) then
    raise exception 'Room is marked Completed — change its status before adding or re-opening tasks'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger guard_task_reopen before insert or update of done, room_id on public.tasks
for each row execute function private.guard_task_reopen();

-- Every project keeps at least one manager.
create or replace function private.guard_last_manager()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if old.role = 'manager' and (tg_op = 'DELETE' or new.role <> 'manager') then
    if exists (select 1 from public.projects p where p.id = old.project_id) and not exists (
      select 1 from public.project_members m
      where m.project_id = old.project_id and m.role = 'manager' and m.user_id <> old.user_id
    ) then
      raise exception 'A project needs at least one manager' using errcode = '23514';
    end if;
  end if;
  return coalesce(new, old);
end;
$$;

create trigger guard_last_manager before update or delete on public.project_members
for each row execute function private.guard_last_manager();

-- projects.spent = sum(expenses.amount)
create or replace function private.refresh_project_spent()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_project uuid := coalesce(new.project_id, old.project_id);
begin
  update public.projects p
  set spent = coalesce((select sum(e.amount) from public.expenses e where e.project_id = v_project), 0)
  where p.id = v_project;
  if tg_op = 'UPDATE' and old.project_id <> new.project_id then
    update public.projects p
    set spent = coalesce((select sum(e.amount) from public.expenses e where e.project_id = old.project_id), 0)
    where p.id = old.project_id;
  end if;
  return null;
end;
$$;

create trigger refresh_project_spent after insert or update or delete on public.expenses
for each row execute function private.refresh_project_spent();

-- ---------------------------------------------------------------------------
-- Activity log (generic, all manager-editable tables)
-- ---------------------------------------------------------------------------
create or replace function private.log_activity()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  rec jsonb;
  v_project uuid;
  v_label text;
  v_changes jsonb := '{}'::jsonb;
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

  v_label := coalesce(rec ->> 'name', rec ->> 'title', nullif(rec ->> 'caption', ''),
                      rec ->> 'description', rec ->> 'role', '');

  insert into public.activity_log (project_id, actor_id, action, entity_type, entity_id, summary, changes)
  values (
    v_project,
    auth.uid(),
    lower(tg_op),
    tg_table_name,
    case when rec ? 'id' then (rec ->> 'id')::uuid
         when rec ? 'user_id' then (rec ->> 'user_id')::uuid
         else v_project end,
    initcap(case tg_op when 'INSERT' then 'added' when 'UPDATE' then 'updated' else 'removed' end)
      || ' ' || v_entity || case when v_label <> '' then ' "' || left(v_label, 80) || '"' else '' end,
    v_changes
  );
  return null;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array['projects','project_internal','project_members','rooms','stages','tasks',
                           'photos','renders','expenses','ai_knowledge']
  loop
    execute format(
      'create trigger log_activity after insert or update or delete on public.%I
       for each row execute function private.log_activity()', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Notifications (fan-out to every client of the project)
-- ---------------------------------------------------------------------------
create or replace function private.notify_clients(
  p_project uuid, p_kind text, p_title text, p_body text, p_link text,
  p_entity_type text, p_entity_id uuid
) returns void language sql security definer set search_path = '' as $$
  insert into public.notifications (project_id, recipient_id, kind, title, body, link, entity_type, entity_id, created_by)
  select p_project, m.user_id, p_kind, p_title, p_body, p_link, p_entity_type, p_entity_id, auth.uid()
  from public.project_members m
  where m.project_id = p_project and m.role = 'client';
$$;

create or replace function private.status_label(s public.work_status)
returns text language sql immutable set search_path = '' as $$
  select case s when 'done' then 'Completed' when 'progress' then 'In progress'
                when 'pending' then 'Pending' else 'Blocked' end;
$$;

create or replace function private.notify_on_change()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_table_name = 'stages' then
    if new.is_visible and new.status is distinct from old.status then
      perform private.notify_clients(new.project_id, 'stage', 'Stage update: ' || new.name,
        new.name || ' is now ' || lower(private.status_label(new.status)) || '.', '/stages', 'stages', new.id);
    end if;
  elsif tg_table_name = 'rooms' then
    if new.is_visible and new.status is distinct from old.status then
      perform private.notify_clients(new.project_id, 'room', new.name || ' is now ' || lower(private.status_label(new.status)),
        coalesce(nullif(new.client_note, ''), ''), '/plan', 'rooms', new.id);
    end if;
  elsif tg_table_name = 'photos' then
    if new.status = 'published' and (tg_op = 'INSERT' or old.status <> 'published') then
      perform private.notify_clients(new.project_id, 'photo', 'New site photo', new.caption, '/photos', 'photos', new.id);
    end if;
  elsif tg_table_name = 'renders' then
    if new.is_visible and (tg_op = 'INSERT' or not old.is_visible) then
      perform private.notify_clients(new.project_id, 'render', 'New design render: ' || new.title,
        new.description, '/design', 'renders', new.id);
    end if;
  elsif tg_table_name = 'projects' then
    if new.schedule_status is distinct from old.schedule_status then
      perform private.notify_clients(new.id, 'schedule',
        'Schedule: ' || case new.schedule_status when 'on_schedule' then 'On schedule'
                         when 'at_risk' then 'At risk' else 'Delayed' end,
        new.schedule_note, '/', 'projects', new.id);
    end if;
  end if;
  return null;
end;
$$;

create trigger notify_stage after update of status on public.stages
for each row execute function private.notify_on_change();
create trigger notify_room after update of status on public.rooms
for each row execute function private.notify_on_change();
create trigger notify_photo after insert or update of status on public.photos
for each row execute function private.notify_on_change();
create trigger notify_render after insert or update of is_visible on public.renders
for each row execute function private.notify_on_change();
create trigger notify_schedule after update of schedule_status on public.projects
for each row execute function private.notify_on_change();

-- New chat message -> notify every other member.
create or replace function private.notify_message()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_sender text;
begin
  select full_name into v_sender from public.profiles where id = new.sender_id;
  insert into public.notifications (project_id, recipient_id, kind, title, body, link, entity_type, entity_id, created_by)
  select new.project_id, m.user_id, 'message', 'New message from ' || coalesce(v_sender, 'your project'),
         left(coalesce(nullif(new.body, ''), 'Sent an attachment'), 140), '/chat', 'messages', new.id, new.sender_id
  from public.project_members m
  where m.project_id = new.project_id and m.user_id <> new.sender_id;
  return null;
end;
$$;

create trigger notify_message after insert on public.messages
for each row execute function private.notify_message();

-- ---------------------------------------------------------------------------
-- RPCs
-- ---------------------------------------------------------------------------

-- Create a project and become its manager (only 'manager' accounts).
create or replace function public.create_project(
  p_name text, p_address text default '', p_client_name text default '',
  p_start_date date default null, p_target_date date default null, p_budget numeric default 0
) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and account_type = 'manager') then
    raise exception 'Only manager accounts can create projects' using errcode = '42501';
  end if;
  insert into public.projects (name, address, client_name, start_date, target_date, budget, created_by)
  values (p_name, p_address, p_client_name, p_start_date, p_target_date, coalesce(p_budget, 0), auth.uid())
  returning id into v_id;
  insert into public.project_members (project_id, user_id, role) values (v_id, auth.uid(), 'manager');
  insert into public.project_internal (project_id) values (v_id);
  return v_id;
end;
$$;

-- Add an existing account to a project by email (managers only).
create or replace function public.add_project_member(p_project uuid, p_email text, p_role public.project_role)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_user uuid;
begin
  if not public.is_project_manager(p_project) then
    raise exception 'Only project managers can add members' using errcode = '42501';
  end if;
  select u.id into v_user from auth.users u where lower(u.email) = lower(trim(p_email));
  if v_user is null then
    raise exception 'No RenoTrack account uses %. Ask them to sign up first.', p_email using errcode = 'P0002';
  end if;
  insert into public.project_members (project_id, user_id, role)
  values (p_project, v_user, p_role)
  on conflict (project_id, user_id) do update set role = excluded.role;
  return v_user;
end;
$$;

-- Manual announcement to all clients of a project.
create or replace function public.notify_project_clients(p_project uuid, p_title text, p_body text, p_link text default null)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_project_manager(p_project) then
    raise exception 'Only project managers can send notifications' using errcode = '42501';
  end if;
  perform private.notify_clients(p_project, 'manual', p_title, coalesce(p_body, ''), p_link, null, null);
end;
$$;

-- Recipients mark their own notifications read (no direct UPDATE grant on the table).
create or replace function public.mark_notifications_read(p_ids uuid[] default null)
returns void language sql security definer set search_path = '' as $$
  update public.notifications set read_at = now()
  where recipient_id = auth.uid() and read_at is null and (p_ids is null or id = any (p_ids));
$$;

-- Chat read marker for the current member.
create or replace function public.mark_chat_read(p_project uuid)
returns void language sql security definer set search_path = '' as $$
  update public.project_members set last_read_at = now()
  where project_id = p_project and user_id = auth.uid();
$$;

revoke execute on all functions in schema private from public, anon, authenticated;
revoke execute on function public.create_project from public, anon;
revoke execute on function public.add_project_member from public, anon;
revoke execute on function public.notify_project_clients from public, anon;
revoke execute on function public.mark_notifications_read from public, anon;
revoke execute on function public.mark_chat_read from public, anon;
grant execute on function public.create_project, public.add_project_member, public.notify_project_clients,
  public.mark_notifications_read, public.mark_chat_read to authenticated;
grant usage on schema private to authenticated; -- policies call private.path_project_id
grant execute on function private.path_project_id(text) to authenticated;
