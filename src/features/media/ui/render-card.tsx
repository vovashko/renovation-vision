import { Icon } from "@/components/ui/icon";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { VisibilityBadge } from "@/components/manager/visibility-badge";
import type { Render } from "@/lib/database.types";

/** One design render tile: image, title, description and (for managers) the visibility toggle and edit action. */
export function RenderCard({
  render,
  isManager,
  onToggleVisible,
  onEdit,
}: {
  render: Render;
  isManager: boolean;
  onToggleVisible: () => void;
  onEdit: () => void;
}) {
  return (
    <Card className={isManager && !render.is_visible ? "overflow-hidden border-dashed" : "overflow-hidden"}>
      <img src={render.url} alt={render.alt} loading="lazy" width={1024} height={768} className="aspect-[4/3] w-full object-cover" />
      <CardContent className="flex flex-col gap-1 pt-4">
        <div className="text-title-md">{render.title}</div>
        <p className="text-body-md text-on-surface-variant">{render.description}</p>
        {isManager && (
          <div className="mt-2 flex items-center justify-between gap-2">
            <VisibilityBadge visible={render.is_visible} />
            <div className="flex items-center gap-1">
              <Switch checked={render.is_visible} onCheckedChange={onToggleVisible} aria-label={`Share ${render.title} with client`} />
              <Button size="icon" variant="ghost" className="h-9 w-9" onClick={onEdit} aria-label={`Edit ${render.title}`}>
                <Icon name="edit" size={20} />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
