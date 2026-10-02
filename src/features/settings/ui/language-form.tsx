import { useTranslation } from "react-i18next";
import { z } from "zod";
import { Card } from "@/components/ui/card";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { updateUserLocale } from "@/features/auth/hooks";
import { LOCALES, useLocale, useSetLocale } from "@/i18n";
import { useZodForm } from "@/shared/hooks/use-zod-form";
import { FormField } from "@/shared/ui/form-field";

const languageSchema = z.object({
  locale: z.enum(LOCALES, { message: "common:form.invalid" }),
});

/**
 * Language picker on /settings. Applies on change: no reload, the choice is remembered in a cookie,
 * and it's mirrored onto `user_metadata.locale` (best-effort — the cookie switch already applied)
 * so the hosted auth emails pick it up too.
 */
export function LanguageForm({ className }: { className?: string }) {
  const { t } = useTranslation(["settings", "common"]);
  const locale = useLocale();
  const setLocale = useSetLocale();
  const form = useZodForm(languageSchema, { locale });
  const apply = form.handleSubmit(async (values) => {
    await setLocale(values.locale);
    await updateUserLocale(values.locale).catch(() => {
      // Best-effort: the UI already switched language via the cookie; a failed metadata sync just
      // means a hosted auth email may render in the previous language until the next change.
    });
  });

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
