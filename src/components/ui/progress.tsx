import * as React from "react";

import { cn } from "@/lib/utils";

export type ProgressTone = "primary" | "done" | "progress" | "pending" | "blocked";

// Native <progress>, styled through its pseudo-elements, so the width comes from `value`
// with no inline styles. Track is the element itself; the indicator is the value bar.
const base =
  "block h-2 w-full appearance-none overflow-hidden rounded-full border-0 [&::-webkit-progress-bar]:bg-transparent [&::-webkit-progress-value]:rounded-full [&::-webkit-progress-value]:transition-[width] [&::-webkit-progress-value]:duration-300 [&::-moz-progress-bar]:rounded-full";

const toneClass: Record<ProgressTone, string> = {
  primary:
    "bg-surface-container-highest [&::-webkit-progress-value]:bg-primary [&::-moz-progress-bar]:bg-primary",
  done: "bg-status-done-container [&::-webkit-progress-value]:bg-success [&::-moz-progress-bar]:bg-success",
  progress:
    "bg-status-progress-container [&::-webkit-progress-value]:bg-status-progress [&::-moz-progress-bar]:bg-status-progress",
  // Not started: no indicator, an empty white track with a dashed outline.
  pending:
    "border border-dashed border-outline bg-surface-container-lowest [&::-webkit-progress-value]:bg-transparent [&::-moz-progress-bar]:bg-transparent",
  blocked:
    "bg-status-blocked-container [&::-webkit-progress-value]:bg-status-blocked [&::-moz-progress-bar]:bg-status-blocked",
};

export interface ProgressProps extends Omit<React.ProgressHTMLAttributes<HTMLProgressElement>, "value" | "max"> {
  value?: number | null;
  tone?: ProgressTone;
  /** Inside a tinted panel the default track turns white. */
  onPanel?: boolean;
}

const Progress = React.forwardRef<HTMLProgressElement, ProgressProps>(
  ({ className, value, tone = "primary", onPanel = false, ...props }, ref) => {
    const v = Math.min(100, Math.max(0, value ?? 0));
    return (
      <progress
        ref={ref}
        max={100}
        value={tone === "pending" ? 0 : v}
        className={cn(base, toneClass[tone], onPanel && tone === "primary" && "bg-surface-container-lowest", className)}
        {...props}
      />
    );
  },
);
Progress.displayName = "Progress";

export { Progress };
