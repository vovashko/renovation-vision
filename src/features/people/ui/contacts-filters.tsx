import { useId } from "react";
import { useTranslation } from "react-i18next";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import type { ContactKind } from "@/lib/database.types";
import { CONTACT_KINDS, type ContactFilters } from "../domain/contact-book";

/** Search box plus the kind and trade filters of the contacts page. */
export function ContactFilterBar({
  filters,
  trades,
  onChange,
}: {
  filters: ContactFilters;
  trades: string[];
  onChange: (patch: Partial<ContactFilters>) => void;
}) {
  const { t } = useTranslation(["people"]);
  const id = useId();
  return (
    <div className="grid gap-3 sm:grid-cols-[2fr_1fr_1fr]">
      <Field>
        <FieldLabel htmlFor={`${id}-q`}>{t("contacts.search")}</FieldLabel>
        <Input
          id={`${id}-q`}
          type="search"
          autoComplete="off"
          placeholder={t("contacts.searchPlaceholder")}
          value={filters.query}
          onChange={(e) => onChange({ query: e.target.value })}
        />
      </Field>
      <Field>
        <FieldLabel htmlFor={`${id}-kind`}>{t("contacts.kindFilter")}</FieldLabel>
        <NativeSelect id={`${id}-kind`} value={filters.kind} onChange={(e) => onChange({ kind: e.target.value as ContactKind | "" })}>
          <option value="">{t("contacts.allKinds")}</option>
          {CONTACT_KINDS.map((kind) => (
            <option key={kind} value={kind}>
              {t(`contacts.kind.${kind}`)}
            </option>
          ))}
        </NativeSelect>
      </Field>
      <Field>
        <FieldLabel htmlFor={`${id}-trade`}>{t("contacts.tradeFilter")}</FieldLabel>
        <NativeSelect id={`${id}-trade`} value={filters.trade} onChange={(e) => onChange({ trade: e.target.value })}>
          <option value="">{t("contacts.allTrades")}</option>
          {trades.map((trade) => (
            <option key={trade} value={trade}>
              {trade}
            </option>
          ))}
        </NativeSelect>
      </Field>
    </div>
  );
}
