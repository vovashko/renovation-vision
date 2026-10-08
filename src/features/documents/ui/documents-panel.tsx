import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Icon } from "@/components/ui/icon";
import { ItemGroup } from "@/components/ui/item";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageLoading } from "@/components/page-header";
import { useConfirm } from "@/shared/ui/use-confirm";
import { useRooms, useStages } from "@/features/work/hooks";
import { useArchiveDocument, useDocuments, useDownloadDocument } from "@/features/documents/hooks";
import {
  countByCategory,
  documentsOf,
  DOCUMENT_CATEGORIES,
  groupByRoom,
  groupVersions,
  isVersionedCategory,
} from "@/features/documents/domain/documents";
import { DocumentEditSheet } from "@/features/documents/ui/document-edit-sheet";
import { DocumentItem, type DocumentActions } from "@/features/documents/ui/document-item";
import { DocumentUploadSheet } from "@/features/documents/ui/document-upload-sheet";
import { InstallationGallery } from "@/features/documents/ui/installation-gallery";
import { VersionedDocuments } from "@/features/documents/ui/versioned-documents";
import type { DocumentCategory, ProjectDocument } from "@/lib/database.types";

/**
 * The Documentation page body: one tab per category. The investor (client) sees and downloads; the site manager
 * also uploads (a new version for contract/estimate), edits and archives. Archived documents are hidden unless the
 * manager switches them on.
 */
export function DocumentsPanel({ projectId, isManager, now }: { projectId: string; isManager: boolean; now?: Date }) {
  const { t } = useTranslation(["documents", "common"]);
  const confirm = useConfirm();
  const { data: docs, isLoading } = useDocuments(projectId);
  const { data: rooms = [] } = useRooms(projectId);
  const { data: stages = [] } = useStages(projectId);
  const download = useDownloadDocument();
  const archive = useArchiveDocument(projectId);

  const [category, setCategory] = useState<DocumentCategory>("contract");
  const [showArchived, setShowArchived] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [versionGroup, setVersionGroup] = useState<string | null>(null);
  const [editing, setEditing] = useState<ProjectDocument | null>(null);

  const includeArchived = isManager && showArchived;
  const all = useMemo(() => docs ?? [], [docs]);
  const counts = useMemo(() => countByCategory(all, includeArchived), [all, includeArchived]);
  const inCategory = useMemo(() => documentsOf(all, category, includeArchived), [all, category, includeArchived]);
  const roomOptions = useMemo(() => rooms.map((r) => ({ id: r.id, name: r.name })), [rooms]);
  const taskOptions = useMemo(
    () => stages.flatMap((s) => s.tasks.map((task) => ({ id: task.id, label: `${s.name}: ${task.name}` }))),
    [stages],
  );
  const hasArchived = all.some((d) => d.archived_at);

  if (isLoading || !docs) return <PageLoading />;

  const actions: DocumentActions = {
    isManager,
    onDownload: (doc) => download.mutate(doc),
    onEdit: setEditing,
    onArchive: async (doc, archived) => {
      if (archived && !(await confirm({ title: t("confirm.archiveTitle"), description: t("confirm.archiveBody"), destructive: true })))
        return;
      archive.mutate({ id: doc.id, archived });
    },
  };
  const roomName = (id: string | null) => rooms.find((r) => r.id === id)?.name ?? t("gallery.noRoom");
  const taskName = (id: string | null) => (id ? (taskOptions.find((x) => x.id === id)?.label ?? null) : null);
  const openUpload = (group: string | null = null) => {
    setVersionGroup(group);
    setUploading(true);
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs value={category} onValueChange={(v) => setCategory(v as DocumentCategory)}>
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
          <Button className="min-h-11 gap-2" onClick={() => openUpload()}>
            <Icon name="upload_file" size={22} /> {t("actions.add")}
          </Button>
        )}
      </div>

      {isManager && hasArchived && (
        <div className="flex items-center gap-3">
          <Switch id="documents-show-archived" checked={showArchived} onCheckedChange={setShowArchived} />
          <Label htmlFor="documents-show-archived" className="font-normal">
            {t("actions.showArchived")}
          </Label>
        </div>
      )}

      <section aria-label={t(`categories.${category}`)}>
        {inCategory.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon" icon="folder_open" />
              <EmptyTitle>{t("empty.title")}</EmptyTitle>
              <EmptyDescription>{isManager ? t("empty.manager") : t("empty.client")}</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : isVersionedCategory(category) ? (
          <VersionedDocuments groups={groupVersions(inCategory)} actions={actions} onNewVersion={openUpload} now={now} />
        ) : category === "installation_photos" ? (
          <InstallationGallery
            galleries={groupByRoom(
              inCategory,
              rooms.map((r) => r.id),
            )}
            roomName={roomName}
            taskName={taskName}
            actions={actions}
            now={now}
          />
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
          <DocumentUploadSheet
            projectId={projectId}
            open={uploading}
            onOpenChange={setUploading}
            category={category}
            versionGroup={versionGroup}
            documents={all}
            rooms={roomOptions}
            tasks={taskOptions}
          />
          <DocumentEditSheet projectId={projectId} doc={editing} onClose={() => setEditing(null)} rooms={roomOptions} tasks={taskOptions} />
        </>
      )}
    </div>
  );
}
