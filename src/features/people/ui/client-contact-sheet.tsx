import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormSheet } from "@/shared/ui/form-sheet";
import { useZodForm } from "@/shared/hooks/use-zod-form";
import { FormField } from "@/shared/ui/form-field";
import type { ProjectContact } from "@/lib/database.types";
import { clientContactSchema, type ClientContactValues } from "../domain/schemas";
import { useSaveClientContact } from "../hooks";

function toForm(client: ProjectContact | undefined, defaultName: string): ClientContactValues {
  return {
    full_name: client?.contact.full_name ?? defaultName,
    phone: client?.contact.phone ?? "",
    email: client?.contact.email ?? "",
  };
}

/** The manager-only "client contact" sheet on the overview: edits (or creates) the primary client contact. */
export function ClientContactSheet({
  projectId,
  open,
  onOpenChange,
  client,
  defaultName,
}: {
  projectId: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  client: ProjectContact | undefined;
  /** Pre-fills the name when the project has no client contact yet (e.g. the invited clients' names). */
  defaultName: string;
}) {
  const { t } = useTranslation(["people", "common"]);
  const save = useSaveClientContact(projectId, client);
  const form = useZodForm(clientContactSchema, toForm(client, defaultName));

  return (
    <FormSheet
      open={open}
      onOpenChange={(v) => {
        if (v) form.reset(toForm(client, defaultName));
        onOpenChange(v);
      }}
      title={t("clientContact.title")}
      description={t("clientContact.description")}
    >
      <form
        noValidate
        className="space-y-4"
        onSubmit={form.handleSubmit((values: ClientContactValues) => save.mutate(values, { onSuccess: () => onOpenChange(false) }))}
      >
        <FormField control={form.control} name="full_name" label={t("clientContact.name")} description={t("clientContact.nameHint")}>
          {(field) => <Input autoComplete="off" {...field} />}
        </FormField>
        <FormField control={form.control} name="phone" label={t("clientContact.phone")}>
          {(field) => <Input type="tel" autoComplete="off" {...field} />}
        </FormField>
        <FormField control={form.control} name="email" label={t("clientContact.email")}>
          {(field) => <Input type="email" autoComplete="off" {...field} />}
        </FormField>
        <Button type="submit" disabled={save.isPending} className="w-full">
          {save.isPending ? t("common:state.saving") : t("clientContact.submit")}
        </Button>
      </form>
    </FormSheet>
  );
}
