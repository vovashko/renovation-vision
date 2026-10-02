import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { AuthCard, AuthCardFooter, AuthCardHeader, AuthScreen } from "@/components/ui/auth-screen";
import { Button } from "@/components/ui/button";
import { useSessionRefresh } from "@/lib/auth";
import { useZodForm } from "@/shared/hooks/use-zod-form";
import { useRecoverySession, useUpdatePassword, mfaHref } from "../hooks";
import { authErrorKey, type AuthErrorKey } from "../domain/auth-errors";
import { newPasswordFormSchema } from "../domain/schemas";
import { AuthErrorNote, AuthSuccessNote } from "./auth-notes";
import { NewPasswordFields } from "./new-password-fields";

/** The new-password form. On success the (recovery) session is a normal session: off to the app. */
function ResetPasswordForm() {
  const { t } = useTranslation(["auth"]);
  const form = useZodForm(newPasswordFormSchema, { password: "", confirm: "" });
  const update = useUpdatePassword();
  const refresh = useSessionRefresh();
  const navigate = useNavigate();
  const [error, setError] = useState<AuthErrorKey | null>(null);

  const submit = form.handleSubmit(async ({ password }) => {
    setError(null);
    try {
      await update.mutateAsync({ password });
    } catch (err) {
      setError(authErrorKey(err));
      return;
    }
    // Fresh router context first, so `/`'s guards (incl. the staff 2FA one) see the signed-in user.
    await refresh();
    await navigate({ to: "/", replace: true });
  });

  return (
    <form noValidate onSubmit={submit} className="flex flex-col gap-5">
      <NewPasswordFields control={form.control} />
      <AuthErrorNote errorKey={error} />
      {update.isSuccess && <AuthSuccessNote>{t("reset.done")}</AuthSuccessNote>}
      <Button type="submit" size="lg" disabled={update.isPending || update.isSuccess}>
        {t("reset.submit")}
      </Button>
    </form>
  );
}

const GENERIC: AuthErrorKey = "auth:errors.generic";
const LINK_EXPIRED: AuthErrorKey = "auth:errors.linkExpired";

/** Expired, used or broken link: say so and offer a new one. */
function ResetLinkInvalid({ errorKey }: { errorKey: AuthErrorKey }) {
  const { t } = useTranslation(["auth"]);
  const shown: AuthErrorKey = errorKey === GENERIC ? LINK_EXPIRED : errorKey;
  return (
    <>
      <AuthErrorNote errorKey={shown} />
      <Button asChild size="lg">
        <Link to="/forgot-password">{t("reset.requestNew")}</Link>
      </Button>
    </>
  );
}

/** An account with 2FA: gotrue only accepts the new password from an aal2 session. */
function ResetNeedsMfa() {
  const { t } = useTranslation(["auth"]);
  return (
    <>
      <AuthSuccessNote>{t("reset.needsMfa")}</AuthSuccessNote>
      <Button asChild size="lg">
        <a href={mfaHref("challenge", "/reset-password")}>{t("reset.verify")}</a>
      </Button>
    </>
  );
}

export function ResetPasswordScreen() {
  const { t } = useTranslation(["auth"]);
  const recovery = useRecoverySession();
  return (
    <AuthScreen>
      <AuthCard>
        <AuthCardHeader title={t("reset.title")} description={recovery.status === "ready" ? t("reset.description") : undefined} />
        {recovery.status === "checking" && <AuthSuccessNote>{t("reset.checking")}</AuthSuccessNote>}
        {recovery.status === "invalid" && <ResetLinkInvalid errorKey={recovery.errorKey} />}
        {recovery.status === "needs-mfa" && <ResetNeedsMfa />}
        {recovery.status === "ready" && <ResetPasswordForm />}
        <AuthCardFooter>
          <Button asChild variant="link">
            <Link to="/login">{t("backToSignIn")}</Link>
          </Button>
        </AuthCardFooter>
      </AuthCard>
    </AuthScreen>
  );
}
