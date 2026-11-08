// A notification's title and body from its `kind` + `params`, given a translate function for the comms and common
// namespaces. Pure, so the browser (hooks/use-notification-text.ts) and the email jobs (src/server/notifications,
// with a fixed-locale `t`) render the same text.
import type { TFunction } from "i18next";
import type { Notification } from "@/lib/database.types";
import { paramName, paramScheduleStatus, paramStatus, paramText } from "./params";

export type NotificationText = { title: string; body: string };
export type CommsT = TFunction<["comms", "common"]>;

/**
 * Unknown kinds (and rows missing a value the text needs, e.g. written before T33) fall back to the legacy English
 * `title`/`body`. User-written values (names, captions, notes, announcements) are shown as written.
 */
export function notificationText(t: CommsT, n: Pick<Notification, "kind" | "params" | "title" | "body">): NotificationText {
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
    case "decision_new":
    case "decision_answer":
    case "decision_question":
    case "decision_rejected":
    case "decision_reopened":
    case "decision_accepted":
    case "decision_reminder": {
      // params { title, text }: the change request's title and the rejection reason (or an old question / answer), as written.
      const title = paramName(p, "title");
      if (!title) return legacy;
      return { title: t(`notifications.${n.kind}.title`, { title }), body: paramText(p, "text") ?? n.body };
    }
    case "document_new": {
      const name = paramName(p, "name");
      return name ? { title: t("notifications.document_new.title", { name }), body: n.body } : legacy;
    }
    case "manual": {
      const title = paramName(p, "title");
      return title ? { title, body: paramText(p, "body") ?? "" } : legacy;
    }
    default:
      return legacy;
  }
}
