-- Comms schema v2 (T33): translatable notifications and activity, profile language, notification
-- preferences, invitations, consents and GDPR-safe deletes.
-- Run against a seeded database (everything is rolled back): bun run test:db, or directly with psql.
-- Prints "comms tests passed" on success; any failed assertion aborts with an error.
--
--   Jonas  a0…01  manager of Maple Street      Sarah  a0…02  client
--   Tom    a0…03  client                      Admin  a0…04  admin, on no project

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

-- Fails unless `sql` raises insufficient_privilege (42501): a missing grant or an RLS check.
create or replace function pg_temp.denied(sql text, what text) returns void language plpgsql as $$
begin
  execute sql;
  raise exception 'FAILED: %', what;
exception when insufficient_privilege then null;
end $$;

-- Fails unless `sql` raises check_violation (23514).
create or replace function pg_temp.rejected(sql text, what text) returns void language plpgsql as $$
begin
  execute sql;
  raise exception 'FAILED: %', what;
exception when check_violation then null;
end $$;

-- Rows `sql` (an UPDATE/DELETE) touched.
create or replace function pg_temp.affected(sql text) returns int language plpgsql as $$
declare n int;
begin
  execute sql;
  get diagnostics n = row_count;
  return n;
end $$;


-- An unrelated manager (with no project) and a second manager for the delete tests.
insert into auth.users (id, email, aud, role) values
  ('a0000000-0000-4000-8000-0000000000ee', 'second@renovision.demo', 'authenticated', 'authenticated'),
  ('a0000000-0000-4000-8000-0000000000ff', 'other@renovision.demo', 'authenticated', 'authenticated');
update public.profiles set account_type = 'manager', full_name = 'Second Manager' where id = 'a0000000-0000-4000-8000-0000000000ee';
update public.profiles set account_type = 'manager', full_name = 'Other Manager' where id = 'a0000000-0000-4000-8000-0000000000ff';

-- ===========================================================================
-- Locale and phone
-- ===========================================================================
select pg_temp.check((select locale from public.profiles where id = 'a0000000-0000-4000-8000-0000000000ee') = 'pl',
  'a new profile defaults to pl');
insert into auth.users (id, email, aud, role, raw_user_meta_data) values
  ('a0000000-0000-4000-8000-0000000000dd', 'english@renovision.demo', 'authenticated', 'authenticated', '{"locale":"en"}');
select pg_temp.check((select locale from public.profiles where id = 'a0000000-0000-4000-8000-0000000000dd') = 'en',
  'a language chosen at sign-up (user_metadata.locale) becomes the profile''s');
select pg_temp.check((select locale from public.profiles where id = 'a0000000-0000-4000-8000-000000000003') = 'en'
  and (select locale from public.profiles where id = 'a0000000-0000-4000-8000-000000000002') = 'pl',
  'seed: Tom is en, Sarah is pl');
select pg_temp.rejected($$update public.profiles set locale = 'de' where id = 'a0000000-0000-4000-8000-000000000002'$$,
  'locale outside en/pl was accepted');

select pg_temp.as_user('a0000000-0000-4000-8000-000000000002');
select pg_temp.check(
  pg_temp.affected($$update public.profiles set locale = 'en', phone = '+48 600 100 200' where id = auth.uid()$$) = 1,
  'a user updates their own locale and phone');
select pg_temp.check((select locale = 'en' and phone = '+48 600 100 200' from public.profiles where id = auth.uid()),
  'the new locale and phone are saved');
select pg_temp.check(
  pg_temp.affected($$update public.profiles set locale = 'en' where id = 'a0000000-0000-4000-8000-000000000001'$$) = 0,
  'a user cannot change someone else''s locale');
select pg_temp.denied($$update public.profiles set account_type = 'admin' where id = auth.uid()$$,
  'account_type is still not user-editable');
select pg_temp.as_admin();
update public.profiles set locale = 'pl', phone = null where id = 'a0000000-0000-4000-8000-000000000002';

