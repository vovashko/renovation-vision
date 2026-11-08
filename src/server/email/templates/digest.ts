// "digest" app email: a list of notification items plus one link button. The daily digest (T41) uses it as is; the
// instant job uses it, with its own subject and heading, when several notifications reach one person in one run.
// Chrome strings live in the comms i18n namespace ("email.digest"); each item's `title`/`body` and the overrides
// are caller-provided content and are HTML-escaped.
// Renders through ../design/components, the same building blocks the generated auth templates use.
import en from "@/features/comms/i18n/en.json";
import pl from "@/features/comms/i18n/pl.json";
import type { Locale } from "@/i18n/locale";
import { Button, Divider, Heading, Layout, Muted, Text } from "../design/components";
import { escapeHtml, interpolate } from "../html";
import type { EmailContent } from "./types";

const STRINGS: Record<Locale, (typeof en)["email"]["digest"]> = { en: en.email.digest, pl: pl.email.digest };

export type DigestEmailItem = { title: string; body?: string };

export type DigestEmailParams = {
  /** The app's origin, e.g. "https://app.renovision.app" — used for the header logo and the link fallback text. */
  siteUrl: string;
  items: DigestEmailItem[];
  linkUrl: string;
  /** Defaults to the translated "Open in RenoVision" when not given. */
  linkLabel?: string;
  /** Replace the digest's own subject, heading and preheader (the instant job's batch email). */
  subject?: string;
  heading?: string;
  preheader?: string;
  /** Items left out of `items` (listed as "And N more in the app"). */
  more?: number;
  /** Settings → Notifications, shown in the footer as the place to change these emails. */
  manageUrl?: string;
};

function renderItemHtml(item: DigestEmailItem): string {
  const title = Heading(escapeHtml(item.title));
  const bodyText = item.body ? Muted(escapeHtml(item.body)) : "";
  return [title, bodyText].filter(Boolean).join("\n");
}

export function renderDigestEmail(params: DigestEmailParams, locale: Locale): EmailContent {
  const s = STRINGS[locale];
  const linkLabel = params.linkLabel ?? s.cta;

  const subject = params.subject ?? s.subject;
  const heading = params.heading ?? s.heading;
  const preheaderHtml = escapeHtml(params.preheader ?? s.preheader);
  const more = params.more && params.more > 0 ? interpolate(s.more, { count: String(params.more) }) : "";
  const manage = params.manageUrl ? interpolate(s.manage, { url: params.manageUrl }) : "";
  const linkFallbackHtml = interpolate(s.linkFallback, { linkUrl: escapeHtml(params.linkUrl) });
  const linkFallbackText = interpolate(s.linkFallback, { linkUrl: params.linkUrl });

  const itemsHtml = params.items.length
    ? params.items.map((item, i) => (i === 0 ? renderItemHtml(item) : [Divider(), renderItemHtml(item)].join("\n"))).join("\n")
    : Text(escapeHtml(s.empty));

  const bodyHtml = [
    Heading(escapeHtml(heading)),
    itemsHtml,
    more ? Muted(escapeHtml(more)) : "",
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

  const itemsText = params.items.length
    ? params.items.map((item) => `- ${item.title}${item.body ? `: ${item.body}` : ""}`).join("\n")
    : s.empty;

  const text = [
    heading,
    "",
    itemsText,
    ...(more ? ["", more] : []),
    "",
    `${linkLabel}: ${params.linkUrl}`,
    "",
    linkFallbackText,
    "",
    s.disclaimer,
  ]
    .concat(manage ? [manage] : [])
    .join("\n");

  return { subject, html, text };
}
