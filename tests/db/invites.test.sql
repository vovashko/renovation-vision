-- Invites (T40): accept_invitation, the one-open-invitation index, invite_account_state and their grants.
-- Run against a seeded database (everything is rolled back): bun run test:db, or directly with psql.
-- Prints "invites tests passed" on success; any failed assertion aborts with an error.
--
--   Jonas  a0…01  staff, manager of Maple Street (b0…01)     Sarah a0…02  Maple Street's client
--   Ivy    c0…01  invited client of "Invite Test"            Pam   c0…02  invited manager
--   Max    c0…03  someone else                               Cleo  c0…04  "Invite Test"'s client, invited as a manager

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

-- Fails unless `sql` raises any error (a privilege or constraint error carries no hint).
create or replace function pg_temp.fails(sql text, what text) returns void language plpgsql as $$
begin
  begin
    execute sql;
  exception when others then
    return;
  end;
  raise exception 'FAILED: % (no error)', what;
end $$;

create or replace function pg_temp.h(p_token text) returns text language sql as $$
  select encode(sha256(convert_to(p_token, 'UTF8')), 'hex');
$$;

create or replace function pg_temp.project() returns uuid language sql as $$
  select id from public.projects where name = 'Invite Test';
$$;

-- ===========================================================================
-- Privileges
-- ===========================================================================
select pg_temp.check(has_function_privilege('authenticated', 'public.accept_invitation(text, text, text, text)', 'EXECUTE'),
  'authenticated can accept an invitation');
select pg_temp.check(not has_function_privilege('anon', 'public.accept_invitation(text, text, text, text)', 'EXECUTE'),
  'anon can''t accept an invitation');
select pg_temp.check(not has_function_privilege('authenticated', 'public.invite_account_state(text)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.invite_account_state(text)', 'EXECUTE'),
  'the API roles can''t read account states');
select pg_temp.check(has_function_privilege('service_role', 'public.invite_account_state(text)', 'EXECUTE'),
  'the server (service_role) reads account states');

-- ===========================================================================
-- Setup: a project whose client contact is Ivy, and the invitees' accounts (an invite creates them unconfirmed)
-- ===========================================================================
select pg_temp.check((select account_type = 'admin' from public.profiles where id = 'a0000000-0000-4000-8000-000000000001'),
  'Jonas is staff');
select pg_temp.as_user('a0000000-0000-4000-8000-000000000001');
select public.create_project(p_name => 'Invite Test', p_client_name => 'Ivy Invitee', p_client_email => 'ivy@test.demo');
select pg_temp.as_admin();

insert into auth.users (id, email, aud, role, invited_at) values
  ('c0000000-0000-4000-8000-000000000001', 'ivy@test.demo', 'authenticated', 'authenticated', now()),
  ('c0000000-0000-4000-8000-000000000002', 'pam@test.demo', 'authenticated', 'authenticated', now()),
  ('c0000000-0000-4000-8000-000000000003', 'max@test.demo', 'authenticated', 'authenticated', null);
update auth.users set email_confirmed_at = now(), last_sign_in_at = now() where id = 'c0000000-0000-4000-8000-000000000003';

select pg_temp.check(
  exists (select 1 from public.project_members where project_id = pg_temp.project()
          and user_id = 'c0000000-0000-4000-8000-000000000001' and role = 'client'),
  'T35: the invite''s new account already has client access by email');

select pg_temp.check(
  (select row(user_id, confirmed, invited, signed_in)::text from public.invite_account_state(' IVY@test.demo '))
    = row('c0000000-0000-4000-8000-000000000001'::uuid, false, true, false)::text,
  'invite_account_state: an invited, unconfirmed account (email matched case-insensitively)');
select pg_temp.check(
  (select confirmed and signed_in and not invited from public.invite_account_state('max@test.demo')),
  'invite_account_state: a confirmed account that signed in');
select pg_temp.check(not exists (select 1 from public.invite_account_state('nobody@test.demo')),
  'invite_account_state: no row for an unknown email');

insert into public.invitations (email, role, project_id, invited_by, token_hash, expires_at) values
  ('ivy@test.demo', 'client', pg_temp.project(), 'a0000000-0000-4000-8000-000000000001', pg_temp.h('tok-ivy'), now() + interval '7 days'),
  ('pam@test.demo', 'manager', pg_temp.project(), 'a0000000-0000-4000-8000-000000000001', pg_temp.h('tok-pam'), now() + interval '7 days'),
  ('max@test.demo', 'client', pg_temp.project(), 'a0000000-0000-4000-8000-000000000001', pg_temp.h('tok-expired'), now() - interval '1 minute');

-- ===========================================================================
-- One open invitation per project and email
-- ===========================================================================
select pg_temp.fails($$insert into public.invitations (email, role, project_id, token_hash, expires_at)
  values ('ivy@test.demo', 'client', pg_temp.project(), pg_temp.h('dup'), now() + interval '1 day')$$,
  'a second open invitation for the same project and email');
insert into public.invitations (email, role, project_id, token_hash, expires_at, revoked_at)
  values ('ivy@test.demo', 'client', pg_temp.project(), pg_temp.h('tok-old'), now() + interval '1 day', now());
select pg_temp.check(true, 'a withdrawn invitation doesn''t block the open one');