-- ===========================================================================
-- Notifications: kind + params
-- ===========================================================================
select pg_temp.as_user('a0000000-0000-4000-8000-000000000001');

update public.stages set status = 'blocked' where key = 'wall';
select pg_temp.check(
  (select count(*) from public.notifications
   where kind = 'stage_status' and params = '{"stage":"Walls & Insulation","status":"blocked"}'::jsonb) = 2,
  'a stage status change notifies both clients with kind stage_status and { stage, status }');
select pg_temp.check(
  (select count(*) from public.notifications
   where kind = 'stage_status' and params ->> 'stage' = 'Walls & Insulation'
     and title = 'Stage update: Walls & Insulation' and body = 'Walls & Insulation is now blocked.') = 2,
  'legacy title/body are still filled in English');
select pg_temp.check(
  (select params from public.activity_log where entity_type = 'stages' and created_at = now())
    = '{"entity":"stage","action":"update","label":"Walls & Insulation"}'::jsonb,
  'the activity log writes { entity, action, label }');
select pg_temp.check(
  (select summary from public.activity_log where entity_type = 'stages' and created_at = now()) = 'Updated stage "Walls & Insulation"',
  'the activity log still writes the English summary');

update public.rooms set status = 'progress', progress = 40, client_note = 'Walls closing.' where key = 'bed2';
select pg_temp.check(
  (select count(*) from public.notifications
   where kind = 'room_status' and params = '{"room":"Bedroom 2","status":"progress","note":"Walls closing."}'::jsonb) = 2,
  'a room status change: kind room_status');

update public.projects set schedule_status = 'delayed', schedule_note = 'Waiting on parts.';
select pg_temp.check(
  (select count(*) from public.notifications
   where kind = 'schedule_status' and params = '{"status":"delayed","note":"Waiting on parts."}'::jsonb) = 2,
  'a schedule change: kind schedule_status');

update public.photos set status = 'published', published_at = now() where id = 'e0000000-0000-4000-8000-000000000009';
select pg_temp.check(
  (select count(*) from public.notifications where kind = 'photo_published' and params ? 'caption'
     and entity_id = 'e0000000-0000-4000-8000-000000000009') = 2,
  'publishing a photo: kind photo_published');

update public.renders set is_visible = false where id = 'f0000000-0000-4000-8000-000000000004';
update public.renders set is_visible = true where id = 'f0000000-0000-4000-8000-000000000004';
select pg_temp.check(
  (select count(*) from public.notifications where kind = 'render_published' and params ->> 'title' = 'Bedroom 1') = 2,
  'showing a render: kind render_published');

select public.notify_project_clients('b0000000-0000-4000-8000-000000000001', 'Water off', 'Thursday 9–12', null);
select pg_temp.check(
  (select count(*) from public.notifications
   where kind = 'manual' and params = '{"title":"Water off","body":"Thursday 9–12"}'::jsonb and title = 'Water off') = 2,
  'an announcement: kind manual with { title, body }');

select pg_temp.as_user('a0000000-0000-4000-8000-000000000002');
insert into public.messages (project_id, body) values ('b0000000-0000-4000-8000-000000000001', 'Hello from Sarah');
select pg_temp.as_admin();
select pg_temp.check(
  (select count(*) from public.notifications
   where kind = 'message' and params ->> 'sender' = 'Sarah Bennett' and params ->> 'preview' = 'Hello from Sarah'
     and params -> 'attachment' = 'false'::jsonb
     and recipient_id in ('a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000003')) = 2,
  'a chat message notifies the other members with kind message and { sender, preview, attachment }');
select pg_temp.check(
  (select count(*) from public.notifications where kind = 'message' and params ->> 'preview' = 'Hello from Sarah'
     and recipient_id = 'a0000000-0000-4000-8000-000000000002') = 0,
  'the sender is not notified of their own message');
select pg_temp.check((select emailed_at is null from public.notifications order by created_at desc limit 1),
  'emailed_at starts empty');

