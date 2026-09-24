import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Palette } from "lucide-react";
import { rooms } from "@/lib/renovation-data";
import { beforeAfter, renders } from "@/lib/media-data";
import { FilterChips } from "@/components/filter-chips";
import { Lightbox } from "@/components/lightbox";
import { BeforeAfter } from "@/components/before-after";

export const Route = createFileRoute("/design")({
  validateSearch: (s: Record<string, unknown>): { room?: string } => ({
    room: typeof s.room === "string" ? s.room : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Design renders — RenoTrack" },
      { name: "description", content: "The planned finished look of every room, with before/after comparison." },
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
    <div className="mx-auto w-full max-w-6xl">
      <h1 className="text-2xl font-semibold md:text-3xl">Planned design</h1>
      <p className="mt-1 text-muted-foreground">How each room will look when finished.</p>

      <div className="mt-5">
        <FilterChips label="Room" value={room} onChange={setRoom} options={[{ value: "all", label: "All rooms" }, ...rooms.map((r) => ({ value: r.id, label: r.name }))]} />
      </div>

      {showCompare && (
        <section className="mt-6">
          <h2 className="text-lg font-semibold">{baRoom.name}: now vs. planned</h2>
          <p className="mb-3 text-sm text-muted-foreground">Drag the handle to compare.</p>
          <div className="max-w-3xl"><BeforeAfter before={beforeAfter.before} after={beforeAfter.after} label={baRoom.name} /></div>
        </section>
      )}

      <div className="mt-8 space-y-8">
        {shownRooms.map((r) => {
          const list = renders.filter((x) => x.roomId === r.id);
          return (
            <section key={r.id} aria-label={r.name}>
              <h2 className="mb-3 text-lg font-semibold">{r.name}</h2>
              {list.length === 0 ? (
                <div className="flex items-center gap-3 rounded-xl border border-dashed bg-card p-5 text-sm text-muted-foreground">
                  <Palette className="h-5 w-5 shrink-0" /> Renders for {r.name} are still being prepared by the designer.
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {list.map((x) => (
                    <button key={x.id} onClick={() => setOpen(flat.indexOf(x))} className="overflow-hidden rounded-xl border bg-card text-left shadow-[var(--shadow-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label={`Open render: ${x.title}`}>
                      <img src={x.src} alt={x.alt} loading="lazy" width={1024} height={768} className="aspect-[4/3] w-full object-cover" />
                      <div className="p-4">
                        <div className="font-medium">{x.title}</div>
                        <p className="mt-1 text-sm text-muted-foreground">{x.description}</p>
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
        items={flat.map((x) => ({ src: x.src, alt: x.alt, title: x.title, subtitle: x.description, tags: [rooms.find((r) => r.id === x.roomId)!.name] }))}
        index={open}
        onClose={() => setOpen(null)}
      />
    </div>
  );
}
