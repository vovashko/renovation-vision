-- Projects schema v2 and the contacts book (T30).
-- Run against a seeded database (everything is rolled back): bun run test:db, or directly with psql.
-- Prints "contacts tests passed" on success; any failed assertion aborts with an error.
--
--   Jonas  a0…01  manager of Maple Street (b0…01)      Sarah  a0…02  client      Tom  a0…03  client
--   Other  a0…ff  manager of their own project (created below)

begin;

create or replace function pg_temp.as_user(p_user uuid, p_aal text default 'aal1') returns void language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claim.sub', p_user::text, true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', p_user, 'role', 'authenticated', 'aal', p_aal)::text, true);
end $$;

create or replace function pg_temp.as_admin() returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claims', '', true);
end $$;

create or replace function pg_temp.check(ok boolean, what text) returns void language plpgsql as $$
begin
  if not coalesce(ok, false) then raise exception 'FAILED: %', what; end if;
end $$;

-- Fails unless `sql` raises insufficient_privilege (42501).
create or replace function pg_temp.denied(sql text, what text) returns void language plpgsql as $$
begin
  execute sql;
  raise exception 'FAILED: %', what;
exception when insufficient_privilege then null;
end $$;

-- Fails unless `sql` violates a check (or the char(3) currency's length/format).
create or replace function pg_temp.rejected(sql text, what text) returns void language plpgsql as $$
begin
  execute sql;
  raise exception 'FAILED: %', what;
exception when check_violation or invalid_text_representation or string_data_right_truncation then null;
end $$;

-- ===========================================================================
-- Seeded shape: crew, client and PoC contacts with the right roles
-- ===========================================================================
select pg_temp.check(
  (select count(*) from public.project_contacts pc join public.contacts c on c.id = pc.contact_id
    where pc.project_id = 'b0000000-0000-4000-8000-000000000001' and pc.role = 'crew' and c.kind = 'crew') = 4,
  'four crew contacts on Maple Street');
select pg_temp.check(
  (select string_agg(c.full_name || '/' || c.trade, ', ' order by pc.sort_order)
     from public.project_contacts pc join public.contacts c on c.id = pc.contact_id
    where pc.role = 'crew' and pc.sort_order <= 2) = 'Marek Nowak/Site lead, Ana Petrović/Electrician',
  'Marek (site lead) and Ana (electrician) lead the crew, in order');
select pg_temp.check(
  (select c.full_name = 'Sarah & Tom Bennett' and c.kind = 'client' and c.phone = '+1 555 0142'
          and c.email = 'sarah.bennett@example.com' and pc.is_primary and not pc.visible_to_client
     from public.project_contacts pc join public.contacts c on c.id = pc.contact_id
    where pc.role = 'client'),
  'the Bennetts are the primary client contact, hidden from the client view');
select pg_temp.check(
  (select c.user_id = 'a0000000-0000-4000-8000-000000000001' and pc.visible_to_client and pc.is_primary
     from public.project_contacts pc join public.contacts c on c.id = pc.contact_id
    where pc.role = 'poc'),
  'Jonas is the client-visible point of contact');
select pg_temp.check(
  (select count(*) from public.project_contacts where visible_to_client) = 1, 'only the PoC is visible to the client');
select pg_temp.check(
  (select client_display_name from public.project_summary) = 'Sarah & Tom Bennett', 'summary exposes the client display name');
select pg_temp.check(
  (select currency = 'PLN' and status = 'active' and country = 'PL' and address = '42 Maple Street, Apt 5B'
     from public.project_summary),
  'summary exposes currency, status, country and the address');

-- The old storage is gone.
select pg_temp.check(to_regclass('public.project_crew') is null, 'project_crew is dropped');
select pg_temp.check(not exists (
  select 1 from information_schema.columns
  where table_schema = 'public' and (
    (table_name = 'projects' and column_name = 'client_name')
    or (table_name = 'project_internal' and column_name in ('client_phone', 'client_email'))
    or (table_name = 'project_summary' and column_name = 'client_name'))),
  'client_name, client_phone and client_email are dropped');

-- ===========================================================================
-- Constraints: generated address, currency, status, whatsapp, uniqueness
-- ===========================================================================
insert into public.projects (id, name, address_line, postal_code, city)
values ('b0000000-0000-4000-8000-0000000000a1', 'Address test', 'ul. Długa 5/3', '00-238', 'Warszawa');
select pg_temp.check((select address from public.projects where id = 'b0000000-0000-4000-8000-0000000000a1')
  = 'ul. Długa 5/3, 00-238 Warszawa', 'address = line, postal code city');
update public.projects set postal_code = '', city = 'Kraków' where id = 'b0000000-0000-4000-8000-0000000000a1';
select pg_temp.check((select address from public.projects where id = 'b0000000-0000-4000-8000-0000000000a1')
  = 'ul. Długa 5/3, Kraków', 'address skips a blank postal code');
update public.projects set address_line = '', city = '' where id = 'b0000000-0000-4000-8000-0000000000a1';
select pg_temp.check((select address from public.projects where id = 'b0000000-0000-4000-8000-0000000000a1') = '',
  'an empty address is an empty string, not null');
select pg_temp.check(
  (select currency = 'PLN' and status = 'active' and country = 'PL' from public.projects where id = 'b0000000-0000-4000-8000-0000000000a1'),
  'currency, status and country default to PLN, active, PL');

do $$
begin
  update public.projects set address = 'x' where id = 'b0000000-0000-4000-8000-0000000000a1';
  raise exception 'FAILED: wrote the generated address';
exception when generated_always then null;
end $$;
select pg_temp.rejected($q$update public.projects set currency = 'pln' where id = 'b0000000-0000-4000-8000-0000000000a1'$q$,
  'lowercase currency accepted');
select pg_temp.rejected($q$update public.projects set currency = 'PL' where id = 'b0000000-0000-4000-8000-0000000000a1'$q$,
  'two-letter currency accepted');
select pg_temp.rejected($q$update public.projects set currency = 'EURO' where id = 'b0000000-0000-4000-8000-0000000000a1'$q$,
  'four-letter currency accepted');
select pg_temp.rejected($q$update public.projects set country = 'pol' where id = 'b0000000-0000-4000-8000-0000000000a1'$q$,
  'bad country code accepted');
update public.projects set currency = 'EUR', status = 'on_hold' where id = 'b0000000-0000-4000-8000-0000000000a1';
do $$
begin
  update public.projects set status = 'paused' where id = 'b0000000-0000-4000-8000-0000000000a1';
  raise exception 'FAILED: unknown project status accepted';
exception when invalid_text_representation then null;
end $$;

select pg_temp.rejected($q$insert into public.contacts (full_name, whatsapp) values ('W', '+48 600 100 200')$q$,
  'whatsapp with spaces accepted');
select pg_temp.rejected($q$insert into public.contacts (full_name, whatsapp) values ('W', '600100200')$q$,
  'whatsapp without + accepted');
insert into public.contacts (full_name, whatsapp) values ('W', '+48600100200');
select pg_temp.rejected($q$insert into public.contacts (full_name) values ('  ')$q$, 'blank contact name accepted');
do $$
begin
  insert into public.project_contacts (project_id, contact_id, role)
  values ('b0000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000003', 'crew');
  raise exception 'FAILED: duplicate (project, contact, role) accepted';
exception when unique_violation then null;
end $$;
do $$
begin
  insert into public.project_contacts (project_id, contact_id, role, is_primary)
  values ('b0000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000003', 'client', true);
  raise exception 'FAILED: a second primary client accepted';
exception when unique_violation then null;
end $$;
delete from public.projects where id = 'b0000000-0000-4000-8000-0000000000a1';

-- An unrelated manager with a project of their own (and its own crew).
insert into auth.users (id, email, aud, role) values
  ('a0000000-0000-4000-8000-0000000000ff', 'other@renovision.demo', 'authenticated', 'authenticated');
insert into public.profiles (id, full_name, account_type)
values ('a0000000-0000-4000-8000-0000000000ff', 'Other Manager', 'manager')
on conflict (id) do update set account_type = 'manager';

select pg_temp.as_user('a0000000-0000-4000-8000-0000000000ff');
select set_config('t30.other_project',
  public.create_project('Elm Road House', 'Elm Road 1', '30-001', 'Kraków', 'PL', 'EUR', 'planning', 'Ola Nowak')::text, true);
select pg_temp.check(
  (select address = 'Elm Road 1, 30-001 Kraków' and currency = 'EUR' and status = 'planning'
     from public.projects where id = current_setting('t30.other_project')::uuid),
  'create_project stores the structured address, currency and status');
select pg_temp.check(
  (select client_display_name from public.project_summary where id = current_setting('t30.other_project')::uuid) = 'Ola Nowak',
  'create_project links the client name as the primary client contact');
select pg_temp.check(
  (select count(*) from public.project_contacts pc join public.contacts c on c.id = pc.contact_id
    where pc.project_id = current_setting('t30.other_project')::uuid and pc.role = 'poc' and pc.visible_to_client
      and c.user_id = 'a0000000-0000-4000-8000-0000000000ff' and c.email = 'other@renovision.demo') = 1,
  'create_project makes the creator the client-visible PoC');
with c as (insert into public.contacts (kind, full_name, phone) values ('crew', 'Secret Crew', '+48 600 000 000') returning id)
insert into public.project_contacts (project_id, contact_id, role, visible_to_client)
select current_setting('t30.other_project')::uuid, c.id, 'crew', true from c;
select pg_temp.check((select count(*) from public.project_contacts) = 3, 'other manager sees only their project''s links');
select pg_temp.check((select count(*) from public.contacts) >= 6, 'staff share one address book');
select pg_temp.denied(
  $q$insert into public.project_contacts (project_id, contact_id, role)
     values ('b0000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000003', 'supplier')$q$,
  'a manager linked a contact to a project they do not manage');
do $$
declare n int;
begin
  delete from public.project_contacts where project_id = 'b0000000-0000-4000-8000-000000000001';
  get diagnostics n = row_count;
  perform pg_temp.check(n = 0, 'a manager cannot unlink another project''s contacts');
end $$;
select pg_temp.check(
  (select count(*) from public.project_visible_contacts('b0000000-0000-4000-8000-000000000001')) = 0,
  'a non-member gets nothing from project_visible_contacts');

-- ===========================================================================
-- Client: Sarah
-- ===========================================================================
select pg_temp.as_user('a0000000-0000-4000-8000-000000000002');
select pg_temp.check((select count(*) from public.contacts) = 0, 'client cannot select contacts');
select pg_temp.check((select count(*) from public.project_contacts) = 0, 'client cannot select project_contacts');
select pg_temp.check((select client_display_name from public.project_summary) is null,
  'client gets no client_display_name (it comes from contacts)');
select pg_temp.check((select count(*) from public.project_visible_contacts('b0000000-0000-4000-8000-000000000001')) = 1,
  'client sees exactly the visible contacts of their project');
select pg_temp.check(
  (select role = 'poc' and full_name = 'Jonas Weber' and phone = '+1 555 0100' and email = 'jonas@renovision.demo'
     from public.project_visible_contacts('b0000000-0000-4000-8000-000000000001')),
  'client sees the PoC''s name, phone and email');
select pg_temp.check(
  (select count(*) from public.project_visible_contacts(current_setting('t30.other_project')::uuid)) = 0,
  'client never sees another project''s contacts, even visible ones');
select pg_temp.check(
  (select array_agg(p.parameter_name::text order by p.ordinal_position)
     from information_schema.routines r join information_schema.parameters p using (specific_schema, specific_name)
    where r.routine_schema = 'public' and r.routine_name = 'project_visible_contacts' and p.parameter_mode = 'OUT')
  = array['role', 'full_name', 'phone', 'email', 'is_primary'],
  'project_visible_contacts returns only role, name, phone, email and is_primary');
select pg_temp.denied($q$insert into public.contacts (kind, full_name) values ('crew', 'x')$q$, 'client added a contact');
do $$
declare n int;
begin
  update public.project_contacts set visible_to_client = true;
  get diagnostics n = row_count;
  perform pg_temp.check(n = 0, 'client cannot make contacts visible');
  update public.contacts set phone = '0';
  get diagnostics n = row_count;
  perform pg_temp.check(n = 0, 'client cannot edit contacts');
end $$;

-- ===========================================================================
-- Manager: Jonas manages his project's links
-- ===========================================================================
select pg_temp.as_user('a0000000-0000-4000-8000-000000000001');
select pg_temp.check((select count(*) from public.project_contacts where project_id = 'b0000000-0000-4000-8000-000000000001') = 6,
  'manager reads his project''s links');
with c as (insert into public.contacts (kind, full_name, trade, phone) values ('crew', 'Test Tiler', 'Tiler', '+48 600 100 200') returning id),
     l as (insert into public.project_contacts (project_id, contact_id, role, sort_order)
           select 'b0000000-0000-4000-8000-000000000001', c.id, 'crew', 5 from c returning contact_id)
select set_config('t30.tiler', (select contact_id::text from l), true);
select pg_temp.check((select count(*) from public.project_contacts where role = 'crew') = 5, 'manager adds a crew member');
select pg_temp.check(
  (select count(*) from public.activity_log where entity_type = 'project_contacts' and summary = 'Added crew member "Test Tiler"') = 1,
  'linking a contact is written to the activity log');
update public.project_contacts set visible_to_client = true where contact_id = current_setting('t30.tiler')::uuid;
delete from public.project_contacts where contact_id = current_setting('t30.tiler')::uuid;
select pg_temp.check((select count(*) from public.project_contacts where role = 'crew') = 4, 'manager unlinks a crew member');
select pg_temp.check((select count(*) from public.contacts where id = current_setting('t30.tiler')::uuid) = 1,
  'unlinking keeps the contact in the address book');
select pg_temp.check(
  (select count(*) from public.activity_log where entity_type = 'project_contacts' and summary = 'Removed crew member "Test Tiler"') = 1,
  'unlinking is written to the activity log');
update public.contacts set phone = '+1 555 0199' where id = '10000000-0000-4000-8000-000000000002';
select pg_temp.check((select phone from public.contacts where id = '10000000-0000-4000-8000-000000000002') = '+1 555 0199',
  'manager edits the client contact');
select pg_temp.denied($q$update public.contacts set user_id = 'a0000000-0000-4000-8000-000000000002'
  where id = '10000000-0000-4000-8000-000000000002'$q$, 'manager re-linked a contact to another account');
update public.projects set currency = 'EUR', status = 'on_hold', address_line = '1 New St', postal_code = '00-001', city = 'Warszawa'
where id = 'b0000000-0000-4000-8000-000000000001';
select pg_temp.check((select address from public.project_summary where id = 'b0000000-0000-4000-8000-000000000001')
  = '1 New St, 00-001 Warszawa', 'manager edits the structured address');

-- ===========================================================================
-- Staff MFA: AAL1 staff see no contacts while enforcement is on
-- ===========================================================================
select pg_temp.as_admin();
update private.app_settings set enforce_staff_mfa = true;
select pg_temp.as_user('a0000000-0000-4000-8000-000000000001', 'aal1');
select pg_temp.check((select count(*) from public.contacts) = 0, 'AAL1 manager cannot read contacts when enforced');
select pg_temp.check((select count(*) from public.project_contacts) = 0, 'AAL1 manager cannot read project_contacts when enforced');
select pg_temp.denied($q$insert into public.contacts (kind, full_name) values ('crew', 'x')$q$,
  'AAL1 manager added a contact when enforced');
select pg_temp.check((select count(*) from public.project_visible_contacts('b0000000-0000-4000-8000-000000000001')) = 1,
  'the client-facing RPC still answers (it only returns client-visible fields)');
select pg_temp.as_user('a0000000-0000-4000-8000-000000000001', 'aal2');
select pg_temp.check((select count(*) from public.contacts) > 0, 'AAL2 manager reads contacts when enforced');
select pg_temp.check((select count(*) from public.project_contacts) > 0, 'AAL2 manager reads project_contacts when enforced');
select pg_temp.as_user('a0000000-0000-4000-8000-000000000002', 'aal1');
select pg_temp.check((select count(*) from public.project_visible_contacts('b0000000-0000-4000-8000-000000000001')) = 1,
  'client still sees the PoC when enforcement is on');

-- ===========================================================================
-- Anonymous
-- ===========================================================================
select pg_temp.as_admin();
set local role anon;
select pg_temp.denied($q$select count(*) from public.contacts$q$, 'anon read contacts');
select pg_temp.denied($q$select count(*) from public.project_contacts$q$, 'anon read project_contacts');
select pg_temp.denied($q$select * from public.project_visible_contacts('b0000000-0000-4000-8000-000000000001')$q$,
  'anon called project_visible_contacts');

reset role;
select 'contacts tests passed' as result;
rollback;
