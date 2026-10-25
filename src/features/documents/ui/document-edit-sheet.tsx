import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { FormSheet } from "@/shared/ui/form-sheet";
import { FormField } from "@/shared/ui/form-field";
import { useZodForm } from "@/shared/hooks/use-zod-form";
import { editDocumentSchema } from "@/features/documents/domain/schemas";
import { useUpdateDocument } from "@/features/documents/hooks/use-documents";
import type { ProjectDocument } from "@/lib/database.types";

/** Edit a document's description. The file and its name never change: upload another file instead. */
export function DocumentEditSheet({ projectId, doc, onClose }: { projectId: string; doc: ProjectDocument | null; onClose: () => void }) {
  const { t } = useTranslation(["documents", "common"]);
  const form = useZodForm(editDocumentSchema, { description: "" });
  const update = useUpdateDocument(projectId);

  useEffect(() => {
    if (doc) form.reset({ description: doc.description });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc?.id]);

  const submit = form.handleSubmit((values) => {
    if (!doc) return;
    update.mutate({ id: doc.id, description: values.description }, { onSuccess: onClose });
  });

  return (
    <FormSheet open={!!doc} onOpenChange={(v) => !v && onClose()} title={t("edit.title")} description={doc?.file_name}>
      <form noValidate onSubmit={submit} className="flex flex-col gap-4">
        <FormField control={form.control} name="description" label={t("upload.descriptionLabel")}>
          {(field) => <Textarea {...field} maxLength={2000} />}
        </FormField>
        <Button type="submit" disabled={update.isPending} className="min-h-11 w-full">
          {t("edit.save")}
        </Button>
      </form>
    </FormSheet>
  );
}
