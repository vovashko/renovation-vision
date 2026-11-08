# Comms (`features/comms`)

Announcements, notifications (the bell, the inbox, email preferences) and the activity log: `notifications`,
`notification_preferences`, `activity_log` and the `notify_project_clients` RPC. There is no in-app chat or AI assistant
(T66): conversations happen on WhatsApp, linked from the contact cards (`features/people`).

- **Routes:** `/updates`, `/settings/notifications`
- **UI:** `AnnouncementForm`, `SentNotificationItem`/`InboxNotificationItem`, `InboxList`/`InboxSheet` (`inbox.tsx`),
  the bell (`bell.tsx`: rail item, phone tab, "More" row), `EmailPreferencesList` (`notification-preferences.tsx`),
  `ActivityLog`
- **domain/:** `schemas.ts`, `params.ts` (the notification kinds and activity entities the app knows, and defensive
  readers for the `params` jsonb), `notification-text.ts` (a notification's title and body from `kind` + `params`,
  shared by the UI and the email jobs), `delivery.ts` (T41: which kinds are emailed how, the preference groups, the
  07:00 Europe/Warsaw digest boundary, where a notification leads)
- **hooks/:** `use-notification-text.ts`: `useNotificationText()`, `useNotificationKindLabel()` and `useActivityText()`
  render `kind` + `params` (and activity `{ entity, action, label }`) through i18n, falling back to the legacy English
  `title`/`body`/`summary` (README → Notifications, activity and comms data); `use-inbox.ts` (the inbox, the unread
  count, realtime, mark read, open); `use-notification-preferences.ts`
- **i18n namespace:** `comms` (`useTranslation(["comms", "common"])`); `notifications.*` and `activity.*` hold the
  translated texts, `bell.*`, `inbox.*` and `preferences.*` the bell and Settings → Notifications, `email.*` the app
  emails' chrome

The email jobs themselves live in `src/server/notifications` (README → Notification delivery).

Layers (README → Architecture): `domain/` pure rules (optional, shared ones live in `src/domain`) · `data/`
the repository, the only code that imports supabase-js · `hooks/` TanStack Query hooks, keys and mutations ·
`ui/` small named components composing `src/components/ui` · `i18n/{en,pl}.json` the `comms` namespace.
