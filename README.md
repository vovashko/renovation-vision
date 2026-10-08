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
without them the app shows a clear "Supabase is not configured" screen instead of a blank page. A malformed value
gets its own message naming the variable: the URL must be `http(s)://…`, and the key must be the publishable key
(`sb_publishable_…` or the legacy anon JWT), never a secret or service-role key, since `VITE_*` values ship to the browser.
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

| Role    | Email                   | Password               | Language (`profiles.locale`) |
| ------- | ----------------------- | ---------------------- | ---------------------------- |
| Manager | `jonas@renovision.demo` | `renovision-demo-2026` | `pl`                         |
| Client  | `sarah@renovision.demo` | `renovision-demo-2026` | `pl`                         |
| Client  | `tom@renovision.demo`   | `renovision-demo-2026` | `en`                         |
| Admin   | `admin@renovision.demo` | `renovision-demo-2026` | `pl`                         |

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

- `tests/unit/<area>/*.test.ts(x)` — vitest unit tests (jsdom). `domain/` covers the pure rules, `i18n/` the locale
  resolution and the en/pl parity check every namespace must pass, `shared/` the shared components and hooks.
  Components rendered without an `<I18nextProvider>` translate in English (`tests/setup.ts`).
- `tests/db/*.test.sql` — SQL tests run against a seeded local Supabase
  database with `bun run test:db` (see `tests/db/README.md`).
- `tests/fixtures/` — sample files shared by tests.

## Deploy

The app builds to a Cloudflare Worker via `@cloudflare/vite-plugin` (`bun run build`
writes static assets to `dist/client` and the Worker to `dist/server` — no Nitro,
no `.output/`). There are two Worker environments, defined in `wrangler.jsonc`:

- `preview` (`renovision-preview`) — `bun run deploy:preview`, live at https://renovision-preview.renovision.workers.dev
  (the client demo, backed by the hosted Supabase project `renovision-demo`, eu-west-1)
- `production` (`renovision`) — `bun run deploy`

First time only: `wrangler login`.

**The environment is chosen at build time.** `@cloudflare/vite-plugin` bakes the Wrangler environment into
`dist/server/wrangler.json` when it builds, so the deploy scripts set `CLOUDFLARE_ENV` for `bun run build` and then run a
plain `wrangler deploy` (`wrangler deploy --env …` doesn't apply to a plugin build; a build without `CLOUDFLARE_ENV` would
deploy the top-level config as `renovision`, the production name). The scripts also delete the source maps and the
copied `.dev.vars` before uploading.

**Public config is baked in at build time too.** `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` must point at the
target project when you build (they're public: the publishable key ships to browsers). For the client demo also set
`VITE_DEMO_HINT=true`. Read them from the CLI rather than copying them anywhere:

```bash
REF=elzvszbtulwknpkrkwli   # renovision-demo
PUB=$(supabase projects api-keys --project-ref $REF -o json | jq -r '.[] | select(.type=="publishable") | .api_key')
VITE_SUPABASE_URL=https://$REF.supabase.co VITE_SUPABASE_PUBLISHABLE_KEY=$PUB VITE_DEMO_HINT=true bun run deploy:preview
```

**Secrets** (`SUPABASE_SECRET_KEY`, `BREVO_API_KEY`, `SENTRY_DSN`) are not set via `vars`. Copy `.dev.vars.example` to
`.dev.vars` (gitignored) for `bun run dev`, `bun run preview` and `wrangler dev`, and set remote secrets per Worker,
piping the value so it's never printed:

```bash
supabase projects api-keys --project-ref $REF --reveal -o json \
  | jq -j '.[] | select(.type=="secret") | .api_key' \
  | wrangler secret put SUPABASE_SECRET_KEY --name renovision-preview
```

Pages and `getMe` run with none of them set; the admin Supabase client fails with a clear message until
`SUPABASE_SECRET_KEY` is set. Public config lives in `vars.APP_ENV`; the rate limiters are `ratelimits` bindings
(see **Server functions & security**). Non-production responses send `X-Robots-Tag: noindex, nofollow`.

**Hosted Supabase project.** Schema: `supabase link --project-ref $REF`, then `supabase db push` (`--include-seed` for the
demo project only), then upload the demo media with
`SUPABASE_URL=https://$REF.supabase.co SUPABASE_SERVICE_ROLE_KEY=<secret> node supabase/scripts/upload-seed-media.mjs`.
Auth settings: `supabase config push` from a copy of `supabase/` whose `site_url` and `additional_redirect_urls` point at
the deployed URL (the repo's `config.toml` keeps the local URLs); answer **no** to the API prompt. On the free plan with
Supabase's default email sender, custom email templates are rejected, so leave the `[auth.email.template.*]` sections
out of that copy until Brevo SMTP is configured (see **Email**).

## Architecture

Code is split by layer, then by feature:

```
src/domain/            pure entities and rules: status, progress, money, dates, attention, consistency, budget,
                       db.types.ts (generated). No React, no Supabase, no UI imports.
src/features/<f>/      f ∈ projects | work | media | documents | budget | comms | people | knowledge | auth | settings | admin | import
  README.md            what the feature owns (tables, routes, UI)
  domain/              rules only this feature needs (optional)
  data/                the repository: the ONLY place that imports supabase-js
  hooks/               TanStack Query hooks and mutations (the "controllers"); an index.ts barrel
                       when another feature or a route needs more than one of this feature's hooks
  ui/                  small, named components that compose src/components/ui primitives
  i18n/{en,pl}.json    the feature's translation namespace
src/shared/query-keys.ts app-wide TanStack Query cache keys (`keys.project(id)`, `keys.stages(id)`…), shared so
                       cross-feature invalidation stays consistent (e.g. work and budget mutations invalidate
                       `project`/`projects`/`activity`/`notifications`, which the projects feature's overview reads)
src/shared/ui/         app-level pieces used across features: ConfirmDialog/useConfirm, DataTable, FormField,
                       FormSheet, VisibilityBadge/InternalBadge, nav-config
src/shared/hooks/      useMutationWithToast, useZodForm
src/i18n/              i18next setup, locale resolution, the `common` namespace, useFormat()
src/server/            server functions (functions/), their builders (fn.ts) and middleware (middleware/); see
                       **Server functions & security**
src/components/ui/     the design system (see UI conventions), including status-ui.ts's status→class maps
src/routes/            route files: they compose feature components and hooks, nothing else
```

Dependencies point one way: `routes → features/<f>/{ui,hooks} → features/<f>/data → supabase`, and everything may
use `domain`, `shared` and `i18n`. A feature never imports another feature's `data/`; it goes through the other
feature's `hooks` (most commonly) or `domain` entry point instead — e.g. `features/knowledge/ui/ai-chat.tsx` reads
the project, stages/rooms and photos via `@/features/projects/hooks`, `@/features/work/hooks` and
`@/features/media/hooks`, never their repositories directly. `src/lib/` only holds cross-cutting non-UI code that
isn't domain or a feature's: `auth.tsx`, `supabase/` (`@/lib/supabase` is the browser client; `server.ts` and
`admin.ts` are server-only), `env.ts` (server-only), `logger.ts`, `database.types.ts`, `utils.ts`,
`error-capture.ts`, `error-page.ts`. The `src/lib/{api,queries,status,attention,…}` shims from the feature split (W2c) are gone (T17);
everything imports `@/domain/*`, `@/shared/*`, `@/i18n` and `features/<f>/{hooks,domain}` directly.

Lint enforces the boundaries above as errors (see **Lint rules**), and
`tests/unit/arch/boundaries.test.ts` duplicates the same checks as a guard that isn't config-dependent.

## Server functions & security

Most data still flows browser → Supabase: supabase-js sends the user's JWT and Postgres RLS decides. Anything that
needs a secret, a privileged write, email, or a check RLS can't express goes through a **server function**
(TanStack Start `createServerFn`, running in the Worker). Every server function is authenticated, authorized,
rate-limited and logged by default, because it is built from one of two builders:

```
browser ──(RPC + Authorization: Bearer <access token>)──▶ server function
   serverFnBoundary → requireUser → rateLimit("default") → [requireAal2 | requireAccountType | requireProjectRole | rateLimit(...)]
   → .validator(zod) → handler({ data, context: { user, supabase } })
                          context.supabase = Supabase AS THE USER (RLS applies)
                          getAdminSupabase() = secret key, bypasses RLS: src/server/** only, after authorizing
```

### Writing one

Put it in `src/server/functions/<name>.ts`, start from `authedFn` (or `publicFn` for anonymous callers), always pass
a zod schema to `.validator()`, and call it from a `features/<f>/hooks` hook (like any repository):

```ts
// src/server/functions/rename-project.ts
export const renameProject = authedFn({ method: "POST" })
  .middleware([requireProjectRole((input: { projectId: string }) => input.projectId, "manager")])
  .validator(z.object({ projectId: z.string().uuid(), name: z.string().trim().min(1).max(120) }))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("projects").update({ name: data.name }).eq("id", data.projectId);
    if (error) throw error; // logged; the browser gets a generic 500 with the request id
    return { ok: true };
  });

// features/projects/hooks: useMutationWithToast((vars) => renameProject({ data: vars }), { … })
```

Keep server-only logic out of the function/middleware files' top level (the Start compiler only strips what sits
inside `.handler()`/`.server()` from the browser build): put helpers in a `*.server.ts` module, like
`src/server/functions/me.server.ts`. `getMe` (`src/server/functions/me.ts`, used by `useMe()` on `/settings`) is the
reference example.

### Middleware (`src/server/middleware/`)

| Middleware                                      | What it does                                                                                                                                                                                                                                                  |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `requireUser` (in `authedFn`)                   | Browser half attaches `Authorization: Bearer <access_token>` from the Supabase session. Server half verifies it (or the session cookies, see **Sessions & route guards**) and puts `user: { id, email, aal, role }` and `supabase` in context. 401 otherwise. |
| `requireAal2`                                   | 403 (`reason: "aal2_required"`) unless the session is MFA-verified.                                                                                                                                                                                           |
| `requireAccountType("manager", …)`              | 403 unless `profiles.account_type` is one of those (today `manager` \| `client`); adds `accountType`.                                                                                                                                                         |
| `requireProjectRole(pick, role)`                | 403 unless the caller is `manager` / `client` / `member` (any) of the project `pick(input)` returns, checked with `is_project_manager/client/member` as the user. `pick` sees the **raw** input; a non-UUID is a 400.                                         |
| `rateLimit({ key })` (default in both builders) | 429 + `Retry-After` past the policy in `src/server/rate-limits.ts` (`default` 120/min, `invite` 10/min, `email` 5/min), per user, or per `cf-connecting-ip` when anonymous.                                                                                   |
| `serverFnBoundary` (in both builders)           | Logs every call; maps errors to the responses below; rethrows them as `ServerFnError` in the browser.                                                                                                                                                         |
| `requestIdMiddleware` (request middleware)      | Every request gets an id (a safe incoming `x-request-id`, or a UUID): in logs, `context.requestId`, the `x-request-id` response header and the 500 page.                                                                                                      |

`src/start.ts` also installs TanStack Start's CSRF middleware for server-function requests (`Sec-Fetch-Site`,
`Origin` or `Referer` must be same-origin; otherwise 403).

