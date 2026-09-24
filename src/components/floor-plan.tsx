import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Palette } from "lucide-react";
import { rooms, statusFill, statusLabel, type Room } from "@/lib/renovation-data";
import { renders } from "@/lib/media-data";
import { usePhotos } from "@/lib/photo-store";
import { EmptyPhotos, PhotoThumbs } from "@/components/photo-thumbs";

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
    <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
      <div className="rounded-xl border bg-card p-3 shadow-[var(--shadow-soft)] md:p-4">
        <svg
          viewBox="0 0 600 420"
          className="h-auto w-full"
          role="group"
          aria-label="Floor plan. Select a room to see its status."
        >
          <rect x="0" y="0" width="600" height="420" fill="var(--muted)" rx="12" />
          {rooms.map((r) => {
            const isActive = active.id === r.id;
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
                className="cursor-pointer outline-none transition-opacity hover:opacity-90 [&:focus-visible>rect]:stroke-[var(--ring)] [&:focus-visible>rect]:[stroke-width:4]"
              >
                <rect
                  x={r.x}
                  y={r.y}
                  width={r.w}
                  height={r.h}
                  fill={statusFill[r.status]}
                  fillOpacity={isActive ? 0.85 : 0.55}
                  stroke={isActive ? "var(--primary)" : "var(--border)"}
                  strokeWidth={isActive ? 3 : 1.5}
                  rx="6"
                />
                <text
                  x={r.x + r.w / 2}
                  y={r.y + r.h / 2 - 4}
                  textAnchor="middle"
                  className="pointer-events-none fill-foreground text-[26px] font-semibold md:text-sm"
                >
                  {r.name}
                </text>
                <text
                  x={r.x + r.w / 2}
                  y={r.y + r.h / 2 + 24}
                  textAnchor="middle"
                  className="pointer-events-none fill-foreground/70 text-[22px] md:text-xs"
                >
                  {r.progress}%
                </text>
              </g>
            );
          })}
        </svg>
        <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted-foreground">
          {(["done", "progress", "pending", "blocked"] as const).map((s) => (
            <div key={s} className="flex items-center gap-1.5">
              <span
                className="inline-block h-3 w-3 rounded"
                style={{ background: statusFill[s] }}
              />
              {statusLabel[s]}
            </div>
          ))}
        </div>
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
      className="rounded-xl border bg-card p-4 shadow-[var(--shadow-soft)] md:p-5"
    >
      <div className="text-xs uppercase tracking-wide text-muted-foreground">Selected room</div>
      <div className="mt-1 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-xl font-semibold">{room.name}</h3>
          <div
            className="mt-2 inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium text-white"
            style={{ background: statusFill[room.status] }}
          >
            {statusLabel[room.status]}
          </div>
        </div>
        {detailed && (
          <Link
            to="/design"
            search={{ room: room.id }}
            className="group w-24 shrink-0 text-center text-xs font-medium text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:w-28"
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
                className="aspect-[4/3] w-full rounded-lg border object-cover transition-transform group-hover:scale-105"
              />
            ) : (
              <span className="flex aspect-[4/3] w-full items-center justify-center rounded-lg border border-dashed bg-muted text-muted-foreground">
                <Palette className="h-5 w-5" />
              </span>
            )}
            <span className="mt-1 block">{render ? "Planned look →" : "Renders coming"}</span>
          </Link>
        )}
      </div>
      <div className="mt-5">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Progress</span>
          <span className="font-medium">{room.progress}%</span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full"
            style={{ width: `${room.progress}%`, background: "var(--gradient-primary)" }}
          />
        </div>
      </div>

      {detailed ? (
        <div className="mt-5 border-t pt-4">
          <div className="mb-2 flex items-center justify-between gap-3">
            <h4 className="text-sm font-medium">Photos of this room</h4>
            {roomPhotos.length > 0 && (
              <Link
                to="/photos"
                search={{ room: room.id }}
                className="inline-flex min-h-11 items-center text-sm text-primary hover:underline"
              >
                All {roomPhotos.length} →
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
        <p className="mt-5 text-sm text-muted-foreground">
          Tap any room on the floor plan to view its current renovation status.
        </p>
      )}
    </section>
  );
}
