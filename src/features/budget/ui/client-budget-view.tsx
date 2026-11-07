import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Progress } from "@/components/ui/progress";
import { PageHeader } from "@/components/page-header";
import { budgetSummary } from "@/domain/budget";
import { ClientBudgetStats } from "./client-budget-stats";

type ClientBudgetProject = { planned_budget: number; budget: number; spent: number; currency: string };

/**
 * The client's Budget page (decision 10): the planned, projected and spent totals, then `children` (the change
 * requests). Never the expenses, vendors, receipts or internal notes: this view doesn't load them at all.
 */
export function ClientBudgetView({ project, children }: { project: ClientBudgetProject; children?: ReactNode }) {
  const { t } = useTranslation(["budget"]);
  const budget = budgetSummary(project);
  return (
    <div className="mx-auto w-full max-w-6xl space-y-8">
      <PageHeader title={t("budget:page.titleClient")} description={t("budget:page.descriptionClient")} />
      <ClientBudgetStats project={project} budget={budget} />
      <Progress value={budget.usedPct} tone={budget.over ? "blocked" : "progress"} className="h-3" />
      {children}
    </div>
  );
}
