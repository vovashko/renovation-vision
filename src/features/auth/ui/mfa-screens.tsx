import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { AuthCard, AuthCardFooter, AuthCardHeader, AuthScreen } from "@/components/ui/auth-screen";
import { Button } from "@/components/ui/button";
import { QrCode, QrSecret } from "@/components/ui/qr-code";
import { useAuth, useSessionRefresh } from "@/lib/auth";
import { useZodForm } from "@/shared/hooks/use-zod-form";
import { FormField } from "@/shared/ui/form-field";
import { useMfaFactors, useTotpEnrollment, useVerifyTotp } from "../hooks";
import { authErrorKey, type AuthErrorKey } from "../domain/auth-errors";
import { safeRedirectTarget } from "../domain/guards";
import { codeFormSchema } from "../domain/schemas";
import { AuthErrorNote, AuthSuccessNote } from "./auth-notes";
import { CodeInput } from "./code-input";

/**
 * The 6-digit code form. On a verified code the session is aal2: refresh the router context (so the
 * next page's guards see it), then go to `target`.
 */
function TotpCodeForm({
  factorId,
  target,
  submitLabel,
  onVerified,
}: {
  factorId: string | undefined;
  target: string;
  submitLabel: string;
  onVerified?: () => void;
}) {
  const { t } = useTranslation(["auth"]);
  const form = useZodForm(codeFormSchema, { code: "" });
  const verify = useVerifyTotp();
  const refresh = useSessionRefresh();
  const navigate = useNavigate();
  const [error, setError] = useState<AuthErrorKey | null>(null);

  const submit = form.handleSubmit(async ({ code }) => {
    if (!factorId) return;
    setError(null);
    try {
      await verify.mutateAsync({ factorId, code });
    } catch (err) {
      setError(authErrorKey(err));
      form.setValue("code", "");
      return;
    }
    onVerified?.();
    await refresh();
    await navigate({ href: target, replace: true });
  });

  return (
    <form noValidate onSubmit={submit} className="flex flex-col gap-5">
      <FormField control={form.control} name="code" label={t("mfa.codeLabel")}>
        {(field) => <CodeInput autoFocus {...field} onComplete={() => void submit()} />}
      </FormField>
      <AuthErrorNote errorKey={error} />
      <Button type="submit" size="lg" disabled={!factorId || verify.isPending || verify.isSuccess}>
        {verify.isPending ? t("mfa.verifying") : submitLabel}
      </Button>
    </form>
  );
}

function SignOutButton() {
  const { t } = useTranslation(["auth"]);
  const { signOut } = useAuth();
  return (
    <Button type="button" variant="link" onClick={() => void signOut()}>
      {t("mfa.signOut")}
    </Button>
  );
}

/** /mfa: the step-up challenge for an aal1 session whose account has a verified TOTP factor. */
export function MfaChallengeScreen({ redirect }: { redirect?: string }) {
  const { t } = useTranslation(["auth"]);
  const factors = useMfaFactors();
  const factor = factors.data?.find((f) => f.status === "verified");
  return (
    <AuthScreen>
      <AuthCard>
        <AuthCardHeader title={t("mfa.challenge.title")} description={t("mfa.challenge.description")} />
        {factors.isError && <AuthErrorNote errorKey={authErrorKey(factors.error)} />}
        <TotpCodeForm factorId={factor?.id} target={safeRedirectTarget(redirect)} submitLabel={t("mfa.challenge.submit")} />
        <AuthCardFooter>
          <SignOutButton />
        </AuthCardFooter>
      </AuthCard>
    </AuthScreen>
  );
}

/** Step 1 of enrollment: the QR code and the secret for typing in by hand. */
function EnrollmentQr({ qrCode, secret }: { qrCode: string; secret: string }) {
  const { t } = useTranslation(["auth"]);
  return (
    <div className="flex flex-col gap-3">
      <p className="text-body-md text-on-surface-variant">{t("mfa.enroll.scan")}</p>
      <QrCode src={qrCode} alt={t("mfa.enroll.qrAlt")} />
      <p className="text-body-sm text-on-surface-variant">{t("mfa.enroll.manual")}</p>
      <QrSecret data-testid="totp-secret">{secret}</QrSecret>
    </div>
  );
}

/**
 * /mfa/enroll: set up an authenticator app. `forced` (staff while 2FA is enforced) hides the way
 * out except signing out; otherwise "Cancel" goes back to `redirect`.
 */
export function MfaEnrollScreen({ redirect, forced }: { redirect?: string; forced: boolean }) {
  const { t } = useTranslation(["auth"]);
  const [friendlyName] = useState(() => t("mfa.enroll.factorName", { date: new Date().toISOString().slice(0, 16).replace("T", " ") }));
  const { state, restart, markVerified } = useTotpEnrollment(friendlyName);
  const target = safeRedirectTarget(redirect);
  return (
    <AuthScreen>
      <AuthCard>
        <AuthCardHeader title={t("mfa.enroll.title")} description={forced ? t("mfa.enroll.required") : t("mfa.enroll.description")} />
        {state.status === "starting" && <AuthSuccessNote>{t("mfa.enroll.starting")}</AuthSuccessNote>}
        {state.status === "error" && (
          <>
            <AuthErrorNote errorKey={authErrorKey(state.error)} />
            <Button type="button" variant="outline" onClick={restart}>
              {t("mfa.enroll.retry")}
            </Button>
          </>
        )}
        {state.status === "ready" && (
          <>
            <EnrollmentQr qrCode={state.enrollment.qrCode} secret={state.enrollment.secret} />
            <TotpCodeForm
              factorId={state.enrollment.factorId}
              target={target}
              submitLabel={t("mfa.enroll.submit")}
              onVerified={markVerified}
            />
          </>
        )}
        <AuthCardFooter>
          {forced ? (
            <SignOutButton />
          ) : (
            <Button asChild variant="link">
              <Link to={target}>{t("mfa.enroll.cancel")}</Link>
            </Button>
          )}
        </AuthCardFooter>
      </AuthCard>
    </AuthScreen>
  );
}