**JWT verification.** `auth.getClaims(token)` (supabase-js 2.117): tokens signed with an asymmetric key (ES256 on the
local CLI stack and new hosted projects) are verified locally with WebCrypto against the project's JWKS
(`/auth/v1/.well-known/jwks.json`, cached per isolate for 10 minutes). Projects still on the legacy HS256 secret fall
back to one `auth/v1/user` call per request. Signature and expiry are always enforced; anonymous sign-ins and
non-`authenticated` roles are rejected; a signed-out token stays valid until it expires (≤ 1 h).

### Errors

Throw `ServerFnError(code, message, { reason?, retryAfter?, issues? })` from `@/server/errors`. The response is JSON with
header `x-rv-error: 1`:

```json
{ "error": { "code": "UNAUTHORIZED", "message": "Missing access token", "requestId": "3f0c…", "reason": "missing_token" } }
```

| Code                   | Status | When                                                                                     |
| ---------------------- | ------ | ---------------------------------------------------------------------------------------- |
| `BAD_REQUEST`          | 400    | `.validator()` failed (`error.issues: [{ path, message }]`), or a bad project id         |
| `UNAUTHORIZED`         | 401    | no, malformed, expired or badly signed token (`reason`: `missing_token`/`invalid_token`) |
| `FORBIDDEN`            | 403    | AAL2, account type or project role check failed                                          |
| `NOT_FOUND`            | 404    | yours to throw                                                                           |
| `RATE_LIMITED`         | 429    | over a rate limit (`Retry-After` header and `error.retryAfter`, seconds)                 |
| `INTERNAL`             | 500    | anything unexpected; details are only in the log, the browser gets the request id        |
| `EMAIL_NOT_CONFIGURED` | 500    | `sendEmail` in production/preview with no `BREVO_API_KEY` (see **Email**)                |
| `UNAVAILABLE`          | 503    | the Supabase Auth/JWKS endpoint couldn't be reached                                      |

In the browser, `isServerFnError(e) && e.code === "RATE_LIMITED"` etc.

### Logging

`logger` (`@/lib/logger`) writes one JSON line per call, which Workers Logs indexes: `level`, `msg`, `time`,
`requestId`, `route`/`fn`, `userId` and your fields; `logger.child({ … })` adds fields to every line. The request
context (`src/server/request-context.server.ts`, AsyncLocalStorage) supplies the request id, route, function name and
user automatically. `userId` is logged as `u_` + a 12-char SHA-256 prefix; emails, phone numbers, JWTs, Bearer tokens
and Supabase keys are scrubbed from messages and fields, and password/secret/token/cookie/apikey-like fields are
redacted. Don't `console.log` on the server.

### Env and secrets

`src/lib/env.ts` (server-only) validates, with messages that name the variable: the public `VITE_SUPABASE_*` pair (and
refuses a secret key in any `VITE_*` variable), and the Worker's `APP_ENV`, `SUPABASE_SECRET_KEY` (the legacy
`SUPABASE_SERVICE_ROLE_KEY` is accepted as a fallback), `BREVO_API_KEY`, `EMAIL_FROM`, `EMAIL_SANDBOX` and
`SENTRY_DSN`. It reads them from
`import { env } from "cloudflare:workers"`: the one object that carries every binding, including the rate limiters,
the same in `vite dev`, `vite preview` and production (unit tests alias it to `tests/stubs/cloudflare-workers.ts`).
Locally, put them in `.dev.vars` (see `.dev.vars.example`; for the local stack `SUPABASE_SECRET_KEY` is the
`SECRET_KEY` line of `supabase status -o env`); remotely, `wrangler secret put SUPABASE_SECRET_KEY --env <preview|production>`.

### What's enforced

- **Client build:** `src/lib/env.ts`, `src/lib/supabase/{server,admin}.ts` import `@tanstack/react-start/server-only`,
  and `*.server.ts` modules are denied in the client environment by TanStack Start's import protection, so a
  browser import fails the build. `dist/client` contains no secret variable names or values.
- **Lint + `tests/unit/arch/boundaries.test.ts`:** the admin client only in `src/server/**`, `createServerFn` only in
  `src/server/fn.ts`, client-facing code imports only `@/server/functions/*` and `@/server/errors` (see **Lint rules**).
- **Tests:** `tests/unit/server/*` (auth, rate limit, request id, error boundary), `tests/unit/lib/{env,logger}.test.ts`;
  the rate-limit test also fails if `wrangler.jsonc`'s `ratelimits` drift from `src/server/rate-limits.ts`.
- **Rate limits** are Workers Rate Limiting bindings (`ratelimits` in `wrangler.jsonc`, repeated per env with their
  own `namespace_id`s; Miniflare simulates them locally). Without a binding an in-memory, per-isolate limiter takes
  over and says so once in the log.

### Roles & 2FA enforcement

**Account types** (`profiles.account_type`, enum `account_type`): `client` (the default for new sign-ups), `manager`
and `admin`. `manager` and `admin` are _staff_ (`private.is_staff()`); both may call `create_project` and become the new
project's manager. What someone can see inside a project still comes from `project_members.role`, not the account type (the route
guards and nav follow the same rule: see **Sessions & route guards**).
Users can't change their own account type (no column grant); `public.set_account_type(p_user, p_type)` is the only API
path, and only an `admin` may call it (not on their own account; with an `aal2` session while 2FA is enforced).

**Staff 2FA.** Internal data needs an MFA-verified (`aal2`) session while enforcement is on. _Restrictive_ RLS
policies (`… : staff mfa`, `as restrictive`, ANDed with the existing permissive ones) require `private.staff_mfa_ok()`
on `expenses`, `project_internal`, `contacts`, `project_contacts`, `stage_budgets`, `materials`, `activity_log` and `storage.objects` in bucket `project-internal`
(receipts). An `aal1` manager still sees the rest of the project (stages, rooms, photos, chat, the budget/spent
totals), just none of those rows. Clients are unaffected: they have no access to those tables anyway, and the storage
policy only looks at `project-internal`.

| Piece                         | What it does                                                                        |
| ----------------------------- | ----------------------------------------------------------------------------------- |
| `private.app_settings`        | One row; `enforce_staff_mfa` (default and migration value: `true`)                  |
| `private.staff_mfa_ok()`      | `true` when enforcement is off, or `auth.jwt() ->> 'aal' = 'aal2'`                  |
| `public.staff_mfa_required()` | The setting, for the UI: send `aal1` staff to the 2FA screen when it returns `true` |

**Per environment.** A database built from migrations alone (production) enforces 2FA. `supabase/seed.sql` turns it
**off**, so the local stack and the nightly-reseeded hosted demo work with the demo manager, who has no TOTP factor.
Never run the seed against production. To flip it by hand (SQL editor / psql, as the database owner):

```sql
update private.app_settings set enforce_staff_mfa = true;  -- or false
```

**Auth settings** (`supabase/config.toml`; locally they apply after `supabase stop && supabase start`): email
confirmation on sign-up, passwords of at least 10 characters with letters and digits, `secure_password_change`
(recent sign-in needed to change a password), and TOTP MFA enrol/verify enabled. Hosted projects take the same
settings from the dashboard (Authentication → Providers / Sign In / MFA). Seeded users are already confirmed and keep
their `renovision-demo-2026` password, which meets the password rules.

Tests: `tests/db/auth_hardening.test.sql`.

## Projects & contacts (T30)

```
projects ──< project_contacts >── contacts ──(user_id, optional)── profiles
  address_line, postal_code,          role: client | poc | crew        kind: client | crew | supplier
  city, country (PL)                        | supplier | architect     | architect | other
  address (generated, display)        is_primary, visible_to_client,   full_name, company, trade, phone,
  currency (PLN), status              sort_order                        whatsapp (E.164), email, notes
```

- **Projects.** The address is structured; `address` is a generated column (`"<line>, <postal code> <city>"`,
  blanks skipped), so readers keep working and nobody writes it. `currency` is an uppercase ISO 4217 code (forms
  offer PLN and EUR; format money with `format.money(amount, project.currency)`). `status` is the lifecycle
  (`planning` · `active` · `on_hold` · `completed` · `archived`, default `active`), separate from the schedule status.
  `create_project(p_name, p_address_line, p_postal_code, p_city, p_country, p_currency, p_status, p_client_name, …)`
  links the creator as the client-visible point of contact and, given a client name, a primary client contact.
