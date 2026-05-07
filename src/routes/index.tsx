import { createFileRoute, Link } from "@tanstack/react-router";
import { Calendar, DollarSign, TrendingUp, User } from "lucide-react";
import { project, stages, overallProgress, statusFill, statusLabel } from "@/lib/renovation-data";
import { FloorPlan } from "@/components/floor-plan";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Overview — RenoTrack" },
      { name: "description", content: "Live overview of your home renovation progress." },
    ],
  }),
  component: Overview,
});

function Stat({ icon: Icon, label, value, sub }: { icon: any; label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border bg-card p-5 shadow-[var(--shadow-soft)]">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
        <Icon className="h-4 w-4" />{label}
      </div>
      <div className="mt-2 text-2xl font-semibold">{value}</div>
      {sub && <div className="mt-1 text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}

function Overview() {
  const progress = overallProgress();
  const current = stages.find((s) => s.status === "progress");

  return (
    <div className="mx-auto w-full max-w-7xl space-y-8">
      <section className="overflow-hidden rounded-2xl border bg-card p-6 shadow-[var(--shadow-elegant)] md:p-8">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div>
            <div className="text-xs uppercase tracking-wide text-muted-foreground">Active project</div>
            <h1 className="mt-1 text-3xl font-semibold md:text-4xl">{project.name}</h1>
            <p className="mt-1 text-muted-foreground">{project.address}</p>
            <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
              <User className="h-4 w-4" /> Manager: <span className="font-medium text-foreground">{project.manager}</span>
            </div>
          </div>
          <div className="min-w-[220px]">
            <div className="flex items-end justify-between">
              <span className="text-xs uppercase tracking-wide text-muted-foreground">Overall progress</span>
              <span className="text-2xl font-semibold">{progress}%</span>
            </div>
            <div className="mt-2 h-3 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full" style={{ width: `${progress}%`, background: "var(--gradient-primary)" }} />
            </div>
            {current && (
              <div className="mt-3 text-sm text-muted-foreground">
                Currently working on <span className="font-medium text-foreground">{current.name}</span>
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat icon={Calendar} label="Started" value={project.startDate} sub={`Target: ${project.targetDate}`} />
        <Stat icon={TrendingUp} label="Stages done" value={`${stages.filter(s => s.status === "done").length}/${stages.length}`} sub="On schedule" />
        <Stat icon={DollarSign} label="Budget" value={`$${project.budget.toLocaleString()}`} sub={`Spent $${project.spent.toLocaleString()}`} />
        <Stat icon={User} label="Client" value={project.client} sub="Primary contact" />
      </section>

      <section>
        <div className="mb-3 flex items-end justify-between">
          <h2 className="text-xl font-semibold">Stage timeline</h2>
          <Link to="/stages" className="text-sm text-primary hover:underline">View all stages →</Link>
        </div>
        <div className="space-y-3">
          {stages.map((s) => (
            <div key={s.id} className="rounded-xl border bg-card p-4 shadow-[var(--shadow-soft)]">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="inline-block h-3 w-3 rounded-full" style={{ background: statusFill[s.status] }} />
                  <div>
                    <div className="font-medium">{s.name}</div>
                    <div className="text-xs text-muted-foreground">{s.start} – {s.end}</div>
                  </div>
                </div>
                <div className="flex items-center gap-3 min-w-[200px]">
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full" style={{ width: `${s.progress}%`, background: statusFill[s.status] }} />
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
          <Link to="/plan" className="text-sm text-primary hover:underline">Open full plan →</Link>
        </div>
        <FloorPlan />
        <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted-foreground">
          {(["done","progress","pending","blocked"] as const).map(s => (
            <div key={s} className="flex items-center gap-1.5">
              <span className="inline-block h-3 w-3 rounded" style={{ background: statusFill[s] }} />
              {statusLabel[s]}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
