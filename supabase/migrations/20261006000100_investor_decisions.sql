-- Investor decisions (#55): cases the site manager submits and the investor (a client of the project) decides.
--
--   decisions                 the case: title, description, cost_delta (may be negative), days_delta (may be negative), status
--   decision_photos           1..10 photos per case (project-media, <project_id>/decisions/<file>)
--   decision_events           append-only history: submitted | question | answer | accepted | rejected | reopened | edited
--   decision_confirmations    emailed 6-digit codes for accepting a case (hashed + salted; no API access at all)
--
-- Status: pending -> accepted (final) | rejected (can be reopened -> pending) | question (the manager answers -> pending).
-- Only ACCEPTED cases count: accepting adds days_delta to projects.target_date and cost_delta to projects.budget in
-- one transaction (public.accept_decision). project_summary and every other view are untouched; the plan-vs-current
-- display (#53/#54) shows the difference by itself.
--
-- Access model. RLS lets the project's managers and clients SELECT; nobody writes the tables directly (all
-- privileges are revoked). Every change goes through a SECURITY DEFINER function that checks the caller's project
-- role and the state machine, writes the history event and the notification in the same transaction:
--
--   create_decision / update_decision / answer_decision_question      managers
--   ask_decision_question / reject_decision / accept_decision         clients (the investor)
--   reopen_decision                                                    either
--
-- Code check for accepting is DB-side. The server function (src/server/functions/decisions.ts) generates the code,
-- stores only sha256(salt || ':' || code) with the ADMIN client (the browser can't write decision_confirmations, so it
-- can't plant a code it knows) and emails the code to the signed-in investor. accept_decision(decision, code) checks
-- the code itself (owner, expiry 10 min, max 5 attempts, single use) under a row lock, so the RPC is unusable without
-- the emailed code even when called straight from the browser, and a double submit or a race between two investors
-- accepts once and reports 'already_accepted' to the loser.

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------
create type public.decision_status as enum ('pending', 'accepted', 'rejected', 'question');
create type public.decision_event_kind as enum ('submitted', 'question', 'answer', 'accepted', 'rejected', 'reopened', 'edited');

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
create table public.decisions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  title text not null check (length(btrim(title)) between 1 and 160),
  description text not null default '' check (length(description) <= 5000),
  -- Negative = savings / time gained. Applied to projects.budget / target_date only when accepted.
  cost_delta numeric(12, 2) not null default 0 check (cost_delta between -1000000000 and 1000000000),
  days_delta integer not null default 0 check (days_delta between -3650 and 3650),
  status public.decision_status not null default 'pending',
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  decided_by uuid references public.profiles (id) on delete set null,
  decided_at timestamptz,
  -- The investor's reason for rejecting; cleared when the case is reopened (the history keeps it).
  decision_reason text not null default '' check (length(decision_reason) <= 2000)
);
create index decisions_project_idx on public.decisions (project_id, status, created_at desc);

create trigger set_updated_at before update on public.decisions
for each row execute function private.set_updated_at();

create table public.decision_photos (
  id uuid primary key default gen_random_uuid(),
  decision_id uuid not null references public.decisions (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  storage_path text not null unique,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  -- The storage policies key on the first path segment: a photo can only live in its own project's folder.
  constraint decision_photos_path_check check (storage_path like project_id::text || '/decisions/%')
);
create index decision_photos_decision_idx on public.decision_photos (decision_id, sort_order);

create table public.decision_events (
  id bigint generated always as identity primary key,
  decision_id uuid not null references public.decisions (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  kind public.decision_event_kind not null,
  actor_id uuid references public.profiles (id) on delete set null,
  actor_role public.project_role,
  text text not null default '' check (length(text) <= 5000),
  created_at timestamptz not null default now()
);
create index decision_events_decision_idx on public.decision_events (decision_id, id);

-- Append-only: rows are never changed (they go away only with their case or project, by cascade).
create or replace function private.decision_events_append_only()
returns trigger language plpgsql set search_path = '' as $$
begin
  raise exception 'decision_events is append-only' using errcode = '55000';
end;
$$;
create trigger decision_events_append_only before update on public.decision_events
for each row execute function private.decision_events_append_only();

create table public.decision_confirmations (
  id uuid primary key default gen_random_uuid(),
  decision_id uuid not null references public.decisions (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  -- sha256(salt || ':' || code), hex. The code itself is never stored or logged.
  code_hash text not null,
  salt text not null,
  expires_at timestamptz not null,
  attempts integer not null default 0 check (attempts >= 0),
  -- Set when the code is used, superseded, expired, burned by too many attempts or invalidated by an edit.
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);
create index decision_confirmations_open_idx on public.decision_confirmations (decision_id, user_id, created_at desc);

-- A new code supersedes the open ones for the same case and user, and at most 5 codes an hour can be issued
-- (this bounds guessing even for a caller that bypasses the server function's rate limit).
create or replace function private.decision_confirmations_before_insert()
returns trigger language plpgsql set search_path = '' as $$
begin
  if (select count(*) from public.decision_confirmations c
       where c.decision_id = new.decision_id and c.user_id = new.user_id and c.created_at > now() - interval '1 hour') >= 5 then
    raise exception 'Too many confirmation codes requested' using errcode = '54000', hint = 'too_many_codes';
  end if;
  update public.decision_confirmations set consumed_at = now()
  where decision_id = new.decision_id and user_id = new.user_id and consumed_at is null;
  return new;
end;
$$;
create trigger decision_confirmations_before_insert before insert on public.decision_confirmations
for each row execute function private.decision_confirmations_before_insert();

-- ---------------------------------------------------------------------------
-- RLS and grants
-- ---------------------------------------------------------------------------
alter table public.decisions enable row level security;
alter table public.decision_photos enable row level security;
alter table public.decision_events enable row level security;
alter table public.decision_confirmations enable row level security; -- no policy: not reachable through the API

create policy "decisions: members read" on public.decisions
for select to authenticated using (public.is_project_member(project_id));
create policy "decision_photos: members read" on public.decision_photos
for select to authenticated using (public.is_project_member(project_id));
create policy "decision_events: members read" on public.decision_events
for select to authenticated using (public.is_project_member(project_id));

revoke all on public.decisions, public.decision_photos, public.decision_events, public.decision_confirmations from anon, authenticated;
grant select on public.decisions, public.decision_photos, public.decision_events to authenticated;
-- decision_confirmations: only the server's admin client (service_role) touches it.

-- Clients see a case's photos in storage (managers already read/write everything under their project).
create policy "media: clients read decision photos" on storage.objects
for select to authenticated
using (
  bucket_id = 'project-media'
  and public.is_project_client(private.path_project_id(name))
  and exists (select 1 from public.decision_photos dp where dp.storage_path = name)
);

-- ---------------------------------------------------------------------------
-- Helpers (private: not callable through the API)
-- ---------------------------------------------------------------------------
create or replace function private.decision_event(p_decision uuid, p_project uuid, p_kind public.decision_event_kind, p_text text default '')
returns void language sql security definer set search_path = '' as $$
  insert into public.decision_events (decision_id, project_id, kind, actor_id, actor_role, text)
  values (
    p_decision, p_project, p_kind, auth.uid(),
    (select m.role from public.project_members m where m.project_id = p_project and m.user_id = auth.uid()),
    coalesce(p_text, '')
  );
$$;

-- In-app notification (T33 kind + params) to every member of `p_role` on the project.
create or replace function private.decision_notify(
  p_project uuid, p_role public.project_role, p_kind text, p_decision uuid, p_title text, p_text text default ''
) returns void language sql security definer set search_path = '' as $$
  insert into public.notifications (project_id, recipient_id, kind, params, title, body, link, entity_type, entity_id, created_by)
  select p_project, m.user_id, p_kind, jsonb_build_object('title', p_title, 'text', coalesce(p_text, '')),
         p_title, left(coalesce(p_text, ''), 280), '/decisions', 'decisions', p_decision, auth.uid()
  from public.project_members m
  where m.project_id = p_project and m.role = p_role and m.user_id is distinct from auth.uid();
$$;

-- Open confirmation codes of a case stop working (an edit, a rejection, an acceptance).
create or replace function private.decision_invalidate_codes(p_decision uuid)
returns void language sql security definer set search_path = '' as $$
  update public.decision_confirmations set consumed_at = now() where decision_id = p_decision and consumed_at is null;
$$;

-- Adds photo paths to a case: they must exist in storage under the project's decisions folder.
create or replace function private.decision_add_photos(p_decision uuid, p_project uuid, p_paths text[])
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_path text;
  v_order integer;
begin
  select coalesce(max(sort_order), 0) into v_order from public.decision_photos where decision_id = p_decision;
  foreach v_path in array coalesce(p_paths, '{}') loop
    if not exists (select 1 from storage.objects o where o.bucket_id = 'project-media' and o.name = v_path) then
      raise exception 'Photo % was not uploaded', v_path using errcode = '22023', hint = 'photo_missing';
    end if;
    v_order := v_order + 1;
    insert into public.decision_photos (decision_id, project_id, storage_path, sort_order)
    values (p_decision, p_project, v_path, v_order);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Manager: create / edit / answer
-- ---------------------------------------------------------------------------
create or replace function public.create_decision(
  p_project uuid, p_title text, p_description text, p_cost_delta numeric, p_days_delta integer, p_photos text[]
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
  v_title text := btrim(coalesce(p_title, ''));
begin
  if (select auth.uid()) is null or not public.is_project_manager(p_project) then
    raise exception 'Only the project''s managers can submit a decision' using errcode = '42501';
  end if;
  if coalesce(array_length(p_photos, 1), 0) < 1 then
    raise exception 'A decision needs at least one photo' using errcode = '22023', hint = 'photos_required';
  end if;
  if array_length(p_photos, 1) > 10 then
    raise exception 'A decision takes at most 10 photos' using errcode = '22023', hint = 'too_many_photos';
  end if;

  insert into public.decisions (project_id, title, description, cost_delta, days_delta, created_by)
  values (p_project, v_title, coalesce(p_description, ''), coalesce(p_cost_delta, 0), coalesce(p_days_delta, 0), auth.uid())
  returning id into v_id;

  perform private.decision_add_photos(v_id, p_project, p_photos);
  perform private.decision_event(v_id, p_project, 'submitted', '');
  perform private.decision_notify(p_project, 'client', 'decision_new', v_id, v_title);
  return v_id;
end;
$$;

-- Edit a case while it is pending or in question. Returns the storage paths of the removed photos so the caller can
-- delete the objects. Open confirmation codes stop working, so an investor can't accept what they haven't seen.
create or replace function public.update_decision(
  p_decision uuid, p_title text, p_description text, p_cost_delta numeric, p_days_delta integer,
  p_add_photos text[] default '{}', p_remove_photos uuid[] default '{}'
) returns text[] language plpgsql security definer set search_path = '' as $$
declare
  d public.decisions%rowtype;
  v_removed text[];
  v_count integer;
begin
  select * into d from public.decisions where id = p_decision for update;
  if not found or (select auth.uid()) is null or not public.is_project_manager(d.project_id) then
    raise exception 'Only the project''s managers can edit a decision' using errcode = '42501';
  end if;
  if d.status not in ('pending', 'question') then
    raise exception 'A decided case is locked; submit a new one' using errcode = '55000', hint = 'decision_locked';
  end if;

  with gone as (
    delete from public.decision_photos where decision_id = p_decision and id = any (coalesce(p_remove_photos, '{}'))
    returning storage_path
  )
  select coalesce(array_agg(storage_path), '{}') into v_removed from gone;

  perform private.decision_add_photos(p_decision, d.project_id, p_add_photos);

  select count(*) into v_count from public.decision_photos where decision_id = p_decision;
  if v_count < 1 then
    raise exception 'A decision needs at least one photo' using errcode = '22023', hint = 'photos_required';
  end if;
  if v_count > 10 then
    raise exception 'A decision takes at most 10 photos' using errcode = '22023', hint = 'too_many_photos';
  end if;

  update public.decisions
  set title = btrim(coalesce(p_title, '')), description = coalesce(p_description, ''),
      cost_delta = coalesce(p_cost_delta, 0), days_delta = coalesce(p_days_delta, 0)
  where id = p_decision;

  perform private.decision_invalidate_codes(p_decision);
  perform private.decision_event(p_decision, d.project_id, 'edited', '');
  return v_removed;
end;
$$;

-- The manager answers the investor's question in the same case; it is awaiting a decision again.
create or replace function public.answer_decision_question(p_decision uuid, p_text text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  d public.decisions%rowtype;
  v_text text := btrim(coalesce(p_text, ''));
begin
  select * into d from public.decisions where id = p_decision for update;
  if not found or (select auth.uid()) is null or not public.is_project_manager(d.project_id) then
    raise exception 'Only the project''s managers can answer' using errcode = '42501';
  end if;
  if d.status <> 'question' then
    raise exception 'There is no open question' using errcode = '55000', hint = 'not_in_question';
  end if;
  if v_text = '' or length(v_text) > 2000 then
    raise exception 'The answer must be 1-2000 characters' using errcode = '22023', hint = 'text_invalid';
  end if;

  update public.decisions set status = 'pending' where id = p_decision;
  perform private.decision_event(p_decision, d.project_id, 'answer', v_text);
  perform private.decision_notify(d.project_id, 'client', 'decision_answer', p_decision, d.title, v_text);
end;
$$;

-- ---------------------------------------------------------------------------
-- Investor: question / reject / accept
-- ---------------------------------------------------------------------------
create or replace function public.ask_decision_question(p_decision uuid, p_text text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  d public.decisions%rowtype;
  v_text text := btrim(coalesce(p_text, ''));
begin
  select * into d from public.decisions where id = p_decision for update;
  if not found or (select auth.uid()) is null or not public.is_project_client(d.project_id) then
    raise exception 'Only the project''s investor can ask a question' using errcode = '42501';
  end if;
  if d.status <> 'pending' then
    raise exception 'A question can only be asked while the case awaits a decision' using errcode = '55000', hint = 'not_pending';
  end if;
  if v_text = '' or length(v_text) > 2000 then
    raise exception 'The question must be 1-2000 characters' using errcode = '22023', hint = 'text_invalid';
  end if;

  update public.decisions set status = 'question' where id = p_decision;
  perform private.decision_event(p_decision, d.project_id, 'question', v_text);
  perform private.decision_notify(d.project_id, 'manager', 'decision_question', p_decision, d.title, v_text);
end;
$$;

create or replace function public.reject_decision(p_decision uuid, p_reason text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  d public.decisions%rowtype;
  v_reason text := btrim(coalesce(p_reason, ''));
begin
  select * into d from public.decisions where id = p_decision for update;
  if not found or (select auth.uid()) is null or not public.is_project_client(d.project_id) then
    raise exception 'Only the project''s investor can reject a decision' using errcode = '42501';
  end if;
  if d.status not in ('pending', 'question') then
    raise exception 'This case can no longer be rejected' using errcode = '55000', hint = 'decision_locked';
  end if;
  if v_reason = '' or length(v_reason) > 2000 then
    raise exception 'A reason is required (up to 2000 characters)' using errcode = '22023', hint = 'reason_required';
  end if;

  update public.decisions
  set status = 'rejected', decided_by = auth.uid(), decided_at = now(), decision_reason = v_reason
  where id = p_decision;
  perform private.decision_invalidate_codes(p_decision);
  perform private.decision_event(p_decision, d.project_id, 'rejected', v_reason);
  perform private.decision_notify(d.project_id, 'manager', 'decision_rejected', p_decision, d.title, v_reason);
end;
$$;

-- A rejected case goes back to 'pending'. Totals are untouched (only acceptance changes them).
create or replace function public.reopen_decision(p_decision uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  d public.decisions%rowtype;
  v_other public.project_role;
begin
  select * into d from public.decisions where id = p_decision for update;
  if not found or (select auth.uid()) is null or not public.is_project_member(d.project_id) then
    raise exception 'Only the project''s team can reopen a decision' using errcode = '42501';
  end if;
  if d.status <> 'rejected' then
    raise exception 'Only a rejected case can be reopened' using errcode = '55000', hint = 'not_rejected';
  end if;

  update public.decisions
  set status = 'pending', decided_by = null, decided_at = null, decision_reason = ''
  where id = p_decision;
  perform private.decision_event(p_decision, d.project_id, 'reopened', '');
  v_other := case when public.is_project_manager(d.project_id) then 'client'::public.project_role else 'manager'::public.project_role end;
  perform private.decision_notify(d.project_id, v_other, 'decision_reopened', p_decision, d.title);
end;
$$;

-- Accept a case with the emailed code. Returns a status instead of raising for the code problems, so the attempt
-- counter survives (a raise would roll the increment back):
--   ok | already_accepted | not_open | no_code | expired | invalid_code | too_many_attempts
-- Errors (raised): 42501 not the project's investor, 23514 (hint budget_negative) the budget would drop below zero.
create or replace function public.accept_decision(p_decision uuid, p_code text)
returns text language plpgsql security definer set search_path = '' as $$
declare
  d public.decisions%rowtype;
  c public.decision_confirmations%rowtype;
  v_uid uuid := (select auth.uid());
  v_hash text;
begin
  -- Row lock: concurrent accepts (double click, two investors) run one after the other.
  select * into d from public.decisions where id = p_decision for update;
  if not found or v_uid is null or not public.is_project_client(d.project_id) then
    raise exception 'Only the project''s investor can accept a decision' using errcode = '42501';
  end if;
  if d.status = 'accepted' then
    return 'already_accepted'; -- idempotent: the totals were applied exactly once
  end if;
  if d.status not in ('pending', 'question') then
    return 'not_open';
  end if;

  select * into c from public.decision_confirmations
  where decision_id = p_decision and user_id = v_uid and consumed_at is null
  order by created_at desc limit 1
  for update;
  if not found then
    return 'no_code';
  end if;
  if c.expires_at <= now() then
    update public.decision_confirmations set consumed_at = now() where id = c.id;
    return 'expired';
  end if;

  v_hash := encode(sha256(convert_to(c.salt || ':' || coalesce(p_code, ''), 'UTF8')), 'hex');
  if v_hash is distinct from c.code_hash then
    update public.decision_confirmations
    set attempts = attempts + 1, consumed_at = case when attempts + 1 >= 5 then now() end
    where id = c.id;
    return case when c.attempts + 1 >= 5 then 'too_many_attempts' else 'invalid_code' end;
  end if;

  if (select p.budget from public.projects p where p.id = d.project_id) + d.cost_delta < 0 then
    raise exception 'The budget can''t drop below zero' using errcode = '23514', hint = 'budget_negative';
  end if;

  -- Single use, and any other open code for the case is void.
  perform private.decision_invalidate_codes(p_decision);
  update public.decisions set status = 'accepted', decided_by = v_uid, decided_at = now() where id = p_decision;
  update public.projects
  set budget = budget + d.cost_delta,
      target_date = case when target_date is null then null else target_date + d.days_delta end
  where id = d.project_id;
  perform private.decision_event(p_decision, d.project_id, 'accepted', '');
  return 'ok';
end;
$$;

-- ---------------------------------------------------------------------------
-- Function privileges: authenticated only (the functions check the caller's project role themselves).
-- ---------------------------------------------------------------------------
revoke execute on function private.decision_events_append_only() from public, anon, authenticated;
revoke execute on function private.decision_confirmations_before_insert() from public, anon, authenticated;
revoke execute on function private.decision_event(uuid, uuid, public.decision_event_kind, text) from public, anon, authenticated;
revoke execute on function private.decision_notify(uuid, public.project_role, text, uuid, text, text) from public, anon, authenticated;
revoke execute on function private.decision_invalidate_codes(uuid) from public, anon, authenticated;
revoke execute on function private.decision_add_photos(uuid, uuid, text[]) from public, anon, authenticated;

revoke execute on function public.create_decision(uuid, text, text, numeric, integer, text[]) from public, anon;
revoke execute on function public.update_decision(uuid, text, text, numeric, integer, text[], uuid[]) from public, anon;
revoke execute on function public.answer_decision_question(uuid, text) from public, anon;
revoke execute on function public.ask_decision_question(uuid, text) from public, anon;
revoke execute on function public.reject_decision(uuid, text) from public, anon;
revoke execute on function public.reopen_decision(uuid) from public, anon;
revoke execute on function public.accept_decision(uuid, text) from public, anon;
grant execute on function public.create_decision(uuid, text, text, numeric, integer, text[]),
  public.update_decision(uuid, text, text, numeric, integer, text[], uuid[]),
  public.answer_decision_question(uuid, text),
  public.ask_decision_question(uuid, text),
  public.reject_decision(uuid, text),
  public.reopen_decision(uuid),
  public.accept_decision(uuid, text)
  to authenticated;
