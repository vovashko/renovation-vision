import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { StatusPill } from "@/components/status-pill";
import { ProgressBar } from "@/components/ui/progress-bar";
import { statusTone } from "@/components/ui/status-ui";
import type { Status } from "@/domain/status";

export type SelectedRoom = { name: string; status: Status; progress: number };

/** The floor plan's selected-room panel content (goes inside the tinted card beside the plan). */
export function SelectedRoomPanel({ room, children }: { room: SelectedRoom; children?: ReactNode }) {
  const { t } = useTranslation("work");
  return (
    <>
      <div className="text-body-md text-on-surface-variant">{t("selectedRoom.label")}</div>
      <h3 className="mt-1 text-title-lg">{room.name}</h3>
      <StatusPill status={room.status} size="sm" onPanel className="mt-3" />
      <div className="mt-5 flex justify-between text-body-md">
        <span className="text-on-surface-variant">{t("selectedRoom.progress")}</span>
        <span className="font-medium text-on-surface">{room.progress}%</span>
      </div>
      <ProgressBar
        value={room.progress}
        tone={statusTone[room.status]}
        onPanel
        className="mt-2"
        aria-label={t("selectedRoom.progressAriaLabel", { name: room.name })}
      />
      {children ?? <p className="mt-5 text-body-md text-on-surface-variant">{t("selectedRoom.clickPrompt")}</p>}
    </>
  );
}
