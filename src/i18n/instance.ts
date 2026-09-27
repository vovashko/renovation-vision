import i18next, { type i18n as I18n } from "i18next";
import { DEFAULT_LOCALE, LOCALES, type Locale } from "./locale";
import { namespaces, resources } from "./resources";

export type { I18n };

/**
 * A fresh i18next instance with every namespace bundled. Created once per router — so once per
 * request on the server (no shared mutable singleton across Worker requests) and once in the
 * browser. Never use the global `i18next` default instance or `initReactI18next`; components get
 * the instance from `<I18nextProvider>` in `__root.tsx`.
 *
 * Initialization is synchronous (bundled resources, `initAsync: false`), so the instance is ready
 * to translate as soon as this returns.
 */
export function createI18n(locale: Locale = DEFAULT_LOCALE): I18n {
  const instance = i18next.createInstance();
  void instance.init({
    resources,
    lng: locale,
    supportedLngs: [...LOCALES],
    // English is the source language every key is written in first.
    fallbackLng: "en",
    ns: namespaces,
    defaultNS: "common",
    interpolation: { escapeValue: false }, // React escapes
    initAsync: false,
    returnNull: false,
    react: { useSuspense: false },
  });
  return instance;
}
