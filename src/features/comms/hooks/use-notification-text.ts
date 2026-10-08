import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import type { ActivityEntry, Notification } from "@/lib/database.types";
import {
  isNotificationKind,
  paramAction,
  paramEntity,
  paramFlag,
  paramName,
  paramScheduleStatus,
  paramStatus,
  paramText,
} from "../domain/params";

export type NotificationText = { title: string; body: string };

/**
 * Renders a notification from its `kind` + `params` in the current language (`comms:notifications.*`).
 * Unknown kinds (and rows missing a value the text needs, e.g. written before T33) fall back to the
 * legacy English `title`/`body`. User-written values (names, captions, notes, announcements) are shown
 * as written.
 */
export function useNotificationText(): (n: Pick<Notification, "kind" | "params" | "title" | "body">) => NotificationText {
  const { t } = useTranslation(["comms", "common"]);
  return useCallback(
    (n) => {
      const p = n.params;
      const legacy = { title: n.title, body: n.body };
      switch (n.kind) {
        case "stage_status": {
          const stage = paramName(p, "stage");
          const status = paramStatus(p);
          if (!stage || !status) return legacy;
          const statusLabel = t(`common:status.${status}`).toLowerCase();
          return {
            title: t("notifications.stage_status.title", { stage }),
            body: t("notifications.stage_status.body", { stage, status: statusLabel }),
          };
        }
        case "room_status": {
          const room = paramName(p, "room");
          const status = paramStatus(p);
          if (!room || !status) return legacy;
          return {
            title: t("notifications.room_status.title", { room, status: t(`common:status.${status}`).toLowerCase() }),
            body: paramText(p, "note") ?? n.body,
          };
        }
        case "photo_published":
          return { title: t("notifications.photo_published.title"), body: paramText(p, "caption") ?? n.body };
        case "render_published": {
          const title = paramName(p, "title");
          return {
            title: title ? t("notifications.render_published.title", { title }) : t("notifications.render_published.untitled"),
            body: paramText(p, "description") ?? n.body,
          };
        }
        case "schedule_status": {
          const status = paramScheduleStatus(p);
          if (!status) return legacy;
          return {
            title: t("notifications.schedule_status.title", { status: t(`common:schedule.${status}`) }),
            body: paramText(p, "note") ?? n.body,
          };
        }
        case "message": {
          const sender = paramName(p, "sender");
          const preview = paramText(p, "preview");
          if (preview === undefined) return legacy;
          return {
            title: sender ? t("notifications.message.title", { sender }) : t("notifications.message.titleNoSender"),
            body: preview || (paramFlag(p, "attachment") ? t("notifications.message.attachment") : ""),
          };
        }
        case "decision_new":
        case "decision_answer":
        case "decision_question":
        case "decision_rejected":
        case "decision_reopened": {
          // params { title, text }: the case's title and the question / answer / reason, shown as written.
          const title = paramName(p, "title");
          if (!title) return legacy;
          return { title: t(`notifications.${n.kind}.title`, { title }), body: paramText(p, "text") ?? n.body };
        }
        case "manual": {
          const title = paramName(p, "title");
          return title ? { title, body: paramText(p, "body") ?? "" } : legacy;
        }
        default:
          return legacy;
      }
    },
    [t],
  );
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
