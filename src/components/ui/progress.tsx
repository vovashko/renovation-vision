"use client";

import * as React from "react";
import * as ProgressPrimitive from "@radix-ui/react-progress";

import { cn } from "@/lib/utils";

type Tone = "primary" | "done" | "progress" | "pending" | "blocked";

// Indicator color / track color / stop-dot color per tone.
const toneClass: Record<Tone, { bar: string; track: string }> = {
  primary: { bar: "bg-primary", track: "bg-secondary-container" },
  done: { bar: "bg-status-done", track: "bg-status-done-container" },
  progress: { bar: "bg-status-progress", track: "bg-status-progress-container" },
  pending: { bar: "bg-outline", track: "bg-surface-container-highest" },
  blocked: { bar: "bg-status-blocked", track: "bg-status-blocked-container" },
};

/**
 * M3 linear progress: 4px bar, 4px gap between indicator and track, stop dot at the end.
 * The only inline style is the `--progress` custom property carrying the data value;
 * colors and sizing are utilities.
 */
const Progress = React.forwardRef<
  React.ElementRef<typeof ProgressPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root> & { tone?: Tone }
>(({ className, value, tone = "primary", style, ...props }, ref) => {
  const v = Math.min(100, Math.max(0, value ?? 0));
  const c = toneClass[tone];
  return (
    <ProgressPrimitive.Root
      ref={ref}
      value={v}
      className={cn("flex h-1 w-full items-center gap-1", className)}
      style={{ ...style, "--progress": `${v}%` } as React.CSSProperties}
      {...props}
    >
      {v > 0 && (
        <ProgressPrimitive.Indicator
          className={cn(
            "h-full w-(--progress) shrink-0 rounded-full transition-[width] duration-300 ease-[cubic-bezier(0.2,0,0,1)]",
            c.bar,
          )}
        />
      )}
      {v < 100 && (
        <div className={cn("relative h-full flex-1 rounded-full", c.track)}>
          <span className={cn("absolute right-0 top-0 size-1 rounded-full", c.bar)} />
        </div>
      )}
    </ProgressPrimitive.Root>
  );
});
Progress.displayName = ProgressPrimitive.Root.displayName;

export { Progress };
export type { Tone as ProgressTone };
