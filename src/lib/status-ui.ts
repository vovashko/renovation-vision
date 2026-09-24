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

/** Solid status color (legend swatches, dots). Pending uses outline. */
export const statusBg: Record<Status, string> = {
  done: "bg-status-done",
  progress: "bg-status-progress",
  pending: "bg-outline",
  blocked: "bg-status-blocked",
};

/** Container + on-container pair (markers, tiles). */
export const statusContainer: Record<Status, string> = {
  done: "bg-status-done-container text-on-status-done-container",
  progress: "bg-status-progress-container text-on-status-progress-container",
  pending: "bg-status-pending-container text-on-status-pending-container",
  blocked: "bg-status-blocked-container text-on-status-blocked-container",
};

/** SVG fill + text color for floor-plan tiles. */
export const statusTileSvg: Record<Status, string> = {
  done: "fill-status-done-container text-on-status-done-container",
  progress: "fill-status-progress-container text-on-status-progress-container",
  pending: "fill-status-pending-container text-on-status-pending-container",
  blocked: "fill-status-blocked-container text-on-status-blocked-container",
};

/** Selected-tile outline color (SVG stroke). */
export const statusStroke: Record<Status, string> = {
  done: "stroke-status-done",
  progress: "stroke-status-progress",
  pending: "stroke-outline",
  blocked: "stroke-status-blocked",
};
