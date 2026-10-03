-- Work schema v2 (T32): task-derived stage progress, the site diary, the floor-plan image and import_stages.
-- Run against a freshly seeded database with `bun run test:db` (see tests/db/README.md); everything is rolled back.
-- Prints "work tests passed" on success; any failed assertion aborts with an error.

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

create or replace function pg_temp.stage(p_key text) returns public.stages language sql as $$
  select * from public.stages where project_id = 'b0000000-0000-4000-8000-000000000001' and key = p_key;
$$;

-- An unrelated manager account (no projects).
insert into auth.users (id, email, aud, role) values
  ('a0000000-0000-4000-8000-0000000000ff', 'other@renovision.demo', 'authenticated', 'authenticated');
insert into public.profiles (id, full_name, account_type)
values ('a0000000-0000-4000-8000-0000000000ff', 'Other Manager', 'manager')
on conflict (id) do update set account_type = 'manager';

-- ===========================================================================
-- Backfill / seed modes
-- ===========================================================================
select pg_temp.check(
  (select string_agg(key || ':' || progress_mode, ',' order by sort_order) from public.stages
    where project_id = 'b0000000-0000-4000-8000-000000000001')
  = 'demo:tasks,elec:tasks,wall:manual,floor:manual,kitch:tasks,paint:tasks,final:tasks',
  'demo stages: tasks mode where progress already matches the checklist, manual otherwise');
-- The backfill rule (progress and status equal the derived ones) picks exactly the tasks-mode stages.
select pg_temp.check(
  (select bool_and((s.progress_mode = 'tasks') = exists (
     select 1 from private.stage_derived(s.id, s.status) d where d.progress = s.progress and d.status = s.status))
   from public.stages s),
  'backfill rule matches the seeded modes');
select pg_temp.check(
  (select count(*) from public.stages where progress_mode = 'tasks' and progress <> private.stage_task_progress(id)) = 0,
  'no tasks-mode stage shows a progress other than its checklist');

-- ===========================================================================
-- Derived progress (manager)
-- ===========================================================================
select pg_temp.as_user('a0000000-0000-4000-8000-000000000001');

insert into public.stages (id, project_id, key, name, status, progress, start_date, end_date, sort_order)
values ('c0000000-0000-4000-8000-0000000000aa', 'b0000000-0000-4000-8000-000000000001', 'test', 'Test stage',
        'progress', 40, current_date, current_date + 5, 20);
select pg_temp.check((select progress = 0 and status = 'pending' and progress_mode = 'tasks' from pg_temp.stage('test')),
  'a new tasks-mode stage without tasks is 0% pending, whatever the insert asked for');

insert into public.tasks (id, project_id, stage_id, name, sort_order) values
  ('aa000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-0000000000aa', 'First', 1),
  ('aa000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-0000000000aa', 'Second', 2);
select pg_temp.check((select progress = 0 and status = 'pending' from pg_temp.stage('test')), '0 of 2 tasks: 0% pending');

update public.tasks set done = true where id = 'aa000000-0000-4000-8000-000000000001';
select pg_temp.check((select progress = 50 and status = 'progress' from pg_temp.stage('test')), '1 of 2 tasks: 50% in progress');
select pg_temp.check(
  (select count(*) from public.notifications where kind = 'stage_status' and entity_id = 'c0000000-0000-4000-8000-0000000000aa'
     and params ->> 'status' = 'progress') = 2,
  'a derived status change notifies both clients like a manual one');
select pg_temp.check(
  (select count(*) from public.activity_log where entity_type = 'stages' and entity_id = 'c0000000-0000-4000-8000-0000000000aa'
     and changes ? 'progress' and actor_id = auth.uid()) >= 1,
  'a derived change is written to the activity log as the user who ticked the task');

update public.tasks set done = true where id = 'aa000000-0000-4000-8000-000000000002';
select pg_temp.check((select progress = 100 and status = 'done' from pg_temp.stage('test')), '2 of 2 tasks: 100% done');
select pg_temp.check(
  (select count(*) from public.notifications where kind = 'stage_status' and entity_id = 'c0000000-0000-4000-8000-0000000000aa'
     and params ->> 'status' = 'done') = 2,
  'reaching 100% notifies clients that the stage is done');

