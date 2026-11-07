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

/**
 * A notification in the user's own inbox (the bell, and the manager's Updates page), tinted until read. With
 * `onOpen` the row is a button that opens what it is about; `projectName` names the project in a cross-project list.
 */
export function InboxNotificationItem({
  notification,
  projectName,
  onOpen,
}: {
  notification: Notification;
  projectName?: string;
  onOpen?: () => void;
}) {
  const { t } = useTranslation("comms");
  const format = useFormat();
  const { title, body } = useNotificationText()(notification);
  const unread = !notification.read_at;
  const content = (
    <>
      <ItemContent>
        <ItemTitle>
          {title}
          {unread && <span className="sr-only">{t("inbox.unread")}</span>}
        </ItemTitle>
        {body && <ItemDescription className="line-clamp-3">{body}</ItemDescription>}
        {projectName && <ItemDescription>{projectName}</ItemDescription>}
      </ItemContent>
      <ItemActions>
        <span className="shrink-0 text-body-sm text-on-surface-variant">{format.date(notification.created_at, DAY_TIME_STYLE)}</span>
      </ItemActions>
    </>
  );
  if (!onOpen) {
    return (
      <Item size="lg" unread={unread}>
        {content}
      </Item>
    );
  }
  return (
    <Item asChild size="lg" unread={unread}>
      <button type="button" onClick={onOpen}>
        {content}
      </button>
    </Item>
  );
}
