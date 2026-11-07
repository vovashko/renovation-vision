// The instant notification emails (T41), every 5 minutes (wrangler.jsonc → triggers.crons, src/server.ts →
// scheduled):
//
//   1. With the admin client, claim (mark emailed) the last 24 hours' unemailed rows whose effective email frequency
//      is `instant`, for up to RECIPIENTS_PER_RUN recipients: the user's saved preference, plus the change-request
//      kinds that are always instant (rejected, reopened). The kinds T61 emails itself are never claimed.
//   2. Email each recipient once, in their language: one row as a `notification` email, several as one batch
//      (`digest` template with its own subject).
//
// The claim comes first, so a crash or an overlapping run never sends a row twice (a failed send is not retried).
//
// SERVER-ONLY.
import "@tanstack/react-start/server-only";
import { logger } from "@/lib/logger";
import { getAdminSupabase, type AdminSupabase } from "@/lib/supabase/admin";
import { INSTANT_LOOKBACK_HOURS } from "@/features/comms/domain/delivery";
import { notificationText } from "@/features/comms/domain/notification-text";
import { sendEmail } from "../email/send-email.server";
import {
  claimNotificationEmails,
  deliverToRecipients,
  emailItems,
  linkTo,
  manageUrl,
  notificationEmailOrigin,
  type DeliveryResult,
} from "./deliver.server";

const log = logger.child({ fn: "instantNotificationEmails" });

export async function sendInstantNotificationEmails(
  deps: { admin?: AdminSupabase; now?: Date; siteUrl?: string | null } = {},
): Promise<DeliveryResult> {
  const siteUrl = deps.siteUrl === undefined ? notificationEmailOrigin() : deps.siteUrl;
  if (!siteUrl) {
    log.info("instant notification emails are off (no APP_ORIGIN)");
    return { claimed: 0, recipients: 0, emailed: 0 };
  }
  const now = deps.now ?? new Date();
  const admin = deps.admin ?? getAdminSupabase();
  const rows = await claimNotificationEmails(admin, {
    frequency: "instant",
    since: new Date(now.getTime() - INSTANT_LOOKBACK_HOURS * 3_600_000),
    until: now,
  });

  const result = await deliverToRecipients(
    admin,
    rows,
    async ({ recipient, rows: list, t, projectNames }) => {
      if (list.length === 1) {
        const { title, body } = notificationText(t, list[0]);
        await sendEmail({
          to: recipient.email,
          template: "notification",
          locale: recipient.locale,
          params: { siteUrl, title, body, linkUrl: linkTo(siteUrl, list[0]), manageUrl: manageUrl(siteUrl) },
        });
        return;
      }
      const { items, more, projectId } = emailItems(t, list, projectNames);
      const count = String(list.length);
      await sendEmail({
        to: recipient.email,
        template: "digest",
        locale: recipient.locale,
        params: {
          siteUrl,
          items,
          more,
          linkUrl: projectId ? `${siteUrl}/projects/${projectId}` : `${siteUrl}/`,
          subject: t("comms:email.batch.subject", { count }),
          heading: t("comms:email.batch.heading"),
          preheader: t("comms:email.batch.preheader", { count }),
          manageUrl: manageUrl(siteUrl),
        },
      });
    },
    log,
  );
  if (result.claimed > 0) log.info("instant notification emails", result);
  return result;
}
