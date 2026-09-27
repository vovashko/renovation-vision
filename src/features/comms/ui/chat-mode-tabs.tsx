import { SegmentedControl, SegmentedControlItem } from "@/components/ui/segmented-control";

export type ChatMode = "people" | "ai";

const TABS: { key: ChatMode; label: string }[] = [
  { key: "people", label: "Site manager" },
  { key: "ai", label: "Ask AI" },
];

/** People/AI segmented tab control above the chat panel. */
export function ChatModeTabs({ mode, onChange, panelId }: { mode: ChatMode; onChange: (mode: ChatMode) => void; panelId: string }) {
  return (
    <div className="px-4 pt-4 pb-2">
      <SegmentedControl
        role="tablist"
        aria-label="Chat mode"
        onKeyDown={(e) => {
          if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
          const next = mode === "people" ? "ai" : "people";
          onChange(next);
          document.getElementById(`chat-tab-${next}`)?.focus();
        }}
      >
        {TABS.map((t) => (
          <SegmentedControlItem
            key={t.key}
            id={`chat-tab-${t.key}`}
            role="tab"
            aria-selected={mode === t.key}
            aria-controls={panelId}
            tabIndex={mode === t.key ? 0 : -1}
            active={mode === t.key}
            onClick={() => onChange(t.key)}
          >
            {t.label}
          </SegmentedControlItem>
        ))}
      </SegmentedControl>
    </div>
  );
}
