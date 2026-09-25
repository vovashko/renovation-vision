# Renovision Manager

The admin portal where site managers enter and update everything clients see in the
**Renovision** client app (the app in the repository root). It's a separate app with its own
`package.json`, build and deployment (`wrangler.jsonc` → `renotrack-manager`). The client
app's code was not changed.

Both apps use **one Supabase project** (database, auth, storage). The schema, RLS policies,
seed and tests live in [`../supabase`](../supabase).

## Run it

```bash
cd renotrack-manager
bun install
cp .env.example .env.local   # fill in to connect; leave empty for demo mode
bun run dev
```

With no env vars the portal runs in **demo mode**: an in-memory copy of the seed, signed in as
Jonas Weber, with a "Demo data — not connected" pill in the header. Changes reset on reload.

### Connect to Supabase

```bash
# from the repo root
supabase link --project-ref <ref>      # or `supabase start` for a local stack
supabase db push                       # migrations in supabase/migrations
psql "$SUPABASE_DB_URL" -f supabase/seed.sql
SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… node supabase/scripts/upload-seed-media.mjs
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/rls.test.sql   # prints "RLS tests passed"
```

Demo logins (password `renovision-demo`): `jonas@renovision.demo` (manager),
`sarah@renovision.demo` and `tom@renovision.demo` (clients). Client accounts that sign in here
get a "This portal is for site managers" screen.

## Pages

| Page | What the manager does | What reaches the client |
| --- | --- | --- |
| Projects | List and create projects (`create_project` RPC) | — |
| Overview | Edit name, address, dates, budget, schedule status and note; consistency checks | Project header, stats, schedule status |
| Stages | Add/edit stages, dates, status, progress; tick, add, remove tasks (optionally linked to a room) | Visible stages and tasks |
| Plan | Update room status, progress, client note, visibility, position | Floor plan and room cards |
| Photos | Upload (drafts by default), publish/unpublish, tag stage/room, delete | Published photos only |
| Design | Upload renders, set the before/after photo, share/hide | Visible renders |
| Budget | Expenses with vendor notes and receipts; internal budget notes | Budget and spent **totals** only |
| Chat | Real-time chat with the client, attachments, presence | Same conversation |
| Updates | Send announcements; see what was sent and who read it; activity log | Notifications |
| AI knowledge | Facts the client's "Ask AI" assistant may use | Visible entries |
| Team | Add clients/managers by email, remove members | Team list |

"Completed" and 100% always go together, and a room can't be marked Completed while a task
linked to it is open. The forms enforce this, and so does the database.

## Design system

Visual reference: the client app in the repo root. It was read, never edited.

**Tokens:** [`src/styles/theme.css`](src/styles/theme.css) is copied verbatim from the client
app's `src/styles.css`. It holds the oklch palette, the four `--status-*` colours,
`--gradient-primary` / `--gradient-surface`, `--shadow-soft` / `--shadow-elegant`, and `--radius`
(0.75rem) with the derived radius scale, plus the sidebar tokens. `src/styles.css` only imports
Tailwind and the theme. Typography is the Tailwind default sans stack, as in the client app.

**Components** live in [`src/components/ui`](src/components/ui). Nothing in that folder is
specific to managers, so both apps can later share it as a package.

| Found in the client app | Reused here as | How |
| --- | --- | --- |
| shadcn/ui set (`components/ui/*`: button, sheet, sidebar, input, slider, switch, sonner, …) | same files | copied unchanged |
| `FilterChips` (`components/filter-chips.tsx`) | `ui/filter-chips.tsx` | copied unchanged |
| `Lightbox` (`components/lightbox.tsx`) | `ui/lightbox.tsx` | copied; one ternary rewritten as `if` to pass lint |
| `BeforeAfter` (`components/before-after.tsx`) | `ui/before-after.tsx` | copied unchanged |
| `Stat` (inline in `routes/index.tsx`) | `ui/stat-card.tsx` → `Stat` | same markup and props; `sub` also accepts a node |
| Project header card (inline in `routes/index.tsx`) | `ui/project-header-card.tsx` → `ProjectHeaderCard` | same markup, data passed as props, plus `badges`/`actions` slots |
| Stage timeline row (inline in `routes/index.tsx`) | `ui/stage-timeline-row.tsx` → `StageTimelineRow` | same markup, optional `onClick` |
| Stage card with checklist (inline in `routes/stages.tsx`) | `ui/stage-card.tsx` → `StageList`, `StageCard` | same markup; optional `onToggleTask`/`onRemoveTask` |
| `FloorPlan` (`components/floor-plan.tsx`) | `ui/floor-plan.tsx` → `FloorPlan`, `RoomDetail` | same SVG and styling; rooms, selection and detail panel are props instead of reading mock data |
| Legend (duplicated in `floor-plan.tsx` and `routes/index.tsx`) | `ui/status-pill.tsx` → `StatusLegend` | extracted |
| Room card (inline in `routes/plan.tsx`) | `ui/room-card.tsx` → `RoomCard` | same markup |
| Status pill (inline in stages/plan/floor plan) | `ui/status-pill.tsx` → `StatusPill` | extracted |
| Status maps (`lib/renovation-data.ts`: `Status`, `statusLabel`, `statusColor`, `statusFill`) | `ui/status.ts` | copied unchanged |
| Progress bars (inline everywhere) | `ui/progress-bar.tsx` → `ProgressBar` | extracted |
| Chat UI (inline in `routes/chat.tsx`) | `ui/chat.tsx` → `ChatAvatar`, `ChatHeader`, `PresenceIndicator`, `ChatBubble`, `ChatComposer` | same bubbles, "● Online — …" line, pinned input with attach and send buttons |
| Empty state (`EmptyPhotos` in `routes/photos.tsx`) | `ui/empty-state.tsx` → `EmptyState` | same styling, generic icon/text/action |
| Toasts (`ui/sonner.tsx`, not mounted in the client app) | `ui/sonner.tsx` | copied; mounted in `__root.tsx` |
| Sidebar layout with logo (`components/app-sidebar.tsx`, `routes/__root.tsx`) | `components/app-sidebar.tsx`, `routes/__root.tsx` | same structure and header; adds the **Manager** label next to the logo and a **Manager** badge in the header |

