-- Planned baseline vs current for the end date and the budget (#53, #54).
--
--   projects.target_date / budget            now mean the CURRENT end date and the projected (current) budget
--   projects.planned_target_date/_budget     the baseline agreed before the project started
--
-- The baseline is filled automatically on insert (so create_project and the seed get one without changes) and
-- is only editable while the project is still in 'planning'; once it has started it is locked by a trigger.

alter table public.projects
  add column planned_target_date date,
  add column planned_budget numeric(12,2) not null default 0 check (planned_budget >= 0);

comment on column public.projects.target_date is
  'The CURRENT end date (the forecast). The original plan is planned_target_date.';
comment on column public.projects.budget is
  'The projected (current) budget in the project''s currency. The original plan is planned_budget.';
comment on column public.projects.planned_target_date is
  'The planned (baseline) end date. Defaults to target_date on insert; editable only while status = ''planning''.';
comment on column public.projects.planned_budget is
  'The planned (baseline) budget in the project''s currency. Defaults to budget on insert; editable only while status = ''planning''.';

-- Existing projects: the baseline is what they currently say.
update public.projects set planned_target_date = target_date, planned_budget = budget;

-- Insert: a missing baseline is copied from the current values.
create or replace function private.projects_default_baseline()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.planned_target_date is null then
    new.planned_target_date := new.target_date;
  end if;
  if new.planned_budget = 0 and new.budget > 0 then
    new.planned_budget := new.budget;
  end if;
  return new;
end;
$$;

create trigger projects_default_baseline before insert on public.projects
  for each row execute function private.projects_default_baseline();

-- Update: the baseline can only change while the project is still being planned.
create or replace function private.projects_lock_baseline()
returns trigger language plpgsql set search_path = '' as $$
begin
  if (new.planned_target_date is distinct from old.planned_target_date
      or new.planned_budget is distinct from old.planned_budget)
     and old.status <> 'planning' then
    raise exception 'The planned end date and budget are locked once the project has started'
      using errcode = '23514', hint = 'baseline_locked';
  end if;
  return new;
end;
$$;

create trigger projects_lock_baseline before update on public.projects
  for each row execute function private.projects_lock_baseline();

-- Trigger functions are never called directly.
revoke execute on function private.projects_default_baseline() from public, anon, authenticated;
revoke execute on function private.projects_lock_baseline() from public, anon, authenticated;

-- projects column-grant pattern: the baseline is editable (the trigger above decides when).
grant update (planned_target_date, planned_budget) on public.projects to authenticated;

-- project_summary gains the baseline (appended, so create or replace keeps the grants).
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
  p.plan_image_opts,
  p.planned_target_date,
  p.planned_budget
from public.projects p
left join public.stages s on s.project_id = p.id
group by p.id;
