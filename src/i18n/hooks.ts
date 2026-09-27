import { useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { formatDate, formatDayLabel, type DateInput, type DateStyle } from "@/domain/dates";
import { formatMoney, type Currency, type MoneyOptions } from "@/domain/money";
import type { ScheduleStatus, Status } from "@/domain/status";
import { DEFAULT_LOCALE, isLocale, localeCookie, type Locale } from "./locale";

/** The current UI locale ("pl" | "en"). Re-renders when the language changes. */
export function useLocale(): Locale {
  const { i18n } = useTranslation();
  return isLocale(i18n.language) ? i18n.language : DEFAULT_LOCALE;
}

/**
 * Switch the UI language: remembers it in the `locale` cookie (so SSR renders the same language on
 * the next load) and re-renders every translated component in place, without a reload.
 */
export function useSetLocale(): (locale: Locale) => Promise<void> {
  const { i18n } = useTranslation();
  return useCallback(
    async (locale: Locale) => {
      document.cookie = localeCookie(locale);
      await i18n.changeLanguage(locale);
    },
    [i18n],
  );
}

export type Formatters = {
  locale: Locale;
  /** `money(12345)` → "12 345,00 zł" (pl) / "PLN 12,345.00" (en). Currency defaults to `DEFAULT_CURRENCY`. */
  money: (amount: number, currency?: Currency, opts?: MoneyOptions) => string;
  /** `date("2026-03-02", "short")` → "02 mar" / "Mar 02". Missing dates render as "—". */
  date: (d: DateInput | null | undefined, style: DateStyle) => string;
  /** "Today" / "Yesterday" / "Mon, Mar 02", localized. */
  dayLabel: (d: DateInput, today?: Date) => string;
};

/** Money and date formatters bound to the current locale (backed by `@/domain/money` and `@/domain/dates`). */
export function useFormat(): Formatters {
  const locale = useLocale();
  return useMemo(
    () => ({
      locale,
      money: (amount, currency, opts) => formatMoney(amount, currency, locale, opts),
      date: (d, style) => formatDate(d, style, locale),
      dayLabel: (d, today) => formatDayLabel(d, locale, today),
    }),
    [locale],
  );
}

/** `statusLabel("done")` → "Ukończone" / "Completed" (`common:status.*`). */
export function useStatusLabel(): (status: Status) => string {
  const { t } = useTranslation("common");
  return useCallback((status: Status) => t(`status.${status}`), [t]);
}

/** `scheduleLabel("at_risk")` → "Zagrożony" / "At risk" (`common:schedule.*`). */
export function useScheduleLabel(): (status: ScheduleStatus) => string {
  const { t } = useTranslation("common");
  return useCallback((status: ScheduleStatus) => t(`schedule.${status}`), [t]);
}
