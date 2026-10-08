-- Planned baseline vs current end date / budget (#53, #54).
-- Run against a seeded database (everything is rolled back): bun run test:db, or directly with psql.
-- Prints "planned baseline tests passed" on success; any failed assertion aborts with an error.
--
--   Jonas  a0…01  manager of Maple Street (b0…01)

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

-- Fails unless `sql` raises check_violation (23514) with the baseline_locked hint.
create or replace function pg_temp.locked(sql text, what text) returns void language plpgsql as $$
declare v_hint text;
begin
  execute sql;
  raise exception 'FAILED: %', what;
exception when check_violation then
  get stacked diagnostics v_hint = pg_exception_hint;
  if v_hint is distinct from 'baseline_locked' then raise exception 'FAILED: % (hint %)', what, v_hint; end if;
end $$;

-- ===========================================================================
-- Seed: the baseline equals the current values (defaulted on insert)
-- ===========================================================================
select pg_temp.check(
  (select planned_budget = budget and budget = 84500 and planned_target_date = target_date
          and planned_target_date is not null
     from public.projects where id = 'b0000000-0000-4000-8000-000000000001'),
  'seeded project: planned_budget = budget and planned_target_date = target_date');

-- ===========================================================================
-- Insert defaults
-- ===========================================================================
insert into public.projects (id, name, status, target_date, budget)
values ('b0000000-0000-4000-8000-0000000000b1', 'Baseline default', 'planning', date '2027-01-31', 12000.50);
select pg_temp.check(
  (select planned_target_date = date '2027-01-31' and planned_budget = 12000.50
     from public.projects where id = 'b0000000-0000-4000-8000-0000000000b1'),
  'insert without a baseline copies target_date and budget');

insert into public.projects (id, name, status, target_date, budget, planned_target_date, planned_budget)
values ('b0000000-0000-4000-8000-0000000000b2', 'Baseline explicit', 'planning', date '2027-03-01', 9000,
        date '2027-02-01', 8000);
select pg_temp.check(
  (select planned_target_date = date '2027-02-01' and planned_budget = 8000
     from public.projects where id = 'b0000000-0000-4000-8000-0000000000b2'),
  'an explicit baseline on insert is kept');

insert into public.projects (id, name) values ('b0000000-0000-4000-8000-0000000000b3', 'No dates, no budget');
select pg_temp.check(
  (select planned_target_date is null and planned_budget = 0
     from public.projects where id = 'b0000000-0000-4000-8000-0000000000b3'),
  'no target_date / budget gives an empty baseline');

-- ===========================================================================
-- Locking
-- ===========================================================================
-- Planning: the baseline is editable, and independent of the current values.
update public.projects set planned_budget = 11000, planned_target_date = date '2027-02-15'
 where id = 'b0000000-0000-4000-8000-0000000000b1';
select pg_temp.check(
  (select planned_budget = 11000 and planned_target_date = date '2027-02-15' and budget = 12000.50
     from public.projects where id = 'b0000000-0000-4000-8000-0000000000b1'),
  'baseline editable while planning, current values untouched');

-- Once the project starts it is locked, whether changed alone or with the status.
update public.projects set status = 'active' where id = 'b0000000-0000-4000-8000-0000000000b1';
select pg_temp.locked($q$update public.projects set planned_budget = 1 where id = 'b0000000-0000-4000-8000-0000000000b1'$q$,
  'planned_budget locked once active');
select pg_temp.locked($q$update public.projects set planned_target_date = date '2030-01-01' where id = 'b0000000-0000-4000-8000-0000000000b1'$q$,
  'planned_target_date locked once active');
select pg_temp.locked($q$update public.projects set planned_budget = 1, planned_target_date = null where id = 'b0000000-0000-4000-8000-0000000000b1'$q$,
  'both locked once active');

-- Unchanged values (even written explicitly) and the current values stay editable.
update public.projects
   set planned_budget = planned_budget, planned_target_date = planned_target_date,
       budget = 13500, target_date = date '2027-03-10'
 where id = 'b0000000-0000-4000-8000-0000000000b1';
select pg_temp.check(
  (select budget = 13500 and target_date = date '2027-03-10' and planned_budget = 11000
          and planned_target_date = date '2027-02-15'
     from public.projects where id = 'b0000000-0000-4000-8000-0000000000b1'),
  'current end date / budget editable after start, baseline unchanged');

-- The seeded active project is locked too, as the manager through the column grants.
select pg_temp.as_user('a0000000-0000-4000-8000-000000000001');
select pg_temp.locked($q$update public.projects set planned_budget = 1 where id = 'b0000000-0000-4000-8000-000000000001'$q$,
  'manager cannot change the baseline of an active project');
update public.projects set budget = 90000, target_date = target_date + 7 where id = 'b0000000-0000-4000-8000-000000000001';
select pg_temp.check(
  (select budget = 90000 and planned_budget = 84500 from public.projects where id = 'b0000000-0000-4000-8000-000000000001'),
  'manager changes the current budget, the baseline stays');
select pg_temp.as_admin();

-- ===========================================================================
-- project_summary exposes the baseline (last columns, existing ones intact)
-- ===========================================================================
select pg_temp.check(
  (select array_agg(column_name::text order by ordinal_position) filter (where ordinal_position > 25)
     from information_schema.columns where table_schema = 'public' and table_name = 'project_summary')
  = array['planned_target_date', 'planned_budget'],
  'project_summary ends with planned_target_date, planned_budget');
select pg_temp.check(
  (select count(*) = 1 from public.project_summary
    where id = 'b0000000-0000-4000-8000-000000000001' and planned_budget = 84500
      and planned_target_date is not null and plan_image_opts is not null),
  'project_summary shows the seeded baseline');

select 'planned baseline tests passed' as result;
rollback;
