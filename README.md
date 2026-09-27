# RenoVision

RenoVision is a renovation tracking app. Clients and site managers share one
role-based application: clients follow their project's progress, photos and
budget, while managers run the schedule, upload media and keep the budget
up to date. There is no separate client/admin build — the UI adapts to the
signed-in user's role.

## Stack

- [TanStack Start](https://tanstack.com/start) (SSR) with TanStack Router and
  TanStack Query
- React 19
- Tailwind CSS v4
- [shadcn/ui](https://ui.shadcn.com) on Radix primitives
- [Supabase](https://supabase.com) (Postgres, RLS, Storage, Realtime, Auth)
- Deployed to Cloudflare Workers
- Package manager: [bun](https://bun.sh)

## Setup

```sh
bun install
cp .env.example .env.local
```

The app always talks to a real Supabase project — there is no demo/in-memory mode. Fill in
`VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` in `.env.local` before running `bun run dev`;
without them the app shows a clear "Supabase is not configured" screen instead of a blank page.
See **Local Supabase** below to get those two values from a local stack.

## Local Supabase

Requires [Docker](https://www.docker.com) and the [Supabase CLI](https://supabase.com/docs/guides/cli)
(`brew install supabase/tap/supabase`, or see the docs for other platforms).

```sh
supabase start                  # boots Postgres, Auth, Storage, Studio, ...
supabase status -o env          # prints API_URL and PUBLISHABLE_KEY (among others)
```

Copy `API_URL` → `VITE_SUPABASE_URL` and `PUBLISHABLE_KEY` (or `ANON_KEY` on older CLI output) →
`VITE_SUPABASE_PUBLISHABLE_KEY` into `.env.local`. Then:

```sh
bun run db:reset   # supabase db reset (migrations + seed.sql) + uploads the seed photos/renders
bun run dev
```

Sign in with one of the seeded demo accounts (see `supabase/seed.sql` for the full list):

| Role    | Email                   | Password          |
| ------- | ----------------------- | ----------------- |
| Manager | `jonas@renovision.demo` | `renovision-demo` |
| Client  | `sarah@renovision.demo` | `renovision-demo` |

Useful scripts: `bun run db:start` (`supabase start`), `bun run db:reset` (reset + reseed media),
`bun run db:types` (regenerate `src/domain/db.types.ts` from the running local schema).

**Several agents/processes can share one running local stack** (same ports, same containers) — just
point each at the same `.env.local` values. Only **one** of them should run `supabase db reset` or
`supabase stop` at a time, since that affects everyone sharing the stack.

### Hosted demo

The hosted demo is a real, separately-provisioned Supabase project seeded the same way. A scheduled
workflow (`.github/workflows/demo-reseed.yml`) resets and reseeds it nightly (and on manual dispatch),
so it never accumulates stray edits from people trying it out. It needs three repository secrets:

| Secret                      | What it is                                                        |
| --------------------------- | ----------------------------------------------------------------- |
| `SUPABASE_ACCESS_TOKEN`     | A Supabase personal access token (Account → Access Tokens)        |
| `SUPABASE_DEMO_PROJECT_REF` | The hosted demo project's ref — **never** a real customer project |
| `SUPABASE_DEMO_DB_PASSWORD` | That project's Postgres password                                  |

Without all three, the workflow skips its steps rather than failing. Setting `VITE_DEMO_HINT=true` in
the demo deployment's environment shows the table above under the sign-in form.

## Scripts

| Script                 | What it does                                              |
| ---------------------- | --------------------------------------------------------- |
| `bun run dev`          | Start the dev server                                      |
| `bun run build`        | Production build                                          |
| `bun run build:dev`    | Development-mode build                                    |
| `bun run preview`      | Preview a production build                                |
| `bun run lint`         | ESLint                                                    |
| `bun run format`       | Prettier, writing changes                                 |
| `bun run format:check` | Prettier, check only (used in CI)                         |
| `bun run typecheck`    | `tsc --noEmit`                                            |
| `bun run test`         | Unit tests (vitest)                                       |
| `bun run test:watch`   | Unit tests in watch mode                                  |
| `bun run test:db`      | SQL/RLS tests against a local Supabase instance           |
| `bun run verify`       | lint + format:check + typecheck + test — the CI gate      |
| `bun run db:start`     | `supabase start`                                          |
| `bun run db:reset`     | `supabase db reset` + upload the seed media               |
| `bun run db:types`     | Regenerate `src/domain/db.types.ts` from the local schema |

## Routes

Route files are flat (`src/routes/projects.tsx`, `src/routes/project/budget.tsx`), and URLs keep the project id
(`/projects/<id>/budget`). The mapping lives in `src/routes.config.ts` (TanStack virtual file routes): register every new
route there. `src/routeTree.gen.ts` is generated on `dev`/`build`, so don't edit it by hand.

## Tests

- `tests/unit/<area>/*.test.ts(x)` — vitest unit tests (jsdom).
- `tests/db/*.test.sql` — SQL tests run against a seeded local Supabase
  database with `bun run test:db` (see `tests/db/README.md`).
- `tests/fixtures/` — sample files shared by tests.

## Deploy

The app builds to a Cloudflare Worker via `@cloudflare/vite-plugin` (`bun run build`
writes static assets to `dist/client` and the Worker to `dist/server` — no Nitro,
no `.output/`). There are two Worker environments, defined in `wrangler.jsonc`:

- `preview` (`renovision-preview`) — `bun run deploy:preview`
- `production` (`renovision`) — `bun run deploy`

First time only: `wrangler login`.

Secrets (`SUPABASE_SERVICE_ROLE_KEY`, `BREVO_API_KEY`, `SENTRY_DSN`) are not set via
`vars`. Copy `.dev.vars.example` to `.dev.vars` (gitignored) for local `wrangler dev`,
and set remote secrets per environment with `wrangler secret put <NAME> --env <preview|production>`.
The app runs with none of them set — public config only lives in `vars.APP_ENV`.

## Design system

The v5 ("Sage") design system lives in code, not in docs:

- Tokens (color roles, type scale, radii, `state-layer`) are in `src/styles.css`.
- Primitives and their variants are in `src/components/ui/*` (`cva`). Icons are Material Symbols via `ui/icon`.
- Components own their Tailwind classes; call sites pick variants and props rather than restyling. Repeated class
  patterns become a component or a variant, never a separate CSS file.
- Status model: `done` / `progress` / `pending` (hollow) / `blocked`. Status follows progress: 0% is pending, above 0% is progress, 100% is done. Blocked is set by hand. The orange attention flag (late, over budget) is computed, never stored.

The original design handoff and HTML reference were removed from the repo. They remain in git history at `0e27b3f`
(`git show 0e27b3f:README.md`, `git show "0e27b3f:RenoVision Design System v5.dc.html" > /tmp/v5.html`).

## UI conventions

UI code has three layers:

1. **`src/components/ui/*` is the design system.** Compound primitives with `cva` variants. Long Tailwind class strings live
   here and nowhere else. Prefer a shadcn registry primitive (`bunx shadcn@latest add …`, never overwriting existing files),
   restyled to the v5 tokens; build our own compound primitive only when the spec needs something shadcn lacks.
2. **Feature components** (`src/features/*/ui`, `src/shared/ui`, for now `src/components/*.tsx`) are small, single-purpose and
   named for what they are (`ProjectRail`, `RoomRow`, `StagesEmpty`). They compose primitives; their `className` is layout only
   (flex, grid, gap, width, margin). No raw `<div>` styling, no inline empty states, stat tiles or list rows.
3. **Routes** compose feature components only.

Icons are Material Symbols names passed to `ui/icon` (or a primitive's `icon` prop), never `lucide-react`.

Primitives: `Button`, `Badge`, `Card`, `Progress`/`ProgressBar`, `Input`, `InputGroup` (addons, `search` variant), `NativeSelect`,
`Field` (label, description, error), `Item` (list rows, `lg` for stage rows), `Empty` (empty states), `Stat` (stat cards),
`Rail` (desktop navigation rail), `Sheet`, `Dialog`, `Tabs`, `Switch`, `Tooltip`, `DropdownMenu`, `Popover` and the rest of
`src/components/ui/`.
