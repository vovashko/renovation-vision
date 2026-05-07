import { createFileRoute } from "@tanstack/react-router";
import { FloorPlan } from "@/components/floor-plan";
import { rooms, statusFill, statusLabel } from "@/lib/renovation-data";

export const Route = createFileRoute("/plan")({
  head: () => ({
    meta: [
      { title: "Plan — RenoTrack" },
      { name: "description", content: "Interactive floor plan showing renovation status by room." },
    ],
  }),
  component: PlanPage,
});

function PlanPage() {
  return (
    <div className="mx-auto w-full max-w-6xl">
      <h1 className="text-3xl font-semibold">Floor plan</h1>
      <p className="mt-1 text-muted-foreground">Tap a room to inspect its current renovation status.</p>

      <div className="mt-6">
        <FloorPlan />
      </div>

      <h2 className="mt-10 text-xl font-semibold">Rooms</h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {rooms.map((r) => (
          <div key={r.id} className="rounded-xl border bg-card p-4 shadow-[var(--shadow-soft)]">
            <div className="flex items-center justify-between">
              <span className="font-medium">{r.name}</span>
              <span
                className="rounded-full px-2.5 py-0.5 text-xs font-medium text-white"
                style={{ background: statusFill[r.status] }}
              >
                {statusLabel[r.status]}
              </span>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full" style={{ width: `${r.progress}%`, background: statusFill[r.status] }} />
            </div>
            <div className="mt-1 text-right text-xs text-muted-foreground">{r.progress}%</div>
          </div>
        ))}
      </div>
    </div>
  );
}
