import * as React from "react";

import { cn } from "@/lib/utils";

/** The number shown on a navigation item (cases waiting for a decision). Hidden at 0; "99+" past 99. */
function CountBadge({ count, className, ...props }: Omit<React.ComponentProps<"span">, "children"> & { count: number }) {
  if (count <= 0) return null;
  return (
    <span
      data-slot="count-badge"
      className={cn(
        "inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-label-sm text-on-primary tabular-nums",
        className,
      )}
      {...props}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}

export { CountBadge };
