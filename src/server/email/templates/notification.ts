// "notification" app email: a title, a body and a link button: one notification emailed (T41's instant job) or a
// change-request event (T61). Chrome strings (subject, cta, disclaimer) live in
// the comms i18n namespace (src/features/comms/i18n/{en,pl}.json → "email.notification"), so the
// en/pl parity test covers them; `title`/`body` are caller-provided content and are HTML-escaped.
// Renders through ../design/components, the same building blocks the generated auth templates use.
import en from "@/features/comms/i18n/en.json";
import pl from "@/features/comms/i18n/pl.json";
import type { Locale } from "@/i18n/locale";
import { Button, Heading, Layout, Muted, Text } from "../design/components";
import { escapeHtml, interpolate } from "../html";
import type { EmailContent } from "./types";

const STRINGS: Record<Locale, (typeof en)["email"]["notification"]> = { en: en.email.notification, pl: pl.email.notification };

export type NotificationEmailParams = {
  /** The app's origin, e.g. "https://app.renovision.app" — used for the header logo and the link fallback text. */
  siteUrl: string;
  title: string;
  body: string;
  linkUrl: string;
  /** Defaults to the translated "Open in RenoVision" when not given. */
  linkLabel?: string;
  /** Settings → Notifications, shown in the footer as the place to change these emails. */
  manageUrl?: string;
};

export function renderNotificationEmail(params: NotificationEmailParams, locale: Locale): EmailContent {
  const s = STRINGS[locale];
  const linkLabel = params.linkLabel ?? s.cta;

  const subject = interpolate(s.subject, { title: params.title });
  const preheaderHtml = escapeHtml(interpolate(s.preheader, { title: params.title }));
  const linkFallbackHtml = interpolate(s.linkFallback, { linkUrl: escapeHtml(params.linkUrl) });
  const linkFallbackText = interpolate(s.linkFallback, { linkUrl: params.linkUrl });
  const manage = params.manageUrl ? interpolate(s.manage, { url: params.manageUrl }) : "";

  const bodyHtml = [
    Heading(escapeHtml(params.title)),
    params.body ? Text(escapeHtml(params.body)) : "",
    Button(params.linkUrl, linkLabel),
    Muted(linkFallbackHtml),
  ]
    .filter(Boolean)
    .join("\n");

  const html = Layout({
    siteUrl: params.siteUrl,
    lang: locale,
    preheader: preheaderHtml,
    bodyHtml,
    footerHtml: [escapeHtml(s.disclaimer), manage ? escapeHtml(manage) : ""].filter(Boolean).join("<br />"),
  });

  const text = [params.title, "", params.body, "", `${linkLabel}: ${params.linkUrl}`, "", linkFallbackText, "", s.disclaimer]
    .concat(manage ? [manage] : [])
    .join("\n");

  return { subject, html, text };
}
