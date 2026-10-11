#!/usr/bin/env bun
// Patches a hosted Supabase project's auth config through the Management API
// (`PATCH https://api.supabase.com/v1/projects/{ref}/config/auth`) with exactly the settings the
// hosted email setup needs: the six auth email templates + subjects, site_url + the redirect
// allow-list for one environment's origin, and the Brevo SMTP settings. Run with:
//
//   bun run auth:push -- --env <preview|production> [--dry-run]
//
// Deliberately NOT `supabase config push`: that command pushes the *entire* local
// supabase/config.toml, including `site_url = "http://localhost:5173"` and every other local-only
// setting, to the hosted project. This script sends only the allow-listed fields below.
//
// Field names confirmed against the live Management API OpenAPI document
// (https://api.supabase.com/api/v1-json, schema `UpdateAuthConfigBody`) on 2026-10-11:
// `site_url`, `uri_allow_list` (comma-separated string, not an array), `smtp_host`, `smtp_port`
// (a STRING field, not a number, per the spec), `smtp_user`, `smtp_pass`, `smtp_sender_name`,
// `smtp_admin_email`, `mailer_subjects_<type>`, `mailer_templates_<type>_content`. These are read
// from the spec directly, not guessed — see the PR description for how they were checked.
//
// No hardcoded fallbacks: every input is a required environment variable (see ENV_VAR_DOC below).
// A missing one fails loudly and lists only the missing *names* — never a secret value, and at most
// a key's prefix + length for a present one. `--dry-run` prints the payload it would send, with
// smtp_pass/smtp_user masked the same way.
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseFromAddress } from "../src/server/email/providers.server";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CONFIG_TOML_PATH = path.join(REPO_ROOT, "supabase", "config.toml");
const TEMPLATES_DIR = path.join(REPO_ROOT, "supabase", "templates");

export const TEMPLATE_TYPES = ["confirmation", "invite", "recovery", "magic_link", "email_change", "reauthentication"] as const;
export type TemplateType = (typeof TEMPLATE_TYPES)[number];

export const ENVS = ["preview", "production"] as const;
export type PushEnv = (typeof ENVS)[number];

/** Env vars read regardless of --env (shared across environments: one Brevo account, one Management API token). */
const SHARED_VAR_NAMES = ["SUPABASE_ACCESS_TOKEN", "BREVO_SMTP_LOGIN", "BREVO_SMTP_KEY", "EMAIL_FROM"] as const;

/** Env vars that differ per --env (each environment has its own hosted Supabase project and origin). */
function projectRefVar(env: PushEnv): string {
  return `SUPABASE_PROJECT_REF_${env.toUpperCase()}`;
}
function originVar(env: PushEnv): string {
  return `APP_ORIGIN_${env.toUpperCase()}`;
}

/** Names that are secrets or credentials — sanitized to a prefix + length in every printed message. */
const SECRET_VAR_NAMES = new Set<string>(["SUPABASE_ACCESS_TOKEN", "BREVO_SMTP_LOGIN", "BREVO_SMTP_KEY"]);

export const ENV_VAR_DOC = [
  "SUPABASE_ACCESS_TOKEN  — a Supabase personal/org access token (Management API bearer), shared across environments",
  "SUPABASE_PROJECT_REF_<ENV>  — the hosted project's ref for that environment (e.g. SUPABASE_PROJECT_REF_PREVIEW)",
  "APP_ORIGIN_<ENV>  — that environment's deployed origin, no trailing slash (e.g. https://renovision-preview.<account>.workers.dev)",
  "BREVO_SMTP_LOGIN  — Brevo -> SMTP & API -> SMTP -> login",
  "BREVO_SMTP_KEY  — Brevo -> SMTP & API -> SMTP -> an SMTP key (not the transactional API key)",
  'EMAIL_FROM  — the verified sender, e.g. "RenoVision <no-reply@renovision.app>"',
].join("\n  ");

export function sanitizeEnvValue(name: string, value: string): string {
  if (!SECRET_VAR_NAMES.has(name)) return value;
  return `${value.slice(0, 4)}… (${value.length} chars)`;
}

export type ResolvedVars = {
  supabaseAccessToken: string;
  projectRef: string;
  origin: string;
  brevoSmtpLogin: string;
  brevoSmtpKey: string;
  emailFrom: string;
};

export type ResolveResult = { ok: true; vars: ResolvedVars } | { ok: false; message: string };

/** Pure: resolves and validates the env vars for one --env from a given source object (real env in prod, a fake map in tests). */
export function resolveVars(env: PushEnv, source: Record<string, string | undefined>): ResolveResult {
  const names = [...SHARED_VAR_NAMES, projectRefVar(env), originVar(env)];
  const missing: string[] = [];
  const present: Record<string, string> = {};
  for (const name of names) {
    const value = source[name];
    if (value === undefined || value.trim() === "") missing.push(name);
    else present[name] = value.trim();
  }
  if (missing.length > 0) {
    const sanitizedPresent = Object.entries(present)
      .map(([name, value]) => `${name}: ${sanitizeEnvValue(name, value)}`)
      .join("\n  ");
    return {
      ok: false,
      message:
        `Missing required environment variable(s) for --env ${env}: ${missing.join(", ")}.\n\n` +
        `Required variables:\n  ${ENV_VAR_DOC}\n\n` +
        (sanitizedPresent ? `Already set (sanitized):\n  ${sanitizedPresent}\n\n` : "") +
        `See README -> Email -> Hosted setup checklist.`,
    };
  }
  const originRaw = present[originVar(env)];
  if (!/^https?:\/\/[^/\s]+$/.test(originRaw)) {
    return {
      ok: false,
      message: `${originVar(env)} must be an origin with no path and no trailing slash (e.g. https://app.renovision.app), got "${originRaw}".`,
    };
  }
  return {
    ok: true,
    vars: {
      supabaseAccessToken: present.SUPABASE_ACCESS_TOKEN,
      projectRef: present[projectRefVar(env)],
      origin: originRaw,
      brevoSmtpLogin: present.BREVO_SMTP_LOGIN,
      brevoSmtpKey: present.BREVO_SMTP_KEY,
      emailFrom: present.EMAIL_FROM,
    },
  };
}