- **Contacts** are the company's single address book: every staff account (manager or admin) reads and edits all
  of them; clients read none. `user_id` ties a contact to an app account (one contact per account). A project's
  crew, client and PoC are `project_contacts` rows; removing someone from a project deletes the link only.
- **What clients see.** Clients can't select `contacts` or `project_contacts`. `project_visible_contacts(project)`
  (security definer, members only) returns the `visible_to_client` rows of that project, and only their role,
  name, phone and email; the client overview's "Your contact" card reads it. `project_summary.client_display_name`
  (the primary client contact's name) comes from those tables too, so it is null for clients.

| Table / function              | Client                                    | Project manager                   | Other staff           |
| ----------------------------- | ----------------------------------------- | --------------------------------- | --------------------- |
| `contacts`                    | —                                         | all rows (staff)                  | all rows              |
| `project_contacts`            | —                                         | their projects' rows (read/write) | —                     |
| `project_visible_contacts(p)` | `visible_to_client` rows of their project | same                              | not a member: nothing |

Both tables also carry the restrictive staff-MFA policy (see **Roles & 2FA enforcement**). Linking and unlinking
is written to the activity log ("Added crew member "Marek Nowak""); edits to a contact itself are not, because
the log is per project and a contact isn't. Tests: `tests/db/contacts.test.sql`.

## Costs & materials (T31)

```
stages ──1:1── stage_budgets (planned_cost)          expenses.category: enum cost_category
   │                                                   labour | materials | permits | disposal | equipment | other
   ├──< expenses (spent)
   └──< materials ── expense_id ──> expenses          material_status: planned | ordered | delivered | installed
          quantity × unit_price, unit, status, room, supplier_contact_id ──> contacts, progress_entry_id (T32)
stage_costs (view): project_id, stage_id, planned, spent, committed, remaining
```

- **Planned cost** lives in `stage_budgets` (one row per stage, created with the stage), not on `stages`: clients read
  `stages`, and column privileges can't hide a column from clients only (clients and managers are both
  `authenticated`). Managers update `planned_cost` only; the row goes with its stage.
- **`stage_costs`** (`security_invoker`): `spent` is the sum of the stage's expenses; `committed` is `quantity ×
unit_price` of its `ordered`/`delivered` materials not yet linked to an expense (once linked, the expense counts
  them, so nothing is counted twice); `remaining = planned − spent − committed`. It starts from `stage_budgets`, so a
  client, or an `aal1` manager while 2FA is enforced, gets no rows rather than zeroes.
- **`import_materials(project, rows)`** inserts a JSON array of `{ name, quantity, unit, unit_price, status, stage,
room, supplier, notes }` all-or-nothing: stage and room by name within the project, supplier by contact name or
  company. It returns `{ inserted }` or raises `22023` with `DETAIL` = a JSON array of `{ row (1-based), field,
message }`, where `message` is a stable code (`required`, `not_a_number`, `must_be_positive`,
  `must_not_be_negative`, `too_large`, `too_long`, `invalid_unit`, `invalid_status`, `not_found`, `ambiguous`,
  `not_an_object`). Managers of the project only, with an `aal2` session while 2FA is enforced.

| Table / view / function     | Client                     | Project manager                     | Other staff |
| --------------------------- | -------------------------- | ----------------------------------- | ----------- |
| `stages`                    | visible stages (unchanged) | all (unchanged)                     | —           |
| `stage_budgets`             | —                          | read, insert, update `planned_cost` | —           |
| `materials`                 | —                          | all                                 | —           |
| `stage_costs`               | no rows                    | their projects' stages              | —           |
| `import_materials(p, rows)` | rejected (42501)           | their projects                      | rejected    |

`stage_budgets` and `materials` also carry the restrictive staff-MFA policy. Materials (and planned-cost updates)
go to the activity log. Tests: `tests/db/costs.test.sql`.

## Work data (T32)

```
projects ──< stages (progress_mode: tasks | manual) ──< tasks
   │ plan_image_path, plan_image_opts          ▲
   └──< progress_entries (site diary) ─────────┘ stage_id, room_id (same project)
             └──< photos.progress_entry_id
```

- **Stage progress from tasks.** A stage in `tasks` mode (the default) has its `progress` and `status` computed by
  the database: `round(100 * done / total)` of its tasks (0 with none, never 0% or 100% by rounding alone), and
  status follows it (0% pending, 1–99% in progress, 100% done). Triggers recompute it when a task is added, ticked,
  moved or deleted, and when the stage is saved or switched back to `tasks`; a derived status change notifies
  clients (`stage_status`) and is logged like a manual one. `blocked` is never overridden: it is set and cleared by
  hand, and while blocked the progress follows the checklist but stops at 99%. In `manual` mode nothing changes by
  itself. `@/domain/progress` (`taskProgress`, `deriveFromTasks`) is the client-side mirror. The migration kept
  `tasks` only for stages that already matched their checklist; the demo's Walls & Insulation and Flooring are
  `manual`, the other five `tasks`.
- **Site diary.** `progress_entries`: a dated note per project with an optional stage, room and hours; diary photos
  point at their entry with `photos.progress_entry_id` (a photo still reaches clients only once published).
- **Floor-plan image.** `projects.plan_image_path` (`<project_id>/plans/<file>` in `project-media`) and
  `plan_image_opts` (`{ opacity, scale, x, y }`), both on `project_summary`.
- **`import_stages(project, rows)`** (managers): stages with nested tasks (rooms by name), all or nothing; invalid
  input raises `22023` with a JSON array of `{ row, field, code }` as the error detail.

| Table / object                        | Client                                | Project manager |
| ------------------------------------- | ------------------------------------- | --------------- |
| `progress_entries`                    | `is_visible` entries of their project | read/write      |
| `project-media` `<project>/plans/...` | read                                  | read/write      |
| `projects.plan_image_*`               | read (`project_summary`)              | update          |
| `import_stages`                       | —                                     | execute         |

Tests: `tests/db/work.test.sql`.

## Room view (#56)

`/projects/<id>/rooms/<room>` (opened from the plan's selected-room panel): a room's works, materials with their
delivery status, and warnings for the investor. Everything is entered by hand by the site manager; clients read it.

```
rooms ──< tasks (stage_id and/or room_id, state: todo | in_progress | done)    ONE source of progress
rooms ──< materials (order_by_date, delivery_date, status planned|ordered|delivered|installed)
rooms ──< room_warnings (text) ──< room_warning_materials >── materials
```

- **Works are tasks.** `tasks.stage_id` is now nullable (at least one of `stage_id` / `room_id` is required); a task
  may belong to a stage, a room or both. `done` stays the only progress flag; the new `in_progress` flag only marks a
  started, unfinished task (state = done ? done : in_progress ? in progress : to do, `@/domain/progress` `taskState`).
  `tasks.project_id` still comes from the stage, or from the room for a room-only task. Deleting a room deletes its
  room-only tasks; its stage tasks stay without a room.
- **Room progress is derived**, like a stage's: `rooms.progress_mode` (`tasks` default | `manual`). In `tasks` mode, once
  a room has tasks, `progress` = the same `round(100 * done / total)` rule as stages (`deriveFromTasks`), status follows
  it, `blocked` is never overridden (progress capped at 99), and `(status = 'done') = (progress = 100)` still holds. A room
  without tasks keeps its hand-set values. Existing rooms whose numbers differ from their tasks were backfilled to
  `manual` (the demo's Living Room, Kitchen and Bathroom). The old "re-opening a task on a Completed room" guard now only
  applies to `manual` rooms. A stage's progress only counts its own tasks; room-only tasks never touch it.
- **Material colours** (`@/domain/materials`): red = `planned` (not ordered, "najpóźniej zamówić do <order_by_date>"),
  orange = `ordered` ("dostawa <delivery_date>"), green = `delivered` / `installed`. `installed` is kept.
- **Clients never see prices.** `materials` stays managers-only (restrictive staff-MFA policy included). Clients read a
  room's materials through `room_materials(room)`: a security-definer function returning only name, quantity, unit,
  status and the two dates (no price, supplier, notes or expense), for managers (with an MFA session while 2FA is
  enforced) and for clients of the project (visible rooms only). A `security_invoker` view could not do this: it would
  return nothing to clients, and column privileges can't tell two `authenticated` users apart. Same pattern as
  `project_visible_contacts`. The room view's material form has no price field.
- **Warnings ("Uwaga do inwestora")** are risks, never a date change. A warning is **open while any linked material is
  `planned` or `ordered`; a warning with no linked material stays open until a manager removes it**
  (`private.warning_is_open` in the database, `isWarningOpen` in `@/domain/room-warnings`). Clients only read open
  warnings of visible rooms (RLS: `private.client_can_see_warning`); managers read all of them and see the resolved ones
  marked. Linked materials must belong to the warning's room. `rooms.client_note` is untouched.

| Table / function         | Client                                      | Project manager  |
| ------------------------ | ------------------------------------------- | ---------------- |
| `tasks`                  | visible tasks (room-only: of visible rooms) | read/write       |
| `room_materials(room)`   | the safe columns, visible rooms             | the safe columns |
| `materials`              | —                                           | all (unchanged)  |
| `room_warnings`          | open warnings of visible rooms              | read/write       |
| `room_warning_materials` | the links of those warnings                 | read/write       |

Tests: `tests/db/room_view.test.sql`, `tests/unit/work/room-view*.test.ts(x)`, `tests/unit/domain/{materials,room-warnings}.test.ts`.

## Sessions & route guards

**Cookie sessions.** The browser Supabase client (`@/lib/supabase`) is `@supabase/ssr`'s `createBrowserClient`, so
the session (access + refresh token) lives in the `sb-<ref>-auth-token` cookie(s), not localStorage: `Path=/`,
`SameSite=Lax`, `Secure` in production builds (`src/lib/supabase/cookies.ts`). The server reads the same cookies
(`createServerSupabase()`, one cookie client per request) and, when the access token has expired, refreshes it
and writes the new cookies on the response. A session left in localStorage by an older build is moved into the
cookies once on the next visit (`migrateLegacySession`), so nobody has to sign in again.

**Why not `HttpOnly`.** The browser client talks to Supabase directly (PostgREST, Storage, Realtime), so it must
read the token from `document.cookie`, which rules out `HttpOnly`. The trade-off is the same as the localStorage
session it replaces: script running on the page (XSS) could read the token. What we gain is that the server sees
the session on a hard load. Mitigations: `SameSite=Lax` (cross-site requests don't carry it), the CSRF check on
server functions, short-lived access tokens (≤ 1 h), and RLS on every query.

**The session in the router context.**

```
hard load ──▶ root beforeLoad ──▶ context.session.load() ──▶ getSession()  (src/server/functions/session.ts)
                                                             cookies → getClaims (like requireUser) → profile
           ◀── context.auth = { user: { id, email, aal } | null, profile: { full_name, avatar_url, account_type, locale } | null }
