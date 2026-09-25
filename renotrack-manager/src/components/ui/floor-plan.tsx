import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Card } from "./card";
import { ProgressBar } from "./progress-bar";
import { statusLabel, statusStroke, statusTileSvg, type Status } from "./status";
import { StatusLegend, StatusPill } from "./status-pill";

export type FloorPlanRoom = {
  id: string;
  name: string;
  status: Status;
  progress: number;
  // SVG rect coords on a 600x420 viewBox
  x: number;
  y: number;
  w: number;
  h: number;
  muted?: boolean;
};

// Each room is inset by half the 6px gap so neighbouring tiles sit 6px apart.
const GAP = 3;

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
        <svg viewBox="0 0 600 420" className="h-auto w-full" role="group" aria-label="Floor plan">
          <rect x="0" y="0" width="600" height="420" rx="16" className="fill-surface-container" />
          {rooms.map((r) => {
            const isActive = active?.id === r.id;
            const x = r.x + GAP;
            const y = r.y + GAP;
            const w = Math.max(r.w - GAP * 2, 1);
            const h = Math.max(r.h - GAP * 2, 1);
            return (
              <g
                key={r.id}
                onClick={() => onSelect?.(r)}
                onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onSelect?.(r)}
                tabIndex={onSelect ? 0 : undefined}
                role={onSelect ? "button" : undefined}
                aria-pressed={onSelect ? isActive : undefined}
                aria-label={`${r.name}: ${statusLabel[r.status]}, ${r.progress}%`}
                className={cn(
                  "cursor-pointer outline-none [&:focus-visible>rect]:stroke-primary [&:focus-visible>rect]:[stroke-width:3]",
                  statusTileSvg[r.status],
                  r.muted && "opacity-50",
                )}
              >
                <rect
                  x={x}
                  y={y}
                  width={w}
                  height={h}
                  rx="12"
                  className={cn(
                    "transition-[stroke] duration-150",
                    r.status === "pending" && !isActive && "stroke-outline",
                    isActive && statusStroke[r.status],
                  )}
                  strokeWidth={isActive ? 2 : r.status === "pending" ? 1 : 0}
                  strokeDasharray={r.status === "pending" && !isActive ? "5 4" : undefined}
                />
                <text x={x + w / 2} y={y + h / 2 - 4} textAnchor="middle" className="fill-current text-label-lg">
                  {r.name}
                </text>
                <text x={x + w / 2} y={y + h / 2 + 14} textAnchor="middle" className="fill-current text-body-sm opacity-80">
                  {r.progress}%
                </text>
              </g>
            );
          })}
        </svg>
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

/** Selected room panel content (goes inside the tinted panel). */
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
      <ProgressBar value={room.progress} onPanel className="mt-2" />
      {children ?? (
        <p className="mt-5 text-body-md text-on-surface-variant">Click any room on the floor plan to view its current renovation status.</p>
      )}
    </>
  );
}
