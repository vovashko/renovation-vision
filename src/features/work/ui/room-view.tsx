import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Icon } from "@/components/ui/icon";
import { ProgressBar } from "@/components/ui/progress-bar";
import { statusTone } from "@/components/ui/status-ui";
import { StatusPill } from "@/components/status-pill";
import { PageLoading } from "@/components/page-header";
import { ProjectEmpty } from "@/shared/ui/project-empty";
import { useRoomMaterials, useRoomTasks, useRoomWarnings } from "../hooks/room-view";
import { useRooms, useStages } from "../hooks/queries";
import { RoomMaterials } from "./room-materials";
import { RoomWarnings } from "./room-warnings";
import { RoomWorks } from "./room-works";

function BackToPlan({ projectId, roomId }: { projectId: string; roomId?: string }) {
  const { t } = useTranslation("work");
  return (
    <Link
      to="/projects/$projectId/progress"
      params={{ projectId }}
      search={{ view: "plan", room: roomId }}
      className="inline-flex items-center gap-1 text-label-lg text-primary"
    >
      <Icon name="arrow_back" size={18} /> {t("roomView.back")}
    </Link>
  );
}

/**
 * One room: its progress (derived from its works), investor warnings, works and materials with their delivery
 * status. Managers edit everything; clients read it (no prices: materials come from `room_materials()`).
 */
export function RoomView({ projectId, roomId, isManager }: { projectId: string; roomId: string; isManager: boolean }) {
  const { t } = useTranslation("work");
  const rooms = useRooms(projectId);
  const stages = useStages(projectId);
  const tasks = useRoomTasks(projectId, roomId);
  const materials = useRoomMaterials(projectId, roomId);
  const warnings = useRoomWarnings(projectId, roomId);

  if (rooms.isLoading || stages.isLoading || tasks.isLoading || materials.isLoading || warnings.isLoading) return <PageLoading />;

  const room = rooms.data?.find((r) => r.id === roomId);
  if (!room || !stages.data || !tasks.data || !materials.data || !warnings.data) {
    return (
      <ProjectEmpty title={t("roomView.notFoundTitle")} text={t("roomView.notFoundText")} action={<BackToPlan projectId={projectId} />} />
    );
  }

  const derived = room.progress_mode === "tasks" && tasks.data.length > 0;

  return (
    <div className="mx-auto w-full max-w-4xl space-y-8">
      <div>
        <BackToPlan projectId={projectId} roomId={roomId} />
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-headline-md text-on-surface">{room.name}</h1>
          <StatusPill status={room.status} />
        </div>
        <div className="mt-4 flex justify-between text-body-md text-on-surface-variant">
          <span>{t("selectedRoom.progress")}</span>
          <span className="font-medium text-on-surface">{room.progress}%</span>
        </div>
        <ProgressBar
          value={room.progress}
          tone={statusTone[room.status]}
          className="mt-2"
          aria-label={t("selectedRoom.progressAriaLabel", { name: room.name })}
        />
        {isManager && (
          <p className="mt-2 text-body-sm text-on-surface-variant">
            {derived ? t("roomView.progressFromWorks") : t("roomView.progressManual")}
          </p>
        )}
        {room.client_note && <p className="mt-4 text-body-md text-on-surface-variant">{room.client_note}</p>}
      </div>

      <RoomWarnings projectId={projectId} roomId={roomId} warnings={warnings.data} materials={materials.data} isManager={isManager} />
      <RoomWorks projectId={projectId} roomId={roomId} tasks={tasks.data} stages={stages.data} isManager={isManager} />
      <RoomMaterials projectId={projectId} roomId={roomId} materials={materials.data} isManager={isManager} />
    </div>
  );
}
