import { createFileRoute, Link } from "@tanstack/react-router";
import { Icon } from "@/components/ui/icon";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { buttonVariants } from "@/components/ui/button";
import { stages, statusLabel } from "@/lib/renovation-data";
import { statusChip, statusContainer, statusTone } from "@/lib/status-ui";
import { cn } from "@/lib/utils";
import { usePhotos } from "@/lib/photo-store";
import { EmptyPhotos, PhotoThumbs } from "@/components/photo-thumbs";

export const Route = createFileRoute("/stages")({
  head: () => ({
    meta: [
      { title: "Stages — RenoTrack" },
      { name: "description", content: "All renovation stages with tasks and progress." },
    ],
  }),
  component: StagesPage,
});

function StagesPage() {
  const { photos } = usePhotos();
  return (
    <div className="mx-auto w-full max-w-5xl">
      <h1 className="text-headline-md">Renovation stages</h1>
      <p className="mt-1 text-body-lg text-on-surface-variant">
        Detailed breakdown of every stage and its tasks.
      </p>

      <ol className="relative mt-8 space-y-6 before:absolute before:bottom-2 before:left-[19px] before:top-2 before:w-0.5 before:bg-outline-variant">
        {stages.map((s, i) => {
          const stagePhotos = photos.filter((p) => p.stageId === s.id);
          return (
            <li key={s.id} className="relative pl-14">
              <div
                className={cn(
                  "absolute left-0 top-3 flex size-10 items-center justify-center rounded-full text-label-lg",
                  statusContainer[s.status],
                )}
                aria-hidden
              >
                {i + 1}
              </div>
              <Card className="px-4 pb-5 pt-4 md:px-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-title-lg">{s.name}</h2>
                    <div className="text-body-md text-on-surface-variant">
                      {s.start} – {s.end}
                    </div>
                  </div>
                  <Badge variant={statusChip[s.status]}>{statusLabel[s.status]}</Badge>
                </div>
                <div className="mt-5">
                  <div className="mb-2 flex justify-between text-body-sm text-on-surface-variant">
                    <span>Progress</span>
                    <span>{s.progress}%</span>
                  </div>
                  <Progress
                    value={s.progress}
                    tone={statusTone[s.status]}
                    aria-label={`${s.name} progress`}
                  />
                </div>
                <ul className="mt-3">
                  {s.tasks.map((t) => (
                    <li key={t.name} className="flex min-h-12 items-center gap-4">
                      <Icon
                        name={t.done ? "check_box" : "check_box_outline_blank"}
                        fill={t.done}
                        className={t.done ? "text-success" : "text-on-surface-variant"}
                      />
                      <span
                        className={cn(
                          "text-body-lg",
                          t.done && "text-on-surface-variant line-through",
                        )}
                      >
                        <span className="sr-only">{t.done ? "Done: " : "To do: "}</span>
                        {t.name}
                      </span>
                    </li>
                  ))}
                </ul>
                <div className="mt-4 border-t border-outline-variant pt-4">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <h3 className="flex items-center gap-2 text-title-sm">
                      <Icon name="photo_camera" size={20} className="text-on-surface-variant" />
                      {stagePhotos.length} {stagePhotos.length === 1 ? "photo" : "photos"}
                    </h3>
                    {stagePhotos.length > 0 && (
                      <Link
                        to="/photos"
                        search={{ stage: s.id }}
                        className={cn(buttonVariants({ variant: "ghost" }), "-mr-3 min-h-11")}
                      >
                        See all
                        <Icon name="arrow_forward" size={18} />
                      </Link>
                    )}
                  </div>
                  {stagePhotos.length > 0 ? (
                    <PhotoThumbs photos={stagePhotos} max={4} />
                  ) : (
                    <EmptyPhotos
                      compact
                      text={
                        s.status === "pending"
                          ? `Photos will appear here once ${s.name} starts on ${s.start}.`
                          : "No photos for this stage yet."
                      }
                    />
                  )}
                </div>
              </Card>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
