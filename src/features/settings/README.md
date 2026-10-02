# Settings (`features/settings`)

Per-user settings: the profile (name, photo, UI language) and security (2FA, password).

- **Routes:** `/settings` (index linking to the two pages), `/settings/profile`, `/settings/security`
- **UI:** `SettingsNav`/`SettingsBackLink`; Profile: `ProfileForm` (`profiles.full_name`), `AvatarForm` (public
  `avatars` bucket, `<user_id>/avatar-<time>.jpg`, re-encoded with features/media's EXIF strip at 512 px),
  `LanguageForm` (the reference example of the react-hook-form + zod pattern; also syncs `user_metadata.locale`);
  Security: `TwoFactorCard` (status, factors, add/remove), `ChangePasswordCard` (with the reauthentication-code step),
  `AccountCard` (2FA and account type as `getMe` reports the session)
- **domain/:** `profile.ts` (avatar rules and path, the name schema), `two-factor.ts` (`removeRule`)
- **data/:** `profile.repo.ts` (name, avatar upload/remove)
- **Hooks:** `useMe()` calls the `getMe` server function (`src/server/functions/me.ts`), the reference example of a
  hook over a server function; `use-profile.ts` (name/avatar mutations, which re-read the session afterwards). 2FA
  and password hooks come from `@/features/auth/hooks`.
- **i18n namespace:** `settings` (`useTranslation(["settings", "common"])`)

Layers (README → Architecture): `domain/` pure rules (optional, shared ones live in `src/domain`) · `data/`
the repository, the only code that imports supabase-js · `hooks/` TanStack Query hooks, keys and mutations ·
`ui/` small named components composing `src/components/ui` · `i18n/{en,pl}.json` the `settings` namespace.
