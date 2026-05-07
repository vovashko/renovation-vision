import { useState } from "react";
import { rooms, statusFill, statusLabel, type Room } from "@/lib/renovation-data";

export function FloorPlan() {
  const [active, setActive] = useState<Room | null>(rooms[0]);

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
      <div className="rounded-xl border bg-card p-4 shadow-[var(--shadow-soft)]">
        <svg viewBox="0 0 600 420" className="h-auto w-full">
          <rect x="0" y="0" width="600" height="420" fill="var(--muted)" rx="12" />
          {rooms.map((r) => {
            const isActive = active?.id === r.id;
            return (
              <g
                key={r.id}
                onClick={() => setActive(r)}
                className="cursor-pointer transition-opacity hover:opacity-90"
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
                  y={r.y + r.h / 2 - 6}
                  textAnchor="middle"
                  className="fill-foreground text-sm font-semibold"
                >
                  {r.name}
                </text>
                <text
                  x={r.x + r.w / 2}
                  y={r.y + r.h / 2 + 14}
                  textAnchor="middle"
                  className="fill-foreground/70 text-xs"
                >
                  {r.progress}%
                </text>
              </g>
            );
          })}
        </svg>
        <div className="mt-4 flex flex-wrap gap-3 text-xs text-muted-foreground">
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
      <div className="rounded-xl border bg-card p-5 shadow-[var(--shadow-soft)]">
        {active && (
          <>
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Selected room</div>
            <h3 className="mt-1 text-xl font-semibold">{active.name}</h3>
            <div
              className="mt-3 inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium text-white"
              style={{ background: statusFill[active.status] }}
            >
              {statusLabel[active.status]}
            </div>
            <div className="mt-5">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Progress</span>
                <span className="font-medium">{active.progress}%</span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${active.progress}%`, background: "var(--gradient-primary)" }}
                />
              </div>
            </div>
            <p className="mt-5 text-sm text-muted-foreground">
              Click any room on the floor plan to view its current renovation status.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
