import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Icon } from "@/components/ui/icon";
import { Button } from "@/components/ui/button";
import { Note } from "@/components/ui/note";
import { FormSheet } from "@/shared/ui/form-sheet";
import { PageHeader, PageLoading } from "@/components/page-header";
import { VisibilityBadge } from "@/shared/ui/visibility-badge";
import { useConfirm } from "@/shared/ui/use-confirm";
import { useNavRole } from "@/shared/ui/nav-role";
import { StageRow, StageRowList } from "@/features/work/ui/stage-row";
import { StagesEmpty } from "@/features/work/ui/stages-empty";
import { TaskAddForm } from "@/features/work/ui/task-add-form";
import { StageFormSheet } from "@/features/work/ui/stage-form";
import { FloorPlan } from "@/features/work/ui/floor-plan";
import { SelectedRoomPanel } from "@/features/work/ui/selected-room-panel";
import { RoomList } from "@/features/work/ui/room-list";
import { RoomsEmpty } from "@/features/work/ui/rooms-empty";
import { RoomEditor, RoomForm } from "@/features/work/ui/room-form";
import { ProgressTabs, type ProgressView } from "@/features/work/ui/progress-tabs";
import { useRooms, useStages, useSaveStage, useSaveTask, useDeleteTask } from "@/features/work/hooks";
import { daysLate } from "@/domain/attention";
import { deriveStatus } from "@/domain/progress";
import { useFormat } from "@/i18n";
import type { Stage } from "@/lib/database.types";

type ProgressSearch = { view: ProgressView; room?: string };

export const Route = createFileRoute("/_authed/projects/$projectId/progress")({
  validateSearch: (s: Record<string, unknown>): ProgressSearch => ({
    view: s.view === "plan" ? "plan" : "timeline",
    room: typeof s.room === "string" ? s.room : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Progress — RenoVision" },
      { name: "description", content: "Renovation stages, their checklists and the floor plan, in one place." },
    ],
  }),
  component: ProgressPage,
});

