-- Investor decisions (#55): state machine, atomic totals, confirmation codes, RLS and grants.
-- Run against a seeded database (everything is rolled back): bun run test:db, or directly with psql.
-- Prints "investor decisions tests passed" on success; any failed assertion aborts with an error.
--
--   Jonas  a0…01  manager of Maple Street (b0…01); budget and target_date are read from the seed
--   Sarah  a0…02  client of Maple Street
--   Tom    a0…03  client of Maple Street
--   Other  a0…ff  manager of another project (created below)

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

-- Issues a confirmation code the way the server function does: only the salted hash is stored.
create or replace function pg_temp.issue_code(p_decision uuid, p_user uuid, p_code text, p_ttl interval default interval '10 minutes')
returns void language plpgsql as $$
begin
  insert into public.decision_confirmations (decision_id, user_id, code_hash, salt, expires_at)
  values (p_decision, p_user, encode(sha256(convert_to('salt-' || p_decision || ':' || p_code, 'UTF8')), 'hex'),
          'salt-' || p_decision, now() + p_ttl);
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

-- Maple Street = b0…01. Photos in storage, plus another project for the isolation checks.
insert into storage.objects (bucket_id, name) values
  ('project-media', 'b0000000-0000-4000-8000-000000000001/decisions/a.jpg'),
  ('project-media', 'b0000000-0000-4000-8000-000000000001/decisions/b.jpg'),
  ('project-media', 'b0000000-0000-4000-8000-000000000001/decisions/c.jpg'),
  ('project-media', 'b0000000-0000-4000-8000-000000000001/decisions/d.jpg'),
  ('project-media', 'b0000000-0000-4000-8000-000000000001/decisions/e.jpg'),
  ('project-media', 'b0000000-0000-4000-8000-000000000001/decisions/f.jpg'),
  ('project-media', 'b0000000-0000-4000-8000-000000000001/decisions/g.jpg'),
  ('project-media', 'b0000000-0000-4000-8000-0000000000c1/decisions/x.jpg');
insert into auth.users (id, email, aud, role) values
  ('a0000000-0000-4000-8000-0000000000ff', 'other@renovision.demo', 'authenticated', 'authenticated');
insert into public.profiles (id, full_name, account_type)
values ('a0000000-0000-4000-8000-0000000000ff', 'Other Manager', 'manager')
on conflict (id) do update set account_type = 'manager';
insert into public.projects (id, name, status, target_date, budget)
values ('b0000000-0000-4000-8000-0000000000c1', 'Other project', 'active', date '2027-01-01', 1000);
insert into public.project_members (project_id, user_id, role)
values ('b0000000-0000-4000-8000-0000000000c1', 'a0000000-0000-4000-8000-0000000000ff', 'manager');

-- ===========================================================================
-- Submitting (manager)
-- ===========================================================================
select pg_temp.as_user('a0000000-0000-4000-8000-000000000001');

select pg_temp.raises(
  $q$ select public.create_decision('b0000000-0000-4000-8000-000000000001', 'No photo', '', 100, 1, '{}') $q$,
  '22023', 'a case needs at least one photo');
select pg_temp.raises(
  $q$ select public.create_decision('b0000000-0000-4000-8000-000000000001', 'Missing file', '', 100, 1,
        array['b0000000-0000-4000-8000-000000000001/decisions/nope.jpg']) $q$,
  '22023', 'a photo must exist in storage');
select pg_temp.raises(
  $q$ select public.create_decision('b0000000-0000-4000-8000-000000000001', 'Foreign photo', '', 100, 1,
        array['b0000000-0000-4000-8000-0000000000c1/decisions/x.jpg']) $q$,
  '23514', 'a photo must live in the case''s own project folder');
select pg_temp.raises(
  $q$ select public.create_decision('b0000000-0000-4000-8000-000000000001', '   ', '', 100, 1,
        array['b0000000-0000-4000-8000-000000000001/decisions/a.jpg']) $q$,
  '23514', 'a blank title is refused');
select pg_temp.raises(
  $q$ select public.create_decision('b0000000-0000-4000-8000-0000000000c1', 'Wrong project', '', 0, 0,
        array['b0000000-0000-4000-8000-0000000000c1/decisions/x.jpg']) $q$,
  '42501', 'a manager of another project can''t submit here (and vice versa)');

-- Negative cost and negative days are fine.
select set_config('t.saving', public.create_decision('b0000000-0000-4000-8000-000000000001', 'Cheaper tiles', 'Switch the tile range',
  -1200.50, -3, array['b0000000-0000-4000-8000-000000000001/decisions/a.jpg']::text[])::text, true);
select set_config('t.extra', public.create_decision('b0000000-0000-4000-8000-000000000001', 'Extra socket', 'Two more sockets',
  880, 4, array['b0000000-0000-4000-8000-000000000001/decisions/b.jpg', 'b0000000-0000-4000-8000-000000000001/decisions/c.jpg']::text[])::text, true);
select set_config('t.zero', public.create_decision('b0000000-0000-4000-8000-000000000001', 'No impact', '', 0, 0,
  array['b0000000-0000-4000-8000-000000000001/decisions/d.jpg']::text[])::text, true);

select pg_temp.check((select count(*) from public.decisions) = 3, 'manager sees the 3 cases');
select pg_temp.check(
  (select status = 'pending' and cost_delta = -1200.50 and days_delta = -3 from public.decisions where id = current_setting('t.saving')::uuid),
  'new case is pending and keeps negative deltas');
select pg_temp.check((select count(*) from public.decision_photos where decision_id = current_setting('t.extra')::uuid) = 2, 'two photos stored');
select pg_temp.check(
  (select count(*) from public.decision_events where decision_id = current_setting('t.extra')::uuid and kind = 'submitted' and actor_role = 'manager') = 1,
  'a submitted event with the actor''s role');
select pg_temp.check(pg_temp.budget() = pg_temp.b0() and pg_temp.target() = pg_temp.d0(), 'submitting changes no totals');

-- The investor is notified.
select pg_temp.as_admin();
select pg_temp.check(
  (select count(*) from public.notifications where kind = 'decision_new' and entity_id = current_setting('t.extra')::uuid
     and recipient_id in ('a0000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000003')
     and params ->> 'title' = 'Extra socket') = 2,
  'both clients get a decision_new notification');
select pg_temp.check(
  (select count(*) from public.notifications where kind = 'decision_new' and recipient_id = 'a0000000-0000-4000-8000-000000000001') = 0,
  'the submitting manager is not notified');

-- ===========================================================================
-- Access: clients read, nobody writes directly; isolation across projects
-- ===========================================================================
select pg_temp.as_user('a0000000-0000-4000-8000-000000000002');
select pg_temp.check((select count(*) from public.decisions) = 3, 'client sees the cases');
select pg_temp.check((select count(*) from public.decision_photos) = 4, 'client sees the photos');
select pg_temp.check((select count(*) from public.decision_events) = 3, 'client sees the history');
select pg_temp.check((select count(*) from storage.objects where name like '%/decisions/a.jpg') = 1, 'client reads a case photo in storage');
select pg_temp.check((select count(*) from storage.objects where name like '%/decisions/e.jpg') = 0, 'client can''t read an unattached object');

select pg_temp.raises($q$ update public.decisions set status = 'accepted' where status = 'pending' $q$, '42501', 'client can''t update a case');
select pg_temp.raises($q$ delete from public.decisions $q$, '42501', 'client can''t delete a case');
select pg_temp.raises(
  $q$ insert into public.decisions (project_id, title) values ('b0000000-0000-4000-8000-000000000001', 'x') $q$,
  '42501', 'client can''t insert a case');
select pg_temp.raises($q$ insert into public.decision_events (decision_id, project_id, kind)
  select id, project_id, 'accepted' from public.decisions limit 1 $q$, '42501', 'client can''t write history');
select pg_temp.raises($q$ select * from public.decision_confirmations $q$, '42501', 'confirmations are not readable through the API');
select pg_temp.raises(
  $q$ select public.create_decision('b0000000-0000-4000-8000-000000000001', 'By client', '', 0, 0,
        array['b0000000-0000-4000-8000-000000000001/decisions/e.jpg']) $q$,
  '42501', 'a client can''t submit');
select pg_temp.raises($q$ select public.answer_decision_question(id, 'x') from public.decisions limit 1 $q$, '42501', 'a client can''t answer');

select pg_temp.as_user('a0000000-0000-4000-8000-0000000000ff');
select pg_temp.check((select count(*) from public.decisions) = 0, 'another project''s manager sees nothing');
select pg_temp.check((select count(*) from public.decision_photos) = 0 and (select count(*) from public.decision_events) = 0,
  'nor photos or history');
select pg_temp.raises(
  format($q$ select public.update_decision(%L, 'Hijack', '', 0, 0) $q$, current_setting('t.extra')),
  '42501', 'another project''s manager can''t edit');
select pg_temp.raises(format($q$ select public.reopen_decision(%L) $q$, current_setting('t.extra')), '42501', 'nor reopen');
select pg_temp.raises(format($q$ select public.accept_decision(%L, '123456') $q$, current_setting('t.extra')), '42501', 'nor accept');

select pg_temp.as_anon();
select pg_temp.raises($q$ select count(*) from public.decisions $q$, '42501', 'anon has no access to the table');
select pg_temp.raises($q$ select public.accept_decision(gen_random_uuid(), '123456') $q$, '42501', 'anon can''t call the RPCs');

-- ===========================================================================
-- Question -> answer -> pending; the manager is notified
-- ===========================================================================
select pg_temp.as_user('a0000000-0000-4000-8000-000000000002');
select public.ask_decision_question(current_setting('t.extra')::uuid, 'Is the price final?');
select pg_temp.check((select status = 'question' from public.decisions where id = current_setting('t.extra')::uuid), 'a question sets the status');
select pg_temp.raises(format($q$ select public.ask_decision_question(%L, 'again') $q$, current_setting('t.extra')), '55000',
  'no second question while one is open');
select pg_temp.raises(format($q$ select public.ask_decision_question(%L, '  ') $q$, current_setting('t.zero')), '22023', 'a blank question is refused');

select pg_temp.as_user('a0000000-0000-4000-8000-000000000001');
select pg_temp.check(
  (select count(*) from public.notifications where kind = 'decision_question' and entity_id = current_setting('t.extra')::uuid
     and recipient_id = 'a0000000-0000-4000-8000-000000000001' and params ->> 'text' = 'Is the price final?') = 1,
  'the manager is notified of the question');
-- Editing is still allowed while in question; it is logged.
select pg_temp.check(public.update_decision(current_setting('t.extra')::uuid, 'Extra socket', 'Two more sockets, final price', 880, 4) = '{}',
  'edit in question returns no removed photos');
select pg_temp.check((select count(*) from public.decision_events where decision_id = current_setting('t.extra')::uuid and kind = 'edited') = 1,
  'an edited event is logged');
select public.answer_decision_question(current_setting('t.extra')::uuid, 'Yes, the quote is final.');
select pg_temp.check((select status = 'pending' from public.decisions where id = current_setting('t.extra')::uuid), 'an answer returns the case to pending');
select pg_temp.raises(format($q$ select public.answer_decision_question(%L, 'x') $q$, current_setting('t.extra')), '55000', 'nothing to answer when pending');
select pg_temp.check(
  (select array_agg(kind::text order by id) from public.decision_events where decision_id = current_setting('t.extra')::uuid)
    = array['submitted', 'question', 'edited', 'answer'],
  'history is in order: submitted, question, edited, answer');
select pg_temp.as_admin();
select pg_temp.check(
  (select count(*) from public.notifications where kind = 'decision_answer' and entity_id = current_setting('t.extra')::uuid) = 2,
  'the clients are notified of the answer');

-- Photos can be swapped while open, at least one must remain.
select pg_temp.as_user('a0000000-0000-4000-8000-000000000001');
select pg_temp.raises(
  format($q$ select public.update_decision(%L, 'Extra socket', '', 880, 4, '{}', (select array_agg(id) from public.decision_photos where decision_id = %L)) $q$,
         current_setting('t.extra'), current_setting('t.extra')),
  '22023', 'removing every photo is refused');
select pg_temp.check(
  array_length(public.update_decision(current_setting('t.extra')::uuid, 'Extra socket', '', 880, 4,
    array['b0000000-0000-4000-8000-000000000001/decisions/f.jpg']::text[],
    array[(select id from public.decision_photos where decision_id = current_setting('t.extra')::uuid order by sort_order limit 1)]), 1) = 1,
  'a swapped photo is reported back for deletion');
select pg_temp.check((select count(*) from public.decision_photos where decision_id = current_setting('t.extra')::uuid) = 2, 'still two photos');

-- ===========================================================================
-- Reject (reason required) -> manager notified -> reopen -> pending, totals untouched
-- ===========================================================================
select pg_temp.as_user('a0000000-0000-4000-8000-000000000002');
select pg_temp.raises(format($q$ select public.reject_decision(%L, '   ') $q$, current_setting('t.zero')), '22023', 'a reason is required');
select public.reject_decision(current_setting('t.zero')::uuid, 'Not needed');
select pg_temp.check(
  (select status = 'rejected' and decision_reason = 'Not needed' and decided_by = 'a0000000-0000-4000-8000-000000000002' and decided_at is not null
     from public.decisions where id = current_setting('t.zero')::uuid), 'rejected with the reason');
select pg_temp.raises(format($q$ select public.reject_decision(%L, 'again') $q$, current_setting('t.zero')), '55000', 'can''t reject twice');
select pg_temp.check(public.accept_decision(current_setting('t.zero')::uuid, '123456') = 'not_open', 'a rejected case can''t be accepted');

select pg_temp.as_user('a0000000-0000-4000-8000-000000000001');
select pg_temp.check(
  (select count(*) from public.notifications where kind = 'decision_rejected' and entity_id = current_setting('t.zero')::uuid
     and recipient_id = 'a0000000-0000-4000-8000-000000000001' and params ->> 'text' = 'Not needed') = 1,
  'the manager is notified of the rejection');
select pg_temp.raises(format($q$ select public.update_decision(%L, 'Edit rejected', '', 0, 0) $q$, current_setting('t.zero')), '55000',
  'a rejected case is locked for edits');
select pg_temp.check(pg_temp.budget() = pg_temp.b0() and pg_temp.target() = pg_temp.d0(), 'rejecting changes no totals');

select public.reopen_decision(current_setting('t.zero')::uuid);
select pg_temp.check(
  (select status = 'pending' and decided_at is null and decided_by is null and decision_reason = ''
     from public.decisions where id = current_setting('t.zero')::uuid), 'reopened: pending again, decision cleared');
select pg_temp.check(
  (select array_agg(kind::text order by id) from public.decision_events where decision_id = current_setting('t.zero')::uuid)
    = array['submitted', 'rejected', 'reopened'], 'the history keeps rejected and reopened');
select pg_temp.raises(format($q$ select public.reopen_decision(%L) $q$, current_setting('t.zero')), '55000', 'only a rejected case can be reopened');
select pg_temp.check(pg_temp.budget() = pg_temp.b0() and pg_temp.target() = pg_temp.d0(), 'reopening changes no totals');
select pg_temp.as_admin();
select pg_temp.check(
  (select count(*) from public.notifications where kind = 'decision_reopened' and entity_id = current_setting('t.zero')::uuid) = 2,
  'the clients are told about a reopen by the manager');

-- A client may reopen too.
select pg_temp.as_user('a0000000-0000-4000-8000-000000000003');
select public.reject_decision(current_setting('t.zero')::uuid, 'Changed my mind');
select public.reopen_decision(current_setting('t.zero')::uuid);
select pg_temp.check((select status = 'pending' from public.decisions where id = current_setting('t.zero')::uuid), 'a client can reopen as well');

-- ===========================================================================
-- Accepting needs the emailed code
-- ===========================================================================
select pg_temp.as_user('a0000000-0000-4000-8000-000000000002');
select pg_temp.check(public.accept_decision(current_setting('t.extra')::uuid, '123456') = 'no_code', 'no code issued: nothing happens');
select pg_temp.check((select status = 'pending' from public.decisions where id = current_setting('t.extra')::uuid), 'still pending');

-- Wrong codes count attempts (and the counter survives: no exception is raised).
select pg_temp.as_admin();
select pg_temp.issue_code(current_setting('t.extra')::uuid, 'a0000000-0000-4000-8000-000000000002', '654321');
select pg_temp.as_user('a0000000-0000-4000-8000-000000000002');
select pg_temp.check(public.accept_decision(current_setting('t.extra')::uuid, '000000') = 'invalid_code', 'a wrong code is refused');
select pg_temp.check(public.accept_decision(current_setting('t.extra')::uuid, '') = 'invalid_code', 'an empty code is refused');
select pg_temp.as_admin();
select pg_temp.check((select attempts = 2 from public.decision_confirmations where decision_id = current_setting('t.extra')::uuid), 'attempts are counted');
select pg_temp.check(pg_temp.budget() = pg_temp.b0(), 'wrong codes change no totals');

-- Another investor can't use Sarah's code.
select pg_temp.as_user('a0000000-0000-4000-8000-000000000003');
select pg_temp.check(public.accept_decision(current_setting('t.extra')::uuid, '654321') = 'no_code', 'a code is bound to its user');

-- Five wrong attempts burn the code, even for the right one afterwards.
select pg_temp.as_user('a0000000-0000-4000-8000-000000000002');
select public.accept_decision(current_setting('t.extra')::uuid, '000001');
select public.accept_decision(current_setting('t.extra')::uuid, '000002');
select pg_temp.check(public.accept_decision(current_setting('t.extra')::uuid, '000003') = 'too_many_attempts', 'the fifth wrong attempt burns the code');
select pg_temp.check(public.accept_decision(current_setting('t.extra')::uuid, '654321') = 'no_code', 'a burned code can''t be used, even if right');

-- Expired code.
select pg_temp.as_admin();
select pg_temp.issue_code(current_setting('t.extra')::uuid, 'a0000000-0000-4000-8000-000000000002', '111111', interval '-1 minute');
select pg_temp.as_user('a0000000-0000-4000-8000-000000000002');
select pg_temp.check(public.accept_decision(current_setting('t.extra')::uuid, '111111') = 'expired', 'an expired code is refused');
select pg_temp.check(public.accept_decision(current_setting('t.extra')::uuid, '111111') = 'no_code', 'and gone');

-- A new code supersedes the old one; an edit voids open codes.
select pg_temp.as_admin();
select pg_temp.issue_code(current_setting('t.extra')::uuid, 'a0000000-0000-4000-8000-000000000002', '222222');
select pg_temp.issue_code(current_setting('t.extra')::uuid, 'a0000000-0000-4000-8000-000000000002', '333333');
select pg_temp.check((select count(*) from public.decision_confirmations where decision_id = current_setting('t.extra')::uuid and consumed_at is null) = 1,
  'only the latest code stays open');
select pg_temp.as_user('a0000000-0000-4000-8000-000000000001');
select public.update_decision(current_setting('t.extra')::uuid, 'Extra socket', 'Changed after the code went out', 900, 4);
select pg_temp.as_admin();
select pg_temp.check((select count(*) from public.decision_confirmations where decision_id = current_setting('t.extra')::uuid and consumed_at is null) = 0,
  'an edit voids the open codes');

-- The hourly cap on issued codes: 4 so far for this case and user, a 5th is fine, the 6th is not.
select pg_temp.issue_code(current_setting('t.extra')::uuid, 'a0000000-0000-4000-8000-000000000002', '444444');
select pg_temp.check((select count(*) from public.decision_confirmations where decision_id = current_setting('t.extra')::uuid
  and user_id = 'a0000000-0000-4000-8000-000000000002') = 5, 'five codes issued');
select pg_temp.raises(
  format($q$ select pg_temp.issue_code(%L, 'a0000000-0000-4000-8000-000000000002', '555555') $q$, current_setting('t.extra')),
  '54000', 'at most 5 codes an hour per case and user');
update public.decision_confirmations set created_at = now() - interval '2 hours'
where decision_id = current_setting('t.extra')::uuid and user_id = 'a0000000-0000-4000-8000-000000000002';
select pg_temp.issue_code(current_setting('t.extra')::uuid, 'a0000000-0000-4000-8000-000000000002', '666666');

-- ===========================================================================
-- Accepting: atomic totals, negative deltas, idempotent, only accepted counts
-- ===========================================================================
-- At this point nothing was accepted: pending/question/rejected cases moved no totals.
select pg_temp.check(pg_temp.budget() = pg_temp.b0() and pg_temp.target() = pg_temp.d0(), 'only accepted cases count: totals untouched so far');

select pg_temp.as_user('a0000000-0000-4000-8000-000000000002');
select pg_temp.check(public.accept_decision(current_setting('t.extra')::uuid, '666666') = 'ok', 'the right code accepts');
select pg_temp.check(pg_temp.budget() = pg_temp.b0() + 900 and pg_temp.target() = pg_temp.d0() + 4, 'accepting adds cost_delta (900) and days_delta (4)');
select pg_temp.check(
  (select status = 'accepted' and decided_by = 'a0000000-0000-4000-8000-000000000002' and decided_at is not null
     from public.decisions where id = current_setting('t.extra')::uuid), 'accepted by the investor');

-- Double submit, and the other investor racing after: nothing is applied twice.
select pg_temp.check(public.accept_decision(current_setting('t.extra')::uuid, '666666') = 'already_accepted', 'a repeated submit is idempotent');
select pg_temp.as_user('a0000000-0000-4000-8000-000000000003');
select pg_temp.check(public.accept_decision(current_setting('t.extra')::uuid, '999999') = 'already_accepted', 'the other investor gets already_accepted');
select pg_temp.check(pg_temp.budget() = pg_temp.b0() + 900 and pg_temp.target() = pg_temp.d0() + 4, 'totals applied exactly once');
select pg_temp.as_admin();
select pg_temp.check((select count(*) from public.decision_events where decision_id = current_setting('t.extra')::uuid and kind = 'accepted') = 1,
  'one accepted event');
select pg_temp.check((select count(*) from public.decision_confirmations where decision_id = current_setting('t.extra')::uuid and consumed_at is null) = 0,
  'the code is single use');

-- Planned baseline is unchanged: the deviation display (#53/#54) now shows the difference.
select pg_temp.check(
  (select planned_budget = pg_temp.b0() and planned_target_date = pg_temp.d0() from public.projects where id = 'b0000000-0000-4000-8000-000000000001'),
  'the planned baseline stays; the current values moved');

-- Locked after the decision.
select pg_temp.as_user('a0000000-0000-4000-8000-000000000001');
select pg_temp.raises(format($q$ select public.update_decision(%L, 'Late edit', '', 0, 0) $q$, current_setting('t.extra')), '55000',
  'an accepted case is locked for edits');
select pg_temp.as_user('a0000000-0000-4000-8000-000000000002');
select pg_temp.raises(format($q$ select public.reject_decision(%L, 'too late') $q$, current_setting('t.extra')), '55000', 'accepted is final: no rejection');
select pg_temp.raises(format($q$ select public.ask_decision_question(%L, 'too late') $q$, current_setting('t.extra')), '55000', 'nor a question');
select pg_temp.raises(format($q$ select public.reopen_decision(%L) $q$, current_setting('t.extra')), '55000', 'nor a reopen');

-- A negative delta (savings) lowers the budget and pulls the end date in.
select pg_temp.as_admin();
select pg_temp.issue_code(current_setting('t.saving')::uuid, 'a0000000-0000-4000-8000-000000000003', '123123');
select pg_temp.as_user('a0000000-0000-4000-8000-000000000003');
select pg_temp.check(public.accept_decision(current_setting('t.saving')::uuid, '123123') = 'ok', 'accepting a saving works');
select pg_temp.check(pg_temp.budget() = pg_temp.b0() + 900 - 1200.50 and pg_temp.target() = pg_temp.d0() + 4 - 3, 'negative deltas: -1200.50 and -3 days');

-- The budget can't be pushed below zero; nothing is applied then and the code stays usable.
select pg_temp.as_user('a0000000-0000-4000-8000-000000000001');
select set_config('t.huge', public.create_decision('b0000000-0000-4000-8000-000000000001', 'Huge saving', '', -90000, 0,
  array['b0000000-0000-4000-8000-000000000001/decisions/e.jpg']::text[])::text, true);
select pg_temp.as_admin();
select pg_temp.issue_code(current_setting('t.huge')::uuid, 'a0000000-0000-4000-8000-000000000002', '777777');
select pg_temp.as_user('a0000000-0000-4000-8000-000000000002');
select pg_temp.raises(format($q$ select public.accept_decision(%L, '777777') $q$, current_setting('t.huge')), '23514',
  'a negative budget is refused');
select pg_temp.check(pg_temp.budget() = pg_temp.b0() + 900 - 1200.50, 'and nothing was applied');
select pg_temp.check((select status = 'pending' from public.decisions where id = current_setting('t.huge')::uuid), 'the case stays open');

-- A project without an end date keeps it unset (days can't be applied).
select pg_temp.as_admin();
update public.projects set target_date = null where id = 'b0000000-0000-4000-8000-000000000001';
select pg_temp.as_user('a0000000-0000-4000-8000-000000000001');
select set_config('t.nodate', public.create_decision('b0000000-0000-4000-8000-000000000001', 'No end date', '', 10, 5,
  array['b0000000-0000-4000-8000-000000000001/decisions/g.jpg']::text[])::text, true);
select pg_temp.as_admin();
select pg_temp.issue_code(current_setting('t.nodate')::uuid, 'a0000000-0000-4000-8000-000000000002', '888888');
select pg_temp.as_user('a0000000-0000-4000-8000-000000000002');
select pg_temp.check(public.accept_decision(current_setting('t.nodate')::uuid, '888888') = 'ok', 'accepting without an end date works');
select pg_temp.check(pg_temp.target() is null and pg_temp.budget() = pg_temp.b0() + 900 - 1200.50 + 10, 'budget moves, a missing end date stays missing');

-- ===========================================================================
-- History is append-only
-- ===========================================================================
select pg_temp.as_admin();
select pg_temp.raises($q$ update public.decision_events set text = 'tampered' $q$, '55000', 'events can''t be updated, even by the owner');

select 'investor decisions tests passed';
rollback;
