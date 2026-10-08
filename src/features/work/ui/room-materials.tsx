import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { FormSheet } from "@/shared/ui/form-sheet";
import { useConfirm } from "@/shared/ui/use-confirm";
import { useDeleteMaterial } from "../hooks/room-view";
import { MaterialForm } from "./material-form";
import { MaterialRow } from "./material-row";
import type { RoomMaterial } from "@/lib/database.types";

/** The room's materials with their delivery status. Managers add, edit and remove; clients only read. */
export function RoomMaterials({
  projectId,
  roomId,
  materials,
  isManager,
}: {
  projectId: string;
  roomId: string;
  materials: RoomMaterial[];
  isManager: boolean;
}) {
  const { t } = useTranslation(["work", "common"]);
  const confirm = useConfirm();
  const remove = useDeleteMaterial(projectId);
  // null: the sheet is closed; `{}`: adding a material; `{ material }`: editing one.
  const [editing, setEditing] = useState<{ material?: RoomMaterial } | null>(null);

  const onRemove = async (m: RoomMaterial) => {
    const ok = await confirm({ title: t("work:materials.removeConfirmTitle", { name: m.name }), destructive: true });
    if (ok) remove.mutate(m.id);
  };

  return (
    <section aria-labelledby="room-materials-heading">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="room-materials-heading" className="text-title-lg">
          {t("work:materials.heading")}
        </h2>
        {isManager && (
          <Button variant="outline" onClick={() => setEditing({})} className="min-h-11 gap-2">
            <Icon name="add" size={20} /> {t("work:materials.add")}
          </Button>
        )}
      </div>
      {materials.length === 0 ? (
        <p className="mt-3 text-body-md text-on-surface-variant">{t("work:materials.empty")}</p>
      ) : (
        <ul className="mt-2 divide-y divide-outline-variant">
          {materials.map((m) => (
            <MaterialRow
              key={m.id}
              material={m}
              actions={
                isManager && (
                  <>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setEditing({ material: m })}
                      aria-label={t("work:materials.edit", { name: m.name })}
                    >
                      <Icon name="edit" size={20} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onRemove(m)}
                      aria-label={t("work:materials.remove", { name: m.name })}
                    >
                      <Icon name="delete" size={20} />
                    </Button>
                  </>
                )
              }
            />
          ))}
        </ul>
      )}
      {isManager && (
        <FormSheet
          open={editing !== null}
          onOpenChange={(open) => !open && setEditing(null)}
          title={editing?.material ? t("work:materials.editTitle") : t("work:materials.addTitle")}
          description={t("work:materials.formDescription")}
        >
          {editing !== null && (
            <MaterialForm
              key={editing.material?.id}
              projectId={projectId}
              roomId={roomId}
              material={editing.material}
              onSaved={() => setEditing(null)}
            />
          )}
        </FormSheet>
      )}
    </section>
  );
}
