-- Contacts delete guard (T46 follow-up): a contact linked to ANY project can't be deleted, and
-- contact_project_links counts links the caller can't see.
-- Prints "contacts delete guard tests passed" on success.
--
--   Jonas  a0…01  manager of Maple Street      Sarah  a0…02  client (not staff)
--   Other  a0…ff  manager of their own project (created below), whose client is "Ola Nowak"

begin;

create or replace function pg_temp.as_user(p_user uuid, p_aal text default 'aal2') returns void language plpgsql as $$
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

create or replace function pg_temp.denied(sql text, what text) returns void language plpgsql as $$
begin
  execute sql;
  raise exception 'FAILED: %', what;
exception when insufficient_privilege then null;
end $$;

-- The other manager and their project, whose client contact Jonas can read (staff) but whose link he can't.
select pg_temp.as_admin();
insert into auth.users (id, email, aud, role) values
  ('a0000000-0000-4000-8000-0000000000ff', 'other@renovision.demo', 'authenticated', 'authenticated');
insert into public.profiles (id, full_name, account_type)
values ('a0000000-0000-4000-8000-0000000000ff', 'Other Manager', 'admin')
on conflict (id) do update set account_type = 'admin';
select pg_temp.as_user('a0000000-0000-4000-8000-0000000000ff');
select set_config('t.other_project',
  public.create_project('Elm Road House', 'Elm Road 1', '30-001', 'Kraków', 'PL', 'EUR', 'planning', 'Ola Nowak')::text, true);
select pg_temp.as_admin();
select set_config('t.ola', (select id::text from public.contacts where full_name = 'Ola Nowak'), true);

-- ===========================================================================
-- Manager A can't delete a contact linked only on manager B's project
-- ===========================================================================
select pg_temp.as_user('a0000000-0000-4000-8000-000000000001');
select pg_temp.check((select count(*) from public.project_contacts where contact_id = current_setting('t.ola')::uuid) = 0,
  'Jonas can not see the link (RLS)');
do $t$
declare v_hint text;
begin
  begin
    delete from public.contacts where id = current_setting('t.ola')::uuid;
    raise exception 'FAILED: Jonas deleted a contact linked on another manager''s project';
  exception when foreign_key_violation then
    get stacked diagnostics v_hint = pg_exception_hint;
  end;
  if v_hint is distinct from 'contact_linked' then raise exception 'FAILED: hint was %', v_hint; end if;
end $t$;
select pg_temp.as_admin();
select pg_temp.check((select count(*) from public.contacts where id = current_setting('t.ola')::uuid) = 1, 'the contact is still there');
select pg_temp.check((select count(*) from public.project_members
                       where project_id = current_setting('t.other_project')::uuid and role = 'client') >= 0, 'no access side effects');

-- ===========================================================================
-- contact_project_links counts links the caller can't see
-- ===========================================================================
select pg_temp.as_user('a0000000-0000-4000-8000-000000000001');
select pg_temp.check((public.contact_project_links(current_setting('t.ola')::uuid) ->> 'total')::int = 1,
  'the count includes the link Jonas can not see');
select pg_temp.check(jsonb_array_length(public.contact_project_links(current_setting('t.ola')::uuid) -> 'managed') = 0,
  'but lists no project he does not manage');
select pg_temp.as_user('a0000000-0000-4000-8000-0000000000ff');
select pg_temp.check(public.contact_project_links(current_setting('t.ola')::uuid) -> 'managed' -> 0 ->> 'name' = 'Elm Road House',
  'the owner sees the project name');
select pg_temp.as_user('a0000000-0000-4000-8000-000000000002');
select pg_temp.denied(format('select public.contact_project_links(%L)', current_setting('t.ola')), 'a client read contact links');
select pg_temp.as_admin();
set local role anon;
select pg_temp.denied(format('select public.contact_project_links(%L)', current_setting('t.ola')), 'anon read contact links');
select pg_temp.as_admin();

-- ===========================================================================
-- An unlinked contact deletes fine
-- ===========================================================================
select pg_temp.as_user('a0000000-0000-4000-8000-000000000001');
insert into public.contacts (kind, full_name) values ('other', 'Loose Contact');
select pg_temp.check((select (public.contact_project_links(c.id) ->> 'total')::int from public.contacts c where full_name = 'Loose Contact') = 0,
  'an unlinked contact has no links');
delete from public.contacts where full_name = 'Loose Contact';
select pg_temp.check((select count(*) from public.contacts where full_name = 'Loose Contact') = 0, 'the unlinked contact was deleted');

select pg_temp.as_admin();
select 'contacts delete guard tests passed' as result;
rollback;
