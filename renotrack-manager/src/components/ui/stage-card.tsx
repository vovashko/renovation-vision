import type { ReactNode } from "react";
import { Check, Circle, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { statusFill, type Status } from "./status";
import { StatusPill } from "./status-pill";
import { ProgressBar } from "./progress-bar";

export type StageCardTask = { id?: string; name: string; done: boolean; muted?: boolean };

/** Vertical timeline container for StageCards (the connecting line). */
export function StageList({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("relative space-y-6 before:absolute before:left-4 before:top-2 before:bottom-2 before:w-px before:bg-border md:before:left-5", className)}>
      {children}
    </div>
  );
}

export function StageCard({
  index,
  name,
  start,
  end,
  status,
  progress,
  tasks,
  onToggleTask,
  onRemoveTask,
  headerExtra,
  children,
  dimmed,
}: {
  index: number;
  name: string;
  start: string;
  end: string;
  status: Status;
  progress: number;
  tasks: StageCardTask[];
  /** When set, checklist items become toggleable. */
  onToggleTask?: (task: StageCardTask, i: number) => void;
  onRemoveTask?: (task: StageCardTask, i: number) => void;
  headerExtra?: ReactNode;
  children?: ReactNode;
  dimmed?: boolean;
}) {
  return (
    <div className="relative pl-12 md:pl-14">
      <div
        className="absolute left-0 top-1 flex h-9 w-9 items-center justify-center rounded-full border-2 border-background text-xs font-semibold text-white shadow-[var(--shadow-soft)] md:h-10 md:w-10"
        style={{ background: statusFill[status] }}
      >
        {index}
      </div>
      <div className={cn("rounded-xl border bg-card p-5 shadow-[var(--shadow-soft)]", dimmed && "border-dashed opacity-70")}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">{name}</h2>
            <div className="mt-1 text-xs text-muted-foreground">{start} – {end}</div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {headerExtra}
            <StatusPill status={status} />
          </div>
        </div>
        <div className="mt-4">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Progress</span><span>{progress}%</span>
          </div>
          <ProgressBar value={progress} className="mt-1.5" />
        </div>
        <ul className="mt-4 space-y-2">
          {tasks.map((t, i) => {
            const icon = t.done ? <Check className="h-4 w-4 text-status-done" /> : <Circle className="h-4 w-4 text-muted-foreground" />;
            const label = <span className={t.done ? "text-muted-foreground line-through" : ""}>{t.name}</span>;
            return (
              <li key={t.id ?? t.name} className={cn("group flex items-center gap-2 text-sm", t.muted && "opacity-60")}>
                {onToggleTask ? (
                  <button
                    role="checkbox"
                    aria-checked={t.done}
                    onClick={() => onToggleTask(t, i)}
                    className="flex min-h-8 flex-1 items-center gap-2 rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {icon}{label}
                  </button>
                ) : (
                  <>{icon}{label}</>
                )}
                {onRemoveTask && (
                  <button
                    onClick={() => onRemoveTask(t, i)}
                    aria-label={`Remove task ${t.name}`}
                    className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground opacity-0 hover:bg-muted focus-visible:opacity-100 group-hover:opacity-100"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
        {children}
      </div>
    </div>
  );
}
