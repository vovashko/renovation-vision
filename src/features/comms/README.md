# Comms (`features/comms`)

Project chat, the AI assistant, announcements, notifications and the activity log: `messages`, `notifications`, `activity_log`, the `mark_chat_read` and `notify_project_clients` RPCs.

- **Routes:** `/chat`, `/updates`
- **UI:** `MessageList` (a null `sender_id`, i.e. a deleted account, shows as "Former member"), `ChatComposer`,
  `AnnouncementForm`, `SentNotificationItem`/`InboxNotificationItem`, `ActivityLog`
- **domain/:** `chat-format.ts` (day grouping), `schemas.ts`, `params.ts` (the notification kinds and activity
  entities the app knows, and defensive readers for the `params` jsonb)
- **hooks/:** `use-notification-text.ts`: `useNotificationText()`, `useNotificationKindLabel()` and `useActivityText()`
  render `kind` + `params` (and activity `{ entity, action, label }`) through i18n, falling back to the legacy English
  `title`/`body`/`summary` (README → Notifications, activity and comms data)
- **i18n namespace:** `comms` (`useTranslation(["comms", "common"])`); `notifications.*` and `activity.*` hold the
  translated texts

`/chat`'s "Ask AI" tab is `AiChat` from `@/features/knowledge/ui/ai-chat` — see that feature's README.

Layers (README → Architecture): `domain/` pure rules (optional, shared ones live in `src/domain`) · `data/`
the repository, the only code that imports supabase-js · `hooks/` TanStack Query hooks, keys and mutations ·
`ui/` small named components composing `src/components/ui` · `i18n/{en,pl}.json` the `comms` namespace.
