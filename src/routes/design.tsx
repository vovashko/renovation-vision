import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Icon } from "@/components/ui/icon";
import { rooms, statusLabel } from "@/lib/renovation-data";
import { beforeAfter, renders } from "@/lib/media-data";
import { FilterChips } from "@/components/filter-chips";
import { Lightbox } from "@/components/lightbox";
import { BeforeAfter } from "@/components/before-after";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { cardVariants } from "@/components/ui/card";
import { statusChip } from "@/lib/status-ui";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/design")({
  validateSearch: (s: Record<string, unknown>): { room?: string } => ({
    room: typeof s.room === "string" ? s.room : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Design renders — RenoTrack" },
      {
        name: "description",
        content: "The planned finished look of every room, with before/after comparison.",
      },
      { property: "og:title", content: "Design renders — RenoTrack" },
      { property: "og:description", content: "See the planned finished look of your home." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DesignPage,
});

function DesignPage() {
  const search = Route.useSearch();
  const [room, setRoom] = useState(search.room ?? "all");
  const [open, setOpen] = useState<number | null>(null);
  const shownRooms = room === "all" ? rooms : rooms.filter((r) => r.id === room);
  const flat = shownRooms.flatMap((r) => renders.filter((x) => x.roomId === r.id));
  const showCompare = room === "all" || room === beforeAfter.roomId;
  const baRoom = rooms.find((r) => r.id === beforeAfter.roomId)!;

  return (
    <div className="mx-auto w-full max-w-7xl">
      <h1 className="text-headline-md">Planned design</h1>
      <p className="mt-1 text-body-lg text-on-surface-variant">
        How each room will look when finished.
      </p>

      <div className="mt-4">
        <FilterChips
          label="Room"
          value={room}
          onChange={setRoom}
          options={[
            { value: "all", label: "All rooms" },
            ...rooms.map((r) => ({ value: r.id, label: r.name })),
          ]}
        />
      </div>

      {showCompare && (
        <section className="mt-6">
          <h2 className="text-title-lg">{baRoom.name}: now vs. planned</h2>
          <p className="mb-3 text-body-md text-on-surface-variant">Drag the handle to compare.</p>
          <div className="max-w-3xl">
            <BeforeAfter
              before={beforeAfter.before}
              after={beforeAfter.after}
              label={baRoom.name}
            />
          </div>
        </section>
      )}

      <div className="mt-8 space-y-8">
        {shownRooms.map((r) => {
          const list = renders.filter((x) => x.roomId === r.id);
          return (
            <section key={r.id} aria-label={r.name}>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-x-3">
                <h2 className="flex flex-wrap items-center gap-3 text-title-lg">
                  {r.name}
                  <Badge variant={statusChip[r.status]}>
                    {statusLabel[r.status]} · {r.progress}%
                  </Badge>
                </h2>
                <Link
                  to="/plan"
                  search={{ room: r.id }}
                  className={cn(buttonVariants({ variant: "ghost" }), "-mr-3 min-h-11")}
                >
                  See on plan
                  <Icon name="arrow_forward" size={18} />
                </Link>
              </div>
              {list.length === 0 ? (
                <div className="flex items-center gap-3 rounded-md border border-dashed border-outline-variant bg-surface-container-low p-5 text-body-md text-on-surface-variant">
                  <Icon name="palette" size={20} /> Renders for {r.name} are still being prepared by
                  the designer.
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {list.map((x) => (
                    <button
                      key={x.id}
                      onClick={() => setOpen(flat.indexOf(x))}
                      className={cn(
                        cardVariants({ interactive: true }),
                        "overflow-hidden p-0 text-left",
                      )}
                      aria-label={`Open render: ${x.title}`}
                    >
                      <img
                        src={x.src}
                        alt={x.alt}
                        loading="lazy"
                        width={1024}
                        height={768}
                        className="aspect-[4/3] w-full object-cover"
                      />
                      <div className="p-4">
                        <div className="text-title-md">{x.title}</div>
                        <p className="mt-1 text-body-md text-on-surface-variant">{x.description}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </section>
          );
        })}
      </div>
      <Lightbox
        items={flat.map((x) => ({
          src: x.src,
          alt: x.alt,
          title: x.title,
          subtitle: x.description,
          tags: [rooms.find((r) => r.id === x.roomId)!.name],
        }))}
        index={open}
        onClose={() => setOpen(null)}
      />
    </div>
  );
}
