import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Icon } from "@/components/ui/icon";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { PageHeader, PageLoading } from "@/components/page-header";
import { InternalBadge } from "@/components/manager/visibility-badge";
import { ExpenseSheet } from "@/components/expense-sheet";
import { BudgetStats } from "@/features/budget/ui/budget-stats";
import { ExpenseTable } from "@/features/budget/ui/expense-table";
import { InternalNotes } from "@/features/budget/ui/internal-notes";
import { api } from "@/lib/api";
import { useExpenses, useProject, useStages } from "@/lib/queries";
import { budgetSummary } from "@/lib/budget";
import type { Expense } from "@/lib/database.types";

export const Route = createFileRoute("/projects/$projectId/budget")({
  head: () => ({
    meta: [
      { title: "Budget — RenoVision" },
      { name: "description", content: "Track expenses, vendor notes and receipts. Clients only see the budget and spent totals." },
    ],
  }),
  component: BudgetPage,
});

function BudgetPage() {
  const { projectId } = Route.useParams();
  const { data: project } = useProject(projectId);
  const { data: expenses, isLoading } = useExpenses(projectId);
  const { data: stages = [] } = useStages(projectId);
  const [editing, setEditing] = useState<Expense | "new" | null>(null);

  if (isLoading || !expenses || !project) return <PageLoading />;
  const budget = budgetSummary(project);

  const openReceipt = async (path: string) => {
    try {
      window.open(await api.receiptUrl(path), "_blank", "noopener");
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <div className="mx-auto w-full max-w-6xl space-y-8">
      <PageHeader
        title="Budget & expenses"
        description="The client sees the budget and the spent total. Line items, vendors and receipts stay internal."
        actions={
          <Button onClick={() => setEditing("new")} className="gap-2">
            <Icon name="add" size={20} /> Add expense
          </Button>
        }
      />

      <BudgetStats project={project} budget={budget} />
      <Progress value={budget.usedPct} tone={budget.over ? "blocked" : "progress"} className="h-3" />

      <InternalNotes projectId={projectId} />

      <section>
        <h2 className="mb-3 flex flex-wrap items-center gap-2 text-title-lg">
          Expenses <InternalBadge />
        </h2>
        <ExpenseTable expenses={expenses} stages={stages} onSelect={setEditing} onOpenReceipt={(path) => void openReceipt(path)} />
      </section>

      <ExpenseSheet projectId={projectId} expense={editing} stages={stages} onClose={() => setEditing(null)} />
    </div>
  );
}
