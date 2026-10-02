// Settings → Security's rule for removing an authenticator app (a TOTP factor).

/** What a factor row's "Remove" button may do. */
export type RemoveRule = "allowed" | "verify-first" | "locked";

/**
 * - an unverified factor (an abandoned setup) can always go;
 * - staff can't remove their last verified factor while 2FA is enforced for staff → "locked";
 * - otherwise a verified one needs an aal2 session (gotrue's rule) → "verify-first" from aal1.
 */
export function removeRule(
  factor: { status: "verified" | "unverified" },
  opts: { aal: "aal1" | "aal2" | null; verifiedCount: number; enforcedForMe: boolean },
): RemoveRule {
  if (factor.status !== "verified") return "allowed";
  if (opts.enforcedForMe && opts.verifiedCount <= 1) return "locked";
  return opts.aal === "aal2" ? "allowed" : "verify-first";
}
