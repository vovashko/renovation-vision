import { useMemo, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import type { Status } from "@/domain/status";
import { useStatusLabel } from "@/i18n";
import { statusContainer, statusOutline } from "@/components/ui/status-ui";
import { Card } from "@/components/ui/card";
import { layoutRooms } from "@/domain/floor-plan-layout";
import { StatusLegend } from "@/components/status-pill";
import { SelectedRoomPanel, type SelectedRoom } from "./selected-room-panel";

export type FloorPlanRoom = {
  id: string;
  name: string;
  status: Status;
  progress: number;
  /** Real width and length in metres: the plan sizes and places the tile from these. */
  w: number;
  h: number;
  muted?: boolean;
};

// Plan geometry: rooms are laid out on a 600x420 grid by `layoutRooms`, each tile's area proportional to the
// room's real area. Each tile is inset by GAP on every side so
// neighbouring rooms sit 2*GAP plan-units apart (~6px at a typical rendered width). This grid
// has no shadcn/spec primitive to compose from — it's a genuinely bespoke, positioned widget —
// so its tiles are styled here directly, through the shared status-ui.ts token maps only.
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
  const { t } = useTranslation("work");
  const statusLabel = useStatusLabel();
  const active = rooms.find((r) => r.id === activeId) ?? null;
  const layout = useMemo(() => layoutRooms(rooms, GRID_W, GRID_H), [rooms]);

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
      <Card className="p-4">
        <div
          className="relative w-full overflow-hidden rounded-lg bg-surface-container"
          style={{ aspectRatio: `${GRID_W} / ${GRID_H}` }}
          role="group"
          aria-label={t("floorPlan.ariaLabel")}
        >
          {rooms.map((r) => {
            const isActive = active?.id === r.id;
            const isPending = r.status === "pending";
            const box = layout.get(r.id);
            if (!box) return null;
            return (
              <button
                key={r.id}
                type="button"
                onClick={() => onSelect?.(r)}
                aria-pressed={onSelect ? isActive : undefined}
                aria-label={t("floorPlan.tileLabel", { name: r.name, status: statusLabel(r.status), progress: r.progress })}
                style={{
                  left: pct(box.x + GAP, GRID_W),
                  top: pct(box.y + GAP, GRID_H),
                  width: pct(Math.max(box.w - GAP * 2, 1), GRID_W),
                  height: pct(Math.max(box.h - GAP * 2, 1), GRID_H),
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
            <SelectedRoomPanel room={active} />
          ) : (
            <p className="text-body-md text-on-surface-variant">{t("selectedRoom.clickPrompt")}</p>
          ))}
      </Card>
    </div>
  );
}

export type { SelectedRoom };