-- ===========================================================================
-- Notification preferences
-- ===========================================================================
-- Defaults (no rows): in_app instant; email instant for messages, daily for clients, off for staff.
select pg_temp.check(public.notification_pref('a0000000-0000-4000-8000-000000000002', 'stage_status', 'in_app') = 'instant',
  'default: in_app is instant');
select pg_temp.check(public.notification_pref('a0000000-0000-4000-8000-000000000002', 'stage_status', 'email') = 'daily',
  'default: email is daily for a client');
select pg_temp.check(public.notification_pref('a0000000-0000-4000-8000-000000000002', 'message', 'email') = 'instant',
  'default: email is instant for messages');
select pg_temp.check(public.notification_pref('a0000000-0000-4000-8000-000000000001', 'message', 'email') = 'instant',
  'default: email is instant for messages, staff too');
select pg_temp.check(public.notification_pref('a0000000-0000-4000-8000-000000000001', 'stage_status', 'email') = 'off',
  'default: email is off for staff on other kinds');
select pg_temp.check(public.notification_pref('a0000000-0000-4000-8000-000000000001', 'stage_status', 'in_app') = 'instant',
  'default: in_app is instant for staff');

insert into public.notification_preferences (user_id, kind, channel, frequency)
values ('a0000000-0000-4000-8000-000000000003', 'stage_status', 'email', 'instant');

select pg_temp.as_user('a0000000-0000-4000-8000-000000000002');
insert into public.notification_preferences (kind, channel, frequency) values ('stage_status', 'email', 'off');
select pg_temp.check((select count(*) from public.notification_preferences) = 1, 'a user reads only their own preferences');
select pg_temp.check(public.notification_pref(auth.uid(), 'stage_status', 'email') = 'off', 'a saved preference wins over the default');
update public.notification_preferences set frequency = 'instant' where kind = 'stage_status';
select pg_temp.check(public.notification_pref(auth.uid(), 'stage_status', 'email') = 'instant', 'a user updates their own preference');
select pg_temp.denied($$insert into public.notification_preferences (user_id, kind, channel, frequency)
  values ('a0000000-0000-4000-8000-000000000003', 'message', 'email', 'off')$$, 'a user wrote another user''s preference');
select pg_temp.check(
  pg_temp.affected($$update public.notification_preferences set frequency = 'off' where user_id = 'a0000000-0000-4000-8000-000000000003'$$) = 0,
  'a user cannot update another user''s preference');
select pg_temp.check(
  pg_temp.affected($$delete from public.notification_preferences where user_id = 'a0000000-0000-4000-8000-000000000003'$$) = 0,
  'a user cannot delete another user''s preference');
select pg_temp.denied($$select public.notification_pref('a0000000-0000-4000-8000-000000000003', 'stage_status', 'email')$$,
  'a user read another user''s effective preference');
select pg_temp.check(
  pg_temp.affected($$delete from public.notification_preferences where kind = 'stage_status'$$) = 1,
  'a user deletes their own preference');
select pg_temp.as_admin();
select pg_temp.check(public.notification_pref('a0000000-0000-4000-8000-000000000003', 'stage_status', 'email') = 'instant',
  'the server (no auth.uid) reads anyone''s preference');

-- ===========================================================================
-- Invitations
-- ===========================================================================
insert into public.invitations (id, email, role, project_id, invited_by, token_hash, expires_at) values
  ('90000000-0000-4000-8000-000000000001', 'new.client@example.com', 'client', 'b0000000-0000-4000-8000-000000000001',
   'a0000000-0000-4000-8000-000000000001', 'hash-1', now() + interval '7 days'),
  ('90000000-0000-4000-8000-000000000002', 'staff@example.com', 'manager', null, null, 'hash-2', now() + interval '7 days');
select pg_temp.rejected($$insert into public.invitations (email, role, token_hash, expires_at)
  values ('Mixed@Example.com', 'client', 'hash-3', now())$$, 'an invitation email that is not lowercased');
select pg_temp.rejected($$insert into public.invitations (email, role, token_hash, expires_at)
  values ('not-an-email', 'client', 'hash-4', now())$$, 'an invitation email that is not an address');

