-- Demo seed: "Maple Street Apartment", exactly as the Renovision client app shows it,
-- with two data inconsistencies fixed. All the dates below are written as if "today"
-- were 2026-04-20; a block at the end of this file shifts every one of them by
-- `current_date - date '2026-04-20'`, so the same timeline (finished stages behind,
-- one in-progress stage straddling today, pending stages ahead) lands on the real
-- current date instead of a hardcoded one.
--
--   1. Bedroom 2 is Blocked, but the project said "On schedule".
--      -> schedule_status = 'at_risk' with a note explaining the block.
--   2. Bathroom was Completed at 100% while the "Bathroom tiling" task was unchecked.
--      -> Bathroom is In progress at 80%; "Bathroom tiling" is linked to the Bathroom room.
--         The guard_room_done trigger now prevents this state from recurring.
--   3. Kitchen was Pending at 10%, but pending always means 0% (state follows progress).
--      -> Kitchen is In progress at 10%.
--
-- Demo logins (password for all: renovision-demo)
--   jonas@renovision.demo  manager (Jonas Weber)       language pl
--   sarah@renovision.demo  client  (Sarah Bennett)     language pl
--   tom@renovision.demo    client  (Tom Bennett)       language en (so both languages are exercised)
--   admin@renovision.demo  admin   (Renovision Admin; not on any project, changes account types)  language pl
--
-- Image files are uploaded separately: `node supabase/scripts/upload-seed-media.mjs`.
-- Triggers are disabled while seeding so the audit trail and notifications below are curated.

set session_replication_role = replica;

-- ---------------------------------------------------------------------------
-- Staff 2FA enforcement: OFF for the local and hosted-demo databases only.
-- Migrations turn it ON (the production default), but the demo manager has no TOTP factor, so
-- with it on he could not read the budget, internal notes, contacts or activity log. Never run this
-- against production. See README "Roles & 2FA enforcement".
-- ---------------------------------------------------------------------------
update private.app_settings set enforce_staff_mfa = false;

