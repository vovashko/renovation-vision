import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MoneyInput } from "@/components/ui/money-input";
import { FieldGroup } from "@/components/ui/field";
import { FormSheet } from "@/shared/ui/form-sheet";
import { FormField } from "@/shared/ui/form-field";
import { useZodForm } from "@/shared/hooks/use-zod-form";
import { useProject } from "@/features/projects/hooks";
import { deliveredExpenseAmount } from "@/domain/materials";
import { markDeliveredSchema, type MarkDeliveredFormInput } from "../domain/schemas";
import { useMarkMaterialDelivered } from "../hooks/room-view";
import type { ProjectMaterial } from "../data/room-view.repo";

const today = () => new Date().toISOString().slice(0, 10);

/**
 * "Mark delivered": sets the material delivered and creates the materials expense for it, linked to the material.
 * The amount starts as quantity × unit price and can be changed (the invoice may differ). Only a material without an
 * expense can be marked: the database refuses a second one.
 */
export function MarkDeliveredSheet({
  projectId,
  material,
  onClose,
}: {
  projectId: string;
  material: ProjectMaterial | null;
  onClose: () => void;
}) {
  const { t } = useTranslation(["work"]);
  return (
    <FormSheet
      open={material !== null}
      onOpenChange={(open) => !open && onClose()}
      title={t("work:materials.delivered.title", { name: material?.name ?? "" })}
    >
      {material && <MarkDeliveredForm key={material.id} projectId={projectId} material={material} onDone={onClose} />}
    </FormSheet>
  );
}

function MarkDeliveredForm({ projectId, material, onDone }: { projectId: string; material: ProjectMaterial; onDone: () => void }) {
  const { t } = useTranslation(["work", "common"]);
  const { data: project } = useProject(projectId);
  const defaults: MarkDeliveredFormInput = { amount: deliveredExpenseAmount(material), spent_on: material.delivery_date ?? today() };
  const form = useZodForm(markDeliveredSchema, defaults);
  const mark = useMarkMaterialDelivered(projectId);

  const submit = form.handleSubmit((values) => {
    mark.mutate({ materialId: material.id, amount: values.amount, spentOn: values.spent_on }, { onSuccess: onDone });
  });

  return (
    <form noValidate onSubmit={submit}>
      <FieldGroup>
        <p className="text-body-md text-on-surface-variant">
          {t("work:materials.delivered.description", { quantity: material.quantity, unit: material.unit })}
        </p>
        <FormField control={form.control} name="amount" label={t("work:materials.delivered.amount")}>
          {(field) => <MoneyInput {...field} currency={project?.currency} />}
        </FormField>
        <FormField control={form.control} name="spent_on" label={t("work:materials.delivered.date")}>
          {(field) => <Input {...field} type="date" className="h-11" />}
        </FormField>
        <Button type="submit" disabled={mark.isPending} className="min-h-11 w-full">
          {mark.isPending ? t("common:state.saving") : t("work:materials.delivered.confirm")}
        </Button>
      </FieldGroup>
    </form>
  );
}