export function readConfigToml(): string {
  return readFileSync(CONFIG_TOML_PATH, "utf8");
}

/** The `subject = "…"` value configured for one template type in config.toml, TOML-unescaped. Throws if missing. */
export function extractSubject(configToml: string, type: TemplateType): string {
  const re = new RegExp(`\\[auth\\.email\\.template\\.${type}\\][^[]*?subject\\s*=\\s*"((?:[^"\\\\]|\\\\.)*)"`);
  const match = re.exec(configToml);
  if (!match) throw new Error(`supabase/config.toml has no subject for [auth.email.template.${type}]`);
  return match[1].replace(/\\"/g, '"').replace(/\\\\/g, "\\");
}

/** The template file's content, byte for byte (no trimming, no transformation). */
export function readTemplateContent(type: TemplateType): string {
  return readFileSync(path.join(TEMPLATES_DIR, `${type}.html`), "utf8");
}

export type AuthConfigPayload = Record<string, string>;

/** The exact, allow-listed set of keys this script is permitted to send. Nothing else may appear in the payload. */
export const ALLOWED_PAYLOAD_KEYS: readonly string[] = [
  "site_url",
  "uri_allow_list",
  "smtp_host",
  "smtp_port",
  "smtp_user",
  "smtp_pass",
  "smtp_sender_name",
  "smtp_admin_email",
  ...TEMPLATE_TYPES.map((t) => `mailer_subjects_${t}`),
  ...TEMPLATE_TYPES.map((t) => `mailer_templates_${t}_content`),
];

const BREVO_SMTP_HOST = "smtp-relay.brevo.com";
const BREVO_SMTP_PORT = "587"; // smtp_port is documented as a string field in the Management API schema.

/** Pure: builds the PATCH body from the resolved vars, config.toml and the template files' contents. */
export function buildPayload(vars: ResolvedVars, configToml: string, templates: Record<TemplateType, string>): AuthConfigPayload {
  const { name: senderName, email: senderEmail } = parseFromAddress(vars.emailFrom);
  const payload: AuthConfigPayload = {
    site_url: vars.origin,
    uri_allow_list: `${vars.origin}/**`,
    smtp_host: BREVO_SMTP_HOST,
    smtp_port: BREVO_SMTP_PORT,
    smtp_user: vars.brevoSmtpLogin,
    smtp_pass: vars.brevoSmtpKey,
    smtp_sender_name: senderName ?? senderEmail,
    smtp_admin_email: senderEmail,
  };
  for (const type of TEMPLATE_TYPES) {
    payload[`mailer_subjects_${type}`] = extractSubject(configToml, type);
    payload[`mailer_templates_${type}_content`] = templates[type];
  }
  return payload;
}

/** A copy of the payload with secret-ish values masked, for --dry-run and for logging. */
export function maskPayload(payload: AuthConfigPayload): AuthConfigPayload {
  const masked = { ...payload };
  for (const key of ["smtp_pass", "smtp_user"] as const) {
    if (masked[key]) masked[key] = sanitizeEnvValue("BREVO_SMTP_KEY", masked[key]);
  }
  return masked;
}

function managementApiUrl(projectRef: string): string {
  return `https://api.supabase.com/v1/projects/${projectRef}/config/auth`;
}

function parseArgs(argv: string[]): { env: PushEnv; dryRun: boolean } {
  let env: string | undefined;
  let dryRun = false;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--env") env = argv[++i];
    else if (arg.startsWith("--env=")) env = arg.slice("--env=".length);
    else if (arg === "--dry-run") dryRun = true;
  }
  if (!env || !(ENVS as readonly string[]).includes(env)) {
    console.error(`Usage: bun run auth:push -- --env <${ENVS.join("|")}> [--dry-run]`);
    process.exit(1);
  }
  return { env: env as PushEnv, dryRun };
}

async function main() {
  const { env, dryRun } = parseArgs(process.argv.slice(2));

  const resolved = resolveVars(env, process.env);
  if (!resolved.ok) {
    console.error(resolved.message);
    process.exit(1);
  }

  const configToml = readConfigToml();
  const templates = Object.fromEntries(TEMPLATE_TYPES.map((t) => [t, readTemplateContent(t)])) as Record<TemplateType, string>;
  const payload = buildPayload(resolved.vars, configToml, templates);

  if (dryRun) {
    console.log(`Dry run: PATCH ${managementApiUrl(resolved.vars.projectRef)}`);
    console.log(JSON.stringify(maskPayload(payload), null, 2));
    return;
  }

  console.log(`Pushing auth config to ${env} (project ${resolved.vars.projectRef})…`);
  let response: Response;
  try {
    response = await fetch(managementApiUrl(resolved.vars.projectRef), {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${resolved.vars.supabaseAccessToken}`,
      },
      body: JSON.stringify(payload),
    });
  } catch (error) {
    console.error(`Network error calling the Management API: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }

  const text = await response.text();
  if (!response.ok) {
    console.error(`Management API returned HTTP ${response.status}: ${text.slice(0, 500)}`);
    process.exit(1);
  }
  console.log(`Done. ${env} auth config updated (${Object.keys(payload).length} fields).`);
}

// Only run when executed directly (`bun run auth:push`), not when imported by tests.
const isMain = process.argv[1] !== undefined && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
