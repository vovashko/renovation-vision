import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Icon } from "@/components/ui/icon";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { RenderCard } from "@/features/media/ui/render-card";
import { MediaEmpty } from "@/features/media/ui/media-empty";
import type { Render, Room } from "@/lib/database.types";

export type RenderGroup = { room: Room | null; items: Render[] };

/** One room's renders (or a "still being prepared" placeholder), with a link to see the room on the plan. */
export function RenderSections({
  projectId,
  groups,
  isManager,
  onToggleVisible,
  onEdit,
}: {
  projectId: string;
  groups: RenderGroup[];
  isManager: boolean;
  onToggleVisible: (render: Render) => void;
  onEdit: (render: Render) => void;
}) {
  const { t } = useTranslation(["media"]);
  return (
    <div className="flex flex-col gap-8">
      {groups.map((g) => {
        const roomName = g.room?.name ?? t("renderSections.noRoomHeading");
        return (
          <section key={g.room?.id ?? "none"} aria-label={roomName} className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-x-3">
              <h2 className="text-title-lg">{roomName}</h2>
              {g.room && (
                <Link
                  to="/projects/$projectId/plan"
                  params={{ projectId }}
                  search={{ room: g.room.id }}
                  className={cn(buttonVariants({ variant: "ghost" }), "-mr-3 min-h-11")}
                >
                  {t("renderSections.seeOnPlan")}
                  <Icon name="arrow_forward" size={20} />
                </Link>
              )}
            </div>
            {g.items.length === 0 ? (
              <MediaEmpty
                icon="palette"
                compact
                text={
                  isManager ? t("renderSections.emptyManager", { room: roomName }) : t("renderSections.emptyClient", { room: roomName })
                }
              />
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {g.items.map((r) => (
                  <RenderCard
                    key={r.id}
                    render={r}
                    isManager={isManager}
                    onToggleVisible={() => onToggleVisible(r)}
                    onEdit={() => onEdit(r)}
                  />
                ))}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
