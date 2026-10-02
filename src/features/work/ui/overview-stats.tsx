import { useTranslation } from "react-i18next";
import { Stat, StatChange, StatDelta, StatLabel, StatValue } from "@/components/ui/stat";
import { budgetStatus, daysLate } from "@/domain/attention";
import { useFormat } from "@/i18n";
import type { ProjectSummary, Stage } from "@/lib/database.types";

const DATE_STYLE = "long";

/** The four project-facts stat cards on the client overview. */
export function OverviewStats({ project, stages }: { project: ProjectSummary; stages: Stage[] }) {
  const { t } = useTranslation("work");
  const format = useFormat();
  const budget = budgetStatus(project);
  const lateStages = stages.filter((s) => daysLate(s) > 0).length;
  const started = format.date(project.start_date, DATE_STYLE);
  const target = format.date(project.target_date, DATE_STYLE);

  return (
    <section className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label={t("overview.projectFacts")}>
      <Stat>
        <StatLabel>{t("stats.started")}</StatLabel>
        <StatValue>{started}</StatValue>
        <StatChange>{t("stats.target", { date: target })}</StatChange>
      </Stat>
      <Stat>
        <StatLabel>{t("stats.stagesDone")}</StatLabel>
        <StatValue unit={`/ ${project.stages_total}`}>{project.stages_done}</StatValue>
        <StatChange>
          <StatDelta tone={lateStages ? "attention" : "good"}>
            {lateStages ? t("stats.stagesLate", { count: lateStages }) : t("stats.onSchedule")}
          </StatDelta>
        </StatChange>
      </Stat>
      <Stat variant={budget.over ? "attention" : "default"}>
        <StatLabel>{t("stats.budgetSpent")}</StatLabel>
        <StatValue>{format.money(project.spent, project.currency)}</StatValue>
        <StatChange>
          <StatDelta tone={budget.over ? "attention" : "good"}>
            {budget.over ? t("stats.overBudget", { pct: budget.overPct }) : t("stats.budgetUsed", { pct: budget.usedPct })}
          </StatDelta>{" "}
          {t("stats.ofPlan", { amount: format.money(project.budget, project.currency) })}
        </StatChange>
      </Stat>
      <Stat>
        <StatLabel>{t("stats.siteManager")}</StatLabel>
        <StatValue>{project.manager_name || t("stats.noManager")}</StatValue>
        <StatChange>{t("stats.pointOfContact")}</StatChange>
      </Stat>
    </section>
  );
}
