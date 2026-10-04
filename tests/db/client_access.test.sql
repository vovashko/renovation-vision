-- Client access follows the client contact's email (T35).
-- Run against a seeded database (everything is rolled back): bun run test:db, or directly with psql.
-- Prints "client access tests passed" on success; any failed assertion aborts with an error.
--
--   Jonas  a0…01  manager of Maple Street (b0…01)    Sarah a0…02 client (the client contact's account)
--   Tom    a0…03  client (explicit extra login)      Admin a0…04 staff, on no project
--   Other  a0…f1  manager account, own project       C1 / C2  client accounts created below

begin;

create or replace function pg_temp.as_user(p_user uuid) returns void language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claim.sub', p_user::text, true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', p_user, 'role', 'authenticated', 'aal', 'aal2')::text, true);
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

-- Fails unless `sql` raises an error whose hint is `expected`.
create or replace function pg_temp.raises(sql text, expected text, what text) returns void language plpgsql as $$
declare v_hint text;
begin
  begin
    execute sql;
  exception when others then
    get stacked diagnostics v_hint = pg_exception_hint;
    if v_hint is distinct from expected then
      raise exception 'FAILED: % (hint %, expected %: %)', what, v_hint, expected, sqlerrm;
    end if;
    return;
  end;
  raise exception 'FAILED: % (no error)', what;
end $$;

-- The user's role on a project, or null (read as the database owner).
create or replace function pg_temp.role_of(p_project uuid, p_user uuid) returns text language sql as $$
  select role::text from public.project_members where project_id = p_project and user_id = p_user;
$$;

create or replace function pg_temp.client_contact(p_project uuid) returns uuid language sql as $$
  select contact_id from public.project_contacts where project_id = p_project and role = 'client';
$$;

-- ===========================================================================
-- Accounts
-- ===========================================================================
insert into auth.users (id, email, aud, role) values
  ('a0000000-0000-4000-8000-0000000000f1', 'other-manager@test.demo', 'authenticated', 'authenticated'),
  ('a0000000-0000-4000-8000-0000000000c1', 'c1@test.demo', 'authenticated', 'authenticated'),
  ('a0000000-0000-4000-8000-0000000000c2', 'c2@test.demo', 'authenticated', 'authenticated');
update public.profiles set account_type = 'manager' where id = 'a0000000-0000-4000-8000-0000000000f1';

-- ===========================================================================
-- Seed: the Bennett contact is Sarah's; Tom is an explicit extra login
-- ===========================================================================
select pg_temp.check(
  (select email = 'sarah@renovision.demo' and user_id = 'a0000000-0000-4000-8000-000000000002'
     from public.contacts where id = '10000000-0000-4000-8000-000000000002'),
  'the Bennett client contact carries Sarah''s email and account');
select pg_temp.check(pg_temp.role_of('b0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000002') = 'client'
  and pg_temp.role_of('b0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000003') = 'client',
  'Sarah and Tom are Maple Street clients');

-- ===========================================================================
-- Schema: one client per project, one client contact per email, normalized emails
-- ===========================================================================
select pg_temp.check(
  (select count(*) from pg_indexes where indexname in ('project_contacts_one_client_idx', 'contacts_client_email_idx')) = 2,
  'the one-client and client-email unique indexes exist');
insert into public.contacts (kind, full_name, email) values ('crew', 'Padded Email', '  Mixed@Case.Example ');
select pg_temp.check((select email from public.contacts where full_name = 'Padded Email') = 'mixed@case.example',
  'emails are stored lowercased and trimmed');
insert into public.contacts (kind, full_name, email) values ('crew', 'Blank Email', '   ');
select pg_temp.check((select email is null from public.contacts where full_name = 'Blank Email'), 'a blank email is stored as null');
select pg_temp.raises($q$insert into public.contacts (kind, full_name, email) values ('client', 'Sarah Twin', 'SARAH@renovision.demo')$q$,
  'client_email_in_use', 'a second client contact with the same email');

-- ===========================================================================
-- create_project with a client email; access moves with the email
-- ===========================================================================
select pg_temp.as_user('a0000000-0000-4000-8000-000000000001');
select set_config('t.p1', public.create_project('Client House', p_client_name => 'Client One',
  p_client_email => ' C1@Test.demo ')::text, true);
select pg_temp.as_admin();
select pg_temp.check(
  (select c.kind = 'client' and c.full_name = 'Client One' and c.email = 'c1@test.demo'
          and c.user_id = 'a0000000-0000-4000-8000-0000000000c1' and pc.is_primary
     from public.project_contacts pc join public.contacts c on c.id = pc.contact_id
    where pc.project_id = current_setting('t.p1')::uuid and pc.role = 'client'),
  'create_project links a primary client contact with the email and its account');
