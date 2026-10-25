-- T61: change requests. The bug-bash "investor decisions" (#55) become the owner's simpler model: the manager
-- asks the client to approve a change to the budget and/or the end date, the client approves or rejects it.
-- The tables keep their names (`decisions`, `decision_events`); the app calls them "change requests".
--
-- Removed:
--   * the question step: ask_decision_question / answer_decision_question (questions go to WhatsApp). Rows in
--     `question` go back to `pending`; the enum value stays, unused (dropping an enum value means rebuilding
--     the type). The `question`/`answer` event kinds stay for the history already written.
--   * the emailed confirmation code: decision_confirmations, its trigger, private.decision_invalidate_codes
--     and accept_decision(uuid, text). Approving is a confirm dialog that spells out the impact.
--   * photos: decision_photos, private.decision_add_photos and the "media: clients read decision photos"
--     storage policy (the supporting estimate goes to Documents). Objects already uploaded under
--     <project>/decisions/ are left in the bucket; managers still reach them, clients no longer do.
--
-- Added:
--   * decisions.stage_id: an optional link to a stage of the same project (on delete set null).
--   * decisions.pending_since / reminded_at: when the request started waiting for the client (create and
--     reopen) and when the one reminder went out (cleared on reopen). The hourly cron (src/server.ts →
--     src/server/jobs/change-request-reminders.server.ts) calls public.remind_decision with the admin client.
--   * `decision_accepted` (to the managers) and `decision_reminder` (to the clients) notifications.
--   * Staff 2FA: create_decision, update_decision and a manager's reopen_decision require
--     private.staff_mfa_ok(), like set_project_client.
--
-- A request must change something: cost_delta and days_delta can't both be 0. That is checked by the write
-- functions (hint `no_change`), not by a table check, so the zero-impact cases written before stay decidable.
--
-- private.log_activity is not touched, and no blanket revoke on schema private is made.

-- ---------------------------------------------------------------------------
-- Removed: the question step, the confirmation codes, the photos
-- ---------------------------------------------------------------------------
drop function public.ask_decision_question(uuid, text);
drop function public.answer_decision_question(uuid, text);
drop function public.accept_decision(uuid, text);
drop function public.create_decision(uuid, text, text, numeric, integer, text[]);
drop function public.update_decision(uuid, text, text, numeric, integer, text[], uuid[]);

drop table public.decision_confirmations; -- its trigger goes with it
drop function private.decision_confirmations_before_insert();
drop function private.decision_invalidate_codes(uuid);

drop policy "media: clients read decision photos" on storage.objects;
drop table public.decision_photos;
drop function private.decision_add_photos(uuid, uuid, text[]);

-- Open questions go back to awaiting the client's decision.
update public.decisions set status = 'pending' where status = 'question';

-- ---------------------------------------------------------------------------
-- New columns
-- ---------------------------------------------------------------------------
alter table public.decisions
  add column stage_id uuid references public.stages (id) on delete set null,
  add column pending_since timestamptz,
  add column reminded_at timestamptz;

comment on column public.decisions.stage_id is 'Optional: the stage this change request unblocks (same project). Approving doesn''t change the stage.';
comment on column public.decisions.pending_since is 'When the request started waiting for the client (set on create and reopen; null once decided).';
comment on column public.decisions.reminded_at is 'When the one 24-hour reminder went out; cleared on reopen.';

-- Existing pending requests wait since their latest reopen, or since they were submitted.
update public.decisions d
set pending_since = coalesce(
      (select max(e.created_at) from public.decision_events e where e.decision_id = d.id and e.kind = 'reopened'),
      d.created_at)
where d.status = 'pending';

create index decisions_stage_idx on public.decisions (stage_id) where stage_id is not null;
-- The reminder cron's lookup.
create index decisions_reminder_due_idx on public.decisions (pending_since) where status = 'pending' and reminded_at is null;

-- The linked stage must belong to the request's project (nobody writes the table directly, but the check
-- holds for any writer, migrations and the admin client included).
create or replace function private.decisions_stage_same_project()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.stage_id is not null
     and not exists (select 1 from public.stages s where s.id = new.stage_id and s.project_id = new.project_id) then
    raise exception 'The stage belongs to another project' using errcode = '22023', hint = 'stage_other_project';
  end if;
  return new;
