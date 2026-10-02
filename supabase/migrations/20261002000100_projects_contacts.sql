-- Projects schema v2 and a shared contacts book (T30).
--
--   projects            structured address (address_line, postal_code, city, country); `address` becomes a
--                       generated display column; currency (ISO 4217, default PLN); lifecycle status
--   contacts            the company's address book: clients, crew, suppliers, architects, staff (user_id)
--   project_contacts    who is on which project, in which role; visible_to_client opts a row into the
--                       client-facing RPC public.project_visible_contacts(project)
--
-- Backfill, then cut-over: project_crew rows, projects.client_name and project_internal.client_phone/
-- client_email move into contacts + project_contacts, every project's first manager becomes its
-- client-visible point of contact (PoC), and the old table and columns are dropped.
--
-- RLS:
--   contacts            staff (private.is_staff()) only; clients never read it directly
--   project_contacts    the project's managers only; clients go through project_visible_contacts()
--   both                restrictive staff-MFA policy (`… : staff mfa`), like project_internal / expenses

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type public.project_status as enum ('planning', 'active', 'on_hold', 'completed', 'archived');
create type public.contact_kind as enum ('client', 'crew', 'supplier', 'architect', 'other');
create type public.project_contact_role as enum ('client', 'poc', 'crew', 'supplier', 'architect');

-- ---------------------------------------------------------------------------
-- projects: structured address, currency, status
-- ---------------------------------------------------------------------------
alter table public.projects
  add column address_line text not null default '',
  add column postal_code text not null default '',
  add column city text not null default '',
  add column country text not null default 'PL' check (country ~ '^[A-Z]{2}$'),
  add column currency char(3) not null default 'PLN' check (currency::text ~ '^[A-Z]{3}$'),
  add column status public.project_status not null default 'active';

-- The backfill below is a data migration, not a user edit: keep it out of the activity log.
alter table public.projects disable trigger log_activity;

-- Split the free-text address: "<line>, <postal code> <city>" (Polish 00-000 or a 4–5 digit code).
-- Anything else stays whole in address_line, so nothing is lost.
update public.projects p
set address_line = coalesce(m[1], p.address),
    postal_code = coalesce(m[2], ''),
    city = coalesce(m[3], '')
from (
  select id, regexp_match(btrim(address), '^(.+?),\s*([0-9]{2}-[0-9]{3}|[0-9]{4,5})\s+(.+)$') as m
  from public.projects
) parsed
where parsed.id = p.id;
update public.projects set address_line = btrim(address_line), city = btrim(city);

alter table public.projects enable trigger log_activity;

-- ---------------------------------------------------------------------------
-- contacts: the address book
-- ---------------------------------------------------------------------------
create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  kind public.contact_kind not null default 'other',
  full_name text not null check (length(trim(full_name)) > 0),
  company text,
  trade text,
  phone text,
  -- E.164: "+" and 7–15 digits, no spaces (what wa.me links need).
  whatsapp text check (whatsapp is null or whatsapp ~ '^\+[1-9][0-9]{6,14}$'),
  email text,
  notes text,
  -- Links a contact to an app account (staff, or a client who was invited). One contact per account.
  user_id uuid references public.profiles (id) on delete set null,
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index contacts_user_idx on public.contacts (user_id) where user_id is not null;
create index contacts_kind_name_idx on public.contacts (kind, full_name);

