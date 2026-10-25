-- Change requests (T61; the `decisions` tables): approve or reject only, atomic totals, the stage link, staff 2FA,
-- the notifications, the 24-hour reminder's bookkeeping, RLS and grants.
-- Run against a seeded database (everything is rolled back): bun run test:db, or directly with psql.
-- Prints "change requests tests passed" on success; any failed assertion aborts with an error.
--
--   Jonas  a0…01  manager of Maple Street (b0…01); budget and target_date are read from the seed
--   Sarah  a0…02  client of Maple Street
--   Tom    a0…03  client of Maple Street
--   Other  a0…ff  manager of another project (created below)

begin;

-- Signed in with an MFA-verified session unless `p_aal` says otherwise.
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

-- The server's admin client (the reminder cron).
create or replace function pg_temp.as_service() returns void language plpgsql as $$
begin
  perform set_config('role', 'service_role', true);
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, true);
end $$;

create or replace function pg_temp.as_anon() returns void language plpgsql as $$
begin
  perform set_config('role', 'anon', true);
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claims', '', true);
end $$;

create or replace function pg_temp.check(ok boolean, what text) returns void language plpgsql as $$
begin
  if not coalesce(ok, false) then raise exception 'FAILED: %', what; end if;
end $$;

-- Fails unless `sql` raises the given SQLSTATE.
create or replace function pg_temp.raises(sql text, p_state text, what text) returns void language plpgsql as $$
declare v_state text;
begin
  execute sql;
  raise exception 'FAILED: % (no error)', what;
exception when others then
  get stacked diagnostics v_state = returned_sqlstate;
  if v_state = 'P0001' and sqlerrm like 'FAILED:%' then raise; end if;
  if v_state is distinct from p_state then raise exception 'FAILED: % (got % %)', what, v_state, sqlerrm; end if;
end $$;

-- The seed's dates are relative to the day it runs, so remember the starting point.
create or replace function pg_temp.b0() returns numeric language sql security definer as
$$ select planned_budget from public.projects where id = 'b0000000-0000-4000-8000-000000000001' $$;
create or replace function pg_temp.d0() returns date language sql security definer as
$$ select planned_target_date from public.projects where id = 'b0000000-0000-4000-8000-000000000001' $$;
create or replace function pg_temp.budget() returns numeric language sql security definer as
$$ select budget from public.projects where id = 'b0000000-0000-4000-8000-000000000001' $$;
create or replace function pg_temp.target() returns date language sql security definer as
$$ select target_date from public.projects where id = 'b0000000-0000-4000-8000-000000000001' $$;
create or replace function pg_temp.req(p_setting text) returns public.decisions language sql security definer as
$$ select * from public.decisions where id = current_setting(p_setting)::uuid $$;

-- Staff 2FA is enforced (a missing settings row enforces too).
insert into private.app_settings (id, enforce_staff_mfa) values (true, true)
on conflict (id) do update set enforce_staff_mfa = true;

-- Another project (with a stage) for the isolation checks.
insert into auth.users (id, email, aud, role) values
  ('a0000000-0000-4000-8000-0000000000ff', 'other@renovision.demo', 'authenticated', 'authenticated');
insert into public.profiles (id, full_name, account_type)
values ('a0000000-0000-4000-8000-0000000000ff', 'Other Manager', 'admin')
on conflict (id) do update set account_type = 'admin';
insert into public.projects (id, name, status, target_date, budget)
values ('b0000000-0000-4000-8000-0000000000c1', 'Other project', 'active', date '2027-01-01', 1000);
insert into public.project_members (project_id, user_id, role)
values ('b0000000-0000-4000-8000-0000000000c1', 'a0000000-0000-4000-8000-0000000000ff', 'manager');
insert into public.stages (id, project_id, key, name, start_date, end_date, sort_order)
values ('c0000000-0000-4000-8000-0000000000c1', 'b0000000-0000-4000-8000-0000000000c1', 'other', 'Other stage',
        date '2026-01-01', date '2026-02-01', 1);

