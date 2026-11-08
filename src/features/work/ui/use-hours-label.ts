import { useTranslation } from "react-i18next";
import { useFormat } from "@/i18n";

/** "2,5 h" / "2.5 h": hours in the current locale. */
export function useHoursLabel() {
  const { t } = useTranslation(["work"]);
  const { locale } = useFormat();
  return (hours: number) => t("work:diary.hours", { hours: new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(hours) });
}
