import { useTranslation } from "react-i18next";
import type { Control } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormSheet } from "@/shared/ui/form-sheet";
import { useConfirm } from "@/shared/ui/use-confirm";
import { useZodForm } from "@/shared/hooks/use-zod-form";
import { FormField } from "@/shared/ui/form-field";
import type { ProjectContact } from "@/lib/database.types";
import { crewFormSchema, emptyCrew, type CrewFormValues } from "../domain/schemas";
import { useRemoveCrew, useUpdateCrew } from "../hooks";

function crewToForm({ contact }: ProjectContact): CrewFormValues {
  return { full_name: contact.full_name, trade: contact.trade ?? "", phone: contact.phone ?? "", email: contact.email ?? "" };
}

/** The crew form's fields, shared by the edit sheet and the "Add person" sheet's crew tab. */
export function CrewFormFields({ control }: { control: Control<CrewFormValues, unknown, CrewFormValues> }) {
  const { t } = useTranslation(["people"]);
  return (
    <>
      <FormField control={control} name="full_name" label={t("crew.name")}>
        {(field) => <Input autoComplete="off" {...field} />}
      </FormField>
      <FormField control={control} name="trade" label={t("crew.trade")}>
        {(field) => <Input autoComplete="off" placeholder={t("crew.tradePlaceholder")} {...field} />}
      </FormField>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField control={control} name="phone" label={t("crew.phone")}>
          {(field) => <Input type="tel" autoComplete="off" {...field} />}
        </FormField>
        <FormField control={control} name="email" label={t("crew.email")}>
          {(field) => <Input type="email" autoComplete="off" {...field} />}
        </FormField>
      </div>
    </>
  );
}

/** Edit / remove sheet for a crew member (adding goes through the "Add person" sheet). Removing only unlinks the contact. */
export function CrewSheet({ projectId, person, onClose }: { projectId: string; person: ProjectContact | null; onClose: () => void }) {
  const { t } = useTranslation(["people", "common"]);
  const confirm = useConfirm();
  const update = useUpdateCrew(projectId);
  const remove = useRemoveCrew(projectId);
  const form = useZodForm(crewFormSchema, person ? crewToForm(person) : emptyCrew);

  return (
    <FormSheet
      open={person !== null}
      onOpenChange={(v) => {
        if (v && person) form.reset(crewToForm(person));
        if (!v) onClose();
      }}
      title={t("crew.editTitle")}
      description={t("crew.description")}
    >
      {person && (
        <form
          noValidate
          className="space-y-4"
          onSubmit={form.handleSubmit((values: CrewFormValues) => update.mutate({ link: person, values }, { onSuccess: onClose }))}
        >
          <CrewFormFields control={form.control} />
          <Button type="submit" disabled={update.isPending} className="w-full">
            {update.isPending ? t("common:state.saving") : t("crew.submitSave")}
          </Button>
          <Button
            type="button"
            variant="destructive"
            className="w-full"
            disabled={remove.isPending}
            onClick={async () => {
              const ok = await confirm({
                title: t("crew.removeConfirmTitle", { name: person.contact.full_name }),
                description: t("crew.removeConfirmDescription"),
                confirmLabel: t("crew.remove"),
                destructive: true,
              });
              if (ok) remove.mutate(person, { onSuccess: onClose });
            }}
          >
            {t("crew.remove")}
          </Button>
        </form>
      )}
    </FormSheet>
  );
}
