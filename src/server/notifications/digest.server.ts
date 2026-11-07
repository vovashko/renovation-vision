// The daily notification digest (T41), on the same 5-minute cron as the instant emails:
//
//   1. The boundary is the latest 07:00 Europe/Warsaw (DST-safe, digestBoundary). With the admin client, claim
//      (mark emailed) the unemailed rows created in the 48 hours before it whose effective email frequency is
//      `daily`, for up to RECIPIENTS_PER_RUN recipients. Rows created after 07:00 wait for tomorrow's boundary.
//   2. Email each recipient one `digest` in their language, every row of theirs in it.
//
// So the 07:05 run (the first after 07:00) sends the day's digests; a later run only finds the overflow beyond the
// recipient cap (or nothing, cheaply). A recipient is claimed whole, so nobody gets two digests for one day, and
// the claim comes first, so a crash never sends twice.
//
// SERVER-ONLY.
import "@tanstack/react-start/server-only";
import { logger } from "@/lib/logger";
import { getAdminSupabase, type AdminSupabase } from "@/lib/supabase/admin";
import { DIGEST_LOOKBACK_HOURS, digestBoundary } from "@/features/comms/domain/delivery";
import { sendEmail } from "../email/send-email.server";
import {
  claimNotificationEmails,
  deliverToRecipients,
  emailItems,
  manageUrl,
  notificationEmailOrigin,
  type DeliveryResult,
} from "./deliver.server";

const log = logger.child({ fn: "notificationDigest" });

export async function sendNotificationDigests(
  deps: { admin?: AdminSupabase; now?: Date; siteUrl?: string | null } = {},
): Promise<DeliveryResult> {
  const siteUrl = deps.siteUrl === undefined ? notificationEmailOrigin() : deps.siteUrl;
  if (!siteUrl) {
    log.info("notification digests are off (no APP_ORIGIN)");
    return { claimed: 0, recipients: 0, emailed: 0 };
  }
  const until = digestBoundary(deps.now ?? new Date());
  const admin = deps.admin ?? getAdminSupabase();
  const rows = await claimNotificationEmails(admin, {
    frequency: "daily",
    since: new Date(until.getTime() - DIGEST_LOOKBACK_HOURS * 3_600_000),
    until,
  });

  const result = await deliverToRecipients(
    admin,
    rows,
    async ({ recipient, rows: list, t, projectNames }) => {
      const { items, more, projectId } = emailItems(t, list, projectNames);
      await sendEmail({
        to: recipient.email,
        template: "digest",
        locale: recipient.locale,
        params: {
          siteUrl,
          items,
          more,
          linkUrl: projectId ? `${siteUrl}/projects/${projectId}` : `${siteUrl}/`,
          manageUrl: manageUrl(siteUrl),
        },
      });
    },
    log,
  );
  if (result.claimed > 0) log.info("notification digests", { ...result, boundary: until.toISOString() });
  return result;
}
