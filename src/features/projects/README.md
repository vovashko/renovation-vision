# Projects (`features/projects`)

The project list and project creation: `projects`, the `project_summary` view and the `create_project` RPC. Since
T30 a project has a structured address (`address_line`, `postal_code`, `city`, `country`; `address` is generated
for display), a `currency` (format money with `useFormat().money(amount, project.currency)`) and a lifecycle
`status` (`planning` · `active` · `on_hold` · `completed` · `archived`).

- **Routes:** `/` (redirect to a project), `/projects`
- **UI:** `ProjectListItem` (status badge unless active), `NewProjectForm`, `ProjectDetailsSheet`, `ProjectFields`
  (the address/currency/status fields both forms share)
- **i18n namespace:** `projects` (`useTranslation(["projects", "common"])`)

Layers (README → Architecture): `domain/` pure rules (optional, shared ones live in `src/domain`) · `data/`
the repository, the only code that imports supabase-js · `hooks/` TanStack Query hooks, keys and mutations ·
`ui/` small named components composing `src/components/ui` · `i18n/{en,pl}.json` the `projects` namespace.
