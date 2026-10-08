import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Icon } from "@/components/ui/icon";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { FormSheet } from "@/shared/ui/form-sheet";
import { FormField } from "@/shared/ui/form-field";
import { useZodForm } from "@/shared/hooks/use-zod-form";
import { useConfirm } from "@/shared/ui/use-confirm";
import { StageRoomFields } from "@/features/media/ui/stage-room-fields";
import { photoEditSchema, resolveTaskId } from "@/features/media/domain/schemas";
import { useDeletePhoto, useUpdatePhoto } from "@/features/media/hooks/use-photos";
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
  const { t } = useTranslation(["media", "common"]);
  const confirm = useConfirm();
  const form = useZodForm(photoEditSchema, { caption: "", alt: "", stageId: "", taskId: "", roomId: "" });
  const [lastId, setLastId] = useState<string | null>(null);
  useEffect(() => {
    if (photo && photo.id !== lastId) {
      setLastId(photo.id);
      form.reset({
        caption: photo.caption,
        alt: photo.alt,
        stageId: photo.stage_id ?? "",
        taskId: photo.task_id ?? "",
        roomId: photo.room_id ?? "",
      });
    }
  }, [photo, lastId, form]);

  const update = useUpdatePhoto(projectId);
  const remove = useDeletePhoto(projectId);

  const submit = form.handleSubmit((values) => {
    if (!photo) return;
    update.mutate(
      {
        id: photo.id,
        patch: {
          caption: values.caption,
          alt: values.alt,
          stage_id: values.stageId || null,
          task_id: resolveTaskId(stages, values.stageId, values.taskId),
          room_id: values.roomId || null,
        },
      },
      { onSuccess: onClose },
    );
  });

  return (
    <FormSheet
      open={!!photo}
      onOpenChange={(v) => {
        if (!v) {
          onClose();
          setLastId(null);
        }
      }}
      title={t("photoEditSheet.title")}
    >
      {photo && (
        <form noValidate onSubmit={submit} className="flex flex-col gap-4">
          {photo.url && <img src={photo.url} alt={photo.alt} className="aspect-[4/3] w-full rounded-md object-cover" />}
          <FormField control={form.control} name="caption" label={t("fields.caption")}>
            {(field) => <Textarea {...field} />}
          </FormField>
          <FormField control={form.control} name="alt" label={t("fields.altLabel")}>
            {(field) => <Textarea {...field} />}
          </FormField>
          <StageRoomFields control={form.control} stages={stages} rooms={rooms} />
          <Button type="submit" className="min-h-11 w-full" disabled={update.isPending}>
            {t("photoEditSheet.save")}
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="min-h-11 w-full gap-2 text-destructive"
            onClick={async () => {
              if (await confirm({ title: t("photoEditSheet.deleteConfirmTitle"), destructive: true })) {
                remove.mutate(photo, { onSuccess: onClose });
              }
            }}
          >
            <Icon name="delete" size={20} /> {t("photoEditSheet.delete")}
          </Button>
        </form>
      )}
    </FormSheet>
  );
}
