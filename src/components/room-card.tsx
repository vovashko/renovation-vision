import type { ReactNode } from "react";
import { cardVariants } from "@/components/ui/card";
import { ProgressBar } from "@/components/ui/progress-bar";
import { cn } from "@/lib/utils";
import type { Status } from "@/lib/status";
import { statusOutline, statusTone } from "@/lib/status-ui";
import { StatusPill } from "./status-pill";

export function RoomCard({
  name,
  status,
  progress,
  active,
  muted,
  onClick,
  children,
}: {
  name: string;
  status: Status;
  progress: number;
  active?: boolean;
  muted?: boolean;
  onClick?: () => void;
  children?: ReactNode;
}) {
  const Wrapper = onClick ? "button" : "div";
  return (
    <Wrapper
      type={onClick ? "button" : undefined}
      onClick={onClick}
      aria-pressed={onClick ? !!active : undefined}
      className={cn(
        cardVariants({ interactive: !!onClick }),
        "block w-full px-5 py-4.5 text-left",
        // Selected: an outline in the room's own status color, per the floor plan (never primary).
        active && cn("outline-2 -outline-offset-2", statusOutline[status]),
        muted && "border-dashed opacity-70",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="min-w-0 truncate text-title-md">{name}</span>
        <StatusPill status={status} size="sm" />
      </div>
      <ProgressBar value={progress} tone={statusTone[status]} className="mt-4" aria-label={`${name} progress`} />
      <div className="mt-1.5 text-right text-body-sm text-on-surface-variant">{progress}%</div>
      {children}
    </Wrapper>
  );
}
