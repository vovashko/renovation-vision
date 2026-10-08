import { useTranslation } from "react-i18next";
import { useWatch, type Control, type FieldPath, type FieldValues } from "react-hook-form";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { FormField } from "@/shared/ui/form-field";
import type { Room, Stage } from "@/lib/database.types";

type StageRoomValues = { stageId: string; taskId: string; roomId: string };

/** Stage + room pickers, side by side, and a task picker for the chosen stage; shared by the upload sheet and the photo edit sheet. */
export function StageRoomFields<TValues extends FieldValues & StageRoomValues>({
  control,
  stages,
  rooms,
}: {
  control: Control<TValues, unknown, TValues>;
  stages: Stage[];
  rooms: Room[];
}) {
  const { t } = useTranslation(["media"]);
  const stageId = useWatch({ control, name: "stageId" as FieldPath<TValues> }) as string;
  const tasks = stages.find((s) => s.id === stageId)?.tasks ?? [];
  return (
    <div className="grid grid-cols-2 gap-3">
      <FormField control={control} name={"stageId" as FieldPath<TValues>} label={t("fields.stage")}>
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
      <FormField control={control} name={"roomId" as FieldPath<TValues>} label={t("fields.room")}>
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
      {tasks.length > 0 && (
        <div className="col-span-2">
          <FormField control={control} name={"taskId" as FieldPath<TValues>} label={t("fields.task")}>
            {(field) => (
              <NativeSelect {...field}>
                <NativeSelectOption value="">{t("fields.wholeStage")}</NativeSelectOption>
                {tasks.map((task) => (
                  <NativeSelectOption key={task.id} value={task.id}>
                    {task.name}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            )}
          </FormField>
        </div>
      )}
    </div>
  );
}
