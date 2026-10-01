import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Icon } from "@/components/ui/icon";
import { Button } from "@/components/ui/button";
import { PhotoFilters, type PhotoStatusFilter } from "@/features/media/ui/photo-filters";
import { PhotoGrid } from "@/features/media/ui/photo-grid";
import { PhotoEditSheet } from "@/features/media/ui/photo-edit-sheet";
import { Lightbox } from "@/features/media/ui/lightbox";
import { UploadSheet } from "@/features/media/ui/photo-upload-sheet";
import { usePhotos, useUpdatePhoto } from "@/features/media/hooks/use-photos";
import { filterPhotos, groupPhotosByDate, toLightboxItem } from "@/features/media/domain/photo-helpers";
import { useNavRole } from "@/shared/ui/nav-role";
import { useRooms, useStages } from "@/features/work/hooks";
import { PageHeader, PageLoading } from "@/components/page-header";
import { useFormat } from "@/i18n";
import type { Photo } from "@/lib/database.types";

export const Route = createFileRoute("/_authed/projects/$projectId/photos")({
  head: ({ match }) => ({
    meta: [
      { title: `${match.context.i18n.t("media:photosPage.heading")} — RenoVision` },
      { name: "description", content: match.context.i18n.t("media:photosPage.metaDescription") },
    ],
  }),
  component: PhotosPage,
});

function PhotosPage() {
  const { t } = useTranslation(["media", "common"]);
  const format = useFormat();
  const { projectId } = Route.useParams();
  const isManager = useNavRole() === "manager";
  const { data: photos, isLoading } = usePhotos(projectId);
  const { data: stages = [] } = useStages(projectId);
  const { data: rooms = [] } = useRooms(projectId);
  const [status, setStatus] = useState<PhotoStatusFilter>("all");
  const [stageId, setStageId] = useState("all");
  const [roomId, setRoomId] = useState("all");
  const [uploading, setUploading] = useState(false);
  const [editing, setEditing] = useState<Photo | null>(null);
  const [open, setOpen] = useState<number | null>(null);
  const update = useUpdatePhoto(projectId);

  const byStatus = useMemo(() => {
    const all = photos ?? [];
    return status === "all" ? all : all.filter((p) => p.status === status);
  }, [photos, status]);
  const filtered = useMemo(() => filterPhotos(byStatus, { stageId, roomId }), [byStatus, stageId, roomId]);
  const groups = useMemo(() => groupPhotosByDate(filtered), [filtered]);
  const indexById = useMemo(() => new Map(filtered.map((p, i) => [p.id, i] as const)), [filtered]);

  if (isLoading || !photos) return <PageLoading />;
  const drafts = photos.filter((p) => p.status === "draft").length;
  const stageName = (id: string | null) => stages.find((s) => s.id === id)?.name ?? t("filters.noStage");
  const roomName = (id: string | null) => rooms.find((r) => r.id === id)?.name ?? t("filters.noRoom");
  const filtering = stageId !== "all" || roomId !== "all";
  const emptyText = filtering
    ? t("photosPage.emptyFiltered")
    : status === "draft"
      ? t("photosPage.emptyDrafts")
      : isManager
        ? t("photosPage.emptyManager")
        : t("photosPage.emptyClient");

  return (
    <div className="mx-auto w-full max-w-6xl">
      <PageHeader
        title={t("photosPage.heading")}
        description={isManager ? t("photosPage.descriptionManager") : t("photosPage.descriptionClient")}
        actions={
          isManager && (
            <Button onClick={() => setUploading(true)} className="min-h-11 gap-2">
              <Icon name="add_photo_alternate" size={22} /> {t("photosPage.addPhotos")}
            </Button>
          )
        }
      />

      <div className="mt-5">
        <PhotoFilters
          isManager={isManager}
          totalCount={photos.length}
          draftCount={drafts}
          status={status}
          onStatusChange={setStatus}
          stages={stages}
          stageId={stageId}
          onStageChange={setStageId}
          rooms={rooms}
          roomId={roomId}
          onRoomChange={setRoomId}
        />
      </div>

      <div className="mt-6">
        <PhotoGrid
          groups={groups}
          emptyText={emptyText}
          isManager={isManager}
          stageName={stageName}
          roomName={roomName}
          onOpen={(p) => setOpen(indexById.get(p.id) ?? 0)}
          onTogglePublish={(p) => update.mutate({ id: p.id, patch: { status: p.status === "draft" ? "published" : "draft" } })}
          onEdit={setEditing}
        />
      </div>

      <Lightbox
        items={filtered.map((p) =>
          toLightboxItem(p, {
            fallbackTitle: t("photo.fallbackCaption"),
            subtitle: format.date(p.taken_at, "dayTime"),
            tags: [
              stageName(p.stage_id),
              roomName(p.room_id),
              ...(isManager ? [p.status === "draft" ? t("photoCard.draftTag") : t("photoCard.publishedTag")] : []),
            ],
          }),
        )}
        index={open}
        onClose={() => setOpen(null)}
      />
      {isManager && <UploadSheet projectId={projectId} open={uploading} onOpenChange={setUploading} stages={stages} rooms={rooms} />}
      {isManager && <PhotoEditSheet projectId={projectId} photo={editing} onClose={() => setEditing(null)} stages={stages} rooms={rooms} />}
    </div>
  );
}
