import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { cn } from "@/lib/utils";
import { taskFlags, taskState, type TaskState } from "@/domain/progress";
import { useZodForm } from "@/shared/hooks/use-zod-form";
import { useConfirm } from "@/shared/ui/use-confirm";
import { roomTaskFormSchema, taskStateSchema } from "../domain/schemas";
import { useDeleteTask, useSaveTask } from "../hooks/mutations";
import type { Stage, Task } from "@/lib/database.types";

const stateVariant = {
  todo: "status-pending",
  in_progress: "status-progress",
  done: "status-done",
} as const satisfies Record<TaskState, string>;

const STATES: TaskState[] = ["todo", "in_progress", "done"];

/** The room's works: tasks tagged with the room, each todo / in progress / done. Managers add, change and remove. */
export function RoomWorks({
  projectId,
  roomId,
  tasks,
  stages,
  isManager,
}: {
  projectId: string;
  roomId: string;
  tasks: Task[];
  stages: Pick<Stage, "id" | "name">[];
  isManager: boolean;
}) {
  const { t } = useTranslation(["work", "common"]);
  const confirm = useConfirm();
  const saveTask = useSaveTask(projectId);
  const removeTask = useDeleteTask(projectId);
  const form = useZodForm(roomTaskFormSchema, { name: "", stage_id: "" });
  const name = form.watch("name");
  const nameField = form.register("name");
  const stageField = form.register("stage_id");
  const stageName = (id: string | null) => stages.find((s) => s.id === id)?.name;

  const setState = (task: Task, state: TaskState) => saveTask.mutate({ id: task.id, ...taskFlags(state) });
  const onRemove = async (task: Task) => {
    const ok = await confirm({ title: t("work:stageRow.removeTaskConfirmTitle", { name: task.name }), destructive: true });
    if (ok) removeTask.mutate(task);
  };
  const submit = form.handleSubmit((values) => {
    saveTask.mutate({
      room_id: roomId,
      stage_id: values.stage_id || null,
      name: values.name,
      sort_order: tasks.length + 1,
    });
    form.reset({ name: "", stage_id: values.stage_id });
  });

  return (
    <section aria-labelledby="room-works-heading">
      <h2 id="room-works-heading" className="text-title-lg">
        {t("work:roomWorks.heading")}
      </h2>
      {tasks.length === 0 ? (
        <p className="mt-3 text-body-md text-on-surface-variant">{t("work:roomWorks.empty")}</p>
      ) : (
        <ul className="mt-2 divide-y divide-outline-variant">
          {tasks.map((task) => {
            const state = taskState(task);
            const stage = stageName(task.stage_id);
            return (
              <li
                key={task.id}
                className={cn("flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-3", !task.is_visible && "opacity-60")}
              >
                <div className="min-w-0">
                  <div className={cn("text-body-lg", state === "done" && "text-on-surface-variant line-through")}>{task.name}</div>
                  {stage && <div className="text-body-md text-on-surface-variant">{t("work:roomWorks.stage", { name: stage })}</div>}
                </div>
                <div className="flex items-center gap-2">
                  {isManager ? (
                    <>
                      <NativeSelect
                        size="sm"
                        value={state}
                        onChange={(e) => setState(task, taskStateSchema.parse(e.target.value))}
                        aria-label={t("work:roomWorks.stateLabel", { name: task.name })}
                        className="w-40"
                      >
                        {STATES.map((s) => (
                          <NativeSelectOption key={s} value={s}>
                            {t(`work:roomWorks.state.${s}`)}
                          </NativeSelectOption>
                        ))}
                      </NativeSelect>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onRemove(task)}
                        aria-label={t("work:stageRow.removeTask", { name: task.name })}
                      >
                        <Icon name="close" size={20} />
                      </Button>
                    </>
                  ) : (
                    <Badge size="compact" variant={stateVariant[state]}>
                      {t(`work:roomWorks.state.${state}`)}
                    </Badge>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {isManager && (
        <form className="mt-3 flex flex-wrap gap-2" noValidate onSubmit={submit}>
          <Input
            {...nameField}
            placeholder={t("work:roomWorks.addPlaceholder")}
            aria-label={t("work:roomWorks.addLabel")}
            className="h-10 min-w-0 flex-1 basis-full sm:basis-auto"
          />
          <NativeSelect size="sm" {...stageField} aria-label={t("work:roomWorks.stageLabel")} className="w-44 shrink-0">
            <NativeSelectOption value="">{t("work:roomWorks.noStage")}</NativeSelectOption>
            {stages.map((s) => (
              <NativeSelectOption key={s.id} value={s.id}>
                {s.name}
              </NativeSelectOption>
            ))}
          </NativeSelect>
          <Button type="submit" variant="outline" disabled={!name.trim()} className="h-10">
            {t("work:addTask.submit")}
          </Button>
        </form>
      )}
    </section>
  );
}
