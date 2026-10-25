-- Invites (T40): the accept step and what the invite server functions need.
--
--   invitations_open_idx                  at most one open (not accepted, not revoked) invitation per project and email;
--                                         resending updates that row (a new token hash and expiry)
--   public.accept_invitation(...)         the invitee, signed in through the invite link: saves their name, language
--                                         and privacy consent, makes a manager invite's account staff and a manager
--                                         of the project, and marks the invitation accepted. Client access needs
--                                         nothing here: T35's auth.users trigger already granted it by email.
--   public.invite_account_state(email)    service_role only: whether an account uses the email and whether it was
--                                         ever confirmed, invited or signed in (the server's "can we invite?" and
--                                         "can a revoke remove the unused account?" checks)
--
-- invitations.token_hash is sha256(hex) of the token in the invite link (`?token_hash=`, gotrue's hashed invite
-- token). The link's token is never stored by the app.
--
-- Errors carry a stable `hint` the UI maps to a message:
--   invite_invalid (P0002), invite_revoked (22023), invite_used (22023), invite_expired (22023),
--   invite_email_mismatch (42501), invite_name_required (22023), invite_locale_invalid (22023),
--   consent_required (22023), manager_is_project_client (23514), not_signed_in (42501).

-- ---------------------------------------------------------------------------
-- 1. One open invitation per project and email
-- ---------------------------------------------------------------------------
create unique index invitations_open_idx on public.invitations (project_id, email)
  where accepted_at is null and revoked_at is null;

-- ---------------------------------------------------------------------------
-- 2. Accepting an invitation (as the invitee)
-- ---------------------------------------------------------------------------
create or replace function public.accept_invitation(
  p_token text, p_full_name text, p_locale text, p_privacy_version text
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_inv public.invitations;
  v_email text;
  v_name text := btrim(coalesce(p_full_name, ''));
  v_version text := btrim(coalesce(p_privacy_version, ''));
begin
  if v_uid is null then
    raise exception 'Sign in through the invite link first' using errcode = '42501', hint = 'not_signed_in';
  end if;

  select i.* into v_inv from public.invitations i
  where i.token_hash = encode(sha256(convert_to(coalesce(p_token, ''), 'UTF8')), 'hex')
  for update;
  if not found or nullif(btrim(coalesce(p_token, '')), '') is null then
    raise exception 'This invitation link is not valid' using errcode = 'P0002', hint = 'invite_invalid';
  end if;
  if v_inv.revoked_at is not null then
    raise exception 'This invitation was withdrawn' using errcode = '22023', hint = 'invite_revoked';
  end if;
  if v_inv.accepted_at is not null then
    raise exception 'This invitation was already accepted' using errcode = '22023', hint = 'invite_used';
  end if;
  if v_inv.expires_at <= now() then
    raise exception 'This invitation has expired' using errcode = '22023', hint = 'invite_expired';
  end if;

  select lower(u.email) into v_email from auth.users u where u.id = v_uid;
  if v_email is distinct from v_inv.email then
    raise exception 'This invitation is for another email address' using errcode = '42501', hint = 'invite_email_mismatch';
  end if;

  if length(v_name) = 0 or length(v_name) > 120 then
    raise exception 'Your name is required' using errcode = '22023', hint = 'invite_name_required';
  end if;
  if p_locale is null or p_locale not in ('en', 'pl') then
    raise exception 'Unknown language %', p_locale using errcode = '22023', hint = 'invite_locale_invalid';
  end if;
  if length(v_version) = 0 or length(v_version) > 40 then
    raise exception 'The privacy policy must be accepted' using errcode = '22023', hint = 'consent_required';
  end if;

  update public.profiles set full_name = v_name, locale = p_locale where id = v_uid;
  insert into public.consents (user_id, kind, version) values (v_uid, 'privacy_policy', v_version)
  on conflict (user_id, kind, version) do nothing;

  if v_inv.role = 'manager' then
    -- Only staff may invite managers (the server checks it when inviting); re-checked here in case the inviter
    -- lost their manager account since.
    if v_inv.invited_by is null or not private.is_staff(v_inv.invited_by) then
      raise exception 'This invitation is no longer valid' using errcode = 'P0002', hint = 'invite_invalid';
    end if;
    if v_inv.project_id is not null and exists (
      select 1 from public.project_contacts pc
      where pc.project_id = v_inv.project_id and pc.role = 'client' and private.client_account(pc.contact_id) = v_uid
    ) then
      raise exception 'This person is the project''s client, so they can''t manage it'
        using errcode = '23514', hint = 'manager_is_project_client';
    end if;
    update public.profiles set account_type = 'admin' where id = v_uid;
    if v_inv.project_id is not null then
      insert into public.project_members (project_id, user_id, role)
      values (v_inv.project_id, v_uid, 'manager')
      on conflict (project_id, user_id) do update set role = 'manager';
    end if;
  end if;

  update public.invitations set accepted_at = now() where id = v_inv.id;

  -- Where to land: the project, once the invitee can open it (a client's access follows the client contact).
  return (
    select m.project_id from public.project_members m
    where m.project_id = v_inv.project_id and m.user_id = v_uid
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. The account behind an email, for the server (service_role) only
-- ---------------------------------------------------------------------------
create or replace function public.invite_account_state(p_email text)
returns table (user_id uuid, confirmed boolean, invited boolean, signed_in boolean)
language sql stable security definer set search_path = '' as $$
  select u.id, u.email_confirmed_at is not null, u.invited_at is not null, u.last_sign_in_at is not null
  from auth.users u
  where nullif(lower(btrim(p_email)), '') is not null and lower(u.email) = lower(btrim(p_email))
  order by u.created_at
  limit 1;
$$;

-- ---------------------------------------------------------------------------
-- 4. Privileges (explicit, per function)
-- ---------------------------------------------------------------------------
revoke execute on function public.accept_invitation(text, text, text, text) from public, anon;
grant execute on function public.accept_invitation(text, text, text, text) to authenticated;

revoke execute on function public.invite_account_state(text) from public, anon, authenticated;
grant execute on function public.invite_account_state(text) to service_role;