end;
$$;
create trigger decisions_stage_same_project before insert or update of stage_id, project_id on public.decisions
for each row execute function private.decisions_stage_same_project();

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
-- In-app notification to every member of `p_role` (except the caller). The link is where the request is
-- listed: Budget for a cost change, Progress for a days-only change.
create or replace function private.decision_notify(
  p_project uuid, p_role public.project_role, p_kind text, p_decision uuid, p_title text, p_text text default ''
) returns void language sql security definer set search_path = '' as $$
  insert into public.notifications (project_id, recipient_id, kind, params, title, body, link, entity_type, entity_id, created_by)
  select p_project, m.user_id, p_kind, jsonb_build_object('title', p_title, 'text', coalesce(p_text, '')),
         p_title, left(coalesce(p_text, ''), 280),
         (select case when d.cost_delta = 0 and d.days_delta <> 0 then '/progress' else '/budget' end
            from public.decisions d where d.id = p_decision),
         'decisions', p_decision, auth.uid()
  from public.project_members m
  where m.project_id = p_project and m.role = p_role and m.user_id is distinct from auth.uid();
$$;

-- The request's fields, validated the same way for create and update.
create or replace function private.decision_check_input(p_cost_delta numeric, p_days_delta integer)
returns void language plpgsql immutable set search_path = '' as $$
begin
  if coalesce(p_cost_delta, 0) = 0 and coalesce(p_days_delta, 0) = 0 then
    raise exception 'A change request must change the cost or the days' using errcode = '22023', hint = 'no_change';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Manager: create / edit (2FA)
