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

/** Status dot (legend). Pending is a hollow ring, never a filled dot. */
export const statusBg: Record<Status, string> = {
  done: "bg-status-done",
  progress: "bg-status-progress",
  pending: "border-2 border-status-pending bg-transparent",
  blocked: "bg-status-blocked",
};

/** Container + on-container pair (stage tiles). Pending is white with a dashed outline. */
export const statusContainer: Record<Status, string> = {
  done: "bg-status-done-container text-on-status-done-container",
  progress: "bg-status-progress-container text-on-status-progress-container",
  pending:
    "border border-dashed border-outline bg-status-pending-container text-on-status-pending-container",
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

/**
 * Selected-item outline in the item's own status color (never primary).
 * Pending uses a solid outline-colored ring, replacing its dashed border.
 */
export const statusStroke: Record<Status, string> = {
  done: "stroke-status-done",
  progress: "stroke-status-progress",
  pending: "stroke-outline",
  blocked: "stroke-status-blocked",
};

/** Same as statusStroke, for HTML elements (CSS outline). */
export const statusOutline: Record<Status, string> = {
  done: "outline-status-done",
  progress: "outline-status-progress",
  pending: "outline-outline",
  blocked: "outline-status-blocked",
};
