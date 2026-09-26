import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Camera, EyeOff, ImagePlus, Pencil, Send, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { FilterChips } from "@/components/filter-chips";
import { Lightbox } from "@/components/lightbox";
import { EmptyState } from "@/components/empty-state";
import { Field, FormSheet, selectCls } from "@/components/manager/form-sheet";
import { useAuth } from "@/lib/auth";
import { PageHeader, PageLoading } from "@/components/page-header";
import { api, type PhotoMeta, type PhotoPatch } from "@/lib/api";
import { keys, usePhotos, useRooms, useSave, useStages } from "@/lib/queries";
import { dateTime } from "@/lib/format";
import type { Photo, Room, Stage } from "@/lib/database.types";

export const Route = createFileRoute("/projects/$projectId/photos")({
  head: () => ({
    meta: [
      { title: "Site photos — RenoTrack" },
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
    <div className="mx-auto w-full max-w-5xl">
      <PageHeader
        title="Site photos"
        description={isManager ? "Uploads start as private drafts. Publish when they're ready for the client." : "Progress photos from your site manager."}
        actions={isManager && <Button onClick={() => setUploading(true)} className="min-h-11 gap-2"><ImagePlus className="h-4 w-4" /> Add photos</Button>}
      />
      {isManager && <div className="mt-5">
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
      </div>}

      {filtered.length === 0 ? (
        <EmptyState className="mt-6" icon={Camera} text={filter === "draft" ? "No drafts — everything is published." : isManager ? "No photos yet. Add today's progress." : "No photos yet. Your site manager will share progress photos here."} />
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
                {isManager && p.status === "draft" && (
                  <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-foreground/70 px-2.5 py-1 text-xs font-medium text-background">
                    <EyeOff className="h-3.5 w-3.5" /> Draft — client can't see
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
                {isManager && <div className="mt-3 flex gap-2">
                  {p.status === "draft" ? (
                    <Button size="sm" className="min-h-9 flex-1 gap-1.5" onClick={() => update.mutate({ id: p.id, patch: { status: "published" } })}><Send className="h-3.5 w-3.5" /> Publish</Button>
                  ) : (
                    <Button size="sm" variant="outline" className="min-h-9 flex-1" onClick={() => update.mutate({ id: p.id, patch: { status: "draft" } })}>Unpublish</Button>
                  )}
                  <Button size="icon" variant="ghost" className="h-9 w-9" onClick={() => setEditing(p)} aria-label="Edit photo"><Pencil className="h-4 w-4" /></Button>
                </div>}
              </div>
            </article>
          ))}
        </div>
      )}

      <Lightbox
        items={filtered.map((p) => ({ src: p.url, alt: p.alt, title: p.caption, subtitle: dateTime(p.taken_at), tags: [stageName(p.stage_id), roomName(p.room_id), ...(isManager ? [p.status === "draft" ? "Draft" : "Published"] : [])] }))}
        index={open}
        onClose={() => setOpen(null)}
      />
      {isManager && <UploadSheet projectId={projectId} open={uploading} onOpenChange={setUploading} stages={stages} rooms={rooms} />}
      {isManager && <EditSheet projectId={projectId} photo={editing} onClose={() => setEditing(null)} stages={stages} rooms={rooms} />}
    </div>
  );
}

function StageRoomFields({ prefix, stages, rooms, stageId, roomId, onStage, onRoom }: { prefix: string; stages: Stage[]; rooms: Room[]; stageId: string; roomId: string; onStage: (v: string) => void; onRoom: (v: string) => void }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <Field id={`${prefix}-stage`} label="Stage">
        <select id={`${prefix}-stage`} value={stageId} onChange={(e) => onStage(e.target.value)} className={selectCls}>
          <option value="">—</option>
          {stages.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </Field>
      <Field id={`${prefix}-room`} label="Room">
        <select id={`${prefix}-room`} value={roomId} onChange={(e) => onRoom(e.target.value)} className={selectCls}>
          <option value="">—</option>
          {rooms.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select>
      </Field>
    </div>
  );
}

function UploadSheet({ projectId, open, onOpenChange, stages, rooms }: { projectId: string; open: boolean; onOpenChange: (v: boolean) => void; stages: Stage[]; rooms: Room[] }) {
  const [files, setFiles] = useState<File[]>([]);
  const [stageId, setStageId] = useState("");
  const [roomId, setRoomId] = useState("");
  const [caption, setCaption] = useState("");
  const [publish, setPublish] = useState(false);
  const upload = useSave(projectId, (v: { files: File[]; meta: PhotoMeta; publish: boolean }) => api.uploadPhotos(projectId, v.files, v.meta, v.publish), {
    invalidate: [keys.photos(projectId)],
    success: (v) => (v.publish ? `Published ${v.files.length} photo${v.files.length > 1 ? "s" : ""}` : `Saved ${v.files.length} draft${v.files.length > 1 ? "s" : ""}`),
  });
  const current = stages.find((s) => s.status === "progress")?.id ?? "";

  return (
    <FormSheet open={open} onOpenChange={onOpenChange} title="Add site photos" description="Tag the stage and room so the client can filter them.">
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="photo-files">Images</Label>
          <input id="photo-files" type="file" accept="image/*" multiple onChange={(e) => setFiles(Array.from(e.target.files ?? []))} className="block w-full text-sm file:mr-3 file:min-h-11 file:rounded-md file:border-0 file:bg-muted file:px-4 file:text-sm file:font-medium" />
          {files.length > 0 && (
            <div className="grid grid-cols-4 gap-2">
              {files.map((f) => <img key={f.name} src={URL.createObjectURL(f)} alt={f.name} className="aspect-square w-full rounded-md object-cover" />)}
            </div>
          )}
        </div>
        <StageRoomFields prefix="up" stages={stages} rooms={rooms} stageId={stageId || current} roomId={roomId} onStage={setStageId} onRoom={setRoomId} />
        <Field id="up-caption" label="Caption">
          <Textarea id="up-caption" value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="What changed today?" />
        </Field>
        <div className="flex min-h-11 items-center justify-between gap-3 rounded-md border px-3">
          <Label htmlFor="up-publish" className="font-normal">Publish to client now</Label>
          <Switch id="up-publish" checked={publish} onCheckedChange={setPublish} />
        </div>
        <Button
          disabled={!files.length || upload.isPending}
          className="min-h-11 w-full"
          onClick={() =>
            upload.mutate(
              { files, meta: { stage_id: (stageId || current) || null, room_id: roomId || null, caption: caption.trim() }, publish },
              { onSuccess: () => { setFiles([]); setCaption(""); onOpenChange(false); } },
            )
          }
        >
          {upload.isPending ? "Uploading…" : `${publish ? "Publish" : "Save"} ${files.length || ""} ${publish ? "photo" : "draft"}${files.length === 1 ? "" : "s"}`}
        </Button>
      </div>
    </FormSheet>
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
            <Trash2 className="h-4 w-4" /> Delete photo
          </Button>
        </div>
      )}
    </FormSheet>
  );
}
