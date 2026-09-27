# Settings (`features/settings`)

Per-user app settings. Today: the UI language (the `locale` cookie; `profiles.locale` once that column exists).

- **Routes:** `/settings`
- **UI:** `LanguageForm` (the reference example of the react-hook-form + zod pattern)
- **i18n namespace:** `settings` (`useTranslation(["settings", "common"])`)

Layers (README → Architecture): `domain/` pure rules (optional, shared ones live in `src/domain`) · `data/`
the repository, the only code that imports supabase-js · `hooks/` TanStack Query hooks, keys and mutations ·
`ui/` small named components composing `src/components/ui` · `i18n/{en,pl}.json` the `settings` namespace.
