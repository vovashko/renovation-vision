import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import type { ActivityEntry, Notification } from "@/lib/database.types";
import { notificationText, type NotificationText } from "../domain/notification-text";
import { isNotificationKind, paramAction, paramEntity, paramName } from "../domain/params";

export type { NotificationText } from "../domain/notification-text";

/**
 * Renders a notification from its `kind` + `params` in the current language (`comms:notifications.*`), through
 * `notificationText` (domain/notification-text.ts, shared with the email jobs). Unknown kinds fall back to the
 * legacy English `title`/`body`.
 */
export function useNotificationText(): (n: Pick<Notification, "kind" | "params" | "title" | "body">) => NotificationText {
  const { t } = useTranslation(["comms", "common"]);
  return useCallback((n) => notificationText(t, n), [t]);
}

/** The short label for a notification's kind ("Stage", "Announcement"…); an unknown kind is shown as stored. */
export function useNotificationKindLabel(): (kind: string) => string {
  const { t } = useTranslation(["comms"]);
  return useCallback((kind: string) => (isNotificationKind(kind) ? t(`notifications.kind.${kind}`) : kind), [t]);
}

/**
 * Renders an activity entry from `params` ({ entity, action, label }) in the current language
 * (`comms:activity.*`), e.g. "Zaktualizowano etap „Flooring”". Rows without known params (older rows,
 * or a table the app has no label for yet) fall back to the English `summary`.
 */
export function useActivityText(): (a: Pick<ActivityEntry, "params" | "summary">) => string {
  const { t } = useTranslation(["comms"]);
  return useCallback(
    (a) => {
      const entity = paramEntity(a.params);
      const action = paramAction(a.params);
      if (!entity || !action) return a.summary;
      const entityLabel = t(`activity.entity.${entity}`);
      const label = paramName(a.params, "label");
      return label
        ? t(`activity.labelled.${action}`, { entity: entityLabel, label })
        : t(`activity.plain.${action}`, { entity: entityLabel });
    },
    [t],
  );
}
