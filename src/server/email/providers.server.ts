// Email providers for @/server/email/send-email.server. No hardcoded fallback URL/credential
// anywhere — every address comes from env. There is no local mail-catcher integration here: that
// was Mailpit, removed (see git history) in favor of testing Brevo itself via its sandbox mode
// (scripts/email-check.ts, `bun run email:check`). `[local_smtp]` in supabase/config.toml is
// Supabase CLI's own local catcher for *auth* emails and is unrelated to this module.
//
// | When                                   | Provider | How                                                              |
// | --------------------------------------- | -------- | ------------------------------------------------------------------ |
// | `BREVO_API_KEY` set (any environment)    | Brevo    | fetch, `POST https://api.brevo.com/v3/smtp/email`, `api-key` header |
// | Not set, `APP_ENV` production/preview    | (throws) | EMAIL_NOT_CONFIGURED — Brevo is required there                     |
// | Not set, `APP_ENV` development/test      | log      | `logger` (PII-scrubbed), with a one-time `logger.warn`              |
//
// SERVER-ONLY: Brevo's response/network errors are logged here, deliberately never including the
// API key (it's only ever sent as a request header, never put in a logged field).
import "@tanstack/react-start/server-only";
import type { ServerEnv } from "@/lib/env";
import { logger } from "@/lib/logger";
import { ServerFnError } from "../errors";

export type OutgoingEmail = { to: string; from: string; subject: string; html: string; text: string; sensitive?: boolean };

export interface EmailProvider {
  readonly name: "brevo" | "log";
  send(message: OutgoingEmail): Promise<void>;
}

export const BREVO_ENDPOINT = "https://api.brevo.com/v3/smtp/email";

/** `"RenoVision <no-reply@renovision.app>"` → `{ email: "no-reply@renovision.app", name: "RenoVision" }`. */
export function parseFromAddress(from: string): { email: string; name?: string } {
  const match = /^(.*)<(.+)>$/.exec(from.trim());
  if (!match) return { email: from.trim() };
  const name = match[1].trim().replace(/^"|"$/g, "");
  return { email: match[2].trim(), name: name || undefined };
}

/**
 * Brevo's sandbox mode (https://developers.brevo.com/docs/using-sandbox-mode): the request is fully
 * validated (auth, sender, payload) and answered with a normal 2xx + messageId, but nothing is
 * delivered and no log entry is created. It's a field *inside the JSON body's `headers` object*, not
 * an HTTP header — easy to get backwards, so it's centralized here rather than inlined at each call site.
 */
export function brevoRequestBody(message: OutgoingEmail, options: { sandbox?: boolean } = {}): Record<string, unknown> {
  const body: Record<string, unknown> = {
    sender: parseFromAddress(message.from),
    to: [{ email: message.to }],
    subject: message.subject,
    htmlContent: message.html,
    textContent: message.text,
  };
  if (options.sandbox) body.headers = { "X-Sib-Sandbox": "drop" };
  return body;
}

export function createBrevoProvider(apiKey: string, options: { sandbox?: boolean } = {}): EmailProvider {
  return {
    name: "brevo",
    async send(message) {
      let response: Response;
      try {
        response = await fetch(BREVO_ENDPOINT, {
          method: "POST",
          headers: { "content-type": "application/json", accept: "application/json", "api-key": apiKey },
          body: JSON.stringify(brevoRequestBody(message, options)),
        });
      } catch (error) {
        logger.error("brevo email request failed (network error)", { provider: "brevo", err: error });
        throw new ServerFnError("INTERNAL", "Failed to send email", { reason: "email_provider_unreachable" });
      }
      if (!response.ok) {
        const body = await response.text().catch(() => "");
        logger.error("brevo email send failed", { provider: "brevo", status: response.status, body: body.slice(0, 500) });
        throw new ServerFnError("INTERNAL", "Failed to send email", { reason: "email_provider_error" });
      }
    },
  };
}

export function createLogProvider(): EmailProvider {
  return {
    name: "log",
    send(message) {
      logger.info("email (log provider — no email actually sent)", {
        to: message.to,
        from: message.from,
        subject: message.subject,
        // A sensitive email (a confirmation code) is never written to the logs, not even in development.
        ...(message.sensitive ? { text: "[redacted: sensitive content]" } : { text: message.text }),
      });
      return Promise.resolve();
    },
  };
}

let warnedNoProviderConfigured = false;

/** Test hook: forget the "no email provider configured" one-time warning. */
export function resetEmailProviderWarnings() {
  warnedNoProviderConfigured = false;
}

/**
 * Brevo whenever `BREVO_API_KEY` is set (its sandbox header is added when `EMAIL_SANDBOX=true`, see
 * src/lib/env.ts). Otherwise, in `production`/`preview`, Brevo is **required** — throws
 * `ServerFnError("EMAIL_NOT_CONFIGURED", …)` rather than silently falling back to anything. In
 * `development`/`test`, the log provider (warns once per isolate that emails aren't being
 * delivered) — test Brevo itself locally with `bun run email:check` (sandbox mode) instead.
 */
export function resolveEmailProvider(env: Pick<ServerEnv, "brevoApiKey" | "appEnv" | "emailSandbox">): EmailProvider {
  if (env.brevoApiKey) return createBrevoProvider(env.brevoApiKey, { sandbox: env.emailSandbox });

  if (env.appEnv === "production" || env.appEnv === "preview") {
    throw new ServerFnError("EMAIL_NOT_CONFIGURED", `Email is not configured: BREVO_API_KEY is required in ${env.appEnv}.`, {
      reason: "brevo_api_key_missing",
    });
  }

  if (!warnedNoProviderConfigured) {
    warnedNoProviderConfigured = true;
    logger.warn("no BREVO_API_KEY configured; emails are logged, not delivered", { appEnv: env.appEnv });
  }
  return createLogProvider();
}
