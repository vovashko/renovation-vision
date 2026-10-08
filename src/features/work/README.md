# Work (`features/work`)

Stages, rooms and tasks, their status and progress, the floor plan and the schedule: `stages`, `rooms`, `tasks`
(and, from T32, the site diary `progress_entries` and the plan image on `projects`; their screens are T43/T44).
A stage's `progress_mode` is `tasks` (progress and status computed from the checklist by the database, read-only
in `StageFormSheet` except "blocked") or `manual` (README → Work data).

- **Routes:** `/projects/$projectId` (overview), `/stages`, `/plan`, `/rooms/$roomId` (the room view)
- **UI:** `StageFormSheet` (+ `ProgressModeControl`, `TaskDerivedProgress`), `StageRow`, `StageTimeline`, `FloorPlan`, `RoomList`, `SelectedRoomPanel`, `OverviewStats`, `ProjectHeader`; the room view: `RoomView` (+ `RoomWorks`, `RoomMaterials`, `RoomWarnings`, `MaterialForm`, `WarningForm`)
- **i18n namespace:** `work` (`useTranslation(["work", "common"])`)

Layers (README → Architecture): `domain/` pure rules (optional, shared ones live in `src/domain`) · `data/`
the repository, the only code that imports supabase-js · `hooks/` TanStack Query hooks, keys and mutations ·
`ui/` small named components composing `src/components/ui` · `i18n/{en,pl}.json` the `work` namespace.
