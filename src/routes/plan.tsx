import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { FloorPlan } from "@/components/floor-plan";
import { rooms, statusLabel } from "@/lib/renovation-data";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cardVariants } from "@/components/ui/card";
import { statusChip, statusTone } from "@/lib/status-ui";
import { cn } from "@/lib/utils";

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
      <h1 className="text-headline-md">Floor plan</h1>
      <p className="mt-1 text-body-lg text-on-surface-variant">
        Tap a room to inspect its current renovation status.
      </p>

      <div className="mt-6">
        <FloorPlan detailed activeId={activeId} onSelect={select} />
      </div>

      <h2 className="mt-10 text-title-lg">Rooms</h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {rooms.map((r) => (
          <button
            key={r.id}
            onClick={() => {
              select(r.id);
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
            aria-pressed={r.id === activeId}
            className={cn(
              cardVariants({ interactive: true }),
              "text-left",
              r.id === activeId && "border-2 border-primary",
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-title-md">{r.name}</span>
              <Badge variant={statusChip[r.status]}>{statusLabel[r.status]}</Badge>
            </div>
            <Progress
              value={r.progress}
              tone={statusTone[r.status]}
              className="mt-4"
              aria-label={`${r.name} progress`}
            />
            <div className="mt-1 text-right text-body-sm text-on-surface-variant">
              {r.progress}%
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
