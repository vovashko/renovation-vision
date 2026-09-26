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

## Tests

- `tests/unit/<area>/*.test.ts(x)` — vitest unit tests (jsdom).
- `tests/db/*.test.sql` — SQL tests run against a seeded local Supabase
  database with `bun run test:db` (see `tests/db/README.md`).
- `tests/fixtures/` — sample files shared by tests.

## Design system

The design handoff for the current visual redesign ("RenoVision design
system v5 (Sage)") lives in [`design/README.md`](design/README.md), along
with the HTML design reference and supporting assets it points to. Those
files are a reference for re-theming the app, not app source.