-- ---------------------------------------------------------------------------
-- Users
-- ---------------------------------------------------------------------------
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
)
select
  '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated', u.email,
  extensions.crypt('renovision-demo', extensions.gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  -- user_metadata.locale mirrors profiles.locale (the auth email templates read it).
  jsonb_build_object('full_name', u.full_name, 'locale', u.locale), now(), now(), '', '', '', ''
from (values
  ('a0000000-0000-4000-8000-000000000001'::uuid, 'jonas@renovision.demo', 'Jonas Weber', 'pl'),
  ('a0000000-0000-4000-8000-000000000002'::uuid, 'sarah@renovision.demo', 'Sarah Bennett', 'pl'),
  ('a0000000-0000-4000-8000-000000000003'::uuid, 'tom@renovision.demo', 'Tom Bennett', 'en'),
  ('a0000000-0000-4000-8000-000000000004'::uuid, 'admin@renovision.demo', 'Renovision Admin', 'pl')
) as u (id, email, full_name, locale)
on conflict (id) do nothing;

insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select gen_random_uuid(), u.id, u.id::text,
       jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
       'email', now(), now(), now()
from auth.users u
where u.email like '%@renovision.demo'
  and not exists (select 1 from auth.identities i where i.user_id = u.id and i.provider = 'email');

insert into public.profiles (id, full_name, account_type, locale) values
  ('a0000000-0000-4000-8000-000000000001', 'Jonas Weber', 'manager', 'pl'),
  ('a0000000-0000-4000-8000-000000000002', 'Sarah Bennett', 'client', 'pl'),
  ('a0000000-0000-4000-8000-000000000003', 'Tom Bennett', 'client', 'en'),
  ('a0000000-0000-4000-8000-000000000004', 'Renovision Admin', 'admin', 'pl')
on conflict (id) do update
  set full_name = excluded.full_name, account_type = excluded.account_type, locale = excluded.locale;

-- ---------------------------------------------------------------------------
-- Project
-- ---------------------------------------------------------------------------
-- address is generated from address_line / postal_code / city; amounts are in the project's currency.
insert into public.projects (
  id, name, address_line, postal_code, city, country, currency, status, start_date, target_date, budget, spent,
  schedule_status, schedule_note, created_by
) values (
  'b0000000-0000-4000-8000-000000000001', 'Maple Street Apartment', '42 Maple Street, Apt 5B', '', '', 'PL', 'PLN', 'active',
  '2026-03-02', '2026-06-10', 84500, 51200,
  'at_risk',
  'Bedroom 2 is blocked until the electrical inspector signs off the new circuit. The Jun 10 target still holds if sign-off arrives this week.',
  'a0000000-0000-4000-8000-000000000001'
);

insert into public.project_internal (project_id, internal_budget_notes) values (
  'b0000000-0000-4000-8000-000000000001',
  E'Contingency: $4,000 held for Bedroom 2 rework if the circuit fails inspection.\nKitchen cabinets quote $14,800 — 30% deposit due May 1.\nKeep margin at or above 12%; oak planks came in $350 under quote.'
);

insert into public.project_members (project_id, user_id, role, last_read_at) values
  ('b0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'manager', '2026-04-20 09:25:00'),
  ('b0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000002', 'client', '2026-04-20 09:25:00'),
  ('b0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000003', 'client', '2026-04-19 18:00:00');

-- ---------------------------------------------------------------------------
-- Contacts (the company address book) and who is on this project. Staff only, except the PoC row
-- marked visible_to_client, which the client reads through project_visible_contacts().
-- Example numbers and addresses.
-- ---------------------------------------------------------------------------
insert into public.contacts (id, kind, full_name, trade, phone, whatsapp, email, user_id, created_by) values
  ('10000000-0000-4000-8000-000000000001', 'other', 'Jonas Weber', 'Project manager', '+1 555 0100', null, 'jonas@renovision.demo', 'a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001'),
  ('10000000-0000-4000-8000-000000000002', 'client', 'Sarah & Tom Bennett', null, '+1 555 0142', null, 'sarah.bennett@example.com', null, 'a0000000-0000-4000-8000-000000000001'),
  ('10000000-0000-4000-8000-000000000003', 'crew', 'Marek Nowak', 'Site lead', '+1 555 0107', '+15550107', 'marek@example.com', null, 'a0000000-0000-4000-8000-000000000001'),
  ('10000000-0000-4000-8000-000000000004', 'crew', 'Ana Petrović', 'Electrician', '+1 555 0118', null, 'ana@example.com', null, 'a0000000-0000-4000-8000-000000000001'),
  ('10000000-0000-4000-8000-000000000005', 'crew', 'Luis Ortega', 'Plumber', '+1 555 0123', null, 'luis@example.com', null, 'a0000000-0000-4000-8000-000000000001'),
  ('10000000-0000-4000-8000-000000000006', 'crew', 'Kai Jensen', 'Drywall & paint', '+1 555 0136', null, null, null, 'a0000000-0000-4000-8000-000000000001');

insert into public.project_contacts (project_id, contact_id, role, is_primary, visible_to_client, sort_order) values
  ('b0000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'poc', true, true, 0),
  ('b0000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000002', 'client', true, false, 0),
  ('b0000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000003', 'crew', false, false, 1),
  ('b0000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000004', 'crew', false, false, 2),
  ('b0000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000005', 'crew', false, false, 3),
  ('b0000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000006', 'crew', false, false, 4);

-- ---------------------------------------------------------------------------
-- Rooms (same geometry as the client app's floor plan)
-- ---------------------------------------------------------------------------
insert into public.rooms (id, project_id, key, name, status, progress, x, y, w, h, sort_order, client_note) values
  ('d0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 'living', 'Living Room', 'progress', 60, 20, 20, 320, 220, 1, 'Drywall finished; taping and priming this week.'),
  ('d0000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000001', 'kitchen', 'Kitchen', 'progress', 10, 340, 20, 240, 140, 2, 'New circuit panel in place. Cabinets arrive for the Kitchen Install stage.'),
  ('d0000000-0000-4000-8000-000000000003', 'b0000000-0000-4000-8000-000000000001', 'dining', 'Dining', 'progress', 45, 340, 160, 240, 80, 3, 'Walls boarded and insulated.'),
  ('d0000000-0000-4000-8000-000000000004', 'b0000000-0000-4000-8000-000000000001', 'bath', 'Bathroom', 'progress', 80, 20, 240, 160, 160, 4, 'Plumbing re-routed and signed off. Tiling follows with the flooring stage.'),
  ('d0000000-0000-4000-8000-000000000005', 'b0000000-0000-4000-8000-000000000001', 'bed1', 'Bedroom 1', 'progress', 35, 180, 240, 200, 160, 5, 'Subfloor levelled; oak planks acclimatising.'),
  ('d0000000-0000-4000-8000-000000000006', 'b0000000-0000-4000-8000-000000000001', 'bed2', 'Bedroom 2', 'blocked', 15, 380, 240, 200, 160, 6, 'Waiting on the electrical inspector to sign off the new circuit before the walls can be closed.');

-- ---------------------------------------------------------------------------
-- Stages (2026 dates, same progress as the client app)
-- ---------------------------------------------------------------------------
insert into public.stages (id, project_id, key, name, status, progress, start_date, end_date, sort_order) values
  ('c0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 'demo', 'Demolition', 'done', 100, '2026-03-02', '2026-03-14', 1),
  ('c0000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000001', 'elec', 'Electrical & Plumbing', 'done', 100, '2026-03-15', '2026-04-02', 2),
  ('c0000000-0000-4000-8000-000000000003', 'b0000000-0000-4000-8000-000000000001', 'wall', 'Walls & Insulation', 'progress', 65, '2026-04-03', '2026-04-24', 3),
  ('c0000000-0000-4000-8000-000000000004', 'b0000000-0000-4000-8000-000000000001', 'floor', 'Flooring', 'progress', 20, '2026-04-18', '2026-05-08', 4),
  ('c0000000-0000-4000-8000-000000000005', 'b0000000-0000-4000-8000-000000000001', 'kitch', 'Kitchen Install', 'pending', 0, '2026-05-09', '2026-05-22', 5),
  ('c0000000-0000-4000-8000-000000000006', 'b0000000-0000-4000-8000-000000000001', 'paint', 'Painting & Finishes', 'pending', 0, '2026-05-23', '2026-06-05', 6),
  ('c0000000-0000-4000-8000-000000000007', 'b0000000-0000-4000-8000-000000000001', 'final', 'Final Inspection', 'pending', 0, '2026-06-06', '2026-06-10', 7);

insert into public.tasks (project_id, stage_id, room_id, name, done, completed_at, sort_order)
select 'b0000000-0000-4000-8000-000000000001', s.id, r.id, t.name, t.done,
       case when t.done then s.end_date::timestamptz end, t.ord
from (values
  ('demo', null, 'Remove old flooring', true, 1),
  ('demo', 'living', 'Tear down partition wall', true, 2),
  ('demo', null, 'Dispose debris', true, 3),
  ('elec', 'kitchen', 'New circuit panel', true, 1),
  ('elec', 'bath', 'Re-route bathroom plumbing', true, 2),
  ('elec', null, 'Inspection sign-off', true, 3),
  ('wall', 'living', 'Drywall living room', true, 1),
  ('wall', null, 'Insulate exterior walls', true, 2),
  ('wall', null, 'Tape & mud', false, 3),
  ('wall', null, 'Prime walls', false, 4),
  ('floor', null, 'Subfloor leveling', true, 1),
  ('floor', null, 'Install oak planks', false, 2),
  ('floor', 'bath', 'Bathroom tiling', false, 3),
  ('kitch', 'kitchen', 'Cabinet delivery', false, 1),
  ('kitch', 'kitchen', 'Countertop template', false, 2),
  ('kitch', 'kitchen', 'Appliance hookup', false, 3),
  ('paint', null, 'Ceiling paint', false, 1),
  ('paint', null, 'Wall color coats', false, 2),
  ('paint', null, 'Trim & doors', false, 3),
  ('final', null, 'Walkthrough with client', false, 1)
) as t (stage_key, room_key, name, done, ord)
join public.stages s on s.project_id = 'b0000000-0000-4000-8000-000000000001' and s.key = t.stage_key
left join public.rooms r on r.project_id = 'b0000000-0000-4000-8000-000000000001' and r.key = t.room_key;

-- ---------------------------------------------------------------------------
-- Photos (8 published, as in the client app, plus one manager-only draft)
-- ---------------------------------------------------------------------------
insert into public.photos (id, project_id, stage_id, room_id, storage_path, alt, caption, taken_at, uploaded_by, status, published_at)
select p.id, 'b0000000-0000-4000-8000-000000000001', s.id, r.id,
       'b0000000-0000-4000-8000-000000000001/photos/' || p.file, p.alt, p.caption, p.taken_at::timestamptz,
       'a0000000-0000-4000-8000-000000000001', p.status::public.photo_status,
       case when p.status = 'published' then p.taken_at::timestamptz end
from (values
  ('e0000000-0000-4000-8000-000000000001'::uuid, 'p1-living-drywall.jpg', 'wall', 'living', 'Living room with fresh drywall panels and taped seams', 'Drywall finished in the living room — taping started this morning.', '2026-04-20 10:12:00', 'published'),
  ('e0000000-0000-4000-8000-000000000002'::uuid, 'p2-bed1-subfloor.jpg', 'floor', 'bed1', 'Bedroom subfloor freshly leveled with oak planks stacked nearby', 'Subfloor leveled in Bedroom 1. Oak planks acclimatising before install.', '2026-04-20 08:40:00', 'published'),
  ('e0000000-0000-4000-8000-000000000003'::uuid, 'p3-dining-drywall.jpg', 'wall', 'dining', 'Dining area walls boarded with drywall', 'Dining walls boarded and insulated behind the panels.', '2026-04-19 16:05:00', 'published'),
  ('e0000000-0000-4000-8000-000000000004'::uuid, 'p4-bed1-leveling.jpg', 'floor', 'bed1', 'Self-leveling compound drying on a bedroom floor', 'Levelling compound curing — ready for planks in 48h.', '2026-04-19 11:30:00', 'published'),
  ('e0000000-0000-4000-8000-000000000005'::uuid, 'p5-bed2-wiring.jpg', 'wall', 'bed2', 'Open stud wall in Bedroom 2 with new wiring awaiting inspection', 'Bedroom 2 walls stay open until the electrical inspector signs off the new circuit.', '2026-04-17 14:20:00', 'published'),
  ('e0000000-0000-4000-8000-000000000006'::uuid, 'p6-kitchen-panel.jpg', 'elec', 'kitchen', 'New circuit panel installed between wooden studs', 'New circuit panel installed and labelled.', '2026-03-28 09:50:00', 'published'),
  ('e0000000-0000-4000-8000-000000000007'::uuid, 'p7-living-demo.jpg', 'demo', 'living', 'Living room during demolition with old flooring torn up', 'Partition wall removed — living and dining now open plan.', '2026-03-10 15:00:00', 'published'),
  ('e0000000-0000-4000-8000-000000000008'::uuid, 'p8-dining-demo.jpg', 'demo', 'dining', 'Old flooring pieces scattered across the dining area', 'Old flooring lifted in the dining area.', '2026-03-06 10:00:00', 'published'),
  ('e0000000-0000-4000-8000-000000000009'::uuid, 'p9-bed2-junction-draft.jpg', 'wall', 'bed2', 'Close-up of a junction box in Bedroom 2', 'Junction box relocated for the inspector — check spacing before publishing.', '2026-04-20 11:05:00', 'draft')
) as p (id, file, stage_key, room_key, alt, caption, taken_at, status)
join public.stages s on s.project_id = 'b0000000-0000-4000-8000-000000000001' and s.key = p.stage_key
join public.rooms r on r.project_id = 'b0000000-0000-4000-8000-000000000001' and r.key = p.room_key;

-- ---------------------------------------------------------------------------
-- Renders (Living Room carries the before/after pair)
-- ---------------------------------------------------------------------------
insert into public.renders (id, project_id, room_id, storage_path, alt, title, description, compare_photo_id, sort_order, is_visible) values
  ('f0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001/renders/r1-living.jpg', 'Render of the finished living room with oak floors and linen sofa', 'Open living space', 'Oak plank floors, soft white walls, linen sofa with terracotta accents.', 'e0000000-0000-4000-8000-000000000001', 1, true),
  ('f0000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000001/renders/r2-kitchen.jpg', 'Render of the finished kitchen with matte white cabinets', 'Kitchen & island', 'Matte white cabinets, oak open shelving, quartz worktops, brass fixtures.', null, 2, true),
  ('f0000000-0000-4000-8000-000000000003', 'b0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000004', 'b0000000-0000-4000-8000-000000000001/renders/r3-bath.jpg', 'Render of the finished bathroom with sage green tiles', 'Bathroom', 'Sage zellige tiles, walk-in shower, oak vanity, matte black taps.', null, 3, true),
  ('f0000000-0000-4000-8000-000000000004', 'b0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000005', 'b0000000-0000-4000-8000-000000000001/renders/r4-bedroom.jpg', 'Render of the finished bedroom with oak floor and warm beige walls', 'Bedroom 1', 'Oak floor, warm beige walls, linen bedding, restored radiator.', null, 4, true);

-- ---------------------------------------------------------------------------
-- Expenses — sum to $51,200 (projects.spent)
-- ---------------------------------------------------------------------------
insert into public.expenses (project_id, stage_id, category, description, vendor, vendor_notes, amount, spent_on, created_by)
select 'b0000000-0000-4000-8000-000000000001', s.id, e.category::public.cost_category, e.description, e.vendor, e.notes, e.amount, e.spent_on::date,
       'a0000000-0000-4000-8000-000000000001'
from (values
  ('demo', 'labour', 'Demolition crew (2 weeks)', 'Hansen Demolition', 'Fixed price. Invoice paid on completion.', 6800.00, '2026-03-14'),
  ('demo', 'disposal', 'Skip hire and debris disposal', 'CityWaste', 'Two skips; second one was a same-day swap.', 950.00, '2026-03-12'),
  ('elec', 'labour', 'New circuit panel and rewiring', 'Brightline Electric', 'Contact: Marek (+1 555 0142). Re-inspection of Bedroom 2 circuit included in price.', 12400.00, '2026-04-02'),
  ('elec', 'labour', 'Bathroom plumbing re-route', 'FlowRight Plumbing', 'Warranty 5 years on new runs. Ask for pressure-test certificate.', 8900.00, '2026-03-30'),
  ('elec', 'permits', 'Electrical permit and inspection fees', 'City Building Dept.', 'Inspection #EL-2291. Follow-up slot requested for Bedroom 2.', 1250.00, '2026-03-16'),
  ('wall', 'materials', 'Drywall boards and insulation', 'BuildMart', 'Trade account discount 8%. Leftover boards returnable until May 15.', 7300.00, '2026-04-04'),
  ('wall', 'labour', 'Drywall installation', 'Hansen Demolition', 'Same crew as demolition; day rate $700.', 5600.00, '2026-04-17'),
  ('floor', 'materials', 'Oak planks (68 m²)', 'Nordic Oak Supply', 'Came in $350 under quote. Keep 2 spare boxes for repairs.', 6450.00, '2026-04-19'),
  ('floor', 'materials', 'Levelling compound and subfloor prep', 'BuildMart', '', 1550.00, '2026-04-18')
) as e (stage_key, category, description, vendor, notes, amount, spent_on)
join public.stages s on s.project_id = 'b0000000-0000-4000-8000-000000000001' and s.key = e.stage_key;

-- ---------------------------------------------------------------------------
-- Planned cost per stage (manager-only, stage_budgets) and materials (T31). The planned costs total
-- 83 000 of the 84 500 budget; Electrical & Plumbing is 550 over. stage_costs then shows, e.g.,
-- Flooring: planned 13 500, spent 8 000, committed 2 572.50 (skirting ordered, tiles delivered; the
-- oak planks are paid through their expense, so they count once), remaining 2 927.50.
-- ---------------------------------------------------------------------------
insert into public.stage_budgets (stage_id, project_id, planned_cost)
select s.id, s.project_id, b.planned
from (values
  ('demo', 8000.00), ('elec', 22000.00), ('wall', 14500.00), ('floor', 13500.00),
  ('kitch', 17500.00), ('paint', 6000.00), ('final', 1500.00)
) as b (stage_key, planned)
join public.stages s on s.project_id = 'b0000000-0000-4000-8000-000000000001' and s.key = b.stage_key;

-- A supplier in the address book (not linked to the project's contacts).
insert into public.contacts (id, kind, full_name, company, trade, phone, email, created_by) values
  ('10000000-0000-4000-8000-000000000007', 'supplier', 'Piotr Lis', 'Nordic Oak Supply', 'Timber & flooring', '+1 555 0151', 'orders@example.com', 'a0000000-0000-4000-8000-000000000001');

insert into public.materials (id, project_id, stage_id, room_id, name, supplier_contact_id, quantity, unit, unit_price, status, expense_id, notes, created_by)
select m.id, 'b0000000-0000-4000-8000-000000000001', s.id, r.id, m.name, m.supplier::uuid, m.quantity, m.unit, m.unit_price,
       m.status::public.material_status,
       (select e.id from public.expenses e
         where e.project_id = 'b0000000-0000-4000-8000-000000000001' and e.description = m.expense),
       m.notes, 'a0000000-0000-4000-8000-000000000001'
from (values
  ('20000000-0000-4000-8000-000000000001'::uuid, 'floor', null, 'Oak planks', '10000000-0000-4000-8000-000000000007', 68.000, 'm2', 94.85, 'delivered', 'Oak planks (68 m²)', 'Two spare boxes kept for repairs.'),
  ('20000000-0000-4000-8000-000000000002'::uuid, 'floor', null, 'Oak skirting boards', '10000000-0000-4000-8000-000000000007', 42.000, 'm', 18.50, 'ordered', null, ''),
  ('20000000-0000-4000-8000-000000000003'::uuid, 'floor', 'bath', 'Sage zellige wall tiles', null, 9.500, 'm2', 189.00, 'delivered', null, 'Invoice to follow with the adhesive.'),
  ('20000000-0000-4000-8000-000000000004'::uuid, 'floor', 'bath', 'Tile adhesive and grout', null, 6.000, 'bag', 42.00, 'planned', null, ''),
  ('20000000-0000-4000-8000-000000000005'::uuid, 'kitch', 'kitchen', 'Kitchen cabinets (matte white)', null, 1.000, 'set', 14800.00, 'ordered', null, '30% deposit due May 1.'),
  ('20000000-0000-4000-8000-000000000006'::uuid, 'kitch', 'kitchen', 'Quartz worktop', null, 1.000, 'pcs', 3900.00, 'planned', null, 'Templated once the cabinets are fixed.'),
  ('20000000-0000-4000-8000-000000000007'::uuid, 'paint', null, 'Wall paint (soft white)', null, 24.000, 'l', 38.00, 'planned', null, ''),
  ('20000000-0000-4000-8000-000000000008'::uuid, 'wall', null, 'Drywall boards (12.5 mm)', null, 160.000, 'pcs', 28.50, 'installed', 'Drywall boards and insulation', '')
) as m (id, stage_key, room_key, name, supplier, quantity, unit, unit_price, status, expense, notes)
join public.stages s on s.project_id = 'b0000000-0000-4000-8000-000000000001' and s.key = m.stage_key
left join public.rooms r on r.project_id = 'b0000000-0000-4000-8000-000000000001' and r.key = m.room_key;

-- ---------------------------------------------------------------------------
-- Chat (same conversation as the client app; "me" = Sarah)
-- ---------------------------------------------------------------------------
insert into public.messages (project_id, sender_id, body, created_at) values
  ('b0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'Hi! Quick update — drywall is done in the living room. We''re starting flooring tomorrow.', '2026-04-20 09:14:00'),
  ('b0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000002', 'Great news! Did the oak planks arrive?', '2026-04-20 09:18:00'),
  ('b0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'Yes, delivered this morning. Quality looks excellent.', '2026-04-20 09:20:00'),
  ('b0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'Heads up: Bedroom 2 is blocked — waiting on the electrical inspector. Will follow up today.', '2026-04-20 09:21:00'),
  ('b0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000002', 'Thanks Jonas, keep me posted.', '2026-04-20 09:25:00');

-- ---------------------------------------------------------------------------
-- Notifications (fan-out to both clients). `kind` + `params` are what the app renders (translated);
-- title/body are the legacy English text the triggers still write.
-- ---------------------------------------------------------------------------
insert into public.notifications (project_id, recipient_id, kind, params, title, body, link, entity_type, entity_id, created_by, created_at, read_at)
select 'b0000000-0000-4000-8000-000000000001', c.id, n.kind, n.params::jsonb, n.title, n.body, n.link, n.entity_type, n.entity_id::uuid,
       'a0000000-0000-4000-8000-000000000001', n.created_at::timestamptz,
       case when n.read then n.created_at::timestamptz + interval '1 hour' end
from (values
  ('room_status', '{"room":"Bedroom 2","status":"blocked","note":"Waiting on the electrical inspector to sign off the new circuit before the walls can be closed."}', 'Bedroom 2 is now blocked', 'Waiting on the electrical inspector to sign off the new circuit before the walls can be closed.', '/plan', 'rooms', 'd0000000-0000-4000-8000-000000000006', '2026-04-17 14:25:00', true),
  ('stage_status', '{"stage":"Flooring","status":"progress"}', 'Stage update: Flooring', 'Flooring is now in progress.', '/stages', 'stages', 'c0000000-0000-4000-8000-000000000004', '2026-04-18 08:00:00', true),
  ('photo_published', '{"caption":"Subfloor leveled in Bedroom 1. Oak planks acclimatising before install."}', 'New site photo', 'Subfloor leveled in Bedroom 1. Oak planks acclimatising before install.', '/photos', 'photos', 'e0000000-0000-4000-8000-000000000002', '2026-04-20 08:45:00', true),
  ('photo_published', '{"caption":"Drywall finished in the living room — taping started this morning."}', 'New site photo', 'Drywall finished in the living room — taping started this morning.', '/photos', 'photos', 'e0000000-0000-4000-8000-000000000001', '2026-04-20 10:15:00', false),
  ('schedule_status', '{"status":"at_risk","note":"Bedroom 2 is blocked until the electrical inspector signs off the new circuit. The Jun 10 target still holds if sign-off arrives this week."}', 'Schedule: At risk', 'Bedroom 2 is blocked until the electrical inspector signs off the new circuit. The Jun 10 target still holds if sign-off arrives this week.', '/', 'projects', 'b0000000-0000-4000-8000-000000000001', '2026-04-20 11:00:00', false)
) as n (kind, params, title, body, link, entity_type, entity_id, created_at, read)
cross join (values ('a0000000-0000-4000-8000-000000000002'::uuid), ('a0000000-0000-4000-8000-000000000003'::uuid)) as c (id);

-- Manager's own inbox: the client's latest message.
insert into public.notifications (project_id, recipient_id, kind, params, title, body, link, entity_type, created_by, created_at, read_at) values
  ('b0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'message', '{"sender":"Sarah Bennett","preview":"Thanks Jonas, keep me posted.","attachment":false}', 'New message from Sarah Bennett', 'Thanks Jonas, keep me posted.', '/chat', 'messages', 'a0000000-0000-4000-8000-000000000002', '2026-04-20 09:25:00', '2026-04-20 09:30:00');

-- ---------------------------------------------------------------------------
-- Activity log (manager-only)
-- ---------------------------------------------------------------------------
insert into public.activity_log (project_id, actor_id, action, entity_type, entity_id, summary, changes, params, created_at) values
  ('b0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'update', 'stages', 'c0000000-0000-4000-8000-000000000002', 'Updated stage "Electrical & Plumbing"', '{"status":{"from":"progress","to":"done"},"progress":{"from":90,"to":100}}', '{"entity":"stage","action":"update","label":"Electrical & Plumbing"}', '2026-04-02 17:10:00'),
  ('b0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'update', 'rooms', 'd0000000-0000-4000-8000-000000000006', 'Updated room "Bedroom 2"', '{"status":{"from":"progress","to":"blocked"}}', '{"entity":"room","action":"update","label":"Bedroom 2"}', '2026-04-17 14:25:00'),
  ('b0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'update', 'stages', 'c0000000-0000-4000-8000-000000000004', 'Updated stage "Flooring"', '{"status":{"from":"pending","to":"progress"}}', '{"entity":"stage","action":"update","label":"Flooring"}', '2026-04-18 08:00:00'),
  ('b0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'insert', 'expenses', null, 'Added expense "Oak planks (68 m²)"', '{}', '{"entity":"expense","action":"insert","label":"Oak planks (68 m²)"}', '2026-04-19 17:40:00'),
  ('b0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'insert', 'photos', 'e0000000-0000-4000-8000-000000000001', 'Added photo "Drywall finished in the living room — taping started this morning."', '{}', '{"entity":"photo","action":"insert","label":"Drywall finished in the living room — taping started this morning."}', '2026-04-20 10:15:00'),
  ('b0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'update', 'rooms', 'd0000000-0000-4000-8000-000000000004', 'Updated room "Bathroom"', '{"status":{"from":"done","to":"progress"},"progress":{"from":100,"to":80}}', '{"entity":"room","action":"update","label":"Bathroom"}', '2026-04-20 10:40:00'),
  ('b0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'update', 'projects', 'b0000000-0000-4000-8000-000000000001', 'Updated project "Maple Street Apartment"', '{"schedule_status":{"from":"on_schedule","to":"at_risk"}}', '{"entity":"project","action":"update","label":"Maple Street Apartment"}', '2026-04-20 11:00:00');

-- ---------------------------------------------------------------------------
-- AI knowledge (visible rows feed the client app's assistant)
-- ---------------------------------------------------------------------------
insert into public.ai_knowledge (project_id, title, content, tags, is_visible, created_by) values
  ('b0000000-0000-4000-8000-000000000001', 'Why is Bedroom 2 blocked?', 'The new circuit in Bedroom 2 needs the electrical inspector''s sign-off before the walls can be closed. The inspection is requested and Jonas follows up daily. Nothing else in the apartment is waiting on it.', '{bedroom 2,blocked,electrical}', true, 'a0000000-0000-4000-8000-000000000001'),
  ('b0000000-0000-4000-8000-000000000001', 'Site working hours', 'The crew is on site Monday to Friday, 7:30–16:30. Noisy work (cutting, drilling) starts after 9:00.', '{schedule,hours}', true, 'a0000000-0000-4000-8000-000000000001'),
  ('b0000000-0000-4000-8000-000000000001', 'Oak flooring', 'The oak planks were delivered on Apr 20 and acclimatise for 48 hours before install. Two spare boxes are kept for future repairs.', '{flooring,oak}', true, 'a0000000-0000-4000-8000-000000000001'),
  ('b0000000-0000-4000-8000-000000000001', 'Kitchen cabinets', 'Cabinets are delivered at the start of the Kitchen Install stage (May 9). The countertop is templated once the cabinets are fixed.', '{kitchen}', true, 'a0000000-0000-4000-8000-000000000001'),
  ('b0000000-0000-4000-8000-000000000001', 'Cabinet supplier fallback (internal)', 'If the cabinet delivery slips past May 12, switch to the Hallmark stock range — 10 days lead time, $900 more.', '{kitchen,internal}', false, 'a0000000-0000-4000-8000-000000000001');

-- ---------------------------------------------------------------------------
-- Shift the whole timeline from the fixed 2026-04-20 anchor above onto the
-- real current date, keeping every gap between dates (and so every stage's
-- status relative to "today") exactly as authored.
-- ---------------------------------------------------------------------------
update public.projects set
  start_date = start_date + (current_date - date '2026-04-20'),
  target_date = target_date + (current_date - date '2026-04-20')
where id = 'b0000000-0000-4000-8000-000000000001';

update public.project_members set
  last_read_at = last_read_at + (current_date - date '2026-04-20') * interval '1 day'
where project_id = 'b0000000-0000-4000-8000-000000000001';

update public.stages set
  start_date = start_date + (current_date - date '2026-04-20'),
  end_date = end_date + (current_date - date '2026-04-20')
where project_id = 'b0000000-0000-4000-8000-000000000001';

update public.tasks set
  completed_at = completed_at + (current_date - date '2026-04-20') * interval '1 day'
where project_id = 'b0000000-0000-4000-8000-000000000001' and completed_at is not null;

update public.photos set
  taken_at = taken_at + (current_date - date '2026-04-20') * interval '1 day',
  published_at = published_at + (current_date - date '2026-04-20') * interval '1 day'
where project_id = 'b0000000-0000-4000-8000-000000000001';

update public.expenses set
  spent_on = spent_on + (current_date - date '2026-04-20')
where project_id = 'b0000000-0000-4000-8000-000000000001';

update public.messages set
  created_at = created_at + (current_date - date '2026-04-20') * interval '1 day'
where project_id = 'b0000000-0000-4000-8000-000000000001';

update public.notifications set
  created_at = created_at + (current_date - date '2026-04-20') * interval '1 day',
  read_at = read_at + (current_date - date '2026-04-20') * interval '1 day'
where project_id = 'b0000000-0000-4000-8000-000000000001';

update public.activity_log set
  created_at = created_at + (current_date - date '2026-04-20') * interval '1 day'
where project_id = 'b0000000-0000-4000-8000-000000000001';

set session_replication_role = origin;
