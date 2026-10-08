import type { Status } from "./status";

/**
 * State follows progress: `pending` is only ever 0%, above 0% it is `progress`, and 100% is
 * `done`. `blocked` is the one state kept as set by hand, at whatever progress was reached
 * when work stopped. The database enforces `(status = 'done') = (progress = 100)`, so these
 * helpers keep edit forms consistent with that constraint before they ever reach the API.
 */
export function deriveStatus(stored: Status, progress: number): Status {
  // The DB ties done to exactly 100%, so 100% always wins over a stored "blocked".
  if (progress >= 100) return "done";
  if (stored === "blocked") return "blocked";
  if (progress > 0) return "progress";
  return "pending";
}

/** Form helper: the status after moving the progress slider (100% is always "Completed"). */
export function statusForProgress(current: Status, progress: number): Status {
  return deriveStatus(current === "blocked" ? "blocked" : "progress", progress);
}

/** Form helper: the progress after picking a status by hand (Pending = 0%, Completed = 100%). */
export function progressForStatus(status: Status, progress: number): number {
  if (status === "done") return 100;
  if (status === "pending") return 0;
  // Leaving "done" or entering "progress"/"blocked" from 0% needs a non-zero, non-100 number.
  if (progress >= 100) return 95;
  if (progress <= 0) return 5;
  return progress;
}

/**
 * A checklist's completion, as the database computes it for a stage in `tasks` progress mode
 * (`private.stage_task_progress`): `round(100 * done / total)`, 0 with no tasks, and never 0% or 100% by
 * rounding alone, so 100% always means every task is done.
 */
export function taskProgress(done: number, total: number): number {
  if (total <= 0 || done <= 0) return 0;
  if (done >= total) return 100;
  return Math.min(99, Math.max(1, Math.round((100 * done) / total)));
}

/** A task's state: `done` is the only progress flag; `in_progress` only marks a started, unfinished task. */
export type TaskState = "todo" | "in_progress" | "done";

export function taskState(task: { done: boolean; in_progress: boolean }): TaskState {
  return task.done ? "done" : task.in_progress ? "in_progress" : "todo";
}

/** The `done` / `in_progress` columns for a chosen state (the database also clears `in_progress` on a done task). */
export function taskFlags(state: TaskState): { done: boolean; in_progress: boolean } {
  return { done: state === "done", in_progress: state === "in_progress" };
}

/**
 * The progress and status of a stage in `tasks` mode, mirroring the database (`private.stage_derived`):
 * status follows the checklist (0% pending, 1–99% in progress, 100% done), except that `blocked` is never
 * overridden; while blocked, progress is capped at 99% so it can't mean "done".
 */
export function deriveFromTasks(stored: Status, done: number, total: number): { progress: number; status: Status } {
  const progress = taskProgress(done, total);
  if (stored === "blocked") return { progress: Math.min(progress, 99), status: "blocked" };
  return { progress, status: progress === 0 ? "pending" : progress === 100 ? "done" : "progress" };
}
