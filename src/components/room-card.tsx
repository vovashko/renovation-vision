import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { statusFill, type Status } from "@/lib/status";
import { StatusPill } from "./status-pill";
import { ProgressBar } from "./progress-bar";

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
      className={cn(
        "block w-full rounded-xl border bg-card p-4 text-left shadow-[var(--shadow-soft)] focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
        active && "border-primary ring-1 ring-primary",
        muted && "border-dashed opacity-70",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium">{name}</span>
        <StatusPill status={status} size="sm" />
      </div>
      <ProgressBar value={progress} fill={statusFill[status]} className="mt-3" />
      <div className="mt-1 text-right text-xs text-muted-foreground">{progress}%</div>
      {children}
    </Wrapper>
  );
}
