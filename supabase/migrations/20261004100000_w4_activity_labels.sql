-- W4 follow-up, after T31 (costs/materials) and T32 (work data) merged.
--
-- 1. materials.progress_entry_id gets its foreign key to progress_entries: T31 and T32 were built in
--    parallel, so T31 left the column without one.
-- 2. private.log_activity() learns the three new tables: entity labels (and translatable params.entity
--    keys) for materials, stage_budgets and progress_entries, a stage-name label for stage budgets, a
--    note label for diary entries, and the stage as the entity of a stage budget (it has no id column).
--    Redefined from 20261003000100_fix_w4_merge.sql; everything else is unchanged.

alter table public.materials
  add constraint materials_progress_entry_id_fkey
  foreign key (progress_entry_id) references public.progress_entries (id) on delete set null;
create index if not exists materials_progress_entry_idx on public.materials (progress_entry_id)
  where progress_entry_id is not null;

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
    when 'materials' then 'material'
    when 'stage_budgets' then 'stage budget'
    when 'progress_entries' then 'diary entry'
    when 'project_contacts' then 'contact'
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
    when 'materials' then 'material'
    when 'stage_budgets' then 'stage_budget'
    when 'progress_entries' then 'diary_entry'
    when 'project_contacts' then 'contact'
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

  if tg_table_name = 'project_contacts' then
    -- Label a project contact by its role (T30), keyed for translation (T33).
    v_entity := case rec ->> 'role'
      when 'crew' then 'crew member'
      when 'client' then 'client contact'
      when 'poc' then 'point of contact'
      else coalesce(rec ->> 'role', 'project') || ' contact' end;
    v_entity_key := case rec ->> 'role'
      when 'crew' then 'crew_member'
      when 'client' then 'client_contact'
      when 'poc' then 'point_of_contact'
      else 'contact' end;
    -- The contact's name; on a cascade from a deleted contact it may be gone already.
    v_label := left(coalesce((select c.full_name from public.contacts c where c.id = (rec ->> 'contact_id')::uuid), ''), 80);
  elsif tg_table_name = 'stage_budgets' then
    -- A stage's planned cost: label it with the stage's name.
    v_label := left(coalesce((select s.name from public.stages s where s.id = (rec ->> 'stage_id')::uuid), ''), 80);
  elsif tg_table_name = 'progress_entries' then
    -- A diary entry: the start of its note.
    v_label := left(coalesce(rec ->> 'note', ''), 80);
  else
    v_label := left(coalesce(rec ->> 'name', rec ->> 'title', nullif(rec ->> 'caption', ''),
                             rec ->> 'description', rec ->> 'role', ''), 80);
  end if;

  insert into public.activity_log (project_id, actor_id, action, entity_type, entity_id, summary, changes, params)
  values (
    v_project,
    auth.uid(),
    v_action,
    tg_table_name,
    case when rec ? 'id' then (rec ->> 'id')::uuid
         when tg_table_name = 'stage_budgets' then (rec ->> 'stage_id')::uuid
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

