import { Link } from "@tanstack/react-router";
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
  return (
    <div className="flex flex-col gap-8">
      {groups.map((g) => (
        <section key={g.room?.id ?? "none"} aria-label={g.room?.name ?? "No room"} className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-x-3">
            <h2 className="text-title-lg">{g.room?.name ?? "Not linked to a room"}</h2>
            {g.room && (
              <Link
                to="/projects/$projectId/plan"
                params={{ projectId }}
                search={{ room: g.room.id }}
                className={cn(buttonVariants({ variant: "ghost" }), "-mr-3 min-h-11")}
              >
                See on plan
                <Icon name="arrow_forward" size={20} />
              </Link>
            )}
          </div>
          {g.items.length === 0 ? (
            <MediaEmpty
              icon="palette"
              compact
              text={`${isManager ? "The client sees " : ""}"Renders for ${g.room?.name} are still being prepared by the designer."`}
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
      ))}
    </div>
  );
}
