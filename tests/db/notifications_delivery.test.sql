-- Notification emails (T41): public.claim_notification_emails picks by effective email frequency, skips the kinds
-- the change-request functions email themselves, forces the other change-request kinds to instant, caps the number
-- of recipients, never claims a row twice, and is the service role's only.
-- Run against a seeded database (everything is rolled back): bun run test:db, or directly with psql.
-- Prints "notifications delivery tests passed" on success; any failed assertion aborts with an error.
--
--   Jonas  a0…01  manager of Maple Street (b0…01): email defaults to off
--   Sarah  a0…02  client: email defaults to daily
--   Tom    a0…03  client: email defaults to daily
-- Every notification already in the database is marked emailed first, so only the rows written here count.

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

create or replace function pg_temp.as_service() returns void language plpgsql as $$
begin
  perform set_config('role', 'service_role', true);
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claims', json_build_object('role', 'service_role')::text, true);
end $$;

create or replace function pg_temp.check(ok boolean, what text) returns void language plpgsql as $$
begin
  if not coalesce(ok, false) then raise exception 'FAILED: %', what; end if;
end $$;

-- Fails unless `sql` raises the given SQLSTATE.
create or replace function pg_temp.raises(sql text, code text, what text) returns void language plpgsql as $$
begin
  execute sql;
  raise exception 'FAILED: %', what;
exception when others then
  if sqlstate <> code then raise exception 'FAILED: % (got % %)', what, sqlstate, sqlerrm; end if;
end $$;

-- A notification for `p_user`, `p_minutes` ago.
create or replace function pg_temp.notify(p_user uuid, p_kind text, p_minutes int) returns uuid language sql as $$
  insert into public.notifications (project_id, recipient_id, kind, params, title, created_at)
  values ('b0000000-0000-4000-8000-000000000001', p_user, p_kind, '{}'::jsonb, p_kind, now() - make_interval(mins => p_minutes))
  returning id;
$$;

-- The rows a claim returned, as "<recipient last digit>:<kind>" sorted, for readable assertions.
create temp table claimed (id uuid, recipient_id uuid, kind text);
create or replace function pg_temp.claim(
  p_frequency public.notification_frequency, p_recipients int default 50,
  p_since timestamptz default now() - interval '1 day', p_until timestamptz default now() + interval '1 minute'
) returns int language plpgsql as $$
declare n int;
begin
  truncate claimed;
  insert into claimed
  select c.id, c.recipient_id, c.kind
  from public.claim_notification_emails(
    p_frequency, p_since, p_until, p_recipients,
    array['decision_new', 'decision_accepted', 'decision_reminder'],
    array['decision_rejected', 'decision_reopened']) c;
  get diagnostics n = row_count;
  return n;
end $$;

grant all on table claimed to service_role, authenticated;

-- Start from a clean slate: the seed media upload publishes photos, which notifies the clients at reset time.
update public.notifications set emailed_at = now() where emailed_at is null;

-- Tom wants photos instantly and stage updates never; Sarah keeps the defaults (daily).
insert into public.notification_preferences (user_id, kind, channel, frequency) values
  ('a0000000-0000-4000-8000-000000000003', 'photo_published', 'email', 'instant'),
  ('a0000000-0000-4000-8000-000000000003', 'stage_status', 'email', 'off');

select pg_temp.notify('a0000000-0000-4000-8000-000000000003', 'photo_published', 30);   -- Tom: instant
select pg_temp.notify('a0000000-0000-4000-8000-000000000003', 'stage_status', 29);      -- Tom: off
select pg_temp.notify('a0000000-0000-4000-8000-000000000003', 'document_new', 28);      -- Tom: daily (default)
select pg_temp.notify('a0000000-0000-4000-8000-000000000002', 'photo_published', 27);   -- Sarah: daily (default)
select pg_temp.notify('a0000000-0000-4000-8000-000000000002', 'decision_new', 26);      -- emailed by T61: skipped
select pg_temp.notify('a0000000-0000-4000-8000-000000000002', 'decision_reminder', 25); -- emailed by T61: skipped
select pg_temp.notify('a0000000-0000-4000-8000-000000000002', 'decision_reopened', 24); -- always instant
select pg_temp.notify('a0000000-0000-4000-8000-000000000001', 'decision_rejected', 23); -- Jonas (off): always instant
select pg_temp.notify('a0000000-0000-4000-8000-000000000001', 'decision_accepted', 22); -- emailed by T61: skipped
select pg_temp.notify('a0000000-0000-4000-8000-000000000003', 'photo_published', 60 * 30); -- Tom: instant, too old

