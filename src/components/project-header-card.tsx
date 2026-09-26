import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { ProgressBar } from "@/components/ui/progress-bar";

export function ProjectHeaderCard({
  eyebrow = "Active project",
  name,
  address,
  managerName,
  progress,
  currentStage,
  actions,
}: {
  eyebrow?: string;
  name: string;
  address: string;
  managerName?: string | null;
  progress: number;
  currentStage?: string | null;
  actions?: ReactNode;
}) {
  return (
    <Card className="flex flex-wrap items-start justify-between gap-x-12 gap-y-6 px-5 py-5 md:px-7 md:py-6">
      <div className="min-w-0">
        <div className="text-body-md text-on-surface-variant">{eyebrow}</div>
        <h1 className="text-headline-md sm:text-headline-lg">{name}</h1>
        <p className="text-body-lg text-on-surface-variant">{address}</p>
        {managerName && (
          <div className="mt-3 flex items-center gap-2 text-body-md text-on-surface-variant">
            <span className="grid size-7 shrink-0 place-items-center rounded-full bg-surface-container-high">
              <Icon name="person" size={18} />
            </span>
            Manager <span className="font-medium text-on-surface">{managerName}</span>
          </div>
        )}
        {actions && <div className="mt-4 flex flex-wrap gap-2">{actions}</div>}
      </div>
      <div className="w-full md:w-[380px]">
        <div className="flex items-end justify-between">
          <span className="text-body-md text-on-surface-variant">Overall progress</span>
          <span className="text-headline-md">{progress}%</span>
        </div>
        <ProgressBar value={progress} className="mt-2" aria-label="Overall progress" />
        {currentStage && (
          <div className="mt-3 text-body-md text-on-surface-variant">
            Currently working on <span className="font-medium text-on-surface">{currentStage}</span>
          </div>
        )}
      </div>
    </Card>
  );
}
