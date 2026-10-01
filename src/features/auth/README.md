# Auth (`features/auth`)

Sign-in (password and magic link), the session and the signed-in profile. The session plumbing lives in
`src/lib/auth.tsx` (router context, `useAuth`, `AuthSync`) and `src/server/functions/session.ts` (`getSession`,
`getProjectAccess`); the sign-in form is still `src/components/login-screen.tsx`. See README → Sessions & route guards.

- **Routes:** `/login` (`src/routes/login.tsx`); the guards in `src/routes/_authed.tsx` and `src/routes/project/layout.tsx`
- **domain/guards.ts:** the guard decisions (`projectGuard`, `safeRedirectTarget`, `projectSection`)
- **hooks:** `projectAccessQuery` / `ensureProjectAccess` (the per-project role, cached), `useProjectRole`
- **UI:** none yet (T22 builds the auth screens)
- **i18n namespace:** `auth` (`useTranslation(["auth", "common"])`)

Layers (README → Architecture): `domain/` pure rules (optional, shared ones live in `src/domain`) · `data/`
the repository, the only code that imports supabase-js · `hooks/` TanStack Query hooks, keys and mutations ·
`ui/` small named components composing `src/components/ui` · `i18n/{en,pl}.json` the `auth` namespace.
