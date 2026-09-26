import { Icon } from "@/components/ui/icon";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { dateTime } from "@/lib/format";
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
  const isDraft = isManager && photo.status === "draft";

  return (
    <Card className={isDraft ? "overflow-hidden border-dashed" : "overflow-hidden"}>
      <button
        onClick={onOpen}
        className="relative block w-full focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary"
        aria-label={`Open photo: ${photo.caption || "site photo"}`}
      >
        {photo.url ? (
          <img src={photo.url} alt={photo.alt} loading="lazy" width={1024} height={768} className="aspect-[4/3] w-full object-cover" />
        ) : (
          <div className="flex aspect-[4/3] w-full items-center justify-center bg-surface-container-high text-body-sm text-on-surface-variant">
            File missing
          </div>
        )}
        {isDraft && (
          <Badge icon="visibility_off" className="absolute top-3 left-3 bg-inverse-surface text-inverse-on-surface">
            Draft — client can&rsquo;t see
          </Badge>
        )}
      </button>
      <CardContent className="flex flex-col gap-3 pt-4">
        <p className="text-body-md">{photo.caption || <span className="text-on-surface-variant">No caption</span>}</p>
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary" icon="construction">
            {stageName}
          </Badge>
          <Badge variant="outline" icon="meeting_room">
            {roomName}
          </Badge>
        </div>
        <div className="text-body-sm text-on-surface-variant">{dateTime(photo.taken_at)}</div>
        {isManager && (
          <div className="flex gap-2">
            {photo.status === "draft" ? (
              <Button size="sm" className="flex-1 gap-1.5" onClick={onTogglePublish}>
                <Icon name="send" size={18} /> Publish
              </Button>
            ) : (
              <Button size="sm" variant="outline" className="flex-1" onClick={onTogglePublish}>
                Unpublish
              </Button>
            )}
            <Button size="icon" variant="ghost" className="h-9 w-9" onClick={onEdit} aria-label="Edit photo">
              <Icon name="edit" size={20} />
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