```

`getSession` never 401s: signed out is `{ user: null, profile: null }`. The router dehydrates `auth` (and the
query cache) to the browser, so the first client render matches the SSR HTML without another request. In the
browser, `<AuthSync />` (`src/lib/auth.tsx`, mounted in `__root.tsx`) listens to `onAuthStateChange`: on sign-in,
sign-out, a user update or an MFA step-up it clears the cached session and the query cache and calls
`router.invalidate()`, which re-runs `getSession` and every guard. `useAuth()` reads `auth` from the root route's
context (plus `signIn` / `sendMagicLink` / `signOut`).

During SSR, `@/lib/supabase` resolves to the request's cookie client (RLS as the user), so a route `loader` can
prefetch through the normal repositories, e.g. `context.queryClient.prefetchQuery(stagesQuery(id))` (see
`routes/project/overview.tsx`); in the browser it is the cookie-backed singleton.

**Guards** run in `beforeLoad`, so on a hard load they run on the server (a `307`, never a client-side redirect
after a loading screen) and in the browser on navigation. The decisions are pure functions in
`src/features/auth/domain/guards.ts`.

| Route                                                    | Signed out            | Client (on this project)            | Manager (on this project) | Not a member                         |
| -------------------------------------------------------- | --------------------- | ----------------------------------- | ------------------------- | ------------------------------------ |
| `/login`                                                 | sign-in screen        | → `?redirect=` (same-origin) or `/` | same                      | same                                 |
| `/`                                                      | → `/login?redirect=/` | → their first project               | → `/projects`             | —                                    |
| `/projects`, `/settings`                                 | → `/login?redirect=…` | page                                | page                      | —                                    |
| `/projects/<id>`, `progress`, `photos`, `design`, `chat` | → `/login?redirect=…` | page                                | page                      | "Project not available" (`notFound`) |
| `/projects/<id>/budget`, `updates`, `knowledge`, `team`  | → `/login?redirect=…` | → `/projects/<id>` (overview)       | page                      | "Project not available"              |

- **`_authed`** (`src/routes/_authed.tsx`, a pathless layout in `routes.config.ts`): every app route sits under
  it; no user → `/login?redirect=<current href>`. It also renders the app shell (rail, bottom bar), so `/login`
  doesn't get one. Children get `context.user` (never null).
- **`/login`** (`src/routes/login.tsx`): a signed-in user goes to `redirect` if it is a same-origin path, else `/`
  (through `/mfa` first when 2FA is set up and the session is `aal1`; see **Auth screens & 2FA** below).
- **2FA for staff** (`_authed`): `aal1` managers/admins go to `/mfa` or `/mfa/enroll` while
  `staff_mfa_required()` is true (matrix below).
- **Project layout** (`src/routes/project/layout.tsx`): the user's **per-project role** comes from
  `project_members` via the `getProjectAccess` server function, cached in the query client
  (`projectAccessQuery` in `features/auth/hooks`, 5 min); not a member → `notFound()` (the existing empty state),
  a client on a `managerOnlySections` page → the overview.
- **Nav role** (`useNavRole`, `src/shared/ui/nav-role.ts`): inside a project the per-project role, so a manager
  account invited as a client somewhere gets the client nav there; outside a project `profiles.account_type`
  (only `manager` gets the manager nav there; `admin` is treated like a non-manager until its UI is decided).
  Role-aware project pages use the same hook.

These guards decide what to render and where to send people. **RLS is still the enforcement**: a guard that
let someone through could not show them data Postgres refuses to return.

### Sharing a page with the investor

There is no anonymous or token access. "Copy link for investor" (managers only, in the project top bar, not on
manager-only sections) copies the URL of the current project page, query string included (`investorShareUrl` in
`features/auth/domain/guards.ts`). The investor opens it, is sent to `/login?redirect=<that page>`, signs in with
their client account and lands on the page; nobody signed out sees anything. An account that isn't a member of the
project gets "Project not available". To revoke access, remove or change the project's client: the link then stops
working for that account (RLS and the guards decide, the URL carries no permission).

### Auth screens & 2FA (T22)

| Route                                                  | Who                     | What                                                                                                                           |
| ------------------------------------------------------ | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `/login`                                               | public                  | email + password; "Email me a sign-in link" (magic link, keeps `?redirect=`); "Forgot password?"; demo hint (`VITE_DEMO_HINT`) |
| `/forgot-password`                                     | public                  | `resetPasswordForEmail(email, { redirectTo: <origin>/reset-password })`; always the same "if an account exists…" answer        |
| `/reset-password`                                      | public (link session)   | the recovery link → new password (10+ characters, letters + digits) → signed in, into the app; expired link → error + new one  |
| `/mfa`                                                 | signed in, aal1 or aal2 | TOTP challenge → aal2 → `?redirect=`; no verified factor → `/mfa/enroll`                                                       |
| `/mfa/enroll`                                          | signed in               | QR code (an `img` with the `data:image/svg+xml` URI Supabase returns; CSP `img-src data:`) + secret → first code → aal2        |
| `/settings`, `/settings/profile`, `/settings/security` | signed in               | index; name, photo, language; 2FA (status, factors, add/remove), password change, the session as `getMe` sees it               |

**Where people go after signing in.** `/login`'s beforeLoad sends a signed-in user to `?redirect=` (same-origin
only), through `/mfa` first when the session is `aal1` and the account has a verified TOTP factor (any account
type: 2FA you set up is always asked for). Sign-in itself never navigates: supabase-js emits `SIGNED_IN`, `AuthSync`
re-runs the guards. After a 2FA verification the screen refreshes the session (`useSessionRefresh()` in
`src/lib/auth.tsx`) before navigating, so the next page's guards already see `aal2`.

**The staff 2FA redirect** (`_authed` beforeLoad, `resolveStaffMfaStep` in `features/auth/hooks/mfa.ts`, decisions in
`features/auth/domain/mfa-guard.ts`):

| Account         | Session | `staff_mfa_required()` | Verified factor | Goes to                                            |
| --------------- | ------- | ---------------------- | --------------- | -------------------------------------------------- |
| manager / admin | aal1    | true                   | yes             | `/mfa`                                             |
| manager / admin | aal1    | true                   | no              | `/mfa/enroll` (no "Not now", only sign-out)        |
| manager / admin | aal1    | false                  | –               | the page                                           |
| manager / admin | aal2    | – (not asked)          | –               | the page                                           |
| client          | any     | – (not asked)          | –               | the page                                           |
| manager / admin | aal1    | RPC error              | –               | the page + `logger.warn` (fail open: RLS enforces) |

`staff_mfa_required()` and the factor list are TanStack Query entries (`authKeys.staffMfaRequired/mfaFactors`):
read once per request during SSR, dehydrated with the page, then cached for 5 minutes in the browser; sign-in/out
clears them with the rest of the cache. Factors are read with `mfa.listFactors()` (a `getUser` call to Supabase
Auth, also on the server), not from the cookie's copy of the user.

**Email links.** The auth emails link to `{{ .ConfirmationURL }}` (T24's templates). Since the browser client uses
PKCE, those land with `?code=…`, which the browser client exchanges by itself on load (with the code verifier it kept
in a cookie), so a link has to be opened in the browser that asked for it; a code that couldn't be exchanged, or
gotrue's `#error_code=otp_expired` redirect, shows "link invalid or expired". `/login` and `/reset-password` also
accept `?token_hash=…&type=…` (verified with `verifyOtp`), which is what the admin API's `generateLink` gives you
for testing. gotrue only accepts a new password from an `aal2` session when the account has a verified factor, so
`/reset-password` (and Settings → Security) send such accounts through `/mfa` first.

**Password changes** (`secure_password_change`): a session younger than 24 h changes the password directly; an
older one gets `reauthentication_needed`, so the form calls `reauthenticate()` (the `reauthentication` email with a
6-digit code) and retries with `updateUser({ password, nonce })`.

