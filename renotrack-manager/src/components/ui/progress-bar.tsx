import { Progress, type ProgressTone } from "./progress";

/** 8px Renovision progress bar. `tone` picks a status color; the default is primary. */
export function ProgressBar({ value, tone = "primary", onPanel, className }: { value: number; tone?: ProgressTone; onPanel?: boolean; className?: string }) {
  return <Progress value={value} tone={tone} onPanel={onPanel} className={className} aria-label={`${Math.round(value)}%`} />;
}
