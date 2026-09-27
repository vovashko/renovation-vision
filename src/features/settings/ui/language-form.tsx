import { useTranslation } from "react-i18next";
import { z } from "zod";
import { Card } from "@/components/ui/card";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { LOCALES, useLocale, useSetLocale } from "@/i18n";
import { useZodForm } from "@/shared/hooks/use-zod-form";
import { FormField } from "@/shared/ui/form-field";

const languageSchema = z.object({
  locale: z.enum(LOCALES, { message: "common:form.invalid" }),
});

/** Language picker on /settings. Applies on change: no reload, and the choice is remembered in a cookie. */
export function LanguageForm({ className }: { className?: string }) {
  const { t } = useTranslation(["settings", "common"]);
  const locale = useLocale();
  const setLocale = useSetLocale();
  const form = useZodForm(languageSchema, { locale });
  const apply = form.handleSubmit((values) => setLocale(values.locale));

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
