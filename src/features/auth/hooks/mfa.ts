// 2FA (TOTP): the route guards' resolvers (called from beforeLoad, on the server during SSR and in
// the browser on navigation) and the hooks behind /mfa, /mfa/enroll and Settings → Security.
import { queryOptions, useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { mfaRepo, type TotpEnrollment } from "../data/mfa.repo";
import { safeRedirectTarget } from "../domain/guards";
import { mfaHref, signInStep, staffMfaStep, type Aal, type MfaStep } from "../domain/mfa-guard";
import { authKeys } from "./keys";

export type { MfaFactor, TotpEnrollment } from "../data/mfa.repo";
export type { MfaStep } from "../domain/mfa-guard";
export { isStaffAccount, mfaHref } from "../domain/mfa-guard";

const FIVE_MINUTES = 5 * 60_000;

/**
 * `public.staff_mfa_required()`, cached per user: in the request's query client during SSR (and
 * dehydrated to the browser with the page), then for 5 minutes in the browser. A failed call is
 * cached as `null` ("unknown") so a broken RPC doesn't cost a round trip on every navigation.
 */
export const staffMfaRequiredQuery = (userId: string) =>
  queryOptions({
    queryKey: authKeys.staffMfaRequired(userId),
    queryFn: async (): Promise<boolean | null> => {
      try {
        return await mfaRepo.isStaffMfaRequired();
      } catch (error) {
        return failed(error);
      }
    },
    staleTime: FIVE_MINUTES,
    retry: false,
  });

/** Remembers why the last read failed, for the warning the guard logs. */
let lastRequiredError: unknown;
function failed(error: unknown): null {
  lastRequiredError = error;
  return null;
}

/** The user's TOTP factors (verified and not). */
export const mfaFactorsQuery = (userId: string) =>
  queryOptions({
    queryKey: authKeys.mfaFactors(userId),
    queryFn: () => mfaRepo.listFactors(),
    staleTime: FIVE_MINUTES,
    retry: false,
  });

async function hasVerifiedFactor(queryClient: QueryClient, userId: string): Promise<boolean> {
  const factors = await queryClient.ensureQueryData(mfaFactorsQuery(userId));
  return factors.some((factor) => factor.status === "verified");
}

/** The slice of the router context's session the guards need. */
export type GuardSession = { user: { id: string; aal: Aal }; profile: { account_type: string } | null };

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * The `_authed` layout's 2FA decision for a signed-in user (see ../domain/mfa-guard): "challenge"
 * → /mfa, "enroll" → /mfa/enroll, "pass" → the page. Fails open, with a warning, when
 * `staff_mfa_required()` can't be read.
 */
export function resolveStaffMfaStep(queryClient: QueryClient, auth: GuardSession): Promise<MfaStep> {
  return staffMfaStep({
    accountType: auth.profile?.account_type,
    aal: auth.user.aal,
    isRequired: async () => {
      const required = await queryClient.ensureQueryData(staffMfaRequiredQuery(auth.user.id));
      if (required === null) throw lastRequiredError ?? new Error("staff_mfa_required() is unavailable");
      return required;
    },
    hasVerifiedFactor: () => hasVerifiedFactor(queryClient, auth.user.id),
    onRequiredError: (error) =>
      logger.warn("staff_mfa_required() failed; not redirecting to 2FA (RLS still enforces it)", { err: errorMessage(error) }),
  });
}

/**
 * Where a signed-in user on /login goes: the safe `redirect` target, through the /mfa challenge
 * first when the session is aal1 and they have a verified factor. If the factors can't be read it
 * skips the challenge (the staff guard and RLS still apply).
 */
export async function signedInTarget(queryClient: QueryClient, user: GuardSession["user"], redirect: unknown): Promise<string> {
  const target = safeRedirectTarget(redirect);
  if (user.aal === "aal2") return target;
  let factor = false;
  try {
    factor = await hasVerifiedFactor(queryClient, user.id);
  } catch (error) {
    logger.warn("listing MFA factors failed; skipping the 2FA challenge after sign-in", { err: errorMessage(error) });
  }
  return signInStep(user.aal, factor) === "challenge" ? mfaHref("challenge", target) : target;
}

/** For the /mfa routes' beforeLoad: whether the user has a verified factor (false when unknown). */
export async function hasVerifiedTotp(queryClient: QueryClient, userId: string): Promise<boolean> {
  try {
    return await hasVerifiedFactor(queryClient, userId);
  } catch {
    return false;
  }
}

/** The signed-in user's TOTP factors (Settings → Security, /mfa). */
export function useMfaFactors() {
  const { userId } = useAuth();
  return useQuery({ ...mfaFactorsQuery(userId ?? ""), enabled: !!userId });
}

/** `staff_mfa_required()` for the signed-in user; only fetched when `enabled` (i.e. for staff). */
export function useStaffMfaRequired(enabled: boolean) {
  const { userId } = useAuth();
  return useQuery({ ...staffMfaRequiredQuery(userId ?? ""), enabled: enabled && !!userId });
}

/** Verifies a 6-digit code against a factor (the challenge, or the first code of an enrollment). */
export function useVerifyTotp() {
  return useMutation({ mutationFn: (vars: { factorId: string; code: string }) => mfaRepo.verify(vars.factorId, vars.code) });
}

/** Removes a factor, then refreshes the factor list. */
export function useUnenrollFactor() {
  const queryClient = useQueryClient();
  const { userId } = useAuth();
  return useMutation({
    mutationFn: (factorId: string) => mfaRepo.unenroll(factorId),
    onSettled: () => queryClient.invalidateQueries({ queryKey: authKeys.mfaFactors(userId ?? "") }),
  });
}

/** Runs enrollment steps one at a time, in order (module-wide: there's one browser session). */
let queue: Promise<unknown> = Promise.resolve();
function enqueue(step: () => Promise<unknown>): Promise<unknown> {
  const next = queue.then(step, step);
  queue = next.catch(() => {});
  return next;
}

export type EnrollmentState =
  { status: "starting" } | { status: "ready"; enrollment: TotpEnrollment } | { status: "error"; error: unknown };

/**
 * Starts a TOTP enrollment when the screen opens: removes abandoned (unverified) factors, then
 * enrolls a new one and returns its QR code and secret. If the screen closes before the first code
 * is verified, the new factor is unenrolled again (best effort; the next enrollment cleans up
 * whatever is left). `markVerified()` keeps it. `restart()` tries again after an error.
 */
export function useTotpEnrollment(friendlyName: string) {
  const [state, setState] = useState<EnrollmentState>({ status: "starting" });
  const [attempt, setAttempt] = useState(0);
  const verified = useRef(false);
  const queryClient = useQueryClient();
  const { userId } = useAuth();

  useEffect(() => {
    let cancelled = false;
    let factorId: string | undefined;
    verified.current = false;
    setState({ status: "starting" });
    // Queued, so an enrollment never overlaps another one or a cleanup (React StrictMode runs this
    // effect twice in development: run 1, its cleanup, run 2 — in that order).
    void enqueue(() =>
      mfaRepo.enrollTotp(friendlyName).then(
        (enrollment) => {
          factorId = enrollment.factorId;
          if (!cancelled) setState({ status: "ready", enrollment });
        },
        (error: unknown) => {
          if (!cancelled) setState({ status: "error", error });
        },
      ),
    );
    return () => {
      cancelled = true;
      void enqueue(async () => {
        if (factorId && !verified.current) await mfaRepo.unenroll(factorId).catch(() => {});
      });
    };
  }, [friendlyName, attempt]);

  return {
    state,
    restart: () => setAttempt((n) => n + 1),
    markVerified: () => {
      verified.current = true;
      void queryClient.invalidateQueries({ queryKey: authKeys.mfaFactors(userId ?? "") });
    },
  };
}
