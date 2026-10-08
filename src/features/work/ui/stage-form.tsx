import { useEffect } from "react";
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
import { deriveFromTasks, progressForStatus, statusForProgress } from "@/domain/progress";
import { slugify } from "@/domain/text";
import { useStatusLabel } from "@/i18n";
import { FormSheet, VisibleSwitch } from "@/shared/ui/form-sheet";
import { FormField } from "@/shared/ui/form-field";
import { useConfirm } from "@/shared/ui/use-confirm";
import { useZodForm } from "@/shared/hooks/use-zod-form";
import { stageFormSchema, type StageFormValues } from "../domain/schemas";
import { useDeleteStage, useSaveStage } from "../hooks/mutations";
import { ProgressModeControl, TaskDerivedProgress } from "./stage-progress-mode";
import type { ProgressMode, Room, Stage } from "@/lib/database.types";
import type { StageInput } from "../data/work.repo";

const emptyStage: StageFormValues = {
  name: "",
  progress_mode: "tasks",
  status: "pending",
  progress: 0,
  start_date: "",
  end_date: "",
  client_note: "",
  is_visible: true,
};

/**
 * Add/edit sheet for a stage: RHF + zod. In `tasks` progress mode, progress and status are computed from the
 * checklist (`deriveFromTasks`, mirroring the database) and shown read-only, with only "blocked" set by hand;
 * in `manual` mode `@/domain/progress` keeps the status picker and the slider in sync.
 */
export function StageFormSheet({
  projectId,
  stage,
  rooms,
  count,
  onClose,
}: {
  projectId: string;
  stage: Stage | "new" | null;
  rooms: Room[];
  count: number;
  onClose: () => void;
}) {
  const { t } = useTranslation(["work", "common"]);
  const statusLabel = useStatusLabel();
  const confirm = useConfirm();
  const isNew = stage === "new";
  const form = useZodForm(stageFormSchema, emptyStage);
  const save = useSaveStage(projectId);
  const remove = useDeleteStage(projectId);
  const progress = form.watch("progress");
  const status = form.watch("status");
  const mode = form.watch("progress_mode");
  const tasks = stage && stage !== "new" ? stage.tasks : [];
  const tasksDone = tasks.filter((t2) => t2.done).length;

  useEffect(() => {
    if (stage && stage !== "new") {
      const { name, progress_mode, status: s, progress: p, start_date, end_date, client_note, is_visible } = stage;
      form.reset({ name, progress_mode, status: s, progress: p, start_date, end_date, client_note: client_note ?? "", is_visible });
    } else if (isNew) {
      form.reset(emptyStage);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage]);

  const setStatus = (status: Status) => {
    form.setValue("status", status, { shouldValidate: true });
    form.setValue("progress", progressForStatus(status, form.getValues("progress")), { shouldValidate: true });
  };
  const setProgress = (value: number) => {
    form.setValue("progress", value, { shouldValidate: true });
    form.setValue("status", statusForProgress(form.getValues("status"), value), { shouldValidate: true });
  };
  // Tasks mode: the computed values, so the form shows (and sends) what the database will store.
  const applyDerived = (base: Status) => {
    const derived = deriveFromTasks(base, tasksDone, tasks.length);
    form.setValue("status", derived.status, { shouldValidate: true });
    form.setValue("progress", derived.progress, { shouldValidate: true });
  };
  const setMode = (next: ProgressMode) => {
    form.setValue("progress_mode", next, { shouldDirty: true });
    if (next === "tasks") applyDerived(form.getValues("status"));
  };
  const setBlocked = (blocked: boolean) => applyDerived(blocked ? "blocked" : "pending");

  const roomNames =
    stage && stage !== "new" ? [...new Set(stage.tasks.map((t2) => rooms.find((r) => r.id === t2.room_id)?.name).filter(Boolean))] : [];

  const submit = form.handleSubmit((values) => {
    const payload: StageInput = isNew
      ? { ...values, key: slugify(values.name), sort_order: count + 1 }
      : { ...values, id: (stage as Stage).id };
    save.mutate(payload, { onSuccess: onClose });
  });

  const onDelete = async () => {
    if (stage === "new" || !stage) return;
    const ok = await confirm({
      title: t("work:stageForm.deleteConfirmTitle"),
      description: t("work:stageForm.deleteConfirmDescription", { name: stage.name, count: stage.tasks.length }),
      destructive: true,
    });
    if (ok) remove.mutate(stage.id, { onSuccess: onClose });
  };

  return (
    <FormSheet
      open={stage !== null}
      onOpenChange={(v) => !v && onClose()}
      title={isNew ? t("work:stageForm.addTitle") : t("work:stageForm.editTitle")}
      description={t("work:stageForm.description")}
    >
      <form noValidate onSubmit={submit}>
        <FieldGroup>
          <FormField control={form.control} name="name" label={t("work:stageForm.name")}>
            {(field) => <Input {...field} className="h-11" />}
          </FormField>
          <div className="grid grid-cols-2 gap-3">
            <FormField control={form.control} name="start_date" label={t("work:stageForm.start")}>
              {(field) => <Input {...field} type="date" className="h-11" />}
            </FormField>
            <FormField control={form.control} name="end_date" label={t("work:stageForm.end")}>
              {(field) => <Input {...field} type="date" className="h-11" />}
            </FormField>
          </div>
          <ProgressModeControl value={mode} onChange={setMode} done={tasksDone} total={tasks.length} />
          {mode === "tasks" ? (
            <TaskDerivedProgress status={status} progress={progress} onBlockedChange={setBlocked} />
          ) : (
            <>
              <FormField control={form.control} name="status" label={t("work:stageForm.status")}>
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
              <FormField control={form.control} name="progress" label={t("work:stageForm.progress", { pct: progress })}>
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
            </>
          )}
          <FormField control={form.control} name="client_note" label={t("work:stageForm.note")}>
            {(field) => <Textarea {...field} />}
          </FormField>
          <Controller
            control={form.control}
            name="is_visible"
            render={({ field }) => (
              <VisibleSwitch id="st-visible" checked={field.value} onChange={field.onChange} label={t("work:stageForm.visibleToClient")} />
            )}
          />
          {roomNames.length > 0 && (
            <p className="text-xs text-muted-foreground">{t("work:stageForm.affects", { rooms: roomNames.join(", ") })}</p>
          )}
          <Button type="submit" disabled={save.isPending} className="min-h-11 w-full">
            {save.isPending ? t("work:stageForm.saving") : t("work:stageForm.save")}
          </Button>
          {!isNew && stage && (
            <Button type="button" variant="ghost" className="min-h-11 w-full gap-2 text-destructive" onClick={onDelete}>
              <Icon name="delete" size={20} /> {t("work:stageForm.delete")}
            </Button>
          )}
        </FieldGroup>
      </form>
    </FormSheet>
  );
}
