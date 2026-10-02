// Supabase Auth errors → `auth` i18n keys. supabase-js 2.117 puts gotrue's machine-readable
// `error_code` on `AuthError.code`; the human message is English-only, so it's never shown.

export type AuthErrorKey =
  | "auth:errors.invalidCredentials"
  | "auth:errors.emailNotConfirmed"
  | "auth:errors.rateLimited"
  | "auth:errors.weakPassword"
  | "auth:errors.samePassword"
  | "auth:errors.reauthenticationInvalid"
  | "auth:errors.invalidCode"
  | "auth:errors.aal2Required"
  | "auth:errors.linkExpired"
  | "auth:errors.network"
  | "auth:errors.generic";

const BY_CODE: Record<string, AuthErrorKey> = {
  invalid_credentials: "auth:errors.invalidCredentials",
  email_not_confirmed: "auth:errors.emailNotConfirmed",
  over_request_rate_limit: "auth:errors.rateLimited",
  over_email_send_rate_limit: "auth:errors.rateLimited",
  over_sms_send_rate_limit: "auth:errors.rateLimited",
  weak_password: "auth:errors.weakPassword",
  same_password: "auth:errors.samePassword",
  reauthentication_not_valid: "auth:errors.reauthenticationInvalid",
  mfa_verification_failed: "auth:errors.invalidCode",
  mfa_challenge_expired: "auth:errors.invalidCode",
  insufficient_aal: "auth:errors.aal2Required",
  otp_expired: "auth:errors.linkExpired",
  flow_state_expired: "auth:errors.linkExpired",
  flow_state_not_found: "auth:errors.linkExpired",
  bad_code_verifier: "auth:errors.linkExpired",
};

/** gotrue's `error_code` of an AuthError (or anything shaped like one), if it has one. */
export function authErrorCode(error: unknown): string | undefined {
  const code = (error as { code?: unknown } | null | undefined)?.code;
  return typeof code === "string" ? code : undefined;
}

/** The i18n key to show for a failed auth call. */
export function authErrorKey(error: unknown): AuthErrorKey {
  const code = authErrorCode(error);
  if (code && BY_CODE[code]) return BY_CODE[code];
  const { name, status } = (error ?? {}) as { name?: unknown; status?: unknown };
  if (status === 429) return "auth:errors.rateLimited";
  if (name === "AuthRetryableFetchError" || (error instanceof TypeError && /fetch/i.test(error.message))) return "auth:errors.network";
  return "auth:errors.generic";
}

/** True when `updateUser({ password })` needs the emailed reauthentication code first (`secure_password_change`). */
export const needsReauthentication = (error: unknown) => authErrorCode(error) === "reauthentication_needed";

/** True when the call needs an MFA-verified (aal2) session first. */
export const needsAal2 = (error: unknown) => authErrorCode(error) === "insufficient_aal";
