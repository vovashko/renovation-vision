import { parseDate } from "./dates";
import type { Status } from "./status";

/**
 * Derived project health (owner decision 5). Nothing here is stored or set by hand:
 *   - blocked:     at least one visible stage is blocked and every other visible stage is done (red)
 *   - at_risk:     something visible is blocked (a stage or a room) while other work continues
 *   - on_schedule: otherwise
 * Overdue is independent of those three: today is after the *planned* end date and the project is
 * neither completed nor archived. It is always shown in the attention tone, never red.
 */
export type HealthState = "on_schedule" | "at_risk" | "blocked";

export type BlockedItem = { kind: "stage" | "room"; id?: string; name: string };

export type ProjectHealth = { state: HealthState; overdueDays: number; blockedItems: BlockedItem[] };

type StageLike = { id?: string; name: string; status: Status; is_visible: boolean };
type RoomLike = { id?: string; name: string; status: Status; is_visible: boolean };
type ProjectLike = { status: string; planned_target_date: string | null };

const DAY = 86_400_000;
const dayStart = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

/** Whole days after `end` ('YYYY-MM-DD'); 0 on the end day itself or before it. */
function daysAfter(end: string, today: Date): number {
  const diff = Math.floor((dayStart(today) - dayStart(parseDate(end))) / DAY);
  return diff > 0 ? diff : 0;
}

/** Days a project is past its planned end; 0 when there is no plan, or it is completed or archived. */
export function projectOverdueDays(project: ProjectLike, today: Date = new Date()): number {
  if (!project.planned_target_date || project.status === "completed" || project.status === "archived") return 0;
  return daysAfter(project.planned_target_date, today);
}

/** Days a stage is past its end date; 0 once it is done (under 100%) or while on time. */
export function stageOverdueDays(stage: { end_date: string; status: Status; progress?: number }, today: Date = new Date()): number {
  if (stage.status === "done" || (stage.progress ?? 0) >= 100) return 0;
  return daysAfter(stage.end_date, today);
}

export function projectHealth(project: ProjectLike, stages: StageLike[], rooms: RoomLike[], today: Date = new Date()): ProjectHealth {
  const visibleStages = stages.filter((s) => s.is_visible);
  const blockedStages = visibleStages.filter((s) => s.status === "blocked");
  const blockedRooms = rooms.filter((r) => r.is_visible && r.status === "blocked");
  const blockedItems: BlockedItem[] = [
    ...blockedStages.map((s): BlockedItem => ({ kind: "stage", id: s.id, name: s.name })),
    ...blockedRooms.map((r): BlockedItem => ({ kind: "room", id: r.id, name: r.name })),
  ];
  const restDone = visibleStages.every((s) => s.status === "blocked" || s.status === "done");
  const state: HealthState = blockedStages.length > 0 && restDone ? "blocked" : blockedItems.length > 0 ? "at_risk" : "on_schedule";
  return { state, overdueDays: projectOverdueDays(project, today), blockedItems };
}
