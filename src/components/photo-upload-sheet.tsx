import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { FormSheet } from "@/components/manager/form-sheet";
import { StageRoomFields } from "@/features/media/ui/stage-room-fields";
import { api, type PhotoMeta } from "@/lib/api";
import { keys, useSave } from "@/lib/queries";
import type { Room, Stage } from "@/lib/database.types";

/** "Add site photos" panel: used on the Photos page and by the Overview shortcut. */
export function UploadSheet({
  projectId,
  open,
  onOpenChange,
  stages,
  rooms,
}: {
  projectId: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  stages: Stage[];
  rooms: Room[];
}) {
  const [files, setFiles] = useState<File[]>([]);
  const [stageId, setStageId] = useState("");
  const [roomId, setRoomId] = useState("");
  const [caption, setCaption] = useState("");
  const [publish, setPublish] = useState(false);
  const upload = useSave(
    projectId,
    (v: { files: File[]; meta: PhotoMeta; publish: boolean }) => api.uploadPhotos(projectId, v.files, v.meta, v.publish),
    {
      invalidate: [keys.photos(projectId)],
      success: (v) =>
        v.publish
          ? `Published ${v.files.length} photo${v.files.length > 1 ? "s" : ""}`
          : `Saved ${v.files.length} draft${v.files.length > 1 ? "s" : ""}`,
    },
  );
  const current = stages.find((s) => s.status === "progress")?.id ?? "";

  return (
    <FormSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Add site photos"
      description="Tag the stage and room so the client can filter them."
    >
      <div className="flex flex-col gap-4">
        <Field>
          <FieldLabel htmlFor="photo-files">Images</FieldLabel>
          <input
            id="photo-files"
            type="file"
            accept="image/*"
            multiple
            onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
            className="block w-full text-body-md text-on-surface-variant file:mr-3 file:h-10 file:rounded-full file:border-0 file:bg-secondary-container file:px-6 file:text-label-lg file:text-on-secondary-container"
          />
          {files.length > 0 && (
            <div className="grid grid-cols-4 gap-2">
              {files.map((f) => (
                <img key={f.name} src={URL.createObjectURL(f)} alt={f.name} className="aspect-square w-full rounded-sm object-cover" />
              ))}
            </div>
          )}
        </Field>
        <StageRoomFields
          prefix="up"
          stages={stages}
          rooms={rooms}
          stageId={stageId || current}
          roomId={roomId}
          onStage={setStageId}
          onRoom={setRoomId}
        />
        <Field>
          <FieldLabel htmlFor="up-caption">Caption</FieldLabel>
          <Textarea id="up-caption" value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="What changed today?" />
        </Field>
        <div className="flex min-h-11 items-center justify-between gap-3 rounded-md border border-outline-variant px-3">
          <FieldLabel htmlFor="up-publish" className="font-normal">
            Publish to client now
          </FieldLabel>
          <Switch id="up-publish" checked={publish} onCheckedChange={setPublish} />
        </div>
        <Button
          disabled={!files.length || upload.isPending}
          className="min-h-11 w-full"
          onClick={() =>
            upload.mutate(
              { files, meta: { stage_id: stageId || current || null, room_id: roomId || null, caption: caption.trim() }, publish },
              {
                onSuccess: () => {
                  setFiles([]);
                  setCaption("");
                  onOpenChange(false);
                },
              },
            )
          }
        >
          {upload.isPending
            ? "Uploading…"
            : `${publish ? "Publish" : "Save"} ${files.length || ""} ${publish ? "photo" : "draft"}${files.length === 1 ? "" : "s"}`}
        </Button>
      </div>
    </FormSheet>
  );
}
