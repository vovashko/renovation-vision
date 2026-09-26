import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { statusLabel, statuses, type Status } from "@/lib/status";
import { statusBg, statusChip } from "@/lib/status-ui";

/** Status chip. `sm` is the compact chip used inside cards; `onPanel` gives it a white fill. */
export function StatusPill({
  status,
  size = "md",
  onPanel,
  className,
}: {
  status: Status;
  size?: "sm" | "md";
  onPanel?: boolean;
  className?: string;
}) {
  return (
    <Badge variant={statusChip[status]} size={size === "sm" ? "compact" : "default"} onPanel={onPanel} className={className}>
      {statusLabel[status]}
    </Badge>
  );
}

export function StatusLegend({ className }: { className?: string }) {
  return (
    <div className={cn("flex flex-wrap gap-x-4 gap-y-2 text-body-sm text-on-surface-variant", className)}>
      {statuses.map((s) => (
        <div key={s} className="flex items-center gap-2">
          <span aria-hidden className={cn("size-2 shrink-0 rounded-full", statusBg[s])} />
          {statusLabel[s]}
        </div>
      ))}
    </div>
  );
}
