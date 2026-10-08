import { useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { FormSheet } from "@/shared/ui/form-sheet";
import { useConfirm } from "@/shared/ui/use-confirm";
import { isWarningOpen } from "@/domain/room-warnings";
import { useDeleteWarning } from "../hooks/room-view";
import { MaterialStatusChip } from "./material-row";
import { useMaterialDateLabel } from "./use-material-date-label";
import { WarningForm } from "./warning-form";
import type { RoomMaterial, RoomWarning } from "@/lib/database.types";

/** The materials a warning is linked to, with their status and date, as the room's materials list knows them. */
function linkedMaterials(warning: RoomWarning, materials: RoomMaterial[]): RoomMaterial[] {
  return materials.filter((m) => warning.material_ids.includes(m.id));
}

function WarningCard({
  warning,
  materials,
  actions,
  resolved,
}: {
  warning: RoomWarning;
  materials: RoomMaterial[];
  actions?: ReactNode;
  resolved: boolean;
}) {
  const { t } = useTranslation("work");
  const dateLabel = useMaterialDateLabel();
  const linked = linkedMaterials(warning, materials);
  return (
    <Card attention={!resolved} className="px-5 py-4">
      <div className="flex flex-wrap items-start justify-between gap-2 pr-4">
        <h3 className="flex items-center gap-2 text-title-md">
          <Icon name="warning" size={20} className="text-attention" /> {t("warnings.title")}
        </h3>
        <div className="flex items-center gap-1">
          {resolved && (
            <Badge variant="status-done" size="compact">
              {t("warnings.resolved")}
            </Badge>
          )}
          {actions}
        </div>
      </div>
      <p className="mt-2 text-body-lg whitespace-pre-line text-on-surface">{warning.text}</p>
      {linked.length > 0 && (
        <ul className="mt-3 space-y-2">
          {linked.map((m) => {
            const label = dateLabel(m);
            return (
              <li key={m.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 text-body-md">
                <span className="text-on-surface">{m.name}</span>
                <MaterialStatusChip status={m.status} />
                {label && <span className="text-on-surface-variant">{label}</span>}
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

/**
 * "Uwaga do inwestora": risk notes about a room. Clients get only the open ones (the database filters them);
 * managers get every warning, the resolved ones marked, and can write, edit and remove them. A warning is
 * informational: it never changes a date.
 */
export function RoomWarnings({
  projectId,
  roomId,
  warnings,
  materials,
  isManager,
}: {
  projectId: string;
  roomId: string;
  warnings: RoomWarning[];
  materials: RoomMaterial[];
  isManager: boolean;
}) {
  const { t } = useTranslation(["work", "common"]);
  const confirm = useConfirm();
  const remove = useDeleteWarning(projectId);
  // null: the sheet is closed; `{}`: writing a warning; `{ warning }`: editing one.
  const [editing, setEditing] = useState<{ warning?: RoomWarning } | null>(null);

  const statusOf = (w: RoomWarning) => linkedMaterials(w, materials).map((m) => m.status);
  const visible = isManager ? warnings : warnings.filter((w) => isWarningOpen(statusOf(w)));

  const onRemove = async (w: RoomWarning) => {
    const ok = await confirm({ title: t("work:warnings.removeConfirmTitle"), destructive: true });
    if (ok) remove.mutate(w.id);
  };

  if (!isManager && visible.length === 0) return null;

  return (
    <section aria-labelledby="room-warnings-heading" className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="room-warnings-heading" className="text-title-lg">
          {t("work:warnings.heading")}
        </h2>
        {isManager && (
          <Button variant="outline" onClick={() => setEditing({})} className="min-h-11 gap-2">
            <Icon name="add" size={20} /> {t("work:warnings.add")}
          </Button>
        )}
      </div>
      {visible.length === 0 && <p className="text-body-md text-on-surface-variant">{t("work:warnings.empty")}</p>}
      {visible.map((w) => (
        <WarningCard
          key={w.id}
          warning={w}
          materials={materials}
          resolved={!isWarningOpen(statusOf(w))}
          actions={
            isManager && (
              <>
                <Button variant="ghost" size="icon" onClick={() => setEditing({ warning: w })} aria-label={t("work:warnings.edit")}>
                  <Icon name="edit" size={20} />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => onRemove(w)} aria-label={t("work:warnings.remove")}>
                  <Icon name="delete" size={20} />
                </Button>
              </>
            )
          }
        />
      ))}
      {isManager && (
        <FormSheet
          open={editing !== null}
          onOpenChange={(open) => !open && setEditing(null)}
          title={editing?.warning ? t("work:warnings.editTitle") : t("work:warnings.addTitle")}
          description={t("work:warnings.formDescription")}
        >
          {editing !== null && (
            <WarningForm
              key={editing.warning?.id}
              projectId={projectId}
              roomId={roomId}
              warning={editing.warning}
              materials={materials}
              onSaved={() => setEditing(null)}
            />
          )}
        </FormSheet>
      )}
    </section>
  );
}
