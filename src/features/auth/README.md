# Auth (`features/auth`)

Sign-in (password and magic link), the session and the signed-in profile. Today this lives in `src/lib/auth.tsx` and `src/components/login-screen.tsx`; this folder is where it moves.

- **Routes:** none of its own: the root route shows the sign-in screen when signed out
- **UI:** none yet
- **i18n namespace:** `auth` (`useTranslation(["auth", "common"])`)

Layers (README → Architecture): `domain/` pure rules (optional, shared ones live in `src/domain`) · `data/`
the repository, the only code that imports supabase-js · `hooks/` TanStack Query hooks, keys and mutations ·
`ui/` small named components composing `src/components/ui` · `i18n/{en,pl}.json` the `auth` namespace.
