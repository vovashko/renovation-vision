import type { Database } from "./db.types";

// Status vocabulary shared by stages, rooms and their widgets. Labels live in i18n
// (`common:status.<status>`, `common:schedule.<status>`); colors live in the UI layer.

/** Work state of a stage or room: `done` / `progress` / `pending` (hollow) / `blocked`. */
export type Status = Database["public"]["Enums"]["work_status"];

/** Every status, in display order (legends, pickers). */
export const statuses: Status[] = ["done", "progress", "pending", "blocked"];

/** The project's schedule status, set by the manager. */
export type ScheduleStatus = Database["public"]["Enums"]["schedule_status"];

export const scheduleStatuses: ScheduleStatus[] = ["on_schedule", "at_risk", "delayed"];
