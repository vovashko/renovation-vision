-- Guards function grants that RLS policies depend on. A blanket
-- `revoke execute on all functions in schema private` in one migration must not silently break
-- policies added by another (see migration 20261003000100_fix_w4_merge.sql).
begin;

do $$
declare f text;
begin
  foreach f in array array['private.is_staff()', 'private.staff_mfa_ok()', 'private.path_project_id(text)'] loop
    if not has_function_privilege('authenticated', f, 'EXECUTE') then
      raise exception 'FAILED: authenticated must be able to execute % (RLS policies call it)', f;
    end if;
    if has_function_privilege('anon', f, 'EXECUTE') then
      raise exception 'FAILED: anon must not be able to execute %', f;
    end if;
  end loop;
end $$;

-- project_contacts activity entries keep T30's role label and T33's translatable params.
do $$
declare v_project uuid; v_contact uuid; v_entity text;
begin
  select id into v_project from public.projects order by created_at limit 1;
  insert into public.contacts (kind, full_name) values ('crew', 'Grants Test Person') returning id into v_contact;
  insert into public.project_contacts (project_id, contact_id, role) values (v_project, v_contact, 'crew');
  select params ->> 'entity' into v_entity from public.activity_log
   where entity_type = 'project_contacts' order by id desc limit 1;
  if v_entity is distinct from 'crew_member' then
    raise exception 'FAILED: project_contacts activity params.entity = %, expected crew_member', v_entity;
  end if;
end $$;

select 'grants tests passed';
rollback;