**2FA housekeeping.** Starting an enrollment first unenrolls the user's unverified TOTP factors (abandoned setups);
leaving the screen before the first code unenrolls the new one. Settings → Security can remove a verified factor
only from an `aal2` session (gotrue's rule) and never a staff member's last one while enforcement is on.

**Redirect URLs** (`supabase/config.toml` `[auth]`): `site_url` is `http://localhost:5173` (`bun run dev`) and
`additional_redirect_urls` allows `vite dev` (5173), `vite preview` (4173) and `wrangler dev` (8787) on `localhost`
and `127.0.0.1` (gotrue also accepts any port on `site_url`'s host). Hosted projects need their deployed origin in
Authentication → URL Configuration. Restart the local stack after changing them.

**Demo passwords.** All demo accounts use `renovision-demo-2026`, which meets the password rules, so the admin API can set it
again; with SQL: `update auth.users set encrypted_password = extensions.crypt('renovision-demo-2026', extensions.gen_salt('bf')) where email = '…';`.

## Security headers

`src/server/middleware/security-headers.ts` is a request middleware (registered in `src/start.ts`, outside
`errorMiddleware` so the branded 500 page gets it too) that adds a fixed set of headers to **HTML responses only**
(checked by `content-type`; server-function JSON, CSRF's plain-text 403 and static assets pass through untouched):

- **`Content-Security-Policy`:** `default-src 'self'`, `base-uri 'self'`, `object-src 'none'`, `frame-ancestors 'none'`,
  `form-action 'self'`, `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com`,
  `font-src https://fonts.gstatic.com`, `img-src 'self' data: blob: <VITE_SUPABASE_URL origin>` and
  `connect-src 'self' <VITE_SUPABASE_URL> <its ws(s):// origin> <Sentry ingest origin, if VITE_SENTRY_DSN is set>`.
  A `script-src` nonce: see below.
- **`Strict-Transport-Security: max-age=31536000; includeSubDomains`** — present on every built response (`vite preview`,
  `wrangler dev`, production), omitted only under `vite dev` (plain http, no real TLS to pin).
- **`X-Content-Type-Options: nosniff`**, **`Referrer-Policy: strict-origin-when-cross-origin`**,
  **`Permissions-Policy: camera=(self), microphone=(), geolocation=()`**.
- **The rest of helmet's defaults** (see below): `Cross-Origin-Opener-Policy: same-origin`,
  `Cross-Origin-Resource-Policy: same-origin`, `X-Frame-Options: DENY`, `Origin-Agent-Cluster: ?1`,
  `X-Permitted-Cross-Domain-Policies: none`, `X-DNS-Prefetch-Control: off`.
- **`vite dev` relaxations** (gated on `import.meta.env.DEV`, i.e. never in a built bundle): `script-src` gets
  `'unsafe-inline' 'unsafe-eval'` (no nonce source alongside it — mixing the two would make a CSP-Level-2+ browser
  ignore `'unsafe-inline'` entirely, per spec, and break Vite's HMR/React-refresh preamble, which injects its own
  un-nonced inline scripts) and `connect-src` gets `ws:`, both for Vite's HMR client.

**No [helmet](https://helmetjs.github.io) package.** helmet is Express/Node middleware built on
`req`/`res`; this app is TanStack Start (h3) on Cloudflare Workers, so it doesn't apply — there's no `req`/`res`
for it to patch. `securityHeadersMiddleware` already covers helmet's core defaults by hand: the CSP above (with a
nonce — helmet's own CSP middleware doesn't generate one), HSTS, `X-Content-Type-Options`, `Referrer-Policy` and
`frame-ancestors 'none'` (CSP's modern equivalent of framing protection). `HELMET_EQUIVALENT_HEADERS` (exported for
`src/server/healthz.ts` to reuse on `/healthz`, a non-HTML response outside the branch above) adds the rest of
helmet's defaults: `Cross-Origin-Opener-Policy`/`Cross-Origin-Resource-Policy: same-origin` and
`X-Frame-Options: DENY` (a legacy fallback for browsers that predate `frame-ancestors`), plus
`Origin-Agent-Cluster: ?1`, `X-Permitted-Cross-Domain-Policies: none` and `X-DNS-Prefetch-Control: off`.
**Not** `Cross-Origin-Embedder-Policy: require-corp` (also a helmet default): it would block the cross-origin
images (Supabase Storage) and fonts (Google Fonts) this app actually loads, since neither currently serves
`Cross-Origin-Resource-Policy: cross-origin` or CORS headers for those requests.

**Script nonce (T26).** Outside dev, `script-src` is `'self' 'nonce-<value>'` — no `'unsafe-inline'`.
`securityHeadersMiddleware` generates 128 random bits (base64) per request, _before_ calling `next()`, and hands it
to `src/router.tsx` via a same-request response-header round trip (`src/lib/csp-nonce.ts`, read with
`getResponseHeader`): `createRouter({ ssr: { nonce } })` makes TanStack Start (`@tanstack/router-core`'s
`createHydrationScripts`/`getSsrBodyScriptParts`, which read `router.options.ssr?.nonce`) stamp the same nonce onto
every inline/module script tag it renders. The handoff header is stripped from the response before it leaves (not
sensitive — a nonce is public the instant it's in the HTML — just not part of the header contract).

`tests/unit/server/security-headers.test.ts` covers the header set (every header present, the CSP directives, the
nonce wiring, HSTS and the dev relaxations) and that non-HTML responses are left alone.

## Observability

**Sentry** (`src/lib/sentry-*.ts`), EU data region: both DSNs must point at a `*.ingest.de.sentry.io` project
(pick "EU" when creating it). **Everything is a no-op without a DSN** — no SDK init, no network calls — so local
dev and CI never need a Sentry account.

- **Worker** (`src/lib/sentry-worker.ts`): `@sentry/cloudflare`'s `withSentry` wraps `src/server.ts`'s default
  export. `SENTRY_DSN` is a secret (`.dev.vars` locally; `wrangler secret put SENTRY_DSN --env <preview|production>`
  remotely), read through `@/lib/env` like every other secret. The branded 500 page (`brandedErrorResponse`) and
  the h3-swallowed-SSR-error path both still work exactly as before (T23); they now also call
  `captureServerException` (a no-op without a DSN).
- **Browser** (`src/lib/sentry-client.ts`): `@sentry/react`, initialized once in `src/router.tsx` from
  `VITE_SENTRY_DSN` — a public, build-time value (a DSN is [public by
  design](https://docs.sentry.io/concepts/key-terms/dsn-explainer/#dsn-public-by-design): it only lets the browser
  POST events to that one project). Wrapped in `createClientOnlyFn` (same mechanism as `src/i18n/request-locale.ts`)
  so the Start compiler erases `@sentry/react` from the Worker bundle entirely; `src/router.tsx` additionally guards
  the call with `typeof document !== "undefined"`, since `createClientOnlyFn`'s compiled server-side stub _throws_
  if ever called (a safety net, not a silent no-op) and `getRouter()` runs on both the server and the browser.
- **Settings:** `sendDefaultPii: false`; `environment` is `APP_ENV` (Worker) / `import.meta.env.MODE` (browser);
  `release` is the build-time git SHA (`CF_PAGES_COMMIT_SHA` or `GITHUB_SHA`, "dev" otherwise — a Vite `define`,
  `__APP_RELEASE__`, see `vite.config.ts` and `src/lib/sentry-config.ts`); `tracesSampleRate: 0.1`; no session replay.
- **Scrubbing** (`src/lib/sentry-scrub.ts`, shared `beforeSend`/`beforeBreadcrumb` for both SDKs): reuses the
  logger's PII rules (`src/lib/pii-scrub.ts`, factored out of `src/lib/logger.ts` in this PR — its own behavior and
  tests are unchanged) — emails, phone numbers, JWTs, Bearer tokens and Supabase keys become placeholders;
  password/secret/token/cookie/apikey-like fields are redacted. On top of that: request `cookies` are dropped
  entirely and the `authorization`/`cookie` headers are redacted; `user` is reduced to the hashed id only (the same
  `hashUserId` the logger uses) — never an email, username or IP.
- **Request id:** the Worker tags every event for a request with it (`Sentry.setTag`, ambient isolation scope —
  see `tagRequestId` in `src/server.ts`). In the browser, `reportClientError` (`src/lib/sentry-client.ts`) tags it
  too when the error is a `ServerFnError` that carries one.
- **Error reporting:** `src/routes/__root.tsx`'s root `errorComponent` reports whatever it catches, except a
  `ServerFnError` below 500 (401/403/404/429 are expected, handled rejections, not incidents).

**Health check.** `GET /healthz` (handled directly in `src/server.ts`, before the TanStack Start handler — there's
no server-route/API-route feature in the installed TanStack Start 1.168, only page routes and RPC server
functions) returns `{ ok, version, time, checks: { worker: "ok", supabase: "ok" | "error" } }`: 200 when every
check is ok, 503 otherwise. The Supabase check (`src/server/healthz.ts`) is a single unauthenticated
`GET <VITE_SUPABASE_URL>/auth/v1/health` with the publishable key and a 2s timeout. No auth, no PII,
`Cache-Control: no-store`, `X-Content-Type-Options: nosniff` (outside the HTML security-headers branch above).

**Setup checklist** (none of this is required for local dev or CI):

1. Create a Sentry project in the **EU** region.
2. `wrangler secret put SENTRY_DSN --env <preview|production>` (the server DSN).
3. Set `VITE_SENTRY_DSN` (the public browser DSN) wherever the build runs (CI/CD build-time env, or a local
   `.env.local` to test it).
4. For CI's source-map upload (`.github/workflows/ci.yml`, `getsentry/action-release`): add the `SENTRY_AUTH_TOKEN`,
   `SENTRY_ORG` and `SENTRY_PROJECT` repository secrets. Without all three the step is skipped, not failed.

## Uploads

Site photos and design renders (`features/media`) are validated and sanitized client-side before upload
(`features/media/domain/upload.ts`, `strip-exif.ts` — pure rules kept separate from the canvas work so they're
unit-testable):

- **Mime type and size**, checked against the `project-media` bucket's rules: jpeg/png/webp/heic for photos
  (jpeg/png/webp only for renders — a render is never HEIC), 15 MB max. A rejected file shows a translated error on
  the form field (the upload/render zod schemas call `validateFile`).
- **EXIF/GPS stripping.** A standard raster image (jpeg/png/webp) is re-encoded: `createImageBitmap` decodes it,
  the longest edge is capped at 2560px, and it's redrawn to a canvas (`OffscreenCanvas` when available) and
  exported as JPEG at quality 0.9 — redrawing drops every metadata segment, EXIF/GPS included. The capture date
  (EXIF `DateTimeOriginal`, read with [`exifr`](https://github.com/MikeKovarik/exifr) **before** re-encoding, since
  that destroys it) becomes the photo's `taken_at` instead of "now".
- **HEIC** can't be canvas-decoded by browsers, so it's uploaded unchanged — the upload sheet shows a translated
  note that its location data may still be present. Its capture date is still read with `exifr`, which parses HEIC's
  EXIF box the same way.
- `reencodeImage`'s canvas path needs `createImageBitmap` and a real 2D canvas, neither available in jsdom (no
  `canvas` npm polyfill here): `tests/unit/media/strip-exif.test.ts` covers the pure rules and `extractTakenAt`
  (against `tests/fixtures/gps.jpg`, a hand-built JPEG carrying GPS + `DateTimeOriginal` EXIF); the re-encode path
  was checked by hand against the running app (upload → download the stored object → `exifr` shows no GPS and the
  right `taken_at`), not in this suite.

**Atomic deletes.** `deletePhoto`, `deleteRender` and `deleteExpense` (`src/server/functions/{media,expenses}.ts`) are
manager-only server functions (`authedFn` + `requireProjectRole(..., "manager")`) that delete the DB row and then
remove the storage object, both as the user (`context.supabase`, RLS applies) — one call instead of the client doing
both and risking an orphan when the second fails. If the storage removal fails, it's logged (`logger.error`, with the
path and the automatic request id) as an orphan marker for manual cleanup, but the call still reports success: the
row is gone, which is what the UI and the rest of the app care about. `features/media/hooks` and
`features/budget/hooks` call these instead of the old two-call repository methods.

## Notifications, activity and comms data (T33)

**Translatable notifications.** Triggers (`private.notify_on_change`, `private.notify_message`) and the
`notify_project_clients` RPC write one row per recipient with a stable `kind` and `params` (jsonb). The app renders
them through i18n (`useNotificationText()` in `features/comms/hooks/use-notification-text.ts`, keys
`comms:notifications.*`); user-written values (names, captions, notes, announcements) are shown as written.
`title`/`body` are still filled with the English text (legacy, for older readers) and are the fallback for a kind the
app doesn't know or a row missing a value (rows written before T33 carry the old kinds `stage`, `room`, …).

| `kind`             | `params`                          | Written when                           |
| ------------------ | --------------------------------- | -------------------------------------- |
| `stage_status`     | `{ stage, status }`               | a visible stage's status changes       |
| `room_status`      | `{ room, status, note }`          | a visible room's status changes        |
| `photo_published`  | `{ caption }`                     | a photo is published                   |
| `render_published` | `{ title, description }`          | a render becomes visible               |
| `schedule_status`  | `{ status, note }`                | the project's schedule status changes  |
| `message`          | `{ sender, preview, attachment }` | a chat message (to every other member) |
| `manual`           | `{ title, body }`                 | a manager's announcement               |

`status` is a `work_status` (`common:status.*`) or, for `schedule_status`, a `schedule_status` (`common:schedule.*`).
`notifications.emailed_at` is for T41's email delivery (null until sent).

**Activity log.** `private.log_activity` writes `params: { entity, action, label }` next to the English `summary`
(`entity`: `stage`, `room`, `task`, `photo`, `render`, `expense`, `project`, `internal_notes`, `member`,
`ai_knowledge`, `crew_member`, else the table name; `action`: `insert` | `update` | `delete`). The manager's
activity list renders it with `useActivityText()` (`comms:activity.*`) and falls back to `summary` for an entity it
has no label for. A new table logged by `log_activity` needs a branch in its `v_entity_key` and a
`comms:activity.entity.*` key.

**Preferences, invitations, consents.**

| Table / function                                 | Who can do what (RLS + grants)                                                                                                                                                                                                 |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `notification_preferences` (user, kind, channel) | each user reads/writes only their own rows                                                                                                                                                                                     |
| `notification_pref(user, kind, channel)`         | the effective frequency: the saved row, else `in_app` instant; `email` instant for `message`, daily for clients, off for staff on other kinds. A user may only ask about themselves; the server (no `auth.uid()`) about anyone |
| `invitations`                                    | the project's managers read (every column but `token_hash`); nobody inserts/updates/deletes through the API: a server function creates them with the admin client (T40); managers revoke with `revoke_invitation(id)`          |
| `consents` (user, kind, version)                 | users insert and read their own; no update or delete (an audit trail); `granted_at` is always the server's time                                                                                                                |
| `profiles.locale`, `profiles.phone`              | users update their own (column grants, like `full_name`); `phone` is visible to project peers like the name                                                                                                                    |

### Data deletion (GDPR)

Deleting a user (`auth.users` → `profiles`, cascade) removes their **personal** rows and keeps **project** data with
the author set to null, so a project's history stays readable:

| Reference                                             | On delete  | Why                                                         |
| ----------------------------------------------------- | ---------- | ----------------------------------------------------------- |
| `project_members.user_id`                             | cascade    | their membership                                            |
| `notifications.recipient_id`                          | cascade    | their own inbox                                             |
| `notification_preferences.user_id`                    | cascade    | their settings                                              |
| `consents.user_id`                                    | cascade    | their consent records (personal data)                       |
| `messages.sender_id`                                  | `set null` | the chat stays; the app shows the sender as "Former member" |
| `photos.uploaded_by`, `expenses.created_by`           | `set null` | project data                                                |
| `ai_knowledge.created_by`, `notifications.created_by` | `set null` | project data                                                |
| `invitations.invited_by`, `projects.created_by`       | `set null` | project data                                                |
| `activity_log.actor_id`                               | no FK      | the audit trail keeps the old id (shown as "Former member") |

A project's **last manager can't be deleted** (`guard_last_manager`): add another manager first, or delete the
project. Tests: `tests/db/comms.test.sql`.

## Email

Two separate systems, on purpose:

- **Auth emails** (signup confirmation, invite, magic link, password recovery, email change,
  reauthentication) are sent by **Supabase Auth itself**, from localized HTML templates — not a
  send-email hook. A hook would make every auth email (including sign-in) depend on our Worker being
  up; Supabase's own mailer doesn't. **Locally they stay inside Supabase's own local mail catcher**
  (`[local_smtp]` in `config.toml`, bundled with the CLI) — that's Supabase's tooling, not ours; we
  don't build anything on top of it.
- **App emails** (notifications, digests — T41; T40's invite may just reuse the auth invite) go
  through **`src/server/email`**, our own `sendEmail()` talking to Brevo. There's no local
  mail-catcher stand-in for this path either: Brevo itself is tested directly, in sandbox mode (see
  below), rather than relying on a different tool in dev.

Both render through the same shared design-system components (`src/server/email/design/`), so every
RenoVision email — auth or app — looks like it came from the same product.

### The shared design system (`src/server/email/design/`)

Email clients can't read CSS variables, oklch colors or Tailwind, so `tokens.ts` mirrors the subset of
the design system's tokens that emails need as literal hex/px values — M3 color roles (primary,
surface, outline, …), a type scale, radii and spacing — each one commented with the `--m3-*`/
`--radius-*` variable in `src/styles.css` it mirrors. **A drift test**
(`tests/unit/email/design-tokens.test.ts`) converts `styles.css`'s oklch values to sRGB and fails the
moment `tokens.ts` disagrees (±1 per channel, for rounding).

`components.ts` builds `Layout` (the branded header — a logo at an absolute URL built from a
`siteUrl` param, see below — plus the card and footer), `Heading`, `Text`, `Button`, `Muted` and
`Divider` as table-based, inline-styled HTML fragments from those tokens. Every email — the two app
templates and the six generated auth templates — is assembled from these; there's no separate,
hand-rolled HTML anywhere.

**The logo.** `public/email-logo.png` (served at the site root by Vite, e.g.
`https://app.renovision.app/email-logo.png`) is a small PNG version of the brand mark — email clients
need a real, absolute image URL, not the inline SVG the app itself uses.

### Auth emails (Supabase Auth's own templates, generated)

`supabase/templates/*.html` (`confirmation`, `invite`, `recovery`, `magic_link`, `email_change`,
`reauthentication`) are wired up in `supabase/config.toml`:

```toml
[auth.email.template.confirmation]
subject = "{{ if eq .Data.locale \"en\" }}Confirm your email address{{ else }}Potwierdź adres e-mail{{ end }}"
content_path = "./supabase/templates/confirmation.html"
```

**These files are generated, not hand-written.** `scripts/build-auth-email-templates.ts`
(`bun run email:build`) renders each one from the shared components above and the copy in
`src/server/email/design/auth-copy.ts` (pl/en, one place), keeping Supabase Auth's Go-template
placeholders — `{{ .ConfirmationURL }}`, `{{ .Token }}`, `{{ .NewEmail }}`, `{{ .SiteURL }}` (the
logo's absolute URL) and the locale conditional — literally in the output for gotrue to fill in. **Never
hand-edit a file in `supabase/templates/`**: change the copy or the components and regenerate.
`tests/unit/email/auth-templates-freshness.test.ts` regenerates every template in memory and fails if
a checked-in file doesn't match byte-for-byte, so a stale template fails CI.

Each template is **localized with Go-template conditionals** on the signed-in (or signing-up) user's
`user_metadata.locale`, **Polish by default**:

```html
{{ if eq .Data.locale "en" }}
<p>Reset your password</p>
{{ else }}
<p>Zresetuj hasło</p>
{{ end }}
```

The variable names (checked against the Supabase CLI **2.118.0** / gotrue v2.197.0 source, since the
hosted dashboard's docs don't version-pin them) are `.ConfirmationURL` (link-based flows),
`.Token`/`.TokenHash` (the OTP and its hash — reauthentication only has `.Token`, no confirmation
link), `.SiteURL`, `.RedirectTo`, `.Email`, `.NewEmail` (email_change only) and `.Data` (the user's
`user_metadata`, hence `.Data.locale`).

**Getting the locale into `user_metadata`.** The app keeps the UI language in `profiles.locale` (see
**Internationalization**), which the Supabase Auth templates can't read. `updateUserLocale()`
(`src/features/auth/data/locale.repo.ts`, re-exported from `features/auth/hooks`) calls
`supabase.auth.updateUser({ data: { locale } })` and is called from two places: the language switch
on `/settings/profile` (`useSaveLocale()`, after saving the profile), and after sign-in when the
metadata differs from `profiles.locale` (`<AuthSync />` in `src/lib/auth.tsx`, so older accounts get
backfilled). Best-effort: a failed sync never blocks the language switch.

**Config and template changes only take effect after `supabase stop && supabase start`.**

**Hosted setup checklist** (production/preview Supabase projects — the dashboard doesn't read this
repo's `config.toml`):

1. Create a Brevo account and **verify a sender domain** (SPF + DKIM records) so RenoVision's From
   address isn't flagged as spam.
2. Brevo → SMTP & API → SMTP: copy the login + an **SMTP key** (not the transactional API key below).
3. Supabase Dashboard → Authentication → Settings → SMTP Settings: enable custom SMTP, host
   `smtp-relay.brevo.com`, port `587`, the Brevo SMTP login/key, sender name/email matching the
   verified domain.
4. Supabase Dashboard → Authentication → Email Templates: **paste each `supabase/templates/*.html`
   file's content** (run `bun run email:build` first so they're current) and the matching subject
   (copied verbatim from `config.toml`) into the matching template. (The CLI's `supabase config push`
   can push `[auth.email.template.*]` to a linked hosted project instead of pasting by hand —
   untested here, but worth trying before a manual paste becomes a recurring chore.)
5. `wrangler secret put BREVO_API_KEY --env <preview|production>` for the **app** email path below
   (a different credential: Brevo's transactional API key, not the SMTP key from step 2).

**Optional: a Send Email Hook.** Supabase Auth also supports a
[Send Email Hook](https://supabase.com/docs/guides/auth/auth-hooks/send-email-hook) — a Postgres
function or HTTPS endpoint that receives every auth email and can render/send it however it likes
(e.g. through our own `sendEmail()` below, for one unified provider and one place to log deliveries).
Not implemented here: it would route every auth email (including sign-in's magic link) through our
Worker, which is exactly the single point of failure this design avoids. If that trade-off ever looks
worth it, `auth.hook.send_email` in `config.toml` is where it would be wired up, pointing at a new
server function that calls `sendEmail()`.

Tests: `tests/unit/email/auth-templates.test.ts` (every template file exists, has both locale
branches, references the right gotrue variable, and balanced `{{ if }}`/`{{ end }}` tags — read as
text, since Go templates aren't renderable here) and `auth-templates-freshness.test.ts` (above).

### App emails (`src/server/email`)

```ts
import { sendEmail } from "@/server/email/send-email.server";

await sendEmail({
  to: user.email,
  template: "notification", // or "digest"
  locale: "pl",
  params: {
    siteUrl: "https://app.renovision.app",
    title: "Nowe zdjęcia",
    body: "Dodano 4 zdjęcia.",
    linkUrl: `${siteUrl}/projects/${id}/photos`,
  },
});
```

**Provider** (`src/server/email/providers.server.ts`), chosen by `resolveEmailProvider()`. **No
hardcoded fallback URL or key anywhere**, and there is no local mail-catcher integration — Brevo
itself is tested directly instead (sandbox mode, below):

| When                                         | Provider         | How                                                                         |
| -------------------------------------------- | ---------------- | --------------------------------------------------------------------------- |
| `BREVO_API_KEY` is set (any environment)     | Brevo            | `POST https://api.brevo.com/v3/smtp/email`, header `api-key`                |
| Not set, `APP_ENV` is `production`/`preview` | **throws**       | `ServerFnError("EMAIL_NOT_CONFIGURED", …)` — Brevo is **required** there    |
| Not set, `APP_ENV` is `development`/`test`   | log (warns once) | Writes the rendered email through `logger` (PII-scrubbed — see **Logging**) |

So a misconfigured preview/production deploy fails loudly (a logged, typed error) the first time
something tries to send an email, instead of quietly losing it.

The **From** address is `EMAIL_FROM` (`.dev.vars`/`wrangler secret put EMAIL_FROM`), defaulting to
`RenoVision <no-reply@renovision.app>` — **needs a verified Brevo sender** once `BREVO_API_KEY` is
set, or Brevo rejects the send.

**Testing Brevo locally, with sandbox mode.** Brevo's transactional API supports a sandbox mode: the
request is fully validated (auth, sender, payload) and answered with a normal 2xx + `messageId`, but
nothing is delivered and no log entry is created
([developers.brevo.com/docs/using-sandbox-mode](https://developers.brevo.com/docs/using-sandbox-mode)).
It's a field **inside the JSON body's `headers` object** (`{ "headers": { "X-Sib-Sandbox": "drop" } }`),
not an HTTP header — easy to get backwards, so it's centralized in `brevoRequestBody()`
(`providers.server.ts`) rather than inlined at each call site. Set `EMAIL_SANDBOX=true` in `.dev.vars`
to add it to every send automatically once `BREVO_API_KEY` is set (a free Brevo account's key works
fine for this — sandbox mode is available on every plan):

1. Sign up for a free Brevo account and copy an API key (Brevo → SMTP & API → API Keys).
2. In `.dev.vars`: `BREVO_API_KEY=<your key>`, `EMAIL_FROM=RenoVision <no-reply@renovision.app>`,
   `EMAIL_SANDBOX=true`.
3. `bun run email:check` — sends every app template, in both locales, to the RFC 2606
   `test@example.com` address, asserts Brevo answers 2xx with a `messageId` for each, and prints a
   pass/fail table (non-zero exit on any failure). It **always forces sandbox mode itself**,
   regardless of `EMAIL_SANDBOX`, so it never sends anything real even if you forgot to set it.

`bun run email:check` has the same "no hardcoded fallback" rule: it requires `BREVO_API_KEY` and
`EMAIL_FROM` (real env vars, then `.dev.vars`, then `.env.local`); missing ones print a clear list,
present ones a sanitized form (key prefix + length), never a full secret.

**CI** runs this too, in a separate `email-sandbox` job (`.github/workflows/ci.yml`) that only runs
when both a `BREVO_API_KEY` and an `EMAIL_FROM` **repository secret** are configured (Settings →
Secrets and variables → Actions) — otherwise it's skipped cleanly, so forks and contributors without
a Brevo account aren't blocked.

**Templates** (`src/server/email/templates/*.ts`) are plain functions, `(params, locale) => { subject,
html, text }`, rendered through the shared design-system components:

| Template       | Params                                                        | Used by (later)                          |
| -------------- | ------------------------------------------------------------- | ---------------------------------------- |
| `notification` | `{ siteUrl, title, body, linkUrl, linkLabel? }`               | A single notification emailed (T41)      |
| `digest`       | `{ siteUrl, items: { title, body? }[], linkUrl, linkLabel? }` | A periodic digest of notifications (T41) |

Chrome strings (subject, button label, disclaimer) live in the `comms` i18n namespace
(`src/features/comms/i18n/{en,pl}.json` → `email.notification`/`email.digest`), so the en/pl parity
test (`tests/unit/i18n/parity.test.ts`) covers them; `title`/`body`/item content is caller-provided
and is HTML-escaped (`src/server/email/html.ts`) before it reaches the components.

**There is no public send endpoint.** `sendEmail()` is a `*.server.ts` module, not a server function;
T41's server function(s) that call it **must** add `rateLimit({ key: "email" })` to their middleware
chain (`src/server/rate-limits.ts` caps it at 5/min — see **Server functions & security**).

Tests: `tests/unit/email/templates.test.ts` (both locales render with all params, no unreplaced
`{{placeholder}}`, the link appears in both the HTML and text bodies, and a `<script>`-bearing title
is HTML-escaped), `design-tokens.test.ts` (above) and `tests/unit/email/send-email.test.ts` (provider
selection; Brevo's request shape, headers and sandbox field against a mocked `fetch`; a Brevo error
becomes a logged `ServerFnError` that never contains the API key).

## Internationalization

The UI speaks Polish (`pl`, the default) and English (`en`), with [i18next](https://www.i18next.com) and
react-i18next. All strings are bundled; there is no lazy loading.

**Namespaces.** `common` (`src/i18n/common/{en,pl}.json`) holds strings shared across the app: actions, status
and schedule labels, nav labels, confirm/table/form defaults. Every feature has its own namespace named after its
folder, in `src/features/<f>/i18n/{en,pl}.json`, picked up automatically by a Vite glob in `src/i18n/resources.ts`.
Every feature is already registered for typed keys in `src/i18n/i18next.d.ts`, so a feature task only edits its
own two JSON files. A brand-new namespace needs its folder plus one line in `i18next.d.ts`
(`tests/unit/i18n/parity.test.ts` fails until that line exists).

**Keys.** English is the source: write the `en.json` key first, then the same key in `pl.json`. Nest by screen or
component (`"stageRow": { "late": "…" }`), use `{{name}}` placeholders, and plural suffixes for counts
(`_one`/`_other` in English, `_one`/`_few`/`_many`/`_other` in Polish; call `t("key", { count })`). The parity test
requires identical keys (plural forms compared by base key) and identical placeholders in both languages.

```tsx
const { t } = useTranslation(["work", "common"]); // pass an array: first ns unprefixed, others as "ns:key"
t("stageRow.late", { count: 3 }); // work namespace
t("common:status.done"); // typed and autocompleted
```

**Formatting.** Never format money or dates by hand; use the locale-bound helpers:

```tsx
const format = useFormat();
format.money(project.spent, project.currency); // "51 200,00 zł" (pl) / "PLN 51,200.00" (en); always pass the project's currency
format.money(12345); // no currency: DEFAULT_CURRENCY (PLN), only for amounts with no project at hand
format.money(amount, "EUR", { decimals: 0 });
format.date(stage.end_date, "short"); // "02 mar" / "Mar 02"; also "long", "dayTime", "time"; null → "—"
format.dayLabel(message.created_at); // "Dzisiaj" / "Today" / "pon., 02 mar"
const statusLabel = useStatusLabel(); // statusLabel("done") → "Ukończone"; also useScheduleLabel()
```

The pure versions (`formatMoney`, `formatDate`, `formatDayLabel`) live in `@/domain/money` and `@/domain/dates`
for code outside React.

**Locale resolution.** `profiles.locale` (`'pl'` | `'en'`, default `'pl'`) is the source of truth for a signed-in
user. On the server, the root route's `beforeLoad` loads the session (`getSession` exposes `profile.locale`) and then
resolves the request's locale: the profile's, then the `locale` cookie, then `Accept-Language`, then `pl`
(`resolveLocale` in `src/i18n/locale.ts`, applied by `applyRequestLocale` in `src/i18n/request-locale.ts`). So a hard
load renders in the saved language on any device, with or without the cookie. Each request gets its own i18next
instance, created with the router in `src/router.tsx`, so nothing is shared between requests on the Worker. The router
dehydrates the chosen language and the browser's instance starts in it, so hydration matches the server HTML and
`<html lang>` follows the locale. In the browser the language only changes on the switch, or when a different user
signs in without a reload (then it becomes theirs).

The language switch on Settings → Profile (`useSaveLocale()` in `features/settings/hooks/use-profile.ts`) changes
the language in place (cookie + i18next, `useSetLocale()`), saves `profiles.locale` (a failure toasts), then mirrors
it onto `user_metadata.locale` for the auth emails (see **Email**). A sign-up's `user_metadata.locale`, when set,
becomes the new profile's.

## Forms

Forms use react-hook-form with a zod schema, through two helpers. `features/settings/ui/language-form.tsx` is the
reference example.

```tsx
const schema = z.object({ email: z.string().email("common:form.invalidEmail"), name: z.string().min(1, "common:form.required") });

function InviteForm({ onInvite }: { onInvite: (values: z.output<typeof schema>) => void }) {
  const { t } = useTranslation(["people", "common"]);
  const form = useZodForm(schema, { email: "", name: "" }); // @/shared/hooks/use-zod-form
  return (
    <form noValidate onSubmit={form.handleSubmit(onInvite)}>
      <FormField control={form.control} name="email" label={t("invite.email")}>
        {(field) => <Input type="email" {...field} />}
      </FormField>
    </form>
  );
}
```

- `FormField` (`@/shared/ui/form-field`) renders `ui/field`'s `Field`, `FieldLabel`, an optional `FieldDescription`
  and `FieldError`; it passes the control `id`, `aria-invalid` and `aria-describedby`, so the label and error are
  wired up for you. Spread `field` onto the control (`Input`, `Textarea`, `NativeSelect`…); for non-input controls
  use `field.value` and `field.onChange`.
- zod messages are i18n keys (`"common:form.required"`, or a key in the feature's namespace); `FormField` translates
  them. A message that isn't a key is shown as written.
- Put `noValidate` on the `<form>` so the zod messages show instead of the browser's own validation bubbles.
- Validation runs on blur, then on every change once a field is invalid (`mode: "onTouched"`).

## Shared UI and hooks

**`useConfirm()`** (`@/shared/ui/use-confirm`) replaces `window.confirm()`. It returns a function that opens the
app's one `ConfirmDialog` (an `ui/alert-dialog`, mounted by `ConfirmProvider` in `__root.tsx`) and resolves `true`
on confirm, `false` on cancel, Escape or an outside click:

```tsx
const confirm = useConfirm();
<Button onClick={async () => (await confirm({ title: t("deletePhoto"), destructive: true })) && remove.mutate(photo)} />;
```

`title`, `description`, `confirmLabel` and `cancelLabel` are optional (defaults from `common:confirm.*`).

**`DataTable`** (`@/shared/ui/data-table`) is a table in a card, on `ui/table`. Columns are data; rows come already
sorted. With no rows it shows an `Empty` state instead.

```tsx
<DataTable
  rows={expenses}
  getRowKey={(e) => e.id}
  columns={[
    { key: "date", header: t("date"), cell: (e) => format.date(e.spent_on, "short"), className: "whitespace-nowrap" },
    { key: "amount", header: t("amount"), cell: (e) => format.money(e.amount), align: "end" },
  ]}
  onRowClick={openExpense} // optional: rows become clickable and keyboard-focusable
  empty={{ icon: "receipt_long", title: t("noExpenses") }}
/>
```

**`useMutationWithToast(fn, opts)`** (`@/shared/hooks/use-mutation-with-toast`) is a TanStack mutation that toasts
`opts.success` (already translated) or the error's message, and invalidates `opts.invalidate` once it settles.
Each feature's mutations call it directly, passing `@/shared/query-keys` keys to `invalidate` themselves (the old
`useSave` shim that did this for you was removed in T17).

**`nav-config`** (`@/shared/ui/nav-config`) lists the project sections as
`{ key, section, icon, labelKey, roles, placement }`: the rail shows `navItemsFor(role)`, the phone bar
`navItemsFor(role, "tab")` plus a "More" sheet of `navItemsFor(role, "more")`, and labels render with
`t(item.labelKey)` (`common:nav.*`).

## Lint rules

`bun run lint` must report 0 errors. Since T17 these are hard errors, not warnings:

- **Layer boundaries** (`@typescript-eslint/no-restricted-imports`): `src/routes/**` and `src/features/*/ui/**` may
  not import `@/lib/supabase`, `@/lib/api` or `@/features/*/data`; `src/domain/**` may not import React,
  `@supabase/*` or `@/components/**`. A base `no-restricted-imports` error also bans `@/lib/api` and `@/lib/queries`
  everywhere (both were deleted in T17; the rule is just a guard against reintroducing them).
- **Server boundaries** (base `no-restricted-imports`, built per scope by `restrictedImports()` in
  `eslint.config.js`): `@/lib/supabase/admin` only from `src/server/**`; `createServerFn` only in `src/server/fn.ts`;
  `src/{features,routes,components,shared,domain,i18n}/**` may import `@/server/functions/*` and `@/server/errors`
  but no other `src/server` module, no `*.server.ts`, and neither `@/lib/env` nor `@/lib/supabase/server`. See
  **Server functions & security**.
- **No literal strings** (`i18next/no-literal-string`) in `src/features/*/ui/**`, `src/shared/**`, `src/routes/**`,
  `src/components/*.tsx` and `src/components/manager/**` (not `src/components/ui/**`, where primitives take their
  text via props): JSX text and user-visible attributes (`label`, `title`, `placeholder`, `alt`, `aria-label`…) go
  through `t(...)`. Identifier-like attributes (`className`, `to`, `href`, `type`, `id`, `icon`, `variant`, `data-*`,
  ARIA id references…) are ignored, as are a handful of identifier-like object-property keys used for route search
  params and enum-like values (`to`, `view`, `status`, `room`) and `useFormat()`'s style-token arguments
  (`format.date(d, "short")`) — see `eslint.config.js` for the exact lists.

`tests/unit/arch/boundaries.test.ts` duplicates the layer-boundary and server-boundary rules (plus "no `@deprecated`
shim left in src/lib") as a plain fs/regex guard that keeps working even if the eslint config is ever loosened.

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

Primitives: `Button` (variants include `scrim`, for a control sitting directly on a photo), `Badge` (`scrim` likewise, for a tag
on a photo), `Card`, `Progress`/`ProgressBar`, `Input`, `InputGroup` (addons, `search` variant; `InputGroupButton` has an `icon`
size for a full 44px touch target, alongside the default 32px inline `icon-sm`), `NativeSelect`, `FileInput` (a styled
`<input type="file">`, `default`/`compact`), `Field` (label, description, error), `Note` (a tinted informational aside),
`Item` (list rows: `size="lg"` for stage rows, `selected`/`tone` for a status-colored outline, `attention` for the
over-budget/late outline + dot, `ItemTitle size="lg"` for a bigger heading than the row's own size caps at), `Empty` (empty
states), `Stat` (stat cards), `Rail` (desktop navigation rail), `TabBar`/`TabBarItem`/`TabBarRow` (phone bottom navigation),
`Sheet`, `Dialog`, `Tabs`, `Switch`, `Tooltip`, `DropdownMenu`, `Popover` and the rest of `src/components/ui/`.
`src/shared/ui/` holds the app-level pieces shared well beyond a single feature, at the feature layer rather than under a
specific `features/*/ui`: `FormSheet`/`VisibleSwitch` (the editing-panel shell), `ConfirmDialog`/`useConfirm`, `DataTable`,
`FormField` and `nav-config` (see **Shared UI and hooks**).

**Guard:** `tests/unit/arch/ui-layers.test.ts` scans `src/**/*.tsx` outside `src/components/ui/` and fails the moment any file
there imports `lucide-react`, hardcodes a color/background/border in an inline `style={{ … }}`, or has a `className="…"` literal
of 70+ characters that isn't in `tests/unit/arch/ui-layers.allowlist.json`. When you hit that last one, first try moving the
styling into a primitive or variant; if it's genuinely a one-off (layout-only, or too specific to a single row to generalize),
add an entry to the allowlist — `{ "file", "snippet", "reason" }`, one line explaining why it can't move — instead of widening
the regex or reaching for `lucide-react`.
