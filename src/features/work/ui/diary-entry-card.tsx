import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { VisibilityBadge } from "@/shared/ui/visibility-badge";
import { PhotoThumbs } from "@/features/media/ui/photo-thumbs";
import { useHoursLabel } from "./use-hours-label";
import type { DiaryMaterial } from "../data/diary.repo";
import type { Photo, ProgressEntry } from "@/lib/database.types";

/** One diary entry: its note, where and how long, the photos and (for managers) the materials used. */
export function DiaryEntryCard({
  entry,
  stageName,
  roomName,
  photos,
  materials,
  isManager,
  onEdit,
  onDelete,
}: {
  entry: ProgressEntry;
  stageName?: string;
  roomName?: string;
  photos: Photo[];
  materials: DiaryMaterial[];
  isManager: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  const { t } = useTranslation(["work"]);
  const hoursLabel = useHoursLabel();
  return (
    <Card className="px-5 py-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          {stageName && (
            <Badge variant="status-progress" size="compact">
              {stageName}
            </Badge>
          )}
          {roomName && (
            <Badge variant="status-pending" size="compact" icon="meeting_room">
              {roomName}
            </Badge>
          )}
          {entry.hours != null && (
            <span className="inline-flex items-center gap-1 text-body-sm text-on-surface-variant">
              <Icon name="schedule" size={16} /> {hoursLabel(entry.hours)}
            </span>
          )}
          {isManager && <VisibilityBadge visible={entry.is_visible} />}
        </div>
        {isManager && (
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" onClick={onEdit} aria-label={t("work:diary.edit")}>
              <Icon name="edit" size={20} />
            </Button>
            <Button variant="ghost" size="icon" onClick={onDelete} aria-label={t("work:diary.remove")}>
              <Icon name="delete" size={20} />
            </Button>
          </div>
        )}
      </div>
      <p className="mt-2 text-body-lg whitespace-pre-line text-on-surface">{entry.note}</p>
      {photos.length > 0 && <PhotoThumbs photos={photos} max={4} className="mt-3 grid grid-cols-4 gap-2" />}
      {materials.length > 0 && (
        <p className="mt-3 text-body-md text-on-surface-variant">
          <span className="font-medium text-on-surface">{t("work:diary.materialsUsed")}</span> {materials.map((m) => m.name).join(", ")}
        </p>
      )}
    </Card>
  );
}
