# Comms (`features/comms`)

Project chat, the AI assistant, announcements, notifications and the activity log: `messages`, `notifications`, `activity_log`, the `mark_chat_read` and `notify_project_clients` RPCs.

- **Routes:** `/chat`, `/updates`
- **UI:** `MessageList`, `ChatComposer`, `AiChat`, `AnnouncementForm`, `NotificationItem`, `ActivityLog`
- **i18n namespace:** `comms` (`useTranslation(["comms", "common"])`)

Layers (README → Architecture): `domain/` pure rules (optional, shared ones live in `src/domain`) · `data/`
the repository, the only code that imports supabase-js · `hooks/` TanStack Query hooks, keys and mutations ·
`ui/` small named components composing `src/components/ui` · `i18n/{en,pl}.json` the `comms` namespace.
