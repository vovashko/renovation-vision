import type { Control } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { FieldGroup } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { FormField } from "@/shared/ui/form-field";
import type { NewPasswordValues } from "../domain/schemas";

/** "New password" + "Repeat it", with the rules as the hint (shared by reset and Settings → Security). */
export function NewPasswordFields({ control }: { control: Control<NewPasswordValues, unknown, NewPasswordValues> }) {
  const { t } = useTranslation(["auth"]);
  return (
    <FieldGroup>
      <FormField control={control} name="password" label={t("password.new")} description={t("password.rules")}>
        {(field) => <Input type="password" autoComplete="new-password" {...field} />}
      </FormField>
      <FormField control={control} name="confirm" label={t("password.confirm")}>
        {(field) => <Input type="password" autoComplete="new-password" {...field} />}
      </FormField>
    </FieldGroup>
  );
}
