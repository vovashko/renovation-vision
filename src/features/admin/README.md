# Admin (`features/admin`)

Account-level administration. Today: the Staff page, where any manager account lists every account and makes a
client a manager (`admin` internally) or a manager a client.

- **Routes:** `/admin/staff` (staff only; linked from the profile panel)
- **Server:** `src/server/functions/staff.ts` (`listAccounts`: `requireStaff`, reads auth.users and profiles with the
  admin client and returns only `{ id, name, email, accountType, invited }`)
- **Changing a type:** `set_account_type` called as the user from `data/staff.repo.ts`, so the database applies its
  rules: staff only, an MFA-verified session while enforced, and never the last manager (`last_staff_account`)
- **UI:** `StaffAccounts` (list + confirm), `AccountItem`
- **i18n namespace:** `admin` (`useTranslation(["admin", "common"])`)

Layers (README → Architecture): `domain/` pure rules (optional, shared ones live in `src/domain`) · `data/`
the repository, the only code that imports supabase-js · `hooks/` TanStack Query hooks, keys and mutations ·
`ui/` small named components composing `src/components/ui` · `i18n/{en,pl}.json` the `admin` namespace.