update public.tasks set done = false where id = 'aa000000-0000-4000-8000-000000000002';
select pg_temp.check((select progress = 50 and status = 'progress' from pg_temp.stage('test')), 're-opening a task drops back to 50%');

delete from public.tasks where id = 'aa000000-0000-4000-8000-000000000002';
select pg_temp.check((select progress = 100 and status = 'done' from pg_temp.stage('test')), 'deleting the open task recomputes: 1 of 1 = 100%');

-- Editing progress/status by hand in tasks mode is overridden by the checklist.
update public.stages set progress = 30, status = 'progress' where key = 'test';
select pg_temp.check((select progress = 100 and status = 'done' from pg_temp.stage('test')), 'manual edits in tasks mode are overridden');

delete from public.tasks where id = 'aa000000-0000-4000-8000-000000000001';
select pg_temp.check((select progress = 0 and status = 'pending' from pg_temp.stage('test')), 'deleting the last task: 0% pending');

-- Thirds round, but never reach 0 or 100 by rounding alone.
update public.tasks set done = true where stage_id = (select id from pg_temp.stage('paint')) and name = 'Ceiling paint';
select pg_temp.check((select progress = 33 and status = 'progress' from pg_temp.stage('paint')), '1 of 3: 33%');
update public.tasks set done = true where stage_id = (select id from pg_temp.stage('paint')) and name = 'Wall color coats';
select pg_temp.check((select progress = 67 from pg_temp.stage('paint')), '2 of 3: 67%');

-- Moving a task between stages recomputes both.
update public.tasks set stage_id = (select id from pg_temp.stage('final'))
where stage_id = (select id from pg_temp.stage('paint')) and name = 'Wall color coats';
select pg_temp.check((select progress = 50 from pg_temp.stage('paint')), 'moving a done task out recomputes the old stage (1 of 2)');
select pg_temp.check((select progress = 50 and status = 'progress' from pg_temp.stage('final')), 'and the new stage (1 of 2)');

-- Manual mode: nothing changes automatically.
update public.tasks set done = true where stage_id = (select id from pg_temp.stage('wall')) and name = 'Tape & mud';
select pg_temp.check((select progress = 65 and status = 'progress' from pg_temp.stage('wall')), 'manual stages ignore the checklist');
-- Switching to tasks mode recomputes on the spot (3 of 4 done = 75%), and back to manual allows editing.
update public.stages set progress_mode = 'tasks' where key = 'wall';
select pg_temp.check((select progress = 75 and status = 'progress' from pg_temp.stage('wall')), 'switching to tasks mode recomputes');
update public.stages set progress_mode = 'manual', progress = 80 where key = 'wall';
select pg_temp.check((select progress = 80 and progress_mode = 'manual' from pg_temp.stage('wall')), 'manual progress is editable again');

-- Blocked is never overridden: progress follows the checklist but caps at 99 while blocked.
update public.stages set status = 'blocked' where key = 'kitch';
select pg_temp.check((select progress = 0 and status = 'blocked' from pg_temp.stage('kitch')), 'blocked can be set by hand in tasks mode');
update public.tasks set done = true where stage_id = (select id from pg_temp.stage('kitch')) and name = 'Cabinet delivery';
select pg_temp.check((select progress = 33 and status = 'blocked' from pg_temp.stage('kitch')), 'ticking a task on a blocked stage keeps it blocked');
update public.tasks set done = true where stage_id = (select id from pg_temp.stage('kitch'));
select pg_temp.check((select progress = 99 and status = 'blocked' from pg_temp.stage('kitch')), 'all tasks done while blocked: blocked at 99%');
update public.stages set status = 'progress' where key = 'kitch';
select pg_temp.check((select progress = 100 and status = 'done' from pg_temp.stage('kitch')), 'unblocking derives the status again: 100% done');

-- The room guard still wins: re-opening a task on a Completed room is refused, and nothing is recomputed.
update public.rooms set status = 'done', progress = 100 where key = 'kitchen'
  and not exists (select 1 from public.tasks t where t.room_id = rooms.id and not t.done);
select pg_temp.check((select status = 'done' from public.rooms where key = 'kitchen'), 'kitchen completed once its tasks are done');
do $$
begin
  update public.tasks set done = false where stage_id = (select id from pg_temp.stage('kitch')) and name = 'Appliance hookup';
  raise exception 'FAILED: re-opened a task on a completed room';
