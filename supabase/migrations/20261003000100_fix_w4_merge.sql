-- Fix-forward for the W4 merge (T30 projects/contacts + T33 comms schema).
--
-- The two migrations were written in parallel and applied in timestamp order (T30, then T33):
--   1. T33 runs `revoke execute on all functions in schema private ...` and re-grants only the
--      functions it knew about, which silently revoked T30's grant on private.is_staff(). The
--      contacts/project_contacts RLS policies call is_staff(), so every query on them failed with
--      "permission denied for function is_staff".
--   2. T33 replaced private.log_activity() and dropped T30's role-based labels for project_contacts.
--
-- Rule for future migrations: a blanket revoke on schema private must re-grant every function that
-- RLS policies call (path_project_id, staff_mfa_ok, is_staff). tests/db/grants.test.sql guards this.

grant execute on function private.is_staff() to authenticated; -- contacts / project_contacts policies

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

