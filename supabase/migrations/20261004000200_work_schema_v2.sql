-- Schema v2 for work data (T32): the site diary, stage progress derived from tasks, the floor-plan
-- background image and a bulk stage import.
--
--   progress_entries                 the site diary: a dated note (optional stage, room, hours) per project;
--                                    clients read only is_visible entries of their own project
--   photos.progress_entry_id         diary photos attach to an entry (client visibility stays the photo's status)
--   stages.progress_mode             'tasks' (default): progress and status follow the stage's checklist;
--                                    'manual': set by hand, as before
--   projects.plan_image_path/_opts   the floor plan's background image (<project_id>/plans/<file> in project-media)
--                                    and its display options; exposed by project_summary
--   import_stages(project, rows)     all-or-nothing import of stages with nested tasks (managers)
--
-- Rules from the W4 merge (see 20261003000100_fix_w4_merge.sql): private.log_activity() is not redefined here
-- (progress_entries falls back to its table name until the coordinator adds a label), and privileges are
-- granted/revoked per function, never with a blanket revoke on schema private.

-- ---------------------------------------------------------------------------
-- Stage progress derived from tasks
-- ---------------------------------------------------------------------------
create type public.progress_mode as enum ('tasks', 'manual');

alter table public.stages add column progress_mode public.progress_mode not null default 'tasks';

comment on column public.stages.progress_mode is
  'tasks: progress = round(100 * done / total) of the stage''s tasks (0 without tasks) and status follows it '
  '(0 pending, 1-99 progress, 100 done), kept by triggers; blocked is never overridden (progress capped at 99 '
  'while blocked). manual: progress and status are set by hand.';

-- The checklist's completion: 0 without tasks, 100 only when every task is done, and never 0 or 100 by
-- rounding alone (1 of 201 done is 1%, 200 of 201 is 99%), so 100% keeps meaning "all done".
create or replace function private.stage_task_progress(p_stage uuid)
returns smallint language sql stable security definer set search_path = '' as $$
  select (case
    when count(*) = 0 or count(*) filter (where t.done) = 0 then 0
    when count(*) filter (where t.done) = count(*) then 100
    else least(99, greatest(1, round(100.0 * count(*) filter (where t.done) / count(*))))
  end)::smallint
  from public.tasks t
  where t.stage_id = p_stage;
$$;

-- The derived progress and status of a tasks-mode stage, given the status it has (or is being given).
-- Blocked stays blocked, with the progress capped at 99 so it never meets (status = 'done') = (progress = 100).
create or replace function private.stage_derived(p_stage uuid, p_status public.work_status,
  out progress smallint, out status public.work_status)
language plpgsql stable security definer set search_path = '' as $$
begin
  progress := private.stage_task_progress(p_stage);
  if p_status = 'blocked' then
    status := 'blocked';
    progress := least(progress, 99);
  else
    status := case when progress = 0 then 'pending' when progress = 100 then 'done' else 'progress' end;
  end if;
end;
$$;

-- Backfill: existing stages keep 'tasks' only when they already show exactly what their checklist gives
-- (progress and status), so nothing on screen jumps; everything else becomes 'manual'. A data migration,
-- not a user edit: kept out of the activity log.
alter table public.stages disable trigger log_activity;
update public.stages s
set progress_mode = 'manual'
where not exists (
  select 1 from private.stage_derived(s.id, s.status) d where d.progress = s.progress and d.status = s.status
);
alter table public.stages enable trigger log_activity;

-- In tasks mode, a stage's progress and status are always the derived ones, whatever an insert or update
-- asks for, except that "blocked" may be set and cleared by hand. Switching a stage back to tasks mode
-- recomputes it on the spot.
create or replace function private.derive_stage_progress()
returns trigger language plpgsql security definer set search_path = '' as $$
declare d record;
begin
  if new.progress_mode = 'tasks' then
    select * into d from private.stage_derived(new.id, new.status);
    new.progress := d.progress;
    new.status := d.status;
  end if;
  return new;
end;
$$;

create trigger derive_stage_progress before insert or update on public.stages
for each row execute function private.derive_stage_progress();

-- Recomputes one tasks-mode stage after its checklist changed. The update names `status`, so
-- notify_stage (after update of status) notifies clients of a derived status change like a manual one,
-- and log_activity records it. A stage or project being deleted (cascading to its tasks) is skipped.
create or replace function private.recompute_stage_progress(p_stage uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_status public.work_status;
  d record;
begin
  select s.status into v_status
  from public.stages s
  join public.projects p on p.id = s.project_id
  where s.id = p_stage and s.progress_mode = 'tasks';
  if not found then
    return;
  end if;
  select * into d from private.stage_derived(p_stage, v_status);
  update public.stages s
  set progress = d.progress, status = d.status
  where s.id = p_stage and (s.progress, s.status) is distinct from (d.progress, d.status);
end;
$$;

create or replace function private.refresh_stage_progress()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op in ('UPDATE', 'DELETE') then
    perform private.recompute_stage_progress(old.stage_id);
  end if;
  if tg_op = 'INSERT' or (tg_op = 'UPDATE' and new.stage_id is distinct from old.stage_id) then
    perform private.recompute_stage_progress(new.stage_id);
  end if;
  return null;
end;
$$;

create trigger refresh_stage_progress after insert or delete or update of done, stage_id on public.tasks
for each row execute function private.refresh_stage_progress();

-- ---------------------------------------------------------------------------
-- Site diary
-- ---------------------------------------------------------------------------
create table public.progress_entries (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  stage_id uuid references public.stages (id) on delete set null,
  room_id uuid references public.rooms (id) on delete set null,
  entry_date date not null default current_date,
  author_id uuid default auth.uid() references public.profiles (id) on delete set null,
  note text not null check (length(trim(note)) > 0),
  hours numeric(5, 2) check (hours is null or hours >= 0),
  -- Internal by default, like renders and AI knowledge: the manager opts an entry into the client's view.
  is_visible boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index progress_entries_project_idx on public.progress_entries (project_id, entry_date desc, created_at desc);
create index progress_entries_stage_idx on public.progress_entries (stage_id) where stage_id is not null;
create index progress_entries_room_idx on public.progress_entries (room_id) where room_id is not null;

comment on table public.progress_entries is
  'The site diary. Managers of the project read and write every entry; clients read is_visible entries of their own project.';

-- The stage and room of an entry belong to the entry's project (like sync_task_project for tasks).
create or replace function private.check_progress_entry_refs()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.stage_id is not null and not exists (
    select 1 from public.stages s where s.id = new.stage_id and s.project_id = new.project_id
  ) then
    raise exception 'Diary entry stage must belong to the same project' using errcode = '23514';
  end if;
  if new.room_id is not null and not exists (
    select 1 from public.rooms r where r.id = new.room_id and r.project_id = new.project_id
  ) then
    raise exception 'Diary entry room must belong to the same project' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger check_progress_entry_refs before insert or update of project_id, stage_id, room_id on public.progress_entries
for each row execute function private.check_progress_entry_refs();

create trigger set_updated_at before update on public.progress_entries
for each row execute function private.set_updated_at();

-- The existing generic trail; with no label branch yet it logs entity "progress_entries" (coordinator follow-up).
create trigger log_activity after insert or update or delete on public.progress_entries
for each row execute function private.log_activity();

alter table public.progress_entries enable row level security;

create policy "progress_entries: managers or visible to clients" on public.progress_entries
for select to authenticated
using (public.is_project_manager(project_id) or (is_visible and public.is_project_client(project_id)));

create policy "progress_entries: managers insert" on public.progress_entries
for insert to authenticated with check (public.is_project_manager(project_id));

create policy "progress_entries: managers update" on public.progress_entries
for update to authenticated
using (public.is_project_manager(project_id)) with check (public.is_project_manager(project_id));

create policy "progress_entries: managers delete" on public.progress_entries
for delete to authenticated using (public.is_project_manager(project_id));

revoke all on public.progress_entries from anon;
grant select, insert, update, delete on public.progress_entries to authenticated;

-- ---------------------------------------------------------------------------
-- Diary photos
-- ---------------------------------------------------------------------------
alter table public.photos
  add column progress_entry_id uuid references public.progress_entries (id) on delete set null;
create index photos_progress_entry_idx on public.photos (progress_entry_id) where progress_entry_id is not null;

comment on column public.photos.progress_entry_id is
  'The diary entry this photo belongs to. Clients still see the photo only once it is published, whatever the entry''s visibility.';

create or replace function private.check_photo_progress_entry()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.progress_entry_id is not null and not exists (
    select 1 from public.progress_entries e where e.id = new.progress_entry_id and e.project_id = new.project_id
  ) then
    raise exception 'Photo diary entry must belong to the same project' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger check_photo_progress_entry before insert or update of project_id, progress_entry_id on public.photos
for each row execute function private.check_photo_progress_entry();

-- ---------------------------------------------------------------------------
-- Floor-plan background image
-- ---------------------------------------------------------------------------
alter table public.projects
  add column plan_image_path text check (plan_image_path is null or plan_image_path like id::text || '/plans/_%'),
  -- { opacity: 0..1, scale: > 0, x, y }; every key optional. CASE keeps each cast behind its type check.
  add column plan_image_opts jsonb not null default '{}'::jsonb check (
    jsonb_typeof(plan_image_opts) = 'object'
    and case when plan_image_opts -> 'opacity' is null then true
             when jsonb_typeof(plan_image_opts -> 'opacity') = 'number'
               then (plan_image_opts ->> 'opacity')::numeric between 0 and 1
             else false end
    and case when plan_image_opts -> 'scale' is null then true
             when jsonb_typeof(plan_image_opts -> 'scale') = 'number'
               then (plan_image_opts ->> 'scale')::numeric > 0
             else false end
    and (plan_image_opts -> 'x' is null or jsonb_typeof(plan_image_opts -> 'x') = 'number')
    and (plan_image_opts -> 'y' is null or jsonb_typeof(plan_image_opts -> 'y') = 'number')
  );

comment on column public.projects.plan_image_path is
  'Floor-plan background image in bucket project-media, ''<project_id>/plans/<file>''. Null: no background.';
comment on column public.projects.plan_image_opts is
  'How the plan background is drawn under the rooms: { opacity (0-1), scale (> 0), x, y } in plan units; keys optional.';

-- Managers edit them (the projects column-grant pattern; the "projects: managers update" policy applies).
grant update (plan_image_path, plan_image_opts) on public.projects to authenticated;

-- Storage: clients read the plan images of their project. Managers already read, write, replace and delete
-- every <project_id>/... object of project-media through the "media: managers …" policies, plans included.
-- Allowed types are the bucket's (jpeg, png, webp, heic, pdf).
create policy "media: clients read plans" on storage.objects
for select to authenticated
using (
  bucket_id = 'project-media'
  and split_part(name, '/', 2) = 'plans'
  and public.is_project_client(private.path_project_id(name))
);

-- project_summary gains the plan image (appended, so create or replace keeps the grants).
create or replace view public.project_summary
with (security_invoker = true) as
select
  p.id,
  p.name,
  p.address,
  p.address_line,
  p.postal_code,
  p.city,
  p.country,
  p.currency,
  p.status,
  p.start_date,
  p.target_date,
  p.budget,
  p.spent,
  p.schedule_status,
  p.schedule_note,
  p.created_at,
  p.updated_at,
  coalesce(round(avg(s.progress))::int, 0) as overall_progress,
  count(s.id) filter (where s.status = 'done')::int as stages_done,
  count(s.id)::int as stages_total,
  (
    select s2.name from public.stages s2
    where s2.project_id = p.id and s2.status = 'progress'
    order by s2.sort_order limit 1
  ) as current_stage,
  (
    select pr.full_name from public.project_members m
    join public.profiles pr on pr.id = m.user_id
    where m.project_id = p.id and m.role = 'manager'
    order by m.created_at limit 1
  ) as manager_name,
  (
    select c.full_name from public.project_contacts pc
    join public.contacts c on c.id = pc.contact_id
    where pc.project_id = p.id and pc.role = 'client'
    order by pc.is_primary desc, pc.sort_order, pc.created_at limit 1
  ) as client_display_name,
  p.plan_image_path,
  p.plan_image_opts
from public.projects p
left join public.stages s on s.project_id = p.id
group by p.id;

-- ---------------------------------------------------------------------------
-- Bulk import: stages with nested tasks (used by T45)
-- ---------------------------------------------------------------------------
-- The key convention of src/domain/text.ts slugify(): lowercase, runs of anything else become "-",
-- no leading/trailing "-", at most 24 characters, "item" when empty.
create or replace function private.slugify(p_text text)
returns text language sql immutable set search_path = '' as $$
  select coalesce(nullif(left(btrim(regexp_replace(lower(coalesce(p_text, '')), '[^a-z0-9]+', '-', 'g'), '-'), 24), ''), 'item');
$$;

-- p_rows: [{ name, start_date, end_date (YYYY-MM-DD), client_note?, tasks?: [{ name, room? }] }]
-- room is a room's name in the same project (case- and space-insensitive).
-- Inserts everything or nothing. On invalid input raises 22023 with message 'import_stages: invalid rows'
-- and, as DETAIL, a JSON array of { row, field, code } (row is the 0-based index in p_rows; field e.g.
-- "end_date" or "tasks[2].room"). Returns { inserted_stages, inserted_tasks }.
create or replace function public.import_stages(p_project uuid, p_rows jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_errors jsonb := '[]'::jsonb;
  v_row jsonb;
  v_task jsonb;
  v_i int;
  v_j int;
  v_name text;
  v_start date;
  v_end date;
  v_room_name text;
  v_room_count int;
  v_key text;
  v_base text;
  v_n int;
  v_sort int;
  v_stage uuid;
  v_stages int := 0;
  v_tasks int := 0;
begin
  if p_project is null or not public.is_project_manager(p_project) then
    raise exception 'Only project managers can import stages' using errcode = '42501';
  end if;
  if p_rows is null or jsonb_typeof(p_rows) <> 'array' then
    raise exception 'import_stages: rows must be a JSON array' using errcode = '22023';
  end if;
  if jsonb_array_length(p_rows) > 500 then
    raise exception 'import_stages: at most 500 rows at a time' using errcode = '22023';
  end if;

  -- Validate every row first; nothing is written unless all of them pass.
  for v_i in 0 .. jsonb_array_length(p_rows) - 1 loop
    v_row := p_rows -> v_i;
    if jsonb_typeof(v_row) <> 'object' then
      v_errors := v_errors || jsonb_build_object('row', v_i, 'field', null, 'code', 'not_an_object');
      continue;
    end if;

    if nullif(btrim(coalesce(v_row ->> 'name', '')), '') is null then
      v_errors := v_errors || jsonb_build_object('row', v_i, 'field', 'name', 'code', 'required');
    end if;

    v_start := null;
    v_end := null;
    if coalesce(v_row ->> 'start_date', '') = '' then
      v_errors := v_errors || jsonb_build_object('row', v_i, 'field', 'start_date', 'code', 'required');
    elsif (v_row ->> 'start_date') !~ '^\d{4}-\d{2}-\d{2}$' then
      v_errors := v_errors || jsonb_build_object('row', v_i, 'field', 'start_date', 'code', 'invalid_date');
    else
      begin
        v_start := (v_row ->> 'start_date')::date;
      exception when others then
        v_errors := v_errors || jsonb_build_object('row', v_i, 'field', 'start_date', 'code', 'invalid_date');
      end;
    end if;
    if coalesce(v_row ->> 'end_date', '') = '' then
      v_errors := v_errors || jsonb_build_object('row', v_i, 'field', 'end_date', 'code', 'required');
    elsif (v_row ->> 'end_date') !~ '^\d{4}-\d{2}-\d{2}$' then
      v_errors := v_errors || jsonb_build_object('row', v_i, 'field', 'end_date', 'code', 'invalid_date');
    else
      begin
        v_end := (v_row ->> 'end_date')::date;
      exception when others then
        v_errors := v_errors || jsonb_build_object('row', v_i, 'field', 'end_date', 'code', 'invalid_date');
      end;
    end if;
    if v_start is not null and v_end is not null and v_end < v_start then
      v_errors := v_errors || jsonb_build_object('row', v_i, 'field', 'end_date', 'code', 'end_before_start');
    end if;

    if v_row -> 'client_note' is not null and jsonb_typeof(v_row -> 'client_note') not in ('string', 'null') then
      v_errors := v_errors || jsonb_build_object('row', v_i, 'field', 'client_note', 'code', 'invalid');
    end if;

    if coalesce(jsonb_typeof(v_row -> 'tasks'), 'null') <> 'null' then
      if jsonb_typeof(v_row -> 'tasks') <> 'array' then
        v_errors := v_errors || jsonb_build_object('row', v_i, 'field', 'tasks', 'code', 'not_an_array');
      else
        for v_j in 0 .. jsonb_array_length(v_row -> 'tasks') - 1 loop
          v_task := v_row -> 'tasks' -> v_j;
          if jsonb_typeof(v_task) <> 'object' then
            v_errors := v_errors || jsonb_build_object('row', v_i, 'field', format('tasks[%s]', v_j), 'code', 'not_an_object');
            continue;
          end if;
          if nullif(btrim(coalesce(v_task ->> 'name', '')), '') is null then
            v_errors := v_errors || jsonb_build_object('row', v_i, 'field', format('tasks[%s].name', v_j), 'code', 'required');
          end if;
          v_room_name := nullif(btrim(coalesce(v_task ->> 'room', '')), '');
          if v_room_name is not null then
            select count(*) into v_room_count from public.rooms r
            where r.project_id = p_project and lower(btrim(r.name)) = lower(v_room_name);
            if v_room_count = 0 then
              v_errors := v_errors || jsonb_build_object('row', v_i, 'field', format('tasks[%s].room', v_j), 'code', 'room_not_found');
            elsif v_room_count > 1 then
              v_errors := v_errors || jsonb_build_object('row', v_i, 'field', format('tasks[%s].room', v_j), 'code', 'room_ambiguous');
            end if;
          end if;
        end loop;
      end if;
    end if;
  end loop;

  if jsonb_array_length(v_errors) > 0 then
    raise exception 'import_stages: invalid rows' using errcode = '22023', detail = v_errors::text;
  end if;

  -- Insert. Stages go after the project's existing ones; keys are slugs, made unique with -2, -3, …
  select coalesce(max(s.sort_order), 0) into v_sort from public.stages s where s.project_id = p_project;
  for v_i in 0 .. jsonb_array_length(p_rows) - 1 loop
    v_row := p_rows -> v_i;
    v_name := btrim(v_row ->> 'name');
    v_base := private.slugify(v_name);
    v_key := v_base;
    v_n := 1;
    while exists (select 1 from public.stages s where s.project_id = p_project and s.key = v_key) loop
      v_n := v_n + 1;
      v_key := left(v_base, 24 - length(v_n::text) - 1) || '-' || v_n;
    end loop;
    v_sort := v_sort + 1;

    insert into public.stages (project_id, key, name, start_date, end_date, client_note, sort_order)
    values (p_project, v_key, v_name, (v_row ->> 'start_date')::date, (v_row ->> 'end_date')::date,
            coalesce(v_row ->> 'client_note', ''), v_sort)
    returning id into v_stage;
    v_stages := v_stages + 1;

    if jsonb_typeof(v_row -> 'tasks') = 'array' then
      for v_j in 0 .. jsonb_array_length(v_row -> 'tasks') - 1 loop
        v_task := v_row -> 'tasks' -> v_j;
        v_room_name := nullif(btrim(coalesce(v_task ->> 'room', '')), '');
        insert into public.tasks (project_id, stage_id, room_id, name, sort_order)
        values (
          p_project, v_stage,
          (select r.id from public.rooms r where r.project_id = p_project and lower(btrim(r.name)) = lower(v_room_name)),
          btrim(v_task ->> 'name'), v_j + 1
        );
        v_tasks := v_tasks + 1;
      end loop;
    end if;
  end loop;

  return jsonb_build_object('inserted_stages', v_stages, 'inserted_tasks', v_tasks);
end;
$$;

comment on function public.import_stages(uuid, jsonb) is
  'Managers: insert stages with nested tasks, all or nothing. Rows: [{ name, start_date, end_date, client_note?, '
  'tasks?: [{ name, room? (a room name in the project) }] }]. Returns { inserted_stages, inserted_tasks }; invalid '
  'input raises 22023 with DETAIL = JSON array of { row, field, code }.';

-- ---------------------------------------------------------------------------
-- Privileges: only the functions created here (no blanket revoke on schema private)
-- ---------------------------------------------------------------------------
revoke execute on function private.stage_task_progress(uuid) from public, anon, authenticated;
revoke execute on function private.stage_derived(uuid, public.work_status) from public, anon, authenticated;
revoke execute on function private.derive_stage_progress() from public, anon, authenticated;
revoke execute on function private.recompute_stage_progress(uuid) from public, anon, authenticated;
revoke execute on function private.refresh_stage_progress() from public, anon, authenticated;
revoke execute on function private.check_progress_entry_refs() from public, anon, authenticated;
revoke execute on function private.check_photo_progress_entry() from public, anon, authenticated;
revoke execute on function private.slugify(text) from public, anon, authenticated;

revoke execute on function public.import_stages(uuid, jsonb) from public, anon;
grant execute on function public.import_stages(uuid, jsonb) to authenticated;
