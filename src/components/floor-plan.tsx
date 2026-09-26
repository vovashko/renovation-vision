import type { ReactNode } from "react";
import { statusFill, statusLabel, type Status } from "@/lib/status";
import { StatusLegend } from "./status-pill";
import { ProgressBar } from "./progress-bar";

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
    <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
      <div className="rounded-xl border bg-card p-4 shadow-[var(--shadow-soft)]">
        <svg viewBox="0 0 600 420" className="h-auto w-full" role="group" aria-label="Floor plan">
          <rect x="0" y="0" width="600" height="420" fill="var(--muted)" rx="12" />
          {rooms.map((r) => {
            const isActive = active?.id === r.id;
            return (
              <g
                key={r.id}
                onClick={() => onSelect?.(r)}
                onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onSelect?.(r)}
                tabIndex={onSelect ? 0 : undefined}
                role={onSelect ? "button" : undefined}
                aria-label={`${r.name}: ${statusLabel[r.status]}, ${r.progress}%`}
                className="cursor-pointer transition-opacity outline-none hover:opacity-90"
              >
                <rect
                  x={r.x}
                  y={r.y}
                  width={r.w}
                  height={r.h}
                  fill={statusFill[r.status]}
                  fillOpacity={r.muted ? 0.2 : isActive ? 0.85 : 0.55}
                  stroke={isActive ? "var(--primary)" : "var(--border)"}
                  strokeWidth={isActive ? 3 : 1.5}
                  strokeDasharray={r.muted ? "6 4" : undefined}
                  rx="6"
                />
                <text x={r.x + r.w / 2} y={r.y + r.h / 2 - 6} textAnchor="middle" className="fill-foreground text-sm font-semibold">
                  {r.name}
                </text>
                <text x={r.x + r.w / 2} y={r.y + r.h / 2 + 14} textAnchor="middle" className="fill-foreground/70 text-xs">
                  {r.progress}%
                </text>
              </g>
            );
          })}
        </svg>
        <StatusLegend className="mt-4" />
      </div>
      <div className="rounded-xl border bg-card p-5 shadow-[var(--shadow-soft)]">
        {detail ??
          (active ? (
            <RoomDetail room={active} />
          ) : (
            <p className="text-sm text-muted-foreground">Click any room on the floor plan to view its current renovation status.</p>
          ))}
      </div>
    </div>
  );
}

export function RoomDetail({ room, children }: { room: FloorPlanRoom; children?: ReactNode }) {
  return (
    <>
      <div className="text-xs tracking-wide text-muted-foreground uppercase">Selected room</div>
      <h3 className="mt-1 text-xl font-semibold">{room.name}</h3>
      <div
        className="mt-3 inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium text-white"
        style={{ background: statusFill[room.status] }}
      >
        {statusLabel[room.status]}
      </div>
      <div className="mt-5">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Progress</span>
          <span className="font-medium">{room.progress}%</span>
        </div>
        <ProgressBar value={room.progress} className="mt-2" />
      </div>
      {children ?? (
        <p className="mt-5 text-sm text-muted-foreground">Click any room on the floor plan to view its current renovation status.</p>
      )}
    </>
  );
}
