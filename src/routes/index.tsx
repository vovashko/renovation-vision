import { createFileRoute, Link } from "@tanstack/react-router";
import { Calendar, DollarSign, TrendingUp, User, type LucideIcon } from "lucide-react";
import { project, stages, overallProgress, statusFill } from "@/lib/renovation-data";
import { FloorPlan } from "@/components/floor-plan";
import { PhotoThumbs } from "@/components/photo-thumbs";
import { usePhotos } from "@/lib/photo-store";
import { dayLabel } from "@/lib/media-data";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Overview — RenoTrack" },
      { name: "description", content: "Live overview of your home renovation progress." },
    ],
  }),
  component: Overview,
});

function Stat({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="rounded-xl border bg-card p-4 shadow-[var(--shadow-soft)] md:p-5">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
        <Icon className="h-4 w-4 shrink-0" />
        {label}
      </div>
      <div className="mt-2 text-lg font-semibold leading-tight sm:text-2xl">{value}</div>
      {sub && <div className="mt-1 text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}

function Overview() {
  const progress = overallProgress();
  const current = stages.find((s) => s.status === "progress");
  const { photos } = usePhotos();

  return (
    <div className="mx-auto w-full max-w-7xl space-y-8">
      <section className="overflow-hidden rounded-2xl border bg-card p-6 shadow-[var(--shadow-elegant)] md:p-8">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div>
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              Active project
            </div>
            <h1 className="mt-1 text-3xl font-semibold md:text-4xl">{project.name}</h1>
            <p className="mt-1 text-muted-foreground">{project.address}</p>
            <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
              <User className="h-4 w-4" /> Manager:{" "}
              <span className="font-medium text-foreground">{project.manager}</span>
            </div>
          </div>
          <div className="w-full sm:w-auto sm:min-w-[220px]">
            <div className="flex items-end justify-between">
              <span className="text-xs uppercase tracking-wide text-muted-foreground">
                Overall progress
              </span>
              <span className="text-2xl font-semibold">{progress}%</span>
            </div>
            <div className="mt-2 h-3 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full"
                style={{ width: `${progress}%`, background: "var(--gradient-primary)" }}
              />
            </div>
            {current && (
              <div className="mt-3 text-sm text-muted-foreground">
                Currently working on{" "}
                <span className="font-medium text-foreground">{current.name}</span>
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4">
        <Stat
          icon={Calendar}
          label="Started"
          value={project.startDate}
          sub={`Target: ${project.targetDate}`}
        />
        <Stat
          icon={TrendingUp}
          label="Stages done"
          value={`${stages.filter((s) => s.status === "done").length}/${stages.length}`}
          sub="On schedule"
        />
        <Stat
          icon={DollarSign}
          label="Budget"
          value={`$${project.budget.toLocaleString()}`}
          sub={`Spent $${project.spent.toLocaleString()}`}
        />
        <Stat icon={User} label="Client" value={project.client} sub="Primary contact" />
      </section>

      <section aria-labelledby="latest-photos">
        <div className="mb-2 flex items-end justify-between gap-3">
          <div>
            <h2 id="latest-photos" className="text-xl font-semibold">
              Latest photos
            </h2>
            {photos[0] && (
              <p className="text-sm text-muted-foreground">
                Latest from {photos[0].uploadedBy} · {dayLabel(photos[0].takenAt)}
              </p>
            )}
          </div>
          <Link
            to="/photos"
            className="inline-flex min-h-11 shrink-0 items-center text-sm text-primary hover:underline"
          >
            All photos →
          </Link>
        </div>
        <PhotoThumbs
          photos={photos}
          max={4}
          className="grid max-w-2xl grid-cols-4 gap-2 md:gap-3"
        />
      </section>

      <section>
        <div className="mb-3 flex items-end justify-between">
          <h2 className="text-xl font-semibold">Stage timeline</h2>
          <Link
            to="/stages"
            className="inline-flex min-h-11 items-center text-sm text-primary hover:underline"
          >
            View all stages →
          </Link>
        </div>
        <div className="space-y-3">
          {stages.map((s) => (
            <div key={s.id} className="rounded-xl border bg-card p-4 shadow-[var(--shadow-soft)]">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span
                    className="inline-block h-3 w-3 rounded-full"
                    style={{ background: statusFill[s.status] }}
                  />
                  <div>
                    <div className="font-medium">{s.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {s.start} – {s.end}
                    </div>
                  </div>
                </div>
                <div className="flex w-full items-center gap-3 sm:w-auto sm:min-w-[200px]">
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${s.progress}%`, background: statusFill[s.status] }}
                    />
                  </div>
                  <span className="w-10 text-right text-sm font-medium">{s.progress}%</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-end justify-between">
          <h2 className="text-xl font-semibold">Floor plan visualisation</h2>
          <Link
            to="/plan"
            className="inline-flex min-h-11 items-center text-sm text-primary hover:underline"
          >
            Open full plan →
          </Link>
        </div>
        <FloorPlan />
      </section>
    </div>
  );
}
