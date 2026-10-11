import { useTranslation } from "react-i18next";
import { Stat, StatChange, StatDelta, StatLabel, StatValue } from "@/components/ui/stat";
import { ProgressBar } from "@/components/ui/progress-bar";
import { StatSkeleton } from "@/components/ui/skeleton";
import { progressSummary } from "@/features/work/domain/progress-summary";
import { useFormat } from "@/i18n";
import type { Stage } from "@/lib/database.types";

/** The three stat cards above the Progress timeline (desktop Progress screen). */
export function ProgressSummary({ stages }: { stages: Stage[] }) {
  const { t } = useTranslation(["work", "common"]);
  const format = useFormat();
  const summary = progressSummary(stages);
  if (summary.stagesTotal === 0) return null;

  const { stagesDone, stagesTotal, overallProgress, nextDeadline } = summary;

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <Stat>
        <StatLabel>{t("work:summary.stagesDone")}</StatLabel>
        <StatValue unit={`/ ${stagesTotal}`}>{stagesDone}</StatValue>
      </Stat>
      <Stat>
        <StatLabel>{t("work:summary.overallProgress")}</StatLabel>
        <StatValue>{overallProgress}%</StatValue>
        <ProgressBar value={overallProgress} className="mt-2" aria-label={t("work:summary.overallProgress")} />
      </Stat>
      <Stat variant={nextDeadline && nextDeadline.lateDays > 0 ? "attention" : "default"}>
        <StatLabel>{t("work:summary.nextDeadline")}</StatLabel>
        <StatValue>{nextDeadline ? format.date(nextDeadline.endDate, "short") : "—"}</StatValue>
        <StatChange>
          {nextDeadline ? (
            <>
              {nextDeadline.lateDays > 0 && (
                <StatDelta tone="attention">{t("common:attention.daysLate", { count: nextDeadline.lateDays })}</StatDelta>
              )}
              <span className="truncate">{nextDeadline.name}</span>
            </>
          ) : (
            t("work:summary.allDone")
          )}
        </StatChange>
      </Stat>
    </div>
  );
}

export function ProgressSummarySkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <StatSkeleton />
      <StatSkeleton />
      <StatSkeleton />
    </div>
  );
}
