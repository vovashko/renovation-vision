# Import (`features/import`)

Placeholder for bringing existing projects in (spreadsheets, other tools). Nothing here yet.

- **Routes:** none yet
- **UI:** none yet
- **i18n namespace:** `import` (`useTranslation(["import", "common"])`)

Layers (README → Architecture): `domain/` pure rules (optional, shared ones live in `src/domain`) · `data/`
the repository, the only code that imports supabase-js · `hooks/` TanStack Query hooks, keys and mutations ·
`ui/` small named components composing `src/components/ui` · `i18n/{en,pl}.json` the `import` namespace.
