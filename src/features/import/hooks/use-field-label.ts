import { useTranslation } from "react-i18next";

const KNOWN = [
  "name",
  "start_date",
  "end_date",
  "client_note",
  "task",
  "room",
  "quantity",
  "unit",
  "unit_price",
  "status",
  "stage",
  "supplier",
  "notes",
] as const;

/** The translated name of an importable field (`import:fields.*`); the key itself when unknown. */
export function useFieldLabel(): (key: string) => string {
  const { t } = useTranslation(["import"]);
  return (key) => ((KNOWN as readonly string[]).includes(key) ? t(`import:fields.${key as (typeof KNOWN)[number]}`) : key);
}