-- ===========================================================================
-- Dead ends
-- ===========================================================================
select pg_temp.as_user('c0000000-0000-4000-8000-000000000001');
select pg_temp.raises($$select public.accept_invitation('nope', 'Ivy', 'en', '2026-10-25')$$, 'invite_invalid', 'an unknown token');
select pg_temp.raises($$select public.accept_invitation('', 'Ivy', 'en', '2026-10-25')$$, 'invite_invalid', 'an empty token');
select pg_temp.raises($$select public.accept_invitation('tok-old', 'Ivy', 'en', '2026-10-25')$$, 'invite_revoked', 'a withdrawn invitation');
select pg_temp.raises($$select public.accept_invitation('tok-pam', 'Ivy', 'en', '2026-10-25')$$, 'invite_email_mismatch',
  'someone else''s invitation');
select pg_temp.raises($$select public.accept_invitation('tok-ivy', '  ', 'en', '2026-10-25')$$, 'invite_name_required', 'no name');
select pg_temp.raises($$select public.accept_invitation('tok-ivy', 'Ivy', 'de', '2026-10-25')$$, 'invite_locale_invalid', 'a bad language');
select pg_temp.raises($$select public.accept_invitation('tok-ivy', 'Ivy', 'en', ' ')$$, 'consent_required', 'no privacy consent');

select pg_temp.as_user('c0000000-0000-4000-8000-000000000003');
select pg_temp.raises($$select public.accept_invitation('tok-expired', 'Max', 'en', '2026-10-25')$$, 'invite_expired', 'an expired invitation');

select pg_temp.as_admin();
select pg_temp.raises($$select public.accept_invitation('tok-ivy', 'Ivy', 'en', '2026-10-25')$$, 'not_signed_in', 'no session');

-- ===========================================================================
-- A client accepts: name, language, consent; access was already there
-- ===========================================================================
select pg_temp.as_user('c0000000-0000-4000-8000-000000000001');
select pg_temp.check(public.accept_invitation('tok-ivy', ' Ivy Invitee ', 'en', '2026-10-25') = pg_temp.project(),
  'accepting returns the project to open');
select pg_temp.as_admin();
select pg_temp.check(
  (select full_name = 'Ivy Invitee' and locale = 'en' and account_type = 'client'
     from public.profiles where id = 'c0000000-0000-4000-8000-000000000001'),
  'the client''s name and language are saved; they stay a client');
select pg_temp.check(
  exists (select 1 from public.consents where user_id = 'c0000000-0000-4000-8000-000000000001'
          and kind = 'privacy_policy' and version = '2026-10-25'),
  'the privacy consent is recorded');
select pg_temp.check(
  (select accepted_at is not null from public.invitations where token_hash = pg_temp.h('tok-ivy')),
  'the invitation is marked accepted');

select pg_temp.as_user('c0000000-0000-4000-8000-000000000001');
select pg_temp.raises($$select public.accept_invitation('tok-ivy', 'Ivy', 'en', '2026-10-25')$$, 'invite_used', 'accepting twice');

-- ===========================================================================
-- A manager accepts: a staff account and a manager of the project
-- ===========================================================================
select pg_temp.as_user('c0000000-0000-4000-8000-000000000002');
select pg_temp.check(public.accept_invitation('tok-pam', 'Pam Manager', 'pl', '2026-10-25') = pg_temp.project(),
  'a manager lands on the project');
select pg_temp.as_admin();
select pg_temp.check((select account_type = 'admin' from public.profiles where id = 'c0000000-0000-4000-8000-000000000002'),
  'the manager invite made the account staff');
select pg_temp.check(
  (select role = 'manager' from public.project_members
     where project_id = pg_temp.project() and user_id = 'c0000000-0000-4000-8000-000000000002'),
  'and a manager of the project');

-- An inviter who is no longer staff: the manager invite is void.
insert into auth.users (id, email, aud, role, invited_at) values
  ('c0000000-0000-4000-8000-000000000005', 'quinn@test.demo', 'authenticated', 'authenticated', now());
insert into public.invitations (email, role, project_id, invited_by, token_hash, expires_at) values
  ('quinn@test.demo', 'manager', pg_temp.project(), 'a0000000-0000-4000-8000-000000000002', pg_temp.h('tok-quinn'), now() + interval '1 day');
select pg_temp.as_user('c0000000-0000-4000-8000-000000000005');
select pg_temp.raises($$select public.accept_invitation('tok-quinn', 'Quinn', 'en', '2026-10-25')$$, 'invite_invalid',
  'a manager invite from a client account');
select pg_temp.as_admin();
select pg_temp.check((select account_type = 'client' from public.profiles where id = 'c0000000-0000-4000-8000-000000000005'),
  'nothing changed for that account');

-- The project's own client can't become its manager through an invite.
insert into auth.users (id, email, aud, role, invited_at) values
  ('c0000000-0000-4000-8000-000000000004', 'cleo@test.demo', 'authenticated', 'authenticated', now());
select pg_temp.as_user('a0000000-0000-4000-8000-000000000001');
select public.create_project(p_name => 'Cleo Flat', p_client_name => 'Cleo', p_client_email => 'cleo@test.demo');
select pg_temp.as_admin();
insert into public.invitations (email, role, project_id, invited_by, token_hash, expires_at) values
  ('cleo@test.demo', 'manager', (select id from public.projects where name = 'Cleo Flat'),
   'a0000000-0000-4000-8000-000000000001', pg_temp.h('tok-cleo'), now() + interval '1 day');
select pg_temp.as_user('c0000000-0000-4000-8000-000000000004');
select pg_temp.raises($$select public.accept_invitation('tok-cleo', 'Cleo', 'en', '2026-10-25')$$, 'manager_is_project_client',
  'a project''s client invited as its manager');
select pg_temp.as_admin();
select pg_temp.check((select account_type = 'client' from public.profiles where id = 'c0000000-0000-4000-8000-000000000004'),
  'the refused invite left the account a client');

select 'invites tests passed';
rollback;
