import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { FileInput } from "@/components/ui/file-input";
import { Note } from "@/components/ui/note";
import { Textarea } from "@/components/ui/textarea";
import { FormSheet, VisibleSwitch } from "@/shared/ui/form-sheet";
import { FormField } from "@/shared/ui/form-field";
import { useZodForm } from "@/shared/hooks/use-zod-form";
import { StageRoomFields } from "@/features/media/ui/stage-room-fields";
import { uploadPhotosSchema } from "@/features/media/domain/schemas";
import { isHeic } from "@/features/media/domain/upload";
import { useUploadPhotos } from "@/features/media/hooks/use-photos";
import type { Room, Stage } from "@/lib/database.types";

/** "Add site photos" panel: used on the Photos page, the Overview shortcut and the quick-actions FAB. */
export function UploadSheet({
  projectId,
  open,
  onOpenChange,
  stages,
  rooms,
  capture = false,
}: {
  projectId: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  stages: Stage[];
  rooms: Room[];
  /** Opens straight to the camera on a phone (the quick-actions FAB's "Upload photo"). */
  capture?: boolean;
}) {
  const { t } = useTranslation(["media", "common"]);
  const current = stages.find((s) => s.status === "progress")?.id ?? "";
  const form = useZodForm(uploadPhotosSchema, { files: [], stageId: current, roomId: "", caption: "", publish: false });
  const upload = useUploadPhotos(projectId);
  const files = form.watch("files");
  const publish = form.watch("publish");
  const setPublish = (v: boolean) => form.setValue("publish", v);

  const submit = form.handleSubmit((values) =>
    upload.mutate(
      {
        files: values.files,
        meta: { stage_id: values.stageId || null, room_id: values.roomId || null, caption: values.caption.trim() },
        publish: values.publish,
      },
      {
        onSuccess: () => {
          form.reset({ files: [], stageId: current, roomId: "", caption: "", publish: false });
          onOpenChange(false);
        },
      },
    ),
  );

  return (
    <FormSheet open={open} onOpenChange={onOpenChange} title={t("uploadSheet.title")} description={t("uploadSheet.description")}>
      <form noValidate onSubmit={submit} className="flex flex-col gap-4">
        <FormField control={form.control} name="files" label={t("uploadSheet.images")}>
          {(field) => (
            <div className="flex flex-col gap-3">
              <FileInput
                id={field.id}
                accept="image/*"
                multiple
                capture={capture ? "environment" : undefined}
                aria-invalid={field["aria-invalid"]}
                aria-describedby={field["aria-describedby"]}
                onChange={(e) => field.onChange(Array.from(e.target.files ?? []))}
              />
              {files.length > 0 && (
                <div className="grid grid-cols-4 gap-2">
                  {files.map((f) => (
                    <img key={f.name} src={URL.createObjectURL(f)} alt={f.name} className="aspect-square w-full rounded-sm object-cover" />
                  ))}
                </div>
              )}
              {files.some((f) => isHeic(f.type)) && <Note size="sm">{t("upload.heicNotice")}</Note>}
            </div>
          )}
        </FormField>
        <StageRoomFields control={form.control} stages={stages} rooms={rooms} />
        <FormField control={form.control} name="caption" label={t("fields.caption")}>
          {(field) => <Textarea {...field} placeholder={t("uploadSheet.captionPlaceholder")} />}
        </FormField>
        <VisibleSwitch id="up-publish" checked={publish} onChange={setPublish} label={t("uploadSheet.publishNow")} />
        <Button type="submit" disabled={!files.length || upload.isPending} className="min-h-11 w-full">
          {upload.isPending
            ? t("uploadSheet.uploading")
            : publish
              ? t("uploadSheet.submitPublish", { count: files.length })
              : t("uploadSheet.submitSave", { count: files.length })}
        </Button>
      </form>
    </FormSheet>
  );
}
