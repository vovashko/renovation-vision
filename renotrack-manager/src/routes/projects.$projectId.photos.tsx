import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Icon } from "@/components/ui/icon";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { FilterChips } from "@/components/ui/filter-chips";
import { Lightbox } from "@/components/ui/lightbox";
import { EmptyState } from "@/components/ui/empty-state";
import { Field, FormSheet } from "@/components/form-sheet";
import { StageRoomFields, UploadSheet } from "@/components/photo-upload-sheet";
import { PageHeader, PageLoading } from "@/components/page-header";
import { api, type PhotoPatch } from "@/lib/api";
import { keys, usePhotos, useRooms, useSave, useStages } from "@/lib/queries";
import { dateTime } from "@/lib/format";
import type { Photo, Room, Stage } from "@/lib/database.types";

export const Route = createFileRoute("/projects/$projectId/photos")({
  head: () => ({
    meta: [
      { title: "Site photos — RenoTrack Manager" },
      { name: "description", content: "Upload site photos, keep drafts private and publish them to the client." },
    ],
  }),
  component: PhotosPage,
});

function PhotosPage() {
  const { projectId } = Route.useParams();
  const { data: photos, isLoading } = usePhotos(projectId);
  const { data: stages = [] } = useStages(projectId);
  const { data: rooms = [] } = useRooms(projectId);
  const [filter, setFilter] = useState<"all" | "draft" | "published">("all");
  const [uploading, setUploading] = useState(false);
  const [editing, setEditing] = useState<Photo | null>(null);
  const [open, setOpen] = useState<number | null>(null);
  const inv = { invalidate: [keys.photos(projectId), keys.renders(projectId)] };
  const update = useSave(projectId, ({ id, patch }: { id: string; patch: PhotoPatch }) => api.updatePhoto(id, patch), {
    ...inv,
    success: ({ patch }) => (patch.status === "published" ? "Published — the client can see it now" : patch.status === "draft" ? "Moved back to drafts" : "Photo updated"),
  });

  const filtered = useMemo(() => (photos ?? []).filter((p) => filter === "all" || p.status === filter), [photos, filter]);
  if (isLoading || !photos) return <PageLoading />;
  const drafts = photos.filter((p) => p.status === "draft").length;
  const stageName = (id: string | null) => stages.find((s) => s.id === id)?.name ?? "No stage";
  const roomName = (id: string | null) => rooms.find((r) => r.id === id)?.name ?? "No room";

  return (
    <div className="mx-auto w-full max-w-7xl">
      <PageHeader
        title="Site photos"
        description="Uploads start as private drafts. Publish when they're ready for the client."
        actions={<Button onClick={() => setUploading(true)} className="min-h-11 gap-2"><Icon name="add_photo_alternate" size={20} /> Add photos</Button>}
      />
      <div className="mt-5">
        <FilterChips
          label="Filter photos"
          value={filter}
          onChange={(v) => setFilter(v as typeof filter)}
          options={[
            { value: "all", label: `All (${photos.length})` },
            { value: "draft", label: `Drafts (${drafts})` },
            { value: "published", label: `Published (${photos.length - drafts})` },
          ]}
        />
      </div>

      {filtered.length === 0 ? (
        <EmptyState className="mt-6" icon="photo_camera" text={filter === "draft" ? "No drafts — everything is published." : "No photos yet. Add today's progress."} />
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((p, i) => (
            <article key={p.id} className={`overflow-hidden rounded-xl border bg-card shadow-[var(--shadow-soft)] ${p.status === "draft" ? "border-dashed" : ""}`}>
              <button onClick={() => setOpen(i)} className="relative block w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label={`Open photo: ${p.caption}`}>
                {p.url ? (
                  <img src={p.url} alt={p.alt} loading="lazy" width={1024} height={768} className="aspect-[4/3] w-full object-cover" />
                ) : (
                  <div className="flex aspect-[4/3] w-full items-center justify-center bg-muted text-xs text-muted-foreground">File missing</div>
                )}
                {p.status === "draft" && (
                  <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-foreground/70 px-2.5 py-1 text-xs font-medium text-background">
                    <Icon name="visibility_off" size={18} /> Draft — client can't see
                  </span>
                )}
              </button>
              <div className="p-4">
                <p className="text-sm">{p.caption || <span className="text-muted-foreground">No caption</span>}</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <span className="rounded-full bg-accent px-2.5 py-0.5 text-xs font-medium text-accent-foreground">{stageName(p.stage_id)}</span>
                  <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium">{roomName(p.room_id)}</span>
                </div>
                <div className="mt-2 text-xs text-muted-foreground">{dateTime(p.taken_at)}</div>
                <div className="mt-3 flex gap-2">
                  {p.status === "draft" ? (
                    <Button size="sm" className="min-h-9 flex-1 gap-1.5" onClick={() => update.mutate({ id: p.id, patch: { status: "published" } })}><Icon name="send" size={18} /> Publish</Button>
                  ) : (
                    <Button size="sm" variant="outline" className="min-h-9 flex-1" onClick={() => update.mutate({ id: p.id, patch: { status: "draft" } })}>Unpublish</Button>
                  )}
                  <Button size="icon" variant="ghost" className="h-9 w-9" onClick={() => setEditing(p)} aria-label="Edit photo"><Icon name="edit" size={20} /></Button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      <Lightbox
        items={filtered.map((p) => ({ src: p.url, alt: p.alt, title: p.caption, subtitle: dateTime(p.taken_at), tags: [stageName(p.stage_id), roomName(p.room_id), p.status === "draft" ? "Draft" : "Published"] }))}
        index={open}
        onClose={() => setOpen(null)}
      />
      <UploadSheet projectId={projectId} open={uploading} onOpenChange={setUploading} stages={stages} rooms={rooms} />
      <EditSheet projectId={projectId} photo={editing} onClose={() => setEditing(null)} stages={stages} rooms={rooms} />
    </div>
  );
}

function EditSheet({ projectId, photo, onClose, stages, rooms }: { projectId: string; photo: Photo | null; onClose: () => void; stages: Stage[]; rooms: Room[] }) {
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
    <FormSheet open={!!photo} onOpenChange={(v) => { if (!v) { onClose(); setLastId(null); } }} title="Edit photo">
      {photo && draft && (
        <div className="space-y-4">
          {photo.url && <img src={photo.url} alt={photo.alt} className="aspect-[4/3] w-full rounded-lg object-cover" />}
          <Field id="ed-caption" label="Caption"><Textarea id="ed-caption" value={draft.caption} onChange={(e) => setDraft({ ...draft, caption: e.target.value })} /></Field>
          <Field id="ed-alt" label="Image description (for screen readers)"><Textarea id="ed-alt" value={draft.alt} onChange={(e) => setDraft({ ...draft, alt: e.target.value })} /></Field>
          <StageRoomFields prefix="ed" stages={stages} rooms={rooms} stageId={draft.stage_id} roomId={draft.room_id} onStage={(v) => setDraft({ ...draft, stage_id: v })} onRoom={(v) => setDraft({ ...draft, room_id: v })} />
          <Button
            className="min-h-11 w-full"
            disabled={update.isPending}
            onClick={() => update.mutate({ caption: draft.caption, alt: draft.alt, stage_id: draft.stage_id || null, room_id: draft.room_id || null }, { onSuccess: onClose })}
          >
            Save changes
          </Button>
          <Button variant="ghost" className="min-h-11 w-full gap-2 text-destructive" onClick={() => confirm("Delete this photo for everyone?") && remove.mutate(photo, { onSuccess: onClose })}>
            <Icon name="delete" size={20} /> Delete photo
          </Button>
        </div>
      )}
    </FormSheet>
  );
}