create table public.project_contacts (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  contact_id uuid not null references public.contacts (id) on delete cascade,
  role public.project_contact_role not null,
  is_primary boolean not null default false,
  -- Opt-in: only these rows reach the client, through project_visible_contacts().
  visible_to_client boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, contact_id, role)
);
create index project_contacts_project_idx on public.project_contacts (project_id, role, sort_order);
create index project_contacts_contact_idx on public.project_contacts (contact_id);
-- At most one primary per role on a project (the client card's contact, the PoC).
create unique index project_contacts_primary_idx on public.project_contacts (project_id, role) where is_primary;

create trigger set_updated_at before update on public.contacts
for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.project_contacts
for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- The contact for an app account: found, or created from the profile and auth email.
-- ---------------------------------------------------------------------------
create or replace function private.user_contact(p_user uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  select c.id into v_id from public.contacts c where c.user_id = p_user;
  if v_id is null then
    insert into public.contacts (kind, full_name, email, user_id, created_by)
    select 'other',
           coalesce(nullif(btrim(p.full_name), ''), split_part(u.email, '@', 1), 'User'),
           nullif(u.email, ''), p.id, p.id
    from public.profiles p
    left join auth.users u on u.id = p.id
    where p.id = p_user
    returning id into v_id;
  end if;
  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Backfill (runs before the activity-log trigger exists, so nothing is logged)
-- ---------------------------------------------------------------------------

-- Crew: keep the ids (a crew row becomes the contact with the same id), the trade and the order.
insert into public.contacts (id, kind, full_name, trade, phone, email, created_by, created_at, updated_at)
select c.id, 'crew', btrim(c.name), nullif(btrim(c.trade), ''), nullif(btrim(c.phone), ''), nullif(btrim(c.email), ''),
       (select pr.id from public.profiles pr join public.projects p on p.created_by = pr.id where p.id = c.project_id),
       c.created_at, c.updated_at
from public.project_crew c;

insert into public.project_contacts (project_id, contact_id, role, sort_order, created_at)
select c.project_id, c.id, 'crew', c.sort_order, c.created_at
from public.project_crew c;

-- Client: projects.client_name + project_internal.client_phone/client_email -> one primary client contact.
do $$
declare
  r record;
  v_contact uuid;
begin
  for r in
    select p.id, p.created_by, btrim(p.client_name) as client_name,
           nullif(btrim(i.client_phone), '') as phone, nullif(btrim(i.client_email), '') as email,
           (select string_agg(pr.full_name, ' & ' order by m.created_at)
              from public.project_members m join public.profiles pr on pr.id = m.user_id
             where m.project_id = p.id and m.role = 'client' and btrim(pr.full_name) <> '') as member_names
    from public.projects p
    left join public.project_internal i on i.project_id = p.id
  loop
    continue when r.client_name = '' and r.phone is null and r.email is null;
    insert into public.contacts (kind, full_name, phone, email, created_by)
    values ('client', coalesce(nullif(r.client_name, ''), r.member_names, 'Client'), r.phone, r.email,
            (select pr.id from public.profiles pr where pr.id = r.created_by))
    returning id into v_contact;
    insert into public.project_contacts (project_id, contact_id, role, is_primary)
    values (r.id, v_contact, 'client', true);
  end loop;
end $$;

-- PoC: each project's first manager, visible to the client.
insert into public.project_contacts (project_id, contact_id, role, is_primary, visible_to_client)
select m.project_id, private.user_contact(m.user_id), 'poc', true, true
from (
  select distinct on (project_id) project_id, user_id
  from public.project_members
  where role = 'manager'
  order by project_id, created_at, user_id
) m;

-- ---------------------------------------------------------------------------
-- Cut-over: drop the old storage, rebuild `address` and project_summary
-- ---------------------------------------------------------------------------
drop view public.project_summary;
drop table public.project_crew; -- its policies and triggers go with it
alter table public.project_internal drop column client_phone, drop column client_email;
alter table public.projects drop column client_name;

-- `address` is now derived, so every reader keeps working: "<line>, <postal code> <city>", skipping blanks.
alter table public.projects drop column address;
alter table public.projects add column address text generated always as (
  case
    when coalesce(address_line, '') = '' then btrim(coalesce(postal_code, '') || ' ' || coalesce(city, ''))
    when btrim(coalesce(postal_code, '') || ' ' || coalesce(city, '')) = '' then address_line
    else address_line || ', ' || btrim(coalesce(postal_code, '') || ' ' || coalesce(city, ''))
  end
) stored;

-- security_invoker: a client never sees client_display_name (no access to contacts); managers do.
create view public.project_summary
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
  coalesce(round(avg(s.progress))::int, 0) as overall_progress,
  count(s.id) filter (where s.status = 'done')::int as stages_done,
  count(s.id)::int as stages_total,
  (
    select s2.name from public.stages s2
    where s2.project_id = p.id and s2.status = 'progress'
    order by s2.sort_order limit 1
  ) as current_stage,
  (
    select pr.full_name from public.project_members m
    join public.profiles pr on pr.id = m.user_id
    where m.project_id = p.id and m.role = 'manager'
    order by m.created_at limit 1
  ) as manager_name,
  (
    select c.full_name from public.project_contacts pc
    join public.contacts c on c.id = pc.contact_id
    where pc.project_id = p.id and pc.role = 'client'
    order by pc.is_primary desc, pc.sort_order, pc.created_at limit 1
  ) as client_display_name
from public.projects p
left join public.stages s on s.project_id = p.id
group by p.id;

-- ---------------------------------------------------------------------------
-- Activity log: project_contacts joins the trail ("Added crew member "Marek Nowak"").
-- contacts itself is company-wide (no project_id), so it isn't logged per project.
-- ---------------------------------------------------------------------------
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
    v_entity := case rec ->> 'role'
      when 'crew' then 'crew member'
      when 'client' then 'client contact'
      when 'poc' then 'point of contact'
      else (rec ->> 'role') || ' contact' end;
    -- The contact's name; on a cascade from a deleted contact it may be gone already.
    v_label := coalesce((select c.full_name from public.contacts c where c.id = (rec ->> 'contact_id')::uuid), '');
  else
    v_label := coalesce(rec ->> 'name', rec ->> 'title', nullif(rec ->> 'caption', ''),
                        rec ->> 'description', rec ->> 'role', '');
  end if;

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

create trigger log_activity after insert or update or delete on public.project_contacts
for each row execute function private.log_activity();

-- ---------------------------------------------------------------------------
-- create_project: structured address, currency, status; links the creator as the PoC and,
-- when a client name is given, a primary client contact.
-- ---------------------------------------------------------------------------
drop function public.create_project(text, text, text, date, date, numeric);

create or replace function public.create_project(
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
  p_budget numeric default 0
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
  v_client uuid;
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

  if nullif(btrim(coalesce(p_client_name, '')), '') is not null then
    insert into public.contacts (kind, full_name) values ('client', btrim(p_client_name)) returning id into v_client;
    insert into public.project_contacts (project_id, contact_id, role, is_primary)
    values (v_id, v_client, 'client', true);
  end if;
  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- The client-facing contacts of a project: only visible_to_client rows, only name/phone/email.
-- Any member may call it (a non-member gets nothing); clients have no other path to contacts.
-- A contact linked to an account shows the account's current name.
-- ---------------------------------------------------------------------------
create or replace function public.project_visible_contacts(p_project uuid)
returns table (role public.project_contact_role, full_name text, phone text, email text, is_primary boolean)
language sql stable security definer set search_path = '' as $$
  select pc.role, coalesce(nullif(btrim(pr.full_name), ''), c.full_name), c.phone, c.email, pc.is_primary
  from public.project_contacts pc
  join public.contacts c on c.id = pc.contact_id
  left join public.profiles pr on pr.id = c.user_id
  where pc.project_id = p_project
    and pc.visible_to_client
    and public.is_project_member(p_project)
  order by (pc.role = 'poc') desc, pc.is_primary desc, pc.sort_order, c.full_name;
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.contacts enable row level security;
alter table public.project_contacts enable row level security;

-- Single company: every staff account (manager or admin) works from the same address book.
create policy "contacts: staff all" on public.contacts
for all to authenticated
using ((select private.is_staff())) with check ((select private.is_staff()));

create policy "project_contacts: managers read" on public.project_contacts
for select to authenticated using (public.is_project_manager(project_id));
create policy "project_contacts: managers insert" on public.project_contacts
for insert to authenticated with check (public.is_project_manager(project_id));
create policy "project_contacts: managers update" on public.project_contacts
for update to authenticated
using (public.is_project_manager(project_id)) with check (public.is_project_manager(project_id));
create policy "project_contacts: managers delete" on public.project_contacts
for delete to authenticated using (public.is_project_manager(project_id));

-- Contact details are internal data: staff need an MFA-verified session while enforcement is on.
do $$
declare t text;
begin
  foreach t in array array['contacts', 'project_contacts'] loop
    execute format(
      'create policy "%1$s: staff mfa" on public.%1$I as restrictive for all to authenticated
         using ((select private.staff_mfa_ok())) with check ((select private.staff_mfa_ok()))', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Privileges
-- ---------------------------------------------------------------------------
revoke all on public.contacts, public.project_contacts, public.project_summary from anon;
grant select, insert, update, delete on public.contacts, public.project_contacts to authenticated;
grant select on public.project_summary to authenticated;

-- created_by is set by default; user_id links are managed by the database (user_contact) or a later admin UI.
revoke update on public.contacts from authenticated;
grant update (kind, full_name, company, trade, phone, whatsapp, email, notes) on public.contacts to authenticated;

-- projects: the new columns are editable; address is generated, spent/created_by stay fixed.
grant update (name, address_line, postal_code, city, country, currency, status, start_date, target_date, budget,
              schedule_status, schedule_note)
  on public.projects to authenticated;

-- The contacts policy calls is_staff(); it only reports on the caller (account_type of their own profile).
grant execute on function private.is_staff() to authenticated;

revoke execute on function private.user_contact(uuid) from public, anon, authenticated;
revoke execute on function public.create_project(text, text, text, text, text, text, public.project_status, text, date, date, numeric)
  from public, anon;
revoke execute on function public.project_visible_contacts(uuid) from public, anon;
grant execute on function public.create_project(text, text, text, text, text, text, public.project_status, text, date, date, numeric),
  public.project_visible_contacts(uuid)
  to authenticated;
