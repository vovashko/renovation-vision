import { cn } from "@/lib/utils";
import { statusFill, statusLabel, statuses, type Status } from "./status";

export function StatusPill({ status, size = "md", className }: { status: Status; size?: "sm" | "md"; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full font-medium text-white",
        size === "sm" ? "px-2.5 py-0.5 text-xs" : "px-3 py-1 text-xs",
        className,
      )}
      style={{ background: statusFill[status] }}
    >
      {statusLabel[status]}
    </span>
  );
}

export function StatusLegend({ className }: { className?: string }) {
  return (
    <div className={cn("flex flex-wrap gap-3 text-xs text-muted-foreground", className)}>
      {statuses.map((s) => (
        <div key={s} className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded" style={{ background: statusFill[s] }} />
          {statusLabel[s]}
        </div>
      ))}
    </div>
  );
}
