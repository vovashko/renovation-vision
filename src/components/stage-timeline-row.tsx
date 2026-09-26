import { cardVariants } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { Badge } from "@/components/ui/badge";
import { ProgressBar } from "@/components/ui/progress-bar";
import { lateLabel } from "@/lib/attention";
import { cn } from "@/lib/utils";
import type { Status } from "@/lib/status";
import { statusContainer, statusTone } from "@/lib/status-ui";

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
  index: number;
  name: string;
  status: Status;
  start: string;
  end: string;
  progress: number;
  /** Days past the end date, shown as an attention badge. */
  lateDays?: number;
  onClick?: () => void;
}) {
  const Wrapper = onClick ? "button" : "div";
  return (
    <Wrapper
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={cn(cardVariants({ interactive: !!onClick }), "flex w-full items-center gap-3.5 py-3.5 pr-4 pl-3.5 text-left sm:pr-5")}
    >
      <span className={cn("grid size-11 shrink-0 place-items-center rounded-md text-label-lg", statusContainer[status])} aria-hidden>
        {status === "done" ? <Icon name="check" size={22} /> : index}
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-title-md">{name}</div>
        <div className="text-body-sm text-on-surface-variant">
          {start} – {end}
        </div>
        {!!lateDays && (
          <Badge variant="attention" size="compact" icon="schedule" className="mt-1.5">
            {lateLabel(lateDays)}
          </Badge>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <ProgressBar value={progress} tone={statusTone[status]} className="w-16 sm:w-[140px]" aria-label={`${name} progress`} />
        <span className="w-10 text-right text-label-lg tabular-nums">{progress}%</span>
      </div>
    </Wrapper>
  );
}
