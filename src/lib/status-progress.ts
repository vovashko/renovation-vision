import type { Status } from "@/lib/status";

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
