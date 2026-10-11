# People (`features/people`)

Who is on a project: app members and roles (`project_members`, `profiles` (read), the `add_project_member` RPC),
and the project's contacts from the company address book (`contacts` + `project_contacts`, T30): the crew, the
primary client contact and the point of contact (PoC). Clients read only the client-visible contacts, through the
`project_visible_contacts(project)` RPC.

- **Routes:** `/team` (managers and crew; clients are set on the client card); cards on the project overview
  (manager: client card + team card; client: "Your contact")
- **UI:** `MemberItem`, `AddTeamPersonSheet` (manager by email, or crew: a contact only), `TeamCard`/`CrewRow`/`CrewSheet`
  (crew: edit, remove = unlink, the contact stays in the book), `ClientCard`/`ClientContactSheet` (saves through
  `set_project_client`; access status from `domain/client-access.ts`),
  `YourContactCard` (client overview)
- **i18n namespace:** `people` (`useTranslation(["people", "common"])`)

Layers (README → Architecture): `domain/` pure rules (optional, shared ones live in `src/domain`) · `data/`
the repository, the only code that imports supabase-js · `hooks/` TanStack Query hooks, keys and mutations ·
`ui/` small named components composing `src/components/ui` · `i18n/{en,pl}.json` the `people` namespace.
