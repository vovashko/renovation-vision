import { FilterChips } from "@/components/filter-chips";
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
  return (
    <div className="flex flex-col gap-1">
      {isManager && (
        <FilterChips
          label="Filter by status"
          value={status}
          onChange={(v) => onStatusChange(v as PhotoStatusFilter)}
          options={[
            { value: "all", label: `All (${totalCount})` },
            { value: "draft", label: `Drafts (${draftCount})` },
            { value: "published", label: `Published (${totalCount - draftCount})` },
          ]}
        />
      )}
      {stages.length > 0 && (
        <FilterChips
          label="Filter by stage"
          value={stageId}
          onChange={onStageChange}
          options={[{ value: "all", label: "All stages" }, ...stages.map((s) => ({ value: s.id, label: s.name }))]}
        />
      )}
      {rooms.length > 0 && (
        <FilterChips
          label="Filter by room"
          value={roomId}
          onChange={onRoomChange}
          options={[{ value: "all", label: "All rooms" }, ...rooms.map((r) => ({ value: r.id, label: r.name }))]}
        />
      )}
    </div>
  );
}
