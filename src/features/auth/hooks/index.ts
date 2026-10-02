// The auth feature's hooks entry point: routes, the settings feature and src/lib/auth import from
// here (README → Architecture: cross-feature imports go through hooks/domain, never data/).
export { authKeys } from "./keys";
export { projectAccessQuery, ensureProjectAccess, useProjectRole, useCurrentProjectRole } from "./project-access";
export {
  staffMfaRequiredQuery,
  mfaFactorsQuery,
  resolveStaffMfaStep,
  signedInTarget,
  hasVerifiedTotp,
  useMfaFactors,
  useStaffMfaRequired,
  useVerifyTotp,
  useUnenrollFactor,
  useTotpEnrollment,
  isStaffAccount,
  mfaHref,
  type MfaFactor,
  type MfaStep,
  type TotpEnrollment,
  type EnrollmentState,
  type GuardSession,
} from "./mfa";
export {
  useSignIn,
  useSendMagicLink,
  useRequestPasswordReset,
  useUpdatePassword,
  useReauthenticate,
  useCooldown,
  useEmailLinkSignIn,
  useRecoverySession,
  type RecoveryState,
} from "./sign-in";

/** Mirrors the UI locale onto `user_metadata.locale` (see ../data/locale.repo for why). */
export { updateUserLocale } from "../data/locale.repo";
