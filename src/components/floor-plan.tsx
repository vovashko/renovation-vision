import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { statusLabel, type Status } from "@/lib/status";
import { statusContainer, statusOutline, statusTone } from "@/lib/status-ui";
import { Card } from "@/components/ui/card";
import { ProgressBar } from "@/components/ui/progress-bar";
import { StatusLegend, StatusPill } from "./status-pill";

export type FloorPlanRoom = {
  id: string;
  name: string;
  status: Status;
  progress: number;
  // Position on a 600x420 plan grid.
  x: number;
  y: number;
  w: number;
  h: number;
  muted?: boolean;
};

// Plan geometry: rooms live on a 600x420 grid. Each tile is inset by GAP on every side so
// neighbouring rooms sit 2*GAP plan-units apart (~6px at a typical rendered width).
const GRID_W = 600;
const GRID_H = 420;
const GAP = 3;

const pct = (n: number, of: number) => `${(n / of) * 100}%`;

/**
 * Floor plan with clickable rooms, legend and a detail panel.
 * Controlled: pass `activeId` and `onSelect`. Replace the default panel with `detail`.
 */
export function FloorPlan({
  rooms,
  activeId,
  onSelect,
  detail,
}: {
  rooms: FloorPlanRoom[];
  activeId?: string | null;
  onSelect?: (room: FloorPlanRoom) => void;
  detail?: ReactNode;
}) {
  const active = rooms.find((r) => r.id === activeId) ?? null;

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
      <Card className="p-4">
        <div
          className="relative w-full overflow-hidden rounded-lg bg-surface-container"
          style={{ aspectRatio: `${GRID_W} / ${GRID_H}` }}
          role="group"
          aria-label="Floor plan"
        >
          {rooms.map((r) => {
            const isActive = active?.id === r.id;
            const isPending = r.status === "pending";
            return (
              <button
                key={r.id}
                type="button"
                onClick={() => onSelect?.(r)}
                aria-pressed={onSelect ? isActive : undefined}
                aria-label={`${r.name}: ${statusLabel[r.status]}, ${r.progress}%`}
                style={{
                  left: pct(r.x + GAP, GRID_W),
                  top: pct(r.y + GAP, GRID_H),
                  width: pct(Math.max(r.w - GAP * 2, 1), GRID_W),
                  height: pct(Math.max(r.h - GAP * 2, 1), GRID_H),
                }}
                className={cn(
                  "absolute flex flex-col items-center justify-center gap-0.5 overflow-hidden rounded-md px-1 text-center transition-opacity",
                  // Not "outline-none": that utility's --tw-outline-style cascades over the
                  // selected-room outline below, which needs to stay solid, not just on focus.
                  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
                  // Pending has no border of its own here — only bg/text — so a selected pending
                  // tile can swap the dashed border for a solid outline instead of layering both.
                  isPending ? "bg-status-pending-container text-on-status-pending-container" : statusContainer[r.status],
                  isPending && !isActive && "border border-dashed border-outline",
                  isActive && cn("outline-2 -outline-offset-2", statusOutline[r.status]),
                  r.muted && "opacity-50",
                )}
              >
                <span className="w-full truncate text-label-lg">{r.name}</span>
                <span className="text-body-sm opacity-80">{r.progress}%</span>
              </button>
            );
          })}
        </div>
        <StatusLegend className="mt-3.5" />
      </Card>
      <Card variant="tinted" className="p-5 lg:self-start">
        {detail ??
          (active ? (
            <RoomDetail room={active} />
          ) : (
            <p className="text-body-md text-on-surface-variant">Click any room on the floor plan to view its current renovation status.</p>
          ))}
      </Card>
    </div>
  );
}

/** Selected room panel content (goes inside the tinted card beside the plan). */
export function RoomDetail({ room, children }: { room: FloorPlanRoom; children?: ReactNode }) {
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
