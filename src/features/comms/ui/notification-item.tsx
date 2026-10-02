import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { Item, ItemActions, ItemContent, ItemDescription, ItemHeader, ItemTitle } from "@/components/ui/item";
import { useFormat } from "@/i18n";
import type { Notification } from "@/lib/database.types";
import { useNotificationKindLabel, useNotificationText } from "@/features/comms/hooks/use-notification-text";

// Named at module scope, not as an inline literal, so the linter doesn't mistake this
// non-translatable format identifier for user-facing text.
const DAY_TIME_STYLE = "dayTime";

// Title and body are rendered from the notification's `kind` + `params` in the current language
// (useNotificationText); unknown kinds fall back to the stored English `title`/`body`.

/** A notification the manager sent to their client(s), grouped back into one row with a read count. */
export function SentNotificationItem({
  notification,
  total,
  read,
  linkLabel,
}: {
  notification: Notification;
  total: number;
  read: number;
  linkLabel?: string;
}) {
  const { t } = useTranslation("comms");
  const format = useFormat();
  const { title, body } = useNotificationText()(notification);
  const kindLabel = useNotificationKindLabel();
  return (
    <Item size="lg">
      <ItemHeader>
        <ItemTitle>{title}</ItemTitle>
        <ItemActions>
          <Badge variant="outline" size="compact">
            {kindLabel(notification.kind)}
          </Badge>
        </ItemActions>
      </ItemHeader>
      <ItemContent>
        {body && <ItemDescription className="line-clamp-none">{body}</ItemDescription>}
        <ItemDescription className="line-clamp-none">
          {format.date(notification.created_at, DAY_TIME_STYLE)} · {t("updates.sent.readBy", { read, total })}
          {linkLabel ? ` · ${t("updates.sent.opens", { link: linkLabel })}` : ""}
        </ItemDescription>
      </ItemContent>
    </Item>
  );
}

/** A notification in the manager's own inbox (e.g. a client's reply). */
export function InboxNotificationItem({ notification }: { notification: Notification }) {
  const format = useFormat();
  const { title, body } = useNotificationText()(notification);
  return (
    <Item size="lg">
      <ItemContent>
        <ItemTitle>{title}</ItemTitle>
        <ItemDescription className="line-clamp-none">{body}</ItemDescription>
      </ItemContent>
      <ItemActions>
        <span className="shrink-0 text-body-sm text-on-surface-variant">{format.date(notification.created_at, DAY_TIME_STYLE)}</span>
      </ItemActions>
    </Item>
  );
}
