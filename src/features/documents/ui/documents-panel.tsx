import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Icon } from "@/components/ui/icon";
import { ItemGroup } from "@/components/ui/item";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageLoading } from "@/components/page-header";
import { useConfirm } from "@/shared/ui/use-confirm";
import { useDeleteDocument, useDocuments, useDownloadDocument } from "@/features/documents/hooks";
import { countByCategory, documentsOf, DOCUMENT_CATEGORIES, type ShelfCategory } from "@/features/documents/domain/documents";
import { DocumentEditSheet } from "@/features/documents/ui/document-edit-sheet";
import { DocumentItem, type DocumentActions } from "@/features/documents/ui/document-item";
import { DocumentUploadSheet } from "@/features/documents/ui/document-upload-sheet";
import type { ProjectDocument } from "@/lib/database.types";

/**
 * The Documents page body: one tab per category. The client sees and downloads; the site manager also uploads,
 * edits the description and deletes (after a confirmation: there is no archive and no undo).
 */
export function DocumentsPanel({ projectId, isManager, now }: { projectId: string; isManager: boolean; now?: Date }) {
  const { t } = useTranslation(["documents", "common"]);
  const confirm = useConfirm();
  const { data: docs, isLoading } = useDocuments(projectId);
  const download = useDownloadDocument();
  const remove = useDeleteDocument(projectId);

  const [category, setCategory] = useState<ShelfCategory>("contract");
  const [uploading, setUploading] = useState(false);
  const [editing, setEditing] = useState<ProjectDocument | null>(null);

  const all = useMemo(() => docs ?? [], [docs]);
  const counts = useMemo(() => countByCategory(all), [all]);
  const inCategory = useMemo(() => documentsOf(all, category), [all, category]);

  if (isLoading || !docs) return <PageLoading />;

  const actions: DocumentActions = {
    isManager,
    onDownload: (doc) => download.mutate(doc),
    onEdit: setEditing,
    onDelete: async (doc) => {
      if (
        !(await confirm({
          title: t("confirm.deleteTitle"),
          description: t("confirm.deleteBody", { name: doc.file_name }),
          destructive: true,
        }))
      )
        return;
      remove.mutate(doc);
    },
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs value={category} onValueChange={(v) => setCategory(v as ShelfCategory)}>
          <TabsList aria-label={t("tabs.aria")} className="h-auto flex-wrap justify-start">
            {DOCUMENT_CATEGORIES.map((c) => (
              <TabsTrigger key={c} value={c} className="min-h-9 gap-2">
                {t(`categories.${c}`)}
                <span className="text-on-surface-variant">{counts[c]}</span>
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        {isManager && (
          <Button className="min-h-11 gap-2" onClick={() => setUploading(true)}>
            <Icon name="upload_file" size={22} /> {t("actions.add")}
          </Button>
        )}
      </div>

      <section aria-label={t(`categories.${category}`)}>
        {inCategory.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon" icon="folder_open" />
              <EmptyTitle>{t("empty.title")}</EmptyTitle>
              <EmptyDescription>{isManager ? t("empty.manager") : t("empty.client")}</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <ItemGroup>
            {inCategory.map((doc) => (
              <DocumentItem key={doc.id} doc={doc} actions={actions} now={now} />
            ))}
          </ItemGroup>
        )}
      </section>

      {isManager && (
        <>
          <DocumentUploadSheet projectId={projectId} open={uploading} onOpenChange={setUploading} category={category} />
          <DocumentEditSheet projectId={projectId} doc={editing} onClose={() => setEditing(null)} />
        </>
      )}
    </div>
  );
}
