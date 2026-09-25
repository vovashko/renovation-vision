import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Icon } from "@/components/ui/icon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { BeforeAfter } from "@/components/ui/before-after";
import { EmptyState } from "@/components/ui/empty-state";
import { Field, FormSheet, selectCls, VisibleSwitch } from "@/components/form-sheet";
import { PageHeader, PageLoading } from "@/components/page-header";
import { VisibilityBadge } from "@/components/visibility-badge";
import { api, type RenderInput } from "@/lib/api";
import { keys, usePhotos, useRenders, useRooms, useSave } from "@/lib/queries";
import type { Photo, Render, Room } from "@/lib/database.types";

export const Route = createFileRoute("/projects/$projectId/design")({
  head: () => ({
    meta: [
      { title: "Design renders — RenoTrack Manager" },
      { name: "description", content: "Upload design renders and before/after pairs for each room." },
    ],
  }),
  component: DesignPage,
});

function DesignPage() {
  const { projectId } = Route.useParams();
  const { data: renders, isLoading } = useRenders(projectId);
  const { data: rooms = [] } = useRooms(projectId);
  const { data: photos = [] } = usePhotos(projectId);
  const [editing, setEditing] = useState<Render | "new" | null>(null);
  const toggle = useSave(projectId, (r: Render) => api.saveRender(projectId, { id: r.id, is_visible: !r.is_visible }), {
    invalidate: [keys.renders(projectId)],
    success: (r) => (r.is_visible ? "Hidden from the client" : "Shared with the client"),
  });

  if (isLoading || !renders) return <PageLoading />;
  const compare = renders.find((r) => r.compare_photo_id && photos.some((p) => p.id === r.compare_photo_id));
  const comparePhoto = photos.find((p) => p.id === compare?.compare_photo_id);
  const groups: { room: Room | null; items: Render[] }[] = [
    ...rooms.map((room) => ({ room, items: renders.filter((r) => r.room_id === room.id) })),
    { room: null, items: renders.filter((r) => !r.room_id) },
  ].filter((g) => g.room || g.items.length);

  return (
    <div className="mx-auto w-full max-w-7xl">
      <PageHeader
        title="Planned design"
        description="Renders show the client how each room will look when finished."
        actions={<Button onClick={() => setEditing("new")} className="min-h-11 gap-2"><Icon name="add_photo_alternate" size={20} /> Add render</Button>}
      />

      {compare && comparePhoto && (
        <section className="mt-6">
          <h2 className="text-lg font-semibold">{rooms.find((r) => r.id === compare.room_id)?.name ?? compare.title}: now vs. planned</h2>
          <p className="mb-3 text-sm text-muted-foreground">
            The client sees this slider on their Design page{compare.is_visible && comparePhoto.status === "published" ? "." : " once both the render and the photo are shared."}
          </p>
          <div className="max-w-3xl"><BeforeAfter before={comparePhoto.url} after={compare.url} label={compare.title} /></div>
        </section>
      )}

      {renders.length === 0 && <EmptyState className="mt-6" icon="palette" title="No renders yet" text="Add the designer's renders so the client can see the finished look." />}

      <div className="mt-8 space-y-8">
        {groups.map((g) => (
          <section key={g.room?.id ?? "none"} aria-label={g.room?.name ?? "No room"}>
            <h2 className="mb-3 text-lg font-semibold">{g.room?.name ?? "Not linked to a room"}</h2>
            {g.items.length === 0 ? (
              <div className="flex items-center gap-3 rounded-xl border border-dashed bg-card p-5 text-sm text-muted-foreground">
                <Icon name="palette" size={22} className="shrink-0" /> The client sees "Renders for {g.room?.name} are still being prepared by the designer."
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {g.items.map((r) => (
                  <article key={r.id} className={`overflow-hidden rounded-xl border bg-card shadow-[var(--shadow-soft)] ${r.is_visible ? "" : "border-dashed"}`}>
                    <img src={r.url} alt={r.alt} loading="lazy" width={1024} height={768} className="aspect-[4/3] w-full object-cover" />
                    <div className="p-4">
                      <div className="font-medium">{r.title}</div>
                      <p className="mt-1 text-sm text-muted-foreground">{r.description}</p>
                      <div className="mt-3 flex items-center justify-between gap-2">
                        <VisibilityBadge visible={r.is_visible} />
                        <div className="flex items-center gap-1">
                          <Switch checked={r.is_visible} onCheckedChange={() => toggle.mutate(r)} aria-label={`Share ${r.title} with client`} />
                          <Button size="icon" variant="ghost" className="h-9 w-9" onClick={() => setEditing(r)} aria-label={`Edit ${r.title}`}><Icon name="edit" size={20} /></Button>
                        </div>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        ))}
      </div>

      <RenderSheet projectId={projectId} render={editing} rooms={rooms} photos={photos} onClose={() => setEditing(null)} />
    </div>
  );
}

type RenderForm = { title: string; description: string; alt: string; room_id: string; compare_photo_id: string; is_visible: boolean; file: File | null };

function RenderSheet({ projectId, render, rooms, photos, onClose }: { projectId: string; render: Render | "new" | null; rooms: Room[]; photos: Photo[]; onClose: () => void }) {
  const isNew = render === "new";
  const [form, setForm] = useState<RenderForm | null>(null);
  const [lastKey, setLastKey] = useState<string | null>(null);
  const key = render === null ? null : isNew ? "new" : render.id;
  if (key !== lastKey) {
    setLastKey(key);
    setForm(
      render === null ? null
        : isNew ? { title: "", description: "", alt: "", room_id: "", compare_photo_id: "", is_visible: false, file: null }
        : { title: render.title, description: render.description, alt: render.alt, room_id: render.room_id ?? "", compare_photo_id: render.compare_photo_id ?? "", is_visible: render.is_visible, file: null },
    );
  }
  const inv = { invalidate: [keys.renders(projectId)] };
  const save = useSave(projectId, (r: RenderInput) => api.saveRender(projectId, r), { ...inv, success: "Render saved" });
  const remove = useSave(projectId, (r: Render) => api.deleteRender(r), { ...inv, success: "Render deleted" });
  const roomPhotos = photos.filter((p) => !form?.room_id || p.room_id === form.room_id);

  return (
    <FormSheet open={render !== null} onOpenChange={(v) => !v && onClose()} title={isNew ? "Add render" : "Edit render"} description="New renders stay hidden until you share them.">
      {form && (
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate(
              {
                ...(isNew ? { sort_order: 100 } : { id: (render as Render).id }),
                title: form.title, description: form.description, alt: form.alt || form.title,
                room_id: form.room_id || null, compare_photo_id: form.compare_photo_id || null, is_visible: form.is_visible, file: form.file,
              },
              { onSuccess: onClose },
            );
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="rn-file">{isNew ? "Image" : "Replace image (optional)"}</Label>
            <input id="rn-file" type="file" accept="image/*" required={isNew} onChange={(e) => setForm({ ...form, file: e.target.files?.[0] ?? null })} className="block w-full text-sm file:mr-3 file:min-h-11 file:rounded-md file:border-0 file:bg-muted file:px-4 file:text-sm file:font-medium" />
          </div>
          <Field id="rn-title" label="Title"><Input id="rn-title" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="h-11" /></Field>
          <Field id="rn-desc" label="Description"><Textarea id="rn-desc" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Materials, colours, fixtures." /></Field>
          <Field id="rn-alt" label="Image description (for screen readers)"><Input id="rn-alt" value={form.alt} onChange={(e) => setForm({ ...form, alt: e.target.value })} className="h-11" /></Field>
          <Field id="rn-room" label="Room">
            <select id="rn-room" value={form.room_id} onChange={(e) => setForm({ ...form, room_id: e.target.value, compare_photo_id: "" })} className={selectCls}>
              <option value="">—</option>
              {rooms.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </Field>
          <Field id="rn-compare" label="Before/after: current site photo (optional)" hint="Adds a slider comparing this photo with the render.">
            <select id="rn-compare" value={form.compare_photo_id} onChange={(e) => setForm({ ...form, compare_photo_id: e.target.value })} className={selectCls}>
              <option value="">None</option>
              {roomPhotos.map((p) => <option key={p.id} value={p.id}>{p.caption.slice(0, 60) || p.id}{p.status === "draft" ? " (draft)" : ""}</option>)}
            </select>
          </Field>
          <VisibleSwitch id="rn-visible" checked={form.is_visible} onChange={(v) => setForm({ ...form, is_visible: v })} label="Share with client" />
          <Button type="submit" disabled={save.isPending || !form.title.trim() || (isNew && !form.file)} className="min-h-11 w-full">{save.isPending ? "Saving…" : "Save render"}</Button>
          {!isNew && render && (
            <Button type="button" variant="ghost" className="min-h-11 w-full gap-2 text-destructive" onClick={() => confirm("Delete this render?") && remove.mutate(render, { onSuccess: onClose })}>
              <Icon name="delete" size={20} /> Delete render
            </Button>
          )}
        </form>
      )}
    </FormSheet>
  );
}
