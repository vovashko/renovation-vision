// The project's lifecycle status, currency and address vocabulary (T30). Pure: no React, no Supabase.
import type { Database } from "@/domain/db.types";

export type ProjectStatus = Database["public"]["Enums"]["project_status"];

/** Every lifecycle status, in the order a project moves through them (pickers, filters). */
export const projectStatuses: ProjectStatus[] = ["planning", "active", "on_hold", "completed", "archived"];

/** Currencies the project forms offer. The column accepts any uppercase ISO 4217 code. */
export const projectCurrencies = ["PLN", "EUR"] as const;

/** Countries the address forms offer (ISO 3166-1 alpha-2), Poland first. The column accepts any code. */
export const projectCountries = ["PL", "DE", "CZ", "SK", "LT", "UA", "GB"] as const;

export const DEFAULT_COUNTRY = "PL";

/** Picker options: the offered list, plus the project's current value when it's something else (set via SQL). */
export function withCurrent<T extends string>(options: readonly T[], current: string | null | undefined): string[] {
  return current && !options.includes(current as T) ? [...options, current] : [...options];
}

/** Polish postal codes are "00-000". */
export const isPolishPostalCode = (code: string) => /^\d{2}-\d{3}$/.test(code);

/** Mirrors the generated `projects.address` column: "<line>, <postal code> <city>", skipping blanks. */
export function formatAddress({ address_line, postal_code, city }: { address_line: string; postal_code: string; city: string }): string {
  const place = `${postal_code.trim()} ${city.trim()}`.trim();
  const line = address_line.trim();
  if (!line) return place;
  return place ? `${line}, ${place}` : line;
}
