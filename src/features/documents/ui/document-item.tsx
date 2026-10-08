import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Item, ItemActions, ItemContent, ItemDescription, ItemMedia, ItemTitle } from "@/components/ui/item";
import { fileKind, fileTypeLabel, formatFileSize, isNewDocument, type FileKind } from "@/features/documents/domain/documents";
import { useFormat } from "@/i18n";
import type { ProjectDocument } from "@/lib/database.types";

const KIND_ICON: Record<FileKind, string> = {
  pdf: "picture_as_pdf",
  image: "image",
  word: "description",
  excel: "table_chart",
  file: "draft",
};

export type DocumentActions = {
  isManager: boolean;
  onDownload: (doc: ProjectDocument) => void;
  onEdit: (doc: ProjectDocument) => void;
  onArchive: (doc: ProjectDocument, archived: boolean) => void;
};

/**
 * One document row: type icon, title with the "new" marker, date added / file type / size, the description when
 * there is one, and the actions (download for everyone; edit and archive/restore for the site manager).
 */
export function DocumentItem({
  doc,
  actions,
  versionLabel,
  now,
}: {
  doc: ProjectDocument;
  actions: DocumentActions;
  /** "Version 2", shown for contract/estimate rows. */
  versionLabel?: string;
  now?: Date;
}) {
  const { t } = useTranslation(["documents"]);
  const format = useFormat();
  const archived = !!doc.archived_at;
  const meta = t("item.meta", {
    date: format.date(doc.created_at, "long"),
    type: fileTypeLabel(doc.mime_type, doc.file_name),
    size: formatFileSize(doc.size_bytes),
  });

  return (
    <Item data-testid="document-item" className={archived ? "border-dashed opacity-80" : undefined}>
      <ItemMedia variant="icon" icon={KIND_ICON[fileKind(doc.mime_type)]} />
      <ItemContent>
        <ItemTitle className="flex-wrap">
          <span className="min-w-0 break-words">{doc.title}</span>
          {isNewDocument(doc.created_at, now) && !archived && (
            <Badge variant="status-progress" size="compact" icon={null}>
              {t("item.new")}
            </Badge>
          )}
          {versionLabel && (
            <Badge variant="assist" size="compact" icon={null}>
              {versionLabel}
            </Badge>
          )}
          {archived && (
            <Badge variant="outline" size="compact" icon="inventory_2">
              {t("item.archived")}
            </Badge>
          )}
        </ItemTitle>
        <ItemDescription>{meta}</ItemDescription>
        {doc.description && <ItemDescription className="text-on-surface">{doc.description}</ItemDescription>}
      </ItemContent>
      <ItemActions>
        <Button
          variant="tonal"
          size="icon"
          aria-label={t("actions.downloadAria", { title: doc.title })}
          onClick={() => actions.onDownload(doc)}
        >
          <Icon name="download" size={22} />
        </Button>
        {actions.isManager && (
          <>
            <Button
              variant="ghost"
              size="icon"
              aria-label={t("actions.editAria", { title: doc.title })}
              onClick={() => actions.onEdit(doc)}
            >
              <Icon name="edit" size={22} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label={archived ? t("actions.restoreAria", { title: doc.title }) : t("actions.archiveAria", { title: doc.title })}
              onClick={() => actions.onArchive(doc, !archived)}
            >
              <Icon name={archived ? "unarchive" : "archive"} size={22} />
            </Button>
          </>
        )}
      </ItemActions>
    </Item>
  );
}
