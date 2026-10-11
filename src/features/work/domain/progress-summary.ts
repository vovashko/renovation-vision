import { daysLate } from "@/domain/attention";
import type { Status } from "@/domain/status";

type SummaryStage = {
  status: Status;
  progress: number;
  end_date: string;
  name: string;
  is_visible?: boolean;
};

export type ProgressSummary = {
  /** Stages marked `done`, out of the total (hidden stages excluded). */
  stagesDone: number;
  stagesTotal: number;
  /** Mean progress across the stages, rounded to the nearest percent; 0 with no stages. */
  overallProgress: number;
  /** The soonest end date among stages that aren't done yet, or null when every stage is done. */
  nextDeadline: { name: string; endDate: string; lateDays: number } | null;
  /** True when there are stages and every one of them is done. */
  allDone: boolean;
};

/**
 * Pure selector behind the desktop Progress page's stat cards. Only visible stages count, so a
 * manager's dashboard isn't thrown off by stages they've hidden from the client (`is_visible: false`
 * is treated the same as not passing the stage at all).
 */
export function progressSummary(stages: SummaryStage[], today: Date = new Date()): ProgressSummary {
  const visible = stages.filter((s) => s.is_visible !== false);
  const stagesTotal = visible.length;
  const stagesDone = visible.filter((s) => s.status === "done").length;
  const overallProgress = stagesTotal === 0 ? 0 : Math.round(visible.reduce((sum, s) => sum + s.progress, 0) / stagesTotal);

  const upcoming = visible.filter((s) => s.status !== "done").sort((a, b) => a.end_date.localeCompare(b.end_date))[0];

  const nextDeadline = upcoming ? { name: upcoming.name, endDate: upcoming.end_date, lateDays: daysLate(upcoming, today) } : null;

  return {
    stagesDone,
    stagesTotal,
    overallProgress,
    nextDeadline,
    allDone: stagesTotal > 0 && stagesDone === stagesTotal,
  };
}
