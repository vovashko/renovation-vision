import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FieldDescription } from "@/components/ui/field";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { useZodForm } from "@/shared/hooks/use-zod-form";
import { FormField } from "@/shared/ui/form-field";
import { memberFormSchema, type MemberFormValues } from "../domain/schemas";

/** Invite-by-email row on the Team page, with a Role dropdown (a segmented control was tried; more roles may come). */
export function AddMemberForm({ onSubmit, pending }: { onSubmit: (values: MemberFormValues) => void; pending: boolean }) {
  const { t } = useTranslation(["people", "common"]);
  const form = useZodForm(memberFormSchema, { email: "", role: "client" });

  return (
    <Card className="p-5">
      <form
        noValidate
        className="grid gap-3 sm:grid-cols-[1fr_160px_auto] sm:items-end"
        onSubmit={form.handleSubmit((values) => {
          onSubmit(values);
          form.reset({ email: "", role: values.role });
        })}
      >
        <FormField control={form.control} name="email" label={t("team.addByEmail")}>
          {(field) => <Input type="email" {...field} />}
        </FormField>
        <FormField control={form.control} name="role" label={t("team.role")}>
          {(field) => (
            <NativeSelect {...field}>
              <NativeSelectOption value="client">{t("team.clientBadge")}</NativeSelectOption>
              <NativeSelectOption value="manager">{t("team.managerBadge")}</NativeSelectOption>
            </NativeSelect>
          )}
        </FormField>
        <Button type="submit" disabled={pending} className="gap-2">
          <Icon name="person_add" size={20} /> {t("team.add")}
        </Button>
      </form>
      {/* Below the whole row so the fields and the button share one baseline. */}
      <FieldDescription className="mt-2">{t("team.addByEmailHint")}</FieldDescription>
    </Card>
  );
}
