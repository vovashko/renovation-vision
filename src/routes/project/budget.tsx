import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Icon } from "@/components/ui/icon";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { PageHeader, PageLoading } from "@/components/page-header";
import { InternalBadge } from "@/components/manager/visibility-badge";
import { ExpenseSheet } from "@/features/budget/ui/expense-sheet";
import { BudgetStats } from "@/features/budget/ui/budget-stats";
import { ExpenseTable } from "@/features/budget/ui/expense-table";
import { InternalNotes } from "@/features/budget/ui/internal-notes";
import { useExpenses, useOpenReceipt } from "@/features/budget/hooks/use-expenses";
import { useProject, useStages } from "@/lib/queries";
import { budgetSummary } from "@/domain/budget";
import type { Expense } from "@/lib/database.types";

export const Route = createFileRoute("/projects/$projectId/budget")({
  head: ({ match }) => ({
    meta: [
      { title: `${match.context.i18n.t("budget:page.title")} — RenoVision` },
      { name: "description", content: match.context.i18n.t("budget:page.description") },
    ],
  }),
  component: BudgetPage,
});

function BudgetPage() {
  const { t } = useTranslation(["budget"]);
  const { projectId } = Route.useParams();
  const { data: project } = useProject(projectId);
  const { data: expenses, isLoading } = useExpenses(projectId);
  const { data: stages = [] } = useStages(projectId);
  const [editing, setEditing] = useState<Expense | "new" | null>(null);
  const openReceipt = useOpenReceipt();

  if (isLoading || !expenses || !project) return <PageLoading />;
  const budget = budgetSummary(project);

  return (
    <div className="mx-auto w-full max-w-6xl space-y-8">
      <PageHeader
        title={t("budget:page.title")}
        description={t("budget:page.description")}
        actions={
          <Button onClick={() => setEditing("new")} className="gap-2">
            <Icon name="add" size={20} /> {t("budget:page.addExpense")}
          </Button>
        }
      />

      <BudgetStats project={project} budget={budget} />
      <Progress value={budget.usedPct} tone={budget.over ? "blocked" : "progress"} className="h-3" />

      <InternalNotes projectId={projectId} />

      <section>
        <h2 className="mb-3 flex flex-wrap items-center gap-2 text-title-lg">
          {t("budget:expenses.heading")} <InternalBadge />
        </h2>
        <ExpenseTable expenses={expenses} stages={stages} onSelect={setEditing} onOpenReceipt={(path) => void openReceipt(path)} />
      </section>

      <ExpenseSheet projectId={projectId} expense={editing} stages={stages} onClose={() => setEditing(null)} />
    </div>
  );
}
