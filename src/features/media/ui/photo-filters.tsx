import { useTranslation } from "react-i18next";
import { FilterChips } from "@/features/media/ui/filter-chips";
import type { Room, Stage } from "@/lib/database.types";

export type PhotoStatusFilter = "all" | "draft" | "published";

/** The Photos page's filter rows: status (manager only), stage and room. */
export function PhotoFilters({
  isManager,
  totalCount,
  draftCount,
  status,
  onStatusChange,
  stages,
  stageId,
  onStageChange,
  rooms,
  roomId,
  onRoomChange,
}: {
  isManager: boolean;
  totalCount: number;
  draftCount: number;
  status: PhotoStatusFilter;
  onStatusChange: (v: PhotoStatusFilter) => void;
  stages: Stage[];
  stageId: string;
  onStageChange: (v: string) => void;
  rooms: Room[];
  roomId: string;
  onRoomChange: (v: string) => void;
}) {
  const { t } = useTranslation(["media"]);
  const ALL = "all";
  const statusOptions = [
    { value: ALL, label: t("filters.allCount", { count: totalCount }) },
    { value: "draft", label: t("filters.draftsCount", { count: draftCount }) },
    { value: "published", label: t("filters.publishedCount", { count: totalCount - draftCount }) },
  ];
  const stageOptions = [{ value: ALL, label: t("filters.allStages") }, ...stages.map((s) => ({ value: s.id, label: s.name }))];
  const roomOptions = [{ value: ALL, label: t("filters.allRooms") }, ...rooms.map((r) => ({ value: r.id, label: r.name }))];

  return (
    <div className="flex flex-col gap-1">
      {isManager && (
        <FilterChips
          label={t("filters.byStatus")}
          value={status}
          onChange={(v) => onStatusChange(v as PhotoStatusFilter)}
          options={statusOptions}
        />
      )}
      {stages.length > 0 && <FilterChips label={t("filters.byStage")} value={stageId} onChange={onStageChange} options={stageOptions} />}
      {rooms.length > 0 && <FilterChips label={t("filters.byRoom")} value={roomId} onChange={onRoomChange} options={roomOptions} />}
    </div>
  );
}
