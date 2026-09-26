import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Icon } from "@/components/ui/icon";
import { Button } from "@/components/ui/button";
import { PhotoFilters, type PhotoStatusFilter } from "@/features/media/ui/photo-filters";
import { PhotoGrid } from "@/features/media/ui/photo-grid";
import { PhotoEditSheet } from "@/features/media/ui/photo-edit-sheet";
import { Lightbox } from "@/components/lightbox";
import { UploadSheet } from "@/components/photo-upload-sheet";
import { useAuth } from "@/lib/auth";
import { PageHeader, PageLoading } from "@/components/page-header";
import { api, type PhotoPatch } from "@/lib/api";
import { keys, usePhotos, useRooms, useSave, useStages } from "@/lib/queries";
import { filterPhotos, groupPhotosByDate, toLightboxItem } from "@/lib/photo-helpers";
import type { Photo } from "@/lib/database.types";

export const Route = createFileRoute("/projects/$projectId/photos")({
  head: () => ({
    meta: [
      { title: "Site photos — RenoVision" },
      { name: "description", content: "Upload site photos, keep drafts private and publish them to the client." },
    ],
  }),
  component: PhotosPage,
});

function PhotosPage() {
  const { projectId } = Route.useParams();
  const isManager = useAuth().profile?.account_type === "manager";
  const { data: photos, isLoading } = usePhotos(projectId);
  const { data: stages = [] } = useStages(projectId);
  const { data: rooms = [] } = useRooms(projectId);
  const [status, setStatus] = useState<PhotoStatusFilter>("all");
  const [stageId, setStageId] = useState("all");
  const [roomId, setRoomId] = useState("all");
  const [uploading, setUploading] = useState(false);
  const [editing, setEditing] = useState<Photo | null>(null);
  const [open, setOpen] = useState<number | null>(null);
  const inv = { invalidate: [keys.photos(projectId), keys.renders(projectId)] };
  const update = useSave(projectId, ({ id, patch }: { id: string; patch: PhotoPatch }) => api.updatePhoto(id, patch), {
    ...inv,
    success: ({ patch }) =>
      patch.status === "published"
        ? "Published — the client can see it now"
        : patch.status === "draft"
          ? "Moved back to drafts"
          : "Photo updated",
  });

  const byStatus = useMemo(() => {
    const all = photos ?? [];
    return status === "all" ? all : all.filter((p) => p.status === status);
  }, [photos, status]);
  const filtered = useMemo(() => filterPhotos(byStatus, { stageId, roomId }), [byStatus, stageId, roomId]);
  const groups = useMemo(() => groupPhotosByDate(filtered), [filtered]);
  const indexById = useMemo(() => new Map(filtered.map((p, i) => [p.id, i] as const)), [filtered]);

  if (isLoading || !photos) return <PageLoading />;
  const drafts = photos.filter((p) => p.status === "draft").length;
  const stageName = (id: string | null) => stages.find((s) => s.id === id)?.name ?? "No stage";
  const roomName = (id: string | null) => rooms.find((r) => r.id === id)?.name ?? "No room";
  const filtering = stageId !== "all" || roomId !== "all";
  const emptyText = filtering
    ? "No photos match this filter."
    : status === "draft"
      ? "No drafts — everything is published."
      : isManager
        ? "No photos yet. Add today's progress."
        : "No photos yet. Your site manager will share progress photos here.";

  return (
    <div className="mx-auto w-full max-w-6xl">
      <PageHeader
        title="Site photos"
        description={
          isManager
            ? "Uploads start as private drafts. Publish when they're ready for the client."
            : "Progress photos from your site manager."
        }
        actions={
          isManager && (
            <Button onClick={() => setUploading(true)} className="min-h-11 gap-2">
              <Icon name="add_photo_alternate" size={22} /> Add photos
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
          toLightboxItem(p, [
            stageName(p.stage_id),
            roomName(p.room_id),
            ...(isManager ? [p.status === "draft" ? "Draft" : "Published"] : []),
          ]),
        )}
        index={open}
        onClose={() => setOpen(null)}
      />
      {isManager && <UploadSheet projectId={projectId} open={uploading} onOpenChange={setUploading} stages={stages} rooms={rooms} />}
      {isManager && <PhotoEditSheet projectId={projectId} photo={editing} onClose={() => setEditing(null)} stages={stages} rooms={rooms} />}
    </div>
  );
}
