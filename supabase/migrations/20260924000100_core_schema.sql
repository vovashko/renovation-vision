-- Renovision shared backend — core schema.
--
-- One Supabase project serves both apps:
--   * Renovision (client app)          — reads visible, client-safe rows.
--   * Renovision Manager (admin portal) — reads and writes everything for assigned projects.
--
-- Internal fields never live on client-readable tables. They are kept in
-- manager-only tables (project_internal, expenses, activity_log) or are hidden
-- row-by-row (draft photos, is_visible = false).

create schema if not exists private;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type public.project_role as enum ('manager', 'client');
-- Same four states and colours as the client app (done/progress/pending/blocked).
create type public.work_status as enum ('done', 'progress', 'pending', 'blocked');
create type public.schedule_status as enum ('on_schedule', 'at_risk', 'delayed');
create type public.photo_status as enum ('draft', 'published');
create type public.account_type as enum ('manager', 'client');

-- ---------------------------------------------------------------------------
-- Profiles (one per auth user)
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '',
  avatar_url text,
  -- Only 'manager' accounts may create projects. Set by an admin, never by the user.
  account_type public.account_type not null default 'client',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Projects
-- ---------------------------------------------------------------------------
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  address text not null default '',
  client_name text not null default '',
  start_date date,
  target_date date,
  budget numeric(12, 2) not null default 0 check (budget >= 0),
  -- Maintained by trigger from expenses. Clients see the total, never the line items.
  spent numeric(12, 2) not null default 0 check (spent >= 0),
  schedule_status public.schedule_status not null default 'on_schedule',
  schedule_note text not null default '',
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (target_date is null or start_date is null or target_date >= start_date)
);

-- Manager-only companion row for internal project fields.
create table public.project_internal (
  project_id uuid primary key references public.projects (id) on delete cascade,
  internal_budget_notes text not null default '',
  updated_at timestamptz not null default now()
);

create table public.project_members (
  project_id uuid not null references public.projects (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.project_role not null,
  -- Used for chat unread counts.
  last_read_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (project_id, user_id)
);
create index project_members_user_idx on public.project_members (user_id);

-- ---------------------------------------------------------------------------
-- Rooms (floor plan) — coordinates are on the client app's 600x420 SVG viewBox
-- ---------------------------------------------------------------------------
create table public.rooms (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  key text not null, -- stable short id, e.g. 'living', 'bed2'
  name text not null check (length(trim(name)) > 0),
  status public.work_status not null default 'pending',
  progress smallint not null default 0 check (progress between 0 and 100),
  x integer not null default 20,
  y integer not null default 20,
  w integer not null default 160 check (w > 0),
  h integer not null default 120 check (h > 0),
  client_note text not null default '',
  sort_order integer not null default 0,
  is_visible boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, key),
  -- "Completed" and 100% always go together.
  check ((status = 'done') = (progress = 100))
);
create index rooms_project_idx on public.rooms (project_id, sort_order);

-- ---------------------------------------------------------------------------
-- Stages and their checklist tasks
-- ---------------------------------------------------------------------------
create table public.stages (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  key text not null, -- e.g. 'demo', 'elec'
  name text not null check (length(trim(name)) > 0),
  status public.work_status not null default 'pending',
  progress smallint not null default 0 check (progress between 0 and 100),
  start_date date not null,
  end_date date not null,
  client_note text not null default '',
  sort_order integer not null default 0,
  is_visible boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, key),
  check (end_date >= start_date),
  check ((status = 'done') = (progress = 100))
);
create index stages_project_idx on public.stages (project_id, sort_order);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  -- Denormalised from the stage (kept in sync by trigger) so RLS stays a single lookup.
  project_id uuid not null references public.projects (id) on delete cascade,
  stage_id uuid not null references public.stages (id) on delete cascade,
  -- Optional: the room this task affects. A room can't be "Completed" while it has open tasks.
  room_id uuid references public.rooms (id) on delete set null,
  name text not null check (length(trim(name)) > 0),
  done boolean not null default false,
  completed_at timestamptz,
  sort_order integer not null default 0,
  is_visible boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index tasks_stage_idx on public.tasks (stage_id, sort_order);
create index tasks_project_idx on public.tasks (project_id);
create index tasks_room_idx on public.tasks (room_id) where room_id is not null;

