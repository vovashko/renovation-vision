import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Icon } from "@/components/ui/icon";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { useConfirm } from "@/shared/ui/use-confirm";
import { usePhotos } from "@/features/media/hooks";
import { useFormat } from "@/i18n";
import { filterByStage, groupByDay } from "../domain/diary";
import { useDeleteDiaryEntry, useDiaryEntries, useDiaryMaterials } from "../hooks/diary";
import { DiaryEntryCard } from "./diary-entry-card";
import { DiaryEntrySheet } from "./diary-entry-sheet";
import type { ProgressEntry, Room, Stage } from "@/lib/database.types";

/**
 * The Progress page's "Diary" section: entries grouped by day, filterable by stage. Managers add, edit and
 * delete entries; clients read the ones the manager made visible.
 */
export function DiarySection({
  projectId,
  stages,
  rooms,
  isManager,
}: {
  projectId: string;
  stages: Stage[];
  rooms: Room[];
  isManager: boolean;
}) {
  const { t } = useTranslation(["work", "common"]);
  const format = useFormat();
  const confirm = useConfirm();
  const { data: entries = [], isLoading } = useDiaryEntries(projectId);
  const { data: photos = [] } = usePhotos(projectId);
  const { data: materials = [] } = useDiaryMaterials(projectId, isManager);
  const remove = useDeleteDiaryEntry(projectId);
  const [stageId, setStageId] = useState("");
  const [editing, setEditing] = useState<ProgressEntry | "new" | null>(null);

  const days = useMemo(() => groupByDay(filterByStage(entries, stageId)), [entries, stageId]);
  const startNew = () => setEditing("new");
  const closeSheet = () => setEditing(null);

  const removeWithConfirm = async (entry: ProgressEntry) => {
    const ok = await confirm({ title: t("work:diary.removeConfirmTitle"), destructive: true });
    if (ok) remove.mutate(entry.id);
  };

  return (
    <section id="diary" aria-labelledby="diary-title" className="scroll-mt-20">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <h2 id="diary-title" className="text-title-lg">
          {t("work:diary.title")}
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          {entries.length > 0 && stages.length > 0 && (
            <NativeSelect value={stageId} onChange={(e) => setStageId(e.target.value)} aria-label={t("work:diary.filterByStage")}>
              <NativeSelectOption value="">{t("work:diary.allStages")}</NativeSelectOption>
              {stages.map((s) => (
                <NativeSelectOption key={s.id} value={s.id}>
                  {s.name}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          )}
          {isManager && (
            <Button onClick={startNew} className="min-h-11 gap-2">
              <Icon name="add" size={20} /> {t("work:diary.add")}
            </Button>
          )}
        </div>
      </div>

      {!isLoading && days.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon" icon="edit_note" />
            <EmptyTitle>{t("work:diary.empty.title")}</EmptyTitle>
            <EmptyDescription>
              {isManager ? t("work:diary.empty.descriptionManager") : t("work:diary.empty.descriptionClient")}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="space-y-6">
          {days.map((day) => (
            <div key={day.date}>
              <h3 className="mb-2 text-title-md text-on-surface-variant">{format.dayLabel(day.date)}</h3>
              <ul className="space-y-3">
                {day.entries.map((entry) => (
                  <li key={entry.id}>
                    <DiaryEntryCard
                      entry={entry}
                      stageName={stages.find((s) => s.id === entry.stage_id)?.name}
                      roomName={rooms.find((r) => r.id === entry.room_id)?.name}
                      photos={photos.filter((p) => p.progress_entry_id === entry.id)}
                      materials={materials.filter((m) => m.progress_entry_id === entry.id)}
                      isManager={isManager}
                      onEdit={() => setEditing(entry)}
                      onDelete={() => removeWithConfirm(entry)}
                    />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      {isManager && <DiaryEntrySheet projectId={projectId} entry={editing} stages={stages} rooms={rooms} onClose={closeSheet} />}
    </section>
  );
}
