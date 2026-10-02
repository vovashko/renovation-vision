// sendEmail(): renders an app email template and hands it to a provider (see ./providers.server).
//
//   import { sendEmail } from "@/server/email/send-email.server";
//   await sendEmail({
//     to: "sarah@renovision.demo",
//     template: "notification",
//     locale: "pl",
//     params: {
//       siteUrl: "https://app.renovision.app",
//       title: "Nowe zdjęcia",
//       body: "Dodano 4 zdjęcia z budowy.",
//       linkUrl: "https://app.renovision.app/projects/1/photos",
//     },
//   });
//
// There is no public server function exposed for this yet (T41 adds the callers for real
// notifications/digests). Any server function that calls sendEmail MUST add
// `rateLimit({ key: "email" })` to its middleware chain (src/server/rate-limits.ts caps it at
// 5/min) — see README → Email.
//
// SERVER-ONLY.
import "@tanstack/react-start/server-only";
import { getServerEnv } from "@/lib/env";
import { logger } from "@/lib/logger";
import type { Locale } from "@/i18n/locale";
import { ServerFnError } from "../errors";
import { resolveEmailProvider } from "./providers.server";
import { renderEmail, type EmailTemplateName, type EmailTemplateParams } from "./templates";

/** Shown in the README as needing a verified Brevo sender once BREVO_API_KEY is set. */
export const DEFAULT_EMAIL_FROM = "RenoVision <no-reply@renovision.app>";

export type SendEmailInput<T extends EmailTemplateName> = {
  to: string;
  template: T;
  locale: Locale;
  params: EmailTemplateParams[T];
};

export async function sendEmail<T extends EmailTemplateName>(input: SendEmailInput<T>): Promise<void> {
  const env = getServerEnv();
  const log = logger.child({ fn: "sendEmail", template: input.template });

  let provider;
  try {
    provider = resolveEmailProvider(env);
  } catch (error) {
    // Logged once here (one call = one request's worth of logging), then rethrown as-is so the
    // caller sees EMAIL_NOT_CONFIGURED rather than a generic INTERNAL error.
    log.error(error);
    throw error;
  }

  const from = env.emailFrom?.trim() || DEFAULT_EMAIL_FROM;
  const { subject, html, text } = renderEmail(input.template, input.params, input.locale);
  try {
    await provider.send({ to: input.to, from, subject, html, text });
    log.info("email sent", { provider: provider.name });
  } catch (error) {
    if (error instanceof ServerFnError) {
      log.error(error);
      throw error;
    }
    log.error(error instanceof Error ? error : "email send failed");
    throw new ServerFnError("INTERNAL", "Failed to send email");
  }
}
