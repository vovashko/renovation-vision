import { useTranslation } from "react-i18next";
import { useFormat } from "@/i18n";

/**
 * Signed text for a case's cost and time deltas: "+880,00 zł" / "−1 200,50 zł", "+4 dni" / "−3 dni",
 * and "Bez zmian" for zero. Negative values are savings / time gained, so they are shown as such, never hidden.
 */
export function useDeltaText() {
  const { t } = useTranslation(["decisions"]);
  const format = useFormat();
  return {
    money: (amount: number, currency: string) =>
      amount === 0 ? t("decisions:delta.none") : format.money(amount, currency, { signed: true }),
    days: (days: number) =>
      days === 0 ? t("decisions:delta.none") : `${days > 0 ? "+" : "−"}${t("decisions:delta.days", { count: Math.abs(days) })}`,
  };
}
