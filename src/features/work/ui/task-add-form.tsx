import { useTranslation } from "react-i18next";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { useZodForm } from "@/shared/hooks/use-zod-form";
import { taskAddFormSchema } from "../domain/schemas";
import type { Room } from "@/lib/database.types";

/** Small inline form at the bottom of a stage card: name + optional room, RHF + zod. */
export function TaskAddForm({ rooms, onAdd }: { rooms: Room[]; onAdd: (values: { name: string; room_id: string | null }) => void }) {
  const { t } = useTranslation("work");
  const form = useZodForm(taskAddFormSchema, { name: "", room_id: "" });
  const name = form.watch("name");
  const nameField = form.register("name");
  const roomField = form.register("room_id");

  const submit = form.handleSubmit((values) => {
    onAdd({ name: values.name, room_id: values.room_id || null });
    form.reset({ name: "", room_id: values.room_id });
  });

  return (
    <form className="mt-3 flex flex-wrap gap-2" noValidate onSubmit={submit}>
      <Input
        {...nameField}
        placeholder={t("addTask.placeholder")}
        aria-label={t("addTask.nameLabel")}
        className="h-10 min-w-0 flex-1 basis-full sm:basis-auto"
      />
      <NativeSelect size="sm" {...roomField} aria-label={t("addTask.roomLabel")} className="w-36 shrink-0">
        <NativeSelectOption value="">{t("addTask.noRoom")}</NativeSelectOption>
        {rooms.map((r) => (
          <NativeSelectOption key={r.id} value={r.id}>
            {r.name}
          </NativeSelectOption>
        ))}
      </NativeSelect>
      <Button type="submit" variant="outline" disabled={!name.trim()} className="h-10">
        {t("addTask.submit")}
      </Button>
    </form>
  );
}