-- ===========================================================================
-- What is gone
-- ===========================================================================
select pg_temp.check(to_regclass('public.decision_photos') is null, 'decision_photos is dropped');
select pg_temp.check(to_regclass('public.decision_confirmations') is null, 'decision_confirmations is dropped');
select pg_temp.check(to_regprocedure('public.ask_decision_question(uuid, text)') is null, 'ask_decision_question is dropped');
select pg_temp.check(to_regprocedure('public.answer_decision_question(uuid, text)') is null, 'answer_decision_question is dropped');
select pg_temp.check(to_regprocedure('public.accept_decision(uuid, text)') is null, 'the code-taking accept_decision is dropped');
select pg_temp.check(to_regprocedure('private.decision_add_photos(uuid, uuid, text[])') is null, 'the photo helper is dropped');
select pg_temp.check(to_regprocedure('private.decision_invalidate_codes(uuid)') is null, 'the code helper is dropped');
select pg_temp.check(
  not exists (select 1 from pg_policies where schemaname = 'storage' and policyname = 'media: clients read decision photos'),
  'the decision-photo storage policy is dropped');
select pg_temp.check((select count(*) from public.decisions where status = 'question') = 0, 'no request is left in question');

-- ===========================================================================
-- Submitting (manager, 2FA)
-- ===========================================================================
select pg_temp.as_user('a0000000-0000-4000-8000-000000000001', 'aal1');
select pg_temp.raises(
  $q$ select public.create_decision('b0000000-0000-4000-8000-000000000001', 'AAL1', '', 100, 1) $q$,
  '42501', 'an AAL1 manager can''t submit while 2FA is enforced');

select pg_temp.as_user('a0000000-0000-4000-8000-000000000001');
select pg_temp.raises(
  $q$ select public.create_decision('b0000000-0000-4000-8000-000000000001', 'Nothing', '', 0, 0) $q$,
  '22023', 'a request must change the cost or the days');
select pg_temp.raises(
  $q$ select public.create_decision('b0000000-0000-4000-8000-000000000001', '   ', '', 100, 1) $q$,
  '23514', 'a blank title is refused');
select pg_temp.raises(
  $q$ select public.create_decision('b0000000-0000-4000-8000-0000000000c1', 'Wrong project', '', 10, 0) $q$,
  '42501', 'a manager of another project can''t submit here (and vice versa)');
select pg_temp.raises(
  $q$ select public.create_decision('b0000000-0000-4000-8000-000000000001', 'Foreign stage', '', 10, 0,
        'c0000000-0000-4000-8000-0000000000c1') $q$,
  '22023', 'a stage of another project is refused');

-- Negative cost and negative days are fine; a request may link a stage.
select set_config('t.saving', public.create_decision('b0000000-0000-4000-8000-000000000001', 'Cheaper tiles', 'Switch the tile range',
  -1200.50, -3)::text, true);
select set_config('t.extra', public.create_decision('b0000000-0000-4000-8000-000000000001', 'Extra socket', 'Two more sockets',
  880, 4, 'c0000000-0000-4000-8000-000000000003')::text, true);
select set_config('t.days', public.create_decision('b0000000-0000-4000-8000-000000000001', 'Drying time', '', 0, 2)::text, true);

select pg_temp.check((select count(*) from public.decisions) = 3, 'manager sees the 3 requests');
select pg_temp.check(
  (select status = 'pending' and cost_delta = -1200.50 and days_delta = -3 and stage_id is null from pg_temp.req('t.saving')),
  'a new request is pending and keeps negative deltas');
select pg_temp.check((select stage_id = 'c0000000-0000-4000-8000-000000000003' from pg_temp.req('t.extra')), 'the stage link is stored');
select pg_temp.check(
  (select pending_since is not null and pending_since > now() - interval '1 minute' and reminded_at is null from pg_temp.req('t.extra')),
  'pending_since is set on create, reminded_at is empty');
select pg_temp.check(
  (select count(*) from public.decision_events where decision_id = current_setting('t.extra')::uuid and kind = 'submitted' and actor_role = 'manager') = 1,
  'a submitted event with the actor''s role');
select pg_temp.check(pg_temp.budget() = pg_temp.b0() and pg_temp.target() = pg_temp.d0(), 'submitting changes no totals');

-- The clients are notified; the link is where the request is listed.
select pg_temp.as_admin();
select pg_temp.check(
  (select count(*) from public.notifications where kind = 'decision_new' and entity_id = current_setting('t.extra')::uuid
     and recipient_id in ('a0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000003')
     and params ->> 'title' = 'Extra socket' and link = '/budget') = 2,
  'both clients get a decision_new notification linking to Budget');