select pg_temp.check(pg_temp.role_of(current_setting('t.p1')::uuid, 'a0000000-0000-4000-8000-0000000000c1') = 'client',
  'a client email that matches an account grants access');
select pg_temp.check(pg_temp.role_of(current_setting('t.p1')::uuid, 'a0000000-0000-4000-8000-000000000001') = 'manager',
  'the creator stays the manager');

select pg_temp.as_user('a0000000-0000-4000-8000-000000000001');
update public.contacts set email = 'c2@test.demo' where id = pg_temp.client_contact(current_setting('t.p1')::uuid);
select pg_temp.as_admin();
select pg_temp.check(pg_temp.role_of(current_setting('t.p1')::uuid, 'a0000000-0000-4000-8000-0000000000c1') is null
  and pg_temp.role_of(current_setting('t.p1')::uuid, 'a0000000-0000-4000-8000-0000000000c2') = 'client',
  'changing the email moves the access');
select pg_temp.check((select user_id from public.contacts where id = pg_temp.client_contact(current_setting('t.p1')::uuid))
  = 'a0000000-0000-4000-8000-0000000000c2', 'changing the email relinks the contact');

select pg_temp.as_user('a0000000-0000-4000-8000-000000000001');
update public.contacts set email = '' where id = pg_temp.client_contact(current_setting('t.p1')::uuid);
select pg_temp.as_admin();
select pg_temp.check(pg_temp.role_of(current_setting('t.p1')::uuid, 'a0000000-0000-4000-8000-0000000000c2') is null,
  'clearing the email removes the access');
select pg_temp.check((select user_id is null and email is null from public.contacts
  where id = pg_temp.client_contact(current_setting('t.p1')::uuid)), 'clearing the email unlinks the contact');

-- ===========================================================================
-- An account created later gets access; two projects share one client contact
-- ===========================================================================
select pg_temp.as_user('a0000000-0000-4000-8000-000000000001');
select set_config('t.c', public.set_project_client(current_setting('t.p1')::uuid, 'Client One', 'later@test.demo')::text, true);
select pg_temp.check(current_setting('t.c')::uuid = pg_temp.client_contact(current_setting('t.p1')::uuid),
  'set_project_client edits the project''s current client contact');
select set_config('t.p2', public.create_project('Second House', p_client_name => 'Client One (again)',
  p_client_email => 'LATER@test.demo')::text, true);
select pg_temp.check(pg_temp.client_contact(current_setting('t.p2')::uuid) = current_setting('t.c')::uuid,
  'set_project_client reuses the client contact with that email');
select pg_temp.check((select full_name from public.contacts where id = current_setting('t.c')::uuid) = 'Client One (again)',
  'the shared contact''s name is updated');
select pg_temp.as_admin();
select pg_temp.check((select count(*) from public.project_members where user_id in (
  select id from auth.users where email = 'later@test.demo')) = 0, 'no account yet, no access');

insert into auth.users (id, email, aud, role)
values ('a0000000-0000-4000-8000-0000000000c3', 'later@test.demo', 'authenticated', 'authenticated');
select pg_temp.check(pg_temp.role_of(current_setting('t.p1')::uuid, 'a0000000-0000-4000-8000-0000000000c3') = 'client'
  and pg_temp.role_of(current_setting('t.p2')::uuid, 'a0000000-0000-4000-8000-0000000000c3') = 'client',
  'an account created later with that email gets access to both projects');
select pg_temp.check((select user_id from public.contacts where id = current_setting('t.c')::uuid)
  = 'a0000000-0000-4000-8000-0000000000c3', 'the new account is linked to the contact');

select pg_temp.as_user('a0000000-0000-4000-8000-000000000001');
update public.contacts set email = 'c1@test.demo' where id = current_setting('t.c')::uuid;
select pg_temp.as_admin();
select pg_temp.check(pg_temp.role_of(current_setting('t.p1')::uuid, 'a0000000-0000-4000-8000-0000000000c3') is null
  and pg_temp.role_of(current_setting('t.p2')::uuid, 'a0000000-0000-4000-8000-0000000000c3') is null
  and pg_temp.role_of(current_setting('t.p1')::uuid, 'a0000000-0000-4000-8000-0000000000c1') = 'client'
  and pg_temp.role_of(current_setting('t.p2')::uuid, 'a0000000-0000-4000-8000-0000000000c1') = 'client',
  'editing the shared contact''s email moves access on both projects');

-- ===========================================================================
-- Crew links grant nothing; manager memberships are never touched
-- ===========================================================================
select pg_temp.as_user('a0000000-0000-4000-8000-000000000001');
with c as (insert into public.contacts (kind, full_name, email) values ('crew', 'C2 As Crew', 'c2@test.demo') returning id)
insert into public.project_contacts (project_id, contact_id, role) select current_setting('t.p1')::uuid, id, 'crew' from c;
select pg_temp.as_admin();
select pg_temp.check(pg_temp.role_of(current_setting('t.p1')::uuid, 'a0000000-0000-4000-8000-0000000000c2') is null,
  'a crew contact with an account''s email grants nothing');
