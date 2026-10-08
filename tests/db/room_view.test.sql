-- Room view (issue #56): room-only tasks and derived room progress, material dates, the client-safe
-- room_materials() read, and investor warnings (visibility, RLS). Run against a freshly seeded database with
-- `bun run test:db` (see tests/db/README.md); everything is rolled back.
-- Prints "room view tests passed" on success; any failed assertion aborts with an error.

begin;

create or replace function pg_temp.as_user(p_user uuid) returns void language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claim.sub', p_user::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
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

create or replace function pg_temp.room(p_key text) returns public.rooms language sql as $$
  select * from public.rooms where project_id = 'b0000000-0000-4000-8000-000000000001' and key = p_key;
$$;

-- An unrelated manager account (no projects).
insert into auth.users (id, email, aud, role) values
  ('a0000000-0000-4000-8000-0000000000ff', 'other@renovision.demo', 'authenticated', 'authenticated');
insert into public.profiles (id, full_name, account_type)
values ('a0000000-0000-4000-8000-0000000000ff', 'Other Manager', 'manager')
on conflict (id) do update set account_type = 'manager';

-- ===========================================================================
-- Seed
-- ===========================================================================
select set_config('rv.kitch_end', (select end_date::text from public.stages where key = 'kitch'), false);
select set_config('rv.target', coalesce((select target_date::text from public.projects), ''), false);
select pg_temp.check(
  (select string_agg(key || ':' || progress_mode, ',' order by sort_order) from public.rooms
    where project_id = 'b0000000-0000-4000-8000-000000000001')
  = 'living:manual,kitchen:manual,dining:tasks,bath:manual,bed1:tasks,bed2:tasks',
  'seeded rooms: manual where their numbers differ from their tasks');
select pg_temp.check(
  (select count(*) from public.room_warnings) = 1 and (select count(*) from public.room_warning_materials) = 2,
  'the seed has one kitchen warning linking two materials');

-- ===========================================================================
-- Room-only tasks and derived room progress (manager)
-- ===========================================================================
select pg_temp.as_user('a0000000-0000-4000-8000-000000000001');

select pg_temp.check((select progress = 35 and status = 'progress' from pg_temp.room('bed1')),
  'a tasks-mode room without tasks keeps its hand-set values');

insert into public.tasks (id, project_id, stage_id, room_id, name, sort_order) values
  ('ab000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', null, (select id from pg_temp.room('bed1')), 'Paint walls', 1),
  ('ab000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000001', null, (select id from pg_temp.room('bed1')), 'Fit sockets', 2);
select pg_temp.check((select project_id = 'b0000000-0000-4000-8000-000000000001' from public.tasks where id = 'ab000000-0000-4000-8000-000000000001'),
  'a room-only task takes its project from the room');
select pg_temp.check((select progress = 0 and status = 'pending' from pg_temp.room('bed1')),
  'first tasks: the room is derived (0 of 2: 0% pending)');

update public.tasks set in_progress = true where id = 'ab000000-0000-4000-8000-000000000001';
select pg_temp.check((select progress = 0 and status = 'pending' from pg_temp.room('bed1')),
  'started is not progress: only done counts');

update public.tasks set done = true where id = 'ab000000-0000-4000-8000-000000000001';
select pg_temp.check((select progress = 50 and status = 'progress' from pg_temp.room('bed1')), '1 of 2 done: 50% in progress');
select pg_temp.check((select in_progress = false and completed_at is not null from public.tasks where id = 'ab000000-0000-4000-8000-000000000001'),
  'a done task is no longer in progress');

update public.tasks set done = true where id = 'ab000000-0000-4000-8000-000000000002';
select pg_temp.check((select progress = 100 and status = 'done' from pg_temp.room('bed1')), 'all done: 100% done');

-- Adding a task to a completed tasks-mode room just recomputes it.
insert into public.tasks (project_id, stage_id, room_id, name, sort_order)
values ('b0000000-0000-4000-8000-000000000001', null, (select id from pg_temp.room('bed1')), 'Hang doors', 3);
select pg_temp.check((select progress = 67 and status = 'progress' from pg_temp.room('bed1')), 'a new open task reopens the room: 67%');

-- Stage tasks tagged with the room count for it too, and stage progress ignores room-only tasks.
select pg_temp.check((select progress = 0 from public.stages where project_id = 'b0000000-0000-4000-8000-000000000001' and key = 'final'),
  'room-only tasks do not touch a stage (final inspection is still 0%)');
insert into public.tasks (project_id, stage_id, room_id, name, sort_order)
values ('b0000000-0000-4000-8000-000000000001', (select id from public.stages where project_id = 'b0000000-0000-4000-8000-000000000001' and key = 'final'),
        (select id from pg_temp.room('bed1')), 'Bedroom 1 walkthrough', 9);
select pg_temp.check((select progress = 50 from pg_temp.room('bed1')), 'a stage task with a room counts for the room: 2 of 4 done');
select pg_temp.check((select progress = 0 from public.stages where project_id = 'b0000000-0000-4000-8000-000000000001' and key = 'final')
                     and (select progress = 100 from public.stages where project_id = 'b0000000-0000-4000-8000-000000000001' and key = 'demo'),
  'stages keep following only their own tasks');

-- Blocked is never overridden; progress caps at 99.
update public.rooms set status = 'blocked' where key = 'bed1';
update public.tasks set done = true where room_id = (select id from pg_temp.room('bed1'));
select pg_temp.check((select progress = 99 and status = 'blocked' from pg_temp.room('bed1')), 'blocked room with all tasks done stays blocked at 99%');
update public.rooms set status = 'progress' where key = 'bed1';
select pg_temp.check((select progress = 100 and status = 'done' from pg_temp.room('bed1')), 'unblocking derives the status again');

-- A tasks-mode room ignores hand-set numbers once it has tasks; a manual room does not.
update public.rooms set progress = 10, status = 'progress' where key = 'bed1';
select pg_temp.check((select progress = 100 and status = 'done' from pg_temp.room('bed1')), 'tasks mode: hand-set numbers are overridden');
update public.rooms set progress_mode = 'manual', progress = 10, status = 'progress' where key = 'bed1';
select pg_temp.check((select progress = 10 and status = 'progress' from pg_temp.room('bed1')), 'manual mode: hand-set numbers stay');
update public.rooms set progress_mode = 'tasks' where key = 'bed1';
select pg_temp.check((select progress = 100 and status = 'done' from pg_temp.room('bed1')), 'switching back to tasks mode derives at once');
select pg_temp.check((select progress = 60 and status = 'progress' and progress_mode = 'manual' from pg_temp.room('living')),
  'a manual room is untouched by other rooms'' tasks');

-- Both the room and its (rounding) rule: never 0% or 100% by rounding alone.
select pg_temp.check((select (progress = 100) = (status = 'done') from public.rooms where key = 'bed1'), 'rooms keep (done) = (100%)');

-- Integrity.
do $$
begin
  begin
    insert into public.tasks (project_id, name) values ('b0000000-0000-4000-8000-000000000001', 'Nowhere');
    raise exception 'FAILED: a task without stage and room was accepted';
  exception when check_violation then null;
  end;
end $$;

-- Deleting a room deletes its room-only tasks and detaches stage tasks.
do $$
declare v_room uuid; v_stage_task uuid; v_before int;
begin
  insert into public.rooms (project_id, key, name) values ('b0000000-0000-4000-8000-000000000001', 'tmp', 'Temp room') returning id into v_room;
  insert into public.tasks (project_id, stage_id, room_id, name) values ('b0000000-0000-4000-8000-000000000001', null, v_room, 'Room only');
  insert into public.tasks (project_id, stage_id, room_id, name)
  values ('b0000000-0000-4000-8000-000000000001', (select id from public.stages where key = 'final' and project_id = 'b0000000-0000-4000-8000-000000000001'), v_room, 'With stage')
  returning id into v_stage_task;
  perform pg_temp.check((select progress = 0 from public.rooms where id = v_room), 'new room with tasks: derived');
  delete from public.rooms where id = v_room;
  perform pg_temp.check(not exists (select 1 from public.rooms where id = v_room), 'the room is deleted');
  perform pg_temp.check(not exists (select 1 from public.tasks where name = 'Room only'), 'its room-only task is deleted');
  perform pg_temp.check((select room_id is null from public.tasks where id = v_stage_task), 'its stage task stays, without the room');
end $$;

-- ===========================================================================
-- Project consistency (another project's room)
-- ===========================================================================
do $$
declare v_other uuid; v_other_room uuid; v_other_material uuid;
begin
  v_other := public.create_project('Elm Road House');
  insert into public.rooms (project_id, key, name) values (v_other, 'hall', 'Hall') returning id into v_other_room;
  begin
    insert into public.tasks (project_id, stage_id, room_id, name)
    values ('b0000000-0000-4000-8000-000000000001', (select id from public.stages where key = 'final' and project_id = 'b0000000-0000-4000-8000-000000000001'), v_other_room, 'x');
    raise exception 'FAILED: task used another project''s room';
  exception when check_violation then null;
  end;
  begin
    update public.tasks set room_id = v_other_room where name = 'Walkthrough with client';
    raise exception 'FAILED: task moved to another project''s room';
  exception when check_violation then null;
  end;
  begin
    insert into public.room_warnings (project_id, room_id, text) values ('b0000000-0000-4000-8000-000000000001', v_other_room, 'x');
    raise exception 'FAILED: warning used another project''s room';
  exception when check_violation then null;
  end;
  insert into public.materials (project_id, room_id, name) values (v_other, v_other_room, 'Hall tiles') returning id into v_other_material;
  begin
    insert into public.room_warning_materials (warning_id, material_id)
    values ('21000000-0000-4000-8000-000000000001', v_other_material);
    raise exception 'FAILED: warning linked another project''s material';
  exception when check_violation then null;
  end;
end $$;

-- ===========================================================================
-- Materials: dates and the client-safe read
-- ===========================================================================
select pg_temp.check(
  (select order_by_date = '2026-05-12' and delivery_date is null from public.materials where id = '20000000-0000-4000-8000-000000000006'),
  'the worktop has an order-by date');
select pg_temp.check((select count(*) from public.room_materials((select id from pg_temp.room('kitchen')))) = 2,
  'a manager reads the kitchen''s two materials through room_materials()');

-- ===========================================================================
-- Warnings (manager)
-- ===========================================================================
select pg_temp.check((select count(*) from public.room_warnings) = 1, 'a manager sees the warning');
select pg_temp.check(private.warning_is_open('21000000-0000-4000-8000-000000000001'), 'ordered + planned: the warning is open');

insert into public.room_warnings (id, project_id, room_id, text)
values ('21000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000001', (select id from pg_temp.room('bath')), 'Tiles may arrive late.');
select pg_temp.check((select created_by = auth.uid() from public.room_warnings where id = '21000000-0000-4000-8000-000000000002'), 'created_by defaults to the signed-in manager');
select pg_temp.check(private.warning_is_open('21000000-0000-4000-8000-000000000002'), 'a warning without linked materials is open');
insert into public.room_warning_materials (warning_id, material_id)
values ('21000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000004');
select pg_temp.check((select project_id = 'b0000000-0000-4000-8000-000000000001' from public.room_warning_materials where material_id = '20000000-0000-4000-8000-000000000004'),
  'the link takes the warning''s project');
do $$
begin
  begin
    insert into public.room_warning_materials (warning_id, material_id)
    values ('21000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000005');
    raise exception 'FAILED: a kitchen material was linked to a bathroom warning';
  exception when check_violation then null;
  end;
  begin
    insert into public.room_warnings (project_id, room_id, text) values ('b0000000-0000-4000-8000-000000000001', (select id from pg_temp.room('bath')), '   ');
    raise exception 'FAILED: blank warning text accepted';
  exception when check_violation then null;
  end;
end $$;

-- A warning never moves a date.
select pg_temp.check(
  (select end_date::text = current_setting('rv.kitch_end') from public.stages where project_id = 'b0000000-0000-4000-8000-000000000001' and key = 'kitch')
  and (select coalesce(target_date::text, '') = current_setting('rv.target') and schedule_status = 'at_risk' from public.projects where id = 'b0000000-0000-4000-8000-000000000001'),
  'warnings leave stage dates, the target date and the schedule status alone');

-- ===========================================================================
-- Client: no prices, only open warnings of visible rooms
-- ===========================================================================
select pg_temp.as_user('a0000000-0000-4000-8000-000000000002');

select pg_temp.check((select count(*) from public.materials) = 0, 'a client cannot read materials directly');
select pg_temp.check((select count(*) from public.room_materials((select id from pg_temp.room('kitchen')))) = 2,
  'a client reads the kitchen''s materials through room_materials()');
select pg_temp.check(
  (select bool_and(not (to_jsonb(m) ? 'unit_price') and not (to_jsonb(m) ? 'supplier_contact_id') and not (to_jsonb(m) ? 'notes') and not (to_jsonb(m) ? 'expense_id'))
     from public.room_materials((select id from pg_temp.room('kitchen'))) m),
  'room_materials() exposes no prices, supplier, notes or expense');
select pg_temp.check((select count(*) from public.room_warnings) = 2, 'a client sees the two open warnings');
select pg_temp.check((select count(*) from public.room_warning_materials) = 3, 'a client sees the links of open warnings');

do $$
declare n int;
begin
  begin
    insert into public.room_warnings (project_id, room_id, text)
    values ('b0000000-0000-4000-8000-000000000001', (select id from pg_temp.room('kitchen')), 'client warning');
    raise exception 'FAILED: a client created a warning';
  exception when insufficient_privilege then null;
  end;
  update public.room_warnings set text = 'hacked';
  get diagnostics n = row_count;
  perform pg_temp.check(n = 0, 'a client cannot edit warnings');
  delete from public.room_warnings;
  get diagnostics n = row_count;
  perform pg_temp.check(n = 0, 'a client cannot delete warnings');
  update public.materials set status = 'delivered';
  get diagnostics n = row_count;
  perform pg_temp.check(n = 0, 'a client cannot change materials');
end $$;

-- Resolving the linked materials hides the warning from the client, not from the manager.
select pg_temp.as_user('a0000000-0000-4000-8000-000000000001');
update public.materials set status = 'delivered', delivery_date = '2026-05-11' where id = '20000000-0000-4000-8000-000000000006';
select pg_temp.check(private.warning_is_open('21000000-0000-4000-8000-000000000001'), 'one material still ordered: still open');
update public.materials set status = 'installed' where id = '20000000-0000-4000-8000-000000000005';
select pg_temp.check(not private.warning_is_open('21000000-0000-4000-8000-000000000001'), 'every linked material delivered or installed: resolved');
select pg_temp.check((select count(*) from public.room_warnings) = 2, 'a manager still sees the resolved warning');

select pg_temp.as_user('a0000000-0000-4000-8000-000000000003');
select pg_temp.check((select count(*) from public.room_warnings) = 1 and (select text from public.room_warnings) = 'Tiles may arrive late.',
  'the other client no longer sees the resolved warning, only the open one');
select pg_temp.check((select count(*) from public.room_warning_materials) = 1, 'nor its links');

select pg_temp.as_user('a0000000-0000-4000-8000-000000000001');
update public.materials set status = 'ordered' where id = '20000000-0000-4000-8000-000000000005';
select pg_temp.as_user('a0000000-0000-4000-8000-000000000002');
select pg_temp.check((select count(*) from public.room_warnings) = 2, 'putting a material back to ordered reopens the warning');

-- A hidden room hides its warnings and materials from clients.
select pg_temp.as_user('a0000000-0000-4000-8000-000000000001');
update public.rooms set is_visible = false where key = 'kitchen';
select pg_temp.as_user('a0000000-0000-4000-8000-000000000002');
select pg_temp.check((select count(*) from public.room_warnings) = 1, 'a hidden room''s warning is hidden');
select pg_temp.check((select count(*) from public.room_materials((select id from public.rooms where key = 'kitchen'))) = 0, 'a hidden room''s materials are hidden');
select pg_temp.check((select count(*) from public.tasks where room_id = (select id from public.rooms where key = 'kitchen') and stage_id is null) = 0,
  'no leak of room-only tasks of a hidden room');

-- Room-only tasks of a visible room are visible to clients; those of a hidden room are not.
select pg_temp.as_user('a0000000-0000-4000-8000-000000000001');
insert into public.tasks (project_id, stage_id, room_id, name) values
  ('b0000000-0000-4000-8000-000000000001', null, (select id from pg_temp.room('kitchen')), 'Hidden room task'),
  ('b0000000-0000-4000-8000-000000000001', null, (select id from pg_temp.room('dining')), 'Visible room task');
select pg_temp.as_user('a0000000-0000-4000-8000-000000000002');
select pg_temp.check((select count(*) from public.tasks where name = 'Visible room task') = 1, 'a client sees a room-only task of a visible room');
select pg_temp.check((select count(*) from public.tasks where name = 'Hidden room task') = 0, 'a client does not see a room-only task of a hidden room');

-- ===========================================================================
-- Isolation
-- ===========================================================================
select pg_temp.as_user('a0000000-0000-4000-8000-0000000000ff');
select pg_temp.check((select count(*) from public.room_warnings) = 0 and (select count(*) from public.room_warning_materials) = 0,
  'an unrelated manager sees no warnings');
select pg_temp.check((select count(*) from public.room_materials((select id from public.rooms where key = 'bath' limit 1))) = 0,
  'an unrelated manager gets no materials from room_materials()');
do $$
begin
  begin
    insert into public.room_warnings (project_id, room_id, text)
    values ('b0000000-0000-4000-8000-000000000001', (select id from public.rooms where key = 'bath' limit 1), 'intruder');
    raise exception 'FAILED: an unrelated manager created a warning';
  exception when insufficient_privilege or check_violation then null; -- they can't even see the room
  end;
end $$;

do $$
begin
  perform set_config('role', 'anon', true);
  begin
    perform count(*) from public.room_warnings;
    raise exception 'FAILED: anon read warnings';
  exception when insufficient_privilege then null;
  end;
  begin
    perform * from public.room_materials('d0000000-0000-4000-8000-000000000002');
    raise exception 'FAILED: anon called room_materials';
  exception when insufficient_privilege then null;
  end;
end $$;

select 'room view tests passed' as result;
rollback;
