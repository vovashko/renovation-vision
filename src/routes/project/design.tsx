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
import { useNavRole } from "@/shared/ui/nav-role";
import { useRooms } from "@/features/work/hooks";
import { PageHeader, PageLoading } from "@/components/page-header";
import { PlanPanel } from "@/features/work/ui/plan-panel";
import { ViewTabs } from "@/shared/ui/view-tabs";
import type { Render } from "@/lib/database.types";

export const Route = createFileRoute("/_authed/projects/$projectId/design")({
  head: ({ match }) => ({
    meta: [
      { title: `${match.context.i18n.t("media:designPage.heading")} — RenoVision` },
      { name: "description", content: match.context.i18n.t("media:designPage.metaDescription") },
    ],
  }),
  validateSearch: (s: Record<string, unknown>): { view: "renders" | "plan"; room?: string } => ({
    view: s.view === "plan" ? "plan" : "renders",
    room: typeof s.room === "string" ? s.room : undefined,
  }),
  component: DesignPage,
});

const TABS_ID_PREFIX = "design";
const RENDERS_VIEW = "renders";
const PLAN_VIEW = "plan";

function DesignPage() {
  const { t } = useTranslation(["media", "work"]);
  const { projectId } = Route.useParams();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const view = search.view;
  const isManager = useNavRole() === "manager";
  const { data: renders, isLoading } = useRenders(projectId);
  const { data: rooms = [] } = useRooms(projectId);
  const { data: photos = [] } = usePhotos(projectId);
  const [roomId, setRoomId] = useState("all");
  const [editing, setEditing] = useState<Render | "new" | null>(null);
  const [addingRoom, setAddingRoom] = useState(false);
  const toggle = useToggleRenderVisible(projectId);

  const shownRooms = useMemo(() => (roomId === "all" ? rooms : rooms.filter((r) => r.id === roomId)), [rooms, roomId]);

  if (view === "renders" && (isLoading || !renders)) return <PageLoading />;
  const renderList = renders ?? [];
  const compare = renderList.find((r) => r.compare_photo_id && photos.some((p) => p.id === r.compare_photo_id));
  const comparePhoto = photos.find((p) => p.id === compare?.compare_photo_id);
  const showCompare = compare && comparePhoto && (roomId === "all" || roomId === compare.room_id);
  const groups: RenderGroup[] = [
    ...shownRooms.map((room) => ({ room, items: renderList.filter((r) => r.room_id === room.id) })),
    ...(roomId === "all" ? [{ room: null, items: renderList.filter((r) => !r.room_id) }] : []),
  ].filter((g) => g.room || g.items.length);
  const startNewRender = () => setEditing("new");
  const roomFilterOptions = [{ value: "all", label: t("filters.allRooms") }, ...rooms.map((r) => ({ value: r.id, label: r.name }))];
  const compareManagerNote = isManager
    ? compare && comparePhoto && compare.is_visible && comparePhoto.status === "published"
      ? "ready"
      : "waiting"
    : undefined;

  return (
    <div className="mx-auto w-full max-w-6xl">
      <PageHeader
        title={t("designPage.heading")}
        description={isManager ? t("designPage.descriptionManager") : t("designPage.descriptionClient")}
        actions={
          isManager &&
          (view === "renders" ? (
            <Button onClick={startNewRender} className="min-h-11 gap-2">
              <Icon name="add_photo_alternate" size={22} /> {t("designPage.addRender")}
            </Button>
          ) : (
            <Button onClick={() => setAddingRoom(true)} className="min-h-11 gap-2">
              <Icon name="add" size={20} /> {t("work:plan.addRoom")}
            </Button>
          ))
        }
      />

      <div className="mt-6">
        <ViewTabs
          idPrefix={TABS_ID_PREFIX}
          label={t("designPage.tabsLabel")}
          views={[
            { key: RENDERS_VIEW, label: t("designPage.tabRenders") },
            { key: PLAN_VIEW, label: t("designPage.tabPlan") },
          ]}
          view={view}
          onChange={(next) => navigate({ search: (prev) => ({ ...prev, view: next }) })}
        />
      </div>

      {view === "plan" ? (
        <PlanPanel
          projectId={projectId}
          isManager={isManager}
          initialRoomId={search.room}
          addingRoom={addingRoom}
          onAddingRoomChange={setAddingRoom}
        />
      ) : (
        <div id="design-panel-renders" role="tabpanel" aria-labelledby="design-tab-renders">
          {rooms.length > 0 && (
            <div className="mt-5">
              <FilterChips label={t("filters.byRoom")} value={roomId} onChange={setRoomId} options={roomFilterOptions} />
            </div>
          )}

          {showCompare && comparePhoto && compare && (
            <div className="mt-6">
              <RenderCompare
                roomName={rooms.find((r) => r.id === compare.room_id)?.name ?? compare.title}
                title={compare.title}
                before={comparePhoto.url}
                after={compare.url}
                managerNote={compareManagerNote}
              />
            </div>
          )}

          {renderList.length === 0 && (
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
        </div>
      )}

      {isManager && <RenderSheet projectId={projectId} render={editing} rooms={rooms} photos={photos} onClose={() => setEditing(null)} />}
    </div>
  );
}
