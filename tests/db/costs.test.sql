-- Costs and materials (T31): cost categories, stage planned costs, materials, stage_costs, import_materials.
-- Run against a seeded database (everything is rolled back): bun run test:db, or directly with psql.
-- Prints "costs tests passed" on success; any failed assertion aborts with an error.
--
--   Jonas  a0…01  manager of Maple Street (b0…01)      Sarah  a0…02  client      Tom  a0…03  client
--   Other  a0…fe  manager of their own project (created below)

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

-- Fails unless `sql` violates a check constraint.
create or replace function pg_temp.rejected(sql text, what text) returns void language plpgsql as $$
begin
  execute sql;
  raise exception 'FAILED: %', what;
exception when check_violation or not_null_violation then null;
end $$;

-- Runs import_materials and returns the per-row errors it raised (22023), or fails if it didn't raise.
create or replace function pg_temp.import_errors(p_project uuid, p_rows jsonb) returns jsonb language plpgsql as $$
declare v_detail text;
begin
  perform public.import_materials(p_project, p_rows);
  raise exception 'FAILED: import_materials accepted invalid rows %', p_rows;
exception when invalid_parameter_value then
  get stacked diagnostics v_detail = pg_exception_detail;
  return v_detail::jsonb;
end $$;

-- A stage's row in stage_costs, for the current user.
create or replace function pg_temp.costs(p_key text) returns public.stage_costs language sql as $$
  select c.* from public.stage_costs c join public.stages s on s.id = c.stage_id
  where s.project_id = 'b0000000-0000-4000-8000-000000000001' and s.key = p_key;
$$;

