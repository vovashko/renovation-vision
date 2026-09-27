import type { ReactNode } from "react";
import { StatusPill } from "@/components/status-pill";
import { ProgressBar } from "@/components/ui/progress-bar";
import { statusTone } from "@/lib/status-ui";
import type { Status } from "@/lib/status";

export type SelectedRoom = { name: string; status: Status; progress: number };

/** The floor plan's selected-room panel content (goes inside the tinted card beside the plan). */
export function SelectedRoomPanel({ room, children }: { room: SelectedRoom; children?: ReactNode }) {
  return (
    <>
      <div className="text-body-md text-on-surface-variant">Selected room</div>
      <h3 className="mt-1 text-title-lg">{room.name}</h3>
      <StatusPill status={room.status} size="sm" onPanel className="mt-3" />
      <div className="mt-5 flex justify-between text-body-md">
        <span className="text-on-surface-variant">Progress</span>
        <span className="font-medium text-on-surface">{room.progress}%</span>
      </div>
      <ProgressBar value={room.progress} tone={statusTone[room.status]} onPanel className="mt-2" aria-label={`${room.name} progress`} />
      {children ?? (
        <p className="mt-5 text-body-md text-on-surface-variant">Click any room on the floor plan to view its current renovation status.</p>
      )}
    </>
  );
}
