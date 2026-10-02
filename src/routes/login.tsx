import { createFileRoute, redirect } from "@tanstack/react-router";
import { LoginScreen } from "@/features/auth/ui/login-screen";
import { signedInTarget } from "@/features/auth/hooks";

type LoginSearch = { redirect?: string };

/**
 * The public sign-in page. A signed-in visitor goes to `?redirect=` (a same-origin path only) or
 * `/` — through the /mfa challenge first when the session is aal1 and the account has a verified
 * TOTP factor. After signing in here (password, or a sign-in link landing here), AuthSync re-runs
 * this beforeLoad, which does the same.
 */
export const Route = createFileRoute("/login")({
  validateSearch: (search: Record<string, unknown>): LoginSearch =>
    typeof search.redirect === "string" ? { redirect: search.redirect } : {},
  beforeLoad: async ({ context, search }) => {
    const user = context.auth.user;
    if (user) throw redirect({ href: await signedInTarget(context.queryClient, user, search.redirect), replace: true });
  },
  head: ({ match }) => ({ meta: [{ title: `${match.context.i18n.t("auth:signIn.title")} — RenoVision` }] }),
  component: LoginPage,
});

function LoginPage() {
  const { redirect } = Route.useSearch();
  return <LoginScreen redirect={redirect} />;
}
