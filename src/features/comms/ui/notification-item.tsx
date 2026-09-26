import { Badge } from "@/components/ui/badge";
import { Item, ItemActions, ItemContent, ItemDescription, ItemHeader, ItemTitle } from "@/components/ui/item";
import { dateTime } from "@/lib/format";
import type { Notification } from "@/lib/database.types";

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
  return (
    <Item size="lg">
      <ItemHeader>
        <ItemTitle>{notification.title}</ItemTitle>
        <ItemActions>
          <Badge variant="outline" size="compact">
            {notification.kind}
          </Badge>
        </ItemActions>
      </ItemHeader>
      <ItemContent>
        {notification.body && <ItemDescription className="line-clamp-none">{notification.body}</ItemDescription>}
        <ItemDescription className="line-clamp-none">
          {dateTime(notification.created_at)} · read by {read} of {total}
          {linkLabel ? ` · opens ${linkLabel}` : ""}
        </ItemDescription>
      </ItemContent>
    </Item>
  );
}

/** A notification in the manager's own inbox (e.g. a client's reply). */
export function InboxNotificationItem({ notification }: { notification: Notification }) {
  return (
    <Item size="lg">
      <ItemContent>
        <ItemTitle>{notification.title}</ItemTitle>
        <ItemDescription className="line-clamp-none">{notification.body}</ItemDescription>
      </ItemContent>
      <ItemActions>
        <span className="shrink-0 text-body-sm text-on-surface-variant">{dateTime(notification.created_at)}</span>
      </ItemActions>
    </Item>
  );
}
