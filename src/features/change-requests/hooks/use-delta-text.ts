import { useTranslation } from "react-i18next";
import { useFormat } from "@/i18n";

/**
 * Signed text for a change request's cost and day changes: "+880,00 zł" / "−1 200,50 zł", "+4 dni" / "−3 dni",
 * and "Bez zmian" for zero. Negative values are savings / time gained, so they are shown as such, never hidden.
 */
export function useDeltaText() {
  const { t } = useTranslation(["change-requests"]);
  const format = useFormat();
  return {
    money: (amount: number, currency: string) =>
      amount === 0 ? t("change-requests:delta.none") : format.money(amount, currency, { signed: true }),
    days: (days: number) =>
      days === 0 ? t("change-requests:delta.none") : `${days > 0 ? "+" : "−"}${t("change-requests:delta.days", { count: Math.abs(days) })}`,
  };
}
