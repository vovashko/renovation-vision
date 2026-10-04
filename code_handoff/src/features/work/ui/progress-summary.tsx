import { useTranslation } from "react-i18next";
import { Stat, StatChange, StatDelta, StatLabel, StatValue } from "@/components/ui/stat";
import { ProgressBar } from "@/components/ui/progress-bar";
import { StatSkeleton } from "@/components/ui/skeleton";
import { daysLate } from "@/domain/attention";
import { useFormat } from "@/i18n";
import type { Stage } from "@/lib/database.types";

/** The three stat cards above the Progress timeline (desktop Stages screen design). */
export function ProgressSummary({ stages }: { stages: Stage[] }) {
  const { t } = useTranslation(["work", "common"]);
  const format = useFormat();
  if (stages.length === 0) return null;

  const done = stages.filter((s) => s.status === "done").length;
  const overall = Math.round(stages.reduce((sum, s) => sum + s.progress, 0) / stages.length);
  const next = stages
    .filter((s) => s.status !== "done" && s.end_date)
    .sort((a, b) => a.end_date!.localeCompare(b.end_date!))[0];
  const late = next ? daysLate(next) : 0;

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <Stat>
        <StatLabel>{t("work:summary.stagesDone")}</StatLabel>
        <StatValue unit={`/ ${stages.length}`}>{done}</StatValue>
      </Stat>
      <Stat>
        <StatLabel>{t("work:summary.overallProgress")}</StatLabel>
        <StatValue>{overall}%</StatValue>
        <ProgressBar value={overall} className="mt-2" aria-label={t("work:summary.overallProgress")} />
      </Stat>
      <Stat variant={late > 0 ? "attention" : "default"}>
        <StatLabel>{t("work:summary.nextDeadline")}</StatLabel>
        <StatValue>{next ? format.date(next.end_date!, "short") : "—"}</StatValue>
        <StatChange>
          {next ? (
            <>
              {late > 0 && <StatDelta tone="attention">{t("common:attention.daysLate", { count: late })}</StatDelta>}
              <span className="truncate">{next.name}</span>
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
