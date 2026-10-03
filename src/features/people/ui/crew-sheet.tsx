import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormSheet } from "@/shared/ui/form-sheet";
import { useConfirm } from "@/shared/ui/use-confirm";
import { useZodForm } from "@/shared/hooks/use-zod-form";
import { FormField } from "@/shared/ui/form-field";
import type { ProjectContact } from "@/lib/database.types";
import { crewFormSchema, type CrewFormValues } from "../domain/schemas";
import { useAddCrew, useRemoveCrew, useUpdateCrew } from "../hooks";

const emptyCrew: CrewFormValues = { full_name: "", trade: "", phone: "", email: "" };

function crewToForm({ contact }: ProjectContact): CrewFormValues {
  return { full_name: contact.full_name, trade: contact.trade ?? "", phone: contact.phone ?? "", email: contact.email ?? "" };
}

/**
 * Add / edit sheet for the site crew: used by the Team card's "Add person" and row edit. Adding creates an
 * address-book contact and links it to the project; removing only unlinks it.
 */
export function CrewSheet({
  projectId,
  links,
  person,
  onClose,
}: {
  projectId: string;
  /** All of the project's contacts, to place a new crew member after the others. */
  links: ProjectContact[];
  /** "new" to add, a crew link to edit, null when closed. */
  person: ProjectContact | "new" | null;
  onClose: () => void;
}) {
  const { t } = useTranslation(["people", "common"]);
  const confirm = useConfirm();
  const isNew = person === "new";
  const add = useAddCrew(projectId, links);
  const update = useUpdateCrew(projectId);
  const remove = useRemoveCrew(projectId);
  const saving = add.isPending || update.isPending;
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
          if (person === "new") add.mutate(values, { onSuccess: onClose });
          else if (person) update.mutate({ link: person, values }, { onSuccess: onClose });
        })}
      >
        <FormField control={form.control} name="full_name" label={t("crew.name")}>
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
        <Button type="submit" disabled={saving} className="w-full">
          {saving ? t("common:state.saving") : isNew ? t("crew.submitAdd") : t("crew.submitSave")}
        </Button>
        {person && person !== "new" && (
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
        )}
      </form>
    </FormSheet>
  );
}
