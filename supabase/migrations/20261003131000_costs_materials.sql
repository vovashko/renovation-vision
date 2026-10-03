-- Schema v2 for costs and materials (T31).
--
--   cost_category / expenses.category  the free-text category becomes an enum (labour, materials, permits,
--                                      disposal, equipment, other); existing rows are mapped case-insensitively,
--                                      anything unknown becomes 'other'
--   stage_budgets                      one row per stage with its planned cost. Internal: the project's managers
--                                      only, plus the restrictive staff-MFA policy. A separate table, not a
--                                      `stages.planned_cost` column, because clients read `stages` and column
--                                      privileges are per role: clients and managers are both `authenticated`,
--                                      so a column grant can't hide planned cost from clients only (see the PR).
--   materials                          what a project buys: quantity × unit price, a status, an optional stage,
--                                      room, supplier contact (T30's contacts book) and the expense that paid it.
--                                      Staff-internal, like expenses.
--   stage_costs                        view (security_invoker): planned, spent, committed and remaining per stage
--   import_materials(project, rows)    all-or-nothing bulk insert with per-row errors (used by T45)
--
-- Activity: materials and stage_budgets (updates) use the existing private.log_activity() trigger, unchanged.
-- Their entity labels/translations are added by the coordinator after both W4 tasks merge.
-- materials.progress_entry_id has no FK yet: T32 creates progress_entries in parallel; the FK follows the merge.

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type public.cost_category as enum ('labour', 'materials', 'permits', 'disposal', 'equipment', 'other');
create type public.material_status as enum ('planned', 'ordered', 'delivered', 'installed');

-- ---------------------------------------------------------------------------
-- expenses.category: text -> cost_category
-- ---------------------------------------------------------------------------
-- The mapping the backfill uses; kept as a function so tests/db/costs.test.sql can check it.
create or replace function private.cost_category_from_text(p_value text)
returns public.cost_category language sql immutable set search_path = '' as $$
  select case lower(btrim(coalesce(p_value, '')))
    when 'labour' then 'labour'
    when 'labor' then 'labour'
    when 'materials' then 'materials'
    when 'material' then 'materials'
    when 'permits' then 'permits'
    when 'permit' then 'permits'
    when 'disposal' then 'disposal'
    when 'equipment' then 'equipment'
    else 'other'
  end::public.cost_category;
$$;

-- A type change is a data migration, not a user edit: keep it out of the activity log.
alter table public.expenses disable trigger log_activity;
alter table public.expenses alter column category drop default;
alter table public.expenses
  alter column category type public.cost_category using private.cost_category_from_text(category);
alter table public.expenses alter column category set default 'other';
alter table public.expenses enable trigger log_activity;

-- ---------------------------------------------------------------------------
-- stage_budgets: planned cost per stage (manager-only)
-- ---------------------------------------------------------------------------
create table public.stage_budgets (
  stage_id uuid primary key references public.stages (id) on delete cascade,
  -- Denormalised from the stage (kept in sync by trigger) so RLS and the activity log are a single lookup.
  project_id uuid not null references public.projects (id) on delete cascade,
  planned_cost numeric(12, 2) not null default 0 check (planned_cost >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index stage_budgets_project_idx on public.stage_budgets (project_id);

create or replace function private.sync_stage_budget_project()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  select s.project_id into new.project_id from public.stages s where s.id = new.stage_id;
  return new;
end;
$$;

create trigger sync_stage_budget_project before insert or update of stage_id, project_id on public.stage_budgets
for each row execute function private.sync_stage_budget_project();

create trigger set_updated_at before update on public.stage_budgets
for each row execute function private.set_updated_at();

-- Every stage has exactly one budget row (planned cost 0 until a manager sets it), so stage_costs can
-- inner-join it and return nothing to anyone who can't read budgets.
create or replace function private.create_stage_budget()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.stage_budgets (stage_id, project_id) values (new.id, new.project_id)
  on conflict (stage_id) do nothing;
  return null;
end;
$$;

create trigger create_stage_budget after insert on public.stages
for each row execute function private.create_stage_budget();

insert into public.stage_budgets (stage_id, project_id)
select s.id, s.project_id from public.stages s
on conflict (stage_id) do nothing;

-- Planned-cost changes go to the activity log. Not inserts (created with the stage, which is logged
-- itself) and not deletes (they cascade from the stage).
create trigger log_activity after update on public.stage_budgets
for each row execute function private.log_activity();

-- ---------------------------------------------------------------------------
-- materials
-- ---------------------------------------------------------------------------
create table public.materials (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  stage_id uuid references public.stages (id) on delete set null,
  room_id uuid references public.rooms (id) on delete set null,
  name text not null check (length(trim(name)) > 0),
  supplier_contact_id uuid references public.contacts (id) on delete set null,
  quantity numeric(12, 3) not null default 1 check (quantity > 0),
  unit text not null default 'pcs' check (length(btrim(unit)) between 1 and 16),
  unit_price numeric(12, 2) not null default 0 check (unit_price >= 0),
  status public.material_status not null default 'planned',
  -- The expense that paid for it. Linked materials count as spent (through the expense), never as committed.
  expense_id uuid references public.expenses (id) on delete set null,
  -- The site-diary entry it was used in (T32). The FK to progress_entries is added after T32 merges.
  progress_entry_id uuid,
  notes text not null default '',
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index materials_project_idx on public.materials (project_id, created_at);
create index materials_stage_idx on public.materials (stage_id) where stage_id is not null;
create index materials_room_idx on public.materials (room_id) where room_id is not null;
create index materials_expense_idx on public.materials (expense_id) where expense_id is not null;
create index materials_supplier_idx on public.materials (supplier_contact_id) where supplier_contact_id is not null;

-- The stage, room and expense must belong to the material's project (FK checks bypass RLS).
-- The supplier is a company-wide contact, so any contact is fine.
create or replace function private.guard_material_refs()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.stage_id is not null and not exists (
    select 1 from public.stages s where s.id = new.stage_id and s.project_id = new.project_id
  ) then
    raise exception 'Material stage must belong to the same project' using errcode = '23514';
  end if;
  if new.room_id is not null and not exists (
    select 1 from public.rooms r where r.id = new.room_id and r.project_id = new.project_id
  ) then
    raise exception 'Material room must belong to the same project' using errcode = '23514';
  end if;
  if new.expense_id is not null and not exists (
    select 1 from public.expenses e where e.id = new.expense_id and e.project_id = new.project_id
  ) then
    raise exception 'Material expense must belong to the same project' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger guard_material_refs before insert or update of project_id, stage_id, room_id, expense_id
on public.materials for each row execute function private.guard_material_refs();

create trigger set_updated_at before update on public.materials
for each row execute function private.set_updated_at();

create trigger log_activity after insert or update or delete on public.materials
for each row execute function private.log_activity();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.stage_budgets enable row level security;
alter table public.materials enable row level security;

-- stage_budgets: the project's managers read and set planned costs. No delete: the row lives and dies
-- with its stage (set the planned cost to 0 instead).
create policy "stage_budgets: managers read" on public.stage_budgets
for select to authenticated using (public.is_project_manager(project_id));
create policy "stage_budgets: managers insert" on public.stage_budgets
for insert to authenticated with check (public.is_project_manager(project_id));
create policy "stage_budgets: managers update" on public.stage_budgets
for update to authenticated
using (public.is_project_manager(project_id)) with check (public.is_project_manager(project_id));

-- materials: the project's managers only (like expenses); clients have no policy.
create policy "materials: managers all" on public.materials
for all to authenticated
using (public.is_project_manager(project_id)) with check (public.is_project_manager(project_id));

-- Internal data: staff need an MFA-verified session while enforcement is on.
do $$
declare t text;
begin
  foreach t in array array['stage_budgets', 'materials'] loop
    execute format(
      'create policy "%1$s: staff mfa" on public.%1$I as restrictive for all to authenticated
         using ((select private.staff_mfa_ok())) with check ((select private.staff_mfa_ok()))', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- stage_costs: planned / spent / committed / remaining per stage
-- ---------------------------------------------------------------------------
-- security_invoker: the caller's RLS applies to every table below. It starts from stage_budgets, so a
-- client (no budget rows) and an AAL1 manager while 2FA is enforced get no rows at all, rather than
-- stages with zeroes.
--   spent      sum of the stage's expenses
--   committed  materials ordered or delivered but not linked to an expense yet (quantity × unit price);
--              once linked, the expense counts them as spent, so nothing is counted twice
--   remaining  planned − spent − committed (negative when over)
create view public.stage_costs
with (security_invoker = true) as
select
  b.project_id,
  b.stage_id,
  b.planned_cost as planned,
  coalesce(e.spent, 0)::numeric(12, 2) as spent,
  coalesce(m.committed, 0)::numeric(12, 2) as committed,
  (b.planned_cost - coalesce(e.spent, 0) - coalesce(m.committed, 0))::numeric(12, 2) as remaining
from public.stage_budgets b
join public.stages s on s.id = b.stage_id
left join lateral (
  select sum(x.amount) as spent from public.expenses x where x.stage_id = b.stage_id
) e on true
left join lateral (
  select round(sum(x.quantity * x.unit_price), 2) as committed
  from public.materials x
  where x.stage_id = b.stage_id and x.status in ('ordered', 'delivered') and x.expense_id is null
) m on true;

-- ---------------------------------------------------------------------------
-- import_materials: all-or-nothing bulk insert
-- ---------------------------------------------------------------------------
-- p_rows: a JSON array of objects
--   { "name": text (required), "quantity": number (default 1, > 0), "unit": text (default 'pcs', 1–16 chars),
--     "unit_price": number (default 0, >= 0), "status": planned|ordered|delivered|installed (default planned),
--     "stage": stage name, "room": room name, "supplier": contact name or company, "notes": text }
-- Numbers may be JSON numbers or strings ("12,5" works). Names match case-insensitively: stage and room
-- within the project, supplier in the company's contacts (a supplier-kind contact wins a tie).
-- Returns { "inserted": n }. Otherwise nothing is inserted and it raises 22023 with DETAIL set to a JSON
-- array of { "row": 1-based position in p_rows, "field", "message" }, where message is a stable code:
--   required | not_a_number | must_be_positive | must_not_be_negative | too_large | too_long | invalid_unit
--   | invalid_status | not_found | ambiguous | not_an_object
create or replace function public.import_materials(p_project uuid, p_rows jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_errors jsonb := '[]'::jsonb;
  v_valid jsonb := '[]'::jsonb;
  v_row jsonb;
  v_i int := 0;
  v_name text;
  v_qty_text text;
  v_price_text text;
  v_qty numeric;
  v_price numeric;
  v_unit text;
  v_status_text text;
  v_ref text;
  v_stage uuid;
  v_room uuid;
  v_supplier uuid;
  v_count int;
  v_inserted int := 0;
  v_row_errors int;
begin
  if not public.is_project_manager(p_project) then
    raise exception 'Only project managers can import materials' using errcode = '42501';
  end if;
  if not private.staff_mfa_ok() then
    raise exception 'Two-factor verification required' using errcode = '42501';
  end if;
  if p_rows is null or jsonb_typeof(p_rows) <> 'array' then
    raise exception 'p_rows must be a JSON array' using errcode = '22023';
  end if;
  if jsonb_array_length(p_rows) > 2000 then
    raise exception 'Import at most 2000 rows at a time' using errcode = '22023';
  end if;

  for v_row in select value from jsonb_array_elements(p_rows) loop
    v_i := v_i + 1;
    v_row_errors := jsonb_array_length(v_errors);
    v_stage := null; v_room := null; v_supplier := null; v_qty := 1; v_price := 0;

    if jsonb_typeof(v_row) <> 'object' then
      v_errors := v_errors || jsonb_build_object('row', v_i, 'field', null, 'message', 'not_an_object');
      continue;
    end if;

    -- name
    v_name := btrim(coalesce(v_row ->> 'name', ''));
    if v_name = '' then
      v_errors := v_errors || jsonb_build_object('row', v_i, 'field', 'name', 'message', 'required');
    elsif length(v_name) > 200 then
      v_errors := v_errors || jsonb_build_object('row', v_i, 'field', 'name', 'message', 'too_long');
    end if;

    -- quantity
    v_qty_text := replace(btrim(coalesce(v_row ->> 'quantity', '')), ',', '.');
    if v_qty_text <> '' then
      if v_qty_text !~ '^[+-]?([0-9]+([.][0-9]*)?|[.][0-9]+)$' then
        v_errors := v_errors || jsonb_build_object('row', v_i, 'field', 'quantity', 'message', 'not_a_number');
      else
        v_qty := v_qty_text::numeric;
        if v_qty <= 0 then
          v_errors := v_errors || jsonb_build_object('row', v_i, 'field', 'quantity', 'message', 'must_be_positive');
        elsif round(v_qty, 3) >= 1e9 then
          v_errors := v_errors || jsonb_build_object('row', v_i, 'field', 'quantity', 'message', 'too_large');
        elsif round(v_qty, 3) = 0 then
          v_errors := v_errors || jsonb_build_object('row', v_i, 'field', 'quantity', 'message', 'must_be_positive');
        end if;
      end if;
    end if;

    -- unit_price
    v_price_text := replace(btrim(coalesce(v_row ->> 'unit_price', '')), ',', '.');
    if v_price_text <> '' then
      if v_price_text !~ '^[+-]?([0-9]+([.][0-9]*)?|[.][0-9]+)$' then
        v_errors := v_errors || jsonb_build_object('row', v_i, 'field', 'unit_price', 'message', 'not_a_number');
      else
        v_price := v_price_text::numeric;
        if v_price < 0 then
          v_errors := v_errors || jsonb_build_object('row', v_i, 'field', 'unit_price', 'message', 'must_not_be_negative');
        elsif round(v_price, 2) >= 1e10 then
          v_errors := v_errors || jsonb_build_object('row', v_i, 'field', 'unit_price', 'message', 'too_large');
        end if;
      end if;
    end if;

    -- unit (same rule as the table's check)
    v_unit := coalesce(nullif(btrim(coalesce(v_row ->> 'unit', '')), ''), 'pcs');
    if length(v_unit) > 16 then
      v_errors := v_errors || jsonb_build_object('row', v_i, 'field', 'unit', 'message', 'invalid_unit');
    end if;

    -- status
    v_status_text := lower(btrim(coalesce(v_row ->> 'status', '')));
    if v_status_text = '' then
      v_status_text := 'planned';
    elsif not v_status_text = any (enum_range(null::public.material_status)::text[]) then
      v_errors := v_errors || jsonb_build_object('row', v_i, 'field', 'status', 'message', 'invalid_status');
    end if;

    -- stage, by name within the project
    v_ref := lower(btrim(coalesce(v_row ->> 'stage', '')));
    if v_ref <> '' then
      select count(*), min(s.id::text)::uuid into v_count, v_stage
      from public.stages s where s.project_id = p_project and lower(btrim(s.name)) = v_ref;
      if v_count <> 1 then
        v_errors := v_errors || jsonb_build_object('row', v_i, 'field', 'stage',
          'message', case when v_count = 0 then 'not_found' else 'ambiguous' end);
      end if;
    end if;

    -- room, by name within the project
    v_ref := lower(btrim(coalesce(v_row ->> 'room', '')));
    if v_ref <> '' then
      select count(*), min(r.id::text)::uuid into v_count, v_room
      from public.rooms r where r.project_id = p_project and lower(btrim(r.name)) = v_ref;
      if v_count <> 1 then
        v_errors := v_errors || jsonb_build_object('row', v_i, 'field', 'room',
          'message', case when v_count = 0 then 'not_found' else 'ambiguous' end);
      end if;
    end if;

    -- supplier, by contact name or company in the company's contacts; suppliers win a tie
    v_ref := lower(btrim(coalesce(v_row ->> 'supplier', '')));
    if v_ref <> '' then
      select count(*), min(c.id::text)::uuid into v_count, v_supplier
      from public.contacts c
      where (lower(btrim(c.full_name)) = v_ref or lower(btrim(coalesce(c.company, ''))) = v_ref)
        and (c.kind = 'supplier' or not exists (
          select 1 from public.contacts c2
          where c2.kind = 'supplier'
            and (lower(btrim(c2.full_name)) = v_ref or lower(btrim(coalesce(c2.company, ''))) = v_ref)));
      if v_count <> 1 then
        v_errors := v_errors || jsonb_build_object('row', v_i, 'field', 'supplier',
          'message', case when v_count = 0 then 'not_found' else 'ambiguous' end);
      end if;
    end if;

    if jsonb_array_length(v_errors) = v_row_errors then
      v_valid := v_valid || jsonb_build_object(
        'name', v_name, 'quantity', round(v_qty, 3), 'unit', v_unit, 'unit_price', round(v_price, 2),
        'status', v_status_text, 'stage_id', v_stage, 'room_id', v_room, 'supplier_contact_id', v_supplier,
        'notes', coalesce(v_row ->> 'notes', ''));
    end if;
  end loop;

  if jsonb_array_length(v_errors) > 0 then
    raise exception 'Invalid material rows: %', jsonb_array_length(v_errors)
      using errcode = '22023', detail = v_errors::text;
  end if;

  insert into public.materials (project_id, name, quantity, unit, unit_price, status, stage_id, room_id,
                                supplier_contact_id, notes, created_by)
  select p_project, r ->> 'name', (r ->> 'quantity')::numeric, r ->> 'unit', (r ->> 'unit_price')::numeric,
         (r ->> 'status')::public.material_status, (r ->> 'stage_id')::uuid, (r ->> 'room_id')::uuid,
         (r ->> 'supplier_contact_id')::uuid, r ->> 'notes', auth.uid()
  from jsonb_array_elements(v_valid) with ordinality as t (r, n)
  order by t.n;
  get diagnostics v_inserted = row_count;

  return jsonb_build_object('inserted', v_inserted);
end;
$$;

-- ---------------------------------------------------------------------------
-- Privileges (only the objects created here; no blanket revokes)
-- ---------------------------------------------------------------------------
revoke all on public.stage_budgets, public.materials, public.stage_costs from anon;
grant select, insert, update, delete on public.materials to authenticated;
grant select, insert on public.stage_budgets to authenticated;
revoke update, delete on public.stage_budgets from authenticated;
grant update (planned_cost) on public.stage_budgets to authenticated;
grant select on public.stage_costs to authenticated;

revoke execute on function private.cost_category_from_text(text) from public, anon, authenticated;
revoke execute on function private.sync_stage_budget_project() from public, anon, authenticated;
revoke execute on function private.create_stage_budget() from public, anon, authenticated;
revoke execute on function private.guard_material_refs() from public, anon, authenticated;

revoke execute on function public.import_materials(uuid, jsonb) from public, anon;
grant execute on function public.import_materials(uuid, jsonb) to authenticated;
