import { useTranslation } from "react-i18next";
import { Card } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { Note } from "@/components/ui/note";
import { ProgressBar } from "@/components/ui/progress-bar";
import { useFormat, useScheduleLabel } from "@/i18n";
import { cn } from "@/lib/utils";
import type { ScheduleStatus } from "@/lib/database.types";
import type { ProjectIssue } from "../domain/project-issues";
import { IssuesList } from "./issues-list";

/** The manager overview's status card: on-track headline, progress, key facts, note and issues. */
export function StatusCard({
  projectId,
  scheduleStatus,
  scheduleNote,
  progress,
  currentStage,
  stagesDone,
  stagesTotal,
  targetDate,
  daysLeft,
  budgetUsedPct,
  budgetOver,
  issues,
  onOpenDetails,
}: {
  projectId: string;
  scheduleStatus: ScheduleStatus;
  scheduleNote?: string | null;
  progress: number;
  currentStage: string | null;
  stagesDone: number;
  stagesTotal: number;
  targetDate: string | null;
  daysLeft: number | null;
  budgetUsedPct: number;
  budgetOver: boolean;
  issues: ProjectIssue[];
  onOpenDetails: () => void;
}) {
  const { t } = useTranslation(["projects", "common"]);
  const format = useFormat();
  const scheduleLabel = useScheduleLabel();
  const onTrack = scheduleStatus === "on_schedule";
  const pastTarget = daysLeft !== null && daysLeft < 0;

  const facts = [
    { label: t("status.stagesDone"), value: t("status.stagesDoneValue", { done: stagesDone, total: stagesTotal }) },
    { label: t("status.target"), value: format.date(targetDate, "short") },
    {
      label: pastTarget ? t("status.pastTarget") : t("status.daysLeft"),
      value: daysLeft === null ? "—" : t("status.daysLeftValue", { count: Math.abs(daysLeft) }),
      attention: pastTarget,
    },
    { label: t("status.budgetUsed"), value: `${budgetUsedPct}%`, attention: budgetOver },
  ];

  return (
    <Card attention={!onTrack} className="flex flex-col gap-6 p-5 md:p-6" aria-labelledby="status-heading">
      <div className="flex items-start gap-4 pr-4">
        <span
          className={cn(
            "grid size-12 shrink-0 place-items-center rounded-full",
            onTrack ? "bg-success-container text-success-text" : "bg-attention-container text-attention",
          )}
        >
          <Icon name={onTrack ? "check_circle" : "schedule"} size={24} />
        </span>
        <div className="min-w-0">
          <p className="text-body-md text-on-surface-variant">{t("status.label")}</p>
          <h2 id="status-heading" className="text-headline-md">
            {onTrack ? t("status.onTrack") : scheduleLabel(scheduleStatus)}
          </h2>
          <p className="text-body-md text-on-surface-variant">
            {issues.length ? t("status.needsAttention", { count: issues.length }) : t("status.allClear")}
          </p>
        </div>
      </div>

      <div>
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-body-md text-on-surface-variant">
            {currentStage ? (
              <>
                {t("status.workingOnLabel")} <span className="font-medium text-on-surface">{currentStage}</span>
              </>
            ) : (
              t("status.overallProgress")
            )}
          </span>
          <span className="text-title-lg tabular-nums">{progress}%</span>
        </div>
        <ProgressBar value={progress} className="mt-2" />
        <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
          {facts.map((f) => (
            <div key={f.label} className="min-w-0">
              <dt className="text-body-sm text-on-surface-variant">{f.label}</dt>
              <dd className={cn("text-title-md", f.attention && "text-attention-text")}>{f.value}</dd>
            </div>
          ))}
        </dl>
      </div>

      {scheduleNote && (
        <Note>
          <span className="font-medium text-on-surface">{t("status.noteForClient")}</span>
          {scheduleNote}
        </Note>
      )}

      <IssuesList issues={issues} projectId={projectId} onOpenDetails={onOpenDetails} />
    </Card>
  );
}
