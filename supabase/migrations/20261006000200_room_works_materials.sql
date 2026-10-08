-- Room view (issue #56): works, materials with delivery status and investor warnings per room.
--
--   tasks                      ONE source of progress. A task may now belong to a stage and/or a room
--                              (stage_id is nullable, at least one of the two is required). Its state is
--                              todo / in progress / done: `done` stays the only progress flag, the new
--                              `in_progress` flag only marks a started, not yet finished task.
--   rooms.progress_mode        'tasks' (default): progress and status follow the room's tasks, exactly like a
--                              stage (round(100 * done / total), blocked never overridden, capped at 99 while
--                              blocked). A room without tasks keeps whatever was set by hand. 'manual': by hand.
--                              Existing rooms that don't match their tasks are backfilled to 'manual'.
--   materials                  gain order_by_date ("order at the latest by") and delivery_date.
--   room_materials(room)       the client-safe read of a room's materials: name, quantity, unit, status and the
--                              two dates; never prices, supplier or notes. A security-definer function (like
--                              project_visible_contacts), because a security_invoker view over `materials`
--                              would return nothing to clients (managers only, restrictive staff-MFA policy) and
--                              column privileges can't differ between two `authenticated` roles.
--   room_warnings              "Uwaga do inwestora": a risk note on a room, never a date change. Linked to one or
--   room_warning_materials     more materials. Visibility rule (same in private.warning_is_open and
--                              src/domain/room-warnings.ts): open while ANY linked material is still 'planned'
--                              or 'ordered'; a warning with no linked material stays open until a manager removes
--                              it. Clients only read open warnings of visible rooms; managers read all of them.
--   rooms.client_note          untouched.
-- project_summary is not touched.

-- ---------------------------------------------------------------------------
-- tasks: stage and/or room, plus the in-progress flag
-- ---------------------------------------------------------------------------
alter table public.tasks alter column stage_id drop not null;
alter table public.tasks add constraint tasks_stage_or_room check (stage_id is not null or room_id is not null);
alter table public.tasks add column in_progress boolean not null default false;
alter table public.tasks add constraint tasks_in_progress_not_done check (not (done and in_progress));

comment on column public.tasks.in_progress is
  'Work has started but the task is not done. State = done ? done : in_progress ? in progress : todo. Progress counts only `done`.';

-- tasks.project_id comes from the stage, or from the room for a room-only task; the room must be in that project.
create or replace function private.sync_task_project()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_project uuid;
begin
  if new.stage_id is not null then
    select s.project_id into v_project from public.stages s where s.id = new.stage_id;
  elsif new.room_id is not null then
    select r.project_id into v_project from public.rooms r where r.id = new.room_id;
  end if;
  if v_project is null then
    raise exception 'Task needs an existing stage or room' using errcode = '23514';
  end if;
  new.project_id := v_project;
  if new.room_id is not null and not exists (
    select 1 from public.rooms r where r.id = new.room_id and r.project_id = v_project
  ) then
    raise exception 'Task room must belong to the same project' using errcode = '23514';
  end if;
  if new.done then
    new.in_progress := false;
  end if;
  if new.done and (tg_op = 'INSERT' or not old.done) then
    new.completed_at := coalesce(new.completed_at, now());
  elsif not new.done then
    new.completed_at := null;
  end if;
  return new;
end;
$$;

-- Clients see a task when it is visible and its stage (or, without a stage, its room) is visible.
drop policy "tasks: managers or visible to clients" on public.tasks;
create policy "tasks: managers or visible to clients" on public.tasks
for select to authenticated
using (
  public.is_project_manager(project_id)
  or (
    is_visible and public.is_project_client(project_id)
    and (
      (stage_id is not null and exists (select 1 from public.stages s where s.id = stage_id and s.is_visible))
      or (stage_id is null and exists (select 1 from public.rooms r where r.id = room_id and r.is_visible))
    )
  )
);

-- ---------------------------------------------------------------------------
-- rooms: progress derived from tasks
-- ---------------------------------------------------------------------------
alter table public.rooms add column progress_mode public.progress_mode not null default 'tasks';

comment on column public.rooms.progress_mode is
  'tasks: once the room has tasks, progress = round(100 * done / total) and status follows it (0 pending, 1-99 progress, '
  '100 done; blocked is never overridden, progress capped at 99 while blocked); kept by triggers. A room without tasks '
  'keeps its hand-set values. manual: progress and status are set by hand.';

-- The room's task completion (same rule as private.stage_task_progress) and whether it has tasks at all.
create or replace function private.room_derived(p_room uuid, p_status public.work_status,
  out has_tasks boolean, out progress smallint, out status public.work_status)
language plpgsql stable security definer set search_path = '' as $$
declare v_total int; v_done int;
begin
  select count(*), count(*) filter (where t.done) into v_total, v_done from public.tasks t where t.room_id = p_room;
  has_tasks := v_total > 0;
  progress := (case
    when v_total = 0 or v_done = 0 then 0
    when v_done = v_total then 100
    else least(99, greatest(1, round(100.0 * v_done / v_total)))
  end)::smallint;
  if p_status = 'blocked' then
    status := 'blocked';
    progress := least(progress, 99);
  else
    status := case when progress = 0 then 'pending' when progress = 100 then 'done' else 'progress' end;
  end if;
end;
$$;

-- Backfill: rooms that have tasks but show something else keep their numbers ('manual'). A data migration, not a
-- user edit: kept out of the activity log.
alter table public.rooms disable trigger log_activity;
update public.rooms r
set progress_mode = 'manual'
where exists (select 1 from public.tasks t where t.room_id = r.id)
  and not exists (
    select 1 from private.room_derived(r.id, r.status) d where d.progress = r.progress and d.status = r.status
  );
alter table public.rooms enable trigger log_activity;

create or replace function private.derive_room_progress()
returns trigger language plpgsql security definer set search_path = '' as $$
declare d record;
begin
  if new.progress_mode = 'tasks' then
    select * into d from private.room_derived(new.id, new.status);
    if d.has_tasks then
      new.progress := d.progress;
      new.status := d.status;
    end if;
  end if;
  return new;
end;
$$;

-- Named to sort before guard_room_done, so a derived status is what the guard sees.
create trigger derive_room_progress before insert or update on public.rooms
for each row execute function private.derive_room_progress();

-- Recomputes one tasks-mode room after its tasks changed (the update names `status`, so notify_room and the
-- activity log treat a derived change like a manual one). A room being deleted is skipped.
create or replace function private.recompute_room_progress(p_room uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_status public.work_status;
  d record;
begin
  if p_room is null or current_setting('private.deleting_room', true) = p_room::text then
    return;
  end if;
  select r.status into v_status
  from public.rooms r
  join public.projects p on p.id = r.project_id
  where r.id = p_room and r.progress_mode = 'tasks';
  if not found then
    return;
  end if;
  select * into d from private.room_derived(p_room, v_status);
  if not d.has_tasks then
    return;
  end if;
  update public.rooms r
  set progress = d.progress, status = d.status
  where r.id = p_room and (r.progress, r.status) is distinct from (d.progress, d.status);
end;
$$;

create or replace function private.refresh_room_progress()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op in ('UPDATE', 'DELETE') then
    perform private.recompute_room_progress(old.room_id);
  end if;
  if tg_op = 'INSERT' or (tg_op = 'UPDATE' and new.room_id is distinct from old.room_id) then
    perform private.recompute_room_progress(new.room_id);
  end if;
  return null;
end;
$$;

create trigger refresh_room_progress after insert or delete or update of done, room_id on public.tasks
for each row execute function private.refresh_room_progress();

-- Re-opening or adding a task on a Completed room is only refused for a manual room; a tasks-mode room
-- just recomputes.
create or replace function private.guard_task_reopen()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if not new.done and new.room_id is not null and exists (
    select 1 from public.rooms r where r.id = new.room_id and r.status = 'done' and r.progress_mode = 'manual'
  ) then
    raise exception 'Room is marked Completed — change its status before adding or re-opening tasks'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

-- Deleting a room deletes the tasks that belong to nothing else (room-only tasks); stage tasks lose the room.
create or replace function private.delete_room_only_tasks()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform set_config('private.deleting_room', old.id::text, true);
  delete from public.tasks t where t.room_id = old.id and t.stage_id is null;
  return old;
end;
$$;

create trigger delete_room_only_tasks before delete on public.rooms
for each row execute function private.delete_room_only_tasks();

-- ---------------------------------------------------------------------------
-- materials: order-by and delivery dates
-- ---------------------------------------------------------------------------
alter table public.materials
  add column order_by_date date,
  add column delivery_date date;

comment on column public.materials.order_by_date is 'Order at the latest by this date (shown red while the material is still planned).';
comment on column public.materials.delivery_date is 'Expected (ordered) or actual (delivered) delivery date.';

-- ---------------------------------------------------------------------------
-- room_materials(room): the client-safe read
-- ---------------------------------------------------------------------------
create or replace function public.room_materials(p_room uuid)
returns table (
  id uuid, project_id uuid, room_id uuid, name text, quantity numeric, unit text,
  status public.material_status, order_by_date date, delivery_date date
)
language sql stable security definer set search_path = '' as $$
  select m.id, m.project_id, m.room_id, m.name, m.quantity, m.unit, m.status, m.order_by_date, m.delivery_date
  from public.materials m
  join public.rooms r on r.id = m.room_id
  where m.room_id = p_room
    and (
      (public.is_project_manager(m.project_id) and private.staff_mfa_ok())
      or (public.is_project_client(m.project_id) and r.is_visible)
    )
  order by m.created_at, m.id;
$$;

comment on function public.room_materials(uuid) is
  'A room''s materials without prices, supplier or notes. Managers of the project (with an MFA session while 2FA is '
  'enforced) and clients of the project (visible rooms only).';

-- ---------------------------------------------------------------------------
-- Investor warnings
-- ---------------------------------------------------------------------------
create table public.room_warnings (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  room_id uuid not null references public.rooms (id) on delete cascade,
  text text not null check (length(trim(text)) > 0 and length(text) <= 2000),
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index room_warnings_room_idx on public.room_warnings (room_id);
create index room_warnings_project_idx on public.room_warnings (project_id);

comment on table public.room_warnings is
  'A risk the investor should know about ("Uwaga do inwestora"). Informational: it never moves a stage or project date.';

create table public.room_warning_materials (
  warning_id uuid not null references public.room_warnings (id) on delete cascade,
  material_id uuid not null references public.materials (id) on delete cascade,
  -- Denormalised from the warning (kept in sync by trigger) so RLS is a single lookup.
  project_id uuid not null references public.projects (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (warning_id, material_id)
);
create index room_warning_materials_material_idx on public.room_warning_materials (material_id);

-- The warning's room belongs to its project; a linked material belongs to the warning's room.
create or replace function private.check_room_warning_refs()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.rooms r where r.id = new.room_id and r.project_id = new.project_id) then
    raise exception 'Warning room must belong to the same project' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger check_room_warning_refs before insert or update of project_id, room_id on public.room_warnings
for each row execute function private.check_room_warning_refs();

create trigger set_updated_at before update on public.room_warnings
for each row execute function private.set_updated_at();

create trigger log_activity after insert or update or delete on public.room_warnings
for each row execute function private.log_activity();

create or replace function private.check_room_warning_material()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_project uuid; v_room uuid;
begin
  select w.project_id, w.room_id into v_project, v_room from public.room_warnings w where w.id = new.warning_id;
  new.project_id := v_project;
  if not exists (select 1 from public.materials m where m.id = new.material_id and m.project_id = v_project and m.room_id = v_room) then
    raise exception 'Warning material must belong to the warning''s room' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger check_room_warning_material before insert or update of warning_id, material_id on public.room_warning_materials
for each row execute function private.check_room_warning_material();

-- The visibility rule: open while any linked material is 'planned' or 'ordered'; open when nothing is linked.
create or replace function private.warning_is_open(p_warning uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select not exists (select 1 from public.room_warning_materials l where l.warning_id = p_warning)
      or exists (
        select 1 from public.room_warning_materials l
        join public.materials m on m.id = l.material_id
        where l.warning_id = p_warning and m.status in ('planned', 'ordered')
      );
$$;

-- What a client may read: an open warning of a visible room in their project. Security definer, because the
-- linked materials are not readable by clients.
create or replace function private.client_can_see_warning(p_warning uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.room_warnings w
    join public.rooms r on r.id = w.room_id
    where w.id = p_warning and r.is_visible and public.is_project_client(w.project_id)
  ) and private.warning_is_open(p_warning);
$$;

alter table public.room_warnings enable row level security;
alter table public.room_warning_materials enable row level security;

create policy "room_warnings: managers or open to clients" on public.room_warnings
for select to authenticated
using (public.is_project_manager(project_id) or private.client_can_see_warning(id));
create policy "room_warnings: managers insert" on public.room_warnings
for insert to authenticated with check (public.is_project_manager(project_id));
create policy "room_warnings: managers update" on public.room_warnings
for update to authenticated
using (public.is_project_manager(project_id)) with check (public.is_project_manager(project_id));
create policy "room_warnings: managers delete" on public.room_warnings
for delete to authenticated using (public.is_project_manager(project_id));

create policy "room_warning_materials: managers or open to clients" on public.room_warning_materials
for select to authenticated
using (public.is_project_manager(project_id) or private.client_can_see_warning(warning_id));
create policy "room_warning_materials: managers insert" on public.room_warning_materials
for insert to authenticated with check (public.is_project_manager(project_id));
create policy "room_warning_materials: managers update" on public.room_warning_materials
for update to authenticated
using (public.is_project_manager(project_id)) with check (public.is_project_manager(project_id));
create policy "room_warning_materials: managers delete" on public.room_warning_materials
for delete to authenticated using (public.is_project_manager(project_id));

revoke all on public.room_warnings, public.room_warning_materials from anon;
grant select, insert, update, delete on public.room_warnings, public.room_warning_materials to authenticated;

-- ---------------------------------------------------------------------------
-- Privileges: only the functions created here
-- ---------------------------------------------------------------------------
revoke execute on function private.room_derived(uuid, public.work_status) from public, anon, authenticated;
revoke execute on function private.derive_room_progress() from public, anon, authenticated;
revoke execute on function private.recompute_room_progress(uuid) from public, anon, authenticated;
revoke execute on function private.refresh_room_progress() from public, anon, authenticated;
revoke execute on function private.delete_room_only_tasks() from public, anon, authenticated;
revoke execute on function private.check_room_warning_refs() from public, anon, authenticated;
revoke execute on function private.check_room_warning_material() from public, anon, authenticated;
-- Called from RLS policies, so the signed-in role needs them.
revoke execute on function private.warning_is_open(uuid) from public, anon;
revoke execute on function private.client_can_see_warning(uuid) from public, anon;
grant execute on function private.warning_is_open(uuid) to authenticated;
grant execute on function private.client_can_see_warning(uuid) to authenticated;

revoke execute on function public.room_materials(uuid) from public, anon;
grant execute on function public.room_materials(uuid) to authenticated;
