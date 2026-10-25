// "invite" app email (T40): someone was invited to a project, as its client or as a manager. Strings live in the
// people i18n namespace (email.invite). The link carries a sign-in token, so the content is `sensitive` (the log
// provider never writes it out). Renders through ../design/components like every other app email.
import en from "@/features/people/i18n/en.json";
import pl from "@/features/people/i18n/pl.json";
import type { Locale } from "@/i18n/locale";
import { Button, Heading, Layout, Muted, Text } from "../design/components";
import { escapeHtml, interpolate } from "../html";
import type { EmailContent } from "./types";

const STRINGS: Record<Locale, (typeof en)["email"]["invite"]> = { en: en.email.invite, pl: pl.email.invite };

export type InviteEmailParams = {
  /** The app's origin, used for the header logo. */
  siteUrl: string;
  /** `/accept-invite?token_hash=…&type=invite` on the app's origin. */
  inviteUrl: string;
  inviterName: string;
  projectName: string;
  role: "client" | "manager";
  expiresInDays: number;
};

export function renderInviteEmail(params: InviteEmailParams, locale: Locale): EmailContent {
  const s = STRINGS[locale];
  const vars = { inviter: params.inviterName, project: params.projectName, days: String(params.expiresInDays) };
  const subject = interpolate(s.subject, vars);
  const intro = interpolate(params.role === "manager" ? s.introManager : s.introClient, vars);
  const validity = interpolate(s.validity, vars);
  const linkFallbackHtml = interpolate(s.linkFallback, { linkUrl: escapeHtml(params.inviteUrl) });
  const linkFallbackText = interpolate(s.linkFallback, { linkUrl: params.inviteUrl });

  const bodyHtml = [
    Heading(escapeHtml(s.heading)),
    Text(escapeHtml(intro)),
    Button(params.inviteUrl, s.cta),
    Text(escapeHtml(validity)),
    Muted(linkFallbackHtml),
    Muted(escapeHtml(s.ignore)),
  ].join("\n");

  const html = Layout({
    siteUrl: params.siteUrl,
    lang: locale,
    preheader: escapeHtml(intro),
    bodyHtml,
    footerHtml: escapeHtml(s.disclaimer),
  });

  const text = [s.heading, "", intro, "", linkFallbackText, "", validity, "", s.ignore, "", s.disclaimer].join("\n");

  return { subject, html, text, sensitive: true };
}
