import type { ReactNode } from "react";
import { Card } from "./card";
import { Icon } from "./icon";

/**
 * Stat card: label, value (+ optional unit), supporting line. `icon` is a Material Symbols name.
 * `attention` switches to the orange attention card (over budget / late).
 */
export function Stat({
  icon,
  label,
  value,
  unit,
  sub,
  attention,
}: {
  icon: string;
  label: string;
  value: string;
  unit?: string;
  sub?: ReactNode;
  attention?: boolean;
}) {
  return (
    <Card attention={attention} className="px-5 py-4">
      <div className="flex items-center gap-2 text-body-md text-on-surface">
        <Icon name={icon} size={20} className="text-on-surface-variant" />
        {label}
      </div>
      <div className="mt-2 text-headline-md">
        {value}
        {unit && <span className="ml-1 text-title-md text-on-surface-variant">{unit}</span>}
      </div>
      {sub && <div className="mt-1 text-body-sm text-on-surface-variant">{sub}</div>}
    </Card>
  );
}
