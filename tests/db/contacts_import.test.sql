-- Contacts import (T46): public.import_contacts.
-- Run against a seeded database (everything is rolled back): bun run test:db, or directly with psql.
-- Prints "contacts import tests passed" on success; any failed assertion aborts with an error.
--
--   Jonas  a0…01  manager (staff)      Sarah  a0…02  client (not staff)

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

-- ===========================================================================
-- Refused: clients and anonymous callers
-- ===========================================================================
select pg_temp.as_user('a0000000-0000-4000-8000-000000000002');
select pg_temp.denied($q$select public.import_contacts('[{"full_name":"X"}]'::jsonb)$q$, 'client imported contacts');
select pg_temp.check((select count(*) from public.contacts) = 0, 'client still reads no contacts');
select pg_temp.as_admin();
set local role anon;
select pg_temp.denied($q$select public.import_contacts('[{"full_name":"X"}]'::jsonb)$q$, 'anon imported contacts');
select pg_temp.as_admin();

-- ===========================================================================
-- Staff: insert, dedupe by email, fill blanks only
-- ===========================================================================
select pg_temp.as_user('a0000000-0000-4000-8000-000000000001', 'aal2');
select pg_temp.check(
  (public.import_contacts($j$[
    {"full_name":"Piotr Wisniewski","kind":"Supplier","company":"Hurtownia","trade":"Tiles","phone":"+48 600 100 200","whatsapp":"+48600100201","email":"  Piotr@Example.COM "},
    {"full_name":"Ewa Kowal","phone":"+48 (601) 200-300"}
  ]$j$::jsonb) ->> 'inserted')::int = 2, 'two contacts inserted');
select pg_temp.check(
  (select kind = 'supplier' and phone = '+48600100200' and whatsapp = '+48600100201' and email = 'piotr@example.com'
     from public.contacts where full_name = 'Piotr Wisniewski'), 'values are normalized');
select pg_temp.check((select kind = 'other' and phone = '+48601200300' from public.contacts where full_name = 'Ewa Kowal'),
  'kind defaults to other');

-- Same email: blanks are filled, nothing is overwritten. No email but same name and phone: skipped.
select pg_temp.check(
  public.import_contacts($j$[
    {"full_name":"Different Name","company":"Other Co","notes":"Prefers mornings","email":"piotr@example.com"},
    {"full_name":"ewa kowal","phone":"+48601200300"},
    {"full_name":"Sarah B","email":"SARAH@renovision.demo"}
  ]$j$::jsonb) = '{"inserted":0,"updated":1,"skipped":2}'::jsonb, 'dedupe counts');
select pg_temp.check(
  (select full_name = 'Piotr Wisniewski' and company = 'Hurtownia' and notes = 'Prefers mornings'
     from public.contacts where email = 'piotr@example.com'), 'existing values kept, empty notes filled');
select pg_temp.check((select count(*) from public.contacts where lower(email) = 'sarah@renovision.demo') = 1,
  'the client with that email is not duplicated');
select pg_temp.check((select count(*) from public.contacts where full_name = 'Different Name') = 0, 'no duplicate row');

-- ===========================================================================
-- All or nothing, with per-row errors (0-based row, field, code)
-- ===========================================================================
do $t$
declare
  v_detail text;
  v_before int := (select count(*) from public.contacts);
begin
  begin
    perform public.import_contacts($j$[
      {"full_name":"Good Person","email":"good@example.com"},
      {"full_name":"","kind":"boss","phone":"600 100 200","whatsapp":"abc","email":"nope"},
      {"full_name":"Twice","email":"dup@example.com"},
      {"full_name":"Twice Again","email":"DUP@example.com"}
    ]$j$::jsonb);
    raise exception 'FAILED: invalid rows were accepted';
  exception when sqlstate '22023' then
    get stacked diagnostics v_detail = pg_exception_detail;
  end;
  if exists (select 1 from jsonb_array_elements(v_detail::jsonb) e where (e ->> 'row')::int = 0) then
    raise exception 'FAILED: row 0 is valid but was reported';
  end if;
  if (select string_agg((e ->> 'field') || ':' || (e ->> 'code'), ',' order by e ->> 'field')
        from jsonb_array_elements(v_detail::jsonb) e where (e ->> 'row')::int = 1)
     is distinct from 'email:invalid_email,full_name:required,kind:invalid_kind,phone:invalid_phone,whatsapp:invalid_whatsapp' then
    raise exception 'FAILED: row 1 errors were %', v_detail;
  end if;
  if not exists (select 1 from jsonb_array_elements(v_detail::jsonb) e
                  where (e ->> 'row')::int = 3 and e ->> 'code' = 'duplicate_in_file') then
    raise exception 'FAILED: duplicate email in the file not reported: %', v_detail;
  end if;
  if (select count(*) from public.contacts) <> v_before then
    raise exception 'FAILED: a partial import was saved';
  end if;
end $t$;

select pg_temp.as_admin();
select 'contacts import tests passed' as result;
rollback;
