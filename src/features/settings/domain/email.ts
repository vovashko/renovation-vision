// Changing the login email (T70): the form's schema and what a confirmation link left in the URL. No Supabase, no React.
//
// Supabase's secure email change (`double_confirm_changes`) emails a link to both the current and the new address;
// the email changes once both are opened. Each link goes through gotrue's /verify and lands back on
// /settings/security: the first one with `?message=…` (one side confirmed), the second with a PKCE `?code=` that the
// browser client exchanges on load, a failed one with `error_code`.
import { z } from "zod";
import { emailSchema } from "@/features/auth/domain/schemas";
import { readAuthLink } from "@/features/auth/domain/auth-link";
import { authErrorCode, authErrorKey, type AuthErrorKey } from "@/features/auth/domain/auth-errors";

/** Where the confirmation links land (it must be on Supabase Auth's redirect allow-list). */
export const EMAIL_CHANGE_PATH = "/settings/security";

/** The new address: a valid email, other than the current one. */
export function changeEmailSchema(currentEmail: string | null | undefined) {
  const current = currentEmail?.trim().toLowerCase() ?? "";
  return z.object({
    email: emailSchema.transform((v) => v.toLowerCase()).refine((v) => v !== current, { message: "settings:email.same" }),
  });
}

export type EmailChangeErrorKey = "settings:email.inUse" | "common:form.invalidEmail" | AuthErrorKey;

/** gotrue's answer to an email change, translated (never its English message). */
export function emailChangeErrorKey(error: unknown): EmailChangeErrorKey {
  switch (authErrorCode(error)) {
    case "email_exists":
      return "settings:email.inUse";
    case "email_address_invalid":
      return "common:form.invalidEmail";
    default:
      return authErrorKey(error);
  }
}

export type EmailChangeLanding = "partial" | "failed" | null;

/** What a confirmation link reported on landing: one side confirmed, the link failed, or nothing to say. */
export function emailChangeLanding(href: string): EmailChangeLanding {
  const link = readAuthLink(href);
  if (link.error) return "failed";
  let url: URL;
  try {
    url = new URL(href, "http://placeholder.invalid");
  } catch {
    return null;
  }
  const hash = new URLSearchParams(url.hash.replace(/^#/, ""));
  return url.searchParams.has("message") || hash.has("message") ? "partial" : null;
}

/** The URL without what the confirmation link added for us (`message`, `error*`); a `code` is left to the client. */
export function withoutLandingParams(href: string): string {
  const url = new URL(href);
  for (const key of ["message", "error", "error_code", "error_description"]) url.searchParams.delete(key);
  const hash = new URLSearchParams(url.hash.replace(/^#/, ""));
  for (const key of ["message", "error", "error_code", "error_description"]) hash.delete(key);
  url.hash = hash.toString();
  return url.toString();
}
