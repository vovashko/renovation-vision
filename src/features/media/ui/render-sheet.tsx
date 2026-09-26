import { useState } from "react";
import { Icon } from "@/components/ui/icon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field, FieldLabel } from "@/components/ui/field";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { FormSheet, VisibleSwitch } from "@/components/manager/form-sheet";
import { api, type RenderInput } from "@/lib/api";
import { keys, useSave } from "@/lib/queries";
import type { Photo, Render, Room } from "@/lib/database.types";

type RenderForm = {
  title: string;
  description: string;
  alt: string;
  room_id: string;
  compare_photo_id: string;
  is_visible: boolean;
  file: File | null;
};

/** Manager sheet: add or edit a design render, including the optional before/after site photo. */
export function RenderSheet({
  projectId,
  render,
  rooms,
  photos,
  onClose,
}: {
  projectId: string;
  render: Render | "new" | null;
  rooms: Room[];
  photos: Photo[];
  onClose: () => void;
}) {
  const isNew = render === "new";
  const [form, setForm] = useState<RenderForm | null>(null);
  const [lastKey, setLastKey] = useState<string | null>(null);
  const key = render === null ? null : isNew ? "new" : render.id;
  if (key !== lastKey) {
    setLastKey(key);
    setForm(
      render === null
        ? null
        : isNew
          ? { title: "", description: "", alt: "", room_id: "", compare_photo_id: "", is_visible: false, file: null }
          : {
              title: render.title,
              description: render.description,
              alt: render.alt,
              room_id: render.room_id ?? "",
              compare_photo_id: render.compare_photo_id ?? "",
              is_visible: render.is_visible,
              file: null,
            },
    );
  }
  const inv = { invalidate: [keys.renders(projectId)] };
  const save = useSave(projectId, (r: RenderInput) => api.saveRender(projectId, r), { ...inv, success: "Render saved" });
  const remove = useSave(projectId, (r: Render) => api.deleteRender(r), { ...inv, success: "Render deleted" });
  const roomPhotos = photos.filter((p) => !form?.room_id || p.room_id === form.room_id);

  return (
    <FormSheet
      open={render !== null}
      onOpenChange={(v) => !v && onClose()}
      title={isNew ? "Add render" : "Edit render"}
      description="New renders stay hidden until you share them."
    >
      {form && (
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate(
              {
                ...(isNew ? { sort_order: 100 } : { id: (render as Render).id }),
                title: form.title,
                description: form.description,
                alt: form.alt || form.title,
                room_id: form.room_id || null,
                compare_photo_id: form.compare_photo_id || null,
                is_visible: form.is_visible,
                file: form.file,
              },
              { onSuccess: onClose },
            );
          }}
        >
          <Field>
            <FieldLabel htmlFor="rn-file">{isNew ? "Image" : "Replace image (optional)"}</FieldLabel>
            <input
              id="rn-file"
              type="file"
              accept="image/*"
              required={isNew}
              onChange={(e) => setForm({ ...form, file: e.target.files?.[0] ?? null })}
              className="block w-full text-body-md text-on-surface-variant file:mr-3 file:h-10 file:rounded-full file:border-0 file:bg-secondary-container file:px-6 file:text-label-lg file:text-on-secondary-container"
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="rn-title">Title</FieldLabel>
            <Input id="rn-title" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </Field>
          <Field>
            <FieldLabel htmlFor="rn-desc">Description</FieldLabel>
            <Textarea
              id="rn-desc"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Materials, colours, fixtures."
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="rn-alt">Image description (for screen readers)</FieldLabel>
            <Input id="rn-alt" value={form.alt} onChange={(e) => setForm({ ...form, alt: e.target.value })} />
          </Field>
          <Field>
            <FieldLabel htmlFor="rn-room">Room</FieldLabel>
            <NativeSelect
              id="rn-room"
              value={form.room_id}
              onChange={(e) => setForm({ ...form, room_id: e.target.value, compare_photo_id: "" })}
            >
              <NativeSelectOption value="">—</NativeSelectOption>
              {rooms.map((r) => (
                <NativeSelectOption key={r.id} value={r.id}>
                  {r.name}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </Field>
          <Field>
            <FieldLabel htmlFor="rn-compare">Before/after: current site photo (optional)</FieldLabel>
            <NativeSelect
              id="rn-compare"
              value={form.compare_photo_id}
              onChange={(e) => setForm({ ...form, compare_photo_id: e.target.value })}
            >
              <NativeSelectOption value="">None</NativeSelectOption>
              {roomPhotos.map((p) => (
                <NativeSelectOption key={p.id} value={p.id}>
                  {p.caption.slice(0, 60) || p.id}
                  {p.status === "draft" ? " (draft)" : ""}
                </NativeSelectOption>
              ))}
            </NativeSelect>
            <p className="text-body-sm text-on-surface-variant">Adds a slider comparing this photo with the render.</p>
          </Field>
          <VisibleSwitch
            id="rn-visible"
            checked={form.is_visible}
            onChange={(v) => setForm({ ...form, is_visible: v })}
            label="Share with client"
          />
          <Button type="submit" disabled={save.isPending || !form.title.trim() || (isNew && !form.file)} className="min-h-11 w-full">
            {save.isPending ? "Saving…" : "Save render"}
          </Button>
          {!isNew && render && (
            <Button
              type="button"
              variant="ghost"
              className="min-h-11 w-full gap-2 text-destructive"
              onClick={() => confirm("Delete this render?") && remove.mutate(render, { onSuccess: onClose })}
            >
              <Icon name="delete" size={20} /> Delete render
            </Button>
          )}
        </form>
      )}
    </FormSheet>
  );
}
