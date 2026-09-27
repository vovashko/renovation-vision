import { useTranslation } from "react-i18next";
import { SegmentedControl, SegmentedControlItem } from "@/components/ui/segmented-control";

export type ProgressView = "timeline" | "plan";

const otherView = (view: ProgressView): ProgressView => (view === "timeline" ? "plan" : "timeline");

/** Timeline/floor-plan switch at the top of the Progress page. */
export function ProgressTabs({ view, onChange }: { view: ProgressView; onChange: (view: ProgressView) => void }) {
  const { t } = useTranslation("work");
  const views: { key: ProgressView; label: string }[] = [
    { key: "timeline", label: t("progress.tabTimeline") },
    { key: "plan", label: t("progress.tabPlan") },
  ];

  return (
    <SegmentedControl
      role="tablist"
      aria-label={t("progress.tabsLabel")}
      className="w-full sm:w-auto"
      onKeyDown={(e) => {
        if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
        const next = otherView(view);
        onChange(next);
        document.getElementById(`progress-tab-${next}`)?.focus();
      }}
    >
      {views.map((v) => (
        <SegmentedControlItem
          key={v.key}
          id={`progress-tab-${v.key}`}
          role="tab"
          aria-selected={view === v.key}
          aria-controls={`progress-panel-${v.key}`}
          tabIndex={view === v.key ? 0 : -1}
          active={view === v.key}
          onClick={() => onChange(v.key)}
        >
          {v.label}
        </SegmentedControlItem>
      ))}
    </SegmentedControl>
  );
}
