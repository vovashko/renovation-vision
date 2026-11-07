import { useTranslation } from "react-i18next";
import { FormSheet } from "@/shared/ui/form-sheet";
import { DiaryEntryForm } from "./diary-entry-form";
import type { ProgressEntry, Room, Stage } from "@/lib/database.types";

/**
 * The diary entry panel. `entry` doubles as the open flag, like `ExpenseSheet`: "new" opens an empty form,
 * an entry opens it for editing, null keeps it closed.
 */
export function DiaryEntrySheet({
  projectId,
  entry,
  stages,
  rooms,
  onClose,
}: {
  projectId: string;
  entry: ProgressEntry | "new" | null;
  stages: Stage[];
  rooms: Room[];
  onClose: () => void;
}) {
  const { t } = useTranslation(["work"]);
  const editing = entry && entry !== "new" ? entry : undefined;
  return (
    <FormSheet
      open={entry !== null}
      onOpenChange={(open) => !open && onClose()}
      title={editing ? t("work:diary.sheet.editTitle") : t("work:diary.sheet.newTitle")}
      description={t("work:diary.sheet.description")}
    >
      {entry && (
        <DiaryEntryForm key={editing?.id ?? "new"} projectId={projectId} entry={editing} stages={stages} rooms={rooms} onSaved={onClose} />
      )}
    </FormSheet>
  );
}
