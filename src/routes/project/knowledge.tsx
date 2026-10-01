import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Icon } from "@/components/ui/icon";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { ItemGroup } from "@/components/ui/item";
import { PageHeader, PageLoading } from "@/components/page-header";
import { KnowledgeEntryItem } from "@/features/knowledge/ui/knowledge-entry";
import { KnowledgeSheet } from "@/features/knowledge/ui/knowledge-sheet";
import { useKnowledge, useToggleKnowledgeVisible } from "@/features/knowledge/hooks/use-knowledge";
import type { Knowledge } from "@/lib/database.types";

export const Route = createFileRoute("/_authed/projects/$projectId/knowledge")({
  head: ({ match }) => ({
    meta: [
      { title: `${match.context.i18n.t("knowledge:page.title")} — RenoVision` },
      { name: "description", content: match.context.i18n.t("knowledge:meta.description") },
    ],
  }),
  component: KnowledgePage,
});

function KnowledgePage() {
  const { projectId } = Route.useParams();
  const { t } = useTranslation("knowledge");
  const { data: entries, isLoading } = useKnowledge(projectId);
  const [editing, setEditing] = useState<Knowledge | "new" | null>(null);
  const toggle = useToggleKnowledgeVisible(projectId);
  const startNewEntry = () => setEditing("new");
  if (isLoading || !entries) return <PageLoading />;

  return (
    <div className="mx-auto w-full max-w-5xl">
      <PageHeader
        title={t("page.title")}
        description={t("page.description")}
        actions={
          <Button onClick={startNewEntry} className="gap-2">
            <Icon name="add" size={20} /> {t("page.addEntry")}
          </Button>
        }
      />
      {entries.length === 0 ? (
        <Empty className="mt-6">
          <EmptyHeader>
            <EmptyMedia variant="icon" icon="menu_book" />
            <EmptyTitle>{t("page.empty.title")}</EmptyTitle>
            <EmptyDescription>{t("page.empty.description")}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <ItemGroup className="mt-6 md:grid md:grid-cols-2 md:gap-4">
          {entries.map((k) => (
            <KnowledgeEntryItem key={k.id} entry={k} onEdit={() => setEditing(k)} onToggle={() => toggle.mutate(k)} />
          ))}
        </ItemGroup>
      )}
      <KnowledgeSheet projectId={projectId} entry={editing} onClose={() => setEditing(null)} />
    </div>
  );
}
