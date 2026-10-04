-- Seed data sanity checks: the demo accounts can actually sign in, and the
-- seeded timeline is anchored on today rather than a hardcoded date.
-- Run as part of `bun run test:db` (see tests/db/README.md).

begin;

create or replace function pg_temp.check(ok boolean, what text) returns void language plpgsql as $$
begin
  if not coalesce(ok, false) then raise exception 'FAILED: %', what; end if;
end $$;

-- ---------------------------------------------------------------------------
-- Demo accounts: correct role, a usable password, confirmed email, and the
-- auth.identities row the current GoTrue needs for password sign-in.
-- ---------------------------------------------------------------------------
select pg_temp.check(
  (select account_type from public.profiles where id = 'a0000000-0000-4000-8000-000000000001') = 'manager',
  'Jonas is a manager'
);
select pg_temp.check(
  (select account_type from public.profiles where id = 'a0000000-0000-4000-8000-000000000002') = 'client',
  'Sarah is a client'
);
select pg_temp.check(
  (select account_type from public.profiles where id = 'a0000000-0000-4000-8000-000000000003') = 'client',
  'Tom is a client'
);
select pg_temp.check(
  (select account_type from public.profiles where id = 'a0000000-0000-4000-8000-000000000004') = 'admin',
  'the demo admin is an admin'
);
-- The local/demo seed turns staff 2FA enforcement off (the demo manager has no TOTP factor).
select pg_temp.check(
  (select enforce_staff_mfa from private.app_settings) = false,
  'seed turns staff 2FA enforcement off'
);

do $$
declare
  u record;
begin
  for u in
    select id, email from auth.users
    where email in ('jonas@renovision.demo', 'sarah@renovision.demo', 'tom@renovision.demo', 'admin@renovision.demo')
  loop
    perform pg_temp.check(
      (select encrypted_password from auth.users where id = u.id) = extensions.crypt('renovision-demo-2026', (select encrypted_password from auth.users where id = u.id)),
      u.email || ': password is renovision-demo-2026'
    );
    perform pg_temp.check(
      (select email_confirmed_at from auth.users where id = u.id) is not null,
      u.email || ': email is confirmed'
    );
    perform pg_temp.check(
      (select aud from auth.users where id = u.id) = 'authenticated' and (select role from auth.users where id = u.id) = 'authenticated',
      u.email || ': aud/role are authenticated'
    );
    perform pg_temp.check(
      exists (select 1 from auth.identities i where i.user_id = u.id and i.provider = 'email'),
      u.email || ': has an email identity'
    );
  end loop;
  perform pg_temp.check(
    (select count(*) from auth.users where email like '%@renovision.demo') = 4,
    'all 4 demo accounts exist'
  );
end $$;

-- ---------------------------------------------------------------------------
-- Dates are relative to current_date (Steps 4 in T02): the timeline keeps its
-- shape, so the in-progress stage still straddles "today" and nothing that
-- was on-time now reads as late just because time passed.
-- ---------------------------------------------------------------------------
select pg_temp.check(
  (select status from public.stages where key = 'wall') = 'progress',
  'Walls & Insulation is still in progress'
);
select pg_temp.check(
  (select start_date from public.stages where key = 'wall') <= current_date
  and (select end_date from public.stages where key = 'wall') >= current_date,
  'Walls & Insulation spans current_date'
);
select pg_temp.check(
  (select end_date from public.stages where key = 'demo') < current_date
  and (select status from public.stages where key = 'demo') = 'done',
  'Demolition is done and behind current_date'
);
select pg_temp.check(
  (select start_date from public.stages where key = 'final') > current_date
  and (select status from public.stages where key = 'final') = 'pending',
  'Final Inspection is still ahead of current_date'
);
select pg_temp.check(
  (select target_date from public.projects where id = 'b0000000-0000-4000-8000-000000000001') > current_date,
  'the project target date is still ahead of current_date'
);

-- Site diary and plan image (T32): a mix of visible and internal entries, dated around today; no plan image.
select pg_temp.check(
  (select count(*) from public.progress_entries) = 5 and (select count(*) from public.progress_entries where is_visible) = 3,
  'the diary has 5 entries, 3 visible to the client'
);
select pg_temp.check(
  (select max(entry_date) from public.progress_entries) = current_date,
  'the latest diary entry is dated today'
);
select pg_temp.check(
  (select plan_image_path from public.projects where id = 'b0000000-0000-4000-8000-000000000001') is null,
  'the demo project has no plan image'
);

-- Client access (T35): the client contact carries Sarah's login and is linked to her; Tom is an extra login.
select pg_temp.check(
  (select email = 'sarah@renovision.demo' and user_id = 'a0000000-0000-4000-8000-000000000002'
     from public.contacts where id = '10000000-0000-4000-8000-000000000002'),
  'the client contact is linked to Sarah''s account');
select pg_temp.check(
  (select count(*) from public.project_members where project_id = 'b0000000-0000-4000-8000-000000000001' and role = 'client') = 2,
  'Sarah and Tom are the demo project''s clients');

select 'seed tests passed' as result;
rollback;
