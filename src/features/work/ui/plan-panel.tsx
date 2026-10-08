import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { FormSheet } from "@/shared/ui/form-sheet";
import { PageLoading } from "@/components/page-header";
import { VisibilityBadge } from "@/shared/ui/visibility-badge";
import { FloorPlan } from "@/features/work/ui/floor-plan";
import { SelectedRoomPanel } from "@/features/work/ui/selected-room-panel";
import { OpenRoomLink } from "@/features/work/ui/open-room-link";
import { RoomList } from "@/features/work/ui/room-list";
import { RoomsEmpty } from "@/features/work/ui/rooms-empty";
import { RoomEditor, RoomForm } from "@/features/work/ui/room-form";
import { useRooms, useStages } from "@/features/work/hooks";

/** The whole floor-plan view: plan, selected room, room list and (managers) the add-room sheet. */
export function PlanPanel({
  projectId,
  isManager,
  initialRoomId,
  addingRoom,
  onAddingRoomChange,
}: {
  projectId: string;
  isManager: boolean;
  initialRoomId?: string;
  addingRoom: boolean;
  onAddingRoomChange: (open: boolean) => void;
}) {
  const { t } = useTranslation(["work"]);
  const { data: stages, isLoading: stagesLoading } = useStages(projectId);
  const { data: rooms, isLoading: roomsLoading } = useRooms(projectId);
  const [activeRoomId, setActiveRoomId] = useState<string | null>(initialRoomId ?? null);

  useEffect(() => {
    if (!activeRoomId && rooms?.length) setActiveRoomId(rooms[0].id);
  }, [rooms, activeRoomId]);

  if (stagesLoading || roomsLoading || !stages || !rooms) return <PageLoading />;

  const activeRoom = rooms.find((r) => r.id === activeRoomId) ?? null;
  const openTasksFor = (roomId: string) => stages.flatMap((s) => s.tasks).filter((t2) => t2.room_id === roomId && !t2.done);

  return (
    <div id="plan-panel" role="tabpanel" aria-labelledby="design-tab-plan" className="mt-6">
      {rooms.length === 0 ? (
        <RoomsEmpty />
      ) : (
        <>
          <FloorPlan
            rooms={rooms.map((r) => ({ ...r, muted: isManager && !r.is_visible }))}
            activeId={activeRoomId}
            onSelect={(r) => setActiveRoomId(r.id)}
            detail={
              !activeRoom ? undefined : isManager ? (
                <>
                  <RoomEditor
                    key={activeRoom.id + activeRoom.status + activeRoom.progress}
                    projectId={projectId}
                    room={activeRoom}
                    openTasks={openTasksFor(activeRoom.id).map((t2) => t2.name)}
                  />
                  <OpenRoomLink projectId={projectId} roomId={activeRoom.id} />
                </>
              ) : (
                <SelectedRoomPanel room={activeRoom}>
                  {activeRoom.client_note && <p className="mt-5 text-body-md text-on-surface-variant">{activeRoom.client_note}</p>}
                  {openTasksFor(activeRoom.id).length > 0 && (
                    <div className="mt-5">
                      <div className="text-body-md text-on-surface-variant">{t("work:plan.stillToDo")}</div>
                      <ul className="mt-2 list-disc space-y-1 pl-5 text-body-md">
                        {openTasksFor(activeRoom.id).map((t2) => (
                          <li key={t2.id}>{t2.name}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <OpenRoomLink projectId={projectId} roomId={activeRoom.id} />
                </SelectedRoomPanel>
              )
            }
          />

          <h2 className="mt-10 text-title-lg">{t("work:plan.roomsHeading")}</h2>
          <div className="mt-3">
            <RoomList
              rooms={rooms.map((r) => ({
                id: r.id,
                name: r.name,
                status: r.status,
                progress: r.progress,
                muted: isManager && !r.is_visible,
              }))}
              activeId={activeRoomId}
              onSelect={(r) => setActiveRoomId(r.id)}
              rowExtra={(r) =>
                isManager && r.muted ? (
                  <div className="mt-1">
                    <VisibilityBadge visible={false} />
                  </div>
                ) : null
              }
            />
          </div>
        </>
      )}

      {isManager && (
        <FormSheet
          open={addingRoom}
          onOpenChange={onAddingRoomChange}
          title={t("work:plan.addRoom")}
          description={t("work:plan.addRoomDescription")}
        >
          <RoomForm
            projectId={projectId}
            initial={{ name: "", status: "pending", progress: 0, client_note: "", is_visible: true, w: 4, h: 3 }}
            onSaved={() => onAddingRoomChange(false)}
            extra={{ sort_order: rooms.length + 1 }}
          />
        </FormSheet>
      )}
    </div>
  );
}
