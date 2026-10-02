import { useTranslation } from "react-i18next";
import { z } from "zod";
import { Card } from "@/components/ui/card";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { useSaveLocale } from "@/features/settings/hooks/use-profile";
import { LOCALES, useLocale } from "@/i18n";
import { useZodForm } from "@/shared/hooks/use-zod-form";
import { FormField } from "@/shared/ui/form-field";

const languageSchema = z.object({
  locale: z.enum(LOCALES, { message: "common:form.invalid" }),
});

/**
 * Language picker on /settings. Applies on change, without a reload, and saves the choice on the
 * profile (`profiles.locale`, which the server renders in), in the cookie and in
 * `user_metadata.locale` for the hosted auth emails (see useSaveLocale).
 */
export function LanguageForm({ className }: { className?: string }) {
  const { t } = useTranslation(["settings", "common"]);
  const locale = useLocale();
  const saveLocale = useSaveLocale();
  const form = useZodForm(languageSchema, { locale });
  const apply = form.handleSubmit((values) => saveLocale(values.locale));

  return (
    <Card className={className}>
      <form noValidate onSubmit={apply} className="p-5">
        <FormField control={form.control} name="locale" label={t("language.title")} description={t("language.description")}>
          {(field) => (
            <NativeSelect
              {...field}
              onChange={(e) => {
                field.onChange(e);
                void apply();
              }}
            >
              {LOCALES.map((l) => (
                <NativeSelectOption key={l} value={l} lang={l}>
                  {t(`common:language.${l}`)}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          )}
        </FormField>
      </form>
    </Card>
  );
}
