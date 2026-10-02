import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { Control } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { useLocale } from "@/i18n";
import { FormField } from "@/shared/ui/form-field";
import { projectCountries, projectCurrencies, projectStatuses, withCurrent, type ProjectStatus } from "../domain/project-fields";
import { useProjectStatusLabel } from "../hooks";

/** The fields both project forms share. */
type Shape = { address_line: string; postal_code: string; city: string; country: string; currency: string; status: ProjectStatus };

/** Country names in the UI language ("Polska" / "Poland"), from the browser's own data: no strings to translate. */
function useCountryName(): (code: string) => string {
  const locale = useLocale();
  return useMemo(() => {
    const names = new Intl.DisplayNames([locale], { type: "region" });
    return (code: string) => names.of(code) ?? code;
  }, [locale]);
}

/**
 * The structured address (line, postal code, city, country), currency and lifecycle status, for the
 * "New project" and "Project details" forms. `current` keeps a value outside the offered lists selectable.
 */
export function ProjectFields<T extends Shape, U>({
  control,
  current,
  size,
}: {
  control: Control<T, unknown, U>;
  current?: { country: string; currency: string };
  /** "lg" for the details sheet's 44px inputs. */
  size?: "lg";
}) {
  const { t } = useTranslation(["projects", "common"]);
  const statusLabel = useProjectStatusLabel();
  const countryName = useCountryName();
  // Both forms carry these fields; FormField's name checks need the narrower shape.
  const c = control as unknown as Control<Shape>;
  const inputClass = size === "lg" ? "h-11" : undefined;

  return (
    <>
      <FormField control={c} name="address_line" label={t("fields.addressLine")}>
        {(field) => <Input autoComplete="off" placeholder={t("fields.addressLinePlaceholder")} {...field} className={inputClass} />}
      </FormField>
      <div className="grid grid-cols-[8rem_1fr] gap-3">
        <FormField control={c} name="postal_code" label={t("fields.postalCode")}>
          {(field) => (
            <Input
              autoComplete="off"
              inputMode="numeric"
              placeholder={t("fields.postalCodePlaceholder")}
              {...field}
              className={inputClass}
            />
          )}
        </FormField>
        <FormField control={c} name="city" label={t("fields.city")}>
          {(field) => <Input autoComplete="off" {...field} className={inputClass} />}
        </FormField>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <FormField control={c} name="country" label={t("fields.country")}>
          {(field) => (
            <NativeSelect {...field}>
              {withCurrent(projectCountries, current?.country).map((code) => (
                <NativeSelectOption key={code} value={code}>
                  {countryName(code)}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          )}
        </FormField>
        <FormField control={c} name="currency" label={t("fields.currency")}>
          {(field) => (
            <NativeSelect {...field}>
              {withCurrent(projectCurrencies, current?.currency).map((code) => (
                <NativeSelectOption key={code} value={code}>
                  {code}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          )}
        </FormField>
      </div>
      <FormField control={c} name="status" label={t("fields.status")} description={t("fields.statusHint")}>
        {(field) => (
          <NativeSelect {...field}>
            {projectStatuses.map((s) => (
              <NativeSelectOption key={s} value={s}>
                {statusLabel(s)}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        )}
      </FormField>
    </>
  );
}