select pg_temp.check(
  (select bool_and(link = '/progress') from public.notifications where kind = 'decision_new' and entity_id = current_setting('t.days')::uuid),
  'a days-only request links to Progress');
select pg_temp.check(
  (select count(*) from public.notifications where kind = 'decision_new' and recipient_id = 'a0000000-0000-4000-8000-000000000001') = 0,
  'the submitting manager is not notified');

-- ===========================================================================
-- Editing (manager, 2FA, pending only)
-- ===========================================================================
select pg_temp.as_user('a0000000-0000-4000-8000-000000000001', 'aal1');
select pg_temp.raises(
  format($q$ select public.update_decision(%L, 'Extra socket', '', 900, 4) $q$, current_setting('t.extra')),
  '42501', 'an AAL1 manager can''t edit');
select pg_temp.as_user('a0000000-0000-4000-8000-000000000001');
select pg_temp.raises(
  format($q$ select public.update_decision(%L, 'Extra socket', '', 0, 0) $q$, current_setting('t.extra')),
  '22023', 'an edit can''t remove every change');
select pg_temp.raises(
  format($q$ select public.update_decision(%L, 'Extra socket', '', 900, 4, 'c0000000-0000-4000-8000-0000000000c1') $q$, current_setting('t.extra')),
  '22023', 'an edit can''t link a stage of another project');
select public.update_decision(current_setting('t.extra')::uuid, 'Extra socket', 'Two more sockets, final price', 900, 4,
  'c0000000-0000-4000-8000-000000000003');
select pg_temp.check((select cost_delta = 900 from pg_temp.req('t.extra')), 'the edit is saved');
select pg_temp.check((select count(*) from public.decision_events where decision_id = current_setting('t.extra')::uuid and kind = 'edited') = 1,
  'an edited event is logged');

-- Deleting the stage keeps the request and drops the link.
select pg_temp.as_admin();
insert into public.stages (id, project_id, key, name, start_date, end_date, sort_order)
values ('c0000000-0000-4000-8000-0000000000d1', 'b0000000-0000-4000-8000-000000000001', 'tmp', 'Temporary stage',
        date '2026-01-01', date '2026-02-01', 99);
update public.decisions set stage_id = 'c0000000-0000-4000-8000-0000000000d1' where id = current_setting('t.saving')::uuid;
delete from public.stages where id = 'c0000000-0000-4000-8000-0000000000d1';
select pg_temp.check((select stage_id is null from pg_temp.req('t.saving')), 'deleting the stage sets the link to null');

-- ===========================================================================
-- Access: clients read, nobody writes directly; isolation across projects
-- ===========================================================================
select pg_temp.as_user('a0000000-0000-4000-8000-000000000002', 'aal1');
select pg_temp.check((select count(*) from public.decisions) = 3, 'client sees the requests');
select pg_temp.check((select count(*) from public.decision_events) >= 4, 'client sees the history');
select pg_temp.raises($q$ update public.decisions set status = 'accepted' where status = 'pending' $q$, '42501', 'client can''t update a request');
select pg_temp.raises($q$ delete from public.decisions $q$, '42501', 'client can''t delete a request');
select pg_temp.raises(
  $q$ insert into public.decisions (project_id, title) values ('b0000000-0000-4000-8000-000000000001', 'x') $q$,
  '42501', 'client can''t insert a request');
select pg_temp.raises($q$ insert into public.decision_events (decision_id, project_id, kind)
  select id, project_id, 'accepted' from public.decisions limit 1 $q$, '42501', 'client can''t write history');
select pg_temp.raises(
  $q$ select public.create_decision('b0000000-0000-4000-8000-000000000001', 'By client', '', 10, 0) $q$,
  '42501', 'a client can''t submit');
select pg_temp.raises(format($q$ select public.remind_decision(%L) $q$, current_setting('t.extra')), '42501',
  'a client can''t trigger a reminder');

select pg_temp.as_user('a0000000-0000-4000-8000-0000000000ff');
select pg_temp.check((select count(*) from public.decisions) = 0, 'another project''s manager sees nothing');
select pg_temp.check((select count(*) from public.decision_events) = 0, 'nor the history');
select pg_temp.raises(
  format($q$ select public.update_decision(%L, 'Hijack', '', 1, 0) $q$, current_setting('t.extra')),
  '42501', 'another project''s manager can''t edit');
