import { useTranslation } from "react-i18next";
import { SegmentedControl, SegmentedControlItem } from "@/components/ui/segmented-control";

export type ChatMode = "people" | "ai";

// A top-level lookup, not an inline ternary, so the linter doesn't mistake these mode
// identifiers (not user-facing text) for a literal string inside the JSX keyboard handler.
const OTHER_MODE: Record<ChatMode, ChatMode> = { people: "ai", ai: "people" };

/** People/AI segmented tab control above the chat panel. */
export function ChatModeTabs({ mode, onChange, panelId }: { mode: ChatMode; onChange: (mode: ChatMode) => void; panelId: string }) {
  const { t } = useTranslation("comms");
  const tabs: { key: ChatMode; label: string }[] = [
    { key: "people", label: t("chat.tabs.people") },
    { key: "ai", label: t("chat.tabs.ai") },
  ];

  return (
    <div className="px-4 pt-4 pb-2">
      <SegmentedControl
        role="tablist"
        aria-label={t("chat.tabs.ariaLabel")}
        onKeyDown={(e) => {
          if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
          const next = OTHER_MODE[mode];
          onChange(next);
          document.getElementById(`chat-tab-${next}`)?.focus();
        }}
      >
        {tabs.map((tab) => (
          <SegmentedControlItem
            key={tab.key}
            id={`chat-tab-${tab.key}`}
            role="tab"
            aria-selected={mode === tab.key}
            aria-controls={panelId}
            tabIndex={mode === tab.key ? 0 : -1}
            active={mode === tab.key}
            onClick={() => onChange(tab.key)}
          >
            {tab.label}
          </SegmentedControlItem>
        ))}
      </SegmentedControl>
    </div>
  );
}
