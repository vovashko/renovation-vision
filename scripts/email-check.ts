#!/usr/bin/env bun
// Tests Brevo itself (not a local mail-catcher stand-in): sends every app template, in both
// locales, through Brevo's real API with sandbox mode forced on — the request is fully validated
// (auth, sender, payload) and answered with a normal 2xx + messageId, but nothing is delivered and
// no log entry is created in Brevo (see developers.brevo.com/docs/using-sandbox-mode). Run with:
//
//   bun run email:check
//
// No hardcoded fallbacks: requires BREVO_API_KEY and EMAIL_FROM from the environment, resolved (in
// order) from real env vars, then .dev.vars, then .env.local (both gitignored). Missing ones print a
// clear list; present ones print a sanitized form (key prefix + length), never a full secret.
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { LOCALES, type Locale } from "../src/i18n/locale";
import { brevoRequestBody, BREVO_ENDPOINT } from "../src/server/email/providers.server";
import { renderEmail, type EmailTemplateName } from "../src/server/email/templates";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** A minimal `KEY=VALUE` dotenv parser (no quoting/escaping support — matches this repo's own files). */
function parseDotEnv(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    out[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
  }
  return out;
}

function loadDotEnvFile(filename: string): Record<string, string> {
  try {
    return parseDotEnv(readFileSync(path.join(REPO_ROOT, filename), "utf8"));
  } catch {
    return {};
  }
}

const fileEnv = { ...loadDotEnvFile(".env.local"), ...loadDotEnvFile(".dev.vars") };
function resolve(name: string): string | undefined {
  return process.env[name] || fileEnv[name] || undefined;
}

const REQUIRED = {
  BREVO_API_KEY: resolve("BREVO_API_KEY"),
  EMAIL_FROM: resolve("EMAIL_FROM"),
};

function sanitizeKey(value: string): string {
  return `${value.slice(0, 7)}… (${value.length} chars)`;
}

const missing = Object.entries(REQUIRED).filter(([, value]) => !value);
if (missing.length > 0) {
  console.error("Missing required environment variables (set them, or fill .dev.vars/.env.local):\n");
  for (const [name] of missing) console.error(`  - ${name}`);
  const present = Object.entries(REQUIRED).filter(([, value]) => value);
  if (present.length > 0) {
    console.error("\nPresent (sanitized):");
    for (const [name, value] of present) console.error(`  ${name}: ${sanitizeKey(value!)}`);
  }
  process.exit(1);
}

const BREVO_API_KEY = REQUIRED.BREVO_API_KEY!;
const EMAIL_FROM = REQUIRED.EMAIL_FROM!;

// An RFC 2606 reserved address/domain: guaranteed never to be a real mailbox, and fine to use even
// outside sandbox mode (though sandbox is always forced below regardless).
const TEST_RECIPIENT = "test@example.com";
const SITE_URL = "https://app.renovision.app";

const TEMPLATE_PARAMS: Record<EmailTemplateName, unknown> = {
  notification: {
    siteUrl: SITE_URL,
    title: "RenoVision email:check",
    body: "This is a sandbox-mode test send from `bun run email:check`. Nothing was delivered.",
    linkUrl: `${SITE_URL}/projects`,
  },
  digest: {
    siteUrl: SITE_URL,
    items: [{ title: "Sandbox test item", body: "From bun run email:check." }],
    linkUrl: `${SITE_URL}/projects`,
  },
};

type CheckResult = { template: EmailTemplateName; locale: Locale; ok: boolean; detail: string };

async function checkOne(template: EmailTemplateName, locale: Locale): Promise<CheckResult> {
  const content = renderEmail(template, TEMPLATE_PARAMS[template] as never, locale);
  const body = brevoRequestBody(
    { to: TEST_RECIPIENT, from: EMAIL_FROM, subject: content.subject, html: content.html, text: content.text },
    { sandbox: true }, // always forced, regardless of EMAIL_SANDBOX — this script never sends for real
  );

  let response: Response;
  try {
    response = await fetch(BREVO_ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json", "api-key": BREVO_API_KEY },
      body: JSON.stringify(body),
    });
  } catch (error) {
    return { template, locale, ok: false, detail: `network error: ${error instanceof Error ? error.message : String(error)}` };
  }

  const responseText = await response.text();
  if (!response.ok) return { template, locale, ok: false, detail: `HTTP ${response.status}: ${responseText.slice(0, 300)}` };

  let parsed: { messageId?: unknown };
  try {
    parsed = JSON.parse(responseText) as { messageId?: unknown };
  } catch {
    return { template, locale, ok: false, detail: `response wasn't JSON: ${responseText.slice(0, 300)}` };
  }
  if (typeof parsed.messageId !== "string" || !parsed.messageId) {
    return { template, locale, ok: false, detail: `no messageId in response: ${responseText.slice(0, 300)}` };
  }
  return { template, locale, ok: true, detail: `messageId ${parsed.messageId}` };
}

async function main() {
  console.log(`Testing Brevo with sandbox mode forced on, sender ${sanitizeKey(EMAIL_FROM)}, recipient ${TEST_RECIPIENT}.\n`);

  const templates = Object.keys(TEMPLATE_PARAMS) as EmailTemplateName[];
  const results: CheckResult[] = [];
  for (const template of templates) {
    for (const locale of LOCALES) {
      results.push(await checkOne(template, locale));
    }
  }

  const nameWidth = Math.max(...results.map((r) => `${r.template} (${r.locale})`.length));
  for (const r of results) {
    const label = `${r.template} (${r.locale})`.padEnd(nameWidth);
    console.log(`${r.ok ? "PASS" : "FAIL"}  ${label}  ${r.detail}`);
  }

  const failures = results.filter((r) => !r.ok);
  if (failures.length > 0) {
    console.error(`\n${failures.length} of ${results.length} checks failed.`);
    process.exit(1);
  }
  console.log(`\nAll ${results.length} checks passed.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
