import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { FileInput } from "@/components/ui/file-input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { FormSheet } from "@/shared/ui/form-sheet";
import { FormField } from "@/shared/ui/form-field";
import { useZodForm } from "@/shared/hooks/use-zod-form";
import { DOCUMENT_ACCEPT, DOCUMENT_CATEGORIES, type ShelfCategory } from "@/features/documents/domain/documents";
import { uploadDocumentSchema } from "@/features/documents/domain/schemas";
import { useUploadDocument } from "@/features/documents/hooks/use-documents";

const EMPTY = { category: "contract", description: "", file: null } as const;

/**
 * The manager's upload panel: category, the file (its name is shown as the title) and an optional description.
 * There is no versioning: an amendment is just another file in "Contract and amendments".
 */
export function DocumentUploadSheet({
  projectId,
  open,
  onOpenChange,
  category,
}: {
  projectId: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** The category pre-selected when the panel opens (the active tab). */
  category: ShelfCategory;
}) {
  const { t } = useTranslation(["documents", "common"]);
  const form = useZodForm(uploadDocumentSchema, { ...EMPTY, category });
  const upload = useUploadDocument(projectId);
  const file = form.watch("file");

  useEffect(() => {
    if (open) form.reset({ ...EMPTY, category });
    // Only re-seed when the panel opens, not on every re-render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, category]);

  const submit = form.handleSubmit((values) =>
    upload.mutate(
      { file: values.file as File, category: values.category as ShelfCategory, description: values.description },
      { onSuccess: () => onOpenChange(false) },
    ),
  );

  return (
    <FormSheet open={open} onOpenChange={onOpenChange} title={t("upload.sheetTitle")} description={t("upload.sheetDescription")}>
      <form noValidate onSubmit={submit} className="flex flex-col gap-4">
        <FormField control={form.control} name="category" label={t("upload.category")}>
          {(field) => (
            <NativeSelect {...field}>
              {DOCUMENT_CATEGORIES.map((c) => (
                <NativeSelectOption key={c} value={c}>
                  {t(`categories.${c}`)}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          )}
        </FormField>

        <FormField control={form.control} name="file" label={t("upload.file")} description={t("upload.fileHint")}>
          {(field) => (
            <FileInput
              id={field.id}
              accept={DOCUMENT_ACCEPT}
              aria-invalid={field["aria-invalid"]}
              aria-describedby={field["aria-describedby"]}
              onChange={(e) => field.onChange(e.target.files?.[0] ?? null)}
            />
          )}
        </FormField>

        <FormField control={form.control} name="description" label={t("upload.descriptionLabel")}>
          {(field) => <Textarea {...field} maxLength={2000} placeholder={t("upload.descriptionPlaceholder")} />}
        </FormField>

        <Button type="submit" disabled={!file || upload.isPending} className="min-h-11 w-full">
          {upload.isPending ? t("upload.uploading") : t("upload.submit")}
        </Button>
      </form>
    </FormSheet>
  );
}
