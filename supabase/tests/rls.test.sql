-- RLS regression tests for the shared RenoTrack backend.
-- Run against a freshly seeded database (everything is rolled back):
--   psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/rls.test.sql
-- Prints "RLS tests passed" on success; any failed assertion aborts with an error.

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

-- Storage objects for one published and one draft photo, plus a receipt.
insert into storage.objects (bucket_id, name) values
  ('project-media', 'b0000000-0000-4000-8000-000000000001/photos/p1-living-drywall.jpg'),
  ('project-media', 'b0000000-0000-4000-8000-000000000001/photos/p9-bed2-junction-draft.jpg'),
  ('project-internal', 'b0000000-0000-4000-8000-000000000001/receipts/oak.pdf');

-- An unrelated manager account with its own project.
insert into auth.users (id, email, aud, role) values
  ('a0000000-0000-4000-8000-0000000000ff', 'other@renotrack.demo', 'authenticated', 'authenticated');
insert into public.profiles (id, full_name, account_type)
values ('a0000000-0000-4000-8000-0000000000ff', 'Other Manager', 'manager')
on conflict (id) do update set account_type = 'manager';

-- ===========================================================================
-- Client: Sarah
-- ===========================================================================
select pg_temp.as_user('a0000000-0000-4000-8000-000000000002');

select pg_temp.check((select count(*) from public.projects) = 1, 'client sees exactly their project');
select pg_temp.check((select count(*) from public.rooms) = 6, 'client sees 6 rooms');
select pg_temp.check((select count(*) from public.stages) = 7, 'client sees 7 stages');
select pg_temp.check((select count(*) from public.tasks) = 20, 'client sees 20 tasks');
select pg_temp.check((select count(*) from public.photos) = 8, 'client sees 8 published photos, not the draft');
select pg_temp.check((select count(*) from public.photos where status = 'draft') = 0, 'client never sees drafts');
select pg_temp.check((select count(*) from public.renders) = 4, 'client sees 4 visible renders');
select pg_temp.check((select count(*) from public.ai_knowledge) = 4, 'client sees only visible AI knowledge');
select pg_temp.check((select count(*) from public.expenses) = 0, 'client cannot read expenses');
select pg_temp.check((select count(*) from public.project_internal) = 0, 'client cannot read internal budget notes');
select pg_temp.check((select count(*) from public.activity_log) = 0, 'client cannot read the activity log');
select pg_temp.check((select count(*) from public.messages) = 5, 'client reads the chat');
select pg_temp.check((select count(*) from public.notifications) = 5, 'client reads only their own notifications');
select pg_temp.check((select count(*) from public.project_members) = 3, 'client sees the project team');
select pg_temp.check((select manager_name from public.project_summary) = 'Jonas Weber', 'summary shows manager');
select pg_temp.check((select spent from public.project_summary) = 51200, 'summary shows spent total');
select pg_temp.check((select count(*) from storage.objects where name like '%p1-living%') = 1, 'client reads published photo file');
select pg_temp.check((select count(*) from storage.objects where name like '%draft%') = 0, 'client cannot read draft photo file');
select pg_temp.check((select count(*) from storage.objects where bucket_id = 'project-internal') = 0, 'client cannot read receipts');

