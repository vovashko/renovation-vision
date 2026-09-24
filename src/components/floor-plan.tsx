import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Icon } from "@/components/ui/icon";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { buttonVariants } from "@/components/ui/button";
import { rooms, statusLabel, type Room, type Status } from "@/lib/renovation-data";
import { renders } from "@/lib/media-data";
import { usePhotos } from "@/lib/photo-store";
import { EmptyPhotos, PhotoThumbs } from "@/components/photo-thumbs";
import { statusBg, statusChip, statusStroke, statusTileSvg, statusTone } from "@/lib/status-ui";
import { cn } from "@/lib/utils";

// Plan geometry: rooms live on a 600x420 grid starting at (20,20); tiles are inset by
// GAP/2 so neighbours are separated by a 4-unit gap.
const VIEW = "20 20 560 380";
const GAP = 4;
const LEGEND: Status[] = ["done", "progress", "pending", "blocked"];

// The SVG scales with its container, so text sizes step down as the container widens
// to render at roughly title-sm (14px) / body-sm (12px) at every width.
const nameSize =
  "text-[28px] @xs:text-[24px] @sm:text-[20px] @md:text-[17px] @lg:text-[15px] @xl:text-[14px] @2xl:text-[12px] @3xl:text-[10px]";
const pctSize =
  "text-[24px] @xs:text-[21px] @sm:text-[17px] @md:text-[15px] @lg:text-[13px] @xl:text-[12px] @2xl:text-[10px] @3xl:text-[9px]";

