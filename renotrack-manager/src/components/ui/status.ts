// Status vocabulary shared with the RenoTrack client app (src/lib/renovation-data.ts there).
export type Status = "done" | "progress" | "pending" | "blocked";

export const statuses: Status[] = ["done", "progress", "pending", "blocked"];

export const statusLabel: Record<Status, string> = {
  done: "Completed",
  progress: "In progress",
  pending: "Pending",
  blocked: "Blocked",
};

export const statusColor: Record<Status, string> = {
  done: "bg-status-done",
  progress: "bg-status-progress",
  pending: "bg-status-pending",
  blocked: "bg-status-blocked",
};

export const statusFill: Record<Status, string> = {
  done: "var(--status-done)",
  progress: "var(--status-progress)",
  pending: "var(--status-pending)",
  blocked: "var(--status-blocked)",
};
