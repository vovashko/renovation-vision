import { useTranslation } from "react-i18next";
import { Icon } from "@/components/ui/icon";
import { Stat, StatChange, StatDelta, StatLabel, StatValue } from "@/components/ui/stat";
import { useFormat } from "@/i18n";
import { budgetDeviation, type budgetSummary } from "@/domain/budget";

type ClientBudgetProject = { planned_budget: number; budget: number; spent: number; currency: string };

/**
 * What the client sees of the budget (decision 10): the planned budget, the projected one (planned plus the
 * approved change requests) with the deviation, and the spent total. No expenses, vendors, receipts or notes.
 */
export function ClientBudgetStats({ project, budget }: { project: ClientBudgetProject; budget: ReturnType<typeof budgetSummary> }) {
  const { t } = useTranslation(["budget", "common"]);
  const format = useFormat();
  const deviation = budgetDeviation(project.planned_budget, project.budget);
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <Stat>
        <StatLabel>
          <Icon name="flag" size={20} /> {t("budget:client.planned")}
        </StatLabel>
        <StatValue>{format.money(project.planned_budget, project.currency)}</StatValue>
        <StatChange>{t("budget:client.plannedHint")}</StatChange>
      </Stat>
      <Stat>
        <StatLabel>
          <Icon name="euro" size={20} /> {t("budget:stats.budget")}
        </StatLabel>
        <StatValue>{format.money(project.budget, project.currency)}</StatValue>
        <StatChange>
          {deviation !== 0 ? (
            <StatDelta tone={deviation > 0 ? "attention" : "good"}>
              {t("budget:client.deviation", { amount: format.money(deviation, project.currency, { decimals: 0, signed: true }) })}
            </StatDelta>
          ) : (
            t("budget:client.onPlan")
          )}
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
            t("budget:client.spentOf", { pct: budget.usedPct })
          )}
        </StatChange>
      </Stat>
    </div>
  );
}
