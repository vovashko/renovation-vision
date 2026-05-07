import { createFileRoute } from "@tanstack/react-router";
import { Check, Circle } from "lucide-react";
import { stages, statusFill, statusLabel } from "@/lib/renovation-data";

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
  return (
    <div className="mx-auto w-full max-w-5xl">
      <h1 className="text-3xl font-semibold">Renovation stages</h1>
      <p className="mt-1 text-muted-foreground">Detailed breakdown of every stage and its tasks.</p>

      <div className="relative mt-8 space-y-6 before:absolute before:left-4 before:top-2 before:bottom-2 before:w-px before:bg-border md:before:left-5">
        {stages.map((s, i) => (
          <div key={s.id} className="relative pl-12 md:pl-14">
            <div
              className="absolute left-0 top-1 flex h-9 w-9 items-center justify-center rounded-full border-2 border-background text-xs font-semibold text-white shadow-[var(--shadow-soft)] md:h-10 md:w-10"
              style={{ background: statusFill[s.status] }}
            >
              {i + 1}
            </div>
            <div className="rounded-xl border bg-card p-5 shadow-[var(--shadow-soft)]">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold">{s.name}</h2>
                  <div className="mt-1 text-xs text-muted-foreground">{s.start} – {s.end}</div>
                </div>
                <span
                  className="rounded-full px-3 py-1 text-xs font-medium text-white"
                  style={{ background: statusFill[s.status] }}
                >
                  {statusLabel[s.status]}
                </span>
              </div>
              <div className="mt-4">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Progress</span><span>{s.progress}%</span>
                </div>
                <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full" style={{ width: `${s.progress}%`, background: "var(--gradient-primary)" }} />
                </div>
              </div>
              <ul className="mt-4 space-y-2">
                {s.tasks.map((t) => (
                  <li key={t.name} className="flex items-center gap-2 text-sm">
                    {t.done ? (
                      <Check className="h-4 w-4 text-status-done" />
                    ) : (
                      <Circle className="h-4 w-4 text-muted-foreground" />
                    )}
                    <span className={t.done ? "text-muted-foreground line-through" : ""}>{t.name}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
