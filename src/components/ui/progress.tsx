"use client";

import * as React from "react";
import * as ProgressPrimitive from "@radix-ui/react-progress";

import { cn } from "@/lib/utils";

type Tone = "primary" | "done" | "progress" | "pending" | "blocked";

// Indicator and track color per tone. Done is a solid bar with no visible track;
// pending has no indicator, only an empty white track with a dashed outline.
const toneClass: Record<Tone, { bar: string; track: string }> = {
  primary: { bar: "bg-primary", track: "bg-surface-container-highest" },
  done: { bar: "bg-status-done", track: "bg-status-done-container" },
  progress: { bar: "bg-status-progress", track: "bg-status-progress-container" },
  pending: { bar: "", track: "border border-dashed border-outline bg-status-pending-container" },
  blocked: { bar: "bg-status-blocked", track: "bg-status-blocked-container" },
};

/**
 * v5 linear progress: an 8px rounded track with a rounded indicator.
 * `onPanel` switches the default track to white for use inside tinted panels.
 * The only inline style is the `--progress` custom property carrying the data value.
 */
const Progress = React.forwardRef<
  React.ElementRef<typeof ProgressPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root> & {
    tone?: Tone;
    onPanel?: boolean;
  }
>(({ className, value, tone = "primary", onPanel = false, style, ...props }, ref) => {
  const v = Math.min(100, Math.max(0, value ?? 0));
  const c = toneClass[tone];
  return (
    <ProgressPrimitive.Root
      ref={ref}
      value={v}
      className={cn(
        "relative h-2 w-full overflow-hidden rounded-full",
        onPanel && tone === "primary" ? "bg-surface-container-lowest" : c.track,
        className,
      )}
      style={{ ...style, "--progress": `${v}%` } as React.CSSProperties}
      {...props}
    >
      {tone !== "pending" && (
        <ProgressPrimitive.Indicator
          className={cn(
            "h-full w-(--progress) rounded-full transition-[width] duration-300 ease-[cubic-bezier(0.2,0,0,1)]",
            c.bar,
          )}
        />
      )}
    </ProgressPrimitive.Root>
  );
});
Progress.displayName = ProgressPrimitive.Root.displayName;

export { Progress };
export type { Tone as ProgressTone };