-- ===========================================================================
-- Grants: the service role only
-- ===========================================================================
select pg_temp.check(
  has_function_privilege('service_role',
    'public.claim_notification_emails(public.notification_frequency, timestamptz, timestamptz, integer, text[], text[])', 'EXECUTE')
  and not has_function_privilege('authenticated',
    'public.claim_notification_emails(public.notification_frequency, timestamptz, timestamptz, integer, text[], text[])', 'EXECUTE')
  and not has_function_privilege('anon',
    'public.claim_notification_emails(public.notification_frequency, timestamptz, timestamptz, integer, text[], text[])', 'EXECUTE'),
  'claim_notification_emails is executable by service_role only');

select pg_temp.as_user('a0000000-0000-4000-8000-000000000002');
select pg_temp.raises($q$ select pg_temp.claim('instant') $q$, '42501', 'a signed-in user can''t claim emails');
select pg_temp.as_service();
select pg_temp.raises($q$ select pg_temp.claim('off') $q$, '22023', '"off" is not a claimable frequency');

-- ===========================================================================
-- Instant
-- ===========================================================================
select pg_temp.check(pg_temp.claim('instant') = 3, 'instant claims 3 rows');
select pg_temp.check(
  (select string_agg(right(recipient_id::text, 1) || ':' || kind, ',' order by recipient_id, kind) from claimed)
    = '1:decision_rejected,2:decision_reopened,3:photo_published',
  'instant: Tom''s instant photo and the forced change-request kinds (whatever the preference), nothing T61 emails');
select pg_temp.check(
  (select count(*) from public.notifications n join claimed c using (id) where n.emailed_at is not null) = 3,
  'the claimed rows are marked emailed');
select pg_temp.check(pg_temp.claim('instant') = 0, 'a second run claims nothing: no row is sent twice');

-- ===========================================================================
-- Daily
-- ===========================================================================
select pg_temp.check(pg_temp.claim('daily') = 2, 'daily claims 2 rows');
select pg_temp.check(
  (select string_agg(right(recipient_id::text, 1) || ':' || kind, ',' order by recipient_id, kind) from claimed)
    = '2:photo_published,3:document_new',
  'daily: the default-daily rows of both clients; not Tom''s "off" stage update, not T61''s kinds');
select pg_temp.check(pg_temp.claim('daily') = 0, 'a second digest run claims nothing');

select pg_temp.check(
  (select count(*) from public.notifications
   where emailed_at is null and created_at > now() - interval '1 hour'
     and kind in ('decision_new', 'decision_reminder', 'decision_accepted', 'stage_status')) = 4,
  'T61''s kinds and the "off" row stay unclaimed');

-- ===========================================================================
-- The window and the recipient cap
-- ===========================================================================
select pg_temp.check(pg_temp.claim('instant', 50, now() - interval '31 hours') = 1,
  'a wider window picks up the older instant row');

select pg_temp.as_admin();
select pg_temp.notify('a0000000-0000-4000-8000-000000000002', 'document_new', 12);
select pg_temp.notify('a0000000-0000-4000-8000-000000000002', 'render_published', 11);
select pg_temp.notify('a0000000-0000-4000-8000-000000000003', 'document_new', 10);
select pg_temp.notify('a0000000-0000-4000-8000-000000000003', 'document_new', 2);
select pg_temp.as_service();

select pg_temp.check(pg_temp.claim('daily', 50, now() - interval '1 day', now() - interval '5 minutes') = 3,
  'rows created after p_until wait for the next digest');
select pg_temp.check(pg_temp.claim('daily', 50) = 1, 'and are claimed once the window includes them');

select pg_temp.as_admin();
select pg_temp.notify('a0000000-0000-4000-8000-000000000002', 'document_new', 9);
select pg_temp.notify('a0000000-0000-4000-8000-000000000002', 'manual', 8);
select pg_temp.notify('a0000000-0000-4000-8000-000000000003', 'manual', 7);
select pg_temp.as_service();

select pg_temp.check(pg_temp.claim('daily', 1) = 2, 'one recipient per run: all of the longest-waiting one''s rows');
select pg_temp.check((select bool_and(recipient_id = 'a0000000-0000-4000-8000-000000000002') from claimed),
  'Sarah waited longest');
select pg_temp.check(pg_temp.claim('daily', 1) = 1, 'the next run takes the next recipient');
select pg_temp.check(pg_temp.claim('daily', 0) = 0, 'a cap of 0 claims nothing');

select 'notifications delivery tests passed';
rollback;
