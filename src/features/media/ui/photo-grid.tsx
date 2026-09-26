import { PhotoCard } from "@/features/media/ui/photo-card";
import { MediaEmpty } from "@/features/media/ui/media-empty";
import type { PhotoGroup } from "@/lib/photo-helpers";
import type { Photo } from "@/lib/database.types";

/** The Photos page's main grid: photos grouped by date, or an empty state when the filter matches nothing. */
export function PhotoGrid({
  groups,
  emptyText,
  isManager,
  stageName,
  roomName,
  onOpen,
  onTogglePublish,
  onEdit,
}: {
  groups: PhotoGroup[];
  emptyText: string;
  isManager: boolean;
  stageName: (id: string | null) => string;
  roomName: (id: string | null) => string;
  onOpen: (photo: Photo) => void;
  onTogglePublish: (photo: Photo) => void;
  onEdit: (photo: Photo) => void;
}) {
  if (groups.length === 0) {
    return <MediaEmpty text={emptyText} />;
  }

  return (
    <div className="flex flex-col gap-8">
      {groups.map((g) => (
        <section key={g.label} aria-label={g.label} className="flex flex-col gap-3">
          <h2 className="text-label-lg text-on-surface-variant">{g.label}</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {g.items.map((p) => (
              <PhotoCard
                key={p.id}
                photo={p}
                stageName={stageName(p.stage_id)}
                roomName={roomName(p.room_id)}
                isManager={isManager}
                onOpen={() => onOpen(p)}
                onTogglePublish={() => onTogglePublish(p)}
                onEdit={() => onEdit(p)}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