function ProgressPage() {
  const { projectId } = Route.useParams();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const { t } = useTranslation(["work", "common"]);
  const format = useFormat();
  const isManager = useNavRole() === "manager";
  const confirm = useConfirm();
  const { data: stages, isLoading: stagesLoading } = useStages(projectId);
  const { data: rooms, isLoading: roomsLoading } = useRooms(projectId);
  const [editingStage, setEditingStage] = useState<Stage | "new" | null>(null);
  const [addingRoom, setAddingRoom] = useState(false);
  const [activeRoomId, setActiveRoomId] = useState<string | null>(search.room ?? null);

  const saveTask = useSaveTask(projectId);
  const removeTask = useDeleteTask(projectId);
  const saveStage = useSaveStage(projectId);

  useEffect(() => {
    const hash = typeof window !== "undefined" ? window.location.hash.slice(1) : "";
    if (hash && stages) document.getElementById(hash)?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [stages]);

  useEffect(() => {
    if (!activeRoomId && rooms?.length) setActiveRoomId(rooms[0].id);
  }, [rooms, activeRoomId]);

  const setView = (view: ProgressView) => navigate({ search: (prev) => ({ ...prev, view }) });

  const removeTaskWithConfirm = async (task: { id: string; name: string }) => {
    const ok = await confirm({ title: t("work:stageRow.removeTaskConfirmTitle", { name: task.name }), destructive: true });
    if (ok) removeTask.mutate(task);
  };
  const startNewStage = () => setEditingStage("new");

  if (stagesLoading || roomsLoading || !stages || !rooms) return <PageLoading />;

  const activeRoom = rooms.find((r) => r.id === activeRoomId) ?? null;
  const openTasksFor = (roomId: string) => stages.flatMap((s) => s.tasks).filter((t2) => t2.room_id === roomId && !t2.done);

  return (
    <div className="mx-auto w-full max-w-6xl">
      <PageHeader
        title={t("work:progress.title")}
        description={isManager ? t("work:progress.descriptionManager") : t("work:progress.descriptionClient")}
        actions={
          isManager &&
          (search.view === "timeline" ? (
            <Button onClick={startNewStage} className="min-h-11 gap-2">
              <Icon name="add" size={20} /> {t("work:progress.addStage")}
            </Button>
          ) : (
            <Button onClick={() => setAddingRoom(true)} className="min-h-11 gap-2">
              <Icon name="add" size={20} /> {t("work:plan.addRoom")}
            </Button>
          ))
        }
      />

      <div className="mt-6">
        <ProgressTabs view={search.view} onChange={setView} />
      </div>

      {search.view === "timeline" ? (
        <div id="progress-panel-timeline" role="tabpanel" aria-labelledby="progress-tab-timeline" className="mt-6 max-w-5xl">
          {stages.length === 0 ? (
            <StagesEmpty />
          ) : (
            <StageRowList>
              {stages.map((s, i) => {
                const done = s.tasks.filter((t2) => t2.done).length;
                const fromChecklist = s.tasks.length ? Math.round((done / s.tasks.length) * 100) : null;
                return (
                  <div key={s.id} id={s.id} className="scroll-mt-20">
                    <StageRow
                      index={i + 1}
                      name={s.name}
                      start={format.date(s.start_date, "short")}
                      end={format.date(s.end_date, "short")}
                      status={s.status}
                      progress={s.progress}
                      lateDays={daysLate(s)}
                      dimmed={isManager && !s.is_visible}
                      tasks={s.tasks.map((t2) => ({ ...t2, muted: isManager && !t2.is_visible }))}
                      onToggleTask={isManager ? (t2) => saveTask.mutate({ id: t2.id, stage_id: s.id, done: !t2.done }) : undefined}
                      onRemoveTask={isManager ? (t2) => removeTaskWithConfirm(s.tasks.find((x) => x.id === t2.id)!) : undefined}
                      headerExtra={
                        isManager && (
                          <>
                            {!s.is_visible && <VisibilityBadge visible={false} />}
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setEditingStage(s)}
                              aria-label={t("work:stageRow.editStage", { name: s.name })}
                            >
                              <Icon name="edit" size={20} />
                            </Button>
                          </>
                        )
                      }
                    >
                      {isManager && (
                        <TaskAddForm
                          rooms={rooms}
                          onAdd={({ name, room_id }) => saveTask.mutate({ stage_id: s.id, name, room_id, sort_order: s.tasks.length + 1 })}
                        />
                      )}
                      {/* Tasks-mode stages follow their checklist already (database triggers); only manual ones can drift. */}
                      {isManager &&
                        s.progress_mode === "manual" &&
                        fromChecklist !== null &&
                        fromChecklist !== s.progress &&
                        s.status !== "done" && (
                          <Note size="sm" className="mt-3 flex flex-wrap items-center justify-between gap-2">
                            <span>
                              {t("work:stageRow.checklistMismatch", {
                                done,
                                total: s.tasks.length,
                                pct: fromChecklist,
                                progress: s.progress,
                              })}
                            </span>
                            <button
                              type="button"
                              className="font-medium text-primary hover:underline"
                              onClick={() => {
                                const progress = Math.min(fromChecklist, 99);
                                saveStage.mutate({ id: s.id, progress, status: deriveStatus(s.status, progress) });
                              }}
                            >
                              {t("work:stageRow.useChecklistPct", { pct: Math.min(fromChecklist, 99) })}
                            </button>
                          </Note>
                        )}
                      {s.client_note && (
                        <p className="mt-3 text-body-md text-on-surface-variant">
                          {isManager && t("work:stageRow.noteForClient")}
                          {s.client_note}
                        </p>
                      )}
                    </StageRow>
                  </div>
                );
              })}
            </StageRowList>
          )}

          {isManager && (
            <StageFormSheet
              projectId={projectId}
              stage={editingStage}
              rooms={rooms}
              count={stages.length}
              onClose={() => setEditingStage(null)}
            />
          )}
        </div>
      ) : (
        <div id="progress-panel-plan" role="tabpanel" aria-labelledby="progress-tab-plan" className="mt-6">
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
                    <RoomEditor
                      key={activeRoom.id + activeRoom.status + activeRoom.progress}
                      projectId={projectId}
                      room={activeRoom}
                      openTasks={openTasksFor(activeRoom.id).map((t2) => t2.name)}
                    />
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
              onOpenChange={setAddingRoom}
              title={t("work:plan.addRoom")}
              description={t("work:plan.addRoomDescription")}
            >
              <RoomForm
                projectId={projectId}
                initial={{ name: "", status: "pending", progress: 0, client_note: "", is_visible: true, x: 20, y: 20, w: 160, h: 120 }}
                onSaved={() => setAddingRoom(false)}
                extra={{ sort_order: rooms.length + 1 }}
                showGeometry
              />
            </FormSheet>
          )}
        </div>
      )}
    </div>
  );
}
