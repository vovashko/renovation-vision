# Media (`features/media`)

Site photos (draft → published) and design renders, in the `project-media` storage bucket: `photos`, `renders`.

- **Routes:** `/photos`, `/design`
- **UI:** `PhotoGrid`, `PhotoCard`, `PhotoEditSheet`, `RenderSections`, `RenderSheet`, `RenderCompare`
- **i18n namespace:** `media` (`useTranslation(["media", "common"])`)

Layers (README → Architecture): `domain/` pure rules (optional, shared ones live in `src/domain`) · `data/`
the repository, the only code that imports supabase-js · `hooks/` TanStack Query hooks, keys and mutations ·
`ui/` small named components composing `src/components/ui` · `i18n/{en,pl}.json` the `media` namespace.