select pg_temp.as_user('a0000000-0000-4000-8000-000000000002');
select pg_temp.check((select count(*) from public.invitations) = 0, 'clients see no invitations');
select pg_temp.denied($$insert into public.invitations (email, role, project_id, token_hash, expires_at)
  values ('x@example.com', 'manager', 'b0000000-0000-4000-8000-000000000001', 'h', now())$$, 'a client inserted an invitation');
select pg_temp.denied($$select public.revoke_invitation('90000000-0000-4000-8000-000000000001')$$, 'a client revoked an invitation');

select pg_temp.as_user('a0000000-0000-4000-8000-000000000001');
select pg_temp.check(
  (select count(*) from (select id, email, role, expires_at, revoked_at from public.invitations) i) = 1,
  'a manager reads their project''s invitations (not the staff-only one)');
select pg_temp.denied($$select token_hash from public.invitations$$, 'a manager read the token hash');
select pg_temp.denied($$insert into public.invitations (email, role, project_id, token_hash, expires_at)
  values ('x@example.com', 'client', 'b0000000-0000-4000-8000-000000000001', 'h', now())$$,
  'a manager inserted an invitation directly');
select pg_temp.denied($$update public.invitations set expires_at = now() + interval '1 year'$$, 'a manager updated an invitation directly');
select pg_temp.denied($$delete from public.invitations$$, 'a manager deleted an invitation');
select pg_temp.check(public.revoke_invitation('90000000-0000-4000-8000-000000000001'), 'a manager revokes a pending invitation');
select pg_temp.check(not public.revoke_invitation('90000000-0000-4000-8000-000000000001'), 'revoking twice is a no-op');
select pg_temp.check((select revoked_at is not null from public.invitations), 'revoked_at is set');

select pg_temp.as_user('a0000000-0000-4000-8000-0000000000ff');
select pg_temp.check((select count(*) from public.invitations) = 0, 'another project''s manager sees none');
select pg_temp.denied($$select public.revoke_invitation('90000000-0000-4000-8000-000000000001')$$,
  'another project''s manager revoked an invitation');

select pg_temp.as_admin();
set local role anon;
select pg_temp.denied($$select id from public.invitations$$, 'anon read invitations');
reset role;

-- ===========================================================================
-- Consents: insert own, read own, no update or delete
-- ===========================================================================
select pg_temp.as_user('a0000000-0000-4000-8000-000000000002');
insert into public.consents (kind, version) values ('privacy_policy', '2026-10'), ('terms', '2026-10');
select pg_temp.check((select count(*) from public.consents where user_id = auth.uid()) = 2, 'a user records and reads their consents');
select pg_temp.check((select bool_and(granted_at = now()) from public.consents), 'granted_at is the server''s time');
select pg_temp.denied($$insert into public.consents (user_id, kind, version)
  values ('a0000000-0000-4000-8000-000000000003', 'terms', '2026-10')$$, 'a user recorded consent for someone else');
select pg_temp.denied($$insert into public.consents (kind, version, granted_at)
  values ('terms', '2026-11', now() - interval '1 year')$$, 'a user backdated a consent');
select pg_temp.denied($$update public.consents set version = '2020-01'$$, 'a user updated a consent');
select pg_temp.denied($$delete from public.consents$$, 'a user deleted a consent');

select pg_temp.as_user('a0000000-0000-4000-8000-000000000003');
select pg_temp.check((select count(*) from public.consents) = 0, 'a user cannot see someone else''s consents');

-- ===========================================================================
-- Deleting users: personal rows go, project data stays with the author nulled
-- ===========================================================================
select pg_temp.as_user('a0000000-0000-4000-8000-000000000003');
insert into public.messages (project_id, body) values ('b0000000-0000-4000-8000-000000000001', 'Tom was here');
select pg_temp.as_admin();

create temp table counts_before as
select (select count(*) from public.projects) as projects, (select count(*) from public.stages) as stages,
       (select count(*) from public.rooms) as rooms, (select count(*) from public.tasks) as tasks,
       (select count(*) from public.photos) as photos, (select count(*) from public.renders) as renders,
       (select count(*) from public.expenses) as expenses, (select count(*) from public.ai_knowledge) as knowledge,
       (select count(*) from public.messages) as messages, (select count(*) from public.activity_log) as activity;

