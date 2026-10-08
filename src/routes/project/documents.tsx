import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { PageHeader } from "@/components/page-header";
import { DocumentsPanel } from "@/features/documents/ui/documents-panel";
import { useNavRole } from "@/shared/ui/nav-role";

export const Route = createFileRoute("/_authed/projects/$projectId/documents")({
  head: ({ match }) => ({
    meta: [
      { title: `${match.context.i18n.t("documents:page.heading")} — RenoVision` },
      { name: "description", content: match.context.i18n.t("documents:page.metaDescription") },
    ],
  }),
  component: DocumentsPage,
});

function DocumentsPage() {
  const { t } = useTranslation(["documents"]);
  const { projectId } = Route.useParams();
  const isManager = useNavRole() === "manager";
  return (
    <div className="mx-auto w-full max-w-6xl">
      <PageHeader title={t("page.heading")} description={isManager ? t("page.descriptionManager") : t("page.descriptionClient")} />
      <div className="mt-5">
        <DocumentsPanel projectId={projectId} isManager={isManager} />
      </div>
    </div>
  );
}
