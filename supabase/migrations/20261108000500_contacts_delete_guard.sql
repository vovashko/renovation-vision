-- Contacts delete guard (T46 follow-up).
--
-- project_contacts RLS shows a manager only their own projects' links, but deleting a contact cascades every link.
-- A manager could therefore delete a contact that is the CLIENT on another manager's project, and T35's sync would
-- silently revoke that client's access. Two pieces close that:
--
--   1. private.guard_contact_delete(): BEFORE DELETE on contacts. Raises 23503 (hint 'contact_linked') while any
--      project_contacts row references the contact, on ANY project (security definer, so it sees them all).
--      Nothing at runtime deletes linked contacts; code that must (T50 account deletion) has to unlink first.
--   2. public.contact_project_links(contact): staff only. { total, managed: [{ project_id, name, role }] } where
--      total counts every link and managed lists only the projects the caller manages, so the sheet can say
--      "Linked to 3 projects (2 you manage)".

create or replace function private.guard_contact_delete()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from public.project_contacts pc where pc.contact_id = old.id) then
    raise exception 'This contact is still linked to a project' using errcode = '23503', hint = 'contact_linked';
  end if;
  return old;
end;
$$;

create trigger guard_contact_delete before delete on public.contacts
for each row execute function private.guard_contact_delete();

revoke execute on function private.guard_contact_delete() from public, anon, authenticated;

create or replace function public.contact_project_links(p_contact uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.is_staff() then
    raise exception 'Only staff can read contact links' using errcode = '42501';
  end if;
  if not private.staff_mfa_ok() then
    raise exception 'Two-factor verification required' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'total', (select count(*) from public.project_contacts pc where pc.contact_id = p_contact),
    'managed', coalesce((
      select jsonb_agg(jsonb_build_object('project_id', p.id, 'name', p.name, 'role', pc.role) order by p.name)
      from public.project_contacts pc
      join public.projects p on p.id = pc.project_id
      where pc.contact_id = p_contact and public.is_project_manager(p.id)
    ), '[]'::jsonb)
  );
end;
$$;

comment on function public.contact_project_links(uuid) is
  'Staff: { total, managed } for a contact. total counts links on every project; managed lists only the projects the '
  'caller manages (project_id, name, role).';

revoke execute on function public.contact_project_links(uuid) from public, anon;
grant execute on function public.contact_project_links(uuid) to authenticated;