export function FloorPlan({
  detailed = false,
  activeId,
  onSelect,
}: {
  /** Show planned-look and room photos in the details panel (Plan page). */
  detailed?: boolean;
  activeId?: string;
  onSelect?: (id: string) => void;
}) {
  const [ownId, setOwnId] = useState(rooms[0].id);
  const currentId = activeId ?? ownId;
  const active: Room = rooms.find((r) => r.id === currentId) ?? rooms[0];
  const select = (id: string) => (onSelect ? onSelect(id) : setOwnId(id));

  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
      <div className="rounded-md bg-surface-container-low p-4">
        <div className="@container rounded-md bg-surface-container-high p-2">
          <svg
            viewBox={VIEW}
            className="block h-auto w-full"
            role="group"
            aria-label="Floor plan. Select a room to see its status."
          >
            {rooms.map((r) => {
              const isActive = active.id === r.id;
              const x = r.x + GAP / 2;
              const y = r.y + GAP / 2;
              const w = r.w - GAP;
              const h = r.h - GAP;
              return (
                <g
                  key={r.id}
                  role="button"
                  tabIndex={0}
                  aria-pressed={isActive}
                  aria-label={`${r.name}: ${statusLabel[r.status]}, ${r.progress}%`}
                  onClick={() => select(r.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      select(r.id);
                    }
                  }}
                  className={cn("group cursor-pointer outline-none", statusTileSvg[r.status])}
                >
                  <rect x={x} y={y} width={w} height={h} rx={8} />
                  {/* State layer: 8% hover, 10% focus/pressed of the content color */}
                  <rect
                    x={x}
                    y={y}
                    width={w}
                    height={h}
                    rx={8}
                    className="fill-current opacity-0 transition-opacity duration-150 ease-[cubic-bezier(0.2,0,0,1)] group-hover:opacity-8 group-focus-visible:opacity-10 group-active:opacity-10"
                  />
                  {isActive && (
                    <rect
                      x={x + 1.5}
                      y={y + 1.5}
                      width={w - 3}
                      height={h - 3}
                      rx={6.5}
                      className={cn("fill-none stroke-3", statusStroke[r.status])}
                    />
                  )}
                  <rect
                    x={x - 3}
                    y={y - 3}
                    width={w + 6}
                    height={h + 6}
                    rx={10}
                    className="pointer-events-none fill-none stroke-primary stroke-2 opacity-0 group-focus-visible:opacity-100"
                  />
                  <text
                    x={r.x + r.w / 2}
                    y={r.y + r.h / 2}
                    textAnchor="middle"
                    className={cn("pointer-events-none fill-current font-medium", nameSize)}
                  >
                    {r.name}
                  </text>
                  <text
                    x={r.x + r.w / 2}
                    y={r.y + r.h / 2}
                    dy="1.4em"
                    textAnchor="middle"
                    className={cn("pointer-events-none fill-current", pctSize)}
                  >
                    {r.progress}%
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
        <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-2" aria-label="Legend">
          {LEGEND.map((s) => (
            <li key={s} className="flex items-center gap-2 text-body-md text-on-surface-variant">
              <span className={cn("size-3 rounded-xs", statusBg[s])} aria-hidden />
              {statusLabel[s]}
            </li>
          ))}
        </ul>
      </div>
      <RoomDetails room={active} detailed={detailed} />
    </div>
  );
}

function RoomDetails({ room, detailed }: { room: Room; detailed: boolean }) {
  const { photos } = usePhotos();
  const roomPhotos = photos.filter((p) => p.roomId === room.id);
  const render = renders.find((r) => r.roomId === room.id);

  return (
    <section
      aria-live="polite"
      aria-label={`Selected room: ${room.name}`}
      className="rounded-md bg-surface-container-low p-5"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-label-md text-on-surface-variant">Selected room</div>
          <h3 className="text-title-lg">{room.name}</h3>
          <Badge variant={statusChip[room.status]} className="mt-3">
            {statusLabel[room.status]}
          </Badge>
        </div>
        {detailed && (
          <Link
            to="/design"
            search={{ room: room.id }}
            className="group w-24 shrink-0 rounded-sm text-center text-label-md text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary md:w-28"
            aria-label={
              render ? `Planned look for ${room.name}` : `Design renders for ${room.name}`
            }
          >
            {render ? (
              <img
                src={render.src}
                alt=""
                width={224}
                height={168}
                className="aspect-[4/3] w-full rounded-sm object-cover"
              />
            ) : (
              <span className="flex aspect-[4/3] w-full items-center justify-center rounded-sm border border-dashed border-outline-variant bg-surface-container-high text-on-surface-variant">
                <Icon name="palette" size={20} />
              </span>
            )}
            <span className="mt-1 block group-hover:underline">
              {render ? "Planned look" : "Renders coming"}
            </span>
          </Link>
        )}
      </div>
      <div className="mt-5">
        <div className="mb-2 flex justify-between text-body-md">
          <span className="text-on-surface-variant">Progress</span>
          <span className="font-medium text-on-surface">{room.progress}%</span>
        </div>
        <Progress
          value={room.progress}
          tone={statusTone[room.status]}
          aria-label={`${room.name} progress`}
        />
      </div>

      {detailed ? (
        <div className="mt-5 border-t border-outline-variant pt-4">
          <div className="mb-2 flex items-center justify-between gap-3">
            <h4 className="text-title-sm">Photos of this room</h4>
            {roomPhotos.length > 0 && (
              <Link
                to="/photos"
                search={{ room: room.id }}
                className={cn(buttonVariants({ variant: "ghost" }), "-mr-3 min-h-11")}
              >
                All {roomPhotos.length}
                <Icon name="arrow_forward" size={18} />
              </Link>
            )}
          </div>
          {roomPhotos.length > 0 ? (
            <PhotoThumbs photos={roomPhotos} max={3} className="grid grid-cols-3 gap-2" />
          ) : (
            <EmptyPhotos compact text={`No photos of the ${room.name.toLowerCase()} yet.`} />
          )}
        </div>
      ) : (
        <p className="mt-5 text-body-md text-on-surface-variant">
          Tap any room on the floor plan to view its current renovation status.
        </p>
      )}
    </section>
  );
}
