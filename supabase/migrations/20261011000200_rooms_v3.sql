-- Floor plan v3 (T64): the plan is a fixed layout by room count, so rooms keep only their width and length
-- (metres) as specs, and the never-used plan background image goes away.
--
--   projects.plan_image_path/_opts   dropped, with their column grant (dropped with the columns)
--   "media: clients read plans"      dropped (storage policy for <project_id>/plans/ in project-media)
--   project_summary                  recreated without the two columns; every other column keeps its position
--   rooms.w / rooms.h                comments: specs, not layout input
--
-- Room deletion needs no schema change: private.delete_room_only_tasks (20261006000200) already deletes the
-- room's room-only works; photos, renders, materials and diary entries are SET NULL, warnings CASCADE. The
-- documents.room_id block (installation photos, NO ACTION) goes away with T62.
-- private.log_activity is not touched; no function is added, so no privilege changes.

drop policy "media: clients read plans" on storage.objects;

-- The view depends on the columns, so it is dropped first; the grants are restored as the earlier migrations had them.
drop view public.project_summary;

alter table public.projects
  drop column plan_image_path,
  drop column plan_image_opts;

create view public.project_summary
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
  coalesce(round(avg(s.progress))::integer, 0) as overall_progress,
  count(s.id) filter (where s.status = 'done'::public.work_status)::integer as stages_done,
  count(s.id)::integer as stages_total,
  (
    select s2.name from public.stages s2
    where s2.project_id = p.id and s2.status = 'progress'::public.work_status
    order by s2.sort_order limit 1
  ) as current_stage,
  (
    select pr.full_name from public.project_members m
    join public.profiles pr on pr.id = m.user_id
    where m.project_id = p.id and m.role = 'manager'::public.project_role
    order by m.created_at limit 1
  ) as manager_name,
  (
    select c.full_name from public.project_contacts pc
    join public.contacts c on c.id = pc.contact_id
    where pc.project_id = p.id and pc.role = 'client'::public.project_contact_role
    order by pc.is_primary desc, pc.sort_order, pc.created_at limit 1
  ) as client_display_name,
  p.planned_target_date,
  p.planned_budget,
  (
    select m.role from public.project_members m
    where m.project_id = p.id and m.user_id = (select auth.uid())
  ) as my_role
from public.projects p
left join public.stages s on s.project_id = p.id
group by p.id;

revoke all on public.project_summary from anon, authenticated;
grant select on public.project_summary to authenticated;

comment on column public.rooms.w is 'Room width in metres: a spec shown in the room form and room view. The plan layout ignores it.';
comment on column public.rooms.h is 'Room length in metres: a spec shown in the room form and room view. The plan layout ignores it.';
