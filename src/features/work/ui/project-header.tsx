import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { ProgressBar } from "@/components/ui/progress-bar";

/** The client overview's project header card: name, address, manager and overall progress. */
export function ProjectHeader({
  name,
  address,
  managerName,
  progress,
  currentStage,
  blocked,
  overdueDays,
  alerts,
  actions,
}: {
  name: string;
  address: string;
  managerName?: string | null;
  progress: number;
  currentStage?: string | null;
  /** Blocked with nothing else moving: the overall progress bar turns red. */
  blocked?: boolean;
  /** Days past the planned end date: the bar turns orange and a "Past due" badge shows. */
  overdueDays?: number;
  /** Warnings and alerts (e.g. the schedule note), shown at the bottom of the card. */
  alerts?: ReactNode;
  actions?: ReactNode;
}) {
  const { t } = useTranslation(["work", "common"]);
  return (
    <Card className="flex flex-wrap items-start justify-between gap-x-12 gap-y-6 px-5 py-5 md:px-7 md:py-6">
      <div className="min-w-0">
        <div className="text-body-md text-on-surface-variant">{t("overview.eyebrow")}</div>
        <h1 className="text-headline-md sm:text-headline-lg">{name}</h1>
        <p className="text-body-lg text-on-surface-variant">{address}</p>
        {managerName && (
          <div className="mt-3 flex items-center gap-2 text-body-md text-on-surface-variant">
            <span className="grid size-7 shrink-0 place-items-center rounded-full bg-surface-container-high">
              <Icon name="person" size={18} />
            </span>
            {t("overview.manager")} <span className="font-medium text-on-surface">{managerName}</span>
          </div>
        )}
        {actions && <div className="mt-4 flex flex-wrap gap-2">{actions}</div>}
      </div>
      <div className="w-full md:w-[380px]">
        <div className="flex items-end justify-between">
          <span className="text-body-md text-on-surface-variant">{t("overview.overallProgress")}</span>
          <span className="text-headline-md">{progress}%</span>
        </div>
        <ProgressBar
          value={progress}
          tone={blocked ? "blocked" : overdueDays ? "attention" : "primary"}
          className="mt-2"
          aria-label={t("overview.overallProgress")}
        />
        {!!overdueDays && (
          <Badge variant="attention" size="compact" icon="schedule" className="mt-3">
            {t("common:attention.pastDue", { count: overdueDays })}
          </Badge>
        )}
        {currentStage && (
          <div className="mt-3 text-body-md text-on-surface-variant">
            {t("overview.currentlyWorkingOnPrefix")} <span className="font-medium text-on-surface">{currentStage}</span>
          </div>
        )}
      </div>
      {alerts && <div className="w-full">{alerts}</div>}
    </Card>
  );
}
