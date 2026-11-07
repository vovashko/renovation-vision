-- One open invitation per email, across projects (T70). Replaces T40's per-project index.
--
-- gotrue keeps a single invite token per account: a second invite link for the same email silently breaks the
-- first, so an email can only have one live invitation anyway. The invite server function decides what a new
-- invite does to the email's open one (re-send it, or refuse; see inviteDecision in features/people/domain/invites.ts).
--
--   invitations_open_email_idx   at most one open (not accepted, not revoked) invitation per email
--
-- Existing duplicates (the same email open in several projects) keep the newest invitation (the latest expiry, which
-- every send renews); the older ones are withdrawn: their links already stopped working when the newer one was sent.

update public.invitations i set revoked_at = now()
from (
  select id, row_number() over (partition by email order by expires_at desc, created_at desc, id) as n
  from public.invitations
  where accepted_at is null and revoked_at is null
) ranked
where i.id = ranked.id and ranked.n > 1;

drop index if exists public.invitations_open_idx;
create unique index invitations_open_email_idx on public.invitations (email)
  where accepted_at is null and revoked_at is null;