Not reused because the portal doesn't need them: `MobileTabBar` (the portal uses the
off-canvas sidebar on phones), `AiChat` and the rule-based assistant (client-only),
`PhotoUploadSheet` (rebuilt as a draft/publish upload sheet using the same styling).

Conventions follow the client app: TanStack Start file routes with a `head()` per route, `@/`
imports, shadcn/ui, Tailwind v4 with CSS-variable tokens, Prettier settings, ESLint config and
the Cloudflare/Nitro build.

## Client app integration notes

The client app still uses mock data (`src/lib/renovation-data.ts`, `media-data.ts`, the
in-memory `photo-store.tsx`, and hard-coded chat in `routes/chat.tsx`). To show what managers
enter here, it has to read from the shared Supabase project as described below.

### Setup

- Add `@supabase/supabase-js` and the same env vars: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`.
- Sign in clients with Supabase Auth (email + password or magic link). Every query below runs as
  the signed-in client. RLS does the filtering, so the app never has to filter for visibility itself.
- Find the client's project with `select project_id from project_members where user_id = auth.uid() and role = 'client'`.

### Tables and columns to read

| Client screen | Source | Columns | Notes |
| --- | --- | --- | --- |
| Header, Overview card, stats | `project_summary` (view) | `name, address, client_name, start_date, target_date, budget, spent, schedule_status, schedule_note, overall_progress, stages_done, stages_total, current_stage, manager_name` | Replaces `project`, `overallProgress()` and the hard-coded "On schedule". Show `schedule_status` as On schedule / At risk / Delayed |
| Stage timeline, Stages page | `stages` + `tasks` | `stages: id, key, name, status, progress, start_date, end_date, client_note, sort_order`; `tasks: id, stage_id, room_id, name, done, sort_order` | `select('*, tasks(*)').order('sort_order')`. Dates are `YYYY-MM-DD`; format as "Mar 02" |
| Floor plan, Plan page | `rooms` | `id, key, name, status, progress, x, y, w, h, client_note, sort_order` | Coordinates use the same 600×420 viewBox. `status` uses the same four values as `Status` |
| Photos | `photos` | `id, stage_id, room_id, storage_path, alt, caption, taken_at, uploaded_by, published_at` | Only published rows come back. Get image URLs with `storage.from('project-media').createSignedUrls(paths, 3600)`. Show `uploaded_by` by joining `profiles.full_name` |
| Design | `renders` | `id, room_id, storage_path, alt, title, description, compare_photo_id, sort_order` | Before/after = render + `photos` row `compare_photo_id` (shown only if that photo is published) |
| Chat | `messages` | `id, sender_id, body, attachment_path, created_at` | Insert `{ project_id, body, attachment_path }`; `sender_id` defaults to `auth.uid()`. Upload attachments to `project-media/<project_id>/chat/<file>`. Subscribe to `postgres_changes` on `messages` filtered by `project_id` |
| Chat header / presence | `project_members` + `profiles` | `user_id, role, profiles.full_name` | Manager = `role = 'manager'`. Presence channel `presence:project:<project_id>`, presence key = user id, payload `{ name, role }` |
| Notifications | `notifications` | `id, kind, title, body, link, created_at, read_at` | Only the client's own rows. `link` is a client-app route (`/`, `/stages`, `/plan`, `/photos`, `/design`, `/chat`). Mark read with `rpc('mark_notifications_read', { p_ids })`. Realtime is enabled |
| Ask AI context | `ai_knowledge` | `title, content, tags` | Only visible entries. Add them to the assistant's context next to stages, rooms and photos |
| Chat unread | `rpc('mark_chat_read', { p_project })` | — | Updates `project_members.last_read_at` for the caller |

### RLS rules the client app relies on

- Clients read only projects where they're in `project_members` with `role = 'client'`.
- `rooms`, `stages`, `renders`, `ai_knowledge`: only rows with `is_visible = true`. `tasks`: only
  visible tasks whose stage is also visible. `photos`: only `status = 'published'`.
- Storage `project-media`: clients can read a file only when a published photo or visible render
  points at it, or when it's under `<project_id>/chat/`. They can upload only to `chat/`.
- **Never readable by clients:** `project_internal` (internal budget notes, client phone and email),
  `project_crew` (site crew and trades with contact details), `expenses` (vendor
  notes, receipts, line items), `activity_log`, draft photos, the `project-internal` bucket (receipts).
- Clients have no write access to project data. The exceptions are sending chat messages as
  themselves, editing or deleting their own messages, and the two read-marker RPCs.
- `anon` has no access to anything.

### Mock data the client app should drop

`renovation-data.ts` (keep the `Status` helpers), `media-data.ts` (keep `dayLabel`/`timeLabel`),
`photo-store.tsx` (client uploads aren't part of this model: managers publish photos), the
`initial` messages and the fake auto-reply in `routes/chat.tsx`, and the hard-coded
"Maple Street Apartment" in `__root.tsx`.
