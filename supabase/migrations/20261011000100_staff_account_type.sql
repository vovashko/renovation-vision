-- One staff account type (T37).
--
-- Manager and admin accounts are the same thing. Internally the account type is 'admin'; the product
-- calls it "Manager". public.account_type becomes ('client', 'admin'). project_role keeps 'manager':
-- that is the per-project role and is unrelated.

-- ---------------------------------------------------------------------------
-- 1. Data and type
-- ---------------------------------------------------------------------------
update public.profiles set account_type = 'admin' where account_type = 'manager';

alter table public.profiles alter column account_type drop default;
alter type public.account_type rename to account_type_old;
create type public.account_type as enum ('client', 'admin');
alter table public.profiles
  alter column account_type type public.account_type using account_type::text::public.account_type;
alter table public.profiles alter column account_type set default 'client';

-- The only function that takes the type as an argument; recreated below with the new type.
drop function public.set_account_type(uuid, public.account_type_old);
drop type public.account_type_old;

-- ---------------------------------------------------------------------------
-- 2. Functions that named an account type
-- ---------------------------------------------------------------------------
-- The caller's account, and any account, is staff. (The policies and RPCs that call these need no change.)
create or replace function private.is_staff()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.account_type = 'admin'
  );
$$;

create or replace function private.is_staff(p_user uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles p
    where p.id = p_user and p.account_type = 'admin'
  );
$$;

-- Staff are not emailed about events they cause themselves (default 'off'); clients get a digest.
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
  if private.is_staff(p_user) then
    return 'off';
  end if;
  return 'daily';
end;
$$;

-- Same body as before; only the error text changes ("manager", not "manager or admin").
create or replace function public.create_project(
  p_name text, p_address_line text default '', p_postal_code text default '', p_city text default '',
  p_country text default 'PL', p_currency text default 'PLN', p_status public.project_status default 'active',
  p_client_name text default '', p_start_date date default null, p_target_date date default null,
  p_budget numeric default 0, p_client_email text default ''
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
begin
  if not private.is_staff() then
    raise exception 'Only manager accounts can create projects' using errcode = '42501';
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

-- Any staff account may promote a client or demote another manager, but the last staff account can't
-- be demoted (nobody could promote anyone again). Needs an MFA-verified session while enforcement is on.
-- Not written to activity_log: that trail is per project and an account type is account-wide.
create or replace function public.set_account_type(p_user uuid, p_type public.account_type)
returns void language plpgsql security definer set search_path = '' as $$
declare v_current public.account_type;
begin
  if not private.is_staff() then
    raise exception 'Only manager accounts can change account types' using errcode = '42501';
  end if;
  if not private.staff_mfa_ok() then
    raise exception 'Two-factor verification required' using errcode = '42501';
  end if;
  if p_type is null then
    raise exception 'Account type is required' using errcode = '22004';
  end if;

  -- Lock the staff rows so two concurrent demotions can't both pass the last-staff check.
  perform 1 from public.profiles where account_type = 'admin' for update;

  select account_type into v_current from public.profiles where id = p_user;
  if not found then
    raise exception 'No Renovision account has id %', p_user using errcode = 'P0002';
  end if;
  if v_current = 'admin' and p_type <> 'admin'
     and (select count(*) from public.profiles where account_type = 'admin') <= 1 then
    raise exception 'The last manager account can''t be demoted' using errcode = '42501', hint = 'last_staff_account';
  end if;

  update public.profiles set account_type = p_type where id = p_user;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Privileges (explicit; the new function starts from the default grants)
-- ---------------------------------------------------------------------------
revoke execute on function public.set_account_type(uuid, public.account_type) from public, anon;
grant execute on function public.set_account_type(uuid, public.account_type) to authenticated;
