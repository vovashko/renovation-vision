import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";

// v5 skeleton: surface-container blocks that pulse to surface-container-high (1.2 s), using the same
// radii as the thing they stand in for. Static when the user prefers reduced motion.
function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden
      className={cn(
        "rounded-sm bg-surface-container animate-[skeleton-pulse_1.2s_ease-in-out_infinite] motion-reduce:animate-none",
        className,
      )}
      {...props}
    />
  );
}

/** Stand-in for a <Stat> card. */
function StatSkeleton() {
  return (
    <Card className="space-y-2.5 px-5 py-4">
      <Skeleton className="h-3.5 w-3/5" />
      <Skeleton className="h-7 w-2/5" />
      <Skeleton className="h-3 w-4/5" />
    </Card>
  );
}

/** Stand-in for a room list row (44px tile + two lines). */
function RoomRowSkeleton() {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-outline-variant bg-surface-container-lowest py-2 pr-3.5 pl-2">
      <Skeleton className="size-11 rounded-md" />
      <div className="flex-1 space-y-1.5">
        <Skeleton className="h-3.5 w-2/5" />
        <Skeleton className="h-3 w-1/4" />
      </div>
    </div>
  );
}

/** Stand-in for a collapsed stage card. */
function StageCardSkeleton() {
  return (
    <Card className="space-y-3 px-6 py-5">
      <div className="flex justify-between">
        <Skeleton className="h-5.5 w-[45%]" />
        <Skeleton className="h-7 w-22 rounded-full" />
      </div>
      <Skeleton className="h-3.5 w-[30%]" />
      <Skeleton className="h-2 w-full rounded-full" />
    </Card>
  );
}

export { Skeleton, StatSkeleton, RoomRowSkeleton, StageCardSkeleton };
