-- Clients as their own entity (T35): one client per project, and access that follows the client's email.
--
--   contacts.email                      normalized (lower, trimmed, null when blank); one client contact per email
--   project_contacts                    at most one `client` link per project
--   public.set_project_client(...)      the one write path for "who is this project's client" (client card,
--                                       create_project)
--   public.create_project(...)          gains p_client_email
--   public.add_project_member(...)      managers only: rejects the client role and non-staff accounts
--   private.sync_client_access(contact) links a client contact to the account with its email and grants that
--                                       account project_members(role = 'client') on every project where the
--                                       contact is the client; called by triggers on contacts, project_contacts
--                                       and auth.users
--   public.project_summary              gains my_role (the caller's project role), last column
--
-- Access rules:
--   * Only `client` links grant access; crew, supplier, architect and PoC links never do.
--   * The sync only adds or removes `client` memberships for the account a client contact resolves (or
--     resolved) to. It never touches a `manager` membership, and it leaves alone client memberships that no
--     client contact accounts for (e.g. a second login added by hand before this migration).
--   * A project's own manager can't be its client: that raises client_is_project_manager.
--
-- Errors carry a stable `hint` the UI maps to a message:
--   client_is_project_manager (23514), manager_is_project_client (23514), project_already_has_client (23505),
--   client_email_in_use (23505), client_role_not_allowed (22023), manager_requires_staff_account (22023),
--   client_name_required (22023), not_project_manager (42501), mfa_required (42501), account_not_found (P0002).

-- ---------------------------------------------------------------------------
-- 1. Normalize emails, then dedupe client contacts and client links
-- ---------------------------------------------------------------------------
update public.contacts set email = nullif(lower(btrim(email)), '')
where email is distinct from nullif(lower(btrim(email)), '');

-- The dedupe is a data migration, not a user edit: keep it out of the activity log.
alter table public.project_contacts disable trigger log_activity;

-- One client contact per email: keep the oldest, fill its blanks from the others, repoint their links.
create temporary table client_contact_dupes as
select id, keeper from (
  select c.id, first_value(c.id) over (partition by c.email order by c.created_at, c.id) as keeper
  from public.contacts c
  where c.kind = 'client' and c.email is not null
) ranked
where id <> keeper;

update public.contacts k set
  phone = coalesce(k.phone, d.phone),
  whatsapp = coalesce(k.whatsapp, d.whatsapp),
  company = coalesce(k.company, d.company),
  notes = coalesce(k.notes, d.notes)
from (
  select dd.keeper,
         (array_agg(c.phone order by c.created_at) filter (where c.phone is not null))[1] as phone,
         (array_agg(c.whatsapp order by c.created_at) filter (where c.whatsapp is not null))[1] as whatsapp,
         (array_agg(c.company order by c.created_at) filter (where c.company is not null))[1] as company,
         (array_agg(c.notes order by c.created_at) filter (where c.notes is not null))[1] as notes
  from client_contact_dupes dd join public.contacts c on c.id = dd.id
  group by dd.keeper
) d
where k.id = d.keeper;

-- Links that would collide once repointed (same project, role and keeper): keep the keeper's own, else the
-- primary, else the oldest.
delete from public.project_contacts
where id in (
  select id from (
    select pc.id,
           row_number() over (
             partition by pc.project_id, pc.role, coalesce(d.keeper, pc.contact_id)
             order by (d.id is null) desc, pc.is_primary desc, pc.created_at, pc.id
           ) as rn
    from public.project_contacts pc
    left join client_contact_dupes d on d.id = pc.contact_id
  ) x
  where rn > 1
);
update public.project_contacts pc set contact_id = d.keeper
from client_contact_dupes d where pc.contact_id = d.id;
update public.materials m set supplier_contact_id = d.keeper
from client_contact_dupes d where m.supplier_contact_id = d.id;
delete from public.contacts c using client_contact_dupes d where c.id = d.id;
drop table client_contact_dupes;

-- One client link per project: keep the primary, else the oldest; it is the primary.
delete from public.project_contacts
where role = 'client'
  and id not in (
    select distinct on (project_id) id
    from public.project_contacts
    where role = 'client'
    order by project_id, is_primary desc, created_at, id
  );
update public.project_contacts set is_primary = true where role = 'client' and not is_primary;

alter table public.project_contacts enable trigger log_activity;

-- ---------------------------------------------------------------------------
-- 2. Constraints and indexes
-- ---------------------------------------------------------------------------
alter table public.contacts add constraint contacts_email_normalized
  check (email is null or (email = lower(btrim(email)) and email <> ''));
create unique index contacts_client_email_idx on public.contacts (lower(email))
  where kind = 'client' and email is not null;
create index contacts_email_idx on public.contacts (email) where email is not null;
create unique index project_contacts_one_client_idx on public.project_contacts (project_id) where role = 'client';

-- Normalize on write, and name the duplicate-email case before the unique index does.
create or replace function private.normalize_contact_email()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  new.email := nullif(lower(btrim(new.email)), '');
  if new.kind = 'client' and new.email is not null and exists (
    select 1 from public.contacts c
    where c.kind = 'client' and lower(c.email) = new.email and c.id <> new.id
  ) then
    raise exception 'Another client already uses %', new.email
      using errcode = '23505', hint = 'client_email_in_use';
  end if;
  return new;
end;
$$;

create trigger normalize_email before insert or update of email, kind on public.contacts
for each row execute function private.normalize_contact_email();

-- ---------------------------------------------------------------------------
-- 3. Helpers
-- ---------------------------------------------------------------------------
-- A staff account (manager or admin), for any user. private.is_staff() answers for the caller.
create or replace function private.is_staff(p_user uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles p
    where p.id = p_user and p.account_type in ('admin', 'manager')
  );
$$;

-- The account (with a profile) whose login email is p_email.
create or replace function private.account_for_email(p_email text)
returns uuid language sql stable security definer set search_path = '' as $$
  select u.id
  from auth.users u
  join public.profiles p on p.id = u.id
  where nullif(lower(btrim(p_email)), '') is not null and lower(u.email) = lower(btrim(p_email))
  order by u.created_at
  limit 1;
$$;

-- The account a contact gives client access to: a client contact follows its email; any other contact
-- (a staff member's own, linked by user_id) is its linked account.
create or replace function private.client_account(p_contact uuid)
returns uuid language sql stable security definer set search_path = '' as $$
  select case when c.kind = 'client' then private.account_for_email(c.email)
              else coalesce(c.user_id, private.account_for_email(c.email)) end
  from public.contacts c
  where c.id = p_contact;
$$;

-- A project's manager can't also be its client.
create or replace function private.assert_not_project_manager(p_project uuid, p_user uuid)
returns void language plpgsql stable security definer set search_path = '' as $$
begin
  if p_user is not null and exists (
    select 1 from public.project_members m
    where m.project_id = p_project and m.user_id = p_user and m.role = 'manager'
  ) then
    if p_user = (select auth.uid()) then
      raise exception 'You manage this project, so you can''t be its client'
        using errcode = '23514', hint = 'client_is_project_manager';
    end if;
    raise exception 'This person manages this project, so they can''t be its client'
      using errcode = '23514', hint = 'client_is_project_manager';
  end if;
end;
$$;

-- Removes p_user's client membership on p_project, unless the project's client link still resolves to them.
-- Manager memberships are never touched.
create or replace function private.drop_client_membership(p_project uuid, p_user uuid)
returns void language sql security definer set search_path = '' as $$
  delete from public.project_members m
  where m.project_id = p_project and m.user_id = p_user and m.role = 'client'
    and not exists (
      select 1 from public.project_contacts pc
      where pc.project_id = p_project and pc.role = 'client' and private.client_account(pc.contact_id) = p_user
    );
$$;

-- ---------------------------------------------------------------------------
-- 4. The sync
-- ---------------------------------------------------------------------------
-- Links a client contact to the account with its email (one contact per account: when the account already has
-- another contact, the link stays empty and access still follows the email), drops the previously linked
-- account's client memberships, and grants the account a client membership on every project where the contact
-- is the client. Existing memberships (a manager's, or one added by hand) are left as they are.
create or replace function private.sync_client_access(p_contact uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_kind public.contact_kind;
  v_linked uuid;
  v_user uuid;
  v_link uuid;
begin
  select c.kind, c.user_id into v_kind, v_linked from public.contacts c where c.id = p_contact;
  if not found then
    return;
  end if;
  v_user := private.client_account(p_contact);

  if v_kind = 'client' and v_user is distinct from v_linked then
    if v_linked is not null then
      perform private.drop_client_membership(pc.project_id, v_linked)
      from public.project_contacts pc
      where pc.contact_id = p_contact and pc.role = 'client';
    end if;
    v_link := case when v_user is not null and not exists (
                     select 1 from public.contacts o where o.user_id = v_user and o.id <> p_contact)
                   then v_user end;
    update public.contacts set user_id = v_link where id = p_contact and user_id is distinct from v_link;
  end if;

  if v_user is not null then
    insert into public.project_members (project_id, user_id, role)
    select pc.project_id, v_user, 'client'
    from public.project_contacts pc
    where pc.contact_id = p_contact and pc.role = 'client'
    on conflict (project_id, user_id) do nothing;
  end if;
end;
$$;

-- contacts: an email, link or kind change moves the access.
create or replace function private.contacts_client_access()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_old uuid;
  v_new uuid;
begin
  if tg_op = 'UPDATE' then
    v_old := case when old.kind = 'client' then private.account_for_email(old.email)
                  else coalesce(old.user_id, private.account_for_email(old.email)) end;
    v_new := private.client_account(new.id);
    if old.email is distinct from new.email and v_new is distinct from v_old and v_new is distinct from old.user_id then
      perform private.assert_not_project_manager(pc.project_id, v_new)
      from public.project_contacts pc
      where pc.contact_id = new.id and pc.role = 'client';
    end if;
    perform private.drop_client_membership(pc.project_id, a.id)
    from public.project_contacts pc
    cross join (values (v_old), (old.user_id)) as a (id)
    where pc.contact_id = new.id and pc.role = 'client' and a.id is not null;
  end if;
  perform private.sync_client_access(new.id);
  return null;
end;
$$;

-- contacts: deleting a client contact takes its access with it (the links go by cascade).
create or replace function private.contacts_drop_client_access()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_user uuid := private.client_account(old.id);
begin
  if v_user is not null then
    delete from public.project_members m
    using public.project_contacts pc
    where pc.contact_id = old.id and pc.role = 'client'
      and m.project_id = pc.project_id and m.user_id = v_user and m.role = 'client';
  end if;
  return old;
end;
$$;

-- project_contacts: one client per project, and never the project's own manager.
create or replace function private.guard_project_client()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.role = 'client' then
    if exists (
      select 1 from public.project_contacts pc
      where pc.project_id = new.project_id and pc.role = 'client' and pc.id <> new.id
    ) then
      raise exception 'This project already has a client'
        using errcode = '23505', hint = 'project_already_has_client';
    end if;
    perform private.assert_not_project_manager(new.project_id, private.client_account(new.contact_id));
  end if;
  return new;
end;
$$;

-- project_contacts: linking a client grants access; unlinking (or relinking) drops it.
create or replace function private.project_contacts_client_access()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op <> 'INSERT' and old.role = 'client' then
    perform private.drop_client_membership(old.project_id, private.client_account(old.contact_id));
  end if;
  if tg_op <> 'DELETE' and new.role = 'client' then
    perform private.sync_client_access(new.contact_id);
  end if;
  return null;
end;
$$;

-- auth.users: a new account (an invite or a sign-up) gets the access its email was given; a login email change
-- follows to the account's own contact and moves the access. A separate trigger from handle_new_user, named so
-- it fires after it (triggers fire in name order), so the profile exists.
create or replace function private.auth_user_client_access()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_new text := nullif(lower(btrim(new.email)), '');
  v_old text;
  r record;
begin
  if tg_op = 'UPDATE' then
    v_old := nullif(lower(btrim(old.email)), '');
    -- The contact linked to this account follows the login email (unless another client contact has it).
    if v_new is not null then
      update public.contacts c set email = v_new
      where c.user_id = new.id and c.email is distinct from v_new
        and not (c.kind = 'client' and exists (
          select 1 from public.contacts d where d.kind = 'client' and d.email = v_new and d.id <> c.id));
    end if;
    -- Contacts still on the old email no longer give this account access.
    for r in select c.id from public.contacts c where v_old is not null and c.email = v_old loop
      perform private.drop_client_membership(pc.project_id, new.id)
      from public.project_contacts pc
      where pc.contact_id = r.id and pc.role = 'client';
      perform private.sync_client_access(r.id);
    end loop;
  end if;
  for r in select c.id from public.contacts c where v_new is not null and c.email = v_new loop
    perform private.sync_client_access(r.id);
  end loop;
  return null;
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. Triggers
-- ---------------------------------------------------------------------------
create trigger sync_client_access after insert on public.contacts
for each row execute function private.contacts_client_access();
create trigger sync_client_access_update after update of email, user_id, kind on public.contacts
for each row
when (old.email is distinct from new.email or old.user_id is distinct from new.user_id or old.kind is distinct from new.kind)
execute function private.contacts_client_access();
create trigger drop_client_access before delete on public.contacts
for each row execute function private.contacts_drop_client_access();

create trigger guard_project_client before insert or update of role, contact_id, project_id on public.project_contacts
for each row execute function private.guard_project_client();
create trigger sync_client_access after insert or delete or update of role, contact_id, project_id on public.project_contacts
for each row execute function private.project_contacts_client_access();

create trigger on_auth_user_sync_client_access after insert on auth.users
for each row execute function private.auth_user_client_access();
create trigger on_auth_user_email_sync_client_access after update of email on auth.users
for each row when (old.email is distinct from new.email)
execute function private.auth_user_client_access();

-- ---------------------------------------------------------------------------
-- 6. set_project_client: the one write path for a project's client
-- ---------------------------------------------------------------------------
-- Picks the contact, in this order:
--   1. the contact linked to the account with that email (a staff member's own contact, created when missing,
--      or a client's);
--   2. else the client contact with that email;
--   3. else the project's current client contact, when it is a client contact (editing the client card edits
--      that shared contact, so the change shows on every project it is the client of);
--   4. else a new client contact.
-- Name and phone are written to client contacts only, never to a staff member's own contact. p_phone null
-- leaves the phone as it is; '' clears it. Returns the contact id.
create or replace function public.set_project_client(
  p_project uuid,
  p_full_name text,
  p_email text default null,
  p_phone text default null
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_name text := btrim(coalesce(p_full_name, ''));
  v_email text := nullif(lower(btrim(coalesce(p_email, ''))), '');
  v_user uuid;
  v_current uuid;
  v_contact uuid;
begin
  if not public.is_project_manager(p_project) then
    raise exception 'Only project managers can set the client'
      using errcode = '42501', hint = 'not_project_manager';
  end if;
  if not private.staff_mfa_ok() then
    raise exception 'Two-factor verification required' using errcode = '42501', hint = 'mfa_required';
  end if;
  if v_name = '' then
    raise exception 'The client needs a name' using errcode = '22023', hint = 'client_name_required';
  end if;

  select pc.contact_id into v_current
  from public.project_contacts pc
  where pc.project_id = p_project and pc.role = 'client';

  if v_email is not null then
    v_user := private.account_for_email(v_email);
    if v_user is not null then
      perform private.assert_not_project_manager(p_project, v_user);
      select c.id into v_contact from public.contacts c where c.user_id = v_user;
      if v_contact is null and private.is_staff(v_user) then
        v_contact := private.user_contact(v_user);
      end if;
    end if;
    if v_contact is null then
      select c.id into v_contact from public.contacts c where c.kind = 'client' and lower(c.email) = v_email;
    end if;
  end if;
  if v_contact is null and v_current is not null
     and (select c.kind from public.contacts c where c.id = v_current) = 'client' then
    v_contact := v_current;
  end if;

  if v_contact is null then
    insert into public.contacts (kind, full_name, email, phone)
    values ('client', v_name, v_email, nullif(btrim(p_phone), ''))
    returning id into v_contact;
  else
    update public.contacts c
    set full_name = v_name,
        email = v_email,
        phone = case when p_phone is null then c.phone else nullif(btrim(p_phone), '') end
    where c.id = v_contact and c.kind = 'client'
      and (c.full_name, c.email, c.phone) is distinct from
          (v_name, v_email, case when p_phone is null then c.phone else nullif(btrim(p_phone), '') end);
  end if;

  if v_current is null then
    insert into public.project_contacts (project_id, contact_id, role, is_primary)
    values (p_project, v_contact, 'client', true);
  elsif v_current <> v_contact then
    update public.project_contacts set contact_id = v_contact
    where project_id = p_project and role = 'client';
  end if;
  return v_contact;
end;
$$;

-- ---------------------------------------------------------------------------
-- 7. create_project gains p_client_email (appended, so positional calls keep working)
-- ---------------------------------------------------------------------------
drop function public.create_project(text, text, text, text, text, text, public.project_status, text, date, date, numeric);

create function public.create_project(
  p_name text,
  p_address_line text default '',
  p_postal_code text default '',
  p_city text default '',
  p_country text default 'PL',
  p_currency text default 'PLN',
  p_status public.project_status default 'active',
  p_client_name text default '',
  p_start_date date default null,
  p_target_date date default null,
  p_budget numeric default 0,
  p_client_email text default ''
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
begin
  if not private.is_staff() then
    raise exception 'Only manager or admin accounts can create projects' using errcode = '42501';
  end if;
  insert into public.projects (name, address_line, postal_code, city, country, currency, status,
                               start_date, target_date, budget, created_by)
  values (p_name, btrim(coalesce(p_address_line, '')), btrim(coalesce(p_postal_code, '')), btrim(coalesce(p_city, '')),
          upper(coalesce(nullif(btrim(p_country), ''), 'PL')), upper(coalesce(nullif(btrim(p_currency), ''), 'PLN')),
          coalesce(p_status, 'active'), p_start_date, p_target_date, coalesce(p_budget, 0), auth.uid())
  returning id into v_id;
  insert into public.project_members (project_id, user_id, role) values (v_id, auth.uid(), 'manager');
  insert into public.project_internal (project_id) values (v_id);

  insert into public.project_contacts (project_id, contact_id, role, is_primary, visible_to_client)
  values (v_id, private.user_contact(auth.uid()), 'poc', true, true);

  -- An email without a name raises client_name_required rather than being dropped.
  if nullif(btrim(coalesce(p_client_name, '')), '') is not null
     or nullif(btrim(coalesce(p_client_email, '')), '') is not null then
    perform public.set_project_client(v_id, p_client_name, p_client_email);
  end if;
  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- 8. add_project_member: the team's managers only (clients come from the client card)
-- ---------------------------------------------------------------------------
create or replace function public.add_project_member(p_project uuid, p_email text, p_role public.project_role)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_user uuid;
begin
  if not public.is_project_manager(p_project) then
    raise exception 'Only project managers can add members' using errcode = '42501', hint = 'not_project_manager';
  end if;
  if p_role = 'client' then
    raise exception 'Clients are added on the client card' using errcode = '22023', hint = 'client_role_not_allowed';
  end if;
  select u.id into v_user from auth.users u where lower(u.email) = lower(trim(p_email));
  if v_user is null then
    raise exception 'No Renovision account uses %. Ask them to sign up first.', p_email
      using errcode = 'P0002', hint = 'account_not_found';
  end if;
  if p_role = 'manager' and not private.is_staff(v_user) then
    raise exception 'Only manager accounts can manage a project'
      using errcode = '22023', hint = 'manager_requires_staff_account';
  end if;
  if exists (
    select 1 from public.project_contacts pc
    where pc.project_id = p_project and pc.role = 'client' and private.client_account(pc.contact_id) = v_user
  ) then
    raise exception 'This person is the project''s client, so they can''t manage it'
      using errcode = '23514', hint = 'manager_is_project_client';
  end if;
  insert into public.project_members (project_id, user_id, role)
  values (p_project, v_user, p_role)
  on conflict (project_id, user_id) do update set role = excluded.role;
  return v_user;
end;
$$;

-- ---------------------------------------------------------------------------
-- 9. project_summary gains my_role (last column; columns and options otherwise unchanged)
-- ---------------------------------------------------------------------------
create or replace view public.project_summary
with (security_invoker = true) as
select
  p.id,
  p.name,
  p.address,
  p.address_line,
  p.postal_code,
  p.city,
  p.country,
  p.currency,
  p.status,
  p.start_date,
  p.target_date,
  p.budget,
  p.spent,
  p.schedule_status,
  p.schedule_note,
  p.created_at,
  p.updated_at,
  coalesce(round(avg(s.progress))::integer, 0) as overall_progress,
  count(s.id) filter (where s.status = 'done'::public.work_status)::integer as stages_done,
  count(s.id)::integer as stages_total,
  (
    select s2.name from public.stages s2
    where s2.project_id = p.id and s2.status = 'progress'::public.work_status
    order by s2.sort_order limit 1
  ) as current_stage,
  (
    select pr.full_name from public.project_members m
    join public.profiles pr on pr.id = m.user_id
    where m.project_id = p.id and m.role = 'manager'::public.project_role
    order by m.created_at limit 1
  ) as manager_name,
  (
    select c.full_name from public.project_contacts pc
    join public.contacts c on c.id = pc.contact_id
    where pc.project_id = p.id and pc.role = 'client'::public.project_contact_role
    order by pc.is_primary desc, pc.sort_order, pc.created_at limit 1
  ) as client_display_name,
  p.plan_image_path,
  p.plan_image_opts,
  (
    select m.role from public.project_members m
    where m.project_id = p.id and m.user_id = (select auth.uid())
  ) as my_role
from public.projects p
left join public.stages s on s.project_id = p.id
group by p.id;

-- ---------------------------------------------------------------------------
-- 10. Privileges (each new function explicitly; nothing in bulk)
-- ---------------------------------------------------------------------------
revoke execute on function private.normalize_contact_email() from public, anon, authenticated;
revoke execute on function private.is_staff(uuid) from public, anon, authenticated;
revoke execute on function private.account_for_email(text) from public, anon, authenticated;
revoke execute on function private.client_account(uuid) from public, anon, authenticated;
revoke execute on function private.assert_not_project_manager(uuid, uuid) from public, anon, authenticated;
revoke execute on function private.drop_client_membership(uuid, uuid) from public, anon, authenticated;
revoke execute on function private.sync_client_access(uuid) from public, anon, authenticated;
revoke execute on function private.contacts_client_access() from public, anon, authenticated;
revoke execute on function private.contacts_drop_client_access() from public, anon, authenticated;
revoke execute on function private.guard_project_client() from public, anon, authenticated;
revoke execute on function private.project_contacts_client_access() from public, anon, authenticated;
revoke execute on function private.auth_user_client_access() from public, anon, authenticated;

revoke execute on function public.set_project_client(uuid, text, text, text) from public, anon;
revoke execute on function public.create_project(text, text, text, text, text, text, public.project_status, text, date, date, numeric, text)
  from public, anon;
revoke execute on function public.add_project_member(uuid, text, public.project_role) from public, anon;
grant execute on function public.set_project_client(uuid, text, text, text),
  public.create_project(text, text, text, text, text, text, public.project_status, text, date, date, numeric, text),
  public.add_project_member(uuid, text, public.project_role)
  to authenticated;

-- ---------------------------------------------------------------------------
-- 11. Backfill: every client contact with an email gets its account linked and its access granted
-- ---------------------------------------------------------------------------
alter table public.project_members disable trigger log_activity;
select private.sync_client_access(c.id)
from public.contacts c
where c.email is not null
  and (c.kind = 'client'
       or exists (select 1 from public.project_contacts pc where pc.contact_id = c.id and pc.role = 'client'));
alter table public.project_members enable trigger log_activity;
