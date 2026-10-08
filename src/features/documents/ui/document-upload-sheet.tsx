import { useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { FileInput } from "@/components/ui/file-input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { FormSheet, VisibleSwitch } from "@/shared/ui/form-sheet";
import { FormField } from "@/shared/ui/form-field";
import { useZodForm } from "@/shared/hooks/use-zod-form";
import { DOCUMENT_ACCEPT, DOCUMENT_CATEGORIES, groupVersions, isVersionedCategory } from "@/features/documents/domain/documents";
import { uploadDocumentSchema } from "@/features/documents/domain/schemas";
import { useUploadDocument } from "@/features/documents/hooks/use-documents";
import type { DocumentCategory, ProjectDocument } from "@/lib/database.types";

export type RoomOption = { id: string; name: string };
export type TaskOption = { id: string; label: string };

const EMPTY = { title: "", category: "contract", description: "", file: null, roomId: "", taskId: "", versionOf: "" } as const;

/**
 * The manager's upload panel: title, category, optional description, the file, room (required) and work (optional)
 * for installation photos, and a "new version" switch for contract and estimate. A new version never replaces
 * the old file: the database keeps it as history.
 */
export function DocumentUploadSheet({
  projectId,
  open,
  onOpenChange,
  category,
  versionGroup,
  documents,
  rooms,
  tasks,
}: {
  projectId: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** The category pre-selected when the panel opens (the active tab). */
  category: DocumentCategory;
  /** Opens as "new version of" this document group (contract/estimate). */
  versionGroup?: string | null;
  documents: ProjectDocument[];
  rooms: RoomOption[];
  tasks: TaskOption[];
}) {
  const { t } = useTranslation(["documents", "common"]);
  const form = useZodForm(uploadDocumentSchema, { ...EMPTY, category });
  const upload = useUploadDocument(projectId);
  const chosenCategory = form.watch("category") as DocumentCategory;
  const versionOf = form.watch("versionOf");
  const file = form.watch("file");
  const isPhoto = chosenCategory === "installation_photos";

  // Current documents of the chosen (versioned) category: the ones a new version can be uploaded for.
  const versionable = useMemo(
    () =>
      isVersionedCategory(chosenCategory)
        ? groupVersions(documents.filter((d) => d.category === chosenCategory && !d.archived_at)).map((g) => g.current)
        : [],
    [documents, chosenCategory],
  );

  useEffect(() => {
    if (!open) return;
    const current = versionGroup ? documents.find((d) => d.version_group === versionGroup && d.is_current) : undefined;
    form.reset({ ...EMPTY, category: current?.category ?? category, title: current?.title ?? "", versionOf: current ? versionGroup! : "" });
    // Only re-seed when the panel opens (or is opened for another document), not on every documents refetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, category, versionGroup]);

  const setVersionOn = (on: boolean) => {
    const first = versionable[0];
    form.setValue("versionOf", on && first ? first.version_group : "");
    if (on && first && !form.getValues("title")) form.setValue("title", first.title);
  };

  const clearVersion = () => form.setValue("versionOf", "");
  // A picked file proposes its name (without the extension) as the title when none was typed.
  const suggestTitle = (picked: File | null) => {
    if (picked && !form.getValues("title")) form.setValue("title", picked.name.replace(/\.[a-z0-9]+$/i, ""));
  };

  const submit = form.handleSubmit((values) =>
    upload.mutate(
      {
        file: values.file as File,
        category: values.category as DocumentCategory,
        title: values.title,
        description: values.description,
        roomId: values.category === "installation_photos" ? values.roomId || null : null,
        taskId: values.category === "installation_photos" ? values.taskId || null : null,
        versionOf: isVersionedCategory(values.category as DocumentCategory) ? values.versionOf || null : null,
      },
      { onSuccess: () => onOpenChange(false) },
    ),
  );

  return (
    <FormSheet open={open} onOpenChange={onOpenChange} title={t("upload.sheetTitle")} description={t("upload.sheetDescription")}>
      <form noValidate onSubmit={submit} className="flex flex-col gap-4">
        <FormField control={form.control} name="category" label={t("upload.category")}>
          {(field) => (
            <NativeSelect
              {...field}
              onChange={(e) => {
                field.onChange(e);
                clearVersion();
              }}
            >
              {DOCUMENT_CATEGORIES.map((c) => (
                <NativeSelectOption key={c} value={c}>
                  {t(`categories.${c}`)}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          )}
        </FormField>

        {versionable.length > 0 && (
          <>
            <VisibleSwitch id="doc-new-version" checked={!!versionOf} onChange={setVersionOn} label={t("upload.newVersionSwitch")} />
            {versionOf && versionable.length > 1 && (
              <FormField control={form.control} name="versionOf" label={t("upload.versionOf")}>
                {(field) => (
                  <NativeSelect {...field}>
                    {versionable.map((d) => (
                      <NativeSelectOption key={d.version_group} value={d.version_group}>
                        {d.title}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                )}
              </FormField>
            )}
          </>
        )}

        <FormField control={form.control} name="title" label={t("upload.titleLabel")}>
          {(field) => <Input {...field} maxLength={200} placeholder={t("upload.titlePlaceholder")} />}
        </FormField>

        <FormField control={form.control} name="file" label={t("upload.file")} description={t("upload.fileHint")}>
          {(field) => (
            <FileInput
              id={field.id}
              accept={DOCUMENT_ACCEPT}
              aria-invalid={field["aria-invalid"]}
              aria-describedby={field["aria-describedby"]}
              onChange={(e) => {
                const picked = e.target.files?.[0] ?? null;
                field.onChange(picked);
                suggestTitle(picked);
              }}
            />
          )}
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
