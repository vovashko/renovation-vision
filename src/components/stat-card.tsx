import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export function Stat({ icon: Icon, label, value, sub }: { icon: LucideIcon; label: string; value: string; sub?: ReactNode }) {
  return (
    <div className="rounded-xl border bg-card p-5 shadow-[var(--shadow-soft)]">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
        <Icon className="h-4 w-4" />{label}
      </div>
      <div className="mt-2 text-2xl font-semibold">{value}</div>
      {sub && <div className="mt-1 text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}
