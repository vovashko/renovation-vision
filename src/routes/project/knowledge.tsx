import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Icon } from "@/components/ui/icon";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { ItemGroup } from "@/components/ui/item";
import { PageHeader, PageLoading } from "@/components/page-header";
import { KnowledgeEntryItem } from "@/features/knowledge/ui/knowledge-entry";
import { KnowledgeSheet } from "@/features/knowledge/ui/knowledge-sheet";
import { api } from "@/lib/api";
import { keys, useKnowledge, useSave } from "@/lib/queries";
import type { Knowledge } from "@/lib/database.types";

export const Route = createFileRoute("/projects/$projectId/knowledge")({
  head: () => ({
    meta: [
      { title: "AI knowledge — RenoVision" },
      { name: "description", content: "Facts the client's AI assistant can use when answering questions." },
    ],
  }),
  component: KnowledgePage,
});

function KnowledgePage() {
  const { projectId } = Route.useParams();
  const { data: entries, isLoading } = useKnowledge(projectId);
  const [editing, setEditing] = useState<Knowledge | "new" | null>(null);
  const toggle = useSave(projectId, (k: Knowledge) => api.saveKnowledge(projectId, { id: k.id, is_visible: !k.is_visible }), {
    invalidate: [keys.knowledge(projectId)],
    success: (k) => (k.is_visible ? "The assistant will no longer use this" : "The assistant can use this now"),
  });
  if (isLoading || !entries) return <PageLoading />;

  return (
    <div className="mx-auto w-full max-w-5xl">
      <PageHeader
        title="AI knowledge"
        description="The client's “Ask AI” assistant answers from project data plus the visible entries here."
        actions={
          <Button onClick={() => setEditing("new")} className="gap-2">
            <Icon name="add" size={20} /> Add entry
          </Button>
        }
      />
      {entries.length === 0 ? (
        <Empty className="mt-6">
          <EmptyHeader>
            <EmptyMedia variant="icon" icon="menu_book" />
            <EmptyTitle>Nothing yet</EmptyTitle>
            <EmptyDescription>
              Add answers to the questions clients ask most — working hours, deliveries, why something is blocked.
            </EmptyDescription>
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
