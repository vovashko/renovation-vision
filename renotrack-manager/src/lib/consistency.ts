import { statusLabel } from "@/components/ui/status";
import { scheduleLabel } from "./format";
import type { ProjectSummary, Room, Stage } from "./database.types";

export type Warning = { text: string; to: "stages" | "plan" | "overview" };

/**
 * Things a client would find contradictory. The database blocks the hard cases
 * (a Completed room with open tasks); these are the soft ones worth a nudge.
 */
export function findInconsistencies(project: ProjectSummary, stages: Stage[], rooms: Room[]): Warning[] {
  const out: Warning[] = [];
  const blocked = [...rooms.filter((r) => r.is_visible && r.status === "blocked"), ...stages.filter((s) => s.is_visible && s.status === "blocked")];
  if (blocked.length && project.schedule_status === "on_schedule") {
    out.push({
      text: `${blocked.map((b) => b.name).join(", ")} ${blocked.length > 1 ? "are" : "is"} Blocked, but the project says "${scheduleLabel.on_schedule}". Update the schedule status or unblock.`,
      to: "overview",
    });
  }
  for (const r of rooms) {
    const open = stages.flatMap((s) => s.tasks).filter((t) => t.room_id === r.id && !t.done);
    if (r.status === "done" && open.length) {
      out.push({ text: `${r.name} is ${statusLabel.done} but "${open[0].name}" is still open.`, to: "plan" });
    }
  }
  for (const s of stages) {
    const open = s.tasks.filter((t) => !t.done);
    if (s.status === "done" && open.length) out.push({ text: `${s.name} is ${statusLabel.done} but ${open.length} task${open.length > 1 ? "s are" : " is"} unchecked.`, to: "stages" });
    if (s.status === "pending" && s.tasks.some((t) => t.done)) out.push({ text: `${s.name} is ${statusLabel.pending} but has checked tasks.`, to: "stages" });
  }
  return out;
}
