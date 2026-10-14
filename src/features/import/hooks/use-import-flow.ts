import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { keys } from "@/shared/query-keys";
import { useMutationWithToast } from "@/shared/hooks/use-mutation-with-toast";
import { importRows } from "@/server/functions/import";
import { isServerFnError } from "@/server/errors";
import { autoMap, applyMapping, missingRequired } from "../domain/map";
import { ImportFileError, readSheetFile } from "../domain/parse";
import { issuesToSheet } from "../domain/rpc-errors";
import type { ColumnMapping, ImportIssue, ImportKind, Sheet } from "../domain/types";
import { validateRows } from "../domain/validate";

export type ImportStep = "pick" | "map" | "preview" | "done";

const KNOWN_ISSUES = [
  "required",
  "too_long",
  "invalid_date",
  "end_before_start",
  "dates_differ",
  "task_without_stage",
  "not_a_number",
  "must_be_positive",
  "must_not_be_negative",
  "too_large",
  "invalid_status",
  "invalid_unit",
  "not_found",
  "ambiguous",
  "room_not_found",
  "room_ambiguous",
  "too_many_rows",
] as const;

/** The `import:issues.*` key for an issue code from the browser or the database; unknown codes fall back to "invalid". */
export const issueKey = (code: string) =>
  (KNOWN_ISSUES as readonly string[]).includes(code) ? (code as (typeof KNOWN_ISSUES)[number]) : "invalid";

/** The state machine behind the import sheet: pick a file → map columns → preview → import. */
export function useImportFlow(projectId: string, kind: ImportKind) {
  const { t } = useTranslation(["import", "common"]);
  const [step, setStep] = useState<ImportStep>("pick");
  const [fileName, setFileName] = useState("");
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [mapping, setMapping] = useState<ColumnMapping>({});
  const [fileError, setFileError] = useState<ImportFileError["code"] | null>(null);
  const [reading, setReading] = useState(false);
  const [serverIssues, setServerIssues] = useState<ImportIssue[]>([]);

  const missing = useMemo(() => missingRequired(mapping, kind), [mapping, kind]);
  const validation = useMemo(
    () => (sheet && missing.length === 0 && step !== "pick" ? validateRows(kind, applyMapping(sheet, mapping, kind)) : null),
    [sheet, mapping, kind, missing.length, step],
  );

  const reset = useCallback(() => {
    setStep("pick");
    setFileName("");
    setSheet(null);
    setMapping({});
    setFileError(null);
    setServerIssues([]);
  }, []);

  const pickFile = useCallback(
    async (file: File) => {
      setFileError(null);
      setReading(true);
      try {
        const next = await readSheetFile(file);
        setSheet(next);
        setFileName(file.name);
        setMapping(autoMap(next.headers, kind));
        setServerIssues([]);
        setStep("map");
      } catch (e) {
        setFileError(e instanceof ImportFileError ? e.code : "unreadable");
      } finally {
        setReading(false);
      }
    },
    [kind],
  );

  const mutation = useMutationWithToast(
    async () => {
      if (!validation || validation.issues.length > 0 || validation.rows.length === 0) throw new Error(t("import:errors.notReady"));
      const data =
        validation.kind === "stages"
          ? { projectId, kind: "stages" as const, rows: validation.rows }
          : { projectId, kind: "materials" as const, rows: validation.rows };
      try {
        return await importRows({ data });
      } catch (e) {
        if (isServerFnError(e) && e.issues?.length) setServerIssues(issuesToSheet(e.issues, validation.sources));
        throw e;
      }
    },
    {
      invalidate: [keys.stages(projectId), keys.roomView(projectId), keys.project(projectId), keys.activity(projectId)],
      error: (e) => {
        if (isServerFnError(e) && e.reason === "import_invalid_rows") return t("import:errors.rowsRejected");
        if (isServerFnError(e) && e.reason === "import_forbidden") return t("import:errors.forbidden");
        if (isServerFnError(e) && e.code === "RATE_LIMITED") return t("import:errors.rateLimited");
        return t("common:errors.generic");
      },
      onSuccess: () => setStep("done"),
    },
  );

  const issues = useMemo(() => [...(validation?.issues ?? []), ...serverIssues].sort((a, b) => a.row - b.row), [validation, serverIssues]);

  return {
    step,
    goToMap: () => setStep("map"),
    goToPreview: () => setStep("preview"),
    fileName,
    sheet,
    mapping,
    setMapping,
    missing,
    validation,
    issues,
    fileError,
    reading,
    pickFile,
    reset,
    submit: mutation.mutate,
    submitting: mutation.isPending,
    result: mutation.data,
  };
}
