import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { ProgressBar } from "./progress-bar";
import { statusTone, type Status } from "./status";
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
      onClick={onClick}
      aria-pressed={onClick ? !!active : undefined}
      className={cn(
        "block w-full rounded-xl border border-outline-variant bg-card px-5 py-4.5 text-left text-on-surface",
        onClick &&
          "cursor-pointer transition-colors duration-150 hover:bg-surface-container-low focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
        active && "border-primary outline-1 -outline-offset-2 outline-primary",
        muted && "border-dashed opacity-70",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="min-w-0 truncate text-title-md">{name}</span>
        <StatusPill status={status} size="sm" />
      </div>
      <ProgressBar value={progress} tone={statusTone[status]} className="mt-4" />
      <div className="mt-1.5 text-right text-body-sm text-on-surface-variant">{progress}%</div>
      {children}
    </Wrapper>
  );
}
