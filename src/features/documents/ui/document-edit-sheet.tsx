import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { FormSheet } from "@/shared/ui/form-sheet";
import { FormField } from "@/shared/ui/form-field";
import { useZodForm } from "@/shared/hooks/use-zod-form";
import { editDocumentSchema } from "@/features/documents/domain/schemas";
import { useUpdateDocument } from "@/features/documents/hooks/use-documents";
import type { RoomOption, TaskOption } from "@/features/documents/ui/document-upload-sheet";
import type { ProjectDocument } from "@/lib/database.types";

/** Edit a document's title and description, and an installation photo's room and work. The file itself never changes. */
export function DocumentEditSheet({
  projectId,
  doc,
  onClose,
  rooms,
  tasks,
}: {
  projectId: string;
  doc: ProjectDocument | null;
  onClose: () => void;
  rooms: RoomOption[];
  tasks: TaskOption[];
}) {
  const { t } = useTranslation(["documents", "common"]);
  const isPhoto = doc?.category === "installation_photos";
  const form = useZodForm(editDocumentSchema(!!isPhoto), { title: "", description: "", roomId: "", taskId: "" });
  const update = useUpdateDocument(projectId);

  useEffect(() => {
    if (doc) form.reset({ title: doc.title, description: doc.description, roomId: doc.room_id ?? "", taskId: doc.task_id ?? "" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc?.id]);

  const submit = form.handleSubmit((values) => {
    if (!doc) return;
    update.mutate(
      {
        id: doc.id,
        patch: {
          title: values.title,
          description: values.description,
          ...(isPhoto ? { room_id: values.roomId || null, task_id: values.taskId || null } : {}),
        },
      },
      { onSuccess: onClose },
    );
  });

  return (
    <FormSheet open={!!doc} onOpenChange={(v) => !v && onClose()} title={t("edit.title")} description={doc?.file_name}>
      <form noValidate onSubmit={submit} className="flex flex-col gap-4">
        <FormField control={form.control} name="title" label={t("upload.titleLabel")}>
          {(field) => <Input {...field} maxLength={200} />}
        </FormField>
        <FormField control={form.control} name="description" label={t("upload.descriptionLabel")}>
          {(field) => <Textarea {...field} maxLength={2000} />}
        </FormField>
        {isPhoto && (
          <div className="grid grid-cols-2 gap-3">
            <FormField control={form.control} name="roomId" label={t("upload.room")}>
              {(field) => (
                <NativeSelect {...field}>
                  <NativeSelectOption value="">{t("upload.chooseRoom")}</NativeSelectOption>
                  {rooms.map((r) => (
                    <NativeSelectOption key={r.id} value={r.id}>
                      {r.name}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              )}
            </FormField>
            <FormField control={form.control} name="taskId" label={t("upload.work")}>
              {(field) => (
                <NativeSelect {...field}>
                  <NativeSelectOption value="">—</NativeSelectOption>
                  {tasks.map((w) => (
                    <NativeSelectOption key={w.id} value={w.id}>
                      {w.label}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              )}
            </FormField>
          </div>
        )}
        <Button type="submit" disabled={update.isPending} className="min-h-11 w-full">
          {t("edit.save")}
        </Button>
      </form>
    </FormSheet>
  );
}
