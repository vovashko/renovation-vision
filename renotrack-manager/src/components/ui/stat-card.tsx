import { Icon } from "./icon";
import type { ReactNode } from "react";

/** `icon` is a Material Symbols name, e.g. "calendar_month". */
export function Stat({ icon, label, value, sub }: { icon: string; label: string; value: string; sub?: ReactNode }) {
  return (
    <div className="rounded-xl border bg-card p-5 shadow-[var(--shadow-soft)]">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
        <Icon name={icon} size={20} />{label}
      </div>
      <div className="mt-2 text-2xl font-semibold">{value}</div>
      {sub && <div className="mt-1 text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}
