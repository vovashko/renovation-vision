import { useTranslation } from "react-i18next";
import { Icon } from "@/components/ui/icon";
import { Stat, StatChange, StatDelta, StatLabel, StatValue } from "@/components/ui/stat";
import { useFormat } from "@/i18n";
import { budgetDeviation, type budgetSummary } from "@/domain/budget";
import type { ProjectSummary } from "@/lib/database.types";

/** The Budget page's four stat tiles: Budget, Spent (attention over budget), Remaining, Used. */
export function BudgetStats({ project, budget }: { project: ProjectSummary; budget: ReturnType<typeof budgetSummary> }) {
  const { t } = useTranslation(["budget", "common"]);
  const format = useFormat();
  const overrun = budgetDeviation(project.planned_budget, project.budget);
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Stat>
        <StatLabel>
          <Icon name="euro" size={20} /> {t("budget:stats.budget")}
        </StatLabel>
        <StatValue>{format.money(project.budget, project.currency)}</StatValue>
        <StatChange>
          {overrun !== 0 && (
            <StatDelta tone={overrun > 0 ? "attention" : "good"}>
              {format.money(overrun, project.currency, { decimals: 0, signed: true })}
            </StatDelta>
          )}
          {t("budget:stats.plannedBudget", { amount: format.money(project.planned_budget, project.currency) })}
        </StatChange>
      </Stat>
      <Stat variant={budget.over ? "attention" : "default"}>
        <StatLabel>
          <Icon name="account_balance_wallet" size={20} /> {t("budget:stats.spent")}
        </StatLabel>
        <StatValue>{format.money(project.spent, project.currency)}</StatValue>
        <StatChange>
          {budget.over ? (
            <StatDelta tone="attention">{t("common:attention.overBudget", { pct: budget.overPct })}</StatDelta>
          ) : (
            t("budget:stats.clientSeesSpent")
          )}
        </StatChange>
      </Stat>
      <Stat>
        <StatLabel>
          <Icon name="savings" size={20} /> {t("budget:stats.remaining")}
        </StatLabel>
        <StatValue>{format.money(budget.remaining, project.currency)}</StatValue>
        <StatChange>
          {budget.over ? <StatDelta tone="attention">{t("budget:stats.overBudget")}</StatDelta> : t("budget:stats.leftToSpend")}
        </StatChange>
      </Stat>
      <Stat>
        <StatLabel>
          <Icon name="trending_up" size={20} /> {t("budget:stats.used")}
        </StatLabel>
        <StatValue>{budget.usedPct}%</StatValue>
        <StatChange>{t("budget:stats.projectComplete", { pct: project.overall_progress })}</StatChange>
      </Stat>
    </div>
  );
}
