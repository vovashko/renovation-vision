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

-- Client access (T35): the app calls the public RPCs; the private sync helpers are for triggers only.
do $$
declare f text;
begin
  foreach f in array array[
    'public.set_project_client(uuid, text, text, text)',
    'public.create_project(text, text, text, text, text, text, public.project_status, text, date, date, numeric, text)',
    'public.add_project_member(uuid, text, public.project_role)'
  ] loop
    if not has_function_privilege('authenticated', f, 'EXECUTE') then
      raise exception 'FAILED: authenticated must be able to execute %', f;
    end if;
    if has_function_privilege('anon', f, 'EXECUTE') then
      raise exception 'FAILED: anon must not be able to execute %', f;
    end if;
  end loop;
  foreach f in array array[
    'private.is_staff(uuid)', 'private.account_for_email(text)', 'private.client_account(uuid)',
    'private.assert_not_project_manager(uuid, uuid)', 'private.drop_client_membership(uuid, uuid)',
    'private.sync_client_access(uuid)', 'private.normalize_contact_email()', 'private.contacts_client_access()',
    'private.contacts_drop_client_access()', 'private.guard_project_client()',
    'private.project_contacts_client_access()', 'private.auth_user_client_access()'
  ] loop
    if has_function_privilege('authenticated', f, 'EXECUTE') or has_function_privilege('anon', f, 'EXECUTE') then
      raise exception 'FAILED: % must not be executable by the API roles', f;
    end if;
  end loop;
  if to_regprocedure('public.create_project(text, text, text, text, text, text, public.project_status, text, date, date, numeric)') is not null then
    raise exception 'FAILED: the old create_project signature is still there';
  end if;
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