-- A client.
delete from auth.users where id = 'a0000000-0000-4000-8000-000000000003';
select pg_temp.check((select count(*) from public.profiles where id = 'a0000000-0000-4000-8000-000000000003') = 0,
  'the profile goes with the auth user');
select pg_temp.check((select count(*) from public.messages where body = 'Tom was here' and sender_id is null) = 1,
  'a deleted client''s message stays, with sender_id null');
select pg_temp.check((select count(*) from public.project_members where user_id = 'a0000000-0000-4000-8000-000000000003') = 0,
  'their membership is removed');
select pg_temp.check((select count(*) from public.notifications where recipient_id = 'a0000000-0000-4000-8000-000000000003') = 0,
  'their own notifications are removed');
select pg_temp.check((select count(*) from public.notification_preferences where user_id = 'a0000000-0000-4000-8000-000000000003') = 0,
  'their notification preferences are removed');

-- The project's only manager can't be deleted (a project keeps a manager) ...
do $$
begin
  delete from auth.users where id = 'a0000000-0000-4000-8000-000000000001';
  raise exception 'FAILED: deleted the project''s last manager';
exception when check_violation then null;
end $$;

-- ... but once there is a second one, deleting the first keeps everything they authored.
insert into public.project_members (project_id, user_id, role)
values ('b0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-0000000000ee', 'manager');
delete from auth.users where id = 'a0000000-0000-4000-8000-000000000001';
select pg_temp.check(
  (select c.projects = (select count(*) from public.projects) and c.stages = (select count(*) from public.stages)
      and c.rooms = (select count(*) from public.rooms) and c.tasks = (select count(*) from public.tasks)
      and c.photos = (select count(*) from public.photos) and c.renders = (select count(*) from public.renders)
      and c.expenses = (select count(*) from public.expenses) and c.knowledge = (select count(*) from public.ai_knowledge)
      and c.messages = (select count(*) from public.messages)
   from counts_before c),
  'no project data is deleted with its author');
select pg_temp.check((select count(*) from public.activity_log) >= (select activity from counts_before),
  'the activity log keeps every row');
select pg_temp.check(
  (select count(*) from public.messages where sender_id is null) = 4, -- Jonas's 3 seeded + Tom's
  'a deleted manager''s messages stay, with sender_id null');
select pg_temp.check((select count(*) from public.photos where uploaded_by is not null) = 0, 'photos.uploaded_by is nulled');
select pg_temp.check((select count(*) from public.expenses where created_by is not null) = 0, 'expenses.created_by is nulled');
select pg_temp.check((select count(*) from public.ai_knowledge where created_by is not null) = 0, 'ai_knowledge.created_by is nulled');
select pg_temp.check((select created_by is null from public.projects where id = 'b0000000-0000-4000-8000-000000000001'),
  'projects.created_by is nulled');
select pg_temp.check(
  (select count(*) from public.notifications where created_by = 'a0000000-0000-4000-8000-000000000001') = 0
    and (select count(*) from public.notifications where recipient_id = 'a0000000-0000-4000-8000-000000000002') > 0,
  'notifications they sent stay with created_by nulled');
select pg_temp.check(
  (select invited_by is null from public.invitations where id = '90000000-0000-4000-8000-000000000001'),
  'invitations they sent stay with invited_by nulled');
select pg_temp.check(
  (select count(*) from public.activity_log where actor_id = 'a0000000-0000-4000-8000-000000000001') > 0,
  'activity_log.actor_id has no foreign key: the trail keeps the old actor id');

-- The chat still reads for the remaining members.
select pg_temp.as_user('a0000000-0000-4000-8000-000000000002');
select pg_temp.check((select count(*) from public.messages where sender_id is null) = 4, 'members still read the former members'' messages');

select pg_temp.as_admin();
select 'comms tests passed' as result;
rollback;
