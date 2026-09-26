import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";

// v5 stat card: a default card (px-5 py-4) with a body-md label, a headline-md value and a body-sm
// change line that starts with a coloured delta. `attention` (over budget, late) swaps the border for
// the attention outline and puts the 8px orange dot at the end of the label row, as in the reference.

const statVariants = cva("group/stat px-5 py-4", {
  variants: { variant: { default: "", attention: "border-attention-outline" } },
  defaultVariants: { variant: "default" },
});

function Stat({ className, variant = "default", ...props }: React.ComponentProps<"div"> & VariantProps<typeof statVariants>) {
  return <Card data-slot="stat" data-variant={variant} className={cn(statVariants({ variant }), className)} {...props} />;
}

function StatLabel({ className, children, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="stat-label"
      className={cn("flex items-center justify-between gap-2 text-body-md text-on-surface", className)}
      {...props}
    >
      {children}
      <span aria-hidden className="hidden size-2 shrink-0 rounded-full bg-attention group-data-[variant=attention]/stat:block" />
    </div>
  );
}

const statUnitVariants = cva("text-title-md", {
  variants: { tone: { muted: "text-on-surface-variant", default: "text-on-surface" } },
  defaultVariants: { tone: "muted" },
});

type StatValueProps = React.ComponentProps<"div"> & {
  /** Trailing unit or total, e.g. "/ 7" or "k€", in title-md. */
  unit?: React.ReactNode;
  /** `muted` (default) grays the unit, for totals like "/ 7"; `default` keeps it on-surface, for "k€". */
  unitTone?: VariantProps<typeof statUnitVariants>["tone"];
};

function StatValue({ className, children, unit, unitTone, ...props }: StatValueProps) {
  return (
    <div data-slot="stat-value" className={cn("mt-1 text-headline-md text-on-surface", className)} {...props}>
      {children}
      {unit != null && (
        <span data-slot="stat-unit" className={statUnitVariants({ tone: unitTone })}>
          {" "}
          {unit}
        </span>
      )}
    </div>
  );
}

/** The change line under the value: a <StatDelta> followed by context, e.g. "plan of 84.5 k€". */
function StatChange({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div data-slot="stat-change" className={cn("flex items-center gap-1 text-body-sm text-on-surface-variant", className)} {...props} />
  );
}

const statDeltaVariants = cva("font-medium", {
  variants: {
    tone: {
      // Progress made, under budget.
      good: "text-success-text",
      // Over budget or late. Use the attention colour, never error, for these.
      attention: "text-attention-text",
      neutral: "text-on-surface",
    },
  },
  defaultVariants: { tone: "neutral" },
});

function StatDelta({ className, tone, ...props }: React.ComponentProps<"span"> & VariantProps<typeof statDeltaVariants>) {
  return <span data-slot="stat-delta" data-tone={tone ?? "neutral"} className={cn(statDeltaVariants({ tone }), className)} {...props} />;
}

export { Stat, StatLabel, StatValue, StatChange, StatDelta };
