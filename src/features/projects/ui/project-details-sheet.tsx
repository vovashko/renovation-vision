import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { scheduleStatuses } from "@/domain/status";
import { useScheduleLabel } from "@/i18n";
import { FormSheet } from "@/shared/ui/form-sheet";
import { useZodForm } from "@/shared/hooks/use-zod-form";
import { FormField } from "@/shared/ui/form-field";
import type { ProjectSummary } from "@/lib/database.types";
import { projectEditSchema, type ProjectEditValues } from "../domain/schemas";
import { useUpdateProject } from "../hooks";
import { ProjectFields } from "./project-fields";

/** The manager's "Project details" sheet: everything here is visible to the client. */
export function ProjectDetailsSheet({
  project,
  open,
  onOpenChange,
}: {
  project: ProjectSummary;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { t } = useTranslation(["projects", "common"]);
  const scheduleLabel = useScheduleLabel();
  const save = useUpdateProject(project.id);
  const form = useZodForm(projectEditSchema, projectToForm(project));

  return (
    <FormSheet
      open={open}
      onOpenChange={(v) => {
        if (v) form.reset(projectToForm(project));
        onOpenChange(v);
      }}
      title={t("details.title")}
      description={t("details.description")}
    >
      <form
        noValidate
        className="space-y-4"
        onSubmit={form.handleSubmit((values: ProjectEditValues) => {
          save.mutate(
            { ...values, start_date: values.start_date || null, target_date: values.target_date || null },
            { onSuccess: () => onOpenChange(false) },
          );
        })}
      >
        <FormField control={form.control} name="name" label={t("details.name")}>
          {(field) => <Input {...field} className="h-11" />}
        </FormField>
        <ProjectFields control={form.control} current={project} size="lg" />
        <div className="grid grid-cols-2 gap-3">
          <FormField control={form.control} name="start_date" label={t("details.start")}>
            {(field) => <Input type="date" {...field} className="h-11" />}
          </FormField>
          <FormField control={form.control} name="target_date" label={t("details.target")}>
            {(field) => <Input type="date" {...field} className="h-11" />}
          </FormField>
        </div>
        <FormField control={form.control} name="budget" label={t("details.budget")} description={t("details.budgetHint")}>
          {(field) => <Input type="number" min={0} step={100} {...field} className="h-11" />}
        </FormField>
        <FormField
          control={form.control}
          name="schedule_status"
          label={t("details.scheduleStatus")}
          description={t("details.scheduleStatusHint")}
        >
          {(field) => (
            <NativeSelect {...field}>
              {scheduleStatuses.map((s) => (
                <NativeSelectOption key={s} value={s}>
                  {scheduleLabel(s)}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          )}
        </FormField>
        <FormField control={form.control} name="schedule_note" label={t("details.scheduleNote")}>
          {(field) => <Textarea {...field} placeholder={t("details.scheduleNotePlaceholder")} />}
        </FormField>
        <Button type="submit" disabled={save.isPending} className="min-h-11 w-full">
          {save.isPending ? t("common:state.saving") : t("details.submit")}
        </Button>
      </form>
    </FormSheet>
  );
}

function projectToForm(project: ProjectSummary): ProjectEditValues {
  return {
    name: project.name,
    address_line: project.address_line,
    postal_code: project.postal_code,
    city: project.city,
    country: project.country,
    currency: project.currency,
    status: project.status,
    start_date: project.start_date ?? "",
    target_date: project.target_date ?? "",
    budget: project.budget,
    schedule_status: project.schedule_status,
    schedule_note: project.schedule_note ?? "",
  };
}
