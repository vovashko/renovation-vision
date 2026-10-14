/** An error whose user-facing text is a translation key (`namespace:path`), resolved where the UI toasts it. */
export class TranslatedError extends Error {
  readonly i18nKey: string;

  constructor(i18nKey: string, message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "TranslatedError";
    this.i18nKey = i18nKey;
  }
}

/** The translation key a `TranslatedError` carries, or undefined for any other error. */
export function translatedErrorKey(error: unknown): string | undefined {
  return error instanceof TranslatedError ? error.i18nKey : undefined;
}
