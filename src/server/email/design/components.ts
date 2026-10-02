// Table-based, inline-styled email "components" built from ../design/tokens — the design system's
// look, translated to what email clients actually support (no CSS variables, no Tailwind, no
// flexbox/grid). Both the app templates (../templates/*.ts) and the generated auth templates
// (scripts/build-auth-email-templates.ts) render through these, so there is exactly one place that
// knows what a RenoVision email looks like.
//
// Every function returns an HTML *fragment*: callers compose them inside Layout(). Dynamic text
// must be escaped by the caller (escapeHtml, ../html.ts) before it reaches these — components don't
// escape for you, since some callers intentionally pass already-built HTML (e.g. a Divider between
// two Text() fragments).
import { escapeHtml } from "../html";
import { emailColors, emailFontFamily, emailRadii, emailSpacing, emailType } from "./tokens";

/** The branded header + card shell + footer. `siteUrl` may be a real origin (app emails) or the
 * literal Go-template placeholder `"{{ .SiteURL }}"` (generated auth emails) — it's only ever
 * concatenated into a URL, never parsed. `bodyHtml`/`footerHtml` are trusted, pre-escaped HTML. */
export function Layout(opts: { siteUrl: string; lang: string; preheader: string; bodyHtml: string; footerHtml: string }): string {
  const { siteUrl, lang, preheader, bodyHtml, footerHtml } = opts;
  const logoUrl = `${siteUrl.replace(/\/+$/, "")}/email-logo.png`;
  return `<!DOCTYPE html>
<html lang="${lang}">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="light" />
    <title>RenoVision</title>
  </head>
  <body style="margin:0;padding:0;background:${emailColors.background};font-family:${emailFontFamily};color:${emailColors.onSurface};">
    <span style="display:none;max-height:0;overflow:hidden;opacity:0;">${preheader}</span>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${emailColors.background};padding:${emailSpacing.xl}px 0;">
      <tr>
        <td align="center">
          <table
            role="presentation"
            width="100%"
            cellpadding="0"
            cellspacing="0"
            style="max-width:480px;background:${emailColors.surface};border:1px solid ${emailColors.outlineVariant};border-radius:${emailRadii.card}px;overflow:hidden;"
          >
            <tr>
              <td style="padding:${emailSpacing.xl}px ${emailSpacing.xxl}px ${emailSpacing.sm}px ${emailSpacing.xxl}px;">
                <img
                  src="${logoUrl}"
                  width="28"
                  height="28"
                  alt="RenoVision"
                  style="display:block;border:0;outline:none;text-decoration:none;vertical-align:middle;"
                />
              </td>
            </tr>
            <tr>
              <td style="padding:${emailSpacing.sm}px ${emailSpacing.xxl}px ${emailSpacing.xl}px ${emailSpacing.xxl}px;font-size:${emailType.body.size}px;line-height:1.5;">${bodyHtml}</td>
            </tr>
            <tr>
              <td
                style="padding:${emailSpacing.md}px ${emailSpacing.xxl}px ${emailSpacing.xl}px ${emailSpacing.xxl}px;border-top:1px solid ${emailColors.outlineVariant};font-size:${emailType.small.size}px;line-height:1.5;color:${emailColors.onSurfaceVariant};"
              >
                ${footerHtml}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

/** A prominent heading (pre-escaped `html`). */
export function Heading(html: string): string {
  return `<p style="margin:0 0 ${emailSpacing.md}px 0;font-size:${emailType.heading.size}px;font-weight:${emailType.heading.weight};color:${emailColors.onSurface};">${html}</p>`;
}

/** A body paragraph (pre-escaped `html`). Preserves line breaks in the source string. */
export function Text(html: string): string {
  return `<p style="margin:0 0 ${emailSpacing.lg}px 0;white-space:pre-line;color:${emailColors.onSurface};">${html}</p>`;
}

/** Smaller, muted text — captions, fallback links, disclaimers (pre-escaped `html`). */
export function Muted(html: string): string {
  return `<p style="margin:0;font-size:${emailType.small.size}px;color:${emailColors.onSurfaceVariant};">${html}</p>`;
}

/** A hairline rule between sections. */
export function Divider(): string {
  return `<hr style="border:none;border-top:1px solid ${emailColors.outlineVariant};margin:${emailSpacing.md}px 0;" />`;
}

/** The primary call-to-action button. `url` and `label` are escaped here (callers pass raw values). */
export function Button(url: string, label: string): string {
  return (
    `<p style="margin:0 0 ${emailSpacing.lg}px 0;">` +
    `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer" ` +
    `style="display:inline-block;background:${emailColors.primary};color:${emailColors.onPrimary};` +
    `text-decoration:none;font-weight:600;font-size:${emailType.body.size}px;line-height:1;padding:12px 22px;border-radius:${emailRadii.button}px;">` +
    `${escapeHtml(label)}</a></p>`
  );
}
