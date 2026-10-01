-- Admin account type and staff 2FA (AAL2) enforcement (T25).
-- Run against a seeded database (everything is rolled back): bun run test:db, or directly with psql.
-- Prints "auth hardening tests passed" on success; any failed assertion aborts with an error.
--
--   Jonas  a0…01  manager of Maple Street      Sarah  a0…02  client
--   Tom    a0…03  client                      Admin  a0…04  admin, on no project

begin;

-- as_user with an explicit authenticator assurance level (the JWT's `aal` claim).
create or replace function pg_temp.as_user_aal(p_user uuid, p_aal text) returns void language plpgsql as $$
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

insert into storage.objects (bucket_id, name) values
  ('project-media', 'b0000000-0000-4000-8000-000000000001/photos/p1-living-drywall.jpg'),
  ('project-internal', 'b0000000-0000-4000-8000-000000000001/receipts/oak.pdf')
on conflict do nothing; -- the photo file exists when the seed media was uploaded (bun run db:reset)

-- ===========================================================================
-- Settings table: one row, not reachable by the API roles
-- ===========================================================================
do $$
begin
  insert into private.app_settings (id, enforce_staff_mfa) values (false, true);
  raise exception 'FAILED: a second settings row was accepted';
exception when check_violation then null;
end $$;
select pg_temp.check((select count(*) from private.app_settings) = 1, 'exactly one settings row');
select pg_temp.check(not has_table_privilege('authenticated', 'private.app_settings', 'select'),
  'authenticated cannot read app_settings');
select pg_temp.check(not has_table_privilege('anon', 'private.app_settings', 'select'), 'anon cannot read app_settings');
select pg_temp.check(not has_function_privilege('anon', 'public.set_account_type(uuid, public.account_type)', 'execute'),
  'anon cannot call set_account_type');
select pg_temp.check(not has_function_privilege('anon', 'public.staff_mfa_required()', 'execute'),
  'anon cannot call staff_mfa_required');
select pg_temp.check(not has_function_privilege('authenticated', 'private.is_staff()', 'execute'),
  'authenticated cannot call private.is_staff directly');

-- ===========================================================================
-- Enforcement ON (the production default)
-- ===========================================================================
update private.app_settings set enforce_staff_mfa = true;

select pg_temp.as_user_aal('a0000000-0000-4000-8000-000000000001', 'aal1');
select pg_temp.check(public.staff_mfa_required(), 'staff_mfa_required() is true when enforcement is on');
select pg_temp.check((select count(*) from public.expenses) = 0, 'AAL1 manager cannot read expenses');
select pg_temp.check((select count(*) from public.project_internal) = 0, 'AAL1 manager cannot read internal notes');
select pg_temp.check((select count(*) from public.project_crew) = 0, 'AAL1 manager cannot read the crew');
select pg_temp.check((select count(*) from public.activity_log) = 0, 'AAL1 manager cannot read the activity log');
select pg_temp.check((select count(*) from storage.objects where bucket_id = 'project-internal') = 0,
  'AAL1 manager cannot read receipts');
select pg_temp.check((select count(*) from storage.objects where name like '%p1-living%') = 1,
  'AAL1 manager still reads project media');
select pg_temp.check((select count(*) from public.photos) = 9, 'AAL1 manager still reads photos incl. drafts');
select pg_temp.check((select spent from public.projects) = 51200, 'AAL1 manager still sees the spent total');
select pg_temp.denied(
  $q$insert into public.expenses (project_id, description, amount) values ('b0000000-0000-4000-8000-000000000001', 'x', 1)$q$,
  'AAL1 manager added an expense');
select pg_temp.denied(
  $q$insert into storage.objects (bucket_id, name) values ('project-internal', 'b0000000-0000-4000-8000-000000000001/receipts/x.pdf')$q$,
  'AAL1 manager uploaded a receipt');

select pg_temp.as_user_aal('a0000000-0000-4000-8000-000000000001', 'aal2');
select pg_temp.check((select count(*) from public.expenses) = 9, 'AAL2 manager reads expenses');
select pg_temp.check((select count(*) from public.project_internal) = 1, 'AAL2 manager reads internal notes');
select pg_temp.check((select count(*) from public.project_crew) = 4, 'AAL2 manager reads the crew');
select pg_temp.check((select count(*) from public.activity_log) > 0, 'AAL2 manager reads the activity log');
select pg_temp.check((select count(*) from storage.objects where bucket_id = 'project-internal') = 1,
  'AAL2 manager reads receipts');
insert into public.expenses (project_id, description, amount) values ('b0000000-0000-4000-8000-000000000001', 'Grout', 100);
select pg_temp.check((select spent from public.projects) = 51300, 'AAL2 manager adds an expense');

-- A client is unchanged at either level: no internal data, the same client-visible rows as rls.test.sql.
select pg_temp.as_user_aal('a0000000-0000-4000-8000-000000000002', 'aal1');
select pg_temp.check((select count(*) from public.projects) = 1, 'client sees their project');
select pg_temp.check((select count(*) from public.stages) = 7, 'client sees 7 visible stages');
select pg_temp.check((select count(*) from public.rooms) = 6, 'client sees 6 rooms');
select pg_temp.check((select count(*) from public.photos) = 8, 'client sees 8 published photos');
select pg_temp.check((select count(*) from public.renders) = 4, 'client sees 4 renders');
select pg_temp.check((select count(*) from public.messages) >= 5, 'client reads the chat');
select pg_temp.check((select count(*) from storage.objects where name like '%p1-living%') = 1, 'client reads a published photo file');
select pg_temp.check((select count(*) from public.expenses) = 0, 'client cannot read expenses');
select pg_temp.check((select count(*) from public.project_internal) = 0, 'client cannot read internal notes');
select pg_temp.check((select count(*) from public.project_crew) = 0, 'client cannot read the crew');
select pg_temp.check((select count(*) from public.activity_log) = 0, 'client cannot read the activity log');
select pg_temp.check((select count(*) from storage.objects where bucket_id = 'project-internal') = 0, 'client cannot read receipts');
insert into storage.objects (bucket_id, name) values ('avatars', 'a0000000-0000-4000-8000-000000000002/me.png');
select pg_temp.check(
  (select count(*) from storage.objects where name = 'a0000000-0000-4000-8000-000000000002/me.png') = 1,
  'client still uploads an avatar');

select pg_temp.as_user_aal('a0000000-0000-4000-8000-000000000002', 'aal2');
select pg_temp.check((select count(*) from public.expenses) = 0, 'AAL2 client still cannot read expenses');
select pg_temp.check((select count(*) from storage.objects where bucket_id = 'project-internal') = 0,
  'AAL2 client still cannot read receipts');

-- Admin RPC needs an MFA-verified admin while enforcement is on.
select pg_temp.as_user_aal('a0000000-0000-4000-8000-000000000004', 'aal1');
select pg_temp.denied($q$select public.set_account_type('a0000000-0000-4000-8000-000000000003', 'manager')$q$,
  'AAL1 admin changed an account type while enforcement is on');
select pg_temp.as_user_aal('a0000000-0000-4000-8000-000000000004', 'aal2');
select public.set_account_type('a0000000-0000-4000-8000-000000000003', 'manager');
select pg_temp.as_admin();
select pg_temp.check((select account_type from public.profiles where id = 'a0000000-0000-4000-8000-000000000003') = 'manager',
  'AAL2 admin promotes Tom to manager');
update public.profiles set account_type = 'client' where id = 'a0000000-0000-4000-8000-000000000003';

-- ===========================================================================
-- Enforcement OFF (the seeded local / demo setting)
-- ===========================================================================
update private.app_settings set enforce_staff_mfa = false;

select pg_temp.as_user_aal('a0000000-0000-4000-8000-000000000001', 'aal1');
select pg_temp.check(not public.staff_mfa_required(), 'staff_mfa_required() is false when enforcement is off');
select pg_temp.check((select count(*) from public.expenses) = 10, 'AAL1 manager reads expenses when enforcement is off');
select pg_temp.check((select count(*) from public.project_internal) = 1, 'AAL1 manager reads internal notes when off');
select pg_temp.check((select count(*) from public.project_crew) = 4, 'AAL1 manager reads the crew when off');
select pg_temp.check((select count(*) from public.activity_log) > 0, 'AAL1 manager reads the activity log when off');
select pg_temp.check((select count(*) from storage.objects where bucket_id = 'project-internal') = 1,
  'AAL1 manager reads receipts when off');

-- ===========================================================================
-- set_account_type: admins only
-- ===========================================================================
select pg_temp.denied($q$select public.set_account_type('a0000000-0000-4000-8000-000000000003', 'manager')$q$,
  'manager changed an account type');
select pg_temp.denied($q$select public.set_account_type('a0000000-0000-4000-8000-000000000001', 'admin')$q$,
  'manager made themselves admin');

select pg_temp.as_user_aal('a0000000-0000-4000-8000-000000000002', 'aal1');
select pg_temp.denied($q$select public.set_account_type('a0000000-0000-4000-8000-000000000002', 'admin')$q$,
  'client made themselves admin');
select pg_temp.denied($q$update public.profiles set account_type = 'admin' where id = auth.uid()$q$,
  'client updated account_type directly');

select pg_temp.as_user_aal('a0000000-0000-4000-8000-000000000004', 'aal1');
select pg_temp.denied($q$select public.set_account_type('a0000000-0000-4000-8000-000000000004', 'client')$q$,
  'admin changed their own account type');
do $$
begin
  perform public.set_account_type('a0000000-0000-4000-8000-0000000000aa', 'manager');
  raise exception 'FAILED: set_account_type accepted an unknown user';
exception when no_data_found then null;
end $$;
select public.set_account_type('a0000000-0000-4000-8000-000000000003', 'manager');
select pg_temp.as_user_aal('a0000000-0000-4000-8000-000000000003', 'aal1');
select pg_temp.check(public.create_project('Tom''s Cabin') is not null, 'a promoted manager can create projects');

-- Admins can create projects (and become their manager); clients still can't.
select pg_temp.as_user_aal('a0000000-0000-4000-8000-000000000004', 'aal1');
select pg_temp.check((select count(*) from public.projects) = 0, 'admin sees no project they are not on');
select pg_temp.check(public.create_project('Admin Test House') is not null, 'admin creates a project');
select pg_temp.check((select count(*) from public.projects where name = 'Admin Test House') = 1, 'admin manages the new project');
select pg_temp.check((select count(*) from public.project_internal) = 1, 'admin project gets its internal row');

select pg_temp.as_user_aal('a0000000-0000-4000-8000-000000000002', 'aal1');
select pg_temp.denied($q$select public.create_project('Not mine')$q$, 'client created a project');

-- anon
select pg_temp.as_admin();
set local role anon;
select pg_temp.denied($q$select public.set_account_type('a0000000-0000-4000-8000-000000000003', 'admin')$q$,
  'anon called set_account_type');
select pg_temp.denied($q$select public.staff_mfa_required()$q$, 'anon called staff_mfa_required');

reset role;
select 'auth hardening tests passed' as result;
rollback;
