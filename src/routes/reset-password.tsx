import { createFileRoute } from "@tanstack/react-router";
import { ResetPasswordScreen } from "@/features/auth/ui/reset-password-screen";

/**
 * Public: where the recovery email's link lands (`?code=…`, or `?token_hash=…&type=recovery`). The
 * session it carries exists only in the browser until the page has exchanged it, so the page itself
 * (not a beforeLoad) decides between the new-password form and the "link expired" state.
 */
export const Route = createFileRoute("/reset-password")({
  head: ({ match }) => ({ meta: [{ title: `${match.context.i18n.t("auth:reset.title")} — RenoVision` }] }),
  component: ResetPasswordScreen,
});
