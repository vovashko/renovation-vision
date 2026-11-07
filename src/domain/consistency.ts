import type { Status } from "./status";

/** Which page fixes the warning. */
export type WarningTarget = "stages" | "plan";

/**
 * A soft inconsistency, as data. The UI turns `kind` + params into text (an i18n key per kind,
 * e.g. `t(\`work:consistency.${w.kind}\`, w)`), so the rule itself carries no language.
 */
export type Inconsistency =
  /** A room is Completed but one of its tasks is still open. */
  | { kind: "roomDoneTaskOpen"; to: "plan"; room: string; task: string }
  /** A stage is Completed but has unchecked tasks. */
  | { kind: "stageDoneTasksOpen"; to: "stages"; stage: string; count: number }
  /** A stage is Pending but some of its tasks are already checked. */
  | { kind: "stagePendingTasksDone"; to: "stages"; stage: string };

type TaskLike = { name: string; room_id: string | null; done: boolean };
type StageLike = { name: string; status: Status; is_visible: boolean; tasks: TaskLike[] };
type RoomLike = { id: string; name: string; status: Status; is_visible: boolean };

/**
 * Things a client would find contradictory. The database blocks the hard cases
 * (a Completed room with open tasks); these are the soft ones worth a nudge.
 */
export function findInconsistencies(stages: StageLike[], rooms: RoomLike[]): Inconsistency[] {
  const out: Inconsistency[] = [];
  for (const r of rooms) {
    const open = stages.flatMap((s) => s.tasks).filter((t) => t.room_id === r.id && !t.done);
    if (r.status === "done" && open.length) {
      out.push({ kind: "roomDoneTaskOpen", to: "plan", room: r.name, task: open[0].name });
    }
  }
  for (const s of stages) {
    const open = s.tasks.filter((t) => !t.done);
    if (s.status === "done" && open.length) out.push({ kind: "stageDoneTasksOpen", to: "stages", stage: s.name, count: open.length });
    if (s.status === "pending" && s.tasks.some((t) => t.done)) out.push({ kind: "stagePendingTasksDone", to: "stages", stage: s.name });
  }
  return out;
}
