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
cp .env.example .env
```

With an empty `.env`, the app runs in **demo mode**: an in-memory copy of
`supabase/seed.sql` stands in for Supabase, so you can run the app with no
backend at all. To use a real (or local) Supabase project, fill in
`VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`.

To run Supabase locally (requires Docker and the `supabase` CLI):

```sh
supabase start
supabase db reset
```

## Scripts

| Script                 | What it does                                         |
| ---------------------- | ---------------------------------------------------- |
| `bun run dev`          | Start the dev server                                 |
| `bun run build`        | Production build                                     |
| `bun run build:dev`    | Development-mode build                               |
| `bun run preview`      | Preview a production build                           |
| `bun run lint`         | ESLint                                               |
| `bun run format`       | Prettier, writing changes                            |
| `bun run format:check` | Prettier, check only (used in CI)                    |
| `bun run typecheck`    | `tsc --noEmit`                                       |
| `bun run test`         | Unit tests (vitest)                                  |
| `bun run test:watch`   | Unit tests in watch mode                             |
| `bun run test:db`      | SQL/RLS tests against a local Supabase instance      |
| `bun run verify`       | lint + format:check + typecheck + test — the CI gate |

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