exception when check_violation then null;
end $$;
select pg_temp.check((select progress = 100 and status = 'done' from pg_temp.stage('kitch')), 'a refused task change leaves the stage alone');

-- Deleting a stage or a whole project cascades through the task trigger without errors.
delete from public.stages where key = 'test';
do $$
declare v_project uuid; v_stage uuid;
begin
  v_project := public.create_project('Cascade House');
  insert into public.stages (project_id, key, name, start_date, end_date)
  values (v_project, 'a', 'A', current_date, current_date) returning id into v_stage;
  insert into public.tasks (project_id, stage_id, name, done) values (v_project, v_stage, 'One', true), (v_project, v_stage, 'Two', false);
  perform pg_temp.check((select progress = 50 from public.stages where id = v_stage), 'new project stage derives 50%');
  delete from public.stages where id = v_stage;
  insert into public.stages (project_id, key, name, start_date, end_date)
  values (v_project, 'b', 'B', current_date, current_date) returning id into v_stage;
  insert into public.tasks (project_id, stage_id, name, done) values (v_project, v_stage, 'One', true);
  delete from public.projects where id = v_project;
  perform pg_temp.check(not exists (select 1 from public.projects where id = v_project), 'project with tasks deleted');
end $$;

-- ===========================================================================
-- Site diary
-- ===========================================================================
select pg_temp.as_user('a0000000-0000-4000-8000-000000000002');
select pg_temp.check((select count(*) from public.progress_entries) = 3, 'client sees only the 3 visible diary entries');
select pg_temp.check((select count(*) from public.progress_entries where not is_visible) = 0, 'client never sees hidden entries');
do $$
declare n int;
begin
  begin
    insert into public.progress_entries (project_id, note) values ('b0000000-0000-4000-8000-000000000001', 'Client note');
    raise exception 'FAILED: client wrote a diary entry';
  exception when insufficient_privilege then null;
  end;
  update public.progress_entries set note = 'Edited';
  get diagnostics n = row_count;
  perform pg_temp.check(n = 0, 'client cannot edit diary entries');
  delete from public.progress_entries;
  get diagnostics n = row_count;
  perform pg_temp.check(n = 0, 'client cannot delete diary entries');
end $$;

select pg_temp.as_user('a0000000-0000-4000-8000-000000000003');
select pg_temp.check((select count(*) from public.progress_entries) = 3, 'the second client sees the same visible entries');

select pg_temp.as_user('a0000000-0000-4000-8000-0000000000ff');
select pg_temp.check((select count(*) from public.progress_entries) = 0, 'an unrelated manager sees no entries');

select pg_temp.as_user('a0000000-0000-4000-8000-000000000001');
select pg_temp.check((select count(*) from public.progress_entries) = 5, 'the manager sees every entry');

insert into public.progress_entries (id, project_id, stage_id, room_id, note, hours)
values ('70000000-0000-4000-8000-0000000000aa', 'b0000000-0000-4000-8000-000000000001',
        (select id from pg_temp.stage('floor')), (select id from public.rooms where key = 'bed1'), 'Planks laid in half of Bedroom 1.', 7.25);
select pg_temp.check(
  (select author_id = auth.uid() and entry_date = current_date and not is_visible
   from public.progress_entries where id = '70000000-0000-4000-8000-0000000000aa'),
  'a new entry defaults to today, the author and hidden');
select pg_temp.check(
  (select count(*) from public.activity_log where entity_type = 'progress_entries' and action = 'insert'
     and entity_id = '70000000-0000-4000-8000-0000000000aa' and params ->> 'entity' = 'diary_entry') = 1,
  'log_activity fires for progress_entries, logged as a diary entry');

update public.progress_entries set is_visible = true, hours = 8 where id = '70000000-0000-4000-8000-0000000000aa';
select pg_temp.check(
  (select count(*) from public.activity_log where entity_type = 'progress_entries' and action = 'update'
     and entity_id = '70000000-0000-4000-8000-0000000000aa') = 1,
  'diary updates are logged');

select pg_temp.as_user('a0000000-0000-4000-8000-000000000002');
select pg_temp.check((select count(*) from public.progress_entries) = 4, 'publishing an entry makes it visible to the client');