-- ===========================================================================
-- expenses.category: the enum and the backfill mapping
-- ===========================================================================
select pg_temp.check(
  (select data_type = 'USER-DEFINED' and udt_name = 'cost_category' and column_default = '''other''::cost_category'
     from information_schema.columns where table_schema = 'public' and table_name = 'expenses' and column_name = 'category'),
  'expenses.category is a cost_category defaulting to other');
select pg_temp.check(
  enum_range(null::public.cost_category)::text[] = array['labour', 'materials', 'permits', 'disposal', 'equipment', 'other'],
  'cost_category has the six categories');
select pg_temp.check(
  (select bool_and(private.cost_category_from_text(v.input) = v.expected::public.cost_category)
     from (values
       ('Labour', 'labour'), ('LABOUR', 'labour'), (' labour ', 'labour'), ('Labor', 'labour'),
       ('Materials', 'materials'), ('materials', 'materials'), ('Material', 'materials'),
       ('Permits', 'permits'), ('pErMiTs', 'permits'), ('Disposal', 'disposal'), ('Equipment', 'equipment'),
       ('Other', 'other'), ('Snacks', 'other'), ('', 'other'), (null, 'other')
     ) as v (input, expected)),
  'the backfill maps the old text categories case-insensitively, unknown to other');
select pg_temp.check(
  (select string_agg(category::text || ':' || n, ',' order by category)
     from (select category, count(*) n from public.expenses group by category) x)
  = 'labour:4,materials:3,permits:1,disposal:1',
  'seeded expenses carry the enum categories');
do $$
begin
  insert into public.expenses (project_id, description, amount, category)
  values ('b0000000-0000-4000-8000-000000000001', 'x', 1, 'Snacks');
  raise exception 'FAILED: an unknown category was accepted';
exception when invalid_text_representation then null;
end $$;

-- ===========================================================================
-- Seeded shape and constraints
-- ===========================================================================
select pg_temp.check((select count(*) from public.stage_budgets) = (select count(*) from public.stages),
  'every stage has a budget row');
select pg_temp.check((select sum(planned_cost) from public.stage_budgets) = 83000, 'seeded planned costs total 83 000');
select pg_temp.check((select count(*) from public.materials) = 8, 'eight seeded materials');
select pg_temp.check(
  (select count(*) from public.materials m join public.contacts c on c.id = m.supplier_contact_id where c.kind = 'supplier') >= 1,
  'a seeded material has a supplier contact');
select pg_temp.check((select count(*) from public.materials where expense_id is not null) >= 1,
  'a seeded material is linked to an expense');
select pg_temp.check(
  (select count(distinct status) from public.materials) = 4, 'seeded materials cover every status');

select pg_temp.rejected($q$update public.stage_budgets set planned_cost = -1$q$, 'negative planned cost accepted');
select pg_temp.rejected($q$insert into public.materials (project_id, name, quantity) values ('b0000000-0000-4000-8000-000000000001', 'x', 0)$q$,
  'zero quantity accepted');
select pg_temp.rejected($q$insert into public.materials (project_id, name, unit_price) values ('b0000000-0000-4000-8000-000000000001', 'x', -1)$q$,
  'negative unit price accepted');
select pg_temp.rejected($q$insert into public.materials (project_id, name) values ('b0000000-0000-4000-8000-000000000001', '  ')$q$,
  'blank material name accepted');
select pg_temp.rejected($q$insert into public.materials (project_id, name, unit) values ('b0000000-0000-4000-8000-000000000001', 'x', ' ')$q$,
  'blank unit accepted');
insert into public.materials (project_id, name) values ('b0000000-0000-4000-8000-000000000001', 'Defaults');
select pg_temp.check(
  (select quantity = 1 and unit = 'pcs' and unit_price = 0 and status = 'planned' and progress_entry_id is null
     from public.materials where name = 'Defaults'),
  'materials default to 1 pcs at 0, planned');
delete from public.materials where name = 'Defaults';

-- A new stage gets its budget row; deleting the stage removes it.
insert into public.stages (id, project_id, key, name, start_date, end_date)
values ('c0000000-0000-4000-8000-0000000000aa', 'b0000000-0000-4000-8000-000000000001', 'tmp', 'Temp', current_date, current_date);
select pg_temp.check(
  (select planned_cost = 0 and project_id = 'b0000000-0000-4000-8000-000000000001'
     from public.stage_budgets where stage_id = 'c0000000-0000-4000-8000-0000000000aa'),
  'a new stage gets a zero budget row');
delete from public.stages where id = 'c0000000-0000-4000-8000-0000000000aa';
select pg_temp.check(not exists (select 1 from public.stage_budgets where stage_id = 'c0000000-0000-4000-8000-0000000000aa'),
  'the budget row goes with its stage');

-- An unrelated manager with a project of their own (and a stage, room and expense there).
insert into auth.users (id, email, aud, role) values
  ('a0000000-0000-4000-8000-0000000000fe', 'costs-other@renovision.demo', 'authenticated', 'authenticated');
insert into public.profiles (id, full_name, account_type)
values ('a0000000-0000-4000-8000-0000000000fe', 'Other Manager', 'manager')
on conflict (id) do update set account_type = 'manager';
insert into public.projects (id, name) values ('b0000000-0000-4000-8000-0000000000fe', 'Other project');
insert into public.project_members (project_id, user_id, role)
values ('b0000000-0000-4000-8000-0000000000fe', 'a0000000-0000-4000-8000-0000000000fe', 'manager');
insert into public.stages (id, project_id, key, name, start_date, end_date)
values ('c0000000-0000-4000-8000-0000000000fe', 'b0000000-0000-4000-8000-0000000000fe', 'demo', 'Demolition', current_date, current_date);
insert into public.expenses (id, project_id, description, amount)
values ('90000000-0000-4000-8000-0000000000fe', 'b0000000-0000-4000-8000-0000000000fe', 'Other expense', 10);

-- References must stay inside the material's project.
do $$
begin
  insert into public.materials (project_id, name, stage_id)
  values ('b0000000-0000-4000-8000-000000000001', 'x', 'c0000000-0000-4000-8000-0000000000fe');
  raise exception 'FAILED: a material took another project''s stage';
exception when check_violation then null;
end $$;
do $$
begin
  insert into public.materials (project_id, name, expense_id)
  values ('b0000000-0000-4000-8000-000000000001', 'x', '90000000-0000-4000-8000-0000000000fe');
  raise exception 'FAILED: a material took another project''s expense';
exception when check_violation then null;
end $$;

-- ===========================================================================
-- stage_costs roll-ups (manager)
-- ===========================================================================
select pg_temp.as_user('a0000000-0000-4000-8000-000000000001');
select pg_temp.check((select count(*) from public.stage_costs) = 7, 'manager sees a cost row per stage');
select pg_temp.check(
  (select planned = 13500 and spent = 8000 and committed = 2572.50 and remaining = 2927.50 from pg_temp.costs('floor')),
  'Flooring: planned 13 500, spent 8 000, committed 2 572.50 (skirting ordered + tiles delivered), remaining 2 927.50');
select pg_temp.check(
  (select planned = 17500 and spent = 0 and committed = 14800 and remaining = 2700 from pg_temp.costs('kitch')),
  'Kitchen: the ordered cabinets are committed; the planned worktop is not');
select pg_temp.check(
  (select planned = 22000 and spent = 22550 and committed = 0 and remaining = -550 from pg_temp.costs('elec')),
  'Electrical: over budget shows a negative remaining');
select pg_temp.check(
  (select spent = 12900 and committed = 0 from pg_temp.costs('wall')),
  'Walls: installed drywall boards linked to their expense count only as spent');

-- Committed -> spent: buying the skirting moves it from committed to spent without counting it twice.
with e as (
  insert into public.expenses (project_id, stage_id, category, description, amount)
  values ('b0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000004', 'materials', 'Oak skirting', 777)
  returning id
)
update public.materials set expense_id = (select id from e), status = 'delivered'
where id = '20000000-0000-4000-8000-000000000002';
select pg_temp.check(
  (select spent = 8777 and committed = 1795.50 and remaining = 2927.50 from pg_temp.costs('floor')),
  'linking a committed material to its expense moves it to spent, counted once');
-- Installed and planned materials are never committed; an unlinked delivered one is.
update public.materials set status = 'installed' where id = '20000000-0000-4000-8000-000000000003';
select pg_temp.check((select committed = 0 from pg_temp.costs('floor')), 'installed materials are not committed');
update public.materials set status = 'ordered' where id = '20000000-0000-4000-8000-000000000004';
select pg_temp.check((select committed = 252 from pg_temp.costs('floor')), 'ordering a planned material commits it');

-- Managers set planned costs (only that column).
update public.stage_budgets set planned_cost = 20000 where stage_id = 'c0000000-0000-4000-8000-000000000005';
select pg_temp.check((select planned = 20000 and remaining = 5200 from pg_temp.costs('kitch')), 'manager updates a planned cost');
select pg_temp.denied($q$update public.stage_budgets set project_id = 'b0000000-0000-4000-8000-0000000000fe'$q$,
  'manager moved a budget row to another project');
select pg_temp.denied($q$delete from public.stage_budgets$q$, 'manager deleted a budget row');
select pg_temp.check(
  (select count(*) from public.activity_log where entity_type = 'stage_budgets' and action = 'update'
     and changes ? 'planned_cost') = 1,
  'a planned-cost change is written to the activity log');

-- Another manager sees only their own project's costs and materials.
select pg_temp.as_user('a0000000-0000-4000-8000-0000000000fe');
select pg_temp.check((select count(*) from public.stage_costs) = 1, 'other manager sees only their stage costs');
select pg_temp.check((select count(*) from public.materials) = 0, 'other manager sees no Maple Street materials');
select pg_temp.check((select count(*) from public.stage_budgets) = 1, 'other manager sees only their budget rows');
select pg_temp.denied(
  $q$insert into public.materials (project_id, name) values ('b0000000-0000-4000-8000-000000000001', 'x')$q$,
  'a manager added a material to a project they do not manage');
do $$
declare n int;
begin
  update public.stage_budgets set planned_cost = 1 where project_id = 'b0000000-0000-4000-8000-000000000001';
  get diagnostics n = row_count;
  perform pg_temp.check(n = 0, 'a manager cannot set another project''s planned costs');
end $$;

-- ===========================================================================
-- Clients: no materials, costs or planned cost; their stages still load
-- ===========================================================================
select pg_temp.as_user('a0000000-0000-4000-8000-000000000002');
select pg_temp.check((select count(*) from public.materials) = 0, 'client cannot read materials');
select pg_temp.check((select count(*) from public.stage_costs) = 0, 'client gets no stage_costs rows');
select pg_temp.check((select count(*) from public.stage_budgets) = 0, 'client cannot read planned costs');
select pg_temp.check((select count(*) from public.stages) = 7, 'client still reads their visible stages');
select pg_temp.check(
  (select count(*) from public.stages s join public.tasks t on t.stage_id = s.id) > 0,
  'client still reads the stages'' tasks (the progress page''s select("*, tasks(*)"))');
select pg_temp.check(not exists (
  select 1 from information_schema.columns
  where table_schema = 'public' and table_name in ('stages', 'project_summary') and column_name like '%planned%'
    and column_name not in ('planned_target_date', 'planned_budget')),  -- the project baseline is not a stage cost
  'no planned-cost column on the client-readable stages or project_summary');
select pg_temp.denied($q$insert into public.materials (project_id, name) values ('b0000000-0000-4000-8000-000000000001', 'x')$q$,
  'client added a material');
do $$
declare n int;
begin
  update public.stage_budgets set planned_cost = 0;
  get diagnostics n = row_count;
  perform pg_temp.check(n = 0, 'client cannot change planned costs');
  delete from public.materials;
  get diagnostics n = row_count;
  perform pg_temp.check(n = 0, 'client cannot delete materials');
end $$;
select pg_temp.denied($q$select public.import_materials('b0000000-0000-4000-8000-000000000001', '[{"name":"x"}]')$q$,
  'client imported materials');

-- ===========================================================================
-- Staff MFA: AAL1 staff see no materials, budgets or costs while enforcement is on
-- ===========================================================================
select pg_temp.as_admin();
update private.app_settings set enforce_staff_mfa = true;
select pg_temp.as_user('a0000000-0000-4000-8000-000000000001', 'aal1');
select pg_temp.check((select count(*) from public.materials) = 0, 'AAL1 manager cannot read materials when enforced');
select pg_temp.check((select count(*) from public.stage_budgets) = 0, 'AAL1 manager cannot read planned costs when enforced');
select pg_temp.check((select count(*) from public.stage_costs) = 0, 'AAL1 manager gets no stage_costs when enforced');
select pg_temp.check((select count(*) from public.stages) = 7, 'AAL1 manager still reads the stages');
select pg_temp.denied($q$insert into public.materials (project_id, name) values ('b0000000-0000-4000-8000-000000000001', 'x')$q$,
  'AAL1 manager added a material when enforced');
select pg_temp.denied($q$select public.import_materials('b0000000-0000-4000-8000-000000000001', '[{"name":"x"}]')$q$,
  'AAL1 manager imported materials when enforced');
select pg_temp.as_user('a0000000-0000-4000-8000-000000000001', 'aal2');
select pg_temp.check((select count(*) from public.materials) > 0, 'AAL2 manager reads materials when enforced');
select pg_temp.check((select count(*) from public.stage_costs) = 7, 'AAL2 manager reads stage_costs when enforced');
select pg_temp.as_admin();
update private.app_settings set enforce_staff_mfa = false;

-- ===========================================================================
-- import_materials
-- ===========================================================================
select pg_temp.as_user('a0000000-0000-4000-8000-000000000001');
select set_config('t31.before', (select count(*)::text from public.materials), true);

-- All-or-nothing: one bad row among good ones inserts nothing, and every problem is reported.
select set_config('t31.errors', pg_temp.import_errors('b0000000-0000-4000-8000-000000000001', $j$[
  {"name": "Good row", "quantity": 2, "unit": "m2", "unit_price": "12,50", "stage": "flooring", "room": "Bathroom"},
  {"name": " ", "quantity": 0, "unit_price": -1},
  {"name": "Bad refs", "stage": "Roofing", "room": "Garage", "supplier": "Nobody Ltd", "status": "lost"},
  {"name": "Bad numbers", "quantity": "abc", "unit_price": "1e3", "unit": "a very long unit name"},
  "not an object"
]$j$)::text, true);
select pg_temp.check((select count(*)::text from public.materials) = current_setting('t31.before'),
  'a failed import inserts nothing');
select pg_temp.check(
  (select jsonb_agg(e order by (e ->> 'row')::int, e ->> 'field') from jsonb_array_elements(current_setting('t31.errors')::jsonb) e)
  = $j$[
    {"row": 2, "field": "name", "message": "required"},
    {"row": 2, "field": "quantity", "message": "must_be_positive"},
    {"row": 2, "field": "unit_price", "message": "must_not_be_negative"},
    {"row": 3, "field": "room", "message": "not_found"},
    {"row": 3, "field": "stage", "message": "not_found"},
    {"row": 3, "field": "status", "message": "invalid_status"},
    {"row": 3, "field": "supplier", "message": "not_found"},
    {"row": 4, "field": "quantity", "message": "not_a_number"},
    {"row": 4, "field": "unit", "message": "invalid_unit"},
    {"row": 4, "field": "unit_price", "message": "not_a_number"},
    {"row": 5, "field": null, "message": "not_an_object"}
  ]$j$::jsonb,
  'import_materials reports every error with row, field and message');

-- Ambiguous names are errors, not guesses.
insert into public.contacts (kind, full_name) values ('crew', 'Twin'), ('crew', 'Twin');
select pg_temp.check(
  pg_temp.import_errors('b0000000-0000-4000-8000-000000000001', '[{"name": "x", "supplier": "twin"}]')
  = '[{"row": 1, "field": "supplier", "message": "ambiguous"}]'::jsonb,
  'an ambiguous supplier name is reported');

-- A valid batch: names resolve case-insensitively, defaults apply, supplier matches by company.
select pg_temp.check(
  public.import_materials('b0000000-0000-4000-8000-000000000001', $j$[
    {"name": "Grout (anthracite)", "quantity": "4", "unit": "bag", "unit_price": 31.9, "status": "Ordered",
     "stage": " FLOORING ", "room": "bathroom", "supplier": "nordic oak supply", "notes": "Imported"},
    {"name": "Spare blades"}
  ]$j$) = '{"inserted": 2}'::jsonb,
  'a valid import returns the inserted count');
select pg_temp.check(
  (select m.quantity = 4 and m.unit = 'bag' and m.unit_price = 31.90 and m.status = 'ordered'
          and m.stage_id = 'c0000000-0000-4000-8000-000000000004' and m.room_id = 'd0000000-0000-4000-8000-000000000004'
          and m.supplier_contact_id = '10000000-0000-4000-8000-000000000007' and m.notes = 'Imported'
          and m.created_by = 'a0000000-0000-4000-8000-000000000001'
     from public.materials m where m.name = 'Grout (anthracite)'),
  'imported row resolves stage, room and supplier by name');
select pg_temp.check(
  (select quantity = 1 and unit = 'pcs' and unit_price = 0 and status = 'planned' and stage_id is null
     from public.materials where name = 'Spare blades'),
  'imported row without optional fields gets the defaults');
select pg_temp.check(public.import_materials('b0000000-0000-4000-8000-000000000001', '[]') = '{"inserted": 0}'::jsonb,
  'an empty import inserts nothing');
do $$
begin
  perform public.import_materials('b0000000-0000-4000-8000-000000000001', '{"name": "x"}');
  raise exception 'FAILED: a non-array import was accepted';
exception when invalid_parameter_value then null;
end $$;

-- Non-managers are rejected: another project's manager, and a stage name from the other project doesn't resolve.
select pg_temp.as_user('a0000000-0000-4000-8000-0000000000fe');
select pg_temp.denied($q$select public.import_materials('b0000000-0000-4000-8000-000000000001', '[{"name":"x"}]')$q$,
  'another project''s manager imported materials');
select pg_temp.check(
  pg_temp.import_errors('b0000000-0000-4000-8000-0000000000fe', '[{"name": "x", "stage": "Flooring"}]')
  = '[{"row": 1, "field": "stage", "message": "not_found"}]'::jsonb,
  'stage names resolve within the target project only');

-- ===========================================================================
-- Activity log: the existing trigger fires for materials
-- ===========================================================================
select pg_temp.as_user('a0000000-0000-4000-8000-000000000001');
insert into public.materials (id, project_id, name) values
  ('20000000-0000-4000-8000-0000000000aa', 'b0000000-0000-4000-8000-000000000001', 'Logged material');
update public.materials set quantity = 3 where id = '20000000-0000-4000-8000-0000000000aa';
delete from public.materials where id = '20000000-0000-4000-8000-0000000000aa';
select pg_temp.check(
  (select string_agg(action, ',' order by id) from public.activity_log
    where entity_type = 'materials' and entity_id = '20000000-0000-4000-8000-0000000000aa') = 'insert,update,delete',
  'materials inserts, updates and deletes are written to the activity log');
select pg_temp.check(
  (select summary = 'Added material "Logged material"' and params ->> 'entity' = 'material'
          and params ->> 'label' = 'Logged material' and project_id = 'b0000000-0000-4000-8000-000000000001'
          and actor_id = 'a0000000-0000-4000-8000-000000000001'
     from public.activity_log
    where entity_type = 'materials' and entity_id = '20000000-0000-4000-8000-0000000000aa' and action = 'insert'),
  'a materials entry is logged as a material (label from 20261004100000_w4_activity_labels)');
select pg_temp.check(
  (select changes = '{"quantity": {"from": 1.000, "to": 3.000}}'::jsonb from public.activity_log
    where entity_type = 'materials' and entity_id = '20000000-0000-4000-8000-0000000000aa' and action = 'update'),
  'a materials update records what changed');

-- ===========================================================================
-- Anonymous and privileges
-- ===========================================================================
select pg_temp.as_admin();
select pg_temp.check(not has_function_privilege('anon', 'public.import_materials(uuid, jsonb)', 'EXECUTE'),
  'anon cannot execute import_materials');
select pg_temp.check(has_function_privilege('authenticated', 'public.import_materials(uuid, jsonb)', 'EXECUTE'),
  'authenticated can execute import_materials');
select pg_temp.check(not has_function_privilege('authenticated', 'private.cost_category_from_text(text)', 'EXECUTE'),
  'the backfill helper is not callable through the API');
set local role anon;
select pg_temp.denied($q$select count(*) from public.materials$q$, 'anon read materials');
select pg_temp.denied($q$select count(*) from public.stage_budgets$q$, 'anon read stage_budgets');
select pg_temp.denied($q$select count(*) from public.stage_costs$q$, 'anon read stage_costs');

reset role;
select 'costs tests passed' as result;
rollback;