select pg_temp.raises(format($q$ select public.reopen_decision(%L) $q$, current_setting('t.extra')), '42501', 'nor reopen');
select pg_temp.raises(format($q$ select public.accept_decision(%L) $q$, current_setting('t.extra')), '42501', 'nor approve');

select pg_temp.as_anon();
select pg_temp.raises($q$ select count(*) from public.decisions $q$, '42501', 'anon has no access to the table');
select pg_temp.raises($q$ select public.accept_decision(gen_random_uuid()) $q$, '42501', 'anon can''t call the RPCs');

-- ===========================================================================
-- Reject (reason required) -> manager notified -> reopen -> pending, totals untouched
-- ===========================================================================
select pg_temp.as_user('a0000000-0000-4000-8000-000000000002', 'aal1');
select pg_temp.raises(format($q$ select public.reject_decision(%L, '   ') $q$, current_setting('t.days')), '22023', 'a reason is required');
select public.reject_decision(current_setting('t.days')::uuid, 'Not needed');
select pg_temp.check(
  (select status = 'rejected' and decision_reason = 'Not needed' and decided_by = 'a0000000-0000-4000-8000-000000000002'
     and decided_at is not null and pending_since is null from pg_temp.req('t.days')),
  'rejected with the reason; no longer pending');
select pg_temp.raises(format($q$ select public.reject_decision(%L, 'again') $q$, current_setting('t.days')), '55000', 'can''t reject twice');
select pg_temp.check(public.accept_decision(current_setting('t.days')::uuid) = 'not_open', 'a rejected request can''t be approved');

select pg_temp.as_user('a0000000-0000-4000-8000-000000000001');
select pg_temp.check(
  (select count(*) from public.notifications where kind = 'decision_rejected' and entity_id = current_setting('t.days')::uuid
     and recipient_id = 'a0000000-0000-4000-8000-000000000001' and params ->> 'text' = 'Not needed') = 1,
  'the manager is notified of the rejection');
select pg_temp.raises(format($q$ select public.update_decision(%L, 'Edit rejected', '', 0, 1) $q$, current_setting('t.days')), '55000',
  'a rejected request is locked for edits');
select pg_temp.check(pg_temp.budget() = pg_temp.b0() and pg_temp.target() = pg_temp.d0(), 'rejecting changes no totals');

select pg_temp.as_user('a0000000-0000-4000-8000-000000000001', 'aal1');
select pg_temp.raises(format($q$ select public.reopen_decision(%L) $q$, current_setting('t.days')), '42501',
  'an AAL1 manager can''t reopen');
select pg_temp.as_user('a0000000-0000-4000-8000-000000000001');
-- Pretend it was reminded long ago: reopening starts the clock again and allows a new reminder.
select pg_temp.as_admin();
update public.decisions set reminded_at = now() - interval '3 days' where id = current_setting('t.days')::uuid;
select pg_temp.as_user('a0000000-0000-4000-8000-000000000001');
select public.reopen_decision(current_setting('t.days')::uuid);
select pg_temp.check(
  (select status = 'pending' and decided_at is null and decided_by is null and decision_reason = ''
     and pending_since > now() - interval '1 minute' and reminded_at is null from pg_temp.req('t.days')),
  'reopened: pending again, the decision cleared, pending_since reset, reminded_at cleared');
select pg_temp.check(
  (select array_agg(kind::text order by id) from public.decision_events where decision_id = current_setting('t.days')::uuid)
    = array['submitted', 'rejected', 'reopened'], 'the history keeps rejected and reopened');
select pg_temp.raises(format($q$ select public.reopen_decision(%L) $q$, current_setting('t.days')), '55000', 'only a rejected request can be reopened');
select pg_temp.check(pg_temp.budget() = pg_temp.b0() and pg_temp.target() = pg_temp.d0(), 'reopening changes no totals');
select pg_temp.as_admin();
select pg_temp.check(
  (select count(*) from public.notifications where kind = 'decision_reopened' and entity_id = current_setting('t.days')::uuid) = 2,
  'the clients are told about a reopen by the manager');

