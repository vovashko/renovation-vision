#!/usr/bin/env bun
// Regenerates supabase/templates/*.html from the design-system components
// (src/server/email/design/{tokens,components}.ts) and the copy in
// src/server/email/design/auth-copy.ts. Run with `bun run email:build`.
//
// The output keeps Supabase Auth's Go-template placeholders literally in the HTML —
// `{{ .ConfirmationURL }}`, `{{ .Token }}`, `{{ .NewEmail }}`, `{{ .SiteURL }}` and the
// `{{ if eq .Data.locale "en" }} … {{ else }} … {{ end }}` locale branches — for gotrue to fill in
// when it actually sends the email (see README -> Email for the variable reference).
//
// tests/unit/email/auth-templates-freshness.test.ts calls generateAuthTemplate() for every type and
// fails if that doesn't byte-for-byte match the checked-in file, so CI catches a stale template.
// Never hand-edit supabase/templates/*.html after this — change the copy/components and regenerate.
import { writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Button, Heading, Layout, Muted, Text } from "../src/server/email/design/components";
import {
  AUTH_EMAIL_COPY,
  AUTH_EMAIL_FOOTER,
  AUTH_EMAIL_SUBJECT,
  NEW_EMAIL_MARKER,
  type AuthEmailType,
} from "../src/server/email/design/auth-copy";
import { emailColors, emailSpacing, emailType } from "../src/server/email/design/tokens";
import { escapeHtml } from "../src/server/email/html";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const TEMPLATES_DIR = path.join(REPO_ROOT, "supabase", "templates");

/** Wraps two already-built HTML fragments in gotrue's locale conditional. */
function localized(en: string, pl: string): string {
  return `{{ if eq .Data.locale "en" }}${en}{{ else }}${pl}{{ end }}`;
}

export const AUTH_EMAIL_TYPES: AuthEmailType[] = ["confirmation", "invite", "recovery", "magic_link", "email_change", "reauthentication"];

const GOTRUE_LINK_VARIABLE = "{{ .ConfirmationURL }}";

/** The big, centered verification code (reauthentication only) — not a named shared component
 * since no other email needs it, but still built from the same tokens as everything else. */
function CodeBlock(code: string): string {
  return `<p style="margin:0 0 ${emailSpacing.lg}px 0;font-size:28px;font-weight:${emailType.heading.weight};letter-spacing:4px;color:${emailColors.primary};">${code}</p>`;
}

function renderLocaleBody(type: AuthEmailType, locale: "en" | "pl"): string {
  const copy = AUTH_EMAIL_COPY[type][locale];
  let paragraphHtml = escapeHtml(copy.paragraph);
  if (paragraphHtml.includes(NEW_EMAIL_MARKER)) {
    paragraphHtml = paragraphHtml.replace(NEW_EMAIL_MARKER, "<strong>{{ .NewEmail }}</strong>");
  }

  const parts = [Heading(escapeHtml(copy.heading)), Text(paragraphHtml)];

  if (type === "reauthentication") {
    parts.push(CodeBlock("{{ .Token }}"));
  } else {
    parts.push(Button(GOTRUE_LINK_VARIABLE, escapeHtml(copy.cta)));
    if (copy.linkFallback) parts.push(Muted(`${escapeHtml(copy.linkFallback)} ${GOTRUE_LINK_VARIABLE}`));
  }

  if (copy.note) parts.push(Muted(escapeHtml(copy.note)));

  return parts.join("\n");
}

/** The full HTML for one auth email template, with Go-template placeholders intact. */
export function generateAuthTemplate(type: AuthEmailType): string {
  const bodyHtml = localized(renderLocaleBody(type, "en"), renderLocaleBody(type, "pl"));
  const preheader = localized(escapeHtml(AUTH_EMAIL_COPY[type].en.heading), escapeHtml(AUTH_EMAIL_COPY[type].pl.heading));
  const footerHtml = localized(escapeHtml(AUTH_EMAIL_FOOTER.en), escapeHtml(AUTH_EMAIL_FOOTER.pl));
  const lang = localized("en", "pl");

  return Layout({ siteUrl: "{{ .SiteURL }}", lang, preheader, bodyHtml, footerHtml });
}

/** The subject line for one type, as it belongs in config.toml's `subject = "…"` (unescaped — TOML
 * does its own quoting; the caller is responsible for escaping `"` when writing it into the file). */
export function generateAuthSubject(type: AuthEmailType): string {
  const { en, pl } = AUTH_EMAIL_SUBJECT[type];
  return localized(en, pl);
}

function main() {
  for (const type of AUTH_EMAIL_TYPES) {
    const html = generateAuthTemplate(type);
    const filePath = path.join(TEMPLATES_DIR, `${type}.html`);
    writeFileSync(filePath, html, "utf8");
    console.log(`wrote ${path.relative(REPO_ROOT, filePath)}`);
  }
  console.log("\nDone. Subjects (already in supabase/config.toml, shown here for reference):");
  for (const type of AUTH_EMAIL_TYPES) console.log(`  ${type}: ${generateAuthSubject(type)}`);
}

// Only run when executed directly (`bun run email:build`), not when imported by the freshness test.
// Checked via process.argv rather than a Bun-specific global, so this works the same under plain
// Node and doesn't need `Bun` typed for tsc (the freshness test imports this module too).
const isMain = process.argv[1] !== undefined && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) main();
