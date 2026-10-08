import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Note } from "@/components/ui/note";
import { PageHeader, PageLoading } from "@/components/page-header";
import { useNavRole } from "@/shared/ui/nav-role";
import { DecisionDetail } from "@/features/decisions/ui/decision-detail";
import { DecisionFormSheet } from "@/features/decisions/ui/decision-form-sheet";
import { DecisionList } from "@/features/decisions/ui/decision-list";
import { DecisionSummary } from "@/features/decisions/ui/decision-summary";
import { useDecisions } from "@/features/decisions/hooks";
import { useProject } from "@/features/projects/hooks";
import type { Decision } from "@/lib/database.types";

type DecisionsSearch = { case?: string };

// Named at module scope so the linter does not mistake this sentinel for user-facing text.
const NEW_CASE = "new";

export const Route = createFileRoute("/_authed/projects/$projectId/decisions")({
  validateSearch: (s: Record<string, unknown>): DecisionsSearch => ({ case: typeof s.case === "string" ? s.case : undefined }),
  head: ({ match }) => ({
    meta: [
      { title: `${match.context.i18n.t("decisions:page.title")} — RenoVision` },
      { name: "description", content: match.context.i18n.t("decisions:page.descriptionClient") },
    ],
  }),
  component: DecisionsPage,
});

function DecisionsPage() {
  const { t } = useTranslation(["decisions"]);
  const { projectId } = Route.useParams();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const isManager = useNavRole() === "manager";
  const { data: project } = useProject(projectId);
  const { data: decisions, isLoading } = useDecisions(projectId);
  const [editing, setEditing] = useState<Decision | "new" | null>(null);

  if (isLoading || !decisions || !project) return <PageLoading />;

  const selected = search.case ? decisions.find((d) => d.id === search.case) : undefined;
  const open = (id: string | undefined) => void navigate({ search: { case: id }, replace: false });
  const impactProject = { budget: project.budget, target_date: project.target_date, currency: project.currency };

  return (
    <div className="mx-auto w-full max-w-6xl space-y-8">
      <PageHeader
        title={t("decisions:page.title")}
        description={isManager ? t("decisions:page.descriptionManager") : t("decisions:page.descriptionClient")}
        actions={
          isManager ? (
            <Button onClick={() => setEditing(NEW_CASE)} className="gap-2">
              <Icon name="add" size={20} /> {t("decisions:page.new")}
            </Button>
          ) : undefined
        }
      />

      {search.case ? (
        selected ? (
          <DecisionDetail
            projectId={projectId}
            decision={selected}
            project={impactProject}
            isManager={isManager}
            onBack={() => open(undefined)}
            onEdit={() => setEditing(selected)}
          />
        ) : (
          <div className="space-y-4">
            <Note>{t("decisions:detail.notFound")}</Note>
            <Button variant="ghost" onClick={() => open(undefined)} className="gap-2">
              <Icon name="arrow_back" size={20} /> {t("decisions:page.back")}
            </Button>
          </div>
        )
      ) : (
        <>
          <DecisionSummary decisions={decisions} isManager={isManager} />
          <DecisionList decisions={decisions} currency={project.currency} isManager={isManager} onSelect={(d) => open(d.id)} />
        </>
      )}

      {isManager && (
        <DecisionFormSheet projectId={projectId} decision={editing} currency={project.currency} onClose={() => setEditing(null)} />
      )}
    </div>
  );
}
