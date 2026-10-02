// Sign-in, magic link, password reset and password change: the hooks behind /login,
// /forgot-password, /reset-password and Settings → Security's password form.
import { useMutation } from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";
import { authRepo } from "../data/auth.repo";
import { mfaRepo } from "../data/mfa.repo";
import { authErrorKey, type AuthErrorKey } from "../domain/auth-errors";
import { hasAuthLink, readAuthLink } from "../domain/auth-link";

export function useSignIn() {
  return useMutation({ mutationFn: (vars: { email: string; password: string }) => authRepo.signInWithPassword(vars.email, vars.password) });
}

export function useSendMagicLink() {
  return useMutation({ mutationFn: (vars: { email: string; redirect?: string }) => authRepo.sendMagicLink(vars.email, vars.redirect) });
}

export function useRequestPasswordReset() {
  return useMutation({ mutationFn: (email: string) => authRepo.requestPasswordReset(email) });
}

/** Sets a new password; `nonce` is the emailed reauthentication code, when gotrue asked for one. */
export function useUpdatePassword() {
  return useMutation({ mutationFn: (vars: { password: string; nonce?: string }) => authRepo.updatePassword(vars.password, vars.nonce) });
}

/** Emails the reauthentication code that a password change on an older session needs. */
export function useReauthenticate() {
  return useMutation({ mutationFn: () => authRepo.reauthenticate() });
}

function readCooldownUntil(storageKey: string): number {
  try {
    return Number(window.localStorage.getItem(storageKey)) || 0;
  } catch {
    return 0; // storage blocked: the in-memory state below still applies
  }
}

/**
 * A client-side cooldown between emails (reset links, sign-in links, codes), remembered across
 * reloads in localStorage. It spares the user Supabase Auth's own email rate limit (a 429 that would
 * otherwise hit everyone on the project); it isn't the protection itself — gotrue enforces that.
 * `remaining` is whole seconds, 0 when sending is allowed.
 */
export function useCooldown(name: string, seconds: number) {
  const storageKey = `rv:cooldown:${name}`;
  const [until, setUntil] = useState(0);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => setUntil(readCooldownUntil(storageKey)), [storageKey]);

  useEffect(() => {
    if (until <= Date.now()) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [until]);

  const start = useCallback(() => {
    const next = Date.now() + seconds * 1000;
    setUntil(next);
    setNow(Date.now());
    try {
      window.localStorage.setItem(storageKey, String(next));
    } catch {
      // storage blocked: the cooldown lasts until a reload
    }
  }, [seconds, storageKey]);

  return { remaining: Math.max(0, Math.ceil((until - now) / 1000)), start };
}

/**
 * For /login: finishes a sign-in link that landed there. A `token_hash` link is verified here; a PKCE
 * `?code=` link is exchanged by the browser client on load, so a code still in the URL once the
 * client is ready means it couldn't be (expired, used, or opened in another browser). gotrue's own
 * error redirect (`#error_code=otp_expired`) shows as an error too. On success supabase-js emits
 * SIGNED_IN and AuthSync sends the user on. `null` means nothing to show.
 */
export function useEmailLinkSignIn(): { status: "idle" | "verifying" | "error"; errorKey: AuthErrorKey | null } {
  const [state, setState] = useState<{ status: "idle" | "verifying" | "error"; errorKey: AuthErrorKey | null }>({
    status: "idle",
    errorKey: null,
  });
  useEffect(() => {
    const link = readAuthLink(window.location.href);
    if (!hasAuthLink(link)) return;
    let cancelled = false;
    const fail = (error: unknown) => !cancelled && setState({ status: "error", errorKey: authErrorKey(error) });
    if (link.error) {
      fail({ code: "otp_expired" });
      return;
    }
    setState({ status: "verifying", errorKey: null });
    void (async () => {
      try {
        if (link.tokenHash && link.type && link.type !== "recovery") {
          await authRepo.verifyEmailLink(link.tokenHash, link.type);
        } else {
          await authRepo.currentSession(); // waits for the browser client's own code exchange
          if (readAuthLink(window.location.href).code) throw { code: "flow_state_not_found" };
        }
        if (!cancelled) setState({ status: "idle", errorKey: null });
      } catch (error) {
        fail(error);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  return state;
}

export type RecoveryState =
  { status: "checking" } | { status: "ready" } | { status: "needs-mfa" } | { status: "invalid"; errorKey: AuthErrorKey };

/**
 * For /reset-password: turns the recovery link into a session, then says what to show.
 * - `?token_hash=…&type=recovery` → verifyOtp;
 * - `?code=…` (the emailed link, PKCE) → the browser client exchanges it on load;
 * - an error in the URL, a code that couldn't be exchanged, or no session at all → "invalid";
 * - a session whose account has 2FA → "needs-mfa": gotrue only lets an aal2 session change the
 *   password of an account with a verified factor, so they verify on /mfa first and come back.
 */
export function useRecoverySession(): RecoveryState {
  const [state, setState] = useState<RecoveryState>({ status: "checking" });
  useEffect(() => {
    let cancelled = false;
    const invalid = (error: unknown) => !cancelled && setState({ status: "invalid", errorKey: authErrorKey(error) });
    void (async () => {
      const link = readAuthLink(window.location.href);
      if (link.error) return invalid({ code: "otp_expired" });
      try {
        if (link.tokenHash) {
          if (link.type !== "recovery") return invalid({ code: "otp_expired" });
          await authRepo.verifyEmailLink(link.tokenHash, "recovery");
        }
        const session = await authRepo.currentSession();
        if (link.code && readAuthLink(window.location.href).code) return invalid({ code: "flow_state_not_found" });
        if (!session) return invalid({ code: "otp_expired" });
        const { currentLevel, nextLevel } = await mfaRepo.assurance();
        if (!cancelled) setState({ status: currentLevel === "aal1" && nextLevel === "aal2" ? "needs-mfa" : "ready" });
      } catch (error) {
        invalid(error);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  return state;
}
