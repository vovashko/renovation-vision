import { SegmentedControl, SegmentedControlItem } from "@/components/ui/segmented-control";

/** Generic tab switch (SegmentedControl as a tablist) with roving tabindex and arrow-key navigation. */
export function ViewTabs<T extends string>({
  views,
  view,
  onChange,
  label,
  idPrefix,
}: {
  views: { key: T; label: string }[];
  view: T;
  onChange: (v: T) => void;
  label: string;
  idPrefix: string;
}) {
  return (
    <SegmentedControl
      role="tablist"
      aria-label={label}
      className="w-full sm:w-auto"
      onKeyDown={(e) => {
        if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
        const index = views.findIndex((v) => v.key === view);
        const step = e.key === "ArrowRight" ? 1 : -1;
        const next = views[(index + step + views.length) % views.length].key;
        onChange(next);
        document.getElementById(`${idPrefix}-tab-${next}`)?.focus();
      }}
    >
      {views.map((v) => (
        <SegmentedControlItem
          key={v.key}
          id={`${idPrefix}-tab-${v.key}`}
          role="tab"
          aria-selected={view === v.key}
          aria-controls={`${idPrefix}-panel-${v.key}`}
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
