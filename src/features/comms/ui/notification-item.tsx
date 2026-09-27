import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { Item, ItemActions, ItemContent, ItemDescription, ItemHeader, ItemTitle } from "@/components/ui/item";
import { useFormat } from "@/i18n";
import type { Notification } from "@/lib/database.types";

// Named at module scope, not as an inline literal, so the linter doesn't mistake this
// non-translatable format identifier for user-facing text.
const DAY_TIME_STYLE = "dayTime";

// `notification.title`/`.body`/`.kind` come from the database in English for now (see the comms
// README / PR: a later schema task adds a `kind` + params pair so these can be rendered from a
// translated template). Shown as written until then.

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
  return (
    <Item size="lg">
      <ItemContent>
        <ItemTitle>{notification.title}</ItemTitle>
        <ItemDescription className="line-clamp-none">{notification.body}</ItemDescription>
      </ItemContent>
      <ItemActions>
        <span className="shrink-0 text-body-sm text-on-surface-variant">{format.date(notification.created_at, DAY_TIME_STYLE)}</span>
      </ItemActions>
    </Item>
  );
}
