import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { FloorPlan } from "@/components/floor-plan";
import { rooms, statusFill, statusLabel } from "@/lib/renovation-data";

export const Route = createFileRoute("/plan")({
  validateSearch: (s: Record<string, unknown>): { room?: string } => ({
    room: typeof s.room === "string" ? s.room : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Plan — RenoTrack" },
      { name: "description", content: "Interactive floor plan showing renovation status by room." },
    ],
  }),
  component: PlanPage,
});

function PlanPage() {
  const { room } = Route.useSearch();
  const navigate = useNavigate({ from: "/plan" });
  const activeId = rooms.some((r) => r.id === room) ? room! : rooms[0].id;
  const select = (id: string) =>
    navigate({ search: { room: id }, replace: true, resetScroll: false });

  return (
    <div className="mx-auto w-full max-w-6xl">
      <h1 className="text-2xl font-semibold md:text-3xl">Floor plan</h1>
      <p className="mt-1 text-muted-foreground">
        Tap a room to inspect its current renovation status.
      </p>

      <div className="mt-6">
        <FloorPlan detailed activeId={activeId} onSelect={select} />
      </div>

      <h2 className="mt-10 text-xl font-semibold">Rooms</h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {rooms.map((r) => (
          <button
            key={r.id}
            onClick={() => {
              select(r.id);
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
            aria-pressed={r.id === activeId}
            className={`rounded-xl border bg-card p-4 text-left shadow-[var(--shadow-soft)] transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${r.id === activeId ? "border-primary" : ""}`}
          >
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
              <div
                className="h-full rounded-full"
                style={{ width: `${r.progress}%`, background: statusFill[r.status] }}
              />
            </div>
            <div className="mt-1 text-right text-xs text-muted-foreground">{r.progress}%</div>
          </button>
        ))}
      </div>
    </div>
  );
}
