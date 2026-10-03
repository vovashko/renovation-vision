import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { FieldGroup } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useZodForm } from "@/shared/hooks/use-zod-form";
import { FormField } from "@/shared/ui/form-field";
import { DEFAULT_COUNTRY } from "../domain/project-fields";
import { newProjectSchema, type NewProjectValues } from "../domain/schemas";
import { ProjectFields } from "./project-fields";

const emptyProject: NewProjectValues = {
  name: "",
  address_line: "",
  postal_code: "",
  city: "",
  country: DEFAULT_COUNTRY,
  currency: "PLN",
  status: "active",
  client_name: "",
  start_date: "",
  target_date: "",
  budget: 0,
};

/** The "New project" sheet's form. */
export function NewProjectForm({ onSubmit, saving }: { onSubmit: (values: NewProjectValues) => void; saving: boolean }) {
  const { t } = useTranslation(["projects", "common"]);
  const form = useZodForm(newProjectSchema, emptyProject);

  return (
    <form noValidate onSubmit={form.handleSubmit(onSubmit)}>
      <FieldGroup>
        <FormField control={form.control} name="name" label={t("newProject.name")}>
          {(field) => <Input {...field} />}
        </FormField>
        <ProjectFields control={form.control} />
        <FormField
          control={form.control}
          name="client_name"
          label={t("newProject.clientName")}
          description={t("newProject.clientNameHint")}
        >
          {(field) => <Input {...field} />}
        </FormField>
        <div className="grid grid-cols-2 gap-3">
          <FormField control={form.control} name="start_date" label={t("newProject.start")}>
            {(field) => <Input type="date" {...field} />}
          </FormField>
          <FormField control={form.control} name="target_date" label={t("newProject.target")}>
            {(field) => <Input type="date" {...field} />}
          </FormField>
        </div>
        <FormField control={form.control} name="budget" label={t("newProject.budget")}>
          {(field) => <Input type="number" min={0} step={100} {...field} />}
        </FormField>
        <Button type="submit" disabled={saving} className="w-full">
          {saving ? t("common:state.saving") : t("newProject.submit")}
        </Button>
      </FieldGroup>
    </form>
  );
}