-- A client may reopen too, without 2FA.
select pg_temp.as_user('a0000000-0000-4000-8000-000000000003', 'aal1');
select public.reject_decision(current_setting('t.days')::uuid, 'Changed my mind');
select public.reopen_decision(current_setting('t.days')::uuid);
select pg_temp.check((select status = 'pending' from pg_temp.req('t.days')), 'a client can reopen as well');

-- ===========================================================================
-- Approving: no code, atomic totals, idempotent, the managers notified
-- ===========================================================================
select pg_temp.as_user('a0000000-0000-4000-8000-000000000002', 'aal1');
select pg_temp.check(public.accept_decision(current_setting('t.extra')::uuid) = 'ok', 'a client approves without a code');
select pg_temp.check(pg_temp.budget() = pg_temp.b0() + 900 and pg_temp.target() = pg_temp.d0() + 4,
  'approving adds cost_delta (900) and days_delta (4)');
select pg_temp.check(
  (select status = 'accepted' and decided_by = 'a0000000-0000-4000-8000-000000000002' and decided_at is not null and pending_since is null
     from pg_temp.req('t.extra')), 'approved by the client');

-- Double submit, and the other client racing after: nothing is applied twice.
select pg_temp.check(public.accept_decision(current_setting('t.extra')::uuid) = 'already_accepted', 'a repeated approve is idempotent');
select pg_temp.as_user('a0000000-0000-4000-8000-000000000003', 'aal1');
select pg_temp.check(public.accept_decision(current_setting('t.extra')::uuid) = 'already_accepted', 'the other client gets already_accepted');
select pg_temp.check(pg_temp.budget() = pg_temp.b0() + 900 and pg_temp.target() = pg_temp.d0() + 4, 'totals applied exactly once');
select pg_temp.as_admin();
select pg_temp.check((select count(*) from public.decision_events where decision_id = current_setting('t.extra')::uuid and kind = 'accepted') = 1,
  'one accepted event');
select pg_temp.check(
  (select count(*) from public.notifications where kind = 'decision_accepted' and entity_id = current_setting('t.extra')::uuid
     and recipient_id = 'a0000000-0000-4000-8000-000000000001' and params ->> 'title' = 'Extra socket') = 1,
  'the manager gets one decision_accepted notification');
select pg_temp.check(
  (select count(*) from public.notifications where kind = 'decision_accepted' and recipient_id <> 'a0000000-0000-4000-8000-000000000001') = 0,
  'only managers get decision_accepted');

