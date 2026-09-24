import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { usePhotos } from "@/lib/photo-store";
import { rooms, stages } from "@/lib/renovation-data";
import { dayLabel, timeLabel, type SitePhoto } from "@/lib/media-data";
import { roomName, stageName, toLightbox } from "@/lib/photo-helpers";
import { FilterChips } from "@/components/filter-chips";
import { Lightbox } from "@/components/lightbox";
import { EmptyPhotos } from "@/components/photo-thumbs";
import { PhotoUploadSheet } from "@/components/photo-upload-sheet";

export const Route = createFileRoute("/photos")({
  validateSearch: (s: Record<string, unknown>): { stage?: string; room?: string } => ({
    stage: typeof s.stage === "string" ? s.stage : undefined,
    room: typeof s.room === "string" ? s.room : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Site photos — RenoTrack" },
      {
        name: "description",
        content: "Daily site photos of your renovation, grouped by date, stage and room.",
      },
      { property: "og:title", content: "Site photos — RenoTrack" },
      { property: "og:description", content: "See your renovation without being there." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PhotosPage,
});

function PhotosPage() {
  const search = Route.useSearch();
  const { photos } = usePhotos();
  const [mode, setMode] = useState<"latest" | "stage" | "room">(
    search.room ? "room" : search.stage ? "stage" : "latest",
  );
  const [stage, setStage] = useState(search.stage ?? stages[2].id);
  const [room, setRoom] = useState(search.room ?? rooms[0].id);
  const [open, setOpen] = useState<number | null>(null);

  const filtered = useMemo(
    () =>
      photos.filter((p) =>
        mode === "stage" ? p.stageId === stage : mode === "room" ? p.roomId === room : true,
      ),
    [photos, mode, stage, room],
  );
  const groups = useMemo(() => {
    const g: { label: string; items: { p: SitePhoto; i: number }[] }[] = [];
    filtered.forEach((p, i) => {
      const label = dayLabel(p.takenAt);
      const last = g[g.length - 1];
      if (last && last.label === label) last.items.push({ p, i });
      else g.push({ label, items: [{ p, i }] });
    });
    return g;
  }, [filtered]);

  return (
    <div className="mx-auto w-full max-w-5xl">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold md:text-3xl">Site photos</h1>
          <p className="mt-1 text-muted-foreground">See it without being there.</p>
        </div>
        <PhotoUploadSheet />
      </div>

      <div className="mt-5 space-y-3">
        <FilterChips
          label="Filter photos by"
          value={mode}
          onChange={(v) => setMode(v as typeof mode)}
          options={[
            { value: "latest", label: "Latest updates" },
            { value: "stage", label: "By stage" },
            { value: "room", label: "By room" },
          ]}
        />
        {mode === "stage" && (
          <FilterChips
            label="Stage"
            value={stage}
            onChange={setStage}
            options={stages.map((s) => ({ value: s.id, label: s.name }))}
          />
        )}
        {mode === "room" && (
          <FilterChips
            label="Room"
            value={room}
            onChange={setRoom}
            options={rooms.map((r) => ({ value: r.id, label: r.name }))}
          />
        )}
      </div>

      {filtered.length === 0 ? (
        <EmptyPhotos
          text={`No photos yet for ${mode === "stage" ? stageName(stage) : roomName(room)}. ${stages.find((s) => s.id === stage)?.status === "pending" && mode === "stage" ? "This stage hasn't started." : "Jonas will add some soon."}`}
        />
      ) : (
        <div className="mt-6 space-y-8">
          {groups.map((g) => (
            <section key={g.label} aria-label={g.label}>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                {g.label}
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {g.items.map(({ p, i }) => (
                  <article
                    key={p.id}
                    className="overflow-hidden rounded-xl border bg-card shadow-[var(--shadow-soft)]"
                  >
                    <button
                      onClick={() => setOpen(i)}
                      className="block w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      aria-label={`Open photo: ${p.caption}`}
                    >
                      <img
                        src={p.src}
                        alt={p.alt}
                        loading="lazy"
                        width={1024}
                        height={768}
                        className="aspect-[4/3] w-full object-cover"
                      />
                    </button>
                    <div className="p-4">
                      <p className="text-sm">{p.caption}</p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        <span className="rounded-full bg-accent px-2.5 py-0.5 text-xs font-medium text-accent-foreground">
                          {stageName(p.stageId)}
                        </span>
                        <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium">
                          {roomName(p.roomId)}
                        </span>
                      </div>
                      <div className="mt-2 text-xs text-muted-foreground">
                        {timeLabel(p.takenAt)} · {p.uploadedBy}
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
      <Lightbox items={filtered.map(toLightbox)} index={open} onClose={() => setOpen(null)} />
    </div>
  );
}
