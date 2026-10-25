import { createFileRoute } from "@tanstack/react-router";
import { InviteAcceptScreen } from "@/features/people/ui/invite-accept-screen";

type AcceptInviteSearch = { token_hash?: string; type?: string };

/**
 * Public: where an invite email lands (`?token_hash=…&type=invite`). The page checks the link without spending it,
 * signs the invitee in with it only on submit (verifyOtp; no PKCE verifier is involved), then accepts the invitation.
 */
export const Route = createFileRoute("/accept-invite")({
  validateSearch: (search: Record<string, unknown>): AcceptInviteSearch => ({
    ...(typeof search.token_hash === "string" ? { token_hash: search.token_hash } : {}),
    ...(typeof search.type === "string" ? { type: search.type } : {}),
  }),
  head: ({ match }) => ({ meta: [{ title: `${match.context.i18n.t("people:invite.accept.title")} — RenoVision` }] }),
  component: AcceptInvitePage,
});

function AcceptInvitePage() {
  const { token_hash, type } = Route.useSearch();
  return <InviteAcceptScreen tokenHash={type === "invite" && token_hash ? token_hash : null} />;
}
