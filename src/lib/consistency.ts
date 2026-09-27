/** @deprecated moved to @/domain/consistency, which returns structured `Inconsistency` values. This shim goes away in T17. */
import en from "@/i18n/common/en.json";
import { findInconsistencies as findDomainInconsistencies, type Inconsistency } from "@/domain/consistency";
import type { ProjectSummary, Room, Stage } from "./database.types";

export type { Inconsistency } from "@/domain/consistency";

/** @deprecated English only. */
export type Warning = { text: string; to: "stages" | "plan" | "overview" };

/** @deprecated English text of a domain `Inconsistency`; translate `kind` with i18n instead. */
export function inconsistencyText(w: Inconsistency): string {
  switch (w.kind) {
    case "blockedOnSchedule":
      return `${w.names.join(", ")} ${w.count > 1 ? "are" : "is"} Blocked, but the project says "${en.schedule.on_schedule}". Update the schedule status or unblock.`;
    case "roomDoneTaskOpen":
      return `${w.room} is ${en.status.done} but "${w.task}" is still open.`;
    case "stageDoneTasksOpen":
      return `${w.stage} is ${en.status.done} but ${w.count} task${w.count > 1 ? "s are" : " is"} unchecked.`;
    case "stagePendingTasksDone":
      return `${w.stage} is ${en.status.pending} but has checked tasks.`;
  }
}

/** @deprecated English only. Use `findInconsistencies` from @/domain/consistency. */
export function findInconsistencies(project: ProjectSummary, stages: Stage[], rooms: Room[]): Warning[] {
  return findDomainInconsistencies(project, stages, rooms).map((w) => ({ text: inconsistencyText(w), to: w.to }));
}
