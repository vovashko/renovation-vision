import type { Status } from "@/lib/renovation-data";
import type { ProgressTone } from "@/components/ui/progress";

// Literal class strings per status so Tailwind generates them (no inline colors).

export const statusChip = {
  done: "status-done",
  progress: "status-progress",
  pending: "status-pending",
  blocked: "status-blocked",
} as const satisfies Record<Status, string>;

export const statusTone: Record<Status, ProgressTone> = {
  done: "done",
  progress: "progress",
  pending: "pending",
  blocked: "blocked",
};

/** Solid status color (legend dots, chip dots). */
export const statusBg: Record<Status, string> = {
  done: "bg-status-done",
  progress: "bg-status-progress",
  pending: "bg-status-pending",
  blocked: "bg-status-blocked",
};

/** Container + on-container pair (stage tiles, plan tiles). */
export const statusContainer: Record<Status, string> = {
  done: "bg-status-done-container text-on-status-done-container",
  progress: "bg-status-progress-container text-on-status-progress-container",
  pending: "bg-status-pending-container text-on-status-pending-container",
  blocked: "bg-status-blocked-container text-on-status-blocked-container",
};

/** Timeline marker: solid status color with white text, as specified for the stage timeline. */
export const statusMarker: Record<Status, string> = {
  done: "bg-status-done text-white",
  progress: "bg-status-progress text-white",
  pending: "bg-status-pending text-white",
  blocked: "bg-status-blocked text-white",
};

/** SVG fill + text color for floor-plan tiles. */
export const statusTileSvg: Record<Status, string> = {
  done: "fill-status-done-container text-on-status-done-container",
  progress: "fill-status-progress-container text-on-status-progress-container",
  pending: "fill-status-pending-container text-on-status-pending-container",
  blocked: "fill-status-blocked-container text-on-status-blocked-container",
};
