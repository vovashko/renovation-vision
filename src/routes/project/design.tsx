import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Icon } from "@/components/ui/icon";
import { Button } from "@/components/ui/button";
import { FilterChips } from "@/components/filter-chips";
import { RenderCompare } from "@/features/media/ui/render-compare";
import { RenderSections, type RenderGroup } from "@/features/media/ui/render-sections";
import { RenderSheet } from "@/features/media/ui/render-sheet";
import { MediaEmpty } from "@/features/media/ui/media-empty";
import { useAuth } from "@/lib/auth";
import { PageHeader, PageLoading } from "@/components/page-header";
import { api } from "@/lib/api";
import { keys, usePhotos, useRenders, useRooms, useSave } from "@/lib/queries";
import type { Render } from "@/lib/database.types";

export const Route = createFileRoute("/projects/$projectId/design")({
  head: () => ({
    meta: [
      { title: "Design renders — RenoVision" },
      { name: "description", content: "Upload design renders and before/after pairs for each room." },
    ],
  }),
  component: DesignPage,
});

function DesignPage() {
  const { projectId } = Route.useParams();
  const isManager = useAuth().profile?.account_type === "manager";
  const { data: renders, isLoading } = useRenders(projectId);
  const { data: rooms = [] } = useRooms(projectId);
  const { data: photos = [] } = usePhotos(projectId);
  const [roomId, setRoomId] = useState("all");
  const [editing, setEditing] = useState<Render | "new" | null>(null);
  const toggle = useSave(projectId, (r: Render) => api.saveRender(projectId, { id: r.id, is_visible: !r.is_visible }), {
    invalidate: [keys.renders(projectId)],
    success: (r) => (r.is_visible ? "Hidden from the client" : "Shared with the client"),
  });

  const shownRooms = useMemo(() => (roomId === "all" ? rooms : rooms.filter((r) => r.id === roomId)), [rooms, roomId]);

  if (isLoading || !renders) return <PageLoading />;
  const compare = renders.find((r) => r.compare_photo_id && photos.some((p) => p.id === r.compare_photo_id));
  const comparePhoto = photos.find((p) => p.id === compare?.compare_photo_id);
  const showCompare = compare && comparePhoto && (roomId === "all" || roomId === compare.room_id);
  const groups: RenderGroup[] = [
    ...shownRooms.map((room) => ({ room, items: renders.filter((r) => r.room_id === room.id) })),
    ...(roomId === "all" ? [{ room: null, items: renders.filter((r) => !r.room_id) }] : []),
  ].filter((g) => g.room || g.items.length);

  return (
    <div className="mx-auto w-full max-w-6xl">
      <PageHeader
        title="Planned design"
        description={
          isManager ? "Renders show the client how each room will look when finished." : "How each room will look when it is finished."
        }
        actions={
          isManager && (
            <Button onClick={() => setEditing("new")} className="min-h-11 gap-2">
              <Icon name="add_photo_alternate" size={22} /> Add render
            </Button>
          )
        }
      />

      {rooms.length > 0 && (
        <div className="mt-5">
          <FilterChips
            label="Filter by room"
            value={roomId}
            onChange={setRoomId}
            options={[{ value: "all", label: "All rooms" }, ...rooms.map((r) => ({ value: r.id, label: r.name }))]}
          />
        </div>
      )}

      {showCompare && comparePhoto && compare && (
        <div className="mt-6">
          <RenderCompare
            roomName={rooms.find((r) => r.id === compare.room_id)?.name ?? compare.title}
            title={compare.title}
            before={comparePhoto.url}
            after={compare.url}
            note={
              isManager
                ? `The client sees this slider on their Design page${compare.is_visible && comparePhoto.status === "published" ? "." : " once both the render and the photo are shared."}`
                : undefined
            }
          />
        </div>
      )}

      {renders.length === 0 && (
        <div className="mt-6">
          <MediaEmpty
            icon="palette"
            title="No renders yet"
            text={
              isManager
                ? "Add the designer's renders so the client can see the finished look."
                : "Design renders will appear here once your designer shares them."
            }
          />
        </div>
      )}

      <div className="mt-8">
        <RenderSections
          projectId={projectId}
          groups={groups}
          isManager={isManager}
          onToggleVisible={(r) => toggle.mutate(r)}
          onEdit={setEditing}
        />
      </div>

      {isManager && <RenderSheet projectId={projectId} render={editing} rooms={rooms} photos={photos} onClose={() => setEditing(null)} />}
    </div>
  );
}