-- ---------------------------------------------------------------------------
create or replace function public.create_decision(
  p_project uuid, p_title text, p_description text, p_cost_delta numeric, p_days_delta integer, p_stage uuid default null
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
  v_title text := btrim(coalesce(p_title, ''));
begin
  if (select auth.uid()) is null or not public.is_project_manager(p_project) then
    raise exception 'Only the project''s managers can submit a change request' using errcode = '42501';
  end if;
  if not private.staff_mfa_ok() then
    raise exception 'Two-factor verification required' using errcode = '42501', hint = 'mfa_required';
  end if;
  perform private.decision_check_input(p_cost_delta, p_days_delta);

  insert into public.decisions (project_id, title, description, cost_delta, days_delta, stage_id, created_by, pending_since)
  values (p_project, v_title, coalesce(p_description, ''), coalesce(p_cost_delta, 0), coalesce(p_days_delta, 0), p_stage,
          auth.uid(), now())
  returning id into v_id;

  perform private.decision_event(v_id, p_project, 'submitted', '');
  perform private.decision_notify(p_project, 'client', 'decision_new', v_id, v_title);
  return v_id;
end;
$$;

-- Edit a request while it is pending. A decided request is locked: submit a new one.
create or replace function public.update_decision(
  p_decision uuid, p_title text, p_description text, p_cost_delta numeric, p_days_delta integer, p_stage uuid default null
) returns void language plpgsql security definer set search_path = '' as $$
declare
  d public.decisions%rowtype;
begin
  select * into d from public.decisions where id = p_decision for update;
  if not found or (select auth.uid()) is null or not public.is_project_manager(d.project_id) then
    raise exception 'Only the project''s managers can edit a change request' using errcode = '42501';
  end if;
  if not private.staff_mfa_ok() then
    raise exception 'Two-factor verification required' using errcode = '42501', hint = 'mfa_required';
  end if;
  if d.status <> 'pending' then
    raise exception 'A decided change request is locked; submit a new one' using errcode = '55000', hint = 'decision_locked';
  end if;
  perform private.decision_check_input(p_cost_delta, p_days_delta);

  update public.decisions
  set title = btrim(coalesce(p_title, '')), description = coalesce(p_description, ''),
      cost_delta = coalesce(p_cost_delta, 0), days_delta = coalesce(p_days_delta, 0), stage_id = p_stage
  where id = p_decision;

  perform private.decision_event(p_decision, d.project_id, 'edited', '');
end;
$$;

-- ---------------------------------------------------------------------------
-- Client: reject / approve
-- ---------------------------------------------------------------------------
create or replace function public.reject_decision(p_decision uuid, p_reason text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  d public.decisions%rowtype;
  v_reason text := btrim(coalesce(p_reason, ''));
begin
  select * into d from public.decisions where id = p_decision for update;
  if not found or (select auth.uid()) is null or not public.is_project_client(d.project_id) then
    raise exception 'Only the project''s client can reject a change request' using errcode = '42501';
  end if;
  if d.status <> 'pending' then
    raise exception 'This change request can no longer be rejected' using errcode = '55000', hint = 'decision_locked';
  end if;
  if v_reason = '' or length(v_reason) > 2000 then
    raise exception 'A reason is required (up to 2000 characters)' using errcode = '22023', hint = 'reason_required';
  end if;

  update public.decisions
  set status = 'rejected', decided_by = auth.uid(), decided_at = now(), decision_reason = v_reason, pending_since = null
  where id = p_decision;
  perform private.decision_event(p_decision, d.project_id, 'rejected', v_reason);
  perform private.decision_notify(d.project_id, 'manager', 'decision_rejected', p_decision, d.title, v_reason);
end;
$$;

-- Approve a request. Returns ok | already_accepted | not_open. The row lock serializes a double click and two
-- clients approving at once: the second one sees 'already_accepted' and nothing is applied twice.
-- Raises 42501 (not the project's client) and 23514 (hint budget_negative: the budget would drop below zero).
create or replace function public.accept_decision(p_decision uuid)
returns text language plpgsql security definer set search_path = '' as $$
declare
  d public.decisions%rowtype;
  v_uid uuid := (select auth.uid());
begin
  select * into d from public.decisions where id = p_decision for update;
  if not found or v_uid is null or not public.is_project_client(d.project_id) then
    raise exception 'Only the project''s client can approve a change request' using errcode = '42501';
  end if;
  if d.status = 'accepted' then
    return 'already_accepted'; -- idempotent: the totals were applied exactly once
  end if;
  if d.status <> 'pending' then
    return 'not_open';
  end if;
  if (select p.budget from public.projects p where p.id = d.project_id) + d.cost_delta < 0 then
    raise exception 'The budget can''t drop below zero' using errcode = '23514', hint = 'budget_negative';
  end if;

  update public.decisions set status = 'accepted', decided_by = v_uid, decided_at = now(), pending_since = null
  where id = p_decision;
  update public.projects
  set budget = budget + d.cost_delta,
      target_date = case when target_date is null then null else target_date + d.days_delta end
  where id = d.project_id;
  perform private.decision_event(p_decision, d.project_id, 'accepted', '');
  perform private.decision_notify(d.project_id, 'manager', 'decision_accepted', p_decision, d.title);
  return 'ok';
end;
$$;

-- ---------------------------------------------------------------------------
-- Either side: reopen a rejected request (a manager needs 2FA)
-- ---------------------------------------------------------------------------
create or replace function public.reopen_decision(p_decision uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  d public.decisions%rowtype;
  v_manager boolean;
begin
  select * into d from public.decisions where id = p_decision for update;
  if not found or (select auth.uid()) is null or not public.is_project_member(d.project_id) then
    raise exception 'Only the project''s team can reopen a change request' using errcode = '42501';
  end if;
  v_manager := public.is_project_manager(d.project_id);
  if v_manager and not private.staff_mfa_ok() then
    raise exception 'Two-factor verification required' using errcode = '42501', hint = 'mfa_required';
  end if;
  if d.status <> 'rejected' then
    raise exception 'Only a rejected change request can be reopened' using errcode = '55000', hint = 'not_rejected';
  end if;

  update public.decisions
  set status = 'pending', decided_by = null, decided_at = null, decision_reason = '', pending_since = now(), reminded_at = null
  where id = p_decision;
  perform private.decision_event(p_decision, d.project_id, 'reopened', '');
  perform private.decision_notify(
    d.project_id, case when v_manager then 'client'::public.project_role else 'manager'::public.project_role end,
    'decision_reopened', p_decision, d.title);
end;
$$;

-- ---------------------------------------------------------------------------
-- The 24-hour reminder (service role only: the hourly cron's admin client)
-- ---------------------------------------------------------------------------
-- Claims the one reminder of a request and writes the clients' in-app `decision_reminder`, under a row lock.
-- Returns false (and changes nothing) unless the request is still pending, has waited 24 hours since it was
-- submitted or reopened, and has not been reminded yet; so overlapping cron runs remind once.
create or replace function public.remind_decision(p_decision uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  d public.decisions%rowtype;
begin
  select * into d from public.decisions where id = p_decision for update;
  if not found or d.status <> 'pending' or d.reminded_at is not null
     or d.pending_since is null or d.pending_since > now() - interval '24 hours' then
    return false;
  end if;
  update public.decisions set reminded_at = now() where id = p_decision;
  perform private.decision_notify(d.project_id, 'client', 'decision_reminder', p_decision, d.title);
  return true;
end;
$$;

-- ---------------------------------------------------------------------------
-- Function privileges
-- ---------------------------------------------------------------------------
revoke execute on function private.decisions_stage_same_project() from public, anon, authenticated;
revoke execute on function private.decision_check_input(numeric, integer) from public, anon, authenticated;
-- decision_notify keeps the revoke from 20261006000100 (same signature, so it survives the replace).

revoke execute on function public.create_decision(uuid, text, text, numeric, integer, uuid) from public, anon;
revoke execute on function public.update_decision(uuid, text, text, numeric, integer, uuid) from public, anon;
revoke execute on function public.accept_decision(uuid) from public, anon;
grant execute on function public.create_decision(uuid, text, text, numeric, integer, uuid),
  public.update_decision(uuid, text, text, numeric, integer, uuid),
  public.accept_decision(uuid)
  to authenticated;
-- reject_decision / reopen_decision keep their signatures and grants.

revoke execute on function public.remind_decision(uuid) from public, anon, authenticated;
grant execute on function public.remind_decision(uuid) to service_role;

