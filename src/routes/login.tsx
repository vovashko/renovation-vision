import { createFileRoute, redirect } from "@tanstack/react-router";
import { LoginScreen } from "@/components/login-screen";
import { safeRedirectTarget } from "@/features/auth/domain/guards";

type LoginSearch = { redirect?: string };

/**
 * The public sign-in page (the minimal T21 version; T22 builds the full auth screens). A signed-in
 * visitor goes straight to `?redirect=` (a same-origin path only) or `/`; after signing in here,
 * AuthSync re-runs this beforeLoad, which does the same.
 */
export const Route = createFileRoute("/login")({
  validateSearch: (search: Record<string, unknown>): LoginSearch =>
    typeof search.redirect === "string" ? { redirect: search.redirect } : {},
  beforeLoad: ({ context, search }) => {
    if (context.auth.user) throw redirect({ href: safeRedirectTarget(search.redirect), replace: true });
  },
  head: () => ({ meta: [{ title: "Sign in — RenoVision" }] }),
  component: LoginScreen,
});
