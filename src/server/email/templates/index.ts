// Registry of app email templates: plain TypeScript functions, each returning { subject, html,
// text } for a locale. src/server/email/send-email.server.ts renders one of these, then hands the
// result to a provider.
import type { Locale } from "@/i18n/locale";
import { renderConfirmationCodeEmail, type ConfirmationCodeEmailParams } from "./confirmation-code";
import { renderDigestEmail, type DigestEmailParams } from "./digest";
import { renderNotificationEmail, type NotificationEmailParams } from "./notification";
import type { EmailContent } from "./types";

export type { EmailContent } from "./types";
export type { NotificationEmailParams } from "./notification";
export type { ConfirmationCodeEmailParams } from "./confirmation-code";
export type { DigestEmailItem, DigestEmailParams } from "./digest";

export type EmailTemplateParams = {
  notification: NotificationEmailParams;
  digest: DigestEmailParams;
  confirmationCode: ConfirmationCodeEmailParams;
};

export type EmailTemplateName = keyof EmailTemplateParams;

export function renderEmail<T extends EmailTemplateName>(template: T, params: EmailTemplateParams[T], locale: Locale): EmailContent {
  switch (template) {
    case "notification":
      return renderNotificationEmail(params as NotificationEmailParams, locale);
    case "digest":
      return renderDigestEmail(params as DigestEmailParams, locale);
    case "confirmationCode":
      return renderConfirmationCodeEmail(params as ConfirmationCodeEmailParams, locale);
    default: {
      const exhaustive: never = template;
      throw new Error(`Unknown email template: ${String(exhaustive)}`);
    }
  }
}
