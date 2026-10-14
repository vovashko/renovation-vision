import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Note } from "@/components/ui/note";
import { FormSheet } from "@/shared/ui/form-sheet";
import { useImportFlow } from "../hooks/use-import-flow";
import type { ImportKind } from "../domain/types";
import { MapStep } from "./map-step";
import { PickStep } from "./pick-step";
import { PreviewStep } from "./preview-step";

/** The import wizard in a sheet: pick a file, match columns, check the rows, import. */
export function ImportSheet({
  projectId,
  kind,
  open,
  onOpenChange,
}: {
  projectId: string;
  kind: ImportKind;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation(["import"]);
  const flow = useImportFlow(projectId, kind);
  const { step, validation, issues } = flow;

  const close = (next: boolean) => {
    onOpenChange(next);
    if (!next) flow.reset();
  };

  return (
    <FormSheet open={open} onOpenChange={close} title={t(`import:title.${kind}`)} description={t(`import:description.${kind}`)}>
      <div className="space-y-6 py-4">
        {step === "pick" && (
          <PickStep kind={kind} reading={flow.reading} error={flow.fileError} onPick={(file) => void flow.pickFile(file)} />
        )}
        {step === "map" && flow.sheet && (
          <MapStep
            kind={kind}
            sheet={flow.sheet}
            fileName={flow.fileName}
            mapping={flow.mapping}
            missing={flow.missing}
            onChange={flow.setMapping}
          />
        )}
        {step === "preview" && validation && <PreviewStep validation={validation} issues={issues} />}
        {step === "done" && flow.result && (
          <Note tone="success">
            {flow.result.kind === "stages"
              ? t("import:done.stages", { stages: flow.result.inserted, tasks: flow.result.insertedTasks })
              : t("import:done.materials", { count: flow.result.inserted })}
          </Note>
        )}

        <div className="flex flex-wrap justify-end gap-2">
          {step === "map" && (
            <>
              <Button variant="outline" onClick={flow.reset}>
                {t("import:actions.back")}
              </Button>
              <Button disabled={flow.missing.length > 0} onClick={() => flow.goToPreview()}>
                {t("import:actions.next")}
              </Button>
            </>
          )}
          {step === "preview" && (
            <>
              <Button variant="outline" onClick={() => flow.goToMap()}>
                {t("import:actions.back")}
              </Button>
              <Button
                loading={flow.submitting}
                disabled={issues.length > 0 || !validation || validation.rows.length === 0}
                onClick={() => flow.submit()}
              >
                {flow.submitting ? t("import:actions.importing") : t("import:actions.import")}
              </Button>
            </>
          )}
          {step === "done" && (
            <>
              <Button variant="outline" onClick={flow.reset}>
                {t("import:actions.another")}
              </Button>
              <Button onClick={() => close(false)}>{t("import:actions.done")}</Button>
            </>
          )}
        </div>
      </div>
    </FormSheet>
  );
}
