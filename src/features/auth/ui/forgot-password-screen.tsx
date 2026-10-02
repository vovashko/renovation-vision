import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { AuthCard, AuthCardFooter, AuthCardHeader, AuthScreen } from "@/components/ui/auth-screen";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useZodForm } from "@/shared/hooks/use-zod-form";
import { FormField } from "@/shared/ui/form-field";
import { useCooldown, useRequestPasswordReset } from "../hooks";
import { authErrorCode, type AuthErrorKey } from "../domain/auth-errors";
import { emailFormSchema } from "../domain/schemas";
import { AuthErrorNote, AuthSuccessNote } from "./auth-notes";

const RESET_COOLDOWN_S = 60;
const RATE_LIMITED_OUTCOME = "rate-limited";
const RATE_LIMITED: AuthErrorKey = "auth:errors.rateLimited";

/**
 * Asks for a reset link. Whatever happens (account or not, even most errors) it shows the same
 * "if an account exists, we sent a link" message, so the page can't be used to find out who has an
 * account. Only a rate limit says so, since that answer is the same for every address.
 */
function ForgotPasswordForm() {
  const { t } = useTranslation(["auth", "common"]);
  const form = useZodForm(emailFormSchema, { email: "" });
  const reset = useRequestPasswordReset();
  const cooldown = useCooldown("password-reset", RESET_COOLDOWN_S);
  const [outcome, setOutcome] = useState<"sent" | "rate-limited" | null>(null);

  const submit = form.handleSubmit(async ({ email }) => {
    setOutcome(null);
    try {
      await reset.mutateAsync(email);
    } catch (error) {
      const code = authErrorCode(error);
      if (code?.startsWith("over_") || (error as { status?: unknown })?.status === 429) {
        setOutcome("rate-limited");
        return;
      }
      // Any other failure gets the neutral answer too (see above).
    }
    cooldown.start();
    setOutcome("sent");
  });

  return (
    <form noValidate onSubmit={submit} className="flex flex-col gap-5">
      <FormField control={form.control} name="email" label={t("signIn.email")}>
        {(field) => <Input type="email" autoComplete="email" inputMode="email" {...field} />}
      </FormField>
      {outcome === "sent" && <AuthSuccessNote>{t("forgot.sent")}</AuthSuccessNote>}
      <AuthErrorNote errorKey={outcome === RATE_LIMITED_OUTCOME ? RATE_LIMITED : null} />
      <Button type="submit" size="lg" disabled={reset.isPending || cooldown.remaining > 0}>
        {cooldown.remaining > 0 ? t("forgot.wait", { seconds: cooldown.remaining }) : t("forgot.submit")}
      </Button>
    </form>
  );
}

export function ForgotPasswordScreen() {
  const { t } = useTranslation(["auth"]);
  return (
    <AuthScreen>
      <AuthCard>
        <AuthCardHeader title={t("forgot.title")} description={t("forgot.description")} />
        <ForgotPasswordForm />
        <AuthCardFooter>
          <Button asChild variant="link">
            <Link to="/login">{t("backToSignIn")}</Link>
          </Button>
        </AuthCardFooter>
      </AuthCard>
    </AuthScreen>
  );
}
