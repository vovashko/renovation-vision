import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { Badge } from "@/components/ui/badge";
import { ProgressBar } from "@/components/ui/progress-bar";
import { lateLabel } from "@/lib/attention";
import { cn } from "@/lib/utils";
import type { Status } from "@/lib/status";
import { statusMarker, statusTone } from "@/lib/status-ui";
import { StatusPill } from "./status-pill";

export type StageCardTask = { id?: string; name: string; done: boolean; muted?: boolean };

/** Vertical timeline for StageCards: a 2px line at x=21 in a 60px gutter. */
export function StageList({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "relative space-y-6 before:absolute before:top-2 before:bottom-2 before:left-[21px] before:w-0.5 before:bg-outline-variant",
        className,
      )}
    >
      {children}
    </div>
  );
}

function CheckBox({ done }: { done: boolean }) {
  return done ? (
    <span className="grid size-[22px] shrink-0 place-items-center rounded-[7px] bg-primary text-on-primary">
      <Icon name="check" size={16} />
    </span>
  ) : (
    <span aria-hidden className="size-[22px] shrink-0 rounded-[7px] border-[1.5px] border-outline" />
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
  lateDays,
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
  /** Days past the end date, shown as an attention badge and the card's attention outline. */
  lateDays?: number;
  children?: ReactNode;
  dimmed?: boolean;
}) {
  return (
    <div className="relative pl-15">
      <div
        className={cn("absolute top-0 left-0 grid size-11 place-items-center rounded-full font-semibold", statusMarker[status])}
        aria-hidden
      >
        {index}
      </div>
      <Card attention={!!lateDays} className={cn("px-6 py-5", dimmed && "border-dashed opacity-70")}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-title-lg">{name}</h2>
            <div className="mt-1 text-body-md text-on-surface-variant">
              {start} – {end}
            </div>
            {!!lateDays && (
              <Badge variant="attention" size="compact" icon="schedule" className="mt-2">
                {lateLabel(lateDays)}
              </Badge>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2 pr-4">
            {headerExtra}
            <StatusPill status={status} size="sm" />
          </div>
        </div>
        <div className="mt-4.5">
          <div className="flex justify-between text-body-md text-on-surface-variant">
            <span>Progress</span>
            <span className="font-medium text-on-surface">{progress}%</span>
          </div>
          <ProgressBar value={progress} tone={statusTone[status]} className="mt-2" aria-label={`${name} progress`} />
        </div>
        <ul className="mt-4 space-y-3">
          {tasks.map((t, i) => {
            const label = <span className={cn("text-body-lg", t.done && "text-on-surface-variant line-through")}>{t.name}</span>;
            return (
              <li key={t.id ?? t.name} className={cn("group flex min-h-10 items-center gap-3", t.muted && "opacity-60")}>
                {onToggleTask ? (
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={t.done}
                    onClick={() => onToggleTask(t, i)}
                    className="flex min-h-10 flex-1 items-center gap-3 rounded-md text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                  >
                    <CheckBox done={t.done} />
                    {label}
                  </button>
                ) : (
                  <>
                    <CheckBox done={t.done} />
                    {label}
                  </>
                )}
                {onRemoveTask && (
                  <button
                    type="button"
                    onClick={() => onRemoveTask(t, i)}
                    aria-label={`Remove task ${t.name}`}
                    className="state-layer grid size-10 shrink-0 place-items-center rounded-full text-on-surface-variant opacity-0 group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-primary"
                  >
                    <Icon name="close" size={20} />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
        {children}
      </Card>
    </div>
  );
}
