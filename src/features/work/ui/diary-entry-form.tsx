import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { FieldGroup } from "@/components/ui/field";
import { FileInput } from "@/components/ui/file-input";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { FormField } from "@/shared/ui/form-field";
import { VisibleSwitch } from "@/shared/ui/form-sheet";
import { useZodForm } from "@/shared/hooks/use-zod-form";
import { useUploadPhotos } from "@/features/media/hooks";
import { diaryFormSchema, isoDay, type DiaryFormValues } from "../domain/diary";
import { useDiaryMaterials, useSaveDiaryEntry } from "../hooks/diary";
import type { ProgressEntry, Room, Stage } from "@/lib/database.types";

function diaryFormDefaults(entry: ProgressEntry | undefined, materialIds: string[]) {
  return {
    note: entry?.note ?? "",
    entry_date: entry?.entry_date ?? isoDay(),
    stageId: entry?.stage_id ?? "",
    roomId: entry?.room_id ?? "",
    hours: entry?.hours == null ? "" : String(entry.hours),
    files: [] as File[],
    materialIds,
    is_visible: entry?.is_visible ?? false,
  };
}

/**
 * The quick diary entry: a note, the day, optionally a stage and room, hours, photos, the materials used and
 * whether the client sees it. Managers only. Saving creates/updates the entry and links its materials, then
 * uploads the photos with the entry's id (published when the entry is visible, kept as drafts otherwise).
 */
export function DiaryEntryForm({
  projectId,
  entry,
  stages,
  rooms,
  onSaved,
}: {
  projectId: string;
  entry?: ProgressEntry;
  stages: Stage[];
  rooms: Room[];
  onSaved: () => void;
}) {
  const { t } = useTranslation(["work", "common", "media"]);
  const { data: materials = [] } = useDiaryMaterials(projectId);
  const linkedIds = entry ? materials.filter((m) => m.progress_entry_id === entry.id).map((m) => m.id) : [];
  const form = useZodForm(diaryFormSchema, diaryFormDefaults(entry, linkedIds));
  const save = useSaveDiaryEntry(projectId);
  const upload = useUploadPhotos(projectId);
  const files = form.watch("files");
  const materialIds = form.watch("materialIds");
  const isVisible = form.watch("is_visible");
  const pending = save.isPending || upload.isPending;

  const setVisible = (v: boolean) => form.setValue("is_visible", v, { shouldDirty: true });
  const toggleMaterial = (id: string, on: boolean) =>
    form.setValue("materialIds", on ? [...materialIds, id] : materialIds.filter((m) => m !== id), { shouldDirty: true });

  const submit = form.handleSubmit(async (values: DiaryFormValues) => {
    const entryId = await save.mutateAsync({
      entry: {
        ...(entry ? { id: entry.id } : {}),
        note: values.note,
        entry_date: values.entry_date,
        stage_id: values.stageId || null,
        room_id: values.roomId || null,
        hours: values.hours,
        is_visible: values.is_visible,
      },
      materialIds: values.materialIds,
      previousMaterialIds: linkedIds,
    });
    if (values.files.length > 0) {
      await upload.mutateAsync({
        files: values.files,
        meta: {
          stage_id: values.stageId || null,
          task_id: null,
          room_id: values.roomId || null,
          caption: "",
          progress_entry_id: entryId,
        },
        publish: values.is_visible,
      });
    }
    onSaved();
  });

  return (
    <form noValidate onSubmit={submit}>
      <FieldGroup>
        <FormField control={form.control} name="note" label={t("work:diary.form.note")}>
          {(field) => <Textarea {...field} rows={4} placeholder={t("work:diary.form.notePlaceholder")} />}
        </FormField>
        <div className="grid grid-cols-2 gap-3">
          <FormField control={form.control} name="entry_date" label={t("work:diary.form.date")}>
            {(field) => <Input {...field} type="date" className="h-11" />}
          </FormField>
          <FormField control={form.control} name="hours" label={t("work:diary.form.hours")}>
            {(field) => <Input {...field} inputMode="decimal" placeholder="0" className="h-11" />}
          </FormField>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <FormField control={form.control} name="stageId" label={t("work:diary.form.stage")}>
            {(field) => (
              <NativeSelect {...field}>
                <NativeSelectOption value="">—</NativeSelectOption>
                {stages.map((s) => (
                  <NativeSelectOption key={s.id} value={s.id}>
                    {s.name}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            )}
          </FormField>
          <FormField control={form.control} name="roomId" label={t("work:diary.form.room")}>
            {(field) => (
              <NativeSelect {...field}>
                <NativeSelectOption value="">—</NativeSelectOption>
                {rooms.map((r) => (
                  <NativeSelectOption key={r.id} value={r.id}>
                    {r.name}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            )}
          </FormField>
        </div>
        <FormField control={form.control} name="files" label={t("work:diary.form.photos")}>
          {(field) => (
            <div className="flex flex-col gap-3">
              <FileInput
                id={field.id}
                accept="image/*"
                multiple
                aria-invalid={field["aria-invalid"]}
                aria-describedby={field["aria-describedby"]}
                onChange={(e) => field.onChange(Array.from(e.target.files ?? []))}
              />
              {files.length > 0 && (
                <p className="text-body-sm text-on-surface-variant">{t("work:diary.form.photosChosen", { count: files.length })}</p>
              )}
            </div>
          )}
        </FormField>
        {materials.length > 0 && (
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-label-lg">{t("work:diary.form.materials")}</legend>
            {materials.map((m) => (
              <div key={m.id} className="flex min-h-11 items-center gap-3 rounded-md border px-3">
                <Checkbox
                  id={`diary-material-${m.id}`}
                  checked={materialIds.includes(m.id)}
                  onCheckedChange={(on) => toggleMaterial(m.id, on === true)}
                />
                <Label htmlFor={`diary-material-${m.id}`} className="flex-1 font-normal">
                  {m.name}
                </Label>
              </div>
            ))}
          </fieldset>
        )}
        <VisibleSwitch id="diary-visible" checked={isVisible} onChange={(v) => setVisible(v)} label={t("work:diary.form.visible")} />
        <Button type="submit" disabled={pending} className="min-h-11 w-full">
          {pending ? t("common:state.saving") : t("common:actions.save")}
        </Button>
      </FieldGroup>
    </form>
  );
}
