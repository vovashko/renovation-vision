// "confirmationCode" app email: the 6-digit code that confirms accepting an investor decision (#55).
// Chrome strings live in the comms i18n namespace (email.confirmationCode); `title` is the case's title
// (user-written, HTML-escaped). The content is marked `sensitive`, so the log provider never writes the
// code to the logs. Renders through ../design/components like every other app email.
import en from "@/features/comms/i18n/en.json";
import pl from "@/features/comms/i18n/pl.json";
import type { Locale } from "@/i18n/locale";
import { Heading, Layout, Muted, Text } from "../design/components";
import { escapeHtml, interpolate } from "../html";
import type { EmailContent } from "./types";

const STRINGS: Record<Locale, (typeof en)["email"]["confirmationCode"]> = { en: en.email.confirmationCode, pl: pl.email.confirmationCode };

export type ConfirmationCodeEmailParams = {
  /** The app's origin, used for the header logo. */
  siteUrl: string;
  /** The decision case's title. */
  title: string;
  /** The 6-digit code. */
  code: string;
  /** How long the code is valid, for the sentence under it. */
  ttlMinutes: number;
};

export function renderConfirmationCodeEmail(params: ConfirmationCodeEmailParams, locale: Locale): EmailContent {
  const s = STRINGS[locale];
  const minutes = String(params.ttlMinutes);

  const subject = s.subject;
  const intro = interpolate(s.intro, { title: params.title });
  const validity = interpolate(s.validity, { minutes });

  const bodyHtml = [
    Heading(escapeHtml(s.heading)),
    Text(escapeHtml(intro)),
    Heading(escapeHtml(params.code.split("").join(" "))),
    Text(escapeHtml(validity)),
    Muted(escapeHtml(s.ignore)),
  ].join("\n");

  const html = Layout({
    siteUrl: params.siteUrl,
    lang: locale,
    preheader: escapeHtml(interpolate(s.preheader, { title: params.title })),
    bodyHtml,
    footerHtml: escapeHtml(s.disclaimer),
  });

  const text = [s.heading, "", intro, "", params.code, "", validity, "", s.ignore, "", s.disclaimer].join("\n");

  return { subject, html, text, sensitive: true };
}
