-- Cost breakdown for clients and managers, and "mark delivered -> create expense" (T42).
--
--   project_cost_breakdown(project)   aggregates only, for any member of the project (decision 10):
--                                     planned and spent per stage (visible stages only for a client), and spent per
--                                     cost category. A security-definer function because clients can't read
--                                     stage_budgets or expenses. Managers also get `committed` per stage and every
--                                     stage; clients get committed = null. No expense rows, vendors or receipts.
--   mark_material_delivered(...)      security invoker (the caller's RLS applies): sets a material to delivered and
--                                     creates the expense that pays for it, linked through materials.expense_id.
--                                     Refuses a material that already has an expense, so it can't be counted twice.
-- Does not touch private.log_activity; the expense and material triggers log the change as usual.

create or replace function public.project_cost_breakdown(p_project uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_manager boolean := public.is_project_manager(p_project);
  v_client boolean := public.is_project_client(p_project);
  v_stages jsonb;
  v_categories jsonb;
begin
  if not (v_manager or v_client) then
    raise exception 'Not a member of this project' using errcode = '42501';
  end if;
  if v_manager and not private.staff_mfa_ok() then
    raise exception 'Two-factor verification required' using errcode = '42501';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'stage_id', s.id,
           'name', s.name,
           'planned', coalesce(b.planned_cost, 0),
           'spent', coalesce(e.spent, 0),
           'committed', case when v_manager then coalesce(m.committed, 0) else null end
         ) order by s.sort_order, s.created_at), '[]'::jsonb)
    into v_stages
  from public.stages s
  left join public.stage_budgets b on b.stage_id = s.id
  left join lateral (select sum(x.amount) as spent from public.expenses x where x.stage_id = s.id) e on true
  left join lateral (
    select round(sum(x.quantity * x.unit_price), 2) as committed
    from public.materials x
    where x.stage_id = s.id and x.status in ('ordered', 'delivered') and x.expense_id is null
  ) m on true
  where s.project_id = p_project and (v_manager or s.is_visible);

  -- Every expense of the project, so the categories add up to the Spent total the client already sees.
  select coalesce(jsonb_agg(jsonb_build_object('category', c.category, 'spent', c.spent) order by c.category), '[]'::jsonb)
    into v_categories
  from (
    select x.category, sum(x.amount) as spent from public.expenses x where x.project_id = p_project group by x.category
  ) c;

  return jsonb_build_object('stages', v_stages, 'categories', v_categories);
end;
$$;

comment on function public.project_cost_breakdown(uuid) is
  'Planned/spent per stage and spent per category: aggregates only. Clients: visible stages, no committed. Managers: all stages with committed.';

create or replace function public.mark_material_delivered(p_material uuid, p_amount numeric, p_spent_on date default current_date)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare
  m public.materials;
  v_vendor text;
  v_expense uuid;
begin
  select * into m from public.materials where id = p_material for update;
  if not found then
    raise exception 'Material not found' using errcode = '42501';
  end if;
  if m.expense_id is not null then
    raise exception 'This material already has an expense' using errcode = '23505';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'The expense amount must be positive' using errcode = '23514';
  end if;

  select coalesce(nullif(btrim(c.company), ''), c.full_name) into v_vendor
  from public.contacts c where c.id = m.supplier_contact_id;

  insert into public.expenses (project_id, stage_id, category, description, vendor, amount, spent_on, created_by)
  values (m.project_id, m.stage_id, 'materials', m.name, coalesce(v_vendor, ''), round(p_amount, 2),
          coalesce(p_spent_on, current_date), auth.uid())
  returning id into v_expense;

  update public.materials
     set status = 'delivered', expense_id = v_expense, delivery_date = coalesce(delivery_date, current_date)
   where id = m.id;
  return v_expense;
end;
$$;

comment on function public.mark_material_delivered(uuid, numeric, date) is
  'Sets a material to delivered and creates its materials expense (linked via expense_id). Refuses a material that already has one.';

revoke execute on function public.project_cost_breakdown(uuid) from public, anon;
grant execute on function public.project_cost_breakdown(uuid) to authenticated;
revoke execute on function public.mark_material_delivered(uuid, numeric, date) from public, anon;
grant execute on function public.mark_material_delivered(uuid, numeric, date) to authenticated;
