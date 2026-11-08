import { useState } from "react";
import { useTranslation } from "react-i18next";
import { RailItem } from "@/components/ui/rail";
import { TabBarItem, TabBarRow } from "@/components/ui/tab-bar";
import { useUnreadCount } from "@/features/comms/hooks/use-inbox";
import { InboxSheet } from "./inbox";

const BELL_ICON = "notifications";

/** The bell's accessible name: "Notifications, 3 unread". */
function useBellLabel() {
  const { t } = useTranslation("comms");
  const { data: unread = 0 } = useUnreadCount();
  return { unread, label: t("bell.label"), ariaLabel: unread > 0 ? t("bell.labelWithCount", { count: unread }) : t("bell.label") };
}

/** The desktop rail's bell: the unread count as a badge; opens the inbox. */
export function NotificationBellRailItem() {
  const [open, setOpen] = useState(false);
  const { unread, label, ariaLabel } = useBellLabel();
  return (
    <>
      <RailItem icon={BELL_ICON} label={label} badge={unread} aria-label={ariaLabel} aria-haspopup="dialog" onClick={() => setOpen(true)} />
      <InboxSheet open={open} onOpenChange={setOpen} />
    </>
  );
}

/** The phone bar's bell, outside a project (where the bar has no "More" sheet). */
export function NotificationBellTabItem() {
  const [open, setOpen] = useState(false);
  const { unread, label, ariaLabel } = useBellLabel();
  return (
    <>
      <TabBarItem
        icon={BELL_ICON}
        label={label}
        badge={unread}
        aria-label={ariaLabel}
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
      />
      <InboxSheet open={open} onOpenChange={setOpen} />
    </>
  );
}

/** The bell as a row of the phone's "More" sheet; the caller closes that sheet and opens the inbox. */
export function NotificationBellRow({ onOpen }: { onOpen: () => void }) {
  const { unread, label, ariaLabel } = useBellLabel();
  return (
    <TabBarRow icon={BELL_ICON} badge={unread} aria-label={ariaLabel} aria-haspopup="dialog" onClick={onOpen}>
      {label}
    </TabBarRow>
  );
}

export { InboxSheet };
