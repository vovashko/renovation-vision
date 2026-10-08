import { useId } from "react";
import { useTranslation } from "react-i18next";
import { Field, FieldDescription, FieldTitle } from "@/components/ui/field";
import { SegmentedControl, SegmentedControlItem } from "@/components/ui/segmented-control";
import { ProgressBar } from "@/components/ui/progress-bar";
import { statusTone } from "@/components/ui/status-ui";
import { StatusPill } from "@/components/status-pill";
import { VisibleSwitch } from "@/shared/ui/form-sheet";
import type { Status } from "@/domain/status";
import type { ProgressMode } from "@/lib/database.types";

/**
 * The stage form's "how is progress set" switch: automatic from the checklist (`tasks`) or by hand (`manual`),
 * with a one-line explanation of the selected mode right below it.
 */
export function ProgressModeControl({
  value,
  onChange,
  done,
  total,
}: {
  value: ProgressMode;
  onChange: (mode: ProgressMode) => void;
  done: number;
  total: number;
}) {
  const { t } = useTranslation("work");
  const labelId = useId();
  const modes: { key: ProgressMode; label: string }[] = [
    { key: "tasks", label: t("stageForm.modeTasks") },
    { key: "manual", label: t("stageForm.modeManual") },
  ];
  return (
    <Field>
      <FieldTitle id={labelId}>{t("stageForm.progressMode")}</FieldTitle>
      <SegmentedControl role="radiogroup" aria-labelledby={labelId}>
        {modes.map((m) => (
          <SegmentedControlItem
            key={m.key}
            role="radio"
            aria-checked={value === m.key}
            active={value === m.key}
            onClick={() => onChange(m.key)}
          >
            {m.label}
          </SegmentedControlItem>
        ))}
      </SegmentedControl>
      <FieldDescription>
        {value === "manual"
          ? t("stageForm.modeManualHint")
          : total > 0
            ? t("stageForm.computedFromTasks", { done, total })
            : t("stageForm.computedNoTasks")}
      </FieldDescription>
    </Field>
  );
}

/**
 * Tasks mode: progress and status are computed from the checklist (the database keeps them in sync), so
 * they are shown read-only. Only "blocked" is set by hand.
 */
export function TaskDerivedProgress({
  status,
  progress,
  onBlockedChange,
}: {
  status: Status;
  progress: number;
  onBlockedChange: (blocked: boolean) => void;
}) {
  const { t } = useTranslation("work");
  const switchId = useId();
  return (
    <Field>
      <div className="flex items-center justify-between gap-3">
        <FieldTitle>{t("stageForm.progress", { pct: progress })}</FieldTitle>
        <StatusPill status={status} size="sm" />
      </div>
      <ProgressBar value={progress} tone={statusTone[status]} />
      <FieldDescription>{t("stageForm.computedStatus")}</FieldDescription>
      <VisibleSwitch id={switchId} checked={status === "blocked"} onChange={onBlockedChange} label={t("stageForm.blocked")} />
    </Field>
  );
}
