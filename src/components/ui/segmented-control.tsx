import * as React from "react";

import { cn } from "@/lib/utils";

// v5 segmented control: a pill-shaped `role="tablist"` where each segment is a button. Generic
// two/three-way mode switch — `ui/tabs` and `ui/toggle-group` aren't restyled to v5 and carry
// Radix content-panel semantics we don't need here (no per-segment `<TabsContent>`).
function SegmentedControl({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="segmented-control" className={cn("flex rounded-full bg-on-surface/12 p-0.5", className)} {...props} />;
}

/**
 * A segment button. The `::after` pseudo-element extends the tap target to 44px without affecting
 * the pill's visible 30px height.
 */
function SegmentedControlItem({ className, active = false, ...props }: React.ComponentProps<"button"> & { active?: boolean }) {
  return (
    <button
      type="button"
      data-slot="segmented-control-item"
      data-active={active}
      className={cn(
        "relative flex h-7.5 flex-1 items-center justify-center rounded-full px-3.5 text-[13px] transition-colors duration-150 after:absolute after:inset-x-0 after:-inset-y-[7px] after:content-[''] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
        active ? "bg-surface-container font-medium text-on-surface" : "text-on-surface hover:bg-on-surface/8",
        className,
      )}
      {...props}
    />
  );
}

export { SegmentedControl, SegmentedControlItem };
