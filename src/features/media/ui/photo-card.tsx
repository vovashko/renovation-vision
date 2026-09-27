import { useTranslation } from "react-i18next";
import { Icon } from "@/components/ui/icon";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { focusRingInset } from "@/components/ui/focus-ring";
import { cn } from "@/lib/utils";
import { useFormat } from "@/i18n";
import type { Photo } from "@/lib/database.types";

/** One photo tile in the grid: image, caption, stage/room tags and (for managers) the publish/edit actions. */
export function PhotoCard({
  photo,
  stageName,
  roomName,
  isManager,
  onOpen,
  onTogglePublish,
  onEdit,
}: {
  photo: Photo;
  stageName: string;
  roomName: string;
  isManager: boolean;
  onOpen: () => void;
  onTogglePublish: () => void;
  onEdit: () => void;
}) {
  const { t } = useTranslation(["media", "common"]);
  const format = useFormat();
  const isDraft = isManager && photo.status === "draft";
  const takenAt = format.date(photo.taken_at, "dayTime");

  return (
    <Card className={isDraft ? "overflow-hidden border-dashed" : "overflow-hidden"}>
      <button
        onClick={onOpen}
        className={cn("relative block w-full", focusRingInset)}
        aria-label={t("photoCard.openAria", { caption: photo.caption || t("photo.fallbackCaption") })}
      >
        {photo.url ? (
          <img src={photo.url} alt={photo.alt} loading="lazy" width={1024} height={768} className="aspect-[4/3] w-full object-cover" />
        ) : (
          <div className="flex aspect-[4/3] w-full items-center justify-center bg-surface-container-high text-body-sm text-on-surface-variant">
            {t("photoCard.fileMissing")}
          </div>
        )}
        {isDraft && (
          <Badge icon="visibility_off" variant="scrim" className="absolute top-3 left-3">
            {t("photoCard.draftBadge")}
          </Badge>
        )}
      </button>
      <CardContent className="flex flex-col gap-3 pt-4">
        <p className="text-body-md">{photo.caption || <span className="text-on-surface-variant">{t("photoCard.noCaption")}</span>}</p>
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary" icon="construction">
            {stageName}
          </Badge>
          <Badge variant="outline" icon="meeting_room">
            {roomName}
          </Badge>
        </div>
        <div className="text-body-sm text-on-surface-variant">{takenAt}</div>
        {isManager && (
          <div className="flex gap-2">
            {photo.status === "draft" ? (
              <Button size="sm" className="flex-1 gap-1.5" onClick={onTogglePublish}>
                <Icon name="send" size={18} /> {t("photoCard.publish")}
              </Button>
            ) : (
              <Button size="sm" variant="outline" className="flex-1" onClick={onTogglePublish}>
                {t("photoCard.unpublish")}
              </Button>
            )}
            <Button size="icon" variant="ghost" className="h-9 w-9" onClick={onEdit} aria-label={t("photoCard.editAria")}>
              <Icon name="edit" size={20} />
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
