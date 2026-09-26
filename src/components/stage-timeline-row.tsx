import { statusFill, statusLabel, type Status } from "@/lib/status";
import { ProgressBar } from "./progress-bar";

export function StageTimelineRow({
  name,
  status,
  start,
  end,
  progress,
  onClick,
}: {
  name: string;
  status: Status;
  start: string;
  end: string;
  progress: number;
  onClick?: () => void;
}) {
  const Wrapper = onClick ? "button" : "div";
  return (
    <Wrapper
      onClick={onClick}
      className="block w-full rounded-xl border bg-card p-4 text-left shadow-[var(--shadow-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring enabled:hover:border-primary/50"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="inline-block h-3 w-3 rounded-full" style={{ background: statusFill[status] }} aria-label={statusLabel[status]} />
          <div>
            <div className="font-medium">{name}</div>
            <div className="text-xs text-muted-foreground">{start} – {end}</div>
          </div>
        </div>
        <div className="flex min-w-[200px] items-center gap-3">
          <ProgressBar value={progress} fill={statusFill[status]} className="flex-1" />
          <span className="w-10 text-right text-sm font-medium">{progress}%</span>
        </div>
      </div>
    </Wrapper>
  );
}
