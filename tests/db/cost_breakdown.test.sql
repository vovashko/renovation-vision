-- Cost breakdown and mark-delivered (T42). Everything is rolled back; prints "cost breakdown tests passed".
--   Jonas  a0…01  manager of Maple Street (b0…01)      Sarah  a0…02  client      Tom  a0…03  client
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
-- Fails unless `sql` raises the SQLSTATE `p_state`.
create or replace function pg_temp.fails_with(sql text, p_state text, what text) returns void language plpgsql as $$
begin
  execute sql;
  raise exception 'FAILED: %', what;
exception when others then
  if sqlstate = 'P0001' and sqlerrm like 'FAILED:%' then raise; end if;
  if sqlstate <> p_state then raise exception 'FAILED: % (got % %)', what, sqlstate, sqlerrm; end if;
end $$;

-- A hidden stage with a budget and an expense, so a client must not see it.
insert into public.stages (id, project_id, key, name, start_date, end_date, is_visible)
values ('c0000000-0000-4000-8000-0000000000bb', 'b0000000-0000-4000-8000-000000000001', 'hidden', 'Hidden stage', current_date, current_date, false);
update public.stage_budgets set planned_cost = 500 where stage_id = 'c0000000-0000-4000-8000-0000000000bb';
insert into public.expenses (project_id, stage_id, description, amount, category)
values ('b0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-0000000000bb', 'Hidden spend', 77, 'permits');

-- Manager: every stage, with committed.
select pg_temp.as_user('a0000000-0000-4000-8000-000000000001');
select pg_temp.check(
  (select jsonb_array_length(public.project_cost_breakdown('b0000000-0000-4000-8000-000000000001') -> 'stages'))
  = (select count(*) from public.stages where project_id = 'b0000000-0000-4000-8000-000000000001'),
  'a manager gets every stage');
select pg_temp.check(
  (select bool_and(s ->> 'committed' is not null)
     from jsonb_array_elements(public.project_cost_breakdown('b0000000-0000-4000-8000-000000000001') -> 'stages') s),
  'a manager gets committed');
select pg_temp.check(
  (select bool_and((s ->> 'planned')::numeric = c.planned and (s ->> 'spent')::numeric = c.spent
                   and (s ->> 'committed')::numeric = c.committed)
     from jsonb_array_elements(public.project_cost_breakdown('b0000000-0000-4000-8000-000000000001') -> 'stages') s
     join public.stage_costs c on c.stage_id = (s ->> 'stage_id')::uuid),
  'the breakdown matches stage_costs');

-- Client: visible stages only, aggregates only.
select pg_temp.as_user('a0000000-0000-4000-8000-000000000002');
select pg_temp.check(
  (select jsonb_array_length(public.project_cost_breakdown('b0000000-0000-4000-8000-000000000001') -> 'stages'))
  = (select count(*) from public.stages where project_id = 'b0000000-0000-4000-8000-000000000001' and is_visible),
  'a client gets the visible stages');
select pg_temp.check(
  not exists (select 1 from jsonb_array_elements(public.project_cost_breakdown('b0000000-0000-4000-8000-000000000001') -> 'stages') s
              where s ->> 'name' = 'Hidden stage'),
  'a client does not get a hidden stage');
select pg_temp.check(
  (select bool_and(s ->> 'committed' is null and (s ->> 'planned') is not null and (s ->> 'spent') is not null)
     from jsonb_array_elements(public.project_cost_breakdown('b0000000-0000-4000-8000-000000000001') -> 'stages') s),
  'a client gets planned and spent, never committed');
select pg_temp.check(
  (select (select sum((c ->> 'spent')::numeric) from jsonb_array_elements(b -> 'categories') c)
        = (select spent from public.projects where id = 'b0000000-0000-4000-8000-000000000001')
   from (select public.project_cost_breakdown('b0000000-0000-4000-8000-000000000001') b) x),
  'the categories add up to the project spent total');
select pg_temp.check(
  (select (select array_agg(k order by k) from jsonb_object_keys(b) k) = array['categories', 'stages']
        and not (b::text like '%vendor%') and not (b::text like '%description%')
   from (select public.project_cost_breakdown('b0000000-0000-4000-8000-000000000001') b) x),
  'only aggregates: no vendors or descriptions');

-- A non-member (another manager) gets an error.
select pg_temp.as_admin();
insert into auth.users (id, email, aud, role) values
  ('a0000000-0000-4000-8000-0000000000fd', 'breakdown-other@renovision.demo', 'authenticated', 'authenticated');
insert into public.profiles (id, full_name, account_type) values ('a0000000-0000-4000-8000-0000000000fd', 'Other', 'admin')
on conflict (id) do update set account_type = 'admin';
select pg_temp.as_user('a0000000-0000-4000-8000-0000000000fd');
select pg_temp.fails_with($q$select public.project_cost_breakdown('b0000000-0000-4000-8000-000000000001')$q$, '42501',
  'a non-member read the breakdown');

-- Mark delivered: a client cannot, a manager creates one expense, a second call is refused.
select pg_temp.as_user('a0000000-0000-4000-8000-000000000002');
select pg_temp.fails_with($q$select public.mark_material_delivered('20000000-0000-4000-8000-000000000003', 100)$q$, '42501',
  'a client marked a material delivered');

select pg_temp.as_user('a0000000-0000-4000-8000-000000000001');
select pg_temp.fails_with($q$select public.mark_material_delivered('20000000-0000-4000-8000-000000000001', 100)$q$, '23505',
  'a material that already has an expense got a second one');
select pg_temp.fails_with($q$select public.mark_material_delivered('20000000-0000-4000-8000-000000000003', 0)$q$, '23514',
  'a zero expense amount was accepted');

do $$
declare v_spent_before numeric; v_expense uuid;
begin
  select spent into v_spent_before from public.projects where id = 'b0000000-0000-4000-8000-000000000001';
  v_expense := public.mark_material_delivered('20000000-0000-4000-8000-000000000005', 14800, '2026-05-07');
  perform pg_temp.check(
    (select m.status = 'delivered' and m.expense_id = v_expense and m.delivery_date is not null
       from public.materials m where m.id = '20000000-0000-4000-8000-000000000005'),
    'the material is delivered and linked');
  perform pg_temp.check(
    (select e.category = 'materials' and e.amount = 14800 and e.spent_on = '2026-05-07'
            and e.description = 'Kitchen cabinets (matte white)'
       from public.expenses e where e.id = v_expense),
    'the expense is a materials expense for the amount');
  perform pg_temp.check(
    (select spent from public.projects where id = 'b0000000-0000-4000-8000-000000000001') = v_spent_before + 14800,
    'the project spent total moved once');
end $$;
select pg_temp.fails_with($q$select public.mark_material_delivered('20000000-0000-4000-8000-000000000005', 14800)$q$, '23505',
  'the same material was paid twice');

-- Privileges
select pg_temp.as_admin();
select pg_temp.check(not has_function_privilege('anon', 'public.project_cost_breakdown(uuid)', 'EXECUTE'), 'anon cannot read the breakdown');
select pg_temp.check(has_function_privilege('authenticated', 'public.project_cost_breakdown(uuid)', 'EXECUTE'), 'authenticated can read the breakdown');
select pg_temp.check(not has_function_privilege('anon', 'public.mark_material_delivered(uuid, numeric, date)', 'EXECUTE'), 'anon cannot mark delivered');
select pg_temp.check(has_function_privilege('authenticated', 'public.mark_material_delivered(uuid, numeric, date)', 'EXECUTE'), 'authenticated can mark delivered');

select 'cost breakdown tests passed' as result;
rollback;
