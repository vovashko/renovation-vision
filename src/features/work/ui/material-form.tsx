import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FieldGroup } from "@/components/ui/field";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { FormField } from "@/shared/ui/form-field";
import { useZodForm } from "@/shared/hooks/use-zod-form";
import { materialStatuses } from "@/domain/materials";
import { materialFormSchema, type MaterialFormValues } from "../domain/schemas";
import { useSaveMaterial } from "../hooks/room-view";
import type { RoomMaterial } from "@/lib/database.types";

function materialFormDefaults(material?: RoomMaterial): MaterialFormValues {
  return {
    name: material?.name ?? "",
    quantity: material?.quantity ?? 1,
    unit: material?.unit ?? "pcs",
    status: material?.status ?? "planned",
    order_by_date: material?.order_by_date ?? "",
    delivery_date: material?.delivery_date ?? "",
  };
}

/** Add or edit a room material: name, quantity, unit, status and the two dates. No prices: those live in Budget. */
export function MaterialForm({
  projectId,
  roomId,
  material,
  onSaved,
}: {
  projectId: string;
  roomId: string;
  material?: RoomMaterial;
  onSaved: () => void;
}) {
  const { t } = useTranslation(["work", "common"]);
  const form = useZodForm(materialFormSchema, materialFormDefaults(material));
  const save = useSaveMaterial(projectId, roomId);
  const status = form.watch("status");

  const submit = form.handleSubmit((values) => {
    save.mutate(
      {
        ...(material ? { id: material.id } : {}),
        name: values.name,
        quantity: values.quantity,
        unit: values.unit,
        status: values.status,
        order_by_date: values.order_by_date || null,
        delivery_date: values.delivery_date || null,
      },
      { onSuccess: onSaved },
    );
  });

  return (
    <form noValidate onSubmit={submit}>
      <FieldGroup>
        <FormField control={form.control} name="name" label={t("work:materials.form.name")}>
          {(field) => <Input {...field} className="h-11" />}
        </FormField>
        <div className="grid grid-cols-2 gap-3">
          <FormField control={form.control} name="quantity" label={t("work:materials.form.quantity")}>
            {(field) => (
              <Input
                {...field}
                type="number"
                inputMode="decimal"
                min={0}
                step={0.001}
                onChange={(e) => field.onChange(e.target.value === "" ? Number.NaN : Number(e.target.value))}
                className="h-11"
              />
            )}
          </FormField>
          <FormField control={form.control} name="unit" label={t("work:materials.form.unit")}>
            {(field) => <Input {...field} maxLength={16} className="h-11" />}
          </FormField>
        </div>
        <FormField control={form.control} name="status" label={t("work:materials.form.status")}>
          {(field) => (
            <NativeSelect {...field}>
              {materialStatuses.map((s) => (
                <NativeSelectOption key={s} value={s}>
                  {t(`work:materials.status.${s}`)}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          )}
        </FormField>
        <FormField
          control={form.control}
          name="order_by_date"
          label={t("work:materials.form.orderBy")}
          description={status === "planned" ? t("work:materials.form.orderByHint") : undefined}
        >
          {(field) => <Input {...field} type="date" className="h-11" />}
        </FormField>
        <FormField control={form.control} name="delivery_date" label={t("work:materials.form.delivery")}>
          {(field) => <Input {...field} type="date" className="h-11" />}
        </FormField>
        <Button type="submit" disabled={save.isPending} className="min-h-11 w-full">
          {save.isPending ? t("common:state.saving") : t("common:actions.save")}
        </Button>
      </FieldGroup>
    </form>
  );
}
