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

| Role    | Email                   | Password          |
| ------- | ----------------------- | ----------------- |
| Manager | `jonas@renovision.demo` | `renovision-demo` |
| Client  | `sarah@renovision.demo` | `renovision-demo` |
| Admin   | `admin@renovision.demo` | `renovision-demo` |

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

- `preview` (`renovision-preview`) — `bun run deploy:preview`
- `production` (`renovision`) — `bun run deploy`

First time only: `wrangler login`.

Secrets (`SUPABASE_SECRET_KEY`, `BREVO_API_KEY`, `SENTRY_DSN`) are not set via
`vars`. Copy `.dev.vars.example` to `.dev.vars` (gitignored) for `bun run dev`, `bun run preview` and `wrangler dev`,
and set remote secrets per environment with `wrangler secret put <NAME> --env <preview|production>`.
Pages and `getMe` run with none of them set; the admin Supabase client fails with a clear message until
`SUPABASE_SECRET_KEY` is set. Public config lives in `vars.APP_ENV`; the rate limiters are `ratelimits` bindings
(see **Server functions & security**).

## Architecture

Code is split by layer, then by feature:

```
src/domain/            pure entities and rules: status, progress, money, dates, attention, consistency, budget,
                       db.types.ts (generated). No React, no Supabase, no UI imports.
src/features/<f>/      f ∈ projects | work | media | budget | comms | people | knowledge | auth | settings | admin | import
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

| Code           | Status | When                                                                                     |
| -------------- | ------ | ---------------------------------------------------------------------------------------- |
| `BAD_REQUEST`  | 400    | `.validator()` failed (`error.issues: [{ path, message }]`), or a bad project id         |
| `UNAUTHORIZED` | 401    | no, malformed, expired or badly signed token (`reason`: `missing_token`/`invalid_token`) |
| `FORBIDDEN`    | 403    | AAL2, account type or project role check failed                                          |
| `NOT_FOUND`    | 404    | yours to throw                                                                           |
| `RATE_LIMITED` | 429    | over a rate limit (`Retry-After` header and `error.retryAfter`, seconds)                 |
| `INTERNAL`     | 500    | anything unexpected; details are only in the log, the browser gets the request id        |
| `UNAVAILABLE`  | 503    | the Supabase Auth/JWKS endpoint couldn't be reached                                      |

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
`SUPABASE_SERVICE_ROLE_KEY` is accepted as a fallback), `BREVO_API_KEY` and `SENTRY_DSN`. It reads them from
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
on `expenses`, `project_internal`, `project_crew`, `activity_log` and `storage.objects` in bucket `project-internal`
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
their `renovision-demo` password (the length rule only applies to new passwords).

Tests: `tests/db/auth_hardening.test.sql`.

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
           ◀── context.auth = { user: { id, email, aal } | null, profile: { full_name, avatar_url, account_type } | null }
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
- **`/login`** (`src/routes/login.tsx`): a signed-in user goes to `redirect` if it is a same-origin path, else `/`.
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

There is no AAL2/MFA redirect yet: T22 adds it together with the 2FA screens, sending `aal1` staff to the 2FA
screen when `public.staff_mfa_required()` returns `true` (see **Roles & 2FA enforcement** above).
`context.auth.user.aal` and `context.auth.profile.account_type` are already in the router context for it.

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
- **`vite dev` relaxations** (gated on `import.meta.env.DEV`, i.e. never in a built bundle): `script-src` gets
  `'unsafe-inline' 'unsafe-eval'` (no nonce source alongside it — mixing the two would make a CSP-Level-2+ browser
  ignore `'unsafe-inline'` entirely, per spec, and break Vite's HMR/React-refresh preamble, which injects its own
  un-nonced inline scripts) and `connect-src` gets `ws:`, both for Vite's HMR client.

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
format.money(12345); // "12 345,00 zł" (pl) / "PLN 12,345.00" (en); currency defaults to DEFAULT_CURRENCY (PLN)
format.money(amount, "EUR", { decimals: 0 });
format.date(stage.end_date, "short"); // "02 mar" / "Mar 02"; also "long", "dayTime", "time"; null → "—"
format.dayLabel(message.created_at); // "Dzisiaj" / "Today" / "pon., 02 mar"
const statusLabel = useStatusLabel(); // statusLabel("done") → "Ukończone"; also useScheduleLabel()
```

The pure versions (`formatMoney`, `formatDate`, `formatDayLabel`) live in `@/domain/money` and `@/domain/dates`
for code outside React.

**Locale resolution.** On the server, the root route's `beforeLoad` resolves the request's locale: the `locale`
cookie, then `Accept-Language`, then `pl` (`resolveLocale` in `src/i18n/locale.ts`; a saved `profiles.locale` will
slot in first once that column exists). Each request gets its own i18next instance, created with the router in
`src/router.tsx`, so nothing is shared between requests on the Worker. The router dehydrates the chosen language
and the browser's instance starts in it, so hydration matches the server HTML and `<html lang>` follows the locale.
The language switch on `/settings` (`useSetLocale()`) writes the cookie and changes the language in place, without
a reload.

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
