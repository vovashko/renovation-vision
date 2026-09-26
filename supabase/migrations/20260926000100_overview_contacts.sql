-- Overview page: client contact details and the crew working on a project.
--
--   project_internal.client_phone / client_email   manager-only (the client knows their own details)
--   project_crew                                    manager-only: site crew and trades with contact details
--
-- The crew are usually not app users, so they get their own table instead of project_members.
-- Nothing here is readable by clients; project_summary is unchanged.

alter table public.project_internal
  add column client_phone text not null default '',
  add column client_email text not null default '';

create table public.project_crew (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  trade text not null default '',
  phone text not null default '',
  email text not null default '',
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index project_crew_project_idx on public.project_crew (project_id, sort_order);

alter table public.project_crew enable row level security;
create policy "project_crew: managers all" on public.project_crew
for all to authenticated
using (public.is_project_manager(project_id)) with check (public.is_project_manager(project_id));

create trigger set_updated_at before update on public.project_crew
for each row execute function private.set_updated_at();

-- Same activity log as the other manager-editable tables ("Added crew member ...").
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
    when 'project_crew' then 'crew member'
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


create trigger log_activity after insert or update or delete on public.project_crew
for each row execute function private.log_activity();
