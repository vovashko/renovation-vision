import type { ElementType, ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/**
 * Stat card per the v5 spec: label, a headline value with an optional grayed unit, and a
 * change line whose delta is colored (`good` = success, `attention` = late/over budget).
 * `icon` is accepted for older callers but the redesigned card has no icon — new call sites
 * should leave it out.
 */
export function Stat({
  icon: IconTag,
  label,
  value,
  unit,
  sub,
  delta,
  deltaTone = "neutral",
  attention = false,
  className,
}: {
  icon?: ElementType;
  label: string;
  value: string;
  unit?: string;
  sub?: ReactNode;
  delta?: string;
  deltaTone?: "good" | "attention" | "neutral";
  attention?: boolean;
  className?: string;
}) {
  return (
    <Card variant="tinted" attention={attention} className={cn("px-5 py-4", className)}>
      <div className="flex items-center gap-2 text-body-md text-on-surface-variant">
        {IconTag && <IconTag className="size-[18px]" />}
        {label}
      </div>
      <div className="mt-1 text-title-lg sm:text-headline-md">
        {value}
        {unit && <span className="ml-1 text-title-md text-on-surface-variant">{unit}</span>}
      </div>
      {(delta || sub) && (
        <div className="mt-1 text-body-sm text-on-surface-variant">
          {delta && (
            <span
              className={cn("font-medium", deltaTone === "good" && "text-success-text", deltaTone === "attention" && "text-attention-text")}
            >
              {delta}
            </span>
          )}
          {delta && sub && " "}
          {sub}
        </div>
      )}
    </Card>
  );
}
