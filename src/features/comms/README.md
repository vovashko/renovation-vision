# Comms (`features/comms`)

Announcements, notifications and the activity log: `notifications`, `activity_log` and the `notify_project_clients`
RPC. There is no in-app chat or AI assistant (T66): conversations happen on WhatsApp, linked from the contact cards
(`features/people`).

- **Routes:** `/updates`
- **UI:** `AnnouncementForm`, `SentNotificationItem`/`InboxNotificationItem`, `ActivityLog`
- **domain/:** `schemas.ts`, `params.ts` (the notification kinds and activity entities the app knows, and defensive
  readers for the `params` jsonb)
- **hooks/:** `use-notification-text.ts`: `useNotificationText()`, `useNotificationKindLabel()` and `useActivityText()`
  render `kind` + `params` (and activity `{ entity, action, label }`) through i18n, falling back to the legacy English
  `title`/`body`/`summary` (README → Notifications, activity and comms data)
- **i18n namespace:** `comms` (`useTranslation(["comms", "common"])`); `notifications.*` and `activity.*` hold the
  translated texts

Layers (README → Architecture): `domain/` pure rules (optional, shared ones live in `src/domain`) · `data/`
the repository, the only code that imports supabase-js · `hooks/` TanStack Query hooks, keys and mutations ·
`ui/` small named components composing `src/components/ui` · `i18n/{en,pl}.json` the `comms` namespace.
