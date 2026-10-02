/** Query keys for the session-derived data this feature caches (sign-in/out clears them all). */
export const authKeys = {
  projectAccess: (projectId: string, userId: string) => ["projectAccess", projectId, userId] as const,
  /** `public.staff_mfa_required()`, per user. */
  staffMfaRequired: (userId: string) => ["staffMfaRequired", userId] as const,
  /** The user's TOTP factors. */
  mfaFactors: (userId: string) => ["mfaFactors", userId] as const,
};
