import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Icon } from "@/components/ui/icon";
import { Button } from "@/components/ui/button";
import { FilterChips } from "@/features/media/ui/filter-chips";
import { RenderCompare } from "@/features/media/ui/render-compare";
import { RenderSections, type RenderGroup } from "@/features/media/ui/render-sections";
import { RenderSheet } from "@/features/media/ui/render-sheet";
import { MediaEmpty } from "@/features/media/ui/media-empty";
import { usePhotos } from "@/features/media/hooks/use-photos";
import { useRenders, useToggleRenderVisible } from "@/features/media/hooks/use-renders";
import { useAuth } from "@/lib/auth";
import { useRooms } from "@/lib/queries";
import { PageHeader, PageLoading } from "@/components/page-header";
import type { Render } from "@/lib/database.types";

export const Route = createFileRoute("/projects/$projectId/design")({
  head: ({ match }) => ({
    meta: [
      { title: `${match.context.i18n.t("media:designPage.heading")} — RenoVision` },
      { name: "description", content: match.context.i18n.t("media:designPage.metaDescription") },
    ],
  }),
  component: DesignPage,
});

function DesignPage() {
  const { t } = useTranslation(["media"]);
  const { projectId } = Route.useParams();
  const isManager = useAuth().profile?.account_type === "manager";
  const { data: renders, isLoading } = useRenders(projectId);
  const { data: rooms = [] } = useRooms(projectId);
  const { data: photos = [] } = usePhotos(projectId);
  const [roomId, setRoomId] = useState("all");
  const [editing, setEditing] = useState<Render | "new" | null>(null);
  const toggle = useToggleRenderVisible(projectId);

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
        title={t("designPage.heading")}
        description={isManager ? t("designPage.descriptionManager") : t("designPage.descriptionClient")}
        actions={
          isManager && (
            <Button onClick={() => setEditing("new")} className="min-h-11 gap-2">
              <Icon name="add_photo_alternate" size={22} /> {t("designPage.addRender")}
            </Button>
          )
        }
      />

      {rooms.length > 0 && (
        <div className="mt-5">
          <FilterChips
            label={t("filters.byRoom")}
            value={roomId}
            onChange={setRoomId}
            options={[{ value: "all", label: t("filters.allRooms") }, ...rooms.map((r) => ({ value: r.id, label: r.name }))]}
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
            managerNote={isManager ? (compare.is_visible && comparePhoto.status === "published" ? "ready" : "waiting") : undefined}
          />
        </div>
      )}

      {renders.length === 0 && (
        <div className="mt-6">
          <MediaEmpty
            icon="palette"
            title={t("designPage.emptyTitle")}
            text={isManager ? t("designPage.emptyManager") : t("designPage.emptyClient")}
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
