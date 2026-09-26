import { cn } from "@/lib/utils";

/** Rounded progress track used across RenoVision. `fill` defaults to the primary gradient. */
export function ProgressBar({
  value,
  fill = "var(--gradient-primary)",
  size = "md",
  className,
}: {
  value: number;
  fill?: string;
  size?: "md" | "lg";
  className?: string;
}) {
  return (
    <div className={cn("overflow-hidden rounded-full bg-muted", size === "lg" ? "h-3" : "h-2", className)}>
      <div className="h-full rounded-full" style={{ width: `${Math.max(0, Math.min(100, value))}%`, background: fill }} />
    </div>
  );
}
