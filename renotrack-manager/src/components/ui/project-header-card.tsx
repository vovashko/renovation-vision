import type { ReactNode } from "react";
import { Icon } from "@/components/ui/icon";
import { ProgressBar } from "./progress-bar";

export function ProjectHeaderCard({
  eyebrow = "Active project",
  name,
  address,
  managerName,
  progress,
  currentStage,
  badges,
  actions,
}: {
  eyebrow?: string;
  name: string;
  address: string;
  managerName?: string | null;
  progress: number;
  currentStage?: string | null;
  badges?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border bg-card p-6 shadow-[var(--shadow-elegant)] md:p-8">
      <div className="flex flex-wrap items-start justify-between gap-6">
        <div>
          <div className="text-xs uppercase tracking-wide text-muted-foreground">{eyebrow}</div>
          <h1 className="mt-1 text-3xl font-semibold md:text-4xl">{name}</h1>
          <p className="mt-1 text-muted-foreground">{address}</p>
          {managerName && (
            <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
              <Icon name="person" size={20} /> Manager: <span className="font-medium text-foreground">{managerName}</span>
            </div>
          )}
          {badges && <div className="mt-3 flex flex-wrap items-center gap-2">{badges}</div>}
        </div>
        <div className="min-w-[220px]">
          <div className="flex items-end justify-between">
            <span className="text-xs uppercase tracking-wide text-muted-foreground">Overall progress</span>
            <span className="text-2xl font-semibold">{progress}%</span>
          </div>
          <ProgressBar value={progress} size="lg" className="mt-2" />
          {currentStage && (
            <div className="mt-3 text-sm text-muted-foreground">
              Currently working on <span className="font-medium text-foreground">{currentStage}</span>
            </div>
          )}
          {actions && <div className="mt-4 flex flex-wrap gap-2">{actions}</div>}
        </div>
      </div>
    </section>
  );
}
