// Where 2FA sends someone, as pure decisions (the routes' beforeLoad hooks turn them into redirects).
//
// Staff (`manager`/`admin` account types) need an MFA-verified (aal2) session while
// `public.staff_mfa_required()` is true: the restrictive RLS policies hide internal data from an
// aal1 staff session anyway (README → Roles & 2FA enforcement), so the UI sends them to the 2FA
// screen instead of showing half-empty pages. Clients are never forced.
//
// These decide navigation only: RLS is the enforcement. So when the setting can't be read the UI
// fails OPEN (lets them through and logs a warning) rather than locking everyone out.

/** The session's authenticator assurance level (the JWT `aal` claim). */
export type Aal = "aal1" | "aal2";

export type MfaStep = "pass" | "challenge" | "enroll";

const STAFF = ["manager", "admin"];

/** `manager` and `admin` accounts (`private.is_staff()` in SQL). */
export const isStaffAccount = (accountType: string | null | undefined) => !!accountType && STAFF.includes(accountType);

export type StaffMfaInput = {
  accountType: string | null | undefined;
  aal: Aal;
  /** `public.staff_mfa_required()`; only asked for aal1 staff. */
  isRequired: () => Promise<boolean>;
  /** Whether the user has a verified TOTP factor; only asked when 2FA is required. */
  hasVerifiedFactor: () => Promise<boolean>;
  /** Called when `isRequired` fails (the guard then fails open). */
  onRequiredError: (error: unknown) => void;
};

/**
 * The `_authed` layout's 2FA decision:
 * - client, or any aal2 session → "pass";
 * - aal1 staff while enforcement is off → "pass";
 * - aal1 staff while enforcement is on → "challenge" with a verified factor, else "enroll";
 * - the setting can't be read → "pass" (fail open; `onRequiredError` logs it).
 * A factor list that can't be read counts as "challenge": the /mfa screen re-reads the factors
 * itself and sends someone without one on to enrollment.
 */
export async function staffMfaStep(input: StaffMfaInput): Promise<MfaStep> {
  if (!isStaffAccount(input.accountType) || input.aal === "aal2") return "pass";
  let required: boolean;
  try {
    required = await input.isRequired();
  } catch (error) {
    input.onRequiredError(error);
    return "pass";
  }
  if (!required) return "pass";
  try {
    return (await input.hasVerifiedFactor()) ? "challenge" : "enroll";
  } catch {
    return "challenge";
  }
}

/**
 * After signing in (and on /login for someone already signed in): an aal1 session with a verified
 * factor goes through the /mfa challenge first, whatever the account type. Optional 2FA still has
 * to be used once it's set up; nobody is *forced* to set it up except staff (staffMfaStep).
 */
export function signInStep(aal: Aal, hasVerifiedFactor: boolean): "challenge" | "pass" {
  return aal === "aal1" && hasVerifiedFactor ? "challenge" : "pass";
}

/** `/mfa?redirect=<target>` (or `/mfa/enroll?…`), keeping where the user was going. */
export function mfaHref(step: "challenge" | "enroll", target: string): string {
  const path = step === "challenge" ? "/mfa" : "/mfa/enroll";
  return target && target !== "/" ? `${path}?redirect=${encodeURIComponent(target)}` : path;
}
