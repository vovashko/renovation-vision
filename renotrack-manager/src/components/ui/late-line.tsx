import { cn } from "@/lib/utils";

/** Attention line for work past its end date that isn't done: 6px orange dot + "N days late". */
export function LateLine({ days, className }: { days: number; className?: string }) {
  return (
    <div className={cn("flex items-center gap-1.5 text-body-sm font-medium text-attention-text", className)}>
      <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-attention" />
      {days} {days === 1 ? "day" : "days"} late
    </div>
  );
}