do $$
declare n int;
begin
  update public.rooms set progress = 99 where key = 'living';
  get diagnostics n = row_count;
  perform pg_temp.check(n = 0, 'client cannot update rooms');

  update public.projects set name = 'Hacked';
  get diagnostics n = row_count;
  perform pg_temp.check(n = 0, 'client cannot update the project');

  begin
    insert into public.expenses (project_id, description, amount)
    values ('b0000000-0000-4000-8000-000000000001', 'x', 1);
    raise exception 'FAILED: client inserted an expense';
  exception when insufficient_privilege then null;
  end;

  begin
    insert into public.messages (project_id, sender_id, body)
    values ('b0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'spoof');
    raise exception 'FAILED: client sent a message as the manager';
  exception when insufficient_privilege then null;
  end;

  begin
    update public.profiles set account_type = 'manager' where id = auth.uid();
    raise exception 'FAILED: client promoted themselves';
  exception when insufficient_privilege then null;
  end;

  begin
    perform public.create_project('Mine');
    raise exception 'FAILED: client created a project';
  exception when insufficient_privilege then null;
  end;
end $$;

insert into public.messages (project_id, body) values ('b0000000-0000-4000-8000-000000000001', 'Hello from Sarah');
select public.mark_notifications_read();
select pg_temp.check((select count(*) from public.notifications where read_at is null) = 0, 'client marks notifications read');

-- ===========================================================================
-- Manager: Jonas
-- ===========================================================================
select pg_temp.as_user('a0000000-0000-4000-8000-000000000001');

select pg_temp.check((select count(*) from public.photos) = 9, 'manager sees drafts');
select pg_temp.check((select count(*) from public.expenses) = 9, 'manager reads expenses');
select pg_temp.check((select count(*) from public.project_internal) = 1, 'manager reads internal notes');
select pg_temp.check((select count(*) from public.ai_knowledge) = 5, 'manager reads all AI knowledge');
select pg_temp.check((select count(*) from storage.objects) = 3, 'manager reads all project files');

update public.rooms set status = 'progress', progress = 40,
  client_note = 'Inspector signed off — walls closing this week.' where key = 'bed2';
select pg_temp.check(
  (select count(*) from public.notifications where kind = 'room' and title = 'Bedroom 2 is now in progress') = 2,
  'room status change notifies both clients');
select pg_temp.check(
  (select count(*) from public.activity_log where entity_type = 'rooms' and changes ? 'status' and actor_id = auth.uid() and created_at = now()) = 1,
  'room change is written to the activity log');

do $$
begin
  update public.rooms set status = 'done', progress = 100 where key = 'bath';
  raise exception 'FAILED: bathroom completed while "Bathroom tiling" is open';
exception when check_violation then null;
end $$;

insert into public.expenses (project_id, description, amount)
values ('b0000000-0000-4000-8000-000000000001', 'Tile adhesive', 300);
select pg_temp.check((select spent from public.projects) = 51500, 'spent follows expenses');

update public.photos set status = 'published', published_at = now() where id = 'e0000000-0000-4000-8000-000000000009';
select pg_temp.check(
  (select count(*) from public.notifications where kind = 'photo' and entity_id = 'e0000000-0000-4000-8000-000000000009') = 2,
  'publishing a photo notifies clients');

update public.stages set is_visible = false where key = 'final';

-- Client view after the manager's changes
select pg_temp.as_user('a0000000-0000-4000-8000-000000000002');
select pg_temp.check((select count(*) from public.stages) = 6, 'hidden stage disappears for the client');
select pg_temp.check((select count(*) from public.tasks) = 19, 'tasks of a hidden stage disappear too');
select pg_temp.check((select count(*) from public.photos) = 9, 'published draft becomes visible');

-- ===========================================================================
-- Unrelated manager
-- ===========================================================================
select pg_temp.as_user('a0000000-0000-4000-8000-0000000000ff');
select pg_temp.check((select count(*) from public.projects) = 0, 'other manager cannot see the project');
do $$
declare n int;
begin
  update public.stages set progress = 1;
  get diagnostics n = row_count;
  perform pg_temp.check(n = 0, 'other manager cannot edit stages');
  begin
    perform public.add_project_member('b0000000-0000-4000-8000-000000000001', 'other@renotrack.demo', 'manager');
    raise exception 'FAILED: other manager joined a project they do not manage';
  exception when insufficient_privilege then null;
  end;
end $$;
select pg_temp.check(public.create_project('Elm Road House') is not null, 'manager accounts can create projects');
select pg_temp.check((select count(*) from public.projects) = 1, 'creator becomes manager of the new project');

-- ===========================================================================
-- Avatars: users write only inside their own folder
-- ===========================================================================
select pg_temp.as_user('a0000000-0000-4000-8000-000000000002');
insert into storage.objects (bucket_id, name) values ('avatars', 'a0000000-0000-4000-8000-000000000002/me.png');
do $$
begin
  insert into storage.objects (bucket_id, name) values ('avatars', 'a0000000-0000-4000-8000-000000000001/not-mine.png');
  raise exception 'FAILED: user uploaded into another user''s avatar folder';
exception when insufficient_privilege then null;
end $$;
select pg_temp.check((select count(*) from storage.objects where bucket_id = 'avatars') = 1, 'user sees only their own avatar files');

-- ===========================================================================
-- Anonymous
-- ===========================================================================
select pg_temp.as_admin();
set local role anon;
do $$
begin
  perform count(*) from public.projects;
  raise exception 'FAILED: anon read projects';
exception when insufficient_privilege then null;
end $$;

reset role;
select 'RLS tests passed' as result;
rollback;
