# Projects (`features/projects`)

The project list and project creation: `projects`, the `project_summary` view and the `create_project` RPC.

- **Routes:** `/` (redirect to a project), `/projects`
- **UI:** `ProjectListItem`, `NewProjectForm`
- **i18n namespace:** `projects` (`useTranslation(["projects", "common"])`)

Layers (README → Architecture): `domain/` pure rules (optional, shared ones live in `src/domain`) · `data/`
the repository, the only code that imports supabase-js · `hooks/` TanStack Query hooks, keys and mutations ·
`ui/` small named components composing `src/components/ui` · `i18n/{en,pl}.json` the `projects` namespace.
