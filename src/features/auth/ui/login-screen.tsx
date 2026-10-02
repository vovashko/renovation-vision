import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import logo from "@/assets/renovision-logo.svg";
import { AuthCard, AuthCardFooter, AuthCardHeader, AuthDivider, AuthScreen } from "@/components/ui/auth-screen";
import { Button } from "@/components/ui/button";
import { FieldGroup } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useZodForm } from "@/shared/hooks/use-zod-form";
import { FormField } from "@/shared/ui/form-field";
import { useCooldown, useEmailLinkSignIn, useSendMagicLink, useSignIn } from "../hooks";
import { authErrorKey, type AuthErrorKey } from "../domain/auth-errors";
import { emailSchema, signInSchema, type SignInValues } from "../domain/schemas";
import { AuthErrorNote, AuthSuccessNote } from "./auth-notes";
import { DemoHint } from "./demo-hint";

const MAGIC_LINK_COOLDOWN_S = 60;

/**
 * Email + password, with "Email me a sign-in link" and "Forgot password?" as secondary actions.
 * Nothing navigates from here: a successful sign-in makes supabase-js emit SIGNED_IN, AuthSync
 * re-runs /login's beforeLoad, and that sends the user to `redirect` (or the /mfa challenge first).
 */
function LoginForm({ redirect }: { redirect?: string }) {
  const { t } = useTranslation(["auth", "common"]);
  const form = useZodForm(signInSchema, { email: "", password: "" });
  const signIn = useSignIn();
  const magicLink = useSendMagicLink();
  const cooldown = useCooldown("magic-link", MAGIC_LINK_COOLDOWN_S);
  const [error, setError] = useState<AuthErrorKey | null>(null);
  const [linkSent, setLinkSent] = useState(false);

  const submit = form.handleSubmit(async (values: SignInValues) => {
    setError(null);
    setLinkSent(false);
    try {
      await signIn.mutateAsync(values);
    } catch (err) {
      setError(authErrorKey(err));
    }
  });

  const sendLink = async () => {
    setError(null);
    setLinkSent(false);
    const email = emailSchema.safeParse(form.getValues("email"));
    if (!email.success) {
      void form.trigger("email");
      return;
    }
    try {
      await magicLink.mutateAsync({ email: email.data, redirect });
      cooldown.start();
      setLinkSent(true);
    } catch (err) {
      setError(authErrorKey(err));
    }
  };

  const busy = signIn.isPending || signIn.isSuccess;
  return (
    <form noValidate onSubmit={submit} className="flex flex-col gap-5">
      <FieldGroup>
        <FormField control={form.control} name="email" label={t("signIn.email")}>
          {(field) => <Input type="email" autoComplete="email" inputMode="email" {...field} />}
        </FormField>
        <FormField control={form.control} name="password" label={t("signIn.password")}>
          {(field) => <Input type="password" autoComplete="current-password" {...field} />}
        </FormField>
      </FieldGroup>
      <AuthErrorNote errorKey={error} />
      {linkSent && <AuthSuccessNote>{t("signIn.magicLinkSent")}</AuthSuccessNote>}
      <Button type="submit" size="lg" disabled={busy}>
        {busy ? t("signIn.submitting") : t("signIn.submit")}
      </Button>
      <AuthDivider>{t("signIn.or")}</AuthDivider>
      <Button type="button" variant="outline" onClick={sendLink} disabled={magicLink.isPending || cooldown.remaining > 0}>
        {cooldown.remaining > 0 ? t("signIn.magicLinkWait", { seconds: cooldown.remaining }) : t("signIn.magicLink")}
      </Button>
    </form>
  );
}

/** A sign-in link that landed here (expired, already used, opened in another browser): its outcome. */
function EmailLinkStatus() {
  const { t } = useTranslation(["auth"]);
  const link = useEmailLinkSignIn();
  if (link.status === "verifying") return <AuthSuccessNote>{t("signIn.verifyingLink")}</AuthSuccessNote>;
  return <AuthErrorNote errorKey={link.errorKey} />;
}

export function LoginScreen({ redirect }: { redirect?: string }) {
  const { t } = useTranslation(["auth"]);
  return (
    <AuthScreen>
      <AuthCard>
        <AuthCardHeader logo={logo} logoAlt={t("signIn.logoAlt")} title={t("signIn.title")} description={t("signIn.subtitle")} />
        <EmailLinkStatus />
        <LoginForm redirect={redirect} />
        <AuthCardFooter>
          <Button asChild variant="link">
            <Link to="/forgot-password">{t("signIn.forgotPassword")}</Link>
          </Button>
        </AuthCardFooter>
      </AuthCard>
      <DemoHint />
    </AuthScreen>
  );
}
