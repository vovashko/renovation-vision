import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Note } from "@/components/ui/note";
import { mfaHref, useReauthenticate, useUpdatePassword } from "@/features/auth/hooks";
import { authErrorKey, needsAal2, needsReauthentication, type AuthErrorKey } from "@/features/auth/domain/auth-errors";
import { codeFormSchema, newPasswordFormSchema } from "@/features/auth/domain/schemas";
import { AuthErrorNote, AuthSuccessNote } from "@/features/auth/ui/auth-notes";
import { CodeInput } from "@/features/auth/ui/code-input";
import { NewPasswordFields } from "@/features/auth/ui/new-password-fields";
import { useZodForm } from "@/shared/hooks/use-zod-form";
import { FormField } from "@/shared/ui/form-field";

type Outcome = { kind: "error"; key: AuthErrorKey } | { kind: "aal2" } | { kind: "done" } | null;

/**
 * Step 2, only when gotrue asks for it (`secure_password_change`: a session older than 24 h): the
 * code Supabase Auth just emailed (the `reauthentication` template), sent back as `nonce`.
 */
function ReauthCodeForm({ password, onDone }: { password: string; onDone: (outcome: Outcome) => void }) {
  const { t } = useTranslation(["settings", "auth"]);
  const form = useZodForm(codeFormSchema, { code: "" });
  const update = useUpdatePassword();
  const resend = useReauthenticate();
  const [error, setError] = useState<AuthErrorKey | null>(null);

  const submit = form.handleSubmit(async ({ code }) => {
    setError(null);
    try {
      await update.mutateAsync({ password, nonce: code });
      onDone({ kind: "done" });
    } catch (err) {
      setError(authErrorKey(err));
    }
  });

  return (
    <form noValidate onSubmit={submit} className="flex flex-col gap-4">
      <Note>{t("password.codeSent")}</Note>
      <FormField control={form.control} name="code" label={t("password.codeLabel")}>
        {(field) => <CodeInput autoFocus {...field} />}
      </FormField>
      <AuthErrorNote errorKey={error} />
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={update.isPending}>
          {t("password.submit")}
        </Button>
        <Button type="button" variant="ghost" disabled={resend.isPending} onClick={() => resend.mutate()}>
          {t("password.resend")}
        </Button>
      </div>
    </form>
  );
}

/** Settings → Security: change the password (new + repeat, then the emailed code if gotrue wants one). */
export function ChangePasswordCard({ className }: { className?: string }) {
  const { t } = useTranslation(["settings", "auth"]);
  const form = useZodForm(newPasswordFormSchema, { password: "", confirm: "" });
  const update = useUpdatePassword();
  const reauthenticate = useReauthenticate();
  const [pending, setPending] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<Outcome>(null);

  const finish = (next: Outcome) => {
    setOutcome(next);
    if (next?.kind === "done") {
      setPending(null);
      form.reset();
    }
  };

  const submit = form.handleSubmit(async ({ password }) => {
    setOutcome(null);
    try {
      await update.mutateAsync({ password });
      finish({ kind: "done" });
    } catch (err) {
      if (needsAal2(err)) return setOutcome({ kind: "aal2" });
      if (!needsReauthentication(err)) return setOutcome({ kind: "error", key: authErrorKey(err) });
      try {
        await reauthenticate.mutateAsync();
        setPending(password);
      } catch (sendError) {
        setOutcome({ kind: "error", key: authErrorKey(sendError) });
      }
    }
  });

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>{t("password.title")}</CardTitle>
        <CardDescription>{t("password.description")}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {outcome?.kind === "done" && <AuthSuccessNote>{t("password.changed")}</AuthSuccessNote>}
        {outcome?.kind === "error" && <AuthErrorNote errorKey={outcome.key} />}
        {outcome?.kind === "aal2" && (
          <>
            <Note tone="error">{t("password.needsMfa")}</Note>
            <Button asChild variant="outline" className="self-start">
              <a href={mfaHref("challenge", "/settings/security")}>{t("twoFactor.verifyNow")}</a>
            </Button>
          </>
        )}
        {pending ? (
          <ReauthCodeForm password={pending} onDone={finish} />
        ) : (
          <form noValidate onSubmit={submit} className="flex flex-col gap-4">
            <NewPasswordFields control={form.control} />
            <Button type="submit" className="self-start" disabled={update.isPending || reauthenticate.isPending}>
              {t("password.submit")}
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
