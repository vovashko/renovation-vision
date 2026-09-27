# People (`features/people`)

Who is on a project: app members and roles, plus the site crew (not app users): `project_members`, `project_crew`, `profiles` (read), the `add_project_member` RPC.

- **Routes:** `/team`
- **UI:** `MemberRow`, `AddMemberForm`
- **i18n namespace:** `people` (`useTranslation(["people", "common"])`)

Layers (README → Architecture): `domain/` pure rules (optional, shared ones live in `src/domain`) · `data/`
the repository, the only code that imports supabase-js · `hooks/` TanStack Query hooks, keys and mutations ·
`ui/` small named components composing `src/components/ui` · `i18n/{en,pl}.json` the `people` namespace.
