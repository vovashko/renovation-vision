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

| Middleware                                      | What it does                                                                                                                                                                                                                          |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `requireUser` (in `authedFn`)                   | Browser half attaches `Authorization: Bearer <access_token>` from the Supabase session. Server half verifies it (or the session cookies, for T21) and puts `user: { id, email, aal, role }` and `supabase` in context. 401 otherwise. |
| `requireAal2`                                   | 403 (`reason: "aal2_required"`) unless the session is MFA-verified.                                                                                                                                                                   |
| `requireAccountType("manager", …)`              | 403 unless `profiles.account_type` is one of those (today `manager` \| `client`); adds `accountType`.                                                                                                                                 |
| `requireProjectRole(pick, role)`                | 403 unless the caller is `manager` / `client` / `member` (any) of the project `pick(input)` returns, checked with `is_project_manager/client/member` as the user. `pick` sees the **raw** input; a non-UUID is a 400.                 |
| `rateLimit({ key })` (default in both builders) | 429 + `Retry-After` past the policy in `src/server/rate-limits.ts` (`default` 120/min, `invite` 10/min, `email` 5/min), per user, or per `cf-connecting-ip` when anonymous.                                                           |
| `serverFnBoundary` (in both builders)           | Logs every call; maps errors to the responses below; rethrows them as `ServerFnError` in the browser.                                                                                                                                 |
| `requestIdMiddleware` (request middleware)      | Every request gets an id (a safe incoming `x-request-id`, or a UUID): in logs, `context.requestId`, the `x-request-id` response header and the 500 page.                                                                              |

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
