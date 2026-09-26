import { useState } from "react";
import { Icon } from "@/components/ui/icon";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Field, FieldLabel } from "@/components/ui/field";
import { FormSheet } from "@/components/manager/form-sheet";
import { StageRoomFields } from "@/features/media/ui/stage-room-fields";
import { api, type PhotoPatch } from "@/lib/api";
import { keys, useSave } from "@/lib/queries";
import type { Photo, Room, Stage } from "@/lib/database.types";

/** Manager sheet: edit a photo's caption, alt text, stage and room, or delete it. */
export function PhotoEditSheet({
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
        <div className="flex flex-col gap-4">
          {photo.url && <img src={photo.url} alt={photo.alt} className="aspect-[4/3] w-full rounded-md object-cover" />}
          <Field>
            <FieldLabel htmlFor="ed-caption">Caption</FieldLabel>
            <Textarea id="ed-caption" value={draft.caption} onChange={(e) => setDraft({ ...draft, caption: e.target.value })} />
          </Field>
          <Field>
            <FieldLabel htmlFor="ed-alt">Image description (for screen readers)</FieldLabel>
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
