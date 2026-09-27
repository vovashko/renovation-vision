import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Icon } from "@/components/ui/icon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { FileInput } from "@/components/ui/file-input";
import { FormSheet, VisibleSwitch } from "@/shared/ui/form-sheet";
import { FormField } from "@/shared/ui/form-field";
import { useZodForm } from "@/shared/hooks/use-zod-form";
import { useConfirm } from "@/shared/ui/use-confirm";
import { renderSchema, type RenderValues } from "@/features/media/domain/schemas";
import { useDeleteRender, useSaveRender } from "@/features/media/hooks/use-renders";
import type { Photo, Render, Room } from "@/lib/database.types";

const emptyValues: RenderValues = {
  title: "",
  description: "",
  alt: "",
  roomId: "",
  comparePhotoId: "",
  isVisible: false,
  file: null,
};

const valuesFor = (render: Render): RenderValues => ({
  title: render.title,
  description: render.description,
  alt: render.alt,
  roomId: render.room_id ?? "",
  comparePhotoId: render.compare_photo_id ?? "",
  isVisible: render.is_visible,
  file: null,
});

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
  const { t } = useTranslation(["media", "common"]);
  const confirm = useConfirm();
  const isNew = render === "new";
  const form = useZodForm(renderSchema(isNew), emptyValues);
  const [lastKey, setLastKey] = useState<string | null>(null);
  const key = render === null ? null : isNew ? "new" : render.id;
  useEffect(() => {
    if (key === lastKey) return;
    setLastKey(key);
    form.reset(render === null ? emptyValues : isNew ? emptyValues : valuesFor(render));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, lastKey]);

  const save = useSaveRender(projectId);
  const remove = useDeleteRender(projectId);
  const roomId = form.watch("roomId");
  const roomPhotos = photos.filter((p) => !roomId || p.room_id === roomId);
  const isVisible = form.watch("isVisible");
  const setVisible = (v: boolean) => form.setValue("isVisible", v);
  const title = form.watch("title");
  const clearComparePhoto = () => form.setValue("comparePhotoId", "");

  const submit = form.handleSubmit((values) =>
    save.mutate(
      {
        ...(isNew ? { sort_order: 100 } : { id: (render as Render).id }),
        title: values.title,
        description: values.description,
        alt: values.alt || values.title,
        room_id: values.roomId || null,
        compare_photo_id: values.comparePhotoId || null,
        is_visible: values.isVisible,
        file: values.file,
      },
      { onSuccess: onClose },
    ),
  );

  return (
    <FormSheet
      open={render !== null}
      onOpenChange={(v) => !v && onClose()}
      title={isNew ? t("renderSheet.addTitle") : t("renderSheet.editTitle")}
      description={t("renderSheet.description")}
    >
      {render !== null && (
        <form noValidate className="flex flex-col gap-4" onSubmit={submit}>
          <FormField control={form.control} name="file" label={isNew ? t("renderSheet.imageNew") : t("renderSheet.imageReplace")}>
            {(field) => (
              <FileInput
                id={field.id}
                accept="image/*"
                aria-invalid={field["aria-invalid"]}
                aria-describedby={field["aria-describedby"]}
                onChange={(e) => field.onChange(e.target.files?.[0] ?? null)}
              />
            )}
          </FormField>
          <FormField control={form.control} name="title" label={t("renderSheet.titleLabel")}>
            {(field) => <Input {...field} />}
          </FormField>
          <FormField control={form.control} name="description" label={t("renderSheet.descriptionLabel")}>
            {(field) => <Textarea {...field} placeholder={t("renderSheet.descriptionPlaceholder")} />}
          </FormField>
          <FormField control={form.control} name="alt" label={t("fields.altLabel")}>
            {(field) => <Input {...field} />}
          </FormField>
          <FormField control={form.control} name="roomId" label={t("fields.room")}>
            {(field) => (
              <NativeSelect
                {...field}
                onChange={(e) => {
                  field.onChange(e);
                  clearComparePhoto();
                }}
              >
                <NativeSelectOption value="">—</NativeSelectOption>
                {rooms.map((r) => (
                  <NativeSelectOption key={r.id} value={r.id}>
                    {r.name}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            )}
          </FormField>
          <FormField
            control={form.control}
            name="comparePhotoId"
            label={t("renderSheet.compareLabel")}
            description={t("renderSheet.compareHint")}
          >
            {(field) => (
              <NativeSelect {...field}>
                <NativeSelectOption value="">{t("renderSheet.comparePhotoNone")}</NativeSelectOption>
                {roomPhotos.map((p) => (
                  <NativeSelectOption key={p.id} value={p.id}>
                    {p.caption.slice(0, 60) || p.id}
                    {p.status === "draft" ? ` ${t("renderSheet.draftSuffix")}` : ""}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            )}
          </FormField>
          <VisibleSwitch id="rn-visible" checked={isVisible} onChange={setVisible} label={t("renderSheet.shareLabel")} />
          <Button type="submit" disabled={save.isPending || !title.trim()} className="min-h-11 w-full">
            {save.isPending ? t("renderSheet.saving") : t("renderSheet.save")}
          </Button>
          {!isNew && render && (
            <Button
              type="button"
              variant="ghost"
              className="min-h-11 w-full gap-2 text-destructive"
              onClick={async () => {
                if (await confirm({ title: t("renderSheet.deleteConfirmTitle"), destructive: true })) {
                  remove.mutate(render, { onSuccess: onClose });
                }
              }}
            >
              <Icon name="delete" size={20} /> {t("renderSheet.delete")}
            </Button>
          )}
        </form>
      )}
    </FormSheet>
  );
}
