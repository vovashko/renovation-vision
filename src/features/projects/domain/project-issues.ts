import { budgetStatus, daysLate } from "@/domain/attention";
import { findInconsistencies, type Inconsistency } from "@/domain/consistency";
import type { ScheduleStatus, Status } from "@/domain/status";

/**
 * A manager overview issue, as data (no language, no colors, no routes — the UI maps `kind` to an
 * i18n message, a tone/icon and a route). Order: blocked stages/rooms, then late stages, then the
 * budget, then the soft data-consistency checks.
 */
export type ProjectIssue =
  | { kind: "stage_blocked"; id: string; name: string; note: string | null }
  | { kind: "room_blocked"; id: string; name: string; note: string | null }
  | { kind: "stage_late"; id: string; name: string; daysLate: number; progress: number; endDate: string }
  | { kind: "over_budget"; overPct: number; spent: number; budget: number }
  | { kind: "inconsistency"; issue: Inconsistency };

type IssueTaskLike = { name: string; room_id: string | null; done: boolean };
type IssueStage = {
  id: string;
  name: string;
  status: Status;
  end_date: string;
  progress: number;
  client_note: string | null;
  is_visible: boolean;
  tasks: IssueTaskLike[];
};
type IssueRoom = { id: string; name: string; status: Status; client_note: string | null; is_visible: boolean };
type IssueProject = { schedule_status: ScheduleStatus; budget: number; spent: number };

/** Everything a manager should look at on a project, in the order the overview shows it. */
export function projectIssues(project: IssueProject, stages: IssueStage[], rooms: IssueRoom[], today: Date = new Date()): ProjectIssue[] {
  const budget = budgetStatus(project);
  return [
    ...stages
      .filter((s) => s.status === "blocked")
      .map((s): ProjectIssue => ({ kind: "stage_blocked", id: s.id, name: s.name, note: s.client_note })),
    ...rooms
      .filter((r) => r.status === "blocked")
      .map((r): ProjectIssue => ({ kind: "room_blocked", id: r.id, name: r.name, note: r.client_note })),
    ...stages
      .filter((s) => s.status !== "blocked" && daysLate(s, today) > 0)
      .map((s): ProjectIssue => ({
        kind: "stage_late",
        id: s.id,
        name: s.name,
        daysLate: daysLate(s, today),
        progress: s.progress,
        endDate: s.end_date,
      })),
    ...(budget.over
      ? [{ kind: "over_budget", overPct: budget.overPct, spent: project.spent, budget: project.budget } satisfies ProjectIssue]
      : []),
    ...findInconsistencies(project, stages, rooms).map((issue): ProjectIssue => ({ kind: "inconsistency", issue })),
  ];
}
