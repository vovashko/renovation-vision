import type { ProgressTone } from "./progress";

// Status vocabulary shared with the RenoTrack client app (src/lib/renovation-data.ts there).
// State follows progress: pending is always 0%, above 0% it is in progress, 100% is done;
// blocked keeps the progress reached when work stopped.
export type Status = "done" | "progress" | "pending" | "blocked";

export const statuses: Status[] = ["done", "progress", "pending", "blocked"];

export const statusLabel: Record<Status, string> = {
  done: "Completed",
  progress: "In progress",
  pending: "Pending",
  blocked: "Blocked",
};

// Literal class strings per status so Tailwind generates them (no inline colors).

/** Badge variant for the status chip. */
export const statusChip = {
  done: "status-done",
  progress: "status-progress",
  pending: "status-pending",
  blocked: "status-blocked",
} as const satisfies Record<Status, string>;

/** Progress tone for status bars. */
export const statusTone: Record<Status, ProgressTone> = {
  done: "done",
  progress: "progress",
  pending: "pending",
  blocked: "blocked",
};

/** 8px dot (legend, rows). Pending is a hollow ring. */
export const statusDot: Record<Status, string> = {
  done: "bg-status-done",
  progress: "bg-status-progress",
  pending: "border-2 border-status-pending bg-transparent",
  blocked: "bg-status-blocked",
};

/** Solid color, e.g. `bg-status-done`. Pending has no solid color; use statusDot. */
export const statusColor: Record<Status, string> = {
  done: "bg-status-done",
  progress: "bg-status-progress",
  pending: "bg-status-pending",
  blocked: "bg-status-blocked",
};

/** Container + on-container pair (tiles). Pending is white with a dashed outline. */
export const statusContainer: Record<Status, string> = {
  done: "bg-status-done-container text-on-status-done-container",
  progress: "bg-status-progress-container text-on-status-progress-container",
  pending: "border border-dashed border-outline bg-status-pending-container text-on-status-pending-container",
  blocked: "bg-status-blocked-container text-on-status-blocked-container",
};

/** Solid timeline marker. Pending stays hollow so "not started" never reads as filled. */
export const statusMarker: Record<Status, string> = {
  done: "bg-status-done text-white",
  progress: "bg-status-progress text-white",
  pending: "border-2 border-dashed border-outline bg-surface-container-lowest text-on-surface-variant",
  blocked: "bg-status-blocked text-white",
};

/** Floor-plan tile: SVG fill + label color. */
export const statusTileSvg: Record<Status, string> = {
  done: "fill-status-done-container text-on-status-done-container",
  progress: "fill-status-progress-container text-on-status-progress-container",
  pending: "fill-status-pending-container text-on-status-pending-container",
  blocked: "fill-status-blocked-container text-on-status-blocked-container",
};

/** Floor-plan selected outline: a darker stroke in the room's own status color. */
export const statusStroke: Record<Status, string> = {
  done: "stroke-status-done",
  progress: "stroke-status-progress",
  pending: "stroke-outline",
  blocked: "stroke-status-blocked",
};

/**
 * State follows progress: pending is only ever 0%, above 0% it is in progress, 100% is done.
 * Blocked is the one stored state that is kept, with whatever progress was reached.
 */
export function deriveStatus(stored: Status, progress: number): Status {
  if (stored === "blocked") return "blocked";
  if (progress >= 100) return "done";
  if (progress > 0) return "progress";
  return "pending";
}

/** Form helper: the state after moving the progress slider (100% is always Completed). */
export function statusForProgress(current: Status, progress: number): Status {
  if (progress >= 100) return "done";
  return deriveStatus(current === "blocked" ? "blocked" : "progress", progress);
}

/** Form helper: the progress after picking a state (Pending = 0%, Completed = 100%). */
export function progressForStatus(status: Status, progress: number): number {
  if (status === "done") return 100;
  if (status === "pending") return 0;
  if (progress >= 100) return 95;
  if (status === "progress" && progress <= 0) return 5;
  return progress;
}
