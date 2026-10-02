import { createFileRoute, redirect } from "@tanstack/react-router";
import { hasVerifiedTotp, mfaHref } from "@/features/auth/hooks";
import { safeRedirectTarget } from "@/features/auth/domain/guards";
import { MfaChallengeScreen } from "@/features/auth/ui/mfa-screens";

/** /mfa: the TOTP challenge. Already aal2 → on to the target; no verified factor → enrollment. */
export const Route = createFileRoute("/mfa/")({
  beforeLoad: async ({ context, search }) => {
    const target = safeRedirectTarget(search.redirect);
    if (context.user.aal === "aal2") throw redirect({ href: target, replace: true });
    if (!(await hasVerifiedTotp(context.queryClient, context.user.id))) throw redirect({ href: mfaHref("enroll", target), replace: true });
  },
  head: ({ match }) => ({ meta: [{ title: `${match.context.i18n.t("auth:mfa.challenge.title")} — RenoVision` }] }),
  component: ChallengePage,
});

function ChallengePage() {
  const { redirect } = Route.useSearch();
  return <MfaChallengeScreen redirect={redirect} />;
}