select pg_temp.as_user('a0000000-0000-4000-8000-000000000001');
delete from public.progress_entries where id = '70000000-0000-4000-8000-0000000000aa';
select pg_temp.check(
  (select count(*) from public.activity_log where entity_type = 'progress_entries' and action = 'delete') = 1,
  'the manager deletes entries, and that is logged');

do $$
declare v_other uuid; v_other_stage uuid; v_other_room uuid;
begin
  v_other := public.create_project('Elm Road House');
  insert into public.stages (project_id, key, name, start_date, end_date)
  values (v_other, 'demo', 'Demolition', current_date, current_date) returning id into v_other_stage;
  insert into public.rooms (project_id, key, name) values (v_other, 'hall', 'Hall') returning id into v_other_room;

  begin
    insert into public.progress_entries (project_id, stage_id, note) values ('b0000000-0000-4000-8000-000000000001', v_other_stage, 'x');
    raise exception 'FAILED: diary entry used another project''s stage';
  exception when check_violation then null;
  end;
  begin
    insert into public.progress_entries (project_id, room_id, note) values ('b0000000-0000-4000-8000-000000000001', v_other_room, 'x');
    raise exception 'FAILED: diary entry used another project''s room';
  exception when check_violation then null;
  end;
  begin
    update public.progress_entries set room_id = v_other_room where id = '70000000-0000-4000-8000-000000000001';
    raise exception 'FAILED: diary entry moved to another project''s room';
  exception when check_violation then null;
  end;
  begin
    insert into public.progress_entries (project_id, note) values ('b0000000-0000-4000-8000-000000000001', '   ');
    raise exception 'FAILED: empty diary note';
  exception when check_violation then null;
  end;
  begin
    insert into public.progress_entries (project_id, note, hours) values ('b0000000-0000-4000-8000-000000000001', 'x', -1);
    raise exception 'FAILED: negative hours';
  exception when check_violation then null;
  end;
  begin
    insert into public.photos (project_id, storage_path, progress_entry_id)
    values (v_other, v_other || '/photos/x.jpg', '70000000-0000-4000-8000-000000000001');
    raise exception 'FAILED: photo attached to another project''s diary entry';
  exception when check_violation then null;
  end;
end $$;

-- Diary photos: the client still sees a photo only once it is published.
select pg_temp.check(
  (select count(*) from public.photos where progress_entry_id = '70000000-0000-4000-8000-000000000001') = 1,
  'the seeded drywall photo belongs to the Apr 20 entry');
update public.photos set progress_entry_id = '70000000-0000-4000-8000-000000000003'
where id = 'e0000000-0000-4000-8000-000000000009'; -- the draft photo, on a hidden entry
select pg_temp.as_user('a0000000-0000-4000-8000-000000000002');
select pg_temp.check(
  (select count(*) from public.photos where progress_entry_id is not null) = 1,
  'client sees the published diary photo, not the draft one');

-- ===========================================================================
-- Floor-plan image
-- ===========================================================================
select pg_temp.as_user('a0000000-0000-4000-8000-000000000001');
update public.projects set plan_image_path = 'b0000000-0000-4000-8000-000000000001/plans/plan.png',
  plan_image_opts = '{"opacity": 0.5, "scale": 1.25, "x": 10, "y": -4}'
where id = 'b0000000-0000-4000-8000-000000000001';
select pg_temp.check(
  (select plan_image_path from public.projects where id = 'b0000000-0000-4000-8000-000000000001')
    = 'b0000000-0000-4000-8000-000000000001/plans/plan.png',
  'managers set the plan image');
do $$
declare p text;
begin
  foreach p in array array[
    'b0000000-0000-4000-8000-0000000000ff/plans/plan.png', -- another project's folder
    'b0000000-0000-4000-8000-000000000001/photos/plan.png', -- not under plans/
    'b0000000-0000-4000-8000-000000000001/plans/' -- no file
  ] loop
    begin
      update public.projects set plan_image_path = p where id = 'b0000000-0000-4000-8000-000000000001';
      raise exception 'FAILED: plan image path % accepted', p;
    exception when check_violation then null;
    end;
  end loop;
  foreach p in array array['[]', '{"opacity": 2}', '{"opacity": "half"}', '{"scale": 0}', '{"x": "left"}'] loop
    begin
      update public.projects set plan_image_opts = p::jsonb where id = 'b0000000-0000-4000-8000-000000000001';
      raise exception 'FAILED: plan image opts % accepted', p;
    exception when check_violation then null;
    end;
  end loop;
