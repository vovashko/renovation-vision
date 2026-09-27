// Public i18n API. Components translate with react-i18next's `useTranslation("<namespace>")` and
// format with `useFormat()`; see README → Internationalization.
export { createI18n, type I18n } from "./instance";
export { useFormat, useLocale, useScheduleLabel, useSetLocale, useStatusLabel, type Formatters } from "./hooks";
export {
  DEFAULT_LOCALE,
  LOCALES,
  LOCALE_COOKIE,
  isLocale,
  localeCookie,
  matchLocale,
  parseAcceptLanguage,
  readCookie,
  resolveLocale,
  type Locale,
  type LocaleSources,
} from "./locale";
export { namespaces } from "./resources";
