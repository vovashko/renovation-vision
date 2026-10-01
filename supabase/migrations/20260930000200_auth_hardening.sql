-- Database auth hardening (T25), part 2 of 2: admin role and staff 2FA (AAL2) enforcement.
--
--   private.is_staff()                  admin or manager account
--   public.set_account_type(user, type) admins only: the one way to change profiles.account_type
--   public.create_project(...)          now open to admin as well as manager accounts
--   private.app_settings                single row; enforce_staff_mfa is ON here (production default)
--   private.staff_mfa_ok()              enforcement off, or the JWT's aal claim is 'aal2'
--   public.staff_mfa_required()         the setting, for the UI (send AAL1 staff to the 2FA screen)
--   restrictive RLS                     expenses, project_internal, project_crew, activity_log and
--                                       storage bucket 'project-internal' need staff_mfa_ok()
--
-- supabase/seed.sql turns enforcement OFF for the local and hosted-demo databases, where the demo
-- manager has no TOTP factor. A database built from migrations alone (production) enforces it.

-- ---------------------------------------------------------------------------
-- Staff helper
-- ---------------------------------------------------------------------------
create or replace function private.is_staff()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.account_type in ('admin', 'manager')
  );
$$;

-- ---------------------------------------------------------------------------
-- App settings (exactly one row)
-- ---------------------------------------------------------------------------
create table private.app_settings (
  -- Always true: the primary key plus this check allow a single row only.
  id boolean primary key default true check (id),
  -- Staff (project managers) must be MFA-verified (JWT aal = 'aal2') to read internal data.
  enforce_staff_mfa boolean not null default true,
  updated_at timestamptz not null default now()
);

insert into private.app_settings (id, enforce_staff_mfa) values (true, true)
on conflict (id) do nothing;

create trigger set_updated_at before update on private.app_settings
for each row execute function private.set_updated_at();

-- Only the database owner changes settings (SQL, migrations, seed); nothing is exposed to the API roles.
alter table private.app_settings enable row level security;
revoke all on private.app_settings from public, anon, authenticated;

-- True when enforcement is off, or the session is MFA-verified. A missing settings row enforces.
create or replace function private.staff_mfa_ok()
returns boolean language sql stable security definer set search_path = '' as $$
  select not coalesce((select s.enforce_staff_mfa from private.app_settings s where s.id), true)
      or coalesce((select auth.jwt() ->> 'aal'), '') = 'aal2';
$$;

-- The setting itself, so the UI can decide whether AAL1 staff must go through the 2FA screen.
create or replace function public.staff_mfa_required()
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select s.enforce_staff_mfa from private.app_settings s where s.id), true);
$$;

-- ---------------------------------------------------------------------------
-- Account types: admins only
-- ---------------------------------------------------------------------------
-- profiles.account_type has no UPDATE grant for authenticated (see rls_policies); this is the only
-- way to change it through the API. Admins need an MFA-verified session while enforcement is on.
-- Not written to activity_log: that trail is per project (project_id is required) and read by the
-- project's managers, while an account type is account-wide.
create or replace function public.set_account_type(p_user uuid, p_type public.account_type)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not exists (
    select 1 from public.profiles p where p.id = (select auth.uid()) and p.account_type = 'admin'
  ) then
    raise exception 'Only admins can change account types' using errcode = '42501';
  end if;
  if not private.staff_mfa_ok() then
    raise exception 'Two-factor verification required' using errcode = '42501';
  end if;
  if p_user = (select auth.uid()) then
    raise exception 'Admins cannot change their own account type' using errcode = '42501';
  end if;
  if p_type is null then
    raise exception 'Account type is required' using errcode = '22004';
  end if;

  update public.profiles set account_type = p_type where id = p_user;
  if not found then
    raise exception 'No Renovision account has id %', p_user using errcode = 'P0002';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- create_project: manager or admin accounts
-- ---------------------------------------------------------------------------
create or replace function public.create_project(
  p_name text, p_address text default '', p_client_name text default '',
  p_start_date date default null, p_target_date date default null, p_budget numeric default 0
) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if not private.is_staff() then
    raise exception 'Only manager or admin accounts can create projects' using errcode = '42501';
  end if;
  insert into public.projects (name, address, client_name, start_date, target_date, budget, created_by)
  values (p_name, p_address, p_client_name, p_start_date, p_target_date, coalesce(p_budget, 0), auth.uid())
  returning id into v_id;
  insert into public.project_members (project_id, user_id, role) values (v_id, auth.uid(), 'manager');
  insert into public.project_internal (project_id) values (v_id);
  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Staff 2FA: restrictive policies on the manager-only tables
-- ---------------------------------------------------------------------------
-- A restrictive policy is ANDed with the permissive ones, which stay as they are: a row still needs
-- "managers all" / "managers read", and now also staff_mfa_ok(). Only project managers have a
-- permissive policy on these tables, so clients (who can't read them at all) see no change.
-- `(select ...)` evaluates the check once per statement instead of once per row.
do $$
declare t text;
begin
  foreach t in array array['expenses', 'project_internal', 'project_crew', 'activity_log'] loop
    execute format(
      'create policy "%1$s: staff mfa" on public.%1$I as restrictive for all to authenticated
         using ((select private.staff_mfa_ok())) with check ((select private.staff_mfa_ok()))', t);
  end loop;
end $$;

-- storage.objects holds every bucket, so scope the check to 'project-internal' (receipts): client
-- photos, renders, chat attachments and avatars are untouched.
create policy "internal: staff mfa" on storage.objects
as restrictive for all to authenticated
using (bucket_id <> 'project-internal' or (select private.staff_mfa_ok()))
with check (bucket_id <> 'project-internal' or (select private.staff_mfa_ok()));

-- ---------------------------------------------------------------------------
-- Privileges
-- ---------------------------------------------------------------------------
revoke execute on function private.is_staff() from public, anon, authenticated;
revoke execute on function private.staff_mfa_ok() from public, anon;
grant execute on function private.staff_mfa_ok() to authenticated; -- called by the policies above

revoke execute on function public.set_account_type(uuid, public.account_type) from public, anon;
revoke execute on function public.staff_mfa_required() from public, anon;
grant execute on function public.set_account_type(uuid, public.account_type), public.staff_mfa_required()
  to authenticated;
