import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormSheet } from "@/shared/ui/form-sheet";
import { useConfirm } from "@/shared/ui/use-confirm";
import { useZodForm } from "@/shared/hooks/use-zod-form";
import { FormField } from "@/shared/ui/form-field";
import type { CrewMember } from "@/lib/database.types";
import { crewFormSchema, type CrewFormValues } from "../domain/schemas";
import { useDeleteCrew, useSaveCrew } from "../hooks";

const emptyCrew: CrewFormValues = { name: "", trade: "", phone: "", email: "" };

function crewToForm(person: CrewMember): CrewFormValues {
  return { name: person.name, trade: person.trade, phone: person.phone, email: person.email };
}

/** Add / edit sheet for the site crew (not app users): used by the Team card's "Add person" and row edit. */
export function CrewSheet({
  projectId,
  person,
  onClose,
}: {
  projectId: string;
  /** "new" to add, a crew member to edit, null when closed. */
  person: CrewMember | "new" | null;
  onClose: () => void;
}) {
  const { t } = useTranslation(["people", "common"]);
  const confirm = useConfirm();
  const isNew = person === "new";
  const save = useSaveCrew(projectId);
  const remove = useDeleteCrew(projectId);
  const form = useZodForm(crewFormSchema, person && person !== "new" ? crewToForm(person) : emptyCrew);

  return (
    <FormSheet
      open={person !== null}
      onOpenChange={(v) => {
        if (v && person && person !== "new") form.reset(crewToForm(person));
        else if (v) form.reset(emptyCrew);
        if (!v) onClose();
      }}
      title={isNew ? t("crew.addTitle") : t("crew.editTitle")}
      description={t("crew.description")}
    >
      <form
        noValidate
        className="space-y-4"
        onSubmit={form.handleSubmit((values: CrewFormValues) => {
          save.mutate(isNew ? values : { id: (person as CrewMember).id, ...values }, { onSuccess: onClose });
        })}
      >
        <FormField control={form.control} name="name" label={t("crew.name")}>
          {(field) => <Input autoComplete="off" {...field} />}
        </FormField>
        <FormField control={form.control} name="trade" label={t("crew.trade")}>
          {(field) => <Input autoComplete="off" placeholder={t("crew.tradePlaceholder")} {...field} />}
        </FormField>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField control={form.control} name="phone" label={t("crew.phone")}>
            {(field) => <Input type="tel" autoComplete="off" {...field} />}
          </FormField>
          <FormField control={form.control} name="email" label={t("crew.email")}>
            {(field) => <Input type="email" autoComplete="off" {...field} />}
          </FormField>
        </div>
        <Button type="submit" disabled={save.isPending} className="w-full">
          {save.isPending ? t("common:state.saving") : isNew ? t("crew.submitAdd") : t("crew.submitSave")}
        </Button>
        {person && person !== "new" && (
          <Button
            type="button"
            variant="destructive"
            className="w-full"
            disabled={remove.isPending}
            onClick={async () => {
              if (await confirm({ title: t("crew.removeConfirmTitle", { name: person.name }), destructive: true })) {
                remove.mutate(person, { onSuccess: onClose });
              }
            }}
          >
            {t("crew.remove")}
          </Button>
        )}
      </form>
    </FormSheet>
  );
}