select pg_temp.check((select user_id is null from public.contacts where full_name = 'C2 As Crew'),
  'a crew contact is not linked to the account');

-- The Bennett email moves to C2: Sarah loses access, Tom (an explicit login) keeps his, Jonas stays manager.
update public.contacts set email = 'c2@test.demo' where id = '10000000-0000-4000-8000-000000000002';
select pg_temp.check(pg_temp.role_of('b0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000002') is null,
  'Sarah loses access when the client email moves');
select pg_temp.check(pg_temp.role_of('b0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-0000000000c2') = 'client',
  'the new email''s account gets access');
select pg_temp.check(pg_temp.role_of('b0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000003') = 'client',
  'Tom''s explicit client membership is left alone');
select pg_temp.check(pg_temp.role_of('b0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001') = 'manager',
  'the manager membership is untouched');
update public.contacts set email = 'sarah@renovision.demo' where id = '10000000-0000-4000-8000-000000000002';
select pg_temp.check(pg_temp.role_of('b0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000002') = 'client'
  and pg_temp.role_of('b0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-0000000000c2') is null,
  'moving the email back restores Sarah');

-- ===========================================================================
-- add_project_member: managers only, staff accounts only
-- ===========================================================================
select pg_temp.as_user('a0000000-0000-4000-8000-000000000001');
select pg_temp.raises($q$select public.add_project_member(current_setting('t.p1')::uuid, 'c2@test.demo', 'client')$q$,
  'client_role_not_allowed', 'add_project_member accepted the client role');
select pg_temp.raises($q$select public.add_project_member(current_setting('t.p1')::uuid, 'c2@test.demo', 'manager')$q$,
  'manager_requires_staff_account', 'add_project_member made a client account a manager');
select pg_temp.raises($q$select public.add_project_member(current_setting('t.p1')::uuid, 'c1@test.demo', 'manager')$q$,
  'manager_requires_staff_account', 'add_project_member made the project''s client a manager');
select pg_temp.raises($q$select public.add_project_member(current_setting('t.p1')::uuid, 'nobody@test.demo', 'manager')$q$,
  'account_not_found', 'add_project_member found an account that does not exist');
select public.add_project_member(current_setting('t.p2')::uuid, 'admin@renovision.demo', 'manager');
select pg_temp.as_admin();
select pg_temp.check(pg_temp.role_of(current_setting('t.p2')::uuid, 'a0000000-0000-4000-8000-000000000004') = 'manager',
  'add_project_member adds a staff account as manager');

-- ===========================================================================
-- A staff email on a client card; the project's own manager can't be its client
-- ===========================================================================
select pg_temp.as_user('a0000000-0000-4000-8000-000000000001');
select set_config('t.staff_contact',
  public.set_project_client(current_setting('t.p1')::uuid, 'Ignored Name', 'Other-Manager@test.demo', '+48 600 000 999')::text, true);
select pg_temp.as_admin();
select pg_temp.check(
  (select user_id = 'a0000000-0000-4000-8000-0000000000f1' and kind = 'other' and full_name <> 'Ignored Name' and phone is null
     from public.contacts where id = current_setting('t.staff_contact')::uuid),
  'a staff email links the staff member''s own contact, without renaming it');
select pg_temp.check(pg_temp.client_contact(current_setting('t.p1')::uuid) = current_setting('t.staff_contact')::uuid,
  'the staff member''s contact replaces the previous client link');
select pg_temp.check(pg_temp.role_of(current_setting('t.p1')::uuid, 'a0000000-0000-4000-8000-0000000000f1') = 'client',
  'the staff member gets a client membership');
select pg_temp.check(pg_temp.role_of(current_setting('t.p1')::uuid, 'a0000000-0000-4000-8000-0000000000c1') is null
  and pg_temp.role_of(current_setting('t.p2')::uuid, 'a0000000-0000-4000-8000-0000000000c1') = 'client',
  'the replaced client loses this project only');

select pg_temp.as_user('a0000000-0000-4000-8000-000000000001');
select pg_temp.raises($q$select public.set_project_client(current_setting('t.p1')::uuid, 'Me', 'jonas@renovision.demo')$q$,
  'client_is_project_manager', 'the project''s own manager became its client');
select pg_temp.raises($q$select public.set_project_client(current_setting('t.p2')::uuid, 'Co-manager', 'admin@renovision.demo')$q$,
  'client_is_project_manager', 'a co-manager became the client');
select pg_temp.raises($q$update public.contacts set email = 'admin@renovision.demo' where id = current_setting('t.c')::uuid$q$,
  'client_is_project_manager', 'editing the client email to a manager''s email');
