-- Row-level security.
--
--   Managers: read/write only projects they are assigned to (project_members.role = 'manager').
--   Clients:  read only their own project, and only rows marked visible / published.
--   Internal: project_internal, expenses and activity_log have no client policy at all;
--             draft photos are filtered out row by row.
--
-- anon gets nothing: every policy targets the authenticated role.

alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.project_internal enable row level security;
alter table public.project_members enable row level security;
alter table public.rooms enable row level security;
alter table public.stages enable row level security;
alter table public.tasks enable row level security;
alter table public.photos enable row level security;
alter table public.renders enable row level security;
alter table public.expenses enable row level security;
alter table public.messages enable row level security;
alter table public.notifications enable row level security;
alter table public.activity_log enable row level security;
alter table public.ai_knowledge enable row level security;

revoke all on all tables in schema public from anon;

-- ---------------------------------------------------------------------------
-- profiles: see yourself and people you share a project with; edit your own name/avatar.
-- ---------------------------------------------------------------------------
create policy "profiles: read self and project peers" on public.profiles
for select to authenticated
using (id = (select auth.uid()) or public.shares_project_with(id));

create policy "profiles: update self" on public.profiles
for update to authenticated
using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- account_type is admin-controlled: users may only change these columns.
revoke update on public.profiles from authenticated;
grant update (full_name, avatar_url) on public.profiles to authenticated;

-- ---------------------------------------------------------------------------
-- projects: members read; managers update/delete. Creation goes through create_project().
-- ---------------------------------------------------------------------------
create policy "projects: members read" on public.projects
for select to authenticated using (public.is_project_member(id));

create policy "projects: managers update" on public.projects
for update to authenticated
using (public.is_project_manager(id)) with check (public.is_project_manager(id));

create policy "projects: managers delete" on public.projects
for delete to authenticated using (public.is_project_manager(id));

-- spent is derived from expenses and created_by is fixed: only these columns are editable.
revoke update on public.projects from authenticated;
grant update (name, address, client_name, start_date, target_date, budget, schedule_status, schedule_note)
  on public.projects to authenticated;

-- ---------------------------------------------------------------------------
-- project_internal: managers only.
-- ---------------------------------------------------------------------------
create policy "project_internal: managers all" on public.project_internal
for all to authenticated
using (public.is_project_manager(project_id)) with check (public.is_project_manager(project_id));

-- ---------------------------------------------------------------------------
-- project_members: members see the team; managers manage it.
-- ---------------------------------------------------------------------------
create policy "project_members: members read" on public.project_members
for select to authenticated using (public.is_project_member(project_id));

create policy "project_members: managers insert" on public.project_members
for insert to authenticated with check (public.is_project_manager(project_id));

create policy "project_members: managers update" on public.project_members
for update to authenticated
using (public.is_project_manager(project_id)) with check (public.is_project_manager(project_id));

create policy "project_members: managers delete" on public.project_members
for delete to authenticated using (public.is_project_manager(project_id));

-- ---------------------------------------------------------------------------
-- Client-visible content: rooms, stages, tasks, renders, ai_knowledge (is_visible), photos (published).
-- ---------------------------------------------------------------------------
create policy "rooms: managers or visible to clients" on public.rooms
for select to authenticated
using (public.is_project_manager(project_id) or (is_visible and public.is_project_client(project_id)));

create policy "stages: managers or visible to clients" on public.stages
for select to authenticated
using (public.is_project_manager(project_id) or (is_visible and public.is_project_client(project_id)));

create policy "tasks: managers or visible to clients" on public.tasks
for select to authenticated
using (
  public.is_project_manager(project_id)
  or (
    is_visible and public.is_project_client(project_id)
    and exists (select 1 from public.stages s where s.id = stage_id and s.is_visible)
  )
);

create policy "photos: managers or published to clients" on public.photos
for select to authenticated
using (public.is_project_manager(project_id) or (status = 'published' and public.is_project_client(project_id)));

create policy "renders: managers or visible to clients" on public.renders
for select to authenticated
using (public.is_project_manager(project_id) or (is_visible and public.is_project_client(project_id)));

create policy "ai_knowledge: managers or visible to clients" on public.ai_knowledge
for select to authenticated
using (public.is_project_manager(project_id) or (is_visible and public.is_project_client(project_id)));

-- Writes on all of the above: managers of that project only.
do $$
declare t text;
begin
  foreach t in array array['rooms','stages','tasks','photos','renders','ai_knowledge'] loop
    execute format(
      'create policy "%1$s: managers insert" on public.%1$I for insert to authenticated
         with check (public.is_project_manager(project_id))', t);
    execute format(
      'create policy "%1$s: managers update" on public.%1$I for update to authenticated
         using (public.is_project_manager(project_id)) with check (public.is_project_manager(project_id))', t);
    execute format(
      'create policy "%1$s: managers delete" on public.%1$I for delete to authenticated
         using (public.is_project_manager(project_id))', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- expenses: managers only (vendor notes, receipts).
-- ---------------------------------------------------------------------------
create policy "expenses: managers all" on public.expenses
for all to authenticated
using (public.is_project_manager(project_id)) with check (public.is_project_manager(project_id));

-- ---------------------------------------------------------------------------
-- messages: every member reads and posts as themselves; senders edit/delete their own.
-- ---------------------------------------------------------------------------
create policy "messages: members read" on public.messages
for select to authenticated using (public.is_project_member(project_id));

create policy "messages: members send as self" on public.messages
for insert to authenticated
with check (sender_id = (select auth.uid()) and public.is_project_member(project_id));

create policy "messages: sender edits" on public.messages
for update to authenticated
using (sender_id = (select auth.uid()))
with check (sender_id = (select auth.uid()) and public.is_project_member(project_id));

create policy "messages: sender deletes" on public.messages
for delete to authenticated using (sender_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- notifications: recipients read their own; managers see (and can retract) their project's.
-- Read state changes via mark_notifications_read(); manual sends via notify_project_clients().
-- ---------------------------------------------------------------------------
create policy "notifications: recipient or manager read" on public.notifications
for select to authenticated
using (recipient_id = (select auth.uid()) or public.is_project_manager(project_id));

create policy "notifications: managers delete" on public.notifications
for delete to authenticated using (public.is_project_manager(project_id));

-- ---------------------------------------------------------------------------
-- activity_log: managers read; only triggers write.
-- ---------------------------------------------------------------------------
create policy "activity_log: managers read" on public.activity_log
for select to authenticated using (public.is_project_manager(project_id));

-- ---------------------------------------------------------------------------
-- Table privileges (RLS still applies on top).
-- ---------------------------------------------------------------------------
revoke insert, update, delete on public.activity_log from authenticated;
revoke insert, update on public.notifications from authenticated;
revoke insert on public.projects from authenticated;
grant select on public.project_summary to authenticated;

-- ---------------------------------------------------------------------------
-- Realtime: stream changes to both apps (RLS is enforced per subscriber).
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table
      public.projects, public.rooms, public.stages, public.tasks, public.photos,
      public.renders, public.messages, public.notifications;
  end if;
end $$;