end $$;

insert into storage.objects (bucket_id, name) values ('project-media', 'b0000000-0000-4000-8000-000000000001/plans/plan.png');
select pg_temp.check(
  (select count(*) from storage.objects where name like 'b0000000-0000-4000-8000-000000000001/plans/%') = 1,
  'managers upload and read plan images');

select pg_temp.as_user('a0000000-0000-4000-8000-000000000002');
select pg_temp.check(
  (select plan_image_path from public.project_summary) = 'b0000000-0000-4000-8000-000000000001/plans/plan.png'
  and (select (plan_image_opts ->> 'opacity')::numeric from public.project_summary) = 0.5,
  'project_summary exposes the plan image to the client');
select pg_temp.check(
  (select count(*) from storage.objects where name = 'b0000000-0000-4000-8000-000000000001/plans/plan.png') = 1,
  'clients read the plan image file');
do $$
declare n int;
begin
  update public.projects set plan_image_path = null;
  get diagnostics n = row_count;
  perform pg_temp.check(n = 0, 'clients cannot change the plan image');
  begin
    insert into storage.objects (bucket_id, name) values ('project-media', 'b0000000-0000-4000-8000-000000000001/plans/mine.png');
    raise exception 'FAILED: client uploaded a plan image';
  exception when insufficient_privilege then null;
  end;
end $$;

select pg_temp.as_user('a0000000-0000-4000-8000-0000000000ff');
select pg_temp.check((select count(*) from storage.objects where name like '%/plans/%') = 0, 'other managers cannot read the plan image');

-- What the Storage API does for a delete (storage.protect_delete refuses direct SQL deletes otherwise).
select set_config('storage.allow_delete_query', 'true', true);
select pg_temp.as_user('a0000000-0000-4000-8000-000000000002');
do $$
declare n int;
begin
  delete from storage.objects where name = 'b0000000-0000-4000-8000-000000000001/plans/plan.png';
  get diagnostics n = row_count;
  perform pg_temp.check(n = 0, 'clients cannot delete plan images');
end $$;
select pg_temp.as_user('a0000000-0000-4000-8000-000000000001');
delete from storage.objects where name = 'b0000000-0000-4000-8000-000000000001/plans/plan.png';
select pg_temp.check((select count(*) from storage.objects where name like '%/plans/%') = 0, 'managers delete plan images');

-- ===========================================================================
-- import_stages
-- ===========================================================================
select pg_temp.as_user('a0000000-0000-4000-8000-000000000002');
do $$
begin
  perform public.import_stages('b0000000-0000-4000-8000-000000000001', '[{"name":"X","start_date":"2026-01-01","end_date":"2026-01-02"}]');
  raise exception 'FAILED: a client imported stages';
exception when insufficient_privilege then null;
end $$;

select pg_temp.as_user('a0000000-0000-4000-8000-0000000000ff');
do $$
begin
  perform public.import_stages('b0000000-0000-4000-8000-000000000001', '[]');
  raise exception 'FAILED: a manager of another project imported stages';
exception when insufficient_privilege then null;
end $$;

select pg_temp.as_user('a0000000-0000-4000-8000-000000000001');
do $$
declare
  v_before int := (select count(*) from public.stages);
  v_tasks_before int := (select count(*) from public.tasks);
  v_detail text;
  v_errors jsonb;
  v_result jsonb;
