// "digest" app email: a list of notification items plus one link button. Used later (T41) for a
// periodic digest; render-tested now. Chrome strings live in the comms i18n namespace
// ("email.digest"); each item's `title`/`body` is caller-provided content and is HTML-escaped.
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
};

function renderItemHtml(item: DigestEmailItem): string {
  const title = Heading(escapeHtml(item.title));
  const bodyText = item.body ? Muted(escapeHtml(item.body)) : "";
  return [title, bodyText].filter(Boolean).join("\n");
}

export function renderDigestEmail(params: DigestEmailParams, locale: Locale): EmailContent {
  const s = STRINGS[locale];
  const linkLabel = params.linkLabel ?? s.cta;

  const subject = s.subject;
  const preheaderHtml = escapeHtml(s.preheader);
  const linkFallbackHtml = interpolate(s.linkFallback, { linkUrl: escapeHtml(params.linkUrl) });
  const linkFallbackText = interpolate(s.linkFallback, { linkUrl: params.linkUrl });

  const itemsHtml = params.items.length
    ? params.items.map((item, i) => (i === 0 ? renderItemHtml(item) : [Divider(), renderItemHtml(item)].join("\n"))).join("\n")
    : Text(escapeHtml(s.empty));

  const bodyHtml = [Heading(escapeHtml(s.heading)), itemsHtml, Button(params.linkUrl, linkLabel), Muted(linkFallbackHtml)].join("\n");

  const html = Layout({
    siteUrl: params.siteUrl,
    lang: locale,
    preheader: preheaderHtml,
    bodyHtml,
    footerHtml: escapeHtml(s.disclaimer),
  });

  const itemsText = params.items.length
    ? params.items.map((item) => `- ${item.title}${item.body ? `: ${item.body}` : ""}`).join("\n")
    : s.empty;

  const text = [s.heading, "", itemsText, "", `${linkLabel}: ${params.linkUrl}`, "", linkFallbackText, "", s.disclaimer].join("\n");

  return { subject, html, text };
}
