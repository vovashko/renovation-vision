import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Icon } from "@/components/ui/icon";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { PageHeader, PageLoading } from "@/components/page-header";
import { InternalBadge } from "@/shared/ui/visibility-badge";
import { useNavRole } from "@/shared/ui/nav-role";
import { MaterialsImportButton } from "@/features/import/ui/import-button";
import { ExpenseSheet } from "@/features/budget/ui/expense-sheet";
import { BudgetStats } from "@/features/budget/ui/budget-stats";
import { ClientBudgetView } from "@/features/budget/ui/client-budget-view";
import { ExpenseTable } from "@/features/budget/ui/expense-table";
import { InternalNotes } from "@/features/budget/ui/internal-notes";
import { useExpenses, useOpenReceipt } from "@/features/budget/hooks/use-expenses";
import { ChangeRequestSection } from "@/features/change-requests/ui/change-request-section";
import type { ChangeRequestPlace } from "@/features/change-requests/domain/status";
import { useProject } from "@/features/projects/hooks";
import { useStages } from "@/features/work/hooks";
import { budgetSummary } from "@/domain/budget";
import type { Expense, ProjectSummary, Stage } from "@/lib/database.types";

// Where this page lists change requests (named at module scope so the linter doesn't take it for text).
const PLACE: ChangeRequestPlace = "budget";

/** `request` opens one change request (links from notifications, emails and the overview card). */
type BudgetSearch = { request?: string };

export const Route = createFileRoute("/_authed/projects/$projectId/budget")({
  validateSearch: (s: Record<string, unknown>): BudgetSearch => ({ request: typeof s.request === "string" ? s.request : undefined }),
  head: ({ match }) => ({
    meta: [
      { title: `${match.context.i18n.t("budget:page.titleClient")} — RenoVision` },
      { name: "description", content: match.context.i18n.t("budget:page.descriptionClient") },
    ],
  }),
  component: BudgetPage,
});

/** Both roles: managers get expenses, notes and stage costs; clients the totals only (decision 10). Both get change requests. */
function BudgetPage() {
  const { projectId } = Route.useParams();
  const isManager = useNavRole() === "manager";
  const { data: project } = useProject(projectId);
  const { data: stages = [] } = useStages(projectId);
  if (!project) return <PageLoading />;
  return isManager ? (
    <ManagerBudget projectId={projectId} project={project} stages={stages} />
  ) : (
    <ClientBudget project={project} stages={stages} />
  );
}

function useRequestSearch() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  return { selectedId: search.request, onSelect: (id: string | undefined) => void navigate({ search: { request: id } }) };
}

const impactOf = (p: ProjectSummary) => ({ budget: p.budget, target_date: p.target_date, currency: p.currency });

function ClientBudget({ project, stages }: { project: ProjectSummary; stages: Stage[] }) {
  const requestSearch = useRequestSearch();
  return (
    <ClientBudgetView project={project}>
      <ChangeRequestSection
        projectId={project.id}
        place={PLACE}
        project={impactOf(project)}
        isManager={false}
        stages={stages}
        {...requestSearch}
      />
    </ClientBudgetView>
  );
}

function ManagerBudget({ projectId, project, stages }: { projectId: string; project: ProjectSummary; stages: Stage[] }) {
  const { t } = useTranslation(["budget"]);
  const { data: expenses, isLoading } = useExpenses(projectId);
  const [editing, setEditing] = useState<Expense | "new" | null>(null);
  const openReceipt = useOpenReceipt();
  const requestSearch = useRequestSearch();
  const startNewExpense = () => setEditing("new");

  if (isLoading || !expenses) return <PageLoading />;
  const budget = budgetSummary(project);

  return (
    <div className="mx-auto w-full max-w-6xl space-y-8">
      <PageHeader
        title={t("budget:page.title")}
        description={t("budget:page.description")}
        actions={
          <>
            <MaterialsImportButton projectId={projectId} />
            <Button onClick={startNewExpense} className="gap-2">
              <Icon name="add" size={20} /> {t("budget:page.addExpense")}
            </Button>
          </>
        }
      />

      <BudgetStats project={project} budget={budget} />
      <Progress value={budget.usedPct} tone={budget.over ? "blocked" : "progress"} className="h-3" />

      <ChangeRequestSection projectId={projectId} place={PLACE} project={impactOf(project)} isManager stages={stages} {...requestSearch} />

      <InternalNotes projectId={projectId} />

      <section>
        <h2 className="mb-3 flex flex-wrap items-center gap-2 text-title-lg">
          {t("budget:expenses.heading")} <InternalBadge />
        </h2>
        <ExpenseTable
          expenses={expenses}
          stages={stages}
          currency={project.currency}
          onSelect={setEditing}
          onOpenReceipt={(path) => void openReceipt(path)}
        />
      </section>

      <ExpenseSheet projectId={projectId} expense={editing} stages={stages} onClose={() => setEditing(null)} />
    </div>
  );
}
