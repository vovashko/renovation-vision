# Auth (`features/auth`)

Sign-in (password and magic link), password reset, TOTP two-factor authentication and the route guards' decisions.
The session plumbing lives in `src/lib/auth.tsx` (router context, `useAuth`, `useSessionRefresh`, `AuthSync`) and
`src/server/functions/session.ts` (`getSession`, `getProjectAccess`). See README → Sessions & route guards and
README → Auth screens & 2FA.

- **Routes:** `/login`, `/forgot-password`, `/reset-password` (public); `/mfa`, `/mfa/enroll` (signed in, outside
  `_authed`); the guards in `src/routes/_authed.tsx` (incl. the staff 2FA redirect) and `src/routes/project/layout.tsx`
- **domain/:** `guards.ts` (`projectGuard`, `safeRedirectTarget`, `projectSection`), `mfa-guard.ts` (`staffMfaStep`,
  `signInStep`, `mfaHref`), `schemas.ts` (email, new password, 6-digit code), `auth-errors.ts` (gotrue `error_code` →
  i18n key), `auth-link.ts` (what an emailed link left in the URL)
- **data/:** `auth.repo.ts` (sign-in, magic link, reset, verifyOtp, password, reauthenticate), `mfa.repo.ts`
  (factors, enroll with stale-factor cleanup, verify, unenroll, `staff_mfa_required()`), `locale.repo.ts`
- **hooks/:** `project-access.ts`, `mfa.ts` (guard resolvers + 2FA hooks), `sign-in.ts` (sign-in/reset/password hooks,
  `useCooldown`, `useEmailLinkSignIn`, `useRecoverySession`); `index.ts` is the barrel other code imports
- **ui/:** `LoginScreen`, `ForgotPasswordScreen`, `ResetPasswordScreen`, `MfaChallengeScreen`, `MfaEnrollScreen`, and
  the pieces Settings → Security reuses (`CodeInput`, `NewPasswordFields`, `AuthErrorNote`/`AuthSuccessNote`)
- **i18n namespace:** `auth` (`useTranslation(["auth", "common"])`)

Layers (README → Architecture): `domain/` pure rules (optional, shared ones live in `src/domain`) · `data/`
the repository, the only code that imports supabase-js · `hooks/` TanStack Query hooks, keys and mutations ·
`ui/` small named components composing `src/components/ui` · `i18n/{en,pl}.json` the `auth` namespace.
