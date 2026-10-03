# People (`features/people`)

Who is on a project: app members and roles (`project_members`, `profiles` (read), the `add_project_member` RPC),
and the project's contacts from the company address book (`contacts` + `project_contacts`, T30): the crew, the
primary client contact and the point of contact (PoC). Clients read only the client-visible contacts, through the
`project_visible_contacts(project)` RPC.

- **Routes:** `/team`; cards on the project overview (manager: client card + team card; client: "Your contact")
- **UI:** `MemberRow`, `AddMemberForm`, `TeamCard`/`CrewRow`/`CrewSheet` (crew: add = new contact + link,
  remove = unlink, the contact stays in the book), `ClientCard`/`ClientContactSheet` (the primary client contact),
  `YourContactCard` (client overview)
- **i18n namespace:** `people` (`useTranslation(["people", "common"])`)

Layers (README → Architecture): `domain/` pure rules (optional, shared ones live in `src/domain`) · `data/`
the repository, the only code that imports supabase-js · `hooks/` TanStack Query hooks, keys and mutations ·
`ui/` small named components composing `src/components/ui` · `i18n/{en,pl}.json` the `people` namespace.