select pg_temp.raises($q$select public.add_project_member(current_setting('t.p1')::uuid, 'other-manager@test.demo', 'manager')$q$,
  'manager_is_project_client', 'the project''s client was made its manager');
select pg_temp.raises($q$select public.set_project_client(current_setting('t.p1')::uuid, '  ', 'x@test.demo')$q$,
  'client_name_required', 'a client without a name');

-- A second client link on a project is rejected.
select pg_temp.raises(
  $q$insert into public.project_contacts (project_id, contact_id, role)
     select current_setting('t.p1')::uuid, id, 'client' from public.contacts where full_name = 'C2 As Crew'$q$,
  'project_already_has_client', 'a second client link');

-- Only the project's managers set its client.
select pg_temp.as_user('a0000000-0000-4000-8000-0000000000f1');
select pg_temp.raises($q$select public.set_project_client('b0000000-0000-4000-8000-000000000001', 'X', 'c2@test.demo')$q$,
  'not_project_manager', 'another manager set the client of a project they don''t manage');

-- ===========================================================================
-- project_summary.my_role
-- ===========================================================================
select pg_temp.as_user('a0000000-0000-4000-8000-000000000001');
select pg_temp.check((select my_role::text from public.project_summary where id = 'b0000000-0000-4000-8000-000000000001') = 'manager',
  'my_role is manager for the manager');
select pg_temp.as_user('a0000000-0000-4000-8000-000000000002');
select pg_temp.check((select my_role::text from public.project_summary where id = 'b0000000-0000-4000-8000-000000000001') = 'client',
  'my_role is client for the client');
select pg_temp.as_user('a0000000-0000-4000-8000-0000000000f1');
select pg_temp.check((select my_role::text from public.project_summary where id = current_setting('t.p1')::uuid) = 'client',
  'my_role is client for a staff member who is the client');
select pg_temp.check(
  (select attname from pg_attribute where attrelid = 'public.project_summary'::regclass and attnum > 0 and not attisdropped
    order by attnum desc limit 1) = 'my_role',
  'my_role is the last column of project_summary');

-- ===========================================================================
-- Clients still can't read contacts
-- ===========================================================================
select pg_temp.as_user('a0000000-0000-4000-8000-0000000000c1');
select pg_temp.check((select count(*) from public.contacts) = 0, 'a client cannot select contacts');
select pg_temp.check((select count(*) from public.project_contacts) = 0, 'a client cannot select project_contacts');
select pg_temp.raises($q$select public.set_project_client(current_setting('t.p2')::uuid, 'X', 'c2@test.demo')$q$,
  'not_project_manager', 'a client set the client');

-- ===========================================================================
-- A login email change follows to the linked contact and keeps the access
-- ===========================================================================
select pg_temp.as_admin();
update auth.users set email = 'c1-new@test.demo' where id = 'a0000000-0000-4000-8000-0000000000c1';
select pg_temp.check((select email from public.contacts where id = current_setting('t.c')::uuid) = 'c1-new@test.demo',
  'the login email change updates the linked contact');
select pg_temp.check(pg_temp.role_of(current_setting('t.p2')::uuid, 'a0000000-0000-4000-8000-0000000000c1') = 'client',
  'the account keeps its access after an email change');

-- A login email change onto a client email of a project the account manages never downgrades the manager.
update public.contacts set email = 'future@test.demo' where id = current_setting('t.c')::uuid;
update auth.users set email = 'future@test.demo' where id = 'a0000000-0000-4000-8000-000000000004';
select pg_temp.check(pg_temp.role_of(current_setting('t.p2')::uuid, 'a0000000-0000-4000-8000-000000000004') = 'manager',
  'the sync never downgrades a manager');
select pg_temp.check(pg_temp.role_of(current_setting('t.p2')::uuid, 'a0000000-0000-4000-8000-0000000000c1') is null,
  'the previous account lost the access');

-- ===========================================================================
-- Unlinking or deleting the client contact removes the access
-- ===========================================================================
delete from public.project_contacts where project_id = current_setting('t.p1')::uuid and role = 'client';
select pg_temp.check(pg_temp.role_of(current_setting('t.p1')::uuid, 'a0000000-0000-4000-8000-0000000000f1') is null,
  'unlinking the client removes the access');
select pg_temp.check(pg_temp.role_of(current_setting('t.p1')::uuid, 'a0000000-0000-4000-8000-000000000001') = 'manager',
  'unlinking leaves the manager alone');
delete from public.contacts where id = '10000000-0000-4000-8000-000000000002';
select pg_temp.check(pg_temp.role_of('b0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000002') is null
  and pg_temp.role_of('b0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000003') = 'client',
  'deleting the client contact removes its access, and only its access');

select 'client access tests passed' as result;
rollback;
