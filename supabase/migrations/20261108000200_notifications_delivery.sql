-- Notification emails (T41): how the email jobs claim the notifications they send, and an index on the rows still
-- waiting for one. The jobs (src/server/notifications/*, run by the 5-minute cron in src/server.ts) call this with
-- the admin client:
--
--   instant  every run: rows of the last 24 hours whose effective email frequency is `instant`
--   daily    every run: rows created before the latest 07:00 Europe/Warsaw whose frequency is `daily`, one digest per
--            recipient (in practice the 07:00 run sends them all; later runs only pick up an overflow)
--
-- The claim sets `emailed_at` under `for update skip locked` before anything is sent, so overlapping runs never pick
-- the same row and a crash after the claim never sends twice (at most once, like the T61 reminder). The kinds the
-- change-request server functions email themselves (T61) are passed in `p_skip_kinds` and never claimed; the other
-- change-request kinds are passed in `p_instant_kinds`: emailed at once whatever the preferences. Both lists live in
-- src/features/comms/domain/delivery.ts.
--
-- No private.log_activity change, no blanket revoke: one new function, granted to service_role only.

create index if not exists notifications_unemailed_idx on public.notifications (created_at) where emailed_at is null;

create function public.claim_notification_emails(
  p_frequency public.notification_frequency,
  p_since timestamptz,
  p_until timestamptz,
  p_recipients integer,
  p_skip_kinds text[] default '{}',
  p_instant_kinds text[] default '{}'
) returns setof public.notifications
language plpgsql security invoker set search_path = '' as $$
begin
  if p_frequency is distinct from 'instant' and p_frequency is distinct from 'daily' then
    raise exception 'Only instant or daily notification emails can be claimed' using errcode = '22023';
  end if;
  return query
  with eligible as (
    select n.id, n.recipient_id, n.created_at
    from public.notifications n
    where n.emailed_at is null
      and n.created_at >= p_since and n.created_at < p_until
      and n.kind <> all (coalesce(p_skip_kinds, '{}'))
      and case
            when n.kind = any (coalesce(p_instant_kinds, '{}')) then 'instant'::public.notification_frequency
            else public.notification_pref(n.recipient_id, n.kind, 'email')
          end = p_frequency
  ),
  -- The recipients waiting longest come first; every eligible row of a chosen recipient goes into the same run.
  recipients as (
    select e.recipient_id from eligible e
    group by e.recipient_id
    order by min(e.created_at), e.recipient_id
    limit greatest(coalesce(p_recipients, 0), 0)
  ),
  picked as (
    select n.id from public.notifications n
    where n.id in (select e.id from eligible e join recipients r on r.recipient_id = e.recipient_id)
      and n.emailed_at is null
    for update skip locked
  ),
  claimed as (
    update public.notifications n set emailed_at = now()
    from picked where n.id = picked.id
    returning n.*
  )
  select * from claimed;
end;
$$;

comment on function public.claim_notification_emails(
  public.notification_frequency, timestamptz, timestamptz, integer, text[], text[]
) is 'T41 email jobs (service role): claims (sets emailed_at on) the unemailed notifications of up to p_recipients '
     'recipients whose effective email frequency is p_frequency, created in [p_since, p_until).';

revoke execute on function public.claim_notification_emails(
  public.notification_frequency, timestamptz, timestamptz, integer, text[], text[]
) from public, anon, authenticated;
grant execute on function public.claim_notification_emails(
  public.notification_frequency, timestamptz, timestamptz, integer, text[], text[]
) to service_role;
