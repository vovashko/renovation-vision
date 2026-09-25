import { cn } from "@/lib/utils";
import { Icon } from "./icon";
import { Badge } from "./badge";
import { lateLabel } from "@/lib/attention";
import { ProgressBar } from "./progress-bar";
import { statusContainer, statusLabel, statusTone, type Status } from "./status";

/** Compact stage list item: status tile (check or number), name + dates, status bar + %. */
export function StageTimelineRow({
  index,
  name,
  status,
  start,
  end,
  progress,
  lateDays,
  onClick,
}: {
  index?: number;
  name: string;
  status: Status;
  start: string;
  end: string;
  progress: number;
  lateDays?: number;
  onClick?: () => void;
}) {
  const Wrapper = onClick ? "button" : "div";
  return (
    <Wrapper
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-3.5 rounded-xl border border-outline-variant bg-card py-3.5 pr-4 pl-3.5 text-left text-on-surface sm:pr-5",
        onClick &&
          "cursor-pointer transition-colors duration-150 hover:bg-surface-container-low focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
      )}
    >
      <span
        className={cn("grid size-11 shrink-0 place-items-center rounded-md text-label-lg", statusContainer[status])}
        aria-label={statusLabel[status]}
      >
        {status === "done" ? <Icon name="check" size={22} /> : (index ?? "")}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-title-md">{name}</span>
        <span className="block text-body-sm text-on-surface-variant">
          {start} – {end}
        </span>
        {lateDays ? (
          <Badge variant="attention" size="compact" icon="schedule" className="mt-1.5">
            {lateLabel(lateDays)}
          </Badge>
        ) : null}
      </span>
      <span className="flex shrink-0 items-center gap-3">
        <ProgressBar value={progress} tone={statusTone[status]} className="w-16 sm:w-[140px]" />
        <span className="w-10 text-right text-label-lg tabular-nums">{progress}%</span>
      </span>
    </Wrapper>
  );
}
