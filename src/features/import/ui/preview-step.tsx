import { useTranslation } from "react-i18next";
import { Note } from "@/components/ui/note";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { issueKey } from "../hooks/use-import-flow";
import type { ImportIssue } from "../domain/types";
import type { AnyValidation } from "../domain/validate";
import { useFieldLabel } from "../hooks/use-field-label";

const PREVIEW_ROWS = 8;
const LISTED_ISSUES = 30;

function IssueList({ issues }: { issues: ImportIssue[] }) {
  const { t } = useTranslation(["import"]);
  const label = useFieldLabel();
  return (
    <Note tone="error" size="sm">
      <p>{t("import:preview.problems", { count: issues.length })}</p>
      <ul className="mt-2 list-disc space-y-1 pl-5">
        {issues.slice(0, LISTED_ISSUES).map((issue, i) => (
          <li key={i}>
            {t("import:preview.row", { row: issue.row })}: {issue.field ? `${label(issue.field)} ` : ""}
            {t(`import:issues.${issueKey(issue.code)}`)}
          </li>
        ))}
      </ul>
      {issues.length > LISTED_ISSUES && <p className="mt-2">{t("import:preview.moreRows", { count: issues.length - LISTED_ISSUES })}</p>}
      <p className="mt-2">{t("import:preview.problemsHint")}</p>
    </Note>
  );
}

function PreviewTable({ validation }: { validation: AnyValidation }) {
  const { t } = useTranslation(["import"]);
  if (validation.kind === "stages") {
    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("import:preview.stageColumn")}</TableHead>
            <TableHead>{t("import:fields.start_date")}</TableHead>
            <TableHead>{t("import:fields.end_date")}</TableHead>
            <TableHead>{t("import:preview.tasksColumn")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {validation.rows.slice(0, PREVIEW_ROWS).map((stage, i) => (
            <TableRow key={i}>
              <TableCell>{stage.name}</TableCell>
              <TableCell>{stage.start_date}</TableCell>
              <TableCell>{stage.end_date}</TableCell>
              <TableCell>{stage.tasks.length}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
  }
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{t("import:fields.name")}</TableHead>
          <TableHead>{t("import:fields.quantity")}</TableHead>
          <TableHead>{t("import:fields.unit")}</TableHead>
          <TableHead>{t("import:fields.unit_price")}</TableHead>
          <TableHead>{t("import:fields.room")}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {validation.rows.slice(0, PREVIEW_ROWS).map((m, i) => (
          <TableRow key={i}>
            <TableCell>{m.name}</TableCell>
            <TableCell>{m.quantity ?? ""}</TableCell>
            <TableCell>{m.unit}</TableCell>
            <TableCell>{m.unit_price ?? ""}</TableCell>
            <TableCell>{m.room}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export function PreviewStep({ validation, issues }: { validation: AnyValidation; issues: ImportIssue[] }) {
  const { t } = useTranslation(["import"]);
  const tasks = validation.kind === "stages" ? validation.rows.reduce((sum, s) => sum + s.tasks.length, 0) : 0;
  return (
    <div className="space-y-4">
      {issues.length > 0 && <IssueList issues={issues} />}
      {issues.length === 0 && (
        <Note tone="success" size="sm">
          {validation.kind === "stages"
            ? t("import:preview.summaryStages", { stages: validation.rows.length, tasks })
            : t("import:preview.summaryMaterials", { count: validation.rows.length })}
        </Note>
      )}
      {validation.rows.length > 0 && <PreviewTable validation={validation} />}
      {validation.rows.length > PREVIEW_ROWS && (
        <p className="text-body-sm text-on-surface-variant">
          {t("import:preview.moreRows", { count: validation.rows.length - PREVIEW_ROWS })}
        </p>
      )}
    </div>
  );
}
