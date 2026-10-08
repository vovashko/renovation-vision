import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { focusRingInset } from "@/components/ui/focus-ring";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";
import { canPreviewImage, fileTypeLabel, isNewDocument, type RoomGallery } from "@/features/documents/domain/documents";
import type { DocumentActions } from "@/features/documents/ui/document-item";
import { useFormat } from "@/i18n";
import type { ProjectDocument } from "@/lib/database.types";

/** One installation photo: thumbnail (opens the download), title, date, the work it documents and the manager actions. */
function PhotoTile({
  doc,
  taskName,
  actions,
  now,
}: {
  doc: ProjectDocument;
  taskName: string | null;
  actions: DocumentActions;
  now?: Date;
}) {
  const { t } = useTranslation(["documents"]);
  const format = useFormat();
  const archived = !!doc.archived_at;
  return (
    <Card data-testid="gallery-photo" className={cn("overflow-hidden", archived && "border-dashed opacity-80")}>
      <button
        className={cn("relative block w-full", focusRingInset)}
        aria-label={t("actions.downloadAria", { title: doc.title })}
        onClick={() => actions.onDownload(doc)}
      >
        {doc.url && canPreviewImage(doc.mime_type) ? (
          <img src={doc.url} alt={doc.title} loading="lazy" width={1024} height={768} className="aspect-[4/3] w-full object-cover" />
        ) : (
          <div className="grid aspect-[4/3] w-full place-items-center bg-surface-container-high">
            <span className="flex items-center gap-1 text-body-sm text-on-surface-variant">
              <Icon name="image" size={24} /> {fileTypeLabel(doc.mime_type, doc.file_name)}
            </span>
          </div>
        )}
        {isNewDocument(doc.created_at, now) && !archived && (
          <Badge variant="scrim" icon={null} size="compact" className="absolute top-3 left-3">
            {t("item.new")}
          </Badge>
        )}
      </button>
      <CardContent className="flex flex-col gap-2 pt-4">
        <p className="text-label-lg break-words">{doc.title}</p>
        <p className="text-body-sm text-on-surface-variant">{format.date(doc.created_at, "long")}</p>
        {doc.description && <p className="text-body-md">{doc.description}</p>}
        <div className="flex flex-wrap gap-2">
          {taskName && (
            <Badge variant="secondary" size="compact" icon="construction">
              {taskName}
            </Badge>
          )}
          {archived && (
            <Badge variant="outline" size="compact" icon="inventory_2">
              {t("item.archived")}
            </Badge>
          )}
        </div>
        {actions.isManager && (
          <div className="flex gap-1">
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
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/** Installation photos before they are covered up, as a gallery grouped by room. */
export function InstallationGallery({
  galleries,
  roomName,
  taskName,
  actions,
  now,
}: {
  galleries: RoomGallery[];
  roomName: (id: string | null) => string;
  taskName: (id: string | null) => string | null;
  actions: DocumentActions;
  now?: Date;
}) {
  return (
    <div className="flex flex-col gap-8">
      {galleries.map((g) => {
        const label = roomName(g.roomId);
        return (
          <section key={g.roomId ?? "none"} aria-label={label} className="flex flex-col gap-3">
            <h2 className="flex items-center gap-2 text-label-lg text-on-surface-variant">
              <Icon name="meeting_room" size={20} /> {label}
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {g.photos.map((doc) => (
                <PhotoTile key={doc.id} doc={doc} taskName={taskName(doc.task_id)} actions={actions} now={now} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
