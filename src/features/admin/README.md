# Admin (`features/admin`)

Placeholder for account- and organisation-level administration (managing managers, org settings). Nothing here yet.

- **Routes:** none yet
- **UI:** none yet
- **i18n namespace:** `admin` (`useTranslation(["admin", "common"])`)

Layers (README → Architecture): `domain/` pure rules (optional, shared ones live in `src/domain`) · `data/`
the repository, the only code that imports supabase-js · `hooks/` TanStack Query hooks, keys and mutations ·
`ui/` small named components composing `src/components/ui` · `i18n/{en,pl}.json` the `admin` namespace.
