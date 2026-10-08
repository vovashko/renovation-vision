import { Controller } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Icon } from "@/components/ui/icon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { FieldGroup } from "@/components/ui/field";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { statuses, type Status } from "@/domain/status";
import { progressForStatus, statusForProgress } from "@/domain/progress";
import { slugify } from "@/domain/text";
import { useStatusLabel } from "@/i18n";
import { VisibleSwitch } from "@/shared/ui/form-sheet";
import { FormField } from "@/shared/ui/form-field";
import { useConfirm } from "@/shared/ui/use-confirm";
import { useZodForm } from "@/shared/hooks/use-zod-form";
import { roomFormSchema, type RoomFormValues } from "../domain/schemas";
import { useDeleteRoom, useSaveRoom } from "../hooks/mutations";
import type { RoomInput } from "../data/work.repo";
import type { Room } from "@/lib/database.types";

const SIZE_KEYS = ["w", "h"] as const;

/** The room fields shared by the "Add room" sheet and the selected room's inline editor. */
export function RoomForm({
  projectId,
  initial,
  id,
  openTasks = [],
  compact,
  extra,
  onSaved,
}: {
  projectId: string;
  initial: RoomFormValues;
  id?: string;
  openTasks?: string[];
  compact?: boolean;
  extra?: Partial<RoomInput>;
  onSaved?: () => void;
}) {
  const { t } = useTranslation(["work", "common"]);
  const statusLabel = useStatusLabel();
  const form = useZodForm(roomFormSchema, initial);
  const save = useSaveRoom(projectId);
  const progress = form.watch("progress");
  const status = form.watch("status");
  const blockedByTasks = status === "done" && openTasks.length > 0;
  const pre = id ?? "new";

  const setStatus = (s: Status) => {
    form.setValue("status", s, { shouldValidate: true });
    form.setValue("progress", progressForStatus(s, form.getValues("progress")), { shouldValidate: true });
  };
  const setProgress = (value: number) => {
    form.setValue("progress", value, { shouldValidate: true });
    form.setValue("status", statusForProgress(form.getValues("status"), value), { shouldValidate: true });
  };

  const submit = form.handleSubmit((values) => {
    const payload: RoomInput = { ...values, ...extra, ...(id ? { id } : { key: slugify(values.name) }) };
    save.mutate(payload, { onSuccess: () => onSaved?.() });
  });

  return (
    <form noValidate onSubmit={submit}>
      <FieldGroup>
        {!compact && (
          <FormField control={form.control} name="name" label={t("work:roomForm.name")}>
            {(field) => <Input {...field} className="h-11" />}
          </FormField>
        )}
        <FormField control={form.control} name="status" label={t("work:roomForm.status")}>
          {(field) => (
            <NativeSelect {...field} onChange={(e) => setStatus(e.target.value as Status)}>
              {statuses.map((s) => (
                <NativeSelectOption key={s} value={s}>
                  {statusLabel(s)}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          )}
        </FormField>
        {blockedByTasks && (
          <p className="rounded-md bg-status-blocked-container p-2 text-body-sm text-on-status-blocked-container" role="alert">
            {t("work:roomForm.blockedByTasks", { tasks: openTasks.join(", ") })}
          </p>
        )}
        <FormField control={form.control} name="progress" label={t("work:roomForm.progress", { pct: progress })}>
          {(field) => (
            <Slider
              id={field.id}
              min={0}
              max={100}
              step={5}
              value={[field.value]}
              onValueChange={([v]) => setProgress(v)}
              className="py-3"
            />
          )}
        </FormField>
        <FormField control={form.control} name="client_note" label={t("work:roomForm.note")}>
          {(field) => (
            <Textarea
              {...field}
              placeholder={status === "blocked" ? t("work:roomForm.notePlaceholderBlocked") : t("work:roomForm.notePlaceholder")}
            />
          )}
        </FormField>
        <Controller
          control={form.control}
          name="is_visible"
          render={({ field }) => (
            <VisibleSwitch
              id={`${pre}-visible`}
              checked={field.value}
              onChange={field.onChange}
              label={t("work:roomForm.visibleToClient")}
            />
          )}
        />
        <div className="grid grid-cols-2 gap-3">
          {SIZE_KEYS.map((k) => (
            <FormField key={k} control={form.control} name={k} label={t(`work:roomForm.size${k.toUpperCase() as "W" | "H"}`)}>
              {(field) => (
                <Input
                  {...field}
                  type="number"
                  inputMode="decimal"
                  min={0.5}
                  max={100}
                  step={0.01}
                  onChange={(e) => field.onChange(e.target.value === "" ? Number.NaN : Number(e.target.value))}
                  className="h-11"
                />
              )}
            </FormField>
          ))}
        </div>
        <Button type="submit" disabled={save.isPending || blockedByTasks} className="min-h-11 w-full">
          {save.isPending ? t("work:roomForm.saving") : id ? t("work:roomForm.save") : t("work:roomForm.add")}
        </Button>
      </FieldGroup>
    </form>
  );
}

/** The selected room's inline editor on the plan page: name/header, fields and delete. */
export function RoomEditor({ projectId, room, openTasks }: { projectId: string; room: Room; openTasks: string[] }) {
  const { t } = useTranslation(["work", "common"]);
  const confirm = useConfirm();
  const remove = useDeleteRoom(projectId);

  const onDelete = async () => {
    const ok = await confirm({
      title: t("work:roomForm.deleteConfirmTitle"),
      description: t("work:roomForm.deleteConfirmDescription", { name: room.name }),
      destructive: true,
    });
    if (ok) remove.mutate(room.id);
  };

  return (
    <>
      <div className="text-body-md text-on-surface-variant">{t("work:selectedRoom.label")}</div>
      <h3 className="mt-1 text-title-lg">{room.name}</h3>
      <div className="mt-4">
        <RoomForm projectId={projectId} initial={room} id={room.id} openTasks={openTasks} compact />
      </div>
      <div className="mt-3 flex flex-wrap justify-end gap-2">
        <button type="button" onClick={onDelete} className="inline-flex items-center gap-1 text-body-sm text-destructive hover:underline">
          <Icon name="delete" size={16} /> {t("work:roomForm.delete")}
        </button>
      </div>
    </>
  );
}
