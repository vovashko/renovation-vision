import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import type { ImportKind } from "../domain/types";
import { ImportSheet } from "./import-sheet";

/** The page-header entry point: a button that opens the import wizard for stages or materials. */
function ImportButton({ projectId, kind }: { projectId: string; kind: ImportKind }) {
  const { t } = useTranslation(["import"]);
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)} className="min-h-11 gap-2">
        <Icon name="upload_file" size={20} /> {t(`import:button.${kind}`)}
      </Button>
      <ImportSheet projectId={projectId} kind={kind} open={open} onOpenChange={setOpen} />
    </>
  );
}

const STAGES: ImportKind = "stages";
const MATERIALS: ImportKind = "materials";

export const StagesImportButton = ({ projectId }: { projectId: string }) => <ImportButton projectId={projectId} kind={STAGES} />;
export const MaterialsImportButton = ({ projectId }: { projectId: string }) => <ImportButton projectId={projectId} kind={MATERIALS} />;
