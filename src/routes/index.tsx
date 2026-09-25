import { createFileRoute, Link } from "@tanstack/react-router";
import { Icon } from "@/components/ui/icon";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { buttonVariants } from "@/components/ui/button";
import { project, stages, overallProgress } from "@/lib/renovation-data";
import { statusContainer, statusTone } from "@/lib/status-ui";
import { budgetStatus, daysLate, lateLabel } from "@/lib/attention";
import { Badge } from "@/components/ui/badge";
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

/** Compact money figure: 51200 -> "$51.2" + "k". Keeps the project's dollar data. */
function kUsd(n: number) {
  return { value: `$${(n / 1000).toFixed(1)}`, unit: "k" };
}

function Stat({
  label,
  value,
  unit,
  delta,
  deltaTone = "neutral",
  note,
  attention = false,
}: {
  label: string;
  value: string;
  unit?: string;
  delta?: string;
  deltaTone?: "good" | "attention" | "neutral";
  note?: string;
  attention?: boolean;
}) {
  return (
    <Card variant="tinted" attention={attention} className="px-5 py-4">
      <div className="text-body-md">{label}</div>
      <div className="mt-1 text-title-lg sm:text-headline-md">
        {value}
        {unit && <span className="ml-1 text-title-md text-on-surface-variant">{unit}</span>}
      </div>
      {(delta || note) && (
        <div className="mt-1 text-body-sm text-on-surface-variant">
          {delta && (
            <span
              className={cn(
                "font-medium",
                deltaTone === "good" && "text-success-text",
                deltaTone === "attention" && "text-attention-text",
              )}
            >
              {delta}
            </span>
          )}
          {delta && note && " "}
          {note}
        </div>
      )}
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
      <Link to={to} className={cn(buttonVariants({ variant: "ghost" }), "-mr-3 shrink-0")}>
        {linkLabel}
        <Icon name="arrow_forward" size={20} />
      </Link>
    </div>
  );
}

function Overview() {
  const progress = overallProgress();
  const current = stages.find((s) => s.status === "progress");
  const { photos } = usePhotos();
  const budget = budgetStatus(project);
  const spent = kUsd(project.spent);
  const plan = kUsd(project.budget);
  const lateStages = stages.filter((s) => daysLate(s) > 0).length;
  const done = stages.filter((s) => s.status === "done").length;

  return (
    <div className="mx-auto w-full max-w-7xl space-y-8">
      <Card className="flex flex-wrap items-start justify-between gap-x-12 gap-y-6 px-5 py-5 md:px-7 md:py-6">
        <div className="min-w-0">
          <div className="text-body-md text-on-surface-variant">Active project</div>
          <h1 className="text-headline-md sm:text-headline-lg">{project.name}</h1>
          <p className="text-body-lg text-on-surface-variant">{project.address}</p>
          <div className="mt-3 flex items-center gap-2 text-body-md text-on-surface-variant">
            <span className="grid size-7 place-items-center rounded-full bg-surface-container-high">
              <Icon name="person" size={18} />
            </span>
            Manager <span className="font-medium text-on-surface">{project.manager}</span>
          </div>
        </div>
        <div className="w-full md:w-[380px]">
          <div className="flex items-end justify-between">
            <span className="text-body-md text-on-surface-variant">Overall progress</span>
            <span className="text-headline-md">{progress}%</span>
          </div>
          <Progress value={progress} className="mt-2" aria-label="Overall progress" />
          {current && (
            <div className="mt-3 text-body-md text-on-surface-variant">
              Currently working on{" "}
              <span className="font-medium text-on-surface">{current.name}</span>
            </div>
          )}
        </div>
      </Card>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Project facts">
        <Stat
          label="Started"
          value={project.startDate.split(",")[0]}
          note={`Target: ${project.targetDate}`}
        />
        <Stat
          label="Stages done"
          value={String(done)}
          unit={`/ ${stages.length}`}
          delta={lateStages ? `${lateStages} late` : "On schedule"}
          deltaTone={lateStages ? "attention" : "good"}
        />
        <Stat
          label="Budget spent"
          value={spent.value}
          unit={spent.unit}
          attention={budget.over}
          delta={budget.over ? `↑ ${budget.overPct}% over` : `${budget.usedPct}% used`}
          deltaTone={budget.over ? "attention" : "good"}
          note={`of the ${plan.value}${plan.unit} plan`}
        />
        <Stat label="Project manager" value={project.manager} note="Primary contact" />
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
        <ul className="space-y-2">
          {stages.map((s, i) => {
            const late = daysLate(s);
            return (
              <li key={s.id}>
                <Card className="flex items-center gap-3.5 py-3.5 pl-3.5 pr-4 sm:pr-5">
                  <span
                    className={cn(
                      "grid size-11 shrink-0 place-items-center rounded-md text-label-lg",
                      statusContainer[s.status],
                    )}
                    aria-hidden
                  >
                    {s.status === "done" ? <Icon name="check" size={22} /> : i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-title-md">{s.name}</div>
                    <div className="text-body-sm text-on-surface-variant">
                      {s.start} – {s.end}
                    </div>
                    {late > 0 && (
                      <Badge variant="attention" size="sm" icon="schedule" className="mt-1.5">
                        {lateLabel(late)}
                      </Badge>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <Progress
                      value={s.progress}
                      tone={statusTone[s.status]}
                      className="w-16 sm:w-[140px]"
                      aria-label={`${s.name} progress`}
                    />
                    <span className="w-10 text-right text-label-lg tabular-nums">
                      {s.progress}%
                    </span>
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
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
