-- Photos can be linked to a single checklist task (as well as, or instead of, a whole stage and a room).
-- Managers set the link when uploading or editing a photo; the task must be in the photo's project, and a task
-- that belongs to a stage pulls the photo into that stage when none is given.

alter table public.photos add column task_id uuid references public.tasks (id) on delete set null;
create index photos_task_idx on public.photos (task_id) where task_id is not null;

comment on column public.photos.task_id is
  'The checklist task this photo documents (optional). Same project as the photo; its stage becomes the photo''s stage when none is set.';

create or replace function private.check_photo_task()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_project uuid;
  v_stage uuid;
begin
  if new.task_id is null then
    return new;
  end if;
  select t.project_id, t.stage_id into v_project, v_stage from public.tasks t where t.id = new.task_id;
  if v_project is distinct from new.project_id then
    raise exception 'Photo task must belong to the same project' using errcode = '23514';
  end if;
  if new.stage_id is null then
    new.stage_id := v_stage;
  end if;
  return new;
end;
$$;

create trigger check_photo_task before insert or update of project_id, task_id, stage_id on public.photos
for each row execute function private.check_photo_task();

revoke execute on function private.check_photo_task() from public, anon, authenticated;
