// TOTP two-factor authentication (supabase.auth.mfa.*) and the staff-2FA setting.
//
// Runs in the browser and, for the route guards' reads (listFactors, isStaffMfaRequired), during
// SSR too: there `@/lib/supabase` is the request's cookie client, so listFactors asks the Auth
// server (getUser) as that user rather than trusting the cookie's copy of the user.
import { supabase } from "@/lib/supabase";

export type MfaFactor = {
  id: string;
  friendlyName: string | null;
  status: "verified" | "unverified";
  createdAt: string;
};

export type TotpEnrollment = {
  factorId: string;
  /** An `data:image/svg+xml` URI (CSP `img-src` allows `data:`). */
  qrCode: string;
  /** The base32 secret, for typing into an authenticator app by hand. */
  secret: string;
};

/** The issuer authenticator apps show next to the account. A product name, not UI copy. */
const TOTP_ISSUER = "RenoVision";

export const mfaRepo = {
  /** The user's TOTP factors, verified or not, oldest first. */
  async listFactors(): Promise<MfaFactor[]> {
    const { data, error } = await supabase.auth.mfa.listFactors();
    if (error) throw error;
    return data.all
      .filter((factor) => factor.factor_type === "totp")
      .map((factor) => ({
        id: factor.id,
        friendlyName: factor.friendly_name ?? null,
        status: factor.status === "verified" ? ("verified" as const) : ("unverified" as const),
        createdAt: factor.created_at,
      }))
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  },

  /** `public.staff_mfa_required()`: whether staff need an aal2 session right now. */
  async isStaffMfaRequired(): Promise<boolean> {
    const { data, error } = await supabase.rpc("staff_mfa_required");
    if (error) throw error;
    return data === true;
  },

  /**
   * Unenrolls every unverified TOTP factor: enrollments someone started and abandoned (closed the
   * tab before entering the first code). They'd otherwise pile up, and gotrue refuses a new factor
   * with the same friendly name. Best effort per factor (one that's already gone is fine). Returns
   * how many it removed.
   */
  async removeUnverifiedFactors(): Promise<number> {
    const stale = (await mfaRepo.listFactors()).filter((factor) => factor.status === "unverified");
    let removed = 0;
    for (const factor of stale) {
      const { error } = await supabase.auth.mfa.unenroll({ factorId: factor.id });
      if (!error) removed += 1;
    }
    return removed;
  },

  /** Cleans up abandoned enrollments, then starts a new TOTP enrollment (verify it with `verify`). */
  async enrollTotp(friendlyName: string): Promise<TotpEnrollment> {
    await mfaRepo.removeUnverifiedFactors();
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName, issuer: TOTP_ISSUER });
    if (error) throw error;
    return { factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret };
  },

  /**
   * Challenges the factor and verifies the 6-digit code. On success the session becomes aal2 (and an
   * unverified factor becomes verified); supabase-js emits MFA_CHALLENGE_VERIFIED, which AuthSync
   * turns into a fresh router context.
   */
  async verify(factorId: string, code: string): Promise<void> {
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code });
    if (error) throw error;
  },

  /**
   * The browser session's assurance level now (`currentLevel`) and what it could reach
   * (`nextLevel`: "aal2" when the user has a verified factor). Local: no network call.
   */
  async assurance(): Promise<{ currentLevel: string | null; nextLevel: string | null }> {
    const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (error) throw error;
    return { currentLevel: data.currentLevel, nextLevel: data.nextLevel };
  },

  /** Removes a factor. gotrue needs an aal2 session to remove a verified one. */
  async unenroll(factorId: string): Promise<void> {
    const { error } = await supabase.auth.mfa.unenroll({ factorId });
    if (error) throw error;
  },
};
