import { createFileRoute } from "@tanstack/react-router";
import { ForgotPasswordScreen } from "@/features/auth/ui/forgot-password-screen";

/** Public: asks for a password-reset link (the answer never reveals whether the account exists). */
export const Route = createFileRoute("/forgot-password")({
  head: ({ match }) => ({ meta: [{ title: `${match.context.i18n.t("auth:forgot.title")} — RenoVision` }] }),
  component: ForgotPasswordScreen,
});