-- The planned baseline is unchanged: the deviation display (#53/#54) now shows the difference.
select pg_temp.check(
  (select planned_budget = pg_temp.b0() and planned_target_date = pg_temp.d0() from public.projects where id = 'b0000000-0000-4000-8000-000000000001'),
  'the planned baseline stays; the current values moved');

-- Locked after the decision.
select pg_temp.as_user('a0000000-0000-4000-8000-000000000001');
select pg_temp.raises(format($q$ select public.update_decision(%L, 'Late edit', '', 1, 0) $q$, current_setting('t.extra')), '55000',
  'an approved request is locked for edits');
select pg_temp.as_user('a0000000-0000-4000-8000-000000000002', 'aal1');
select pg_temp.raises(format($q$ select public.reject_decision(%L, 'too late') $q$, current_setting('t.extra')), '55000', 'approved is final: no rejection');
select pg_temp.raises(format($q$ select public.reopen_decision(%L) $q$, current_setting('t.extra')), '55000', 'nor a reopen');

-- A negative delta (savings) lowers the budget and pulls the end date in.
select pg_temp.as_user('a0000000-0000-4000-8000-000000000003', 'aal1');
select pg_temp.check(public.accept_decision(current_setting('t.saving')::uuid) = 'ok', 'approving a saving works');
select pg_temp.check(pg_temp.budget() = pg_temp.b0() + 900 - 1200.50 and pg_temp.target() = pg_temp.d0() + 4 - 3, 'negative deltas: -1200.50 and -3 days');

-- The budget can't be pushed below zero; nothing is applied then.
select pg_temp.as_user('a0000000-0000-4000-8000-000000000001');
select set_config('t.huge', public.create_decision('b0000000-0000-4000-8000-000000000001', 'Huge saving', '', -90000000, 0)::text, true);
select pg_temp.as_user('a0000000-0000-4000-8000-000000000002', 'aal1');
select pg_temp.raises(format($q$ select public.accept_decision(%L) $q$, current_setting('t.huge')), '23514', 'a negative budget is refused');
select pg_temp.check(pg_temp.budget() = pg_temp.b0() + 900 - 1200.50, 'and nothing was applied');
select pg_temp.check((select status = 'pending' from pg_temp.req('t.huge')), 'the request stays open');

-- A project without an end date keeps it unset (days can't be applied).
select pg_temp.as_admin();
update public.projects set target_date = null where id = 'b0000000-0000-4000-8000-000000000001';
select pg_temp.as_user('a0000000-0000-4000-8000-000000000001');
select set_config('t.nodate', public.create_decision('b0000000-0000-4000-8000-000000000001', 'No end date', '', 10, 5)::text, true);
select pg_temp.as_user('a0000000-0000-4000-8000-000000000002', 'aal1');
select pg_temp.check(public.accept_decision(current_setting('t.nodate')::uuid) = 'ok', 'approving without an end date works');
select pg_temp.check(pg_temp.target() is null and pg_temp.budget() = pg_temp.b0() + 900 - 1200.50 + 10, 'budget moves, a missing end date stays missing');

-- ===========================================================================
-- The 24-hour reminder: remind_decision (service role only)
-- ===========================================================================
-- t.days is pending (reopened a moment ago), t.huge is pending.
select pg_temp.as_service();
select pg_temp.check(public.remind_decision(current_setting('t.huge')::uuid) = false, 'not due before 24 hours');
select pg_temp.check((select reminded_at is null from pg_temp.req('t.huge')), 'nothing is marked when not due');

select pg_temp.as_admin();
update public.decisions set pending_since = now() - interval '25 hours' where id in (current_setting('t.huge')::uuid, current_setting('t.days')::uuid);
select pg_temp.as_service();
select pg_temp.check(public.remind_decision(current_setting('t.huge')::uuid) = true, 'due after 24 hours: reminded');
select pg_temp.check((select reminded_at is not null from pg_temp.req('t.huge')), 'reminded_at is set');
select pg_temp.check(public.remind_decision(current_setting('t.huge')::uuid) = false, 'only one reminder');
select pg_temp.check(public.remind_decision(current_setting('t.extra')::uuid) = false, 'an approved request is never reminded');
select pg_temp.check(public.remind_decision(gen_random_uuid()) = false, 'an unknown request is ignored');
select pg_temp.as_admin();
select pg_temp.check(
  (select count(*) from public.notifications where kind = 'decision_reminder' and entity_id = current_setting('t.huge')::uuid
     and recipient_id in ('a0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000003')) = 2,
  'both clients get one decision_reminder');

-- Reopening after a reminder starts the clock again.
select pg_temp.as_user('a0000000-0000-4000-8000-000000000003', 'aal1');
select public.reject_decision(current_setting('t.huge')::uuid, 'No');
select pg_temp.as_service();
select pg_temp.check(public.remind_decision(current_setting('t.huge')::uuid) = false, 'a rejected request is not reminded');
select pg_temp.as_user('a0000000-0000-4000-8000-000000000001');
select public.reopen_decision(current_setting('t.huge')::uuid);
select pg_temp.check((select reminded_at is null from pg_temp.req('t.huge')), 'reopening clears reminded_at');
select pg_temp.as_service();
select pg_temp.check(public.remind_decision(current_setting('t.huge')::uuid) = false, 'a reopened request waits another 24 hours');

-- Privileges of the reminder function.
select pg_temp.as_admin();
select pg_temp.check(has_function_privilege('service_role', 'public.remind_decision(uuid)', 'EXECUTE'), 'service_role may remind');
select pg_temp.check(not has_function_privilege('authenticated', 'public.remind_decision(uuid)', 'EXECUTE'), 'authenticated may not remind');
select pg_temp.check(not has_function_privilege('anon', 'public.remind_decision(uuid)', 'EXECUTE'), 'anon may not remind');

-- ===========================================================================
-- History is append-only
-- ===========================================================================
select pg_temp.raises($q$ update public.decision_events set text = 'tampered' $q$, '55000', 'events can''t be updated, even by the owner');

select 'change requests tests passed';
rollback;
