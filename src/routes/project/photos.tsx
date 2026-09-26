import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Icon } from "@/components/ui/icon";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cardVariants } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { FilterChips } from "@/components/filter-chips";
import { Lightbox } from "@/components/lightbox";
import { EmptyPhotos } from "@/components/photo-thumbs";
import { Field, FormSheet } from "@/components/manager/form-sheet";
import { StageRoomFields, UploadSheet } from "@/components/photo-upload-sheet";
import { useAuth } from "@/lib/auth";
import { PageHeader, PageLoading } from "@/components/page-header";
import { api, type PhotoPatch } from "@/lib/api";
import { keys, usePhotos, useRooms, useSave, useStages } from "@/lib/queries";
import { dateTime } from "@/lib/format";
import { filterPhotos, groupPhotosByDate, toLightboxItem } from "@/lib/photo-helpers";
import { cn } from "@/lib/utils";
import type { Photo, Room, Stage } from "@/lib/database.types";

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
  const [status, setStatus] = useState<"all" | "draft" | "published">("all");
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

      <div className="mt-5 space-y-1">
        {isManager && (
          <FilterChips
            label="Filter by status"
            value={status}
            onChange={(v) => setStatus(v as typeof status)}
            options={[
              { value: "all", label: `All (${photos.length})` },
              { value: "draft", label: `Drafts (${drafts})` },
              { value: "published", label: `Published (${photos.length - drafts})` },
            ]}
          />
        )}
        {stages.length > 0 && (
          <FilterChips
            label="Filter by stage"
            value={stageId}
            onChange={setStageId}
            options={[{ value: "all", label: "All stages" }, ...stages.map((s) => ({ value: s.id, label: s.name }))]}
          />
        )}
        {rooms.length > 0 && (
          <FilterChips
            label="Filter by room"
            value={roomId}
            onChange={setRoomId}
            options={[{ value: "all", label: "All rooms" }, ...rooms.map((r) => ({ value: r.id, label: r.name }))]}
          />
        )}
      </div>

      {filtered.length === 0 ? (
        <EmptyPhotos
          text={
            filtering
              ? "No photos match this filter."
              : status === "draft"
                ? "No drafts — everything is published."
                : isManager
                  ? "No photos yet. Add today's progress."
                  : "No photos yet. Your site manager will share progress photos here."
          }
        />
      ) : (
        <div className="mt-6 space-y-8">
          {groups.map((g) => (
            <section key={g.label} aria-label={g.label}>
              <h2 className="mb-3 text-label-lg text-on-surface-variant">{g.label}</h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {g.items.map((p) => (
                  <article
                    key={p.id}
                    className={cn(cardVariants(), "overflow-hidden p-0", isManager && p.status === "draft" && "border-dashed")}
                  >
                    <button
                      onClick={() => setOpen(indexById.get(p.id) ?? 0)}
                      className="relative block w-full focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary"
                      aria-label={`Open photo: ${p.caption || "site photo"}`}
                    >
                      {p.url ? (
                        <img
                          src={p.url}
                          alt={p.alt}
                          loading="lazy"
                          width={1024}
                          height={768}
                          className="aspect-[4/3] w-full object-cover"
                        />
                      ) : (
                        <div className="flex aspect-[4/3] w-full items-center justify-center bg-surface-container-high text-body-sm text-on-surface-variant">
                          File missing
                        </div>
                      )}
                      {isManager && p.status === "draft" && (
                        <span className="absolute top-3 left-3 flex items-center gap-1 rounded-full bg-inverse-surface px-2.5 py-1 text-label-md text-inverse-on-surface">
                          <Icon name="visibility_off" size={18} /> Draft — client can&rsquo;t see
                        </span>
                      )}
                    </button>
                    <div className="p-4">
                      <p className="text-body-md">{p.caption || <span className="text-on-surface-variant">No caption</span>}</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Badge variant="secondary" icon="construction">
                          {stageName(p.stage_id)}
                        </Badge>
                        <Badge variant="outline" icon="meeting_room">
                          {roomName(p.room_id)}
                        </Badge>
                      </div>
                      <div className="mt-3 text-body-sm text-on-surface-variant">{dateTime(p.taken_at)}</div>
                      {isManager && (
                        <div className="mt-3 flex gap-2">
                          {p.status === "draft" ? (
                            <Button
                              size="sm"
                              className="min-h-9 flex-1 gap-1.5"
                              onClick={() => update.mutate({ id: p.id, patch: { status: "published" } })}
                            >
                              <Icon name="send" size={18} /> Publish
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              className="min-h-9 flex-1"
                              onClick={() => update.mutate({ id: p.id, patch: { status: "draft" } })}
                            >
                              Unpublish
                            </Button>
                          )}
                          <Button size="icon" variant="ghost" className="h-9 w-9" onClick={() => setEditing(p)} aria-label="Edit photo">
                            <Icon name="edit" size={20} />
                          </Button>
                        </div>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

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
      {isManager && <EditSheet projectId={projectId} photo={editing} onClose={() => setEditing(null)} stages={stages} rooms={rooms} />}
    </div>
  );
}

function EditSheet({
  projectId,
  photo,
  onClose,
  stages,
  rooms,
}: {
  projectId: string;
  photo: Photo | null;
  onClose: () => void;
  stages: Stage[];
  rooms: Room[];
}) {
  const [draft, setDraft] = useState<{ caption: string; alt: string; stage_id: string; room_id: string } | null>(null);
  const [lastId, setLastId] = useState<string | null>(null);
  if (photo && photo.id !== lastId) {
    setLastId(photo.id);
    setDraft({ caption: photo.caption, alt: photo.alt, stage_id: photo.stage_id ?? "", room_id: photo.room_id ?? "" });
  }
  const inv = { invalidate: [keys.photos(projectId), keys.renders(projectId)] };
  const update = useSave(projectId, (patch: PhotoPatch) => api.updatePhoto(photo!.id, patch), { ...inv, success: "Photo updated" });
  const remove = useSave(projectId, (p: Photo) => api.deletePhoto(p), { ...inv, success: "Photo deleted" });

  return (
    <FormSheet
      open={!!photo}
      onOpenChange={(v) => {
        if (!v) {
          onClose();
          setLastId(null);
        }
      }}
      title="Edit photo"
    >
      {photo && draft && (
        <div className="space-y-4">
          {photo.url && <img src={photo.url} alt={photo.alt} className="aspect-[4/3] w-full rounded-md object-cover" />}
          <Field id="ed-caption" label="Caption">
            <Textarea id="ed-caption" value={draft.caption} onChange={(e) => setDraft({ ...draft, caption: e.target.value })} />
          </Field>
          <Field id="ed-alt" label="Image description (for screen readers)">
            <Textarea id="ed-alt" value={draft.alt} onChange={(e) => setDraft({ ...draft, alt: e.target.value })} />
          </Field>
          <StageRoomFields
            prefix="ed"
            stages={stages}
            rooms={rooms}
            stageId={draft.stage_id}
            roomId={draft.room_id}
            onStage={(v) => setDraft({ ...draft, stage_id: v })}
            onRoom={(v) => setDraft({ ...draft, room_id: v })}
          />
          <Button
            className="min-h-11 w-full"
            disabled={update.isPending}
            onClick={() =>
              update.mutate(
                { caption: draft.caption, alt: draft.alt, stage_id: draft.stage_id || null, room_id: draft.room_id || null },
                { onSuccess: onClose },
              )
            }
          >
            Save changes
          </Button>
          <Button
            variant="ghost"
            className="min-h-11 w-full gap-2 text-destructive"
            onClick={() => confirm("Delete this photo for everyone?") && remove.mutate(photo, { onSuccess: onClose })}
          >
            <Icon name="delete" size={20} /> Delete photo
          </Button>
        </div>
      )}
    </FormSheet>
  );
}
