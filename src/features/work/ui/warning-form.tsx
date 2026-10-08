import { Controller } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Field, FieldDescription, FieldGroup, FieldTitle } from "@/components/ui/field";
import { FormField } from "@/shared/ui/form-field";
import { useZodForm } from "@/shared/hooks/use-zod-form";
import { warningFormSchema } from "../domain/schemas";
import { useSaveWarning } from "../hooks/room-view";
import { MaterialStatusChip } from "./material-row";
import type { RoomMaterial, RoomWarning } from "@/lib/database.types";

/** Write or edit an investor warning and pick the materials it is about. */
export function WarningForm({
  projectId,
  roomId,
  warning,
  materials,
  onSaved,
}: {
  projectId: string;
  roomId: string;
  warning?: RoomWarning;
  materials: RoomMaterial[];
  onSaved: () => void;
}) {
  const { t } = useTranslation(["work", "common"]);
  const form = useZodForm(warningFormSchema, { text: warning?.text ?? "", material_ids: warning?.material_ids ?? [] });
  const save = useSaveWarning(projectId, roomId);

  const submit = form.handleSubmit((values) => {
    save.mutate({ ...(warning ? { id: warning.id } : {}), text: values.text, material_ids: values.material_ids }, { onSuccess: onSaved });
  });

  return (
    <form noValidate onSubmit={submit}>
      <FieldGroup>
        <FormField control={form.control} name="text" label={t("work:warnings.form.text")} description={t("work:warnings.form.textHint")}>
          {(field) => <Textarea {...field} rows={4} />}
        </FormField>
        <Controller
          control={form.control}
          name="material_ids"
          render={({ field }) => (
            <Field>
              <FieldTitle>{t("work:warnings.form.materials")}</FieldTitle>
              <FieldDescription>{t("work:warnings.form.materialsHint")}</FieldDescription>
              {materials.length === 0 ? (
                <p className="text-body-md text-on-surface-variant">{t("work:warnings.form.noMaterials")}</p>
              ) : (
                <ul className="space-y-1">
                  {materials.map((m) => {
                    const checked = field.value.includes(m.id);
                    return (
                      <li key={m.id}>
                        <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-md px-1">
                          <input
                            type="checkbox"
                            className="size-5 accent-primary"
                            checked={checked}
                            onChange={() => field.onChange(checked ? field.value.filter((id) => id !== m.id) : [...field.value, m.id])}
                          />
                          <span className="min-w-0 flex-1 text-body-md">{m.name}</span>
                          <MaterialStatusChip status={m.status} />
                        </label>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Field>
          )}
        />
        <Button type="submit" disabled={save.isPending} className="min-h-11 w-full">
          {save.isPending ? t("common:state.saving") : t("common:actions.save")}
        </Button>
      </FieldGroup>
    </form>
  );
}
