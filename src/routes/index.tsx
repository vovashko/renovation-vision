import { createFileRoute, Link } from "@tanstack/react-router";
import { Icon } from "@/components/ui/icon";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { buttonVariants } from "@/components/ui/button";
import { project, stages, overallProgress } from "@/lib/renovation-data";
import { statusContainer, statusTone } from "@/lib/status-ui";
import { cn } from "@/lib/utils";
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
  icon,
  label,
  value,
  sub,
}: {
  icon: string;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <Card variant="filled">
      <div className="flex items-center gap-2 text-label-md text-on-surface-variant">
        <Icon name={icon} size={20} />
        {label}
      </div>
      <div className="mt-3 text-title-lg sm:text-headline-sm">{value}</div>
      {sub && <div className="text-body-md text-on-surface-variant">{sub}</div>}
    </Card>
  );
}

/** Section heading with a trailing text-button link. */
function SectionHeader({
  id,
  title,
  sub,
  to,
  linkLabel,
}: {
  id?: string;
  title: string;
  sub?: string;
  to: "/photos" | "/stages" | "/plan";
  linkLabel: string;
}) {
  return (
    <div className="mb-3 flex items-end justify-between gap-3">
      <div>
        <h2 id={id} className="text-title-lg">
          {title}
        </h2>
        {sub && <p className="text-body-md text-on-surface-variant">{sub}</p>}
      </div>
      <Link to={to} className={cn(buttonVariants({ variant: "ghost" }), "-mr-3 min-h-11 shrink-0")}>
        {linkLabel}
        <Icon name="arrow_forward" size={18} />
      </Link>
    </div>
  );
}

function Overview() {
  const progress = overallProgress();
  const current = stages.find((s) => s.status === "progress");
  const { photos } = usePhotos();

  return (
    <div className="mx-auto w-full max-w-7xl space-y-8">
      <Card
        variant="elevated"
        className="flex flex-wrap items-start justify-between gap-x-12 gap-y-6 px-5 py-5 md:px-8 md:py-6"
      >
        <div className="min-w-0">
          <div className="text-label-md text-on-surface-variant">Active project</div>
          <h1 className="mt-1 text-headline-md sm:text-display-sm">{project.name}</h1>
          <p className="mt-1 text-body-lg text-on-surface-variant">{project.address}</p>
          <div className="mt-3 flex items-center gap-2 text-body-md text-on-surface-variant">
            <Icon name="person" size={20} /> Manager:{" "}
            <span className="font-medium text-on-surface">{project.manager}</span>
          </div>
        </div>
        <div className="w-full md:w-[380px]">
          <div className="flex items-end justify-between">
            <span className="text-label-md text-on-surface-variant">Overall progress</span>
            <span className="text-headline-md">{progress}%</span>
          </div>
          <Progress value={progress} className="mt-3" aria-label="Overall progress" />
          {current && (
            <div className="mt-3 text-body-md text-on-surface-variant">
              Currently working on{" "}
              <span className="font-medium text-on-surface">{current.name}</span>
            </div>
          )}
        </div>
      </Card>

      <section
        className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4"
        aria-label="Project facts"
      >
        <Stat
          icon="calendar_month"
          label="Started"
          value={project.startDate}
          sub={`Target: ${project.targetDate}`}
        />
        <Stat
          icon="trending_up"
          label="Stages done"
          value={`${stages.filter((s) => s.status === "done").length}/${stages.length}`}
          sub="On schedule"
        />
        <Stat
          icon="payments"
          label="Budget"
          value={`$${project.budget.toLocaleString()}`}
          sub={`Spent $${project.spent.toLocaleString()}`}
        />
        <Stat icon="person" label="Client" value={project.client} sub="Primary contact" />
      </section>

      <section aria-labelledby="latest-photos">
        <SectionHeader
          id="latest-photos"
          title="Latest photos"
          sub={
            photos[0]
              ? `Latest from ${photos[0].uploadedBy} · ${dayLabel(photos[0].takenAt)}`
              : undefined
          }
          to="/photos"
          linkLabel="All photos"
        />
        <PhotoThumbs
          photos={photos}
          max={4}
          className="grid max-w-2xl grid-cols-4 gap-2 md:gap-3"
        />
      </section>

      <section aria-labelledby="stage-timeline">
        <SectionHeader
          id="stage-timeline"
          title="Stage timeline"
          to="/stages"
          linkLabel="View all stages"
        />
        <Card className="p-0 py-2">
          <ul>
            {stages.map((s, i) => (
              <li
                key={s.id}
                className="relative flex min-h-18 items-center gap-4 py-2 pl-4 pr-4 sm:pr-6 [&+&]:before:absolute [&+&]:before:left-[72px] [&+&]:before:right-0 [&+&]:before:top-0 [&+&]:before:h-px [&+&]:before:bg-outline-variant"
              >
                <span
                  className={cn(
                    "flex size-10 shrink-0 items-center justify-center rounded-full text-label-lg",
                    statusContainer[s.status],
                  )}
                  aria-hidden
                >
                  {s.status === "done" ? <Icon name="check" size={20} /> : i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-body-lg">{s.name}</div>
                  <div className="text-body-md text-on-surface-variant">
                    {s.start} – {s.end}
                  </div>
                </div>
                <div className="flex w-24 shrink-0 items-center gap-3 sm:w-auto">
                  <Progress
                    value={s.progress}
                    tone={statusTone[s.status]}
                    className="flex-1 sm:w-60 sm:flex-none"
                    aria-label={`${s.name} progress`}
                  />
                  <span className="w-9 text-right text-label-md tabular-nums">{s.progress}%</span>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      </section>

      <section aria-labelledby="floor-plan">
        <SectionHeader
          id="floor-plan"
          title="Floor plan visualisation"
          to="/plan"
          linkLabel="Open full plan"
        />
        <FloorPlan />
      </section>
    </div>
  );
}