-- ---------------------------------------------------------------------------
-- Media — files live in Storage under <project_id>/...; rows point at them.
-- ---------------------------------------------------------------------------
create table public.photos (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  stage_id uuid references public.stages (id) on delete set null,
  room_id uuid references public.rooms (id) on delete set null,
  storage_path text not null, -- bucket 'project-media', '<project_id>/photos/<file>'
  alt text not null default '',
  caption text not null default '',
  taken_at timestamptz not null default now(),
  uploaded_by uuid references public.profiles (id) on delete set null,
  -- Drafts are manager-only. Publishing is what makes a photo visible to the client.
  status public.photo_status not null default 'draft',
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (storage_path like project_id::text || '/photos/%')
);
create index photos_project_idx on public.photos (project_id, taken_at desc);

create table public.renders (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  room_id uuid references public.rooms (id) on delete set null,
  storage_path text not null, -- bucket 'project-media', '<project_id>/renders/<file>'
  alt text not null default '',
  title text not null default '',
  description text not null default '',
  -- Optional current site photo for the before/after slider.
  compare_photo_id uuid references public.photos (id) on delete set null,
  sort_order integer not null default 0,
  is_visible boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (storage_path like project_id::text || '/renders/%')
);
create index renders_project_idx on public.renders (project_id, sort_order);

-- ---------------------------------------------------------------------------
-- Expenses — manager-only (vendor notes and receipts are internal).
-- ---------------------------------------------------------------------------
create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  stage_id uuid references public.stages (id) on delete set null,
  category text not null default 'Other',
  description text not null check (length(trim(description)) > 0),
  vendor text not null default '',
  vendor_notes text not null default '',
  amount numeric(12, 2) not null check (amount > 0),
  spent_on date not null default current_date,
  receipt_path text, -- bucket 'project-internal', '<project_id>/receipts/<file>'
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index expenses_project_idx on public.expenses (project_id, spent_on desc);

-- ---------------------------------------------------------------------------
-- Chat
-- ---------------------------------------------------------------------------
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  sender_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  body text not null default '' check (length(body) <= 4000),
  attachment_path text, -- bucket 'project-media', '<project_id>/chat/<file>'
  created_at timestamptz not null default now(),
  edited_at timestamptz,
  check (length(trim(body)) > 0 or attachment_path is not null)
);
create index messages_project_idx on public.messages (project_id, created_at);

-- ---------------------------------------------------------------------------
-- Notifications — one row per recipient (fan-out on write).
-- ---------------------------------------------------------------------------
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null default 'manual', -- stage | room | photo | render | schedule | message | manual
  title text not null,
  body text not null default '',
  link text, -- client-app route, e.g. '/stages'
  entity_type text,
  entity_id uuid,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  read_at timestamptz
);
create index notifications_recipient_idx on public.notifications (recipient_id, created_at desc);
create index notifications_project_idx on public.notifications (project_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Activity log — manager-only audit trail, written by triggers only.
-- No FK on project_id so the trail survives deletions.
-- ---------------------------------------------------------------------------
create table public.activity_log (
  id bigint generated always as identity primary key,
  project_id uuid not null,
  actor_id uuid,
  action text not null, -- insert | update | delete
  entity_type text not null,
  entity_id uuid,
  summary text not null,
  changes jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index activity_log_project_idx on public.activity_log (project_id, created_at desc);

-- ---------------------------------------------------------------------------
-- AI knowledge — facts the client-side assistant may use (when visible).
-- ---------------------------------------------------------------------------
create table public.ai_knowledge (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  title text not null check (length(trim(title)) > 0),
  content text not null default '',
  tags text[] not null default '{}',
  is_visible boolean not null default false,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index ai_knowledge_project_idx on public.ai_knowledge (project_id);

-- ---------------------------------------------------------------------------
-- Client-facing summary view. security_invoker => the caller's RLS applies,
-- so a client only ever aggregates visible stages of their own project.
-- ---------------------------------------------------------------------------
create view public.project_summary
with (security_invoker = true) as
select
  p.id,
  p.name,
  p.address,
  p.client_name,
  p.start_date,
  p.target_date,
  p.budget,
  p.spent,
  p.schedule_status,
  p.schedule_note,
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
  ) as manager_name
from public.projects p
left join public.stages s on s.project_id = p.id
group by p.id;
