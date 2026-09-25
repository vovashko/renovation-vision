import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Card } from "./card";
import { Icon } from "./icon";

/**
 * Stat card (tinted panel): label, value with optional unit, then a line with an optional
 * colored delta (good = success, attention = orange) and a note. `attention` adds the orange
 * outline + dot (over budget / late). `icon` is an optional Material Symbols name.
 */
export function Stat({
  icon,
  label,
  value,
  unit,
  delta,
  deltaTone = "neutral",
  note,
  sub,
  attention = false,
}: {
  icon?: string;
  label: string;
  value: string;
  unit?: string;
  delta?: string;
  deltaTone?: "good" | "attention" | "neutral";
  note?: ReactNode;
  /** Free-form supporting line (used instead of delta/note). */
  sub?: ReactNode;
  attention?: boolean;
}) {
  return (
    <Card variant="tinted" attention={attention} className="px-5 py-4">
      <div className="flex items-center gap-2 text-body-md">
        {icon && <Icon name={icon} size={20} className="text-on-surface-variant" />}
        {label}
      </div>
      <div className="mt-1 text-title-lg sm:text-headline-md">
        {value}
        {unit && <span className="ml-1 text-title-md text-on-surface-variant">{unit}</span>}
      </div>
      {(delta || note || sub) && (
        <div className="mt-1 text-body-sm text-on-surface-variant">
          {delta && (
            <span className={cn("font-medium", deltaTone === "good" && "text-success-text", deltaTone === "attention" && "text-attention-text")}>
              {delta}
            </span>
          )}
          {delta && note && " "}
          {note}
          {sub}
        </div>
      )}
    </Card>
  );
}
