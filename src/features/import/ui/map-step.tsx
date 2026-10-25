import { useId } from "react";
import { useTranslation } from "react-i18next";
import { Field, FieldLabel } from "@/components/ui/field";
import { NativeSelect } from "@/components/ui/native-select";
import { Note } from "@/components/ui/note";
import { useFieldLabel } from "../hooks/use-field-label";
import { FIELDS, type FieldDef } from "../domain/fields";
import type { ColumnMapping, ImportKind, Sheet } from "../domain/types";

function MapRow({
  field,
  sheet,
  value,
  onChange,
}: {
  field: FieldDef;
  sheet: Sheet;
  value: number | null;
  onChange: (index: number | null) => void;
}) {
  const { t } = useTranslation(["import"]);
  const label = useFieldLabel();
  const id = useId();
  return (
    <Field>
      <FieldLabel htmlFor={id}>
        {label(field.key)}
        {field.required && <span className="text-on-surface-variant"> ({t("import:map.required")})</span>}
      </FieldLabel>
      <NativeSelect id={id} value={value ?? ""} onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}>
        <option value="">{t("import:map.notMapped")}</option>
        {sheet.headers.map((header, index) => (
          <option key={index} value={index}>
            {header || `#${index + 1}`}
          </option>
        ))}
      </NativeSelect>
    </Field>
  );
}

export function MapStep({
  kind,
  sheet,
  fileName,
  mapping,
  missing,
  onChange,
}: {
  kind: ImportKind;
  sheet: Sheet;
  fileName: string;
  mapping: ColumnMapping;
  missing: FieldDef[];
  onChange: (mapping: ColumnMapping) => void;
}) {
  const { t } = useTranslation(["import"]);
  const label = useFieldLabel();
  return (
    <div className="space-y-4">
      <p className="text-body-md text-on-surface-variant">{t("import:map.description", { file: fileName })}</p>
      {FIELDS[kind].map((field) => (
        <MapRow
          key={field.key}
          field={field}
          sheet={sheet}
          value={mapping[field.key] ?? null}
          onChange={(index) => onChange({ ...mapping, [field.key]: index })}
        />
      ))}
      {missing.length > 0 && (
        <Note tone="error" size="sm">
          {t("import:map.missing", { fields: missing.map((f) => label(f.key)).join(", ") })}
        </Note>
      )}
    </div>
  );
}
