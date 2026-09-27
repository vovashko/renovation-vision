import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormSheet } from "@/shared/ui/form-sheet";
import { useZodForm } from "@/shared/hooks/use-zod-form";
import { FormField } from "@/shared/ui/form-field";
import { useUpdateClientContact } from "@/features/projects/hooks";
import { clientContactSchema, type ClientContactValues } from "../domain/schemas";
import type { ClientContact } from "./client-card";

/** The manager-only "client contact" sheet on the overview. */
export function ClientContactSheet({
  projectId,
  open,
  onOpenChange,
  contact,
}: {
  projectId: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  contact: ClientContact | undefined;
}) {
  const { t } = useTranslation(["people", "common"]);
  const save = useUpdateClientContact(projectId);
  const form = useZodForm(clientContactSchema, { client_phone: contact?.client_phone ?? "", client_email: contact?.client_email ?? "" });

  return (
    <FormSheet
      open={open}
      onOpenChange={(v) => {
        if (v) form.reset({ client_phone: contact?.client_phone ?? "", client_email: contact?.client_email ?? "" });
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
        <FormField control={form.control} name="client_phone" label={t("clientContact.phone")}>
          {(field) => <Input type="tel" autoComplete="off" {...field} />}
        </FormField>
        <FormField control={form.control} name="client_email" label={t("clientContact.email")}>
          {(field) => <Input type="email" autoComplete="off" {...field} />}
        </FormField>
        <Button type="submit" disabled={save.isPending} className="w-full">
          {save.isPending ? t("common:state.saving") : t("clientContact.submit")}
        </Button>
      </form>
    </FormSheet>
  );
}