begin
  -- Per-row errors, and nothing written.
  begin
    perform public.import_stages('b0000000-0000-4000-8000-000000000001', '[
      {"name": "Good row", "start_date": "2026-07-01", "end_date": "2026-07-05", "tasks": [{"name": "Fine", "room": "Kitchen"}]},
      {"name": "  ", "start_date": "2026-07-01", "end_date": "2026-06-01"},
      {"name": "Bad date", "start_date": "2026-02-30", "end_date": "07/01/2026"},
      {"name": "Bad room", "start_date": "2026-07-01", "end_date": "2026-07-02", "tasks": [{"name": "Tile", "room": "Garage"}, {"name": ""}]},
      "not an object"
    ]');
    raise exception 'FAILED: invalid import accepted';
  exception when sqlstate '22023' then
    get stacked diagnostics v_detail = pg_exception_detail;
  end;
  v_errors := v_detail::jsonb;
  perform pg_temp.check(jsonb_typeof(v_errors) = 'array', 'errors come back as a JSON array');
  perform pg_temp.check(v_errors @> '[{"row": 1, "field": "name", "code": "required"}]', 'missing name reported for row 1');
  perform pg_temp.check(v_errors @> '[{"row": 1, "field": "end_date", "code": "end_before_start"}]', 'end before start reported');
  perform pg_temp.check(v_errors @> '[{"row": 2, "field": "start_date", "code": "invalid_date"}]', 'impossible date reported');
  perform pg_temp.check(v_errors @> '[{"row": 2, "field": "end_date", "code": "invalid_date"}]', 'non-ISO date reported');
  perform pg_temp.check(v_errors @> '[{"row": 3, "field": "tasks[0].room", "code": "room_not_found"}]', 'unknown room reported');
  perform pg_temp.check(v_errors @> '[{"row": 3, "field": "tasks[1].name", "code": "required"}]', 'missing task name reported');
  perform pg_temp.check(v_errors @> '[{"row": 4, "code": "not_an_object"}]', 'non-object row reported');
  perform pg_temp.check(not v_errors @> '[{"row": 0}]', 'the valid row has no errors');
  perform pg_temp.check((select count(*) from public.stages) = v_before and (select count(*) from public.tasks) = v_tasks_before,
    'all or nothing: an invalid import writes no stage or task');

  begin
    perform public.import_stages('b0000000-0000-4000-8000-000000000001', '{"name": "x"}');
    raise exception 'FAILED: non-array import accepted';
  exception when sqlstate '22023' then null;
  end;

  -- A valid import: rooms by name (case-insensitive), slug keys made unique.
  v_result := public.import_stages('b0000000-0000-4000-8000-000000000001', '[
    {"name": "Demo", "start_date": "2026-07-01", "end_date": "2026-07-05", "client_note": "Second round",
     "tasks": [{"name": "Strip tiles", "room": " bathroom "}, {"name": "Haul away"}]},
    {"name": "Garden & Terrace!", "start_date": "2026-07-06", "end_date": "2026-07-06", "tasks": [{"name": "Lay slabs"}]},
    {"name": "Snagging", "start_date": "2026-07-07", "end_date": "2026-07-08"}
  ]');
  perform pg_temp.check(v_result = '{"inserted_stages": 3, "inserted_tasks": 3}', 'import returns the inserted counts');
end $$;
select pg_temp.check(
  (select string_agg(key, ',' order by sort_order) from public.stages
    where project_id = 'b0000000-0000-4000-8000-000000000001' and sort_order > 7) = 'demo-2,garden-terrace,snagging',
  'imported stages get unique slug keys after the existing stages');
select pg_temp.check(
  (select r.key from public.tasks t join public.rooms r on r.id = t.room_id where t.name = 'Strip tiles') = 'bath',
  'task rooms are resolved by name');
select pg_temp.check(
  (select progress_mode = 'tasks' and progress = 0 and status = 'pending' and client_note = 'Second round' from pg_temp.stage('demo-2')),
  'imported stages start in tasks mode at 0%');
select pg_temp.check(
  (select count(*) from public.activity_log where entity_type = 'stages' and action = 'insert' and params ->> 'label' = 'Snagging') = 1,
  'imported stages are in the activity log');

-- ===========================================================================
-- Privileges on the new functions
-- ===========================================================================
select pg_temp.as_admin();
do $$
declare f text;
begin
  foreach f in array array['private.stage_task_progress(uuid)', 'private.stage_derived(uuid, public.work_status)',
                           'private.recompute_stage_progress(uuid)', 'private.slugify(text)'] loop
    perform pg_temp.check(not has_function_privilege('authenticated', f, 'EXECUTE'), 'authenticated cannot execute ' || f);
    perform pg_temp.check(not has_function_privilege('anon', f, 'EXECUTE'), 'anon cannot execute ' || f);
  end loop;
  perform pg_temp.check(has_function_privilege('authenticated', 'public.import_stages(uuid, jsonb)', 'EXECUTE'),
    'authenticated can call import_stages');
  perform pg_temp.check(not has_function_privilege('anon', 'public.import_stages(uuid, jsonb)', 'EXECUTE'),
    'anon cannot call import_stages');
end $$;

select 'work tests passed' as result;
rollback;
