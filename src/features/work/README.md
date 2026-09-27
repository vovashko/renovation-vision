# Work (`features/work`)

Stages, rooms and tasks, their status and progress, the floor plan and the schedule: `stages`, `rooms`, `tasks`.

- **Routes:** `/projects/$projectId` (overview), `/stages`, `/plan`
- **UI:** `StageRow`, `StageTimeline`, `FloorPlan`, `RoomList`, `SelectedRoomPanel`, `OverviewStats`, `ProjectHeader`
- **i18n namespace:** `work` (`useTranslation(["work", "common"])`)

Layers (README → Architecture): `domain/` pure rules (optional, shared ones live in `src/domain`) · `data/`
the repository, the only code that imports supabase-js · `hooks/` TanStack Query hooks, keys and mutations ·
`ui/` small named components composing `src/components/ui` · `i18n/{en,pl}.json` the `work` namespace.
