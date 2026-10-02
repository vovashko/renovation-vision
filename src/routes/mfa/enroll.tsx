import { createFileRoute, redirect } from "@tanstack/react-router";
import { hasVerifiedTotp, mfaHref, resolveStaffMfaStep } from "@/features/auth/hooks";
import { safeRedirectTarget } from "@/features/auth/domain/guards";
import { MfaEnrollScreen } from "@/features/auth/ui/mfa-screens";

/**
 * /mfa/enroll: set up TOTP. An aal1 session that already has a verified factor can't add another
 * (gotrue needs aal2 for that), so it goes through the challenge first. `forced` = the staff guard
 * would send this user here anyway (staff, 2FA enforced, no factor): no "Cancel", only sign-out.
 */
export const Route = createFileRoute("/mfa/enroll")({
  beforeLoad: async ({ context, search }) => {
    const { user, queryClient, auth } = context;
    if (user.aal === "aal1" && (await hasVerifiedTotp(queryClient, user.id))) {
      throw redirect({ href: mfaHref("challenge", safeRedirectTarget(search.redirect)), replace: true });
    }
    const forced = (await resolveStaffMfaStep(queryClient, { user, profile: auth.profile })) === "enroll";
    return { forced };
  },
  head: ({ match }) => ({ meta: [{ title: `${match.context.i18n.t("auth:mfa.enroll.title")} — RenoVision` }] }),
  component: EnrollPage,
});

function EnrollPage() {
  const { redirect } = Route.useSearch();
  const { forced } = Route.useRouteContext();
  return <MfaEnrollScreen redirect={redirect} forced={forced} />;
}
