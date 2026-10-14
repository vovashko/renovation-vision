import { useTranslation } from "react-i18next";
import { FileInput } from "@/components/ui/file-input";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Note } from "@/components/ui/note";
import type { ImportFileError } from "../domain/parse";
import type { ImportKind } from "../domain/types";

const FORMATS = ["csv", "xlsx"] as const;

/** Links to the blank templates (English and Polish headers) in public/templates. */
function TemplateLinks({ kind }: { kind: ImportKind }) {
  const { t } = useTranslation(["import"]);
  return (
    <div className="space-y-1">
      <p className="text-label-lg">{t("import:pick.templates")}</p>
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-body-md text-primary underline">
        {FORMATS.map((format) => (
          <li key={`en-${format}`}>
            <a href={`/templates/${kind}.${format}`} download>
              {t("import:pick.templateEn", { format: format.toUpperCase() })}
            </a>
          </li>
        ))}
        {FORMATS.map((format) => (
          <li key={`pl-${format}`}>
            <a href={`/templates/${kind}.pl.${format}`} download>
              {t("import:pick.templatePl", { format: format.toUpperCase() })}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function PickStep({
  kind,
  reading,
  error,
  onPick,
}: {
  kind: ImportKind;
  reading: boolean;
  error: ImportFileError["code"] | null;
  onPick: (file: File) => void;
}) {
  const { t } = useTranslation(["import"]);
  return (
    <div className="space-y-4">
      {kind === "stages" && <Note size="sm">{t("import:stagesHelp")}</Note>}
      <Field>
        <FieldLabel htmlFor="import-file">{t("import:pick.label")}</FieldLabel>
        <FileInput
          id="import-file"
          accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          disabled={reading}
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) onPick(file);
          }}
        />
        <FieldDescription>{reading ? t("import:pick.reading") : t("import:pick.hint")}</FieldDescription>
      </Field>
      {error && (
        <Note tone="error" size="sm">
          {t(`import:fileErrors.${error}`)}
        </Note>
      )}
      <TemplateLinks kind={kind} />
    </div>
  );
}
